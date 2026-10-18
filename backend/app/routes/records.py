import hashlib
import os
import uuid
from flask import Blueprint, current_app, jsonify, request, send_file
from werkzeug.utils import secure_filename
from ..extensions import db
from ..models import MedicalRecord
from ..services.pdf_extract import PdfError, extract_pdf
from ..utils.audit import log_event
from ..utils.auth import current_user, roles_required
from ..utils.records import CATEGORIES, record_path, serialize_record

records_bp = Blueprint("records", __name__)


def _own_record_or_404(user, record_id):
    rec = db.session.get(MedicalRecord, record_id)
    if rec is None:
        return None, (jsonify(error="Record not found"), 404)
    if rec.patient_id != user.patient.id:
        # Same answer as "does not exist" so IDs cannot be probed.
        log_event("access_denied", user.id, "medical_record", record_id, "not the owner")
        return None, (jsonify(error="Record not found"), 404)
    return rec, None


@records_bp.post("")
@roles_required("patient")
def upload_record():
    user = current_user()
    file = request.files.get("file")
    title = (request.form.get("title") or "").strip()
    category = (request.form.get("category") or "").strip()

    if file is None or not file.filename:
        return jsonify(error="A PDF file is required"), 400
    if not title or len(title) > 150:
        return jsonify(error="Title is required (maximum 150 characters)"), 400
    if category not in CATEGORIES:
        return jsonify(error="Invalid category"), 400
    if not file.filename.lower().endswith(".pdf"):
        return jsonify(error="Only PDF files are accepted"), 400

    data = file.read()
    if not data:
        return jsonify(error="The file is empty"), 400

    try:
        result = extract_pdf(data)
    except PdfError as exc:
        return jsonify(error=str(exc)), 400

    stored = f"{uuid.uuid4().hex}.pdf"
    folder = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, stored)
    with open(path, "wb") as fh:
        fh.write(data)

    try:
        rec = MedicalRecord(
            patient_id=user.patient.id,
            title=title,
            category=category,
            original_filename=(secure_filename(file.filename) or "report.pdf")[:255],
            stored_filename=stored,
            file_size=len(data),
            sha256=hashlib.sha256(data).hexdigest(),
            page_count=result["page_count"],
            extracted_text=result["text"],
            processing_status=result["status"],
            processing_message=result["message"],
        )
        db.session.add(rec)
        db.session.commit()
    except Exception:
        db.session.rollback()
        if os.path.exists(path):
            os.remove(path)
        return jsonify(error="Could not save the record"), 500

    log_event("record_uploaded", user.id, "medical_record", rec.id)
    return jsonify(record=serialize_record(rec)), 201


@records_bp.get("")
@roles_required("patient")
def list_records():
    user = current_user()
    recs = (MedicalRecord.query.filter_by(patient_id=user.patient.id)
            .order_by(MedicalRecord.uploaded_at.desc()).all())
    return jsonify(records=[serialize_record(r) for r in recs])


@records_bp.get("/<int:record_id>")
@roles_required("patient")
def get_record(record_id):
    user = current_user()
    rec, err = _own_record_or_404(user, record_id)
    if err:
        return err
    return jsonify(record=serialize_record(rec, include_text=True))


@records_bp.get("/<int:record_id>/file")
@roles_required("patient")
def get_record_file(record_id):
    user = current_user()
    rec, err = _own_record_or_404(user, record_id)
    if err:
        return err
    path = record_path(rec)
    if not os.path.exists(path):
        return jsonify(error="The stored file is missing"), 404
    log_event("record_file_viewed", user.id, "medical_record", rec.id)
    resp = send_file(path, mimetype="application/pdf", download_name=rec.original_filename)
    resp.headers["X-Content-Type-Options"] = "nosniff"
    return resp


@records_bp.delete("/<int:record_id>")
@roles_required("patient")
def delete_record(record_id):
    user = current_user()
    rec, err = _own_record_or_404(user, record_id)
    if err:
        return err
    path = record_path(rec)
    db.session.delete(rec)
    db.session.commit()
    if os.path.exists(path):
        os.remove(path)
    log_event("record_deleted", user.id, "medical_record", record_id)
    return jsonify(message="Record deleted")
