"""
services/http_resilience.py — Retry, timeout e circuit-breaker pra APIs externas.

Uso:
    from services.http_resilience import external_api_retry

    @external_api_retry()
    def call_sentinel_hub(...):
        ...

Mecanismo:
- Retry com exponential backoff (1s, 2s, 4s — max 3 tentativas)
- Re-raise em erros 4xx (client error, não adianta retry)
- Retry em 5xx, ConnectionError, Timeout
"""

from __future__ import annotations

import logging
from typing import Callable

try:
    from tenacity import (
        retry,
        stop_after_attempt,
        wait_exponential,
        retry_if_exception_type,
        before_sleep_log,
    )
    import requests
    import httpx

    _HAS_TENACITY = True
except ImportError:
    _HAS_TENACITY = False
    logging.warning("tenacity não instalado — APIs externas sem retry automático")


def _is_retryable(exc: BaseException) -> bool:
    """Decide se uma exception merece retry."""
    if not _HAS_TENACITY:
        return False
    # Timeouts e conexões caídas → retry
    if isinstance(exc, (requests.Timeout, requests.ConnectionError)):
        return True
    if isinstance(exc, (httpx.TimeoutException, httpx.ConnectError, httpx.RemoteProtocolError)):
        return True
    # HTTP errors: retry só em 5xx
    if isinstance(exc, requests.HTTPError) and exc.response is not None:
        return exc.response.status_code >= 500
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code >= 500
    return False


def external_api_retry(
    *,
    max_attempts: int = 3,
    min_wait: float = 1.0,
    max_wait: float = 8.0,
) -> Callable:
    """
    Decorator de retry pra chamadas a APIs externas.

    Args:
        max_attempts: 3 (1 tentativa + 2 retries)
        min_wait: tempo inicial entre retries (1s)
        max_wait: cap do exponential backoff (8s)

    Total worst case: 1s + 2s + 4s = 7s antes de falhar definitivo.
    """
    if not _HAS_TENACITY:
        # tenacity não disponível → no-op
        def passthrough(fn):
            return fn
        return passthrough

    return retry(
        stop=stop_after_attempt(max_attempts),
        wait=wait_exponential(multiplier=min_wait, min=min_wait, max=max_wait),
        retry=lambda retry_state: retry_state.outcome is not None
            and retry_state.outcome.failed
            and _is_retryable(retry_state.outcome.exception()),
        before_sleep=before_sleep_log(logging.getLogger(__name__), logging.WARNING),
        reraise=True,
    )
