import { useCallback, useEffect, useState } from "react";
import { UserRound, Users } from "lucide-react";
import { Alert, PageTitle, Spinner } from "../../components/ui.jsx";
import RecordList from "../../components/RecordList.jsx";
import api, { errorMessage } from "../../api/client.js";

export default function DoctorDashboard() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailError, setDetailError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [records, setRecords] = useState([]);
  const [recordsError, setRecordsError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await api.get("/doctor/patients");
      setPatients(res.data.patients);
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
    setRecords([]);
    setRecordsError("");
    setDetailLoading(true);
    try {
      const res = await api.get(`/doctor/patients/${patientId}`);
      setDetail(res.data.patient);
      try {
        const recs = await api.get(`/doctor/patients/${patientId}/records`);
        setRecords(recs.data.records);
      } catch (err) {
        setRecordsError(errorMessage(err));
      }
    } catch (err) {
      setDetailError(errorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <>
      <PageTitle title="Your patients" subtitle="Patients who have granted you access to their record." />
      <Alert>{error}</Alert>

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-1">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-teal-600" />
            <h2 className="font-medium text-slate-900">Patient list</h2>
          </div>
          <div className="mt-4 space-y-2">
            {loading ? (
              <Spinner />
            ) : patients.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                No patients have granted you access yet.
              </p>
            ) : (
              patients.map((p) => (
                <button
                  key={p.patient_id}
                  onClick={() => open(p.patient_id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    selected === p.patient_id
                      ? "border-teal-500 bg-teal-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <p className="font-medium text-slate-900">{p.full_name}</p>
                  <p className="text-xs text-slate-500">{p.health_id}</p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="card lg:col-span-2">
          <div className="flex items-center gap-2">
            <UserRound className="h-5 w-5 text-teal-600" />
            <h2 className="font-medium text-slate-900">Patient record</h2>
          </div>
          <div className="mt-4">
            {!selected ? (
              <p className="text-sm text-slate-500">Select a patient to view their record.</p>
            ) : detailLoading ? (
              <Spinner />
            ) : detailError ? (
              <Alert>{detailError}</Alert>
            ) : detail ? (
              <dl className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" value={detail.full_name} />
                <Field label="Health ID" value={detail.health_id} />
                <Field label="Date of birth" value={detail.date_of_birth} />
                <Field label="Phone" value={detail.phone} />
              </dl>
            ) : null}
          </div>
          {detail && (
            <div className="mt-8">
              <h3 className="mb-3 text-sm font-medium text-slate-900">Uploaded reports</h3>
              <Alert>{recordsError}</Alert>
              {!recordsError && (
                <RecordList
                  records={records}
                  loadDetail={async (id) =>
                    (await api.get(`/doctor/patients/${selected}/records/${id}`)).data.record
                  }
                  fileUrl={(id) => `/doctor/patients/${selected}/records/${id}/file`}
                />
              )}
            </div>
          )}
          <p className="mt-6 text-xs text-slate-400">
            AI summaries and clinical records will appear here in later phases.
          </p>
        </div>
      </div>
    </>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-900">{value || "Not provided"}</dd>
    </div>
  );
}
