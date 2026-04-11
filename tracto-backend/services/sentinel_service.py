"""
tracto-backend/services/sentinel_service.py — Versão 4.1
Correção: indentação do bloco S1, evalscript S1 com 4 bandas RGBA, sem maxCloudCoverage no S1
"""

import base64
import hashlib
import io
import json
import logging
import os
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

import httpx
from PIL import Image

from services import supabase_service

# ── Configurações ───────────────────────────────────────────────────────────
SENTINEL_CACHE_TTL_HOURS = float(os.getenv("SENTINEL_CACHE_TTL_HOURS", "24"))  # Default 24 horas

# ── Cache de token OAuth ──────────────────────────────────────────────────────

_token_lock = threading.Lock()
_token_cache: dict[str, Any] = {"access_token": None, "expires_at": 0.0}

OAUTH_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
PROCESS_API_URL = "https://sh.dataspace.copernicus.eu/api/v1/process"
STATISTICS_API_URL = "https://sh.dataspace.copernicus.eu/api/v1/statistics"


def get_oauth_token() -> str | None:
    with _token_lock:
        now = time.time()
        if _token_cache["access_token"] and now < _token_cache["expires_at"]:
            return _token_cache["access_token"]

        client_id = os.getenv("SENTINEL_CLIENT_ID")
        client_secret = os.getenv("SENTINEL_CLIENT_SECRET")
        if not client_id or not client_secret:
            logging.error("[Sentinel] SENTINEL_CLIENT_ID or SENTINEL_CLIENT_SECRET not configured.")
            return None

        try:
            with httpx.Client(timeout=15.0) as client:
                response = client.post(
                    OAUTH_URL,
                    data={
                        "grant_type": "client_credentials",
                        "client_id": client_id,
                        "client_secret": client_secret,
                    },
                )
                response.raise_for_status()
                data = response.json()

            token = data.get("access_token")
            expires_in = int(data.get("expires_in", 3600))
            _token_cache["access_token"] = token
            _token_cache["expires_at"] = now + max(expires_in - 300, 60)
            logging.info("[Sentinel] OAuth token refreshed. TTL=%ss", max(expires_in - 300, 60))
            return token
        except Exception as exc:
            logging.error("[Sentinel] OAuth token error: %s", exc)
            return None


# ── Cache de overlay ──────────────────────────────────────────────────────────

_overlay_lock = threading.Lock()
_overlay_cache: dict[str, dict[str, Any]] = {}
OVERLAY_TTL_SECONDS = 30 * 60
SATELLITE_CACHE_BUCKET = os.getenv("SATELLITE_CACHE_BUCKET", "satellite-cache")
SATELLITE_CACHE_VERSION = os.getenv("SATELLITE_CACHE_VERSION", "v1")


@dataclass
class SentinelOverlayResult:
    image_bytes: bytes
    cache_hit: bool
    image_cached: bool
    cache_path: str | None
    generated_at: str
    scene_date: str | None
    scene_id: str | None
    cloud_coverage: float | None
    source: str
    mode: str
    width: int | None = None
    height: int | None = None


def _get_cached_overlay(cache_key: str) -> bytes | None:
    with _overlay_lock:
        entry = _overlay_cache.get(cache_key)
        if entry and time.time() < entry["expires_at"]:
            logging.info("[Sentinel] Cache HIT overlay key=%s", cache_key)
            return entry["image_bytes"]
        if entry:
            del _overlay_cache[cache_key]
    return None


def _set_cached_overlay(cache_key: str, image_bytes: bytes) -> None:
    with _overlay_lock:
        _overlay_cache[cache_key] = {
            "image_bytes": image_bytes,
            "expires_at": time.time() + OVERLAY_TTL_SECONDS,
        }
    logging.info("[Sentinel] Overlay cacheado key=%s size=%d bytes", cache_key, len(image_bytes))


def clear_cached_overlays_for_field(field_id: str) -> None:
    prefix = f"{field_id}_"
    with _overlay_lock:
        keys_to_delete = [cache_key for cache_key in _overlay_cache if cache_key.startswith(prefix)]
        for cache_key in keys_to_delete:
            del _overlay_cache[cache_key]
    if keys_to_delete:
        logging.info("[Sentinel] %d overlays removidos da memória para field_id=%s", len(keys_to_delete), field_id)


