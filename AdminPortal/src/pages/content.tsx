import { FormEvent, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  approveContent,
  ContentItem,
  createContent,
  CreateContentInput,
  listContent,
  reviewContent
} from "../api/content";

const emptyForm: CreateContentInput = {
  contentType: "daily-note",
  language: "en",
  ageWindowMonths: 4,
  domain: "movement",
  bodyText: "",
  sourceRef: "CDC-LTSAE-2022",
  ttsEnabled: true
};

function statusClassName(status: string) {
  return `badge badge-${status}`;
}

function actionErrorMessage(err: unknown) {
  if (isAxiosError(err)) {
    const data = err.response?.data as { message?: string; error?: string } | undefined;
    return data?.message || data?.error || err.message;
  }
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}

export function ContentPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateContentInput>(emptyForm);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const contentQuery = useQuery({
    queryKey: ["content"],
    queryFn: listContent
  });

  const rows = contentQuery.data || [];
  const selected = useMemo(
    () => rows.find((row) => row.contentId === selectedId) || rows[0] || null,
    [rows, selectedId]
  );

  const createMutation = useMutation({
    mutationFn: createContent,
    onMutate: () => setNotice(null),
    onSuccess: (item) => {
      queryClient.setQueryData<ContentItem[]>(["content"], (current = []) => [item, ...current]);
      setSelectedId(item.contentId);
      setForm(emptyForm);
      setNotice({ kind: "success", text: "Draft created." });
    },
    onError: (err) => {
      setNotice({ kind: "error", text: actionErrorMessage(err) });
    }
  });

  const reviewMutation = useMutation({
    mutationFn: reviewContent,
    onMutate: () => setNotice(null),
    onSuccess: (item) => {
      queryClient.setQueryData<ContentItem[]>(["content"], (current = []) =>
        current.map((row) => (row.contentId === item.contentId ? item : row))
      );
      setNotice({ kind: "success", text: "Clinical review submitted." });
    },
    onError: (err) => {
      setNotice({ kind: "error", text: actionErrorMessage(err) });
    }
  });

  const approveMutation = useMutation({
    mutationFn: approveContent,
    onMutate: () => setNotice(null),
    onSuccess: (item) => {
      queryClient.setQueryData<ContentItem[]>(["content"], (current = []) =>
        current.map((row) => (row.contentId === item.contentId ? item : row))
      );
      setNotice({ kind: "success", text: "Content approved for users." });
    },
    onError: (err) => {
      setNotice({ kind: "error", text: actionErrorMessage(err) });
    }
  });

  function updateForm<K extends keyof CreateContentInput>(field: K, value: CreateContentInput[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    createMutation.mutate(form);
  }

  return (
    <section>
      <h1 className="page-title">Content Library</h1>
      <p className="page-subtitle">Patricia content moves from draft to clinical review to Ej approval before app delivery.</p>
      {notice ? <div className={`notice notice-${notice.kind}`}>{notice.text}</div> : null}
      <div className="content-grid">
        <div className="panel">
          <div className="panel-header">
            <h2>Library</h2>
            <span className="muted">{rows.length} item{rows.length === 1 ? "" : "s"}</span>
          </div>
          <table className="table">
            <thead><tr><th>Content ID</th><th>Type</th><th>Language</th><th>Status</th></tr></thead>
            <tbody>
              {contentQuery.isLoading ? <tr><td colSpan={4}>Loading content...</td></tr> : null}
              {rows.map((row) => (
                <tr className={row.contentId === selected?.contentId ? "selected-row" : ""} key={row.contentId} onClick={() => setSelectedId(row.contentId)}>
                  <td>{row.contentId}</td>
                  <td>{row.contentType}</td>
                  <td>{row.language}</td>
                  <td><span className={statusClassName(row.status)}>{row.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <aside className="panel">
          <div className="panel-header">
            <h2>Review Gate</h2>
            {selected ? <span className={statusClassName(selected.status)}>{selected.status}</span> : null}
          </div>
          {selected ? (
            <div className="detail-stack">
              <div>
                <div className="card-label">Source</div>
                <div>{selected.sourceRef}</div>
              </div>
              <div>
                <div className="card-label">Patricia text</div>
                <div className="content-body">{selected.bodyText}</div>
              </div>
              <button className="button-secondary" disabled={selected.clinicallyReviewed || reviewMutation.isPending} onClick={() => reviewMutation.mutate(selected)}>
                {reviewMutation.isPending ? "Submitting..." : "Submit clinical review"}
              </button>
              <button className="button-primary" disabled={!selected.clinicallyReviewed || selected.ejApproved || approveMutation.isPending} onClick={() => approveMutation.mutate(selected)}>
                {approveMutation.isPending ? "Approving..." : "Approve for users"}
              </button>
              {!selected.clinicallyReviewed ? <p className="muted">Ej approval stays locked until clinical review is complete.</p> : null}
            </div>
          ) : <p className="muted">No content selected.</p>}
        </aside>
      </div>

      <form className="panel content-form" onSubmit={handleSubmit}>
        <div className="panel-header">
          <h2>New Content</h2>
          <span className="muted">New items start as draft.</span>
        </div>
        <div className="form-grid">
          <label>Type<input value={form.contentType} onChange={(event) => updateForm("contentType", event.target.value)} /></label>
          <label>Language<select value={form.language} onChange={(event) => updateForm("language", event.target.value as CreateContentInput["language"])}><option value="en">English</option><option value="es">Spanish</option><option value="fr">French</option><option value="ar">Arabic</option></select></label>
          <label>Age window<input type="number" value={form.ageWindowMonths ?? ""} onChange={(event) => updateForm("ageWindowMonths", event.target.value ? Number(event.target.value) : null)} /></label>
          <label>Domain<input value={form.domain || ""} onChange={(event) => updateForm("domain", event.target.value)} /></label>
          <label>Source reference<input value={form.sourceRef} onChange={(event) => updateForm("sourceRef", event.target.value)} /></label>
        </div>
        <label>Body text<textarea required value={form.bodyText} onChange={(event) => updateForm("bodyText", event.target.value)} /></label>
        <label className="checkbox-row"><input type="checkbox" checked={form.ttsEnabled} onChange={(event) => updateForm("ttsEnabled", event.target.checked)} /> TTS enabled after voice approval</label>
        <button className="button-primary" disabled={createMutation.isPending} type="submit">{createMutation.isPending ? "Creating..." : "Create draft"}</button>
      </form>
    </section>
  );
}
