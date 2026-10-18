import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth, loginForPath } from "../context/AuthContext.jsx";
import Layout from "./Layout.jsx";
import { Alert, Spinner } from "./ui.jsx";

export default function ProtectedRoute({ roles }) {
  const { user, loading, loadError, reload } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Loading your account..." />;

  if (loadError) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-16">
        <Alert>{loadError}</Alert>
        <button className="btn-primary w-full" onClick={reload}>
          Try again
        </button>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={loginForPath(location.pathname)} replace state={{ from: location }} />;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to="/unauthorized" replace />;

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
