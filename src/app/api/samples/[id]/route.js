import { jsonError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";

function clean(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function getFlag(parameter, rawValue) {
  if (rawValue === "" || rawValue === null || rawValue === undefined) return "not-entered";
  const value = Number(rawValue);
  if (!Number.isFinite(value)) return "normal";
  if (Number.isFinite(parameter.normalMin) && value < parameter.normalMin) return "low";
  if (Number.isFinite(parameter.normalMax) && value > parameter.normalMax) return "high";
  return "normal";
}

function buildInvestigationResults(test, rawValues = {}) {
  const missingRequired = [];
  const invalidValues = [];
  const results = test.parameters
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((parameter) => {
      const textValue = clean(rawValues[parameter.key]);
      const numericValue = textValue === "" ? undefined : Number(textValue);

      if (parameter.required && textValue === "") missingRequired.push(parameter.name);
      if (textValue !== "" && !Number.isFinite(numericValue)) invalidValues.push(parameter.name);

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

  return { results, missingRequired, invalidValues };
}

export async function GET(req, { params }) {
  try {
    const auth = requireTenantSession(req, "samples.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "samples.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { id } = await params;
    const { Sample } = await getTenantModels(auth.tenantId);
    const sample = await Sample.findById(id)
      .populate("patient", "name patientId age gender phone")
      .populate("testDefinition")
      .populate("investigations.testDefinition");
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

    const { Sample, TestDefinition, TestReport, BillingRecord } = await getTenantModels(auth.tenantId);
    const sample = await Sample.findById(id).populate("patient", "name patientId age gender phone");
    if (!sample) return Response.json({ error: "Sample not found" }, { status: 404 });

    const handledBy = auth.session.email;
    if (action === "reject") {
      const reason = clean(body.reason || "");
      if (!reason) {
        return Response.json({ error: "Rejection reason is required" }, { status: 400 });
      }

      if (sample.reservedInventory?.length) {
        const { InventoryItem } = await getTenantModels(auth.tenantId);
        for (const res of sample.reservedInventory) {
          if (res.item && res.quantityBase > 0) {
            await InventoryItem.findOneAndUpdate(
              { _id: res.item, reservedBase: { $gte: res.quantityBase } },
              { $inc: { reservedBase: -res.quantityBase } }
            );
          }
        }
        sample.reservedInventory = [];
      }

      sample.transitionStatus("rejected", handledBy, reason);
      sample.rejectionReason = reason;
    } else if (action === "record-results") {
      const rawValues = body.results || {};
      const submittedInvestigations = Array.isArray(body.investigationResults)
        ? body.investigationResults
        : [];
      const groupedInvestigations = sample.investigations?.length
        ? sample.investigations
        : [{
            _id: "legacy",
            billingItemId: sample.billingItemId,
            testDefinition: sample.testDefinition,
            testSnapshot: sample.testSnapshot,
          }];
      const testIds = groupedInvestigations.map((investigation) => investigation.testDefinition?._id || investigation.testDefinition);
      const tests = await TestDefinition.find({ _id: { $in: testIds } }).populate("category", "name");
      const testMap = new Map(tests.map((testDefinition) => [String(testDefinition._id), testDefinition]));
      const completedInvestigations = [];
      const missingRequired = [];
      const invalidValues = [];

      for (const investigation of groupedInvestigations) {
        const testId = investigation.testDefinition?._id || investigation.testDefinition;
        const activeTest = testMap.get(String(testId));
        if (!activeTest || activeTest.status !== "active") {
          return Response.json({ error: "An active test definition was not found for this bill" }, { status: 404 });
        }

        const investigationKey = String(investigation._id || "legacy");
        const submittedInvestigation = submittedInvestigations.find((entry) =>
          String(entry?.investigationId || "") === investigationKey
          || String(entry?.testDefinitionId || "") === String(testId)
        );
        const investigationValues = submittedInvestigation?.values
          || rawValues[investigationKey]
          || (sample.investigations?.length ? {} : rawValues);
        const built = buildInvestigationResults(activeTest, investigationValues);
        missingRequired.push(...built.missingRequired.map((name) => `${activeTest.name}: ${name}`));
        invalidValues.push(...built.invalidValues.map((name) => `${activeTest.name}: ${name}`));
        completedInvestigations.push({ investigation, test: activeTest, results: built.results });
      }

      if (missingRequired.length > 0) {
        return Response.json(
          { error: `Missing required results: ${missingRequired.join(", ")}` },
          { status: 400 }
        );
      }

      if (sample.investigations?.length) {
        for (const completed of completedInvestigations) {
          completed.investigation.results = completed.results;
          completed.investigation.status = "completed";
        }
      }
      if (invalidValues.length > 0) {
        return Response.json(
          { error: `Invalid numeric results: ${invalidValues.join(", ")}` },
          { status: 400 }
        );
      }
      sample.results = completedInvestigations.flatMap(({ test: activeTest, results }) =>
        results.map((result) => ({
          ...result,
          key: `${activeTest.testId || activeTest._id}:${result.key}`,
          name: completedInvestigations.length > 1 ? `${activeTest.name} - ${result.name}` : result.name,
        }))
      );
      sample.notes = notes;
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

      // Handle inventory consumption submitted from the wizard
      const { reservedInventory: wizardInventory } = body;
      if (wizardInventory && Array.isArray(wizardInventory) && wizardInventory.length > 0 && !sample.reservedInventory?.length) {
        const { InventoryItem: InvItem, InventoryUom: InvUom } = await getTenantModels(auth.tenantId);
        const reservations = [];

        for (const reqItem of wizardInventory) {
          const itemId = reqItem.item;
          const uomId = reqItem.uom;
          const qty = Number(reqItem.quantity);
          if (!itemId || !uomId || isNaN(qty) || qty <= 0) continue;

          const [item, uom] = await Promise.all([
            InvItem.findById(itemId),
            InvUom.findById(uomId)
          ]);
          if (!item || !uom) continue;

          const quantityInBase = qty * (uom.conversionToBase || 1);
          const available = (item.stockOnHandBase || 0) - (item.reservedBase || 0);

          if (available >= quantityInBase) {
            await InvItem.findOneAndUpdate(
              { _id: item._id },
              { $inc: { reservedBase: quantityInBase } }
            );
            reservations.push({ item: item._id, quantityBase: quantityInBase, uom: uom._id });
          }
        }

        if (reservations.length > 0) {
          sample.reservedInventory = reservations;
        }
      }
    } else {
      return Response.json({ error: "Invalid action" }, { status: 400 });
    }

    await sample.save();

    if (sample.status === "completed") {
      const { InventoryItem, InventoryMovement, InventoryUom } = await getTenantModels(auth.tenantId);

      if (sample.reservedInventory?.length) {
        for (const res of sample.reservedInventory) {
          const itemDoc = await InventoryItem.findById(res.item);
          if (!itemDoc) continue;

          const deductQty = res.quantityBase;
          let remaining = deductQty;

          const availableBatches = (itemDoc.batches || [])
            .filter((b) => b.status === "available" && b.quantityBase > 0)
            .sort((a, b) => {
              if (!a.expiryDate) return 1;
              if (!b.expiryDate) return -1;
              return new Date(a.expiryDate) - new Date(b.expiryDate);
            });

          for (const batch of availableBatches) {
            if (remaining <= 0) break;
            const batchDeduct = Math.min(remaining, batch.quantityBase);
            remaining -= batchDeduct;

            const batchUpdate = { $inc: { "batches.$.quantityBase": -batchDeduct } };
            if (batch.quantityBase - batchDeduct <= 0) {
              batchUpdate.$set = { "batches.$.status": "consumed" };
            }

            await InventoryItem.findOneAndUpdate(
              { _id: itemDoc._id, "batches._id": batch._id },
              { $inc: { stockOnHandBase: -batchDeduct, reservedBase: -batchDeduct }, ...batchUpdate }
            );

            await InventoryMovement.create({
              item: itemDoc._id,
              batchId: batch._id,
              movementType: "issue",
              quantityBase: -batchDeduct,
              balanceAfterBase: Math.max(0, (itemDoc.stockOnHandBase || 0) - batchDeduct),
              reason: `Auto-consumed for sample ${sample.sampleId}`,
              referenceNo: sample.sampleId,
              performedBy: handledBy,
              movementDate: new Date(),
            });
          }
        }
        sample.reservedInventory = [];
      }

      const reportInvestigations = sample.investigations?.length
        ? sample.investigations.map((investigation) => ({
            billingItemId: investigation.billingItemId,
            testDefinition: investigation.testDefinition,
            testSnapshot: investigation.testSnapshot,
            results: investigation.results,
          }))
        : [{
            billingItemId: sample.billingItemId,
            testDefinition: sample.testDefinition,
            testSnapshot: sample.testSnapshot,
            results: sample.results,
          }];
      const reportSnapshot = reportInvestigations.length > 1
        ? {
            name: `${reportInvestigations.length} investigations`,
            code: sample.billingRecord ? "Bill grouped" : sample.testSnapshot?.code,
            categoryName: "Combined diagnostic report",
            sampleType: sample.sampleType || reportInvestigations.map((item) => item.testSnapshot?.sampleType).filter(Boolean).join(", "),
          }
        : reportInvestigations[0].testSnapshot;

      const existingReport = await TestReport.findOne({ sample: sample._id }).select("_id").lean();
      if (!existingReport) {
        await TestReport.create({
            patient: sample.patient,
            testDefinition: reportInvestigations[0].testDefinition,
            sample: sample._id,
            billingRecord: sample.billingRecord,
            sampleId: sample.sampleId,
            testSnapshot: reportSnapshot,
            results: sample.results,
            investigations: reportInvestigations,
            remarks: sample.notes || "",
            status: "draft",
            enteredBy: handledBy,
            template: "test-report",
            version: 1,
        });
      }

      if (sample.billingRecord) {
        const billingRecord = await BillingRecord.findById(sample.billingRecord);
        if (billingRecord) {
          const completedItemIds = new Set(reportInvestigations.map((item) => String(item.billingItemId)).filter(Boolean));
          for (const item of billingRecord.items) {
            if (completedItemIds.has(String(item._id))) item.status = "reported";
          }
          if (billingRecord.items.every((item) => item.status === "reported")) billingRecord.status = "completed";
          else billingRecord.status = "in-progress";
          await billingRecord.save();
        }
      }
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
