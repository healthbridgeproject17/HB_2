import { Link, Navigate } from "react-router-dom";
import { Building2, FileText, HeartPulse, ShieldCheck, Stethoscope, UserRound } from "lucide-react";
import { useAuth, homeFor } from "../context/AuthContext.jsx";
import { Spinner } from "../components/ui.jsx";

const features = [
  { icon: FileText, title: "Your records, one place", text: "A unique Health ID and secure storage for your medical history." },
  { icon: Stethoscope, title: "You control access", text: "Choose which doctors can see your record, and revoke it any time." },
  { icon: ShieldCheck, title: "Protected by design", text: "Role-based access, audit logging and ransomware monitoring." },
];

const portals = [
  { to: "/login", icon: UserRound, title: "Patients", text: "View your Health ID and manage who can see your record.", cta: "Patient login" },
  { to: "/doctor/login", icon: Stethoscope, title: "Doctors", text: "Review records of patients who granted you access.", cta: "Doctor login" },
  { to: "/admin/login", icon: Building2, title: "Hospital admin", text: "Provision doctor accounts and manage access.", cta: "Admin login" },
  { to: "/security/login", icon: ShieldCheck, title: "Security team", text: "Monitor alerts, risk scores and audit logs.", cta: "Security login" },
];

export default function Home() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (user) return <Navigate to={homeFor(user.role)} replace />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50/60 to-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white">
            <HeartPulse className="h-5 w-5" />
          </span>
          HealthBridge
        </div>
        <div className="flex gap-2">
          <Link to="/login" className="btn-ghost">Log in</Link>
          <Link to="/register" className="btn-primary">Create account</Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          Secure digital health records you control
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-slate-500">
          Keep your medical history in one place, share it only with the doctors you choose,
          and rely on a platform built to resist cyber threats.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link to="/register" className="btn-primary">Get your Health ID</Link>
          <Link to="/login" className="btn-ghost">Log in</Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-14">
        <h2 className="mb-4 text-center text-sm font-medium uppercase tracking-wide text-slate-400">
          Choose your portal
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {portals.map(({ to, icon: Icon, title, text, cta }) => (
            <Link key={to} to={to} className="card block transition hover:border-teal-300 hover:shadow-md">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-medium text-slate-900">{title}</h3>
              <p className="mt-1 text-sm text-slate-500">{text}</p>
              <p className="mt-4 text-sm font-medium text-teal-700">{cta} →</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-20 sm:grid-cols-3">
        {features.map(({ icon: Icon, title, text }) => (
          <div key={title} className="card">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-medium text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-500">{text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
