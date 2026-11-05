import { NextResponse } from "next/server";
import { canManageSettings, getAdminOrResponse } from "@/lib/auth";
import { MediaUploadError, uploadToCloudinary } from "@/lib/cloudinary";
import { logApiError } from "@/lib/api-errors";

export const runtime = "nodejs";
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const auth = await getAdminOrResponse();
  if (auth.response) return auth.response;
  if (!canManageSettings(auth.admin)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 34 * 1024 * 1024) return NextResponse.json({ error: "Upload up to four site photos, each under 8 MB." }, { status: 413 });
  try {
    const form = await request.formData();
    const files = form.getAll("photos").filter((entry): entry is File => entry instanceof File);
    if (!files.length || files.length > 4) return NextResponse.json({ error: "Choose between one and four photos." }, { status: 400 });
    const assets = await Promise.all(files.map((file) => uploadToCloudinary(file, "ns-construction/site-reports", 8 * 1024 * 1024, imageTypes)));
    return NextResponse.json({ photos: assets.map((asset) => asset.secure_url) }, { status: 201 });
  } catch (error) {
    if (error instanceof MediaUploadError) return NextResponse.json({ error: error.message }, { status: error.status });
    logApiError("/api/admin/operations/photos POST", error);
    return NextResponse.json({ error: "Site photos could not be uploaded." }, { status: 502 });
  }
}
