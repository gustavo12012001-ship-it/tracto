"""
Testes A-08 — descoberta/ordenação de migrations (lógica pura, sem banco).
"""

from pathlib import Path

import migrate


def _touch(d: Path, name: str) -> None:
    (d / name).write_text(f"-- {name}\nSELECT 1;\n", encoding="utf-8")


def test_discover_orders_schema_first_then_numeric(tmp_path):
    _touch(tmp_path, "10_billing.sql")
    _touch(tmp_path, "schema.sql")
    _touch(tmp_path, "02_commercial.sql")
    _touch(tmp_path, "09_cache.sql")
    pending = migrate.discover_migrations(tmp_path, applied=set())
    names = [p.name for p in pending]
    assert names == ["schema.sql", "02_commercial.sql", "09_cache.sql", "10_billing.sql"]


def test_discover_skips_applied(tmp_path):
    _touch(tmp_path, "schema.sql")
    _touch(tmp_path, "02_commercial.sql")
    _touch(tmp_path, "03_extra.sql")
    pending = migrate.discover_migrations(tmp_path, applied={"schema.sql", "02_commercial.sql"})
    assert [p.name for p in pending] == ["03_extra.sql"]


def test_discover_excludes_utility_files(tmp_path):
    _touch(tmp_path, "schema.sql")
    _touch(tmp_path, "verify_schema.sql")  # utilitário, não migration
    pending = migrate.discover_migrations(tmp_path, applied=set())
    assert "verify_schema.sql" not in [p.name for p in pending]


def test_real_sql_dir_includes_chat_usage_and_postgis():
    """O diretório real deve conter 11_chat_usage.sql e 12_postgis_fields.sql."""
    pending = migrate.discover_migrations(migrate.SQL_DIR, applied=set())
    names = [p.name for p in pending]
    assert "11_chat_usage.sql" in names
    assert "12_postgis_fields.sql" in names
    # schema.sql sempre aparece antes de qualquer NN_*.sql
    assert names.index("schema.sql") == 0


def test_checksum_is_stable(tmp_path):
    _touch(tmp_path, "a.sql")
    c1 = migrate.checksum(tmp_path / "a.sql")
    c2 = migrate.checksum(tmp_path / "a.sql")
    assert c1 == c2 and len(c1) == 64
