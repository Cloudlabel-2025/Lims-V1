import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireTenantSession } from "@/app/lib/auth";
import { jsonError } from "@/app/lib/api-response";
import connectMasterDB from "@/app/lib/master-db";
import { getSubscriptionAddonRequestModel } from "@/app/models/master/SubscriptionAddonRequest";
import { getTenantModels } from "@/app/lib/tenant-db";
import { ensureQuotaPeriod } from "@/app/lib/quota-meter";
import { getLabSubscriptionEntitlements } from "@/app/lib/subscription-service";

export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "settings.manage");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const body = await req.json();
    const { addonRequestId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = body;

    if (!addonRequestId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
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
    const SubscriptionAddonRequest = getSubscriptionAddonRequestModel(masterConnection);

    const request = await SubscriptionAddonRequest.findOne({ _id: addonRequestId, tenantId });
    if (!request) {
      return NextResponse.json({ error: "Add-on request not found" }, { status: 404 });
    }

    if (request.status !== "pending") {
      return NextResponse.json({ error: `Request has already been processed with status: ${request.status}` }, { status: 400 });
    }

    if (request.rzpOrderId !== razorpayOrderId) {
      return NextResponse.json({ error: "Order ID mismatch" }, { status: 400 });
    }

    // Now, apply the add-on to the tenant's current QuotaPeriod
    const subscription = await getLabSubscriptionEntitlements(tenantId);
    const { connection, QuotaPeriod } = await getTenantModels(tenantId);
    
    // Ensure quota period exists for the tenant
    const period = await ensureQuotaPeriod(connection, tenantId, subscription);
    const currentQuota = period.quotas[request.quotaKey] || { included: 0, addOn: 0, adjustment: 0 };
    
    const initialLimit = (currentQuota.included || 0) + (currentQuota.addOn || 0) + (currentQuota.adjustment || 0);
    const newLimit = initialLimit + request.units;
    let expiresAt = null;
    if (request.quotaKey !== "staffUsers") {
      expiresAt = period.periodEnd;
    }

    // Mark request as approved and store metrics
    request.status = "approved";
    request.rzpPaymentId = razorpayPaymentId;
    request.initialLimit = initialLimit;
    request.newLimit = newLimit;
    request.expiresAt = expiresAt;
    await request.save();
    
    const quotaPath = `quotas.${request.quotaKey}.addOn`;
    await QuotaPeriod.updateOne(
      { _id: period._id },
      { $inc: { [quotaPath]: request.units } }
    );

    return NextResponse.json({
      success: true,
      message: `Successfully added +${request.units} capacity for ${request.quotaKey}`,
    });

  } catch (err) {
    console.error("POST /api/subscription/addon/confirm error:", err);
    return jsonError("Unable to confirm quota add-on", err, 500);
  }
}
