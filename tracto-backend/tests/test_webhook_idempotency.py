"""
Testes A-09 — idempotência e reprocesso do webhook Mercado Pago.

Cenários cobertos:
  • Primeira entrega bem-sucedida → registra, processa, marca processed_at (200).
  • Duplicata (evento já com processed_at) → ignora sem reprocessar (200).
  • Falha ANTES de concluir → mantém processed_at NULL e retorna 503 (retry).
  • Retry de evento com processed_at NULL → reprocessa sem reinserir (200).
"""

import json as _json

import pytest


class _Resp:
    def __init__(self, status_code=200, json_data=None):
        self.status_code = status_code
        self._json = json_data if json_data is not None else []
        self.ok = 200 <= status_code < 300

    def json(self):
        return self._json


@pytest.fixture
def webhook_env(monkeypatch):
    """
    Prepara o ambiente: assinatura válida, captura de chamadas HTTP ao Supabase
    e bypass do processamento real de pagamento.
    """
    import requests
    from services import mercadopago_service as mp
    import main as main_module

    calls = {"get": [], "post": [], "patch": []}
    # Estado configurável do "registro existente" retornado pelo GET.
    state = {"existing": []}

    monkeypatch.setattr(mp, "verify_webhook_signature", lambda **k: True)

    def fake_get(url, **kwargs):
        calls["get"].append(kwargs)
        return _Resp(200, state["existing"])

    def fake_post(url, **kwargs):
        calls["post"].append(kwargs)
        return _Resp(201, [])

    def fake_patch(url, **kwargs):
        calls["patch"].append(kwargs)
        return _Resp(204, [])

    monkeypatch.setattr(requests, "get", fake_get)
    monkeypatch.setattr(requests, "post", fake_post)
    monkeypatch.setattr(requests, "patch", fake_patch)

    async def fake_get_payment(_id):
        return {"id": _id, "status": "approved"}

    monkeypatch.setattr(mp, "get_payment", fake_get_payment)

    return calls, state, main_module, monkeypatch


def _post_webhook(client, *, data_id="pay-1", req_id="req-1"):
    return client.post(
        f"/api/billing/mercadopago-webhook?type=payment&data.id={data_id}",
        headers={"x-request-id": req_id, "x-signature": "sig", "content-type": "application/json"},
        content=_json.dumps({"action": "payment.created", "data": {"id": data_id}}),
    )


def test_first_delivery_success(unauth_client, webhook_env):
    calls, state, main_module, monkeypatch = webhook_env
    state["existing"] = []  # nenhum registro prévio

    async def ok_process(_payment):
        return None
    monkeypatch.setattr(main_module, "_process_payment_event", ok_process)

    r = _post_webhook(unauth_client)
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert len(calls["post"]) == 1  # registrou o evento
    # Último patch marcou processed_at
    assert any("processed_at" in (c.get("json") or {}) for c in calls["patch"])


def test_duplicate_event_ignored(unauth_client, webhook_env):
    calls, state, main_module, monkeypatch = webhook_env
    state["existing"] = [{"mp_event_id": "req-1", "processed_at": "2026-05-01T00:00:00Z"}]

    r = _post_webhook(unauth_client)
    assert r.status_code == 200
    assert r.json()["status"] == "duplicate"
    assert len(calls["post"]) == 0  # não reinseriu
    assert len(calls["patch"]) == 0  # não reprocessou


def test_failure_before_process_returns_503(unauth_client, webhook_env):
    calls, state, main_module, monkeypatch = webhook_env
    state["existing"] = []

    async def boom_process(_payment):
        raise RuntimeError("supabase indisponível")
    monkeypatch.setattr(main_module, "_process_payment_event", boom_process)

    r = _post_webhook(unauth_client)
    assert r.status_code == 503
    # Registrou o erro mas NÃO marcou processed_at
    error_patches = [c for c in calls["patch"] if "error_message" in (c.get("json") or {})]
    assert len(error_patches) == 1
    assert all("processed_at" not in (c.get("json") or {}) for c in calls["patch"])


def test_retry_reprocesses_unprocessed_event(unauth_client, webhook_env):
    calls, state, main_module, monkeypatch = webhook_env
    # Evento já existe, mas falhou antes (processed_at NULL)
    state["existing"] = [{"mp_event_id": "req-1", "processed_at": None}]

    async def ok_process(_payment):
        return None
    monkeypatch.setattr(main_module, "_process_payment_event", ok_process)

    r = _post_webhook(unauth_client)
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
    assert len(calls["post"]) == 0  # NÃO reinseriu (já registrado)
    assert any("processed_at" in (c.get("json") or {}) for c in calls["patch"])
