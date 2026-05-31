"""
Testes do acesso total de DONO/ADMIN (ignora plano).
"""

import pytest

from services import billing_service as bs


def test_is_owner_by_email_env(monkeypatch):
    monkeypatch.setenv("OWNER_EMAILS", "dono@empresa.com, outro@x.com")
    monkeypatch.setenv("OWNER_USER_IDS", "")
    assert bs.is_owner("any-id", "dono@empresa.com")
    assert bs.is_owner("any-id", "DONO@EMPRESA.COM")  # case-insensitive
    assert not bs.is_owner("any-id", "estranho@x.com")


def test_is_owner_by_user_id_env(monkeypatch):
    monkeypatch.setenv("OWNER_EMAILS", "")
    monkeypatch.setenv("OWNER_USER_IDS", "uuid-123, uuid-456")
    assert bs.is_owner("uuid-123", None)
    assert not bs.is_owner("uuid-999", None)


def test_is_owner_by_default_list(monkeypatch):
    monkeypatch.setenv("OWNER_EMAILS", "")
    monkeypatch.setenv("OWNER_USER_IDS", "")
    monkeypatch.setattr(bs, "DEFAULT_OWNER_EMAILS", ["fixo@dono.com"])
    assert bs.is_owner("x", "fixo@dono.com")
    assert not bs.is_owner("x", "naoehdono@dono.com")


def test_non_owner_when_unset(monkeypatch):
    monkeypatch.setenv("OWNER_EMAILS", "")
    monkeypatch.setenv("OWNER_USER_IDS", "")
    monkeypatch.setattr(bs, "DEFAULT_OWNER_EMAILS", [])
    assert not bs.is_owner("x", "alguem@x.com")
    assert not bs.is_owner(None, None)


def test_owner_gets_full_access(monkeypatch):
    monkeypatch.setenv("OWNER_EMAILS", "dono@empresa.com")
    ent = bs.billing_service.get_entitlements("any-id", "dono@empresa.com")
    assert ent["is_owner"] is True
    assert ent["plan_id"] == "owner"
    assert ent["has_ia_chat"] and ent["has_satellite"]
    assert ent["can_use_whatsapp"] and ent["can_use_push"]
    assert ent["max_fields"] >= 1_000_000
    assert ent["max_farms"] >= 1_000_000


def test_owner_field_limit_never_blocks(monkeypatch):
    monkeypatch.setenv("OWNER_EMAILS", "dono@empresa.com")
    allowed, msg = bs.billing_service.check_field_limit("any-id", 999_999, "dono@empresa.com")
    assert allowed is True
    assert msg is None


def test_non_owner_unchanged(monkeypatch):
    """Sem allowlist, usuário comum não vira dono (não quebra o fluxo normal)."""
    monkeypatch.setenv("OWNER_EMAILS", "")
    monkeypatch.setenv("OWNER_USER_IDS", "")
    monkeypatch.setattr(bs, "DEFAULT_OWNER_EMAILS", [])
    assert bs.is_owner("user-x", "user-x@gmail.com") is False
