import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AuthShell from "./AuthShell.jsx";
import { Alert } from "../components/ui.jsx";
import { useAuth, homeFor } from "../context/AuthContext.jsx";
import { errorMessage } from "../api/client.js";

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", date_of_birth: "", password: "", confirm: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    if (form.password !== form.confirm) return setError("Passwords do not match.");

    setBusy(true);
    try {
      const payload = {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
      };
      if (form.phone.trim()) payload.phone = form.phone.trim();
      if (form.date_of_birth) payload.date_of_birth = form.date_of_birth;
      const u = await register(payload);
      navigate(homeFor(u.role), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Patient registration. You will receive a unique Health ID."
      footer={<>Already registered? <Link to="/login" className="font-medium text-teal-700 hover:underline">Log in</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <Alert>{error}</Alert>
        <div>
          <label className="label" htmlFor="full_name">Full name</label>
          <input id="full_name" required className="input" value={form.full_name} onChange={set("full_name")} />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required className="input" value={form.email}
                 onChange={set("email")} autoComplete="email" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="phone">Phone (optional)</label>
            <input id="phone" className="input" value={form.phone} onChange={set("phone")} />
          </div>
          <div>
            <label className="label" htmlFor="dob">Date of birth (optional)</label>
            <input id="dob" type="date" className="input" value={form.date_of_birth}
                   onChange={set("date_of_birth")} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" required className="input" value={form.password}
                 onChange={set("password")} autoComplete="new-password" />
        </div>
        <div>
          <label className="label" htmlFor="confirm">Confirm password</label>
          <input id="confirm" type="password" required className="input" value={form.confirm}
                 onChange={set("confirm")} autoComplete="new-password" />
        </div>
        <button className="btn-primary w-full" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create account
        </button>
      </form>
    </AuthShell>
  );
}
