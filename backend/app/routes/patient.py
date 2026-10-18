from flask import Blueprint, request, jsonify
from ..extensions import db
from ..models import Doctor, PatientAccessGrant, utcnow
from ..utils.auth import roles_required, current_user
from ..utils.audit import log_event

patient_bp = Blueprint("patient", __name__)


def serialize_grant(grant):
    return {
        "doctor_id": grant.doctor_id,
        "doctor_name": grant.doctor.full_name,
        "specialization": grant.doctor.specialization,
        "granted_at": grant.granted_at.isoformat() if grant.granted_at else None,
    }


@patient_bp.get("/doctors")
@roles_required("patient")
def available_doctors():
    doctors = (Doctor.query.join(Doctor.user)
               .filter_by(is_active_account=True).order_by(Doctor.full_name).all())
    return jsonify(doctors=[
        {"doctor_id": d.id, "full_name": d.full_name, "specialization": d.specialization}
        for d in doctors
    ])


@patient_bp.get("/access-grants")
@roles_required("patient")
def my_grants():
    patient = current_user().patient
    grants = PatientAccessGrant.query.filter_by(patient_id=patient.id, revoked_at=None).all()
    return jsonify(grants=[serialize_grant(g) for g in grants])


@patient_bp.post("/access-grants")
@roles_required("patient")
def grant_access():
    user = current_user()
    data = request.get_json(silent=True) or {}
    doctor_id = data.get("doctor_id")
    if not isinstance(doctor_id, int):
        return jsonify(error="doctor_id (integer) required"), 400

    doctor = db.session.get(Doctor, doctor_id)
    if doctor is None or not doctor.user.is_active_account:
        return jsonify(error="Doctor not found"), 404

    grant = PatientAccessGrant.query.filter_by(
        patient_id=user.patient.id, doctor_id=doctor.id).first()
    if grant is None:
        grant = PatientAccessGrant(patient_id=user.patient.id, doctor_id=doctor.id)
        db.session.add(grant)
    elif grant.revoked_at is None:
        return jsonify(error="Access already granted"), 409
    else:
        grant.revoked_at = None
        grant.granted_at = utcnow()
    db.session.commit()

    log_event("access_granted", user.id, "doctor", doctor.id)
    return jsonify(grant=serialize_grant(grant)), 201


@patient_bp.delete("/access-grants/<int:doctor_id>")
@roles_required("patient")
def revoke_access(doctor_id):
    user = current_user()
    grant = PatientAccessGrant.query.filter_by(
        patient_id=user.patient.id, doctor_id=doctor_id, revoked_at=None).first()
    if grant is None:
        return jsonify(error="No active grant for this doctor"), 404

    grant.revoked_at = utcnow()
    db.session.commit()
    log_event("access_revoked", user.id, "doctor", doctor_id)
    return jsonify(message="Access revoked")
