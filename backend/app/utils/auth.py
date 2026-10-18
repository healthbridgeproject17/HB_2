from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from ..extensions import db
from ..models import User


def current_user():
    return db.session.get(User, int(get_jwt_identity()))


def roles_required(*roles):
    """Verifies the JWT, then re-checks account status and role in the database."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user = current_user()
            if user is None or not user.is_active_account:
                return jsonify(error="Account unavailable"), 401
            if user.role not in roles:
                return jsonify(error="Access denied"), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator
