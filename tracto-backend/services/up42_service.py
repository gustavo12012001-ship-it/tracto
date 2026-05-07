# services/up42_service.py — Up42 marketplace integration
# Documentação: https://docs.up42.com/developers/api
# Autenticação: OAuth2 client_credentials
# Catálogo: STAC v1 em https://api.up42.com/v2/assets/stac/search

import io
import logging
import os
import time
import base64
from datetime import datetime, timedelta
from typing import Optional

import httpx

# ── Credenciais ───────────────────────────────────────────────────────────────

UP42_PROJECT_ID = os.getenv("UP42_PROJECT_ID", "")
UP42_PROJECT_API_KEY = os.getenv("UP42_PROJECT_API_KEY", "")

# ── Cache do token OAuth2 ─────────────────────────────────────────────────────

_token_cache: dict = {}


def _get_token() -> str:
    """Obtém token OAuth2 com cache de validade."""
    now = time.time()
    if _token_cache.get("token") and _token_cache.get("expires_at", 0) > now + 60:
        return _token_cache["token"]

    if not UP42_PROJECT_ID or not UP42_PROJECT_API_KEY:
        raise RuntimeError("UP42_PROJECT_ID e UP42_PROJECT_API_KEY não configurados.")

    credentials = base64.b64encode(
        f"{UP42_PROJECT_ID}:{UP42_PROJECT_API_KEY}".encode()
    ).decode()

    with httpx.Client(timeout=15) as client:
        resp = client.post(
            "https://api.up42.com/oauth/token",
            headers={
                "Authorization": f"Basic {credentials}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={"grant_type": "client_credentials"},
        )
        resp.raise_for_status()
        data = resp.json()
        _token_cache["token"] = data["access_token"]
        _token_cache["expires_at"] = now + int(data.get("expires_in", 3600))
        logging.info("[up42] Token OAuth2 renovado.")
        return _token_cache["token"]


# ── Providers mapeados por collection ─────────────────────────────────────────

_PROVIDER_MAP = {
    "PHR": ("Pléiades", 0.5),
    "PNEO": ("Pléiades Neo", 0.3),
    "SPOT": ("SPOT", 1.5),
    "SPOTSixScene": ("SPOT 6/7", 1.5),
    "SATELLOGIC": ("Satellogic", 0.7),
    "AIRBUS": ("Airbus", 0.5),
    "maxar": ("Maxar", 0.5),
}


def _detect_provider(collection: str, scene_id: str) -> tuple[str, Optional[float]]:
    col_upper = (collection or "").upper()
    for key, (name, res) in _PROVIDER_MAP.items():
        if key in col_upper:
            return name, res
    if "NEO" in col_upper:
        return "Pléiades Neo", 0.3
    if "PHR" in col_upper or "PLEIADES" in col_upper:
        return "Pléiades", 0.5
    return collection or "Up42", None


def _parse_stac_features(features: list) -> list[dict]:
    """Converte features STAC Up42 em lista de cenas para o frontend."""
    scenes = []
    for f in features:
        props = f.get("properties", {})
        assets = f.get("assets", {})
        collection = f.get("collection", "")

        provider, resolution = _detect_provider(collection, f.get("id", ""))

        # Data
        dt_str = props.get("datetime") or props.get("start_datetime", "")
        try:
            dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
            date = dt.strftime("%Y-%m-%d")
            date_br = dt.strftime("%d/%m/%Y")
        except Exception:
            date = dt_str[:10] if dt_str else ""
            date_br = date

        # Thumbnail / quicklook
        thumbnail_url: Optional[str] = None
        for key in ("thumbnail", "overview", "preview", "quicklook"):
            asset = assets.get(key, {})
            href = asset.get("href") or (asset if isinstance(asset, str) else None)
            if href:
                thumbnail_url = href
                break

        cloud = props.get("eo:cloud_cover") or props.get("cloudCoverage")
        scene_id = f.get("id", "")

        scenes.append(
            {
                "scene_id": scene_id,
                "date": date,
                "date_br": date_br,
                "cloud_coverage": float(cloud) if cloud is not None else None,
                "source": "up42",
                "collection": collection,
                "provider": provider,
                "resolution_m": resolution,
                "thumbnail_url": thumbnail_url,
                "orbit": props.get("sat:orbit_state"),
            }
        )

    # Ordena do mais recente para o mais antigo
    scenes.sort(key=lambda s: s["date"], reverse=True)
    return scenes


# ── Busca de cenas ─────────────────────────────────────────────────────────────

def search_up42_scenes(
    lat: float,
    lng: float,
    boundaries: Optional[list] = None,
    lookback_days: int = 90,
) -> list[dict]:
    """Busca cenas no catálogo STAC do Up42 para a área do talhão."""
    if not UP42_PROJECT_ID or not UP42_PROJECT_API_KEY:
        logging.warning("[up42] Credenciais não configuradas. Retornando lista vazia.")
        return []

    # Bounding box da área
    if boundaries and len(boundaries) >= 3:
        lats = [p[0] for p in boundaries]
        lngs = [p[1] for p in boundaries]
        bbox = [min(lngs), min(lats), max(lngs), max(lats)]
    else:
        delta = 0.005
        bbox = [lng - delta, lat - delta, lng + delta, lat + delta]

    end_dt = datetime.utcnow()
    start_dt = end_dt - timedelta(days=lookback_days)
    dt_range = f"{start_dt.strftime('%Y-%m-%dT%H:%M:%SZ')}/{end_dt.strftime('%Y-%m-%dT%H:%M:%SZ')}"

    try:
        token = _get_token()
        with httpx.Client(timeout=30) as client:
            resp = client.post(
                "https://api.up42.com/v2/assets/stac/search",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json={
                    "bbox": bbox,
                    "datetime": dt_range,
                    "limit": 40,
                    # Principais provedores disponíveis no Up42
                    # Deixamos sem filtro de collection para pegar todos os disponíveis
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                features = data.get("features", [])
                logging.info("[up42] %d cenas encontradas para bbox=%s", len(features), bbox)
                return _parse_stac_features(features)
            else:
                logging.warning(
                    "[up42] STAC search retornou %s: %s",
                    resp.status_code,
                    resp.text[:300],
                )
                return []
    except Exception as exc:
        logging.error("[up42] search_up42_scenes error: %s", exc)
        return []


# ── Overlay / Preview ─────────────────────────────────────────────────────────

def _get_stac_item(scene_id: str, token: str) -> Optional[dict]:
    """Busca item STAC pelo ID no Up42."""
    with httpx.Client(timeout=30) as client:
        # Tenta busca direta
        endpoints = [
            f"https://api.up42.com/v2/assets/stac/search",
        ]
        resp = client.post(
            endpoints[0],
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={"ids": [scene_id], "limit": 1},
        )
        if resp.ok:
            feats = resp.json().get("features", [])
            if feats:
                return feats[0]
    return None


def get_up42_overlay(
    scene_id: str,
    boundaries: list,
    lat: float = 0.0,
    lng: float = 0.0,
) -> dict:
    """
    Retorna dict com:
      - image_bytes: PNG da preview/thumbnail recortada
      - bounds: [south, west, north, east]
      - provider: nome do satélite
      - resolution_m: resolução em metros
    """
    if not UP42_PROJECT_ID or not UP42_PROJECT_API_KEY:
        raise RuntimeError("UP42_PROJECT_ID e UP42_PROJECT_API_KEY não configurados.")

    # Bounds do talhão
    if boundaries and len(boundaries) >= 3:
        lats = [p[0] for p in boundaries]
        lngs = [p[1] for p in boundaries]
        s, w, n, e = min(lats), min(lngs), max(lats), max(lngs)
    elif lat and lng:
        delta = 0.005
        s, w, n, e = lat - delta, lng - delta, lat + delta, lng + delta
    else:
        raise ValueError("Boundaries ou coordenadas necessárias para overlay.")

    bounds = [s, w, n, e]

    token = _get_token()
    item = _get_stac_item(scene_id, token)

    if not item:
        raise ValueError(f"Cena {scene_id} não encontrada no catálogo Up42.")

    assets = item.get("assets", {})
    provider, resolution = _detect_provider(
        item.get("collection", ""),
        scene_id,
    )

    # Tenta pegar thumbnail/overview diretamente
    thumbnail_url: Optional[str] = None
    for key in ("thumbnail", "overview", "preview", "quicklook"):
        asset = assets.get(key, {})
        href = asset.get("href") or (asset if isinstance(asset, str) else None)
        if href:
            thumbnail_url = href
            break

    if not thumbnail_url:
        raise ValueError(
            "Nenhum preview/thumbnail disponível para esta cena no Up42. "
            "Para imagens de alta resolução é necessário realizar um pedido (order)."
        )

    with httpx.Client(timeout=30, follow_redirects=True) as client:
        img_resp = client.get(
            thumbnail_url,
            headers={"Authorization": f"Bearer {token}"},
        )
        if not img_resp.is_success:
            raise ValueError(
                f"Falha ao baixar preview Up42: HTTP {img_resp.status_code}"
            )
        image_bytes = img_resp.content

    # Garante PNG
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes))
        out = io.BytesIO()
        img.save(out, format="PNG")
        image_bytes = out.getvalue()
    except Exception:
        pass  # Usa bytes originais se PIL falhar

    return {
        "image_bytes": image_bytes,
        "bounds": bounds,
        "provider": provider,
        "resolution_m": resolution,
    }
