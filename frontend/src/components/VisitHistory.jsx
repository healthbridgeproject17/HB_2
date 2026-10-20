import { useEffect, useState } from "react";
import { Hospital } from "lucide-react";
import api, { errorMessage } from "../api/client.js";
import { Alert, Spinner } from "./ui.jsx";
import { formatDay } from "../utils/format.js";

export default function VisitHistory() {
  const [visits, setVisits] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/patient/visits")
      .then((res) => setVisits(res.data.visits))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  return (
    <div className="card">
      <div className="flex items-center gap-2">
        <Hospital className="h-5 w-5 text-teal-600" />
        <h2 className="font-medium text-slate-900">Hospital visits</h2>
      </div>
      <div className="mt-4 space-y-3">
        <Alert>{error}</Alert>
        {!visits && !error ? (
          <Spinner />
        ) : visits && visits.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No visits recorded yet. Visits are recorded by your doctor.
          </p>
        ) : (
          visits?.map((v) => (
            <div key={v.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-slate-900">{v.reason}</p>
                <span className="text-xs text-slate-500">{formatDay(v.visit_date)}</span>
              </div>
              <p className="text-sm text-slate-500">{v.doctor_name}{v.specialization ? ` · ${v.specialization}` : ""}</p>
              {v.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{v.notes}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
