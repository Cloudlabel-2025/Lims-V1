import { jsonError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

function clean(value) {
  return String(value || "").trim();
}

function getFlag(parameter, rawValue) {
  if (rawValue === "" || rawValue === null || rawValue === undefined) return "not-entered";
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return "normal";
  if (Number.isFinite(parameter.normalMin) && value < parameter.normalMin) return "low";
  if (Number.isFinite(parameter.normalMax) && value > parameter.normalMax) return "high";
  return "normal";
}

export async function GET(req, { params }) {
  try {
    const auth = requireTenantSession(req, "samples.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "samples.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { id } = await params;
    const { Sample } = await getTenantModels(auth.tenantId);
    const sample = await Sample.findById(id).populate("patient", "name patientId age gender phone");
    if (!sample) return Response.json({ error: "Sample not found" }, { status: 404 });

    return Response.json({ sample });
  } catch (error) {
    return jsonError("Unable to fetch sample", error, 500);
  }
}

export async function PUT(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const action = body.action;
    const notes = clean(body.notes || "");

    const actionPermissionMap = {
      "record-results": "samples.update",
    };

    const requiredPermission = actionPermissionMap[action] || "samples.update";
    const auth = requireTenantSession(req, requiredPermission);
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "samples.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { Sample, TestDefinition, TestReport } = await getTenantModels(auth.tenantId);
    const sample = await Sample.findById(id).populate("patient", "name patientId age gender phone");
    if (!sample) return Response.json({ error: "Sample not found" }, { status: 404 });

    const handledBy = auth.session.email;
    let test;

    if (action === "reject") {
      const reason = clean(body.reason || "");
      if (!reason) {
        return Response.json({ error: "Rejection reason is required" }, { status: 400 });
      }
      sample.transitionStatus("rejected", handledBy, reason);
      sample.rejectionReason = reason;
    } else if (action === "record-results") {
      const rawValues = body.results || {};

      test = await TestDefinition.findById(sample.testDefinition).populate("category", "name");
      if (!test || test.status !== "active") {
        return Response.json({ error: "Active test definition not found for this sample" }, { status: 404 });
      }

      const missingRequired = [];
      const results = test.parameters
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((parameter) => {
          const rawValue = rawValues[parameter.key];
          const textValue = clean(rawValue);
          const numericValue = textValue === "" ? undefined : Number(textValue);

          if (parameter.required && textValue === "") {
            missingRequired.push(parameter.name);
          }

          return {
            key: parameter.key,
            name: parameter.name,
            unit: parameter.unit,
            normalMin: parameter.normalMin,
            normalMax: parameter.normalMax,
            required: parameter.required,
            value: Number.isFinite(numericValue) ? numericValue : undefined,
            textValue,
            flag: getFlag(parameter, textValue),
          };
        });

      if (missingRequired.length > 0) {
        return Response.json(
          { error: `Missing required results: ${missingRequired.join(", ")}` },
          { status: 400 }
        );
      }

      sample.results = results;
      try {
        const statusChain = ["registered", "collected", "processing", "completed"];
        const currentIdx = statusChain.indexOf(sample.status);
        if (currentIdx === -1) throw new Error(`Cannot process sample in ${sample.status} status`);
        for (let i = currentIdx; i < statusChain.length - 1; i++) {
          sample.transitionStatus(statusChain[i + 1], handledBy, notes);
        }
      } catch (transitionErr) {
        return Response.json({ error: transitionErr.message }, { status: 400 });
      }
    } else {
      return Response.json({ error: "Invalid action" }, { status: 400 });
    }

    await sample.save();

    if (sample.status === "completed") {
      const testSnapshot = {
        testId: test.testId,
        name: test.name,
        code: test.code,
        categoryName: test.category?.name,
        sampleType: test.sampleType,
      };
      await TestReport.create({
        patient: sample.patient,
        testDefinition: sample.testDefinition,
        sample: sample._id,
        billingRecord: sample.billingRecord,
        sampleId: sample.sampleId,
        testSnapshot,
        results: sample.results,
        status: "draft",
        enteredBy: handledBy,
        template: "test-report",
        version: 1,
      });
    }

    await writeAuditLog(req, auth, {
      action: "samples.completed",
      resourceType: "Sample",
      resourceId: sample._id,
      metadata: { status: sample.status, action },
    });

    await sample.populate("billingRecord", "billId priority status");

    return Response.json({ sample });
  } catch (error) {
    return jsonError("Unable to update sample", error, 500);
  }
}

export async function DELETE(req, { params }) {
  try {
    const auth = requireTenantSession(req, "samples.delete");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "samples.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { id } = await params;
    const { Sample } = await getTenantModels(auth.tenantId);
    const sample = await Sample.findByIdAndDelete(id);
    if (!sample) return Response.json({ error: "Sample not found" }, { status: 404 });

    await writeAuditLog(req, auth, {
      action: "samples.deleted",
      resourceType: "Sample",
      resourceId: id,
      metadata: { sampleId: sample.sampleId },
    });

    return Response.json({ success: true });
  } catch (error) {
    return jsonError("Failed to delete sample", error, 500);
  }
}
