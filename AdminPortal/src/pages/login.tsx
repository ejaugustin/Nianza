import { FormEvent, useState } from "react";
import { useAuth } from "../auth/auth-context";

export function LoginPage() {
  const { challenge, completeNewPassword, signIn } = useAuth();
  const [email, setEmail] = useState("eja+nianza@banxito.com");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (challenge) {
        await completeNewPassword(newPassword);
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-panel" onSubmit={handleSubmit}>
        <div>
          <div className="brand login-brand">Nianza Admin</div>
          <h1 className="page-title">{challenge ? "Set Password" : "Sign In"}</h1>
          <p className="page-subtitle">
            {challenge ? "Create your permanent admin password." : "Use your Nianza admin account."}
          </p>
        </div>
        {challenge ? (
          <label>New password<input autoComplete="new-password" minLength={12} required type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
        ) : (
          <>
            <label>Email<input autoComplete="username" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label>Password<input autoComplete="current-password" required type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          </>
        )}
        {error ? <div className="form-error">{error}</div> : null}
        <button className="button-primary" disabled={isSubmitting} type="submit">
          {challenge ? "Save password" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
