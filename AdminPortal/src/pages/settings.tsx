import { useState } from "react";
import { isAxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPortalUser,
  disablePortalUser,
  getHarnessRun,
  listActiveSessions,
  listAuditLog,
  listHarnessRuns,
  listPortalUsers,
  listReferenceData,
  listSsmParameters,
  publishReferenceData,
  signHarnessRun,
  terminateSession,
  uploadReferenceData,
  writeSsmParameter
} from "../api/admin";
import { useAuth } from "../auth/auth-context";

function actionErrorMessage(err: unknown) {
  if (isAxiosError(err)) {
    const data = err.response?.data as { message?: string; error?: string } | undefined;
    return data?.message || data?.error || err.message;
  }
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}

type Tab = "ai-voice" | "ssm" | "reference-data" | "audit" | "portal-users" | "sessions";
const TABS: { id: Tab; label: string }[] = [
  { id: "ai-voice", label: "AI & Voice Controls" },
  { id: "ssm", label: "SSM Parameters" },
  { id: "reference-data", label: "Reference Data" },
  { id: "audit", label: "Audit Log" },
  { id: "portal-users", label: "Portal Users" },
  { id: "sessions", label: "Active Sessions" }
];

const LANGUAGES: { code: string; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "ar", label: "Arabic" }
];

