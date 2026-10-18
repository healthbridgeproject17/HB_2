import os
from flask import current_app

CATEGORIES = ["lab_report", "prescription", "imaging", "discharge_summary", "other"]


def serialize_record(rec, include_text=False):
    data = {
        "id": rec.id,
        "title": rec.title,
        "category": rec.category,
        "original_filename": rec.original_filename,
        "file_size": rec.file_size,
        "page_count": rec.page_count,
        "processing_status": rec.processing_status,
        "processing_message": rec.processing_message,
        "uploaded_at": rec.uploaded_at.isoformat() if rec.uploaded_at else None,
    }
    if include_text:
        data["extracted_text"] = rec.extracted_text or ""
    return data


def record_path(rec):
    """Path built only from the generated filename, never from user input."""
    return os.path.join(current_app.config["UPLOAD_FOLDER"], rec.stored_filename)
