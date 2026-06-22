import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireTenantSession } from "@/app/lib/auth";

export async function GET(req, { params }) {
  try {
    const auth = requireTenantSession(req, "corporate_accounts.view");
    if (auth.error) return auth.error;

    const { id } = await params;

    const { CorporateAccount, BillingRecord } = await getTenantModels(auth.tenantId);
    const account = await CorporateAccount.findById(id);
    if (!account) return Response.json({ error: "Corporate account not found" }, { status: 404 });

    const transactions = await BillingRecord.find({
      "paymentMeta.corporateAccountId": account._id,
    })
      .select("receiptNumber totalAmount totalPaid dueAmount status paymentMethod createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return Response.json({
      account: {
        name: account.name,
        accountCode: account.accountCode,
        creditLimit: account.creditLimit,
        outstandingBalance: account.outstandingBalance,
        status: account.status,
      },
      transactions: transactions.map((t) => ({
        id: t._id,
        receiptNumber: t.receiptNumber,
        date: t.createdAt,
        amount: t.totalAmount,
        paid: t.totalPaid,
        balance: t.dueAmount,
        status: t.status,
        paymentMethod: t.paymentMethod,
      })),
      totalOutstanding: account.outstandingBalance,
    });
  } catch (error) {
    return jsonError("Unable to fetch statement", error, 500);
  }
}
