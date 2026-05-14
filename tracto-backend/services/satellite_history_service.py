"""
services/satellite_history_service.py
Consulta o histórico de imagens de satélite cacheadas (satellite_artifacts)
por talhão, com suporte a filtros por fonte (s1, s2, up42) e datas.
"""

import logging
import os
from typing import Optional

import requests

_TIMEOUT = 8


def _headers() -> dict:
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def _url() -> str:
    return f"{os.getenv('SUPABASE_URL', '').rstrip('/')}/rest/v1/satellite_artifacts"


def get_satellite_history(
    field_id: str,
    user_id: str,
    source: Optional[str] = None,
    limit: int = 50,
) -> list[dict]:
    """
    Retorna o histórico de imagens cacheadas para o talhão.

    Campos retornados:
      id, source, mode, scene_id, scene_date, cloud_coverage,
      generated_at, provider, bytes_size, image_path
    """
    try:
        params: dict = {
            "field_id": f"eq.{field_id}",
            "user_id": f"eq.{user_id}",
            "order": "scene_date.desc.nullsfirst,generated_at.desc",
            "limit": str(min(limit, 200)),
            "select": (
                "id,source,mode,scene_id,scene_date,cloud_coverage,"
                "generated_at,updated_at,provider,bytes_size,image_path"
            ),
        }
        if source:
            params["source"] = f"eq.{source}"

        resp = requests.get(_url(), headers=_headers(), params=params, timeout=_TIMEOUT)
        resp.raise_for_status()
        rows = resp.json()
        return rows if isinstance(rows, list) else []
    except Exception as e:
        logging.warning(
            "[satellite_history] get error field_id=%s: %s", field_id, e
        )
        return []


def save_satellite_artifact(
    user_id: str,
    field_id: str,
    source: str,
    mode: str,
    scene_id: str,
    scene_date: Optional[str],
    cloud_coverage: Optional[float],
    bbox_hash: str,
    image_path: str,
    provider: Optional[str] = None,
    plot_id: Optional[str] = None,
    farm_id: Optional[str] = None,
    bytes_size: Optional[int] = None,
) -> bool:
    """
    Upsert de artefato de satélite no histórico.
    Usa ON CONFLICT por cena + modo + bbox para NDVI/RGB/SAR coexistirem.
    """
    try:
        payload = {
            "user_id": user_id,
            "field_id": field_id,
            "source": source,
            "mode": mode,
            "scene_id": scene_id,
            "bbox_hash": bbox_hash,
            "image_path": image_path,
            "mime_type": "image/png",
        }
        if scene_date:
            payload["scene_date"] = scene_date
        if cloud_coverage is not None:
            payload["cloud_coverage"] = cloud_coverage
        if provider:
            payload["provider"] = provider
        if plot_id:
            payload["plot_id"] = plot_id
        if farm_id:
            payload["farm_id"] = farm_id
        if bytes_size:
            payload["bytes_size"] = bytes_size

        key = os.getenv("SUPABASE_SERVICE_KEY", "")
        headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        }
        conflicts = (
            "field_id,source,scene_id,mode,bbox_hash",
            "field_id,source,scene_id",
        )
        last_exc: Exception | None = None
        for conflict in conflicts:
            try:
                resp = requests.post(
                    _url(),
                    params={"on_conflict": conflict},
                    json=payload,
                    headers=headers,
                    timeout=_TIMEOUT,
                )
                resp.raise_for_status()
                return True
            except Exception as exc:
                last_exc = exc
                logging.warning(
                    "[satellite_history] save retry conflict=%s field_id=%s: %s",
                    conflict,
                    field_id,
                    exc,
                )
        if last_exc:
            raise last_exc
        return False
    except Exception as e:
        logging.warning("[satellite_history] save error field_id=%s: %s", field_id, e)
        return False
