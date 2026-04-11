"""
tracto-backend/services/planet_service.py
Integração com Planet Labs Data API — imagens PlanetScope de alta resolução
"""

import logging
import os
import secrets
import threading
import time
from datetime import datetime, timedelta
from typing import Any

import httpx

PLANET_BASE_URL = os.getenv("PLANET_BASE_URL", "https://api.planet.com/data/v1")
PLANET_TILE_BASE_URL = os.getenv("PLANET_TILE_BASE_URL", "https://tiles.planet.com/data/v1")
_cache_lock = threading.Lock()
_scenes_cache: dict[str, dict[str, Any]] = {}
_tile_session_lock = threading.Lock()
_tile_sessions: dict[str, dict[str, Any]] = {}
CACHE_TTL = 30 * 60
TILE_SESSION_TTL = 10 * 60


def _get_api_key() -> str | None:
    key = os.getenv("PLANET_API_KEY")
    if not key:
        logging.error("[Planet] PLANET_API_KEY não configurada.")
    return key


def _purge_expired_tile_sessions() -> None:
    now = time.time()
    expired_tokens = [token for token, data in _tile_sessions.items() if now >= data["expires_at"]]
    for token in expired_tokens:
        _tile_sessions.pop(token, None)


def create_planet_tile_session(user_id: str, field_id: str, scene_id: str) -> str:
    token = secrets.token_urlsafe(32)
    with _tile_session_lock:
        _purge_expired_tile_sessions()
        _tile_sessions[token] = {
            "user_id": user_id,
            "field_id": field_id,
            "scene_id": scene_id,
            "expires_at": time.time() + TILE_SESSION_TTL,
        }
    return token


def validate_planet_tile_session(token: str | None, scene_id: str) -> bool:
    return get_planet_tile_session_status(token, scene_id) == "ok"


def get_planet_tile_session_status(token: str | None, scene_id: str) -> str:
    if not token:
        return "missing"

    with _tile_session_lock:
        session = _tile_sessions.get(token)
        if not session:
            return "invalid"

        if time.time() >= session.get("expires_at", 0):
            _tile_sessions.pop(token, None)
            return "expired"

        if session.get("scene_id") != scene_id:
            return "scene_mismatch"

        return "ok"


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


def get_planet_tile(scene_id: str, z: int, x: int, y: int) -> tuple[bytes, str]:
    api_key = _get_api_key()
    if not api_key:
        raise RuntimeError("PLANET_API_KEY não configurada.")

    url = f"{PLANET_TILE_BASE_URL}/PSScene/{scene_id}/{z}/{x}/{y}.png"

    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.get(url, params={"api_key": api_key})
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "image/png")
            return resp.content, content_type
    except httpx.HTTPStatusError as exc:
        status = exc.response.status_code if exc.response is not None else "unknown"
        logging.warning("[Planet] Erro tile scene_id=%s z=%s x=%s y=%s status=%s", scene_id, z, x, y, status)
        raise
    except httpx.TimeoutException as exc:
        logging.warning("[Planet] Timeout tile scene_id=%s z=%s x=%s y=%s: %s", scene_id, z, x, y, exc)
        raise


def get_bbox_from_boundaries(boundaries, lat, lng):
    if not boundaries or len(boundaries) < 3:
        return [lng - 0.01, lat - 0.01, lng + 0.01, lat + 0.01]

    lats = [float(p[0]) for p in boundaries if p and len(p) >= 2]
    lngs = [float(p[1]) for p in boundaries if p and len(p) >= 2]
    margin = 0.001
    return [min(lngs) - margin, min(lats) - margin, max(lngs) + margin, max(lats) + margin]


