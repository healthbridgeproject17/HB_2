import { useCallback, useEffect, useState } from "react";
import { Loader2, UserPlus, Users } from "lucide-react";
import { Alert, PageTitle, Spinner } from "../../components/ui.jsx";
import api, { errorMessage } from "../../api/client.js";

const emptyForm = { full_name: "", email: "", specialization: "", temporary_password: "" };

export default function DoctorsTab() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [formOk, setFormOk] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyUser, setBusyUser] = useState(null);

  const load = useCallback(async () => {
    setListError("");
    try {
      const res = await api.get("/admin/doctors");
      setDoctors(res.data.doctors);
    } catch (err) {
      setListError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const create = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormOk("");
    if (form.temporary_password.length < 8) {
      return setFormError("Temporary password must be at least 8 characters.");
    }
    setCreating(true);
    try {
      await api.post("/admin/doctors", {
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        specialization: form.specialization.trim(),
        temporary_password: form.temporary_password,
      });
      setFormOk(`Doctor account created for ${form.email.trim()}. Ask them to change the password at first login.`);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const toggleStatus = async (doctor) => {
    setBusyUser(doctor.user_id);
    setListError("");
    try {
      await api.patch(`/admin/users/${doctor.user_id}/status`, { is_active: !doctor.is_active });
      await load();
    } catch (err) {
      setListError(errorMessage(err));
    } finally {
      setBusyUser(null);
    }
  };

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-5">
        <form onSubmit={create} className="card space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-teal-600" />
            <h2 className="font-medium text-slate-900">Add a doctor</h2>
          </div>
          <Alert>{formError}</Alert>
          <Alert kind="success">{formOk}</Alert>
          <div>
            <label className="label" htmlFor="d_name">Full name</label>
            <input id="d_name" required className="input" value={form.full_name} onChange={set("full_name")} />
          </div>
          <div>
            <label className="label" htmlFor="d_email">Email</label>
            <input id="d_email" type="email" required className="input" value={form.email} onChange={set("email")} />
          </div>
          <div>
            <label className="label" htmlFor="d_spec">Specialization</label>
            <input id="d_spec" className="input" value={form.specialization} onChange={set("specialization")} />
          </div>
          <div>
            <label className="label" htmlFor="d_pw">Temporary password</label>
            <input id="d_pw" type="text" required className="input" value={form.temporary_password}
                   onChange={set("temporary_password")} autoComplete="off" />
          </div>
          <button className="btn-primary w-full" disabled={creating}>
            {creating && <Loader2 className="h-4 w-4 animate-spin" />} Create doctor account
          </button>
        </form>

        <div className="card lg:col-span-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-teal-600" />
            <h2 className="font-medium text-slate-900">Doctors</h2>
          </div>
          <div className="mt-4 space-y-3">
            <Alert>{listError}</Alert>
            {loading ? (
              <Spinner />
            ) : doctors.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                No doctor accounts yet.
              </p>
            ) : (
              doctors.map((d) => (
                <div key={d.doctor_id}
                     className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
                  <div>
                    <p className="font-medium text-slate-900">{d.full_name}</p>
                    <p className="text-sm text-slate-500">
                      {d.email} · {d.specialization || "General"}
                    </p>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                      d.is_active ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-500"
                    }`}>
                      {d.is_active ? "Active" : "Deactivated"}
                    </span>
                  </div>
                  <button
                    className={d.is_active ? "btn-danger" : "btn-ghost"}
                    disabled={busyUser === d.user_id}
                    onClick={() => toggleStatus(d)}
                  >
                    {busyUser === d.user_id && <Loader2 className="h-4 w-4 animate-spin" />}
                    {d.is_active ? "Deactivate" : "Reactivate"}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
