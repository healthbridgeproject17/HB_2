from flask import Blueprint, jsonify
from ..extensions import db
from ..models import Patient, PatientAccessGrant
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
