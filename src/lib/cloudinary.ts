import { createHash, randomUUID } from "node:crypto";

const MIME_SIGNATURES: Record<string, (bytes: Uint8Array) => boolean> = {
  "image/jpeg": (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/png": (bytes) => bytes.subarray(0, 8).join(",") === "137,80,78,71,13,10,26,10",
  "image/webp": (bytes) => String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP",
  "application/pdf": (bytes) => String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-",
};

export class MediaUploadError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "MediaUploadError";
  }
}

export type CloudinaryAsset = {
  public_id: string;
  secure_url: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
};

export async function uploadToCloudinary(file: File, folder: string, maxBytes: number, allowedTypes: Set<string>) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new MediaUploadError("Secure file uploads are not configured. Please submit without attachments or contact us directly.", 503);
  }
  if (file.size === 0 || file.size > maxBytes || !allowedTypes.has(file.type)) {
    throw new MediaUploadError("A file is too large or uses an unsupported format.", 400);
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  if (!MIME_SIGNATURES[file.type]?.(buffer)) {
    throw new MediaUploadError("A file has an unsupported or invalid format.", 400);
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const publicId = randomUUID();
  const signatureBase = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
  const signature = createHash("sha1").update(signatureBase).digest("hex");
  const payload = new FormData();
  payload.set("file", new Blob([buffer], { type: file.type }), file.name);
  payload.set("api_key", apiKey);
  payload.set("timestamp", timestamp);
  payload.set("folder", folder);
  payload.set("public_id", publicId);
  payload.set("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/auto/upload`, {
    method: "POST",
    body: payload,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    console.error("Cloudinary upload failed", { status: response.status, folder });
    throw new MediaUploadError("A file could not be uploaded. Please try again.", 502);
  }
  const result = await response.json() as CloudinaryAsset;
  if (!result.public_id || !result.secure_url || !result.format || typeof result.bytes !== "number") {
    throw new MediaUploadError("The media provider returned an invalid upload response.", 502);
  }
  return result;
}
