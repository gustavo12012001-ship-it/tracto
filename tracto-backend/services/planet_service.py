"""
tracto-backend/services/planet_service.py
Integração com Planet Labs Data API — imagens PlanetScope de alta resolução
"""

import logging
import os
import threading
import time
from datetime import datetime, timedelta
from typing import Any

import httpx

PLANET_BASE_URL = "https://api.planet.com/data/v1"
_cache_lock = threading.Lock()
_scenes_cache: dict[str, dict[str, Any]] = {}
CACHE_TTL = 30 * 60


def _get_api_key() -> str | None:
    key = os.getenv("PLANET_API_KEY")
    if not key:
        logging.error("[Planet] PLANET_API_KEY não configurada.")
    return key


def get_planet_scenes(
    lat: float,
    lng: float,
    boundaries: list[list[float]] | None = None,
    lookback_days: int = 30,
    max_results: int = 5,
) -> list[dict]:
    api_key = _get_api_key()
    if not api_key:
        return []

    cache_key = f"{lat:.4f}_{lng:.4f}_{lookback_days}"
    with _cache_lock:
        entry = _scenes_cache.get(cache_key)
        if entry and time.time() < entry["expires_at"]:
            return entry["scenes"]

    now = datetime.utcnow()
    from_dt = (now - timedelta(days=lookback_days)).strftime("%Y-%m-%dT00:00:00Z")
    to_dt = now.strftime("%Y-%m-%dT23:59:59Z")

    if boundaries and len(boundaries) >= 3:
        coords = [[float(p[1]), float(p[0])] for p in boundaries if len(p) >= 2]
        if coords[0] != coords[-1]:
            coords.append(coords[0])
        geometry = {"type": "Polygon", "coordinates": [coords]}
    else:
        geometry = {"type": "Point", "coordinates": [float(lng), float(lat)]}

    search_payload = {
        "item_types": ["PSScene"],
        "filter": {
            "type": "AndFilter",
            "config": [
                {"type": "GeometryFilter", "field_name": "geometry", "config": geometry},
                {"type": "DateRangeFilter", "field_name": "acquired", "config": {"gte": from_dt, "lte": to_dt}},
                {"type": "RangeFilter", "field_name": "cloud_cover", "config": {"lte": 0.8}},
                {"type": "StringInFilter", "field_name": "item_type", "config": ["PSScene"]},
            ],
        },
    }

    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.post(
                f"{PLANET_BASE_URL}/quick-search?_page_size={max_results}",
                json=search_payload,
                auth=(api_key, ""),
            )
            resp.raise_for_status()
            features = resp.json().get("features", [])

        scenes = []
        for feat in features:
            props = feat.get("properties", {})
            acquired = props.get("acquired", "")
            date_iso, date_br = None, None
            if acquired:
                try:
                    dt = datetime.fromisoformat(acquired.replace("Z", "+00:00"))
                    date_iso = dt.date().isoformat()
                    date_br = dt.strftime("%d/%m/%Y")
                except Exception:
                    pass
            cloud = props.get("cloud_cover")
            scenes.append({
                "scene_id": feat.get("id"),
                "date": date_iso,
                "date_br": date_br,
                "cloud_coverage": round(float(cloud) * 100, 1) if cloud is not None else None,
                "source": "planet",
                "item_type": "PSScene",
                "thumbnail_url": feat.get("_links", {}).get("thumbnail"),
            })

        with _cache_lock:
            _scenes_cache[cache_key] = {"scenes": scenes, "expires_at": time.time() + CACHE_TTL}

        logging.info("[Planet] Cenas encontradas: %d", len(scenes))
        return scenes

    except Exception as exc:
        logging.warning("[Planet] Erro ao buscar cenas: %s", exc)
        return []


def get_planet_thumbnail(scene_id: str) -> bytes | None:
    api_key = _get_api_key()
    if not api_key:
        return None
    try:
        with httpx.Client(timeout=30.0) as client:
            resp = client.get(
                f"{PLANET_BASE_URL}/item-types/PSScene/items/{scene_id}/thumb",
                auth=(api_key, ""),
            )
            resp.raise_for_status()
            return resp.content
    except Exception as exc:
        logging.warning("[Planet] Erro ao buscar thumbnail scene_id=%s: %s", scene_id, exc)
        return None
