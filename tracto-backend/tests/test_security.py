"""
tests/test_security.py — Testes das correções críticas de segurança/billing.

Cobre:
- CPF/CNPJ com dígitos verificadores
- is_trial expiry
- has_satellite enforcement (sentinel, planet, up42)
- WhatsApp sem entitlement bloqueado
- WhatsApp sem token Z-API rejeitado em produção
- Chat counter diário (memória fallback)
- Conversations paginação
"""

import os
import sys
from pathlib import Path
from datetime import datetime, timedelta, timezone

import pytest

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Env de teste mínima
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-test")
os.environ.setdefault("ENVIRONMENT", "test")


# ── CPF/CNPJ ─────────────────────────────────────────────────────────────────

class TestCpfValidation:
    def setup_method(self):
        from services.billing_service import validate_cpf
        self.validate_cpf = validate_cpf

    def test_valid_cpf(self):
        assert self.validate_cpf("529.982.247-25") is True
        assert self.validate_cpf("52998224725") is True

    def test_invalid_cpf_wrong_digits(self):
        assert self.validate_cpf("123.456.789-00") is False

    def test_invalid_cpf_all_same(self):
        for d in "0123456789":
            assert self.validate_cpf(d * 11) is False

    def test_invalid_cpf_too_short(self):
        assert self.validate_cpf("123456") is False

    def test_invalid_cpf_all_zeros(self):
        assert self.validate_cpf("000.000.000-00") is False


class TestCnpjValidation:
    def setup_method(self):
        from services.billing_service import validate_cnpj
        self.validate_cnpj = validate_cnpj

    def test_valid_cnpj(self):
        assert self.validate_cnpj("11.222.333/0001-81") is True
        assert self.validate_cnpj("11222333000181") is True

    def test_invalid_cnpj_wrong_digits(self):
        assert self.validate_cnpj("11.222.333/0001-00") is False

    def test_invalid_cnpj_all_same(self):
        assert self.validate_cnpj("00000000000000") is False
        assert self.validate_cnpj("11111111111111") is False

    def test_invalid_cnpj_too_short(self):
        assert self.validate_cnpj("1122233300018") is False


# ── is_trial expiry ───────────────────────────────────────────────────────────

class TestIsTrialActive:
    def setup_method(self):
        from services.billing_service import _is_trial_active
        self.is_trial_active = _is_trial_active

    def test_none_is_not_trial(self):
        assert self.is_trial_active(None) is False

    def test_empty_string_is_not_trial(self):
        assert self.is_trial_active("") is False

    def test_future_date_is_trial(self):
        future = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
        assert self.is_trial_active(future) is True

    def test_past_date_is_not_trial(self):
        past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        assert self.is_trial_active(past) is False

    def test_past_date_with_z_suffix(self):
        past = (datetime.now(timezone.utc) - timedelta(hours=1))
        past_str = past.replace(microsecond=0).isoformat().replace("+00:00", "Z")
        assert self.is_trial_active(past_str) is False

    def test_future_date_with_z_suffix(self):
        future = (datetime.now(timezone.utc) + timedelta(days=7))
        future_str = future.replace(microsecond=0).isoformat().replace("+00:00", "Z")
        assert self.is_trial_active(future_str) is True

    def test_invalid_date_string(self):
        assert self.is_trial_active("not-a-date") is False


# ── has_satellite enforcement ─────────────────────────────────────────────────

FREE_ENT = {
    "plan_id": "free", "plan_name": "Gratuito", "status": "active",
    "max_fields": 1, "has_ia_chat": False, "has_satellite": False,
    "can_use_whatsapp": False, "is_trial": False,
}
PRO_ENT = {**FREE_ENT, "plan_id": "pro", "has_ia_chat": True, "has_satellite": True, "can_use_whatsapp": True}


@pytest.fixture
def client_free(monkeypatch):
    """TestClient com usuário free (sem satélite)."""
    from fastapi.testclient import TestClient
    import main as m
    from services.auth_service import AuthenticatedUser

    user = AuthenticatedUser(id="free-user-id", email="free@test.com")
    m.app.dependency_overrides[m.get_current_user] = lambda: user
    monkeypatch.setattr("main.billing_service.get_entitlements", lambda uid, email=None: FREE_ENT)

    with TestClient(m.app) as c:
        yield c
    m.app.dependency_overrides.clear()


@pytest.fixture
def client_pro(monkeypatch):
    """TestClient com usuário pro (com satélite)."""
    from fastapi.testclient import TestClient
    import main as m
    from services.auth_service import AuthenticatedUser

    user = AuthenticatedUser(id="pro-user-id", email="pro@test.com")
    m.app.dependency_overrides[m.get_current_user] = lambda: user
    monkeypatch.setattr("main.billing_service.get_entitlements", lambda uid, email=None: PRO_ENT)

    with TestClient(m.app) as c:
        yield c
    m.app.dependency_overrides.clear()


