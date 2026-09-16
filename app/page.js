"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [date, setDate] = useState("");
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadReports() {
    const res = await fetch("/api/reports", { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Could not load reports.");
    setReports(json.reports || []);
  }

  useEffect(() => {
    loadReports().catch((e) => setError(e.message));
  }, []);

  async function downloadReport() {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/download-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportDate: date })
      });

      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Download failed.");

      setMessage(
        `Downloaded ${json.report.file_name} and saved it to Supabase.`
      );

      await loadReports();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function openReport(id) {
    try {
      const res = await fetch(`/api/reports/${id}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not open report.");
      window.open(json.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <main>
      <div className="card">
        <h1>APDCL RMS Report Downloader</h1>
        <p>
          Select a date. The server will log into APDCL RMS, download the
          Daily Performance Report Excel file, save it in Supabase Storage,
          and display it below.
        </p>

        <div className="form">
          <div className="field">
            <label htmlFor="date">Report date</label>
            <input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <button
            disabled={!date || loading}
            onClick={downloadReport}
          >
            {loading ? "Downloading..." : "Download Excel"}
          </button>
        </div>

        {message && <p className="success">{message}</p>}
        {error && <p className="error">{error}</p>}
      </div>

      <div className="card">
        <h2>Downloaded Reports</h2>

        {reports.length === 0 ? (
          <p>No reports downloaded yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>File</th>
                <th>Status</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>{report.report_date}</td>
                  <td>{report.file_name}</td>
                  <td>{report.status}</td>
                  <td>
                    {new Date(report.created_at).toLocaleString()}
                  </td>
                  <td>
                    {report.status === "downloaded" && (
                      <button onClick={() => openReport(report.id)}>
                        Open Excel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
