import { Link } from "react-router-dom";
import { HeartPulse } from "lucide-react";

export default function AuthShell({ title, subtitle, badge, icon: Icon = HeartPulse, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-teal-50/60 to-white px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2 font-semibold text-slate-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white">
            <HeartPulse className="h-5 w-5" />
          </span>
          HealthBridge
        </Link>
        <div className="card">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              {badge && (
                <span className="text-xs font-medium uppercase tracking-wide text-teal-700">{badge}</span>
              )}
              <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
            </div>
          </div>
          {subtitle && <p className="mt-3 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-sm text-slate-500">{footer}</div>}
      </div>
    </div>
  );
}
