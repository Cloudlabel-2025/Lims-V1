import { jsonError } from "@/app/lib/api-response";
import { getTenantModels } from "@/app/lib/tenant-db";
import { requireEnabledTenantModule, requireTenantSession } from "@/app/lib/auth";
import { exportCommissions } from "@/app/lib/excel-export";
import { exportCommissionsPdf, generateCsv } from "@/app/lib/pdf-export";

export async function GET(req) {
  try {
    const auth = requireTenantSession(req, "accounts.view");
    if (auth.error) return auth.error;

    const moduleAuth = await requireEnabledTenantModule(auth.tenantId, "doctors.view");
    if (moduleAuth.error) return moduleAuth.error;

    const { searchParams } = new URL(req.url);
    const exportFormat = searchParams.get("export");
    const section = searchParams.get("section") || "both";

    const { connection, Doctor } = await getTenantModels(auth.tenantId);
    const JournalEntry = connection.models.JournalEntry;

    let pendingDoctors = [];
    let payoutHistory = [];

    const fetchPending = section === "both" || section === "pending";
    const fetchHistory = section === "both" || section === "history";

    if (fetchPending) {
      pendingDoctors = await Doctor.find({ pendingPayout: { $gt: 0 } })
        .select("name doctorId commission pendingPayout")
        .sort({ name: 1 })
        .lean();
    }

    if (fetchHistory && JournalEntry) {
      const payouts = await JournalEntry.find({
        tenantId: auth.tenantId,
        sourceType: "commission",
      })
        .sort({ createdAt: -1 })
        .limit(200)
        .lean();

      payoutHistory = await Promise.all(
        payouts.map(async (entry) => {
          let doctor = null;
          if (entry.sourceId) {
            doctor = await Doctor.findById(entry.sourceId)
              .select("name doctorId")
              .lean();
          }
          const line = entry.lines?.[0];
          return {
            _id: entry._id,
            entryNumber: entry.entryNumber,
            date: entry.date || entry.createdAt,
            description: entry.description,
            doctor: doctor
              ? { name: doctor.name, doctorId: doctor.doctorId }
              : null,
            amount: line
              ? Math.abs(Number(line.debit || 0) - Number(line.credit || 0))
              : 0,
          };
        })
      );
    }

    if (exportFormat === "xlsx") {
      const buffer = await exportCommissions(pendingDoctors, payoutHistory);
      return new Response(buffer, {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition":
            'attachment; filename="commissions-report.xlsx"',
        },
      });
    }

    if (exportFormat === "pdf") {
      const buffer = await exportCommissionsPdf(pendingDoctors, payoutHistory);
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition":
            'attachment; filename="commissions-report.pdf"',
        },
      });
    }

    if (exportFormat === "csv") {
      let csv = "";
      if (fetchPending) {
        const pendingHeaders = [
          "Doctor",
          "ID",
          "Commission %",
          "Pending Amount",
        ];
        const pendingRows = pendingDoctors.map((d) => [
          d.name,
          d.doctorId || "-",
          `${d.commission || 0}%`,
          String(d.pendingPayout),
        ]);
        const totalPending = pendingDoctors.reduce(
          (s, d) => s + Number(d.pendingPayout || 0),
          0
        );
        pendingRows.push(["", "Total Pending", "", String(totalPending)]);
        csv = generateCsv(pendingHeaders, pendingRows);
      }
      if (fetchHistory) {
        if (csv) csv += "\n\n";
        const historyHeaders = [
          "Entry",
          "Date",
          "Doctor",
          "Amount",
          "Description",
        ];
        const historyRows = payoutHistory.map((p) => [
          p.entryNumber || "-",
          p.date ? new Date(p.date).toLocaleDateString("en-IN") : "",
          p.doctor?.name || "-",
          String(p.amount),
          p.description || "-",
        ]);
        csv += generateCsv(historyHeaders, historyRows);
      }
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition":
            'attachment; filename="commissions-report.csv"',
        },
      });
    }

    return Response.json({
      pendingDoctors,
      payoutHistory,
    });
  } catch (error) {
    return jsonError("Unable to load commissions report", error, 500);
  }
}
