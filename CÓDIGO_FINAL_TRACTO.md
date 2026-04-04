# Código Completo do Projeto Tracto — Inteligência Agronômica

> **Data de atualização:** April 4, 2026  
> **Versão:** 2.2.1  
> **Status:** Produção  

Documentação técnica completa contendo toda a estrutura, configurações, código-fonte e arquitetura do projeto Tracto.

---

## 📋 Índice
1. [Estrutura do Projeto](#estrutura-do-projeto)
2. [Configuração & Build](#configuração--build)
3. [Frontend - React + TypeScript](#frontend---react--typescript)
4. [Backend - FastAPI](#backend---fastapi)
5. [Banco de Dados & Autenticação](#banco-de-dados--autenticação)
6. [Variáveis de Ambiente](#variáveis-de-ambiente)

---

## 🗂️ Estrutura do Projeto

```
.
├── src/                              # Frontend React + TypeScript
│   ├── pages/
│   │   ├── Dashboard.tsx             # Painel principal com mapa de talhões
│   │   ├── Login.tsx                 # Autenticação
│   │   ├── Register.tsx              # Cadastro de usuário
│   │   ├── ResetPassword.tsx         # Recuperação de senha
│   │   ├── LandingPage.tsx           # Página inicial
│   │   ├── Weather.tsx               # Meteorologia/Clima
│   │   ├── Chat.tsx                  # Chat IA Agronômico
│   │   ├── Alerts.tsx                # Centro de alertas
│   │   ├── Reports.tsx               # Relatórios
│   │   ├── Market.tsx                # Mercado/Commodities
│   │   └── Pricing.tsx               # Planos de preço
│   ├── components/
│   │   ├── Layout.tsx                # Sidebar e navegação
│   │   ├── ProtectedRoute.tsx        # Autenticação de rotas
│   │   ├── FieldMap.tsx              # Mapa interativo de talhões
│   │   └── Skeleton.tsx              # Componentes de loading
│   ├── services/
│   │   ├── api.ts                    # Cliente HTTP para backend
│   │   ├── supabase.ts               # Configuração Supabase Auth/DB
│   │   ├── farm_service.ts           # Operações com fazendas/talhões
│   │   ├── alertsAI.ts               # Processamento de alertas IA
│   ├── store/
│   │   └── useAppStore.ts            # Estado global (Zustand)
│   ├── utils/
│   │   ├── geo.ts                    # Utilitários de geometria
│   │   └── geolocation.ts            # Localização do usuário
│   ├── App.tsx                       # Router principal
│   ├── main.tsx                      # Entry point
│   ├── index.css                     # Estilos globais
│   └── App.css                       # Estilos do App
├── tracto-backend/
│   ├── main.py                       # API FastAPI
│   ├── models.py                     # Esquemas Pydantic
│   ├── requirements.txt              # Dependências Python
│   ├── services/
│   │   ├── ai_service.py             # Integração Claude AI
│   │   ├── auth_service.py           # Autenticação JWT
│   │   ├── supabase_service.py       # Cliente Supabase
│   │   ├── farm_service.py           # CRUD Fazendas/Talhões
│   │   ├── weather_service.py        # Integração Weather API
│   │   ├── sentinel_service.py       # Satellite imagery (NDVI)
│   │   ├── agronomic_engine.py       # Motor determinístico
│   │   ├── billing_service.py        # Cobrança e entitlements
│   │   └── cache_service.py          # Cache em memória
│   └── sql/
│       ├── schema.sql                # DDL do banco de dados
│       └── 02_commercial.sql         # Triggers e políticas RLS
├── public/
│   └── sw.js                         # Service Worker
├── package.json                      # Dependências frontend
├── tsconfig.json                     # Config TypeScript
├── vite.config.ts                    # Config Vite
├── eslint.config.js                  # Linting
├── index.html                        # HTML raiz
└── README.md                         # Documentação

---

## 🎨 Frontend - React 19 + TypeScript + Vite

### `package.json`

```json
{
  "name": "tracto",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.99.1",
    "@tailwindcss/vite": "^4.2.1",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-router-dom": "^7.13.1",
    "react-leaflet": "^5.0.0",
    "leaflet": "^1.9.4",
    "zustand": "^5.0.11",
    "framer-motion": "^12.36.0",
    "recharts": "^3.8.0",
    "axios": "^1.13.6",
    "uuid": "^13.0.0"
  }
}
```

### `src/App.tsx`

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Weather from './pages/Weather';
import Chat from './pages/Chat';
import Alerts from './pages/Alerts';
import Reports from './pages/Reports';
import Market from './pages/Market';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import Pricing from './pages/Pricing';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="weather" element={<Weather />} />
          <Route path="chat" element={<Chat />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="reports" element={<Reports />} />
          <Route path="market" element={<Market />} />
          <Route path="billing" element={<Pricing />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
```

### `src/services/api.ts` (Cliente HTTP)

```typescript
import { supabase } from './supabase';

export const API_URL = import.meta.env.VITE_API_URL || 'https://tracto-production.up.railway.app';

async function buildAuthHeaders() {
  try {
    let { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const refreshed = await supabase.auth.refreshSession();
      session = refreshed.data.session;
    }
    return session?.access_token 
      ? { Authorization: `Bearer ${session.access_token}` }
      : {};
  } catch (error) {
    console.warn('[API] Falha ao construir headers:', error);
    return {};
  }
}

export const apiFetch = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  if (!API_URL) throw new Error('Backend não configurado');
  
  const url = `${API_URL}${path}`;
  const authHeaders = await buildAuthHeaders();
  const headers = new Headers(options.headers ?? {});
  
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  
  Object.entries(authHeaders).forEach(([key, value]) => headers.set(key, value));

  try {
    const response = await fetch(url, { ...options, headers });
    
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`[${response.status}] ${detail}`);
    }

    return await response.json() as T;
  } catch (error) {
    console.error('[API] Erro:', error);
    throw error;
  }
};
```

### `src/store/useAppStore.ts` (Zustand State Management)

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Farm {
  id: string;
  name: string;
  fields: Location[];
}

export interface Location {
  id?: string;
  lat: number;
  lng: number;
  name?: string;
  boundaries?: [number, number][];
  cultura?: string;
  areaHa?: number;
}

export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
  dismissed: boolean;
}

interface AppState {
  fields: Location[];
  alerts: Alert[];
  weatherCache: any | null;
  setFields: (fields: Location[]) => void;
  setAlerts: (alerts: Alert[]) => void;
  appendAlert: (alert: Alert) => void;
  dismissAlert: (id: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      fields: [],
      alerts: [],
      weatherCache: null,
      setFields: (fields) => set({ fields }),
      setAlerts: (alerts) => set({ alerts }),
      appendAlert: (alert) => {
        const current = get().alerts;
        set({ alerts: [alert, ...current] });
      },
      dismissAlert: (id) => {
        const current = get().alerts;
        set({ alerts: current.map((a) => a.id === id ? { ...a, dismissed: true } : a) });
      },
    }),
    {
      name: 'tracto-app-store',
    }
  )
);

export default useAppStore;
```

## ⚙️ Configuração & Build

### `eslint.config.js`
```js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
])

```


### `index.html`
```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tracto — Inteligência Agronômica</title>
    <meta name="description" content="Tracto une tecnologia orbital e inteligência agronômica para decisões de alta precisão na sua lavoura." />
    <meta property="og:title" content="Tracto — Inteligência Agronômica" />
    <meta property="og:description" content="Monitoramento de talhões, alertas climáticos e IA agronômica na palma da sua mão." />
    <meta property="og:type" content="website" />
    <script src="https://www.google.com/recaptcha/api.js?render=%VITE_RECAPTCHA_SITE_KEY%"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>

```


### `package.json`
```json
{
  "name": "tracto",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.99.1",
    "@tailwindcss/vite": "^4.2.1",
    "@types/leaflet": "^1.9.21",
    "@types/uuid": "^10.0.0",
    "axios": "^1.13.6",
    "framer-motion": "^12.36.0",
    "jspdf": "^4.2.0",
    "leaflet": "^1.9.4",
    "lucide-react": "^0.577.0",
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-is": "^19.2.4",
    "react-leaflet": "^5.0.0",
    "react-markdown": "^10.1.0",
    "react-router-dom": "^7.13.1",
    "recharts": "^3.8.0",
    "tailwindcss": "^4.2.1",
    "uuid": "^13.0.0",
    "zustand": "^5.0.11"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.4",
    "@types/node": "^24.12.0",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.0",
    "eslint": "^9.39.4",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.5.2",
    "globals": "^17.4.0",
    "typescript": "~5.9.3",
    "typescript-eslint": "^8.56.1",
    "vite": "^8.0.0"
  }
}

```


### `vite.config.ts`
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5174,
  }
})

```


### `tsconfig.json`
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}

```


### `PRODUCAO_SCHEMA.sql`
```sql
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

```


### `public/sw.js`
```js
// service-worker.js
// Base code for handling incoming Web Push notifications

self.addEventListener('push', function (event) {
  if (event.data) {
    let payload = { title: 'Tracto', body: 'Nova notificação do sistema.' };
    
    try {
      if (typeof event.data.json === 'function') {
        payload = event.data.json();
      } else {
        payload.body = event.data.text();
      }
    } catch (e) {
      payload.body = event.data.text();
    }

    const options = {
      body: payload.body,
      icon: '/vite.svg', // Substituir por ícone real depois
      badge: '/vite.svg',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        primaryKey: 1,
        url: payload.url || '/'
      }
    };

    event.waitUntil(self.registration.showNotification(payload.title, options));
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = event.notification.data.url;
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      // Check if there is already a window/tab open with the target URL
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

```


### `src/App.css`
```css
.counter {
  font-size: 16px;
  padding: 5px 10px;
  border-radius: 5px;
  color: var(--accent);
  background: var(--accent-bg);
  border: 2px solid transparent;
  transition: border-color 0.3s;
  margin-bottom: 24px;

  &:hover {
    border-color: var(--accent-border);
  }
  &:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
}

.hero {
  position: relative;

  .base,
  .framework,
  .vite {
    inset-inline: 0;
    margin: 0 auto;
  }

  .base {
    width: 170px;
    position: relative;
    z-index: 0;
  }

  .framework,
  .vite {
    position: absolute;
  }

  .framework {
    z-index: 1;
    top: 34px;
    height: 28px;
    transform: perspective(2000px) rotateZ(300deg) rotateX(44deg) rotateY(39deg)
      scale(1.4);
  }

  .vite {
    z-index: 0;
    top: 107px;
    height: 26px;
    width: auto;
    transform: perspective(2000px) rotateZ(300deg) rotateX(40deg) rotateY(39deg)
      scale(0.8);
  }
}

#center {
  display: flex;
  flex-direction: column;
  gap: 25px;
  place-content: center;
  place-items: center;
  flex-grow: 1;

  @media (max-width: 1024px) {
    padding: 32px 20px 24px;
    gap: 18px;
  }
}

#next-steps {
  display: flex;
  border-top: 1px solid var(--border);
  text-align: left;

  & > div {
    flex: 1 1 0;
    padding: 32px;
    @media (max-width: 1024px) {
      padding: 24px 20px;
    }
  }

  .icon {
    margin-bottom: 16px;
    width: 22px;
    height: 22px;
  }

  @media (max-width: 1024px) {
    flex-direction: column;
    text-align: center;
  }
}

#docs {
  border-right: 1px solid var(--border);

  @media (max-width: 1024px) {
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
}

#next-steps ul {
  list-style: none;
  padding: 0;
  display: flex;
  gap: 8px;
  margin: 32px 0 0;

  .logo {
    height: 18px;
  }

  a {
    color: var(--text-h);
    font-size: 16px;
    border-radius: 6px;
    background: var(--social-bg);
    display: flex;
    padding: 6px 12px;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    transition: box-shadow 0.3s;

    &:hover {
      box-shadow: var(--shadow);
    }
    .button-icon {
      height: 18px;
      width: 18px;
    }
  }

  @media (max-width: 1024px) {
    margin-top: 20px;
    flex-wrap: wrap;
    justify-content: center;

    li {
      flex: 1 1 calc(50% - 8px);
    }

    a {
      width: 100%;
      justify-content: center;
      box-sizing: border-box;
    }
  }
}

#spacer {
  height: 88px;
  border-top: 1px solid var(--border);
  @media (max-width: 1024px) {
    height: 48px;
  }
}

.ticks {
  position: relative;
  width: 100%;

  &::before,
  &::after {
    content: '';
    position: absolute;
    top: -4.5px;
    border: 5px solid transparent;
  }

  &::before {
    left: 0;
    border-left-color: var(--border);
  }
  &::after {
    right: 0;
    border-right-color: var(--border);
  }
}

```


### `src/App.tsx`
```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Weather from './pages/Weather';
import Chat from './pages/Chat';
import Alerts from './pages/Alerts';
import Reports from './pages/Reports';
import Market from './pages/Market';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import Register from './pages/Register';
import ResetPassword from './pages/ResetPassword';
import Pricing from './pages/Pricing';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/app/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="weather" element={<Weather />} />
          <Route path="chat" element={<Chat />} />
          <Route path="alerts" element={<Alerts />} />
          <Route path="reports" element={<Reports />} />
          <Route path="market" element={<Market />} />
          <Route path="billing" element={<Pricing />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

```


### `src/assets/hero-farm.jpg`
```jpg
[Arquivo binário: src/assets/hero-farm.jpg]
```


### `src/assets/hero.png`
```png
[Arquivo binário: src/assets/hero.png]
```


### `src/assets/react.svg`
```svg
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img" class="iconify iconify--logos" width="35.93" height="32" preserveAspectRatio="xMidYMid meet" viewBox="0 0 256 228"><path fill="#00D8FF" d="M210.483 73.824a171.49 171.49 0 0 0-8.24-2.597c.465-1.9.893-3.777 1.273-5.621c6.238-30.281 2.16-54.676-11.769-62.708c-13.355-7.7-35.196.329-57.254 19.526a171.23 171.23 0 0 0-6.375 5.848a155.866 155.866 0 0 0-4.241-3.917C100.759 3.829 77.587-4.822 63.673 3.233C50.33 10.957 46.379 33.89 51.995 62.588a170.974 170.974 0 0 0 1.892 8.48c-3.28.932-6.445 1.924-9.474 2.98C17.309 83.498 0 98.307 0 113.668c0 15.865 18.582 31.778 46.812 41.427a145.52 145.52 0 0 0 6.921 2.165a167.467 167.467 0 0 0-2.01 9.138c-5.354 28.2-1.173 50.591 12.134 58.266c13.744 7.926 36.812-.22 59.273-19.855a145.567 145.567 0 0 0 5.342-4.923a168.064 168.064 0 0 0 6.92 6.314c21.758 18.722 43.246 26.282 56.54 18.586c13.731-7.949 18.194-32.003 12.4-61.268a145.016 145.016 0 0 0-1.535-6.842c1.62-.48 3.21-.974 4.76-1.488c29.348-9.723 48.443-25.443 48.443-41.52c0-15.417-17.868-30.326-45.517-39.844Zm-6.365 70.984c-1.4.463-2.836.91-4.3 1.345c-3.24-10.257-7.612-21.163-12.963-32.432c5.106-11 9.31-21.767 12.459-31.957c2.619.758 5.16 1.557 7.61 2.4c23.69 8.156 38.14 20.213 38.14 29.504c0 9.896-15.606 22.743-40.946 31.14Zm-10.514 20.834c2.562 12.94 2.927 24.64 1.23 33.787c-1.524 8.219-4.59 13.698-8.382 15.893c-8.067 4.67-25.32-1.4-43.927-17.412a156.726 156.726 0 0 1-6.437-5.87c7.214-7.889 14.423-17.06 21.459-27.246c12.376-1.098 24.068-2.894 34.671-5.345a134.17 134.17 0 0 1 1.386 6.193ZM87.276 214.515c-7.882 2.783-14.16 2.863-17.955.675c-8.075-4.657-11.432-22.636-6.853-46.752a156.923 156.923 0 0 1 1.869-8.499c10.486 2.32 22.093 3.988 34.498 4.994c7.084 9.967 14.501 19.128 21.976 27.15a134.668 134.668 0 0 1-4.877 4.492c-9.933 8.682-19.886 14.842-28.658 17.94ZM50.35 144.747c-12.483-4.267-22.792-9.812-29.858-15.863c-6.35-5.437-9.555-10.836-9.555-15.216c0-9.322 13.897-21.212 37.076-29.293c2.813-.98 5.757-1.905 8.812-2.773c3.204 10.42 7.406 21.315 12.477 32.332c-5.137 11.18-9.399 22.249-12.634 32.792a134.718 134.718 0 0 1-6.318-1.979Zm12.378-84.26c-4.811-24.587-1.616-43.134 6.425-47.789c8.564-4.958 27.502 2.111 47.463 19.835a144.318 144.318 0 0 1 3.841 3.545c-7.438 7.987-14.787 17.08-21.808 26.988c-12.04 1.116-23.565 2.908-34.161 5.309a160.342 160.342 0 0 1-1.76-7.887Zm110.427 27.268a347.8 347.8 0 0 0-7.785-12.803c8.168 1.033 15.994 2.404 23.343 4.08c-2.206 7.072-4.956 14.465-8.193 22.045a381.151 381.151 0 0 0-7.365-13.322Zm-45.032-43.861c5.044 5.465 10.096 11.566 15.065 18.186a322.04 322.04 0 0 0-30.257-.006c4.974-6.559 10.069-12.652 15.192-18.18ZM82.802 87.83a323.167 323.167 0 0 0-7.227 13.238c-3.184-7.553-5.909-14.98-8.134-22.152c7.304-1.634 15.093-2.97 23.209-3.984a321.524 321.524 0 0 0-7.848 12.897Zm8.081 65.352c-8.385-.936-16.291-2.203-23.593-3.793c2.26-7.3 5.045-14.885 8.298-22.6a321.187 321.187 0 0 0 7.257 13.246c2.594 4.48 5.28 8.868 8.038 13.147Zm37.542 31.03c-5.184-5.592-10.354-11.779-15.403-18.433c4.902.192 9.899.29 14.978.29c5.218 0 10.376-.117 15.453-.343c-4.985 6.774-10.018 12.97-15.028 18.486Zm52.198-57.817c3.422 7.8 6.306 15.345 8.596 22.52c-7.422 1.694-15.436 3.058-23.88 4.071a382.417 382.417 0 0 0 7.859-13.026a347.403 347.403 0 0 0 7.425-13.565Zm-16.898 8.101a358.557 358.557 0 0 1-12.281 19.815a329.4 329.4 0 0 1-23.444.823c-7.967 0-15.716-.248-23.178-.732a310.202 310.202 0 0 1-12.513-19.846h.001a307.41 307.41 0 0 1-10.923-20.627a310.278 310.278 0 0 1 10.89-20.637l-.001.001a307.318 307.318 0 0 1 12.413-19.761c7.613-.576 15.42-.876 23.31-.876H128c7.926 0 15.743.303 23.354.883a329.357 329.357 0 0 1 12.335 19.695a358.489 358.489 0 0 1 11.036 20.54a329.472 329.472 0 0 1-11 20.722Zm22.56-122.124c8.572 4.944 11.906 24.881 6.52 51.026c-.344 1.668-.73 3.367-1.15 5.09c-10.622-2.452-22.155-4.275-34.23-5.408c-7.034-10.017-14.323-19.124-21.64-27.008a160.789 160.789 0 0 1 5.888-5.4c18.9-16.447 36.564-22.941 44.612-18.3ZM128 90.808c12.625 0 22.86 10.235 22.86 22.86s-10.235 22.86-22.86 22.86s-22.86-10.235-22.86-22.86s10.235-22.86 22.86-22.86Z"></path></svg>
```


### `src/assets/vite.svg`
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="77" height="47" fill="none" aria-labelledby="vite-logo-title" viewBox="0 0 77 47"><title id="vite-logo-title">Vite</title><style>.parenthesis{fill:#000}@media (prefers-color-scheme:dark){.parenthesis{fill:#fff}}</style><path fill="#9135ff" d="M40.151 45.71c-.663.844-2.02.374-2.02-.699V34.708a2.26 2.26 0 0 0-2.262-2.262H24.493c-.92 0-1.457-1.04-.92-1.788l7.479-10.471c1.07-1.498 0-3.578-1.842-3.578H15.443c-.92 0-1.456-1.04-.92-1.788l9.696-13.576c.213-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.472c-1.07 1.497 0 3.578 1.842 3.578h11.376c.944 0 1.474 1.087.89 1.83L40.153 45.712z"/><mask id="a" width="48" height="47" x="14" y="0" maskUnits="userSpaceOnUse" style="mask-type:alpha"><path fill="#000" d="M40.047 45.71c-.663.843-2.02.374-2.02-.699V34.708a2.26 2.26 0 0 0-2.262-2.262H24.389c-.92 0-1.457-1.04-.92-1.788l7.479-10.472c1.07-1.497 0-3.578-1.842-3.578H15.34c-.92 0-1.456-1.04-.92-1.788l9.696-13.575c.213-.297.556-.474.92-.474H53.93c.92 0 1.456 1.04.92 1.788L47.37 13.03c-1.07 1.498 0 3.578 1.842 3.578h11.376c.944 0 1.474 1.088.89 1.831L40.049 45.712z"/></mask><g mask="url(#a)"><g filter="url(#b)"><ellipse cx="5.508" cy="14.704" fill="#eee6ff" rx="5.508" ry="14.704" transform="rotate(269.814 20.96 11.29)scale(-1 1)"/></g><g filter="url(#c)"><ellipse cx="10.399" cy="29.851" fill="#eee6ff" rx="10.399" ry="29.851" transform="rotate(89.814 -16.902 -8.275)scale(1 -1)"/></g><g filter="url(#d)"><ellipse cx="5.508" cy="30.487" fill="#8900ff" rx="5.508" ry="30.487" transform="rotate(89.814 -19.197 -7.127)scale(1 -1)"/></g><g filter="url(#e)"><ellipse cx="5.508" cy="30.599" fill="#8900ff" rx="5.508" ry="30.599" transform="rotate(89.814 -25.928 4.177)scale(1 -1)"/></g><g filter="url(#f)"><ellipse cx="5.508" cy="30.599" fill="#8900ff" rx="5.508" ry="30.599" transform="rotate(89.814 -25.738 5.52)scale(1 -1)"/></g><g filter="url(#g)"><ellipse cx="14.072" cy="22.078" fill="#eee6ff" rx="14.072" ry="22.078" transform="rotate(93.35 31.245 55.578)scale(-1 1)"/></g><g filter="url(#h)"><ellipse cx="3.47" cy="21.501" fill="#8900ff" rx="3.47" ry="21.501" transform="rotate(89.009 35.419 55.202)scale(-1 1)"/></g><g filter="url(#i)"><ellipse cx="3.47" cy="21.501" fill="#8900ff" rx="3.47" ry="21.501" transform="rotate(89.009 35.419 55.202)scale(-1 1)"/></g><g filter="url(#j)"><ellipse cx="14.592" cy="9.743" fill="#8900ff" rx="4.407" ry="29.108" transform="rotate(39.51 14.592 9.743)"/></g><g filter="url(#k)"><ellipse cx="61.728" cy="-5.321" fill="#8900ff" rx="4.407" ry="29.108" transform="rotate(37.892 61.728 -5.32)"/></g><g filter="url(#l)"><ellipse cx="55.618" cy="7.104" fill="#00c2ff" rx="5.971" ry="9.665" transform="rotate(37.892 55.618 7.104)"/></g><g filter="url(#m)"><ellipse cx="12.326" cy="39.103" fill="#8900ff" rx="4.407" ry="29.108" transform="rotate(37.892 12.326 39.103)"/></g><g filter="url(#n)"><ellipse cx="12.326" cy="39.103" fill="#8900ff" rx="4.407" ry="29.108" transform="rotate(37.892 12.326 39.103)"/></g><g filter="url(#o)"><ellipse cx="49.857" cy="30.678" fill="#8900ff" rx="4.407" ry="29.108" transform="rotate(37.892 49.857 30.678)"/></g><g filter="url(#p)"><ellipse cx="52.623" cy="33.171" fill="#00c2ff" rx="5.971" ry="15.297" transform="rotate(37.892 52.623 33.17)"/></g></g><path d="M6.919 0c-9.198 13.166-9.252 33.575 0 46.789h6.215c-9.25-13.214-9.196-33.623 0-46.789zm62.424 0h-6.215c9.198 13.166 9.252 33.575 0 46.789h6.215c9.25-13.214 9.196-33.623 0-46.789" class="parenthesis"/><defs><filter id="b" width="60.045" height="41.654" x="-5.564" y="16.92" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="7.659"/></filter><filter id="c" width="90.34" height="51.437" x="-40.407" y="-6.762" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="7.659"/></filter><filter id="d" width="79.355" height="29.4" x="-35.435" y="2.801" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="e" width="79.579" height="29.4" x="-30.84" y="20.8" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="f" width="79.579" height="29.4" x="-29.307" y="21.949" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="g" width="74.749" height="58.852" x="29.961" y="-17.13" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="7.659"/></filter><filter id="h" width="61.377" height="25.362" x="37.754" y="3.055" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="i" width="61.377" height="25.362" x="37.754" y="3.055" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="j" width="56.045" height="63.649" x="-13.43" y="-22.082" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="k" width="54.814" height="64.646" x="34.321" y="-37.644" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="l" width="33.541" height="35.313" x="38.847" y="-10.552" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="m" width="54.814" height="64.646" x="-15.081" y="6.78" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="n" width="54.814" height="64.646" x="-15.081" y="6.78" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="o" width="54.814" height="64.646" x="22.45" y="-1.645" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter><filter id="p" width="39.409" height="43.623" x="32.919" y="11.36" color-interpolation-filters="sRGB" filterUnits="userSpaceOnUse"><feFlood flood-opacity="0" result="BackgroundImageFix"/><feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape"/><feGaussianBlur result="effect1_foregroundBlur_2002_17286" stdDeviation="4.596"/></filter></defs></svg>

```


### `src/components/FieldMap.tsx`
```tsx
import { useState, useCallback, useEffect, useRef } from 'react';
import {
  MapContainer, TileLayer, Marker, Popup,
  Polygon, Polyline, useMapEvents, useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import useAppStore from '../store/useAppStore';
import { polygonAreaHa } from '../utils/geo';

// Fix default Leaflet marker icons
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// ── NASA GIBS date: use a recent stable date (D-10) to avoid broken tiles ────
const gibsDate = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 10);
  return d.toISOString().slice(0, 10); // e.g. "2024-03-21"
})();

// ── Map Click Handler ─────────────────────────────────────────────────────────
type DrawMode = 'none' | 'drawing';

function MapClickHandler({ onMapClick }: { onMapClick: (latlng: { lat: number; lng: number }) => void }) {
  useMapEvents({ click: (e) => onMapClick(e.latlng) });
  return null;
}

// ── Map Controller (Auto-centering & Status) ───────────────────────────────
function MapController() {
  const map = useMap();
  const { currentLocation, locationStatus, fields, activeFieldId } = useAppStore();
  const hasCenteredInitial = useRef(false);

  useEffect(() => {
    if (hasCenteredInitial.current) return;

    // 1. If we have an active field, go there
    if (activeFieldId) {
      const field = fields.find(f => f.id === activeFieldId);
      if (field) {
        map.setView([field.lat, field.lng], 15);
        hasCenteredInitial.current = true;
        return;
      }
    }

    // 2. If location is precise, go there
    if (locationStatus === 'precise' && currentLocation) {
      map.setView([currentLocation.lat, currentLocation.lng], 13);
      hasCenteredInitial.current = true;
      return;
    }

    // 3. If location is fallback/denied but we have fields, center on first field
    if ((locationStatus === 'fallback' || locationStatus === 'denied' || locationStatus === 'unavailable') && fields.length > 0) {
      const firstField = fields[0];
      map.setView([firstField.lat, firstField.lng], 15);
      hasCenteredInitial.current = true;
    }
  }, [currentLocation, locationStatus, fields, activeFieldId, map]);

  return null;
}

function ZoomControls() {
  const map = useMap();
  return (
    <div className="absolute bottom-4 right-4 z-[500] flex flex-col gap-1.5 pointer-events-auto">
      {[
        { s: '+', action: () => map.zoomIn() },
        { s: '−', action: () => map.zoomOut() },
      ].map(({ s, action }) => (
        <button
          key={s}
          onClick={action}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold transition-all hover:text-white"
          style={{
            background: 'rgba(8,8,9,0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#94a3b8',
          }}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function FieldMap() {
  const {
    currentLocation,
    locationStatus,
    fields,
    createField,
    removeField,
    activeFarmId,
    activeMapLayer,
  } = useAppStore();

  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [fieldName, setFieldName] = useState('');
  const [fieldCultura, setFieldCultura] = useState('');
  const [fieldDataPlantio, setFieldDataPlantio] = useState('');
  const [fieldVariedade, setFieldVariedade] = useState('');

  const center: [number, number] = currentLocation
    ? [currentLocation.lat, currentLocation.lng]
    : [-23.31028, -51.16278];

  const handleMapClick = useCallback((latlng: { lat: number; lng: number }) => {
    if (drawMode !== 'drawing') return;
    setDrawPoints((prev) => [...prev, [latlng.lat, latlng.lng]]);
  }, [drawMode]);

  const resetForm = () => {
    setDrawPoints([]);
    setFieldName('');
    setFieldCultura('');
    setFieldDataPlantio('');
    setFieldVariedade('');
    setDrawMode('none');
  };

  const finishDrawing = async () => {
    // Validações obrigatórias (frontend guard)
    if (!activeFarmId) {
      alert('Selecione ou crie uma fazenda antes de desenhar talhões.');
      return;
    }
    if (drawPoints.length < 3) {
      alert('Marque pelo menos 3 pontos para criar um talhão.');
      return;
    }

    const areaHa = polygonAreaHa(drawPoints);
    if (areaHa < 0.05) {
      alert('A área desenhada é muito pequena. Desenhe um talhão com pelo menos 0.05 ha.');
      return;
    }

    const name = fieldName.trim() || `Talhão ${fields.length + 1}`;
    const centroid: [number, number] = [
      drawPoints.reduce((s, p) => s + p[0], 0) / drawPoints.length,
      drawPoints.reduce((s, p) => s + p[1], 0) / drawPoints.length,
    ];

    const newLoc = {
      lat: centroid[0],
      lng: centroid[1],
      name,
      boundaries: drawPoints,
      cultura: fieldCultura || undefined,
      dataPlantio: fieldDataPlantio || undefined,
      variedade: fieldVariedade || undefined,
      areaHa,
    };

    try {
      setIsSaving(true);
      await createField(activeFarmId, newLoc);
      // Limpeza do formulário APENAS após sucesso confirmado
      resetForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar talhão.';
      alert(`Não foi possível salvar o talhão:\n${msg}`);
      // Intencionalmente NÃO limpa o formulário — permite corrigir e tentar de novo
    } finally {
      setIsSaving(false);
    }
  };

  const FIELD_COLORS = ['#ec5b13', '#4ade80', '#60a5fa', '#f472b6', '#a78bfa', '#facc15'];



  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ cursor: drawMode === 'drawing' ? 'crosshair' : 'default' }}
    >
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: '100%', width: '100%', background: '#080809' }}
        zoomControl={false}
      >
        <MapController />
        {/* ── Base satellite layer (always visible) ── */}
        <TileLayer
          attribution="&copy; Esri"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={20}
        />
        {/* Hybrid labels */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
          maxZoom={20}
          opacity={0.6}
        />

        {/* ── NDVI layer (NASA GIBS — MODIS Terra 8-day) ── */}
        {activeMapLayer === 'ndvi' && (
          <TileLayer
            url={`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_NDVI_8Day/default/${gibsDate}/GoogleMapsCompatible/{z}/{y}/{x}.jpg`}
            attribution="NASA GIBS · MODIS Terra NDVI"
            maxZoom={9}
            opacity={0.85}
          />
        )}

        {/* ── Moisture layer (NASA GIBS — MODIS Terra Land Surface Temp as proxy) ── */}
        {activeMapLayer === 'moisture' && (
          <TileLayer
            url={`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_Land_Surface_Temp_Day/default/${gibsDate}/GoogleMapsCompatible/{z}/{y}/{x}.png`}
            attribution="NASA GIBS · MODIS Terra LST"
            maxZoom={9}
            opacity={0.75}
          />
        )}

        <MapClickHandler onMapClick={handleMapClick} />

        {/* Current location marker */}
        {currentLocation && locationStatus === 'precise' && !fields.some((s) => s.lat === currentLocation.lat) && (
          <Marker position={[currentLocation.lat, currentLocation.lng]}>
            <Popup>📍 Sua localização atual</Popup>
          </Marker>
        )}

        {/* Fields from Supabase (single source of truth) */}
        {fields.map((loc, idx) => {
          const color = FIELD_COLORS[idx % FIELD_COLORS.length];
          return (
            <Polygon
              key={loc.id}  // UUID do banco — nunca usar idx aqui
              positions={
                loc.boundaries ??
                [
                  [loc.lat - 0.003, loc.lng - 0.003],
                  [loc.lat - 0.003, loc.lng + 0.003],
                  [loc.lat + 0.003, loc.lng + 0.003],
                  [loc.lat + 0.003, loc.lng - 0.003],
                ]
              }
              pathOptions={{ color, fillColor: color, fillOpacity: 0.25, weight: 2 }}
            >
              <Popup>
                <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 160 }}>
                  <p style={{ fontWeight: 700, marginBottom: 4, fontSize: 13 }}>{loc.name}</p>
                  {loc.cultura && <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>🌱 {loc.cultura}</p>}
                  {loc.variedade && <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>🔬 {loc.variedade}</p>}
                  {loc.dataPlantio && <p style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>📅 Plantio: {new Date(loc.dataPlantio).toLocaleDateString('pt-BR')}</p>}
                  <p style={{ fontSize: 11, color: '#64748b', marginBottom: 8 }}>
                    {loc.boundaries ? `${loc.boundaries.length} pontos` : 'Talhão'}
                  </p>
                  <button
                    onClick={() => activeFarmId && loc.id && removeField(activeFarmId, loc.id)}
                    style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    🗑 Remover talhão
                  </button>
                </div>
              </Popup>
            </Polygon>
          );
        })}


        {/* Preview of drawing */}
        {drawMode === 'drawing' && drawPoints.length > 0 && (
          <>
            {drawPoints.length > 1 && (
              <Polyline
                positions={[...drawPoints, drawPoints[0]]}
                pathOptions={{ color: '#ec5b13', weight: 2, dashArray: '6 4', opacity: 0.85 }}
              />
            )}
            {drawPoints.map((pt, i) => (
              <Marker
                key={i}
                position={pt}
                icon={L.divIcon({
                  className: '',
                  html: `<div style="width:10px;height:10px;background:#ec5b13;border:2px solid #fff;border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,0.5)"></div>`,
                  iconAnchor: [5, 5],
                })}
              />
            ))}
          </>
        )}

        {/* Functional zoom controls inside map */}
        <ZoomControls />
      </MapContainer>

      {/* ── Overlays (outside MapContainer) ── */}

      {/* Layer selector pills â€” [ESCONDIDO TEMPORARIAMENTE] */}
      {/* 
      {drawMode === 'none' && (
        <div ...>
          ...
        </div>
      )} 
      */}

      {/* Draw new field button */}
      {drawMode === 'none' && (
        <button
          onClick={() => setDrawMode('drawing')}
          className="absolute top-4 right-4 z-[500] flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 pointer-events-auto"
          style={{ background: '#ec5b13', boxShadow: '0 4px 20px rgba(236,91,19,0.35)' }}
        >
          <span className="material-symbols-outlined text-base">add_location_alt</span>
          Desenhar Talhão
        </button>
      )}

      {/* Drawing mode controls */}
      {drawMode === 'drawing' && (
        <>
          <div
            className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white pointer-events-none"
            style={{ background: 'rgba(8,8,9,0.92)', backdropFilter: 'blur(16px)', border: '1px solid rgba(236,91,19,0.3)' }}
          >
            <span className="material-symbols-outlined text-base" style={{ color: '#ec5b13' }}>draw</span>
            Clique no mapa para marcar os vértices &nbsp;·&nbsp; {drawPoints.length} ponto{drawPoints.length !== 1 ? 's' : ''}
          </div>

          <div
            className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[500] flex flex-col gap-3 px-5 py-4 rounded-2xl pointer-events-auto"
            style={{ background: 'rgba(8,8,9,0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.09)', minWidth: 420 }}
          >
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#ec5b13' }}>
              {drawPoints.length} pontos marcados · Novo Talhão
            </p>

            {/* Nome */}
            <input
              type="text"
              placeholder="Nome do talhão (ex: T01 – Soja Norte)"
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              className="w-full bg-transparent border-none text-sm focus:outline-none text-white placeholder:text-slate-600 border-b pb-2"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
            />

            {/* Cultura + Data */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] mb-1" style={{ color: '#64748b' }}>Cultura</p>
                <select
                  value={fieldCultura}
                  onChange={(e) => setFieldCultura(e.target.value)}
                  className="w-full bg-transparent text-sm focus:outline-none text-white cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px' }}
                >
                  <option value="" style={{ background: '#0c0c0e' }}>Selecionar...</option>
                  <option value="Soja" style={{ background: '#0c0c0e' }}>Soja</option>
                  <option value="Milho" style={{ background: '#0c0c0e' }}>Milho</option>
                  <option value="Algodão" style={{ background: '#0c0c0e' }}>Algodão</option>
                  <option value="Trigo" style={{ background: '#0c0c0e' }}>Trigo</option>
                  <option value="Cana-de-açúcar" style={{ background: '#0c0c0e' }}>Cana-de-açúcar</option>
                  <option value="Café" style={{ background: '#0c0c0e' }}>Café</option>
                  <option value="Outro" style={{ background: '#0c0c0e' }}>Outro</option>
                </select>
              </div>
              <div>
                <p className="text-[10px] mb-1" style={{ color: '#64748b' }}>Data de plantio</p>
                <input
                  type="date"
                  value={fieldDataPlantio}
                  onChange={(e) => setFieldDataPlantio(e.target.value)}
                  className="w-full text-sm focus:outline-none text-white cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px', colorScheme: 'dark' }}
                />
              </div>
            </div>

            {/* Variedade */}
            <input
              type="text"
              placeholder="Variedade / Cultivar (ex: M7739, DM 66i68)"
              value={fieldVariedade}
              onChange={(e) => setFieldVariedade(e.target.value)}
              className="w-full bg-transparent text-sm focus:outline-none text-white placeholder:text-slate-600"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '6px 10px' }}
            />

            {/* Botões */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setDrawPoints((p) => p.slice(0, -1))}
                disabled={drawPoints.length === 0}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-30"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}
              >
                <span className="material-symbols-outlined text-base">undo</span>
              </button>
              <button
                onClick={finishDrawing}
                disabled={drawPoints.length < 3 || isSaving}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ background: '#ec5b13' }}
              >
                {isSaving ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Talhão'
                )}
              </button>
              <button
                onClick={() => { setDrawPoints([]); setFieldName(''); setFieldCultura(''); setFieldDataPlantio(''); setFieldVariedade(''); setDrawMode('none'); }}
                disabled={isSaving}
                className="px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-30"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </>
      )}

      {/* Fields legend */}
      {drawMode === 'none' && fields.length > 0 && (
        <div
          className="absolute bottom-4 left-4 z-[500] p-3 rounded-xl pointer-events-none"
          style={{ background: 'rgba(8,8,9,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <p className="text-[9px] font-bold uppercase tracking-widest mb-2" style={{ color: '#64748b' }}>Talhões</p>
          <div className="space-y-1">
            {fields.map((loc, i) => (
              <div key={loc.id} className="flex items-center gap-2 text-xs text-white">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: FIELD_COLORS[i % FIELD_COLORS.length] }} />
                {loc.name ?? `Talhão ${i + 1}`}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NDVI legend */}
      {activeMapLayer === 'ndvi' && (
        <div
          className="absolute bottom-4 right-16 z-[500] p-3 rounded-xl pointer-events-none text-[10px]"
          style={{ background: 'rgba(8,8,9,0.85)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <p className="font-bold uppercase tracking-widest mb-2" style={{ color: '#64748b' }}>NDVI — NASA GIBS</p>
          <div className="flex items-center gap-2">
            <div className="w-20 h-2 rounded-full" style={{ background: 'linear-gradient(to right, #a52a2a, #ffff00, #00aa00)' }} />
          </div>
          <div className="flex justify-between text-[9px] mt-0.5 text-slate-500">
            <span>Baixo</span><span>Alto</span>
          </div>
          <p className="mt-1 text-[9px]" style={{ color: '#475569' }}>
            Data: {gibsDate.split('-').reverse().join('/')}
          </p>
        </div>
      )}
      {/* Location Status Badge */}
      {locationStatus !== 'precise' && locationStatus !== 'loading' && (
        <div 
          className="absolute top-16 left-4 z-[500] flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider pointer-events-auto shadow-lg"
          style={{ 
            background: 'rgba(15, 23, 42, 0.85)', 
            border: '1px solid rgba(245,158,11,0.3)',
            color: '#f59e0b',
            backdropFilter: 'blur(12px)'
          }}
        >
          <span className="material-symbols-outlined text-xs">location_off</span>
          {locationStatus === 'denied' ? 'GPS Negado' : 'Usando Localização Padrão'}
          <button 
            onClick={() => window.location.reload()}
            className="ml-2 px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
          >
            Atualizar
          </button>
        </div>
      )}

    </div>
  );
}

```


### `src/components/Layout.tsx`
```tsx
import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../services/supabase';



const NAV_ITEMS = [
  {
    to: '/app/dashboard',
    label: 'Mapa / Talhões',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    to: '/app/weather',
    label: 'Meteorologia',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    to: '/app/chat',
    label: 'Chat IA',
    badge: 'IA',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    to: '/app/alerts',
    label: 'Alertas',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    to: '/app/reports',
    label: 'Relatórios',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    to: '/app/market',
    label: 'Mercado',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    ),
  },
];

// â”€â”€ Sidebar content (shared between desktop & mobile drawer) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SidebarContent({ onNavClick, handleLogout }: { onNavClick?: () => void, handleLogout: () => Promise<void> }) {
  const { alerts } = useAppStore();
  const activeAlertCount = alerts.filter((a) => !a.dismissed).length;
  const [userName, setUserName] = useState('Usuário');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const name = data.user?.user_metadata?.full_name
        || data.user?.email?.split('@')[0]
        || 'Usuário';
      setUserName(name);
    });
  }, []);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--sidebar)' }}>
      {/* Logo */}
      <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-base font-black tracking-[0.15em] text-white">TRACTO</h1>
        <p className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--muted)' }}>Plataforma AgTech</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        <p className="px-3 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Navegação</p>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavClick}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            {item.icon}
            <span className="flex-1">{item.label}</span>
            {item.to === '/app/alerts' && activeAlertCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                {activeAlertCount}
              </span>
            )}
            {item.badge && (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: 'var(--primary-dim)', color: 'var(--primary)' }}>
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User Footer */}
      <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'var(--primary)', color: '#fff' }}>
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">{userName}</p>
            <p className="text-[10px] truncate" style={{ color: 'var(--muted)' }}>
              {userName === 'Usuário' ? 'Carregando...' : 'Administrador'}
            </p>
          </div>
          <button className="text-slate-600 hover:text-white transition-colors flex-shrink-0">
            <span className="material-symbols-outlined text-base">settings</span>
          </button>
        </div>

        <NavLink
          to="/app/billing"
          onClick={onNavClick}
          className="w-full flex items-center gap-3 px-4 py-2 mb-2 rounded-lg text-xs font-semibold transition-all hover:bg-white/5"
          style={{ color: '#94a3b8', border: '1px solid rgba(255,255,255,0.04)' }}
        >
          <span className="material-symbols-outlined text-base" style={{ color: 'var(--primary)' }}>credit_card</span>
          Minha Assinatura
        </NavLink>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all"
          style={{ color: '#f87171', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}
        >
          <span className="material-symbols-outlined text-sm">logout</span>
          Sair do Portal
        </button>
      </div>
    </div>
  );
}

// â”€â”€ Layout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function Layout() {
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const {
    farms,
    resetStore,
    weatherCache,
    syncFromBackend,
  } = useAppStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // Timeout: se backend demorar mais de 5s, continua sem sync
        const timeout = setTimeout(() => {
          useAppStore.setState({ isSyncing: false });
        }, 5000);
        
        syncFromBackend().finally(() => clearTimeout(timeout));

        // Trigger geolocation on mount if not already precise/denied
        const state = useAppStore.getState();
        if (state.locationStatus === 'loading' || state.locationStatus === 'fallback') {
          state.updateGeolocation();
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        syncFromBackend();
      }
    });

    return () => subscription.unsubscribe();
  }, [syncFromBackend]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    resetStore();
    navigate('/login');
  };

  // Determine active farm/field for display
  const temp = weatherCache ? `${Math.round(weatherCache.temperature)}Â°C` : 'â€”';
  const humidity = weatherCache ? `${weatherCache.humidity}%` : 'â€”';


  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap');

        *, *::before, *::after { box-sizing: border-box; }
        html, body, #root { height: 100%; }
        body { font-family: 'Inter', sans-serif; background-color: #080809; color: #f1f5f9; -webkit-font-smoothing: antialiased; }

        :root {
          --primary: #ec5b13;
          --primary-dim: rgba(236,91,19,0.12);
          --primary-border: rgba(236,91,19,0.2);
          --bg: #080809;
          --sidebar: #0c0c0e;
          --surface: rgba(255,255,255,0.03);
          --border: rgba(255,255,255,0.07);
          --border-strong: rgba(255,255,255,0.12);
          --muted: #64748b;
        }

        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

        .nav-item {
          display: flex; align-items: center; gap: 10px; padding: 9px 12px;
          border-radius: 10px; font-size: 13px; font-weight: 500; color: #64748b;
          transition: all 0.15s ease; text-decoration: none; position: relative;
        }
        .nav-item:hover { color: #e2e8f0; background: rgba(255,255,255,0.05); }
        .nav-item.active { color: #fff; background: var(--primary-dim); }
        .nav-item.active::before {
          content: ''; position: absolute; left: 0; top: 20%; height: 60%;
          width: 3px; background: var(--primary); border-radius: 99px;
        }

        .card-glass { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; }
        .header-glass { background: rgba(8,8,9,0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }

        /* Mobile drawer overlay */
        .drawer-overlay {
          position: fixed; inset: 0; z-index: 40;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(4px);
          transition: opacity 0.2s ease;
        }
        .drawer-panel {
          position: fixed; top: 0; left: 0; bottom: 0;
          width: 240px; z-index: 50;
          transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
        }
        .drawer-panel.open { transform: translateX(0); }
        .drawer-panel.closed { transform: translateX(-100%); }
      `}</style>

      <div className="flex h-screen w-full overflow-hidden" style={{ background: 'var(--bg)' }}>

        {/* â”€â”€ Desktop Sidebar (hidden on mobile) â”€â”€ */}
        <aside className="hidden md:flex w-60 flex-shrink-0 flex-col border-r" style={{ borderColor: 'var(--border)' }}>
          <SidebarContent handleLogout={handleLogout} />
        </aside>

        {/* â”€â”€ Mobile Drawer Overlay â”€â”€ */}
        {drawerOpen && (
          <div className="drawer-overlay md:hidden" onClick={() => setDrawerOpen(false)} />
        )}

        {/* â”€â”€ Mobile Drawer Panel â”€â”€ */}
        <div className={`drawer-panel md:hidden ${drawerOpen ? 'open' : 'closed'}`} style={{ background: 'var(--sidebar)', borderRight: '1px solid var(--border)' }}>
          {/* Close button */}
          <button
            onClick={() => setDrawerOpen(false)}
            className="absolute top-4 right-4 z-50 w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}
          >
            <span className="material-symbols-outlined text-sm" style={{ color: '#94a3b8' }}>close</span>
          </button>
          <SidebarContent onNavClick={() => setDrawerOpen(false)} handleLogout={handleLogout} />
        </div>

        {/* â”€â”€ Main Content â”€â”€ */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* TopBar */}
          <header
            className="header-glass flex items-center justify-between px-4 md:px-6 h-14 border-b flex-shrink-0 z-30"
            style={{ borderColor: 'var(--border)' }}
          >
            {/* Left Section: User Location & Operational Context */}
            <div className="flex items-center gap-6">
              {/* Hamburguer â€” mobile only */}
              <button
                onClick={() => setDrawerOpen(true)}
                className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg transition-all"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                aria-label="Abrir menu"
              >
                <span className="material-symbols-outlined text-base" style={{ color: 'var(--muted)' }}>menu</span>
              </button>

              {/* 1. Sua LocalizaÃ§Ã£o (GeogrÃ¡fica) */}
              <div className="flex items-center gap-2 p-1.5 px-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                <span className="material-symbols-outlined text-base" style={{ color: 'var(--primary)' }}>location_on</span>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider leading-none mb-0.5" style={{ color: 'var(--muted)' }}>Sua LocalizaÃ§Ã£o</p>
                  <p className="text-xs font-bold text-white leading-tight truncate max-w-[120px] md:max-w-none">
                    {useAppStore.getState().currentLocation?.name || 'Londrina, PR'}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Section: Actions & Weather */}
            <div className="flex items-center gap-4">
              {/* Weather Info â€” hidden on mobile */}
              <div className="hidden lg:flex items-center gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5">
                  <span className="material-symbols-outlined text-base" style={{ color: '#f97316' }}>wb_sunny</span>
                  {temp}
                </span>
                <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5">
                  <span className="material-symbols-outlined text-base text-blue-400">humidity_percentage</span>
                  <span style={{ color: 'var(--muted)' }}>{humidity}</span>
                </span>
              </div>

              {/* Seletor unificado: Fazenda → Talhão */}
              <div className="relative hidden md:flex items-center rounded-lg overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <span className="material-symbols-outlined text-sm pl-3 pointer-events-none" style={{ color: 'var(--primary)' }}>agriculture</span>
                <select
                  className="appearance-none bg-transparent border-none text-white text-[10px] font-bold py-2 pl-2 pr-8 focus:outline-none cursor-pointer"
                  value={useAppStore.getState().activeFieldId || useAppStore.getState().activeFarmId || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const store = useAppStore.getState();
                    // Verificar se é um field ou uma farm
                    const allFields = store.farms.flatMap(f => f.fields || []);
                    const isField = allFields.some(f => f.id === val);
                    if (isField) {
                      store.setActiveField(val);
                      // Navegar para o mapa ao selecionar talhão
                      navigate('/app/dashboard');
                    } else {
                      store.setActiveFarm(val);
                      store.setActiveField(null);
                    }
                  }}
                >
                  {farms.length === 0 ? (
                    <option value="" disabled>NENHUMA FAZENDA</option>
                  ) : (
                    farms.map((farm) => (
                      <optgroup key={farm.id} label={farm.name.toUpperCase()} style={{ background: '#0c0c0e' }}>
                        {(farm.fields || []).length === 0 ? (
                          <option value={farm.id} style={{ background: '#0c0c0e' }}>Sem talhões cadastrados</option>
                        ) : (
                          (farm.fields || []).map((field) => (
                            <option key={field.id} value={field.id} style={{ background: '#0c0c0e' }}>
                              {field.name?.toUpperCase()}
                            </option>
                          ))
                        )}
                      </optgroup>
                    ))
                  )}
                </select>
                <span className="material-symbols-outlined absolute right-2 pointer-events-none text-base" style={{ color: 'var(--muted)' }}>expand_more</span>
              </div>

              {/* Notifications */}
              <button className="relative p-2 rounded-lg transition-all" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <span className="material-symbols-outlined text-base" style={{ color: 'var(--muted)' }}>notifications</span>
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2" style={{ background: '#ef4444', borderColor: 'var(--bg)' }} />
              </button>
            </div>
          </header>

          {/* Page Content â€” scrolls correctly on mobile */}
          <main className="flex-1 flex overflow-hidden min-h-0">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
}




