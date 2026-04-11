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
PLANET_BASEMAP_URL = "https://api.planet.com/basemaps/v1"
PLANET_TILE_BASE_URL = os.getenv("PLANET_TILE_BASE_URL", "https://tiles.planet.com/data/v1")
_cache_lock = threading.Lock()
_scenes_cache: dict[str, dict[str, Any]] = {}
_tile_session_lock = threading.Lock()
_tile_sessions: dict[str, dict[str, Any]] = {}
_nicfi_cache_lock = threading.Lock()
_nicfi_mosaic_cache: dict[str, Any] = {"name": None, "expires_at": 0.0}
CACHE_TTL = 30 * 60
TILE_SESSION_TTL = 10 * 60
NICFI_CACHE_TTL = 60 * 60  # 1 hora

# Pixel transparente 1×1 PNG (fallback quando nenhum tile está disponível)
import base64 as _b64
_TRANSPARENT_PNG = _b64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQ"
    "AABjkB6QAAAABJRU5ErkJggg=="
)


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


def _get_nicfi_mosaic_name() -> str | None:
    """Retorna o nome do mosaic NICFI mais recente (cacheado por 1h)."""
    api_key = _get_api_key()
    if not api_key:
        return None

    with _nicfi_cache_lock:
        if _nicfi_mosaic_cache["name"] and time.time() < _nicfi_mosaic_cache["expires_at"]:
            return _nicfi_mosaic_cache["name"]

    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(
                f"{PLANET_BASEMAP_URL}/mosaics",
                params={"_page_size": 5, "name_contains": "medres_visual"},
                auth=(api_key, ""),
            )
            if resp.status_code != 200:
                logging.info("[Planet] NICFI mosaics: status %d (sem acesso)", resp.status_code)
                return None
            mosaics = resp.json().get("mosaics", [])
            if not mosaics:
                return None
            mosaics.sort(key=lambda m: m.get("name", ""), reverse=True)
            name = mosaics[0].get("name")
            with _nicfi_cache_lock:
                _nicfi_mosaic_cache["name"] = name
                _nicfi_mosaic_cache["expires_at"] = time.time() + NICFI_CACHE_TTL
            logging.info("[Planet] NICFI mosaic em cache: %s", name)
            return name
    except Exception as exc:
        logging.warning("[Planet] Erro ao buscar NICFI mosaic: %s", exc)
        return None


def get_planet_tile(scene_id: str, z: int, x: int, y: int) -> tuple[bytes, str]:
    """
    Retorna bytes do tile Planet em 3 camadas:
    1. Tile individual da cena (tiles.planet.com) — requer tile streaming
    2. Tile NICFI basemap (api.planet.com/basemaps) — gratuito para trópicos
    3. Pixel transparente 1×1 — fallback silencioso (sem banner de erro)
    """
    api_key = _get_api_key()
    if not api_key:
        return _TRANSPARENT_PNG, "image/png"

    # ── 1: tile individual da cena ────────────────────────────────────────────
    scene_url = f"{PLANET_TILE_BASE_URL}/PSScene/{scene_id}/{z}/{x}/{y}.png"
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(scene_url, params={"api_key": api_key})
            if resp.status_code == 200:
                logging.debug("[Planet] Scene tile OK scene=%s z=%s x=%s y=%s", scene_id, z, x, y)
                return resp.content, resp.headers.get("content-type", "image/png")
            logging.info("[Planet] Scene tile status=%s scene=%s z=%s x=%s y=%s", resp.status_code, scene_id, z, x, y)
    except Exception as exc:
        logging.warning("[Planet] Erro scene tile: %s", exc)

    # ── 2: NICFI basemap tile (gratuito para área tropical / Brasil) ──────────
    mosaic_name = _get_nicfi_mosaic_name()
    if mosaic_name:
        nicfi_url = f"{PLANET_BASEMAP_URL}/mosaics/{mosaic_name}/xyz/{z}/{x}/{y}.png"
        try:
            with httpx.Client(timeout=15.0) as client:
                resp = client.get(nicfi_url, params={"api_key": api_key})
                if resp.status_code == 200:
                    logging.debug("[Planet] NICFI tile OK mosaic=%s z=%s x=%s y=%s", mosaic_name, z, x, y)
                    return resp.content, resp.headers.get("content-type", "image/png")
                logging.info("[Planet] NICFI tile status=%s mosaic=%s z=%s x=%s y=%s", resp.status_code, mosaic_name, z, x, y)
        except Exception as exc:
            logging.warning("[Planet] Erro NICFI tile: %s", exc)

    # ── 3: pixel transparente (evita banner de erro, base map Esri fica visível)
    return _TRANSPARENT_PNG, "image/png"


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


