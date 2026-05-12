import { getTenantModels } from "@/app/lib/tenant-db";
import { requireTenantSession } from "@/app/lib/auth";

export async function POST(req) {
  try {
    const auth = requireTenantSession(req, "orders.view");
    if (auth.error) return auth.error;

    const { tenantId } = auth;
    const { LabOrder, Doctor, TestReport, TestDefinition } = await getTenantModels(tenantId);
    
    const { orderId, payment, results } = await req.json();

    if (!orderId) {
      return Response.json({ error: "Order ID is required" }, { status: 400 });
    }

    const order = await LabOrder.findById(orderId);
    if (!order) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    if (order.billingStatus === "paid") {
      return Response.json({ error: "Order is already paid" }, { status: 400 });
    }

    // 1. Mark order as paid and save payment details
    order.billingStatus = "paid";
    order.status = "completed";
    order.status = "completed";
    if (payment) {
      order.paymentBreakdown = {
        cash: Number(payment.cash) || 0,
        card: Number(payment.card) || 0,
        online: Number(payment.online) || 0,
      };
    }

    // 2. Process results if provided
    if (results) {
      for (const item of order.items) {
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
              patient: order.patient,
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

    await order.save();

    // 3. If there is a referral doctor and a commission, add it to their pendingPayout
    if (order.referralDoctor && order.commissionAmount > 0) {
      await Doctor.findByIdAndUpdate(order.referralDoctor, {
        $inc: { pendingPayout: order.commissionAmount }
      });
    }

    return Response.json({ 
      message: "Bill closed successfully", 
      orderId: order.orderId,
      paidAmount: order.totalAmount
    });

  } catch (err) {
    console.error("POST /api/orders/close error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
