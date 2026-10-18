import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export function Spinner({ label = "Loading..." }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  );
}

export function Alert({ kind = "error", children }) {
  if (!children) return null;
  const styles =
    kind === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-teal-200 bg-teal-50 text-teal-800";
  const Icon = kind === "error" ? AlertCircle : CheckCircle2;
  return (
    <div className={`flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm ${styles}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function PageTitle({ title, subtitle }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}

export function RoleBadge({ role }) {
  const label = {
    patient: "Patient",
    doctor: "Doctor",
    hospital_admin: "Hospital admin",
    security_admin: "Security admin",
  }[role] || role;
  return (
    <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700">
      {label}
    </span>
  );
}
