import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import api, { errorMessage } from "../api/client.js";
import { Alert, Spinner } from "./ui.jsx";
import { formatDay, todayYmd } from "../utils/format.js";

export default function VisitSection({ patientId }) {
  const [visits, setVisits] = useState(null);
  const [listError, setListError] = useState("");
  const [form, setForm] = useState({ visit_date: todayYmd(), reason: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formOk, setFormOk] = useState("");

  const load = useCallback(async () => {
    setListError("");
    try {
      const res = await api.get(`/doctor/patients/${patientId}/visits`);
      setVisits(res.data.visits);
    } catch (err) {
      setListError(errorMessage(err));
    }
  }, [patientId]);

  useEffect(() => {
    setVisits(null);
    setFormOk("");
    setFormError("");
    load();
  }, [load]);

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormOk("");
    setSaving(true);
    try {
      await api.post(`/doctor/patients/${patientId}/visits`, form);
      setForm({ visit_date: todayYmd(), reason: "", notes: "" });
      setFormOk("Visit recorded.");
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-8">
      <h3 className="mb-3 text-sm font-medium text-slate-900">Hospital visits</h3>
      <form onSubmit={submit} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-3">
        <div className="sm:col-span-3"><Alert>{formError}</Alert><Alert kind="success">{formOk}</Alert></div>
        <div>
          <label className="label" htmlFor="v_date">Visit date</label>
          <input id="v_date" type="date" required max={todayYmd()} className="input" value={form.visit_date} onChange={set("visit_date")} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="v_reason">Reason</label>
          <input id="v_reason" required maxLength={200} className="input" value={form.reason} onChange={set("reason")} placeholder="e.g. Follow-up consultation" />
        </div>
        <div className="sm:col-span-3">
          <label className="label" htmlFor="v_notes">Notes (optional)</label>
          <textarea id="v_notes" rows={2} maxLength={2000} className="input" value={form.notes} onChange={set("notes")} />
        </div>
        <div className="sm:col-span-3">
          <button className="btn-primary" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Record visit
          </button>
        </div>
      </form>

      <div className="mt-4 space-y-3">
        <Alert>{listError}</Alert>
        {!visits && !listError ? (
          <Spinner />
        ) : visits && visits.length === 0 ? (
          <p className="text-sm text-slate-500">No visits recorded yet.</p>
        ) : (
          visits?.map((v) => (
            <div key={v.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-slate-900">{v.reason}</p>
                <span className="text-xs text-slate-500">{formatDay(v.visit_date)}</span>
              </div>
              <p className="text-sm text-slate-500">{v.doctor_name}</p>
              {v.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{v.notes}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
