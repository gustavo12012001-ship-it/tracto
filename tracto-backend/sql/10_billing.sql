-- ============================================================
-- Migration 10 — Billing (Mercado Pago)
-- Tabelas: plans, subscriptions, payment_transactions, billing_profiles
-- Execute no Supabase SQL Editor
-- ============================================================

-- ── 1. Planos ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plans (
    id              TEXT PRIMARY KEY,            -- 'free', 'pro', 'enterprise'
    name            TEXT NOT NULL,
    description     TEXT,
    -- Preços em centavos (evita float)
    price_monthly_brl_cents  INTEGER NOT NULL DEFAULT 0,
    price_yearly_brl_cents   INTEGER NOT NULL DEFAULT 0,
    -- Entitlements
    max_fields           INTEGER NOT NULL DEFAULT 1,
    max_farms            INTEGER NOT NULL DEFAULT 1,
    has_ia_chat          BOOLEAN NOT NULL DEFAULT FALSE,
    has_satellite        BOOLEAN NOT NULL DEFAULT FALSE,
    has_whatsapp         BOOLEAN NOT NULL DEFAULT FALSE,
    has_push             BOOLEAN NOT NULL DEFAULT FALSE,
    -- IDs do Mercado Pago (preenchidos após criar via API)
    mp_plan_id_monthly   TEXT,
    mp_plan_id_yearly    TEXT,
    -- Ordering/UI
    display_order        INTEGER NOT NULL DEFAULT 0,
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- Planos públicos (leitura aberta — qualquer usuário autenticado vê)
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plans_public_read ON public.plans;
CREATE POLICY plans_public_read ON public.plans FOR SELECT USING (true);

-- Seed: 3 planos default. Ajuste preços via UPDATE depois.
INSERT INTO public.plans (id, name, description, price_monthly_brl_cents, price_yearly_brl_cents,
                          max_fields, max_farms, has_ia_chat, has_satellite, has_whatsapp, has_push,
                          display_order)
VALUES
    ('free',
     'Gratuito',
     'Para conhecer a plataforma. 1 talhão, sem IA.',
     0, 0,
     1, 1, FALSE, FALSE, FALSE, FALSE,
     0),
    ('pro',
     'Pro',
     'Para o produtor profissional. Talhões ilimitados, IA, satélite e alertas.',
     9900,        -- R$ 99,00/mês
     95000,       -- R$ 950,00/ano (20% off)
     50, 10, TRUE, TRUE, TRUE, TRUE,
     1),
    ('enterprise',
     'Enterprise',
     'Para fazendas e cooperativas grandes. Recursos ilimitados + suporte dedicado.',
     49900,       -- R$ 499,00/mês
     479000,      -- R$ 4.790,00/ano (20% off)
     9999, 9999, TRUE, TRUE, TRUE, TRUE,
     2)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Perfil de cobrança (dados pra emitir nota fiscal e cobrar) ────────────
CREATE TABLE IF NOT EXISTS public.billing_profiles (
    user_id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name        TEXT NOT NULL,
    document_type    TEXT NOT NULL CHECK (document_type IN ('CPF', 'CNPJ')),
    document_number  TEXT NOT NULL,
    email            TEXT NOT NULL,
    phone            TEXT,
    -- Endereço completo (obrigatório no Mercado Pago)
    address_zip      TEXT,
    address_street   TEXT,
    address_number   TEXT,
    address_complement TEXT,
    address_district TEXT,
    address_city     TEXT,
    address_state    TEXT,          -- UF
    address_country  TEXT DEFAULT 'BR',
    -- MP customer id (cacheado)
    mp_customer_id   TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_profiles_document ON public.billing_profiles(document_number);

ALTER TABLE public.billing_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS billing_profiles_owner ON public.billing_profiles;
CREATE POLICY billing_profiles_owner ON public.billing_profiles FOR ALL
    USING (auth.uid() = user_id);

-- ── 3. Assinaturas ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id           TEXT NOT NULL REFERENCES public.plans(id),
    -- Status segue convenção Mercado Pago + estados internos
    status            TEXT NOT NULL CHECK (status IN (
        'pending',       -- aguardando primeiro pagamento
        'authorized',    -- ativa (cartão autorizado, próx cobrança agendada)
        'paused',        -- pausada (falha de cobrança, retentando)
        'cancelled',     -- cancelada pelo usuário
        'finished'       -- terminada (sem renovação)
    )),
    billing_cycle     TEXT NOT NULL CHECK (billing_cycle IN ('monthly', 'yearly')),
    -- IDs do Mercado Pago
    mp_preapproval_id      TEXT UNIQUE,           -- ID da assinatura no MP
    mp_init_point          TEXT,                  -- URL pro checkout (cache temporário)
    mp_payer_email         TEXT,
    -- Datas
    started_at        TIMESTAMPTZ,
    trial_end_at      TIMESTAMPTZ,
    current_period_start  TIMESTAMPTZ,
    current_period_end    TIMESTAMPTZ,
    cancelled_at      TIMESTAMPTZ,
    last_synced_at    TIMESTAMPTZ DEFAULT NOW(),
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_mp_id ON public.subscriptions(mp_preapproval_id);
-- Apenas UMA assinatura ativa por usuário
CREATE UNIQUE INDEX IF NOT EXISTS ux_subscriptions_active_per_user
    ON public.subscriptions(user_id)
    WHERE status IN ('pending', 'authorized', 'paused');

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subscriptions_owner_read ON public.subscriptions;
CREATE POLICY subscriptions_owner_read ON public.subscriptions FOR SELECT
    USING (auth.uid() = user_id);
-- Write apenas via service_role do backend

-- ── 4. Transações de pagamento (histórico) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription_id   UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    mp_payment_id     TEXT UNIQUE,
    mp_preapproval_id TEXT,
    amount_cents      INTEGER NOT NULL,           -- centavos pra evitar float
    currency          TEXT NOT NULL DEFAULT 'BRL',
    status            TEXT NOT NULL,              -- MP: pending, approved, authorized, in_process, in_mediation, rejected, cancelled, refunded, charged_back
    payment_method    TEXT,                       -- credit_card, debit_card, pix, etc
    payment_type      TEXT,                       -- subscription, one_time
    description       TEXT,
    paid_at           TIMESTAMPTZ,
    refunded_at       TIMESTAMPTZ,
    raw_payload       JSONB,                      -- payload completo do MP pra auditoria
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_user ON public.payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_subscription ON public.payment_transactions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_mp_payment ON public.payment_transactions(mp_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_status ON public.payment_transactions(status);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payment_transactions_owner_read ON public.payment_transactions;
CREATE POLICY payment_transactions_owner_read ON public.payment_transactions FOR SELECT
    USING (auth.uid() = user_id);

-- ── 5. Webhook events (idempotência) ─────────────────────────────────────────
-- Mercado Pago pode reenviar o mesmo evento múltiplas vezes — usamos essa tabela
-- pra garantir que processamos cada evento UMA vez só.
CREATE TABLE IF NOT EXISTS public.mp_webhook_events (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    mp_event_id     TEXT UNIQUE NOT NULL,         -- ID do evento MP (data.id ou similar)
    event_type      TEXT NOT NULL,                -- payment, subscription_preapproval, etc
    action          TEXT,                         -- created, updated, etc
    raw_payload     JSONB NOT NULL,
    processed_at    TIMESTAMPTZ,
    error_message   TEXT,
    received_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_event_type ON public.mp_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_processed ON public.mp_webhook_events(processed_at) WHERE processed_at IS NULL;

-- Webhook events só lidos pelo service_role; sem RLS público

-- ── 6. Helper function: data nova assinatura free pra usuários sem subscription
-- (todos começam no Free automaticamente até assinarem Pro/Enterprise)
-- ============================================================
