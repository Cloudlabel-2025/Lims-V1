import { jsonError } from "@/app/lib/api-response";
import { writeAuditLog } from "@/app/lib/audit";
import { getTenantModels } from "@/app/lib/tenant-db";
import { hasPermission, requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { reserveSampleInventory } from "@/app/lib/sample-inventory";

import { resolveReferenceRange, getFlag } from "@/app/lib/reference-ranges";

function clean(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function buildInvestigationResults(test, rawValues = {}, patient = {}) {
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

      const resolved = resolveReferenceRange(parameter, patient);

      return {
        key: parameter.key,
        name: parameter.name,
        unit: parameter.unit,
        normalMin: Number.isFinite(resolved.min) ? resolved.min : parameter.normalMin,
        normalMax: Number.isFinite(resolved.max) ? resolved.max : parameter.normalMax,
        ageMin: parameter.ageMin,
        ageMax: parameter.ageMax,
        outOfAgeRange: resolved.outOfAgeRange || false,
        ageGap: resolved.ageGap || undefined,
        required: parameter.required,
        value: Number.isFinite(numericValue) ? numericValue : undefined,
        textValue,
        flag: getFlag(parameter, textValue, patient),
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
      .populate({
        path: "testDefinition",
        populate: [
          { path: "requiredInventoryItems.item" },
          { path: "requiredInventoryItems.uom" },
        ],
      })
      .populate({
        path: "investigations.testDefinition",
        populate: [
          { path: "requiredInventoryItems.item" },
          { path: "requiredInventoryItems.uom" },
        ],
      })
      .populate("reservedInventory.item")
      .populate("reservedInventory.uom");
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
      "collect": "samples.collect",
      "record-results": "samples.update",
      "start-processing": "samples.update",
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
    if (action === "collect") {
      if (!hasPermission(auth.session, "samples.collect")) {
        return Response.json(
          { error: "Permission denied: 'samples.collect' permission is required to collect samples" },
          { status: 403 }
        );
      }
      if (sample.status !== "registered") {
        return Response.json({ error: `Cannot collect sample in ${sample.status} status` }, { status: 400 });
      }

      const collectionDate = body.collectionTime ? new Date(body.collectionTime) : new Date();
      if (Number.isNaN(collectionDate.getTime())) {
        return Response.json({ error: "Invalid collection time" }, { status: 400 });
      }
      if (collectionDate > new Date()) {
        return Response.json({ error: "Collection time cannot be in the future" }, { status: 400 });
      }
      if (sample.patient?.dob && collectionDate < new Date(sample.patient.dob)) {
        return Response.json({ error: "Collection time cannot be before date of birth" }, { status: 400 });
      }

      sample.transitionStatus("collected", handledBy, notes || "Sample collected");
      sample.collectionTime = collectionDate;
      if (body.barcode) sample.barcode = String(body.barcode).trim();

      await sample.save();

      await writeAuditLog(req, auth, {
        action: "samples.collected",
        resourceType: "Sample",
        resourceId: sample._id,
        metadata: { sampleId: sample.sampleId, status: sample.status },
      });

      await sample.populate("billingRecord", "billId priority status");
      return Response.json({ sample });
    } else if (action === "reject") {
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
    } else if (action === "start-processing") {
      if (sample.status === "registered" && !hasPermission(auth.session, "samples.collect")) {
        return Response.json(
          { error: "Permission denied: 'samples.collect' permission is required to collect registered samples" },
          { status: 403 }
        );
      }
      if (sample.status === "processing") {
        return Response.json({ sample });
      }
      if (!["registered", "collected"].includes(sample.status)) {
        return Response.json({ error: `Cannot start processing sample in ${sample.status} status` }, { status: 400 });
      }

      // Handle inventory validation and reservation before sample starts processing
      const submittedInventory = Array.isArray(body.reservedInventory)
        ? body.reservedInventory.filter((r) => r.item || r.quantity || r.uom)
        : [];
      let inventoryToReserve = submittedInventory;

      if (!inventoryToReserve.length && !sample.reservedInventory?.length) {
        // Fall back to required inventory items configured on the test definitions
        const groupedInvestigations = sample.investigations?.length
          ? sample.investigations
          : [{ testDefinition: sample.testDefinition }];
        const testIds = groupedInvestigations
          .map((inv) => inv.testDefinition?._id || inv.testDefinition)
          .filter(Boolean);
        const testDocs = await TestDefinition.find({ _id: { $in: testIds } });

        const autoRequired = [];
        for (const td of testDocs) {
          if (Array.isArray(td.requiredInventoryItems)) {
            for (const ri of td.requiredInventoryItems) {
              const rItemId = ri.item?._id || ri.item;
              const rUomId = ri.uom?._id || ri.uom;
              const rQty = Number(ri.quantityPerTest);
              if (rItemId && rUomId && rQty > 0) {
                autoRequired.push({
                  item: rItemId,
                  quantity: rQty,
                  uom: rUomId,
                });
              }
            }
          }
        }
        if (autoRequired.length > 0) {
          inventoryToReserve = autoRequired;
        }
      }

      if (inventoryToReserve.length > 0 && !sample.reservedInventory?.length) {
        const { reservations, error } = await reserveSampleInventory(auth.tenantId, inventoryToReserve);
        if (error) {
          return Response.json({ error: error.message, details: error.details }, { status: error.status });
        }
        if (reservations.length > 0) {
          sample.reservedInventory = reservations;
        }
      }

      if (sample.status === "registered") {
        sample.transitionStatus("collected", handledBy, "Auto-collected on processing start");
      }
      sample.transitionStatus("processing", handledBy, notes || "Processing started");

      if (sample.billingRecord) {
        const billingRecord = await BillingRecord.findById(sample.billingRecord);
        if (billingRecord) {
          const sampleItemIds = new Set(
            (sample.investigations?.length ? sample.investigations : [{ billingItemId: sample.billingItemId }])
              .map((inv) => String(inv.billingItemId))
              .filter(Boolean)
          );
          for (const item of billingRecord.items) {
            if (sampleItemIds.has(String(item._id))) {
              item.status = "processing";
            }
          }
          if (billingRecord.status === "open") {
            billingRecord.status = "in-progress";
          }
          await billingRecord.save();
        }
      }

      await sample.save();

      await writeAuditLog(req, auth, {
        action: "samples.processing_started",
        resourceType: "Sample",
        resourceId: sample._id,
        metadata: { status: sample.status, action },
      });

      await sample.populate("billingRecord", "billId priority status");
      await sample.populate("reservedInventory.item");
      await sample.populate("reservedInventory.uom");

      return Response.json({ sample });
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
        const built = buildInvestigationResults(activeTest, investigationValues, sample.patient);
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

      if (invalidValues.length > 0) {
        return Response.json(
          { error: `Invalid numeric results: ${invalidValues.join(", ")}` },
          { status: 400 }
        );
      }

      if (sample.investigations?.length) {
        for (const completed of completedInvestigations) {
          completed.investigation.results = completed.results;
          completed.investigation.status = "completed";
        }
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
        const { reservations, error } = await reserveSampleInventory(auth.tenantId, wizardInventory);
        if (error) return Response.json({ error: error.message, details: error.details }, { status: error.status });

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