```


### `src/components/ProtectedRoute.tsx`
```tsx
import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import type { Session } from '@supabase/supabase-js';

// Função para aplicar a máscara visual de telefone brasileiro que você já usa no Register.tsx
const maskPhone = (v: string) => {
  let val = v.replace(/\D/g, '');
  if (val.length > 11) val = val.slice(0, 11);
  if (val.length > 10) return `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7)}`;
  if (val.length > 6) return `(${val.slice(0, 2)}) ${val.slice(2, 6)}-${val.slice(6)}`;
  if (val.length > 2) return `(${val.slice(0, 2)}) ${val.slice(2)}`;
  if (val.length > 0) return `(${val}`;
  return val;
};

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [needsPhone, setNeedsPhone] = useState(false);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 1. Verificar sessão inicial
    supabase.auth.getSession().then(({ data }) => {
      
      setSession(data.session);
      
      const userPhone = data.session?.user?.user_metadata?.phone;
      if (data.session && !userPhone) {
        setNeedsPhone(true);
      } else {
        setNeedsPhone(false);
      }
    });

    // 2. Escutar mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      
      const userPhone = session?.user?.user_metadata?.phone;
      if (session && !userPhone) {
        setNeedsPhone(true);
      } else {
        setNeedsPhone(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Função para salvar o telefone no perfil do Supabase quando o usuário digita
  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      alert('Por favor, insira um número de WhatsApp válido.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { phone: cleanPhone }
      });

      if (error) throw error;
      
      setNeedsPhone(false);
    } catch (err: unknown) {
      console.error('ProtectedRoute Error:', err);
      alert('Erro ao salvar o telefone. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080809' }}>
        <div className="flex flex-col items-center gap-4">
          <span className="material-symbols-outlined text-5xl animate-spin" style={{ color: '#ec5b13' }}>refresh</span>
          <p className="text-sm font-medium" style={{ color: '#64748b' }}>Verificando sessão...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Se a sessão existe mas o telefone está em falta, interceptamos e mostramos a tela de bloqueio
  if (needsPhone) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 z-[9999] relative" style={{ background: '#080809' }}>
        <div className="w-full max-w-md p-8 md:p-10 rounded-[2rem] border border-white/10 shadow-2xl backdrop-blur-3xl relative z-10" style={{ background: 'rgba(15, 23, 42, 0.6)' }}>
          <div className="text-center mb-8">
            <span className="text-2xl font-bold tracking-[0.4em] text-white uppercase block mb-2">Tracto</span>
            <p className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-medium">Quase lá! Precisamos do seu contato</p>
          </div>

          <form onSubmit={handleSavePhone} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">WhatsApp para Alertas</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(maskPhone(e.target.value))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-400/50 transition-colors text-sm font-light"
                placeholder="(11) 99999-9999"
                required
              />
              <p className="text-[10px] text-slate-500 ml-1">Usaremos este número apenas para enviar alertas críticos de clima e satélite da sua lavoura.</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-full text-xs font-bold uppercase tracking-[0.3em] transition-all hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? 'Salvando...' : 'Concluir Acesso'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

```


### `src/components/Skeleton.tsx`
```tsx
interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

const BASE = {
  background: 'rgba(255,255,255,0.06)',
  borderRadius: 8,
  animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
} as const;

/** Single skeleton line */
export function SkeletonLine({ className = '', style }: SkeletonProps) {
  return (
    <div
      className={`h-3 rounded ${className}`}
      style={{ ...BASE, ...style }}
    />
  );
}

/** Card-shaped skeleton block */
export function SkeletonCard({ className = '', style }: SkeletonProps) {
  return (
    <div
      className={`rounded-xl p-4 flex flex-col gap-3 ${className}`}
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', ...style }}
    >
      <div style={{ ...BASE, height: 10, width: '40%', borderRadius: 6 }} />
      <div style={{ ...BASE, height: 24, width: '60%', borderRadius: 6 }} />
      <div style={{ ...BASE, height: 8, width: '30%', borderRadius: 6 }} />
      <div style={{ ...BASE, height: 4, borderRadius: 99, marginTop: 4 }} />
    </div>
  );
}

/** Chart-area sized skeleton */
export function SkeletonChart({ className = '', style }: SkeletonProps) {
  return (
    <div
      className={`rounded-2xl p-5 flex flex-col gap-4 ${className}`}
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', ...style }}
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <div style={{ ...BASE, height: 8, width: 120, borderRadius: 6 }} />
          <div style={{ ...BASE, height: 28, width: 80, borderRadius: 6 }} />
        </div>
        <div style={{ ...BASE, height: 22, width: 50, borderRadius: 8 }} />
      </div>
      {/* Fake bars */}
      <div className="flex items-end gap-2 h-24">
        {[60, 80, 45, 90, 70, 55, 85, 75].map((h, i) => (
          <div
            key={i}
            style={{ ...BASE, flex: 1, height: `${h}%`, borderRadius: '4px 4px 0 0' }}
          />
        ))}
      </div>
      <div className="flex justify-between">
        {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'].map((m) => (
          <div key={m} style={{ ...BASE, height: 7, width: 20, borderRadius: 4 }} />
        ))}
      </div>
    </div>
  );
}

/** Map-area sized skeleton */
export function SkeletonMap({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`w-full h-full rounded-xl flex items-center justify-center ${className}`}
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex flex-col items-center gap-3">
        <div style={{ ...BASE, width: 48, height: 48, borderRadius: '50%' }} />
        <div style={{ ...BASE, width: 120, height: 10, borderRadius: 6 }} />
      </div>
    </div>
  );
}

// Global keyframe injected once
const STYLE = `@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }`;
if (typeof document !== 'undefined' && !document.getElementById('skeleton-kf')) {
  const s = document.createElement('style');
  s.id = 'skeleton-kf';
  s.textContent = STYLE;
  document.head.appendChild(s);
}

export default { SkeletonLine, SkeletonCard, SkeletonChart, SkeletonMap };

```


### `src/index.css`
```css
@import "tailwindcss";

@theme {
  --color-primary-50: #fefce8;
  --color-primary-100: #fef9c3;
  --color-primary-200: #fef08a;
  --color-primary-300: #fde047;
  --color-primary-400: #facc15;
  --color-primary-500: #eab308;
  --color-primary-600: #ca8a04;
  --color-primary-700: #a16207;
  --color-primary-800: #854d0e;
  --color-primary-900: #713f12;
  --color-primary-950: #422006;

  --color-warning-50: #fffbeb;
  --color-warning-100: #fef3c7;
  --color-warning-500: #f59e0b;
  --color-warning-600: #d97706;

  --color-danger-50: #fef2f2;
  --color-danger-100: #fee2e2;
  --color-danger-500: #ef4444;
  --color-danger-600: #dc2626;

  --color-success-50: #ecfdf5;
  --color-success-100: #d1fae5;
  --color-success-500: #10b981;
  --color-success-600: #059669;

  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}

body {
  @apply bg-slate-50 text-slate-900 font-sans antialiased;
}

/* Leaflet maps custom resets */
.leaflet-container {
  width: 100%;
  height: 100%;
  z-index: 10;
}

/* Scrollbar fina e discreta global */
window::-webkit-scrollbar,
::-webkit-scrollbar {
  width: 4px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 99px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}

```


### `src/main.tsx`
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { supabase } from './services/supabase'

// Detectar sessão OAuth do URL hash ao iniciar
supabase.auth.onAuthStateChange((event, session) => {
  console.log('[Auth] Event:', event, '| User:', session?.user?.email ?? 'none')
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

```


### `src/pages/Alerts.tsx`
```tsx
import { useEffect, useState } from 'react';
import useAppStore from '../store/useAppStore';
import { generateAlerts } from '../services/alertsAI';
import type { Alert } from '../store/useAppStore';

import { useNavigate } from 'react-router-dom';

// ── Alert type colors ─────────────────────────────────────────────────────────
const TYPE_STYLE: Record<Alert['type'], { border: string; badge: string; badgeText: string }> = {
  critical: {
    border: 'border-orange-500',
    badge: 'bg-orange-500/20 text-orange-400',
    badgeText: 'ALERTA CRÍTICO',
  },
  warning: {
    border: 'border-amber-500',
    badge: 'bg-amber-500/20 text-amber-400',
    badgeText: 'AVISO',
  },
  info: {
    border: 'border-blue-500',
    badge: 'bg-blue-500/20 text-blue-400',
    badgeText: 'INFORMATIVO',
  },
};

const TYPE_VALUE_COLOR: Record<Alert['type'], string> = {
  critical: '#ef4444',
  warning: '#f59e0b',
  info: '#60a5fa',
};

// ── Extra fields added by alertsAI ───────────────────────────────────────────
interface AlertExtra extends Alert {
  field?: string;
  value?: string;
  valueLabel?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Alerts() {
  const navigate = useNavigate();
  const { currentLocation, fields, weatherCache, alerts, setAlerts, dismissAlert } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  

  const loc = fields.length > 0
    ? fields[fields.length - 1]
    : (currentLocation || { lat: -23.31028, lng: -51.16278, name: 'Londrina, PR' });

  const visibleAlerts = (alerts as AlertExtra[]).filter((a) => !a.dismissed);
  const criticalCount = visibleAlerts.filter((a) => a.type === 'critical').length;
  const warningCount = visibleAlerts.filter((a) => a.type === 'warning').length;
  const infoCount = visibleAlerts.filter((a) => a.type === 'info').length;

  // Alertas locais gerados automaticamente quando não há talhões
  const getLocalAlerts = () => {
    if (!weatherCache) return [];
    const local = [];
    if (weatherCache.temperature > 32) {
      local.push({ id: 'l1', type: 'warning' as const, title: 'Calor intenso', message: 'Atenção ao estresse hídrico das culturas.' });
    }
    if ((weatherCache.daily.precipSum[0] ?? 0) > 20) {
      local.push({ id: 'l2', type: 'info' as const, title: 'Chuva significativa prevista', message: 'Avalie condições de pulverização.' });
    }
    if (weatherCache.windSpeed > 20) {
      local.push({ id: 'l3', type: 'warning' as const, title: 'Vento forte', message: 'Evite pulverizações hoje.' });
    }
    if (local.length === 0) {
      local.push({ id: 'l4', type: 'info' as const, title: 'Condições favoráveis', message: `Temperatura atual: ${Math.round(weatherCache.temperature)}°C, Umidade: ${weatherCache.humidity}%` });
    }
    return local;
  };
  const localAlerts = getLocalAlerts();

  const loadAlerts = async () => {
    if (fields.length === 0 && !weatherCache) return;
    setLoading(true);
    setError(null);
    try {
      const generated = await generateAlerts(weatherCache, fields);
      setAlerts(generated);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao gerar alertas');
    } finally {
      setLoading(false);
    }
  };

  // Auto-load when mounting if no alerts yet
  useEffect(() => {
    if (alerts.length === 0 && fields.length > 0 && weatherCache) {
      loadAlerts();
    }
  }, []);

  return (
    <>
      <style>{`
        .glass-card-alert {
          background: rgba(38, 28, 24, 0.6);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(236, 91, 19, 0.1);
        }
        .alert-scrollbar::-webkit-scrollbar { width: 6px; }
        .alert-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .alert-scrollbar::-webkit-scrollbar-thumb { background: #3d2a22; border-radius: 10px; }
      `}</style>

      <main className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#0a0a0a' }}>
        <div className="flex-1 overflow-y-auto alert-scrollbar p-10">

          {/* ── Header + Reload ── */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-white font-bold text-xl">Alertas Inteligentes</h1>
              <p className="text-slate-400 text-xs mt-1">
                Análise em tempo real via IA · {loc?.name ?? 'Localização atual'}
              </p>
            </div>
            <button
              onClick={loadAlerts}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: '#ec5b13', boxShadow: '0 4px 20px rgba(236,91,19,0.3)' }}
            >
              <span className={`material-symbols-outlined text-sm ${loading ? 'animate-spin' : ''}`}>
                {loading ? 'refresh' : 'smart_toy'}
              </span>
              {loading ? 'Analisando...' : 'Gerar Alertas IA'}
            </button>
          </div>

          {/* ── No fields message ── */}
          {fields.length === 0 && !loading && (
            <>
              <div className="glass-card-alert rounded-2xl p-8 text-center mb-8" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
                <span className="material-symbols-outlined text-5xl mb-4 block" style={{ color: '#ec5b13' }}>map</span>
                <h3 className="text-white font-bold mb-2">Nenhum talhão cadastrado</h3>
                <p className="text-slate-400 text-sm">Vá até o <span className="text-white font-semibold">Mapa / Talhões</span> e desenhe seu primeiro talhão para ativar os alertas de IA.</p>
              </div>

              {localAlerts.length > 0 && (
                <>
                  <h3 className="text-slate-100 font-bold mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-blue-400 text-xl">wb_sunny</span>
                    Clima em sua região
                  </h3>
                  <div className="grid grid-cols-1 gap-4 mb-8">
                    {localAlerts.map((a) => {
                      const st = TYPE_STYLE[a.type];
                      return (
                        <div key={a.id} className={`glass-card-alert rounded-xl overflow-hidden flex flex-col items-stretch border-l-4 ${st.border}`}>
                          <div className="p-6">
                            <div className="flex flex-col gap-2">
                              <span className={`px-2 py-0.5 ${st.badge} text-[10px] font-bold rounded uppercase w-fit`}>
                                {st.badgeText}
                              </span>
                              <h4 className="text-slate-100 text-base font-bold">{a.title}</h4>
                              <p className="text-slate-400 text-sm">{a.message}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {/* ── Empty state (No alerts from AI) ── */}
          {!loading && alerts.length === 0 && fields.length > 0 && !error && (
            <div className="glass-card-alert rounded-2xl p-10 text-center mb-8" style={{ border: '1px solid rgba(74, 222, 128, 0.2)', background: 'rgba(74, 222, 128, 0.03)' }}>
              <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-4xl text-green-500">task_alt</span>
              </div>
              <h3 className="text-white font-bold text-lg mb-2">Sua lavoura está protegida</h3>
              <p className="text-slate-400 text-sm max-w-md mx-auto">
                Nenhuma anomalia crítica foi detectada pela nossa IA nos seus talhões monitorados no momento.
              </p>
              <button 
                onClick={loadAlerts}
                className="mt-6 text-green-400 text-xs font-bold uppercase tracking-widest hover:text-green-300 transition-colors"
              >
                Refazer análise agora
              </button>
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div className="p-4 rounded-xl flex items-start gap-3 mb-6" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <span className="material-symbols-outlined text-red-400 mt-0.5">error</span>
              <div>
                <p className="text-sm text-red-300 font-semibold">Erro ao gerar alertas</p>
                <p className="text-xs text-red-400 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* ── Loading skeleton ── */}
          {loading && (
            <div className="space-y-4 mb-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card-alert rounded-xl h-36 animate-pulse" style={{ borderLeft: '4px solid #ec5b13' }} />
              ))}
            </div>
          )}

          {/* ── Summary row ── */}
          {!loading && visibleAlerts.length > 0 && (
            <div className="flex flex-col md:flex-row gap-4 mb-8">
              {[
                { label: 'Críticos', count: criticalCount, icon: 'warning', borderColor: '#f97316', bgColor: 'rgba(249,115,22,0.1)' },
                { label: 'Avisos', count: warningCount, icon: 'warning', borderColor: '#f59e0b', bgColor: 'rgba(245,158,11,0.1)' },
                { label: 'Informativos', count: infoCount, icon: 'info', borderColor: '#60a5fa', bgColor: 'rgba(96,165,250,0.1)' },
              ].map(({ label, count, icon, borderColor, bgColor }) => (
                <div key={label} className="glass-card-alert rounded-xl overflow-hidden flex items-stretch p-4 flex-1" style={{ borderLeft: `4px solid ${borderColor}` }}>
                  <div className="flex items-center gap-4 w-full">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: bgColor }}>
                      <span className="material-symbols-outlined" style={{ color: borderColor }}>{icon}</span>
                    </div>
                    <div className="text-left">
                      <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">{label}</p>
                      <p className="text-2xl font-bold text-slate-100">{String(count).padStart(2, '0')}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Alerts feed ── */}
          {!loading && visibleAlerts.length > 0 && (
            <>
              <h3 className="text-slate-100 font-bold mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-500 text-xl">feed</span>
                Feed de Atividades em Tempo Real
              </h3>

              {criticalCount > 0 && (
                <div className="glass-card-alert rounded-xl p-6 mb-6 flex flex-col md:flex-row items-center justify-between gap-4 border-l-4 border-orange-500/50" style={{ background: 'rgba(236,91,19,0.05)' }}>
                  <div>
                    <h4 className="text-white font-bold flex items-center gap-2">
                      <span className="material-symbols-outlined text-orange-500">satellite_alt</span>
                      Alerta crítico detectado
                    </h4>
                    <p className="text-slate-400 text-sm mt-1">Analise o talhão via satélite para localizar a área afetada.</p>
                  </div>
                  <button
                    onClick={() => navigate('/app')}
                    className="px-4 py-2 rounded-lg bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 transition-all flex-shrink-0"
                  >
                    Analisar no Dashboard
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                {visibleAlerts.map((alert) => {
                  const a = alert as AlertExtra;
                  const st = TYPE_STYLE[a.type];
                  return (
                    <div
                      key={a.id}
                      className={`glass-card-alert rounded-xl overflow-hidden flex flex-col md:flex-row items-stretch border-l-4 ${st.border}`}
                    >
                      <div className="p-6 flex-1 flex flex-col justify-between">
                        <div className="flex flex-col xl:flex-row justify-between items-start gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 ${st.badge} text-[10px] font-bold rounded uppercase`}>
                                {st.badgeText}
                              </span>
                                <span className="text-slate-500 text-[11px] font-medium tracking-tight">
                                  {a.field ? `${a.field} · ` : ''}{new Date(a.timestamp).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {(a.id.startsWith('A') || a.id.startsWith('M')) && (
                                  <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-500/10 text-green-400 text-[9px] font-bold rounded border border-green-500/20">
                                    <span className="material-symbols-outlined text-[10px]">verified</span>
                                    FONTE: MOTOR DETERMINÍSTICO
                                  </span>
                                )}
                              </div>
                            <h4 className="text-slate-100 text-lg font-bold">{a.title}</h4>
                            <p className="text-slate-400 text-sm mt-2 max-w-2xl">{a.message}</p>
                          </div>
                          {a.value && (
                            <div className="text-left xl:text-right w-full xl:w-auto flex-shrink-0">
                              <span className="text-2xl font-bold" style={{ color: TYPE_VALUE_COLOR[a.type] }}>{a.value}</span>
                              <p className="text-slate-500 text-[10px] font-bold uppercase mt-0.5">{a.valueLabel}</p>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-end mt-4 pt-4 border-t gap-2" style={{ borderColor: 'rgba(236,91,19,0.05)' }}>
                          <button
                            onClick={() => dismissAlert(a.id)}
                            className="px-4 py-2 rounded-lg text-slate-300 text-xs font-bold border hover:bg-orange-500/5 transition-all"
                            style={{ background: 'rgba(38,28,24,1)', borderColor: 'rgba(236,91,19,0.1)' }}
                          >
                            Ignorar
                          </button>
                          <button 
                            onClick={() => navigate('/app/reports')}
                            className="px-4 py-2 rounded-lg bg-orange-500 text-white text-xs font-bold hover:bg-orange-600 shadow-lg shadow-orange-500/20 transition-all"
                          >
                            Ver Detalhes
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* ── Empty state (after dismiss all) ── */}
          {!loading && visibleAlerts.length === 0 && alerts.length > 0 && (
            <div className="glass-card-alert rounded-2xl p-8 text-center" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
              <span className="material-symbols-outlined text-5xl mb-4 block text-green-400">check_circle</span>
              <h3 className="text-white font-bold mb-2">Nenhum alerta ativo</h3>
              <p className="text-slate-400 text-sm">Todos os alertas foram dispensados. Clique em "Gerar Alertas IA" para uma nova análise.</p>
            </div>
          )}

        </div>
      </main>
    </>
  );
}

```


### `src/pages/Chat.tsx`
```tsx
import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import useAppStore from '../store/useAppStore';
import { apiFetch } from '../services/api';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../services/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'assistant';
  text: string;
  time: string;
  imagePreview?: string;
}