# ── Utilitários de geometria ──────────────────────────────────────────────────
def invalidate_field_cache(field_id: str) -> None:
    with _overlay_lock:
        for cache_key in list(_overlay_cache.keys()):
            if cache_key.startswith(f"{field_id}_"):
                _overlay_cache.pop(cache_key, None)


def get_bbox_from_boundaries(
    boundaries: list[list[float]] | None,
    lat: float,
    lng: float,
) -> list[float]:
    if not boundaries or len(boundaries) < 3:
        return [lng - 0.005, lat - 0.005, lng + 0.005, lat + 0.005]

    lats = [float(p[0]) for p in boundaries if p and len(p) >= 2]
    lngs = [float(p[1]) for p in boundaries if p and len(p) >= 2]
    if not lats or not lngs:
        return [lng - 0.005, lat - 0.005, lng + 0.005, lat + 0.005]

    margin = 0.0005
    return [min(lngs) - margin, min(lats) - margin, max(lngs) + margin, max(lats) + margin]


def _build_geojson_polygon(boundaries: list[list[float]]) -> dict[str, Any] | None:
    valid: list[list[float]] = []
    for p in boundaries:
        if p and len(p) >= 2:
            valid.append([float(p[1]), float(p[0])])
    if len(valid) < 3:
        return None
    if valid[0] != valid[-1]:
        valid.append(valid[0])
    return {"type": "Polygon", "coordinates": [valid]}


def _iso_now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _boundaries_hash(boundaries: list[list[float]] | None, bbox: list[float]) -> str:
    if boundaries and len(boundaries) >= 3:
        norm = [[round(float(p[0]), 6), round(float(p[1]), 6)] for p in boundaries if p and len(p) >= 2]
        payload = json.dumps(norm, sort_keys=True, separators=(",", ":"))
    else:
        payload = json.dumps([round(float(x), 6) for x in bbox], separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:24]


def _artifact_dimensions(image_bytes: bytes) -> tuple[int | None, int | None]:
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            return int(img.width), int(img.height)
    except Exception:
        return None, None


def _artifact_path(user_id: str | None, field_id: str, source: str, mode: str, scene_id: str | None, bbox_hash: str) -> str:
    uid = user_id or "anonymous"
    sid = scene_id or f"scene-{_iso_now().replace(':', '').replace('-', '')}"
    return f"{SATELLITE_CACHE_VERSION}/{uid}/{field_id}/{source}/{mode}/{sid}_{bbox_hash}.png"


def _get_persistent_artifact(
    user_id: str | None,
    field_id: str,
    source: str,
    mode: str,
    bbox_hash: str,
    scene_id: str | None,
    scene_date: str | None,
) -> SentinelOverlayResult | None:
    if not user_id:
        return None

    artifact = supabase_service.get_satellite_artifact_by_key(
        user_id=user_id,
        field_id=field_id,
        source=source,
        mode=mode,
        bbox_hash=bbox_hash,
        scene_id=scene_id,
        scene_date=scene_date,
    )
    if not artifact:
        return None

    image_path = artifact.get("image_path")
    if not image_path:
        return None

    image_bytes = supabase_service.download_storage_object(SATELLITE_CACHE_BUCKET, image_path)
    if not image_bytes:
        return None

    artifact_id = artifact.get("id")
    if artifact_id:
        supabase_service.touch_satellite_artifact(str(artifact_id))

    return SentinelOverlayResult(
        image_bytes=image_bytes,
        cache_hit=True,
        image_cached=True,
        cache_path=str(image_path),
        generated_at=str(artifact.get("generated_at") or _iso_now()),
        scene_date=(artifact.get("scene_date") or scene_date),
        scene_id=(artifact.get("scene_id") or scene_id),
        cloud_coverage=artifact.get("cloud_coverage"),
        source=source,
        mode=mode,
        width=artifact.get("width"),
        height=artifact.get("height"),
    )


