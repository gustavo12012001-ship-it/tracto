# Referência Completa: FastAPI Backend + Frontend React

## 🐍 Backend - FastAPI Python

### Principais Endpoints

```python
# Health Check
GET /health
← { "status": "ok", "service": "Tracto Backend v2.3.0" }

# reCAPTCHA Verification (Optional)
POST /api/verify-recaptcha
→ { "token": string }
← { "verified": boolean }

# Field Analysis via Satellite (RATE: 10/min)
POST /api/analyze-field
→ {
    "lat": float,
    "lng": float,
    "field_name": string,
    "crop_type": string (optional),
    "boundaries": [[lat, lng], ...] (optional),
    "planting_date": "2024-01-01" (optional),
    "variety": string (optional),
    "area_ha": float (optional)
  }
← {
    "status": "success",
    "ndvi_analysis": { ndvi_medio, zone_critica_pct, tendencia, ... },
    "weather": { temperature, humidity, wind_speed, ... },
    "engine_results": { spray_window, frost_risk, water_stress, ... },
    "ai_report": string,
    "cached": boolean,
    "confidence": float (0.0-1.0)
  }

# AI Chat (RATE: 30/min)
POST /api/chat
→ {
    "messages": [{ "role": "user|model", "text": string }],
    "farm_context": string (optional),
    "image_base64": string (optional),
    "image_mime_type": string (optional),
    "hourly_weather": { temperature, humidity, wind_speed }
  }
← { "reply": string }

# Generate Alerts (RATE: 20/min)
POST /api/alerts
→ { "fields": [...], "weather_snapshot": {...} }
← { "alerts": [{ type, title, message, ... }] }

# Farm Management
GET /api/farms
POST /api/farms → { "name", "description", "is_default" }
PUT /api/farms/{id}
DELETE /api/farms/{id}

# Field Management
GET /api/fields
POST /api/fields → { "farm_id", "name", "crop_type", "boundaries", ... }
PUT /api/fields/{id}
DELETE /api/fields/{id}

# Conversation Management
GET /api/conversations
POST /api/conversations/save → { "conversation_id", "title", "messages", "farm_context" }
DELETE /api/conversations/{id}
```

### Authentication

All endpoints (except `/health` and `/verify-recaptcha`) require:
```
Authorization: Bearer {JWT_TOKEN}
```

JWT is stored in `localStorage` by frontend when user logs in via Supabase Auth.

### Rate Limiting

Implemented via SlowAPI middleware:
- `analyze-field`: 10 requests/minute per IP
- `chat`: 30 requests/minute per IP
- `alerts`: 20 requests/minute per IP

Returns `429 Too Many Requests` if exceeded.

---

## 🎨 Frontend - React Architecture

### Key Components

**Layout.tsx** - Main authenticated layout with sidebar
- Navigation items with badge support
- User profile section with logout
- Weather display integration
- Farm/field selector dropdown
- Mobile hamburger menu

**FieldMap.tsx** - Interactive map component
- Drawing mode for field boundaries
- Satellite + NDVI layer toggle
- NASA GIBS integration (MODIS, Sentinel)
- Field legend and location markers
- GPS accuracy indicator

**ProtectedRoute.tsx** - Authentication guard
- Session check on mount
- Intercepts unauthenticated access
- Phone number requirement overlay (for WhatsApp alerts)
- Redirects to login if needed

**Skeleton.tsx** - Loading placeholders
- `SkeletonLine`, `SkeletonCard`, `SkeletonChart`, `SkeletonMap`
- Pulse animation with CSS keyframes

### Page Components

- **Dashboard.tsx** - Main analytics + map view
- **Chat.tsx** - Conversation history + image upload
- **Alerts.tsx** - Alert triage and dismissal
- **Reports.tsx** - PDF generation + templates
- **Market.tsx** - Commodity pricing (via HG Brasil API)
- **Weather.tsx** - Meteorological forecast visualization
- **Pricing.tsx** - Plan selection
- **LandingPage.tsx** - Public marketing homepage

### Service Modules

**api.ts**
```typescript
export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T>
// Automatically injects JWT from localStorage
// Sets Content-Type: application/json
// Throws on non-OK response

export async function analyzeField(
  lat, lng, fieldName, cropType, weather,
  boundaries, plantingDate, variety, areaHa
): Promise<FieldAnalysisResult>
```