function TabNav({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          className={active === tab.id ? "button-primary" : "button-secondary"}
          onClick={() => onChange(tab.id)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function AiVoicePanel() {
  const { session } = useAuth();
  const isSuperAdmin = session?.user.role === "super_admin";
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const query = useQuery({ queryKey: ["ssm"], queryFn: listSsmParameters });
  const params = query.data?.parameters || [];
  const ttsParams = LANGUAGES.map((lang) => ({
    ...lang,
    param: params.find((p) => p.name === `/nianza/tts-approved/${lang.code}`)
  }));

  const approveMutation = useMutation({
    mutationFn: (code: string) => writeSsmParameter(`/nianza/tts-approved/${code}`, "true", `Approved ${code} TTS voice via AI & Voice Controls`),
    onMutate: () => setNotice(null),
    onSuccess: (_, code) => {
      setNotice({ kind: "success", text: `TTS approved for ${code}. Patricia can now speak on real devices in this language.` });
      queryClient.invalidateQueries({ queryKey: ["ssm"] });
    },
    onError: (err) => setNotice({ kind: "error", text: actionErrorMessage(err) })
  });

  return (
    <div className="panel">
      <div className="panel-header"><h2>TTS voice approval</h2></div>
      {notice ? <div className={`notice notice-${notice.kind}`}>{notice.text}</div> : null}
      <p className="muted">Patricia's voice cannot be heard on any real device until TTS is approved for that language.</p>
      <table className="table">
        <thead><tr><th>Language</th><th>Status</th>{isSuperAdmin ? <th /> : null}</tr></thead>
        <tbody>
          {ttsParams.map((row) => {
            const approved = row.param?.value === "true";
            return (
              <tr key={row.code}>
                <td>{row.label}</td>
                <td><span className={`badge ${approved ? "badge-approved" : "badge-draft"}`}>{approved ? "approved" : "not approved"}</span></td>
                {isSuperAdmin ? (
                  <td>
                    <button
                      className="button-secondary"
                      disabled={approved || approveMutation.isPending}
                      onClick={() => {
                        if (window.confirm(`Setting this flag will allow Patricia to speak in ${row.label} on real user devices. Confirm.`)) {
                          approveMutation.mutate(row.code);
                        }
                      }}
                    >
                      Approve {row.label} voice
                    </button>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
      <HarnessRunsPanel />
    </div>
  );
}

function HarnessRunsPanel() {
  const { session } = useAuth();
  const isSuperAdmin = session?.user.role === "super_admin";
  const queryClient = useQueryClient();
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const listQuery = useQuery({ queryKey: ["harness-runs"], queryFn: listHarnessRuns });
  const detailQuery = useQuery({
    queryKey: ["harness-run", openRunId],
    queryFn: () => getHarnessRun(openRunId as string),
    enabled: Boolean(openRunId)
  });

  const signMutation = useMutation({
    mutationFn: () => signHarnessRun(openRunId as string),
    onMutate: () => setNotice(null),
    onSuccess: () => {
      setNotice({ kind: "success", text: "Run signed. This change can now promote past staging." });
      queryClient.invalidateQueries({ queryKey: ["harness-runs"] });
      queryClient.invalidateQueries({ queryKey: ["harness-run", openRunId] });
    },
    onError: (err) => setNotice({ kind: "error", text: actionErrorMessage(err) })
  });

  return (
    <div style={{ marginTop: 18 }}>
      <div className="panel-header"><h2>Harness runs</h2></div>
      {notice ? <div className={`notice notice-${notice.kind}`}>{notice.text}</div> : null}
      <table className="table">
        <thead><tr><th>Change</th><th>When</th><th>Assertions</th><th>Signed</th></tr></thead>
        <tbody>
          {listQuery.isLoading ? <tr><td colSpan={4}>Loading...</td></tr> : null}
          {!listQuery.isLoading && (listQuery.data?.runs.length ?? 0) === 0 ? <tr><td colSpan={4}>No harness runs recorded yet -- run scripts/record-harness-run.js after a prompt/model change.</td></tr> : null}
          {(listQuery.data?.runs || []).map((run) => (
            <tr className={run.runId === openRunId ? "selected-row" : ""} key={run.runId} onClick={() => setOpenRunId(run.runId)}>
              <td>{run.triggeringChange}</td>
              <td>{new Date(run.createdAt).toLocaleString()}</td>
              <td><span className={`badge ${run.passed ? "badge-approved" : "badge-deleted"}`}>{run.passed ? "passed" : "failed"}</span></td>
              <td>{run.signedBy ? <span className="badge badge-approved">{run.signedBy}</span> : <span className="badge badge-draft">unsigned</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {openRunId && detailQuery.data ? (
        <div className="detail-stack" style={{ marginTop: 14 }}>
          {detailQuery.data.run.scenarios.map((scenario) => (
            <div className="content-body" key={scenario.scenarioId}>
              <strong>{scenario.scenarioId}</strong>
              {scenario.transcript.map((turn, index) => (
                <div key={index}><em>{turn.role}:</em> {turn.text}</div>
              ))}
              <div style={{ marginTop: 6 }}>
                {scenario.assertions.map((assertion) => (
                  <div key={assertion.name} style={{ color: assertion.passed ? "#17805f" : "#9b4c24" }}>
                    {assertion.passed ? "✓" : "✗"} {assertion.name} {assertion.detail ? `-- ${assertion.detail}` : ""}
                  </div>
                ))}
              </div>
            </div>
          ))}
          {isSuperAdmin && !detailQuery.data.run.signedBy ? (
            <button className="button-primary" disabled={!detailQuery.data.run.passed || signMutation.isPending} onClick={() => signMutation.mutate()}>
              {signMutation.isPending ? "Signing..." : detailQuery.data.run.passed ? "Sign off" : "Cannot sign -- assertions failed"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function SsmPanel() {
  const { session } = useAuth();
  const isSuperAdmin = session?.user.role === "super_admin";
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const query = useQuery({ queryKey: ["ssm"], queryFn: listSsmParameters });

  const writeMutation = useMutation({
    mutationFn: () => writeSsmParameter(editing as string, value, reason),
    onMutate: () => setNotice(null),
    onSuccess: () => {
      setNotice({ kind: "success", text: "Parameter updated." });
      setEditing(null);
      setValue("");
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["ssm"] });
    },
    onError: (err) => setNotice({ kind: "error", text: actionErrorMessage(err) })
  });

  return (
    <div className="panel">
      <div className="panel-header"><h2>/nianza/* parameters</h2><span className="muted">{query.data?.parameters.length ?? 0} params</span></div>
      {notice ? <div className={`notice notice-${notice.kind}`}>{notice.text}</div> : null}
      <table className="table">
        <thead><tr><th>Name</th><th>Value</th><th>Type</th>{isSuperAdmin ? <th /> : null}</tr></thead>
        <tbody>
          {query.isLoading ? <tr><td colSpan={4}>Loading...</td></tr> : null}
          {(query.data?.parameters || []).map((param) => (
            <tr key={param.name}>
              <td>{param.name}</td>
              <td>{param.value}</td>
              <td>{param.type}</td>
              {isSuperAdmin ? (
                <td>
                  {editing === param.name ? (
                    <span style={{ display: "flex", gap: 6 }}>
                      <input placeholder="new value" style={{ width: 120 }} value={value} onChange={(e) => setValue(e.target.value)} />
                      <input placeholder="reason" style={{ width: 140 }} value={reason} onChange={(e) => setReason(e.target.value)} />
                      <button className="button-primary" disabled={!value || !reason || writeMutation.isPending} onClick={() => writeMutation.mutate()}>Save</button>
                    </span>
                  ) : (
                    <button className="button-secondary" onClick={() => setEditing(param.name)}>Edit</button>
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReferenceDataPanel() {
  const { session } = useAuth();
  const isSuperAdmin = session?.user.role === "super_admin";
  const queryClient = useQueryClient();
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [publishingKey, setPublishingKey] = useState<string | null>(null);
  const [reviewerName, setReviewerName] = useState("");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const query = useQuery({ queryKey: ["reference-data"], queryFn: listReferenceData });

  const uploadMutation = useMutation({
    mutationFn: () => uploadReferenceData(uploadingKey as string, content),
    onMutate: () => setNotice(null),
    onSuccess: (result) => {
      const { previousCount, nextCount, delta } = result.diff;
      setNotice({ kind: "success", text: `Staged. ${previousCount ?? "?"} -> ${nextCount} rows (${delta == null ? "no prior version" : delta >= 0 ? `+${delta}` : delta}). Review the diff, then publish.` });
      setUploadingKey(null);
      setContent("");
      queryClient.invalidateQueries({ queryKey: ["reference-data"] });
    },
    onError: (err) => setNotice({ kind: "error", text: actionErrorMessage(err) })
  });

  const publishMutation = useMutation({
    mutationFn: () => publishReferenceData(publishingKey as string, reviewerName),
    onMutate: () => setNotice(null),
    onSuccess: () => {
      setNotice({ kind: "success", text: "Published to the live key and sourceVerifiedBy recorded." });
      setPublishingKey(null);
      setReviewerName("");
      queryClient.invalidateQueries({ queryKey: ["reference-data"] });
    },
    onError: (err) => setNotice({ kind: "error", text: actionErrorMessage(err) })
  });

  return (
    <div className="panel">
      <div className="panel-header"><h2>Schedule &amp; reference data</h2></div>
      {notice ? <div className={`notice notice-${notice.kind}`}>{notice.text}</div> : null}
      <p className="muted">
        Vaccine schedule, growth reference tables, and the milestone library. The app refuses to serve an unverified
        schedule -- this is a hard launch gate, not a nicety. Note: growth data's sourceVerifiedBy gate already exists
        and works today via a hardcoded constant in the vitals Lambda; the app-side read path for vaccines/milestones
        hasn't been migrated to read from this bucket yet, so publishing here records the version but doesn't change
        what ships until that migration lands.
      </p>
      <table className="table">
        <thead><tr><th>File</th><th>Verified by</th><th>Last updated</th><th>Staged?</th>{isSuperAdmin ? <th /> : null}</tr></thead>
        <tbody>
          {query.isLoading ? <tr><td colSpan={5}>Loading...</td></tr> : null}
          {(query.data?.items || []).map((item) => (
            <tr key={item.referenceKey}>
              <td>{item.referenceKey}.json</td>
              <td>{item.sourceVerifiedBy ? <span className="badge badge-approved">{item.sourceVerifiedBy.reviewer}</span> : <span className="badge badge-deleted">NOT VERIFIED</span>}</td>
              <td>{item.lastUpdatedAt ? new Date(item.lastUpdatedAt).toLocaleDateString() : "-"}</td>
              <td>{item.hasStagedVersion ? "yes" : "-"}</td>
              {isSuperAdmin ? (
                <td style={{ display: "flex", gap: 6 }}>
                  <button className="button-secondary" onClick={() => { setUploadingKey(item.referenceKey); setPublishingKey(null); }}>Upload new version</button>
                  {item.hasStagedVersion ? <button className="button-primary" onClick={() => { setPublishingKey(item.referenceKey); setUploadingKey(null); }}>Publish</button> : null}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>

      {uploadingKey ? (
        <div className="content-form">
          <div className="panel-header"><h2>Upload {uploadingKey}.json (staging only)</h2></div>
          <label>New file contents (paste JSON)<textarea value={content} onChange={(e) => setContent(e.target.value)} /></label>
          <span style={{ display: "flex", gap: 8 }}>
            <button className="button-primary" disabled={!content.trim() || uploadMutation.isPending} onClick={() => uploadMutation.mutate()}>{uploadMutation.isPending ? "Staging..." : "Stage for review"}</button>
            <button className="button-secondary" onClick={() => setUploadingKey(null)} type="button">Cancel</button>
          </span>
        </div>
      ) : null}

      {publishingKey ? (
        <div className="content-form">
          <div className="panel-header"><h2>Publish {publishingKey}.json</h2></div>
          <label>Reviewer name (sourceVerifiedBy)<input value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} /></label>
          <span style={{ display: "flex", gap: 8 }}>
            <button className="button-primary" disabled={!reviewerName.trim() || publishMutation.isPending} onClick={() => publishMutation.mutate()}>{publishMutation.isPending ? "Publishing..." : "Publish to live"}</button>
            <button className="button-secondary" onClick={() => setPublishingKey(null)} type="button">Cancel</button>
          </span>
        </div>
      ) : null}
    </div>
  );
}

function AuditPanel() {
  const query = useQuery({ queryKey: ["audit"], queryFn: () => listAuditLog() });
  return (
    <div className="panel">
      <div className="panel-header"><h2>Audit log</h2><span className="muted">{query.data?.count ?? 0} entries, non-deletable</span></div>
      <table className="table">
        <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Target</th><th>Result</th></tr></thead>
        <tbody>
          {query.isLoading ? <tr><td colSpan={5}>Loading...</td></tr> : null}
          {query.isError ? <tr><td colSpan={5} className="muted">Could not load audit log (super_admin only).</td></tr> : null}
          {(query.data?.entries || []).map((row) => (
            <tr key={row.actionId}>
              <td>{new Date(row.timestamp).toLocaleString()}</td>
              <td>{row.adminEmail}</td>
              <td>{row.action}</td>
              <td>{row.targetId}</td>
              <td>{row.result}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PortalUsersPanel() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"content_editor" | "operations">("content_editor");
  const [firstName, setFirstName] = useState("");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const query = useQuery({ queryKey: ["portal-users"], queryFn: listPortalUsers });

  const createMutation = useMutation({
    mutationFn: () => createPortalUser({ email, role, firstName: firstName || undefined }),
    onMutate: () => setNotice(null),
    onSuccess: () => {
      setNotice({ kind: "success", text: "Portal user created. Temporary password emailed." });
      setEmail("");
      setFirstName("");
      queryClient.invalidateQueries({ queryKey: ["portal-users"] });
    },
    onError: (err) => setNotice({ kind: "error", text: actionErrorMessage(err) })
  });

  const disableMutation = useMutation({
    mutationFn: (userId: string) => disablePortalUser(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["portal-users"] }),
    onError: (err) => setNotice({ kind: "error", text: actionErrorMessage(err) })
  });

  return (
    <>
      <form
        className="panel content-form"
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate();
        }}
      >
        <div className="panel-header"><h2>Invite portal user</h2></div>
        {notice ? <div className={`notice notice-${notice.kind}`}>{notice.text}</div> : null}
        <div className="form-grid">
          <label>Email<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label>Role<select value={role} onChange={(e) => setRole(e.target.value as typeof role)}><option value="content_editor">content_editor</option><option value="operations">operations</option></select></label>
          <label>First name<input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></label>
        </div>
        <button className="button-primary" disabled={!email || createMutation.isPending} type="submit">{createMutation.isPending ? "Creating..." : "Create user"}</button>
      </form>

      <div className="panel" style={{ marginTop: 18 }}>
        <div className="panel-header"><h2>Portal accounts</h2></div>
        <table className="table">
          <thead><tr><th>Email</th><th>Role</th><th>Status</th><th>Last login</th><th /></tr></thead>
          <tbody>
            {query.isLoading ? <tr><td colSpan={5}>Loading...</td></tr> : null}
            {(query.data?.users || []).map((row) => (
              <tr key={row.userId}>
                <td>{row.email}</td>
                <td>{row.role || "-"}</td>
                <td>{row.status}</td>
                <td>{row.lastLoginAt ? new Date(row.lastLoginAt).toLocaleString() : "never"}</td>
                <td>
                  {row.role !== "super_admin" ? (
                    <button className="button-secondary" disabled={disableMutation.isPending} onClick={() => disableMutation.mutate(row.userId)}>Disable</button>
                  ) : <span className="muted">super_admin</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SessionsPanel() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["sessions"], queryFn: listActiveSessions });

  const terminateMutation = useMutation({
    mutationFn: ({ sessionId, adminUserId }: { sessionId: string; adminUserId: string }) => terminateSession(sessionId, adminUserId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sessions"] })
  });

  return (
    <div className="panel">
      <div className="panel-header"><h2>Active sessions</h2></div>
      <table className="table">
        <thead><tr><th>Admin</th><th>Login</th><th>Last active</th><th>IP</th><th /></tr></thead>
        <tbody>
          {query.isLoading ? <tr><td colSpan={5}>Loading...</td></tr> : null}
          {(query.data?.sessions || []).map((row) => (
            <tr key={row.sessionId}>
              <td>{row.adminEmail}</td>
              <td>{row.loginAt ? new Date(row.loginAt).toLocaleString() : "-"}</td>
              <td>{row.lastActiveAt ? new Date(row.lastActiveAt).toLocaleString() : "-"}</td>
              <td>{row.ipAddress || "-"}</td>
              <td><button className="button-secondary" disabled={terminateMutation.isPending} onClick={() => terminateMutation.mutate({ sessionId: row.sessionId, adminUserId: row.adminUserId })}>Terminate</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>("ai-voice");

  return (
    <section>
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">SSM parameters, AI model controls, TTS approval flags, audit log, and portal users.</p>
      <TabNav active={tab} onChange={setTab} />
      {tab === "ai-voice" ? <AiVoicePanel /> : null}
      {tab === "ssm" ? <SsmPanel /> : null}
      {tab === "reference-data" ? <ReferenceDataPanel /> : null}
      {tab === "audit" ? <AuditPanel /> : null}
      {tab === "portal-users" ? <PortalUsersPanel /> : null}
      {tab === "sessions" ? <SessionsPanel /> : null}
    </section>
  );
}
