import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api, { errorMessage, getToken, setToken } from "../api/client.js";

const AuthContext = createContext(null);

export const ROLE_LABELS = {
  patient: "patient",
  doctor: "doctor",
  hospital_admin: "hospital admin",
  security_admin: "security admin",
};

export const homeFor = (role) =>
  ({
    patient: "/patient",
    doctor: "/doctor",
    hospital_admin: "/admin",
    security_admin: "/security",
  }[role] || "/");

export const loginFor = (role) =>
  ({
    patient: "/login",
    doctor: "/doctor/login",
    hospital_admin: "/admin/login",
    security_admin: "/security/login",
  }[role] || "/");

export const loginForPath = (pathname) => {
  if (pathname.startsWith("/doctor")) return "/doctor/login";
  if (pathname.startsWith("/admin")) return "/admin/login";
  if (pathname.startsWith("/security")) return "/security/login";
  if (pathname.startsWith("/patient")) return "/login";
  return "/";
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));
  const [loadError, setLoadError] = useState("");

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const loadProfile = useCallback(async () => {
    if (!getToken()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError("");
    try {
      const res = await api.get("/auth/me");
      setUser(res.data.user);
    } catch (err) {
      if (err.response?.status === 401) logout();
      else setLoadError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Session expired or token rejected anywhere in the app.
  useEffect(() => {
    window.addEventListener("hb:unauthorized", logout);
    return () => window.removeEventListener("hb:unauthorized", logout);
  }, [logout]);

  // expectedRole: the portal being used. A valid account from another role is rejected
  // BEFORE the token is stored, so nothing is kept and no wrong dashboard flashes up.
  const login = async (email, password, expectedRole) => {
    const res = await api.post("/auth/login", { email, password });
    const u = res.data.user;
    if (expectedRole && u.role !== expectedRole) {
      const err = new Error("wrong portal");
      err.userMessage = `This is a ${ROLE_LABELS[u.role] || u.role} account. Please use the ${
        ROLE_LABELS[u.role] || u.role
      } login instead.`;
      throw err;
    }
    setToken(res.data.access_token);
    setUser(u);
    setLoadError("");
    return u;
  };

  const register = async (payload) => {
    await api.post("/auth/register", payload);
    return login(payload.email, payload.password, "patient");
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, loadError, login, register, logout, reload: loadProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
