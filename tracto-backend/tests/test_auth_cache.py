"""
Testes A-04 — verificação local de JWT + cache token→user.

Cobre:
- Token válido verificado localmente (assinatura HS256 + exp + audience).
- Token inválido (assinatura errada) → cai no fallback de rede.
- Token expirado → cai no fallback de rede.
- Cache hit: segunda verificação não faz round-trip à rede.
"""

import time

import pytest


def _make_jwt(secret: str, *, sub: str = "user-123", email: str = "u@test.com",
              exp_offset: int = 3600, aud: str = "authenticated") -> str:
    import jwt  # PyJWT
    payload = {"sub": sub, "email": email, "aud": aud,
               "exp": int(time.time()) + exp_offset}
    return jwt.encode(payload, secret, algorithm="HS256")


@pytest.fixture(autouse=True)
def _clear_cache():
    """Garante cache limpo entre testes."""
    from services import auth_service
    with auth_service._auth_cache_lock:
        auth_service._auth_cache.clear()
    yield
    with auth_service._auth_cache_lock:
        auth_service._auth_cache.clear()


def test_local_verify_valid_token(monkeypatch):
    """Token válido com SUPABASE_JWT_SECRET → verificado sem rede."""
    from services import auth_service
    secret = "test-jwt-secret"
    monkeypatch.setenv("SUPABASE_JWT_SECRET", secret)

    # Se a rede for chamada, falha o teste.
    def _boom(*a, **k):
        raise AssertionError("Não deveria fazer round-trip à rede em verificação local")
    monkeypatch.setattr(auth_service.requests, "get", _boom)

    token = _make_jwt(secret, sub="abc", email="abc@test.com")
    user = auth_service.verify_access_token(token)
    assert user.id == "abc"
    assert user.email == "abc@test.com"


def test_local_verify_invalid_signature_falls_back(monkeypatch):
    """Assinatura errada → verificação local retorna None (fallback)."""
    from services import auth_service
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "correct-secret")
    # Token assinado com outro secret
    token = _make_jwt("wrong-secret", sub="abc")
    assert auth_service._try_local_verify(token) is None


def test_local_verify_expired_falls_back(monkeypatch):
    """Token expirado → verificação local retorna None (fallback)."""
    from services import auth_service
    secret = "test-jwt-secret"
    monkeypatch.setenv("SUPABASE_JWT_SECRET", secret)
    token = _make_jwt(secret, sub="abc", exp_offset=-10)  # já expirado
    assert auth_service._try_local_verify(token) is None


def test_local_verify_wrong_audience_falls_back(monkeypatch):
    """Audience diferente de 'authenticated' → None."""
    from services import auth_service
    secret = "test-jwt-secret"
    monkeypatch.setenv("SUPABASE_JWT_SECRET", secret)
    token = _make_jwt(secret, sub="abc", aud="anon")
    assert auth_service._try_local_verify(token) is None


def test_no_jwt_secret_uses_network_and_caches(monkeypatch):
    """
    Sem SUPABASE_JWT_SECRET: usa rede na 1ª vez, cacheia, e na 2ª vez
    NÃO faz nova chamada de rede (cache hit).
    """
    from services import auth_service
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)

    calls = {"n": 0}

    class _Resp:
        status_code = 200

        def raise_for_status(self):
            return None

        def json(self):
            return {"id": "net-user", "email": "net@test.com"}

    def _fake_get(*a, **k):
        calls["n"] += 1
        return _Resp()

    monkeypatch.setattr(auth_service.requests, "get", _fake_get)

    token = "opaque-token-no-jwt"
    u1 = auth_service.verify_access_token(token)
    u2 = auth_service.verify_access_token(token)
    assert u1.id == "net-user"
    assert u2.id == "net-user"
    assert calls["n"] == 1  # segunda veio do cache


def test_network_401_raises(monkeypatch):
    """Rede retorna 401 → HTTPException 401, sem cachear."""
    from fastapi import HTTPException
    from services import auth_service
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)

    class _Resp:
        status_code = 401

        def raise_for_status(self):
            return None

        def json(self):
            return {}

    monkeypatch.setattr(auth_service.requests, "get", lambda *a, **k: _Resp())

    with pytest.raises(HTTPException) as exc:
        auth_service.verify_access_token("bad-token")
    assert exc.value.status_code == 401
    # Não cacheou erro
    assert auth_service._auth_cache_get("bad-token") is None


def test_cache_expiry(monkeypatch):
    """Entrada do cache expira após o TTL."""
    from services import auth_service
    user = auth_service.AuthenticatedUser(id="x", email="x@test.com")
    # TTL artificialmente curto
    monkeypatch.setattr(auth_service, "_AUTH_CACHE_TTL", 0.05)
    auth_service._auth_cache_put("tok", user)
    assert auth_service._auth_cache_get("tok") is not None
    time.sleep(0.1)
    assert auth_service._auth_cache_get("tok") is None