def _save_persistent_artifact(
    user_id: str | None,
    farm_id: str | None,
    field_id: str,
    source: str,
    mode: str,
    scene_id: str | None,
    scene_date: str | None,
    cloud_coverage: float | None,
    bbox_hash: str,
    image_bytes: bytes,
) -> tuple[bool, str | None, str]:
    if not user_id:
        return False, None, _iso_now()

    generated_at = _iso_now()
    width, height = _artifact_dimensions(image_bytes)
    object_path = _artifact_path(user_id, field_id, source, mode, scene_id, bbox_hash)

    uploaded = supabase_service.upload_storage_object(
        SATELLITE_CACHE_BUCKET,
        object_path,
        image_bytes,
        "image/png",
    )
    if not uploaded:
        return False, None, generated_at

    metadata = {
        "user_id": user_id,
        "farm_id": farm_id,
        "field_id": field_id,
        "source": source,
        "mode": mode,
        "scene_id": scene_id or scene_date,
        "scene_date": scene_date,
        "cloud_coverage": cloud_coverage,
        "bbox_hash": bbox_hash,
        "image_path": object_path,
        "mime_type": "image/png",
        "width": width,
        "height": height,
        "bytes_size": len(image_bytes),
        "generated_at": generated_at,
        "updated_at": generated_at,
        "last_accessed_at": generated_at,
        "expires_at": (datetime.fromisoformat(generated_at.replace('Z', '+00:00')) + timedelta(hours=SENTINEL_CACHE_TTL_HOURS)).isoformat(),
        "cache_version": SATELLITE_CACHE_VERSION,
    }
    upserted = supabase_service.upsert_satellite_artifact(metadata)
    if upserted:
        object_path = str(upserted.get("image_path") or object_path)

    return True, object_path, generated_at


# ── Busca de cenas via STAC ───────────────────────────────────────────────────

STAC_URL = "https://earth-search.aws.element84.com/v1/search"


def get_available_scenes(
    lat: float,
    lng: float,
    boundaries: list[list[float]] | None = None,
    lookback_days: int = 90,
    max_results_per_source: int = 5,
) -> dict[str, list[dict]]:
    now = datetime.utcnow()
    from_dt = (now - timedelta(days=lookback_days)).strftime("%Y-%m-%dT00:00:00Z")
    to_dt = now.strftime("%Y-%m-%dT23:59:59Z")

    def build_intersects() -> dict:
        if boundaries and len(boundaries) >= 3:
            ring = []
            for p in boundaries:
                if p and len(p) >= 2:
                    ring.append([float(p[1]), float(p[0])])
            if len(ring) >= 3:
                if ring[0] != ring[-1]:
                    ring.append(ring[0])
                return {"type": "Polygon", "coordinates": [ring]}
        return {"type": "Point", "coordinates": [float(lng), float(lat)]}

    intersects = build_intersects()
    results: dict[str, list[dict]] = {"s2": [], "s1": []}

    # Sentinel-2
    try:
        with httpx.Client(timeout=20.0) as client:
            res = client.post(STAC_URL, json={
                "collections": ["sentinel-2-l2a"],
                "limit": max_results_per_source,
                "sortby": [{"field": "properties.datetime", "direction": "desc"}],
                "datetime": f"{from_dt}/{to_dt}",
                "intersects": intersects,
            })
            res.raise_for_status()
            features = res.json().get("features", [])
        for feat in features:
            props = feat.get("properties", {})
            dt_str = props.get("datetime") or props.get("created")
            date_iso, date_br = None, None
            if dt_str:
                try:
                    dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
                    date_iso = dt.date().isoformat()
                    date_br = dt.strftime("%d/%m/%Y")
                except Exception:
                    pass
            cloud = props.get("eo:cloud_cover")
            assets = feat.get("assets", {})
            thumbnail = assets.get("thumbnail", {}).get("href") or assets.get("overview", {}).get("href")
            results["s2"].append({
                "scene_id": feat.get("id"),
                "date": date_iso,
                "date_br": date_br,
                "cloud_coverage": round(float(cloud), 1) if cloud is not None else None,
                "source": "s2",
                "collection": "sentinel-2-l2a",
                "thumbnail_url": thumbnail,
            })
    except Exception as exc:
        logging.warning("[Sentinel] Erro S2 STAC: %s", exc)

    # Sentinel-1
    try:
        with httpx.Client(timeout=20.0) as client:
            res = client.post(STAC_URL, json={
                "collections": ["sentinel-1-grd"],
                "limit": max_results_per_source,
                "sortby": [{"field": "properties.datetime", "direction": "desc"}],
                "datetime": f"{from_dt}/{to_dt}",
                "intersects": intersects,
            })
            res.raise_for_status()
            features = res.json().get("features", [])
        for feat in features:
            props = feat.get("properties", {})
            dt_str = props.get("datetime") or props.get("created")
            date_iso, date_br = None, None
            if dt_str:
                try:
                    dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
                    date_iso = dt.date().isoformat()
                    date_br = dt.strftime("%d/%m/%Y")
                except Exception:
                    pass
            orbit = props.get("sat:orbit_state", "")
            assets = feat.get("assets", {})
            thumbnail = assets.get("thumbnail", {}).get("href")
            results["s1"].append({
                "scene_id": feat.get("id"),
                "date": date_iso,
                "date_br": date_br,
                "cloud_coverage": None,
                "orbit": orbit,
                "source": "s1",
                "collection": "sentinel-1-grd",
                "thumbnail_url": thumbnail,
            })
    except Exception as exc:
        logging.warning("[Sentinel] Erro S1 STAC: %s", exc)

    logging.info("[Sentinel] Cenas: S2=%d S1=%d lat=%.4f lng=%.4f",
                 len(results["s2"]), len(results["s1"]), lat, lng)
    return results


def get_latest_scene_metadata(
    lat: float,
    lng: float,
    boundaries: list[list[float]] | None = None,
    lookback_days: int = 21,
    max_cloud_coverage: int = 40,
) -> dict | None:
    results = get_available_scenes(lat, lng, boundaries, lookback_days, max_results_per_source=5)
    s2_scenes = results.get("s2", [])
    filtered = [s for s in s2_scenes if s.get("cloud_coverage") is None or s.get("cloud_coverage", 100) <= max_cloud_coverage]
    if not filtered:
        filtered = s2_scenes
    if not filtered:
        return None
    scene = filtered[0]
    return {
        "status": "ok",
        "provider": "Sentinel-2",
        "scene_id": scene.get("scene_id"),
        "scene_date": scene.get("date"),
        "scene_date_br": scene.get("date_br"),
        "cloud_coverage": scene.get("cloud_coverage"),
        "source": "s2",
    }


# ── Overlay por cena específica ───────────────────────────────────────────────

def get_true_color_overlay(
    field_id: str,
    lat: float,
    lng: float,
    boundaries: list[list[float]] | None = None,
    date_range_days: int = 30,
    scene_date: str | None = None,
    scene_id: str | None = None,
    cloud_coverage: float | None = None,
    user_id: str | None = None,
    farm_id: str | None = None,
    force_refresh: bool = False,
    source: str = "s2",
    mode: str = "truecolor",
) -> bytes | SentinelOverlayResult | None:
    # Cache key determinístico: (field_id, source, scene_id, mode)
    scene_identifier = scene_id or scene_date or ""
    cache_key = f"{field_id}_{source}_{scene_identifier}_{mode}".rstrip('_')
    cached = _get_cached_overlay(cache_key)
    if cached:
        if force_refresh:
            cached = None
        else:
            return SentinelOverlayResult(
                image_bytes=cached,
                cache_hit=True,
                image_cached=True,
                cache_path=None,
                generated_at=_iso_now(),
                scene_date=scene_date,
                scene_id=scene_id,
                cloud_coverage=cloud_coverage,
                source=source,
                mode=mode,
            )

    token = get_oauth_token()
    if not token:
        return None

    bbox = get_bbox_from_boundaries(boundaries, lat, lng)
    bbox_hash = _boundaries_hash(boundaries, bbox)

    if not force_refresh:
        persistent = _get_persistent_artifact(
            user_id=user_id,
            field_id=field_id,
            source=source,
            mode=mode,
            bbox_hash=bbox_hash,
            scene_id=scene_id,
            scene_date=scene_date,
        )
        if persistent:
            _set_cached_overlay(cache_key, persistent.image_bytes)
            return persistent

    geojson_polygon = _build_geojson_polygon(boundaries) if boundaries else None

    # ── Evalscripts ───────────────────────────────────────────────────────────
    if source == "s1":
        # Sentinel-1 SAR — VV em escala de cinza, 4 bandas RGBA
        evalscript = """
//VERSION=3
function setup() {
  return {
    input: [{ bands: ["VV", "VH", "dataMask"] }],
    output: { bands: 4, sampleType: "UINT8" }
  };
}
function evaluatePixel(s) {
  let vv = Math.log(s.VV * s.VV + 0.000001) / Math.log(10) * 10;
  let norm = Math.round(Math.min(Math.max((vv + 25) / 25, 0), 1) * 255);
    return [norm, norm, norm, s.dataMask * 255];
}
"""
        data_type = "sentinel-1-grd"
    elif mode == "ndvi":
        evalscript = """
//VERSION=3
function setup() {
    return {
        input: [{ bands: ["B04", "B08", "dataMask"] }],
        output: { bands: 4, sampleType: "UINT8" }
    };
}
function evaluatePixel(s) {
    if (s.dataMask === 0) return [0,0,0,0];
    let ndvi = (s.B08 - s.B04) / (s.B08 + s.B04 + 0.0001);
    if (ndvi < 0)   return [120,120,120,255];
    if (ndvi < 0.2) return [200,50,25,255];
    if (ndvi < 0.4) return [230,180,50,255];
    if (ndvi < 0.6) return [100,190,50,255];
    return [20,110,20,255];
}
"""
        data_type = "sentinel-2-l2a"
    else:
        evalscript = """
//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B03", "B02", "dataMask"] }],
    output: { bands: 4, sampleType: "UINT8" }
  };
}
function evaluatePixel(s) {
  function adj(v) {
    return Math.round(Math.pow(Math.min(Math.max(v * 3.5, 0), 1), 0.85) * 255);
  }
  return [adj(s.B04), adj(s.B03), adj(s.B02), s.dataMask * 255];
}
"""
        data_type = "sentinel-2-l2a"

    # ── Janela de tempo ───────────────────────────────────────────────────────
    if scene_date:
        try:
            sd = datetime.fromisoformat(scene_date)
            from_date = (sd - timedelta(days=1)).strftime("%Y-%m-%dT00:00:00Z")
            to_date = (sd + timedelta(days=1)).strftime("%Y-%m-%dT23:59:59Z")
        except Exception:
            from_date = (datetime.utcnow() - timedelta(days=date_range_days)).strftime("%Y-%m-%dT00:00:00Z")
            to_date = datetime.utcnow().strftime("%Y-%m-%dT23:59:59Z")
        windows = [(from_date, to_date)]
    else:
        to_date = datetime.utcnow().strftime("%Y-%m-%dT23:59:59Z")
        windows = [
            ((datetime.utcnow() - timedelta(days=d)).strftime("%Y-%m-%dT00:00:00Z"), to_date)
            for d in [date_range_days, 60, 90]
        ]

    bounds_input: dict = {
        "bbox": bbox,
        "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"},
    }
    if geojson_polygon:
        bounds_input["geometry"] = geojson_polygon

    # dataFilter: S2 tem maxCloudCoverage e mosaickingOrder, S1 não suporta esses filtros
    if source == "s2":
        data_filter_base: dict = {
            "timeRange": {"from": "", "to": ""},
            "maxCloudCoverage": 100,
            "mosaickingOrder": "mostRecent",
        }
    else:
        data_filter_base = {
            "timeRange": {"from": "", "to": ""},
        }

    output_size = 512 if source == "s1" else 1024

    payload: dict = {
        "input": {
            "bounds": bounds_input,
            "data": [
                {
                    "type": data_type,
                    "dataFilter": dict(data_filter_base),
                }
            ],
        },
        "output": {
            "width": output_size,
            "height": output_size,
            "responses": [{"identifier": "default", "format": {"type": "image/png"}}],
        },
        "evalscript": evalscript,
    }

    for from_dt, to_dt in windows:
        payload["input"]["data"][0]["dataFilter"]["timeRange"]["from"] = from_dt
        payload["input"]["data"][0]["dataFilter"]["timeRange"]["to"] = to_dt

        try:
            logging.info("[Sentinel] overlay POST source=%s field_id=%s from=%s to=%s",
                         source, field_id, from_dt, to_dt)
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            with httpx.Client(timeout=60.0) as http_client:
                resp = http_client.post(
                    PROCESS_API_URL,
                    headers=headers,
                    json=payload,
                )

            if resp.status_code == 200:
                ct = resp.headers.get("content-type", "")
                if "image" in ct:
                    image_bytes = resp.content
                    _set_cached_overlay(cache_key, image_bytes)

                    persisted, cache_path, generated_at = _save_persistent_artifact(
                        user_id=user_id,
                        farm_id=farm_id,
                        field_id=field_id,
                        source=source,
                        mode=mode,
                        scene_id=scene_id,
                        scene_date=scene_date,
                        cloud_coverage=cloud_coverage,
                        bbox_hash=bbox_hash,
                        image_bytes=image_bytes,
                    )
                    width, height = _artifact_dimensions(image_bytes)
                    return SentinelOverlayResult(
                        image_bytes=image_bytes,
                        cache_hit=False,
                        image_cached=bool(persisted),
                        cache_path=cache_path,
                        generated_at=generated_at,
                        scene_date=scene_date,
                        scene_id=scene_id,
                        cloud_coverage=cloud_coverage,
                        source=source,
                        mode=mode,
                        width=width,
                        height=height,
                    )
                logging.warning("[Sentinel] Resposta não-imagem ct=%s body=%s", ct, resp.text[:200])

            elif resp.status_code == 401:
                logging.warning("[Sentinel] 401 — renovando token")
                with _token_lock:
                    _token_cache["access_token"] = None
                    _token_cache["expires_at"] = 0.0
                token = get_oauth_token() or token
                continue

            else:
                logging.warning("[Sentinel] HTTP %d from=%s body=%s",
                                resp.status_code, from_dt, resp.text[:300])

        except httpx.TimeoutException:
            logging.warning("[Sentinel] Timeout source=%s from=%s", source, from_dt)
        except Exception as exc:
            logging.error("[Sentinel] Erro source=%s from=%s: %s", source, from_dt, exc)

    logging.error("[Sentinel] Todas as janelas falharam field_id=%s source=%s", field_id, source)
    return None


