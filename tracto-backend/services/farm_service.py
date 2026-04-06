import logging
import os
from typing import Any, Dict, List

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


def _supabase_url(table: str) -> str:
    url = os.getenv("SUPABASE_URL")
    if not url:
        raise ValueError("SUPABASE_URL nao configurada.")
    return f"{url.rstrip('/')}/rest/v1/{table}"


def _get_default_farm(user_id: str) -> Dict[str, Any] | None:
    response = requests.get(
        _supabase_url("farms"),
        headers=_get_supabase_headers(),
        params={
            "user_id": f"eq.{user_id}",
            "is_default": "eq.true",
            "select": "*",
        },
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    existing = response.json()
    return existing[0] if existing else None


# --- Farms ---


def get_farms(user_id: str) -> List[Dict[str, Any]]:
    try:
        response = requests.get(
            _supabase_url("farms"),
            headers=_get_supabase_headers(),
            params={"user_id": f"eq.{user_id}", "order": "created_at.desc"},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response.json()
    except Exception as exc:
        logging.error("Erro ao buscar fazendas: %s", exc)
        raise


def save_farm(user_id: str, farm_data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        payload = {**farm_data, "user_id": user_id}
        headers = _get_supabase_headers()
        if "id" in payload:
            headers["Prefer"] = "resolution=merge-duplicates,return=representation"

        response = requests.post(
            _supabase_url("farms"),
            json=payload,
            headers=headers,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response.json()[0] if response.json() else {}
    except Exception as exc:
        logging.error("Erro ao salvar fazenda: %s", exc)
        raise


def delete_farm(farm_id: str, user_id: str) -> bool:
    try:
        response = requests.delete(
            _supabase_url("farms"),
            headers=_get_supabase_headers(),
            params={"id": f"eq.{farm_id}", "user_id": f"eq.{user_id}"},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return True
    except Exception as exc:
        logging.error("Erro ao deletar fazenda: %s", exc)
        raise


# --- Fields ---


def get_fields(user_id: str, farm_id: str | None = None) -> List[Dict[str, Any]]:
    try:
        params = {"user_id": f"eq.{user_id}", "order": "name.asc"}
        if farm_id:
            params["farm_id"] = f"eq.{farm_id}"

        response = requests.get(
            _supabase_url("fields"),
            headers=_get_supabase_headers(),
            params=params,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response.json()
    except Exception as exc:
        logging.error("Erro ao buscar talhoes: %s", exc)
        raise


def get_field_by_id(user_id: str, field_id: str) -> dict | None:
    try:
        response = requests.get(
            _supabase_url("fields"),
            headers=_get_supabase_headers(),
            params={
                "id": f"eq.{field_id}",
                "user_id": f"eq.{user_id}",
                "select": "id,name,latitude,longitude,boundaries,crop_type",
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        data = response.json()
        return data[0] if data else None
    except Exception as exc:
        logging.error("Erro ao buscar talhao por ID field_id=%s: %s", field_id, exc)
        return None


def save_field(user_id: str, field_data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        # field_data ALREADY comes correctly mapped from Pydantic models in main.py
        payload = {**field_data, "user_id": user_id}
        headers = _get_supabase_headers()
        if "id" in payload:
            headers["Prefer"] = "resolution=merge-duplicates,return=representation"

        response = requests.post(
            _supabase_url("fields"),
            json=payload,
            headers=headers,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response.json()[0] if response.json() else {}
    except requests.HTTPError as exc:
        if exc.response is not None:
             logging.error("Supabase HTTP Error: %s - %s", exc.response.status_code, exc.response.text)
        else:
             logging.error("Erro HTTP ao salvar talhao: %s", exc)
        raise
    except Exception as exc:
        logging.error("Erro interno ao salvar talhao: %s", exc)
        raise


def delete_field(field_id: str, user_id: str) -> bool:
    try:
        response = requests.delete(
            _supabase_url("fields"),
            headers=_get_supabase_headers(),
            params={"id": f"eq.{field_id}", "user_id": f"eq.{user_id}"},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return True
    except Exception as exc:
        logging.error("Erro ao deletar talhao: %s", exc)
        raise


def ensure_default_farm(user_id: str) -> Dict[str, Any]:
    """
    Garante de forma idempotente que o usuario tenha uma fazenda padrao.
    Se outra aba/processo criar a fazenda entre a leitura e a escrita,
    reconsulta o registro vencedor e converge sem propagar erro.
    """
    try:
        existing = _get_default_farm(user_id)
        if existing:
            return existing

        payload = {
            "user_id": user_id,
            "name": "Minha Fazenda",
            "description": "Fazenda principal (Auto-criada)",
            "is_default": True,
        }

        headers = _get_supabase_headers()
        headers["Prefer"] = "resolution=merge-duplicates,return=representation"

        response = requests.post(
            _supabase_url("farms"),
            json=payload,
            headers=headers,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        try:
            response.raise_for_status()
        except requests.HTTPError:
            if response.status_code in (400, 409):
                existing = _get_default_farm(user_id)
                if existing:
                    return existing
            raise

        result = response.json()
        return result[0] if result else {}
    except Exception as exc:
        logging.error("Erro no bootstrap de fazenda: %s", exc)
        raise
