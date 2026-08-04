import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireTenantSession } from "@/app/lib/auth";
import { jsonError } from "@/app/lib/api-response";
import connectMasterDB from "@/app/lib/master-db";
import { getLabModel } from "@/app/models/master/Lab";
import { getSubscriptionUpgradeRequestModel } from "@/app/models/master/SubscriptionUpgradeRequest";
import { assignLabSubscription, getSubscriptionPackageDefinition } from "@/app/lib/subscription-service";
import { clearTenantConfigCache } from "@/app/lib/tenant-cache";

export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "settings.manage");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const body = await req.json();
    const { upgradeRequestId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = body;

    if (!upgradeRequestId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return NextResponse.json({ error: "Missing verification parameters" }, { status: 400 });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return NextResponse.json({ error: "Razorpay integration is not configured" }, { status: 500 });
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(razorpayOrderId + "|" + razorpayPaymentId)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      return NextResponse.json({ error: "Invalid payment signature" }, { status: 400 });
    }

    const masterConnection = await connectMasterDB();
    const Lab = getLabModel(masterConnection);
    const UpgradeRequest = getSubscriptionUpgradeRequestModel(masterConnection);

    const request = await UpgradeRequest.findOne({ _id: upgradeRequestId, tenantId });
    if (!request) {
      return NextResponse.json({ error: "Upgrade request not found" }, { status: 404 });
    }

    if (request.status !== "pending") {
      return NextResponse.json({ error: `Request has already been processed with status: ${request.status}` }, { status: 400 });
    }

    if (request.rzpOrderId !== razorpayOrderId) {
      return NextResponse.json({ error: "Order ID mismatch" }, { status: 400 });
    }

    // Load target package configuration to sync Lab modules
    const definition = await getSubscriptionPackageDefinition(request.toPackageKey);

    // Sync master Lab record subscription status and modules
    await Lab.updateOne(
      { tenantId },
      {
        $set: {
          subscriptionPlan: request.toPackageKey,
          enabledModules: definition.modules,
        },
      }
    );

    // Assign the new subscription package entitlements
    await assignLabSubscription({
      tenantId,
      packageKey: request.toPackageKey,
      status: "active",
      assignedBy: auth.session.userId,
    });

    // Mark request as approved
    request.status = "approved";
    request.rzpPaymentId = razorpayPaymentId;
    request.reviewedAt = new Date();
    await request.save();

    // Clear memory tenant config cache to force reloading next page requests
    clearTenantConfigCache(tenantId);

    return NextResponse.json({
      success: true,
      message: `Successfully upgraded to ${request.toPackageName}`,
    });
  } catch (err) {
    console.error("POST /api/subscription/confirm error:", err);
    return jsonError("Unable to confirm subscription upgrade", err, 500);
  }
}
