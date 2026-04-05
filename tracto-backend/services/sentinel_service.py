import os
import sys
import httpx
import logging
import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

EARTH_SEARCH_URL = "https://earth-search.aws.element84.com/v1/search"
SENTINEL_OAUTH_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token"
SENTINEL_WMS_BASE = "https://sh.dataspace.copernicus.eu/ogc/wms"
TOKEN_TTL_MINUTES = 55

_TOKEN_CACHE: Optional[str] = None
_TOKEN_CACHE_EXPIRES_AT: Optional[datetime] = None


def _resolve_instance_id() -> Optional[str]:
    instance_id = (
        (os.getenv("SENTINEL_INSTANCE_ID") or "").strip()
        or (os.getenv("SENTINEL_HUB_INSTANCE_ID") or "").strip()
        or (os.getenv("SH_INSTANCE_ID") or "").strip()
        or (os.getenv("VITE_SENTINEL_INSTANCE_ID") or "").strip()
    )
    return instance_id or None


def _tile_bbox_epsg_3857(z: int, x: int, y: int) -> str:
    if z < 0:
        raise ValueError("Zoom invalido para tile Sentinel.")

    tiles_per_axis = 2 ** z
    if x < 0 or y < 0 or x >= tiles_per_axis or y >= tiles_per_axis:
        raise ValueError("Coordenadas x/y invalidas para o zoom informado.")

    origin_shift = 20037508.342789244
    tile_size = (2 * origin_shift) / tiles_per_axis

    min_x = -origin_shift + (x * tile_size)
    max_x = -origin_shift + ((x + 1) * tile_size)
    max_y = origin_shift - (y * tile_size)
    min_y = origin_shift - ((y + 1) * tile_size)

    return f"{min_x},{min_y},{max_x},{max_y}"


def get_oauth_token(force_refresh: bool = False):
    global _TOKEN_CACHE, _TOKEN_CACHE_EXPIRES_AT

    client_id = os.getenv("SENTINEL_CLIENT_ID")
    client_secret = os.getenv("SENTINEL_CLIENT_SECRET")

    if not client_id or not client_secret:
        logging.error("SENTINEL credentials not configured.")
        return None

    now_utc = datetime.utcnow()
    if (
        not force_refresh
        and _TOKEN_CACHE
        and _TOKEN_CACHE_EXPIRES_AT
        and now_utc < _TOKEN_CACHE_EXPIRES_AT
    ):
        return _TOKEN_CACHE
        
    try:
        with httpx.Client() as client:
            response = client.post(
                SENTINEL_OAUTH_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": client_id,
                    "client_secret": client_secret
                }
            )
            response.raise_for_status()
            token = response.json().get("access_token")
            if not token:
                logging.error("Sentinel OAuth respondeu sem access_token.")
                return None

            _TOKEN_CACHE = token
            _TOKEN_CACHE_EXPIRES_AT = now_utc + timedelta(minutes=TOKEN_TTL_MINUTES)
            return token
    except Exception as e:
        logging.error(f"Error getting Sentinel OAuth token: {str(e)}")
        return None


def get_sentinel_tile_jpeg(z: int, x: int, y: int, scene_date: Optional[str] = None) -> bytes:
    try:
        instance_id = _resolve_instance_id()
        if not instance_id:
            raise ValueError("Sentinel nao configurado: SENTINEL_INSTANCE_ID ausente no backend.")

        token = get_oauth_token()
        if not token:
            raise ValueError("Nao foi possivel obter token OAuth do Sentinel.")

        wms_url = f"{SENTINEL_WMS_BASE}/{instance_id}"

        headers = {"Authorization": f"Bearer {token}"}
        bbox = _tile_bbox_epsg_3857(z, x, y)
        last_error: Optional[Exception] = None

        with httpx.Client() as client:
            for days_back in (10, 20):
                today_utc = datetime.utcnow()
                start_date = (today_utc - timedelta(days=days_back)).strftime("%Y-%m-%d")
                end_date = today_utc.strftime("%Y-%m-%d")
                time_param = f"{start_date}/{end_date}"

                params = {
                    "SERVICE": "WMS",
                    "VERSION": "1.3.0",
                    "REQUEST": "GetMap",
                    "LAYERS": "TRUE-COLOR",
                    "FORMAT": "image/jpeg",
                    "TRANSPARENT": "false",
                    "WIDTH": "256",
                    "HEIGHT": "256",
                    "CRS": "EPSG:3857",
                    "BBOX": bbox,
                    "TIME": time_param,
                }

                try:
                    response = client.get(wms_url, params=params, headers=headers, timeout=15.0)
                    if response.status_code == 401:
                        refreshed_token = get_oauth_token(force_refresh=True)
                        if not refreshed_token:
                            raise ValueError("Token Sentinel expirado e falha ao renovar OAuth.")
                        headers = {"Authorization": f"Bearer {refreshed_token}"}
                        response = client.get(wms_url, params=params, headers=headers, timeout=15.0)

                    response.raise_for_status()
                    if response.content:
                        logging.info(
                            "[Sentinel Tile] Tile recente obtido com janela de %s dias (%s)",
                            days_back,
                            time_param,
                        )
                        return response.content
                except Exception as exc:
                    last_error = exc
                    logging.warning(
                        "[Sentinel Tile] Falha ao buscar tile com janela de %s dias (%s): %s",
                        days_back,
                        time_param,
                        exc,
                    )

        if last_error:
            raise last_error
        raise ValueError("Nao foi possivel obter tile Sentinel recente.")
    except Exception as e:
        logging.error(f"[Sentinel Tile] Erro real: z={z} x={x} y={y} -> {str(e)}")
        raise

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
    if instance_id and isinstance(instance_id, str) and len(instance_id) > 0:
        time_param = scene_date_iso if scene_date_iso else now_utc.strftime("%Y-%m-%d")
        return {
            "status": "ok",
            "provider": "Copernicus Data Space (ESA)",
            "display_mode": "wms",
            "scene_date": scene_date_iso,
            "scene_date_br": scene_date_br,
            "scene_id": scene_id,
            "cloud_coverage": cloud_coverage,
            "wms_url": f"https://sh.dataspace.copernicus.eu/ogc/wms/{instance_id}",
            "wms_params": {
                "layers": "TRUE_COLOR",
                "format": "image/png",
                "transparent": False,
                "time": f"{time_param}/{time_param}",
            },
            "preview_url": preview_url,
            "message": None,
        }

    return {
        "status": "ok",
        "provider": "Earth Search STAC (preview)",
        "display_mode": "preview",
        "scene_date": scene_date_iso,
        "scene_date_br": scene_date_br,
        "scene_id": scene_id,
        "cloud_coverage": cloud_coverage,
        "preview_url": preview_url,
        "wms_url": None,
        "wms_params": None,
        "message": "Preview estatico da ultima cena (fallback ilustrativo). Nao georreferenciado com precisao.",
    }
