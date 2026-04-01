-- Schema SQL — Tracto (Produção e Base)
-- NOTA: Esta e a fundacao para a Etapa 1.
-- Dívida Técnica (Etapa 2): 'boundaries' em JSONB deve ser migrado para PostGIS (GEOMETRY) para analises espaciais reais.
-- Escopo Comercial (Etapa 3): 'payments' e 'webhook_events' nao estao nesta Etapa 1.

-- 1. Profiles (Metadata do Usuário)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    avatar_url TEXT,
    preferences JSONB DEFAULT '{}'::JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Farms (Fazendas)
CREATE TABLE IF NOT EXISTS public.farms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE, -- [NEW] Para bootstrap idempotente
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Garantir apenas uma fazenda default por usuário (idempotência real)
CREATE UNIQUE INDEX IF NOT EXISTS idx_farms_user_id_is_default 
ON public.farms (user_id) WHERE (is_default = TRUE);

-- 3. Fields (Talhões)
CREATE TABLE IF NOT EXISTS public.fields (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    farm_id UUID REFERENCES public.farms ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    crop_type TEXT,
    variety TEXT,
    planting_date DATE,
    area_ha NUMERIC,
    boundaries JSONB, -- [DÍVIDA TÉCNICA] Migrar para PostGIS na Etapa 2
    latitude NUMERIC NOT NULL,
    longitude NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Analysis Runs (Histórico de Análises)
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

-- 5. Alerts (Alertas Persistentes)
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    field_id UUID REFERENCES public.fields ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    type TEXT CHECK (type IN ('info', 'warning', 'critical')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    dismissed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Conversas (Já existente, com unicidade garantida)
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

-- Unicidade para garantir idempotência de salvamento
CREATE UNIQUE INDEX IF NOT EXISTS conversations_conversation_id_user_id_idx
ON public.conversations (conversation_id, user_id);

-- 7. Push Subscriptions (Base Estrutural para Etapa 2)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    subscription_json JSONB NOT NULL,
    device_info TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. WhatsApp Contacts (Base Estrutural para Etapa 4)
CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    phone_number TEXT UNIQUE NOT NULL,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Subscriptions (Base Estrutural para Etapa 3)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
    plan_type TEXT NOT NULL, -- 'free', 'pro', 'enterprise'
    status TEXT NOT NULL, -- 'active', 'canceled'
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Row Level Security)
-- NOTA: O Backend deve validar o ownership manualmente quando usar Service Key.

-- Habilitar RLS em tudo
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Ownership access') THEN
        -- Aplicar política genérica de ownership (UID match)
        -- Em produção real, criaríamos uma política por tabela para clareza
        CREATE POLICY "Users can only access their own profile" ON public.profiles FOR ALL USING (auth.uid() = id);
        CREATE POLICY "Users can only access their own farms" ON public.farms FOR ALL USING (auth.uid() = user_id);
        CREATE POLICY "Users can only access their own fields" ON public.fields FOR ALL USING (auth.uid() = user_id);
        CREATE POLICY "Users can only access their own analysis" ON public.analysis_runs FOR ALL USING (auth.uid() = user_id);
        CREATE POLICY "Users can only access their own alerts" ON public.alerts FOR ALL USING (auth.uid() = user_id);
        CREATE POLICY "Users can only access their own conversations" ON public.conversations FOR ALL USING (auth.uid() = user_id);
        CREATE POLICY "Users can only access their own push subs" ON public.push_subscriptions FOR ALL USING (auth.uid() = user_id);
        CREATE POLICY "Users can only access their own whatsapp info" ON public.whatsapp_contacts FOR ALL USING (auth.uid() = user_id);
        CREATE POLICY "Users can only access their own subscriptions" ON public.subscriptions FOR ALL USING (auth.uid() = user_id);
    END IF;
END $$;

-- Índices de Performance
CREATE INDEX IF NOT EXISTS idx_farms_user_id ON public.farms(user_id);
CREATE INDEX IF NOT EXISTS idx_fields_farm_id ON public.fields(farm_id);
CREATE INDEX IF NOT EXISTS idx_fields_user_id ON public.fields(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_field_id ON public.analysis_runs(field_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON public.alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
