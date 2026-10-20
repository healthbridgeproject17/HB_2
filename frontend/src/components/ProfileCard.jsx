import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, UserRound } from "lucide-react";
import api, { errorMessage } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { Alert, Spinner } from "./ui.jsx";
import { BLOOD_GROUPS, GENDER_LABELS, formatDay } from "../utils/format.js";

const FIELDS = ["full_name", "phone", "date_of_birth", "gender", "blood_group", "address",
  "emergency_contact_name", "emergency_contact_phone"];

function Row({ label, value }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">{value || <span className="font-normal text-slate-400">Not set</span>}</dd>
    </div>
  );
}

export default function ProfileCard() {
  const { updateUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await api.get("/patient/profile");
      setProfile(res.data.profile);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = () => {
    setSaved("");
    setError("");
    setForm(Object.fromEntries(FIELDS.map((f) => [f, profile[f] || ""])));
    setEditing(true);
  };

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.full_name.trim()) return setError("Full name cannot be empty.");
    setSaving(true);
    try {
      const res = await api.patch("/patient/profile", form);
      setProfile(res.data.profile);
      updateUser({ full_name: res.data.profile.full_name });
      setEditing(false);
      setSaved("Profile updated.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <UserRound className="h-5 w-5 text-teal-600" />
          <h2 className="font-medium text-slate-900">My profile</h2>
        </div>
        {!editing && profile && (
          <button className="btn-ghost !px-3 !py-2" onClick={startEdit}>
            <Pencil className="h-4 w-4" /> Edit profile
          </button>
        )}
      </div>

      <div className="mt-4 space-y-4">
        <Alert>{error}</Alert>
        <Alert kind="success">{saved}</Alert>

        {loading ? (
          <Spinner />
        ) : !profile ? null : !editing ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <Row label="Full name" value={profile.full_name} />
            <Row label="Email" value={profile.email} />
            <Row label="Phone" value={profile.phone} />
            <Row label="Date of birth" value={formatDay(profile.date_of_birth)} />
            <Row label="Gender" value={GENDER_LABELS[profile.gender]} />
            <Row label="Blood group" value={profile.blood_group} />
            <div className="sm:col-span-2"><Row label="Address" value={profile.address} /></div>
            <Row label="Emergency contact" value={profile.emergency_contact_name} />
            <Row label="Emergency phone" value={profile.emergency_contact_phone} />
          </dl>
        ) : (
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="pf_name">Full name</label>
              <input id="pf_name" required maxLength={150} className="input" value={form.full_name} onChange={set("full_name")} />
            </div>
            <div>
              <label className="label" htmlFor="pf_phone">Phone</label>
              <input id="pf_phone" className="input" value={form.phone} onChange={set("phone")} />
            </div>
            <div>
              <label className="label" htmlFor="pf_dob">Date of birth</label>
              <input id="pf_dob" type="date" className="input" value={form.date_of_birth} onChange={set("date_of_birth")} />
            </div>
            <div>
              <label className="label" htmlFor="pf_gender">Gender</label>
              <select id="pf_gender" className="input" value={form.gender} onChange={set("gender")}>
                <option value="">Not set</option>
                {Object.entries(GENDER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="pf_blood">Blood group</label>
              <select id="pf_blood" className="input" value={form.blood_group} onChange={set("blood_group")}>
                <option value="">Not set</option>
                {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="pf_addr">Address</label>
              <textarea id="pf_addr" rows={2} maxLength={300} className="input" value={form.address} onChange={set("address")} />
            </div>
            <div>
              <label className="label" htmlFor="pf_ecn">Emergency contact name</label>
              <input id="pf_ecn" className="input" value={form.emergency_contact_name} onChange={set("emergency_contact_name")} />
            </div>
            <div>
              <label className="label" htmlFor="pf_ecp">Emergency contact phone</label>
              <input id="pf_ecp" className="input" value={form.emergency_contact_phone} onChange={set("emergency_contact_phone")} />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <button className="btn-primary" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
              </button>
              <button type="button" className="btn-ghost" disabled={saving} onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </form>
        )}
      </div>
      <p className="mt-4 text-xs text-slate-400">Your email and Health ID cannot be changed here.</p>
    </div>
  );
}
