-- ============================================================================
-- TRACTO: UNIFIED PRODUCTION SCHEMA & MIGRATION
-- Version: 2.3.0
-- Description: Idempotent script to reconcile legacy schemas with modern backend.
-- ============================================================================

-- 1. Helper Function: update_modified_column
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 2. Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    avatar_url TEXT,
    preferences JSONB DEFAULT '{}'::JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Farms (Fazendas)
CREATE TABLE IF NOT EXISTS public.farms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.farms ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT FALSE;

-- 4. Fields (Talhões)
CREATE TABLE IF NOT EXISTS public.fields (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    farm_id UUID REFERENCES public.farms ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    crop_type TEXT,
    variety TEXT,
    planting_date DATE,
    area_ha NUMERIC,
    boundaries JSONB,
    latitude NUMERIC NOT NULL,
    longitude NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Analysis Runs
CREATE TABLE IF NOT EXISTS public.analysis_runs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    field_id UUID REFERENCES public.fields ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ndvi_avg NUMERIC,
    cloud_coverage NUMERIC,
    ai_report TEXT,
    weather_snapshot JSONB,
    full_result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.analysis_runs ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 6. Alerts
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    field_id UUID REFERENCES public.fields ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    type TEXT CHECK (type IN ('info', 'warning', 'critical')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    dismissed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 7. Conversations
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    title TEXT,
    messages JSONB NOT NULL DEFAULT '[]'::JSONB,
    farm_context TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 8. Subscriptions (Legacy Reconcile: plan_type -> plan_id)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'incomplete',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
    ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS plan_id TEXT DEFAULT 'free';
    ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'incomplete';
    ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE;
    ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS trial_end TIMESTAMP WITH TIME ZONE;
    ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS gateway_customer_id TEXT;
    ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS gateway_subscription_id TEXT;

    -- Migrar dados plan_type -> plan_id se necessário
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='subscriptions' AND column_name='plan_type') THEN
        UPDATE public.subscriptions SET plan_id = plan_type WHERE plan_id = 'free' AND plan_type IS NOT NULL;
    END IF;
    
    -- Se plan_id for instanciado como NULL por migrações mal sucessidas
    UPDATE public.subscriptions SET plan_id = 'free' WHERE plan_id IS NULL;
    ALTER TABLE public.subscriptions ALTER COLUMN plan_id SET NOT NULL;
END $$;

-- 9. Payments & Webhooks
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'BRL',
    status TEXT NOT NULL DEFAULT 'pending',
    payment_method TEXT,
    gateway_payment_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gateway TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Push Subscriptions (Legacy Reconcile)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_endpoint UNIQUE (endpoint)
);

DO $$
BEGIN
    ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS endpoint TEXT;
    ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS p256dh TEXT;
    ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS auth TEXT;
    
    -- NOTA: Campos legados (subscription_json/device_info) sao preservados para auditoria,
    -- mas o backend moderno exige o preenchimento de endpoint/p256dh/auth para novos despachos.
END $$;

-- Unicidade de endpoint para migracao segura
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON public.push_subscriptions (endpoint);

-- 11. WhatsApp Contacts
CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL UNIQUE,
    preferences JSONB DEFAULT '{"critical_alerts": true, "weekly_reports": false}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.whatsapp_contacts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- ============================================================================
-- CONSTRAINTS & INDEXES
-- ============================================================================

-- Unique: 1 default farm per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_farms_user_id_is_default 
ON public.farms (user_id) WHERE (is_default = TRUE);

-- Unique: Conversation context
CREATE UNIQUE INDEX IF NOT EXISTS conversations_conversation_id_user_id_idx
ON public.conversations (conversation_id, user_id);

-- Unique: 1 Subscription per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscription ON public.subscriptions (user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_farms_user_id ON public.farms(user_id);
CREATE INDEX IF NOT EXISTS idx_fields_farm_id ON public.fields(farm_id);
CREATE INDEX IF NOT EXISTS idx_fields_user_id ON public.fields(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON public.alerts(user_id);

-- ============================================================================
-- RLS (ROW LEVEL SECURITY) - Safe & Idempotent
-- ============================================================================

DO $$
DECLARE
    t text;
    tables_to_enable text[] := ARRAY['profiles', 'farms', 'fields', 'analysis_runs', 'alerts', 'conversations', 'push_subscriptions', 'whatsapp_contacts', 'subscriptions', 'payments'];
BEGIN
    -- 1. Webhook Events: Tabela tecnica de sistema.
    -- O acesso operacional ocorre via backend/service role; nao expomos policy de ownership para usuarios finais.
    ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

    -- 2. Demais Tabelas: RLS Ativo e Idempotente por Ownership
    FOREACH t IN ARRAY tables_to_enable LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        
        -- Drop existing generic ownership policy to recreate it updated
        EXECUTE format('DROP POLICY IF EXISTS "Ownership access" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Users can access own data" ON public.%I', t);
        
        -- Create specific ownership policies
        IF t = 'profiles' THEN
            EXECUTE format('CREATE POLICY "Users can access own data" ON public.%I FOR ALL USING (auth.uid() = id)', t);
        ELSE
            EXECUTE format('CREATE POLICY "Users can access own data" ON public.%I FOR ALL USING (auth.uid() = user_id)', t);
        END IF;
    END LOOP;
END $$;

-- ============================================================================
-- TRIGGERS (Updated_at)
-- ============================================================================

DO $$
DECLARE
    t text;
    tables_to_trigger text[] := ARRAY['farms', 'fields', 'conversations', 'subscriptions', 'push_subscriptions', 'whatsapp_contacts', 'alerts'];
BEGIN
    FOREACH t IN ARRAY tables_to_trigger LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated ON public.%I', t, t);
        EXECUTE format('CREATE TRIGGER trg_%I_updated BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE PROCEDURE update_modified_column()', t, t);
    END LOOP;
END $$;

-- ============================================================================
-- ENTITLEMENT ENFORCEMENT (Hard Block)
-- ============================================================================

CREATE OR REPLACE FUNCTION check_field_entitlement()
RETURNS TRIGGER AS $$
DECLARE
    user_plan TEXT;
    field_count INT;
BEGIN
    -- 1. Identificar o plano ativo
    SELECT plan_id INTO user_plan FROM subscriptions WHERE user_id = NEW.user_id AND status IN ('active', 'trialing') LIMIT 1;
    IF user_plan IS NULL THEN user_plan := 'free'; END IF;

    -- 2. Enforcement: Free limit = 1
    IF user_plan = 'free' THEN
        SELECT count(*) INTO field_count FROM fields WHERE user_id = NEW.user_id;
        IF field_count >= 1 THEN
            RAISE EXCEPTION 'Plan limit exceeded. Free tier is limited to 1 field. Please upgrade.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_field_entitlement ON public.fields;
-- [DESATIVADO TEMPORARIAMENTE]
-- CREATE TRIGGER enforce_field_entitlement 
-- BEFORE INSERT ON fields 
-- FOR EACH ROW 
-- EXECUTE FUNCTION check_field_limit_trigger();
