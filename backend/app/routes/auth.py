import re
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required
from ..extensions import db
from ..models import User, Patient, HealthId, utcnow
from ..utils.auth import current_user

auth_bp = Blueprint("auth", __name__)
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def serialize_user(user):
    data = {"id": user.id, "email": user.email, "role": user.role}
    if user.patient:
        data["full_name"] = user.patient.full_name
        data["health_id"] = user.patient.health_id.code if user.patient.health_id else None
    return data


@auth_bp.post("/register")
def register():
    """Public registration creates PATIENT accounts only. Any 'role' sent is ignored."""
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    full_name = (data.get("full_name") or "").strip()

    if not EMAIL_RE.match(email):
        return jsonify(error="Valid email required"), 400
    if len(password) < 8:
        return jsonify(error="Password must be at least 8 characters"), 400
    if not full_name:
        return jsonify(error="Full name required"), 400
    if User.query.filter_by(email=email).first():
        return jsonify(error="Email already registered"), 409

    dob = None
    if data.get("date_of_birth"):
        try:
            dob = datetime.strptime(data["date_of_birth"], "%Y-%m-%d").date()
        except ValueError:
            return jsonify(error="date_of_birth must be YYYY-MM-DD"), 400

    try:
        user = User(email=email, role="patient")
        user.set_password(password)
        patient = Patient(user=user, full_name=full_name,
                          phone=data.get("phone"), date_of_birth=dob)
        db.session.add_all([user, patient])
        db.session.flush()  # assigns patient.id
        patient.health_id = HealthId(code=f"HB-{utcnow().year}-{patient.id:06d}")
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify(error="Could not create account"), 500

    return jsonify(user=serialize_user(user)), 201


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return jsonify(error="Invalid email or password"), 401
    if not user.is_active_account:
        return jsonify(error="Account disabled"), 403

    token = create_access_token(identity=str(user.id))
    return jsonify(access_token=token, user=serialize_user(user))


@auth_bp.get("/me")
@jwt_required()
def me():
    user = current_user()
    if user is None or not user.is_active_account:
        return jsonify(error="Account unavailable"), 401
    return jsonify(user=serialize_user(user))


@auth_bp.post("/change-password")
@jwt_required()
def change_password():
    user = current_user()
    data = request.get_json(silent=True) or {}
    current = data.get("current_password") or ""
    new = data.get("new_password") or ""
    if not user.check_password(current):
        return jsonify(error="Current password is incorrect"), 401
    if len(new) < 8:
        return jsonify(error="New password must be at least 8 characters"), 400
    if new == current:
        return jsonify(error="New password must differ from the current one"), 400
    user.set_password(new)
    db.session.commit()
    return jsonify(message="Password changed")
