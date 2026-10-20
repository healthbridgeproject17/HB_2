import io
from datetime import date, timedelta
import pymupdf
import pytest
from app import create_app
from app.extensions import db
from app.models import AuditLog, User
from config import TestConfig

PW = "Password123"


@pytest.fixture
def app(tmp_path):
    class Cfg(TestConfig):
        UPLOAD_FOLDER = str(tmp_path / "uploads")

    app = create_app(Cfg)
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


def headers(client, email):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": PW})
    return {"Authorization": f"Bearer {res.get_json()['access_token']}"}


def register(client, email, name=None):
    client.post("/api/v1/auth/register",
                json={"email": email, "password": PW, "full_name": name or "P " + email})


def make_admin(email="admin@test.com", role="hospital_admin"):
    u = User(email=email, role=role)
    u.set_password(PW)
    db.session.add(u)
    db.session.commit()


def make_doctor(client):
    make_admin()
    ah = headers(client, "admin@test.com")
    res = client.post("/api/v1/admin/doctors", headers=ah, json={
        "email": "doc@test.com", "temporary_password": PW, "full_name": "Dr Rao", "specialization": "GP"})
    return res.get_json()["doctor"]["doctor_id"]


def pdf_bytes(text="Hemoglobin 13.5 g/dL reference 12.0-15.5 g/dL"):
    doc = pymupdf.open()
    doc.new_page().insert_text((72, 72), text)
    data = doc.tobytes()
    doc.close()
    return data


def upload(client, h, category, title="Report"):
    return client.post("/api/v1/records", headers=h, content_type="multipart/form-data",
                       data={"file": (io.BytesIO(pdf_bytes()), "r.pdf"), "title": title, "category": category})


def grant(client, ph, doctor_id):
    client.post("/api/v1/patient/access-grants", headers=ph, json={"doctor_id": doctor_id})


# ---------- profile editing
def test_patient_can_edit_profile_and_it_persists(client):
    register(client, "p@test.com", "Old Name")
    h = headers(client, "p@test.com")
    res = client.patch("/api/v1/patient/profile", headers=h, json={
        "full_name": "New Name", "phone": "+91 98765 43210", "date_of_birth": "2005-02-19",
        "gender": "female", "blood_group": "O+", "address": "12 Beach Road, Chennai",
        "emergency_contact_name": "Asha", "emergency_contact_phone": "9123456780"})
    assert res.status_code == 200
    got = client.get("/api/v1/patient/profile", headers=h).get_json()["profile"]
    assert got["full_name"] == "New Name" and got["blood_group"] == "O+"
    assert got["date_of_birth"] == "2005-02-19" and got["emergency_contact_name"] == "Asha"
    assert client.get("/api/v1/auth/me", headers=h).get_json()["user"]["full_name"] == "New Name"


def test_partial_update_keeps_other_fields_and_empty_clears(client):
    register(client, "p@test.com")
    h = headers(client, "p@test.com")
    client.patch("/api/v1/patient/profile", headers=h, json={"phone": "9876543210", "blood_group": "A+"})
    client.patch("/api/v1/patient/profile", headers=h, json={"phone": ""})
    got = client.get("/api/v1/patient/profile", headers=h).get_json()["profile"]
    assert got["phone"] is None and got["blood_group"] == "A+"


def test_protected_fields_cannot_be_changed(client):
    register(client, "p@test.com")
    h = headers(client, "p@test.com")
    before = client.get("/api/v1/patient/profile", headers=h).get_json()["profile"]
    client.patch("/api/v1/patient/profile", headers=h,
                 json={"health_id": "HB-HACK", "email": "x@test.com", "role": "hospital_admin", "full_name": "Ok"})
    after = client.get("/api/v1/patient/profile", headers=h).get_json()["profile"]
    assert after["health_id"] == before["health_id"] and after["email"] == "p@test.com"
    assert client.get("/api/v1/auth/me", headers=h).get_json()["user"]["role"] == "patient"


@pytest.mark.parametrize("body", [
    {"full_name": "   "}, {"blood_group": "Z+"}, {"gender": "robot"}, {"phone": "abc"},
    {"date_of_birth": (date.today() + timedelta(days=1)).isoformat()}, {"date_of_birth": "19-02-2005"},
    {"address": "x" * 301}, {"full_name": 123},
])
def test_invalid_profile_values_rejected(client, body):
    register(client, "p@test.com")
    h = headers(client, "p@test.com")
    assert client.patch("/api/v1/patient/profile", headers=h, json=body).status_code == 400


def test_profile_audit_records_field_names_not_values(client):
    register(client, "p@test.com")
    h = headers(client, "p@test.com")
    client.patch("/api/v1/patient/profile", headers=h, json={"address": "Secret Street 9", "phone": "9876543210"})
    entry = AuditLog.query.filter_by(action="profile_updated").one()
    assert "address" in entry.detail and "Secret Street" not in entry.detail and "9876543210" not in entry.detail


def test_profile_endpoints_are_patient_only(client):
    make_doctor(client)
    dh = headers(client, "doc@test.com")
    assert client.get("/api/v1/patient/profile", headers=dh).status_code == 403
    assert client.patch("/api/v1/patient/profile", headers=dh, json={"phone": "9876543210"}).status_code == 403
    assert client.get("/api/v1/patient/profile").status_code == 401


