"""
analysis_history_service.py — Salva e consulta histórico de análises de talhões.

Tabela Supabase: field_analyses
  - id            UUID primary key default gen_random_uuid()
  - field_id      UUID references fields(id) on delete cascade
  - user_id       UUID references auth.users(id) on delete cascade
  - analyzed_at   timestamptz default now()
  - ndvi_medio    float8
  - cloud_coverage float8
  - zona_saudavel_pct float8
  - zona_critica_pct  float8
  - ai_report     text
  - date_acquired text
  - is_mock       bool default false

Operações são best-effort: nunca lançam exceção para não quebrar o fluxo principal.
"""

import logging
import os

import requests

_REQUEST_TIMEOUT = 8


def _headers() -> dict[str, str]:
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }


def _table_url() -> str:
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    return f"{base}/rest/v1/field_analyses"


def _extract_ndvi_zones(analysis_data: dict) -> tuple[float | None, float | None]:
    """Extrai zona_saudavel_pct e zona_critica_pct do dict de análise NDVI."""
    ndvi_analysis = analysis_data.get("ndvi_analysis") or {}
    if not isinstance(ndvi_analysis, dict):
        return None, None

    # Tenta extrair das zonas diretamente
    zones = ndvi_analysis.get("zones") or ndvi_analysis.get("zonas") or {}
    if isinstance(zones, dict):
        saudavel = zones.get("healthy") or zones.get("saudavel") or zones.get("zona_saudavel_pct")
        critica = zones.get("critical") or zones.get("critica") or zones.get("zona_critica_pct")
        return (
            float(saudavel) if saudavel is not None else None,
            float(critica) if critica is not None else None,
        )

    # Tenta extrair direto do ndvi_analysis
    saudavel = ndvi_analysis.get("zona_saudavel_pct") or ndvi_analysis.get("healthy_pct")
    critica = ndvi_analysis.get("zona_critica_pct") or ndvi_analysis.get("critical_pct")
    return (
        float(saudavel) if saudavel is not None else None,
        float(critica) if critica is not None else None,
    )


def _extract_ndvi_medio(analysis_data: dict) -> float | None:
    """Extrai NDVI médio do dict de análise."""
    ndvi_analysis = analysis_data.get("ndvi_analysis") or {}
    if not isinstance(ndvi_analysis, dict):
        return None
    for key in ("ndvi_medio", "ndvi_mean", "mean", "ndvi_avg", "average"):
        val = ndvi_analysis.get(key)
        if val is not None:
            try:
                return float(val)
            except (TypeError, ValueError):
                pass
    return None


async def save_analysis(
    supabase_client,  # noqa: ARG001 — aceito mas usamos requests direto para consistência
    field_id: str,
    user_id: str,
    analysis_data: dict,
) -> None:
    """
    Persiste uma análise no Supabase. Operação best-effort: nunca lança exceção.

    Parameters
    ----------
    supabase_client : Client (supabase-py) — aceito por assinatura mas não utilizado
        internamente (usamos requests para manter padrão do projeto).
    field_id : str
    user_id : str
    analysis_data : dict — dict retornado pelo endpoint /api/analyze-field
    """
    try:
        ndvi_medio = _extract_ndvi_medio(analysis_data)
        zona_saudavel, zona_critica = _extract_ndvi_zones(analysis_data)

        cloud_coverage = analysis_data.get("cloud_coverage")
        ai_report = analysis_data.get("ai_report")
        date_acquired = analysis_data.get("date_acquired")
        is_mock = bool(analysis_data.get("is_mock", False))

        payload: dict = {
            "field_id": field_id,
            "user_id": user_id,
            "is_mock": is_mock,
        }

        if ndvi_medio is not None:
            payload["ndvi_medio"] = ndvi_medio
        if cloud_coverage is not None:
            try:
                payload["cloud_coverage"] = float(cloud_coverage)
            except (TypeError, ValueError):
                pass
        if zona_saudavel is not None:
            payload["zona_saudavel_pct"] = zona_saudavel
        if zona_critica is not None:
            payload["zona_critica_pct"] = zona_critica
        if ai_report:
            payload["ai_report"] = str(ai_report)
        if date_acquired:
            payload["date_acquired"] = str(date_acquired)

        url = _table_url()
        if not url.startswith("http"):
            logging.warning("[analysis_history] SUPABASE_URL não configurada — análise não salva.")
            return

        resp = requests.post(
            url,
            json=payload,
            headers=_headers(),
            timeout=_REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        logging.info(
            "[analysis_history] Análise salva field_id=%s user_id=%s ndvi=%.3f",
            field_id,
            user_id,
            ndvi_medio or 0.0,
        )
    except Exception as exc:
        logging.warning(
            "[analysis_history] Falha ao salvar análise (best-effort) field_id=%s: %s",
            field_id,
            exc,
        )


async def get_field_analyses(
    supabase_client,  # noqa: ARG001
    field_id: str,
    user_id: str,
    limit: int = 30,
) -> list[dict]:
    """
    Retorna histórico de análises do talhão. Retorna lista vazia em caso de erro.

    Os resultados são ordenados por analyzed_at DESC (mais recente primeiro).
    """
    try:
        url = _table_url()
        if not url.startswith("http"):
            logging.warning("[analysis_history] SUPABASE_URL não configurada — retornando lista vazia.")
            return []

        headers = _headers()
        # Para leitura usamos Prefer: return=representation
        headers["Prefer"] = "return=representation"

        resp = requests.get(
            url,
            headers=headers,
            params={
                "field_id": f"eq.{field_id}",
                "user_id": f"eq.{user_id}",
                "order": "analyzed_at.desc",
                "limit": str(min(limit, 100)),
                "select": (
                    "id,field_id,user_id,analyzed_at,"
                    "ndvi_medio,cloud_coverage,"
                    "zona_saudavel_pct,zona_critica_pct,"
                    "ai_report,date_acquired,is_mock"
                ),
            },
            timeout=_REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        rows = resp.json()
        return rows if isinstance(rows, list) else []
    except Exception as exc:
        logging.warning(
            "[analysis_history] Falha ao buscar análises field_id=%s: %s",
            field_id,
            exc,
        )
        return []
