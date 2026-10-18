import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Alert, PageTitle } from "../components/ui.jsx";
import api, { errorMessage } from "../api/client.js";

export default function ChangePassword() {
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setDone("");
    if (form.next.length < 8) return setError("New password must be at least 8 characters.");
    if (form.next !== form.confirm) return setError("New passwords do not match.");
    setBusy(true);
    try {
      await api.post("/auth/change-password", {
        current_password: form.current,
        new_password: form.next,
      });
      setDone("Password changed.");
      setForm({ current: "", next: "", confirm: "" });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <PageTitle title="Change password" subtitle="Use a long, unique password." />
      <form onSubmit={submit} className="card space-y-4">
        <Alert>{error}</Alert>
        <Alert kind="success">{done}</Alert>
        <div>
          <label className="label" htmlFor="current">Current password</label>
          <input id="current" type="password" required className="input" value={form.current}
                 onChange={set("current")} autoComplete="current-password" />
        </div>
        <div>
          <label className="label" htmlFor="next">New password</label>
          <input id="next" type="password" required className="input" value={form.next}
                 onChange={set("next")} autoComplete="new-password" />
        </div>
        <div>
          <label className="label" htmlFor="confirm">Confirm new password</label>
          <input id="confirm" type="password" required className="input" value={form.confirm}
                 onChange={set("confirm")} autoComplete="new-password" />
        </div>
        <button className="btn-primary w-full" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Update password
        </button>
      </form>
    </div>
  );
}
