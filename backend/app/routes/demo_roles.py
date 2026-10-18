from flask import Blueprint, jsonify
from ..utils.auth import roles_required

# Temporary routes that prove role checks work. Remove once real routes exist.
roles_demo_bp = Blueprint("roles_demo", __name__)


@roles_demo_bp.get("/patient-area")
@roles_required("patient")
def patient_area():
    return jsonify(message="patient ok")


@roles_demo_bp.get("/doctor-area")
@roles_required("doctor")
def doctor_area():
    return jsonify(message="doctor ok")
