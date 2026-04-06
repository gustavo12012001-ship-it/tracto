import base64
import logging
import os
import threading
import time
from datetime import datetime, timedelta
from typing import Any

import httpx

# OAuth token cache (55 min)
_token_lock = threading.Lock()
_token_cache: dict[str, Any] = {
    "access_token": None,
    "expires_at": 0.0,
}

# Overlay cache by field_id (30 min)
_overlay_lock = threading.Lock()
_overlay_cache: dict[str, dict[str, Any]] = {}
OVERLAY_TTL_SECONDS = 30 * 60

EARTH_SEARCH_URL = "https://earth-search.aws.element84.com/v1/search"


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
                    "https://services.sentinel-hub.com/oauth/token",
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


def _get_cached_overlay(field_id: str) -> bytes | None:
    with _overlay_lock:
        entry = _overlay_cache.get(field_id)
        if entry and time.time() < entry["expires_at"]:
            logging.info("[Sentinel] overlay cache hit field_id=%s", field_id)
            return entry["image_bytes"]
        if entry:
            del _overlay_cache[field_id]
    return None


def _set_cached_overlay(field_id: str, image_bytes: bytes) -> None:
    with _overlay_lock:
        _overlay_cache[field_id] = {
            "image_bytes": image_bytes,
            "expires_at": time.time() + OVERLAY_TTL_SECONDS,
        }
    logging.info("[Sentinel] overlay cached field_id=%s bytes=%d", field_id, len(image_bytes))


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
    return [
        min(lngs) - margin,
        min(lats) - margin,
        max(lngs) + margin,
        max(lats) + margin,
    ]


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


