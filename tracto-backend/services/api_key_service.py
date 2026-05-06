"""
api_key_service.py — Gerenciamento de API Keys para acesso programático à Tracto API.

Tabela Supabase: api_keys
  - id           UUID primary key default gen_random_uuid()
  - user_id      UUID references auth.users(id) on delete cascade
  - key_hash     TEXT (SHA-256 da chave em plain text)
  - name         TEXT (label amigável, ex: "Integração ERP")
  - created_at   TIMESTAMPTZ default now()
  - last_used_at TIMESTAMPTZ
  - active       BOOL default true

Segurança:
  - A chave em plain text (tracto_live_<32bytes_hex>) é retornada APENAS no momento
    da criação. Após isso, somente o hash SHA-256 é armazenado.
  - Verificação é feita comparando SHA-256(raw_key) com key_hash no banco.
"""

import hashlib
import logging
import os
import secrets

import requests

_REQUEST_TIMEOUT = 8
_KEY_PREFIX = "tracto_live_"


def _headers(return_representation: bool = False) -> dict[str, str]:
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    prefer = "return=representation" if return_representation else "return=minimal"
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": prefer,
    }


def _table_url() -> str:
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    return f"{base}/rest/v1/api_keys"


def _hash_key(raw_key: str) -> str:
    """Retorna o SHA-256 hex da chave em plain text."""
    return hashlib.sha256(raw_key.encode()).hexdigest()


def generate_api_key(user_id: str, name: str) -> dict:
    """
    Gera uma nova API key para o usuário e salva o hash no Supabase.

    A chave plain text é retornada APENAS nesta chamada.
    Após isso, não é possível recuperá-la.

    Parameters
    ----------
    user_id : str — UUID do usuário autenticado
    name    : str — label amigável para identificar a chave

    Returns
    -------
    dict com: key (plain text, única vez), id, name, created_at

    Raises
    ------
    ValueError se SUPABASE_URL não estiver configurada.
    requests.HTTPError em caso de erro HTTP.
    """
    url = _table_url()
    if not url.startswith("http"):
        raise ValueError("[api_key] SUPABASE_URL não configurada.")

    raw_key = _KEY_PREFIX + secrets.token_hex(32)
    key_hash = _hash_key(raw_key)

    payload = {
        "user_id": user_id,
        "key_hash": key_hash,
        "name": name,
        "active": True,
    }

    headers = _headers(return_representation=True)
    headers["Accept"] = "application/json"

    resp = requests.post(
        url,
        json=payload,
        headers=headers,
        timeout=_REQUEST_TIMEOUT,
    )
    resp.raise_for_status()

    result = resp.json()
    record = result[0] if isinstance(result, list) and result else (result if isinstance(result, dict) else {})

    return {
        "key": raw_key,
        "id": record.get("id"),
        "name": record.get("name", name),
        "created_at": record.get("created_at"),
    }


def verify_api_key(raw_key: str) -> str | None:
    """
    Verifica se a API key é válida e ativa.

    Parameters
    ----------
    raw_key : str — chave em plain text (tracto_live_...)

    Returns
    -------
    user_id (str) se válida e ativa, None caso contrário.
    """
    try:
        if not raw_key or not raw_key.startswith(_KEY_PREFIX):
            return None

        url = _table_url()
        if not url.startswith("http"):
            logging.warning("[api_key] SUPABASE_URL não configurada.")
            return None

        key_hash = _hash_key(raw_key)
        headers = _headers(return_representation=True)

        resp = requests.get(
            url,
            headers=headers,
            params={
                "key_hash": f"eq.{key_hash}",
                "active": "eq.true",
                "select": "id,user_id,active",
                "limit": "1",
            },
            timeout=_REQUEST_TIMEOUT,
        )
        resp.raise_for_status()

        rows = resp.json()
        if not isinstance(rows, list) or not rows:
            return None

        user_id = rows[0].get("user_id")
        if not user_id:
            return None

        # Atualiza last_used_at de forma best-effort (não bloqueia o retorno)
        _update_last_used(rows[0].get("id"))

        return str(user_id)
    except Exception as exc:
        logging.warning("[api_key] Erro ao verificar API key: %s", exc)
        return None


def _update_last_used(key_id: str | None) -> None:
    """Atualiza last_used_at. Best-effort: nunca lança exceção."""
    if not key_id:
        return
    try:
        url = _table_url()
        if not url.startswith("http"):
            return

        from datetime import datetime, timezone
        now_iso = datetime.now(timezone.utc).isoformat()

        requests.patch(
            url,
            json={"last_used_at": now_iso},
            headers=_headers(),
            params={"id": f"eq.{key_id}"},
            timeout=_REQUEST_TIMEOUT,
        )
    except Exception as exc:
        logging.debug("[api_key] Falha ao atualizar last_used_at key_id=%s: %s", key_id, exc)


def list_api_keys(user_id: str) -> list[dict]:
    """
    Lista as API keys do usuário sem retornar a chave em plain text.

    Returns
    -------
    list[dict] com: id, name, created_at, last_used_at, active
    """
    try:
        url = _table_url()
        if not url.startswith("http"):
            logging.warning("[api_key] SUPABASE_URL não configurada — retornando lista vazia.")
            return []

        headers = _headers(return_representation=True)

        resp = requests.get(
            url,
            headers=headers,
            params={
                "user_id": f"eq.{user_id}",
                "order": "created_at.desc",
                "select": "id,name,created_at,last_used_at,active",
            },
            timeout=_REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        rows = resp.json()
        return rows if isinstance(rows, list) else []
    except Exception as exc:
        logging.warning("[api_key] Falha ao listar chaves user_id=%s: %s", user_id, exc)
        return []


def revoke_api_key(key_id: str, user_id: str) -> bool:
    """
    Revoga (desativa) uma API key verificando que pertence ao user_id.

    Returns
    -------
    True se revogada com sucesso, False se não encontrada ou sem permissão.
    """
    try:
        url = _table_url()
        if not url.startswith("http"):
            logging.warning("[api_key] SUPABASE_URL não configurada — revoke ignorado.")
            return False

        resp = requests.patch(
            url,
            json={"active": False},
            headers=_headers(),
            params={
                "id": f"eq.{key_id}",
                "user_id": f"eq.{user_id}",
            },
            timeout=_REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.status_code in (200, 204)
    except Exception as exc:
        logging.error("[api_key] Erro ao revogar chave key_id=%s: %s", key_id, exc)
        return False