def _convert_image_to_png(image_bytes: bytes) -> bytes | None:
    import io

    from PIL import Image

    try:
        image = Image.open(io.BytesIO(image_bytes))
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA")

        output = io.BytesIO()
        image.save(output, format="PNG")
        return output.getvalue()
    except Exception as exc:
        logging.warning("[Planet] Erro ao converter imagem para PNG: %s", exc)
        return None


def get_planet_overlay(
    field_id: str,
    scene_id: str,
    lat: float,
    lng: float,
    boundaries: list[list[float]] | None = None,
) -> dict[str, Any] | None:

    api_key = _get_api_key()
    if not api_key:
        return None

    bbox = get_bbox_from_boundaries(boundaries, lat, lng)
    min_lng_b, min_lat_b, max_lng_b, max_lat_b = bbox
    field_bounds = [min_lat_b, min_lng_b, max_lat_b, max_lng_b]

    def build_result(
        image_bytes: bytes,
        *,
        bounds: list[float] | None = None,
        asset_status: str | None = None,
        image_quality: str | None = None,
        content_type: str = "image/png",
    ) -> dict[str, Any]:
        return {
            "image_bytes": image_bytes,
            "bounds": bounds or field_bounds,
            "asset_status": asset_status,
            "image_quality": image_quality,
            "content_type": content_type,
        }

    try:
        with httpx.Client(timeout=20.0) as client:
            item_resp = client.get(
                f"{PLANET_BASE_URL}/item-types/PSScene/items/{scene_id}",
                auth=(api_key, ""),
            )
            item_resp.raise_for_status()
            item = item_resp.json()
    except Exception as exc:
        logging.warning("[Planet] Erro ao buscar item scene=%s: %s", scene_id, exc)
        return None

    geometry = item.get("geometry", {})
    coords = geometry.get("coordinates", [[]])[0]
    thumb_url = item.get("_links", {}).get("thumbnail")
    asset_activating = False

    # ── 1: COG partial read (alta qualidade) ────────────────────────────────
    for asset_type in ["ortho_visual", "visual"]:
        status, location = _activate_planet_asset(scene_id, asset_type, api_key)
        if status == "active" and location:
            cog_bytes = _read_cog_area(location, bbox, 1024)
            if cog_bytes:
                logging.info("[Planet] Overlay COG OK scene=%s field=%s", scene_id, field_id)
                return build_result(cog_bytes, image_quality="high")
        elif status == "activating":
            asset_activating = True

    # ── 2: Thumbnail recortado à área do talhão ─────────────────────────────
    if thumb_url:
        try:
            with httpx.Client(timeout=20.0) as client:
                thumb_resp = client.get(thumb_url, auth=(api_key, ""))
                thumb_resp.raise_for_status()
                thumb_bytes = thumb_resp.content
                thumb_content_type = thumb_resp.headers.get("content-type", "image/jpeg")
        except Exception as exc:
            logging.warning("[Planet] Erro ao buscar thumbnail scene=%s: %s", scene_id, exc)
            thumb_bytes = None
            thumb_content_type = "image/jpeg"

        if thumb_bytes:
            if coords and len(coords) >= 3:
                cropped = _crop_thumbnail_to_field(thumb_bytes, geometry, bbox)
                if cropped:
                    logging.info(
                        "[Planet] Overlay thumbnail recortado OK scene=%s field=%s activating=%s",
                        scene_id,
                        field_id,
                        asset_activating,
                    )
                    return build_result(
                        cropped,
                        asset_status="activating" if asset_activating else None,
                        image_quality="preview",
                    )

            scene_bounds = field_bounds
            if coords and len(coords) >= 3:
                scene_lats = [c[1] for c in coords]
                scene_lngs = [c[0] for c in coords]
                scene_bounds = [min(scene_lats), min(scene_lngs), max(scene_lats), max(scene_lngs)]

            png_bytes = _convert_image_to_png(thumb_bytes)
            if png_bytes:
                logging.info("[Planet] Overlay thumbnail bruto convertido em PNG scene=%s field=%s", scene_id, field_id)
                return build_result(
                    png_bytes,
                    bounds=scene_bounds,
                    asset_status="activating" if asset_activating else None,
                    image_quality="preview",
                )

            logging.warning("[Planet] Fallback para thumbnail sem conversão scene=%s field=%s", scene_id, field_id)
            return build_result(
                thumb_bytes,
                bounds=scene_bounds,
                asset_status="activating" if asset_activating else None,
                image_quality="preview",
                content_type=thumb_content_type,
            )

    logging.error("[Planet] Overlay indisponível scene=%s field=%s", scene_id, field_id)
    return None


