import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { decimal, newQuotationNumber, QuotationInputError, QuotationNotFoundError } from "@/lib/quotations";
import type { quotationSubmissionSchema } from "@/lib/quotations";
import type { z } from "zod";

type QuotationSubmission = z.infer<typeof quotationSubmissionSchema>;
type Estimate = Awaited<ReturnType<typeof import("@/lib/quotations").calculateEstimate>>;

export async function createQuotationRecord(
  data: QuotationSubmission,
  estimate: Estimate,
  actorEmail: string,
  linkedEnquiryId?: string,
) {
  const digits = data.phone.replace(/\D/g, "");
  const canonicalPhone = `+${digits}`;
  const issuedAt = new Date();
  const validUntil = new Date(issuedAt.getTime() + estimate.validityDays * 24 * 60 * 60 * 1000);
  const quotationNo = newQuotationNumber();
  const publicToken = randomBytes(32).toString("base64url");
  const publicTokenHash = createHash("sha256").update(publicToken).digest("hex");

  const quotation = await prisma.$transaction(async (transaction) => {
    const customer = await transaction.customer.upsert({
      where: { phone: canonicalPhone },
      create: { name: data.name, phone: canonicalPhone, email: data.email || null, siteLocation: data.siteLocation },
      update: { name: data.name, email: data.email || null, siteLocation: data.siteLocation },
    });

    let matchedEnquiry;
    if (linkedEnquiryId) {
      matchedEnquiry = await transaction.enquiry.findUnique({
        where: { id: linkedEnquiryId },
        select: { id: true, phone: true, email: true, status: true },
      });
      if (!matchedEnquiry) throw new QuotationNotFoundError("The selected CRM enquiry could not be found.");
      const samePhone = matchedEnquiry.phone.replace(/\D/g, "") === digits;
      const sameEmail = Boolean(data.email && matchedEnquiry.email?.toLowerCase() === data.email.toLowerCase());
      if (!samePhone && !sameEmail) throw new QuotationInputError("The quotation customer must match the selected enquiry.");
    } else {
      const candidates = await transaction.enquiry.findMany({
        where: {
          OR: [
            { phone: { in: [data.phone, canonicalPhone] } },
            ...(data.email ? [{ email: { equals: data.email, mode: "insensitive" as const } }] : []),
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, phone: true, email: true, status: true },
      });
      matchedEnquiry = candidates.find((candidate) =>
        candidate.phone.replace(/\D/g, "") === digits
        || Boolean(data.email && candidate.email?.toLowerCase() === data.email.toLowerCase()),
      );
    }

    const enquiry = matchedEnquiry
      ? await transaction.enquiry.update({
        where: { id: matchedEnquiry.id },
        data: {
          customerId: customer.id,
          ...(matchedEnquiry.status !== "WON" && matchedEnquiry.status !== "LOST" ? { status: "QUOTED" as const } : {}),
        },
      })
      : await transaction.enquiry.create({
        data: {
          submissionId: data.submissionId,
          customerId: customer.id,
          name: data.name,
          phone: data.phone,
          email: data.email || null,
          projectType: data.propertyType,
          location: data.siteLocation,
          projectArea: `${data.constructionAreaSqFt} sq. ft.`,
          floors: data.floors,
          status: "QUOTED",
          source: actorEmail === "customer quotation builder" ? "Quotation Builder" : "Admin Quotation",
          message: data.requirements || null,
        },
      });

    const record = await transaction.quotation.create({
      data: {
        quotationNo,
        submissionId: data.submissionId,
        publicTokenHash,
        customerId: customer.id,
        enquiryId: enquiry.id,
        packageId: estimate.packageId,
        status: "DRAFT",
        propertyType: data.propertyType,
        siteLocation: data.siteLocation,
        plotAreaSqFt: data.plotAreaSqFt === null ? null : decimal(data.plotAreaSqFt),
        constructionAreaSqFt: decimal(data.constructionAreaSqFt),
        floors: data.floors,
        requirements: data.requirements,
        baseRatePerSqFt: decimal(estimate.baseRatePerSqFt),
        upgradeRatePerSqFt: decimal(estimate.upgradeRatePerSqFt),
        applicableRatePerSqFt: decimal(estimate.applicableRatePerSqFt),
        subtotal: decimal(estimate.subtotal),
        gstRate: estimate.gstRate === null ? null : decimal(estimate.gstRate),
        gstAmount: decimal(estimate.gstAmount),
        additionalCharges: estimate.additionalCharges,
        totalAmount: decimal(estimate.totalAmount),
        inclusions: estimate.inclusions,
        exclusions: estimate.exclusions,
        paymentMilestones: estimate.paymentMilestones,
        validityDays: estimate.validityDays,
        issuedAt,
        validUntil,
        items: {
          create: estimate.items.map((item) => ({
            specificationId: item.specificationId,
            categoryName: item.categoryName,
            specificationName: item.specificationName,
            quality: item.quality,
            brand: item.brand,
            details: item.details,
            adjustmentPerSqFt: decimal(item.adjustmentPerSqFt),
            includedInPackage: item.includedInPackage,
          })),
        },
        revisions: {
          create: {
            revision: 1,
            snapshot: {
              quotationNo,
              customer: { name: data.name, phone: data.phone, email: data.email || null },
              project: { propertyType: data.propertyType, siteLocation: data.siteLocation, plotAreaSqFt: data.plotAreaSqFt, constructionAreaSqFt: data.constructionAreaSqFt, floors: data.floors, requirements: data.requirements },
              estimate,
            },
            actorEmail,
          },
        },
        activities: {
          create: { action: "QUOTATION_CREATED", details: "Indicative construction estimate created.", actorEmail },
        },
      },
    });
    await transaction.activityLog.create({
      data: {
        action: "QUOTATION_CREATED",
        entityType: "ENQUIRY",
        entityId: enquiry.id,
        enquiryId: enquiry.id,
        actorEmail,
        details: `Indicative quotation ${quotationNo} created and linked to this lead.`,
      },
    });
    return record;
  });

  return { quotation, quotationUrl: `/quote/${publicToken}` };
}