class TestSatelliteEnforcement:
    def test_free_user_blocked_sentinel(self, client_free):
        resp = client_free.get("/api/sentinel/overlay", params={"field_id": "f1"})
        assert resp.status_code == 403
        assert "satélite" in resp.json()["detail"].lower()

    def test_free_user_blocked_planet(self, client_free):
        resp = client_free.get("/api/planet/overlay", params={"field_id": "f1", "scene_id": "s1"})
        assert resp.status_code == 403

    def test_free_user_blocked_up42(self, client_free):
        resp = client_free.get("/api/up42/overlay", params={"field_id": "f1", "scene_id": "s1"})
        assert resp.status_code == 403

    def test_free_user_blocked_sentinel_scenes(self, client_free, monkeypatch):
        # /api/sentinel/scenes não exige satélite pago (Earth Search é gratuito) — não deve retornar 403
        monkeypatch.setattr("main.farm_service.get_field_by_id", lambda uid, fid: {"latitude": -15.0, "longitude": -47.0, "boundaries": None})
        monkeypatch.setattr("main.get_available_scenes", lambda **kw: {"s2": [], "s1": []})
        resp = client_free.get("/api/sentinel/scenes", params={"field_id": "f1"})
        # Scenes gratuitas — deve passar (200 ou 404 se campo não achar, nunca 403)
        assert resp.status_code != 403


# ── WhatsApp enforcement ──────────────────────────────────────────────────────

class TestWhatsAppWebhook:
    def test_whatsapp_rejected_without_token_in_production(self, monkeypatch):
        """Em produção sem ZAPI_WEBHOOK_SECRET configurado, rejeitar com 401."""
        os.environ["ENVIRONMENT"] = "production"
        os.environ.pop("ZAPI_WEBHOOK_SECRET", None)
        try:
            from fastapi.testclient import TestClient
            import main as m
            with TestClient(m.app) as c:
                resp = c.post("/webhooks/whatsapp", json={"phone": "5511999999999", "text": {"message": "oi"}})
            assert resp.status_code == 401
        finally:
            os.environ["ENVIRONMENT"] = "test"

    def test_whatsapp_rejected_with_wrong_token(self, monkeypatch):
        """Token incorreto deve retornar 401."""
        os.environ["ZAPI_WEBHOOK_SECRET"] = "correct-secret"
        try:
            from fastapi.testclient import TestClient
            import main as m
            with TestClient(m.app) as c:
                resp = c.post(
                    "/webhooks/whatsapp",
                    json={"phone": "5511999999999", "text": {"message": "oi"}},
                    headers={"client-token": "wrong-secret"},
                )
            assert resp.status_code == 401
        finally:
            os.environ.pop("ZAPI_WEBHOOK_SECRET", None)

    def test_whatsapp_accepted_with_correct_token_in_test_mode(self, monkeypatch):
        """Token correto + sem entitlement → passa auth, bloqueia por plano."""
        os.environ["ZAPI_WEBHOOK_SECRET"] = "my-secret"
        os.environ["ENVIRONMENT"] = "test"
        try:
            from fastapi.testclient import TestClient
            import main as m
            # Mock Supabase para encontrar o usuário
            import requests as _req_mod
            class FakeResp:
                ok = True
                def raise_for_status(self): pass
                def json(self): return [{"id": "user-123"}]
            monkeypatch.setattr(_req_mod, "get", lambda *a, **kw: FakeResp())
            monkeypatch.setattr("main.billing_service.get_entitlements", lambda uid, email=None: FREE_ENT)
            with TestClient(m.app) as c:
                resp = c.post(
                    "/webhooks/whatsapp",
                    json={"phone": "5511999999999", "text": {"message": "oi"}},
                    headers={"client-token": "my-secret"},
                )
            # Não deve chamar IA: retorna 200 com mensagem de plano
            assert resp.status_code == 200
            body = resp.json()
            assert body.get("status") == "ok"
            assert "WhatsApp" in body.get("message", "") or "plano" in body.get("message", "")
        finally:
            os.environ.pop("ZAPI_WEBHOOK_SECRET", None)
            os.environ["ENVIRONMENT"] = "test"


# ── Chat counter memória ──────────────────────────────────────────────────────

class TestChatCounterMemoryFallback:
    def test_respects_daily_limit(self):
        import main as m
        # Reset estado
        m._chat_usage.clear()
        for i in range(5):
            m._check_daily_chat_limit_memory("test-user", 5)
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc_info:
            m._check_daily_chat_limit_memory("test-user", 5)
        assert exc_info.value.status_code == 429

    def test_resets_on_new_day(self):
        import main as m
        from datetime import date, timedelta
        yesterday = (date.today() - timedelta(days=1)).strftime("%Y-%m-%d")
        m._chat_usage["day-test-user"] = (5, yesterday)
        # Deve iniciar do zero hoje
        m._check_daily_chat_limit_memory("day-test-user", 5)
        count, _ = m._chat_usage["day-test-user"]
        assert count == 1


# ── Conversations pagination ──────────────────────────────────────────────────

class TestConversationsPagination:
    def test_limit_capped_at_100(self, monkeypatch):
        from services.supabase_service import get_conversations
        calls = []

        class FakeResp:
            ok = True
            def raise_for_status(self): pass
            def json(self): return []

        import requests as _req_mod
        original_get = _req_mod.get

        def capture_get(url, **kwargs):
            calls.append(kwargs.get("params", {}))
            return FakeResp()

        monkeypatch.setattr(_req_mod, "get", capture_get)
        get_conversations("user-1", limit=999, offset=0)
        assert calls[0].get("limit") == "100"

    def test_offset_passed_through(self, monkeypatch):
        from services.supabase_service import get_conversations

        class FakeResp:
            ok = True
            def raise_for_status(self): pass
            def json(self): return []

        import requests as _req_mod
        calls = []

        def capture_get(url, **kwargs):
            calls.append(kwargs.get("params", {}))
            return FakeResp()

        monkeypatch.setattr(_req_mod, "get", capture_get)
        get_conversations("user-1", limit=20, offset=40)
        assert calls[0].get("offset") == "40"
        assert calls[0].get("limit") == "20"