def _activate_planet_asset(scene_id: str, asset_type: str, api_key: str) -> tuple[str, str | None]:
    """
    Verifica / ativa um asset PSScene.
    Retorna (status, location):
      - status: 'active' | 'activating' | 'unavailable'
      - location: URL de download quando status == 'active', None caso contrário
    """
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.get(
                f"{PLANET_BASE_URL}/item-types/PSScene/items/{scene_id}/assets",
                auth=(api_key, ""),
            )
            resp.raise_for_status()
            assets = resp.json()

            asset = assets.get(asset_type, {})
            status = asset.get("status", "unavailable")

            if status == "active":
                return "active", asset.get("location")

            if status == "inactive":
                activate_url = asset.get("_links", {}).get("activate")
                if activate_url:
                    act_resp = client.post(activate_url, auth=(api_key, ""))
                    if act_resp.status_code in (202, 204):
                        logging.info("[Planet] Asset %s/%s ativação disparada", scene_id, asset_type)
                        return "activating", None

            return status or "unavailable", None
    except Exception as exc:
        logging.warning("[Planet] Erro ao ativar asset %s/%s: %s", scene_id, asset_type, exc)
        return "unavailable", None


def _read_cog_area(cog_url: str, bbox: list[float], target_size: int = 1024) -> bytes | None:
    """
    Lê apenas a área do talhão de um COG (Cloud-Optimized GeoTIFF) via HTTP Range requests.
    Requer rasterio instalado. Retorna PNG bytes ou None em caso de falha.
    """
    try:
        import io as _io

        import numpy as np
        import rasterio
        from PIL import Image
        from rasterio.crs import CRS
        from rasterio.enums import Resampling
        from rasterio.warp import transform_bounds
        from rasterio.windows import from_bounds

        min_lng, min_lat, max_lng, max_lat = bbox

        with rasterio.open(cog_url) as src:
            # Reprojetar bbox WGS84 → CRS da imagem se necessário
            if src.crs and not src.crs.is_geographic:
                dst_bounds = transform_bounds(
                    CRS.from_epsg(4326), src.crs,
                    min_lng, min_lat, max_lng, max_lat,
                )
            else:
                dst_bounds = (min_lng, min_lat, max_lng, max_lat)

            window = from_bounds(*dst_bounds, src.transform)
            w = max(1, int(window.width))
            h = max(1, int(window.height))
            scale = min(target_size / w, target_size / h)
            out_w = min(target_size, max(1, int(w * scale)))
            out_h = min(target_size, max(1, int(h * scale)))

            bands = min(src.count, 3)
            data = src.read(
                list(range(1, bands + 1)),
                window=window,
                out_shape=(bands, out_h, out_w),
                resampling=Resampling.bilinear,
            )

            # Normalizar para uint8
            if data.dtype == np.uint16:
                data = (data / 65535.0 * 255).astype(np.uint8)
            elif data.dtype != np.uint8:
                dmin, dmax = float(data.min()), float(data.max())
                if dmax > dmin:
                    data = ((data - dmin) / (dmax - dmin) * 255).astype(np.uint8)
                else:
                    data = np.zeros_like(data, dtype=np.uint8)

            if bands >= 3:
                arr = data.transpose(1, 2, 0)[:, :, :3]
            else:
                arr = np.stack([data[0]] * 3, axis=2)

            img = Image.fromarray(arr, "RGB")
            out = _io.BytesIO()
            img.save(out, format="PNG")
            logging.info("[Planet] COG field read OK: %dx%d px bbox=%s", img.width, img.height, bbox)
            return out.getvalue()

    except ImportError:
        logging.warning("[Planet] rasterio não instalado — COG read indisponível")
        return None
    except Exception as exc:
        logging.warning("[Planet] Erro COG read bbox=%s: %s", bbox, exc)
        return None
