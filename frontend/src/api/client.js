import axios from "axios";

const TOKEN_KEY = "hb_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) =>
  token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);

const api = axios.create({ baseURL: "/api/v1" });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Endpoints where a 401 means "wrong password", not "session expired".
const NO_SESSION_EXPIRY = ["/auth/login", "/auth/change-password", "/auth/register"];

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || "";
    const isCredentialCheck = NO_SESSION_EXPIRY.some((p) => url.endsWith(p));
    if (err.response?.status === 401 && getToken() && !isCredentialCheck) {
      window.dispatchEvent(new Event("hb:unauthorized"));
    }
    return Promise.reject(err);
  }
);

export function errorMessage(err) {
  if (err.userMessage) return err.userMessage;
  if (err.response) {
    const d = err.response.data || {};
    return d.error || d.msg || `Request failed (${err.response.status})`;
  }
  return "Cannot reach the server. Check that the API is running.";
}

export default api;