# ---------- summary + visits
def test_summary_counts_reports_by_type_and_visits(client):
    register(client, "p@test.com")
    ph = headers(client, "p@test.com")
    for cat in ("lab_report", "lab_report", "prescription", "imaging"):
        upload(client, ph, cat)
    doctor_id = make_doctor(client)
    dh = headers(client, "doc@test.com")
    grant(client, ph, doctor_id)
    for d in ("2026-01-10", "2026-03-05"):
        assert client.post("/api/v1/doctor/patients/1/visits", headers=dh,
                           json={"visit_date": d, "reason": "Checkup"}).status_code == 201

    s = client.get("/api/v1/patient/summary", headers=ph).get_json()["summary"]
    assert s["report_count"] == 4 and s["visit_count"] == 2 and s["last_visit_date"] == "2026-03-05"
    assert s["reports_by_category"]["lab_report"] == 2
    assert s["reports_by_category"]["prescription"] == 1 and s["reports_by_category"]["other"] == 0


def test_summary_for_new_patient_is_zero_not_missing(client):
    register(client, "p@test.com")
    s = client.get("/api/v1/patient/summary", headers=headers(client, "p@test.com")).get_json()["summary"]
    assert s["report_count"] == 0 and s["visit_count"] == 0 and s["last_visit_date"] is None


def test_visits_require_grant_and_valid_input(client):
    register(client, "p@test.com")
    ph = headers(client, "p@test.com")
    doctor_id = make_doctor(client)
    dh = headers(client, "doc@test.com")
    url = "/api/v1/doctor/patients/1/visits"
    ok = {"visit_date": "2026-02-02", "reason": "Fever", "notes": "Rest and fluids"}

    assert client.post(url, headers=dh, json=ok).status_code == 403
    assert client.get(url, headers=dh).status_code == 403
    grant(client, ph, doctor_id)
    future = (date.today() + timedelta(days=2)).isoformat()
    assert client.post(url, headers=dh, json={**ok, "visit_date": future}).status_code == 400
    assert client.post(url, headers=dh, json={**ok, "reason": ""}).status_code == 400
    assert client.post(url, headers=dh, json={**ok, "visit_date": "bad"}).status_code == 400
    assert client.post(url, headers=dh, json=ok).status_code == 201
    assert len(client.get(url, headers=dh).get_json()["visits"]) == 1

    mine = client.get("/api/v1/patient/visits", headers=ph).get_json()["visits"]
    assert mine[0]["reason"] == "Fever" and mine[0]["doctor_name"] == "Dr Rao" and mine[0]["notes"] == "Rest and fluids"

    client.delete(f"/api/v1/patient/access-grants/{doctor_id}", headers=ph)
    assert client.post(url, headers=dh, json=ok).status_code == 403


def test_patients_cannot_record_visits(client):
    register(client, "p@test.com")
    ph = headers(client, "p@test.com")
    r = client.post("/api/v1/doctor/patients/1/visits", headers=ph,
                    json={"visit_date": "2026-02-02", "reason": "Self"})
    assert r.status_code == 403


# ---------- admin overview
def test_admin_lists_all_patients_with_counts_and_search(client):
    register(client, "anita@test.com", "Anita Roy")
    register(client, "bala@test.com", "Bala Kumar")
    upload(client, headers(client, "anita@test.com"), "lab_report")
    make_admin("boss@test.com")
    ah = headers(client, "boss@test.com")

    res = client.get("/api/v1/admin/patients", headers=ah).get_json()
    assert res["total"] == 2
    by_name = {p["full_name"]: p for p in res["patients"]}
    assert by_name["Anita Roy"]["report_count"] == 1 and by_name["Bala Kumar"]["report_count"] == 0
    assert by_name["Anita Roy"]["health_id"].startswith("HB-")

    assert client.get("/api/v1/admin/patients?q=bala", headers=ah).get_json()["total"] == 1
    assert client.get("/api/v1/admin/patients?q=HB-", headers=ah).get_json()["total"] == 2
    assert client.get("/api/v1/admin/patients?q=%25", headers=ah).get_json()["total"] == 0  # % is literal


def test_admin_overview_has_metadata_but_no_clinical_content(client):
    register(client, "p@test.com", "Pat")
    ph = headers(client, "p@test.com")
    upload(client, ph, "lab_report", title="Blood work")
    doctor_id = make_doctor(client)
    dh = headers(client, "doc@test.com")
    grant(client, ph, doctor_id)
    client.post("/api/v1/doctor/patients/1/visits", headers=dh, json={
        "visit_date": "2026-02-02", "reason": "SECRET-REASON", "notes": "SECRET-NOTES"})

    ah = headers(client, "admin@test.com")
    res = client.get("/api/v1/admin/patients/1", headers=ah)
    body = res.get_data(as_text=True)
    data = res.get_json()
    assert res.status_code == 200
    assert data["summary"]["report_count"] == 1 and data["summary"]["visit_count"] == 1
    assert data["records"][0]["title"] == "Blood work" and data["records"][0]["category"] == "lab_report"
    assert data["visits"][0]["doctor_name"] == "Dr Rao"
    assert "SECRET-REASON" not in body and "SECRET-NOTES" not in body
    assert "Hemoglobin" not in body and "extracted_text" not in body
    assert "admin_viewed_patient" in [a.action for a in AuditLog.query.all()]
    assert client.get("/api/v1/admin/patients/999", headers=ah).status_code == 404


def test_only_hospital_admin_can_use_admin_patient_endpoints(client):
    register(client, "p@test.com")
    make_doctor(client)
    make_admin("sec@test.com", "security_admin")
    for who in ("p@test.com", "doc@test.com", "sec@test.com"):
        h = headers(client, who)
        assert client.get("/api/v1/admin/patients", headers=h).status_code == 403
        assert client.get("/api/v1/admin/patients/1", headers=h).status_code == 403
    assert client.get("/api/v1/admin/patients").status_code == 401
