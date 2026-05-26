-- Migration 11: chat_usage
-- Tabela para contagem diária de mensagens de chat por usuário.
-- Permite que o limite diário de chat persista entre reinicializações do processo
-- (Railway reinicia o dyno com frequência, limpando o estado in-memory).
--
-- Execute no Supabase Dashboard > SQL Editor.

CREATE TABLE IF NOT EXISTS chat_usage (
    user_id     TEXT        NOT NULL,
    usage_date  DATE        NOT NULL DEFAULT CURRENT_DATE,
    count       INTEGER     NOT NULL DEFAULT 0,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, usage_date)
);

-- Índice para buscas por usuário ordenadas por data (mais recente primeiro)
CREATE INDEX IF NOT EXISTS idx_chat_usage_user_date
    ON chat_usage (user_id, usage_date DESC);

-- RLS: cada usuário só pode ver/alterar seu próprio registro
ALTER TABLE chat_usage ENABLE ROW LEVEL SECURITY;

-- O backend usa a service_role key, que bypassa RLS automaticamente.
-- A policy abaixo protege leituras via anon/authenticated key (frontend direto).
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'chat_usage' AND policyname = 'chat_usage_self_only'
    ) THEN
        CREATE POLICY chat_usage_self_only ON chat_usage
            USING (user_id = auth.uid()::text);
    END IF;
END $$;

-- Função helper: incrementa ou cria o contador do dia atual.
-- Retorna o novo valor do contador.
CREATE OR REPLACE FUNCTION upsert_chat_usage(p_user_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    INSERT INTO chat_usage (user_id, usage_date, count, updated_at)
    VALUES (p_user_id, CURRENT_DATE, 1, NOW())
    ON CONFLICT (user_id, usage_date)
    DO UPDATE SET
        count      = chat_usage.count + 1,
        updated_at = NOW()
    RETURNING count INTO v_count;

    RETURN v_count;
END;
$$;
