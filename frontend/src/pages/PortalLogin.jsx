import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Building2, Loader2, ShieldCheck, Stethoscope, UserRound } from "lucide-react";
import AuthShell from "./AuthShell.jsx";
import { Alert } from "../components/ui.jsx";
import { useAuth, homeFor } from "../context/AuthContext.jsx";
import { errorMessage } from "../api/client.js";

const PORTALS = {
  patient: {
    icon: UserRound,
    badge: "Patient portal",
    title: "Patient login",
    subtitle: "Access your health record, Health ID and doctor permissions.",
  },
  doctor: {
    icon: Stethoscope,
    badge: "Doctor portal",
    title: "Doctor login",
    subtitle: "For approved clinical staff. Your account is created by hospital administration.",
  },
  hospital_admin: {
    icon: Building2,
    badge: "Administration",
    title: "Hospital admin login",
    subtitle: "Provision staff accounts and manage account access.",
  },
  security_admin: {
    icon: ShieldCheck,
    badge: "Security operations",
    title: "Security admin login",
    subtitle: "Monitor alerts, risk scores and audit logs.",
  },
};

const LINKS = [
  { to: "/login", label: "Patient" },
  { to: "/doctor/login", label: "Doctor" },
  { to: "/admin/login", label: "Admin" },
  { to: "/security/login", label: "Security" },
];

export default function PortalLogin({ portal }) {
  const cfg = PORTALS[portal];
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const u = await login(email.trim(), password, portal);
      const from = location.state?.from?.pathname;
      const home = homeFor(u.role);
      navigate(from && from.startsWith(home) ? from : home, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <>
      {portal === "patient" ? (
        <p>
          New here?{" "}
          <Link to="/register" className="font-medium text-teal-700 hover:underline">
            Create an account
          </Link>
        </p>
      ) : (
        <p>No account? Contact your hospital administrator.</p>
      )}
      <p className="mt-3 text-xs text-slate-400">
        Other portals:{" "}
        {LINKS.filter((l) => l.label.toLowerCase() !== portal.split("_")[0] && !(portal === "hospital_admin" && l.label === "Admin"))
          .map((l, i) => (
            <span key={l.to}>
              {i > 0 && " · "}
              <Link to={l.to} className="text-teal-700 hover:underline">{l.label}</Link>
            </span>
          ))}
      </p>
    </>
  );

  return (
    <AuthShell icon={cfg.icon} badge={cfg.badge} title={cfg.title} subtitle={cfg.subtitle} footer={footer}>
      <form onSubmit={submit} className="space-y-4">
        <Alert>{error}</Alert>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required className="input" value={email}
                 onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" required className="input" value={password}
                 onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </div>
        <button className="btn-primary w-full" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Log in
        </button>
      </form>
    </AuthShell>
  );
}
