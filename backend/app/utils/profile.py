import re
from datetime import date, datetime
from sqlalchemy import func
from ..extensions import db
from ..models import MedicalRecord, Visit
from .records import CATEGORIES

GENDERS = ["female", "male", "other", "prefer_not_to_say"]
BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]
PHONE_RE = re.compile(r"^[0-9+()\-\s]{7,30}$")


def serialize_profile(patient):
    return {
        "full_name": patient.full_name,
        "email": patient.user.email,
        "health_id": patient.health_id.code if patient.health_id else None,
        "phone": patient.phone,
        "date_of_birth": patient.date_of_birth.isoformat() if patient.date_of_birth else None,
        "gender": patient.gender,
        "blood_group": patient.blood_group,
        "address": patient.address,
        "emergency_contact_name": patient.emergency_contact_name,
        "emergency_contact_phone": patient.emergency_contact_phone,
    }


def _text(value, label, max_len):
    if value is None:
        return None, None
    if not isinstance(value, str):
        return None, f"{label} must be text"
    value = value.strip()
    if len(value) > max_len:
        return None, f"{label} is too long (maximum {max_len} characters)"
    return (value or None), None


def _phone(value, label):
    value, err = _text(value, label, 30)
    if err or value is None:
        return value, err
    if not PHONE_RE.match(value):
        return None, f"{label} is not a valid phone number"
    return value, None


def validate_profile_update(data):
    """Only the fields below can be edited. Email, Health ID and role are never changed here."""
    clean = {}

    if "full_name" in data:
        v, err = _text(data["full_name"], "Full name", 150)
        if err or not v:
            return None, err or "Full name cannot be empty"
        clean["full_name"] = v

    for field, label in (("address", "Address"),):
        if field in data:
            v, err = _text(data[field], label, 300)
            if err:
                return None, err
            clean[field] = v

    if "emergency_contact_name" in data:
        v, err = _text(data["emergency_contact_name"], "Emergency contact name", 150)
        if err:
            return None, err
        clean["emergency_contact_name"] = v

    for field, label in (("phone", "Phone"), ("emergency_contact_phone", "Emergency contact phone")):
        if field in data:
            v, err = _phone(data[field], label)
            if err:
                return None, err
            clean[field] = v

    if "date_of_birth" in data:
        raw = data["date_of_birth"]
        if raw in (None, ""):
            clean["date_of_birth"] = None
        else:
            try:
                dob = datetime.strptime(str(raw), "%Y-%m-%d").date()
            except ValueError:
                return None, "Date of birth must be YYYY-MM-DD"
            if dob > date.today() or dob.year < 1900:
                return None, "Date of birth is not valid"
            clean["date_of_birth"] = dob

    if "gender" in data:
        v = data["gender"] or None
        if v is not None and v not in GENDERS:
            return None, "Invalid gender value"
        clean["gender"] = v

    if "blood_group" in data:
        v = data["blood_group"] or None
        if v is not None and v not in BLOOD_GROUPS:
            return None, "Invalid blood group"
        clean["blood_group"] = v

    return clean, None


def patient_summary(patient_id):
    """Counts only: visits, reports, and reports per category. Never reads report contents."""
    by_category = dict.fromkeys(CATEGORIES, 0)
    rows = (db.session.query(MedicalRecord.category, func.count(MedicalRecord.id))
            .filter(MedicalRecord.patient_id == patient_id)
            .group_by(MedicalRecord.category).all())
    for category, n in rows:
        by_category[category] = n

    visit_count, last_visit = (db.session.query(func.count(Visit.id), func.max(Visit.visit_date))
                               .filter(Visit.patient_id == patient_id).one())
    return {
        "visit_count": visit_count,
        "last_visit_date": last_visit.isoformat() if last_visit else None,
        "report_count": sum(by_category.values()),
        "reports_by_category": by_category,
    }


def serialize_visit(visit, include_details=True):
    data = {
        "id": visit.id,
        "visit_date": visit.visit_date.isoformat(),
        "doctor_name": visit.doctor.full_name,
        "specialization": visit.doctor.specialization,
    }
    if include_details:  # reason and notes are clinical: patient and approved doctors only
        data["reason"] = visit.reason
        data["notes"] = visit.notes
    return data


def validate_visit(data):
    raw = data.get("visit_date")
    try:
        visit_date = datetime.strptime(str(raw), "%Y-%m-%d").date()
    except ValueError:
        return None, "visit_date must be YYYY-MM-DD"
    if visit_date > date.today():
        return None, "Visit date cannot be in the future"
    if visit_date.year < 1900:
        return None, "Visit date is not valid"

    reason, err = _text(data.get("reason"), "Reason", 200)
    if err or not reason:
        return None, err or "Reason is required"
    notes, err = _text(data.get("notes"), "Notes", 2000)
    if err:
        return None, err
    return {"visit_date": visit_date, "reason": reason, "notes": notes}, None
