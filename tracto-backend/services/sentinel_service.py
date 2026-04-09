"""
sentinel_service.py — Versão 4.3
"""

import base64
import logging
import os
import threading
import time
from datetime import datetime, timedelta
from typing import Any

import httpx

_token_lock = threading.Lock()
_token_cache: dict[str, Any] = {"access_token": None, "expires_at": 0.0}

PROCESS_API_URL = "https://services.sentinel-hub.com/api/v1/process"
STATISTICS_API_URL = "https://services.sentinel-hub.com/api/v1/statistics"
OAUTH_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"


def get_oauth_token() -> str | None:
    with _token_lock:
        now = time.time()
        if _token_cache["access_token"] and now < _token_cache["expires_at"]:
            return _token_cache["access_token"]
        client_id = os.getenv("SENTINEL_CLIENT_ID")
        client_secret = os.getenv("SENTINEL_CLIENT_SECRET")
        if not client_id or not client_secret:
            logging.error("[Sentinel] Credenciais não configuradas.")
            return None
        try:
            with httpx.Client(timeout=15.0) as client:
                response = client.post(
                    OAUTH_URL,
                    data={"grant_type": "client_credentials", "client_id": client_id, "client_secret": client_secret},
                )
                response.raise_for_status()
                data = response.json()
            token = data.get("access_token")
            expires_in = int(data.get("expires_in", 3600))
            _token_cache["access_token"] = token
            _token_cache["expires_at"] = now + max(expires_in - 300, 60)
            logging.info("[Sentinel] Token renovado. TTL=%ss", max(expires_in - 300, 60))
            return token
        except Exception as exc:
            logging.error("[Sentinel] OAuth error: %s", exc)
            return None


_overlay_lock = threading.Lock()
_overlay_cache: dict[str, dict[str, Any]] = {}
OVERLAY_TTL_SECONDS = 30 * 60


def _get_cached_overlay(cache_key: str) -> bytes | None:
    with _overlay_lock:
        entry = _overlay_cache.get(cache_key)
        if entry and time.time() < entry["expires_at"]:
            return entry["image_bytes"]
        if entry:
            del _overlay_cache[cache_key]
    return None


def _set_cached_overlay(cache_key: str, image_bytes: bytes) -> None:
    with _overlay_lock:
        _overlay_cache[cache_key] = {"image_bytes": image_bytes, "expires_at": time.time() + OVERLAY_TTL_SECONDS}


def get_bbox_from_boundaries(boundaries: list[list[float]] | None, lat: float, lng: float) -> list[float]:
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

    try:
        with httpx.Client(timeout=20.0) as client:
            res = client.post(STAC_URL, json={
                "collections": ["sentinel-2-l2a"], "limit": max_results_per_source,
                "sortby": [{"field": "properties.datetime", "direction": "desc"}],
                "datetime": f"{from_dt}/{to_dt}", "intersects": intersects,
            })
            res.raise_for_status()
            for feat in res.json().get("features", []):
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
                    "scene_id": feat.get("id"), "date": date_iso, "date_br": date_br,
                    "cloud_coverage": round(float(cloud), 1) if cloud is not None else None,
                    "source": "s2", "collection": "sentinel-2-l2a", "thumbnail_url": thumbnail,
                })
    except Exception as exc:
        logging.warning("[Sentinel] Erro S2 STAC: %s", exc)

    try:
        with httpx.Client(timeout=20.0) as client:
            res = client.post(STAC_URL, json={
                "collections": ["sentinel-1-grd"], "limit": max_results_per_source,
                "sortby": [{"field": "properties.datetime", "direction": "desc"}],
                "datetime": f"{from_dt}/{to_dt}", "intersects": intersects,
            })
            res.raise_for_status()
            for feat in res.json().get("features", []):
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
                thumbnail = feat.get("assets", {}).get("thumbnail", {}).get("href")
                results["s1"].append({
                    "scene_id": feat.get("id"), "date": date_iso, "date_br": date_br,
                    "cloud_coverage": None, "orbit": orbit,
                    "source": "s1", "collection": "sentinel-1-grd", "thumbnail_url": thumbnail,
                })
    except Exception as exc:
        logging.warning("[Sentinel] Erro S1 STAC: %s", exc)

    logging.info("[Sentinel] Cenas: S2=%d S1=%d lat=%.4f lng=%.4f", len(results["s2"]), len(results["s1"]), lat, lng)
    return results


