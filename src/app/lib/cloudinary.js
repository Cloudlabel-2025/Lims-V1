import { v2 as cloudinary } from "cloudinary";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageSizeBytes = Number(process.env.CLOUDINARY_MAX_IMAGE_SIZE_BYTES || 5 * 1024 * 1024);

function assertCloudinaryConfig() {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || "").trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || "").trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary is not configured");
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
}

export function validateImageFile(file) {
  if (!file) {
    throw new Error("Image file is required");
  }

  if (!allowedImageTypes.has(file.type)) {
    throw new Error("Only JPG, PNG, and WEBP images are allowed");
  }

  if (file.size > maxImageSizeBytes) {
    throw new Error(`Image must be smaller than ${Math.floor(maxImageSizeBytes / (1024 * 1024))}MB`);
  }
}

export async function uploadImageToCloudinary(file, { folder, publicIdPrefix }) {
  assertCloudinaryConfig();
  validateImageFile(file);

  const bytes = Buffer.from(await file.arrayBuffer());

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicIdPrefix,
        overwrite: false,
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          originalName: file.name,
          size: file.size,
          mimeType: file.type,
          width: result.width,
          height: result.height,
          uploadedAt: new Date().toISOString(),
        });
      }
    );

    uploadStream.end(bytes);
  });
}
