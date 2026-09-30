import { jsonError } from "@/app/lib/api-response";
import { requireTenantSession } from "@/app/lib/auth";
import { getTenantModels } from "@/app/lib/tenant-db";

const ALLOWED_CATEGORIES = ["reports", "inventory", "samples", "doctors", "billing", "subscription"];

const DEFAULT_PREFERENCES = {
  reports: true,
  inventory: true,
  samples: true,
  doctors: true,
  billing: true,
  subscription: true,
};

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "dashboard.view");
    if (auth.error) return auth.error;

    const { NotificationPreference } = await getTenantModels(auth.tenantId);
    const prefDoc = await NotificationPreference.findOne({
      tenantId: auth.tenantId,
      $or: [{ userId: auth.session.userId }, { userId: null }],
    })
      .sort({ userId: -1 })
      .lean();

    const preferences = { ...DEFAULT_PREFERENCES, ...(prefDoc?.categories || {}) };

    return Response.json({
      preferences,
      categories: ALLOWED_CATEGORIES.map((key) => ({
        key,
        enabled: preferences[key] !== false,
      })),
    });
  } catch (error) {
    return jsonError("Unable to fetch notification preferences", error, 500);
  }
}

export async function POST(req) {
  try {
    let auth = requireTenantSession(req, "settings.manage");
    if (auth.error) auth = requireTenantSession(req, "dashboard.view");
    if (auth.error) return auth.error;

    const body = await req.json();
    const incoming = body.preferences || body;

    const updatedCategories = { ...DEFAULT_PREFERENCES };
    for (const key of ALLOWED_CATEGORIES) {
      if (typeof incoming[key] === "boolean") {
        updatedCategories[key] = incoming[key];
      }
    }

    const { NotificationPreference } = await getTenantModels(auth.tenantId);
    const saved = await NotificationPreference.findOneAndUpdate(
      { tenantId: auth.tenantId, userId: auth.session.userId },
      {
        $set: {
          categories: updatedCategories,
          tenantId: auth.tenantId,
          userId: auth.session.userId,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    return Response.json({
      ok: true,
      message: "Notification preferences saved successfully",
      preferences: saved.categories || updatedCategories,
    });
  } catch (error) {
    return jsonError("Unable to save notification preferences", error, 500);
  }
}
