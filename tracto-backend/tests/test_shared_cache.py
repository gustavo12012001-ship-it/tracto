"""
Testes A-03 — cache compartilhado (backend local; Redis é opt-in via REDIS_URL).
"""

import time

from services.shared_cache import SharedCache, _LocalBackend


def test_local_set_get_json():
    c = SharedCache()
    assert c.kind == "local"  # sem REDIS_URL nos testes
    c.set_json("k", {"a": 1})
    assert c.get_json("k") == {"a": 1}


def test_local_ttl_expiry():
    be = _LocalBackend()
    be.set("k", "v", ttl_seconds=0.05)
    assert be.get("k") == "v"
    time.sleep(0.1)
    assert be.get("k") is None


def test_local_delete():
    c = SharedCache()
    c.set_json("k", [1, 2, 3])
    c.delete("k")
    assert c.get_json("k") is None


def test_local_incr_with_ttl():
    be = _LocalBackend()
    assert be.incr("cnt", ttl_seconds=10) == 1
    assert be.incr("cnt", ttl_seconds=10) == 2
    assert be.incr("cnt", ttl_seconds=10) == 3


def test_incr_resets_after_expiry():
    be = _LocalBackend()
    assert be.incr("cnt", ttl_seconds=0.05) == 1
    time.sleep(0.1)
    assert be.incr("cnt", ttl_seconds=0.05) == 1  # contou de novo após expirar


def test_get_json_returns_none_for_missing():
    c = SharedCache()
    assert c.get_json("nope-missing") is None
