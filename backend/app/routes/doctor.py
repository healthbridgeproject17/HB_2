import os
from flask import Blueprint, jsonify, send_file
from ..extensions import db
from ..models import MedicalRecord, Patient, PatientAccessGrant
from ..utils.records import record_path, serialize_record
from ..utils.auth import roles_required, current_user
from ..utils.audit import log_event

doctor_bp = Blueprint("doctor", __name__)


def serialize_patient_summary(patient):
    return {
        "patient_id": patient.id,
        "full_name": patient.full_name,
        "health_id": patient.health_id.code if patient.health_id else None,
    }


@doctor_bp.get("/patients")
@roles_required("doctor")
def my_patients():
    doctor = current_user().doctor
    if doctor is None:
        return jsonify(error="Doctor profile missing"), 403
    grants = PatientAccessGrant.query.filter_by(doctor_id=doctor.id, revoked_at=None).all()
    return jsonify(patients=[serialize_patient_summary(g.patient) for g in grants])


@doctor_bp.get("/patients/<int:patient_id>")
@roles_required("doctor")
def patient_detail(patient_id):
    user = current_user()
    doctor = user.doctor
    if doctor is None:
        return jsonify(error="Doctor profile missing"), 403

    grant = PatientAccessGrant.query.filter_by(
        doctor_id=doctor.id, patient_id=patient_id, revoked_at=None).first()
    if grant is None:
        log_event("access_denied", user.id, "patient", patient_id, "no active access grant")
        return jsonify(error="No access to this patient"), 403

    patient = db.session.get(Patient, patient_id)
    log_event("patient_viewed", user.id, "patient", patient_id)
    data = serialize_patient_summary(patient)
    data.update(phone=patient.phone,
                date_of_birth=patient.date_of_birth.isoformat() if patient.date_of_birth else None)
    return jsonify(patient=data)


def _require_grant(user, patient_id):
    """Return None when the doctor has an active grant for this patient, else an error response."""
    doctor = user.doctor
    if doctor is None:
        return jsonify(error="Doctor profile missing"), 403
    grant = PatientAccessGrant.query.filter_by(
        doctor_id=doctor.id, patient_id=patient_id, revoked_at=None).first()
    if grant is None:
        log_event("access_denied", user.id, "patient", patient_id, "no active access grant")
        return jsonify(error="No access to this patient"), 403
    return None


def _granted_record(user, patient_id, record_id):
    err = _require_grant(user, patient_id)
    if err:
        return None, err
    rec = db.session.get(MedicalRecord, record_id)
    if rec is None or rec.patient_id != patient_id:
        return None, (jsonify(error="Record not found"), 404)
    return rec, None


@doctor_bp.get("/patients/<int:patient_id>/records")
@roles_required("doctor")
def patient_records(patient_id):
    err = _require_grant(current_user(), patient_id)
    if err:
        return err
    recs = (MedicalRecord.query.filter_by(patient_id=patient_id)
            .order_by(MedicalRecord.uploaded_at.desc()).all())
    return jsonify(records=[serialize_record(r) for r in recs])


@doctor_bp.get("/patients/<int:patient_id>/records/<int:record_id>")
@roles_required("doctor")
def patient_record_detail(patient_id, record_id):
    user = current_user()
    rec, err = _granted_record(user, patient_id, record_id)
    if err:
        return err
    log_event("record_viewed", user.id, "medical_record", rec.id)
    return jsonify(record=serialize_record(rec, include_text=True))


@doctor_bp.get("/patients/<int:patient_id>/records/<int:record_id>/file")
@roles_required("doctor")
def patient_record_file(patient_id, record_id):
    user = current_user()
    rec, err = _granted_record(user, patient_id, record_id)
    if err:
        return err
    path = record_path(rec)
    if not os.path.exists(path):
        return jsonify(error="The stored file is missing"), 404
    log_event("record_file_viewed", user.id, "medical_record", rec.id)
    resp = send_file(path, mimetype="application/pdf", download_name=rec.original_filename)
    resp.headers["X-Content-Type-Options"] = "nosniff"
    return resp
