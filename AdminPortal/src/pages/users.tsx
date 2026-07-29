import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { disableUser, getUser, initiateUserDeletion, listUsers } from "../api/admin";
import { useAuth } from "../auth/auth-context";

function actionErrorMessage(err: unknown) {
  if (isAxiosError(err)) {
    const data = err.response?.data as { message?: string; error?: string } | undefined;
    return data?.message || data?.error || err.message;
  }
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}

export function UsersPage() {
  const { session } = useAuth();
  const isSuperAdmin = session?.user.role === "super_admin";
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [disableReason, setDisableReason] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [legalBasis, setLegalBasis] = useState("");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const usersQuery = useQuery({ queryKey: ["users"], queryFn: () => listUsers({ limit: 25 }) });
  const rows = usersQuery.data?.users || [];
  const selected = useMemo(() => rows.find((row) => row.userId === selectedUserId) || null, [rows, selectedUserId]);

  const detailQuery = useQuery({
    queryKey: ["user", selectedUserId],
    queryFn: () => getUser(selectedUserId as string),
    enabled: Boolean(selectedUserId)
  });

  const disableMutation = useMutation({
    mutationFn: () => disableUser(selectedUserId as string, disableReason),
    onMutate: () => setNotice(null),
    onSuccess: () => {
      setNotice({ kind: "success", text: "Account disabled." });
      setDisableReason("");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (err) => setNotice({ kind: "error", text: actionErrorMessage(err) })
  });

  const deleteMutation = useMutation({
    mutationFn: () => initiateUserDeletion(selectedUserId as string, deleteReason, legalBasis),
    onMutate: () => setNotice(null),
    onSuccess: (result) => {
      setNotice({ kind: "success", text: `Deletion request logged. ${result.note}` });
      setDeleteReason("");
      setLegalBasis("");
    },
    onError: (err) => setNotice({ kind: "error", text: actionErrorMessage(err) })
  });

  return (
    <section>
      <h1 className="page-title">Users</h1>
      <p className="page-subtitle">Operational support view. Child health records and conversation content stay out of this screen.</p>
      {notice ? <div className={`notice notice-${notice.kind}`}>{notice.text}</div> : null}

      <div className="content-grid">
        <div className="panel">
          <div className="panel-header">
            <h2>Accounts</h2>
            <span className="muted">{rows.length} user{rows.length === 1 ? "" : "s"}</span>
          </div>
          <table className="table">
            <thead><tr><th>Email</th><th>Status</th><th>Language</th><th>Created</th></tr></thead>
            <tbody>
              {usersQuery.isLoading ? <tr><td colSpan={4}>Loading users...</td></tr> : null}
              {!usersQuery.isLoading && rows.length === 0 ? <tr><td colSpan={4}>No users yet.</td></tr> : null}
              {rows.map((row) => (
                <tr className={row.userId === selected?.userId ? "selected-row" : ""} key={row.userId} onClick={() => setSelectedUserId(row.userId)}>
                  <td>{row.email || row.userId}</td>
                  <td><span className={`badge ${row.enabled ? "badge-approved" : "badge-deleted"}`}>{row.enabled ? "active" : "disabled"}</span></td>
                  <td>{row.language || "-"}</td>
                  <td>{row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="panel">
          <div className="panel-header">
            <h2>Account detail</h2>
          </div>
          {!selectedUserId ? <p className="muted">Select a user to see details.</p> : null}
          {selectedUserId && detailQuery.isLoading ? <p className="muted">Loading...</p> : null}
          {detailQuery.data ? (
            <div className="detail-stack">
              <div><div className="card-label">Email</div><div>{detailQuery.data.user.email}</div></div>
              <div><div className="card-label">Children</div><div>{detailQuery.data.children.map((c) => `${c.firstName || "unnamed"} (${c.correctedAgeMonths ?? "?"}mo)`).join(", ") || "none"}</div></div>
              <div><div className="card-label">Subscription</div><div>{detailQuery.data.subscriptionStatus || "unknown"}</div></div>

              {isSuperAdmin ? (
                <>
                  <div className="content-form" style={{ marginTop: 0 }}>
                    <label>Disable reason<input value={disableReason} onChange={(e) => setDisableReason(e.target.value)} /></label>
                    <button className="button-secondary" disabled={!disableReason || disableMutation.isPending} onClick={() => disableMutation.mutate()}>
                      {disableMutation.isPending ? "Disabling..." : "Disable account"}
                    </button>
                  </div>
                  <div className="content-form" style={{ marginTop: 0 }}>
                    <label>Deletion reason<input value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} /></label>
                    <label>Legal basis<input placeholder="e.g. COPPA request" value={legalBasis} onChange={(e) => setLegalBasis(e.target.value)} /></label>
                    <button className="button-secondary" disabled={!deleteReason || !legalBasis || deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
                      {deleteMutation.isPending ? "Submitting..." : "Initiate account deletion"}
                    </button>
                  </div>
                </>
              ) : <p className="muted">Disable and deletion actions require super_admin.</p>}
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
