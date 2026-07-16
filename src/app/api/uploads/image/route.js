import { NextResponse } from "next/server";
import { nextJsonError } from "@/app/lib/api-response";
import { requireAnySession } from "@/app/lib/auth";
import { uploadImageToCloudinary } from "@/app/lib/cloudinary";
import { buildUploadTarget } from "@/app/lib/upload-context";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const auth = requireAnySession(req);
    if (auth.error) return auth.error;

    const formData = await req.formData();
    const file = formData.get("file");
    const context = String(formData.get("context") || "attachment");
    const target = buildUploadTarget(auth.session, {
      context,
      tenantId: formData.get("tenantId"),
    });

    if (target.error) {
      return NextResponse.json({ error: target.error }, { status: target.status });
    }

    const image = await uploadImageToCloudinary(file, {
      folder: target.folder,
      publicIdPrefix: target.publicIdPrefix,
    });

    return NextResponse.json({ image });
  } catch (error) {
    console.error("POST /api/uploads/image error:", error.message);

    return nextJsonError("Image upload failed", error, error.status || 400);
  }
}
