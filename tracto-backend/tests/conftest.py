"""
Fixtures de teste pro backend Tracto.

Estes testes rodam com pytest + httpx.AsyncClient SEM precisar do Supabase real.
Dependências externas (Supabase, Sentinel, Anthropic) são mockadas via monkeypatch.
"""

import os
import sys
from pathlib import Path

import pytest

# Garante que o backend está no path
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Env de teste — antes de importar main
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "sk-ant-test")
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("APP_VERSION", "test-0.0.0")


@pytest.fixture
def fake_user():
    """Usuário autenticado de teste."""
    from services.auth_service import AuthenticatedUser
    return AuthenticatedUser(id="00000000-0000-0000-0000-000000000001", email="alice@test.com")


@pytest.fixture
def fake_other_user():
    """Outro usuário, pra testar isolamento entre tenants (IDOR)."""
    from services.auth_service import AuthenticatedUser
    return AuthenticatedUser(id="00000000-0000-0000-0000-000000000002", email="mallory@test.com")


@pytest.fixture
def client(fake_user, monkeypatch):
    """
    TestClient FastAPI com get_current_user mockado retornando fake_user.
    """
    from fastapi.testclient import TestClient
    import main as main_module

    # Override da dependência de auth
    main_module.app.dependency_overrides[main_module.get_current_user] = lambda: fake_user

    with TestClient(main_module.app) as c:
        yield c

    main_module.app.dependency_overrides.clear()


@pytest.fixture
def unauth_client():
    """TestClient sem autenticação (testa rejeição)."""
    from fastapi.testclient import TestClient
    import main as main_module
    main_module.app.dependency_overrides.clear()
    with TestClient(main_module.app) as c:
        yield c
