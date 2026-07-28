import { useState } from "react";
import { isAxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { extendTrial, listSubscriptions } from "../api/admin";
import { useAuth } from "../auth/auth-context";

function actionErrorMessage(err: unknown) {
  if (isAxiosError(err)) {
    const data = err.response?.data as { message?: string; error?: string } | undefined;
    return data?.message || data?.error || err.message;
  }
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}

export function SubscriptionsPage() {
  const { session } = useAuth();
  const isSuperAdmin = session?.user.role === "super_admin";
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [extendUserId, setExtendUserId] = useState<string | null>(null);
  const [extensionDays, setExtensionDays] = useState(7);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const query = useQuery({
    queryKey: ["subscriptions", statusFilter],
    queryFn: () => listSubscriptions(statusFilter ? { status: statusFilter } : {})
  });

  const extendMutation = useMutation({
    mutationFn: () => extendTrial(extendUserId as string, extensionDays, reason),
    onMutate: () => setNotice(null),
    onSuccess: (result) => {
      setNotice({ kind: "success", text: `Trial extended to ${new Date(result.trialEndsAt).toLocaleDateString()}.` });
      setExtendUserId(null);
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    },
    onError: (err) => setNotice({ kind: "error", text: actionErrorMessage(err) })
  });

  const totals = query.data?.totals;
  const churnRate = query.data?.churnRate;
  const rows = query.data?.subscriptions || [];

  function exportCsv() {
    const header = "userId,email,language,subscriptionStatus,trialStartedAt,trialEndsAt";
    const lines = rows.map((row) => [row.userId, row.email || "", row.language || "", row.subscriptionStatus || "", row.trialStartedAt || "", row.trialEndsAt || ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `nianza-subscriptions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section>
      <h1 className="page-title">Subscriptions</h1>
      <p className="page-subtitle">Cohort view read from nianza-users. Note: RevenueCat isn't integrated yet, so subscriptionStatus is only populated once that write path exists.</p>
      {notice ? <div className={`notice notice-${notice.kind}`}>{notice.text}</div> : null}

      <div className="card-grid">
        {(["trialing", "active", "expired", "cancelled"] as const).map((key) => (
          <div className="card" key={key} onClick={() => setStatusFilter(statusFilter === key ? "" : key)} style={{ cursor: "pointer", outline: statusFilter === key ? "2px solid #34abc4" : "none" }}>
            <div className="card-label">{key}</div>
            <div className="card-value">{totals ? totals[key] : "..."}</div>
          </div>
        ))}
        <div className="card">
          <div className="card-label">Churn rate (proxy)</div>
          <div className="card-value">{churnRate == null ? "..." : `${churnRate}%`}</div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <div className="panel-header">
          <h2>Accounts</h2>
          <span style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span className="muted">{rows.length} shown</span>
            <button className="button-secondary" disabled={!rows.length} onClick={exportCsv} type="button">Export CSV</button>
          </span>
        </div>
        <table className="table">
          <thead><tr><th>Email</th><th>Language</th><th>Status</th><th>Trial ends</th>{isSuperAdmin ? <th /> : null}</tr></thead>
          <tbody>
            {query.isLoading ? <tr><td colSpan={5}>Loading...</td></tr> : null}
            {!query.isLoading && rows.length === 0 ? <tr><td colSpan={5}>No subscription records yet.</td></tr> : null}
            {rows.map((row) => (
              <tr key={row.userId}>
                <td>{row.email || row.userId}</td>
                <td>{row.language || "-"}</td>
                <td><span className="badge">{row.subscriptionStatus || "unknown"}</span></td>
                <td>{row.trialEndsAt ? new Date(row.trialEndsAt).toLocaleDateString() : "-"}</td>
                {isSuperAdmin ? (
                  <td>
                    {extendUserId === row.userId ? (
                      <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input style={{ width: 60 }} type="number" min={1} max={14} value={extensionDays} onChange={(e) => setExtensionDays(Number(e.target.value))} />
                        <input placeholder="reason" style={{ width: 140 }} value={reason} onChange={(e) => setReason(e.target.value)} />
                        <button className="button-primary" disabled={!reason || extendMutation.isPending} onClick={() => extendMutation.mutate()}>Save</button>
                      </span>
                    ) : (
                      <button className="button-secondary" onClick={() => setExtendUserId(row.userId)}>Extend trial</button>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
