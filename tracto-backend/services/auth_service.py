import hashlib
import logging
import os
import json
import base64
import threading
import time as _time
from dataclasses import dataclass

import requests
from fastapi import Header, HTTPException, status


@dataclass
class AuthenticatedUser:
    id: str
    email: str | None = None


# ── Cache token→user (A-04) ──────────────────────────────────────────────────
# Evita um round-trip HTTP ao Supabase Auth a CADA request autenticado.
# Chave = sha256(token) (nunca guardamos o token cru). TTL curto (60s) para
# manter a janela de revogação pequena. Cacheamos apenas verificações OK.
_AUTH_CACHE_TTL = float(os.getenv("AUTH_CACHE_TTL_SECONDS", "60"))
_auth_cache: dict[str, tuple[AuthenticatedUser, float]] = {}
_auth_cache_lock = threading.Lock()


def _token_key(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _auth_cache_get(token: str) -> AuthenticatedUser | None:
    key = _token_key(token)
    with _auth_cache_lock:
        entry = _auth_cache.get(key)
        if entry and _time.monotonic() < entry[1]:
            return entry[0]
        if entry:
            _auth_cache.pop(key, None)
    return None


def _auth_cache_put(token: str, user: AuthenticatedUser) -> None:
    key = _token_key(token)
    with _auth_cache_lock:
        _auth_cache[key] = (user, _time.monotonic() + _AUTH_CACHE_TTL)
        # Bound de memória: limpa entradas expiradas se o cache crescer demais
        if len(_auth_cache) > 5000:
            now = _time.monotonic()
            for k in [k for k, v in _auth_cache.items() if v[1] <= now]:
                _auth_cache.pop(k, None)


def _try_local_verify(token: str) -> AuthenticatedUser | None:
    """
    Verificação LOCAL do JWT (sem rede), habilitada apenas se SUPABASE_JWT_SECRET
    estiver configurada e a lib PyJWT disponível. Valida assinatura HS256, exp e
    audience ('authenticated'). Retorna None se não puder verificar localmente —
    nesse caso o chamador faz o fallback para a verificação via rede.
    """
    secret = os.getenv("SUPABASE_JWT_SECRET")
    if not secret:
        return None
    try:
        import jwt  # PyJWT
    except ImportError:
        return None
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"require": ["exp", "sub"]},
        )
        user_id = payload.get("sub")
        if not user_id:
            return None
        return AuthenticatedUser(id=user_id, email=payload.get("email"))
    except Exception:
        # Assinatura inválida/expirada/algoritmo diferente → deixa o fallback decidir
        return None


