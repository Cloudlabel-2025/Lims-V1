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
      const { InventoryItem, InventoryMovement, InventoryUom } = await getTenantModels(auth.tenantId);

      const testWithInventory = await TestDefinition.findById(sample.testDefinition)
        .populate("category", "name")
        .populate("requiredInventoryItems.item")
        .populate("requiredInventoryItems.uom");

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
      } else if (testWithInventory?.requiredInventoryItems?.length) {
        for (const reqItem of testWithInventory.requiredInventoryItems) {
          const item = reqItem.item;
          const uom = reqItem.uom;
          if (!item || !uom) continue;

          const quantityInBase = reqItem.quantityPerTest * (uom.conversionToBase || 1);

          if ((item.stockOnHandBase || 0) < quantityInBase) {
            console.warn(`[INVENTORY] Low stock for ${item.name}: needed ${quantityInBase} ${item.baseUom}, have ${item.stockOnHandBase}`);
            continue;
          }

          let remaining = quantityInBase;
          const availableBatches = (item.batches || [])
            .filter((b) => b.status === "available" && b.quantityBase > 0)
            .sort((a, b) => {
              if (!a.expiryDate) return 1;
              if (!b.expiryDate) return -1;
              return new Date(a.expiryDate) - new Date(b.expiryDate);
            });

          for (const batch of availableBatches) {
            if (remaining <= 0) break;
            const deductQty = Math.min(remaining, batch.quantityBase);
            remaining -= deductQty;

            const batchUpdate = { $inc: { "batches.$.quantityBase": -deductQty } };
            if (batch.quantityBase - deductQty <= 0) {
              batchUpdate.$set = { "batches.$.status": "consumed" };
            }

            await InventoryItem.findOneAndUpdate(
              { _id: item._id, "batches._id": batch._id },
              { $inc: { stockOnHandBase: -deductQty }, ...batchUpdate }
            );

            await InventoryMovement.create({
              item: item._id,
              batchId: batch._id,
              movementType: "issue",
              quantityBase: -deductQty,
              balanceAfterBase: Math.max(0, (item.stockOnHandBase || 0) - deductQty),
              reason: `Auto-consumed for sample ${sample.sampleId}`,
              referenceNo: sample.sampleId,
              performedBy: handledBy,
              movementDate: new Date(),
            });
          }

          if (remaining > 0) {
            console.warn(`[INVENTORY] Partial consumption for ${item.name}: ${quantityInBase - remaining}/${quantityInBase} consumed, ${remaining} short`);
          }
        }
      }

      const testSnapshot = {
        testId: testWithInventory.testId,
        name: testWithInventory.name,
        code: testWithInventory.code,
        categoryName: testWithInventory.category?.name,
        sampleType: testWithInventory.sampleType,
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