# ── NDVI (mantida para /api/analyze-field) ────────────────────────────────────

def get_ndvi_stats(
    bbox: list[float],
    boundaries: list[list[float]] | None = None,
) -> dict[str, Any] | None:
    token = get_oauth_token()
    if not token:
        return None

    bounds_payload: dict[str, Any] = {
        "bbox": bbox,
        "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"},
    }
    geojson = _build_geojson_polygon(boundaries) if boundaries else None
    if geojson:
        bounds_payload["geometry"] = geojson

    evalscript = """
//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "dataMask"] }],
    output: [{ id: "ndvi", bands: 1 }, { id: "dataMask", bands: 1 }]
  };
}
function evaluatePixel(s) {
  let ndvi = (s.B08 - s.B04) / (s.B08 + s.B04);
  return { ndvi: [ndvi], dataMask: [s.dataMask] };
}
"""
    to_dt = datetime.utcnow().strftime("%Y-%m-%dT23:59:59Z")
    from_dt = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%dT00:00:00Z")

    payload = {
        "input": {
            "bounds": bounds_payload,
            "data": [{"type": "sentinel-2-l2a", "dataFilter": {
                "maxCloudCoverage": 30,
                "timeRange": {"from": from_dt, "to": to_dt},
            }}],
        },
        "aggregation": {
            "timeRange": {"from": from_dt, "to": to_dt},
            "aggregationInterval": {"of": "P30D"},
            "evalscript": evalscript,
            "resx": 10, "resy": 10,
        },
    }

    try:
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(
                STATISTICS_API_URL,
                headers=headers, json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

        output = (
            data.get("data", [{}])[0]
            .get("outputs", {}).get("ndvi", {})
            .get("bands", {}).get("B0", {})
            .get("stats", {})
        )
        if not output or output.get("count", 0) == 0:
            return None

        return {
            "ndvi_avg": output.get("mean", 0),
            "ndvi_max": output.get("max", 0),
            "ndvi_min": output.get("min", 0),
            "count": output.get("count", 0),
            "cloud_coverage": None,
        }
    except Exception as exc:
        logging.warning("[Sentinel] NDVI stats error: %s", exc)
        return None


def get_ndvi_image(
    lat: float,
    lng: float,
    boundaries: list[list[float]] | None = None,
    date_range_days: int = 15,
) -> dict[str, Any] | None:
    token = get_oauth_token()
    if not token:
        return None

    bbox = get_bbox_from_boundaries(boundaries, lat, lng)
    stats = get_ndvi_stats(bbox, boundaries)
    geojson = _build_geojson_polygon(boundaries) if boundaries else None

    evalscript = """
//VERSION=3
function setup() {
  return { input: ["B04","B08","dataMask"], output: { bands: 4 } };
}
function evaluatePixel(s) {
  let ndvi = (s.B08 - s.B04) / (s.B08 + s.B04);
  if (s.dataMask === 0) return [0,0,0,0];
  if (ndvi < 0)   return [0.5, 0.5, 0.5, 1];
  if (ndvi < 0.2) return [0.8, 0.2, 0.1, 1];
  if (ndvi < 0.4) return [0.9, 0.7, 0.1, 1];
  if (ndvi < 0.6) return [0.4, 0.8, 0.2, 1];
  return [0.1, 0.5, 0.1, 1];
}
"""
    to_date = datetime.utcnow().strftime("%Y-%m-%d")

    for days in [date_range_days, 30]:
        f_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
        bounds_input: dict[str, Any] = {
            "bbox": bbox,
            "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"},
        }
        if geojson:
            bounds_input["geometry"] = geojson

        payload = {
            "input": {
                "bounds": bounds_input,
                "data": [{"type": "sentinel-2-l2a", "dataFilter": {
                    "timeRange": {"from": f"{f_date}T00:00:00Z", "to": f"{to_date}T23:59:59Z"},
                    "maxCloudCoverage": 30,
                }}],
            },
            "output": {
                "width": 512, "height": 512,
                "responses": [{"identifier": "default", "format": {"type": "image/png"}}],
            },
            "evalscript": evalscript,
        }

        try:
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            with httpx.Client(timeout=60.0) as client:
                resp = client.post(
                    PROCESS_API_URL,
                    headers=headers, json=payload,
                )
                resp.raise_for_status()
            return {
                "image_base64": base64.b64encode(resp.content).decode("utf-8"),
                "date_acquired": f"{to_date} (Aproximado)",
                "cloud_coverage": None,
                "stats": stats,
                "is_polygonal": bool(geojson),
            }
        except Exception as exc:
            logging.error("[Sentinel] NDVI image error window=%sd: %s", days, exc)

    return None


