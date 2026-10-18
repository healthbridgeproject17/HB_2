import pytest
from app import create_app
from app.extensions import db
from app.models import User, AuditLog
from config import TestConfig

PW = "Password123"


@pytest.fixture
def app():
    app = create_app(TestConfig)
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


def make_admin(email="admin@test.com", role="hospital_admin"):
    u = User(email=email, role=role)
    u.set_password(PW)
    db.session.add(u)
    db.session.commit()


def token(client, email, password=PW):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    return res.get_json()["access_token"]


def auth(client, email, password=PW):
    return {"Authorization": f"Bearer {token(client, email, password)}"}


def register_patient(client, email):
    res = client.post("/api/v1/auth/register",
                      json={"email": email, "password": PW, "full_name": "Pat " + email})
    return res.get_json()["user"]


def create_doctor(client, admin_headers, email="doc@test.com"):
    return client.post("/api/v1/admin/doctors", headers=admin_headers, json={
        "email": email, "temporary_password": PW,
        "full_name": "Dr Test", "specialization": "Cardiology"})


def setup_doctor_and_patient(client):
    make_admin()
    ah = auth(client, "admin@test.com")
    doctor = create_doctor(client, ah).get_json()["doctor"]
    register_patient(client, "p1@test.com")
    return ah, doctor


def patient_id_of(client, headers):
    # patient id equals its row id; first registered patient is 1
    return 1


def test_only_admin_can_create_doctor(client):
    make_admin()
    ah = auth(client, "admin@test.com")
    assert create_doctor(client, ah).status_code == 201
    register_patient(client, "p@test.com")
    ph = auth(client, "p@test.com")
    assert create_doctor(client, ph, "x@test.com").status_code == 403
    dh = auth(client, "doc@test.com")
    assert create_doctor(client, dh, "y@test.com").status_code == 403


def test_security_admin_cannot_create_doctor(client):
    make_admin("sec@test.com", "security_admin")
    sh = auth(client, "sec@test.com")
    assert create_doctor(client, sh).status_code == 403


def test_duplicate_doctor_email(client):
    make_admin()
    ah = auth(client, "admin@test.com")
    create_doctor(client, ah)
    assert create_doctor(client, ah).status_code == 409


def test_doctor_sees_only_granted_patients(client):
    ah, doctor = setup_doctor_and_patient(client)
    dh = auth(client, "doc@test.com")
    ph = auth(client, "p1@test.com")

    assert client.get("/api/v1/doctor/patients", headers=dh).get_json()["patients"] == []
    assert client.get("/api/v1/doctor/patients/1", headers=dh).status_code == 403

    res = client.post("/api/v1/patient/access-grants", headers=ph,
                      json={"doctor_id": doctor["doctor_id"]})
    assert res.status_code == 201
    assert len(client.get("/api/v1/doctor/patients", headers=dh).get_json()["patients"]) == 1
    detail = client.get("/api/v1/doctor/patients/1", headers=dh)
    assert detail.status_code == 200
    assert detail.get_json()["patient"]["health_id"].startswith("HB-")


def test_revoke_removes_access_and_regrant_works(client):
    ah, doctor = setup_doctor_and_patient(client)
    dh = auth(client, "doc@test.com")
    ph = auth(client, "p1@test.com")
    body = {"doctor_id": doctor["doctor_id"]}

    client.post("/api/v1/patient/access-grants", headers=ph, json=body)
    assert client.post("/api/v1/patient/access-grants", headers=ph, json=body).status_code == 409
    assert client.delete(f"/api/v1/patient/access-grants/{doctor['doctor_id']}",
                         headers=ph).status_code == 200
    assert client.get("/api/v1/doctor/patients/1", headers=dh).status_code == 403
    assert client.post("/api/v1/patient/access-grants", headers=ph, json=body).status_code == 201
    assert client.get("/api/v1/doctor/patients/1", headers=dh).status_code == 200


def test_doctor_cannot_read_other_patient_by_changing_id(client):
    ah, doctor = setup_doctor_and_patient(client)
    register_patient(client, "p2@test.com")
    ph1 = auth(client, "p1@test.com")
    dh = auth(client, "doc@test.com")
    client.post("/api/v1/patient/access-grants", headers=ph1, json={"doctor_id": doctor["doctor_id"]})
    assert client.get("/api/v1/doctor/patients/1", headers=dh).status_code == 200
    assert client.get("/api/v1/doctor/patients/2", headers=dh).status_code == 403


def test_patient_cannot_use_doctor_endpoints(client):
    setup_doctor_and_patient(client)
    ph = auth(client, "p1@test.com")
    assert client.get("/api/v1/doctor/patients", headers=ph).status_code == 403
    assert client.get("/api/v1/admin/doctors", headers=ph).status_code == 403


def test_deactivated_doctor_blocked(client):
    ah, doctor = setup_doctor_and_patient(client)
    dh = auth(client, "doc@test.com")
    res = client.patch(f"/api/v1/admin/users/{doctor['user_id']}/status",
                       headers=ah, json={"is_active": False})
    assert res.status_code == 200
    assert client.get("/api/v1/doctor/patients", headers=dh).status_code == 401
    login = client.post("/api/v1/auth/login", json={"email": "doc@test.com", "password": PW})
    assert login.status_code == 403


def test_admin_cannot_deactivate_self_or_other_admins(client):
    make_admin()
    make_admin("admin2@test.com")
    ah = auth(client, "admin@test.com")
    me = User.query.filter_by(email="admin@test.com").first().id
    other = User.query.filter_by(email="admin2@test.com").first().id
    assert client.patch(f"/api/v1/admin/users/{me}/status", headers=ah,
                        json={"is_active": False}).status_code == 400
    assert client.patch(f"/api/v1/admin/users/{other}/status", headers=ah,
                        json={"is_active": False}).status_code == 403


def test_change_password(client):
    make_admin()
    ah = auth(client, "admin@test.com")
    create_doctor(client, ah)
    dh = auth(client, "doc@test.com")
    bad = client.post("/api/v1/auth/change-password", headers=dh,
                      json={"current_password": "nope", "new_password": "NewPassword1"})
    assert bad.status_code == 401
    ok = client.post("/api/v1/auth/change-password", headers=dh,
                     json={"current_password": PW, "new_password": "NewPassword1"})
    assert ok.status_code == 200
    assert client.post("/api/v1/auth/login",
                       json={"email": "doc@test.com", "password": PW}).status_code == 401
    assert client.post("/api/v1/auth/login",
                       json={"email": "doc@test.com", "password": "NewPassword1"}).status_code == 200


def test_audit_log_records_events_without_secrets(client):
    ah, doctor = setup_doctor_and_patient(client)
    dh = auth(client, "doc@test.com")
    client.get("/api/v1/doctor/patients/1", headers=dh)  # denied
    actions = [a.action for a in AuditLog.query.all()]
    assert "doctor_created" in actions
    assert "access_denied" in actions
    for a in AuditLog.query.all():
        assert PW not in (a.detail or "")


def test_cli_create_admin(app):
    runner = app.test_cli_runner()
    res = runner.invoke(args=["create-admin", "--email", "boss@test.com", "--password", PW])
    assert res.exit_code == 0, res.output
    assert User.query.filter_by(email="boss@test.com").first().role == "hospital_admin"
    dup = runner.invoke(args=["create-admin", "--email", "boss@test.com", "--password", PW])
    assert dup.exit_code != 0
    short = runner.invoke(args=["create-admin", "--email", "b2@test.com", "--password", "short"])
    assert short.exit_code != 0
