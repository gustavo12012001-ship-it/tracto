"""
Testes anti-IDOR (Insecure Direct Object Reference).

O backend usa SUPABASE_SERVICE_KEY que BYPASSA RLS. Endpoints com path
param de recurso DEVEM validar ownership via farm_service.get_field_by_id
ou helper require_field_ownership. Estes testes confirmam que:

1. Endpoint não retorna recurso de outro usuário
2. Endpoint retorna 404 (não 403, pra não revelar existência)
"""

import pytest


def test_require_field_ownership_returns_404_for_alien_field(monkeypatch, fake_user):
    """Field de outro usuário → 404."""
    from services.auth_service import require_field_ownership
    from services import farm_service
    from fastapi import HTTPException

    # Mocka farm_service.get_field_by_id pra retornar None (não encontrado)
    monkeypatch.setattr(farm_service, "get_field_by_id", lambda uid, fid: None)

    with pytest.raises(HTTPException) as exc:
        require_field_ownership("some-field-id", fake_user)

    assert exc.value.status_code == 404
    # Mensagem NÃO revela se o field existe pra outro usuário
    assert "Talhão não encontrado" in exc.value.detail


def test_require_field_ownership_returns_field_when_owner(monkeypatch, fake_user):
    """Field do próprio user → retorna o field."""
    from services.auth_service import require_field_ownership
    from services import farm_service

    fake_field = {"id": "field-1", "user_id": fake_user.id, "name": "Talhão Alice"}
    monkeypatch.setattr(farm_service, "get_field_by_id", lambda uid, fid: fake_field if uid == fake_user.id else None)

    result = require_field_ownership("field-1", fake_user)
    assert result == fake_field


def test_require_field_ownership_rejects_empty_id(fake_user):
    """field_id vazio → 400."""
    from services.auth_service import require_field_ownership
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as exc:
        require_field_ownership("", fake_user)
    assert exc.value.status_code == 400

    with pytest.raises(HTTPException) as exc:
        require_field_ownership("   ", fake_user)
    assert exc.value.status_code == 400


def test_field_id_is_stripped(monkeypatch, fake_user):
    """Whitespace no field_id é stripped antes da query."""
    from services.auth_service import require_field_ownership
    from services import farm_service

    captured = []
    def fake_get(uid, fid):
        captured.append(fid)
        return {"id": fid, "user_id": uid}

    monkeypatch.setattr(farm_service, "get_field_by_id", fake_get)
    require_field_ownership("  field-1  ", fake_user)
    assert captured == ["field-1"]
