import crypto from "node:crypto";
import sharp from "sharp";
import { v2 as cloudinary } from "cloudinary";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
const maxImageSizeBytes = Number(process.env.CLOUDINARY_MAX_IMAGE_SIZE_BYTES || 5 * 1024 * 1024);
const compressionThresholdBytes = 2 * 1024 * 1024;
const defaultUploadTimeoutMs = 30_000;

export class ImageUploadError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "ImageUploadError";
    this.status = status;
  }
}

function getUploadTimeoutMs() {
  const timeout = Number(process.env.CLOUDINARY_UPLOAD_TIMEOUT_MS || defaultUploadTimeoutMs);
  return Number.isFinite(timeout) && timeout > 0 ? timeout : defaultUploadTimeoutMs;
}

function assertCloudinaryConfig() {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || "").trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || "").trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new ImageUploadError(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.",
      500
    );
  }

  return { cloudName, apiKey, apiSecret };
}

function configureCloudinarySdk({ cloudName, apiKey, apiSecret }) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
}

export function validateImageFile(file) {
  if (!file) {
    throw new ImageUploadError("Image file is required", 400);
  }

  if (!allowedImageTypes.has(file.type)) {
    throw new ImageUploadError("Only JPG, PNG, WEBP, and AVIF images are allowed", 400);
  }

  if (file.size > maxImageSizeBytes) {
    throw new ImageUploadError(
      `Image must be smaller than ${Math.floor(maxImageSizeBytes / (1024 * 1024))}MB`,
      400
    );
  }
}

async function compressImageIfNeeded(file) {
  if (file.size <= compressionThresholdBytes) {
    return { buffer: Buffer.from(await file.arrayBuffer()), mimeType: file.type, wasCompressed: false };
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());
  let quality = 80;

  const tryCompress = async (q) =>
    sharp(inputBuffer)
      .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
      .webp({ quality: q })
      .toBuffer({ resolveWithObject: true });

  let { data: outputBuffer, info } = await tryCompress(quality);

  while (outputBuffer.length > compressionThresholdBytes && quality > 20) {
    quality -= 10;
    ({ data: outputBuffer, info } = await tryCompress(quality));
  }

  return { buffer: outputBuffer, mimeType: info.format === "webp" ? "image/webp" : file.type, wasCompressed: true };
}

export async function uploadImageToCloudinary(file, { folder, publicIdPrefix }) {
  validateImageFile(file);
  const cloudinaryConfig = assertCloudinaryConfig();
  const { cloudName, apiKey, apiSecret } = cloudinaryConfig;

  const { buffer, mimeType, wasCompressed } = await compressImageIfNeeded(file);
  const timeoutMs = getUploadTimeoutMs();
  const dataUri = `data:${mimeType};base64,${buffer.toString("base64")}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const uploadParams = {
    folder,
    overwrite: "false",
    public_id: publicIdPrefix,
    timestamp: String(timestamp),
  };
  const signaturePayload = Object.entries(uploadParams)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const signature = crypto
    .createHash("sha1")
    .update(`${signaturePayload}${apiSecret}`)
    .digest("hex");
  const formData = new FormData();
  formData.set("file", dataUri);
  formData.set("api_key", apiKey);
  formData.set("signature", signature);
  for (const [key, value] of Object.entries(uploadParams)) {
    formData.set(key, value);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new ImageUploadError(
        result.error?.message || `Cloudinary upload failed with HTTP ${response.status}`,
        response.status >= 500 ? 502 : 400
      );
    }

    return buildUploadResult(result, file, { wasCompressed, compressedSize: buffer.length });
  } catch (error) {
    if (error instanceof ImageUploadError) throw error;

    const isTimeout =
      error?.name === "AbortError" ||
      error?.code === "ETIMEDOUT" ||
      error?.code === "ESOCKETTIMEDOUT" ||
      /timed?\s*out/i.test(error?.message || "");
    const detail = [
      error?.message,
      error?.http_code ? `Cloudinary HTTP ${error.http_code}` : "",
      error?.name,
      error?.code,
    ]
      .filter(Boolean)
      .join(" - ");

    if (!isTimeout) {
      return uploadImageWithSdk(dataUri, file, { folder, publicIdPrefix, timeoutMs, cloudinaryConfig, wasCompressed, compressedSize: buffer.length });
    }

    throw new ImageUploadError(
      `Cloudinary upload timed out after ${Math.round(timeoutMs / 1000)} seconds. Check network access and Cloudinary credentials.`,
      504
    );
  } finally {
    clearTimeout(timeout);
  }
}

function buildUploadResult(result, file, { wasCompressed, compressedSize } = {}) {
  return {
    url: result.secure_url,
    publicId: result.public_id,
    originalName: file.name,
    size: wasCompressed ? compressedSize : file.size,
    originalSize: file.size,
    wasCompressed: !!wasCompressed,
    mimeType: file.type,
    width: result.width,
    height: result.height,
    uploadedAt: new Date().toISOString(),
  };
}

async function uploadImageWithSdk(
  dataUri,
  file,
  { folder, publicIdPrefix, timeoutMs, cloudinaryConfig, wasCompressed, compressedSize }
) {
  configureCloudinarySdk(cloudinaryConfig);

  try {
    const result = await cloudinary.uploader.upload(dataUri, {
      folder,
      public_id: publicIdPrefix,
      overwrite: false,
      resource_type: "image",
      timeout: timeoutMs,
    });

    return buildUploadResult(result, file, { wasCompressed, compressedSize });
  } catch (error) {
    const isTimeout =
      error?.code === "ETIMEDOUT" ||
      error?.code === "ESOCKETTIMEDOUT" ||
      /timed?\s*out/i.test(error?.message || "");
    const detail = [
      error?.message,
      error?.http_code ? `Cloudinary HTTP ${error.http_code}` : "",
      error?.name,
      error?.code,
    ]
      .filter(Boolean)
      .join(" - ");

    throw new ImageUploadError(
      isTimeout
        ? `Cloudinary upload timed out after ${Math.round(timeoutMs / 1000)} seconds. Check network access and Cloudinary credentials.`
        : detail || "Cloudinary upload failed",
      isTimeout ? 504 : 502
    );
  }
}