**supabase.ts**
```typescript
export const supabase = createClient(
  VITE_SUPABASE_URL as string,
  VITE_SUPABASE_ANON_KEY as string
)
// Configured for Auth + RLS enforcement
```

**alertsAI.ts**
```typescript
export async function generateAlerts(
  weather: WeatherCache,
  fields: Location[]
): Promise<Alert[]>
// Calls backend /api/alerts
// Returns typed Alert array
```

**farm_service.ts**
```typescript
export const farmService = {
  async createFarm(name: string, description?: string),
  async updateFarm(id: string, data: Partial<Farm>),
  async deleteFarm(id: string),
  async listFarms(): Promise<Farm[]>
}
```

### Global State (Zustand)

```typescript
interface AppState {
  // Farms & Fields
  farms: Farm[]
  fields: Location[]
  activeFarmId: string | null
  activeFieldId: string | null
  
  // Location
  currentLocation: { lat: number; lng: number; name?: string } | null
  locationStatus: 'loading' | 'precise' | 'fallback' | 'denied' | 'unavailable'
  
  // UI
  activeMapLayer: 'satellite' | 'ndvi' | 'moisture'
  
  // Weather
  weatherCache: WeatherCache | null
  
  // Alerts
  alerts: Alert[]
  
  // Chat
  messages: Message[]
  
  // Methods
  setFields(fields: Location[]): void
  setAlerts(alerts: Alert[]): void
  appendAlert(alert: Alert): void
  dismissAlert(id: string): void
  createField(farmId: string, location: Location): Promise<void>
  removeField(farmId: string, fieldId: string): Promise<void>
  updateGeolocation(): Promise<void>
  syncFromBackend(): Promise<void>
}

// Persisted to localStorage with key 'tracto-app-store'
```

---

## 🔐 Environment Variables

### Frontend (.env.local)

```bash
# API Base
VITE_API_URL=https://tracto-eta.vercel.app
VITE_API_TIMEOUT=30000

# Supabase (Auth + Database)
VITE_SUPABASE_URL=https://[project].supabase.co
VITE_SUPABASE_ANON_KEY=[anon-key]

# Security
VITE_RECAPTCHA_SITE_KEY=[site-key]

# Maps
VITE_LEAFLET_API=https://tile.openstreetmap.org

# Feature Flags
VITE_ENABLE_MOCK_ANALYSIS=false
VITE_ENABLE_CHAT_HISTORY=true
VITE_CACHE_TTL_HOURS=24
```

### Backend (.env)

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/tracto

# Supabase
SUPABASE_URL=https://[project].supabase.co
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]
SUPABASE_JWT_SECRET=[jwt-secret]

# AI & External APIs
ANTHROPIC_API_KEY=sk-ant-...
SENTINEL_HUB_API_TOKEN=...
WEATHER_API_KEY=...

# Security
RECAPTCHA_SECRET_KEY=...
ALLOWED_ORIGINS=http://localhost:5173,https://tracto.app
JWT_EXPIRATION_HOURS=24

# Payments (Etapa 3)
STRIPE_API_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Logging
LOG_LEVEL=INFO
SENTRY_DSN=https://...

