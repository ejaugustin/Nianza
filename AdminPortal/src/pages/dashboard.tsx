const metrics = [
  ["Users", "0"],
  ["Active subscribers", "0"],
  ["Content pending review", "0"],
  ["Reports generated", "0"]
];

export function DashboardPage() {
  return (
    <section>
      <h1 className="page-title">Dashboard</h1>
      <p className="page-subtitle">Operational overview for Nianza launch readiness.</p>
      <div className="card-grid">
        {metrics.map(([label, value]) => <div className="card" key={label}><div className="card-label">{label}</div><div className="card-value">{value}</div></div>)}
      </div>
    </section>
  );
}
