import os
import math
import sys
import httpx
import logging
import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

EARTH_SEARCH_URL = "https://earth-search.aws.element84.com/v1/search"
# ── Token cache em memória (55 min TTL) ──────────────────────────────────────
_token_cache: Dict[str, Any] = {"token": None, "expires_at": 0.0}


def _resolve_instance_id() -> Optional[str]:
    instance_id = (
        (os.getenv("SENTINEL_INSTANCE_ID") or "").strip()
        or (os.getenv("SENTINEL_HUB_INSTANCE_ID") or "").strip()
        or (os.getenv("SH_INSTANCE_ID") or "").strip()
        or (os.getenv("VITE_SENTINEL_INSTANCE_ID") or "").strip()
    )
    return instance_id or None


def get_oauth_token() -> Optional[str]:
    import time

    now = time.time()
    if _token_cache["token"] and now < _token_cache["expires_at"]:
        return _token_cache["token"]

    client_id = os.getenv("SENTINEL_CLIENT_ID")
    client_secret = os.getenv("SENTINEL_CLIENT_SECRET")

    if not client_id or not client_secret:
        logging.error("SENTINEL credentials not configured.")
        return None

    try:
        with httpx.Client() as client:
            response = client.post(
                "https://services.sentinel-hub.com/oauth/token",
                data={
                    "grant_type": "client_credentials",
                    "client_id": client_id,
                    "client_secret": client_secret,
                },
                timeout=15.0,
            )
            response.raise_for_status()
            data = response.json()
            token = data.get("access_token")
            expires_in = data.get("expires_in", 3600)
            _token_cache["token"] = token
            _token_cache["expires_at"] = now + min(expires_in - 60, 3300)
            print(f"[Sentinel] Token renovado, expira em {expires_in}s", flush=True, file=sys.stdout)
            return token
    except Exception as e:
        logging.error(f"Error getting Sentinel OAuth token: {str(e)}")
        return None


# ── Tile XYZ → BBOX EPSG:4326 ─────────────────────────────────────────────────
def tile_to_bbox_4326(z: int, x: int, y: int) -> List[float]:
    """Converte tile XYZ para [west, south, east, north] em EPSG:4326."""
    n = 2 ** z
    west = x / n * 360.0 - 180.0
    east = (x + 1) / n * 360.0 - 180.0
    north = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    south = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n))))
    return [west, south, east, north]


# ── Tile proxy via Process API (TRUE-COLOR, janela dinâmica) ──────────────────
def get_tile_image(z: int, x: int, y: int) -> Optional[bytes]:
    """
    Retorna bytes JPEG de uma tile Sentinel-2 TRUE-COLOR.
    Usa Process API (OAuth) — sem dependência de SENTINEL_INSTANCE_ID.
    Janela: últimos 30 dias, fallback 60 dias. MaxCloud: 20%.
    """
    token = get_oauth_token()
    if not token:
        return None

    bbox = tile_to_bbox_4326(z, x, y)

    evalscript = """
    //VERSION=3
    function setup() {
      return {
        input: [{ bands: ["B04", "B03", "B02"] }],
        output: { bands: 3, sampleType: "AUTO" }
      };
    }
    function evaluatePixel(s) {
      return [3.5 * s.B04, 3.5 * s.B03, 3.5 * s.B02];
    }
    """

    to_date = datetime.utcnow().strftime("%Y-%m-%dT23:59:59Z")
    attempts = [30, 60, 90]

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    for days in attempts:
        from_date = (datetime.utcnow() - timedelta(days=days)).strftime("%Y-%m-%dT00:00:00Z")

        payload = {
            "input": {
                "bounds": {
                    "bbox": bbox,
                    "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"},
                },
                "data": [
                    {
                        "type": "sentinel-2-l2a",
                        "dataFilter": {
                            "timeRange": {"from": from_date, "to": to_date},
                            "maxCloudCoverage": 40,
                            "mosaickingOrder": "mostRecent",
                        },
                    }
                ],
            },
            "output": {
                "width": 256,
                "height": 256,
                "responses": [
                    {"identifier": "default", "format": {"type": "image/jpeg", "quality": 85}}
                ],
            },
            "evalscript": evalscript,
        }

        try:
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(
                    "https://services.sentinel-hub.com/api/v1/process",
                    headers=headers,
                    json=payload,
                )

                if resp.status_code == 401:
                    _token_cache["token"] = None
                    token = get_oauth_token()
                    if not token:
                        return None
                    headers["Authorization"] = f"Bearer {token}"
                    resp = client.post(
                        "https://services.sentinel-hub.com/api/v1/process",
                        headers=headers,
                        json=payload,
                    )

                if resp.status_code == 200 and len(resp.content) > 200:
                    print(
                        f"[Sentinel] tile z={z} x={x} y={y} ok — janela {days}d "
                        f"({len(resp.content)//1024}KB)",
                        flush=True, file=sys.stdout,
                    )
                    return resp.content

                print(
                    f"[Sentinel] tile z={z} x={x} y={y} falhou (status={resp.status_code}, "
                    f"bytes={len(resp.content)}, body={resp.text[:300]}) — tentando janela maior",
                    flush=True, file=sys.stdout,
                )

        except Exception as e:
            logging.warning(f"[Sentinel] tile {z}/{x}/{y} erro ({days}d): {e}")

    return None

