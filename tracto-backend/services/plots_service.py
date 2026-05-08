"""
services/plots_service.py — Parcelas / Microtalhões
Tabela: public.plots (migration 08)
"""

import logging
import os
from typing import Optional

import requests

_TIMEOUT = 8

def _headers(representation: bool = False) -> dict:
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation" if representation else "return=minimal",
    }

def _url() -> str:
    return f"{os.getenv('SUPABASE_URL', '').rstrip('/')}/rest/v1/plots"


def create_plot(field_id: str, user_id: str, data: dict) -> dict:
    payload = {
        "field_id": field_id,
        "user_id": user_id,
        "name": data["name"],
    }
    for f in ("description", "area_ha", "latitude", "longitude"):
        if data.get(f) is not None:
            payload[f] = data[f]
    if data.get("boundaries"):
        payload["boundaries"] = data["boundaries"]

    resp = requests.post(_url(), json=payload, headers=_headers(True), timeout=_TIMEOUT)
    resp.raise_for_status()
    result = resp.json()
    return result[0] if isinstance(result, list) else result


def get_plots_by_field(field_id: str, user_id: str) -> list[dict]:
    try:
        resp = requests.get(
            _url(),
            headers=_headers(True),
            params={
                "field_id": f"eq.{field_id}",
                "user_id": f"eq.{user_id}",
                "order": "created_at.asc",
                "select": "id,field_id,user_id,name,description,area_ha,boundaries,latitude,longitude,created_at,updated_at",
            },
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json() if isinstance(resp.json(), list) else []
    except Exception as e:
        logging.warning("[plots] get_plots_by_field error: %s", e)
        return []


def update_plot(plot_id: str, user_id: str, data: dict) -> dict:
    payload = {k: v for k, v in data.items() if k not in ("id", "user_id", "field_id")}
    resp = requests.patch(
        _url(),
        json=payload,
        headers=_headers(True),
        params={"id": f"eq.{plot_id}", "user_id": f"eq.{user_id}"},
        timeout=_TIMEOUT,
    )
    resp.raise_for_status()
    result = resp.json()
    return result[0] if isinstance(result, list) and result else {}


def delete_plot(plot_id: str, user_id: str) -> bool:
    resp = requests.delete(
        _url(),
        headers=_headers(),
        params={"id": f"eq.{plot_id}", "user_id": f"eq.{user_id}"},
        timeout=_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.status_code in (200, 204)
