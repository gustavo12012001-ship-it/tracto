# Configuração do Supabase — Tracto

Para que a sincronização de conversas e a proteção de dados (ownership) funcionem corretamente, é necessário configurar uma **Constraint Única** na tabela `conversations`.

## 1. Constraint de Unicidade (Obrigatório)

Execute o seguinte script SQL no **SQL Editor** do seu painel do Supabase:

```sql
-- Garante que o mecanismo de 'on_conflict' (upsert) funcione via backend
create unique index if not exists conversations_conversation_id_user_id_idx 
on conversations (conversation_id, user_id);
```

> [!IMPORTANT]
> Sem este índice, a API retornará erro ao tentar salvar conversas existentes ou poderá permitir duplicatas inconsistentes.

## 2. Estrutura Necessária

Certifique-se de que a tabela `conversations` possui as seguintes colunas:
- `conversation_id` (text/uuid)
- `user_id` (uuid)
- `title` (text)
- `messages` (jsonb)
- `farm_context` (text)
- `created_at` (timestamp)
- `updated_at` (timestamp)

## 3. Row Level Security (RLS)

Recomendamos ativar o RLS e adicionar uma política para que usuários só vejam seus próprios dados:

```sql
alter table conversations enable row level security;

create policy "Users can only access their own conversations" 
on conversations for all 
using (auth.uid() = user_id);
```

## 4. Tabelas de Base (Produção)

Para suportar fazendas, talhões e histórico de análises, execute o script completo localizado em:
`tracto-backend/sql/schema.sql`

Este script criará as seguintes tabelas com RLS ativado:
- `profiles`
- `farms`
- `fields`
- `analysis_runs`
- `alerts`
- `push_subscriptions`
- `whatsapp_contacts`

> [!TIP]
> Certifique-se de executar o script no **SQL Editor** do Supabase para garantir que as permissões de acesso (Ownership) e as chaves estrangeiras funcionem corretamente entre o usuário autenticado e seus dados.

