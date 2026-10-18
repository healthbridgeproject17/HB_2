import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Home from "./pages/Home.jsx";
import Login from "./pages/Login.jsx";
import PortalLogin from "./pages/PortalLogin.jsx";
import Register from "./pages/Register.jsx";
import Unauthorized from "./pages/Unauthorized.jsx";
import ChangePassword from "./pages/ChangePassword.jsx";
import PatientDashboard from "./pages/patient/PatientDashboard.jsx";
import DoctorDashboard from "./pages/doctor/DoctorDashboard.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import SecurityPlaceholder from "./pages/SecurityPlaceholder.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/doctor/login" element={<PortalLogin portal="doctor" />} />
      <Route path="/admin/login" element={<PortalLogin portal="hospital_admin" />} />
      <Route path="/security/login" element={<PortalLogin portal="security_admin" />} />
      <Route path="/register" element={<Register />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/account/password" element={<ChangePassword />} />
      </Route>
      <Route element={<ProtectedRoute roles={["patient"]} />}>
        <Route path="/patient" element={<PatientDashboard />} />
      </Route>
      <Route element={<ProtectedRoute roles={["doctor"]} />}>
        <Route path="/doctor" element={<DoctorDashboard />} />
      </Route>
      <Route element={<ProtectedRoute roles={["hospital_admin"]} />}>
        <Route path="/admin" element={<AdminDashboard />} />
      </Route>
      <Route element={<ProtectedRoute roles={["security_admin"]} />}>
        <Route path="/security" element={<SecurityPlaceholder />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
