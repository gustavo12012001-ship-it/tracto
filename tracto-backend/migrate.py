#!/usr/bin/env python3
"""
(A-08) Runner de migrations versionado para o Tracto.

Aplica os arquivos `.sql` de `tracto-backend/sql/` em ordem determinística,
registrando cada aplicação na tabela `public.schema_migrations`. É idempotente:
arquivos já aplicados (mesma versão) são pulados.

Conexão: usa a variável de ambiente DATABASE_URL (string de conexão Postgres do
Supabase — Settings > Database > Connection string > URI). NUNCA commite esse
valor; configure no ambiente de produção.

Uso:
    python migrate.py --status      # lista aplicadas x pendentes
    python migrate.py --dry-run     # mostra o que aplicaria, sem executar
    python migrate.py               # aplica as pendentes

A lógica de descoberta/ordenação (discover_migrations) é pura e testada em
tests/test_migrations.py — não exige banco.
"""

from __future__ import annotations

import hashlib
import os
import re
import sys
from pathlib import Path

SQL_DIR = Path(__file__).resolve().parent / "sql"

# Arquivos que NÃO são migrations aplicáveis (utilitários/documentação).
EXCLUDE = {"verify_schema.sql"}

MIGRATIONS_TABLE_DDL = """
CREATE TABLE IF NOT EXISTS public.schema_migrations (
    version    TEXT PRIMARY KEY,
    checksum   TEXT,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""


def _sort_key(name: str) -> tuple[int, str]:
    """schema.sql primeiro; depois ordena pelo prefixo numérico NN_."""
    if name == "schema.sql":
        return (-1, name)
    m = re.match(r"^(\d+)_", name)
    if m:
        return (int(m.group(1)), name)
    return (10_000, name)


def discover_migrations(sql_dir: Path, applied: set[str]) -> list[Path]:
    """
    Retorna os arquivos de migration PENDENTES, na ordem de aplicação.
    Pura e determinística — não toca no banco.
    """
    candidates = [
        p for p in sql_dir.glob("*.sql")
        if p.name not in EXCLUDE
    ]
    candidates.sort(key=lambda p: _sort_key(p.name))
    return [p for p in candidates if p.name not in applied]


def checksum(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _connect():
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        print(
            "ERRO: DATABASE_URL não configurada.\n"
            "Configure a connection string do Postgres (Supabase > Settings > "
            "Database > Connection string > URI) na variável de ambiente DATABASE_URL.",
            file=sys.stderr,
        )
        sys.exit(2)
    try:
        import psycopg  # psycopg 3
    except ImportError:
        print(
            "ERRO: psycopg não instalado. Rode: pip install 'psycopg[binary]'",
            file=sys.stderr,
        )
        sys.exit(2)
    return psycopg.connect(dsn, autocommit=False)


def _applied_versions(conn) -> set[str]:
    with conn.cursor() as cur:
        cur.execute(MIGRATIONS_TABLE_DDL)
        conn.commit()
        cur.execute("SELECT version FROM public.schema_migrations")
        return {row[0] for row in cur.fetchall()}


def main(argv: list[str]) -> int:
    dry_run = "--dry-run" in argv
    status_only = "--status" in argv

    if status_only or dry_run:
        # Em --status sem banco, ainda conseguimos listar arquivos; mas o estado
        # "aplicado" exige conexão. Conectamos se possível.
        pass

    conn = _connect()
    try:
        applied = _applied_versions(conn)
        pending = discover_migrations(SQL_DIR, applied)

        if status_only:
            print(f"Aplicadas ({len(applied)}):")
            for v in sorted(applied, key=_sort_key):
                print(f"  ✓ {v}")
            print(f"\nPendentes ({len(pending)}):")
            for p in pending:
                print(f"  • {p.name}")
            return 0

        if not pending:
            print("Nenhuma migration pendente. Banco atualizado.")
            return 0

        print(f"{len(pending)} migration(s) pendente(s):")
        for p in pending:
            print(f"  • {p.name}")

        if dry_run:
            print("\n--dry-run: nada foi executado.")
            return 0

        for p in pending:
            sql = p.read_text(encoding="utf-8")
            print(f"\n→ Aplicando {p.name} ...")
            with conn.cursor() as cur:
                cur.execute(sql)
                cur.execute(
                    "INSERT INTO public.schema_migrations (version, checksum) "
                    "VALUES (%s, %s) ON CONFLICT (version) DO NOTHING",
                    (p.name, checksum(p)),
                )
            conn.commit()
            print(f"  ✓ {p.name} aplicada")

        print("\nTodas as migrations pendentes foram aplicadas.")
        return 0
    except Exception as exc:  # noqa: BLE001
        conn.rollback()
        print(f"\nERRO ao aplicar migrations (rollback feito): {exc}", file=sys.stderr)
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