def _try_nicfi_tiles(
    api_key: str,
    zoom: int,
    tile_x: int,
    tile_y: int,
) -> list[tuple[int, int, bytes]]:
    """Tenta obter tiles do NICFI basemap da Planet (disponível gratuitamente para área tropical)."""
    tiles: list[tuple[int, int, bytes]] = []
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(
                "https://api.planet.com/basemaps/v1/mosaics",
                params={"_page_size": 5, "name_contains": "medres_visual"},
                auth=(api_key, ""),
            )
            if resp.status_code != 200:
                logging.info("[Planet] Basemaps API: status %d (sem acesso NICFI)", resp.status_code)
                return tiles
            mosaics = resp.json().get("mosaics", [])
            if not mosaics:
                logging.info("[Planet] Nenhum mosaic NICFI disponível nesta conta.")
                return tiles
            mosaics.sort(key=lambda m: m.get("name", ""), reverse=True)
            mosaic_name = mosaics[0].get("name")
            logging.info("[Planet] Usando NICFI mosaic: %s", mosaic_name)

        with httpx.Client(timeout=30.0) as client:
            for dx in range(-1, 2):
                for dy in range(-1, 2):
                    url = (
                        f"https://tiles.planet.com/basemaps/v1/planet-tiles"
                        f"/{mosaic_name}/gmap/{zoom}/{tile_x + dx}/{tile_y + dy}.png"
                        f"?api_key={api_key}"
                    )
                    r = client.get(url)
                    if r.status_code == 200:
                        tiles.append((dx, dy, r.content))

        logging.info("[Planet] NICFI tiles obtidos: %d/9", len(tiles))
    except Exception as exc:
        logging.warning("[Planet] Erro NICFI tiles: %s", exc)
    return tiles


def _crop_thumbnail_to_field(
    thumb_bytes: bytes,
    scene_geometry: dict,
    field_bbox: list[float],
) -> bytes | None:
    """
    Recorta o thumbnail da cena para mostrar apenas a área do talhão.
    Usa a geometria real da cena (do Planet API) para calcular as coordenadas de pixel corretas.
    """
    import io

    from PIL import Image

    try:
        coords = scene_geometry.get("coordinates", [[]])[0]
        if not coords or len(coords) < 3:
            logging.warning("[Planet] Geometria da cena inválida para recorte.")
            return None

        scene_lngs = [c[0] for c in coords]
        scene_lats = [c[1] for c in coords]
        s_min_lng, s_max_lng = min(scene_lngs), max(scene_lngs)
        s_min_lat, s_max_lat = min(scene_lats), max(scene_lats)
        s_lng_span = s_max_lng - s_min_lng
        s_lat_span = s_max_lat - s_min_lat

        if s_lng_span <= 0 or s_lat_span <= 0:
            return None

        f_min_lng, f_min_lat, f_max_lng, f_max_lat = field_bbox
        # Margem de 60% da extensão do talhão para dar contexto ao redor
        margin_lng = (f_max_lng - f_min_lng) * 0.6
        margin_lat = (f_max_lat - f_min_lat) * 0.6
        c_min_lng = max(s_min_lng, f_min_lng - margin_lng)
        c_max_lng = min(s_max_lng, f_max_lng + margin_lng)
        c_min_lat = max(s_min_lat, f_min_lat - margin_lat)
        c_max_lat = min(s_max_lat, f_max_lat + margin_lat)

        img = Image.open(io.BytesIO(thumb_bytes))
        w, h = img.size

        # Pixel coords (eixo Y invertido: lat alta = Y pequeno)
        x1 = int((c_min_lng - s_min_lng) / s_lng_span * w)
        x2 = int((c_max_lng - s_min_lng) / s_lng_span * w)
        y1 = int((s_max_lat - c_max_lat) / s_lat_span * h)
        y2 = int((s_max_lat - c_min_lat) / s_lat_span * h)

        x1, x2 = max(0, x1), min(w, x2)
        y1, y2 = max(0, y1), min(h, y2)

        if x2 <= x1 or y2 <= y1:
            logging.warning("[Planet] Recorte resultou em área vazia (%d,%d,%d,%d).", x1, y1, x2, y2)
            return None

        cropped = img.crop((x1, y1, x2, y2))

        # Upscale para no mínimo 512px no menor lado para ter resolução utilizável
        min_side = min(cropped.width, cropped.height)
        if min_side < 512:
            scale = 512 / min_side
            new_w = int(cropped.width * scale)
            new_h = int(cropped.height * scale)
            cropped = cropped.resize((new_w, new_h), Image.LANCZOS)

        output = io.BytesIO()
        cropped.save(output, format="PNG")
        logging.info(
            "[Planet] Thumbnail recortado OK: %.4f,%.4f → %.4f,%.4f (%dx%d px)",
            c_min_lng, c_min_lat, c_max_lng, c_max_lat, cropped.width, cropped.height,
        )
        return output.getvalue()

    except Exception as exc:
        logging.warning("[Planet] Erro ao recortar thumbnail: %s", exc)
        return None


