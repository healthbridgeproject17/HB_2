import io
import os
import pymupdf
import pytest
from app import create_app
from app.extensions import db
from app.models import AuditLog, MedicalRecord, User
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


def make_pdf(text="Hemoglobin 13.5 g/dL reference 12.0-15.5 g/dL"):
    doc = pymupdf.open()
    page = doc.new_page()
    if text:
        page.insert_text((72, 72), text)
    data = doc.tobytes()
    doc.close()
    return data


def register(client, email):
    client.post("/api/v1/auth/register", json={"email": email, "password": PW, "full_name": "P " + email})


def headers(client, email):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": PW})
    return {"Authorization": f"Bearer {res.get_json()['access_token']}"}


def upload(client, h, data=None, filename="report.pdf", title="Blood test", category="lab_report"):
    data = make_pdf() if data is None else data
    return client.post(
        "/api/v1/records", headers=h, content_type="multipart/form-data",
        data={"file": (io.BytesIO(data), filename), "title": title, "category": category})


def make_doctor(client):
    admin = User(email="admin@test.com", role="hospital_admin")
    admin.set_password(PW)
    db.session.add(admin)
    db.session.commit()
    ah = headers(client, "admin@test.com")
    res = client.post("/api/v1/admin/doctors", headers=ah, json={
        "email": "doc@test.com", "temporary_password": PW, "full_name": "Dr T", "specialization": "GP"})
    return res.get_json()["doctor"]["doctor_id"]


def test_upload_extracts_text(client):
    register(client, "p1@test.com")
    h = headers(client, "p1@test.com")
    res = upload(client, h)
    assert res.status_code == 201
    rec = res.get_json()["record"]
    assert rec["processing_status"] == "processed"
    detail = client.get(f"/api/v1/records/{rec['id']}", headers=h).get_json()["record"]
    assert "Hemoglobin 13.5" in detail["extracted_text"]


def test_upload_does_not_expose_text_in_list(client):
    register(client, "p1@test.com")
    h = headers(client, "p1@test.com")
    upload(client, h)
    listed = client.get("/api/v1/records", headers=h).get_json()["records"]
    assert len(listed) == 1 and "extracted_text" not in listed[0]


def test_blank_pdf_is_saved_with_no_text_status(client):
    register(client, "p1@test.com")
    h = headers(client, "p1@test.com")
    res = upload(client, h, data=make_pdf(""))
    assert res.status_code == 201
    assert res.get_json()["record"]["processing_status"] == "no_text"


def test_rejects_non_pdf_content_named_pdf(client):
    register(client, "p1@test.com")
    h = headers(client, "p1@test.com")
    assert upload(client, h, data=b"just some text, not a pdf").status_code == 400


def test_rejects_wrong_extension_and_empty_file(client):
    register(client, "p1@test.com")
    h = headers(client, "p1@test.com")
    assert upload(client, h, filename="report.txt").status_code == 400
    assert upload(client, h, data=b"", filename="empty.pdf").status_code == 400


def test_rejects_corrupt_pdf(client):
    register(client, "p1@test.com")
    h = headers(client, "p1@test.com")
    assert upload(client, h, data=b"%PDF-1.4 garbage garbage").status_code == 400


def test_rejects_oversized_file_with_json_error(client):
    register(client, "p1@test.com")
    h = headers(client, "p1@test.com")
    res = upload(client, h, data=b"%PDF-1.4" + b"0" * (2 * 1024 * 1024))
    assert res.status_code == 413
    assert "too large" in res.get_json()["error"].lower()


def test_requires_title_and_valid_category(client):
    register(client, "p1@test.com")
    h = headers(client, "p1@test.com")
    assert upload(client, h, title="").status_code == 400
    assert upload(client, h, category="nonsense").status_code == 400


def test_stored_filename_is_generated_not_user_supplied(app, client):
    register(client, "p1@test.com")
    h = headers(client, "p1@test.com")
    upload(client, h, filename="../../evil name.pdf")
    rec = MedicalRecord.query.first()
    assert "evil" not in rec.stored_filename and ".." not in rec.stored_filename
    assert os.path.exists(os.path.join(app.config["UPLOAD_FOLDER"], rec.stored_filename))


