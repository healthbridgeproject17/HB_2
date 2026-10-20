import { useCallback, useEffect, useState } from "react";
import { Loader2, Search, Users } from "lucide-react";
import api, { errorMessage } from "../../api/client.js";
import { Alert, Spinner } from "../../components/ui.jsx";
import { CategoryBreakdown } from "../../components/SummaryCards.jsx";
import { CATEGORY_LABELS } from "../../components/RecordList.jsx";
import { GENDER_LABELS, formatDay } from "../../utils/format.js";

function Row({ label, value }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">{value || <span className="font-normal text-slate-400">Not set</span>}</dd>
    </div>
  );
}

export default function PatientsTab() {
  const [patients, setPatients] = useState([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [busyUser, setBusyUser] = useState(null);

  const load = useCallback(async (q = "") => {
    setError("");
    setLoading(true);
    try {
      const res = await api.get("/admin/patients", { params: q ? { q } : {} });
      setPatients(res.data.patients);
      setTotal(res.data.total);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const open = async (patientId) => {
    setSelected(patientId);
    setDetail(null);
    setDetailError("");
    setDetailLoading(true);
    try {
      const res = await api.get(`/admin/patients/${patientId}`);
      setDetail(res.data);
    } catch (err) {
      setDetailError(errorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  };

  const toggleStatus = async (p) => {
    setBusyUser(p.user_id);
    setError("");
    try {
      await api.patch(`/admin/users/${p.user_id}/status`, { is_active: !p.is_active });
      await load(query);
      if (selected === p.patient_id) await open(p.patient_id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyUser(null);
    }
  };

  const search = (e) => {
    e.preventDefault();
    load(query.trim());
  };

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <div className="card lg:col-span-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-teal-600" />
          <h2 className="font-medium text-slate-900">All patients</h2>
          <span className="text-sm text-slate-400">({total})</span>
        </div>

        <form onSubmit={search} className="mt-4 flex gap-2">
          <input className="input" placeholder="Search name, email or Health ID" value={query} onChange={(e) => setQuery(e.target.value)} />
          <button className="btn-primary" aria-label="Search"><Search className="h-4 w-4" /></button>
        </form>

        <div className="mt-4 space-y-3">
          <Alert>{error}</Alert>
          {loading ? (
            <Spinner />
          ) : patients.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No patients found.</p>
          ) : (
            patients.map((p) => (
              <div key={p.patient_id}
                   className={`rounded-xl border p-4 ${selected === p.patient_id ? "border-teal-500 bg-teal-50/40" : "border-slate-200"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{p.full_name}</p>
                    <p className="text-sm text-slate-500">{p.email}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {p.health_id} · {p.visit_count} {p.visit_count === 1 ? "visit" : "visits"} · {p.report_count} {p.report_count === 1 ? "report" : "reports"}
                    </p>
                    <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${p.is_active ? "bg-teal-50 text-teal-700" : "bg-slate-100 text-slate-500"}`}>
                      {p.is_active ? "Active" : "Deactivated"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-ghost !px-3 !py-2" onClick={() => open(p.patient_id)}>View</button>
                    <button className={p.is_active ? "btn-danger !px-3 !py-2" : "btn-ghost !px-3 !py-2"}
                            disabled={busyUser === p.user_id} onClick={() => toggleStatus(p)}>
                      {busyUser === p.user_id && <Loader2 className="h-4 w-4 animate-spin" />}
                      {p.is_active ? "Deactivate" : "Reactivate"}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card lg:col-span-2">
        <h2 className="font-medium text-slate-900">Patient overview</h2>
        <div className="mt-4">
          {!selected ? (
            <p className="text-sm text-slate-500">Select a patient to see their profile and activity.</p>
          ) : detailLoading ? (
            <Spinner />
          ) : detailError ? (
            <Alert>{detailError}</Alert>
          ) : detail ? (
            <div className="space-y-6">
              <dl className="grid gap-4 sm:grid-cols-2">
                <Row label="Full name" value={detail.patient.full_name} />
                <Row label="Health ID" value={detail.patient.health_id} />
                <Row label="Email" value={detail.patient.email} />
                <Row label="Phone" value={detail.patient.phone} />
                <Row label="Date of birth" value={formatDay(detail.patient.date_of_birth)} />
                <Row label="Gender" value={GENDER_LABELS[detail.patient.gender]} />
                <Row label="Blood group" value={detail.patient.blood_group} />
                <Row label="Registered" value={detail.patient.registered_at ? formatDay(detail.patient.registered_at.slice(0, 10)) : ""} />
                <div className="sm:col-span-2"><Row label="Address" value={detail.patient.address} /></div>
                <Row label="Emergency contact" value={detail.patient.emergency_contact_name} />
                <Row label="Emergency phone" value={detail.patient.emergency_contact_phone} />
              </dl>

              <div>
                <h3 className="mb-3 text-sm font-medium text-slate-900">
                  Reports ({detail.summary.report_count}) · Visits ({detail.summary.visit_count})
                </h3>
                <CategoryBreakdown byCategory={detail.summary.reports_by_category} />
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium text-slate-900">Uploaded reports</h3>
                {detail.records.length === 0 ? (
                  <p className="text-sm text-slate-500">None.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {detail.records.map((r) => (
                      <li key={r.id} className="flex justify-between gap-2">
                        <span className="text-slate-700">{r.title}</span>
                        <span className="shrink-0 text-xs text-slate-500">{CATEGORY_LABELS[r.category] || r.category} · {formatDay(r.uploaded_at?.slice(0, 10))}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <h3 className="mb-2 text-sm font-medium text-slate-900">Visits</h3>
                {detail.visits.length === 0 ? (
                  <p className="text-sm text-slate-500">None.</p>
                ) : (
                  <ul className="space-y-1.5 text-sm">
                    {detail.visits.map((v) => (
                      <li key={v.id} className="flex justify-between gap-2">
                        <span className="text-slate-700">{v.doctor_name}</span>
                        <span className="shrink-0 text-xs text-slate-500">{formatDay(v.visit_date)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                Report contents, PDFs and visit notes are visible only to the patient and doctors they approve.
                Your views of this page are recorded in the audit log.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
