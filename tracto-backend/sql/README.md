# Migrations SQL — Tracto Backend

## Ordem de execução

Execute **na ordem** no Supabase SQL Editor:

| # | Arquivo | Descrição | Status |
|---|---------|-----------|--------|
| 0 | `schema.sql` | Schema inicial (users, farms, fields, conversations, alerts, push_subscriptions) | Base |
| 1 | `02_commercial.sql` | Plans, subscriptions, billing | Comercial |
| 2 | `03_satellite_artifacts.sql` | Cache de imagens satélite + bucket storage | Cache |
| 3 | `04_conversations_field_scope.sql` | Vincula conversations a field_id | Chat IA |
| 4 | `04_migrations.sql` | Patches diversos (constraint unique satellite_artifacts) | Compatibilidade |
| 5 | `05_field_details.sql` | Campos extra em fields (cultura, plantio, variedade) | Agronomia |
| 6 | `06_research_blocks.sql` | Blocos de pesquisa (research_blocks) | Pesquisa |
| 7 | `07_farm_boundaries.sql` | Polígono boundaries em farms | Geo |
| 8 | `08_plots_notebook_satellite.sql` | Plots (microtalhões) + notebook_events + Up42 source | Caderno |
| 9 | `09_satellite_artifact_mode_cache_key.sql` | Constraint unique inclui mode+bbox_hash (NDVI/RGB coexistem) | Cache |
| 10 | `10_billing.sql` | Plans/subscriptions/billing_profiles/payment_transactions/mp_webhook_events | Billing |
| 11 | `11_chat_usage.sql` | Contagem diária de uso do chat IA (limites por plano) | Chat IA |
| 12 | `12_postgis_fields.sql` | (A-07) PostGIS: coluna `geom` + índice GiST + área, preservando `boundaries` JSONB | Geo |
| 13 | `13_user_app_data.sql` | (A-01) `user_app_data` (JSONB por usuário/namespace) — fim do localStorage como fonte de verdade | Dados |

## Runner automatizado (A-08)

Há um runner versionado em `tracto-backend/migrate.py` que aplica os `.sql`
pendentes em ordem e registra cada um em `public.schema_migrations`
(idempotente — pula os já aplicados).

Pré-requisitos:

```bash
pip install 'psycopg[binary]'
# DATABASE_URL = Supabase > Settings > Database > Connection string > URI
export DATABASE_URL="postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres"   # NUNCA commite
```

Comandos:

```bash
# Desenvolvimento — ver estado e simular
python migrate.py --status     # aplicadas x pendentes
python migrate.py --dry-run    # mostra o que seria aplicado, sem executar

# Aplicar pendentes (dev ou produção)
python migrate.py
```

Em **produção** (Railway), rode o mesmo comando a partir de um shell com
`DATABASE_URL` setada (ou como passo de deploy). Cada migration roda em
transação; em erro, faz rollback e aborta sem registrar a versão.

> Bancos já existentes: o `schema_migrations` começa vazio, então o runner
> tentaria reaplicar tudo. Como todas as migrations são idempotentes
> (`IF NOT EXISTS`), isso é seguro; alternativamente, faça um INSERT manual das
> versões já aplicadas em `schema_migrations` para o runner pulá-las.

## Como aplicar do zero (banco novo)

```bash
# Em ordem, no SQL Editor do Supabase:
1. schema.sql
2. 02_commercial.sql
3. 03_satellite_artifacts.sql
4. 04_conversations_field_scope.sql
5. 04_migrations.sql
6. 05_field_details.sql
7. 06_research_blocks.sql
8. 07_farm_boundaries.sql
9. 08_plots_notebook_satellite.sql
10. 09_satellite_artifact_mode_cache_key.sql
```

## Verificar estado atual

Rode `verify_schema.sql` no SQL Editor — ele checa se todas as tabelas
e colunas esperadas existem e reporta o que falta aplicar.

## Convenção pra novas migrations

1. Numerar sequencialmente: `10_descricao.sql`, `11_descricao.sql`...
2. Sempre idempotente: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`
3. Sempre habilitar RLS em tabelas novas: `ALTER TABLE foo ENABLE ROW LEVEL SECURITY`
4. Sempre criar policy de owner: `auth.uid() = user_id`
5. Adicionar comentário no topo explicando o quê e o porquê
6. Atualizar este README com a nova linha

## Rollback

Como Supabase REST não suporta migrations bidirecionais nativamente,
documente o rollback inline no arquivo:

```sql
-- ROLLBACK (executar manualmente se precisar reverter):
-- DROP TABLE IF EXISTS public.minha_tabela CASCADE;
-- DROP INDEX IF EXISTS public.idx_minha_tabela_x;
```
