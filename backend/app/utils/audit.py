from flask import request
from ..extensions import db
from ..models import AuditLog


def log_event(action, user_id=None, target_type=None, target_id=None, detail=None):
    """Write one audit entry and commit it. Never pass secrets or clinical content in `detail`."""
    ip = request.remote_addr if request else None
    db.session.add(AuditLog(user_id=user_id, action=action, target_type=target_type,
                            target_id=target_id, detail=(detail or None), ip_address=ip))
    db.session.commit()
