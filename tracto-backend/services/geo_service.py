import os
import time
from typing import Any

import httpx

_NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
_CACHE_TTL_SECONDS = 600

_geo_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_last_external_call_ts = 0.0


class GeoNotFoundError(Exception):
    pass


class GeoProviderError(Exception):
    def __init__(self, message: str, provider_status: int | None = None):
        super().__init__(message)
        self.provider_status = provider_status


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


def search_location(query: str) -> dict[str, Any]:
    global _last_external_call_ts

    normalized = query.strip()
    if len(normalized) < 3:
        raise GeoNotFoundError("Consulta muito curta para busca geografica.")

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
    except httpx.TimeoutException as exc:
        raise GeoProviderError("Timeout ao consultar provedor de localizacao.") from exc
    except httpx.HTTPStatusError as exc:
        status_code = exc.response.status_code if exc.response is not None else None
        raise GeoProviderError("Erro HTTP retornado pelo provedor de localizacao.", provider_status=status_code) from exc
    except httpx.RequestError as exc:
        raise GeoProviderError("Falha de rede ao consultar provedor de localizacao.") from exc
    except Exception as exc:
        raise GeoProviderError("Erro inesperado ao consultar provedor de localizacao.") from exc

    if not results:
        raise GeoNotFoundError("Local nao encontrado para a busca informada.")

    top = results[0]
    payload = {
        "name": top.get("display_name", normalized),
        "lat": float(top.get("lat")),
        "lng": float(top.get("lon")),
        "bbox": _parse_bbox(top.get("boundingbox")),
    }

    _geo_cache[cache_key] = (time.time(), payload)
    return payload
