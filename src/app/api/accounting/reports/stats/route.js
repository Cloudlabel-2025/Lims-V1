import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { exportStatsReport } from "@/app/lib/excel-export";
import { exportStatsPdf, generateCsv } from "@/app/lib/pdf-export";

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "accounts.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "accounts.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { searchParams } = new URL(req.url);
    const exportFormat = searchParams.get("export");

    const { connection, Patient, BillingRecord, Doctor } = await getTenantModels(auth.tenantId);
    const JournalEntry = connection.models.JournalEntry;

    const [totalPatients, labIncomeAgg, pendingCommissionAgg, paidCommissionAgg] = await Promise.all([
      Patient.countDocuments({}),
      BillingRecord.aggregate([
        { $match: { billingStatus: { $in: ["paid", "partial"] } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$totalAmount", 0] } } } },
      ]),
      Doctor.aggregate([
        { $group: { _id: null, total: { $sum: { $ifNull: ["$pendingPayout", 0] } } } },
      ]),
      JournalEntry
        ? JournalEntry.aggregate([
            { $match: { tenantId: auth.tenantId, sourceType: "commission" } },
            { $group: { _id: null, total: { $sum: { $abs: { $subtract: [{ $ifNull: ["$lines.0.debit", 0] }, { $ifNull: ["$lines.0.credit", 0] }] } } } } },
          ])
        : Promise.resolve([]),
    ]);

    const totalLabIncome = labIncomeAgg[0]?.total || 0;
    const totalPendingCommission = pendingCommissionAgg[0]?.total || 0;
    const totalPaidCommission = paidCommissionAgg[0]?.total || 0;

    const stats = {
      totalPatients,
      totalLabIncome,
      totalPendingCommission,
      totalPaidCommission,
      totalCommission: totalPendingCommission + totalPaidCommission,
      generatedAt: new Date().toISOString(),
    };

    if (exportFormat === "xlsx") {
      const buffer = await exportStatsReport(stats);
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="statistics-report.xlsx"',
        },
      });
    }

    if (exportFormat === "pdf") {
      const buffer = await exportStatsPdf(stats);
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="statistics-report.pdf"',
        },
      });
    }

    if (exportFormat === "csv") {
      const rows = [
        ["Total Patients", String(stats.totalPatients)],
        ["Total Lab Income", String(stats.totalLabIncome)],
        ["Total Pending Commission", String(stats.totalPendingCommission)],
        ["Total Paid Commission", String(stats.totalPaidCommission)],
        ["Total Commission", String(stats.totalCommission)],
        ["Generated At", String(stats.generatedAt)],
      ];
      const csv = generateCsv(["Metric", "Value"], rows);
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="statistics-report.csv"',
        },
      });
    }

    return Response.json(stats);
  } catch (error) {
    return jsonError("Unable to load statistics report", error, 500);
  }
}