def get_true_color_overlay(
    field_id: str,
    lat: float,
    lng: float,
    boundaries: list[list[float]] | None = None,
    date_range_days: int = 30,
    scene_date: str | None = None,
    source: str = "s2",
    mode: str = "truecolor",
) -> bytes | None:
    cache_key = f"{field_id}_{source}_{scene_date or 'latest'}_{mode}"
    cached = _get_cached_overlay(cache_key)
    if cached:
        return cached

    token = get_oauth_token()
    if not token:
        return None

    bbox = get_bbox_from_boundaries(boundaries, lat, lng)
    geojson_polygon = _build_geojson_polygon(boundaries) if boundaries else None

    if source == "s1":
        evalscript = """
//VERSION=3
function setup() {
  return {
    input: [{ bands: ["VV", "dataMask"] }],
    output: { bands: 4, sampleType: "UINT8" },
    mosaicking: "ORBIT"
  };
}
function evaluatePixel(samples) {
  let vvSum = 0, count = 0;
  for (let s of samples) {
    if (s.dataMask > 0) { vvSum += Math.sqrt(Math.max(s.VV, 0)); count++; }
  }
  if (count === 0) return [0, 0, 0, 0];
  let norm = Math.round(Math.min(Math.max((vvSum / count) * 2.8, 0), 1) * 255);
  return [norm, norm, norm, 255];
}
"""
        data_type = "sentinel-1-grd"
    else:
        if mode == "ndvi":
            evalscript = """
//VERSION=3
function setup() {
  return { input: [{ bands: ["B04", "B08", "dataMask"] }], output: { bands: 4, sampleType: "UINT8" } };
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
        elif mode == "falsecolor":
            # Infravermelho Colorido — vegetação aparece em vermelho vibrante
            evalscript = """
//VERSION=3
function setup() {
  return { input: [{ bands: ["B08", "B04", "B03", "dataMask"] }], output: { bands: 4, sampleType: "UINT8" } };
}
function evaluatePixel(s) {
  if (s.dataMask === 0) return [0,0,0,0];
  function adj(v) { return Math.round(Math.pow(Math.min(Math.max(v * 3.5, 0), 1), 0.85) * 255); }
  return [adj(s.B08), adj(s.B04), adj(s.B03), 255];
}
"""
        elif mode == "agriculture":
            # Bandas SWIR — diferencia solo, vegetação e áreas colhidas
            evalscript = """
//VERSION=3
function setup() {
  return { input: [{ bands: ["B11", "B08", "B02", "dataMask"] }], output: { bands: 4, sampleType: "UINT8" } };
}
function evaluatePixel(s) {
  if (s.dataMask === 0) return [0,0,0,0];
  function adj(v) { return Math.round(Math.pow(Math.min(Math.max(v * 3.5, 0), 1), 0.85) * 255); }
  return [adj(s.B11), adj(s.B08), adj(s.B02), 255];
}
"""
        else:
            evalscript = """
//VERSION=3
function setup() {
  return { input: [{ bands: ["B04", "B03", "B02", "dataMask"] }], output: { bands: 4, sampleType: "UINT8" } };
}
function evaluatePixel(s) {
  function adj(v) { return Math.round(Math.pow(Math.min(Math.max(v * 3.5, 0), 1), 0.85) * 255); }
  return [adj(s.B04), adj(s.B03), adj(s.B02), s.dataMask * 255];
}
"""
        data_type = "sentinel-2-l2a"

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
        windows = [((datetime.utcnow() - timedelta(days=d)).strftime("%Y-%m-%dT00:00:00Z"), to_date) for d in [date_range_days, 60, 90]]

    bounds_input: dict = {"bbox": bbox, "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"}}
    if geojson_polygon:
        bounds_input["geometry"] = geojson_polygon

    data_filter_base: dict = {"timeRange": {"from": "", "to": ""}}
    if source == "s2":
        data_filter_base["maxCloudCoverage"] = 100
        data_filter_base["mosaickingOrder"] = "mostRecent"

    output_size = 512 if source == "s1" else 1024

    payload: dict = {
        "input": {"bounds": bounds_input, "data": [{"type": data_type, "dataFilter": dict(data_filter_base)}]},
        "output": {"width": output_size, "height": output_size, "responses": [{"identifier": "default", "format": {"type": "image/png"}}]},
        "evalscript": evalscript,
    }

    for from_dt, to_dt in windows:
        payload["input"]["data"][0]["dataFilter"]["timeRange"]["from"] = from_dt
        payload["input"]["data"][0]["dataFilter"]["timeRange"]["to"] = to_dt
        try:
            logging.info("[Sentinel] overlay POST source=%s mode=%s field_id=%s from=%s", source, mode, field_id, from_dt)
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            with httpx.Client(timeout=60.0) as http_client:
                resp = http_client.post(PROCESS_API_URL, headers=headers, json=payload)
            if resp.status_code == 200:
                ct = resp.headers.get("content-type", "")
                if "image" in ct:
                    _set_cached_overlay(cache_key, resp.content)
                    return resp.content
                logging.warning("[Sentinel] Resposta não-imagem ct=%s body=%s", ct, resp.text[:200])
            elif resp.status_code == 401:
                logging.warning("[Sentinel] 401 — renovando token")
                with _token_lock:
                    _token_cache["access_token"] = None
                    _token_cache["expires_at"] = 0.0
                token = get_oauth_token() or token
                continue
            else:
                logging.warning("[Sentinel] HTTP %d body=%s", resp.status_code, resp.text[:300])
        except httpx.TimeoutException:
            logging.warning("[Sentinel] Timeout source=%s from=%s", source, from_dt)
        except Exception as exc:
            logging.error("[Sentinel] Erro source=%s: %s", source, exc)

    logging.error("[Sentinel] Todas as janelas falharam field_id=%s source=%s mode=%s", field_id, source, mode)
    return None


def get_ndvi_stats(bbox: list[float], boundaries: list[list[float]] | None = None) -> dict[str, Any] | None:
    token = get_oauth_token()
    if not token:
        return None
    bounds_payload: dict[str, Any] = {"bbox": bbox, "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"}}
    geojson = _build_geojson_polygon(boundaries) if boundaries else None
    if geojson:
        bounds_payload["geometry"] = geojson
    evalscript = """
