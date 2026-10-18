from flask import Flask
from flask_cors import CORS
from config import Config
from .extensions import db, migrate, jwt


def create_app(config_class=Config):
    app = Flask(__name__)
    app.config.from_object(config_class)

    CORS(app, resources={r"/api/*": {"origins": ["http://localhost:5173"]}})
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    from . import models  # noqa: F401  (so migrations see the tables)
    from .routes.health import health_bp
    from .routes.auth import auth_bp
    from .routes.admin import admin_bp
    from .routes.patient import patient_bp
    from .routes.doctor import doctor_bp
    from .routes.demo_roles import roles_demo_bp
    from .cli import register_cli

    app.register_blueprint(health_bp, url_prefix="/api/v1")
    app.register_blueprint(auth_bp, url_prefix="/api/v1/auth")
    app.register_blueprint(admin_bp, url_prefix="/api/v1/admin")
    app.register_blueprint(patient_bp, url_prefix="/api/v1/patient")
    app.register_blueprint(doctor_bp, url_prefix="/api/v1/doctor")
    app.register_blueprint(roles_demo_bp, url_prefix="/api/v1/demo")
    register_cli(app)

    return app