def get_planet_overlay(
    field_id: str,
    scene_id: str,
    lat: float,
    lng: float,
    boundaries: list[list[float]] | None = None,
) -> bytes | None:
    import io
    import math

    from PIL import Image

    api_key = _get_api_key()
    if not api_key:
        return None

    bbox = get_bbox_from_boundaries(boundaries, lat, lng)

    def lat_lng_to_tile(tile_lat: float, tile_lng: float, zoom: int) -> tuple[int, int]:
        n = 2 ** zoom
        x = int((tile_lng + 180) / 360 * n)
        y = int(
            (1 - math.log(math.tan(math.radians(tile_lat)) + 1 / math.cos(math.radians(tile_lat))) / math.pi)
            / 2 * n
        )
        return x, y

    def composite_tiles(tiles: list[tuple[int, int, bytes]]) -> bytes:
        size = 256
        comp = Image.new("RGBA", (size * 3, size * 3))
        for dx, dy, content in tiles:
            comp.paste(Image.open(io.BytesIO(content)), ((dx + 1) * size, (dy + 1) * size))
        out = io.BytesIO()
        comp.save(out, format="PNG")
        return out.getvalue()

    zoom = 15
    min_lng, min_lat, max_lng, max_lat = bbox
    center_lat = (min_lat + max_lat) / 2
    center_lng = (min_lng + max_lng) / 2
    tile_x, tile_y = lat_lng_to_tile(center_lat, center_lng, zoom)

    # ── 1: tiles individuais da cena (requer tile streaming premium) ──────────
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
        logging.info("[Planet] Scene tiles status: %s (scene=%s)", status_codes, scene_id)
        if tiles:
            logging.info("[Planet] Overlay scene tiles OK: %d/9", len(tiles))
            return composite_tiles(tiles)
    except Exception as exc:
        logging.warning("[Planet] Erro scene tiles: %s", exc)

    # ── 2: NICFI basemap tiles (gratuito para área tropical / Brasil) ─────────
    try:
        nicfi_tiles = _try_nicfi_tiles(api_key, zoom, tile_x, tile_y)
        if nicfi_tiles:
            logging.info("[Planet] Overlay NICFI tiles OK: %d/9", len(nicfi_tiles))
            return composite_tiles(nicfi_tiles)
    except Exception as exc:
        logging.warning("[Planet] Erro NICFI: %s", exc)

    # ── 3: thumbnail recortado geograficamente à área do talhão ──────────────
    try:
        with httpx.Client(timeout=30.0) as client:
            item_resp = client.get(
                f"{PLANET_BASE_URL}/item-types/PSScene/items/{scene_id}",
                auth=(api_key, ""),
            )
            item_resp.raise_for_status()
            item = item_resp.json()
            scene_geometry = item.get("geometry", {})
            thumb_url = item.get("_links", {}).get("thumbnail")

            if thumb_url:
                thumb_resp = client.get(thumb_url, auth=(api_key, ""))
                thumb_resp.raise_for_status()
                thumb_bytes = thumb_resp.content

                if scene_geometry:
                    cropped = _crop_thumbnail_to_field(thumb_bytes, scene_geometry, bbox)
                    if cropped:
                        return cropped

                # Fallback final: thumbnail bruto (última opção)
                logging.warning("[Planet] Retornando thumbnail bruto sem recorte geográfico.")
                return thumb_bytes
    except Exception as exc:
        logging.warning("[Planet] Erro thumbnail/recorte: %s", exc)

    logging.error("[Planet] Overlay completamente indisponível scene=%s field=%s", scene_id, field_id)
    return None
