import { useState } from "react";
import { ExternalLink, FileText, Loader2, Trash2 } from "lucide-react";
import api, { errorMessage } from "../api/client.js";
import { Alert } from "./ui.jsx";

export const CATEGORY_LABELS = {
  lab_report: "Lab report",
  prescription: "Prescription",
  imaging: "Imaging",
  discharge_summary: "Discharge summary",
  other: "Other",
};

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";
}

// PDFs sit behind authentication, so they are fetched with the token and opened from a temporary blob URL.
export async function openPdf(url, filename = "report.pdf") {
  const win = window.open("about:blank", "_blank");
  try {
    const res = await api.get(url, { responseType: "blob" });
    const blobUrl = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    if (win) {
      win.location.href = blobUrl;
    } else {
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } catch (err) {
    if (win) win.close();
    throw err;
  }
}

function StatusBadge({ status }) {
  const ok = status === "processed";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
      ok ? "bg-teal-50 text-teal-700" : "bg-amber-50 text-amber-700"
    }`}>
      {ok ? "Text extracted" : "No readable text"}
    </span>
  );
}

/**
 * Shared by the patient and doctor dashboards.
 * loadDetail(id) -> record with extracted_text, fileUrl(id) -> API path of the PDF,
 * onDelete(id) is optional (patients only).
 */
export default function RecordList({ records, loadDetail, fileUrl, onDelete }) {
  const [openId, setOpenId] = useState(null);
  const [details, setDetails] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const toggleText = async (id) => {
    setError("");
    if (openId === id) return setOpenId(null);
    setOpenId(id);
    if (!details[id]) {
      setBusy(`text-${id}`);
      try {
        const rec = await loadDetail(id);
        setDetails((d) => ({ ...d, [id]: rec }));
      } catch (err) {
        setError(errorMessage(err));
        setOpenId(null);
      } finally {
        setBusy(null);
      }
    }
  };

  const view = async (rec) => {
    setError("");
    setBusy(`pdf-${rec.id}`);
    try {
      await openPdf(fileUrl(rec.id), rec.original_filename);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (rec) => {
    if (!window.confirm(`Delete "${rec.title}"? This cannot be undone.`)) return;
    setError("");
    setBusy(`del-${rec.id}`);
    try {
      await onDelete(rec.id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (records.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
        No reports uploaded yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <Alert>{error}</Alert>
      {records.map((rec) => (
        <div key={rec.id} className="rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                <FileText className="h-4 w-4" />
              </span>
              <div>
                <p className="font-medium text-slate-900">{rec.title}</p>
                <p className="text-xs text-slate-500">
                  {CATEGORY_LABELS[rec.category] || rec.category} · {formatDate(rec.uploaded_at)} ·{" "}
                  {rec.page_count} {rec.page_count === 1 ? "page" : "pages"} · {formatSize(rec.file_size)}
                </p>
                <div className="mt-2"><StatusBadge status={rec.processing_status} /></div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-ghost !px-3 !py-2" onClick={() => toggleText(rec.id)}>
                {busy === `text-${rec.id}` && <Loader2 className="h-4 w-4 animate-spin" />}
                {openId === rec.id ? "Hide text" : "View text"}
              </button>
              <button className="btn-ghost !px-3 !py-2" onClick={() => view(rec)} disabled={busy === `pdf-${rec.id}`}>
                {busy === `pdf-${rec.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
                Open PDF
              </button>
              {onDelete && (
                <button className="btn-danger !px-3 !py-2" onClick={() => remove(rec)} disabled={busy === `del-${rec.id}`}>
                  {busy === `del-${rec.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              )}
            </div>
          </div>

          {openId === rec.id && details[rec.id] && (
            <div className="mt-4">
              {rec.processing_message && (
                <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {rec.processing_message}
                </p>
              )}
              {details[rec.id].extracted_text ? (
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-700">
                  {details[rec.id].extracted_text}
                </pre>
              ) : (
                <p className="text-sm text-slate-500">There is no extracted text for this report.</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
