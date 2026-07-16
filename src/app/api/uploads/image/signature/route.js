import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";
import { nextJsonError } from "@/app/lib/api-response";
import { requireAnySession } from "@/app/lib/auth";
import { buildUploadTarget } from "@/app/lib/upload-context";

export const runtime = "nodejs";

function getCloudinarySigningConfig() {
  const cloudName = String(process.env.CLOUDINARY_CLOUD_NAME || "").trim();
  const apiKey = String(process.env.CLOUDINARY_API_KEY || "").trim();
  const apiSecret = String(process.env.CLOUDINARY_API_SECRET || "").trim();

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary is not configured");
  }

  return { cloudName, apiKey, apiSecret };
}

export async function POST(req) {
  try {
    const auth = requireAnySession(req);
    if (auth.error) return auth.error;

    const body = await req.json();
    const target = buildUploadTarget(auth.session, {
      context: body.context,
      tenantId: body.tenantId,
    });

    if (target.error) {
      return NextResponse.json({ error: target.error }, { status: target.status });
    }

    const { cloudName, apiKey, apiSecret } = getCloudinarySigningConfig();
    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign = {
      folder: target.folder,
      overwrite: "false",
      public_id: target.publicIdPrefix,
      timestamp,
    };
    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

    return NextResponse.json({
      upload: {
        cloudName,
        apiKey,
        timestamp,
        signature,
        folder: target.folder,
        publicId: target.publicIdPrefix,
        overwrite: "false",
        uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      },
    });
  } catch (error) {
    console.error("POST /api/uploads/image/signature error:", error.message);
    return nextJsonError("Unable to prepare image upload", error, 500);
  }
}
