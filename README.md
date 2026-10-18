# HealthBridge (HB_2)

Secure digital health records with AI report analysis and ML ransomware detection.

## Quick start (PowerShell)
    cd D:\HB_2
    powershell -ExecutionPolicy Bypass -File .\setup.ps1
    cd backend
    .\.venv\Scripts\activate
    python run.py

API: http://127.0.0.1:5000/api/v1/health

## Structure
- backend/  Flask API (auth, Health ID, roles)
- frontend/ React + Vite (Phase 5)
- ml/       Ransomware detector (Phase 10)
- docs/     Reports and screenshots
