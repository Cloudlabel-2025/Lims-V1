async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

export async function uploadImageDirectToCloudinary(file, { context, tenantId, altText }) {
  const signatureResponse = await fetch("/api/uploads/image/signature", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ context, tenantId }),
  });
  const signatureData = await readJsonResponse(signatureResponse);

  if (!signatureResponse.ok) {
    throw new Error(
      signatureData.details ||
        signatureData.error ||
        "Unable to prepare image upload"
    );
  }

  const upload = signatureData.upload;
  const uploadForm = new FormData();
  uploadForm.append("file", file);
  uploadForm.append("api_key", upload.apiKey);
  uploadForm.append("timestamp", String(upload.timestamp));
  uploadForm.append("signature", upload.signature);
  uploadForm.append("folder", upload.folder);
  uploadForm.append("public_id", upload.publicId);
  uploadForm.append("overwrite", upload.overwrite);

  const cloudinaryResponse = await fetch(upload.uploadUrl, {
    method: "POST",
    body: uploadForm,
  });
  const cloudinaryData = await readJsonResponse(cloudinaryResponse);

  if (!cloudinaryResponse.ok) {
    throw new Error(
      cloudinaryData.error?.message ||
        cloudinaryData.error ||
        "Unable to upload image"
    );
  }

  return {
    url: cloudinaryData.secure_url,
    publicId: cloudinaryData.public_id,
    originalName: file.name,
    size: file.size,
    originalSize: file.size,
    wasCompressed: false,
    mimeType: file.type,
    width: cloudinaryData.width,
    height: cloudinaryData.height,
    uploadedAt: new Date().toISOString(),
    altText,
  };
}
