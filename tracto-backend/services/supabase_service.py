import logging
import os

import requests


REQUEST_TIMEOUT_SECONDS = 10


def _get_supabase_headers() -> dict[str, str]:
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not key:
        raise ValueError("SUPABASE_SERVICE_KEY nao configurada.")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _base_url() -> str:
    url = os.getenv("SUPABASE_URL")
    if not url:
        raise ValueError("SUPABASE_URL nao configurada.")
    return f"{url.rstrip('/')}/rest/v1/conversations"


def save_conversation(
    user_id: str,
    conversation_id: str,
    title: str,
    messages: list,
    farm_context: str | None = None,
    created_at: str | None = None,
    updated_at: str | None = None,
) -> dict:
    try:
        payload = {
            "user_id": user_id,
            "conversation_id": conversation_id,
            "title": title,
            "messages": messages,
            "farm_context": farm_context,
            "updated_at": updated_at,
        }
        if created_at:
            payload["created_at"] = created_at

        response = requests.post(
            _base_url(),
            json=payload,
            headers={**_get_supabase_headers(), "Prefer": "resolution=merge-duplicates,return=representation"},
            params={"on_conflict": "conversation_id,user_id"},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

        response.raise_for_status()
        return {"success": True, "conversation_id": conversation_id}
    except Exception as exc:
        logging.error("Erro ao salvar conversa no Supabase: %s", exc)
        raise


def get_conversations(user_id: str) -> list:
    try:
        response = requests.get(
            _base_url(),
            headers=_get_supabase_headers(),
            params={
                "user_id": f"eq.{user_id}",
                "order": "updated_at.desc",
                "select": "conversation_id,title,messages,farm_context,created_at,updated_at",
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response.json()
    except Exception as exc:
        logging.error("Erro ao buscar conversas do Supabase: %s", exc)
        raise



def delete_conversation(conversation_id: str, user_id: str) -> bool:
    try:
        response = requests.delete(
            _base_url(),
            headers={**_get_supabase_headers(), "Prefer": "return=representation"},
            params={
                "conversation_id": f"eq.{conversation_id}",
                "user_id": f"eq.{user_id}",
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        # PostgREST com return=representation retorna lista de linhas deletadas
        deleted_rows = response.json()
        return len(deleted_rows) > 0
    except Exception as exc:
        logging.error("Erro ao deletar conversa do Supabase: %s", exc)
        raise
