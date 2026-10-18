import { Link, useNavigate } from "react-router-dom";
import { HeartPulse, KeyRound, LogOut } from "lucide-react";
import { useAuth, homeFor, loginFor } from "../context/AuthContext.jsx";
import { RoleBadge } from "./ui.jsx";

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    const portal = loginFor(user.role);
    logout();
    navigate(portal, { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to={homeFor(user.role)} className="flex items-center gap-2 font-semibold text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-600 text-white">
              <HeartPulse className="h-4 w-4" />
            </span>
            HealthBridge
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">{user.email}</span>
            <RoleBadge role={user.role} />
            <Link to="/account/password" className="btn-ghost !px-3 !py-2" title="Change password">
              <KeyRound className="h-4 w-4" />
            </Link>
            <button onClick={handleLogout} className="btn-ghost !px-3 !py-2" title="Log out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
