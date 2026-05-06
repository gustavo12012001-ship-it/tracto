"""
germoplasm_service.py — Banco de Germoplasma e Programa de Melhoramento.

Tabelas Supabase:
  genotypes
    id              UUID primary key default gen_random_uuid()
    user_id         UUID references auth.users(id) on delete cascade
    name            TEXT not null
    species         TEXT
    generation      TEXT            -- F1..F8, BC1..BC3, S1..S5, Linhagem Pura
    status          TEXT            -- Em desenvolvimento / Candidata / Descartada / Registrada
    origin          TEXT
    female_parent   TEXT
    male_parent     TEXT
    year_obtained   INT
    notes           TEXT
    traits          TEXT[]          -- array de atributos fenotípicos
    created_at      TIMESTAMPTZ default now()
    updated_at      TIMESTAMPTZ default now()

  crosses
    id              UUID primary key default gen_random_uuid()
    user_id         UUID references auth.users(id) on delete cascade
    date            DATE
    female_parent   TEXT not null
    male_parent     TEXT not null
    f1_name         TEXT
    purpose         TEXT
    location        TEXT
    f1_count        INT
    notes           TEXT
    created_at      TIMESTAMPTZ default now()

  breeding_generations
    id              UUID primary key default gen_random_uuid()
    user_id         UUID references auth.users(id) on delete cascade
    genotype_id     UUID references genotypes(id) on delete cascade
    generation_label TEXT not null
    year            INT
    location        TEXT
    plants_evaluated INT
    plants_selected  INT
    selection_criteria TEXT
    mean_yield      FLOAT8
    notes           TEXT
    created_at      TIMESTAMPTZ default now()

RLS: enable row level security on all three tables.
  CREATE POLICY "user_own" ON genotypes FOR ALL USING (auth.uid() = user_id);
  (idem for crosses and breeding_generations)
"""

import logging
import os

import requests

_REQUEST_TIMEOUT = 8


def _headers(return_representation: bool = False) -> dict[str, str]:
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    prefer = "return=representation" if return_representation else "return=minimal"
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": prefer,
        "Accept": "application/json",
    }


def _url(table: str) -> str:
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    return f"{base}/rest/v1/{table}"


# ─────────────────────────────────────────────────────────────────────────────
# GENOTYPES
# ─────────────────────────────────────────────────────────────────────────────

async def create_genotype(user_id: str, data: dict) -> dict:
    """Insere um genótipo e retorna o registro criado."""
    url = _url("genotypes")
    if not url.startswith("http"):
        raise ValueError("[germoplasm] SUPABASE_URL não configurada.")

    payload: dict = {
        "user_id": user_id,
        "name": data["name"],
    }
    for field in ("species", "generation", "status", "origin", "female_parent",
                  "male_parent", "notes"):
        if data.get(field) is not None:
            payload[field] = str(data[field])
    if data.get("year_obtained") is not None:
        try:
            payload["year_obtained"] = int(data["year_obtained"])
        except (TypeError, ValueError):
            pass
    if data.get("traits") is not None:
        payload["traits"] = list(data["traits"])

    resp = requests.post(url, json=payload, headers=_headers(True), timeout=_REQUEST_TIMEOUT)
    resp.raise_for_status()
    result = resp.json()
    return result[0] if isinstance(result, list) and result else (result if isinstance(result, dict) else payload)