interface SavedConversation {
  conversation_id: string;
  title: string;
  messages: { role: string; text: string }[];
  farm_context?: string;
  created_at: string;
  updated_at: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const nowTime = () =>
  new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const nowISO = () => new Date().toISOString();

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `há ${mins}min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'ontem';
  return `há ${days} dias`;
}

const INITIAL_MSG = (time: string): Message => ({
  role: 'assistant',
  text: 'Olá! Sou a **Tracto IA**, sua analista agronômica. Posso ajudar com análise de solo, NDVI, irrigação, pragas, colheita e clima.\n\n📸 **Dica:** Envie uma foto da lavoura para análise visual de pragas e doenças.\n\nComo posso ajudar?',
  time,
});

function buildFarmContext(
  fields: ReturnType<typeof useAppStore.getState>['fields']
): string {
  if (fields.length === 0) return 'Nenhum talhão cadastrado.';
  return fields
    .map((l, i) => {
      const area = l.areaHa ? `${l.areaHa.toFixed(2)} ha` : 'Área N/D';
      let ctx = `- ${l.name ?? `Talhão ${i + 1}`} (${area})`;
      const cached = localStorage.getItem(`tracto-ndvi-${l.lat}-${l.lng}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
            const ndvi = parsed.data.ndvi_analysis;
            ctx += `\n  NDVI: ndvi_medio=${ndvi.ndvi_medio?.toFixed(2)}, zona_critica=${ndvi.zona_critica_pct}%, tendencia=${ndvi.tendencia}`;
          }
        } catch { /* ignore */ }
      }
      return ctx;
    })
    .join('\n');
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
  });
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function Chat() {
  const { addMessage, clearChat, fields, weatherCache } = useAppStore();

  // Conversation state
  const [conversationId, setConversationId] = useState<string>(() => uuidv4());
  const [conversationCreatedAt, setConversationCreatedAt] = useState<string>(() => nowISO());
  const [messages, setMessages] = useState<Message[]>(() => [INITIAL_MSG(nowTime())]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Sidebar: saved conversations
  const [savedConversations, setSavedConversations] = useState<SavedConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(false);

  // Image
  const [pendingImage, setPendingImage] = useState<{
    base64: string;
    mimeType: string;
    preview: string;
    name: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    return () => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      if (pendingImage) URL.revokeObjectURL(pendingImage.preview);
    };
  }, [pendingImage]);

  // ── Load saved conversations on mount ──────────────────────────────────────
  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      setLoadingConversations(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const data = await apiFetch<{ conversations: SavedConversation[] }>('/api/conversations');
      setSavedConversations(data.conversations || []);
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Nao foi possivel carregar as conversas salvas.');
    } finally {
      setLoadingConversations(false);
    }
  };

  // ── Auto-save with 3s debounce ──────────────────────────────────────────────
  const scheduleSave = useCallback(
    (msgs: Message[], cid: string, createdAt: string) => {
      if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
      saveDebounceRef.current = setTimeout(async () => {
        const userMessages = msgs.filter((m) => m.role !== 'assistant' || msgs.indexOf(m) > 0);
        if (userMessages.length < 2) return; // só salvar se houver pelo menos 1 troca

        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          // Título = primeiros 40 chars da 1ª msg do usuário
          const firstUserMsg = msgs.find((m) => m.role === 'user');
          const title = firstUserMsg
            ? firstUserMsg.text.slice(0, 40) + (firstUserMsg.text.length > 40 ? '...' : '')
            : 'Nova Conversa';

          await apiFetch('/api/conversations/save', {
            method: 'POST',
            body: JSON.stringify({
              conversation_id: cid,
              title,
              messages: msgs.map((m) => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                text: m.text,
              })),
              farm_context: buildFarmContext(fields),
              created_at: createdAt,
              updated_at: nowISO(),
            }),
          });
          await loadConversations();
        } catch (error) {
          setApiError(error instanceof Error ? error.message : 'Nao foi possivel sincronizar a conversa.');
        }
      }, 3000);
    },
    [fields]
  );

  // ── Start new conversation ─────────────────────────────────────────────────
  const startNewConversation = () => {
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current);
    const newId = uuidv4();
    const createdAt = nowISO();
    setConversationId(newId);
    setConversationCreatedAt(createdAt);
    setMessages([INITIAL_MSG(nowTime())]);
    setActiveConversationId(null);
    clearChat();
    setApiError(null);
    setInput('');
    setPendingImage(null);
  };

  // ── Load a saved conversation ──────────────────────────────────────────────
  const loadConversation = (conv: SavedConversation) => {
    setActiveConversationId(conv.conversation_id);
    setConversationId(conv.conversation_id);
    setConversationCreatedAt(conv.created_at);
    const loaded: Message[] = conv.messages.map((m) => ({
      role: m.role === 'model' || m.role === 'assistant' ? 'assistant' : 'user',
      text: m.text,
      time: '',
    }));
    setMessages(loaded.length > 0 ? loaded : [INITIAL_MSG(nowTime())]);
    setInput('');
    setPendingImage(null);
    setApiError(null);
  };

  // ── Delete conversation ────────────────────────────────────────────────────
  const deleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    try {
      await apiFetch(`/api/conversations/${convId}`, { method: 'DELETE' });
      setSavedConversations((prev) => prev.filter((c) => c.conversation_id !== convId));
      if (activeConversationId === convId) startNewConversation();
    } catch (error) {
      setApiError(error instanceof Error ? error.message : 'Nao foi possivel deletar a conversa.');
    }
  };

  // ── Image handling ─────────────────────────────────────────────────────────
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setApiError('Formato inválido. Use JPG, PNG ou WEBP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setApiError('Imagem muito grande. Máximo: 5MB.');
      return;
    }
    try {
      const base64 = await fileToBase64(file);
      const preview = URL.createObjectURL(file);
      setPendingImage({ base64, mimeType: file.type, preview, name: file.name });
      setApiError(null);
    } catch {
      setApiError('Erro ao processar a imagem.');
    }
    e.target.value = '';
  };

  const removePendingImage = () => {
    if (pendingImage) URL.revokeObjectURL(pendingImage.preview);
    setPendingImage(null);
  };

  // ── Send message ───────────────────────────────────────────────────────────
  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if ((!content && !pendingImage) || isLoading) return;
    setInput('');
    setApiError(null);

    const imagePreview = pendingImage?.preview;
    const imageBase64 = pendingImage?.base64 ?? null;
    const imageMime = pendingImage?.mimeType ?? 'image/jpeg';
    const capturedImage = pendingImage;
    setPendingImage(null);

    const userMsg: Message = {
      role: 'user',
      text: content || '📸 [Imagem enviada para análise]',
      time: nowTime(),
      imagePreview,
    };

    const newMessages = (prev: Message[]) => [...prev, userMsg];
    setMessages((p) => newMessages(p));
    addMessage('user', userMsg.text);
    setIsLoading(true);

    try {
      const payloadMessages = [
        ...messages
          .filter((m) => m.role !== 'assistant' || messages.indexOf(m) > 0)
          .map((m) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            text: m.text,
          })),
        { role: 'user', text: userMsg.text },
      ];

      const farm_context = buildFarmContext(fields);
      const hourly_weather = weatherCache
        ? { temperature: weatherCache.temperature, humidity: weatherCache.humidity, wind_speed: weatherCache.windSpeed }
        : null;

      const data = await apiFetch<{ reply: string }>('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          messages: payloadMessages,
          farm_context,
          image_base64: imageBase64,
          image_mime_type: imageMime,
          hourly_weather,
        }),
      });

      if (capturedImage) URL.revokeObjectURL(capturedImage.preview);

      const aiText = data.reply ?? '';
      const aiMsg: Message = { role: 'assistant', text: aiText, time: nowTime() };

      setMessages((prev) => {
        const updated = [...prev, aiMsg];
        scheduleSave(updated, conversationId, conversationCreatedAt);
        return updated;
      });
      addMessage('model', aiText);
      setActiveConversationId(conversationId);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido';
      setApiError(msg);
      setMessages((p) => [
        ...p,
        { role: 'assistant', text: `⚠️ Erro ao conectar: ${msg}`, time: nowTime() },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Sidebar: Histórico ──────────────────────────────────────────── */}
      <div
        className="w-64 flex-shrink-0 flex flex-col border-r"
        style={{ background: 'rgba(255,255,255,0.01)', borderColor: 'rgba(255,255,255,0.07)' }}
      >
        {/* New conversation button */}
        <div className="p-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <button
            onClick={startNewConversation}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ background: 'rgba(236,91,19,0.14)', border: '1px solid rgba(236,91,19,0.22)' }}
          >
            <span>Nova Conversa</span>
            <span className="material-symbols-outlined text-base" style={{ color: '#ec5b13' }}>
              add_comment
            </span>
          </button>
        </div>

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest px-2 py-2"
            style={{ color: '#64748b' }}
          >
            Conversas Salvas
          </p>

          {loadingConversations && (
            <div className="flex justify-center py-4">
              <span
                className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: '#ec5b13', borderTopColor: 'transparent' }}
              />
            </div>
          )}

          {!loadingConversations && !apiError && savedConversations.length === 0 && (
            <p className="text-[10px] px-2 py-3" style={{ color: '#334155' }}>
              Nenhuma conversa salva ainda.
            </p>
          )}


          <div className="space-y-0.5">
            {savedConversations.map((conv) => {
              const isActive = activeConversationId === conv.conversation_id;
              return (
                <div key={conv.conversation_id} className="group relative">
                  <button
                    onClick={() => loadConversation(conv)}
                    className="w-full text-left px-3 py-2.5 rounded-xl transition-all"
                    style={{
                      background: isActive ? 'rgba(236,91,19,0.1)' : 'transparent',
                      border: isActive ? '1px solid rgba(236,91,19,0.3)' : '1px solid transparent',
                    }}
                  >
                    <p
                      className="text-xs font-medium truncate pr-5"
                      style={{ color: isActive ? '#f97316' : '#cbd5e1' }}
                    >
                      {conv.title}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: '#475569' }}>
                      {relativeDate(conv.updated_at)}
                    </p>
                  </button>
                  {/* Delete button — visible on hover */}
                  <button
                    onClick={(e) => deleteConversation(e, conv.conversation_id)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hidden group-hover:flex"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}
                    title="Deletar conversa"
                  >
                    <span className="material-symbols-outlined text-xs">delete</span>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Context badge */}
          {fields.length > 0 && (
            <div className="mt-4 px-2">
              <p
                className="text-[10px] font-semibold uppercase tracking-widest mb-2"
                style={{ color: '#64748b' }}
              >
                Contexto ativo
              </p>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[10px]" style={{ color: '#4ade80' }}>
                  <span className="material-symbols-outlined text-xs">map</span>
                  {fields.length} talhão{fields.length > 1 ? 'ões' : ''}
                </div>
                {weatherCache && (
                  <div className="flex items-center gap-1.5 text-[10px]" style={{ color: '#60a5fa' }}>
                    <span className="material-symbols-outlined text-xs">wb_sunny</span>
                    {Math.round(weatherCache.temperature)}°C · {weatherCache.humidity}%
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* API status */}
        <div className="p-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-semibold ${
              apiError ? 'text-red-400' : 'text-green-400'
            }`}
            style={{
              background: apiError ? 'rgba(239,68,68,0.08)' : 'rgba(74,222,128,0.07)',
              border: `1px solid ${apiError ? 'rgba(239,68,68,0.18)' : 'rgba(74,222,128,0.15)'}`,
            }}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                apiError ? 'bg-red-400' : 'bg-green-400 animate-pulse'
              }`}
            />
            {apiError ? 'Erro de API' : 'Servidor conectado'}
          </div>
        </div>
      </div>

      {/* ── Chat Principal ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0" style={{ background: '#080809' }}>
        {/* Header */}
        <div
          className="px-5 py-3 border-b flex items-center justify-between flex-shrink-0"
          style={{
            borderColor: 'rgba(255,255,255,0.07)',
            background: 'rgba(255,255,255,0.018)',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(236,91,19,0.15)' }}
            >
              <span className="material-symbols-outlined text-xl" style={{ color: '#ec5b13' }}>
                smart_toy
              </span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Tracto IA</h2>
              <p className="text-[10px] flex items-center gap-1.5" style={{ color: '#64748b' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                Analista Agronômica · Claude Sonnet · Visão Ativa
              </p>
            </div>
          </div>
          <button
            onClick={startNewConversation}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#94a3b8',
            }}
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Reiniciar
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-4">
          {messages.map((msg, i) =>
            msg.role === 'assistant' ? (
              <div key={i} className="flex gap-3 max-w-2xl">
                <div
                  className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5"
                  style={{ background: 'rgba(236,91,19,0.15)' }}
                >
                  <span className="material-symbols-outlined text-sm" style={{ color: '#ec5b13' }}>
                    smart_toy
                  </span>
                </div>
                <div className="flex-1 space-y-1">
                  <div
                    className="px-4 py-3 rounded-2xl rounded-tl-none text-sm leading-relaxed prose prose-sm prose-invert max-w-none prose-p:my-1"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      color: '#cbd5e1',
                    }}
                  >
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                  </div>
                  {msg.time && (
                    <p className="text-[10px] ml-1" style={{ color: '#334155' }}>
                      Tracto IA · {msg.time}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div key={i} className="flex gap-3 max-w-2xl ml-auto flex-row-reverse">
                <div
                  className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  <span className="material-symbols-outlined text-sm" style={{ color: '#64748b' }}>
                    person
                  </span>
                </div>
                <div className="flex-1 flex flex-col items-end space-y-1">
                  {msg.imagePreview && (
                    <img
                      src={msg.imagePreview}
                      alt="Imagem enviada"
                      className="max-w-[200px] max-h-[150px] rounded-xl object-cover"
                      style={{ border: '1px solid rgba(236,91,19,0.3)' }}
                    />
                  )}
                  <div
                    className="px-4 py-3 rounded-2xl rounded-tr-none text-sm leading-relaxed"
                    style={{
                      background: 'rgba(236,91,19,0.12)',
                      border: '1px solid rgba(236,91,19,0.2)',
                      color: '#f1f5f9',
                    }}
                  >
                    {msg.text}
                  </div>
                  {msg.time && (
                    <p className="text-[10px] mr-1" style={{ color: '#334155' }}>
                      Você · {msg.time}
                    </p>
                  )}
                </div>
              </div>
            )
          )}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex gap-3 max-w-2xl">
              <div
                className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center"
                style={{ background: 'rgba(236,91,19,0.15)' }}
              >
                <span className="material-symbols-outlined text-sm" style={{ color: '#ec5b13' }}>
                  smart_toy
                </span>
              </div>
              <div
                className="px-4 py-3.5 rounded-2xl rounded-tl-none flex items-center gap-1.5"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                {[0, 0.15, 0.3].map((d, j) => (
                  <span
                    key={j}
                    className="w-2 h-2 rounded-full animate-bounce"
                    style={{ background: '#ec5b13', opacity: 0.7, animationDelay: `${d}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input bar ────────────────────────────────────────────────────── */}
        <div className="p-4 border-t flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          {/* Pending image preview */}
          {pendingImage && (
            <div className="mb-3 flex items-start gap-2">
              <div className="relative inline-block">
                <img
                  src={pendingImage.preview}
                  alt="Preview"
                  className="w-16 h-16 rounded-xl object-cover"
                  style={{ border: '1px solid rgba(236,91,19,0.4)' }}
                />
                <button
                  onClick={removePendingImage}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white"
                  style={{ background: '#ef4444' }}
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-300 truncate max-w-[180px]">
                  {pendingImage.name}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: '#4ade80' }}>
                  <span className="material-symbols-outlined text-xs align-middle mr-0.5">
                    visibility
                  </span>
                  Pronto para análise visual
                </p>
              </div>
            </div>
          )}

          {/* Input row */}
          <div
            className="flex items-center gap-2 p-2 rounded-2xl"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${pendingImage ? 'rgba(236,91,19,0.35)' : 'rgba(255,255,255,0.09)'}`,
            }}
          >
            {/* Attach image button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Enviar foto da lavoura"
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:opacity-80"
              style={{
                background: pendingImage ? 'rgba(236,91,19,0.25)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${pendingImage ? 'rgba(236,91,19,0.5)' : 'rgba(255,255,255,0.08)'}`,
                color: pendingImage ? '#ec5b13' : '#64748b',
              }}
            >
              <span className="material-symbols-outlined text-base">attach_file</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleImageSelect}
            />

            <input
              className="flex-1 bg-transparent border-none text-sm focus:outline-none text-slate-200 placeholder:text-slate-600 px-1"
              placeholder={
                pendingImage
                  ? 'Adicione uma pergunta ou envie só a foto...'
                  : 'Pergunte sobre sua lavoura...'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            />
            <button
              onClick={() => sendMessage()}
              disabled={isLoading || (!input.trim() && !pendingImage)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-all hover:opacity-90 disabled:opacity-30 flex-shrink-0"
              style={{ background: '#ec5b13' }}
            >
              <span className="material-symbols-outlined text-base">
                {isLoading ? 'more_horiz' : 'arrow_upward'}
              </span>
            </button>
          </div>
          <p className="text-center text-[10px] mt-2" style={{ color: '#1e293b' }}>
            Tracto IA · Claude Sonnet 4.6 · JPG · PNG · WEBP até 5MB
          </p>
        </div>
      </div>
    </>
  );
}

```


### `src/pages/Dashboard.tsx`
```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyzeField } from '../services/api';
import type { FieldAnalysisResult } from '../services/api';
import FieldMap from '../components/FieldMap';
import useAppStore from '../store/useAppStore';
import type { Alert } from '../store/useAppStore';
import { polygonAreaHa } from '../utils/geo';

// ── Market data ───────────────────────────────────────────────────────────────
interface MarketData {
  soja: { price: string; change: string; up: boolean };
}

async function fetchMarket(): Promise<MarketData> {
  try {
    const res = await fetch('https://api.hgbrasil.com/finance?format=json&key=demo');
    if (!res.ok) throw new Error('fetch error');
    const json = await res.json();
    // HG Brasil returns currencies/stocks — use USD/BRL as proxy for commodity index
    const usd = json?.results?.currencies?.USD;
    if (usd) {
      const price = `R$ ${Number(usd.buy).toFixed(2)}`;
      const pct = usd.variation ?? 0;
      return { soja: { price, change: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`, up: pct >= 0 } };
    }
    throw new Error('no data');
  } catch {
    return { soja: { price: 'Atualizando...', change: '—', up: true } };
  }
}

// ── Alert type colors ─────────────────────────────────────────────────────────
const ALERT_COLORS: Record<Alert['type'], { accent: string; text: string; border: string; bg: string }> = {
  critical: { accent: '#ec5b13', text: '#ec5b13', border: 'rgba(236,91,19,0.16)', bg: 'rgba(236,91,19,0.08)' },
  warning:  { accent: '#f59e0b', text: '#fbbf24', border: 'rgba(245,158,11,0.16)', bg: 'rgba(245,158,11,0.08)' },
  info:     { accent: '#60a5fa', text: '#60a5fa', border: 'rgba(96,165,250,0.16)', bg: 'rgba(96,165,250,0.08)' },
};

// ── Component ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const navigate = useNavigate();
  const { fields, weatherCache, alerts } = useAppStore();
  const [market, setMarket] = useState<MarketData>({
    soja: { price: 'Atualizando...', change: '—', up: true },
  });

  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<FieldAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (fields.length === 0) return;
    const loc = fields[0];
    
    setAnalyzing(true);
    setAnalysisError(null);
    
    try {
      const fieldName = loc.name || 'Setor Base';
      const cropType = loc.cultura;
      const result = await analyzeField(
        loc.lat, 
        loc.lng, 
        fieldName, 
        cropType, 
        weatherCache,
        loc.boundaries || null,
        loc.dataPlantio,
        loc.variedade,
        loc.areaHa
      );
      
      setAnalysisResult(result);
      localStorage.setItem(`tracto-ndvi-${loc.lat}-${loc.lng}`, JSON.stringify({
        timestamp: Date.now(),
        data: result
      }));
      
    } catch (e) {
      console.error(e);
      setAnalysisError(e instanceof Error ? e.message : 'Nao foi possivel concluir a analise.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Fetch market once
  useEffect(() => {
    fetchMarket().then(setMarket);
  }, []);

  // ── Computed metrics ──────────────────────────────────────────────────────
  const totalAreaHa = fields.reduce((sum, loc) => {
    if (loc.boundaries && loc.boundaries.length >= 3) return sum + polygonAreaHa(loc.boundaries);
    return sum + 0.01;
  }, 0);

  const areaDisplay = fields.length === 0
    ? 'N/D'
    : totalAreaHa >= 1000
      ? `${(totalAreaHa / 1000).toFixed(2)}k`
      : totalAreaHa.toFixed(1);
  const areaUnit = fields.length === 0 ? '' : totalAreaHa >= 1000 ? 'k ha' : 'ha';

  const precipToday = weatherCache
    ? `${(weatherCache.daily.precipSum[0] ?? 0).toFixed(1)}`
    : '—';
  const precipUnit = weatherCache ? 'mm' : '';

  // Alerts: show top 2 non-dismissed, prioritizing critical
  const activeAlerts = alerts
    .filter((a) => !a.dismissed)
    .sort((a, b) => {
      const order = { critical: 0, warning: 1, info: 2 };
      return order[a.type] - order[b.type];
    })
    .slice(0, 2);

  const METRICS = [
    {
      label: 'Área Total',
      value: areaDisplay,
      unit: areaUnit,
      trend: fields.length > 0 ? `${fields.length} talhão${fields.length > 1 ? 'ões' : ''}` : 'Sem talhões',
      up: true,
      color: '#4ade80',
    },
    {
      label: 'NDVI Médio',
      value: analysisResult ? analysisResult.ndvi_analysis.ndvi_medio.toFixed(2) : 'N/D',
      unit: '',
      trend: analysisResult ? 'Análise de satélite' : 'Aguardando análise',
      up: analysisResult ? (analysisResult.ndvi_analysis.ndvi_medio > 0.5) : false,
      color: '#60a5fa',
    },
    {
      label: 'Precipitação',
      value: precipToday,
      unit: precipUnit,
      trend: weatherCache ? 'Hoje (Open-Meteo)' : 'Sem dados',
      up: (weatherCache?.daily.precipSum[0] ?? 0) > 0,
      color: '#60a5fa',
    },
    {
      label: 'Produtividade',
      value: 'N/D',
      unit: '',
      trend: 'Aguardando histórico',
      up: false,
      color: '#64748b',
    },
  ];


  return (
    <>
      {/* Mapa Central */}
      <section className="flex-1 flex flex-col overflow-hidden p-4 gap-4 min-w-0">
        <div className="flex-1 relative rounded-xl overflow-hidden min-h-0" style={{ border: '1px solid rgba(255,255,255,0.07)', background: '#0c0c0e' }}>
          <FieldMap />
        </div>
      </section>

      {/* Sidebar de Inteligência */}
      <aside className="w-72 flex-shrink-0 flex flex-col overflow-y-auto scrollbar-thin" style={{ background: 'rgba(255,255,255,0.015)', borderLeft: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="p-4 flex flex-col gap-4">

          {/* Cards de Métricas */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3 px-1" style={{ color: '#64748b' }}>Métricas da Fazenda</p>
            <div className="grid grid-cols-2 gap-2">
              {METRICS.map((m) => (
                <div key={m.label} className="p-3 rounded-xl flex flex-col gap-1" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[10px]" style={{ color: '#64748b' }}>{m.label}</p>
                  <p className="text-lg font-bold text-white leading-tight">
                    {m.value}
                    <span className="text-xs font-normal ml-0.5" style={{ color: '#64748b' }}>{m.unit}</span>
                  </p>
                  <p className="text-[10px] font-semibold" style={{ color: m.up ? '#4ade80' : '#f87171' }}>{m.trend}</p>
                  <div className="h-1 w-full rounded-full overflow-hidden mt-1" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="h-full rounded-full w-3/4" style={{ background: m.color + '66' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Status IA */}
          <div className="p-3 rounded-xl" style={{ background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.12)' }}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white">Tracto IA</p>
              <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: '#4ade80' }}>
                <span className="relative w-1.5 h-1.5 rounded-full bg-green-400">
                  <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75" />
                </span>
                Ativo
              </span>
            </div>
            <p className="text-[11px] leading-relaxed" style={{ color: '#94a3b8' }}>
              {fields.length > 0
                ? `Monitorando ${fields.length} talhão${fields.length > 1 ? 'ões' : ''} · Área: ${areaDisplay}${areaUnit}`
                : 'Aguardando talhões cadastrados para análise.'}
            </p>
          </div>

          {/* Análise Satélite */}
          {fields.length > 0 && (
            <div className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">satellite_alt</span>
                  Análise Satélite
                </p>
                {analysisResult && (
                  <div className="flex gap-1">
                    {analysisResult.is_mock && (
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded uppercase bg-amber-500/20 text-amber-400" title="Dados simulados devido a indisponibilidade do serviço de clima">
                        MOCK
                      </span>
                    )}
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${analysisResult.cached ? 'bg-slate-700 text-slate-300' : 'bg-green-500/20 text-green-400'}`}>
                      {analysisResult.cached ? 'CACHE 24H' : 'ATUALIZADO'}
                    </span>
                  </div>
                )}

              </div>

              {!analysisResult ? (
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="w-full py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2"
                  style={{ 
                    background: analysisError ? '#ef4444' : '#ec5b13', 
                    color: '#fff',
                    opacity: analyzing ? 0.7 : 1
                  }}
                >
                  {analyzing ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Analisando...
                    </>
                  ) : analysisError ? (
                    'Tentar novamente'
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">satellite_alt</span>
                      Analisar Talhão
                    </>
                  )}
                </button>
              ) : (
                <div className="flex flex-col gap-3">
                  {analysisResult.ndvi_image_base64 ? (
                    <div className="relative">
                      <img 
                        src={`data:image/png;base64,${analysisResult.ndvi_image_base64}`} 
                        alt="NDVI" 
                        className="w-full h-auto rounded-lg object-cover"
                        style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                      />
                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[8px] font-bold text-white border border-white/10 uppercase tracking-widest">
                        {analysisResult.source || 'Sentinel-2 L2A'}
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-24 rounded-lg flex items-center justify-center p-4 text-center" style={{ background: '#0f2617', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <p className="text-[10px] text-green-200">Imagem indisponível — {analysisResult.source?.includes('Simulado') ? 'Simulação indisponível' : 'cobertura de nuvens alta'}. Tente novamente em breve.</p>
                    </div>
                  )}
                  
                  {/* Confidence Bar (Honest UX) */}
                  <div className="px-1">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">Confiança da Análise</p>
                      <p className="text-[9px] font-bold text-white">{(analysisResult.confidence * 100).toFixed(0)}%</p>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full transition-all duration-1000" 
                        style={{ 
                          width: `${analysisResult.confidence * 100}%`,
                          background: analysisResult.confidence > 0.8 ? '#4ade80' : analysisResult.confidence > 0.5 ? '#fbbf24' : '#f87171'
                        }} 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded bg-black/20 border border-white/5">
                      <p className="text-[9px] text-slate-400">NDVI Médio (Real)</p>
                      <p className="text-sm font-bold text-white">{analysisResult.ndvi_analysis.ndvi_medio.toFixed(2)}</p>
                    </div>
                    <div className="p-2 rounded bg-black/20 border border-white/5">
                      <p className="text-[9px] text-slate-400">Janela Pulveriz.</p>
                      <p className={`text-[10px] font-bold ${analysisResult.engine_results?.spray_window?.color === 'green' ? 'text-green-400' : analysisResult.engine_results?.spray_window?.color === 'red' ? 'text-red-400' : 'text-amber-400'}`}>
                        {analysisResult.engine_results?.spray_window?.label.toUpperCase() || 'N/D'}
                      </p>
                    </div>
                    <div className="p-2 rounded bg-black/20 border border-white/5">
                      <p className="text-[9px] text-slate-400">Risco Geada</p>
                      <p className={`text-[10px] font-bold ${analysisResult.engine_results?.frost_risk?.color === 'red' ? 'text-red-400' : 'text-white'}`}>
                        {analysisResult.engine_results?.frost_risk?.label.toUpperCase() || 'N/D'}
                      </p>
                    </div>
                    <div className="p-2 rounded bg-black/20 border border-white/5">
                      <p className="text-[9px] text-slate-400">Estresse Hídrico</p>
                      <p className={`text-[10px] font-bold ${analysisResult.engine_results?.water_stress?.color === 'red' ? 'text-red-400' : 'text-white'}`}>
                        {analysisResult.engine_results?.water_stress?.label.toUpperCase() || 'N/D'}
                      </p>
                    </div>
                  </div>
                  
                  {analysisResult.date_acquired && (
                    <p className="text-[9px] text-slate-500 text-center flex items-center justify-center gap-1">
                      <span>Imagem de {new Date(analysisResult.date_acquired.split(' ')[0]).toLocaleDateString('pt-BR')}</span>
                      {analysisResult.date_acquired.includes('(Aproximado)') && <span className="text-amber-500/80 font-bold">(Aprox)</span>}
                    </p>
                  )}
                  
                  <button
                    onClick={() => navigate('/app/reports')}
                    className="w-full py-1.5 mt-1 rounded text-[10px] font-semibold transition-all hover:bg-white/10"
                    style={{ background: 'rgba(255,255,255,0.05)', color: '#cbd5e1' }}
                  >
                    Ver Relatório Completo
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Alertas Prioritários (do store) */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3 px-1" style={{ color: '#64748b' }}>
              Alertas Prioritários
            </p>
            <div className="space-y-2">
              {activeAlerts.length === 0 ? (
                <div className="p-3 rounded-xl text-center" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-[10px]" style={{ color: '#64748b' }}>
                    {alerts.length === 0
                      ? 'Vá em Alertas para gerar análise IA'
                      : 'Nenhum alerta ativo no momento'}
                  </p>
                </div>
              ) : (
                activeAlerts.map((alert) => {
                  const c = ALERT_COLORS[alert.type];
                  return (
                    <div key={alert.id} className="p-3 rounded-xl" style={{ background: c.bg, border: `1px solid ${c.border}`, borderLeft: `3px solid ${c.accent}` }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: c.text }}>
                        {alert.type === 'critical' ? '⚠ Crítico' : alert.type === 'warning' ? '⚠ Aviso' : 'ℹ Info'}
                      </p>
                      <p className="text-xs font-semibold text-white truncate">{alert.title}</p>
                      <p className="text-[10px] mt-0.5 line-clamp-2" style={{ color: '#94a3b8' }}>{alert.message}</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Mercado */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3 px-1" style={{ color: '#64748b' }}>Mercado</p>
            <div className="space-y-1.5">
              {[
                {
                  name: 'Câmbio USD/BRL',
                  detail: 'Referência cambial (HG Brasil)',
                  value: market.soja.price,
                  change: market.soja.change,
                  up: market.soja.up,
                },
                {
                  name: 'Índice Logístico',
                  detail: 'Região: Centro-Oeste',
                  value: '104.2',
                  change: '-0.4%',
                  up: false,
                },
              ].map((item) => (
                <div key={item.name} className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div>
                    <p className="text-xs font-semibold text-white">{item.name}</p>
                    <p className="text-[10px]" style={{ color: '#64748b' }}>{item.detail}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-white">{item.value}</p>
                    <p className="text-[10px] font-semibold" style={{ color: item.up ? '#4ade80' : '#f87171' }}>{item.change}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] mt-2 text-right pr-1" style={{ color: '#64748b' }}>Preço real da soja em breve</p>
          </div>

          <button
            onClick={() => navigate('/app/reports')}
            className="w-full py-3 rounded-xl text-xs font-semibold transition-all hover:text-white"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8' }}
          >
            Ver Relatório Completo
          </button>
        </div>
      </aside>
    </>
  );
}

```


### `src/pages/LandingPage.tsx`
```tsx
import { useNavigate } from 'react-router-dom';

export default function LandingPage() {
    const navigate = useNavigate();

    return (
        <>
            <style>{`
                .glass-dark {
                    background: rgba(15, 23, 42, 0.6);
                    backdrop-filter: blur(24px);
                    -webkit-backdrop-filter: blur(24px);
                    border: 1px solid rgba(255, 255, 255, 0.03);
                }
                .hero-gradient {
                    background: linear-gradient(to bottom, rgba(15, 23, 42, 0.1) 0%, rgba(15, 23, 42, 0.4) 50%, rgba(15, 23, 42, 0.9) 100%);
                }
                section {
                    padding-top: 100px;
                    padding-bottom: 100px;
                }
                .section-framed {
                    padding-top: 120px;
                    padding-bottom: 120px;
                }
            `}</style>
            
<div className="bg-background-light dark:bg-background-dark font-sans text-slate-900 dark:text-slate-100 selection:bg-primary/30 antialiased overflow-x-hidden min-h-screen">
<nav className="fixed top-0 w-full z-50 transition-all duration-300 px-8 py-6">
<div className="max-w-7xl mx-auto flex items-center justify-between glass-dark px-10 py-4 rounded-full border border-white/5 shadow-2xl">
<div className="flex items-center gap-2">
<span className="text-lg font-bold tracking-widest text-white uppercase">Tracto</span>
</div>
<div className="hidden md:flex items-center gap-12 text-[10px] font-medium uppercase tracking-[0.25em] text-white/60">
<a className="hover:text-primary transition-colors cursor-pointer" onClick={() => document.getElementById('servicos')?.scrollIntoView({behavior: 'smooth'})}>Serviços</a>
<a className="hover:text-primary transition-colors cursor-pointer" onClick={() => document.getElementById('proposito')?.scrollIntoView({behavior: 'smooth'})}>Nosso Propósito</a>
<a className="hover:text-primary transition-colors cursor-pointer" onClick={() => document.getElementById('precos')?.scrollIntoView({behavior: 'smooth'})}>Planos</a>
<a className="hover:text-primary transition-colors cursor-pointer" onClick={() => document.getElementById('contato')?.scrollIntoView({behavior: 'smooth'})}>Contato</a>
</div>
<div>
<button onClick={() => navigate('/login')} className="bg-primary hover:bg-orange-600 text-white px-8 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] transition-all hover:scale-105 shadow-lg shadow-primary/10">
                    Acessar Plataforma
                </button>
</div>
</div>
</nav>
<section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-0 pb-0">
<div className="absolute inset-0 z-0">
<img 
  alt="Vista aérea de fazenda" 
  className="w-full h-full object-cover object-center" 
  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBo6DW0mlLl01OpM-nNE6jQApM60H56OazuG6Jtp3sxsgX6lAo1LXOyu_JttoOmPNlnMpgPlQbJpAhDq5VeEUUNcLV1jFe1hEPDKudX7NGU0WVSgc3hERq2HUeSt2HkNDWoWQWwlF30I75vq_BKHkhbJDufw2QngU4jQT4SKPEY6rJ2YTZCTaurJg1CQHmynwgKTdRDiYH-fzqvecmgKWHx6wg-nag-tpEWL2lg4lJTopW21OF_MzEnn1Du38qJ0r4Pkbpcsrxwp90"
/>
<div className="absolute inset-0 hero-gradient"></div>
</div>
<div className="relative z-10 max-w-5xl mx-auto px-6 text-center text-white mt-10 fade-in-section visible">
<h1 className="text-4xl md:text-5xl font-light tracking-tight mb-8 leading-snug">
                O campo em sincronia,<br/><span className="text-primary font-medium">na palma da sua mão.</span>
</h1>
<p className="text-base md:text-lg text-slate-100 max-w-2xl mx-auto mb-12 font-light leading-loose drop-shadow-md">
                A Tracto une Tecnologia Orbital Proprietária e Nossa Inteligência Agronômica Dedicada diretamente à sua interface mobile para decisões de alta precisão.
            </p>
<div className="flex flex-col sm:flex-row items-center justify-center gap-8">
<button onClick={() => navigate('/login')} className="bg-primary hover:bg-orange-600 text-white px-12 py-5 rounded-full text-xs font-bold uppercase tracking-widest transition-all hover:shadow-[0_0_40px_rgba(249,115,22,0.4)] active:scale-95">
                    Começar Agora
                </button>
<a className="text-white hover:text-white/80 text-[10px] uppercase tracking-[0.3em] transition-all drop-shadow-md cursor-pointer" onClick={() => document.getElementById('proposito')?.scrollIntoView({behavior: 'smooth'})}>
                    Descobrir o Ecossistema
                </a>
</div>
</div>
</section>
<section className="bg-white dark:bg-slate-900 section-framed" id="proposito">
<div className="max-w-4xl mx-auto px-8 text-center fade-in-section visible">
<h2 className="text-[10px] font-bold text-primary tracking-[0.5em] uppercase mb-8">Nosso Propósito</h2>
<div className="space-y-8">
<p className="text-2xl md:text-4xl font-light text-slate-900 dark:text-white leading-relaxed tracking-tight">
                    Conectar a inteligência orbital e climática proprietária à simplicidade de um chat intuitivo, transformando dados complexos em decisões diárias e precisas.
                </p>
<p className="text-base md:text-lg text-slate-500 dark:text-slate-400 font-light leading-loose max-w-2xl mx-auto pt-4">
                    Nossa missão é otimizar o manejo, promovendo produtividade e sustentabilidade para a sua lavoura.
                </p>
</div>
</div>
</section>
<section className="bg-background-light dark:bg-slate-950/40 section-framed" id="servicos">
<div className="max-w-7xl mx-auto px-6">
<div className="text-center mb-16 fade-in-section visible">
<h2 className="text-[10px] font-bold text-primary tracking-[0.4em] uppercase mb-6">Sistemas</h2>
<h3 className="text-2xl md:text-3xl font-light text-slate-900 dark:text-white tracking-tight">Arquitetura de Dados Proprietária</h3>
</div>
<div className="grid md:grid-cols-3 gap-16 lg:gap-24">
<div className="group fade-in-section visible">
<div className="mb-8 opacity-50 group-hover:opacity-100 transition-opacity">
<span className="material-symbols-outlined text-4xl font-light text-primary">satellite_alt</span>
</div>
<h4 className="text-lg font-semibold mb-4 dark:text-white tracking-tight">Tecnologia Orbital Proprietária</h4>
<p className="text-slate-500 dark:text-slate-400 text-sm leading-loose font-light">
                        Análise de Imagens de Frequência Contínua para monitoramento de índices de vegetação e saúde da plantação com precisão científica.
                    </p>
</div>
<div className="group fade-in-section visible">
<div className="mb-8 opacity-50 group-hover:opacity-100 transition-opacity">
<span className="material-symbols-outlined text-4xl font-light text-primary">analytics</span>
</div>
<h4 className="text-lg font-semibold mb-4 dark:text-white tracking-tight">Análise de Frequência Contínua</h4>
<p className="text-slate-500 dark:text-slate-400 text-sm leading-loose font-light">
                        Processamento ininterrupto de dados ambientais para detecção precoce de anomalias hídricas e estresse biótico.
                    </p>
</div>
<div className="group fade-in-section visible">
<div className="mb-8 opacity-50 group-hover:opacity-100 transition-opacity">
<span className="material-symbols-outlined text-4xl font-light text-primary">memory</span>
</div>
<h4 className="text-lg font-semibold mb-4 dark:text-white tracking-tight">Inteligência Agronômica Dedicada</h4>
<p className="text-slate-500 dark:text-slate-400 text-sm leading-loose font-light">
                        Algoritmos exclusivos traduzem telemetria complexa em recomendações práticas enviadas diretamente para sua interface mobile.
                    </p>
</div>
</div>
</div>
</section>
<section className="bg-white dark:bg-background-dark overflow-hidden section-framed" id="app-showcase">
<div className="max-w-7xl mx-auto px-6">
<div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-32">
<div className="w-full lg:w-1/2 relative fade-in-section visible">
<div className="relative z-10 w-[280px] md:w-[320px] mx-auto rounded-[3rem] border-[10px] border-slate-900 dark:border-slate-950 bg-slate-900 shadow-2xl overflow-hidden ring-1 ring-white/10">
<div className="bg-brand-green p-4 pt-10 text-white flex items-center gap-4">
<span className="material-symbols-outlined text-lg">arrow_back</span>
<div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border border-white/20">
<img alt="Tracto AI Avatar" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA9YpGb0bZjWKAXOj0EldHehbZ3K5vtul8tgwRhsUjRdZ2FASAeb8AD0MCui0QJ2Mp2aYxNuJDOcSaKDBooN80t_4aCJ8mJ9syocA9xkXQ5lN486OD-HlfqsjOrSoAYecg6CIR32ROrEH2JztUZrGJLgcspn8K7GkLepkEhMVSpJTH0_RWRwehawQ_evU9grGQjPDuYWoyFNwALUzf_GdsFCgtFS71Phdl1LWOm13-XIkrXUggFRMMxGmmyxdRkXqybnD-IQCUDjdE"/>
</div>
<div>
<h5 className="text-sm font-bold">Tracto AI</h5>
<p className="text-[10px] opacity-60">online</p>
</div>
</div>
<div className="bg-[#f0f2f5] dark:bg-slate-800 h-[480px] p-4 flex flex-col gap-4 overflow-y-auto">
<div className="bg-white dark:bg-slate-700 p-4 rounded-xl rounded-tl-none shadow-sm max-w-[85%] text-[13px]">
<p className="dark:text-white leading-relaxed">Bom dia. A Tecnologia Orbital identificou uma queda de 15% no vigor vegetativo no Talhão 4. Recomendo inspeção local.</p>
<span className="text-[9px] text-slate-400 mt-2 block text-right">08:30</span>
</div>
<div className="bg-[#dcf8c6] dark:bg-emerald-900/40 p-4 rounded-xl rounded-tr-none shadow-sm max-w-[85%] self-end text-[13px]">
<p className="dark:text-white leading-relaxed">Qual o cenário climático para as próximas horas?</p>
<span className="text-[9px] text-emerald-600/60 dark:text-emerald-400 mt-2 block text-right">08:32</span>
</div>
<div className="bg-white dark:bg-slate-700 p-4 rounded-xl rounded-tl-none shadow-sm max-w-[85%] text-[13px]">
<p className="dark:text-white leading-relaxed">Previsão de precipitação de 5mm para amanhã. A Inteligência Agronômica Dedicada sugere otimizar a nutrição foliar.</p>
<span className="text-[9px] text-slate-400 mt-2 block text-right">08:32</span>
</div>
</div>
</div>
<div className="absolute -top-20 -left-20 w-80 h-80 bg-primary/5 rounded-full blur-[120px] -z-10"></div>
</div>
<div className="w-full lg:w-1/2 space-y-12 fade-in-section visible">
<h2 className="text-2xl md:text-3xl font-light dark:text-white leading-snug tracking-tight">Gestão de alta performance em uma interface minimalista.</h2>
<p className="text-base text-slate-500 dark:text-slate-400 font-light leading-loose">
                        Eliminamos dashboards desnecessários. A Tracto entrega o que é essencial para o produtor onde ele já está.
                    </p>
<ul className="space-y-8">
<li className="flex gap-6">
<div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/5 text-primary flex items-center justify-center">
<span className="material-symbols-outlined text-xl">notifications_active</span>
</div>
<div>
<h6 className="text-sm font-semibold dark:text-white mb-2 tracking-tight">Alertas Proativos</h6>
<p className="text-sm text-slate-500 dark:text-slate-400 font-light leading-relaxed">Monitoramento automático de variações biométricas.</p>
</div>
</li>
<li className="flex gap-6">
<div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/5 text-primary flex items-center justify-center">
<span className="material-symbols-outlined text-xl">psychology</span>
</div>
<div>
<h6 className="text-sm font-semibold dark:text-white mb-2 tracking-tight">Inteligência Agronômica Dedicada</h6>
<p className="text-sm text-slate-500 dark:text-slate-400 font-light leading-relaxed">Interação direta com nossa tecnologia via linguagem natural.</p>
</div>
</li>
</ul>
<div className="pt-2">
<button onClick={() => navigate('/login')} className="bg-primary hover:bg-orange-600 text-white px-12 py-5 rounded-full text-[10px] font-bold uppercase tracking-[0.25em] transition-all flex items-center gap-4 shadow-xl shadow-primary/10">
                            Iniciar Acesso
                            <span className="material-symbols-outlined text-lg">trending_flat</span>
</button>
</div>
</div>
</div>
</div>
</section>
<section className="bg-background-light dark:bg-slate-950/20 section-framed min-h-screen flex items-center" id="precos">
<div className="max-w-7xl mx-auto px-6 w-full">
<div className="text-center mb-16 fade-in-section visible">
<h2 className="text-[10px] font-bold text-primary tracking-[0.4em] uppercase mb-6">Investimento</h2>
<h3 className="text-2xl md:text-3xl font-light text-slate-900 dark:text-white tracking-tight">Planos de Assinatura</h3>
</div>
<div className="grid md:grid-cols-3 gap-10 items-stretch">
<div className="p-10 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex flex-col fade-in-section visible">
<h4 className="text-sm font-semibold mb-2 dark:text-white tracking-widest uppercase">Familiar</h4>
<p className="text-slate-400 mb-8 font-medium uppercase tracking-[0.2em] text-[10px]">Até 50 hectares</p>
<div className="mb-10">
<span className="text-4xl font-light dark:text-white">R$ 149</span>
<span className="text-slate-400 text-sm">/mês</span>
</div>
<ul className="space-y-6 mb-10 flex-1">
<li className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 font-light">
<span className="material-symbols-outlined text-accent-green text-sm">check</span>
                            Relatório diário mobile
                        </li>
<li className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 font-light">
<span className="material-symbols-outlined text-accent-green text-sm">check</span>
                            Monitoramento Orbital
                        </li>
</ul>
<button onClick={() => navigate('/login')} className="w-full py-4 rounded-full border border-primary text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white transition-all">Assinar</button>
</div>
<div className="p-10 rounded-3xl bg-slate-900 dark:bg-brand-green/10 border border-primary flex flex-col relative scale-105 shadow-2xl z-10 fade-in-section visible">
<div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white px-6 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-[0.3em]">Premium</div>
<h4 className="text-sm font-semibold mb-2 text-white tracking-widest uppercase">Profissional</h4>
<p className="text-slate-500 mb-8 font-medium uppercase tracking-[0.2em] text-[10px]">Até 500 hectares</p>
<div className="mb-10 text-white">
<span className="text-4xl font-light">R$ 499</span>
<span className="text-slate-500 text-sm">/mês</span>
</div>
<ul className="space-y-6 mb-10 flex-1">
<li className="flex items-center gap-4 text-xs text-slate-300 font-light">
<span className="material-symbols-outlined text-primary text-sm">check</span>
                            Monitoramento Ilimitado
                        </li>
<li className="flex items-center gap-4 text-xs text-slate-300 font-light">
<span className="material-symbols-outlined text-primary text-sm">check</span>
                            Suporte Prioritário
                        </li>
</ul>
<button onClick={() => navigate('/login')} className="w-full py-4 rounded-full bg-primary text-white text-[10px] font-bold uppercase tracking-widest hover:bg-orange-600 transition-all shadow-lg shadow-primary/20">Assinar</button>
</div>
<div className="p-10 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex flex-col fade-in-section visible">
<h4 className="text-sm font-semibold mb-2 dark:text-white tracking-widest uppercase">Enterprise</h4>
<p className="text-slate-400 mb-8 font-medium uppercase tracking-[0.2em] text-[10px]">Área Ilimitada</p>
<div className="mb-10">
<span className="text-2xl font-light dark:text-white">Sob consulta</span>
</div>
<ul className="space-y-6 mb-10 flex-1">
<li className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 font-light">
<span className="material-symbols-outlined text-accent-green text-sm">check</span>
                            Integração via API
                        </li>
<li className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 font-light">
<span className="material-symbols-outlined text-accent-green text-sm">check</span>
                            Consultoria Individual
                        </li>
</ul>
<button onClick={() => navigate('/login')} className="w-full py-4 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Contato</button>
</div>
</div>
</div>
</section>
<footer className="bg-slate-950 text-white pt-24 pb-12 px-8" id="contato">
<div className="max-w-7xl mx-auto">
<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-16 lg:gap-32 mb-16 fade-in-section visible">
<div className="col-span-1 lg:col-span-2">
<span className="text-xl font-bold tracking-[0.3em] mb-6 block">TRACTO</span>
<p className="text-slate-500 text-sm max-w-sm leading-loose font-light mb-8">
                        Liderando a revolução digital no campo com Tecnologia Orbital Proprietária e inteligência de precisão.
                    </p>
<div className="flex gap-8">
<a className="text-slate-600 hover:text-primary transition-colors cursor-pointer">
<svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"></path></svg>
</a>
</div>
</div>
<div>
<h5 className="text-[10px] font-bold mb-8 uppercase tracking-[0.3em]">Ecossistema</h5>
<ul className="space-y-4 text-slate-500 text-xs font-light tracking-wide">
<li><a className="hover:text-primary transition-colors cursor-pointer" onClick={() => document.getElementById('servicos')?.scrollIntoView({behavior: 'smooth'})}>Serviços</a></li>
<li><a className="hover:text-primary transition-colors cursor-pointer" onClick={() => document.getElementById('proposito')?.scrollIntoView({behavior: 'smooth'})}>Propósito</a></li>
<li><a className="hover:text-primary transition-colors cursor-pointer" onClick={() => document.getElementById('precos')?.scrollIntoView({behavior: 'smooth'})}>Planos</a></li>
<li><a className="hover:text-primary transition-colors cursor-pointer">Segurança IP</a></li>
</ul>
</div>
<div>
<h5 className="text-[10px] font-bold mb-8 uppercase tracking-[0.3em]">Contato</h5>
<ul className="space-y-6 text-slate-500 text-xs font-light">
<li className="flex items-center gap-4">
<span className="material-symbols-outlined text-primary text-lg">mail</span>
                            contato@tracto.ag
                        </li>
<li className="flex items-center gap-4">
<span className="material-symbols-outlined text-primary text-lg">call</span>
                            +55 (11) 99999-9999
                        </li>
</ul>
</div>
</div>
<div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 fade-in-section visible">
<div className="text-slate-600 text-[10px] uppercase tracking-[0.2em]">
                    © 2024 Tracto Agricultural Technologies.
                </div>
<div>
<button onClick={() => navigate('/login')} className="bg-primary/10 border border-primary/20 text-primary px-10 py-4 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white transition-all">
                        Começar Agora
                    </button>
</div>
</div>
</div>
</footer>

</div>
        </>
    );
}

```


### `src/pages/Login.tsx`
```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '../store/useAppStore';
import { supabase } from '../services/supabase';

declare global {
  interface Window {
    grecaptcha: any;
  }
}

// ── Error messages ────────────────────────────────────────────────────────────
function friendlyError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('Email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (msg.includes('User not found')) return 'Usuário não encontrado.';
  if (msg.includes('Invalid email')) return 'E-mail inválido.';
  if (msg.includes('rate limit')) return 'Muitas tentativas. Aguarde alguns minutos.';
  return msg;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Login() {
  const navigate = useNavigate();
  const updateGeolocation = useAppStore((state) => state.updateGeolocation);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Preencha e-mail e senha.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // 0. reCAPTCHA Verification (Optional/Harden)
      try {
        const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
        if (window.grecaptcha && siteKey) {
          const token = await window.grecaptcha.execute(siteKey, { action: 'login' });
          await fetch(`${import.meta.env.VITE_API_URL}/api/verify-recaptcha`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          });
        }
      } catch (captchaErr) {
        console.warn('reCAPTCHA error (pular):', captchaErr);
      }

      // 1. Supabase Auth
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw new Error(authError.message);

      // 2. Geolocation (non-blocking)
      updateGeolocation();

      navigate('/app');
    } catch (err: unknown) {
      setError(friendlyError(err instanceof Error ? err.message : 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/app'
        }
      });
      if (authError) throw new Error(authError.message);
    } catch (err: unknown) {
      setError(friendlyError(err instanceof Error ? err.message : 'Erro no login com Google'));
      setGoogleLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        .login-body { font-family: 'Plus Jakarta Sans', sans-serif; }
        .glass-dark-login {
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.03);
        }
      `}</style>

      <div className="login-body relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <img
            alt="Vista aérea de fazenda"
            className="w-full h-full object-cover object-center"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBo6DW0mlLl01OpM-nNE6jQApM60H56OazuG6Jtp3sxsgX6lAo1LXOyu_JttoOmPNlnMpgPlQbJpAhDq5VeEUUNcLV1jFe1hEPDKudX7NGU0WVSgc3hERq2HUeSt2HkNDWoWQWwlF30I75vq_BKHkhbJDufw2QngU4jQT4SKPEY6rJ2YTZCTaurJg1CQHmynwgKTdRDiYH-fzqvecmgKWHx6wg-nag-tpEWL2lg4lJTopW21OF_MzEnn1Du38qJ0r4Pkbpcsrxwp90"
          />
          <div className="absolute inset-0 bg-slate-950/60" />
        </div>

        {/* Card */}
        <div className="relative z-10 w-full max-w-md px-6">
          <div className="glass-dark-login p-10 md:p-12 rounded-[2rem] border border-white/10 shadow-2xl backdrop-blur-3xl">
            <div className="text-center mb-10">
              <span className="text-2xl font-bold tracking-[0.4em] text-white uppercase block mb-2">Tracto</span>
              <p className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-medium">Acesso ao Ecossistema</p>
            </div>

            <div className="space-y-6">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="w-full bg-white hover:bg-[#f8f9fa] text-[#3c4043] py-3.5 rounded-xl text-sm font-medium transition-all border border-[#dadce0] flex items-center justify-center gap-3 shadow-sm hover:shadow-md disabled:opacity-70"
              >
                {googleLoading ? (
                  <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                )}
                <span>Continuar com Google</span>
              </button>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-white/5"></div>
                <span className="flex-shrink mx-4 text-[10px] text-slate-500 uppercase tracking-widest font-bold">ou</span>
                <div className="flex-grow border-t border-white/5"></div>
              </div>

              <form className="space-y-6" onSubmit={handleLogin}>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-400/50 transition-colors text-sm font-light"
                    placeholder="seu@email.com"
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">Senha</label>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!email) { alert('Digite seu e-mail primeiro.'); return; }
                        await supabase.auth.resetPasswordForEmail(email, {
                          redirectTo: `${window.location.origin}/reset-password`,
                        });
                        alert('Email de recuperação enviado! Verifique sua caixa de entrada.');
                      }}
                      className="text-[9px] uppercase tracking-widest text-orange-400 hover:text-orange-300 transition-colors"
                    >
                      Esqueceu?
                    </button>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-400/50 transition-colors text-sm font-light"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                </div>

                {/* Error banner */}
                {error && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-medium text-red-300" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <span className="material-symbols-outlined text-sm text-red-400">error</span>
                    {error}
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white py-5 rounded-full text-xs font-bold uppercase tracking-[0.3em] transition-all hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] active:scale-95 shadow-xl shadow-orange-500/20 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                        Entrando...
                      </>
                    ) : 'Entrar'}
                  </button>
                </div>
              </form>
            </div>

            <div className="mt-10 text-center">
              <p className="text-slate-500 text-[10px] uppercase tracking-widest">
                Ainda não possui acesso?{' '}
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="text-white hover:text-orange-400 transition-colors font-bold ml-2 uppercase"
                >
                  Solicitar Credenciais
                </button>
              </p>
            </div>
          </div>

          <div className="mt-8 text-center">
            <button
              className="text-slate-400 hover:text-white transition-colors text-[9px] uppercase tracking-[0.4em] flex items-center justify-center gap-2 cursor-pointer mx-auto"
              onClick={() => navigate('/')}
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Voltar para o site
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

```


### `src/pages/Market.tsx`
```tsx
import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';

// --- Utilitários ---
function getCategory(title: string) {
  const t = title.toLowerCase();
  if (t.includes('soja') || t.includes('amendoim') || t.includes('grão') || t.includes('algodão') || t.includes('café') || t.includes('milho')) return { label: 'Grãos', bg: 'bg-emerald-500/20 text-emerald-400' };
  if (t.includes('boi') || t.includes('carne') || t.includes('pecuária') || t.includes('frango') || t.includes('suíno')) return { label: 'Pecuária', bg: 'bg-amber-500/20 text-amber-400' };
  if (t.includes('diesel') || t.includes('frete') || t.includes('logística') || t.includes('corredor')) return { label: 'Logística', bg: 'bg-blue-500/20 text-blue-400' };
  if (t.includes('praga') || t.includes('lagarta') || t.includes('fungo') || t.includes('doença')) return { label: 'Fitossanidade', bg: 'bg-red-500/20 text-red-400' };
  if (t.includes('fertilizante') || t.includes('ureia') || t.includes('potássio')) return { label: 'Insumos', bg: 'bg-purple-500/20 text-purple-400' };
  if (t.includes('clima') || t.includes('chuva') || t.includes('seca') || t.includes('geada')) return { label: 'Clima', bg: 'bg-cyan-500/20 text-cyan-400' };
  return { label: 'Agro', bg: 'bg-slate-700/50 text-slate-300' };
}

function timeAgo(dateString: string) {
  try {
    // Normalizar a data do RSS caso tenha formato inesperado
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const diff = Math.floor((Date.now() - d.getTime()) / 60000); // mins
    if (diff < 1) return `agora mesmo`;
    if (diff < 60) return `há ${diff}min`;
    if (diff < 1440) return `há ${Math.floor(diff/60)}h`;
    return `há ${Math.floor(diff/1440)}d`;
  } catch {
    return dateString;
  }
}

// --- Interfaces ---
interface NewsItem {
  id: string;
  title: string;
  source: string;
  time: string;
  url: string;
  image?: string;
}



// Valores de commodities ref (já que HG/Awesome não cobrem gratuitamente commodities físicas BR)
const STATIC_COMMODITIES = {
  "GRÃOS": [
    { name: 'Soja', place: 'Paranaguá (sc 60kg)', price: '132,50', change: 1.2, pos: 80 },
    { name: 'Milho', place: 'Campinas (sc 60kg)', price: '58,20', change: -0.5, pos: 40 },
    { name: 'Algodão', place: 'ESALQ (@)', price: '142,30', change: 0.8, pos: 60 },
    { name: 'Café Arábica', place: 'BMEF (sc 60kg)', price: '1.045,00', change: 2.1, pos: 90 },
  ],
  "PECUÁRIA": [
    { name: 'Boi Gordo', place: 'SP (@)', price: '235,00', change: 0.4, pos: 70 },
    { name: 'Frango Congelado', place: 'SP (kg)', price: '7,40', change: -0.2, pos: 45 },
    { name: 'Suíno Vivo', place: 'PR (kg)', price: '6,80', change: 0.1, pos: 55 },
  ],
  "INSUMOS": [
    { name: 'Ureia', place: '(ton)', price: '2.100,00', change: -1.5, pos: 30 },
    { name: 'MAP', place: '(ton)', price: '3.450,00', change: 0.0, pos: 50 },
    { name: 'Potássio (KCl)', place: '(ton)', price: '2.800,00', change: 0.5, pos: 65 },
  ],
  "ENERGIA": [
    { name: 'Petróleo WTI', place: '(barril)', price: '82,50', change: 1.1, pos: 75 },
    { name: 'Ouro', place: '(oz)', price: '2.340,00', change: 0.9, pos: 85 },
    { name: 'Etanol Hidratado', place: 'SP (m³)', price: '2.450,00', change: -0.8, pos: 35 },
  ]
};

const TICKER_ITEMS = [
  { name: 'Soja', price: 'R$ 132,50', change: +1.2 },
  { name: 'Milho', price: 'R$ 58,20', change: -0.5 },
  { name: 'Algodão', price: 'R$ 142,30', change: +0.8 },
  { name: 'Café', price: 'R$ 1.045,00', change: +2.1 },
  { name: 'Boi Gordo', price: 'R$ 235,00', change: +0.4 },
  { name: 'Frango', price: 'R$ 7,40', change: -0.2 },
  { name: 'Suíno', price: 'R$ 6,80', change: +0.1 },
  { name: 'Petróleo', price: 'US$ 82,50', change: +1.1 },
  { name: 'Ouro', price: 'US$ 2.340', change: +0.9 },
  { name: 'Ureia', price: 'R$ 2.100', change: -1.5 },
  { name: 'USD', price: 'R$ 4,95', change: -0.3 }, 
  { name: 'EUR', price: 'R$ 5,35', change: +0.2 }, 
  { name: 'GBP', price: 'R$ 6,24', change: +0.4 }, 
];

export default function Market() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // BLOCO 2 — Notícias via RSS
  const fetchNews = async () => {
    try {
      const rssUrl = 'https://www.canalrural.com.br/feed/';
      const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`);
      const data = await res.json();
      if (data.status === 'ok') {
        const formattedNews = data.items.slice(0, 5).map((item: any) => ({
          id: item.guid,
          title: item.title,
          source: 'Canal Rural',
          time: timeAgo(item.pubDate),
          url: item.link,
          // A API rss2json costuma extrair thumbnail/enclosure
          image: item.thumbnail || item.enclosure?.link || null
        }));
        setNews(formattedNews);
        setLastUpdate(new Date());
      }
    } catch (e) {
      console.error('Erro ao buscar notícias RSS:', e);
    }
  };



  useEffect(() => {
    fetchNews();
    
    // Updates
    const inv1 = setInterval(fetchNews, 5 * 60 * 1000); // 5 mins
    
    return () => { clearInterval(inv1); };
  }, []);

  const topNews = news[0];
  const gridNews = news.slice(1, 5);

  return (
    <div className="min-h-screen font-sans pb-16 overflow-x-hidden selection:bg-orange-500/30" style={{ background: '#080809' }}>
      
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-wrap {
          width: 200%;
          display: flex;
          animation: marquee 30s linear infinite;
        }
        .ticker-wrap:hover {
          animation-play-state: paused;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .glass-panel {
          background: rgba(255,255,255,0.02);
          border: 0.5px solid rgba(255,255,255,0.08);
        }
      `}</style>

      {/* BLOCO 1 — TICKER ANIMADO */}
      <div 
        className="w-full relative overflow-hidden flex items-center h-10 select-none"
        style={{ background: 'rgba(236,91,19,0.08)', borderBottom: '1px solid rgba(236,91,19,0.2)' }}
      >
        <div className="ticker-wrap absolute flex whitespace-nowrap">
          {/* Ticker duplo para animação contínua */}
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <div key={i} className="flex items-center mx-6 gap-2 text-xs font-semibold">
              <span className="text-slate-300">{item.name}</span>
              <span className="text-white">{item.price}</span>
              <span className={`flex items-center gap-0.5 ${item.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {item.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(item.change).toFixed(2)}%
              </span>
              <span className="mx-4 text-slate-600 font-normal">·</span>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-10">
        
        {/* CABEÇALHO */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Mercado Financeiro</h1>
            <p className="text-slate-400 text-sm">Cotações e análises do agronegócio em tempo real</p>
          </div>
          <div className="flex items-center justify-between md:justify-end gap-4">
            <p className="text-xs text-slate-500 font-medium flex items-center gap-2">
              <span className="relative flex w-2 h-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full w-2 h-2 bg-green-500"></span>
              </span>
              Atualizado às {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        {/* 3 Colunas: Esquerda (2/3) Notícias | Direita (1/3) Painel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* BLOCO 2 — NOTÍCIAS */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Destaque Principal */}
            {topNews ? (
              <a 
                href={topNews.url} target="_blank" rel="noopener noreferrer"
                className="group relative block rounded-2xl overflow-hidden h-[400px] transition-transform duration-200 hover:-translate-y-1 glass-panel"
              >
                {topNews.image ? (
                  <img src={topNews.image} alt={topNews.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                ) : (
                  <div className="absolute inset-0 w-full h-full flex items-center justify-center transition-transform duration-700 group-hover:scale-105" style={{ background: 'linear-gradient(135deg, #0f2617 0%, #1a3d20 30%, #2d5a27 60%, #1c3a18 100%)' }}>
                    <span className="material-symbols-outlined text-[80px] text-white/20">agriculture</span>
                  </div>
                )}
                
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                
                <div className="absolute bottom-0 left-0 p-8 w-full">
                  <div className="flex items-center gap-3 mb-4">
                    <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] rounded ${getCategory(topNews.title).bg}`}>
                      {getCategory(topNews.title).label}
                    </span>
                    <span className="text-xs text-slate-300 font-medium">{topNews.time}</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-white leading-snug group-hover:text-[#ec5b13] transition-colors line-clamp-2">
                    {topNews.title}
                  </h2>
                  <p className="text-xs text-slate-400 mt-4 flex items-center gap-1.5 font-medium tracking-wide">
                    {topNews.source}
                    <ExternalLink className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </p>
                </div>
              </a>
            ) : (
              <div className="h-[400px] rounded-2xl animate-pulse glass-panel" />
            )}

            {/* Grid Secundário: 2x2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {gridNews.length > 0 ? gridNews.map(item => (
                <a 
                  key={item.id} 
                  href={item.url} target="_blank" rel="noopener noreferrer"
                  className="group flex flex-col rounded-2xl overflow-hidden transition-transform duration-200 hover:-translate-y-1 glass-panel"
                >
                  <div className="h-44 relative overflow-hidden">
                    {item.image ? (
                      <img src={item.image} alt={item.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    ) : (
                      <div className="absolute inset-0 w-full h-full flex items-center justify-center transition-transform duration-700 group-hover:scale-105" style={{ background: 'linear-gradient(135deg, #0f2617 0%, #1a3d20 30%, #2d5a27 60%, #1c3a18 100%)' }}>
                        <span className="material-symbols-outlined text-[60px] text-white/20">agriculture</span>
                      </div>
                    )}
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                        <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded ${getCategory(item.title).bg}`}>
                            {getCategory(item.title).label}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">{item.time}</span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-100 leading-snug line-clamp-2 group-hover:text-[#ec5b13] transition-colors mb-4">
                        {item.title}
                        </h3>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">
                        {item.source}
                    </p>
                  </div>
                </a>
              )) : (
                 Array(4).fill(0).map((_, i) => <div key={i} className="h-64 rounded-2xl animate-pulse glass-panel" />)
              )}
            </div>
          </div>

          {/* BLOCO 3 — PAINEL DE PREÇOS */}
          <div className="lg:col-span-1 flex flex-col gap-8">
            
            {Object.entries(STATIC_COMMODITIES).map(([cat, items]) => (
              <div key={cat} className="space-y-4">
                <h3 className="text-[10px] font-bold text-[#ec5b13] uppercase tracking-[0.2em] pl-1 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ec5b13]"></span>
                  {cat}
                </h3>
                <div className="flex flex-col gap-3">
                  {items.map(item => (
                    <div 
                      key={item.name} 
                      className="group p-4 rounded-xl relative overflow-hidden transition-all duration-200 hover:border-[#ec5b13] glass-panel"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                            {item.name} 
                            <span className="text-[9px] font-medium text-slate-500 uppercase px-1.5 py-0.5 bg-slate-800/50 rounded" title="Preço de Referência Base">(ref.)</span>
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{item.place}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-bold text-white tracking-tight mb-0.5">R$ {item.price}</p>
                          <p className={`text-[10px] font-bold flex items-center justify-end gap-0.5 ${item.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {item.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {item.change > 0 ? '+' : ''}{item.change.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                      
                      {/* Bar indicator */}
                      <div className="h-1 w-full bg-slate-800/50 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-1000"
                          style={{ 
                            width: `${item.pos}%`, 
                            background: item.change >= 0 ? '#4ade80' : '#f87171' 
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

          </div>
        </div>



      </div>
    </div>
  );
}

```


### `src/pages/Pricing.tsx`
```tsx
import { useState, useEffect } from 'react';
import { apiFetch } from '../services/api';

interface Entitlements {
  max_fields: number;
  can_use_whatsapp: boolean;
  can_use_push: boolean;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function Pricing() {
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    apiFetch<Entitlements>('/api/billing/entitlements')
      .then(setEntitlements)
      .catch(console.error);
  }, []);

  const handleCheckout = async (planId: string) => {
    setLoading(true);
    setMessage('');
    try {
      const res = await apiFetch<{ checkout_url: string; message: string }>('/api/billing/checkout', {
        method: 'POST',
        body: JSON.stringify({ plan_id: planId, payment_method: 'pix' })
      });
      setMessage(res.message + " (Integração estrutural pronta. Aguardando chaves do Gateway).");
      // MOCK: Em produção, window.location.href = res.checkout_url;
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  };

  const subscribePush = async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setMessage('Seu navegador não suporta Web Push.');
        return;
      }
      
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setMessage('Permissão para notificações negada.');
        return;
      }

      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const rawVapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!rawVapidKey) {
        throw new Error('VITE_VAPID_PUBLIC_KEY não está definida no ambiente. O registro push exige provisão real.');
      }
      
      const applicationServerKey = urlBase64ToUint8Array(rawVapidKey);

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });

      const subJson = subscription.toJSON();
      
      await apiFetch('/api/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh || '',
          auth: subJson.keys?.auth || ''
        })
      });

      setMessage('Aparelho registrado com sucesso para notificações Push da Tracto!');
    } catch (err: any) {
      console.error(err);
      setMessage(`Erro na Inscrição Push: ${err.message}`);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-6" style={{ background: '#080809' }}>
      <div className="max-w-4xl mx-auto flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-white mb-2">Assinatura e Recursos</h1>
          <p className="text-sm" style={{ color: '#64748b' }}>
            Gerencie seu plano atual e libere funcionalidades avançadas.
          </p>
        </div>

        {entitlements && (
          <div className="p-4 rounded-xl border border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <h2 className="text-sm font-bold text-white mb-4 uppercase tracking-widest">Planos e Limites do seu Usuário</h2>
            <div className="flex flex-col gap-2 text-xs">
              <p className="text-slate-300">Talhões permitidos: <span className="font-bold text-white">{entitlements.max_fields}</span></p>
              <p className="text-slate-300">Acesso via WhatsApp: <span className="font-bold text-white">{entitlements.can_use_whatsapp ? 'Liberado' : 'Bloqueado'}</span></p>
              <p className="text-slate-300">Push Notifications: <span className="font-bold text-white">{entitlements.can_use_push ? 'Liberado' : 'Bloqueado'}</span></p>
            </div>
            {entitlements.max_fields === 1 && (
              <p className="mt-4 text-[10px] text-amber-500 font-bold bg-amber-500/10 p-2 rounded">
                Você está no plano Gratuito. Faça upgrade para remover os limites.
              </p>
            )}

            <button
               onClick={subscribePush}
               className="mt-6 w-full py-2.5 rounded text-[10px] font-bold tracking-widest uppercase transition-all"
               style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              Ativar Recebimento de Alertas (Push) Neste Aparelho
            </button>
            <p className="text-[9px] text-slate-500 mt-2 text-center">Permite receber notificações push fora do aplicativo. Requer credencial VAPID real configurada para disparos via webpush no backend.</p>

          </div>
        )}

        {message && (
          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-400 text-xs font-semibold">
            {message}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6 mt-4">
          <div className="p-6 rounded-2xl border border-white/10 flex flex-col" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <h3 className="text-lg font-bold text-white mb-2">Gratuito</h3>
            <p className="text-2xl font-light text-white mb-6">R$ 0<span className="text-sm text-slate-500">/mês</span></p>
            <ul className="space-y-3 mb-8 flex-1 text-sm text-slate-400">
              <li>• 1 Talhão Ativo</li>
              <li>• Análises Limitadas</li>
              <li>• Chat Básico</li>
            </ul>
            <button disabled className="w-full py-3 rounded-xl bg-white/5 text-slate-500 font-bold cursor-not-allowed">
              Plano Atual
            </button>
          </div>

          <div className="p-6 rounded-2xl border border-primary flex flex-col relative" style={{ background: 'rgba(236,91,19,0.05)' }}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1 rounded-full">
              Recomendado
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Profissional</h3>
            <p className="text-2xl font-light text-white mb-6">R$ 499<span className="text-sm text-slate-500">/mês</span></p>
            <ul className="space-y-3 mb-8 flex-1 text-sm text-slate-300">
              <li>• Talhões Ilimitados</li>
              <li>• IA Integrada no WhatsApp (Estrutural)</li>
              <li>• Push Notifications em Tempo Real (Estrutural)</li>
              <li>• Alertas Proativos sem Limite</li>
            </ul>
            <button 
              onClick={() => handleCheckout('pro')}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-primary text-white font-bold transition-all hover:opacity-90 disabled:opacity-50"
            >
              Simular Checkout (Pro)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

```


### `src/pages/Register.tsx`
```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

declare global {
  interface Window {
    grecaptcha: any;
  }
}


const maskPhone = (v: string) => {
  let val = v.replace(/\D/g, '');
  if (val.length > 11) val = val.slice(0, 11);
  if (val.length > 10) {
    return `(${val.slice(0, 2)}) ${val.slice(2, 7)}-${val.slice(7)}`;
  } else if (val.length > 6) {
    return `(${val.slice(0, 2)}) ${val.slice(2, 6)}-${val.slice(6)}`;
  } else if (val.length > 2) {
    return `(${val.slice(0, 2)}) ${val.slice(2)}`;
  } else if (val.length > 0) {
    return `(${val}`;
  }
  return val;
};

// ── Error messages ────────────────────────────────────────────────────────────
function friendlyError(msg: string): string {
  if (msg.includes('User already registered') || msg.includes('already exists')) return 'Este e-mail já está cadastrado.';
  if (msg.includes('Password should be')) return 'A senha deve ter pelo menos 6 caracteres.';
  if (msg.includes('rate limit')) return 'Muitas tentativas. Aguarde alguns minutos.';
  return msg;
}

export default function Register() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [success, setSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validations
    if (!name || !email || !phone || !password || !confirmPassword) {
      setError('Preencha todos os campos.');
      return;
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setError('Telefone inválido.');
      return;
    }

    setLoading(true);

    try {
      // 0. reCAPTCHA Verification (Optional/Harden)
      try {
        const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
        if (window.grecaptcha && siteKey) {
          const token = await window.grecaptcha.execute(siteKey, { action: 'register' });
          await fetch(`${import.meta.env.VITE_API_URL}/api/verify-recaptcha`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token }),
          });
        }
      } catch (captchaErr) {
        console.warn('reCAPTCHA error (pular):', captchaErr);
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            phone: cleanPhone,
          },
        },
      });

      if (signUpError) throw new Error(signUpError.message);

      setSuccess(true);
    } catch (err: unknown) {
      setError(friendlyError(err instanceof Error ? err.message : 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/app'
        }
      });
      if (authError) throw new Error(authError.message);
    } catch (err: unknown) {
      setError(friendlyError(err instanceof Error ? err.message : 'Erro no login com Google'));
      setGoogleLoading(false);
    }
  };


  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        .login-body { font-family: 'Plus Jakarta Sans', sans-serif; }
        .glass-dark-login {
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.03);
        }
      `}</style>

      <div className="login-body relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 z-0">
          <img
            alt="Vista aérea de fazenda"
            className="w-full h-full object-cover object-center"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBo6DW0mlLl01OpM-nNE6jQApM60H56OazuG6Jtp3sxsgX6lAo1LXOyu_JttoOmPNlnMpgPlQbJpAhDq5VeEUUNcLV1jFe1hEPDKudX7NGU0WVSgc3hERq2HUeSt2HkNDWoWQWwlF30I75vq_BKHkhbJDufw2QngU4jQT4SKPEY6rJ2YTZCTaurJg1CQHmynwgKTdRDiYH-fzqvecmgKWHx6wg-nag-tpEWL2lg4lJTopW21OF_MzEnn1Du38qJ0r4Pkbpcsrxwp90"
          />
          <div className="absolute inset-0 bg-slate-950/60" />
        </div>

        {/* Card */}
        <div className="relative z-10 w-full max-w-md px-6 py-12">
          <div className="glass-dark-login p-8 md:p-10 rounded-[2rem] border border-white/10 shadow-2xl backdrop-blur-3xl">
            <div className="text-center mb-8">
              <span className="text-2xl font-bold tracking-[0.4em] text-white uppercase block mb-2">Tracto</span>
              <p className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-medium">Criar Nova Conta</p>
            </div>

            {!success && (
              <div className="mb-6 space-y-6">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                  className="w-full bg-white hover:bg-[#f8f9fa] text-[#3c4043] py-3.5 rounded-xl text-sm font-medium transition-all border border-[#dadce0] flex items-center justify-center gap-3 shadow-sm hover:shadow-md disabled:opacity-70"
                >
                  {googleLoading ? (
                    <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                  )}
                  <span>Continuar com Google</span>
                </button>

                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-white/5"></div>
                  <span className="flex-shrink mx-4 text-[10px] text-slate-500 uppercase tracking-widest font-bold">ou</span>
                  <div className="flex-grow border-t border-white/5"></div>
                </div>
              </div>
            )}


            {success ? (
              <div className="text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-green-400 text-2xl">mail</span>
                </div>
                <p className="text-sm font-semibold text-white">Cadastro solicitado</p>
                <p className="text-xs text-slate-400 leading-relaxed">Verifique seu email para confirmar o cadastro.</p>
                <button
                  onClick={() => navigate('/login')}
                  className="mt-6 w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-full text-xs font-bold uppercase tracking-[0.2em] transition-all hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] shadow-xl shadow-orange-500/20"
                >
                  Ir para Login
                </button>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleRegister}>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-slate-400 font-bold ml-1">Nome Completo</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-400/50 transition-colors text-sm font-light"
                    placeholder="Seu nome"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-slate-400 font-bold ml-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-400/50 transition-colors text-sm font-light"
                    placeholder="seu@email.com"
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-slate-400 font-bold ml-1">Telefone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(maskPhone(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-400/50 transition-colors text-sm font-light"
                    placeholder="(11) 99999-9999"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-slate-400 font-bold ml-1">Senha</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-400/50 transition-colors text-sm font-light"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] uppercase tracking-widest text-slate-400 font-bold ml-1">Confirmar Senha</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-400/50 transition-colors text-sm font-light"
                    placeholder="••••••••"
                    required
                  />
                </div>

                {/* Error banner */}
                {error && (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-red-300" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <span className="material-symbols-outlined text-sm text-red-400">error</span>
                    {error}
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-full text-xs font-bold uppercase tracking-[0.2em] transition-all hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] active:scale-95 shadow-xl shadow-orange-500/20 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {loading ? 'Cadastrando...' : 'Cadastrar'}
                  </button>
                </div>
              </form>
            )}

            {!success && (
              <div className="mt-8 text-center">
                <p className="text-slate-500 text-[9px] uppercase tracking-widest">
                  Já possui conta?{' '}
                  <button
                    onClick={() => navigate('/login')}
                    className="text-white hover:text-orange-400 transition-colors font-bold ml-2 uppercase"
                  >
                    Fazer Login
                  </button>
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 text-center">
            <button
              className="text-slate-400 hover:text-white transition-colors text-[9px] uppercase tracking-[0.4em] flex items-center justify-center gap-2 cursor-pointer mx-auto"
              onClick={() => navigate('/')}
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Voltar para o site
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

```


### `src/pages/Reports.tsx`
```tsx
import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import useAppStore from '../store/useAppStore';
import type { Location } from '../store/useAppStore';
import { analyzeField } from '../services/api';
import type { FieldAnalysisResult } from '../services/api';
import { polygonAreaHa } from '../utils/geo';

// ── Sem dados históricos simulados na Etapa 2 ───────────────────────────────


// ── PDF export ────────────────────────────────────────────────────────────────
function exportPDF(fields: ReturnType<typeof useAppStore.getState>['fields']) {
  const doc = new jsPDF();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(236, 91, 19);
  doc.text('Tracto — Relatório de Talhões', 15, 20);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 15, 28);

  let y = 40;
  fields.forEach((f, i) => {
    const area = f.boundaries ? polygonAreaHa(f.boundaries) : 0;
    const name = f.name ?? `Talhão ${i + 1}`;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(`${i + 1}. ${name}`, 15, y);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Área: ${area.toFixed(2)} ha`, 20, y);
    y += 5;
    doc.text(`Coordenadas: lat ${f.lat.toFixed(5)}, lng ${f.lng.toFixed(5)}`, 20, y);
    y += 5;
    doc.text(`Vértices: ${f.boundaries?.length ?? 0}`, 20, y);
    y += 10;

    if (y > 270) { doc.addPage(); y = 20; }
  });

  if (fields.length === 0) {
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text('Nenhum talhão cadastrado.', 15, y);
  }

  doc.save('tracto-relatorio.pdf');
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Reports() {
  const { fields, weatherCache } = useAppStore();
  const [analysisResults, setAnalysisResults] = useState<Record<string, FieldAnalysisResult>>({});
  const [loadingAnalysis, setLoadingAnalysis] = useState<Record<string, boolean>>({});

  // Carregar do cache inicial se existir
  useEffect(() => {
    const initial: Record<string, FieldAnalysisResult> = {};
    fields.forEach(loc => {
      const key = `${loc.lat}-${loc.lng}`;
      const cached = localStorage.getItem(`tracto-ndvi-${key}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
            initial[key] = parsed.data;
          }
        } catch {}
      }
    });
    setAnalysisResults(initial);
  }, [fields]);

  const handleAnalyze = async (loc: Location) => {
    const key = `${loc.lat}-${loc.lng}`;
    setLoadingAnalysis(prev => ({ ...prev, [key]: true }));
    try {
      const fieldName = loc.name || 'Setor Base';
      const cropType = loc.cultura;
      const result = await analyzeField(
        loc.lat, 
        loc.lng, 
        fieldName, 
        cropType, 
        weatherCache,
        loc.boundaries || null,
        loc.dataPlantio,
        loc.variedade,
        loc.areaHa
      );

      setAnalysisResults(prev => ({ ...prev, [key]: result }));
      localStorage.setItem(`tracto-ndvi-${key}`, JSON.stringify({
        timestamp: Date.now(),
        data: result
      }));
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingAnalysis(prev => ({ ...prev, [key]: false }));
    }
  };

  const hasFields = fields.length > 0;


  const totalArea = fields.reduce((s, l) =>
    s + (l.boundaries ? polygonAreaHa(l.boundaries) : 0.01), 0);

  const kpis = [
    { label: 'Prod. Média', value: 'N/D', icon: 'agriculture', color: '#4ade80' },
    { label: 'NDVI Médio', value: 'N/D', icon: 'satellite_alt', color: '#60a5fa' },
    { label: 'Relatórios', value: String(hasFields ? fields.length : 0), icon: 'description', color: '#ec5b13' },
    { label: 'Área Analisada', value: hasFields ? `${totalArea.toFixed(1)} ha` : '–', icon: 'map', color: '#a78bfa' },
  ];

  const fieldRows = hasFields
    ? fields.map((loc, i) => ({
        icon: 'description',
        name: `Relatório — ${loc.name ?? `Talhão ${i + 1}`}`,
        date: 'Sob demanda',
        field: loc.name ?? `Talhão ${i + 1}`,
        area: loc.boundaries ? `${polygonAreaHa(loc.boundaries).toFixed(2)} ha` : '< 0.01 ha',
        status: 'Disponível',
      }))
    : [];

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin" style={{ background: '#080809' }}>
      <div className="p-5 flex flex-col gap-5 max-w-5xl mx-auto w-full">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Relatórios</h1>
            <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
              {hasFields ? `${fields.length} talhão${fields.length > 1 ? 'ões' : ''} · Relatórios Determinísticos` : 'Cadastre talhões para gerar relatórios'}
            </p>
          </div>
          <button
            onClick={() => exportPDF(fields)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90"
            style={{ background: '#ec5b13', boxShadow: '0 4px 20px rgba(236,91,19,0.28)' }}
          >
            <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
            Exportar PDF
          </button>
        </div>

        {/* ── Aviso de Confiança ── */}
        <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: 'rgba(56, 189, 248, 0.1)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
          <span className="material-symbols-outlined shrink-0" style={{ color: '#38bdf8' }}>info</span>
          <p className="text-sm font-medium" style={{ color: '#bae6fd' }}>
            Dados reportados via motor determinístico. O histórico temporal requer meses de coleta ativa para calibração de curvas.
          </p>
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {kpis.map((k) => (
            <div key={k.label} className="p-4 rounded-xl flex items-center gap-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: k.color + '18' }}>
                <span className="material-symbols-outlined text-xl" style={{ color: k.color }}>{k.icon}</span>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: '#64748b' }}>{k.label}</p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <p className="text-base font-bold text-white">{k.value}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Análise de Satélite ── */}
        {hasFields && (
          <div className="mb-4">
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-orange-500">satellite_alt</span>
              Análise de Satélite
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {fields.map((loc, i) => {
                const key = `${loc.lat}-${loc.lng}`;
                const result = analysisResults[key];
                const isLoading = loadingAnalysis[key];
                const name = loc.name ?? `Talhão ${i + 1}`;

                return (
                  <div key={key} className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {isLoading ? (
                      <div className="p-6 col-span-1 animate-pulse flex flex-col gap-4">
                        <div className="h-4 bg-white/10 rounded w-1/4"></div>
                        <div className="h-48 bg-white/5 rounded-xl w-full"></div>
                        <div className="h-4 bg-white/10 rounded w-3/4"></div>
                        <div className="h-4 bg-white/10 rounded w-1/2"></div>
                      </div>
                    ) : result ? (
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-bold text-white">{name}</h3>
                          {result.date_acquired && (
                            <span className="text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1" style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>
                              <span>{new Date(result.date_acquired?.split(' ')[0] || '').toLocaleDateString('pt-BR')}</span>
                              {result.date_acquired.includes('(Aproximado)') && <span className="text-amber-500/80">(Aprox)</span>}
                              {result.cloud_coverage !== null && ` · Nuvens: ${result.cloud_coverage}%`}
                            </span>
                          )}
                        </div>

                        {result.ndvi_image_base64 && (
                          <img 
                            src={`data:image/png;base64,${result.ndvi_image_base64}`} 
                            alt={`NDVI ${name}`}
                            className="w-full h-[200px] object-cover rounded-xl mb-6"
                            style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                          />
                        )}

                        <div className="mb-6">
                          <div className="flex justify-between items-center mb-2">
                             <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Metricas Deterministicas</h4>
                             <div className="flex items-center gap-2">
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${result.confidence > 0.7 ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                    Confianca: {(result.confidence * 100).toFixed(0)}%
                                </span>
                                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded uppercase bg-slate-700 text-slate-300">
                                    {result.source || 'Sentinel-2'}
                                </span>
                             </div>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                            <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                                <p className="text-[10px] text-slate-500 mb-1">NDVI Médio</p>
                                <p className="text-sm font-bold text-white">{result.ndvi_analysis.ndvi_medio.toFixed(3)}</p>
                            </div>
                            <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                                <p className="text-[10px] text-slate-500 mb-1">Pulverização</p>
                                <p className={`text-[10px] font-bold ${result.engine_results?.spray_window?.color === 'green' ? 'text-green-400' : 'text-amber-400'}`}>
                                    {result.engine_results?.spray_window?.label.toUpperCase()}
                                </p>
                            </div>
                            <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                                <p className="text-[10px] text-slate-500 mb-1">Risco Geada</p>
                                <p className={`text-[10px] font-bold ${result.engine_results?.frost_risk?.level > 2 ? 'text-red-400' : 'text-white'}`}>
                                    {result.engine_results?.frost_risk?.label.toUpperCase()}
                                </p>
                            </div>
                            <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                                <p className="text-[10px] text-slate-500 mb-1">Estresse Hídrico</p>
                                <p className={`text-[10px] font-bold ${result.engine_results?.water_stress?.level > 2 ? 'text-red-400' : 'text-white'}`}>
                                    {result.engine_results?.water_stress?.label.toUpperCase()}
                                </p>
                            </div>
                          </div>

                          <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Zonas de Vigor (NDVI)</h4>
                          <div className="h-6 w-full rounded-full overflow-hidden flex" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                            <div className="h-full bg-red-500" style={{ width: `${result.ndvi_analysis.zona_critica_pct}%` }} title={`Crítica: ${result.ndvi_analysis.zona_critica_pct}%`} />
                            <div className="h-full bg-yellow-500" style={{ width: `${result.ndvi_analysis.zona_estresse_pct}%` }} title={`Estresse: ${result.ndvi_analysis.zona_estresse_pct}%`} />
                            <div className="h-full bg-green-400" style={{ width: `${result.ndvi_analysis.zona_saudavel_pct}%` }} title={`Saudável: ${result.ndvi_analysis.zona_saudavel_pct}%`} />
                            <div className="h-full bg-green-700" style={{ width: `${result.ndvi_analysis.zona_excelente_pct}%` }} title={`Excelente: ${result.ndvi_analysis.zona_excelente_pct}%`} />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400 mt-1 px-1">
                            <span>Crítico ({result.ndvi_analysis.zona_critica_pct}%)</span>
                            <span>Excelente ({result.ndvi_analysis.zona_excelente_pct}%)</span>
                          </div>
                        </div>

                        <div className="mb-6 prose prose-sm prose-invert max-w-none text-slate-300">
                          <p>{result.ai_report}</p>
                        </div>

                        {result.ndvi_analysis.problemas_detectados.length > 0 && (
                          <div>
                            <h4 className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider">Problemas Detectados</h4>
                            <div className="flex flex-wrap gap-2">
                              {result.ndvi_analysis.problemas_detectados.map(prob => (
                                <span key={prob} className="px-2.5 py-1 rounded bg-red-500/10 text-red-400 text-xs font-medium border border-red-500/20">
                                  {prob}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        <div className="mt-6 flex justify-end">
                            <button
                                onClick={() => handleAnalyze(loc)}
                                className="px-4 py-2 rounded-lg text-xs font-bold transition-all border text-slate-300 hover:text-white hover:bg-white/5"
                                style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'transparent' }}
                            >
                                Re-analisar
                            </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 flex flex-col items-center justify-center text-center py-12">
                        <span className="material-symbols-outlined text-4xl mb-3" style={{ color: '#64748b' }}>query_stats</span>
                        <h3 className="text-white font-bold mb-1">{name}</h3>
                        <p className="text-xs text-slate-400 mb-4 max-w-sm">Gere um relatório detalhado de IA com imagens NDVI recentes de satélite e recomendações agronômicas.</p>
                        <button
                          onClick={() => handleAnalyze(loc)}
                          className="px-6 py-2 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 shadow-lg"
                          style={{ background: '#ec5b13', boxShadow: '0 4px 20px rgba(236,91,19,0.3)' }}
                        >
                          Gerar Análise Completa
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Honest UX: Histórico Real Missing ── */}
        {hasFields && (
          <div className="py-10 text-center rounded-2xl mb-6" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <span className="material-symbols-outlined text-4xl block mb-3 opacity-50" style={{ color: '#64748b' }}>timeline</span>
            <p className="text-sm font-semibold text-white mb-1">Histórico Temporal Indisponível</p>
            <p className="text-xs max-w-sm mx-auto" style={{ color: '#64748b' }}>
              São necessários múltiplos meses de coleta de imagens de satélite e dados de campo para gerar curvas de evolução do NDVI e Produtividade (Etapa 2).
            </p>
          </div>
        )}

        {/* ── Reports Table ── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <h2 className="text-sm font-bold text-white">Relatórios Disponíveis</h2>
            <span className="text-[10px] font-semibold px-2 py-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', color: '#64748b' }}>
              {fieldRows.length} registros
            </span>
          </div>

          {fieldRows.length === 0 ? (
            <div className="py-12 text-center">
              <span className="material-symbols-outlined text-4xl block mb-3" style={{ color: '#ec5b13' }}>description</span>
              <p className="text-sm font-semibold text-white mb-1">Nenhum talhão cadastrado</p>
              <p className="text-xs" style={{ color: '#64748b' }}>Vá ao mapa e desenhe um talhão para gerar relatórios automáticos.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {['Relatório', 'Talhão', 'Área', 'Data', 'Status', ''].map((h) => (
                      <th key={h} className="px-5 py-3 text-left font-semibold uppercase tracking-wider" style={{ color: '#64748b' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fieldRows.map((row, i) => (
                    <tr key={i} className="transition-colors hover:bg-white/[0.02]" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(236,91,19,0.12)' }}>
                            <span className="material-symbols-outlined text-sm" style={{ color: '#ec5b13' }}>{row.icon}</span>
                          </div>
                          <span className="font-medium text-white truncate max-w-[140px]">{row.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3" style={{ color: '#94a3b8' }}>{row.field}</td>
                      <td className="px-5 py-3" style={{ color: '#94a3b8' }}>{row.area}</td>
                      <td className="px-5 py-3" style={{ color: '#94a3b8' }}>{row.date}</td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => exportPDF([fields[i]])}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all hover:opacity-80"
                          style={{ background: 'rgba(236,91,19,0.1)', color: '#ec5b13', border: '1px solid rgba(236,91,19,0.15)' }}
                        >
                          <span className="material-symbols-outlined text-xs">download</span>
                          PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Precipitation info if available */}
        {weatherCache && (
          <div className="p-4 rounded-xl flex items-center gap-3 text-xs" style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.12)' }}>
            <span className="material-symbols-outlined text-blue-400">water_drop</span>
            <span style={{ color: '#94a3b8' }}>Precipitação acumulada (7d): <span className="text-white font-semibold">{weatherCache.daily.precipSum.reduce((a, b) => a + (b ?? 0), 0).toFixed(1)} mm</span></span>
          </div>
        )}

      </div>
    </div>
  );
}

```


### `src/pages/ResetPassword.tsx`
```tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';

type Stage = 'loading' | 'form' | 'success' | 'invalid';

function friendlyError(msg: string): string {
  if (msg.includes('Password should be')) return 'A senha deve ter pelo menos 6 caracteres.';
  if (msg.includes('same password')) return 'A nova senha não pode ser igual à atual.';
  if (msg.includes('expired')) return 'Link expirado. Solicite um novo e-mail de recuperação.';
  return 'Erro ao atualizar senha. Tente novamente.';
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('loading');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setStage('form');
      }
    });

    const hash = window.location.hash;
    if (hash.includes('type=recovery') || hash.includes('access_token')) {
      setStage('form');
    } else {
      const timer = setTimeout(() => {
        setStage((s) => s === 'loading' ? 'invalid' : s);
      }, 2000);
      return () => {
        clearTimeout(timer);
        subscription.unsubscribe();
      };
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw new Error(updateError.message);
      setStage('success');
    } catch (err: unknown) {
      setError(friendlyError(err instanceof Error ? err.message : 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        .login-body { font-family: 'Plus Jakarta Sans', sans-serif; }
        .glass-dark-login {
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.03);
        }
      `}</style>

      <div className="login-body relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            alt="Vista aérea de fazenda"
            className="w-full h-full object-cover object-center"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBo6DW0mlLl01OpM-nNE6jQApM60H56OazuG6Jtp3sxsgX6lAo1LXOyu_JttoOmPNlnMpgPlQbJpAhDq5VeEUUNcLV1jFe1hEPDKudX7NGU0WVSgc3hERq2HUeSt2HkNDWoWQWwlF30I75vq_BKHkhbJDufw2QngU4jQT4SKPEY6rJ2YTZCTaurJg1CQHmynwgKTdRDiYH-fzqvecmgKWHx6wg-nag-tpEWL2lg4lJTopW21OF_MzEnn1Du38qJ0r4Pkbpcsrxwp90"
          />
          <div className="absolute inset-0 bg-slate-950/60" />
        </div>

        <div className="relative z-10 w-full max-w-md px-6">
          <div className="glass-dark-login p-10 md:p-12 rounded-[2rem] border border-white/10 shadow-2xl">
            <div className="text-center mb-10">
              <span className="text-2xl font-bold tracking-[0.4em] text-white uppercase block mb-2">Tracto</span>
              <p className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-medium">Redefinição de Senha</p>
            </div>

            {stage === 'loading' && (
              <div className="flex flex-col items-center gap-4 py-8">
                <span className="material-symbols-outlined text-orange-400 text-4xl animate-spin">refresh</span>
                <p className="text-slate-400 text-sm">Validando link de recuperação...</p>
              </div>
            )}

            {stage === 'invalid' && (
              <div className="flex flex-col items-center gap-6 py-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <span className="material-symbols-outlined text-red-400 text-3xl">link_off</span>
                </div>
                <div className="text-center">
                  <p className="text-white font-medium mb-2">Link inválido ou expirado</p>
                  <p className="text-slate-400 text-sm">Solicite um novo e-mail de recuperação na tela de login.</p>
                </div>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-full text-xs font-bold uppercase tracking-[0.3em] transition-all hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] active:scale-95"
                >
                  Ir para o Login
                </button>
              </div>
            )}

            {stage === 'form' && (
              <form className="space-y-6" onSubmit={handleSubmit}>
                <p className="text-slate-400 text-sm text-center -mt-4 mb-2">
                  Escolha uma nova senha para sua conta.
                </p>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">Nova Senha</label>
                  <div className="relative">
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-400/50 transition-colors text-sm font-light pr-12"
                      placeholder="Mínimo 6 caracteres"
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">
                        {showPass ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">Confirmar Senha</label>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-orange-400/50 transition-colors text-sm font-light"
                    placeholder="Repita a nova senha"
                    autoComplete="new-password"
                    required
                  />
                </div>

                {password.length > 0 && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1,2,3,4].map((n) => (
                        <div key={n} className="h-1 flex-1 rounded-full transition-all" style={{
                          background: password.length >= n * 3
                            ? n <= 1 ? '#ef4444' : n <= 2 ? '#f97316' : n <= 3 ? '#eab308' : '#22c55e'
                            : 'rgba(255,255,255,0.1)'
                        }} />
                      ))}
                    </div>
                    <p className="text-[10px] text-slate-500 ml-1">
                      {password.length < 4 ? 'Muito fraca' : password.length < 7 ? 'Fraca' : password.length < 10 ? 'Razoável' : 'Forte'}
                    </p>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-medium text-red-300" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <span className="material-symbols-outlined text-sm text-red-400">error</span>
                    {error}
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white py-5 rounded-full text-xs font-bold uppercase tracking-[0.3em] transition-all hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] active:scale-95 shadow-xl shadow-orange-500/20 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <span className="material-symbols-outlined text-sm animate-spin">refresh</span>
                        Salvando...
                      </>
                    ) : 'Redefinir Senha'}
                  </button>
                </div>
              </form>
            )}

            {stage === 'success' && (
              <div className="flex flex-col items-center gap-6 py-4">
                <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <span className="material-symbols-outlined text-green-400 text-3xl">check_circle</span>
                </div>
                <div className="text-center">
                  <p className="text-white font-medium mb-2">Senha atualizada!</p>
                  <p className="text-slate-400 text-sm">Sua senha foi redefinida com sucesso. Faça login com a nova senha.</p>
                </div>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-full text-xs font-bold uppercase tracking-[0.3em] transition-all hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] active:scale-95"
                >
                  Ir para o Login
                </button>
              </div>
            )}
          </div>

          <div className="mt-8 text-center">
            <button
              className="text-slate-400 hover:text-white transition-colors text-[9px] uppercase tracking-[0.4em] flex items-center justify-center gap-2 cursor-pointer mx-auto"
              onClick={() => navigate('/login')}
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Voltar para o login
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
```

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('As senhas nÃ£o coincidem.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      const { error: resetError } = await supabase.auth.updateUser({
        password: password
      });

      if (resetError) throw resetError;

      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.message || 'Erro ao redefinir senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-6">
      <div className="w-full max-w-md glass-dark p-8 rounded-[2rem] border border-white/10 shadow-2xl">
        <div className="text-center mb-8">
          <span className="text-2xl font-bold tracking-[0.4em] text-white uppercase block mb-2">Tracto</span>
          <p className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-medium">Redefinir Senha</p>
        </div>

        {success ? (
          <div className="text-center space-y-4 py-8">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-green-400 text-2xl">check_circle</span>
            </div>
            <p className="text-sm font-semibold text-white">Senha alterada com sucesso!</p>
            <p className="text-xs text-slate-400">Você será redirecionado em instantes...</p>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-6">
            <div className="space-y-1">
              <label className="text-[9px] uppercase tracking-widest text-slate-400 font-bold ml-1">Nova Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 transition-colors text-sm"
                placeholder="••••••••"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] uppercase tracking-widest text-slate-400 font-bold ml-1">Confirmar Nova Senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-orange-500/50 transition-colors text-sm"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-4 py-3 rounded-xl flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">error</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-full text-xs font-bold uppercase tracking-[0.2em] transition-all disabled:opacity-50"
            >
              {loading ? 'Processando...' : 'Redefinir Senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

```


### `src/pages/Weather.tsx`
```tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore, { type WeatherCache } from '../store/useAppStore';
import { SkeletonCard } from '../components/Skeleton';

// ── WMO Weather Code → icon + label ──────────────────────────────────────────
const WMO_CODES: Record<number, { icon: string; label: string }> = {
  0: { icon: 'wb_sunny', label: 'Céu limpo' },
  1: { icon: 'wb_sunny', label: 'Predominantemente limpo' },
  2: { icon: 'partly_cloudy_day', label: 'Parcialmente nublado' },
  3: { icon: 'cloud', label: 'Nublado' },
  45: { icon: 'foggy', label: 'Neblina' },
  48: { icon: 'foggy', label: 'Neblina com gelo' },
  51: { icon: 'grain', label: 'Chuvisco leve' },
  61: { icon: 'rainy', label: 'Chuva leve' },
  63: { icon: 'rainy', label: 'Chuva moderada' },
  65: { icon: 'rainy', label: 'Chuva forte' },
  71: { icon: 'ac_unit', label: 'Neve leve' },
  80: { icon: 'rainy', label: 'Pancadas de chuva' },
  95: { icon: 'thunderstorm', label: 'Tempestade' },
  99: { icon: 'thunderstorm', label: 'Tempestade com granizo' },
};

const wmo = (code: number) => WMO_CODES[code] ?? { icon: 'cloud', label: 'Variável' };

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

// ── Open-Meteo fetch ──────────────────────────────────────────────────────────
async function fetchOpenMeteo(lat: number, lng: number): Promise<WeatherCache> {
  const base = 'https://api.open-meteo.com/v1/forecast';
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,visibility',
    hourly: 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,visibility',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration,soil_moisture_0_to_7cm_mean',
    timezone: 'America/Sao_Paulo',
    forecast_days: '7',
    forecast_hours: '24',
  });

  const res = await fetch(`${base}?${params}`);
  if (!res.ok) throw new Error('Erro ao buscar dados da Open-Meteo');
  const d = await res.json();

  return {
    lat,
    lng,
    fetchedAt: Date.now(),
    temperature: d.current.temperature_2m,
    windSpeed: d.current.wind_speed_10m,
    humidity: d.current.relative_humidity_2m,
    weatherCode: d.current.weather_code,
    daily: {
      time: d.daily.time,
      tempMax: d.daily.temperature_2m_max,
      tempMin: d.daily.temperature_2m_min,
      precipSum: d.daily.precipitation_sum,
      et0: d.daily.et0_fao_evapotranspiration ?? [],
    },
    hourly: {
      time: d.hourly.time.slice(0, 24),
      temp: d.hourly.temperature_2m.slice(0, 24),
      humidity: d.hourly.relative_humidity_2m.slice(0, 24),
      precip: d.hourly.precipitation.slice(0, 24),
      windSpeed: d.hourly.wind_speed_10m.slice(0, 24),
      visibility: d.hourly.visibility.slice(0, 24),
    },
  };
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Weather() {
  const navigate = useNavigate();
  const { currentLocation, fields, weatherCache, setWeatherCache } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [windyOverlay, setWindyOverlay] = useState<'temp' | 'rain' | 'humidity' | 'wind' | 'clouds'>('temp');

  const loc = fields.length > 0
    ? fields[fields.length - 1]
    : (currentLocation ?? { lat: -18.9188, lng: -48.2768, name: 'Uberlândia, MG' });

  useEffect(() => {
    const isCacheValid =
      weatherCache &&
      Math.abs(weatherCache.lat - loc.lat) < 0.01 &&
      Math.abs(weatherCache.lng - loc.lng) < 0.01 &&
      Date.now() - weatherCache.fetchedAt < CACHE_TTL_MS;

    if (isCacheValid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    fetchOpenMeteo(loc.lat, loc.lng)
      .then((cache) => setWeatherCache(cache))
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro desconhecido'))
      .finally(() => setLoading(false));
  }, [loc.lat, loc.lng]);

  const w = weatherCache;
  const { icon, label } = w ? wmo(w.weatherCode) : { icon: 'cloud', label: '' };

  // Current hour index for highlighting
  const nowHour = new Date().getHours();

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin" style={{ background: '#080809' }}>
      <div className="p-5 flex flex-col gap-4 max-w-5xl mx-auto w-full">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Meteorologia</h1>
            <p className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: '#64748b' }}>
              <span className="material-symbols-outlined text-sm" style={{ color: '#ec5b13' }}>location_on</span>
              {loc.name ?? 'Localização atual'} · Open-Meteo
            </p>
          </div>
          <button
            onClick={() => {
              setLoading(true);
              fetchOpenMeteo(loc.lat, loc.lng)
                .then(setWeatherCache)
                .catch((e) => setError(e.message))
                .finally(() => setLoading(false));
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: '#94a3b8' }}
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Atualizar
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="p-4 rounded-xl flex items-start gap-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <span className="material-symbols-outlined text-red-400 mt-0.5">error</span>
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* ── Mapa Meteorológico Windy ── */}
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.09)' }}>
          {/* Header do mapa */}
          <div className="px-5 py-4 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-white">Mapa Meteorológico em Tempo Real</h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                Windy · Ao Vivo
              </span>
            </div>
            {/* Seletor de camadas */}
            <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {[
                { key: 'temp', label: 'Temperatura', icon: 'thermostat' },
                { key: 'rain', label: 'Precipitação', icon: 'water_drop' },
                { key: 'humidity', label: 'Umidade', icon: 'humidity_percentage' },
                { key: 'wind', label: 'Vento', icon: 'air' },
                { key: 'clouds', label: 'Nuvens', icon: 'cloud' },
              ].map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setWindyOverlay(key as typeof windyOverlay)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                  style={windyOverlay === key
                    ? { background: 'rgba(236,91,19,0.2)', color: '#ec5b13' }
                    : { color: '#64748b' }
                  }
                >
                  <span className="material-symbols-outlined text-xs">{icon}</span>
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>
          {/* iframe Windy */}
          <iframe
            key={`${loc.lat}-${loc.lng}-${windyOverlay}`}
            src={`https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=mm&metricTemp=°C&metricWind=km/h&lat=${loc.lat}&lon=${loc.lng}&zoom=8&level=surface&overlay=${windyOverlay}&menu=false&message=true&marker=true&calendar=now&pressure=true&type=map&detail=false&detailLat=${loc.lat}&detailLon=${loc.lng}&distIndicator=false&dMap=0`}
            className="w-full"
            style={{ height: 480, border: 'none', display: 'block' }}
            title="Mapa Meteorológico"
            allowFullScreen
          />
        </div>

        {/* ── First Load Loading Skeleton ── */}
        {!w && loading && (
          <div className="space-y-4">
            <SkeletonCard style={{ height: 160 }} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)}
            </div>
            <SkeletonCard style={{ height: 200 }} />
          </div>
        )}

        {/* ── Current Weather Card ── */}
        {w && (
          <div
            className="relative overflow-hidden rounded-2xl p-6 flex flex-col sm:flex-row gap-6"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
          >
            <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full pointer-events-none" style={{ background: '#ec5b13', opacity: 0.07, filter: 'blur(50px)' }} />

            {loading && (
              <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10">
                <span className="material-symbols-outlined text-xs animate-spin text-orange-500">refresh</span>
                <span className="text-[10px] text-slate-400">Atualizando...</span>
              </div>
            )}

            {/* Main temp */}
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(236,91,19,0.12)' }}>
                <span className="material-symbols-outlined text-5xl" style={{ color: '#ec5b13' }}>{icon}</span>
              </div>
              <div>
                <p className="text-7xl font-black text-white leading-none">{Math.round(w.temperature)}°</p>
                <p className="text-sm font-semibold capitalize mt-1" style={{ color: '#e2e8f0' }}>{label}</p>
                <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
                  Máx {Math.round(w.daily.tempMax[0] ?? w.temperature)}° · Mín {Math.round(w.daily.tempMin[0] ?? w.temperature)}°
                </p>
              </div>
            </div>

            <div className="hidden sm:block w-px self-stretch" style={{ background: 'rgba(255,255,255,0.07)' }} />

            {/* Quick stats */}
            <div className="flex flex-wrap gap-x-8 gap-y-3 items-center">
              {[
                { icon: 'air', label: 'Vento', val: `${Math.round(w.windSpeed)} km/h`, color: '#94a3b8' },
                { icon: 'water_drop', label: 'Umidade', val: `${w.humidity}%`, color: '#60a5fa' },
                { icon: 'umbrella', label: 'Precip. hoje', val: `${(w.daily.precipSum[0] ?? 0).toFixed(1)} mm`, color: '#818cf8' },
              ].map((s) => (
                <div key={s.label}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="material-symbols-outlined text-base" style={{ color: s.color }}>{s.icon}</span>
                    <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: '#64748b' }}>{s.label}</p>
                  </div>
                  <p className="text-lg font-bold text-white">{s.val}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 6 Metrics Grid ── */}
        {w && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Vento', value: `${Math.round(w.windSpeed)} km/h`, icon: 'air', color: '#94a3b8' },
              { label: 'Umidade', value: `${w.humidity}%`, icon: 'water_drop', color: '#60a5fa' },
              { label: 'Visibilidade', value: `${((w.hourly.visibility[nowHour] ?? 10000) / 1000).toFixed(1)} km`, icon: 'visibility', color: '#a78bfa' },
              { label: 'Precip. acumulada (7d)', value: `${w.daily.precipSum.reduce((a, b) => a + (b ?? 0), 0).toFixed(1)} mm`, icon: 'water', color: '#38bdf8' },
              { label: 'Et₀ (hoje)', value: w.daily.et0[0] != null ? `${w.daily.et0[0].toFixed(2)} mm/d` : 'N/D', icon: 'local_florist', color: '#4ade80' },
              { label: 'Chuva hoje', value: `${(w.daily.precipSum[0] ?? 0).toFixed(1)} mm`, icon: 'umbrella', color: '#818cf8' },
            ].map((m) => (
              <div key={m.label} className="p-4 rounded-xl flex items-center gap-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: m.color + '18' }}>
                  <span className="material-symbols-outlined text-xl" style={{ color: m.color }}>{m.icon}</span>
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: '#64748b' }}>{m.label}</p>
                  <p className="text-base font-bold text-white mt-0.5">{m.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Dados Agrícolas ── */}
        {w && w.daily.et0.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
            <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <span className="material-symbols-outlined text-xl" style={{ color: '#4ade80' }}>agriculture</span>
              <h2 className="text-sm font-bold text-white">Dados Agrícolas</h2>
              <span className="text-[10px] ml-auto font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>Open-Meteo · Grátis</span>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {w.daily.time.slice(0, 4).map((time, i) => {
                const d = new Date(time + 'T12:00:00');
                const dayLabel = i === 0 ? 'Hoje' : DAYS_PT[d.getDay()];
                return (
                  <div key={time} className="p-3 rounded-xl flex flex-col gap-2" style={{ background: i === 0 ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${i === 0 ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)'}` }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: i === 0 ? '#4ade80' : '#64748b' }}>{dayLabel}</p>
                    <div>
                      <p className="text-[10px]" style={{ color: '#64748b' }}>ET₀</p>
                      <p className="text-sm font-bold text-white">{w.daily.et0[i] != null ? `${w.daily.et0[i].toFixed(2)}` : '—'} <span className="text-[10px] font-normal" style={{ color: '#64748b' }}>mm/d</span></p>
                    </div>
                    <div>
                      <p className="text-[10px]" style={{ color: '#64748b' }}>Precipitação</p>
                      <p className="text-sm font-bold text-white">{(w.daily.precipSum[i] ?? 0).toFixed(1)} <span className="text-[10px] font-normal" style={{ color: '#64748b' }}>mm</span></p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Previsão Horária ── */}
        {w && (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <h2 className="text-sm font-bold text-white">Previsão por Hora</h2>
              <span className="text-[10px] font-medium" style={{ color: '#64748b' }}>Próximas 24h</span>
            </div>
            <div className="flex overflow-x-auto scrollbar-thin p-4 gap-3">
              {w.hourly.time.map((t, i) => {
                const h = new Date(t).getHours();
                const isNow = i === 0;
                return (
                  <div
                    key={t}
                    className="flex flex-col items-center gap-2 px-4 py-3 rounded-xl flex-shrink-0 transition-all"
                    style={{
                      background: isNow ? 'rgba(236,91,19,0.12)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isNow ? 'rgba(236,91,19,0.25)' : 'rgba(255,255,255,0.07)'}`,
                      minWidth: 72,
                    }}
                  >
                    <p className="text-[10px] font-semibold" style={{ color: isNow ? '#ec5b13' : '#64748b' }}>
                      {isNow ? 'Agora' : `${h}h`}
                    </p>
                    <span className="material-symbols-outlined text-2xl" style={{ color: isNow ? '#ec5b13' : '#94a3b8' }}>
                      {wmo(w.weatherCode).icon}
                    </span>
                    <p className="text-sm font-bold text-white">{Math.round(w.hourly.temp[i])}°</p>
                    {w.hourly.precip[i] > 0 && (
                      <p className="text-[10px] font-semibold" style={{ color: '#60a5fa' }}>{w.hourly.precip[i].toFixed(1)}mm</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Previsão 7 Dias ── */}
        {w && (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <h2 className="text-sm font-bold text-white">Próximos 7 Dias</h2>
            </div>
            <div>
              {w.daily.time.map((time, i) => {
                const d = new Date(time + 'T12:00:00');
                const dayLabel = i === 0 ? 'Hoje' : DAYS_PT[d.getDay()];
                const pct = Math.max(0, Math.min(100, ((w.daily.tempMax[i] - 5) / 35) * 100));
                return (
                  <div key={time} className="flex items-center gap-4 px-5 py-4 border-b last:border-none" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <p className="text-sm font-semibold capitalize text-white w-24 shrink-0">{dayLabel}</p>
                    <span className="material-symbols-outlined text-xl" style={{ color: '#94a3b8' }}>{wmo(w.weatherCode).icon}</span>
                    <div className="flex items-center gap-1.5 flex-1 text-xs" style={{ color: '#64748b' }}>
                      {w.daily.precipSum[i] > 0 && (
                        <span className="flex items-center gap-0.5 text-blue-400">
                          <span className="material-symbols-outlined text-xs">water_drop</span>
                          {w.daily.precipSum[i].toFixed(1)}mm
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm font-bold">
                      <span style={{ color: '#60a5fa' }}>{Math.round(w.daily.tempMin[i])}°</span>
                      <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(to right, #60a5fa, #f97316)' }} />
                      </div>
                      <span style={{ color: '#f97316' }}>{Math.round(w.daily.tempMax[i])}°</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Recomendações ── */}
        {w && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-xl" style={{ color: '#ec5b13' }}>agriculture</span>
                <h3 className="text-sm font-bold text-white">Janela de Pulverização</h3>
              </div>
              <p className="text-xs leading-relaxed text-slate-400">
                Vento atual <span className="text-white font-semibold">{Math.round(w.windSpeed)} km/h</span> e umidade <span className="text-white font-semibold">{w.humidity}%</span> — {w.windSpeed < 15 && w.humidity < 80 ? 'condições favoráveis para aplicação no Talhão Norte.' : 'aguarde condições mais favoráveis.'}
              </p>
              <button
                onClick={() => navigate('/app/reports')}
                className="mt-4 w-full py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90" style={{ background: '#ec5b13' }}>
                Gerar Relatório de Pulverização
              </button>
            </div>
            <div className="p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-xl text-blue-400">water_drop</span>
                <h3 className="text-sm font-bold text-white">Manejo de Irrigação</h3>
              </div>
              <p className="text-xs leading-relaxed text-slate-400">
                ET₀ de <span className="text-white font-semibold">{w.daily.et0[0] != null ? `${w.daily.et0[0].toFixed(2)} mm/d` : 'N/D'}</span> com precipitação prevista de <span className="text-white font-semibold">{(w.daily.precipSum[0] ?? 0).toFixed(1)} mm</span> — {(w.daily.precipSum[0] ?? 0) > 5 ? 'reduza o fluxo de irrigação para evitar desperdício.' : 'recomenda-se irrigação suplementar.'}
              </p>
              <button
                disabled
                title="Em breve"
                className="mt-4 w-full py-2 rounded-xl text-xs font-bold transition-all"
                style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa', opacity: 0.5, cursor: 'not-allowed' }}
              >
                Ver Plano de Irrigação
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

```


### `src/services/alertsAI.ts`
```ts
import { apiFetch } from './api';
import type { Alert, Location, WeatherCache } from '../store/useAppStore';

type RawAlert = {
  id?: string;
  type?: string;
  title?: string;
  message?: string;
  createdAt?: string | number;
  field?: string;
  value?: string;
  valueLabel?: string;
};

function normalizeAlertType(type: string | undefined): Alert['type'] {
  return type === 'critical' || type === 'warning' || type === 'info' ? type : 'info';
}

function normalizeTimestamp(createdAt: string | number | undefined, fallback: number) {
  if (typeof createdAt === 'number') return createdAt;
  const parsed = new Date(createdAt ?? '').getTime();
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sumWindow(values: number[] | undefined, days = 7) {
  if (!values || values.length === 0) return 0;
  return values.slice(0, days).reduce((sum, value) => sum + (value ?? 0), 0);
}

export async function generateAlerts(
  weatherCache: WeatherCache | null,
  fields: Location[],
): Promise<Alert[]> {
  const fieldsInfo =
    fields.length > 0
      ? fields.map((location, index) => ({
          name: location.name || `Talhao ${index + 1}`,
          lat: location.lat,
          lng: location.lng,
          crop: location.cultura || null,
          boundaries: location.boundaries || null,
        }))
      : [];

  const distinctCrops = [...new Set(fieldsInfo.map((f) => f.crop).filter(Boolean))];

  const currentCrop =
    distinctCrops.length === 1
      ? (distinctCrops[0] as string)
      : distinctCrops.length > 1
        ? 'Multiplas culturas'
        : null;

  const payload = {
    temperature: weatherCache ? weatherCache.temperature : 25,
    humidity: weatherCache ? weatherCache.humidity : 60,
    rain_accumulation: weatherCache ? sumWindow(weatherCache.daily.precipSum, 7) : 0,
    wind_speed: weatherCache ? weatherCache.windSpeed : 10,
    et0: weatherCache ? sumWindow(weatherCache.daily.et0, 7) : null,
    crop_type: currentCrop,
    fields: fieldsInfo,
    weather_forecast: weatherCache
      ? weatherCache.daily.time
          .slice(0, 7)
          .map((day, index) => `${day}: chuva ${(weatherCache.daily.precipSum[index] ?? 0).toFixed(1)}mm`)
          .join(' | ')
      : null,
  };

  const data = await apiFetch<{ alerts?: RawAlert[] }>('/api/alerts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!Array.isArray(data.alerts)) {
    throw new Error('A API retornou um formato de alertas invalido.');
  }

  const now = Date.now();
  return data.alerts.map((alert, index) => ({
    id: alert.id || `alerta-${now}-${index}`,
    type: normalizeAlertType(alert.type),
    title: alert.title ?? 'Alerta Agronomico',
    message: alert.message ?? '',
    timestamp: normalizeTimestamp(alert.createdAt, now),
    dismissed: false,
    field: alert.field,
    value: alert.value,
    valueLabel: alert.valueLabel,
  }));
}

```


### `src/services/api.ts`
```ts
import type { WeatherCache } from '../store/useAppStore';
import { supabase } from './supabase';

export const API_URL = import.meta.env.VITE_API_URL || 'https://tracto-production.up.railway.app';

async function buildAuthHeaders() {
  try {
    let {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      const refreshed = await supabase.auth.refreshSession();
      session = refreshed.data.session;
    }

    console.log('[API] Token:', session?.access_token ? 'presente' : 'AUSENTE');
    console.log('[API] User:', session?.user?.email ?? 'nenhum');

    if (!session?.access_token) {
      return {};
    }

    return {
      Authorization: `Bearer ${session.access_token}`,
    };
  } catch (error) {
    console.warn('[API] Falha ao construir headers de autentição:', error);
    return {};
  }
}

function buildForecastSummary(weatherCache: WeatherCache | null | undefined) {
  if (!weatherCache) return null;

  return weatherCache.daily.time
    .slice(0, 7)
    .map((day, index) => {
      const min = weatherCache.daily.tempMin[index];
      const max = weatherCache.daily.tempMax[index];
      const rain = weatherCache.daily.precipSum[index] ?? 0;
      return `${day}: ${Math.round(min ?? 0)}-${Math.round(max ?? 0)}C, chuva ${rain.toFixed(1)}mm`;
    })
    .join(' | ');
}

function buildFieldWeatherPayload(weatherCache: WeatherCache | null | undefined) {
  if (!weatherCache) return null;

  return {
    temperature: weatherCache.temperature,
    humidity: weatherCache.humidity,
    wind_speed: weatherCache.windSpeed,
    rain_accumulation: weatherCache.daily.precipSum[0] ?? 0,
    weather_code: weatherCache.weatherCode,
    fetched_at: weatherCache.fetchedAt,
    daily: weatherCache.daily,
    hourly: weatherCache.hourly,
  };
}

export const apiFetch = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  if (!API_URL) {
    throw new Error('Backend não configurado. Defina VITE_API_URL no .env');
  }
  const url = `${API_URL}${path}`;
  console.log('[API] API_URL:', API_URL);
  console.log('[API] Chamando:', url);

  const authHeaders = await buildAuthHeaders();
  const headers = new Headers(options.headers ?? {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  Object.entries(authHeaders).forEach(([key, value]) => headers.set(key, value));

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    if (!response.ok) {
      let detail = response.statusText;

      try {
        if (isJson) {
          const payload = (await response.json()) as { detail?: string };
          detail = payload.detail || detail;
        } else {
          detail = await response.text();
        }
      } catch {
        detail = response.statusText;
      }

      if (response.status === 401) {
        throw new Error('Sua sessao expirou. Entre novamente para continuar.');
      }

      throw new Error(`Erro na API (${response.status} ${response.statusText}): ${detail}`);
    }

    if (!isJson) {
      return (await response.text()) as T;
    }

    return response.json();
  } catch (err) {
    console.error('[API] fetch error:', url, err);
    if (err instanceof TypeError && err.message === 'Failed to fetch') {
      throw new Error(`O servidor Backend/API não está acessível em ${url}. Possível CORS ou URL incorreta. Detalhes: ${err.message}`);
    }
    if (err instanceof Error) {
      throw new Error(`Erro de requisição para ${url}: ${err.message}`);
    }
    throw err;
  }
};

export interface FieldAnalysisResult {
  field_name: string;
  ndvi_image_base64: string | null;
  date_acquired: string | null;
  cloud_coverage: number | null;
  ndvi_analysis: {
    ndvi_medio: number;
    zona_critica_pct: number;
    zona_estresse_pct: number;
    zona_saudavel_pct: number;
    zona_excelente_pct: number;
    solo_exposto_pct: number;
    problemas_detectados: string[];
    areas_atencao: string;
    tendencia: string;
    confianca: number;
    janela_pulverizacao?: string;
    risco_geada?: string;
    deficit_hidrico?: string;
    recomendacao_irrigacao?: string;
  };
  weather_summary: string;
  ai_report: string;
  alerts: Array<Record<string, unknown>>;
  cached: boolean;
  is_mock: boolean;
  analyzed_at: string;
  confidence: number;
  engine_results: Record<string, any>;
  source: string;
}

export async function analyzeField(
  lat: number,
  lng: number,
  fieldName: string,
  cropType?: string,
  weatherCache: WeatherCache | null = null,
  boundaries: [number, number][] | null = null,
  plantingDate?: string,
  variety?: string,
  areaHa?: number
) {
  return apiFetch<FieldAnalysisResult>('/api/analyze-field', {
    method: 'POST',
    body: JSON.stringify({
      lat,
      lng,
      field_name: fieldName,
      crop_type: cropType || undefined,
      date_range_days: 15,
      hourly_weather: buildFieldWeatherPayload(weatherCache),
      forecast_7d: buildForecastSummary(weatherCache),
      boundaries,
      planting_date: plantingDate,
      variety,
      area_ha: areaHa
    }),
  });
}

```


### `src/services/farm_service.ts`
```ts
import { apiFetch } from './api';
import type { Farm, Location } from '../store/useAppStore';

type ApiFarm = {
  id: string;
  name: string;
  description?: string;
  fields?: ApiField[];
};

type ApiField = {
  id?: string;
  farm_id: string;
  user_id?: string;
  name: string;
  crop_type?: string | null;
  variety?: string | null;
  planting_date?: string | null;
  area_ha?: number | null;
  boundaries?: [number, number][] | null;
  latitude: number;
  longitude: number;
};

function toLocation(field: ApiField): Location {
  return {
    id: field.id,
    farm_id: field.farm_id,
    name: field.name,
    lat: Number(field.latitude),
    lng: Number(field.longitude),
    cultura: field.crop_type ?? undefined,
    variedade: field.variety ?? undefined,
    dataPlantio: field.planting_date ?? undefined,
    areaHa: field.area_ha != null ? Number(field.area_ha) : undefined,
    boundaries: Array.isArray(field.boundaries)
      ? field.boundaries.map((point) => [Number(point[0]), Number(point[1])] as [number, number])
      : undefined,
  };
}

function toApiField(field: Partial<Location>): Partial<ApiField> {
  return {
    id: field.id,
    farm_id: field.farm_id,
    name: field.name,
    crop_type: field.cultura ?? null,
    variety: field.variedade ?? null,
    planting_date: field.dataPlantio ?? null,
    area_ha: field.areaHa ?? null,
    boundaries: field.boundaries ?? null,
    latitude: field.lat,
    longitude: field.lng,
  };
}

export const farmService = {
  getFarms: async (): Promise<Farm[]> => {
    const response = await apiFetch<{ farms: ApiFarm[] }>('/api/farms');
    return response.farms.map((farm) => ({
      ...farm,
      fields: Array.isArray(farm.fields) ? farm.fields.map(toLocation) : [],
    }));
  },

  bootstrapFarm: async (): Promise<Farm> => {
    const farm = await apiFetch<ApiFarm>('/api/farms/bootstrap', {
      method: 'POST',
    });
    return {
      ...farm,
      fields: Array.isArray(farm.fields) ? farm.fields.map(toLocation) : [],
    };
  },

  saveFarm: async (farm: Partial<Farm>): Promise<Farm> => {
    const isUpdate = !!farm.id;
    const method = isUpdate ? 'PUT' : 'POST';
    const path = isUpdate ? `/api/farms/${farm.id}` : '/api/farms';

    const response = await apiFetch<ApiFarm>(path, {
      method,
      body: JSON.stringify(farm),
    });

    return {
      ...response,
      fields: Array.isArray(response.fields) ? response.fields.map(toLocation) : [],
    };
  },

  save_farm: async (farm: Partial<Farm>): Promise<Farm> => {
    return farmService.saveFarm(farm);
  },

  deleteFarm: async (farmId: string): Promise<boolean> => {
    const response = await apiFetch<{ success: boolean }>(`/api/farms/${farmId}`, {
      method: 'DELETE',
    });
    return response.success;
  },

  getFields: async (farmId?: string): Promise<Location[]> => {
    const query = new URLSearchParams();
    if (farmId) query.append('farm_id', farmId);

    const path = query.toString() ? `/api/fields?${query.toString()}` : '/api/fields';
    const response = await apiFetch<{ fields: ApiField[] }>(path);
    return response.fields.map(toLocation);
  },

  saveField: async (field: Partial<Location>): Promise<Location> => {
    const isUpdate = !!field.id;
    const method = isUpdate ? 'PUT' : 'POST';
    const path = isUpdate ? `/api/fields/${field.id}` : '/api/fields';

    const response = await apiFetch<ApiField>(path, {
      method,
      body: JSON.stringify(toApiField(field)),
    });

    return toLocation(response);
  },

  deleteField: async (fieldId: string): Promise<boolean> => {
    const response = await apiFetch<{ success: boolean }>(`/api/fields/${fieldId}`, {
      method: 'DELETE',
    });
    return response.success;
  },
};

```


### `src/services/supabase.ts`
```ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const isValidUrl = supabaseUrl && supabaseUrl.startsWith('https://');

if (!isValidUrl || !supabaseAnonKey) {
  console.warn('[Supabase] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY inválidas ou ausentes no .env');
}

export const supabase = createClient(
  isValidUrl ? supabaseUrl : 'https://placeholder.supabase.co',
  supabaseAnonKey && supabaseAnonKey.length > 10 ? supabaseAnonKey : 'placeholder',
  {
    auth: {
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

```


### `src/store/useAppStore.ts`
```ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { supabase } from '../services/supabase';
import { apiFetch } from '../services/api';
import { type LocationStatus, fetchCurrentLocation } from '../utils/geolocation';

export interface Entitlements {
  max_fields: number;
  can_use_whatsapp: boolean;
  can_use_push: boolean;
}

export interface Location {
  id?: string;
  lat: number;
  lng: number;
  name?: string;
  boundaries?: [number, number][];
  cultura?: string;
  dataPlantio?: string;
  variedade?: string;
  areaHa?: number;
  farm_id?: string;
}

export interface Farm {
  id: string;
  name: string;
  description?: string;
  fields: Location[];
}

export type MapLayer = 'satellite' | 'ndvi' | 'moisture';

export interface Alert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: number;
  dismissed: boolean;
  field?: string;
  value?: string;
  valueLabel?: string;
}

export interface WeatherCache {
  lat: number;
  lng: number;
  fetchedAt: number;
  temperature: number;
  windSpeed: number;
  humidity: number;
  weatherCode: number;
  daily: {
    time: string[];
    tempMax: number[];
    tempMin: number[];
    precipSum: number[];
    et0: number[];
  };
  hourly: {
    time: string[];
    temp: number[];
    humidity: number[];
    precip: number[];
    windSpeed: number[];
    visibility: number[];
  };
}

// ── Funções centralizadas de mapeamento (OBRIGATÓRIO — não mapear manualmente) ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDbToField(row: any): Location {
  return {
    id: row.id,
    farm_id: row.farm_id,
    name: row.name,
    lat: Number(row.latitude),
    lng: Number(row.longitude),
    cultura: row.crop_type ?? undefined,
    variedade: row.variety ?? undefined,
    dataPlantio: row.planting_date ?? undefined,
    areaHa: row.area_ha != null ? Number(row.area_ha) : undefined,
    boundaries: Array.isArray(row.boundaries)
      ? row.boundaries.map((p: [number, number]) => [Number(p[0]), Number(p[1])] as [number, number])
      : undefined,
  };
}

function mapFieldToDb(field: Omit<Location, 'id'> & { farm_id: string; user_id: string }) {
  return {
    farm_id: field.farm_id,
    user_id: field.user_id,
    name: field.name ?? 'Talhão',
    latitude: field.lat,
    longitude: field.lng,
    crop_type: field.cultura ?? null,
    variety: field.variedade ?? null,
    planting_date: field.dataPlantio ?? null,
    area_ha: field.areaHa ?? null,
    boundaries: field.boundaries ?? null,
  };
}

// ── State Interface ───────────────────────────────────────────────────────────

interface AppState {
  farms: Farm[];
  fields: Location[];
  chatHistory: { role: 'user' | 'model'; text: string }[];
  alerts: Alert[];
  weatherCache: WeatherCache | null;
  activeFarmId: string | null;
  activeFieldId: string | null;
  activeMapLayer: MapLayer;
  currentLocation: Location | null;
  locationStatus: LocationStatus;
  isSyncing: boolean;
  syncError: string | null;
  entitlements: Entitlements | null;

  setFarms: (farms: Farm[]) => void;
  setActiveFarm: (id: string | null) => void;
  setActiveField: (id: string | null) => void;
  setMapLayer: (layer: MapLayer) => void;
  setCurrentLocation: (loc: Location | null) => void;
  setLocationStatus: (status: LocationStatus) => void;
  updateGeolocation: () => Promise<void>;
  addFarm: (farm: Farm) => void;
  syncFields: () => Promise<void>;
  createField: (farmId: string, field: Omit<Location, 'id'>) => Promise<void>;
  removeField: (farmId: string, fieldId: string) => Promise<void>;
  addMessage: (role: 'user' | 'model', text: string) => void;
  clearChat: () => void;
  setAlerts: (alerts: Alert[]) => void;
  dismissAlert: (id: string) => void;
  setWeatherCache: (cache: WeatherCache) => void;
  fetchEntitlements: () => Promise<void>;
  syncFromBackend: () => Promise<void>;
  resetStore: () => void;
}

const MAX_CHAT_HISTORY = 100;

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      farms: [],
      fields: [],
      chatHistory: [],
      alerts: [],
      weatherCache: null,
      activeFarmId: null,
      activeFieldId: null,
      activeMapLayer: 'satellite',
      currentLocation: null,
      locationStatus: 'loading',
      isSyncing: false,
      syncError: null,
      entitlements: null,

      setFarms: (farms) => {
        set({ farms });
      },

      setActiveFarm: (id) =>
        set({
          activeFarmId: id,
          activeFieldId: null,
        }),

      setActiveField: (id) => set({ activeFieldId: id }),
      setMapLayer: (layer) => set({ activeMapLayer: layer }),
      setCurrentLocation: (loc) => set({ currentLocation: loc }),
      setLocationStatus: (status) => set({ locationStatus: status }),

      updateGeolocation: async () => {
        set({ locationStatus: 'loading' });
        const res = await fetchCurrentLocation();
        set({
          currentLocation: { lat: res.lat, lng: res.lng, name: res.name },
          locationStatus: res.status,
        });
      },

      addFarm: (farm) =>
        set((state) => ({
          farms: [...state.farms, farm],
          activeFarmId: state.activeFarmId || farm.id,
        })),

      // ── syncFields: fonte única de verdade via Supabase ──────────────────────
      syncFields: async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.warn('[Store] syncFields: usuário não autenticado.');
          return;
        }

        const { data, error } = await supabase
          .from('fields')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('[Store] Erro ao sincronizar talhões:', error);
          throw error;
        }

        const mappedFields = (data ?? []).map(mapDbToField);
        set({ fields: mappedFields });
      },

      // ── createField: insert no Supabase com validações obrigatórias ──────────
      createField: async (farmId, fieldData) => {
        // Validação obrigatória antes de qualquer operação
        if (!farmId) {
          throw new Error('Nenhuma fazenda ativa selecionada. Operação cancelada.');
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('Usuário não autenticado. Faça login novamente.');
        }

        const dbPayload = mapFieldToDb({
          ...fieldData,
          farm_id: farmId,
          user_id: user.id,
        });

        const { data: newField, error } = await supabase
          .from('fields')
          .insert(dbPayload)
          .select()
          .single();

        if (error) {
          console.error('[Store] Erro ao criar talhão:', error);
          throw error;
        }

        // Atualizar o estado local APENAS com a resposta confirmada do banco
        const mapped = mapDbToField(newField);
        set((state) => ({ fields: [...state.fields, mapped] }));
      },

      // ── removeField: delete no Supabase + garantia de consistência ───────────
      removeField: async (_farmId, fieldId) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('Usuário não autenticado.');
        }

        const { error } = await supabase
          .from('fields')
          .delete()
          .eq('id', fieldId)
          .eq('user_id', user.id); // garantia de ownership

        if (error) {
          console.error('[Store] Erro ao remover talhão:', error);
          throw error;
        }

        // Otimista: remover do estado local imediatamente
        set((state) => ({
          fields: state.fields.filter((f) => f.id !== fieldId),
          activeFieldId: state.activeFieldId === fieldId ? null : state.activeFieldId,
        }));

        // Garantia de consistência pós-delete
        await get().syncFields();
      },

      addMessage: (role, text) =>
        set((state) => ({
          chatHistory: [...state.chatHistory, { role, text }].slice(-MAX_CHAT_HISTORY),
        })),

      clearChat: () => set({ chatHistory: [] }),
      setAlerts: (alerts) => set({ alerts }),

      dismissAlert: (id) =>
        set((state) => ({
          alerts: state.alerts.map((a) => (a.id === id ? { ...a, dismissed: true } : a)),
        })),

      setWeatherCache: (cache) => set({ weatherCache: cache }),

      fetchEntitlements: async () => {
        try {
          const ent = await apiFetch<Entitlements>('/api/billing/entitlements');
          set({ entitlements: ent });
        } catch (e) {
          console.error('[Store] Erro ao buscar entitlements', e);
        }
      },

      syncFromBackend: async () => {
        set({ isSyncing: true, syncError: null });
        try {
          await get().fetchEntitlements();

          // Sincronizar fazendas via API (autenticação via JWT)
          const { farmService } = await import('../services/farm_service');
          await farmService.bootstrapFarm();

          const farms = await farmService.getFarms();
          set({
            farms,
            activeFarmId: (() => {
              const currentActiveId = get().activeFarmId;
              const firstFarmId = farms.length > 0 ? farms[0].id : null;
              return currentActiveId && farms.find((f) => f.id === currentActiveId)
                ? currentActiveId
                : firstFarmId;
            })(),
          });

          // Sincronizar talhões via Supabase (fonte única de verdade)
          await get().syncFields();
        } catch (error) {
          console.error('[Store] Erro ao sincronizar:', error);
          set({ syncError: 'Ocorreu um erro ao carregar seus talhões.' });
        } finally {
          set({ isSyncing: false });
        }
      },

      resetStore: () =>
        set({
          farms: [],
          fields: [],
          chatHistory: [],
          alerts: [],
          weatherCache: null,
          activeFarmId: null,
          activeFieldId: null,
          currentLocation: null,
          locationStatus: 'loading',
          syncError: null,
          isSyncing: false,
          entitlements: null,
        }),
    }),
    {
      name: 'tracto-app-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeFarmId: state.activeFarmId,
        activeFieldId: state.activeFieldId,
        activeMapLayer: state.activeMapLayer,
        currentLocation: state.currentLocation,
        locationStatus: state.locationStatus,
        // fields NÃO é persistido — vem sempre do Supabase via syncFields()
      }),
    }
  )
);

export default useAppStore;

```


### `src/utils/geo.ts`
```ts
/**
 * Calcula a área de um polígono em hectares usando a fórmula de Shoelace,
 * projetando as coordenadas esféricas (lat/long) para o plano.
 *
 * @param boundaries Array de coordenadas [latitude, longitude].
 * @returns A área em hectares (ha), ou 0 se o polígono for inválido.
 */
export function polygonAreaHa(boundaries: [number, number][]): number {
  if (boundaries.length < 3) return 0;
  const R = 6371000; // Raio da Terra em metros
  let area = 0;
  for (let i = 0; i < boundaries.length; i++) {
    const [lat1, lon1] = boundaries[i];
    const [lat2, lon2] = boundaries[(i + 1) % boundaries.length];
    // Projeção equiretangular simplificada
    const x1 = (lon1 * Math.PI / 180) * R * Math.cos((lat1 * Math.PI / 180));
    const y1 = lat1 * Math.PI / 180 * R;
    const x2 = (lon2 * Math.PI / 180) * R * Math.cos((lat2 * Math.PI / 180));
    const y2 = lat2 * Math.PI / 180 * R;
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2) / 10_000; // m² → ha
}

```


### `src/utils/geolocation.ts`
```ts

export type LocationStatus = 'precise' | 'fallback' | 'denied' | 'unavailable' | 'loading';

export interface GeolocationResult {
  lat: number;
  lng: number;
  name: string;
  status: LocationStatus;
}

const FALLBACK_LOCATION: GeolocationResult = {
  lat: -18.9188,
  lng: -48.2768,
  name: 'Uberlândia, MG',
  status: 'fallback'
};

export async function fetchCurrentLocation(): Promise<GeolocationResult> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ ...FALLBACK_LOCATION, status: 'unavailable' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
          );
          const data = await res.json();
          const city =
            data.address?.city ||
            data.address?.town ||
            data.address?.village ||
            'Localização Atual';
          
          const state = data.address?.state_code?.toUpperCase() || data.address?.state || '';
          
          resolve({ 
            lat, 
            lng: lon, 
            name: `${city}${state ? `, ${state}` : ''}`, 
            status: 'precise' 
          });
        } catch {
          resolve({ lat, lng: lon, name: 'Localização Atual', status: 'precise' });
        }
      },
      (error) => {
        console.warn('[Geolocation] Error:', error);
        if (error.code === error.PERMISSION_DENIED) {
          resolve({ ...FALLBACK_LOCATION, status: 'denied' });
        } else {
          resolve({ ...FALLBACK_LOCATION, status: 'unavailable' });
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  });
}

export function isFallbackLocation(lat: number, lng: number): boolean {
  return Math.abs(lat - FALLBACK_LOCATION.lat) < 0.0001 && Math.abs(lng - FALLBACK_LOCATION.lng) < 0.0001;
}

```


### `tracto-backend/check_supabase.py`
```py
import os
import requests
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY")

if not url or not key:
    print("Error: SUPABASE_URL or SUPABASE_SERVICE_KEY not found in .env")
    exit(1)

headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}"
}

print(f"Checking Supabase project: {url}")

# Check root to see schema
try:
    response = requests.get(f"{url.rstrip('/')}/rest/v1/", headers=headers)
    if response.status_code == 200:
        data = response.json()
        definitions = data.get("definitions", {})
        print("\nAvailable tables/definitions:")
        for table in definitions.keys():
            print(f"- {table}")
    else:
        print(f"Error checking schema: {response.status_code}")
        print(response.text)
except Exception as e:
    print(f"Exception checking schema: {e}")

# Check specific tables
tables = ["conversations", "farms", "fields", "subscriptions", "whatsapp_contacts", "push_subscriptions"]
print("\nChecking specific tables:")
for table in tables:
    try:
        r = requests.get(f"{url.rstrip('/')}/rest/v1/{table}?limit=1", headers=headers)
        print(f"Table '{table}': {r.status_code}")
        if r.status_code != 200:
            print(f"  Detail: {r.text}")
    except Exception as e:
        print(f"  Exception checking '{table}': {e}")

```


### `tracto-backend/drop_limit_trigger.py`
```py
import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_SERVICE_KEY")

if not url or not key:
    print("Erro: SUPABASE_URL ou SUPABASE_SERVICE_KEY não encontrados.")
    exit(1)

supabase = create_client(url, key)

# Raw SQL execution via RPC is not always available.
# We'll try to run a simple update or just output the instruction if rpc fails.
# Actually, the user asked to INCLUDE the operational action. 
# Since I can't run raw SQL DROP TRIGGER via the standard client safely without a custom function,
# I will provide the script and also comment it in the schema.
# But Wait! I can try to use postgres directly if available, or just declare it done in the plan if the user accepts it.
# better: I will use a python script that tries to execute it if there's an 'exec_sql' RPC.

sql = "DROP TRIGGER IF EXISTS enforce_field_entitlement ON public.fields;"
print(f"Executando SQL operacional: {sql}")

try:
    # Try common 'exec_sql' or 'run_sql' RPC if exists
    res = supabase.rpc("exec_sql", {"sql_query": sql}).execute()
    print("Sucesso ao executar via RPC!")
except Exception as e:
    print(f"Nota: RPC 'exec_sql' não disponível ou falhou ({e}). O trigger deve ser removido manualmente no console do Supabase ou via migração.")

```


### `tracto-backend/main.py`
```py
import json
import logging
import os
from datetime import datetime

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import time
import uuid

from models import (
    AlertRequest,
    ChatRequest,
    FieldAnalysisRequest,
    FieldAnalysisResponse,
    RecaptchaRequest,
    SaveConversationRequest,
    FarmBase,
    FarmCreate,
    FarmUpdate,
    FieldBase,
    FieldCreate,
    FieldUpdate,
    CheckoutRequest,
    PushSubscriptionCreate,
    WhatsAppWebhookPayload,
)
from services import supabase_service, farm_service
from services.billing_service import billing_service
from services.ai_service import MODEL, _get_client, analyze_ndvi_image, analyze_weather_map, generate_alerts_claude, generate_chat_response
from services.auth_service import AuthenticatedUser, get_unverified_user_id_from_header, get_current_user
from services.cache_service import analysis_cache
from services.sentinel_service import get_ndvi_image
from services.weather_service import extract_weather_snapshot, fetch_weather_snapshot
from services.agronomic_engine import AgronomicEngine

load_dotenv()

# --- Security & Rate Limiting ---

# --- Security & Rate Limiting ---

# O limitador usa IP (get_remote_address) como chave primária para governança econômica.
# A identidade do usuário (context_user_id) é usada apenas para contexto em logs.
limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="Tracto API", description="O motor da plataforma Tracto", version="2.2.1")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- Structured Logging Middleware ---
@app.middleware("http")
async def structured_log_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())
    start_time = time.time()
    
    # Extração leve do sub_claim para contexto (nao confiavel ate verificado pelo auth_service)
    unverified_uid = get_unverified_user_id_from_header(request.headers.get("Authorization")) or "anonymous"

    response = await call_next(request)
    
    duration = time.time() - start_time
    log_data = {
        "request_id": request_id,
        "context_user_id": unverified_uid, # Nomeado explicitamente como contexto
        "method": request.method,
        "path": request.url.path,
        "status_code": response.status_code,
        "duration_ms": int(duration * 1000),
        "timestamp": datetime.now().isoformat(),
        "ip": get_remote_address(request)
    }
    logging.info(json.dumps(log_data))
    
    response.headers["X-Request-ID"] = request_id
    return response


origins = [
    "https://tracto-eta.vercel.app",       # seu domínio Vercel
    "http://localhost:5173",            # dev local
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/")
def health_check():
    return {"status": "Tracto backend online", "version": "2.1.0"}

# --- Stage 3: Commercial, Push & WhatsApp ---

@app.get("/api/billing/entitlements")
async def get_entitlements(user: AuthenticatedUser = Depends(get_current_user)):
    return billing_service.get_entitlements(user.id)

@app.post("/api/billing/checkout")
async def create_checkout(req: CheckoutRequest, user: AuthenticatedUser = Depends(get_current_user)):
    # MOCK ESTRUTURAL: Nenhum gateway real está conectado (Stripe/Asaas).
    if req.plan_id not in ["pro", "premium"]:
        raise HTTPException(status_code=400, detail="Plano invalido")
    
    return {
        "checkout_url": "https://sandbox.gateway.com/pay/mock_123",
        "message": f"MOCK: Checkout do plano {req.plan_id} via {req.payment_method}. Pagamento não efetuado na realidade."
    }

@app.post("/api/push/subscribe")
async def push_subscribe(req: PushSubscriptionCreate, user: AuthenticatedUser = Depends(get_current_user)):
    # Insere na nova tabela push_subscriptions
    billing_service.supabase.table("push_subscriptions").upsert({
        "user_id": user.id,
        "endpoint": req.endpoint,
        "p256dh": req.p256dh,
        "auth": req.auth
    }).execute()
    return {"status": "ok", "message": "Inscricao de push salva com sucesso na base de dados."}

@app.post("/webhooks/whatsapp")
async def whatsapp_webhook(request: Request):
    # Base estrutural para recebimento via Twilio / Meta API
    # Twilio envia via form-urlencoded
    form_data = await request.form()
    phone = form_data.get("From", "")
    body = form_data.get("Body", "")
    
    if not phone:
        return {"status": "ignored", "reason": "No sender phone number"}
        
    # Consultar o user_id pelo telefone
    contact_res = billing_service.supabase.table("whatsapp_contacts").select("user_id").eq("phone_number", phone).execute()
    if not contact_res.data:
        return {"status": "ok", "message": "Telefone nao registrado na Tracto. Resposta automatica ignorada."}
        
    user_id = contact_res.data[0]["user_id"]
    
    # Buscar contexto agronômico do usuário
    farms_res = billing_service.supabase.table("farms").select("id, name").eq("user_id", user_id).execute()
    farm_context = f"Fazendas do produtor: {[f['name'] for f in (farms_res.data or [])]}"
    
    # Repassar para ai_service passando o contexto
    # Neste mock completo, a resposta seria enviada de volta à API do WhatsApp/Twilio
    try:
        reply = generate_chat_response(
            message=body,
            context=f"Origem: WhatsApp. {farm_context}. Responda de forma concisa como Tracto AI via WhatsApp.",
            history=[]
        )
    except Exception as e:
        reply = f"Erro na Tracto AI: {str(e)}"
    # MOCK ESTRUTURAL DE SAÍDA:
    # A Tracto AI roda perfeitamente o contexto, mas a resposta NÃO é devolvida
    # pois não temos a API do WhatsApp/Twilio configurada e tokenizada.
    # O despache morre em um logger seguro.
    print(f"[WHATSAPP OUT] (MOCK DE ENVIO) Para: {phone} | Msg: {reply}")
    return {"status": "ok", "message": "Recebido e processado no backend Tracto AI. Retorno para Meta bloqueado intencionalmente (Sem Provedor)."}

# --- /Stage 3 ---



def _get_mock_weather(_: float, __: float) -> dict:
    return {
        "temperature": 28.0,
        "humidity": 60.0,
        "wind_speed": 12.0,
        "rain_accumulation": 0.0,
        "condition": "Fallback local",
        "forecast_7d": None,
    }


def _get_season() -> str:
    month = datetime.now().month
    if month in (12, 1, 2):
        return "Verao (Sul/Sudeste BR)"
    if month in (3, 4, 5):
        return "Outono (Sul/Sudeste BR)"
    if month in (6, 7, 8):
        return "Inverno (Sul/Sudeste BR)"
    return "Primavera (Sul/Sudeste BR)"


def _build_weather_summary(weather_data: dict, season: str, now_str: str) -> str:
    return (
        f"Temp: {weather_data['temperature']}C, "
        f"Umidade: {weather_data['humidity']}%, "
        f"Vento: {weather_data['wind_speed']}km/h, "
        f"Chuva acumulada: {weather_data['rain_accumulation']}mm - "
        f"Estacao: {season} - {now_str}"
    )


def _build_report_prompt(
    request: FieldAnalysisRequest,
    now_str: str,
    season: str,
    weather_summary: str,
    forecast_str: str,
    ndvi_analysis: dict | None,
) -> str:
    hourly_str = json.dumps(request.hourly_weather, ensure_ascii=False) if request.hourly_weather else "Nao fornecido"
    ndvi_str = json.dumps(ndvi_analysis, ensure_ascii=False) if ndvi_analysis else "Sem dados de satelite"

    return f"""Escreva um relatorio agronomico tecnico em 3 paragrafos sobre o talhao "{request.field_name}" (Cultura: {request.crop_type}).

Data/Hora: {now_str} | Estacao: {season}
Clima atual: {weather_summary}
Dados climaticos horarios (48h): {hourly_str}
Previsao 7 dias: {forecast_str}
Analise NDVI por satelite: {ndvi_str}

Inclua obrigatoriamente:
1. Estado atual da lavoura (NDVI + clima)
2. Janela de pulverizacao segura
3. Risco de geada e deficit hidrico
4. Recomendacao pratica de irrigacao"""


def _is_production() -> bool:
    return os.getenv("ENVIRONMENT", "development").strip().lower() == "production"


@app.post("/api/chat")
@limiter.limit("5/minute")
async def chat_endpoint(request: ChatRequest, _request: Request, _user: AuthenticatedUser = Depends(get_current_user)):
    try:
        if not request.messages:
            raise HTTPException(status_code=400, detail="O historico de mensagens esta vazio.")

        reply = generate_chat_response(
            messages=[message.model_dump() for message in request.messages],
            farm_context=request.farm_context,
            image_base64=request.image_base64,
            image_mime_type=request.image_mime_type or "image/jpeg",
            hourly_weather=request.hourly_weather,
        )
        return {"reply": reply}
    except HTTPException:
        raise
    except Exception as exc:
        logging.error("Erro no chat: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao processar o chat.") from exc


@app.post("/api/analyze-weather-map")
async def analyze_weather_map_endpoint(request: dict, _user: AuthenticatedUser = Depends(get_current_user)):
    try:
        analysis = analyze_weather_map(
            image_base64=request.get("image_base64", ""),
            weather_data=request.get("weather_data", {}),
            field_locations=request.get("field_locations", []),
            image_mime_type=request.get("image_mime_type", "image/png"),
        )
        return {"analysis": analysis}
    except HTTPException:
        raise
    except Exception as exc:
        logging.error("Erro na analise do mapa climatico: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao analisar o mapa climatico.") from exc


@app.post("/api/analyze-field", response_model=FieldAnalysisResponse)
@limiter.limit("3/minute")
async def analyze_field_endpoint(request: FieldAnalysisRequest, _request: Request, _user: AuthenticatedUser = Depends(get_current_user)):
    try:
        effective_crop_type = request.crop_type or "Não informada"
        # Cache key based on location, crop and current date (24h validity semantic)
        date_str = datetime.now().strftime("%Y%m%d")
        cache_key = f"{request.lat:.4f}_{request.lng:.4f}_{effective_crop_type}_{date_str}"
        cached_result = analysis_cache.get(cache_key)

        if cached_result:
            data = cached_result.copy()
            data["cached"] = True
            return FieldAnalysisResponse(**data)

        is_mock_weather = False
        weather_data = extract_weather_snapshot(request.hourly_weather, request.forecast_7d)
        if not weather_data:
            weather_data = await fetch_weather_snapshot(request.lat, request.lng)
        if not weather_data:
            weather_data = _get_mock_weather(request.lat, request.lng)
            is_mock_weather = True

        season = _get_season()
        now_str = datetime.now().strftime("%d/%m/%Y %H:%M")
        weather_summary = _build_weather_summary(weather_data, season, now_str)
        forecast_str = request.forecast_7d or weather_data.get("forecast_7d") or season

        sentinel_data = get_ndvi_image(request.lat, request.lng, request.boundaries, request.date_range_days)

        ndvi_analysis = None
        image_base64 = None
        date_acquired = None
        cloud_coverage = None
        stats = None

        if sentinel_data:
            image_base64 = sentinel_data["image_base64"]
            date_acquired = sentinel_data["date_acquired"]
            cloud_coverage = sentinel_data["cloud_coverage"]
            stats = sentinel_data.get("stats")
            
        # Deterministic Rules Engine
        engine = AgronomicEngine()
        spray_window = engine.calculate_spray_window(
            weather_data["temperature"], 
            weather_data["humidity"], 
            weather_data["wind_speed"]
        )
        frost_risk = engine.calculate_frost_risk(weather_data["temperature"], effective_crop_type)
        water_stress = engine.calculate_water_stress(
            weather_data["rain_accumulation"], 
            weather_data["temperature"], 
            effective_crop_type,
            weather_data.get("et0")
        )
        confidence = engine.calculate_confidence(
            sat_data=sentinel_data is not None,
            weather_data=not is_mock_weather,
            boundaries_data=request.boundaries is not None and len(request.boundaries) >= 3
        )

        engine_results = {
            "spray_window": spray_window,
            "frost_risk": frost_risk,
            "water_stress": water_stress,
            "confidence": confidence
        }

        if sentinel_data:
            ndvi_analysis = analyze_ndvi_image(
                image_base64=image_base64,
                field_name=request.field_name,
                crop_type=effective_crop_type,
                weather_context=weather_summary,
                hourly_weather=request.hourly_weather,
                forecast_7d=forecast_str,
                ndvi_stats=stats,
                engine_results=engine_results
            )

        class AlertLike:
            temperature = weather_data["temperature"]
            humidity = weather_data["humidity"]
            rain_accumulation = weather_data["rain_accumulation"]
            wind_speed = weather_data["wind_speed"]
            crop_type = effective_crop_type
            et0 = weather_data.get("et0")
            fields = [{"name": request.field_name, "crop": request.crop_type, "lat": request.lat, "lng": request.lng}]
            weather_forecast = forecast_str
            engine_results = [engine_results]

        alerts = generate_alerts_claude(AlertLike(), {request.field_name: ndvi_analysis} if ndvi_analysis else {})

        try:
            client = _get_client()
            response = client.messages.create(
                model=MODEL,
                max_tokens=800,
                temperature=0.3,
                messages=[{"role": "user", "content": _build_report_prompt(request, now_str, season, weather_summary, forecast_str, ndvi_analysis)}],
            )
            ai_report = response.content[0].text
        except Exception as exc:
            logging.error("Erro ao gerar relatorio de IA: %s", exc)
            ai_report = "Relatorio nao disponivel no momento."

        result = {
            "field_name": request.field_name,
            "ndvi_image_base64": image_base64,
            "date_acquired": date_acquired,
            "cloud_coverage": cloud_coverage,
            "ndvi_analysis": ndvi_analysis or {},
            "weather_summary": weather_summary,
            "ai_report": ai_report,
            "alerts": alerts,
            "analyzed_at": datetime.now().isoformat(),
            "cached": False,
            "is_mock": is_mock_weather,
            "confidence": confidence,
            "engine_results": engine_results,
            "source": "Sentinel-2 L2A + Open-Meteo" if not is_mock_weather else "Sentinel-2 (Simulado) + Fallback"
        }

        analysis_cache.set(cache_key, result, ttl_hours=24)
        return FieldAnalysisResponse(**result)
    except HTTPException:
        raise
    except Exception as exc:
        logging.error("Erro na analise do talhao: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao analisar o talhao.") from exc


@app.post("/api/alerts")
async def alerts_endpoint(request: AlertRequest, _user: AuthenticatedUser = Depends(get_current_user)):
    """
    Gera alertas agronomicos considerando multi-talhao e multi-cultura.
    Usa o engine deterministico para cada talhao.
    """
    try:
        engine = AgronomicEngine()
        fields_context = []
        
        # Se nao houver campos, usamos os dados genéricos da request
        if not request.fields:
        # Fallback para dados globais da fazenda na request
            et0_global = getattr(request, 'et0', None)
            engine_res = {
                "spray_window": engine.calculate_spray_window(request.temperature, request.humidity, request.wind_speed),
                "frost_risk": engine.calculate_frost_risk(request.temperature, request.crop_type),
                "water_stress": engine.calculate_water_stress(request.rain_accumulation, request.temperature, request.crop_type, et0_global),
                "confidence": 0.5
            }
            request.engine_results = [engine_res]
        else:
            # Processar cada talhao individualmente para verdade agronomica
            date_str = datetime.now().strftime("%Y%m%d")
            for f in request.fields:
                lat = f.get("lat")
                lng = f.get("lng")
                item_crop = f.get("crop") or request.crop_type or "Não informada"
                et0_field = getattr(request, 'et0', None)
                
                engine_res = {
                    "field_name": f.get("name"),
                    "spray_window": engine.calculate_spray_window(request.temperature, request.humidity, request.wind_speed),
                    "frost_risk": engine.calculate_frost_risk(request.temperature, item_crop),
                    "water_stress": engine.calculate_water_stress(request.rain_accumulation, request.temperature, item_crop, et0_field),
                    "confidence": 0.7 if f.get("boundaries") else 0.5
                }
                fields_context.append(engine_res)
            
            # Adicionamos ao objeto request para que generate_alerts_claude o receba
            request.engine_results = fields_context

        # Busca analise NDVI recente (cache) para TODOS os talhoes
        ndvi_analyses = {}
        if request.fields:
            date_str = datetime.now().strftime("%Y%m%d")
            for field in request.fields:
                if "lat" in field and "lng" in field:
                    item_crop = field.get("crop") or request.crop_type or "Não informada"
                    cache_key = f"{field['lat']:.4f}_{field['lng']:.4f}_{item_crop}_{date_str}"
                    cached = analysis_cache.get(cache_key)
                    if cached and cached.get("ndvi_analysis"):
                        ndvi_analyses[field.get("name", "Desconhecido")] = cached.get("ndvi_analysis")

        alerts = generate_alerts_claude(request, ndvi_analyses)
        return {"alerts": alerts}
    except HTTPException:
        raise
    except Exception as exc:
        logging.error("Erro ao gerar alertas: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao gerar alertas agronomicos.") from exc


@app.post("/api/conversations/save")
async def save_conversation_endpoint(
    request: SaveConversationRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    try:
        return supabase_service.save_conversation(
            user_id=user.id,
            conversation_id=request.conversation_id,
            title=request.title,
            messages=[message.model_dump() for message in request.messages],
            farm_context=request.farm_context,
            created_at=request.created_at,
            updated_at=request.updated_at,
        )
    except Exception as exc:
        logging.error("Erro ao salvar conversa: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao salvar conversa.") from exc


@app.get("/api/conversations")
async def get_conversations_endpoint(user: AuthenticatedUser = Depends(get_current_user)):
    try:
        return {"conversations": supabase_service.get_conversations(user.id)}
    except Exception as exc:
        logging.error("Erro ao buscar conversas: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao buscar conversas.") from exc


@app.delete("/api/conversations/{conversation_id}")
async def delete_conversation_endpoint(
    conversation_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Remove uma conversa garantindo que pertença ao usuário autenticado.
    Retorna 404 se a conversa não existir ou não pertencer ao usuário.
    """
    try:
        success = supabase_service.delete_conversation(conversation_id, user_id=user.id)
        if not success:
            raise HTTPException(status_code=404, detail="Conversa nao encontrada ou acesso negado.")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as exc:
        logging.error("Erro ao deletar conversa: %s", exc)
        raise HTTPException(status_code=500, detail="Erro interno ao deletar conversa.") from exc


# --- Farms Endpoints ---

@app.get("/api/farms")
async def get_farms_endpoint(user: AuthenticatedUser = Depends(get_current_user)):
    try:
        return {"farms": farm_service.get_farms(user.id)}
    except Exception as exc:
        logging.error("Erro ao buscar fazendas: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao buscar fazendas.") from exc

@app.post("/api/farms/bootstrap")
async def bootstrap_farm_endpoint(user: AuthenticatedUser = Depends(get_current_user)):
    """
    Endpoint explícito para garantir a criação da fazenda padrão (idempotente).
    """
    try:
        return farm_service.ensure_default_farm(user.id)
    except Exception as exc:
        logging.error("Erro no bootstrap de fazenda: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao inicializar fazenda padrao.") from exc

@app.post("/api/farms")
async def save_farm_endpoint(request: FarmCreate, user: AuthenticatedUser = Depends(get_current_user)):
    try:
        return farm_service.save_farm(user.id, request.model_dump())
    except Exception as exc:
        logging.error("Erro ao salvar fazenda: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao salvar fazenda.") from exc

@app.put("/api/farms/{farm_id}")
async def update_farm_endpoint(farm_id: str, request: FarmBase, user: AuthenticatedUser = Depends(get_current_user)):
    try:
        data = request.model_dump()
        data["id"] = farm_id
        return farm_service.save_farm(user.id, data)
    except Exception as exc:
        logging.error("Erro ao atualizar fazenda: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao atualizar fazenda.") from exc

@app.delete("/api/farms/{farm_id}")
async def delete_farm_endpoint(farm_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    try:
        return {"success": farm_service.delete_farm(farm_id, user.id)}
    except Exception as exc:
        logging.error("Erro ao deletar fazenda: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao deletar fazenda.") from exc


# --- Fields Endpoints ---

@app.get("/api/fields")
async def get_fields_endpoint(farm_id: str | None = None, user: AuthenticatedUser = Depends(get_current_user)):
    try:
        return {"fields": farm_service.get_fields(user.id, farm_id)}
    except Exception as exc:
        logging.error("Erro ao buscar talhoes: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao buscar talhoes.") from exc

@app.post("/api/fields")
async def save_field_endpoint(request: FieldCreate, user: AuthenticatedUser = Depends(get_current_user)):
    try:
        # Bloqueio HTTP Explicito (Entitlements)
        # [DESATIVADO TEMPORARIAMENTE] Limitador de plano
        # if not billing_service.check_field_limit(user.id):
        #     raise HTTPException(status_code=403, detail="Limite de talhes do seu plano atingido.")
            
        return farm_service.save_field(user.id, request.model_dump(mode='json', exclude_none=True))
    except HTTPException:
        raise
    except Exception as exc:
        # Se barrado por SQL Trigger de contingencia:
        err_msg = str(exc)
        if "Plan limit exceeded" in err_msg:
             raise HTTPException(status_code=403, detail="Limite do plano excedido (Bloqueio DB).")
             
        logging.error("Erro ao salvar talhao: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao salvar talhao.") from exc

@app.put("/api/fields/{field_id}")
async def update_field_endpoint(field_id: str, request: FieldBase, user: AuthenticatedUser = Depends(get_current_user)):
    try:
        data = request.model_dump(mode='json', exclude_none=True)
        data["id"] = field_id
        return farm_service.save_field(user.id, data)
    except Exception as exc:
        logging.error("Erro ao atualizar talhao: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao atualizar talhao.") from exc

@app.delete("/api/fields/{field_id}")
async def delete_field_endpoint(field_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    try:
        return {"success": farm_service.delete_field(field_id, user.id)}
    except Exception as exc:
        logging.error("Erro ao deletar talhao: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao deletar talhao.") from exc


@app.post("/api/verify-recaptcha")
async def verify_recaptcha(request: RecaptchaRequest):
    try:
        secret_key = os.getenv("RECAPTCHA_SECRET_KEY")
        if not secret_key:
            if _is_production():
                raise HTTPException(
                    status_code=500,
                    detail="RECAPTCHA_SECRET_KEY nao configurada em producao.",
                )
            return {"success": True, "score": 1.0}

        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                "https://www.google.com/recaptcha/api/siteverify",
                data={"secret": secret_key, "response": request.token},
            )
            data = response.json()

        success = bool(data.get("success", False))
        score = float(data.get("score", 0.0) or 0.0)
        return {"success": success and score >= 0.5, "score": score}
    except HTTPException:
        raise
    except Exception as exc:
        logging.error("Erro na verificacao do reCAPTCHA: %s", exc)
        raise HTTPException(status_code=500, detail="Erro interno na verificacao de seguranca.") from exc

```


### `tracto-backend/models.py`
```py
from typing import Any, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "model"]
    text: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    farm_context: str | None = "Fazenda sem dados especificos no momento."
    image_base64: str | None = None
    image_mime_type: str | None = "image/jpeg"
    hourly_weather: dict | None = None


class AlertRequest(BaseModel):
    temperature: float
    humidity: float
    rain_accumulation: float
    wind_speed: float
    et0: float | None = None
    crop_type: str | None = None
    fields: list[dict]
    weather_forecast: str | None = None


class FieldAnalysisRequest(BaseModel):
    field_id: str | None = None
    field_name: str
    lat: float
    lng: float
    boundaries: list[list[float]] | None = None
    crop_type: str | None = None
    planting_date: str | None = None
    variety: str | None = None
    area_ha: float | None = None
    date_range_days: int = 21
    hourly_weather: dict | None = None
    forecast_7d: str | None = None


class FieldAnalysisResponse(BaseModel):
    field_name: str
    ndvi_image_base64: str | None
    date_acquired: str | None
    cloud_coverage: float | None
    ndvi_analysis: dict[str, Any]
    weather_summary: str
    ai_report: str
    alerts: list[dict[str, Any]]
    cached: bool
    is_mock: bool = False
    analyzed_at: str
    confidence: float | None = None
    engine_results: dict[str, Any] | None = None
    source: str | None = None


class SaveConversationRequest(BaseModel):
    conversation_id: str
    title: str
    messages: list[ChatMessage]
    farm_context: str | None = None
    created_at: str
    updated_at: str


class RecaptchaRequest(BaseModel):
    token: str


class FarmBase(BaseModel):
    name: str
    description: str | None = None
    is_default: bool = False


class FarmCreate(FarmBase):
    pass


class FarmUpdate(FarmBase):
    id: str


class FieldBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    farm_id: str
    name: str
    crop_type: str | None = Field(default=None, validation_alias=AliasChoices("crop_type", "cultura"))
    variety: str | None = Field(default=None, validation_alias=AliasChoices("variety", "variedade"))
    planting_date: str | None = Field(default=None, validation_alias=AliasChoices("planting_date", "dataPlantio"))
    area_ha: float | None = Field(default=None, validation_alias=AliasChoices("area_ha", "areaHa"))
    boundaries: Any | None = None
    latitude: float = Field(validation_alias=AliasChoices("latitude", "lat"))
    longitude: float = Field(validation_alias=AliasChoices("longitude", "lng"))


class FieldCreate(FieldBase):
    pass


class FieldUpdate(FieldBase):
    id: str


class CheckoutRequest(BaseModel):
    plan_id: str
    payment_method: str = "credit_card"


class PushSubscriptionCreate(BaseModel):
    endpoint: str
    p256dh: str
    auth: str


class WhatsAppWebhookPayload(BaseModel):
    From: str
    Body: str
    ProfileName: str | None = None

```


### `tracto-backend/railway.json`
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "uvicorn main:app --host 0.0.0.0 --port $PORT",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}

```


### `tracto-backend/scripts/deduplicate_fields.py`
```py
import os
import requests
from dotenv import load_dotenv

# Carrega do backend .env
load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

def deduplicate():
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        print("Erro: SUPABASE_URL ou SUPABASE_SERVICE_KEY não encontradas no .env")
        return

    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }
    
    # 0. Debug: Buscar fazendas
    farms_url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/farms"
    f_res = requests.get(farms_url, headers=headers)
    print(f"DEBUG: Fazendas encontradas: {len(f_res.json())}")

    # 1. Buscar todos os talhões
    url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/fields?select=*"
    print(f"Buscando talhões em: {url}")
    
    res = requests.get(url, headers=headers)
    print(f"Status Code: {res.status_code}")
    fields = res.json()
    print(f"Raw Response Length: {len(fields)}")
    
    # (farm_id, name) -> id (manteremos o primeiro encontrado após ordenar por data DESC)
    seen = {} 
    to_delete = []
    
    # Ordenar por created_at decrescente (mais novos primeiro)
    # Alguns podem não ter created_at se forem legados, usamos ID como fallback
    fields.sort(key=lambda x: x.get('created_at') or x.get('id', ''), reverse=True)
    
    for f in fields:
        # Normalizamos o nome para evitar duplicados por espaços
        name_norm = f['name'].strip().lower()
        key = (f['farm_id'], name_norm)
        
        if key in seen:
            to_delete.append(f['id'])
        else:
            seen[key] = f['id']
            
    print(f"Total de talhões: {len(fields)}")
    print(f"Talhões duplicados para remover: {len(to_delete)}")
    
    for fid in to_delete:
        del_url = f"{SUPABASE_URL.rstrip('/')}/rest/v1/fields?id=eq.{fid}"
        requests.delete(del_url, headers=headers).raise_for_status()
        print(f"Removido duplicado ID: {fid}")

    print("\n--- Limpeza concluída! ---")

if __name__ == "__main__":
    deduplicate()

```


### `tracto-backend/services/agronomic_engine.py`
```py
import logging
from typing import Any, Dict, List
from datetime import datetime

class AgronomicEngine:
    """
    Engine deterministico para regras agronomicas da Tracto.
    Calcula riscos e estados com base em regras fisicas antes da IA.
    """

    @staticmethod
    def calculate_spray_window(temp: float, humidity: float, wind_speed: float) -> Dict[str, Any]:
        """
        Calcula se a janela de pulverizacao e segura.
        Regra simplificada:
        - Vento: 5-15 km/h (ideal), < 5 (deriva termica), > 15 (deriva fisica)
        - Umidade: > 50% (ideal)
        - Temperatura: < 30C (ideal)
        """
        score = 100
        reasons = []
        
        # Vento
        if wind_speed > 20:
            score -= 60
            reasons.append("Vento muito forte (>20km/h): alto risco de deriva.")
        elif wind_speed > 15:
            score -= 30
            reasons.append("Vento moderado (>15km/h): atencao a deriva.")
        elif wind_speed < 3:
            score -= 20
            reasons.append("Vento muito calmo (<3km/h): risco de inversao termica.")

        # Umidade
        if humidity < 40:
            score -= 40
            reasons.append("Umidade muito baixa (<40%): gotas evaporam antes de atingir o alvo.")
        elif humidity < 50:
            score -= 15
            reasons.append("Umidade marginal (40-50%).")

        # Temperatura
        if temp > 32:
            score -= 40
            reasons.append("Temperatura muito alta (>32C): risco de fitotoxicidade e evaporacao.")
        elif temp > 30:
            score -= 15
            reasons.append("Temperatura elevada (>30C).")

        status = "safe" if score >= 80 else "caution" if score >= 50 else "unsafe"
        
        return {
            "status": status,
            "color": "green" if status == "safe" else "amber" if status == "caution" else "red",
            "score": max(0, score),
            "reasons": reasons,
            "label": "Seguro" if status == "safe" else "Atencao" if status == "caution" else "Inadequado"
        }

    @staticmethod
    def calculate_frost_risk(temp_min: float, crop_type: str) -> Dict[str, Any]:
        """
        Avalia o risco de geada com base na temperatura minima e sensibilidade da cultura.
        """
        # Thresholds basicos de geada meteorologica (no abrigo) vs relva
        # Se temp no abrigo e < 3C, na relva pode ser < 0C
        
        risk = "none"
        if temp_min <= 0:
            risk = "high"
        elif temp_min <= 3:
            risk = "medium"
        elif temp_min <= 5:
            risk = "low"
            
        # Sensibilidade por cultura (simplificado)
        sensitivity = "medium"
        crops_sensitive = ["Cafe", "Cana-de-açúcar", "Hortaliças", "Citros"]
        crops_hardy = ["Trigo", "Aveia"]
        
        if any(c in (crop_type or "") for c in crops_sensitive):
            sensitivity = "high"
            if risk == "low": risk = "medium"
            if risk == "medium": risk = "high"
        elif any(c in (crop_type or "") for c in crops_hardy):
            sensitivity = "low"
            if risk == "high": risk = "medium"
            if risk == "medium": risk = "low"

        return {
            "risk": risk,
            "color": "red" if risk == "high" else "amber" if risk == "medium" else "white",
            "threshold": temp_min,
            "sensitivity": sensitivity,
            "label": "Alto" if risk == "high" else "Medio" if risk == "medium" else "Baixo" if risk == "low" else "Nenhum"
        }

    @staticmethod
    def calculate_water_stress(precip_sum: float, temp_avg: float, crop_type: str, et0_mm: float | None = None) -> Dict[str, Any]:
        """
        Calcula o balanco hidrico semanal com base em ET0 real (preferencial) ou proxy (fallback).
        """
        used_proxy = False
        if et0_mm is not None:
            # weather_service ja retorna ET0 acumulada na mesma janela da precipitacao (soma 7d)
            weekly_et0 = et0_mm
        else:
            used_proxy = True
            # Proxy baseado em temperatura se ET0 real faltar
            estimated_daily_et0 = (temp_avg * 0.15) + 1.0
            weekly_et0 = estimated_daily_et0 * 7
        
        balance = precip_sum - weekly_et0
        
        if balance < -20:
            status = "critical"
            color = "red"
        elif balance < -10:
            status = "moderate"
            color = "amber"
        else:
            status = "adequate"
            color = "green"
            
        return {
            "status": status,
            "color": color,
            "balance_mm": float(f"{balance:.1f}"),
            "et0_est_mm": float(f"{weekly_et0:.1f}"),
            "precip_mm": precip_sum,
            "used_proxy": used_proxy,
            "label": "Critico" if status == "critical" else "Moderado" if status == "moderate" else "Adequado"
        }

    @staticmethod
    def calculate_confidence(sat_data: bool, weather_data: bool, boundaries_data: bool) -> float:
        """
        Calcula o nivel de confianca da analise (0..1).
        """
        score = 0
        if sat_data: score += 0.4
        if weather_data: score += 0.3
        if boundaries_data: score += 0.3
        
        return round(float(score), 2)

```


### `tracto-backend/services/ai_service.py`
```py
import json
import logging
import os
from typing import Any

import anthropic
from fastapi import HTTPException
from typing import Any, Dict, List, Optional


MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-5")
ALLOWED_ALERT_TYPES = {"critical", "warning", "info"}


def _get_client() -> anthropic.Anthropic:
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key:
        raise ValueError("ANTHROPIC_API_KEY nao configurada.")
    return anthropic.Anthropic(api_key=key)


def generate_chat_response(
    messages: List[Dict[str, Any]],
    farm_context: str,
    ndvi_context: str | None = None,
    image_base64: str | None = None,
    image_mime_type: str = "image/jpeg",
    hourly_weather: dict | None = None,
) -> str:
    client = _get_client()

    system_parts = [
        "Voce e o assistente agronomico da Tracto, plataforma de inteligencia agricola.",
        "Responda como agronomo senior: direto, tecnico e focado no lucro do produtor.",
        f"\nContexto da fazenda:\n{farm_context}",
    ]
    if ndvi_context:
        system_parts.append(f"\nAnalise NDVI recente:\n{ndvi_context}")
    if hourly_weather:
        system_parts.append(
            f"\nDados climaticos atuais:\n{json.dumps(hourly_weather, ensure_ascii=False)}"
        )

    anthropic_messages: list[dict[str, Any]] = []
    # Iterate through all but the last message
    # Use a manual loop to avoid slicing issues in the linter
    count = len(messages)
    for i in range(count - 1):
        msg = messages[i]
        role = "assistant" if msg.get("role") in ("model", "assistant") else "user"
        anthropic_messages.append({"role": role, "content": msg.get("text", "")})

    last_msg = messages[-1] if messages else None
    last_text = last_msg.get("text", "") if last_msg else ""

    if image_base64:
        last_content: Any = [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": image_mime_type,
                    "data": image_base64,
                },
            },
            {
                "type": "text",
                "text": (
                    "O produtor enviou uma foto da lavoura. Analise visualmente e identifique "
                    "pragas, doencas, deficiencias nutricionais, estadio fenologico e qualquer "
                    "problema agronomico visivel. Seja especifico e traga recomendacao pratica.\n\n"
                    f"Mensagem do produtor: {last_text}"
                ).strip(),
            },
        ]
    else:
        last_content = last_text

    anthropic_messages.append({"role": "user", "content": last_content})

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=1024,
            temperature=0.7,
            system="\n".join(system_parts),
            messages=anthropic_messages,
        )
        return response.content[0].text
    except Exception as exc:
        logging.error("Erro no chat Claude: %s", exc)
        return "Desculpe, ocorreu um erro ao processar sua mensagem."


def _clean_json_text(raw: str) -> str:
    return raw.replace("```json", "").replace("```", "").strip()


def _normalize_alerts_payload(payload: list[dict[str, Any]]) -> list[dict[str, Any]]:
    normalized: list[dict[str, Any]] = []
    for index, item in enumerate(payload):
        if not isinstance(item, dict):
            continue

        alert_type = item.get("type")
        if alert_type == "success":
            alert_type = "info"
        if alert_type not in ALLOWED_ALERT_TYPES:
            alert_type = "info"

        normalized.append(
            {
                "id": item.get("id") or f"A{index + 1:03d}",
                "type": alert_type,
                "title": item.get("title") or "Alerta agronomico",
                "message": item.get("message") or "",
                "field": item.get("field") or "",
                "value": item.get("value"),
                "valueLabel": item.get("valueLabel"),
                "createdAt": item.get("createdAt"),
            }
        )
    return normalized


def generate_alerts_claude(request, ndvi_analysis: dict | None = None) -> list[dict[str, Any]]:
    client = _get_client()

    ndvi_block = ""
    if ndvi_analysis:
        ndvi_block = f"\nAnalise NDVI por satelite:\n{json.dumps(ndvi_analysis, ensure_ascii=False)}\n"

    engine_block = ""
    if hasattr(request, "engine_results") and request.engine_results:
        engine_block = f"\nResultados Deterministicos (Truth Engine):\n{json.dumps(request.engine_results, ensure_ascii=False)}\n"

    field_crop_summary = json.dumps(
        [
            {
                "name": field.get("name"),
                "crop": field.get("crop") or "Nao informada",
                "lat": field.get("lat"),
                "lng": field.get("lng"),
            }
            for field in request.fields
        ],
        ensure_ascii=False,
    )

    prompt = f"""Atue como motor de alertas agronomicos da Tracto.
Gere entre 2 e 5 alertas relevantes com base nos dados abaixo.

{engine_block}
{ndvi_block}

Condicoes climaticas:
- Temperatura: {request.temperature}C
- Umidade: {request.humidity}%
- Precipitacao acumulada: {request.rain_accumulation}mm
- Vento: {request.wind_speed} km/h
- Cultura principal: {request.crop_type or 'Nao informada'}
- Talhoes e culturas: {field_crop_summary}
- Previsao: {request.weather_forecast or 'Nao disponivel'}

REGRAS CRITICAS:
1. Use os "Resultados Deterministicos" como fonte primária de verdade para Geada, Pulverização e Estresse.
2. A IA deve explicar e priorizar esses riscos, não inventar novos valores se os cálculos já existem.
3. Se houver culturas diferentes em talhões diferentes, gere alertas específicos por nome de talhão.
4. Distinga entre dado real (calculado) e dado simulado (se a confiança for baixa).

Responda APENAS com um array JSON valido. Nenhum texto adicional.

Cada objeto deve ter exatamente:
{{
  "id": "A001",
  "type": "critical" | "warning" | "info",
  "title": "Titulo curto",
  "message": "Detalhe da acao necessaria vinculada ao motivo real",
  "field": "Nome do talhao",
  "value": "Metrica real",
  "valueLabel": "Unidade",
  "createdAt": "ISO8601"
}}"""

    try:
        message = client.messages.create(
            model=MODEL,
            max_tokens=1200,
            temperature=0.2,
            messages=[{"role": "user", "content": prompt}],
        )
        parsed = json.loads(_clean_json_text(message.content[0].text))
        if not isinstance(parsed, list):
            raise ValueError("A IA nao retornou uma lista de alertas.")
        return _normalize_alerts_payload(parsed)
    except (json.JSONDecodeError, TypeError, ValueError) as exc:
        logging.error("JSON invalido dos alertas Claude: %s", exc)
        raise HTTPException(status_code=502, detail="IA retornou resposta invalida. Tente novamente.") from exc
    except Exception as exc:
        logging.error("Erro nos alertas Claude: %s", exc)
        raise HTTPException(status_code=502, detail=str(exc)) from exc


def analyze_ndvi_image(
    image_base64: str,
    field_name: str,
    crop_type: str,
    weather_context: str,
    hourly_weather: dict | None = None,
    forecast_7d: str | None = None,
    ndvi_stats: dict | None = None,
    engine_results: dict | None = None,
) -> dict[str, Any]:
    client = _get_client()

    stats_block = ""
    if ndvi_stats:
        stats_block = f"\nEstatisticas NDVI Deterministicas (Truth):\n{json.dumps(ndvi_stats, ensure_ascii=False)}\n"

    engine_block = ""
    if engine_results:
        engine_block = f"\nAnalise de Motor Agronomico (Regras):\n{json.dumps(engine_results, ensure_ascii=False)}\n"

    hourly_block = ""
    if hourly_weather:
        hourly_block = f"\nDados climaticos horarios (ultimas 48h):\n{json.dumps(hourly_weather, ensure_ascii=False)}\n"

    forecast_block = ""
    if forecast_7d:
        forecast_block = f"\nPrevisao dos proximos 7 dias:\n{forecast_7d}\n"

    prompt = f"""Voce e especialista em sensoriamento remoto agricola.

Analise a imagem NDVI do talhao "{field_name}" (Cultura: {crop_type}).

{stats_block}
{engine_block}

Legenda visual (para referencia):
- Cinza -> Solo exposto ou agua
- Vermelho/laranja -> Estresse critico
- Amarelo -> Atencao
- Verde claro -> Saudavel
- Verde escuro -> Excelente vigor

Contexto climatico: {weather_context}
{hourly_block}{forecast_block}

TAREFA:
1. EXPLIQUE os dados deterministicos fornecidos (NDVI medio, geada, pulverizacao). 
2. Use a imagem para CORROBORAR os numeros, mas nao invente percentuais visuais que contradigam as estatisticas.
3. Seja honesto sobre a confianca dos dados.

Retorne APENAS JSON valido:
{{
  "ndvi_medio": {ndvi_stats.get('ndvi_avg', 0) if ndvi_stats else 0.0},
  "zona_critica_pct": 0.0,
  "zona_estresse_pct": 0.0,
  "zona_saudavel_pct": 0.0,
  "zona_excelente_pct": 0.0,
  "solo_exposto_pct": 0.0,
  "problemas_detectados": ["lista baseada em regras"],
  "areas_atencao": "descricao baseada em fatos",
  "tendencia": "estavel",
  "janela_pulverizacao": "{engine_results.get('spray_window', {}).get('label', 'Nao calculada') if engine_results else 'Nao calculada'}",
  "risco_geada": "{engine_results.get('frost_risk', {}).get('label', 'Nao calculado') if engine_results else 'Nao calculado'}",
  "deficit_hidrico": "{engine_results.get('water_stress', {}).get('label', 'Nao calculado') if engine_results else 'Nao calculado'}",
  "recomendacao_irrigacao": "recomendacao pratica",
  "confianca": {engine_results.get('confidence', 0.5) if engine_results else 0.5}
}}"""

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=1500,
            temperature=0.1,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/png",
                                "data": image_base64,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        )
        return json.loads(_clean_json_text(response.content[0].text))
    except (json.JSONDecodeError, TypeError, ValueError) as exc:
        logging.error("JSON invalido da analise NDVI Claude: %s", exc)
        return _default_ndvi_response()
    except Exception as exc:
        logging.error("Erro na analise NDVI Claude: %s", exc)
        return _default_ndvi_response()


def _default_ndvi_response() -> Dict[str, Any]:
    return {
        "ndvi_medio": 0.0,
        "zona_critica_pct": 0.0,
        "zona_estresse_pct": 0.0,
        "zona_saudavel_pct": 0.0,
        "zona_excelente_pct": 0.0,
        "solo_exposto_pct": 0.0,
        "problemas_detectados": [],
        "areas_atencao": "Nao foi possivel analisar a imagem.",
        "tendencia": "estavel",
        "janela_pulverizacao": "Dados insuficientes",
        "risco_geada": "nenhum",
        "deficit_hidrico": "adequado",
        "recomendacao_irrigacao": "Monitore as condicoes e reavalie.",
        "confianca": 0.0,
    }


def analyze_weather_map(
    image_base64: str,
    weather_data: dict,
    field_locations: list,
    image_mime_type: str = "image/png",
) -> str:
    client = _get_client()

    fields_str = json.dumps(field_locations, ensure_ascii=False) if field_locations else "Sem talhoes cadastrados"
    weather_str = json.dumps(weather_data, ensure_ascii=False)

    prompt = f"""Analise este mapa meteorologico (possivelmente do Windy, Copernicus ou similar). Descreva de forma tecnica e direta:

1. Frentes e sistemas visiveis
2. Chuva e nuvens
3. Temperatura e gradientes
4. Riscos para as culturas monitoradas

Dados climaticos de referencia: {weather_str}
Talhoes monitorados: {fields_str}

Responda em portugues, em 3-4 paragrafos, e finalize com a acao recomendada ao produtor."""

    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=512,
            temperature=0.3,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": image_mime_type,
                                "data": image_base64,
                            },
                        },
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        )
        return response.content[0].text
    except Exception as exc:
        logging.error("Erro na analise do mapa climatico Claude: %s", exc)
        return "Nao foi possivel analisar o mapa climatico no momento."

```


### `tracto-backend/services/auth_service.py`
```py
import logging
import os
import json
import base64
from dataclasses import dataclass

import requests
from fastapi import Header, HTTPException, status


@dataclass
class AuthenticatedUser:
    id: str
    email: str | None = None


def get_unverified_user_id_from_header(authorization: str | None) -> str | None:
    """
    ⚠️ ALERTA DE SEGURANÇA: ESTA IDENTIDADE NÃO É VERIFICADA.
    Extrai o claim 'sub' do JWT de forma 'burra' (sem verificar assinatura).
    
    NUNCA utilize o retorno desta função para:
    1. Autorização (decidir se o usuário pode acessar algo)
    2. Ownership (atribuir ou deletar recursos)
    
    Finalidade: Apenas contexto auxiliar para logs e rate-limiting não-crítico.
    Para identidade verificada, use a dependência `get_current_user`.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None
    
    try:
        # Pega a parte após 'Bearer '
        token = authorization.split(" ")[1] if " " in authorization else authorization

        parts = token.split(".")
        if len(parts) != 3:
            return None
        
        # O payload e a segunda parte
        payload_b64 = parts[1]
        # Pad with '=' to avoid padding issues
        missing_padding = len(payload_b64) % 4
        if missing_padding:
            payload_b64 += "=" * (4 - missing_padding)
            
        payload_json = base64.b64decode(payload_b64).decode("utf-8")
        payload = json.loads(payload_json)
        return payload.get("sub")
    except Exception:
        return None


def _supabase_url() -> str:

    url = os.getenv("SUPABASE_URL")
    if not url:
        raise ValueError("SUPABASE_URL nao configurada.")
    return url.rstrip("/")


def _supabase_api_key() -> str:
    key = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_ANON_KEY")
    if not key:
        raise ValueError("SUPABASE_SERVICE_KEY ou SUPABASE_ANON_KEY nao configurada.")
    return key


def _extract_bearer_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticacao obrigatoria.",
        )

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de autenticacao invalido.",
        )
    return token.strip()


def verify_access_token(access_token: str) -> AuthenticatedUser:
    try:
        response = requests.get(
            f"{_supabase_url()}/auth/v1/user",
            headers={
                "apikey": _supabase_api_key(),
                "Authorization": f"Bearer {access_token}",
            },
            timeout=10,
        )

        if response.status_code in (401, 403):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Sessao invalida ou expirada.",
            )

        response.raise_for_status()
        payload = response.json()
        user_id = payload.get("id")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Nao foi possivel identificar o usuario autenticado.",
            )

        return AuthenticatedUser(id=user_id, email=payload.get("email"))
    except HTTPException:
        raise
    except requests.RequestException as exc:
        logging.error("Erro ao validar sessao Supabase: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Nao foi possivel validar a sessao no momento.",
        ) from exc


def get_current_user(authorization: str | None = Header(default=None)) -> AuthenticatedUser:
    token = _extract_bearer_token(authorization)
    return verify_access_token(token)

```


### `tracto-backend/services/billing_service.py`
```py
import os
from datetime import datetime
from supabase import create_client, Client

class BillingService:
    def __init__(self):
        self._supabase: Client | None = None

    @property
    def supabase(self) -> Client:
        if self._supabase is None:
            url = os.getenv("SUPABASE_URL")
            key = os.getenv("SUPABASE_SERVICE_KEY")
            if not url or not key:
                raise RuntimeError("SUPABASE_URL ou SUPABASE_SERVICE_KEY não configurados.")
            self._supabase = create_client(url, key)
        return self._supabase


    def get_user_plan(self, user_id: str) -> dict:
        result = self.supabase.table("subscriptions").select("*").eq("user_id", user_id).execute()
        if not result.data:
            return {"plan_id": "free", "status": "active"}
            
        sub = result.data[0]
        # Active or trialing -> return actual plan
        if sub["status"] in ["active", "trialing"]:
            return {"plan_id": sub["plan_id"], "status": sub["status"]}
            
        return {"plan_id": "free", "status": sub["status"]}

    def get_entitlements(self, user_id: str) -> dict:
        plan = self.get_user_plan(user_id)["plan_id"]
        
        # Free limits
        if plan == "free":
            return {
                "max_fields": 1,
                "can_use_whatsapp": False,
                "can_use_push": False
            }
            
        if plan == "pro":
            return {
                "max_fields": 9999,
                "can_use_whatsapp": True,
                "can_use_push": True
            }
            
        return {"max_fields": 1, "can_use_whatsapp": False, "can_use_push": False}

    def check_field_limit(self, user_id: str) -> bool:
        """Returns True if user CAN create another field - [DESATIVADO TEMPORARIAMENTE]"""
        return True

billing_service = BillingService()

```


### `tracto-backend/services/cache_service.py`
```py
import json
import os
import time
import threading
from typing import Any, Dict

CACHE_FILE = ".cache/analysis_cache.json"

class AnalysisCache:
    """
    Cache persistente em arquivo JSON para resultados de analise e IA.
    Esta implementacao e segura para threads e usa escrita atomica.
    Nota: Apropriado apenas para deploy de instância unica (single-instance).
    """
    def __init__(self):
        self._cache_file = CACHE_FILE
        self._lock = threading.Lock()
        self._ensure_cache_dir()
        self._cache = self._load_cache()

    def _ensure_cache_dir(self):
        os.makedirs(os.path.dirname(self._cache_file), exist_ok=True)

    def _load_cache(self) -> Dict[str, Any]:
        with self._lock:
            if os.path.exists(self._cache_file):
                try:
                    with open(self._cache_file, "r", encoding="utf-8") as f:
                        return json.load(f)
                except (json.JSONDecodeError, IOError) as e:
                    # Se o arquivo estiver corrompido, resetar para evitar crash
                    # Em Etapa 2/3 poderiamos ter backup
                    return {}
            return {}

    def _save_cache(self):
        # Nao precisa de lock aqui se for chamado dentro de um metodo que ja tem lock
        temp_file = self._cache_file + ".tmp"
        try:
            with open(temp_file, "w", encoding="utf-8") as f:
                json.dump(self._cache, f, ensure_ascii=False, indent=2)
            # Substituicao atomica
            os.replace(temp_file, self._cache_file)
        except Exception:
            # Silencioso para nao quebrar a requisicao principal, mas logar seria ideal
            if os.path.exists(temp_file):
                try: os.remove(temp_file)
                except: pass

    def set(self, key: str, value: Any, ttl_hours: float = 24.0):
        with self._lock:
            expire_at = time.time() + (ttl_hours * 3600)
            self._cache[key] = {
                "value": value,
                "expire_at": expire_at
            }
            self._save_cache()

    def get(self, key: str) -> Any | None:
        with self._lock:
            if key in self._cache:
                entry = self._cache[key]
                if time.time() < entry["expire_at"]:
                    return entry["value"]
                else:
                    # Expired
                    del self._cache[key]
                    self._save_cache()
            return None

# Global instance
analysis_cache = AnalysisCache()


```


### `tracto-backend/services/farm_service.py`
```py
import logging
import os
from typing import Any, Dict, List

import requests

REQUEST_TIMEOUT_SECONDS = 10


def _get_supabase_headers() -> dict[str, str]:
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not key:
        raise ValueError("SUPABASE_SERVICE_KEY nao configurada.")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _supabase_url(table: str) -> str:
    url = os.getenv("SUPABASE_URL")
    if not url:
        raise ValueError("SUPABASE_URL nao configurada.")
    return f"{url.rstrip('/')}/rest/v1/{table}"


def _get_default_farm(user_id: str) -> Dict[str, Any] | None:
    response = requests.get(
        _supabase_url("farms"),
        headers=_get_supabase_headers(),
        params={
            "user_id": f"eq.{user_id}",
            "is_default": "eq.true",
            "select": "*",
        },
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    existing = response.json()
    return existing[0] if existing else None


# --- Farms ---


def get_farms(user_id: str) -> List[Dict[str, Any]]:
    try:
        response = requests.get(
            _supabase_url("farms"),
            headers=_get_supabase_headers(),
            params={"user_id": f"eq.{user_id}", "order": "created_at.desc"},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response.json()
    except Exception as exc:
        logging.error("Erro ao buscar fazendas: %s", exc)
        raise


def save_farm(user_id: str, farm_data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        payload = {**farm_data, "user_id": user_id}
        headers = _get_supabase_headers()
        if "id" in payload:
            headers["Prefer"] = "resolution=merge-duplicates,return=representation"

        response = requests.post(
            _supabase_url("farms"),
            json=payload,
            headers=headers,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response.json()[0] if response.json() else {}
    except Exception as exc:
        logging.error("Erro ao salvar fazenda: %s", exc)
        raise


def delete_farm(farm_id: str, user_id: str) -> bool:
    try:
        response = requests.delete(
            _supabase_url("farms"),
            headers=_get_supabase_headers(),
            params={"id": f"eq.{farm_id}", "user_id": f"eq.{user_id}"},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return True
    except Exception as exc:
        logging.error("Erro ao deletar fazenda: %s", exc)
        raise


# --- Fields ---


def get_fields(user_id: str, farm_id: str | None = None) -> List[Dict[str, Any]]:
    try:
        params = {"user_id": f"eq.{user_id}", "order": "name.asc"}
        if farm_id:
            params["farm_id"] = f"eq.{farm_id}"

        response = requests.get(
            _supabase_url("fields"),
            headers=_get_supabase_headers(),
            params=params,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response.json()
    except Exception as exc:
        logging.error("Erro ao buscar talhoes: %s", exc)
        raise


def save_field(user_id: str, field_data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        # field_data ALREADY comes correctly mapped from Pydantic models in main.py
        payload = {**field_data, "user_id": user_id}
        headers = _get_supabase_headers()
        if "id" in payload:
            headers["Prefer"] = "resolution=merge-duplicates,return=representation"

        response = requests.post(
            _supabase_url("fields"),
            json=payload,
            headers=headers,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response.json()[0] if response.json() else {}
    except requests.HTTPError as exc:
        if exc.response is not None:
             logging.error("Supabase HTTP Error: %s - %s", exc.response.status_code, exc.response.text)
        else:
             logging.error("Erro HTTP ao salvar talhao: %s", exc)
        raise
    except Exception as exc:
        logging.error("Erro interno ao salvar talhao: %s", exc)
        raise


def delete_field(field_id: str, user_id: str) -> bool:
    try:
        response = requests.delete(
            _supabase_url("fields"),
            headers=_get_supabase_headers(),
            params={"id": f"eq.{field_id}", "user_id": f"eq.{user_id}"},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return True
    except Exception as exc:
        logging.error("Erro ao deletar talhao: %s", exc)
        raise


def ensure_default_farm(user_id: str) -> Dict[str, Any]:
    """
    Garante de forma idempotente que o usuario tenha uma fazenda padrao.
    Se outra aba/processo criar a fazenda entre a leitura e a escrita,
    reconsulta o registro vencedor e converge sem propagar erro.
    """
    try:
        existing = _get_default_farm(user_id)
        if existing:
            return existing

        payload = {
            "user_id": user_id,
            "name": "Minha Fazenda",
            "description": "Fazenda principal (Auto-criada)",
            "is_default": True,
        }

        headers = _get_supabase_headers()
        headers["Prefer"] = "resolution=merge-duplicates,return=representation"

        response = requests.post(
            _supabase_url("farms"),
            json=payload,
            headers=headers,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        try:
            response.raise_for_status()
        except requests.HTTPError:
            if response.status_code in (400, 409):
                existing = _get_default_farm(user_id)
                if existing:
                    return existing
            raise

        result = response.json()
        return result[0] if result else {}
    except Exception as exc:
        logging.error("Erro no bootstrap de fazenda: %s", exc)
        raise

```


### `tracto-backend/services/sentinel_service.py`
```py
import os
import httpx
import logging
import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

def get_oauth_token():
    client_id = os.getenv("SENTINEL_CLIENT_ID")
    client_secret = os.getenv("SENTINEL_CLIENT_SECRET")
    
    if not client_id or not client_secret:
        logging.error("SENTINEL credentials not configured.")
        return None
        
    try:
        with httpx.Client() as client:
            response = client.post(
                "https://services.sentinel-hub.com/oauth/token",
                data={
                    "grant_type": "client_credentials",
                    "client_id": client_id,
                    "client_secret": client_secret
                }
            )
            response.raise_for_status()
            return response.json().get("access_token")
    except Exception as e:
        logging.error(f"Error getting Sentinel OAuth token: {str(e)}")
        return None

def get_bbox_from_boundaries(boundaries: list[list[float]] | None, lat: float, lng: float) -> list[float]:
    """
    Calcula o BBox [min_lng, min_lat, max_lng, max_lat] a partir das boundaries.
    Caso nao existam boundaries, usa um offset de 0.005 (~500m).
    """
    if not boundaries or len(boundaries) < 3:
        # Fallback para aprox 1km x 1km (0.01 grau total)
        return [lng - 0.005, lat - 0.005, lng + 0.005, lat + 0.005]
    
    if boundaries is not None:
        lats: List[float] = [p[0] for p in boundaries if p is not None and len(p) >= 1]
        lngs: List[float] = [p[1] for p in boundaries if p is not None and len(p) >= 2]
    else:
        return [lng - 0.005, lat - 0.005, lng + 0.005, lat + 0.005]
    
    # Adiciona uma pequena margem de 10% ou 0.0005 graus
    margin = 0.0005
    return [
        min(lngs) - margin,
        min(lats) - margin,
        max(lngs) + margin,
        max(lats) + margin
    ]

def get_ndvi_stats(bbox: list[float], boundaries: list[list[float]] | None = None):
    """
    Obtem estatisticas reais de NDVI via Sentinel Hub Statistics API.
    Retorna media, classes e cobertura de nuvens deterministica.
    """
    token = get_oauth_token()
    if not token:
        return None
        
    # Se tivermos polígono real, podemos usar no 'geometry' da API para masking
    bounds_payload: Dict[str, Any] = {
        "bbox": bbox,
        "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"}
    }
    
    if boundaries and len(boundaries) >= 3:
        # GeoJSON Polygon: [[ [lng, lat], [lng, lat]... ]]
        # Add real geometry for masking if available
        # Explicit float conversion and safe indexing
        valid_poly = []
        for p in boundaries:
            if p is not None and len(p) >= 2:
                valid_poly.append([float(p[1]), float(p[0])])
        
        if len(valid_poly) >= 3:
            polygon = [valid_poly]
            if polygon[0][0] != polygon[0][-1]:
                polygon[0].append(polygon[0][0])
            # Ensure bounds_payload is a dict (linter fix)
            if isinstance(bounds_payload, dict): # This check is redundant as bounds_payload is initialized as Dict[str, Any]
                bounds_payload["geometry"] = {"type": "Polygon", "coordinates": polygon}

    # Evalscript que calcula NDVI e retorna stats
    evalscript = """
    //VERSION=3
    function setup() {
      return {
        input: [{ bands: ["B04", "B08", "dataMask"] }],
        output: [
          { id: "ndvi", bands: 1 },
          { id: "dataMask", bands: 1 }
        ]
      };
    }
    function evaluatePixel(samples) {
      let ndvi = (samples.B08 - samples.B04) / (samples.B08 + samples.B04);
      return {
        ndvi: [ndvi],
        dataMask: [samples.dataMask]
      };
    }
    """

    payload = {
        "input": {
            "bounds": bounds_payload,
            "data": [
                {
                    "type": "sentinel-2-l2a",
                    "dataFilter": {
                        "maxCloudCoverage": 30,
                        "timeRange": {
                            "from": (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%dT00:00:00Z"),
                            "to": datetime.now().strftime("%Y-%m-%dT23:59:59Z")
                        }
                    }
                }
            ]
        },
        "aggregation": {
            "timeRange": {
                "from": (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%dT00:00:00Z"),
                "to": datetime.now().strftime("%Y-%m-%dT23:59:59Z")
            },
            "aggregationInterval": {"of": "P30D"},
            "evalscript": evalscript,
            "resx": 10,
            "resy": 10
        }
    }

    try:
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        with httpx.Client() as client:
            response = client.post("https://services.sentinel-hub.com/api/v1/statistics", headers=headers, json=payload, timeout=30.0)
            response.raise_for_status()
            data = response.json()
        
        # Parseando o resultado (simplificado para pegar o primeiro entry)
        output = data.get("data", [])[0].get("outputs", {}).get("ndvi", {}).get("bands", {}).get("B0", {}).get("stats", {})
        
        # Se nao houver dados reais, retornamos None para o fallback cuidar
        if not output or output.get("count", 0) == 0:
            return None
            
        return {
            "ndvi_avg": output.get("mean", 0),
            "ndvi_max": output.get("max", 0),
            "ndvi_min": output.get("min", 0),
            "count": output.get("count", 0),
            "cloud_coverage": None # Indisponivel sem extracao explicita de nuvens
        }
    except Exception as e:
        logging.warning(f"Erro ao buscar estatisticas Sentinel: {str(e)}")
        return None

def get_ndvi_image(lat: float, lng: float, boundaries: list[list[float]] | None = None, date_range_days: int = 15):
    token = get_oauth_token()
    if not token:
        return None
        
    bbox = get_bbox_from_boundaries(boundaries, lat, lng)
    
    # Deterministic stats first!
    stats = get_ndvi_stats(bbox, boundaries)
    
    to_date = datetime.now().strftime("%Y-%m-%d")
    
    evalscript = """
    //VERSION=3
    function setup() {
      return { input: ["B04","B08","dataMask"], output: { bands: 4 } };
    }
    function evaluatePixel(s) {
      let ndvi = (s.B08 - s.B04) / (s.B08 + s.B04);
      if (s.dataMask === 0) return [0,0,0,0];
      if (ndvi < 0)    return [0.5, 0.5, 0.5, 1]; // solo/água
      if (ndvi < 0.2)  return [0.8, 0.2, 0.1, 1]; // vermelho: crítico
      if (ndvi < 0.4)  return [0.9, 0.7, 0.1, 1]; // amarelo: estresse
      if (ndvi < 0.6)  return [0.4, 0.8, 0.2, 1]; // verde claro: ok
      return [0.1, 0.5, 0.1, 1];                   // verde escuro: ótimo
    }
    """
    
    # Attempt with date_range_days then fallback to 30
    attempts = [date_range_days, 30]
    
    for days in attempts:
        f_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        payload = {
            "input": {
                "bounds": {
                    "bbox": bbox,
                    "properties": {"crs": "http://www.opengis.net/def/crs/EPSG/0/4326"}
                },
                "data": [
                    {
                        "type": "sentinel-2-l2a",
                        "dataFilter": {
                            "timeRange": {"from": f"{f_date}T00:00:00Z", "to": f"{to_date}T23:59:59Z"},
                            "maxCloudCoverage": 30
                        }
                    }
                ]
            },
            "output": {
                "width": 512, "height": 512,
                "responses": [{"identifier": "default", "format": {"type": "image/png"}}]
            },
            "evalscript": evalscript
        }
        
        # Add real geometry for masking if available
        if boundaries is not None and len(boundaries) >= 3:
            # Explicit float conversion and safe indexing
            valid_poly = []
            for p in boundaries:
                if p is not None and len(p) >= 2:
                    valid_poly.append([float(p[1]), float(p[0])])
            
            if len(valid_poly) >= 3:
                polygon = [valid_poly]
                if polygon[0][0] != polygon[0][-1]:
                    polygon[0].append(polygon[0][0])
                # Ensure payload is a dict (linter fix)
                if isinstance(payload, dict):
                    payload["input"]["bounds"]["geometry"] = {"type": "Polygon", "coordinates": polygon}

        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        
        try:
            logging.info(f"Fetching Sentinel NDVI for {lat}, {lng} (Polygon-based)")
            with httpx.Client() as client:
                response = client.post("https://services.sentinel-hub.com/api/v1/process", headers=headers, json=payload, timeout=60.0)
                response.raise_for_status()
                
                import base64
                image_base64 = base64.b64encode(response.content).decode('utf-8')
            
            return {
                "image_base64": image_base64,
                "date_acquired": f"{to_date} (Aproximado)", # Explicit fallback date
                "cloud_coverage": None, # Fallback explicitly empty so UI shows N/D instead of fake 20
                "stats": stats,
                "is_polygonal": boundaries is not None and len(boundaries) >= 3
            }
        except Exception as e:
            logging.error(f"Error fetching Sentinel NDVI: {str(e)}")
            continue
            
    return None

```


### `tracto-backend/services/supabase_service.py`
```py
import logging
import os

import requests


REQUEST_TIMEOUT_SECONDS = 10


def _get_supabase_headers() -> dict[str, str]:
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not key:
        raise ValueError("SUPABASE_SERVICE_KEY nao configurada.")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _base_url() -> str:
    url = os.getenv("SUPABASE_URL")
    if not url:
        raise ValueError("SUPABASE_URL nao configurada.")
    return f"{url.rstrip('/')}/rest/v1/conversations"


def save_conversation(
    user_id: str,
    conversation_id: str,
    title: str,
    messages: list,
    farm_context: str | None = None,
    created_at: str | None = None,
    updated_at: str | None = None,
) -> dict:
    try:
        payload = {
            "user_id": user_id,
            "conversation_id": conversation_id,
            "title": title,
            "messages": messages,
            "farm_context": farm_context,
            "updated_at": updated_at,
        }
        if created_at:
            payload["created_at"] = created_at

        response = requests.post(
            _base_url(),
            json=payload,
            headers={**_get_supabase_headers(), "Prefer": "resolution=merge-duplicates,return=representation"},
            params={"on_conflict": "conversation_id,user_id"},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

        response.raise_for_status()
        return {"success": True, "conversation_id": conversation_id}
    except Exception as exc:
        logging.error("Erro ao salvar conversa no Supabase: %s", exc)
        raise


def get_conversations(user_id: str) -> list:
    try:
        response = requests.get(
            _base_url(),
            headers=_get_supabase_headers(),
            params={
                "user_id": f"eq.{user_id}",
                "order": "updated_at.desc",
                "select": "conversation_id,title,messages,farm_context,created_at,updated_at",
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response.json()
    except Exception as exc:
        logging.error("Erro ao buscar conversas do Supabase: %s", exc)
        raise



def delete_conversation(conversation_id: str, user_id: str) -> bool:
    try:
        response = requests.delete(
            _base_url(),
            headers={**_get_supabase_headers(), "Prefer": "return=representation"},
            params={
                "conversation_id": f"eq.{conversation_id}",
                "user_id": f"eq.{user_id}",
            },
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        # PostgREST com return=representation retorna lista de linhas deletadas
        deleted_rows = response.json()
        return len(deleted_rows) > 0
    except Exception as exc:
        logging.error("Erro ao deletar conversa do Supabase: %s", exc)
        raise

```


### `tracto-backend/services/weather_service.py`
```py
import logging
from typing import Any

import httpx


OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


def _first_number(value: Any, default: float | None = None) -> float | None:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def _sum_numbers(values: list[Any] | None, days: int = 7) -> float | None:
    if not values:
        return None
    total = 0.0
    found = False
    for value in values[:days]:
        parsed = _first_number(value, None)
        if parsed is None:
            continue
        total += parsed
        found = True
    return total if found else None


def build_forecast_summary(daily: dict[str, Any] | None) -> str | None:
    if not daily:
        return None

    times = daily.get("time") or []
    temp_max = daily.get("tempMax") or daily.get("temperature_2m_max") or []
    temp_min = daily.get("tempMin") or daily.get("temperature_2m_min") or []
    precip = daily.get("precipSum") or daily.get("precipitation_sum") or []

    if not times:
        return None

    parts: list[str] = []
    for index, day in enumerate(times[:7]):
        high = _first_number(temp_max[index] if index < len(temp_max) else None, 0)
        low = _first_number(temp_min[index] if index < len(temp_min) else None, 0)
        rain = _first_number(precip[index] if index < len(precip) else None, 0)
        parts.append(f"{day}: {low:.0f}-{high:.0f}C, chuva {rain:.1f}mm")

    return " | ".join(parts) if parts else None


def extract_weather_snapshot(hourly_weather: dict[str, Any] | None, forecast_7d: str | None) -> dict[str, Any] | None:
    if not hourly_weather:
        return None

    current = hourly_weather.get("current") if isinstance(hourly_weather.get("current"), dict) else hourly_weather
    daily = hourly_weather.get("daily") if isinstance(hourly_weather.get("daily"), dict) else None

    rain_accumulation = current.get("rain_accumulation")
    precipitation = daily.get("precipSum") or daily.get("precipitation_sum") or []
    et0_series = (
        daily.get("et0")
        or daily.get("et0_fao_evapotranspiration_sum")
        or daily.get("et0_fao_evapotranspiration")
        or []
    )

    total_rain = _sum_numbers(precipitation, 7)
    total_et0 = _sum_numbers(et0_series, 7)

    return {
        "temperature": _first_number(current.get("temperature"), 25),
        "humidity": _first_number(current.get("humidity"), 60),
        "wind_speed": _first_number(current.get("wind_speed"), 10),
        "rain_accumulation": _first_number(total_rain if total_rain is not None else rain_accumulation, 0),
        "et0": _first_number(total_et0, None),
        "condition": current.get("condition") or "Dados do cliente",
        "forecast_7d": forecast_7d or build_forecast_summary(daily),
    }


async def fetch_weather_snapshot(lat: float, lng: float) -> dict[str, Any] | None:
    params = {
        "latitude": str(lat),
        "longitude": str(lng),
        "current": "temperature_2m,relative_humidity_2m,wind_speed_10m",
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration_sum",
        "forecast_days": "7",
        "timezone": "America/Sao_Paulo",
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.get(OPEN_METEO_URL, params=params)
            response.raise_for_status()
            payload = response.json()
    except Exception as exc:
        logging.warning("Nao foi possivel obter clima em tempo real: %s", exc)
        return None

    current = payload.get("current", {})
    daily = payload.get("daily", {})
    precipitation = daily.get("precipitation_sum") or []
    et0 = daily.get("et0_fao_evapotranspiration_sum") or []

    total_rain = _sum_numbers(precipitation, 7)
    total_et0 = _sum_numbers(et0, 7)

    return {
        "temperature": _first_number(current.get("temperature_2m"), 25),
        "humidity": _first_number(current.get("relative_humidity_2m"), 60),
        "wind_speed": _first_number(current.get("wind_speed_10m"), 10),
        "rain_accumulation": _first_number(total_rain, 0),
        "et0": _first_number(total_et0, None),
        "condition": "Open-Meteo",
        "forecast_7d": build_forecast_summary(daily),
    }

```


### `tracto-backend/sql/02_commercial.sql`
```sql
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

    -- 2. Se for free, checar a quantidade atual de fields
    IF user_plan = 'free' THEN
        SELECT count(*) INTO field_count
        FROM fields
        WHERE user_id = NEW.user_id;

        IF field_count >= 1 THEN
            RAISE EXCEPTION 'Plan limit exceeded. Free tier is limited to 1 field. Please upgrade your plan.';
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

```


### `tracto-backend/sql/schema.sql`
```sql
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

```


### `tracto-backend/validate_save.py`
```py
import logging
import os
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logging.info(f"SUPABASE_URL: {os.getenv('SUPABASE_URL')}")
logging.info(f"SUPABASE_SERVICE_KEY length: {len(os.getenv('SUPABASE_SERVICE_KEY') or '')}")

from services.farm_service import ensure_default_farm, save_field

# Create a mock authenticated user and try to hit the DB functions directly
# to validate the pydantic mapping + dict conversion.

logging.basicConfig(level=logging.INFO)

# A fake UID that exists in the dev/testing auth schema or just a valid UUID
TEST_USER_ID = "test-user-validate-123"

def main():
    try:
        logging.info("Ensuring default farm...")
        farm = ensure_default_farm(TEST_USER_ID)
        farm_id = farm["id"]
        logging.info(f"Farm ID: {farm_id}")

        logging.info("Validating frontend payload mapping...")
        
        # This represents what the frontend JSON stringifies and sends to FastAPI
        frontend_payload = {
            "farm_id": farm_id,
            "name": "TESTE SANEAMENTO",
            "crop_type": "Milho",
            "variety": "XPTO 123",
            "planting_date": "2025-10-15",
            "area_ha": 15.6,
            "latitude": -23.123,
            "longitude": -51.123,
            "boundaries": [[-23.1,-51.1], [-23.2,-51.1], [-23.2,-51.2]]
        }

        # Simulating the FastAPI Pydantic parsing:
        from models import FieldCreate
        
        # When FastAPI receives JSON, it instantiates the Pydantic model
        parsed = FieldCreate(**frontend_payload)
        
        # When we send to DB, model_dump is called
        db_payload = parsed.model_dump(exclude_unset=True, by_alias=True)
        
        logging.info(f"Pydantic parsed and dumped payload: {json.dumps(db_payload, indent=2)}")
        
        # Attempt to save to Supabase
        logging.info("Saving to Supabase...")
        result = save_field(TEST_USER_ID, db_payload)
        logging.info(f"Saved successfully! ID: {result.get('id')}")
        
    except Exception as e:
        logging.error(f"Validation failed: {e}")

if __name__ == "__main__":
    main()

```


