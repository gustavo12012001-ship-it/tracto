import logging
import os
import json
import base64
from dataclasses import dataclass

import requests
from fastapi import Header, HTTPException, status


@dataclass
class AuthenticatedUser:
    id: str
    email: str | None = None


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

        return AuthenticatedUser(id=user_id, email=payload.get("email"))
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
