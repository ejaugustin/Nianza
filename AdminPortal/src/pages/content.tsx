const rows = [
  { id: "daily-note#en#4mo#none#sample", type: "daily-note", language: "en", status: "draft" }
];

export function ContentPage() {
  return (
    <section>
      <h1 className="page-title">Content Library</h1>
      <p className="page-subtitle">Patricia content moves from draft to clinical review to Ej approval before app delivery.</p>
      <table className="table"><thead><tr><th>Content ID</th><th>Type</th><th>Language</th><th>Status</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.id}</td><td>{row.type}</td><td>{row.language}</td><td><span className="badge">{row.status}</span></td></tr>)}</tbody></table>
    </section>
  );
}
