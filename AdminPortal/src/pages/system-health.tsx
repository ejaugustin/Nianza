import { useQuery } from "@tanstack/react-query";
import { getSystemHealth } from "../api/admin";

function statusBadge(status: string) {
  if (status === "healthy") return "badge badge-approved";
  if (status === "watch") return "badge badge-reviewed";
  return "badge badge-deleted";
}

// Consolidates what would be separate Reliability / System Health / Security
// & Compliance pages in Claricito into one screen -- there isn't yet a
// second real data source (e.g. a security-events feed) to justify
// splitting further; see the backend handler's header comment.
export function SystemHealthPage() {
  const query = useQuery({ queryKey: ["system-health"], queryFn: getSystemHealth });

  return (
    <section>
      <h1 className="page-title">System Health</h1>
      <p className="page-subtitle">Lambda invocation and error counts from CloudWatch, last {query.data?.windowHours ?? 24} hours.</p>
      {query.isError ? <div className="notice notice-error">Could not read CloudWatch metrics. Check the admin-system-health Lambda's IAM permissions.</div> : null}
      <table className="table">
        <thead><tr><th>Function</th><th>Invocations</th><th>Errors</th><th>Error rate</th><th>Status</th></tr></thead>
        <tbody>
          {query.isLoading ? <tr><td colSpan={5}>Loading...</td></tr> : null}
          {(query.data?.functions || []).map((fn) => (
            <tr key={fn.functionName}>
              <td>{fn.functionName}</td>
              <td>{fn.invocations24h}</td>
              <td>{fn.errors24h}</td>
              <td>{fn.errorRate}%</td>
              <td><span className={statusBadge(fn.status)}>{fn.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
