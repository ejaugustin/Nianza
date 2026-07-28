import { useQuery } from "@tanstack/react-query";
import { listAuditLog } from "../api/admin";

// NZA-ADMIN-v2 page map: DataExportsPage's specific job is COPPA/GDPR
// deletion-request tracking. No new backend was needed for this -- every
// deletion request already writes a user.deletion-initiated row to the
// audit log (see admin/users/handler.js), so this page is just that log,
// filtered and framed as a queue. Ties to the account-deletion sweep noted
// in admin/users/handler.js -- nianza-account-deletion-lambda still needs to
// be built before these requests are fully actioned, not just logged.
export function DataExportsPage() {
  const query = useQuery({
    queryKey: ["audit", "user.deletion-initiated"],
    queryFn: () => listAuditLog({ action: "user.deletion-initiated" })
  });

  return (
    <section>
      <h1 className="page-title">Data Exports</h1>
      <p className="page-subtitle">
        COPPA/GDPR deletion requests, drawn from the audit log. Note: nianza-account-deletion-lambda (the actual
        cross-table data sweep) doesn't exist yet -- these rows record that a request was made and why, not that data
        has been fully purged. Treat this as a request queue to action manually until that Lambda is built.
      </p>
      <div className="panel">
        <div className="panel-header"><h2>Deletion requests</h2><span className="muted">{query.data?.count ?? 0} logged</span></div>
        <table className="table">
          <thead><tr><th>When</th><th>Requested by (admin)</th><th>Target user</th><th>Legal basis</th><th>Reason</th></tr></thead>
          <tbody>
            {query.isLoading ? <tr><td colSpan={5}>Loading...</td></tr> : null}
            {!query.isLoading && (query.data?.entries.length ?? 0) === 0 ? <tr><td colSpan={5}>No deletion requests logged yet.</td></tr> : null}
            {(query.data?.entries || []).map((entry) => {
              const newValue = entry.newValue as { reason?: string; legalBasis?: string } | null;
              return (
                <tr key={entry.actionId}>
                  <td>{new Date(entry.timestamp).toLocaleString()}</td>
                  <td>{entry.adminEmail}</td>
                  <td>{entry.targetId}</td>
                  <td>{newValue?.legalBasis || "-"}</td>
                  <td>{newValue?.reason || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
