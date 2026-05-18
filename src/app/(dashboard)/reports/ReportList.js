"use client";

export default function ReportList({ reports, setSelectedReport }) {
  return (
    <aside className="module-panel">
      <div className="module-panel-header">
        <h2>Generated Reports</h2>
        <p>{reports.length} reports available</p>
      </div>
      <div className="test-card-list">
        {reports.map((report) => (
          <article key={report._id} className="test-card" onClick={() => setSelectedReport(report)}>
            <div>
              <h3>{report.testSnapshot?.name}</h3>
              <span>
                {report.patient?.name} Â· {report.reportId}
              </span>
            </div>
            <strong>{report.status}</strong>
          </article>
        ))}
      </div>
    </aside>
  );
}
