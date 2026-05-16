import { getTenantModels } from "@/app/lib/tenant-db";
import { requireTenantSession } from "@/app/lib/auth";

export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "billing.collect");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const { BillingRecord, Doctor, TestReport, TestDefinition } = await getTenantModels(tenantId);
    
    const { billingRecordId, payment, results } = await req.json();

    if (!billingRecordId) {
      return Response.json({ error: "Billing record ID is required" }, { status: 400 });
    }

    const billingRecord = await BillingRecord.findById(billingRecordId);
    if (!billingRecord) {
      return Response.json({ error: "Billing record not found" }, { status: 404 });
    }

    if (billingRecord.billingStatus === "paid") {
      return Response.json({ error: "Bill is already paid" }, { status: 400 });
    }

    billingRecord.billingStatus = "paid";
    billingRecord.status = "completed";
    if (payment) {
      billingRecord.paymentBreakdown = {
        cash: Number(payment.cash) || 0,
        card: Number(payment.card) || 0,
        online: Number(payment.online) || 0,
      };
    }

    // 2. Process results if provided
    if (results) {
      for (const item of billingRecord.items) {
        const itemResults = results[item._id];
        if (itemResults && Object.keys(itemResults).length > 0) {
          const testDef = await TestDefinition.findById(item.testDefinition);
          if (testDef) {
            const reportResults = testDef.parameters.map(param => {
              const val = itemResults[param.key];
              let flag = "normal";
              const numVal = parseFloat(val);
              
              if (!isNaN(numVal)) {
                if (param.normalMin !== undefined && numVal < param.normalMin) flag = "low";
                else if (param.normalMax !== undefined && numVal > param.normalMax) flag = "high";
              }

              return {
                key: param.key,
                name: param.name,
                unit: param.unit,
                normalMin: param.normalMin,
                normalMax: param.normalMax,
                value: isNaN(numVal) ? undefined : numVal,
                textValue: val,
                flag
              };
            });

            await TestReport.create({
              patient: billingRecord.patient,
              testDefinition: testDef._id,
              testSnapshot: item.testSnapshot,
              results: reportResults,
              status: "completed",
              enteredBy: auth.session?.email || "System"
            });

            item.status = "reported";
          }
        }
      }
    }

    await billingRecord.save();

    if (billingRecord.referralDoctor && billingRecord.commissionAmount > 0) {
      await Doctor.findByIdAndUpdate(billingRecord.referralDoctor, {
        $inc: { pendingPayout: billingRecord.commissionAmount }
      });
    }

    return Response.json({ 
      message: "Bill closed successfully", 
      billId: billingRecord.billId,
      paidAmount: billingRecord.totalAmount
    });

  } catch (err) {
    console.error("POST /api/billing/settle error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
