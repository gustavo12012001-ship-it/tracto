"""
services/user_data_service.py — (A-01) Persistência genérica por usuário/namespace.

Substitui o uso de localStorage como fonte de verdade para dados de negócio
(germoplasma, experimentos, avaliações fenotípicas, solo, blocos de pesquisa).
O backend (tabela user_app_data, RLS por dono) passa a ser a fonte de verdade;
o frontend usa localStorage apenas como cache offline.

Como o backend usa SUPABASE_SERVICE_KEY (bypassa RLS), TODA query é filtrada
explicitamente por user_id (anti-IDOR).
"""

import asyncio as _asyncio
import logging
import os
from typing import Any

import requests

REQUEST_TIMEOUT_SECONDS = 10

# Namespaces permitidos — evita que o cliente crie chaves arbitrárias sem limite.
ALLOWED_NAMESPACES = {
    "germoplasma",
    "experiments",
    "avaliacoes",
    "fenotipos",
    "soil",
    "research_blocks",
}


def _headers() -> dict[str, str]:
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not key:
        raise ValueError("SUPABASE_SERVICE_KEY nao configurada.")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=representation",
    }


def _url() -> str:
    base = os.getenv("SUPABASE_URL")
    if not base:
        raise ValueError("SUPABASE_URL nao configurada.")
    return f"{base.rstrip('/')}/rest/v1/user_app_data"


def is_valid_namespace(namespace: str) -> bool:
    return namespace in ALLOWED_NAMESPACES


def get_user_data(user_id: str, namespace: str) -> Any | None:
    """Retorna o documento JSON do usuário para o namespace, ou None se não existir."""
    try:
        response = requests.get(
            _url(),
            headers={k: v for k, v in _headers().items() if k != "Prefer"},
            params={
                "user_id": f"eq.{user_id}",
                "namespace": f"eq.{namespace}",
                "select": "data",
                "limit": "1",
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        rows = response.json()
        return rows[0]["data"] if rows else None
    except Exception as exc:
        logging.error("[user_data] get %s/%s: %s", user_id, namespace, exc)
        raise


def upsert_user_data(user_id: str, namespace: str, data: Any) -> Any:
    """Cria/atualiza o documento do usuário para o namespace. Retorna o data salvo."""
    try:
        from datetime import datetime, timezone
        payload = {
            "user_id": user_id,
            "namespace": namespace,
            "data": data,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        response = requests.post(
            _url(),
            headers=_headers(),
            json=payload,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        rows = response.json()
        return rows[0]["data"] if rows else data
    except Exception as exc:
        logging.error("[user_data] upsert %s/%s: %s", user_id, namespace, exc)
        raise


# ── Async wrappers (não bloquear o event loop) ───────────────────────────────
async def async_get_user_data(user_id: str, namespace: str) -> Any | None:
    return await _asyncio.to_thread(get_user_data, user_id, namespace)


async def async_upsert_user_data(user_id: str, namespace: str, data: Any) -> Any:
    return await _asyncio.to_thread(upsert_user_data, user_id, namespace, data)
