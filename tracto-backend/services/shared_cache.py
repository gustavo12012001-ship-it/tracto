"""
(A-03) Cache compartilhado com backend opcional de Redis.

Problema: o backend roda como processo único hoje, então caches em memória
(entitlements, contadores) funcionam. Ao escalar para múltiplas instâncias
(replicas/serverless), cada processo teria seu próprio cache -> entitlements
inconsistentes e contadores de uso furados.

Solução: uma abstração única (`cache`) que:
  • usa Redis se `REDIS_URL` estiver definida E o pacote `redis` instalado;
  • caso contrário, cai para um backend em memória com TTL (modo single-instance).

API (string-based, igual ao Redis):
  get_json(key) / set_json(key, obj, ttl_seconds)
  delete(key)
  incr(key, ttl_seconds) -> int     # contador atômico com expiração

Sem REDIS_URL nada muda no comportamento atual (fallback local).
"""

from __future__ import annotations

import json
import logging
import os
import threading
import time
from typing import Any

_log = logging.getLogger(__name__)


class _LocalBackend:
    """Backend em memória com TTL. Seguro para um único processo."""

    def __init__(self) -> None:
        self._d: dict[str, tuple[str, float | None]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> str | None:
        with self._lock:
            entry = self._d.get(key)
            if entry is None:
                return None
            value, expire_at = entry
            if expire_at is not None and time.monotonic() > expire_at:
                self._d.pop(key, None)
                return None
            return value

    def set(self, key: str, value: str, ttl_seconds: float | None) -> None:
        with self._lock:
            expire_at = (time.monotonic() + ttl_seconds) if ttl_seconds else None
            self._d[key] = (value, expire_at)

    def delete(self, key: str) -> None:
        with self._lock:
            self._d.pop(key, None)

    def incr(self, key: str, ttl_seconds: float | None) -> int:
        with self._lock:
            now = time.monotonic()
            entry = self._d.get(key)
            if entry is not None and (entry[1] is None or now <= entry[1]):
                value = int(entry[0]) + 1
                expire_at = entry[1]
            else:
                value = 1
                expire_at = (now + ttl_seconds) if ttl_seconds else None
            self._d[key] = (str(value), expire_at)
            return value


class _RedisBackend:
    """Backend Redis — compartilhado entre instâncias."""

    def __init__(self, client: Any) -> None:
        self._r = client

    def get(self, key: str) -> str | None:
        v = self._r.get(key)
        if v is None:
            return None
        return v.decode("utf-8") if isinstance(v, (bytes, bytearray)) else str(v)

    def set(self, key: str, value: str, ttl_seconds: float | None) -> None:
        if ttl_seconds:
            self._r.set(key, value, ex=int(ttl_seconds))
        else:
            self._r.set(key, value)

    def delete(self, key: str) -> None:
        self._r.delete(key)

    def incr(self, key: str, ttl_seconds: float | None) -> int:
        value = int(self._r.incr(key))
        if value == 1 and ttl_seconds:
            self._r.expire(key, int(ttl_seconds))
        return value


def _build_backend():
    url = os.getenv("REDIS_URL")
    if not url:
        return _LocalBackend(), "local"
    try:
        import redis  # type: ignore
    except ImportError:
        _log.warning(
            "[cache] REDIS_URL definido mas pacote 'redis' não instalado; "
            "usando cache local. Rode: pip install redis"
        )
        return _LocalBackend(), "local"
    try:
        client = redis.Redis.from_url(url, socket_timeout=2, socket_connect_timeout=2)
        client.ping()
        _log.info("[cache] Redis conectado — cache compartilhado ativo.")
        return _RedisBackend(client), "redis"
    except Exception as exc:  # noqa: BLE001
        _log.warning("[cache] Falha ao conectar no Redis (%s); usando cache local.", exc)
        return _LocalBackend(), "local"


class SharedCache:
    """Fachada única usada pelo resto do código."""

    def __init__(self) -> None:
        self._backend, self.kind = _build_backend()

    def get_json(self, key: str) -> Any | None:
        raw = self._backend.get(key)
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except (ValueError, TypeError):
            return None

    def set_json(self, key: str, obj: Any, ttl_seconds: float | None = None) -> None:
        try:
            self._backend.set(key, json.dumps(obj, default=str), ttl_seconds)
        except Exception as exc:  # noqa: BLE001
            _log.debug("[cache] set_json falhou (%s): %s", key, exc)

    def delete(self, key: str) -> None:
        try:
            self._backend.delete(key)
        except Exception as exc:  # noqa: BLE001
            _log.debug("[cache] delete falhou (%s): %s", key, exc)

    def incr(self, key: str, ttl_seconds: float | None = None) -> int:
        return self._backend.incr(key, ttl_seconds)


# Singleton — escolhido uma vez no import conforme REDIS_URL.
cache = SharedCache()
