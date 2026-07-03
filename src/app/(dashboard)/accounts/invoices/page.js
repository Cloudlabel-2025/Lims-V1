"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icons } from "@/app/components/Icons";
import { money, formatDate, inputStyle } from "../_components/helpers";
import Badge from "../_components/Badge";
import Table from "../_components/Table";
import PaginationControls from "../_components/PaginationControls";

const statusColors = {
  paid: ["#ecfdf5", "#047857"],
  partial: ["#fffbeb", "#b45309"],
  unpaid: ["#fef2f2", "#b91c1c"],
  draft: ["var(--surface)", "var(--text-secondary)"],
  confirmed: ["#eff6ff", "#1d4ed8"],
  cancelled: ["#f3f4f6", "#6b7280"],
};

export default function InvoicesPage() {
  const router = useRouter();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [preview, setPreview] = useState(null);
  const printRef = useRef(null);

  const fetchBills = useCallback(async (p) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/billing?page=${p}&limit=20`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setBills(data.billingRecords || []);
      setPagination(data.pagination || { page: p, limit: 20, total: 0, totalPages: 1 });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBills(page); }, [page, fetchBills]);

  async function loadInvoicePreview(billId) {
    try {
      const res = await fetch(`/api/billing/${billId}/invoice`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPreview(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function downloadPdf() {
    if (!printRef.current || !preview) return;
    const { default: jsPDF } = await import("jspdf");
    const { default: html2canvas } = await import("html2canvas");
    const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    let heightLeft = pdfHeight;
    let position = 0;
    const pageHeight = pdf.internal.pageSize.getHeight();
    pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position = heightLeft - pdfHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
    }
    pdf.save(`invoice-${preview.invoiceNumber || "unknown"}.pdf`);
  }

  return (
    <div className="patients-page" style={{ paddingBottom: 40 }}>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div className="page-header-icon" style={{ background: "var(--brand-surface, #e6f0fa)", color: "var(--brand-action, var(--primary))", padding: 12, borderRadius: 8 }}>
            {Icons.report}
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 20, color: "var(--text-main)" }}>Invoices</h4>
            <small style={{ color: "var(--text-muted)" }}>View and download invoices</small>
          </div>
        </div>
        <button type="button" className="btn-lims-secondary" onClick={() => router.push("/accounts")} style={{ height: 38, padding: "0 14px" }}>
          {Icons.arrowLeft} Dashboard
        </button>
      </div>

      {loading ? (
        <div className="form-card" style={{ padding: 28, borderRadius: 8 }}>Loading invoices...</div>
      ) : (
        <>
          <Table
            minWidth={800}
            headings={["Invoice", "Patient", "Amount", "Paid", "Due", "Status", "Date", "Action"]}
            empty="No invoices found."
            rows={bills.map((bill) => {
              const [bg, color] = statusColors[bill.billingStatus] || ["var(--surface)", "var(--text-secondary)"];
              const due = (bill.totalAmount || 0) - (bill.totalPaid || 0);
              return [
                bill.billId || "-",
                bill.patient?.name || "-",
                `Rs ${money(bill.totalAmount)}`,
                `Rs ${money(bill.totalPaid || 0)}`,
                due > 0 ? `Rs ${money(due)}` : "-",
                <span key="status" style={{ background: bg, color, padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800, textTransform: "capitalize" }}>{bill.billingStatus}</span>,
                formatDate(bill.createdAt),
                <button key="view" type="button" className="btn-lims-secondary" onClick={() => loadInvoicePreview(bill._id)} style={{ height: 30, padding: "0 9px", fontSize: 12 }}>{Icons.eye} View</button>,
              ];
            })}
          />
          <PaginationControls pagination={pagination} loading={loading} onPageChange={setPage} />
        </>
      )}

      {preview && (
        <div className="modal-overlay" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "grid", placeItems: "center", zIndex: 1000, overflowY: "auto", padding: 20 }} onClick={() => setPreview(null)}>
          <div style={{ maxWidth: 700, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <div ref={printRef} className="form-card" style={{ padding: 32, borderRadius: 12, display: "grid", gap: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 22 }}>INVOICE</h3>
                  <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>{preview.invoiceNumber}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{preview.patient?.name}</div>
                  {preview.patient?.phone && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{preview.patient.phone}</div>}
                </div>
              </div>

              {preview.items?.length > 0 && (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border)" }}>
                      <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 800 }}>Item</th>
                      <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800 }}>Qty</th>
                      <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800 }}>Price</th>
                      <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.items.map((item, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border-light)" }}>
                        <td style={{ padding: "8px 12px" }}>{item.name || item.test?.name || item.package?.name || "-"}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>{item.quantity || 1}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>Rs {money(item.price || 0)}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>Rs {money((item.price || 0) * (item.quantity || 1))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14, display: "grid", gap: 6, textAlign: "right", fontSize: 14 }}>
                <div>Subtotal: Rs {money(preview.subtotal || 0)}</div>
                {preview.discount > 0 && <div style={{ color: "#b91c1c" }}>Discount: -Rs {money(preview.discount)}</div>}
                {preview.tax > 0 && <div>Tax: Rs {money(preview.tax)}</div>}
                <div style={{ fontSize: 18, fontWeight: 900 }}>Total: Rs {money(preview.totalAmount || 0)}</div>
                {(preview.totalPaid || 0) > 0 && <div style={{ color: "#047857" }}>Paid: Rs {money(preview.totalPaid)}</div>}
                {preview.dueAmount > 0 && <div style={{ color: "#b91c1c" }}>Due: Rs {money(preview.dueAmount)}</div>}
              </div>

              <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                Generated on {preview.issuedAt ? formatDate(preview.issuedAt) : formatDate(new Date())}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
              <button type="button" className="btn-lims-secondary" onClick={() => setPreview(null)} style={{ height: 38, padding: "0 14px" }}>Close</button>
              <button type="button" className="btn-lims-primary" onClick={downloadPdf} style={{ height: 38, padding: "0 14px" }}>{Icons.report} Download PDF</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
