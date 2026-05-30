import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "quality.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "quality.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "";
    const result = searchParams.get("result") || "";

    const query = { tenantId: auth.tenantId };
    if (type) query.type = type;
    if (result) query.result = result;

    const { QcLog } = await getTenantModels(auth.tenantId);
    const logs = await QcLog.find(query).sort({ createdAt: -1 }).limit(200).lean();

    return Response.json({ logs });
  } catch (error) {
    return jsonError("Unable to load QC logs", error, 500);
  }
}

export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "quality.manage");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "quality.view");
    if (moduleAuth.error) return moduleAuth.error;

    const body = await req.json();
    const { type, testName, instrument, lotNumber, result, value, expectedRange, remarks } = body;

    if (!testName?.trim()) return Response.json({ error: "Test name is required" }, { status: 400 });
    if (!result) return Response.json({ error: "Result is required" }, { status: 400 });

    const { QcLog } = await getTenantModels(auth.tenantId);
    const log = await QcLog.create({
      type: type || "qc-run",
      testName: testName.trim(),
      instrument: instrument?.trim(),
      lotNumber: lotNumber?.trim(),
      result,
      value: value?.trim(),
      expectedRange: expectedRange?.trim(),
      remarks: remarks?.trim(),
      enteredBy: auth.session.email,
      tenantId: auth.tenantId,
    });

    return Response.json({ log }, { status: 201 });
  } catch (error) {
    return jsonError("Unable to create QC log", error, 500);
  }
}

export async function DELETE(req) {
  try {
    const auth = requireTenantSession(req, "quality.manage");
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return Response.json({ error: "ID is required" }, { status: 400 });

    const { QcLog } = await getTenantModels(auth.tenantId);
    await QcLog.findOneAndDelete({ _id: id, tenantId: auth.tenantId });

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError("Unable to delete QC log", error, 500);
  }
}
