import asyncio
import time
from typing import Any

import httpx

_NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
_CACHE_TTL_SECONDS = 600

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