//VERSION=3
function setup() {
  return { input: [{ bands: ["B04", "B08", "dataMask"] }], output: [{ id: "ndvi", bands: 1 }, { id: "dataMask", bands: 1 }] };
}
function evaluatePixel(s) {
  let ndvi = (s.B08 - s.B04) / (s.B08 + s.B04);
  return { ndvi: [ndvi], dataMask: [s.dataMask] };
}
"""
    to_dt = datetime.utcnow().strftime("%Y-%m-%dT23:59:59Z")
    from_dt = (datetime.utcnow() - timedelta(days=30)).strftime("%Y-%m-%dT00:00:00Z")
    payload = {
        "input": {"bounds": bounds_payload, "data": [{"type": "sentinel-2-l2a", "dataFilter": {"maxCloudCoverage": 30, "timeRange": {"from": from_dt, "to": to_dt}}}]},
        "aggregation": {"timeRange": {"from": from_dt, "to": to_dt}, "aggregationInterval": {"of": "P30D"}, "evalscript": evalscript, "resx": 10, "resy": 10},
    }
    try:
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        with httpx.Client(timeout=30.0) as client:
            resp = client.post(STATISTICS_API_URL, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
        output = data.get("data", [{}])[0].get("outputs", {}).get("ndvi", {}).get("bands", {}).get("B0", {}).get("stats", {})
        if not output or output.get("count", 0) == 0:
            return None
        return {"ndvi_avg": output.get("mean", 0), "ndvi_max": output.get("max", 0), "ndvi_min": output.get("min", 0), "count": output.get("count", 0), "cloud_coverage": None}
    except Exception as exc:
        logging.warning("[Sentinel] NDVI stats error: %s", exc)
        return None


def get_ndvi_image(lat: float, lng: float, boundaries: list[list[float]] | None = None, date_range_days: int = 15) -> dict[str, Any] | None:
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
  if (ndvi < 0)   return [0.5,0.5,0.5,1];
  if (ndvi < 0.2) return [0.8,0.2,0.1,1];
  if (ndvi < 0.4) return [0.9,0.7,0.1,1];
  if (ndvi < 0.6) return [0.4,0.8,0.2,1];
  return [0.1,0.5,0.1,1];
}
"""
    to_date = datetime.utcnow().strftime("%Y-%m-%d")
    for days in [date_range_days, 30]:
        f_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%d")
        bounds_input: dict[str, Any] = {"bbox": bbox, "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"}}
        if geojson:
            bounds_input["geometry"] = geojson
        payload = {
            "input": {"bounds": bounds_input, "data": [{"type": "sentinel-2-l2a", "dataFilter": {"timeRange": {"from": f"{f_date}T00:00:00Z", "to": f"{to_date}T23:59:59Z"}, "maxCloudCoverage": 30}}]},
            "output": {"width": 512, "height": 512, "responses": [{"identifier": "default", "format": {"type": "image/png"}}]},
            "evalscript": evalscript,
        }
        try:
            headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
            with httpx.Client(timeout=60.0) as client:
                resp = client.post(PROCESS_API_URL, headers=headers, json=payload)
                resp.raise_for_status()
            return {"image_base64": base64.b64encode(resp.content).decode("utf-8"), "date_acquired": f"{to_date} (Aproximado)", "cloud_coverage": None, "stats": stats, "is_polygonal": bool(geojson)}
        except Exception as exc:
            logging.error("[Sentinel] NDVI image error window=%sd: %s", days, exc)
    return None
