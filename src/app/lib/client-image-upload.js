async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

export async function uploadImageThroughServer(file, { context, tenantId, altText }) {
  const uploadForm = new FormData();
  uploadForm.append("file", file);
  uploadForm.append("context", context);
  if (tenantId) uploadForm.append("tenantId", tenantId);

  const response = await fetch("/api/uploads/image", {
    method: "POST",
    credentials: "include",
    body: uploadForm,
  });
  const data = await readJsonResponse(response);

  if (!response.ok) {
    throw new Error(
      data.details ||
        data.error ||
        "Unable to upload image"
    );
  }

  return {
    ...data.image,
    altText,
  };
}
