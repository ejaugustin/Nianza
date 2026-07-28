import { useState } from "react";
import { isAxiosError } from "axios";
import { useMutation, useQuery } from "@tanstack/react-query";
import { listNotifications, sendBroadcast } from "../api/admin";
import { useAuth } from "../auth/auth-context";

function actionErrorMessage(err: unknown) {
  if (isAxiosError(err)) {
    const data = err.response?.data as { message?: string; error?: string } | undefined;
    return data?.message || data?.error || err.message;
  }
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}

export function NotificationsPage() {
  const { session } = useAuth();
  const isSuperAdmin = session?.user.role === "super_admin";
  const [segment, setSegment] = useState("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dryRunResult, setDryRunResult] = useState<{ targetCount: number } | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const logQuery = useQuery({ queryKey: ["notifications"], queryFn: () => listNotifications() });

  const dryRunMutation = useMutation({
    mutationFn: () => sendBroadcast({ segment, title, body, dryRun: true }),
    onMutate: () => setNotice(null),
    onSuccess: (result) => setDryRunResult({ targetCount: result.targetCount }),
    onError: (err) => setNotice({ kind: "error", text: actionErrorMessage(err) })
  });

  const sendMutation = useMutation({
    mutationFn: () => sendBroadcast({ segment, title, body, dryRun: false }),
    onMutate: () => setNotice(null),
    onSuccess: (result) => {
      setNotice({ kind: "success", text: result.note || "Broadcast logged." });
      setDryRunResult(null);
      setTitle("");
      setBody("");
      logQuery.refetch();
    },
    onError: (err) => setNotice({ kind: "error", text: actionErrorMessage(err) })
  });

  return (
    <section>
      <h1 className="page-title">Notifications</h1>
      <p className="page-subtitle">Service announcements only, consistent with the anti-extractive notification principle -- never marketing or re-engagement.</p>
      {notice ? <div className={`notice notice-${notice.kind}`}>{notice.text}</div> : null}

      {isSuperAdmin ? (
        <form
          className="panel content-form"
          onSubmit={(event) => {
            event.preventDefault();
            dryRunMutation.mutate();
          }}
        >
          <div className="panel-header"><h2>Send broadcast</h2></div>
          <div className="form-grid">
            <label>
              Segment
              <select value={segment} onChange={(e) => { setSegment(e.target.value); setDryRunResult(null); }}>
                <option value="all">All users</option>
                <option value="language:en">Language: English</option>
                <option value="language:es">Language: Spanish</option>
                <option value="language:fr">Language: French</option>
                <option value="language:ar">Language: Arabic</option>
                <option value="subscriptionStatus:trialing">Subscription: trialing</option>
                <option value="subscriptionStatus:active">Subscription: active</option>
              </select>
            </label>
            <label>Title (max 60 chars)<input maxLength={60} required value={title} onChange={(e) => { setTitle(e.target.value); setDryRunResult(null); }} /></label>
          </div>
          <label>Body (max 140 chars)<textarea maxLength={140} required value={body} onChange={(e) => { setBody(e.target.value); setDryRunResult(null); }} /></label>
          <button className="button-secondary" disabled={!title || !body || dryRunMutation.isPending} type="submit">
            {dryRunMutation.isPending ? "Checking..." : "Preview target count (dry run)"}
          </button>
          {dryRunResult ? (
            <div className="detail-stack">
              <p className="muted">This will reach approximately <strong>{dryRunResult.targetCount}</strong> user(s).</p>
              <button className="button-primary" disabled={sendMutation.isPending} onClick={() => sendMutation.mutate()} type="button">
                {sendMutation.isPending ? "Sending..." : "Confirm and send"}
              </button>
            </div>
          ) : null}
        </form>
      ) : null}

      <div className="panel" style={{ marginTop: 18 }}>
        <div className="panel-header">
          <h2>Log</h2>
          <span className="muted">{logQuery.data?.count ?? 0} entries</span>
        </div>
        <table className="table">
          <thead><tr><th>When</th><th>Segment</th><th>Title</th><th>Target</th><th>Status</th></tr></thead>
          <tbody>
            {logQuery.isLoading ? <tr><td colSpan={5}>Loading...</td></tr> : null}
            {!logQuery.isLoading && (logQuery.data?.notifications.length ?? 0) === 0 ? <tr><td colSpan={5}>No broadcasts sent yet.</td></tr> : null}
            {(logQuery.data?.notifications || []).map((row) => (
              <tr key={row.createdAt}>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td>{row.segment}</td>
                <td>{row.title}</td>
                <td>{row.targetCount}</td>
                <td className="muted">{row.deliveryNote ? "not yet delivered (no push infra)" : `${row.sent} sent`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
