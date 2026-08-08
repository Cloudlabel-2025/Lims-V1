import { requireTenantSession } from "@/app/lib/auth";
import { jsonError } from "@/app/lib/api-response";
import connectMasterDB from "@/app/lib/master-db";
import { getLabModel } from "@/app/models/master/Lab";
import { getSubscriptionAddonRequestModel } from "@/app/models/master/SubscriptionAddonRequest";
import { getLabSubscriptionEntitlements } from "@/app/lib/subscription-service";
import { getSubscriptionPackageModel } from "@/app/models/master/SubscriptionPackage";

const ADDON_PACKS = {
  patientRegistrations: { units: 100, amountMinor: 10000, label: "+100 Patients Pack" },
  billingRecords: { units: 250, amountMinor: 12500, label: "+250 Bills Pack" },
  staffUsers: { units: 1, amountMinor: 20000, label: "+1 Staff User Pack" },
};

export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "settings.manage");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const body = await req.json();
    const { quotaKey } = body;

    const masterConnection = await connectMasterDB();
    const Lab = getLabModel(masterConnection);
    const SubscriptionPackage = getSubscriptionPackageModel(masterConnection);
    const SubscriptionAddonRequest = getSubscriptionAddonRequestModel(masterConnection);

    const subscription = await getLabSubscriptionEntitlements(tenantId);
    if (!subscription) {
      return Response.json({ error: "No active subscription found for this lab" }, { status: 404 });
    }

    const pkg = await SubscriptionPackage.findOne({ key: subscription.packageKey }).lean();
    const version = pkg?.versions?.find((item) => item.version === pkg.activeVersion) || pkg?.versions?.at(-1);
    const addonsConfig = version?.addons || {
      patientRegistrations: { units: ADDON_PACKS.patientRegistrations.units, priceMinor: ADDON_PACKS.patientRegistrations.amountMinor },
      billingRecords: { units: ADDON_PACKS.billingRecords.units, priceMinor: ADDON_PACKS.billingRecords.amountMinor },
      staffUsers: { units: ADDON_PACKS.staffUsers.units, priceMinor: ADDON_PACKS.staffUsers.amountMinor },
    };

    const quotaAddonConfig = addonsConfig[quotaKey];
    if (!quotaAddonConfig) {
      return Response.json({ error: "Invalid quota key selected for add-on" }, { status: 400 });
    }

    const pack = {
      units: quotaAddonConfig.units,
      amountMinor: quotaAddonConfig.priceMinor,
      label: `+${quotaAddonConfig.units} ${quotaKey === "patientRegistrations" ? "Patients" : quotaKey === "billingRecords" ? "Bills" : "Staff"} Pack`
    };

    const lab = await Lab.findOne({ tenantId }).select("_id").lean();
    if (!lab) {
      return Response.json({ error: "Lab not found" }, { status: 404 });
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return Response.json({ error: "Razorpay integration is not configured" }, { status: 500 });
    }

    // Create a pending request
    const created = await SubscriptionAddonRequest.create({
      lab: lab._id,
      tenantId,
      quotaKey,
      units: pack.units,
      amountMinor: pack.amountMinor,
      requestedBy: auth.session.userId,
      requestedByEmail: auth.session.email,
    });

    const authHeader = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify({
        amount: pack.amountMinor,
        currency: "INR",
        receipt: String(created._id),
      }),
    });

    if (!rzpRes.ok) {
      const rzpErr = await rzpRes.json();
      await SubscriptionAddonRequest.deleteOne({ _id: created._id });
      return Response.json({ error: rzpErr.error?.description || "Failed to create Razorpay order" }, { status: 500 });
    }

    const rzpOrder = await rzpRes.json();
    created.rzpOrderId = rzpOrder.id;
    await created.save();

    return Response.json({
      request: {
        id: String(created._id),
        quotaKey,
        units: pack.units,
        amount: pack.amountMinor,
        rzpOrderId: rzpOrder.id,
        keyId,
        label: pack.label,
      },
      message: `${pack.label} add-on order created`,
    }, { status: 201 });

  } catch (error) {
    return jsonError("Unable to request quota add-on", error, 500);
  }
}
