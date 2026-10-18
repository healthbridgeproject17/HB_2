import { PageTitle } from "../components/ui.jsx";

export default function SecurityPlaceholder() {
  return (
    <>
      <PageTitle title="Security dashboard" subtitle="Alerts, risk scores and audit logs." />
      <div className="card text-sm text-slate-500">
        The ransomware detection and audit dashboard is built in a later phase.
      </div>
    </>
  );
}
