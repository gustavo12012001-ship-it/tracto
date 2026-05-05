import asyncio
import math
import time
from typing import Any

import httpx

_NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
_CACHE_TTL_SECONDS = 600
_PLACES_CACHE_TTL = 300  # 5 min for places results
_places_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}

_NOMINATIM_HEADERS = {
    "User-Agent": "Tracto AgTech/1.0 (tracto@tracto.app)",
    "Accept-Language": "pt-BR,pt;q=0.9",
}

_geo_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_last_external_call_ts = 0.0


class GeoProviderError(Exception):
    def __init__(self, message: str, provider_status: int | None = None):
        super().__init__(message)
        self.provider_status = provider_status


def _parse_bbox(raw_bbox: list[str] | None) -> list[float] | None:
    if not raw_bbox or len(raw_bbox) != 4:
        return None

    try:
        south = float(raw_bbox[0])
        north = float(raw_bbox[1])
        west = float(raw_bbox[2])
        east = float(raw_bbox[3])
    except (TypeError, ValueError):
        return None

    return [south, north, west, east]


async def search_location(query: str) -> dict[str, Any] | None:
    global _last_external_call_ts

    normalized = query.strip()
    if len(normalized) < 2:
        return None

    cache_key = normalized.lower()
    now = time.time()
    cached = _geo_cache.get(cache_key)
    if cached and (now - cached[0]) <= _CACHE_TTL_SECONDS:
        return cached[1]

    elapsed = now - _last_external_call_ts
    if elapsed < 1.0:
        await asyncio.sleep(1.0 - elapsed)

    headers = {
        "User-Agent": "Tracto AgTech/1.0 (tracto@tracto.app)",
        "Accept-Language": "pt-BR",
    }
    params = {
        "q": normalized,
        "format": "json",
        "limit": "1",
        "countrycodes": "br",
    }

    try:
        async with httpx.AsyncClient(timeout=5.0, headers=headers) as client:
            response = await client.get(_NOMINATIM_URL, params=params)
            response.raise_for_status()
            results = response.json()
        _last_external_call_ts = time.time()
    except httpx.TimeoutException as exc:
        raise GeoProviderError("Timeout ao consultar Nominatim.") from exc
    except httpx.HTTPStatusError as exc:
        status_code = exc.response.status_code if exc.response is not None else None
        raise GeoProviderError("Erro HTTP retornado pelo Nominatim.", provider_status=status_code) from exc
    except httpx.RequestError as exc:
        raise GeoProviderError("Falha de rede ao consultar Nominatim.") from exc
    except Exception as exc:
        raise GeoProviderError("Erro inesperado ao consultar Nominatim.") from exc

    if not isinstance(results, list) or not results:
        return None

    top = results[0]
    payload = {
        "name": str(top.get("display_name") or normalized),
        "lat": float(top.get("lat")),
        "lng": float(top.get("lon")),
        "bbox": _parse_bbox(top.get("boundingbox")),
    }

    _geo_cache[cache_key] = (time.time(), payload)
    return payload


# ── Haversine ─────────────────────────────────────────────────────────────────
def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = math.sin(d_lat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ── Places nearby search ───────────────────────────────────────────────────────
async def search_places_nearby(
    query: str,
    lat: float,
    lng: float,
    radius_km: float = 15.0,
) -> list[dict[str, Any]]:
    """Search for places near a coordinate using Nominatim (server-side, no CORS)."""
    cache_key = f"{query.lower().strip()}_{lat:.3f}_{lng:.3f}_{radius_km}"
    now = time.time()
    cached = _places_cache.get(cache_key)
    if cached and (now - cached[0]) <= _PLACES_CACHE_TTL:
        return cached[1]

    # Build bounding box from radius (approx: 1 deg lat ≈ 111 km)
    d_lat = radius_km / 111.0
    d_lng = radius_km / (111.0 * math.cos(math.radians(lat)))
    viewbox = f"{lng - d_lng},{lat + d_lat},{lng + d_lng},{lat - d_lat}"

    params = {
        "q": query.strip(),
        "format": "json",
        "viewbox": viewbox,
        "bounded": "1",
        "limit": "40",
        "addressdetails": "1",
        "extratags": "1",
        "countrycodes": "br",
    }

    try:
        async with httpx.AsyncClient(timeout=20.0, headers=_NOMINATIM_HEADERS) as client:
            resp = await client.get(_NOMINATIM_URL, params=params)
            resp.raise_for_status()
            items: list[dict] = resp.json()
    except httpx.TimeoutException as exc:
        raise GeoProviderError("Timeout ao buscar lugares.") from exc
    except httpx.HTTPStatusError as exc:
        status_code = exc.response.status_code if exc.response is not None else None
        raise GeoProviderError("Erro HTTP do Nominatim.", provider_status=status_code) from exc
    except httpx.RequestError as exc:
        raise GeoProviderError("Falha de rede ao buscar lugares.") from exc

    seen: set[str] = set()
    results: list[dict[str, Any]] = []

    for item in items:
        name: str = item.get("name") or ""
        if not name.strip():
            # Try first segment of display_name
            display = item.get("display_name", "")
            name = display.split(",")[0].strip() if display else ""
        if not name.strip():
            continue

        el_lat = float(item.get("lat", 0))
        el_lng = float(item.get("lon", 0))
        if not el_lat or not el_lng:
            continue

        dedup_key = f"{name.lower()[:20]}_{el_lat:.3f}"
        if dedup_key in seen:
            continue
        seen.add(dedup_key)

        addr = item.get("address", {})
        address_parts = [
            addr.get("road"),
            addr.get("house_number"),
            addr.get("city") or addr.get("town") or addr.get("village") or addr.get("municipality"),
        ]
        address = ", ".join(p for p in address_parts if p) or None

        extra = item.get("extratags", {}) or {}
        phone = extra.get("phone") or extra.get("contact:phone") or None
        website = extra.get("website") or extra.get("contact:website") or None
        opening_hours = extra.get("opening_hours") or None

        results.append({
            "id": item.get("place_id", 0),
            "name": name,
            "type": (item.get("type") or item.get("class") or "").replace("_", " "),
            "address": address,
            "lat": el_lat,
            "lng": el_lng,
            "distance_km": round(_haversine_km(lat, lng, el_lat, el_lng), 2),
            "phone": phone,
            "website": website,
            "opening_hours": opening_hours,
        })

    results.sort(key=lambda r: r["distance_km"])
    _places_cache[cache_key] = (time.time(), results)
    return results
