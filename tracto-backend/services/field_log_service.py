"""
field_log_service.py — Caderno de Campo: registros de operações agrícolas por talhão.

Tabela Supabase: field_logs
  - id              UUID primary key default gen_random_uuid()
  - field_id        UUID references fields(id) on delete cascade
  - user_id         UUID references auth.users(id) on delete cascade
  - logged_at       TIMESTAMPTZ default now()
  - operation_type  TEXT (pulverizacao/adubacao/irrigacao/colheita/observacao/outro)
  - product         TEXT
  - dose            TEXT
  - area_ha         FLOAT8
  - cost            FLOAT8
  - notes           TEXT
  - created_at      TIMESTAMPTZ default now()

Operações são best-effort para leituras; erros de escrita são propagados ao caller.
"""

import logging
import os

import requests

_REQUEST_TIMEOUT = 8
_SELECT_FIELDS = (
    "id,field_id,user_id,logged_at,operation_type,"
    "product,dose,area_ha,cost,notes,created_at"
)


def _headers(return_representation: bool = False) -> dict[str, str]:
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    prefer = "return=representation" if return_representation else "return=minimal"
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": prefer,
    }


def _table_url() -> str:
    base = os.getenv("SUPABASE_URL", "").rstrip("/")
    return f"{base}/rest/v1/field_logs"


async def create_log(field_id: str, user_id: str, data: dict) -> dict:
    """
    Cria um registro no caderno de campo.

    Parameters
    ----------
    field_id : str — UUID do talhão
    user_id  : str — UUID do usuário autenticado
    data     : dict — campos do FieldLogCreate (operation_type obrigatório)

    Returns
    -------
    dict com o registro criado (retornado pelo Supabase).

    Raises
    ------
    ValueError se SUPABASE_URL não estiver configurada.
    requests.HTTPError em caso de erro HTTP.
    """
    url = _table_url()
    if not url.startswith("http"):
        raise ValueError("[field_log] SUPABASE_URL não configurada.")

    payload: dict = {
        "field_id": field_id,
        "user_id": user_id,
        "operation_type": data["operation_type"],
    }

    for field in ("product", "dose", "notes"):
        val = data.get(field)
        if val is not None:
            payload[field] = str(val)

    for field in ("area_ha", "cost"):
        val = data.get(field)
        if val is not None:
            try:
                payload[field] = float(val)
            except (TypeError, ValueError):
                pass

    logged_at = data.get("logged_at")
    if logged_at:
        payload["logged_at"] = str(logged_at)

    headers = _headers(return_representation=True)
    # Retorna apenas o primeiro registro inserido
    headers["Accept"] = "application/json"

    resp = requests.post(
        url,
        json=payload,
        headers=headers,
        timeout=_REQUEST_TIMEOUT,
    )
    resp.raise_for_status()

    result = resp.json()
    if isinstance(result, list) and result:
        return result[0]
    if isinstance(result, dict):
        return result

    logging.warning("[field_log] create_log retornou resposta inesperada: %s", result)
    return payload


async def get_field_logs(field_id: str, user_id: str, limit: int = 50) -> list[dict]:
    """
    Retorna os logs do talhão ordenados por logged_at DESC.
    Retorna lista vazia em caso de erro (best-effort para leitura).
    """
    try:
        url = _table_url()
        if not url.startswith("http"):
            logging.warning("[field_log] SUPABASE_URL não configurada — retornando lista vazia.")
            return []

        headers = _headers(return_representation=True)

        resp = requests.get(
            url,
            headers=headers,
            params={
                "field_id": f"eq.{field_id}",
                "user_id": f"eq.{user_id}",
                "order": "logged_at.desc",
                "limit": str(min(limit, 200)),
                "select": _SELECT_FIELDS,
            },
            timeout=_REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        rows = resp.json()
        return rows if isinstance(rows, list) else []
    except Exception as exc:
        logging.warning(
            "[field_log] Falha ao buscar logs field_id=%s: %s",
            field_id,
            exc,
        )
        return []


async def delete_log(log_id: str, user_id: str) -> bool:
    """
    Deleta um log verificando que pertence ao user_id informado.

    Returns
    -------
    True se deletado com sucesso, False se não encontrado ou sem permissão.

    Raises
    ------
    requests.HTTPError em caso de erro HTTP inesperado (não 404).
    """
    try:
        url = _table_url()
        if not url.startswith("http"):
            logging.warning("[field_log] SUPABASE_URL não configurada — delete ignorado.")
            return False

        # O filtro user_id garante que o usuário só deleta seus próprios logs
        resp = requests.delete(
            url,
            headers=_headers(),
            params={
                "id": f"eq.{log_id}",
                "user_id": f"eq.{user_id}",
            },
            timeout=_REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        # Supabase retorna 204 No Content em caso de sucesso
        # Se nenhuma linha foi afetada (wrong user_id / not found), ainda retorna 204
        # Usamos Content-Range ou count header para checar
        content_range = resp.headers.get("Content-Range", "")
        if content_range and content_range.startswith("*/"):
            # "*/0" significa nenhum registro afetado
            try:
                count = int(content_range.split("/")[-1])
                return count > 0
            except (ValueError, IndexError):
                pass
        # 204 sem Content-Range = sucesso presumido
        return resp.status_code in (200, 204)
    except requests.HTTPError as exc:
        if exc.response is not None and exc.response.status_code == 404:
            return False
        logging.error("[field_log] Erro HTTP ao deletar log_id=%s: %s", log_id, exc)
        raise
    except Exception as exc:
        logging.error("[field_log] Erro inesperado ao deletar log_id=%s: %s", log_id, exc)
        return False
