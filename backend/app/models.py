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
    doctor = db.relationship("Doctor", back_populates="user", uselist=False)

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
    grants = db.relationship("PatientAccessGrant", back_populates="patient")


class HealthId(db.Model):
    __tablename__ = "health_ids"
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("patients.id"), unique=True, nullable=False)
    code = db.Column(db.String(30), unique=True, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)

    patient = db.relationship("Patient", back_populates="health_id")


class Doctor(db.Model):
    __tablename__ = "doctors"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False)
    full_name = db.Column(db.String(150), nullable=False)
    specialization = db.Column(db.String(100))
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow)

    user = db.relationship("User", back_populates="doctor")
    grants = db.relationship("PatientAccessGrant", back_populates="doctor")


class PatientAccessGrant(db.Model):
    """A patient explicitly lets one doctor see their records. revoked_at set = no access."""
    __tablename__ = "patient_access_grants"
    __table_args__ = (
        db.UniqueConstraint("patient_id", "doctor_id", name="uq_grant_patient_doctor"),
    )
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey("patients.id"), nullable=False, index=True)
    doctor_id = db.Column(db.Integer, db.ForeignKey("doctors.id"), nullable=False, index=True)
    granted_at = db.Column(db.DateTime(timezone=True), default=utcnow)
    revoked_at = db.Column(db.DateTime(timezone=True), nullable=True)

    patient = db.relationship("Patient", back_populates="grants")
    doctor = db.relationship("Doctor", back_populates="grants")


class AuditLog(db.Model):
    """Security-relevant actions. Store metadata only: never passwords, tokens or clinical content."""
    __tablename__ = "audit_logs"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    action = db.Column(db.String(60), nullable=False, index=True)
    target_type = db.Column(db.String(40))
    target_id = db.Column(db.Integer)
    detail = db.Column(db.String(255))
    ip_address = db.Column(db.String(45))
    created_at = db.Column(db.DateTime(timezone=True), default=utcnow, index=True)
