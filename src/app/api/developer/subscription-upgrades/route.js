import mongoose from "mongoose";
import { NextResponse } from "next/server";
import { nextJsonError } from "@/app/lib/api-response";
import { requireDeveloperSession } from "@/app/lib/auth";
import connectMasterDB from "@/app/lib/master-db";
import { normalizeEnabledModules } from "@/app/lib/modules";
import { clearTenantConfigCache } from "@/app/lib/tenant-cache";
import { assignLabSubscription, getSubscriptionPackageDefinition } from "@/app/lib/subscription-service";
import { getLabModel } from "@/app/models/master/Lab";
import { getUserModel } from "@/app/models/tenant/User";
import { getSubscriptionUpgradeRequestModel } from "@/app/models/master/SubscriptionUpgradeRequest";
import { writeAuditLog } from "@/app/lib/audit";

function serializeRequest(item) {
  return {
    id: String(item._id),
    tenantId: item.tenantId,
    fromPackageKey: item.fromPackageKey,
    fromPackageName: item.fromPackageName,
    toPackageKey: item.toPackageKey,
    toPackageName: item.toPackageName,
    releaseVersion: item.toReleaseVersion || "1",
    status: item.status,
    requestedByEmail: item.requestedByEmail || "",
    requestedAt: item.createdAt,
    reviewedBy: item.reviewedBy ? String(item.reviewedBy) : null,
    reviewedAt: item.reviewedAt || null,
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

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status");

    const query = {};
    if (statusParam && statusParam !== "all") {
      query.status = statusParam;
    }

    const connection = await connectMasterDB();
    const UpgradeRequest = getSubscriptionUpgradeRequestModel(connection);
    const requests = await UpgradeRequest.find(query).sort({ createdAt: -1 }).limit(100).lean();
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

      // Enforce staff limit check on plan downgrade or switch
      const staffLimit = pkg.quotas?.staffUsers;
      if (typeof staffLimit === "number" && staffLimit > 0) {
        let tenantConnection = null;
        try {
          tenantConnection = await mongoose
            .createConnection(lab.dbConnectionString, {
              bufferCommands: false,
              maxPoolSize: 5,
              serverSelectionTimeoutMS: 5000,
              dbName: lab.dbName,
            })
            .asPromise();

          const User = getUserModel(tenantConnection);
          const activeStaffCount = await User.countDocuments({ status: "active" });
          if (activeStaffCount > staffLimit) {
            return NextResponse.json(
              {
                error: `Cannot switch to ${pkg.name}: Current active staff count (${activeStaffCount}) exceeds package limit of ${staffLimit}. Please deactivate excess staff first.`,
              },
              { status: 400 }
            );
          }
        } finally {
          if (tenantConnection) {
            await tenantConnection.close();
          }
        }
      }

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

    try {
      await writeAuditLog(req, { tenantId: request.tenantId, session: auth.session }, {
        action: `subscription.upgrade_${action}`,
        resourceType: "SubscriptionUpgradeRequest",
        resourceId: request._id,
        metadata: {
          fromPackage: request.fromPackageName,
          toPackage: request.toPackageName,
          status: request.status,
        },
      });
    } catch {
      // audit log failure is non-blocking
    }

    return NextResponse.json({ request: serializeRequest(request), message: `Upgrade request ${request.status}` });
  } catch (error) {
    if (error?.name === "CastError") return NextResponse.json({ error: "Invalid upgrade request" }, { status: 400 });
    return nextJsonError("Unable to review upgrade request", error, 500);
  }
}
