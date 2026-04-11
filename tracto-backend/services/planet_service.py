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
            assets_resp = client.get(
                f"{PLANET_BASE_URL}/item-types/PSScene/items/{scene_id}/assets",
                auth=(api_key, ""),
            )
            assets_resp.raise_for_status()
            assets = assets_resp.json()

            for asset_type in ["ortho_visual", "visual", "ortho_analytic_4b"]:
                asset = assets.get(asset_type)
                if asset and asset.get("status") == "active":
                    location = asset.get("location")
                    if location:
                        img_resp = client.get(location, auth=(api_key, ""))
                        img_resp.raise_for_status()
                        return img_resp.content

            thumb_resp = client.get(
                f"{PLANET_BASE_URL}/item-types/PSScene/items/{scene_id}",
                auth=(api_key, ""),
            )
            thumb_resp.raise_for_status()
            item = thumb_resp.json()
            thumb_url = item.get("_links", {}).get("thumbnail")
            if thumb_url:
                tr = client.get(thumb_url, auth=(api_key, ""))
                tr.raise_for_status()
                return tr.content

        return None
    except Exception as exc:
        logging.warning("[Planet] Erro ao buscar thumbnail scene_id=%s: %s", scene_id, exc)
        return None


def get_bbox_from_boundaries(boundaries, lat, lng):
    if not boundaries or len(boundaries) < 3:
        return [lng - 0.01, lat - 0.01, lng + 0.01, lat + 0.01]

    lats = [float(p[0]) for p in boundaries if p and len(p) >= 2]
    lngs = [float(p[1]) for p in boundaries if p and len(p) >= 2]
    margin = 0.001
    return [min(lngs) - margin, min(lats) - margin, max(lngs) + margin, max(lats) + margin]


def get_planet_overlay(
    field_id: str,
    scene_id: str,
    lat: float,
    lng: float,
    boundaries: list[list[float]] | None = None,
) -> bytes | None:
    api_key = _get_api_key()
    if not api_key:
        return None

    import io
    import math

    from PIL import Image

    bbox = get_bbox_from_boundaries(boundaries, lat, lng)

    def lat_lng_to_tile(tile_lat: float, tile_lng: float, zoom: int) -> tuple[int, int]:
        n = 2 ** zoom
        x = int((tile_lng + 180) / 360 * n)
        y = int(
            (1 - math.log(math.tan(math.radians(tile_lat)) + 1 / math.cos(math.radians(tile_lat))) / math.pi)
            / 2 * n
        )
        return x, y

    zoom = 15
    min_lng, min_lat, max_lng, max_lat = bbox
    center_lat = (min_lat + max_lat) / 2
    center_lng = (min_lng + max_lng) / 2
    tile_x, tile_y = lat_lng_to_tile(center_lat, center_lng, zoom)

    # ── Tentativa 1: tiles XYZ ────────────────────────────────────────────────
    try:
        tiles: list[tuple[int, int, bytes]] = []
        status_codes: list[int] = []
        with httpx.Client(timeout=30.0) as client:
            for dx in range(-1, 2):
                for dy in range(-1, 2):
                    url = (
                        f"https://tiles.planet.com/data/v1/PSScene/{scene_id}"
                        f"/{zoom}/{tile_x + dx}/{tile_y + dy}.png?api_key={api_key}"
                    )
                    resp = client.get(url)
                    status_codes.append(resp.status_code)
                    if resp.status_code == 200:
                        tiles.append((dx, dy, resp.content))

        logging.info("[Planet] Tiles status: %s (scene=%s)", status_codes, scene_id)

        if tiles:
            size = 256
            composite = Image.new("RGBA", (size * 3, size * 3))
            for dx, dy, content in tiles:
                tile_img = Image.open(io.BytesIO(content))
                composite.paste(tile_img, ((dx + 1) * size, (dy + 1) * size))
            output = io.BytesIO()
            composite.save(output, format="PNG")
            logging.info("[Planet] Overlay por tiles OK: %d/%d tiles", len(tiles), 9)
            return output.getvalue()

        logging.warning(
            "[Planet] Nenhum tile disponível (status=%s). Tentando thumbnail como fallback.", status_codes
        )
    except Exception as exc:
        logging.warning("[Planet] Erro ao buscar tiles scene=%s: %s", scene_id, exc)

    # ── Tentativa 2: thumbnail da cena (funciona em qualquer plano) ───────────
    try:
        thumb_bytes = get_planet_thumbnail(scene_id)
        if thumb_bytes:
            logging.info("[Planet] Overlay via thumbnail fallback scene=%s", scene_id)
            return thumb_bytes
    except Exception as exc:
        logging.warning("[Planet] Thumbnail fallback falhou scene=%s: %s", scene_id, exc)

    logging.error("[Planet] Overlay completamente indisponível scene=%s field=%s", scene_id, field_id)
    return None
