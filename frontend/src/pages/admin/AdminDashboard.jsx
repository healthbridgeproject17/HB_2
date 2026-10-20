import { useState } from "react";
import { PageTitle } from "../../components/ui.jsx";
import DoctorsTab from "./DoctorsTab.jsx";
import PatientsTab from "./PatientsTab.jsx";

const TABS = [
  { id: "patients", label: "Patients" },
  { id: "doctors", label: "Doctors" },
];

export default function AdminDashboard() {
  const [tab, setTab] = useState("patients");
  return (
    <>
      <PageTitle title="Hospital administration" subtitle="Manage patient and doctor accounts." />
      <div className="mb-6 inline-flex rounded-xl border border-slate-200 bg-white p-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                    tab === t.id ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-50"
                  }`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "patients" ? <PatientsTab /> : <DoctorsTab />}
    </>
  );
}
