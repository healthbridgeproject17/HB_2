import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Loader2, Upload } from "lucide-react";
import api, { errorMessage } from "../api/client.js";
import { Alert, Spinner } from "./ui.jsx";
import RecordList, { CATEGORY_LABELS } from "./RecordList.jsx";

const MAX_MB = 10;

export default function RecordsSection({ onChange }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("lab_report");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState("");
  const [formOk, setFormOk] = useState("");
  const fileInput = useRef(null);

  const load = useCallback(async () => {
    setListError("");
    try {
      const res = await api.get("/records");
      setRecords(res.data.records);
    } catch (err) {
      setListError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pickFile = (e) => {
    setFormError("");
    const f = e.target.files?.[0] || null;
    if (f && !f.name.toLowerCase().endsWith(".pdf")) {
      setFile(null);
      e.target.value = "";
      return setFormError("Only PDF files are accepted.");
    }
    if (f && f.size > MAX_MB * 1024 * 1024) {
      setFile(null);
      e.target.value = "";
      return setFormError(`File is too large. Maximum size is ${MAX_MB} MB.`);
    }
    setFile(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    setFormError("");
    setFormOk("");
    if (!file) return setFormError("Choose a PDF file first.");

    const body = new FormData();
    body.append("file", file);
    body.append("title", title.trim());
    body.append("category", category);

    setUploading(true);
    try {
      const res = await api.post("/records", body);
      const rec = res.data.record;
      setFormOk(
        rec.processing_status === "processed"
          ? "Report uploaded and text extracted."
          : "Report uploaded, but no readable text was found (it may be a scanned document)."
      );
      setTitle("");
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      await load();
      onChange?.();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id) => {
    await api.delete(`/records/${id}`);
    await load();
    onChange?.();
  };

  return (
    <div className="card mt-6">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-teal-600" />
        <h2 className="font-medium text-slate-900">Medical records</h2>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Upload PDF reports. Only you, and doctors you have approved, can see them.
      </p>

      <form onSubmit={submit} className="mt-5 grid gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Alert>{formError}</Alert><Alert kind="success">{formOk}</Alert></div>
        <div>
          <label className="label" htmlFor="rec_title">Title</label>
          <input id="rec_title" required maxLength={150} className="input" value={title}
                 onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Blood test, March 2026" />
        </div>
        <div>
          <label className="label" htmlFor="rec_cat">Category</label>
          <select id="rec_cat" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="rec_file">PDF file (max {MAX_MB} MB)</label>
          <input id="rec_file" ref={fileInput} type="file" accept="application/pdf,.pdf" onChange={pickFile}
                 className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-teal-50 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-teal-700 hover:file:bg-teal-100" />
        </div>
        <div className="sm:col-span-2">
          <button className="btn-primary" disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {uploading ? "Uploading..." : "Upload report"}
          </button>
        </div>
      </form>

      <div className="mt-6">
        <Alert>{listError}</Alert>
        {loading ? (
          <Spinner />
        ) : (
          <RecordList
            records={records}
            loadDetail={async (id) => (await api.get(`/records/${id}`)).data.record}
            fileUrl={(id) => `/records/${id}/file`}
            onDelete={remove}
          />
        )}
      </div>
    </div>
  );
}