# Server
HOST=0.0.0.0
PORT=8000
WORKERS=4
```

---

## 📊 Database Schema

### Core Tables

**farms** (user's fazendas)
- id (UUID PK)
- user_id (FK auth.users)
- name (string)
- description (text, nullable)
- is_default (boolean)
- created_at, updated_at (timestamps)

**fields** (talhões)
- id (UUID PK)
- farm_id (FK farms)
- user_id (FK auth.users)
- name, crop_type, variety (strings)
- planting_date (date, nullable)
- area_ha (numeric)
- boundaries (JSONB: [[lat, lng], ...])
- latitude, longitude (numeric)
- created_at, updated_at (timestamps)

**analysis_runs** (análises via satélite)
- id (UUID PK)
- field_id (FK fields)
- user_id (FK auth.users)
- analyzed_at (timestamp)
- ndvi_avg, cloud_coverage (numeric)
- ai_report (text)
- weather_snapshot (JSONB)
- full_result (JSONB)
- created_at (timestamp)

**alerts** (alertas gerados)
- id (UUID PK)
- field_id (FK fields, nullable)
- user_id (FK auth.users)
- type ('critical' | 'warning' | 'info')
- title, message (strings)
- dismissed (boolean, default false)
- created_at (timestamp)

**conversations** (histórico de chat)
- id (UUID PK)
- conversation_id (string, unique per user)
- user_id (FK auth.users)
- title (string)
- messages (JSONB: [{ role, text }])
- farm_context (text, nullable)
- created_at, updated_at (timestamps)

**subscriptions** (planos de assinatura - Etapa 3)
- id (UUID PK)
- user_id (FK auth.users, unique)
- plan_id ('free' | 'professional' | 'enterprise')
- status ('active' | 'trialing' | 'canceled')
- current_period_start, current_period_end (timestamps)
- trial_end (timestamp, nullable)
- gateway_customer_id, gateway_subscription_id (strings)

**push_subscriptions** (notificações push - Etapa 2)
- id (UUID PK)
- user_id (FK auth.users)
- endpoint, p256dh, auth (strings for Web Push)
- created_at, updated_at (timestamps)

**whatsapp_contacts** (contatos WhatsApp - Etapa 4)
- id (UUID PK)
- user_id (FK auth.users)
- phone_number (string, unique)
- preferences (JSONB: { critical_alerts, weekly_reports, ... })
- created_at, updated_at (timestamps)

### RLS Policies

All user-owned tables have `SELECT/INSERT/UPDATE/DELETE` policies:
```sql
CREATE POLICY "Users can access own data" ON [table]
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id)
```

---

## 🚀 Deployment

### Frontend (Vercel)

```bash
# Push to git → Automatic build
# Environment variables set in Vercel dashboard
# Build command: npm run build
# Output directory: dist/
# Framework: Vite

# Access: https://tracto.app
```

### Backend (Vercel Python Function)

```bash
# FastAPI carregado por api/index.py
# Environment variables set in Vercel dashboard
# Rewrites: /api/* -> /api/index.py
# Health check: /api/health

# Access: https://tracto-eta.vercel.app
```

### Database (Supabase)

```sql
-- Schema automatically created via PRODUCAO_SCHEMA.sql
-- RLS policies enforce user data isolation
-- Backups daily, retention: 7 days

-- Run migrations:
-- psql $DATABASE_URL < PRODUCAO_SCHEMA.sql
```

---

## 📝 Development Workflow

### Setup

```bash
# Frontend
cd tracto
npm install
npm run dev

# Backend
cd tracto-backend
pip install -r requirements.txt
python main.py

# Visit http://localhost:5173
```

### Making Changes

**Frontend:**
1. Edit `.tsx` or `.css` files
2. Vite hot-reloads automatically
3. Test in browser
4. `git commit && git push`
5. Vercel builds + deploys automatically

**Backend:**
1. Edit `.py` files
2. Restart uvicorn manually (or use watchdog)
3. Test with curl or Postman
4. Ensure `.env` variables are set
5. `git commit && git push`
6. Vercel rebuilds + deploys automatically

### Testing

```bash
# Frontend
npm run lint  # ESLint
npm run build  # Production build

# Backend
pytest tests/  # Unit tests (if available)
curl http://localhost:8000/health  # Health check
```

---

## 🔍 Troubleshooting

**Issue:** "No valid session" on protected routes
- **Solution:** Check localStorage for `sb-${PROJECT_ID}-auth-token`. If missing, user session expired.

**Issue:** "rate limit exceeded"
- **Solution:** Wait a minute, then retry. Rate limits reset per minute.

**Issue:** NDVI image not loading
- **Solution:** High cloud coverage (>70%) or older imagery. Sentinel Hub API may have no tiles for that date. Check `cloud_coverage` field.

**Issue:** Chat response is slow
- **Solution:** Claude API has variable latency. Check `ANTHROPIC_API_KEY` is valid. May take 5-10s for vision analysis.

**Issue:** Fields not syncing across devices
- **Solution:** `syncFromBackend()` runs on app load. Refresh page manually or check network in DevTools.

---

**Last Updated:** April 4, 2026  
**Version:** 2.3.0  
**Status:** Production-Ready
