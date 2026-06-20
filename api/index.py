"""Vercel entrypoint for the Tracto FastAPI backend."""

from pathlib import Path
import sys

BACKEND_DIR = Path(__file__).resolve().parents[1] / "tracto-backend"
sys.path.insert(0, str(BACKEND_DIR))

from main import app  # noqa: E402,F401


@app.get("/api/health", include_in_schema=False)
def vercel_health_check():
    return {
        "status": "ok",
        "service": "tracto-backend",
        "runtime": "vercel",
    }