def get_unverified_user_id_from_header(authorization: str | None) -> str | None:
    """
    ⚠️ ALERTA DE SEGURANÇA: ESTA IDENTIDADE NÃO É VERIFICADA.
    Extrai o claim 'sub' do JWT de forma 'burra' (sem verificar assinatura).
    
    NUNCA utilize o retorno desta função para:
    1. Autorização (decidir se o usuário pode acessar algo)
    2. Ownership (atribuir ou deletar recursos)
    
    Finalidade: Apenas contexto auxiliar para logs e rate-limiting não-crítico.
    Para identidade verificada, use a dependência `get_current_user`.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None
    
    try:
        # Pega a parte após 'Bearer '
        token = authorization.split(" ")[1] if " " in authorization else authorization

        parts = token.split(".")
        if len(parts) != 3:
            return None
        
        # O payload e a segunda parte
        payload_b64 = parts[1]
        # Pad with '=' to avoid padding issues
        missing_padding = len(payload_b64) % 4
        if missing_padding:
            payload_b64 += "=" * (4 - missing_padding)
            
        payload_json = base64.b64decode(payload_b64).decode("utf-8")
        payload = json.loads(payload_json)
        return payload.get("sub")
    except Exception:
        return None


def _supabase_url() -> str:

    url = os.getenv("SUPABASE_URL")
    if not url:
        raise ValueError("SUPABASE_URL nao configurada.")
    return url.rstrip("/")


def _supabase_api_key() -> str:
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not key:
        raise ValueError("SUPABASE_SERVICE_KEY ou SUPABASE_ANON_KEY nao configurada.")
    return key


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticacao obrigatoria.",
        )

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autenticacao invalido.",
        )
    return token.strip()


def verify_access_token(access_token: str) -> AuthenticatedUser:
    # 1) Verificação LOCAL do JWT (sem rede), se SUPABASE_JWT_SECRET estiver
    #    configurada. É o caminho mais seguro e rápido — valida assinatura,
    #    expiração e audience. Cacheamos para evitar redecodificar a cada request.
    local_user = _try_local_verify(access_token)
    if local_user is not None:
        _auth_cache_put(access_token, local_user)
        return local_user

    # 2) Cache token→user (TTL curto). Evita round-trip ao Supabase Auth quando
    #    a verificação local não está disponível (sem JWT secret configurado).
    cached = _auth_cache_get(access_token)
    if cached is not None:
        return cached

    # 3) Fallback: verificação via rede no Supabase Auth.
    try:
        response = requests.get(
            f"{_supabase_url()}/auth/v1/user",
            headers={
                "apikey": _supabase_api_key(),
                "Authorization": f"Bearer {access_token}",
            },
            timeout=10,
        )

        if response.status_code in (401, 403):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Sessao invalida ou expirada.",
            )

        response.raise_for_status()
        payload = response.json()
        user_id = payload.get("id")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Nao foi possivel identificar o usuario autenticado.",
            )

        user = AuthenticatedUser(id=user_id, email=payload.get("email"))
        _auth_cache_put(access_token, user)
        return user
    except HTTPException:
        raise
    except requests.RequestException as exc:
        logging.error("Erro ao validar sessao Supabase: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Nao foi possivel validar a sessao no momento.",
        ) from exc


def get_current_user(authorization: str | None = Header(default=None)) -> AuthenticatedUser:
    token = _extract_bearer_token(authorization)
    return verify_access_token(token)


# ── Ownership guards (anti-IDOR) ─────────────────────────────────────────────
# Como o backend usa SUPABASE_SERVICE_KEY (bypassa RLS), TODO endpoint que
# recebe path param de recurso DEVE validar ownership manualmente. Estas
# dependências centralizam a checagem pra evitar bugs de omissão.

def require_field_ownership(field_id: str, user: AuthenticatedUser) -> dict:
    """
    Confirma que o user é dono do field e retorna o registro. 404 caso
    contrário. Use como dependency FastAPI.
    """
    from fastapi import HTTPException, status as _status
    from services import farm_service
    if not field_id or not field_id.strip():
        raise HTTPException(status_code=_status.HTTP_400_BAD_REQUEST, detail="field_id inválido.")
    field = farm_service.get_field_by_id(user.id, field_id.strip())
    if not field:
        # 404 (não 403) — não revela existência de field de outro usuário
        raise HTTPException(
            status_code=_status.HTTP_404_NOT_FOUND,
            detail="Talhão não encontrado ou sem permissão de acesso.",
        )
    return field


def require_farm_ownership(farm_id: str, user: AuthenticatedUser) -> dict:
    """Mesma ideia pra farms."""
    from fastapi import HTTPException, status as _status
    from services import farm_service
    if not farm_id or not farm_id.strip():
        raise HTTPException(status_code=_status.HTTP_400_BAD_REQUEST, detail="farm_id inválido.")
    farm = farm_service.get_farm_by_id(user.id, farm_id.strip())
    if not farm:
        # 404 (não 403) — não revela existência de farm de outro usuário
        raise HTTPException(
            status_code=_status.HTTP_404_NOT_FOUND,
            detail="Fazenda não encontrada ou sem permissão de acesso.",
        )
    return farm