def get_bbox_from_boundaries(boundaries: Optional[List[List[float]]], lat: float, lng: float) -> list[float]:
    """
    Calcula o BBox [min_lng, min_lat, max_lng, max_lat] a partir das boundaries.
    Caso nao existam boundaries, usa um offset de 0.005 (~500m).
    """
    if not boundaries or len(boundaries) < 3:
        # Fallback para aprox 1km x 1km (0.01 grau total)
        return [lng - 0.005, lat - 0.005, lng + 0.005, lat + 0.005]
    
    if boundaries is not None:
        lats: List[float] = [p[0] for p in boundaries if p is not None and len(p) >= 1]
        lngs: List[float] = [p[1] for p in boundaries if p is not None and len(p) >= 2]
    else:
        return [lng - 0.005, lat - 0.005, lng + 0.005, lat + 0.005]
    
    # Adiciona uma pequena margem de 10% ou 0.0005 graus
    margin = 0.0005
    return [
        min(lngs) - margin,
        min(lats) - margin,
        max(lngs) + margin,
        max(lats) + margin
    ]

def get_ndvi_stats(bbox: list[float], boundaries: Optional[List[List[float]]] = None):
    """
    Obtem estatisticas reais de NDVI via Sentinel Hub Statistics API.
    Retorna media, classes e cobertura de nuvens deterministica.
    """
    token = get_oauth_token()
    if not token:
        return None
        
    # Se tivermos polígono real, podemos usar no 'geometry' da API para masking
    bounds_payload: Dict[str, Any] = {
        "bbox": bbox,
        "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"}
    }
    
    if boundaries and len(boundaries) >= 3:
        # GeoJSON Polygon: [[ [lng, lat], [lng, lat]... ]]
        # Add real geometry for masking if available
        # Explicit float conversion and safe indexing
        valid_poly = []
        for p in boundaries:
            if p is not None and len(p) >= 2:
                valid_poly.append([float(p[1]), float(p[0])])
        
        if len(valid_poly) >= 3:
            polygon = [valid_poly]
            if polygon[0][0] != polygon[0][-1]:
                polygon[0].append(polygon[0][0])
            # Ensure bounds_payload is a dict (linter fix)
            if isinstance(bounds_payload, dict): # This check is redundant as bounds_payload is initialized as Dict[str, Any]
                bounds_payload["geometry"] = {"type": "Polygon", "coordinates": polygon}

    # Evalscript que calcula NDVI e retorna stats
    evalscript = """
    //VERSION=3
    function setup() {
      return {
        input: [{ bands: ["B04", "B08", "dataMask"] }],
        output: [
          { id: "ndvi", bands: 1 },
          { id: "dataMask", bands: 1 }
        ]
      };
    }
    function evaluatePixel(samples) {
      let ndvi = (samples.B08 - samples.B04) / (samples.B08 + samples.B04);
      return {
        ndvi: [ndvi],
        dataMask: [samples.dataMask]
      };
    }
    """

    payload = {
        "input": {
            "bounds": bounds_payload,
            "data": [
                {
                    "type": "sentinel-2-l2a",
                    "dataFilter": {
                        "maxCloudCoverage": 30,
                        "timeRange": {
                            "from": (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%dT00:00:00Z"),
                            "to": datetime.now().strftime("%Y-%m-%dT23:59:59Z")
                        }
                    }
                }
            ]
        },
        "aggregation": {
            "timeRange": {
                "from": (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%dT00:00:00Z"),
                "to": datetime.now().strftime("%Y-%m-%dT23:59:59Z")
            },
            "aggregationInterval": {"of": "P30D"},
            "evalscript": evalscript,
            "resx": 10,
            "resy": 10
        }
    }

    try:
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        with httpx.Client() as client:
            response = client.post("https://services.sentinel-hub.com/api/v1/statistics", headers=headers, json=payload, timeout=30.0)
            response.raise_for_status()
            data = response.json()
        
        # Parseando o resultado (simplificado para pegar o primeiro entry)
        output = data.get("data", [])[0].get("outputs", {}).get("ndvi", {}).get("bands", {}).get("B0", {}).get("stats", {})
        
        # Se nao houver dados reais, retornamos None para o fallback cuidar
        if not output or output.get("count", 0) == 0:
            return None
            
        return {
            "ndvi_avg": output.get("mean", 0),
            "ndvi_max": output.get("max", 0),
            "ndvi_min": output.get("min", 0),
            "count": output.get("count", 0),
            "cloud_coverage": None # Indisponivel sem extracao explicita de nuvens
        }
    except Exception as e:
        logging.warning(f"Erro ao buscar estatisticas Sentinel: {str(e)}")
        return None

def get_ndvi_image(lat: float, lng: float, boundaries: Optional[List[List[float]]] = None, date_range_days: int = 15):
    token = get_oauth_token()
    if not token:
        return None
        
    bbox = get_bbox_from_boundaries(boundaries, lat, lng)
    
    # Deterministic stats first!
    stats = get_ndvi_stats(bbox, boundaries)
    
    to_date = datetime.now().strftime("%Y-%m-%d")
    
    evalscript = """
    //VERSION=3
    function setup() {
      return { input: ["B04","B08","dataMask"], output: { bands: 4 } };
    }
    function evaluatePixel(s) {
      let ndvi = (s.B08 - s.B04) / (s.B08 + s.B04);
      if (s.dataMask === 0) return [0,0,0,0];
      if (ndvi < 0)    return [0.5, 0.5, 0.5, 1]; // solo/água
      if (ndvi < 0.2)  return [0.8, 0.2, 0.1, 1]; // vermelho: crítico
      if (ndvi < 0.4)  return [0.9, 0.7, 0.1, 1]; // amarelo: estresse
      if (ndvi < 0.6)  return [0.4, 0.8, 0.2, 1]; // verde claro: ok
      return [0.1, 0.5, 0.1, 1];                   // verde escuro: ótimo
    }
    """
    
    # Attempt with date_range_days then fallback to 30
    attempts = [date_range_days, 30]
    
    for days in attempts:
        f_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        payload = {
            "input": {
                "bounds": {
                    "bbox": bbox,
                    "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"}
                },
                "data": [
                    {
                        "type": "sentinel-2-l2a",
                        "dataFilter": {
                            "timeRange": {"from": f"{f_date}T00:00:00Z", "to": f"{to_date}T23:59:59Z"},
                            "maxCloudCoverage": 30
                        }
                    }
                ]
            },
            "output": {
                "width": 512, "height": 512,
                "responses": [{"identifier": "default", "format": {"type": "image/png"}}]
            },
            "evalscript": evalscript
        }
        
        # Add real geometry for masking if available
        if boundaries is not None and len(boundaries) >= 3:
            # Explicit float conversion and safe indexing
            valid_poly = []
            for p in boundaries:
                if p is not None and len(p) >= 2:
                    valid_poly.append([float(p[1]), float(p[0])])
            
            if len(valid_poly) >= 3:
                polygon = [valid_poly]
                if polygon[0][0] != polygon[0][-1]:
                    polygon[0].append(polygon[0][0])
                # Ensure payload is a dict (linter fix)
                if isinstance(payload, dict):
                    payload["input"]["bounds"]["geometry"] = {"type": "Polygon", "coordinates": polygon}

        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        try:
            logging.info(f"Fetching Sentinel NDVI for {lat}, {lng} (Polygon-based)")
            with httpx.Client() as client:
                response = client.post("https://services.sentinel-hub.com/api/v1/process", headers=headers, json=payload, timeout=60.0)
                response.raise_for_status()
                
                import base64
                image_base64 = base64.b64encode(response.content).decode('utf-8')
            
            return {
                "image_base64": image_base64,
                "date_acquired": f"{to_date} (Aproximado)", # Explicit fallback date
                "cloud_coverage": None, # Fallback explicitly empty so UI shows N/D instead of fake 20
                "stats": stats,
                "is_polygonal": boundaries is not None and len(boundaries) >= 3
            }
        except Exception as e:
            logging.error(f"Error fetching Sentinel NDVI: {str(e)}")
            continue
            
    return None


def get_latest_scene_metadata(
    lat: float,
    lng: float,
    boundaries: Optional[List[List[float]]] = None,
    lookback_days: int = 21,
    max_cloud_coverage: int = 40,
):
    """
    Busca metadados da cena Sentinel-2 mais recente (Earth Search STAC).
    Nao baixa tiles COG nem tenta montar XYZ a partir dos assets.
    """
    now_utc = datetime.utcnow()

    def _build_intersects() -> Dict[str, Any]:
        if boundaries and len(boundaries) >= 3:
            ring: List[List[float]] = []
            for p in boundaries:
                if p is not None and len(p) >= 2:
                    ring.append([float(p[1]), float(p[0])])
            if len(ring) >= 3:
                if ring[0] != ring[-1]:
                    ring.append(ring[0])
                return {"type": "Polygon", "coordinates": [ring]}
        return {"type": "Point", "coordinates": [float(lng), float(lat)]}

    def _search_scene(window_days: int, cloud_limit: int) -> Optional[Dict[str, Any]]:
        start_utc = now_utc - timedelta(days=window_days)
        payload = {
            "collections": ["sentinel-2-l2a"],
            "limit": 1,
            "sortby": [{"field": "properties.datetime", "direction": "desc"}],
            "datetime": f"{start_utc.strftime('%Y-%m-%dT00:00:00Z')}/{now_utc.strftime('%Y-%m-%dT23:59:59Z')}",
            "intersects": _build_intersects(),
            "query": {"eo:cloud_cover": {"lte": cloud_limit}},
        }

        try:
            with httpx.Client() as client:
                res = client.post(EARTH_SEARCH_URL, json=payload, timeout=20.0)
                res.raise_for_status()
                features = res.json().get("features", [])
                if features:
                    return features[0]
        except Exception as exc:
            logging.warning("Erro ao consultar Earth Search STAC: %s", exc)
        return None

    feature = _search_scene(lookback_days, max_cloud_coverage) or _search_scene(45, 100)
    if not feature:
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

    properties = feature.get("properties", {})
    assets = feature.get("assets", {})
    scene_id = feature.get("id")
    scene_datetime = properties.get("datetime")
    cloud_coverage = properties.get("eo:cloud_cover")

    scene_date_iso = None
    scene_date_br = None
    if isinstance(scene_datetime, str):
        try:
            dt = datetime.fromisoformat(scene_datetime.replace("Z", "+00:00"))
            scene_date_iso = dt.date().isoformat()
            scene_date_br = dt.strftime("%d/%m/%Y")
        except ValueError:
            pass

    preview_url = None
    for key in ("thumbnail", "preview", "rendered_preview"):
        candidate = assets.get(key, {}).get("href") if isinstance(assets.get(key), dict) else None
        if isinstance(candidate, str) and candidate.startswith("http"):
            preview_url = candidate
            break

    instance_id = _resolve_instance_id()
    logging.warning(
        "[Sentinel WMS] SENTINEL_INSTANCE_ID=%r, resolved=%r (type: %s), display_mode=%s",
        os.getenv("SENTINEL_INSTANCE_ID"),
        instance_id if instance_id else None,
        type(instance_id).__name__,
        "wms" if instance_id else "preview",
    )
    print(
        f"[Sentinel WMS] INSTANCE_ID={os.getenv('SENTINEL_INSTANCE_ID')!r}"
        f" resolved={instance_id!r} type={type(instance_id).__name__}"
        f" display_mode={'wms' if instance_id else 'preview'}",
        flush=True,
        file=sys.stdout,
    )
    # Sempre usa o proxy autenticado — ignora Instance ID legado
    return {
        "status": "ok",
        "provider": "Copernicus Sentinel-2 L2A (Process API)",
        "display_mode": "proxy",
        "scene_date": scene_date_iso,
        "scene_date_br": scene_date_br,
        "scene_id": scene_id,
        "cloud_coverage": cloud_coverage,
        "preview_url": preview_url,
        "wms_url": None,
        "wms_params": None,
        "message": None,
    }
