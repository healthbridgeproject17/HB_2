from flask import Blueprint, request, jsonify
from ..extensions import db
from sqlalchemy import func, or_
from ..models import Doctor, HealthId, MedicalRecord, Patient, User, Visit
from ..utils.auth import roles_required, current_user
from ..utils.audit import log_event
from ..utils.profile import patient_summary, serialize_profile, serialize_visit
from ..utils.records import serialize_record
from .auth import EMAIL_RE

admin_bp = Blueprint("admin", __name__)


def serialize_doctor(doctor):
    return {
        "doctor_id": doctor.id,
        "user_id": doctor.user_id,
        "email": doctor.user.email,
        "full_name": doctor.full_name,
        "specialization": doctor.specialization,
        "is_active": doctor.user.is_active_account,
    }


@admin_bp.post("/doctors")
@roles_required("hospital_admin")
def create_doctor():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("temporary_password") or ""
    full_name = (data.get("full_name") or "").strip()
    specialization = (data.get("specialization") or "").strip() or None

    if not EMAIL_RE.match(email):
        return jsonify(error="Valid email required"), 400
    if len(password) < 8:
        return jsonify(error="temporary_password must be at least 8 characters"), 400
    if not full_name:
        return jsonify(error="Full name required"), 400
    if User.query.filter_by(email=email).first():
        return jsonify(error="Email already registered"), 409

    actor = current_user()
    try:
        user = User(email=email, role="doctor")
        user.set_password(password)
        doctor = Doctor(user=user, full_name=full_name, specialization=specialization)
        db.session.add_all([user, doctor])
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify(error="Could not create doctor"), 500

    log_event("doctor_created", actor.id, "user", user.id)
    return jsonify(doctor=serialize_doctor(doctor)), 201


@admin_bp.get("/doctors")
@roles_required("hospital_admin")
def list_doctors():
    doctors = Doctor.query.order_by(Doctor.id).all()
    return jsonify(doctors=[serialize_doctor(d) for d in doctors])


@admin_bp.patch("/users/<int:user_id>/status")
@roles_required("hospital_admin")
def set_user_status(user_id):
    data = request.get_json(silent=True) or {}
    if not isinstance(data.get("is_active"), bool):
        return jsonify(error="is_active (true/false) required"), 400

    actor = current_user()
    target = db.session.get(User, user_id)
    if target is None:
        return jsonify(error="User not found"), 404
    if target.id == actor.id:
        return jsonify(error="You cannot change your own status"), 400
    if target.role not in ("doctor", "patient"):
        return jsonify(error="Only doctor and patient accounts can be changed here"), 403

    target.is_active_account = data["is_active"]
    db.session.commit()
    log_event("account_activated" if target.is_active_account else "account_deactivated",
              actor.id, "user", target.id)
    return jsonify(user_id=target.id, is_active=target.is_active_account)


def _escape_like(text):
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


@admin_bp.get("/patients")
@roles_required("hospital_admin")
def list_patients():
    q = (request.args.get("q") or "").strip()
    limit = min(max(request.args.get("limit", 100, type=int), 1), 200)
    offset = max(request.args.get("offset", 0, type=int), 0)

    query = (db.session.query(Patient, User, HealthId)
             .join(User, Patient.user_id == User.id)
             .outerjoin(HealthId, HealthId.patient_id == Patient.id))
    if q:
        like = f"%{_escape_like(q)}%"
        query = query.filter(or_(Patient.full_name.ilike(like, escape="\\"),
                                 User.email.ilike(like, escape="\\"),
                                 HealthId.code.ilike(like, escape="\\")))
    total = query.count()
    rows = query.order_by(Patient.id).limit(limit).offset(offset).all()

    ids = [p.id for p, _, _ in rows]
    report_counts, visit_counts = {}, {}
    if ids:
        report_counts = dict(db.session.query(MedicalRecord.patient_id, func.count(MedicalRecord.id))
                             .filter(MedicalRecord.patient_id.in_(ids))
                             .group_by(MedicalRecord.patient_id).all())
        visit_counts = dict(db.session.query(Visit.patient_id, func.count(Visit.id))
                            .filter(Visit.patient_id.in_(ids))
                            .group_by(Visit.patient_id).all())

    return jsonify(total=total, patients=[{
        "patient_id": p.id,
        "user_id": u.id,
        "full_name": p.full_name,
        "email": u.email,
        "health_id": h.code if h else None,
        "is_active": u.is_active_account,
        "report_count": report_counts.get(p.id, 0),
        "visit_count": visit_counts.get(p.id, 0),
        "registered_at": p.created_at.isoformat() if p.created_at else None,
    } for p, u, h in rows])


@admin_bp.get("/patients/<int:patient_id>")
@roles_required("hospital_admin")
def patient_overview(patient_id):
    """Profile, counts and report/visit metadata. Report text, PDFs, visit reasons and
    notes are clinical content and stay with the patient and their approved doctors."""
    patient = db.session.get(Patient, patient_id)
    if patient is None:
        return jsonify(error="Patient not found"), 404

    log_event("admin_viewed_patient", current_user().id, "patient", patient_id)
    records = (MedicalRecord.query.filter_by(patient_id=patient_id)
               .order_by(MedicalRecord.uploaded_at.desc()).all())
    visits = (Visit.query.filter_by(patient_id=patient_id)
              .order_by(Visit.visit_date.desc(), Visit.id.desc()).all())

    profile = serialize_profile(patient)
    profile.update(patient_id=patient.id, user_id=patient.user_id,
                   is_active=patient.user.is_active_account,
                   registered_at=patient.created_at.isoformat() if patient.created_at else None)
    return jsonify(
        patient=profile,
        summary=patient_summary(patient_id),
        records=[serialize_record(r) for r in records],
        visits=[serialize_visit(v, include_details=False) for v in visits],
    )
