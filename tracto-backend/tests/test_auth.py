"""Testes de autenticação — JWT verificação e rejeição."""

import pytest


def test_protected_endpoint_rejects_no_auth(unauth_client):
    """Endpoint protegido sem header Authorization → 401."""
    r = unauth_client.get("/api/billing/entitlements")
    assert r.status_code == 401


def test_protected_endpoint_rejects_bad_scheme(unauth_client):
    """Endpoint protegido com scheme errado → 401."""
    r = unauth_client.get(
        "/api/billing/entitlements",
        headers={"Authorization": "Basic dXNlcjpwYXNz"},
    )
    assert r.status_code == 401


def test_protected_endpoint_rejects_empty_token(unauth_client):
    """Endpoint protegido com token vazio → 401."""
    r = unauth_client.get(
        "/api/billing/entitlements",
        headers={"Authorization": "Bearer "},
    )
    assert r.status_code == 401


def test_unverified_uid_parsing_no_signature_check():
    """
    Confirma que get_unverified_user_id_from_header extrai 'sub' SEM verificar
    assinatura. Crítico: o resultado NUNCA pode ser usado pra autorização.
    """
    from services.auth_service import get_unverified_user_id_from_header
    # JWT forjado: header e payload base64, signature inválida
    # {"alg":"HS256","typ":"JWT"} . {"sub":"fake-uid"} . SIG_FORJADA
    forged = (
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
        "eyJzdWIiOiJmYWtlLXVpZCJ9."
        "signature_forjada"
    )
    uid = get_unverified_user_id_from_header(f"Bearer {forged}")
    # Função intencionalmente parseia sem verificar — mas docstring DEVE alertar
    assert uid == "fake-uid"
    # Garante que docstring tem o alerta
    assert "NUNCA" in (get_unverified_user_id_from_header.__doc__ or "")


def test_invalid_jwt_returns_none():
    """JWT malformado retorna None em vez de crashar."""
    from services.auth_service import get_unverified_user_id_from_header
    assert get_unverified_user_id_from_header("Bearer not.a.jwt.too.many.parts") is None
    assert get_unverified_user_id_from_header("not even bearer") is None
    assert get_unverified_user_id_from_header(None) is None
    assert get_unverified_user_id_from_header("") is None


def test_no_auth_returns_none():
    """Header ausente retorna None."""
    from services.auth_service import get_unverified_user_id_from_header
    assert get_unverified_user_id_from_header(None) is None
