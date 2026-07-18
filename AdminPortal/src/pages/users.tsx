export function UsersPage() {
  return (
    <section>
      <h1 className="page-title">Users</h1>
      <p className="page-subtitle">Operational support view. Child health records and conversation content stay out of this screen.</p>
      <table className="table"><thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Children</th></tr></thead><tbody><tr><td colSpan={4}>No users yet.</td></tr></tbody></table>
    </section>
  );
}
