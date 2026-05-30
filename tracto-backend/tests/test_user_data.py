"""
Testes A-01 — endpoints user_app_data (persistência genérica por namespace).
"""

import pytest


def test_get_user_data_invalid_namespace(client):
    r = client.get("/api/user-data/hack-me")
    assert r.status_code == 400


def test_put_user_data_invalid_namespace(client):
    r = client.put("/api/user-data/hack-me", json={"data": [1, 2, 3]})
    assert r.status_code == 400


def test_get_user_data_returns_null_when_absent(client, monkeypatch):
    from services import user_data_service as uds

    async def fake_get(user_id, namespace):
        return None
    monkeypatch.setattr(uds, "async_get_user_data", fake_get)

    r = client.get("/api/user-data/soil")
    assert r.status_code == 200
    assert r.json() == {"namespace": "soil", "data": None}


def test_put_then_shape(client, monkeypatch):
    from services import user_data_service as uds
    captured = {}

    async def fake_upsert(user_id, namespace, data):
        captured["user_id"] = user_id
        captured["namespace"] = namespace
        captured["data"] = data
        return data
    monkeypatch.setattr(uds, "async_upsert_user_data", fake_upsert)

    payload = {"data": {"field-1": [{"ph": 6.2}]}}
    r = client.put("/api/user-data/soil", json=payload)
    assert r.status_code == 200
    assert r.json()["namespace"] == "soil"
    assert r.json()["data"] == payload["data"]
    # escopado pelo usuário autenticado do fixture
    assert captured["user_id"] == "00000000-0000-0000-0000-000000000001"
    assert captured["namespace"] == "soil"


def test_get_user_data_requires_auth(unauth_client):
    r = unauth_client.get("/api/user-data/soil")
    assert r.status_code == 401


def test_namespace_validation_helper():
    from services.user_data_service import is_valid_namespace
    assert is_valid_namespace("germoplasma")
    assert is_valid_namespace("soil")
    assert not is_valid_namespace("../etc/passwd")
    assert not is_valid_namespace("")
