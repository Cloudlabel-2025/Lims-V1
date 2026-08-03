import { NextResponse } from "next/server";
import { nextJsonError } from "@/app/lib/api-response";
import { requireDeveloperSession } from "@/app/lib/auth";
import connectMasterDB from "@/app/lib/master-db";
import { normalizeEnabledModules } from "@/app/lib/modules";
import { clearTenantConfigCache } from "@/app/lib/tenant-cache";
import { assignLabSubscription, getSubscriptionPackageDefinition } from "@/app/lib/subscription-service";
import { getLabModel } from "@/app/models/master/Lab";
import { getSubscriptionUpgradeRequestModel } from "@/app/models/master/SubscriptionUpgradeRequest";

function serializeRequest(item) {
  return {
    id: String(item._id),
    tenantId: item.tenantId,
    fromPackageName: item.fromPackageName,
    toPackageName: item.toPackageName,
    releaseVersion: "1",
    status: item.status,
    requestedByEmail: item.requestedByEmail || "",
    requestedAt: item.createdAt,
  };
}

function legacyPlanForPackage(pkg) {
  const value = String(pkg.key || "").toLowerCase();
  return ["basic", "standard", "premium"].find((tier) => value === tier || value.startsWith(`${tier}-v-`)) || "custom";
}

export async function GET(req) {
  try {
    const auth = requireDeveloperSession(req);
    if (auth.error) return auth.error;
    const connection = await connectMasterDB();
    const UpgradeRequest = getSubscriptionUpgradeRequestModel(connection);
    const requests = await UpgradeRequest.find({ status: "pending" }).sort({ createdAt: 1 }).limit(50).lean();
    return NextResponse.json({ requests: requests.map(serializeRequest) });
  } catch (error) {
    return nextJsonError("Unable to load upgrade requests", error, 500);
  }
}

export async function PATCH(req) {
  try {
    const auth = requireDeveloperSession(req);
    if (auth.error) return auth.error;
    const body = await req.json();
    const action = body.action === "approve" ? "approve" : body.action === "reject" ? "reject" : "";
    if (!action) return NextResponse.json({ error: "Choose approve or reject" }, { status: 400 });

    const connection = await connectMasterDB();
    const UpgradeRequest = getSubscriptionUpgradeRequestModel(connection);
    const request = await UpgradeRequest.findOne({ _id: body.requestId, status: "pending" });
    if (!request) return NextResponse.json({ error: "Pending upgrade request not found" }, { status: 404 });

    if (action === "approve") {
      const pkg = await getSubscriptionPackageDefinition(request.toPackageKey);
      if (!["1", "1.0"].includes(String(pkg.releaseVersion))) {
        return NextResponse.json({ error: "Only Version 1 packages can be approved from this flow" }, { status: 400 });
      }
      const Lab = getLabModel(connection);
      const lab = await Lab.findOne({ tenantId: request.tenantId });
      if (!lab) return NextResponse.json({ error: "Lab not found" }, { status: 404 });
      const enabledModules = normalizeEnabledModules(pkg.modules);
      lab.subscriptionPlan = legacyPlanForPackage(pkg);
      lab.enabledModules = enabledModules;
      await lab.save();
      await assignLabSubscription({
        tenantId: request.tenantId,
        packageKey: pkg.key,
        legacyPlan: lab.subscriptionPlan,
        modulesOverride: enabledModules,
        status: "active",
        assignedBy: auth.session.userId,
      });
      clearTenantConfigCache(request.tenantId);
    }

    request.status = action === "approve" ? "approved" : "rejected";
    request.reviewedBy = auth.session.userId;
    request.reviewedAt = new Date();
    await request.save();
    return NextResponse.json({ request: serializeRequest(request), message: `Upgrade request ${request.status}` });
  } catch (error) {
    if (error?.name === "CastError") return NextResponse.json({ error: "Invalid upgrade request" }, { status: 400 });
    return nextJsonError("Unable to review upgrade request", error, 500);
  }
}
