import logging
import os
from datetime import datetime

import requests


REQUEST_TIMEOUT_SECONDS = 10


def _is_missing_field_id_schema_error(exc: Exception) -> bool:
    message = str(exc).lower()
    return "field_id" in message and (
        "column" in message or "schema cache" in message or "could not find" in message
    )


def _extract_response_text(exc: Exception) -> str:
    response = getattr(exc, "response", None)
    if response is None:
        return ""
    try:
        return response.text
    except Exception:
        return ""


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


def _rest_url(table: str) -> str:
    url = os.getenv("SUPABASE_URL")
    if not url:
        raise ValueError("SUPABASE_URL nao configurada.")
    return f"{url.rstrip('/')}/rest/v1/{table}"


def _storage_url(bucket: str, object_path: str) -> str:
    url = os.getenv("SUPABASE_URL")
    if not url:
        raise ValueError("SUPABASE_URL nao configurada.")
    clean_path = object_path.lstrip("/")
    return f"{url.rstrip('/')}/storage/v1/object/{bucket}/{clean_path}"


def _iso_now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def save_conversation(
    user_id: str,
    conversation_id: str,
    title: str,
    messages: list,
    field_id: str | None = None,
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
            "field_id": field_id,
            "farm_context": farm_context,
            "updated_at": updated_at,
        }
        if created_at:
            payload["created_at"] = created_at

        try:
            response = requests.post(
                _base_url(),
                json=payload,
                headers={**_get_supabase_headers(), "Prefer": "resolution=merge-duplicates,return=representation"},
                params={"on_conflict": "conversation_id,user_id"},
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
        except Exception as exc:
            if not field_id or not _is_missing_field_id_schema_error(exc):
                raise

            legacy_payload = {key: value for key, value in payload.items() if key != "field_id"}
            logging.warning(
                "Conversations sem coluna field_id ainda. Salvando em modo legado conversation_id=%s detalhes=%s",
                conversation_id,
                _extract_response_text(exc) or str(exc),
            )
            response = requests.post(
                _base_url(),
                json=legacy_payload,
                headers={**_get_supabase_headers(), "Prefer": "resolution=merge-duplicates,return=representation"},
                params={"on_conflict": "conversation_id,user_id"},
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()

        return {"success": True, "conversation_id": conversation_id, "field_id": field_id}
    except Exception as exc:
        logging.error("Erro ao salvar conversa no Supabase conversation_id=%s: %s %s", conversation_id, exc, _extract_response_text(exc))
        raise


def get_conversations(user_id: str) -> list:
    try:
        try:
            response = requests.get(
                _base_url(),
                headers=_get_supabase_headers(),
                params={
                    "user_id": f"eq.{user_id}",
                    "order": "updated_at.desc",
                    "select": "conversation_id,title,messages,field_id,farm_context,created_at,updated_at",
                },
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            rows = response.json()
            for row in rows:
                row.setdefault("field_id", None)
            return rows
        except Exception as exc:
            if not _is_missing_field_id_schema_error(exc):
                raise

            logging.warning("Conversations sem coluna field_id ainda. Lendo em modo legado. detalhes=%s", _extract_response_text(exc) or str(exc))
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
            rows = response.json()
            return [{**row, "field_id": None} for row in rows]
    except Exception as exc:
        logging.error("Erro ao buscar conversas do Supabase user_id=%s: %s %s", user_id, exc, _extract_response_text(exc))
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


def delete_conversations_by_field(user_id: str, field_id: str) -> None:
    try:
        response = requests.delete(
            _base_url(),
            headers=_get_supabase_headers(),
            params={
                "user_id": f"eq.{user_id}",
                "field_id": f"eq.{field_id}",
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
    except Exception as exc:
        if _is_missing_field_id_schema_error(exc):
            logging.info("Tabela conversations ainda sem field_id; delete por field foi ignorado para user_id=%s field_id=%s", user_id, field_id)
            return
        logging.warning("Erro ao deletar conversas do field %s: %s", field_id, exc)


def get_satellite_artifact_by_key(
    user_id: str,
    field_id: str,
    source: str,
    mode: str,
    bbox_hash: str,
    scene_id: str | None = None,
    scene_date: str | None = None,
) -> dict | None:
    try:
        params = {
            "user_id": f"eq.{user_id}",
            "field_id": f"eq.{field_id}",
            "source": f"eq.{source}",
            "mode": f"eq.{mode}",
            "bbox_hash": f"eq.{bbox_hash}",
            "order": "updated_at.desc",
            "limit": "1",
            "select": "*",
        }

        if scene_id:
            params["scene_id"] = f"eq.{scene_id}"
        elif scene_date:
            params["scene_date"] = f"eq.{scene_date}"

        response = requests.get(
            _rest_url("satellite_artifacts"),
            headers=_get_supabase_headers(),
            params=params,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        rows = response.json()
        return rows[0] if rows else None
    except Exception as exc:
        logging.warning("Erro ao buscar artifact satelital no Supabase: %s", exc)
        return None


def touch_satellite_artifact(artifact_id: str) -> None:
    try:
        response = requests.patch(
            _rest_url("satellite_artifacts"),
            headers=_get_supabase_headers(),
            params={"id": f"eq.{artifact_id}"},
            json={"last_accessed_at": _iso_now()},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
    except Exception as exc:
        logging.warning("Erro ao atualizar last_accessed_at do artifact %s: %s", artifact_id, exc)


def upsert_satellite_artifact(metadata: dict) -> dict | None:
    try:
        response = requests.post(
            _rest_url("satellite_artifacts"),
            headers={**_get_supabase_headers(), "Prefer": "resolution=merge-duplicates,return=representation"},
            params={"on_conflict": "field_id,source,scene_id"},
            json=metadata,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        rows = response.json()
        return rows[0] if rows else None
    except Exception as exc:
        logging.warning("Erro ao upsert do artifact satelital: %s", exc)
        return None


def upload_storage_object(bucket: str, object_path: str, payload: bytes, mime_type: str) -> bool:
    try:
        headers = {
            "apikey": os.getenv("SUPABASE_SERVICE_KEY", ""),
            "Authorization": f"Bearer {os.getenv('SUPABASE_SERVICE_KEY', '')}",
            "Content-Type": mime_type,
            "x-upsert": "true",
        }
        response = requests.post(
            _storage_url(bucket, object_path),
            headers=headers,
            data=payload,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return True
    except Exception as exc:
        logging.warning("Erro upload storage %s/%s: %s", bucket, object_path, exc)
        return False


def download_storage_object(bucket: str, object_path: str) -> bytes | None:
    try:
        headers = {
            "apikey": os.getenv("SUPABASE_SERVICE_KEY", ""),
            "Authorization": f"Bearer {os.getenv('SUPABASE_SERVICE_KEY', '')}",
        }
        response = requests.get(
            _storage_url(bucket, object_path),
            headers=headers,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response.content
    except Exception as exc:
        logging.warning("Erro download storage %s/%s: %s", bucket, object_path, exc)
        return None


def delete_storage_object(bucket: str, object_path: str) -> bool:
    try:
        headers = {
            "apikey": os.getenv("SUPABASE_SERVICE_KEY", ""),
            "Authorization": f"Bearer {os.getenv('SUPABASE_SERVICE_KEY', '')}",
        }
        response = requests.delete(
            _storage_url(bucket, object_path),
            headers=headers,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return True
    except Exception as exc:
        logging.warning("Erro delete storage %s/%s: %s", bucket, object_path, exc)
        return False


def delete_satellite_artifacts_for_field(user_id: str, field_id: str, bucket: str) -> None:
    try:
        response = requests.get(
            _rest_url("satellite_artifacts"),
            headers=_get_supabase_headers(),
            params={
                "user_id": f"eq.{user_id}",
                "field_id": f"eq.{field_id}",
                "select": "id,image_path",
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        rows = response.json() or []

        for row in rows:
            image_path = row.get("image_path")
            if image_path:
                delete_storage_object(bucket, str(image_path))

        delete_response = requests.delete(
            _rest_url("satellite_artifacts"),
            headers=_get_supabase_headers(),
            params={
                "user_id": f"eq.{user_id}",
                "field_id": f"eq.{field_id}",
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        delete_response.raise_for_status()
    except Exception as exc:
        logging.warning("Erro ao invalidar artifacts satelitais do field %s: %s", field_id, exc)


def get_latest_artifact_for_field(
    user_id: str,
    field_id: str,
    source: str | None = None,
) -> dict | None:
    """Retorna o artifact satelital mais recente registrado para o talhão.
    Útil para injetar metadados de cache no snapshot de inteligência."""
    try:
        params: dict = {
            "user_id": f"eq.{user_id}",
            "field_id": f"eq.{field_id}",
            "order": "updated_at.desc",
            "limit": "1",
            "select": "id,source,mode,scene_date,image_path,generated_at,updated_at,cloud_coverage,bytes_size,scene_id",
        }
        if source:
            params["source"] = f"eq.{source}"
        response = requests.get(
            _rest_url("satellite_artifacts"),
            headers=_get_supabase_headers(),
            params=params,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        rows = response.json()
        return rows[0] if rows else None
    except Exception as exc:
        logging.warning("Erro ao buscar artifact mais recente para field %s: %s", field_id, exc)
        return None
