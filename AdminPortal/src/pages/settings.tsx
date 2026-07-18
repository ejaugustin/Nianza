export function SettingsPage() {
  return (
    <section>
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">SSM parameters, AI model controls, TTS approval flags, audit log, and portal users will live here.</p>
      <div className="card"><div className="card-label">TTS approval</div><div>All languages start unapproved until Ej reviews voice samples.</div></div>
    </section>
  );
}
