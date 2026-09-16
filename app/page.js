"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [date, setDate] = useState("");
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadReports() {
    try {
      const res = await fetch("/api/reports", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to load reports.");

      setReports(data.reports || []);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  async function downloadReport() {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const res = await fetch("/api/download-report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          reportDate: date
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Report download failed.");
      }

      setMessage(
        `Excel downloaded successfully: ${data.report.file_name}`
      );

      loadReports();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function openReport(id) {
    try {
      const res = await fetch(`/api/reports/${id}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Could not open report.");
      }

      window.open(data.url, "_blank");
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <main>
      <div className="card">
        <h1>APDCL RMS Report Downloader</h1>

        <p>
          Select the Daily Performance Report date and download the Excel
          file from APDCL RMS.
        </p>

        <div className="form">
          <div className="field">
            <label>Report Date</label>

            <input
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

        {message && (
          <div className="success">
            {message}
          </div>
        )}

        {error && (
          <div className="error">
            {error}
          </div>
        )}
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
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td>{report.report_date}</td>
                  <td>{report.file_name}</td>
                  <td>{report.status}</td>
                  <td>
                    <button onClick={() => openReport(report.id)}>
                      Open Excel
                    </button>
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