def get_true_color_overlay(
    field_id: str,
    lat: float,
    lng: float,
    boundaries: list[list[float]] | None = None,
    date_range_days: int = 30,
) -> bytes | None:
    cached = _get_cached_overlay(field_id)
    if cached:
        return cached

    token = get_oauth_token()
    if not token:
        return None

    bbox = get_bbox_from_boundaries(boundaries, lat, lng)
    geojson_polygon = _build_geojson_polygon(boundaries) if boundaries else None

    evalscript = """
//VERSION=3
function setup() {
  return {
    input: [{ bands: [\"B04\", \"B03\", \"B02\", \"dataMask\"] }],
    output: { bands: 4, sampleType: \"UINT8\" }
  };
}
function evaluatePixel(s) {
  function adj(v) {
    return Math.round(Math.pow(Math.min(Math.max(v * 3.5, 0), 1), 0.85) * 255);
  }
  return [adj(s.B04), adj(s.B03), adj(s.B02), s.dataMask * 255];
}
"""

    bounds_input: dict[str, Any] = {
        "bbox": bbox,
        "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"},
    }
    if geojson_polygon:
        bounds_input["geometry"] = geojson_polygon

    to_date = datetime.utcnow().strftime("%Y-%m-%dT23:59:59Z")
    payload: dict[str, Any] = {
        "input": {
            "bounds": bounds_input,
            "data": [
                {
                    "type": "sentinel-2-l2a",
                    "dataFilter": {
                        "timeRange": {"from": "", "to": to_date},
                        "maxCloudCoverage": 60,
                        "mosaickingOrder": "mostRecent",
                    },
                }
            ],
        },
        "output": {
            "width": 1024,
            "height": 1024,
            "responses": [{"identifier": "default", "format": {"type": "image/png"}}],
        },
        "evalscript": evalscript,
    }

    windows = sorted(set([date_range_days, 60, 90]))

    for days in windows:
        from_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%dT00:00:00Z")
        payload["input"]["data"][0]["dataFilter"]["timeRange"]["from"] = from_date

        try:
            logging.info("[Sentinel] overlay request field_id=%s window=%sd", field_id, days)
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            with httpx.Client(timeout=60.0) as http_client:
                resp = http_client.post(
                    "https://services.sentinel-hub.com/api/v1/process",
                    headers=headers,
                    json=payload,
                )

            if resp.status_code == 200:
                content_type = resp.headers.get("content-type", "")
                if "image" in content_type:
                    image_bytes = resp.content
                    _set_cached_overlay(field_id, image_bytes)
                    return image_bytes
                logging.warning("[Sentinel] non-image response content-type=%s", content_type)

            elif resp.status_code == 401:
                logging.warning("[Sentinel] 401 on overlay, invalidating token cache")
                with _token_lock:
                    _token_cache["access_token"] = None
                    _token_cache["expires_at"] = 0.0
                token = get_oauth_token() or token
                continue

            else:
                logging.warning("[Sentinel] overlay status=%s body=%s", resp.status_code, resp.text[:300])

        except httpx.TimeoutException:
            logging.warning("[Sentinel] overlay timeout field_id=%s window=%sd", field_id, days)
        except Exception as exc:
            logging.error("[Sentinel] overlay error field_id=%s window=%sd err=%s", field_id, days, exc)

    return None


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
    input: [{ bands: [\"B04\", \"B08\", \"dataMask\"] }],
    output: [
      { id: \"ndvi\", bands: 1 },
      { id: \"dataMask\", bands: 1 }
    ]
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
            "data": [
                {
                    "type": "sentinel-2-l2a",
                    "dataFilter": {
                        "maxCloudCoverage": 30,
                        "timeRange": {"from": from_dt, "to": to_dt},
                    },
                }
            ],
        },
        "aggregation": {
            "timeRange": {"from": from_dt, "to": to_dt},
            "aggregationInterval": {"of": "P30D"},
            "evalscript": evalscript,
            "resx": 10,
            "resy": 10,
        },
    }

    try:
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(
                "https://services.sentinel-hub.com/api/v1/statistics",
                headers=headers,
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()

        output = (
            data.get("data", [{}])[0]
            .get("outputs", {})
            .get("ndvi", {})
            .get("bands", {})
            .get("B0", {})
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
  return { input: [\"B04\",\"B08\",\"dataMask\"], output: { bands: 4 } };
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
                "data": [
                    {
                        "type": "sentinel-2-l2a",
                        "dataFilter": {
                            "timeRange": {
                                "from": f"{f_date}T00:00:00Z",
                                "to": f"{to_date}T23:59:59Z",
                            },
                            "maxCloudCoverage": 30,
                        },
                    }
                ],
            },
            "output": {
                "width": 512,
                "height": 512,
                "responses": [{"identifier": "default", "format": {"type": "image/png"}}],
            },
            "evalscript": evalscript,
        }

        try:
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            with httpx.Client(timeout=60.0) as client:
                resp = client.post(
                    "https://services.sentinel-hub.com/api/v1/process",
                    headers=headers,
                    json=payload,
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


def get_latest_scene_metadata(
    lat: float,
    lng: float,
    boundaries: list[list[float]] | None = None,
    lookback_days: int = 21,
    max_cloud_coverage: int = 40,
) -> dict[str, Any]:
    now_utc = datetime.utcnow()

    def _build_intersects() -> dict[str, Any]:
        if boundaries and len(boundaries) >= 3:
            ring: list[list[float]] = []
            for p in boundaries:
                if p and len(p) >= 2:
                    ring.append([float(p[1]), float(p[0])])
            if len(ring) >= 3:
                if ring[0] != ring[-1]:
                    ring.append(ring[0])
                return {"type": "Polygon", "coordinates": [ring]}
        return {"type": "Point", "coordinates": [float(lng), float(lat)]}

    payload = {
        "collections": ["sentinel-2-l2a"],
        "limit": 1,
        "sortby": [{"field": "properties.datetime", "direction": "desc"}],
        "datetime": f"{(now_utc - timedelta(days=lookback_days)).strftime('%Y-%m-%dT00:00:00Z')}/{now_utc.strftime('%Y-%m-%dT23:59:59Z')}",
        "intersects": _build_intersects(),
        "query": {"eo:cloud_cover": {"lte": max_cloud_coverage}},
    }

    try:
        with httpx.Client(timeout=20.0) as client:
            res = client.post(EARTH_SEARCH_URL, json=payload)
            res.raise_for_status()
            features = res.json().get("features", [])
    except Exception as exc:
        logging.warning("[Sentinel] Earth Search error: %s", exc)
        features = []

    if not features:
        return {
            "status": "fallback",
            "provider": "Earth Search STAC",
            "display_mode": "fallback",
            "scene_date": None,
            "scene_date_br": None,
            "scene_id": None,
            "cloud_coverage": None,
            "message": "Nenhuma cena Sentinel-2 encontrada na janela consultada.",
        }

    feature = features[0]
    properties = feature.get("properties", {})
    scene_datetime = properties.get("datetime")
    scene_date_iso = None
    scene_date_br = None
    if isinstance(scene_datetime, str):
        try:
            dt = datetime.fromisoformat(scene_datetime.replace("Z", "+00:00"))
            scene_date_iso = dt.date().isoformat()
            scene_date_br = dt.strftime("%d/%m/%Y")
        except ValueError:
            pass

    return {
        "status": "ok",
        "provider": "Earth Search STAC",
        "display_mode": "proxy",
        "scene_date": scene_date_iso,
        "scene_date_br": scene_date_br,
        "scene_id": feature.get("id"),
        "cloud_coverage": properties.get("eo:cloud_cover"),
        "preview_url": None,
        "wms_url": None,
        "wms_params": None,
        "message": None,
    }


def get_tile_image(z: int, x: int, y: int) -> bytes | None:
    _ = (z, x, y)
    return None


def get_overlay_image(
    min_lon: float,
    min_lat: float,
    max_lon: float,
    max_lat: float,
    target_date: str | None = None,
) -> tuple[bytes | None, bool]:
    _ = (min_lon, min_lat, max_lon, max_lat, target_date)
    return None, False
