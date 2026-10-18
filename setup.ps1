# Run from D:\HB_2 :  powershell -ExecutionPolicy Bypass -File .\setup.ps1
$ErrorActionPreference = "Stop"
Set-Location "$PSScriptRoot\backend"

python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

$env:FLASK_APP = "run.py"
.\.venv\Scripts\python.exe -m pytest -v
if (!(Test-Path "migrations")) { .\.venv\Scripts\python.exe -m flask db init }
.\.venv\Scripts\python.exe -m flask db migrate -m "users patients health_ids"
.\.venv\Scripts\python.exe -m flask db upgrade

Write-Host "`nSetup complete. Start the API with:  cd backend; .\.venv\Scripts\activate; python run.py"