def test_patient_cannot_see_or_delete_other_patients_record(client):
    register(client, "p1@test.com")
    register(client, "p2@test.com")
    h1, h2 = headers(client, "p1@test.com"), headers(client, "p2@test.com")
    rid = upload(client, h1).get_json()["record"]["id"]

    assert client.get("/api/v1/records", headers=h2).get_json()["records"] == []
    assert client.get(f"/api/v1/records/{rid}", headers=h2).status_code == 404
    assert client.get(f"/api/v1/records/{rid}/file", headers=h2).status_code == 404
    assert client.delete(f"/api/v1/records/{rid}", headers=h2).status_code == 404
    assert client.get(f"/api/v1/records/{rid}", headers=h1).status_code == 200
    assert "access_denied" in [a.action for a in AuditLog.query.all()]


def test_file_download_returns_original_pdf(client):
    register(client, "p1@test.com")
    h = headers(client, "p1@test.com")
    data = make_pdf()
    rid = upload(client, h, data=data).get_json()["record"]["id"]
    res = client.get(f"/api/v1/records/{rid}/file", headers=h)
    assert res.status_code == 200 and res.mimetype == "application/pdf"
    assert res.data == data


def test_delete_removes_row_and_file(app, client):
    register(client, "p1@test.com")
    h = headers(client, "p1@test.com")
    rid = upload(client, h).get_json()["record"]["id"]
    path = os.path.join(app.config["UPLOAD_FOLDER"], MedicalRecord.query.first().stored_filename)
    assert os.path.exists(path)
    assert client.delete(f"/api/v1/records/{rid}", headers=h).status_code == 200
    assert not os.path.exists(path)
    assert MedicalRecord.query.count() == 0


def test_only_patients_can_use_patient_record_endpoints(client):
    make_doctor(client)
    dh = headers(client, "doc@test.com")
    assert upload(client, dh).status_code == 403
    assert client.get("/api/v1/records", headers=dh).status_code == 403
    assert client.get("/api/v1/records").status_code == 401


def test_doctor_access_follows_grants(client):
    register(client, "p1@test.com")
    ph = headers(client, "p1@test.com")
    rid = upload(client, ph).get_json()["record"]["id"]
    doctor_id = make_doctor(client)
    dh = headers(client, "doc@test.com")

    base = "/api/v1/doctor/patients/1"
    assert client.get(f"{base}/records", headers=dh).status_code == 403
    assert client.get(f"{base}/records/{rid}", headers=dh).status_code == 403
    assert client.get(f"{base}/records/{rid}/file", headers=dh).status_code == 403

    client.post("/api/v1/patient/access-grants", headers=ph, json={"doctor_id": doctor_id})
    listed = client.get(f"{base}/records", headers=dh).get_json()["records"]
    assert len(listed) == 1
    detail = client.get(f"{base}/records/{rid}", headers=dh).get_json()["record"]
    assert "Hemoglobin" in detail["extracted_text"]
    assert client.get(f"{base}/records/{rid}/file", headers=dh).mimetype == "application/pdf"

    client.delete(f"/api/v1/patient/access-grants/{doctor_id}", headers=ph)
    assert client.get(f"{base}/records", headers=dh).status_code == 403
    assert client.get(f"{base}/records/{rid}", headers=dh).status_code == 403


def test_doctor_cannot_read_record_through_another_patient_id(client):
    register(client, "p1@test.com")
    register(client, "p2@test.com")
    h1, h2 = headers(client, "p1@test.com"), headers(client, "p2@test.com")
    rid = upload(client, h1).get_json()["record"]["id"]
    doctor_id = make_doctor(client)
    dh = headers(client, "doc@test.com")
    # Patient 2 grants the doctor; the doctor must NOT reach patient 1's record via patient 2.
    client.post("/api/v1/patient/access-grants", headers=h2, json={"doctor_id": doctor_id})
    assert client.get(f"/api/v1/doctor/patients/2/records/{rid}", headers=dh).status_code == 404
    assert client.get(f"/api/v1/doctor/patients/1/records/{rid}", headers=dh).status_code == 403


def test_audit_log_has_upload_and_no_clinical_text(client):
    register(client, "p1@test.com")
    h = headers(client, "p1@test.com")
    upload(client, h)
    logs = AuditLog.query.filter_by(action="record_uploaded").all()
    assert len(logs) == 1
    assert "Hemoglobin" not in (logs[0].detail or "")
