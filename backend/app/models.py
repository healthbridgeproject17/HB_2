from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from .extensions import db


def utcnow():
    return datetime.now(timezone.utc)


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    # patient | doctor | hospital_admin | security_admin
    role = db.Column(db.String(30), nullable=False, default="patient")
    is_active_account = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)

    patient = db.relationship("Patient", back_populates="user", uselist=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)


class Patient(db.Model):
    __tablename__ = "patients"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False)
    full_name = db.Column(db.String(150), nullable=False)
    phone = db.Column(db.String(30))
    date_of_birth = db.Column(db.Date)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)

    user = db.relationship("User", back_populates="patient")
    health_id = db.relationship("HealthId", back_populates="patient", uselist=False)


class HealthId(db.Model):
    __tablename__ = "health_ids"
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("patients.id"), unique=True, nullable=False)
    code = db.Column(db.String(30), unique=True, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)

    patient = db.relationship("Patient", back_populates="health_id")
