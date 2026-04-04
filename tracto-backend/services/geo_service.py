import os
import time
from typing import Any

import httpx

_NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
_CACHE_TTL_SECONDS = 600

_geo_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_last_external_call_ts = 0.0


def _parse_bbox(raw_bbox: list[str] | None) -> dict[str, float] | None:
    if not raw_bbox or len(raw_bbox) != 4:
        return None

    try:
        south = float(raw_bbox[0])
        north = float(raw_bbox[1])
        west = float(raw_bbox[2])
        east = float(raw_bbox[3])
    except (TypeError, ValueError):
        return None

    return {
        "south": min(south, north),
        "north": max(south, north),
        "west": min(west, east),
        "east": max(west, east),
    }


def search_location(query: str) -> dict[str, Any] | None:
    global _last_external_call_ts

    normalized = query.strip()
    if len(normalized) < 3:
        return None

    cache_key = normalized.lower()
    now = time.time()

    cached = _geo_cache.get(cache_key)
    if cached and (now - cached[0]) <= _CACHE_TTL_SECONDS:
        return cached[1]

    # Nominatim policy: max 1 request/second.
    elapsed = now - _last_external_call_ts
    if elapsed < 1.0:
        time.sleep(1.0 - elapsed)

    user_agent = os.getenv("GEO_USER_AGENT", "Tracto AgTech App/1.0 (gustavo@email.com)")
    headers = {
        "User-Agent": user_agent,
        "Referer": "https://tracto-eta.vercel.app",
    }

    def _run_search(extra_params: dict[str, str]) -> list[dict[str, Any]]:
        params = {
            "q": normalized,
            "format": "jsonv2",
            "limit": "1",
            "addressdetails": "1",
            "countrycodes": "br",
        }
        params.update(extra_params)

        with httpx.Client(timeout=5.0, headers=headers) as client:
            response = client.get(_NOMINATIM_URL, params=params)
            response.raise_for_status()
            return response.json()

    try:
        results = _run_search({"featureType": "city"})
        if not results:
            results = _run_search({})
        _last_external_call_ts = time.time()
    except Exception:
        return None

    if not results:
        return None

    top = results[0]
    payload = {
        "name": top.get("display_name", normalized),
        "lat": float(top.get("lat")),
        "lng": float(top.get("lon")),
        "bbox": _parse_bbox(top.get("boundingbox")),
    }

    _geo_cache[cache_key] = (time.time(), payload)
    return payload
