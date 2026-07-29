import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getEngagementMetrics } from "../api/admin";

export function EngagementPage() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d">("30d");
  const query = useQuery({ queryKey: ["engagement", period], queryFn: () => getEngagementMetrics(period) });
  const data = query.data;

  return (
    <section>
      <h1 className="page-title">Engagement</h1>
      <p className="page-subtitle">
        Proxy metrics derived from chat sessions and signups -- there is no per-screen event pipeline yet, so this is
        engagement-via-Patricia, not full feature adoption. See the note below the chart.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {(["7d", "30d", "90d"] as const).map((p) => (
          <button key={p} className={period === p ? "button-primary" : "button-secondary"} onClick={() => setPeriod(p)} type="button">
            {p}
          </button>
        ))}
      </div>

      <div className="card-grid">
        <div className="card"><div className="card-label">Total users</div><div className="card-value">{data?.metrics.totalUsers ?? "..."}</div></div>
        <div className="card"><div className="card-label">Avg daily active (chat)</div><div className="card-value">{data?.metrics.avgDau ?? "..."}</div></div>
        <div className="card"><div className="card-label">Chat sessions (period)</div><div className="card-value">{data?.metrics.totalChatSessionsInPeriod ?? "..."}</div></div>
        <div className="card"><div className="card-label">Avg session length (msgs)</div><div className="card-value">{data?.metrics.avgSessionLength ?? "..."}</div></div>
        <div className="card"><div className="card-label">New users (period)</div><div className="card-value">{data?.metrics.newUsersInPeriod ?? "..."}</div></div>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <div className="panel-header"><h2>Daily active trend</h2></div>
        {query.isLoading ? <p className="muted">Loading...</p> : null}
        {data ? (
          <table className="table">
            <thead><tr><th>Date</th><th>Active (chat)</th></tr></thead>
            <tbody>
              {data.dauTrend.map((row) => (
                <tr key={row.date}>
                  <td>{row.date}</td>
                  <td>
                    <div style={{ background: "#e6f7fa", height: 8, width: `${Math.max(4, row.dau * 10)}px`, borderRadius: 4, display: "inline-block", marginRight: 8, verticalAlign: "middle" }} />
                    {row.dau}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        {data?.note ? <p className="muted" style={{ marginTop: 12 }}>{data.note}</p> : null}
      </div>
    </section>
  );
}
