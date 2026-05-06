"""
season_service.py — Gestão de safras por talhão.

Tabela Supabase: field_seasons
  - id                  UUID primary key default gen_random_uuid()
  - field_id            UUID references fields(id) on delete cascade
  - user_id             UUID references auth.users(id) on delete cascade
  - name                TEXT NOT NULL           -- ex: "Soja 2025/26"
  - crop_type           TEXT
  - planting_date       TEXT
  - harvest_date        TEXT
  - area_ha             FLOAT8
  - productivity_sc_ha  FLOAT8                  -- sacas/ha realizadas
  - productivity_kg_ha  FLOAT8                  -- kg/ha realizadas
  - notes               TEXT
  - created_at          TIMESTAMPTZ DEFAULT now()

SQL para rodar no Supabase:
  CREATE TABLE IF NOT EXISTS field_seasons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_id UUID REFERENCES fields(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    crop_type TEXT,
    planting_date TEXT,
    harvest_date TEXT,
    area_ha FLOAT8,
    productivity_sc_ha FLOAT8,
    productivity_kg_ha FLOAT8,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
  );
  ALTER TABLE field_seasons ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "users_own_seasons" ON field_seasons USING (auth.uid() = user_id);
"""

import logging
import os

import requests

_TIMEOUT = 8
_SELECT = "id,field_id,user_id,name,crop_type,planting_date,harvest_date,area_ha,productivity_sc_ha,productivity_kg_ha,notes,created_at"


def _headers(prefer: str = "return=representation") -> dict[str, str]:
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": prefer,
    }


def _url() -> str:
    return os.getenv("SUPABASE_URL", "").rstrip("/") + "/rest/v1/field_seasons"


async def create_season(field_id: str, user_id: str, data: dict) -> dict:
    """Cria uma safra. Retorna o registro criado ou dict vazio em falha."""
    try:
        payload = {k: v for k, v in data.items() if v is not None}
        payload["field_id"] = field_id
        payload["user_id"] = user_id
        resp = requests.post(_url(), json=payload, headers=_headers(), timeout=_TIMEOUT)
        resp.raise_for_status()
        rows = resp.json()
        return rows[0] if isinstance(rows, list) and rows else payload
    except Exception as exc:
        logging.error("[season] create_season field_id=%s: %s", field_id, exc)
        raise


async def get_field_seasons(field_id: str, user_id: str) -> list[dict]:
    """Retorna safras do talhão ordenadas por planting_date DESC."""
    try:
        resp = requests.get(
            _url(),
            headers=_headers(),
            params={
                "field_id": f"eq.{field_id}",
                "user_id": f"eq.{user_id}",
                "order": "planting_date.desc.nullslast",
                "select": _SELECT,
            },
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        rows = resp.json()
        return rows if isinstance(rows, list) else []
    except Exception as exc:
        logging.warning("[season] get_field_seasons field_id=%s: %s", field_id, exc)
        return []


async def update_season(season_id: str, user_id: str, data: dict) -> dict | None:
    """Atualiza safra. Retorna registro atualizado ou None se não encontrado."""
    try:
        payload = {k: v for k, v in data.items() if k not in ("id", "field_id", "user_id", "created_at") and v is not None}
        resp = requests.patch(
            _url(),
            json=payload,
            headers=_headers(),
            params={"id": f"eq.{season_id}", "user_id": f"eq.{user_id}", "select": _SELECT},
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        rows = resp.json()
        return rows[0] if isinstance(rows, list) and rows else None
    except Exception as exc:
        logging.error("[season] update_season season_id=%s: %s", season_id, exc)
        raise


async def delete_season(season_id: str, user_id: str) -> bool:
    """Deleta safra verificando user_id. Retorna True se deletou."""
    try:
        resp = requests.delete(
            _url(),
            headers=_headers(prefer="return=minimal"),
            params={"id": f"eq.{season_id}", "user_id": f"eq.{user_id}"},
            timeout=_TIMEOUT,
        )
        resp.raise_for_status()
        return True
    except Exception as exc:
        logging.error("[season] delete_season season_id=%s: %s", season_id, exc)
        return False
