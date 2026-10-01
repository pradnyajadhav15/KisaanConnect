"""Shared test setup: make the backend importable and give tests an API client.

The price API is tested on its own (no database, no API keys needed).
"""
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient
    from price_prediction.api.prediction_api import app

    return TestClient(app)


@pytest.fixture(scope="session")
def meta():
    from price_prediction.api.prediction_api import meta as loaded_meta

    return loaded_meta
