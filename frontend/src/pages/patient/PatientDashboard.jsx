import { useCallback, useEffect, useState } from "react";
import { Check, Copy, FileText, Loader2, Stethoscope } from "lucide-react";
import { Alert, PageTitle, Spinner } from "../../components/ui.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import api, { errorMessage } from "../../api/client.js";

export default function PatientDashboard() {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [grants, setGrants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [d, g] = await Promise.all([
        api.get("/patient/doctors"),
        api.get("/patient/access-grants"),
      ]);
      setDoctors(d.data.doctors);
      setGrants(g.data.grants);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const hasAccess = (doctorId) => grants.some((g) => g.doctor_id === doctorId);

  const toggle = async (doctorId) => {
    setBusyId(doctorId);
    setError("");
    try {
      if (hasAccess(doctorId)) await api.delete(`/patient/access-grants/${doctorId}`);
      else await api.post("/patient/access-grants", { doctor_id: doctorId });
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(user.health_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable: ignore */
    }
  };

  return (
    <>
      <PageTitle title={`Hello, ${user.full_name || "there"}`} subtitle="Your health record overview." />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-1">
          <p className="text-sm text-slate-500">Your Health ID</p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-2xl font-semibold tracking-wide text-teal-700">
              {user.health_id || "Not available"}
            </span>
            {user.health_id && (
              <button onClick={copyId} className="btn-ghost !px-3 !py-2" title="Copy Health ID">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Share this ID with your care provider so they can identify your record.
          </p>
        </div>

        <div className="card lg:col-span-2">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-teal-600" />
            <h2 className="font-medium text-slate-900">Doctor access</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Only doctors you approve can view your record. You can revoke access at any time.
          </p>

          <div className="mt-4 space-y-3">
            <Alert>{error}</Alert>
            {loading ? (
              <Spinner />
            ) : doctors.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                No doctors are registered yet.
              </p>
            ) : (
              doctors.map((d) => {
                const granted = hasAccess(d.doctor_id);
                return (
                  <div key={d.doctor_id}
                       className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                    <div>
                      <p className="font-medium text-slate-900">{d.full_name}</p>
                      <p className="text-sm text-slate-500">{d.specialization || "General"}</p>
                    </div>
                    <button
                      className={granted ? "btn-danger" : "btn-primary"}
                      disabled={busyId === d.doctor_id}
                      onClick={() => toggle(d.doctor_id)}
                    >
                      {busyId === d.doctor_id && <Loader2 className="h-4 w-4 animate-spin" />}
                      {granted ? "Revoke access" : "Grant access"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="card mt-6">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-teal-600" />
          <h2 className="font-medium text-slate-900">Medical records</h2>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Report upload and AI-assisted analysis arrive in the next phases.
        </p>
      </div>
    </>
  );
}
