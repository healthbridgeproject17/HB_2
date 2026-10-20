import { useEffect, useState } from "react";
import { CalendarCheck, FileText, Hospital } from "lucide-react";
import api, { errorMessage } from "../api/client.js";
import { Alert, Spinner } from "./ui.jsx";
import { CATEGORY_LABELS } from "./RecordList.jsx";
import { formatDay } from "../utils/format.js";

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="card flex items-center gap-4">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

export function CategoryBreakdown({ byCategory }) {
  const total = Object.values(byCategory).reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...Object.values(byCategory));
  if (total === 0) return <p className="text-sm text-slate-500">No reports uploaded yet.</p>;
  return (
    <div className="space-y-3">
      {Object.entries(byCategory).map(([key, n]) => (
        <div key={key}>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-slate-700">{CATEGORY_LABELS[key] || key}</span>
            <span className="font-medium text-slate-900">{n}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-teal-500" style={{ width: `${(n / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SummaryCards({ refreshKey = 0 }) {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    api.get("/patient/summary")
      .then((res) => alive && (setSummary(res.data.summary), setError("")))
      .catch((err) => alive && setError(errorMessage(err)));
    return () => { alive = false; };
  }, [refreshKey]);

  if (error) return <Alert>{error}</Alert>;
  if (!summary) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat icon={Hospital} label="Hospital visits" value={summary.visit_count} />
        <Stat icon={FileText} label="Reports uploaded" value={summary.report_count} />
        <Stat icon={CalendarCheck} label="Last visit" value={summary.last_visit_date ? formatDay(summary.last_visit_date) : "None yet"} />
      </div>
      <div className="card">
        <h2 className="font-medium text-slate-900">Reports by type</h2>
        <div className="mt-4"><CategoryBreakdown byCategory={summary.reports_by_category} /></div>
      </div>
    </div>
  );
}
