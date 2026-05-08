"""
services/notebook_service.py — Caderno de Campo expandido
Tabela: public.notebook_events (migration 08)

Categorias suportadas:
  identification | planting | soil | pest | disease | weed |
  application | fertilization | irrigation | harvest | observation
"""

import logging
import os
from typing import Optional

import requests

_TIMEOUT = 10

_VALID_CATEGORIES = {
    "identification", "planting", "soil", "pest", "disease",
    "weed", "application", "fertilization", "irrigation", "harvest", "observation",
}

def _headers(representation: bool = False) -> dict:
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation" if representation else "return=minimal",
    }

def _url() -> str:
    return f"{os.getenv('SUPABASE_URL', '').rstrip('/')}/rest/v1/notebook_events"


async def create_event(field_id: str, user_id: str, data: dict) -> dict:
    """
    Cria um evento no caderno de campo.
    data deve conter:
      - category (obrigatório)
      - title (opcional)
      - data (JSONB com payload por categoria)
      - occurred_at (ISO string, opcional)
      - plot_id (UUID, opcional)
      - photos (list[str], opcional)
      - ai_analysis (str, opcional)
    """
    category = data.get("category", "")
    if category not in _VALID_CATEGORIES:
        raise ValueError(f"Categoria inválida: {category}. Válidas: {_VALID_CATEGORIES}")

    payload: dict = {
        "field_id": field_id,
        "user_id": user_id,
        "category": category,
    }

    for f in ("title", "occurred_at", "ai_analysis"):
        if data.get(f):
            payload[f] = data[f]

    if data.get("plot_id"):
        payload["plot_id"] = data["plot_id"]

    if data.get("data"):
        payload["data"] = data["data"]

    if data.get("photos"):
        payload["photos"] = data["photos"]

    resp = requests.post(_url(), json=payload, headers=_headers(True), timeout=_TIMEOUT)
    resp.raise_for_status()
    result = resp.json()
    return result[0] if isinstance(result, list) and result else result


async def get_events(
    field_id: str,
    user_id: str,
    category: Optional[str] = None,
    plot_id: Optional[str] = None,
    limit: int = 100,
) -> list[dict]:
    """Retorna eventos do caderno, filtráveis por categoria e parcela."""
    try:
        params: dict = {
            "field_id": f"eq.{field_id}",
            "user_id": f"eq.{user_id}",
            "order": "occurred_at.desc",
            "limit": str(min(limit, 200)),
        }
        if category:
            params["category"] = f"eq.{category}"
        if plot_id:
            params["plot_id"] = f"eq.{plot_id}"

        resp = requests.get(_url(), headers=_headers(True), params=params, timeout=_TIMEOUT)
        resp.raise_for_status()
        return resp.json() if isinstance(resp.json(), list) else []
    except Exception as e:
        logging.warning("[notebook] get_events error field_id=%s: %s", field_id, e)
        return []


async def update_event(event_id: str, user_id: str, data: dict) -> dict:
    payload = {k: v for k, v in data.items() if k not in ("id", "user_id", "field_id")}
    resp = requests.patch(
        _url(),
        json=payload,
        headers=_headers(True),
        params={"id": f"eq.{event_id}", "user_id": f"eq.{user_id}"},
        timeout=_TIMEOUT,
    )
    resp.raise_for_status()
    result = resp.json()
    return result[0] if isinstance(result, list) and result else {}


async def delete_event(event_id: str, user_id: str) -> bool:
    resp = requests.delete(
        _url(),
        headers=_headers(),
        params={"id": f"eq.{event_id}", "user_id": f"eq.{user_id}"},
        timeout=_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.status_code in (200, 204)
