# KisaanConnect backend

FastAPI backend. Setup, environment variables, deployment and the price model card are in the main [README](../../README.md).

Quick start (from this folder, Python 3.12):

```powershell
py -3.12 -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn main:app --reload --port 8000
```
