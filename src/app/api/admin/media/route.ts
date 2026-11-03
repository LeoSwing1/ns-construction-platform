import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { canManageContent, getAdminOrResponse } from "@/lib/auth";
import { MediaUploadError, uploadToCloudinary } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";
import { databaseErrorResponse, prismaErrorCode } from "@/lib/prisma-errors";

export const runtime = "nodejs";
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function GET() {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  const admin = authorization.admin;
  if (!canManageContent(admin)) return NextResponse.json({ error: "You do not have permission to access the media library." }, { status: 403 });
  try {
    return NextResponse.json(await prisma.mediaAsset.findMany({ orderBy: { createdAt: "desc" }, take: 200 }));
  } catch (error) {
    console.error("Media library could not be loaded", { code: prismaErrorCode(error) || "UNEXPECTED_ERROR" });
    return NextResponse.json(databaseErrorResponse(error, "The media library is temporarily unavailable."), { status: 503 });
  }
}

export async function POST(request: Request) {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  const admin = authorization.admin;
  if (!canManageContent(admin)) return NextResponse.json({ error: "You do not have permission to upload media." }, { status: 403 });
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 9 * 1024 * 1024) return NextResponse.json({ error: "Image must be under 8 MB." }, { status: 413 });
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  }
  const file = formData.get("file");
  const altText = z.string().trim().max(250).safeParse(formData.get("altText") || "");
  if (!(file instanceof File) || !altText.success) return NextResponse.json({ error: "Choose an image and provide valid alt text." }, { status: 400 });

  try {
    const asset = await uploadToCloudinary(file, "ns-construction/projects", 8 * 1024 * 1024, imageTypes);
    const created = await prisma.$transaction(async (transaction) => {
      const record = await transaction.mediaAsset.create({
        data: { publicId: asset.public_id, url: asset.secure_url, secureUrl: asset.secure_url, format: asset.format, bytes: asset.bytes, width: asset.width, height: asset.height, altText: altText.data || null, createdBy: admin.email },
      });
      await transaction.activityLog.create({ data: { action: "MEDIA_UPLOADED", entityType: "MEDIA", entityId: record.id, actorEmail: admin.email, details: `Image uploaded (${asset.format}, ${asset.bytes} bytes).` } });
      return record;
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error instanceof MediaUploadError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Media upload failed", { actor: admin.email, code: prismaErrorCode(error) || "UNEXPECTED_ERROR" });
    return NextResponse.json(databaseErrorResponse(error, "Image upload could not be completed."), { status: 503 });
  }
}

const updateSchema = z.object({ id: z.string().min(1), altText: z.string().trim().max(250) });
export async function PATCH(request: Request) {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  const admin = authorization.admin;
  if (!canManageContent(admin)) return NextResponse.json({ error: "You do not have permission to edit media." }, { status: 403 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Provide an image and valid alternative text." }, { status: 400 });
  try {
    const updated = await prisma.mediaAsset.update({ where: { id: parsed.data.id }, data: { altText: parsed.data.altText || null } });
    await prisma.activityLog.create({ data: { action: "MEDIA_UPDATED", entityType: "MEDIA", entityId: updated.id, actorEmail: admin.email, details: "Image alternative text updated." } });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Media metadata update failed", { code: prismaErrorCode(error) || "UNEXPECTED_ERROR" });
    return prismaErrorCode(error) === "P2025"
      ? NextResponse.json({ error: "Image not found.", code: "RECORD_NOT_FOUND" }, { status: 404 })
      : NextResponse.json(databaseErrorResponse(error, "Image metadata could not be updated."), { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const authorization = await getAdminOrResponse();
  if (authorization.response) return authorization.response;
  const admin = authorization.admin;
  if (!canManageContent(admin)) return NextResponse.json({ error: "You do not have permission to delete media." }, { status: 403 });
  const parsed = z.object({ id: z.string().min(1) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose an image to delete." }, { status: 400 });
  try {
    const asset = await prisma.mediaAsset.findUnique({ where: { id: parsed.data.id } });
    if (!asset) return NextResponse.json({ error: "Image not found." }, { status: 404 });
    const [projectReference, enquiryReference] = await Promise.all([
      prisma.project.findFirst({ where: { OR: [{ coverImage: asset.secureUrl }, { gallery: { has: asset.secureUrl } }] }, select: { id: true } }),
      prisma.enquiry.findFirst({ where: { documents: { has: asset.secureUrl } }, select: { id: true } }),
    ]);
    if (projectReference || enquiryReference) {
      return NextResponse.json({ error: "This image is in use by a project or customer enquiry and cannot be deleted." }, { status: 409 });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) return NextResponse.json({ error: "Cloudinary credentials are not configured." }, { status: 503 });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHash("sha1").update(`public_id=${asset.publicId}&timestamp=${timestamp}${apiSecret}`).digest("hex");
    const body = new FormData();
    body.set("public_id", asset.publicId);
    body.set("timestamp", timestamp);
    body.set("api_key", apiKey);
    body.set("signature", signature);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/destroy`, { method: "POST", body, signal: AbortSignal.timeout(10_000) });
    const result = await response.json() as { result?: string };
    if (!response.ok || result.result !== "ok") {
      console.error("Cloudinary media deletion failed", { status: response.status, providerResult: result.result });
      return NextResponse.json({ error: "The image could not be removed from secure storage." }, { status: 502 });
    }
    await prisma.$transaction([
      prisma.activityLog.create({ data: { action: "MEDIA_DELETED", entityType: "MEDIA", entityId: asset.id, actorEmail: admin.email, details: "Unused image removed from the media library." } }),
      prisma.mediaAsset.delete({ where: { id: asset.id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Media deletion failed", { actor: admin.email, code: prismaErrorCode(error) || "UNEXPECTED_ERROR" });
    return NextResponse.json(databaseErrorResponse(error, "Image deletion could not be completed."), { status: 503 });
  }
}