async def get_genotypes(user_id: str) -> list[dict]:
    """Retorna todos os genótipos do usuário ordenados por nome."""
    try:
        url = _url("genotypes")
        if not url.startswith("http"):
            return []
        resp = requests.get(
            url,
            headers=_headers(True),
            params={"user_id": f"eq.{user_id}", "order": "name.asc"},
            timeout=_REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        rows = resp.json()
        return rows if isinstance(rows, list) else []
    except Exception as exc:
        logging.warning("[germoplasm] get_genotypes user_id=%s: %s", user_id, exc)
        return []


async def update_genotype(genotype_id: str, user_id: str, data: dict) -> dict:
    """Atualiza campos de um genótipo."""
    url = _url("genotypes")
    if not url.startswith("http"):
        raise ValueError("[germoplasm] SUPABASE_URL não configurada.")

    payload: dict = {"updated_at": "now()"}
    for field in ("name", "species", "generation", "status", "origin",
                  "female_parent", "male_parent", "notes"):
        if field in data:
            payload[field] = str(data[field]) if data[field] is not None else None
    if "year_obtained" in data:
        try:
            payload["year_obtained"] = int(data["year_obtained"]) if data["year_obtained"] is not None else None
        except (TypeError, ValueError):
            pass
    if "traits" in data:
        payload["traits"] = list(data["traits"])

    resp = requests.patch(
        url,
        json=payload,
        headers=_headers(True),
        params={"id": f"eq.{genotype_id}", "user_id": f"eq.{user_id}"},
        timeout=_REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    result = resp.json()
    return result[0] if isinstance(result, list) and result else (result if isinstance(result, dict) else payload)


async def delete_genotype(genotype_id: str, user_id: str) -> bool:
    """Remove um genótipo."""
    try:
        url = _url("genotypes")
        if not url.startswith("http"):
            return False
        resp = requests.delete(
            url,
            headers=_headers(),
            params={"id": f"eq.{genotype_id}", "user_id": f"eq.{user_id}"},
            timeout=_REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.status_code in (200, 204)
    except Exception as exc:
        logging.error("[germoplasm] delete_genotype %s: %s", genotype_id, exc)
        return False


# ─────────────────────────────────────────────────────────────────────────────
# CROSSES
# ─────────────────────────────────────────────────────────────────────────────

async def create_cross(user_id: str, data: dict) -> dict:
    url = _url("crosses")
    if not url.startswith("http"):
        raise ValueError("[germoplasm] SUPABASE_URL não configurada.")

    payload: dict = {
        "user_id": user_id,
        "female_parent": data["female_parent"],
        "male_parent": data["male_parent"],
    }
    for field in ("date", "f1_name", "purpose", "location", "notes"):
        if data.get(field) is not None:
            payload[field] = str(data[field])
    if data.get("f1_count") is not None:
        try:
            payload["f1_count"] = int(data["f1_count"])
        except (TypeError, ValueError):
            pass

    resp = requests.post(url, json=payload, headers=_headers(True), timeout=_REQUEST_TIMEOUT)
    resp.raise_for_status()
    result = resp.json()
    return result[0] if isinstance(result, list) and result else (result if isinstance(result, dict) else payload)


async def get_crosses(user_id: str) -> list[dict]:
    try:
        url = _url("crosses")
        if not url.startswith("http"):
            return []
        resp = requests.get(
            url,
            headers=_headers(True),
            params={"user_id": f"eq.{user_id}", "order": "date.desc"},
            timeout=_REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        rows = resp.json()
        return rows if isinstance(rows, list) else []
    except Exception as exc:
        logging.warning("[germoplasm] get_crosses user_id=%s: %s", user_id, exc)
        return []


async def delete_cross(cross_id: str, user_id: str) -> bool:
    try:
        url = _url("crosses")
        if not url.startswith("http"):
            return False
        resp = requests.delete(
            url,
            headers=_headers(),
            params={"id": f"eq.{cross_id}", "user_id": f"eq.{user_id}"},
            timeout=_REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.status_code in (200, 204)
    except Exception as exc:
        logging.error("[germoplasm] delete_cross %s: %s", cross_id, exc)
        return False


# ─────────────────────────────────────────────────────────────────────────────
# BREEDING GENERATIONS
# ─────────────────────────────────────────────────────────────────────────────

async def create_generation(user_id: str, data: dict) -> dict:
    url = _url("breeding_generations")
    if not url.startswith("http"):
        raise ValueError("[germoplasm] SUPABASE_URL não configurada.")

    payload: dict = {
        "user_id": user_id,
        "genotype_id": data["genotype_id"],
        "generation_label": data["generation_label"],
    }
    for field in ("location", "selection_criteria", "notes"):
        if data.get(field) is not None:
            payload[field] = str(data[field])
    for field in ("year", "plants_evaluated", "plants_selected"):
        if data.get(field) is not None:
            try:
                payload[field] = int(data[field])
            except (TypeError, ValueError):
                pass
    if data.get("mean_yield") is not None:
        try:
            payload["mean_yield"] = float(data["mean_yield"])
        except (TypeError, ValueError):
            pass

    resp = requests.post(url, json=payload, headers=_headers(True), timeout=_REQUEST_TIMEOUT)
    resp.raise_for_status()
    result = resp.json()
    return result[0] if isinstance(result, list) and result else (result if isinstance(result, dict) else payload)


async def get_generations(user_id: str, genotype_id: str | None = None) -> list[dict]:
    try:
        url = _url("breeding_generations")
        if not url.startswith("http"):
            return []
        params: dict = {"user_id": f"eq.{user_id}", "order": "year.desc,created_at.desc"}
        if genotype_id:
            params["genotype_id"] = f"eq.{genotype_id}"
        resp = requests.get(url, headers=_headers(True), params=params, timeout=_REQUEST_TIMEOUT)
        resp.raise_for_status()
        rows = resp.json()
        return rows if isinstance(rows, list) else []
    except Exception as exc:
        logging.warning("[germoplasm] get_generations: %s", exc)
        return []


async def delete_generation(generation_id: str, user_id: str) -> bool:
    try:
        url = _url("breeding_generations")
        if not url.startswith("http"):
            return False
        resp = requests.delete(
            url,
            headers=_headers(),
            params={"id": f"eq.{generation_id}", "user_id": f"eq.{user_id}"},
            timeout=_REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        return resp.status_code in (200, 204)
    except Exception as exc:
        logging.error("[germoplasm] delete_generation %s: %s", generation_id, exc)
        return False
