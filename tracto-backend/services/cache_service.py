import json
import logging
import os
import time
import threading
from typing import Any, Dict

CACHE_FILE = ".cache/analysis_cache.json"

_log = logging.getLogger(__name__)


class AnalysisCache:
    """
    Cache persistente em arquivo JSON para resultados de análise e IA.
    Thread-safe. Escrita atômica via arquivo temporário.

    Nota de deploy:
    - ambientes serverless tem filesystem efemero: o arquivo pode ser perdido em reinicializacoes.
    - Isso é tolerável — a classe degrada para modo in-memory automaticamente
      quando o diretório não é gravável (e loga um warning na primeira tentativa).
    - Para persistência real entre deploys, migre para Redis ou Supabase.
    """

    def __init__(self):
        self._cache_file = CACHE_FILE
        self._lock = threading.Lock()
        self._file_disabled = False   # True se o filesystem não for gravável
        self._cache: Dict[str, Any] = {}

        self._try_init_fs()

    # ── Filesystem helpers ───────────────────────────────────────────────────

    def _try_init_fs(self) -> None:
        """Tenta criar o diretório e carregar o cache em disco. Desativa
        silenciosamente o arquivo se o ambiente não permitir escrita."""
        try:
            os.makedirs(os.path.dirname(self._cache_file), exist_ok=True)
        except OSError as exc:
            _log.warning(
                "[cache] Diretório .cache não acessível (%s) — operando em modo in-memory.", exc
            )
            self._file_disabled = True
            return

        self._cache = self._load_cache()

    def _load_cache(self) -> Dict[str, Any]:
        if self._file_disabled:
            return {}
        with self._lock:
            if os.path.exists(self._cache_file):
                try:
                    with open(self._cache_file, "r", encoding="utf-8") as f:
                        return json.load(f)
                except (json.JSONDecodeError, IOError) as exc:
                    _log.warning("[cache] Arquivo de cache corrompido, resetando: %s", exc)
            return {}

    def _save_cache(self) -> None:
        """Grava o cache em disco via substituição atômica. No-op se o modo
        in-memory estiver ativo."""
        if self._file_disabled:
            return
        temp_file = self._cache_file + ".tmp"
        try:
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(self._cache, f, ensure_ascii=False, indent=2)
            os.replace(temp_file, self._cache_file)
        except OSError as exc:
            # Primeira falha: desativa arquivo e avisa (uma vez)
            if not self._file_disabled:
                _log.warning(
                    "[cache] Escrita em disco falhou (%s) — modo in-memory ativado.", exc
                )
                self._file_disabled = True
            try:
                os.remove(temp_file)
            except OSError:
                pass
        except Exception as exc:
            _log.debug("[cache] _save_cache erro inesperado: %s", exc)

    # ── Public API ───────────────────────────────────────────────────────────

    def set(self, key: str, value: Any, ttl_hours: float = 24.0) -> None:
        with self._lock:
            expire_at = time.time() + (ttl_hours * 3600)
            self._cache[key] = {"value": value, "expire_at": expire_at}
            self._save_cache()

    def get(self, key: str) -> Any | None:
        with self._lock:
            entry = self._cache.get(key)
            if entry is None:
                return None
            if time.time() < entry["expire_at"]:
                return entry["value"]
            # Entrada expirada — limpa
            del self._cache[key]
            self._save_cache()
            return None

    def delete(self, key: str) -> None:
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                self._save_cache()

    def delete_prefix(self, prefix: str) -> int:
        with self._lock:
            keys_to_remove = [k for k in self._cache if k.startswith(prefix)]
            if not keys_to_remove:
                return 0
            for k in keys_to_remove:
                del self._cache[k]
            self._save_cache()
            return len(keys_to_remove)

    def gc(self) -> int:
        """Remove TODAS as entradas expiradas. Retorna o número removido."""
        now = time.time()
        with self._lock:
            expired = [
                k for k, v in self._cache.items()
                if not isinstance(v, dict) or "expire_at" not in v or v["expire_at"] <= now
            ]
            if not expired:
                return 0
            for k in expired:
                del self._cache[k]
            self._save_cache()
            return len(expired)

    def stats(self) -> dict:
        """Métricas de observabilidade."""
        with self._lock:
            now = time.time()
            total = len(self._cache)
            expired = sum(
                1 for v in self._cache.values()
                if isinstance(v, dict) and v.get("expire_at", 0) <= now
            )
            return {
                "total": total,
                "expired": expired,
                "active": total - expired,
                "file_disabled": self._file_disabled,
            }


# Global instance
analysis_cache = AnalysisCache()


def start_cache_gc_task(interval_seconds: int = 3600) -> None:
    """
    Inicia thread daemon que roda gc() a cada N segundos.
    Chame uma vez na startup do FastAPI (lifespan).
    """
    def _loop():
        while True:
            time.sleep(interval_seconds)
            try:
                removed = analysis_cache.gc()
                if removed > 0:
                    _log.info("[cache_gc] removidas %d entradas expiradas", removed)
            except Exception as exc:
                _log.warning("[cache_gc] erro durante GC: %s", exc)

    t = threading.Thread(target=_loop, daemon=True, name="cache-gc")
    t.start()
    _log.info("[cache_gc] background task iniciada, interval=%ds", interval_seconds)
