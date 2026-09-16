"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadReports() {
    try {
      const res = await fetch("/api/reports", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load reports.");
      setReports(data.reports || []);
    } catch (e) { setError(e.message); }
  }

  useEffect(() => { loadReports(); }, []);

  async function downloadReport() {
    setLoading(true); setMessage(""); setError("");
    try {
      const res = await fetch("/api/download-report", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Report download failed.");
      setMessage(`Downloaded and saved to Supabase: ${data.report.file_name}`);
      await loadReports();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function openReport(id) {
    try {
      const res = await fetch(`/api/reports/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not open report.");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e) { setError(e.message); }
  }

  return (
    <main>
      <div className="card">
        <h1>APDCL Daily Performance Report</h1>
        <p>Today's date is selected automatically by APDCL.</p>
        <button disabled={loading} onClick={downloadReport}>
          {loading ? "Downloading from APDCL..." : "Download Today's Excel"}
        </button>
        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </div>
      <div className="card">
        <h2>Downloaded Reports</h2>
        {reports.length === 0 ? <p>No reports downloaded yet.</p> : (
          <table>
            <thead><tr><th>Report Date</th><th>File</th><th>Status</th><th>Created</th><th>Action</th></tr></thead>
            <tbody>{reports.map((r) => (
              <tr key={r.id}>
                <td>{r.report_date}</td><td>{r.file_name}</td><td>{r.status}</td>
                <td>{new Date(r.created_at).toLocaleString()}</td>
                <td><button onClick={() => openReport(r.id)}>Open Excel</button></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </main>
  );
}
