import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit } from "@/lib/rate-limit";
import { MediaUploadError, uploadToCloudinary } from "@/lib/cloudinary";
import { sendEnquiryNotifications } from "@/lib/notifications";
import { databaseErrorResponse, prismaErrorCode } from "@/lib/prisma-errors";

export const runtime = "nodejs";

const schema = z.object({
  submissionId: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(8).max(24).regex(/^[+\d\s().-]+$/),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).optional(),
  projectType: z.string().trim().min(2).max(100),
  location: z.string().trim().max(160).optional(),
  projectArea: z.string().trim().max(100).optional(),
  floors: z.union([z.coerce.number().int().min(1).max(100), z.literal("")]).optional(),
  budget: z.string().trim().max(100).optional(),
  services: z.array(z.string().trim().min(2).max(80)).max(12).default([]),
  timeline: z.string().trim().max(100).optional(),
  message: z.string().trim().max(3000).optional(),
  website: z.string().max(0).optional(),
});

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 5;
const MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 22 * 1024 * 1024) return NextResponse.json({ error: "The complete request must be under 22 MB." }, { status: 413 });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Please submit the enquiry using the project form." }, { status: 400 });
  }

  const files = form.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length > MAX_FILES) return NextResponse.json({ error: "You can attach up to five files." }, { status: 400 });
  if (files.reduce((total, file) => total + file.size, 0) > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "The combined attachment size must be under 20 MB." }, { status: 400 });
  }
  if (files.some((file) => !MIME_TYPES.has(file.type) || file.size > MAX_FILE_BYTES)) {
    return NextResponse.json({ error: "Each attachment must be a PDF, JPG, PNG or WebP file under 10 MB." }, { status: 400 });
  }

  const services = form.getAll("services").map(String);
  const parsed = schema.safeParse({
    submissionId: form.get("submissionId"),
    name: form.get("name"),
    phone: form.get("phone"),
    email: form.get("email") ?? "",
    projectType: form.get("projectType"),
    location: form.get("location") ?? "",
    projectArea: form.get("projectArea") ?? "",
    floors: form.get("floors") ?? "",
    budget: form.get("budget") ?? "",
    services,
    timeline: form.get("timeline") ?? "",
    message: form.get("message") ?? "",
    website: form.get("website") ?? "",
  });
  if (!parsed.success) return NextResponse.json({ error: "Please review the required fields and try again." }, { status: 400 });
  const { website, ...data } = parsed.data;
  if (website) return NextResponse.json({ ok: true });

  try {
    const withinLimit = await consumeRateLimit(request, "public-enquiry", 5);
    if (!withinLimit) return NextResponse.json({ error: "Too many enquiries from this connection. Please try again later." }, { status: 429 });

    const existing = await prisma.enquiry.findUnique({ where: { submissionId: data.submissionId }, select: { id: true } });
    if (existing) return NextResponse.json({ ok: true, id: existing.id, duplicate: true });

    const documents: string[] = [];
    for (const file of files) {
      const asset = await uploadToCloudinary(file, "ns-construction/enquiries", MAX_FILE_BYTES, MIME_TYPES);
      documents.push(asset.secure_url);
    }

    const enquiry = await prisma.enquiry.create({
      data: {
        submissionId: data.submissionId,
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        projectType: data.projectType,
        location: data.location || null,
        projectArea: data.projectArea || null,
        floors: data.floors ? Number(data.floors) : null,
        budget: data.budget || null,
        services: data.services,
        timeline: data.timeline || null,
        message: data.message || null,
        documents,
        emailDeliveryStatus: "PENDING",
      },
    });

    try {
      await prisma.activityLog.create({ data: { action: "ENQUIRY_CREATED", entityType: "ENQUIRY", entityId: enquiry.id, enquiryId: enquiry.id, actorEmail: "website", details: "Project consultation request received." } });
    } catch (error) {
      console.error("Enquiry was saved, but its activity log could not be recorded", { enquiryId: enquiry.id, code: prismaErrorCode(error) || "UNEXPECTED_ERROR" });
    }

    let deliveryStatus = "NOT_CONFIGURED";
    let attempts = 0;
    try {
      const notification = await sendEnquiryNotifications(enquiry);
      deliveryStatus = notification.status;
      attempts = notification.attempts.length;
      if (attempts > 0) {
        await prisma.emailDeliveryAttempt.createMany({
          data: notification.attempts.map((attempt) => ({ enquiryId: enquiry.id, recipient: attempt.recipient, status: attempt.status, providerMessageId: attempt.providerMessageId, error: attempt.error })),
        });
      }
    } catch (error) {
      deliveryStatus = "FAILED";
      console.error("Enquiry was saved, but notification delivery or tracking failed", { enquiryId: enquiry.id, code: prismaErrorCode(error) || "UNEXPECTED_ERROR" });
    }
    try {
      await prisma.enquiry.update({ where: { id: enquiry.id }, data: {
        emailDeliveryStatus: deliveryStatus,
        emailAttempts: attempts ? 1 : 0,
        emailLastAttemptAt: attempts ? new Date() : null,
      } });
    } catch (error) {
      console.error("Enquiry was saved, but its notification status could not be recorded", { enquiryId: enquiry.id, deliveryStatus, code: prismaErrorCode(error) || "UNEXPECTED_ERROR" });
    }
    return NextResponse.json({ ok: true, id: enquiry.id, emailDeliveryStatus: deliveryStatus }, { status: 201 });
  } catch (error) {
    if (error instanceof MediaUploadError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (prismaErrorCode(error) === "P2002") {
      try {
        const duplicate = await prisma.enquiry.findUnique({ where: { submissionId: data.submissionId }, select: { id: true } });
        if (duplicate) return NextResponse.json({ ok: true, id: duplicate.id, duplicate: true });
      } catch (lookupError) {
        console.error("Idempotent enquiry lookup failed", { code: prismaErrorCode(lookupError) || "UNEXPECTED_ERROR" });
      }
    }
    console.error("Project enquiry could not be saved", { code: prismaErrorCode(error) || "UNEXPECTED_ERROR" });
    return NextResponse.json(databaseErrorResponse(error, "We could not save your enquiry right now. Please try again or call us."), { status: 503 });
  }
}
