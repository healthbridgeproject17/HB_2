import pytest
from app import create_app
from app.extensions import db
from config import TestConfig


@pytest.fixture
def client():
    app = create_app(TestConfig)
    with app.app_context():
        db.create_all()
        yield app.test_client()
        db.session.remove()
        db.drop_all()


def register(client, email="a@test.com", **extra):
    body = {"email": email, "password": "Password123", "full_name": "Test User", **extra}
    return client.post("/api/v1/auth/register", json=body)


def login(client, email="a@test.com"):
    res = client.post("/api/v1/auth/login", json={"email": email, "password": "Password123"})
    return res.get_json()["access_token"]


def test_health(client):
    assert client.get("/api/v1/health").status_code == 200


def test_register_creates_patient_with_health_id(client):
    res = register(client)
    assert res.status_code == 201
    assert res.get_json()["user"]["health_id"].startswith("HB-")


def test_duplicate_email_rejected(client):
    register(client)
    assert register(client).status_code == 409


def test_role_in_registration_is_ignored(client):
    res = register(client, role="hospital_admin")
    assert res.get_json()["user"]["role"] == "patient"


def test_login_wrong_password(client):
    register(client)
    res = client.post("/api/v1/auth/login", json={"email": "a@test.com", "password": "wrong"})
    assert res.status_code == 401


def test_me_requires_token(client):
    assert client.get("/api/v1/auth/me").status_code == 401


def test_patient_allowed_on_patient_area_denied_on_doctor_area(client):
    register(client)
    h = {"Authorization": f"Bearer {login(client)}"}
    assert client.get("/api/v1/demo/patient-area", headers=h).status_code == 200
    assert client.get("/api/v1/demo/doctor-area", headers=h).status_code == 403
