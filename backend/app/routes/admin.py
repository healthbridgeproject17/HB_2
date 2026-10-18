from flask import Blueprint, request, jsonify
from ..extensions import db
from ..models import User, Doctor
from ..utils.auth import roles_required, current_user
from ..utils.audit import log_event
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
