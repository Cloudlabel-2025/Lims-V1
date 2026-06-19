import { jsonError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
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
    const { type, instrument, lotNumber, result, value, expectedRange, remarks } = body;
    const sampleId = String(body.sample || "").trim();
    let testName = String(body.testName || "").trim();

    const { QcLog, Sample, BillingRecord } = await getTenantModels(auth.tenantId);
    let sample = null;
    if (sampleId) {
      sample = await Sample.findById(sampleId);
      if (!sample) return Response.json({ error: "Sample not found" }, { status: 404 });
      testName = testName || sample.testSnapshot?.name || "";
    }

    if (!testName) return Response.json({ error: "Test name is required" }, { status: 400 });
    if (!result) return Response.json({ error: "Result is required" }, { status: 400 });

    const log = await QcLog.create({
      type: type || "qc-run",
      testName,
      instrument: instrument?.trim(),
      lotNumber: lotNumber?.trim(),
      result,
      value: value?.trim(),
      expectedRange: expectedRange?.trim(),
      remarks: remarks?.trim(),
      enteredBy: auth.session.email,
      sample: sample?._id,
      billingRecord: sample?.billingRecord,
      testDefinition: sample?.testDefinition,
      tenantId: auth.tenantId,
    });

    if (sample && result === "fail") {
      sample.status = "rejected";
      sample.rejectionReason = remarks?.trim() || "QC failed";
      await sample.save();

      const billingRecord = await BillingRecord.findById(sample.billingRecord);
      const item = billingRecord?.items.id(sample.billingItemId);
      if (item) {
        item.status = "cancelled";
        billingRecord.status = "in-progress";
        await billingRecord.save();
      }
    }

    await writeAuditLog(req, auth, {
      action: result === "pass" ? "quality.qc_passed" : result === "fail" ? "quality.qc_failed" : "quality.create",
      resourceType: "QcLog",
      resourceId: log._id,
      metadata: { sampleId: sample?._id, result },
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
