-- Tracto: Commercial, Push and WhatsApp Schema

-- 1. Billing and Subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'incomplete', -- active, trialing, past_due, canceled, incomplete
    current_period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    current_period_end TIMESTAMP WITH TIME ZONE,
    trial_end TIMESTAMP WITH TIME ZONE,
    gateway_customer_id TEXT,
    gateway_subscription_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure 1 subscription per user
CREATE UNIQUE INDEX idx_user_subscription ON subscriptions (user_id);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'BRL',
    status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, failed, refunded
    payment_method TEXT, -- pix, credit_card
    gateway_payment_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gateway TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Push Notifications
CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_endpoint UNIQUE (endpoint)
);

-- 3. WhatsApp Integration
CREATE TABLE whatsapp_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL, -- e.g. +5511999999999
    preferences JSONB DEFAULT '{"critical_alerts": true, "weekly_reports": false}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_phone UNIQUE (phone_number)
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trg_sub_updated BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER trg_push_updated BEFORE UPDATE ON push_subscriptions FOR EACH ROW EXECUTE PROCEDURE update_modified_column();
CREATE TRIGGER trg_wa_updated BEFORE UPDATE ON whatsapp_contacts FOR EACH ROW EXECUTE PROCEDURE update_modified_column();

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only read own subscriptions" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can only read own payments" ON payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can fully manage own push subs" ON push_subscriptions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can fully manage own wa contacts" ON whatsapp_contacts FOR ALL USING (auth.uid() = user_id);

-- 4. Entitlements Enforcement Trigger (Hard Block)
CREATE OR REPLACE FUNCTION check_field_entitlement()
RETURNS TRIGGER AS $$
DECLARE
    user_plan TEXT;
    field_count INT;
BEGIN
    -- 1. Identificar o plano ativo do usuário
    SELECT plan_id INTO user_plan
    FROM subscriptions
    WHERE user_id = NEW.user_id AND status IN ('active', 'trialing')
    LIMIT 1;

    -- Se não achou plano ativo, fallback para 'free'
    IF user_plan IS NULL THEN
        user_plan := 'free';
    END IF;

    -- 2. Checar a quantidade atual de fields para planos limitados
    IF user_plan = 'free' THEN
        SELECT count(*) INTO field_count
        FROM fields
        WHERE user_id = NEW.user_id;

        IF field_count >= 1 THEN
            RAISE EXCEPTION 'Plan limit exceeded. Free tier is limited to 1 field. Please upgrade your plan.';
        END IF;
    ELSIF user_plan = 'familiar' THEN
        SELECT count(*) INTO field_count
        FROM fields
        WHERE user_id = NEW.user_id;

        IF field_count >= 5 THEN
            RAISE EXCEPTION 'Plan limit exceeded. Familiar tier is limited to 5 fields. Please upgrade your plan.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atachar a trigger à tabela fields existente (que vem do schema.sql)
DROP TRIGGER IF EXISTS enforce_field_entitlement ON fields;
CREATE TRIGGER enforce_field_entitlement
BEFORE INSERT ON fields
FOR EACH ROW
EXECUTE PROCEDURE check_field_entitlement();
