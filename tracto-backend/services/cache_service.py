import json
import os
import time
import threading
from typing import Any, Dict

CACHE_FILE = ".cache/analysis_cache.json"

class AnalysisCache:
    """
    Cache persistente em arquivo JSON para resultados de analise e IA.
    Esta implementacao e segura para threads e usa escrita atomica.
    Nota: Apropriado apenas para deploy de instância unica (single-instance).
    """
    def __init__(self):
        self._cache_file = CACHE_FILE
        self._lock = threading.Lock()
        self._ensure_cache_dir()
        self._cache = self._load_cache()

    def _ensure_cache_dir(self):
        os.makedirs(os.path.dirname(self._cache_file), exist_ok=True)

    def _load_cache(self) -> Dict[str, Any]:
        with self._lock:
            if os.path.exists(self._cache_file):
                try:
                    with open(self._cache_file, "r", encoding="utf-8") as f:
                        return json.load(f)
                except (json.JSONDecodeError, IOError) as e:
                    # Se o arquivo estiver corrompido, resetar para evitar crash
                    # Em Etapa 2/3 poderiamos ter backup
                    return {}
            return {}

    def _save_cache(self):
        # Nao precisa de lock aqui se for chamado dentro de um metodo que ja tem lock
        temp_file = self._cache_file + ".tmp"
        try:
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(self._cache, f, ensure_ascii=False, indent=2)
            # Substituicao atomica
            os.replace(temp_file, self._cache_file)
        except Exception:
            # Silencioso para nao quebrar a requisicao principal, mas logar seria ideal
            if os.path.exists(temp_file):
                try: os.remove(temp_file)
                except: pass

    def set(self, key: str, value: Any, ttl_hours: float = 24.0):
        with self._lock:
            expire_at = time.time() + (ttl_hours * 3600)
            self._cache[key] = {
                "value": value,
                "expire_at": expire_at
            }
            self._save_cache()

    def get(self, key: str) -> Any | None:
        with self._lock:
            if key in self._cache:
                entry = self._cache[key]
                if time.time() < entry["expire_at"]:
                    return entry["value"]
                else:
                    # Expired
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
            keys_to_remove = [key for key in self._cache.keys() if key.startswith(prefix)]
            if not keys_to_remove:
                return 0

            for key in keys_to_remove:
                del self._cache[key]

            self._save_cache()
            return len(keys_to_remove)

    def gc(self) -> int:
        """
        Remove TODAS as entradas expiradas. Chamado por background task.
        Retorna número de entradas removidas.
        """
        now = time.time()
        with self._lock:
            expired = [k for k, v in self._cache.items()
                       if not isinstance(v, dict) or "expire_at" not in v
                       or v["expire_at"] <= now]
            if not expired:
                return 0
            for k in expired:
                del self._cache[k]
            self._save_cache()
            return len(expired)

    def stats(self) -> dict:
        """Métricas pra observabilidade."""
        with self._lock:
            now = time.time()
            total = len(self._cache)
            expired = sum(
                1 for v in self._cache.values()
                if isinstance(v, dict) and v.get("expire_at", 0) <= now
            )
            return {"total": total, "expired": expired, "active": total - expired}


# Global instance
analysis_cache = AnalysisCache()


def start_cache_gc_task(interval_seconds: int = 3600) -> None:
    """
    Inicia thread daemon que roda gc() a cada N segundos.
    Chame uma vez na startup do FastAPI (lifespan ou startup event).
    """
    import logging

    def _loop():
        while True:
            time.sleep(interval_seconds)
            try:
                removed = analysis_cache.gc()
                if removed > 0:
                    logging.info("[cache_gc] removed %d expired entries", removed)
            except Exception as exc:
                logging.warning("[cache_gc] erro durante GC: %s", exc)

    t = threading.Thread(target=_loop, daemon=True, name="cache-gc")
    t.start()
    logging.info("[cache_gc] background task started, interval=%ds", interval_seconds)