# ── Cache persistente de artefatos satelitais ─────────────────────────────────

import hashlib  # noqa: E402  (import local para não mover bloco; hashlib é stdlib)

SENTINEL_CACHE_BUCKET = "satellite-cache"


def _compute_bbox_hash(bbox: list[float]) -> str:
    """Hash MD5 estável (16 chars) do BBox arredondado a 4 casas decimais."""
    rounded = [round(v, 4) for v in bbox]
    return hashlib.md5(str(rounded).encode()).hexdigest()[:16]


def get_sentinel_overlay_with_cache(
    user_id: str,
    field_id: str,
    farm_id: str | None,
    lat: float,
    lng: float,
    boundaries: list[list[float]] | None,
    scene_date: str | None,
    source: str,
    mode: str,
    scene_id: str | None = None,
    force_refresh: bool = False,
) -> tuple[bytes | None, dict[str, Any]]:
    """
    Retorna (image_bytes, cache_info) com cache em 2 camadas:
      1ª camada: memória in-process (OVERLAY_TTL_SECONDS)
      2ª camada: Supabase Storage + metadados em satellite_artifacts

    cache_info keys:
      cache_hit: bool
      artifact_id: str | None
      cache_path: str | None
      cache_source: "memory" | "db" | "generated" | None
      generated_at: str | None
      scene_date: str | None
    """
    # Garante scene_id nunca NULL para a chave de unicidade no banco
    # Cache key DETERMINÍSTICO: (field_id, source, scene_id, mode)
    # Se scene_id absent, usa scene_date. Se ambos absent, key usa campo vazio
    effective_scene_id = scene_id or scene_date or ""

    bbox = get_bbox_from_boundaries(boundaries, lat, lng)
    bbox_hash = _compute_bbox_hash(bbox)
    mem_key = f"{field_id}_{source}_{effective_scene_id}_{mode}".rstrip('_')

    # ── 1ª Camada: memória ────────────────────────────────────────────────────
    if not force_refresh:
        cached_bytes = _get_cached_overlay(mem_key)
        if cached_bytes is not None:
            logging.info(
                "[SentinelCache] MEMORY HIT field_id=%s source=%s scene=%s",
                field_id, source, effective_scene_id,
            )
            return cached_bytes, {
                "cache_hit": True,
                "artifact_id": None,
                "cache_path": None,
                "cache_source": "memory",
                "generated_at": None,
                "scene_date": scene_date,
            }

    # ── 2ª Camada: banco + storage ────────────────────────────────────────────
    if not force_refresh:
        try:
            from services import supabase_service  # importação local evita ciclo no import de módulo
            artifact = supabase_service.get_satellite_artifact_by_key(
                user_id=user_id,
                field_id=field_id,
                source=source,
                mode=mode,
                bbox_hash=bbox_hash,
                scene_id=effective_scene_id,
                scene_date=scene_date,
            )
            if artifact and artifact.get("image_path"):
                image_bytes = supabase_service.download_storage_object(
                    SENTINEL_CACHE_BUCKET, artifact["image_path"]
                )
                if image_bytes:
                    _set_cached_overlay(mem_key, image_bytes)
                    # Atualiza last_accessed_at em best-effort (não bloqueia resposta)
                    try:
                        supabase_service.touch_satellite_artifact(artifact["id"])
                    except Exception:
                        pass
                    logging.info(
                        "[SentinelCache] DB HIT field_id=%s source=%s scene=%s path=%s",
                        field_id, source, effective_scene_id, artifact["image_path"],
                    )
                    return image_bytes, {
                        "cache_hit": True,
                        "artifact_id": artifact["id"],
                        "cache_path": artifact["image_path"],
                        "cache_source": "db",
                        "generated_at": artifact.get("generated_at"),
                        "scene_date": artifact.get("scene_date") or scene_date,
                    }
        except Exception as exc:
            logging.warning("[SentinelCache] Falha ao checar cache persistente: %s", exc)

    # ── Geração via Sentinel Hub ──────────────────────────────────────────────
    logging.info(
        "[SentinelCache] MISS — gerando via Sentinel Hub field_id=%s source=%s scene=%s",
        field_id, source, effective_scene_id,
    )
    image_bytes = get_true_color_overlay(
        field_id=field_id,
        lat=lat,
        lng=lng,
        boundaries=boundaries,
        date_range_days=30,
        scene_date=scene_date,
        source=source,
        mode=mode,
    )

    if image_bytes is None:
        return None, {
            "cache_hit": False,
            "artifact_id": None,
            "cache_path": None,
            "cache_source": None,
            "generated_at": None,
            "scene_date": scene_date,
        }

    # ── Persistência: storage + banco ─────────────────────────────────────────
    from datetime import datetime as _dt
    generated_at = _dt.utcnow().isoformat() + "Z"
    safe_key = effective_scene_id.replace(":", "-").replace("/", "-")
    image_path = f"{user_id}/{field_id}/{source}/{mode}/{safe_key}/{bbox_hash}.png"
    artifact_id: str | None = None

    try:
        from services import supabase_service  # noqa: F811
        uploaded = supabase_service.upload_storage_object(
            SENTINEL_CACHE_BUCKET, image_path, image_bytes, "image/png"
        )
        if uploaded:
            output_size = 512 if source == "s1" else 1024
            metadata: dict[str, Any] = {
                "user_id": user_id,
                "field_id": field_id,
                "farm_id": farm_id,
                "source": source,
                "mode": mode,
                "scene_id": effective_scene_id,
                "scene_date": scene_date,
                "bbox_hash": bbox_hash,
                "image_path": image_path,
                "mime_type": "image/png",
                "width": output_size,
                "height": output_size,
                "bytes_size": len(image_bytes),
                "generated_at": generated_at,
                "updated_at": generated_at,
                "last_accessed_at": generated_at,
                "expires_at": (_dt.fromisoformat(generated_at.replace("Z", "+00:00")) + timedelta(hours=SENTINEL_CACHE_TTL_HOURS)).isoformat(),
                "cache_version": 1,
            }
            artifact = supabase_service.upsert_satellite_artifact(metadata)
            artifact_id = artifact.get("id") if artifact else None
            logging.info(
                "[SentinelCache] Artifact salvo field_id=%s source=%s path=%s bytes=%d",
                field_id, source, image_path, len(image_bytes),
            )
    except Exception as exc:
        logging.warning("[SentinelCache] Falha ao persistir artifact: %s", exc)

    return image_bytes, {
        "cache_hit": False,
        "artifact_id": artifact_id,
        "cache_path": image_path,
        "cache_source": "generated",
        "generated_at": generated_at,
        "scene_date": scene_date,
    }
