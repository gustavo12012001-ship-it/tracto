import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import httpx
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, Header, Request, Response, Cookie, Query
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import time
import uuid

from models import (
    AlertRequest,
    ChatResponse,
    ChatRequest,
    FieldAnalysisRequest,
    FieldAnalysisResponse,
    FieldDocumentAnalysisRequest,
    FieldDocumentAnalysisResponse,
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
    GeoSearchRequest,
    PlacesSearchRequest,
    PlaceItem,
    FieldIntelligenceSnapshot,
    SentinelPreloadRequest,
    FieldLogCreate,
    SeasonCreate,
    SeasonUpdate,
    SprayWindowRequest,
    AnovaRequest,
    ParcelNdviRequest,
    GenotypeCreate,
    GenotypeUpdate,
    CrossCreate,
    BreedingGenerationCreate,
    GxERequest,
    PlotCreate,
    PlotUpdate,
    NotebookEventCreate,
    NotebookEventUpdate,
)
from services import supabase_service, farm_service
from services.billing_service import billing_service, validate_cpf, validate_cnpj
from services.ai_service import MODEL, _get_client, analyze_field_document, analyze_ndvi_image, analyze_weather_map, generate_alerts_claude, generate_chat_response
from services.auth_service import AuthenticatedUser, get_unverified_user_id_from_header, get_current_user
from services.cache_service import analysis_cache
from services.sentinel_service import (
    get_ndvi_image,
    get_true_color_overlay,
    get_available_scenes,
    get_sentinel_overlay_with_cache,
    clear_cached_overlays_for_field,
    SATELLITE_CACHE_BUCKET,
)
from services.planet_service import (
    create_planet_tile_session,
    get_planet_tile_session_status,
    get_planet_scenes,
    get_planet_thumbnail,
    get_planet_tile,
    get_planet_overlay,
    get_bbox_from_boundaries,
)
from services.up42_service import (
    search_up42_scenes,
    get_up42_overlay,
)
from services.plots_service import (
    create_plot,
    get_plots_by_field,
    update_plot,
    delete_plot,
)
from services.notebook_service import (
    create_event as create_notebook_event,
    get_events as get_notebook_events,
    update_event as update_notebook_event,
    delete_event as delete_notebook_event,
)
from services.satellite_history_service import (
    get_satellite_history,
)
from services.geo_service import GeoProviderError, search_location, search_places_nearby
from services.weather_service import extract_weather_snapshot, fetch_weather_snapshot
from services.agronomic_engine import AgronomicEngine
from services.field_intelligence_service import build_field_intelligence_snapshot
from services.market_service import get_market_quotes
from services.analysis_history_service import save_analysis, get_field_analyses
from services.field_log_service import create_log, get_field_logs, delete_log
from services.season_service import create_season, get_field_seasons, update_season, delete_season
from services.spray_window_service import evaluate_spray_window
from services.stats_service import run_anova_tukey, run_gxe_analysis
from services.api_key_service import generate_api_key, verify_api_key, list_api_keys, revoke_api_key
from services.germoplasm_service import (
    create_genotype, get_genotypes, update_genotype, delete_genotype,
    create_cross, get_crosses, delete_cross,
    create_generation, get_generations, delete_generation,
)

# --- Security & Rate Limiting ---

# O limitador usa IP (get_remote_address) como chave primária para governança econômica.
# A identidade do usuário (context_user_id) é usada apenas para contexto em logs.
limiter = Limiter(key_func=get_remote_address)
APP_VERSION = os.getenv("APP_VERSION", "2.3.0")
PROCESS_STARTED_AT = time.perf_counter()

# (A-10) Observabilidade: inicializa Sentry ANTES de criar o app (no-op sem
# SENTRY_DSN). As integrações FastAPI/Starlette capturam exceções não tratadas.
try:
    from services.monitoring import init_sentry
    init_sentry()
except Exception as _exc:  # noqa: BLE001
    logging.warning("[startup] init_sentry falhou: %s", _exc)


# ── Lifespan: substitui @app.on_event("startup") deprecado ──────────────────
@asynccontextmanager
async def _lifespan(app_: FastAPI):
    """Tarefas de startup e shutdown do servidor."""
    # --- startup ---
    logging.info(
        "[startup] Tracto API cold_start_ms=%s version=%s environment=%s",
        int((time.perf_counter() - PROCESS_STARTED_AT) * 1000),
        APP_VERSION,
        os.getenv("ENVIRONMENT", "development"),
    )
    try:
        from services.cache_service import start_cache_gc_task
        # GC do cache em arquivo a cada 1h — remove entradas expiradas
        # e evita que .cache/analysis_cache.json cresça indefinidamente.
        start_cache_gc_task(interval_seconds=3600)
    except Exception as exc:
        logging.warning("[startup] Falha ao iniciar cache GC task: %s", exc)

    yield  # servidor em execução

    # --- shutdown (extensão futura: fechar conexões, flush buffers) ---


app = FastAPI(
    title="Tracto API",
    description="O motor da plataforma Tracto",
    version=APP_VERSION,
    lifespan=_lifespan,
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- Structured Logging Middleware ---
@app.middleware("http")
async def structured_log_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())
    start_time = time.time()

    # IMPORTANTE: extrai 'sub' do JWT SEM verificar assinatura. NÃO use pra
    # autorização. Apenas pra correlacionar logs e métricas. O auth_service
    # faz a verificação real via Supabase quando o endpoint usa get_current_user.
    unverified_context_uid = get_unverified_user_id_from_header(
        request.headers.get("Authorization")
    ) or "anonymous"

    response = await call_next(request)

    duration = time.time() - start_time
    log_data = {
        "request_id": request_id,
        # Prefixo 'unverified_' deixa explícito que o claim não foi validado.
        # Auditorias post-incident não devem confiar nesse campo.
        "unverified_context_uid": unverified_context_uid,
        "is_verified_uid": False,
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


# --- Security Headers Middleware ---
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    # CSP: restringe de onde scripts/dados podem ser carregados
    response.headers["Content-Security-Policy"] = (
        "default-src 'none'; "
        "script-src 'none'; "
        "frame-ancestors 'none';"
    )
    # Remove headers that reveal server info (MutableHeaders não tem .pop())
    for _h in ("server", "x-powered-by"):
        try:
            del response.headers[_h]
        except (KeyError, AttributeError):
            pass
    return response


# CORS — whitelist EXPLÍCITA. Regex foi removido pra evitar que subdomínios
# arbitrários do *.vercel.app (incluindo previews de forks maliciosos)
# consigam fazer requisições autenticadas.
allowed_origins_env = os.getenv("ALLOWED_ORIGINS")
if allowed_origins_env:
    allow_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]
else:
    allow_origins = [
        # Produção
        "https://tracto-eta.vercel.app",
        "https://tractoagro.com.br",
        "https://www.tractoagro.com.br",
        # Desenvolvimento local
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:5176",
    ]

# Regex restrito SOMENTE pra deploys preview do projeto Tracto (mesma org Vercel).
# Pattern: tracto-<hash>-gustavo12012001-ship-its-projects.vercel.app
# Se quiser desabilitar previews completamente, defina ALLOWED_ORIGINS_REGEX=""
allow_origin_regex = os.getenv(
    "ALLOWED_ORIGINS_REGEX",
    r"^https://tracto-[a-z0-9-]+-gustavo12012001-ship-its-projects\.vercel\.app$",
) or None

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key", "Accept", "Origin", "X-Request-ID"],
    expose_headers=["X-Scene-Bounds", "X-Scene-Id", "X-Cache", "X-Cache-Source", "X-Source", "X-Scene-Date", "X-Mode", "X-Request-ID", "X-Provider", "X-Resolution", "X-Asset-Status"],
    max_age=600,  # cache de preflight CORS
)


@app.get("/")
def health_check():
    return {
        "status": "Tracto backend online",
        "version": APP_VERSION,
        "service": "tracto-backend",
        "timestamp": datetime.now().isoformat(),
    }


# ---------------------------------------------------------------------------
# Auth helpers — JWT Bearer OR X-API-Key
# ---------------------------------------------------------------------------

async def get_current_user_or_api_key(
    request: Request,
    authorization: str | None = Header(default=None),
    x_api_key: str | None = Header(default=None),
) -> AuthenticatedUser:
    """
    Dependency que aceita autenticação via:
      1. Header Authorization: Bearer <JWT>  (via Supabase)
      2. Header X-API-Key: tracto_live_<hex> (via api_key_service)

    Lança 401 se nenhum método de autenticação for válido.
    """
    # Tenta API Key primeiro (mais barata computacionalmente quando JWT não presente)
    if x_api_key:
        try:
            user_id = verify_api_key(x_api_key)
            if user_id:
                return AuthenticatedUser(id=user_id)
        except Exception as exc:
            logging.warning("[auth] Erro ao verificar X-API-Key: %s", exc)

    # Fallback para JWT Bearer
    if authorization:
        try:
            from services.auth_service import _extract_bearer_token, verify_access_token
            token = _extract_bearer_token(authorization)
            return verify_access_token(token)
        except HTTPException:
            raise
        except Exception as exc:
            logging.warning("[auth] Erro ao verificar JWT: %s", exc)

    raise HTTPException(
        status_code=401,
        detail="Autenticação obrigatória. Use Authorization: Bearer <token> ou X-API-Key: <chave>.",
    )


# ---------------------------------------------------------------------------
# WhatsApp via Z-API — helper de envio
# ---------------------------------------------------------------------------

async def send_whatsapp_reply(phone: str, message: str) -> bool:
    """
    Envia uma mensagem de resposta via Z-API.

    Requer as env vars:
      - ZAPI_INSTANCE_ID
      - ZAPI_TOKEN
      - ZAPI_CLIENT_TOKEN

    Returns
    -------
    True se enviado com sucesso, False caso contrário.
    """
    instance_id = os.getenv("ZAPI_INSTANCE_ID")
    zapi_token = os.getenv("ZAPI_TOKEN")
    client_token = os.getenv("ZAPI_CLIENT_TOKEN")

    if not instance_id or not zapi_token or not client_token:
        logging.warning(
            "[whatsapp] Env vars Z-API ausentes (ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN) "
            "— resposta não enviada para %s.",
            phone,
        )
        return False

    url = f"https://api.z-api.io/instances/{instance_id}/token/{zapi_token}/send-text"
    payload = {"phone": phone, "message": message}
    headers = {"client-token": client_token, "Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            logging.info("[whatsapp] Mensagem enviada via Z-API para %s", phone)
            return True
    except Exception as exc:
        logging.warning("[whatsapp] Falha ao enviar mensagem Z-API para %s: %s", phone, exc)
        return False



# --- Stage 3: Commercial, Push & WhatsApp ---

@app.get("/api/billing/entitlements")
async def get_entitlements(user: AuthenticatedUser = Depends(get_current_user)):
    return billing_service.get_entitlements(user.id, user.email)


# ═══════════════════════════════════════════════════════════════════════════
# BILLING — MERCADO PAGO (recorrência via preapproval)
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/billing/plans")
@limiter.limit("60/minute")
async def list_billing_plans(request: Request, _user: AuthenticatedUser = Depends(get_current_user)):
    """Lista planos ativos disponíveis pra assinatura."""
    import requests as _req
    sb_url = f"{os.getenv('SUPABASE_URL', '').rstrip('/')}/rest/v1/plans"
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    resp = _req.get(
        sb_url,
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        params={"is_active": "eq.true", "order": "display_order.asc"},
        timeout=10,
    )
    if not resp.ok:
        raise HTTPException(status_code=503, detail="Falha ao buscar planos.")
    plans = resp.json()
    # Converte centavos pra reais decimais pro frontend
    for p in plans:
        p["price_monthly_brl"] = round((p.get("price_monthly_brl_cents") or 0) / 100.0, 2)
        p["price_yearly_brl"] = round((p.get("price_yearly_brl_cents") or 0) / 100.0, 2)
    return {"plans": plans}


@app.get("/api/billing/subscription")
@limiter.limit("30/minute")
async def get_user_subscription(request: Request, user: AuthenticatedUser = Depends(get_current_user)):
    """Retorna a assinatura ativa (ou pending) do usuário, se houver."""
    import requests as _req
    sb_url = f"{os.getenv('SUPABASE_URL', '').rstrip('/')}/rest/v1/subscriptions"
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    resp = _req.get(
        sb_url,
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        params={
            "user_id": f"eq.{user.id}",
            "status": "in.(pending,authorized,paused)",
            "order": "created_at.desc",
            "limit": "1",
        },
        timeout=10,
    )
    if not resp.ok:
        raise HTTPException(status_code=503, detail="Falha ao consultar assinatura.")
    rows = resp.json()
    if not rows:
        return {"subscription": None, "plan_id": "free"}
    sub = rows[0]
    return {"subscription": sub, "plan_id": sub.get("plan_id", "free")}


@app.get("/api/billing/profile")
@limiter.limit("30/minute")
async def get_billing_profile(request: Request, user: AuthenticatedUser = Depends(get_current_user)):
    """Retorna o perfil de cobrança do usuário (CPF, endereço, etc)."""
    import requests as _req
    sb_url = f"{os.getenv('SUPABASE_URL', '').rstrip('/')}/rest/v1/billing_profiles"
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    resp = _req.get(
        sb_url,
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        params={"user_id": f"eq.{user.id}", "limit": "1"},
        timeout=10,
    )
    if not resp.ok:
        raise HTTPException(status_code=503, detail="Falha ao consultar perfil.")
    rows = resp.json()
    return {"profile": rows[0] if rows else None}


from pydantic import BaseModel as _BM


class BillingProfileUpsert(_BM):
    full_name: str
    document_type: str  # 'CPF' or 'CNPJ'
    document_number: str
    email: str
    phone: str | None = None
    address_zip: str | None = None
    address_street: str | None = None
    address_number: str | None = None
    address_complement: str | None = None
    address_district: str | None = None
    address_city: str | None = None
    address_state: str | None = None


@app.post("/api/billing/profile")
@limiter.limit("20/minute")
async def upsert_billing_profile(
    request: Request,
    body: BillingProfileUpsert,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Cria ou atualiza o perfil de cobrança (CPF/CNPJ + endereço)."""
    import requests as _req
    sb_url = f"{os.getenv('SUPABASE_URL', '').rstrip('/')}/rest/v1/billing_profiles"
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    # Validações com dígitos verificadores (Módulo 11)
    if body.document_type not in ("CPF", "CNPJ"):
        raise HTTPException(status_code=422, detail="document_type deve ser CPF ou CNPJ.")
    doc = body.document_number.replace(".", "").replace("-", "").replace("/", "").strip()
    if body.document_type == "CPF" and not validate_cpf(doc):
        raise HTTPException(status_code=422, detail="CPF inválido. Verifique os dígitos e tente novamente.")
    if body.document_type == "CNPJ" and not validate_cnpj(doc):
        raise HTTPException(status_code=422, detail="CNPJ inválido. Verifique os dígitos e tente novamente.")

    payload = {
        "user_id": user.id,
        "full_name": body.full_name.strip(),
        "document_type": body.document_type,
        "document_number": doc,
        "email": body.email.strip().lower(),
        "phone": body.phone,
        "address_zip": body.address_zip,
        "address_street": body.address_street,
        "address_number": body.address_number,
        "address_complement": body.address_complement,
        "address_district": body.address_district,
        "address_city": body.address_city,
        "address_state": body.address_state,
        "updated_at": datetime.now().isoformat(),
    }
    resp = _req.post(
        sb_url,
        headers={
            "apikey": key, "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=representation",
        },
        params={"on_conflict": "user_id"},
        json=payload,
        timeout=10,
    )
    if not resp.ok:
        logging.error("[billing/profile] upsert falhou: %s %s", resp.status_code, resp.text[:300])
        raise HTTPException(status_code=503, detail="Falha ao salvar perfil.")
    rows = resp.json()
    return {"profile": rows[0] if isinstance(rows, list) and rows else payload}


class CheckoutCreateRequest(_BM):
    plan_id: str
    billing_cycle: str  # 'monthly' or 'yearly'


def _checkout_trial_end(trial_days: int) -> str | None:
    """Retorna ISO UTC da data de fim do trial, ou None se trial_days <= 0."""
    if trial_days <= 0:
        return None
    from datetime import timedelta
    end = datetime.now(timezone.utc) + timedelta(days=trial_days)
    return end.replace(microsecond=0).isoformat().replace("+00:00", "Z")


@app.post("/api/billing/checkout")
@limiter.limit("10/minute")
async def create_checkout(
    request: Request,
    body: CheckoutCreateRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Cria uma assinatura no Mercado Pago e retorna a URL pra redirect.
    Frontend redireciona o usuário pra essa URL pra completar o pagamento.
    """
    import requests as _req
    from services import mercadopago_service as mp

    if body.billing_cycle not in ("monthly", "yearly"):
        raise HTTPException(status_code=422, detail="billing_cycle inválido.")

    # 1. Busca plano no DB
    sb_url = f"{os.getenv('SUPABASE_URL', '').rstrip('/')}/rest/v1/plans"
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    resp = _req.get(
        sb_url,
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        params={"id": f"eq.{body.plan_id}", "is_active": "eq.true", "limit": "1"},
        timeout=10,
    )
    if not resp.ok or not resp.json():
        raise HTTPException(status_code=404, detail="Plano não encontrado.")
    plan = resp.json()[0]

    if body.plan_id == "free":
        raise HTTPException(status_code=400, detail="Plano gratuito não requer checkout.")

    amount_cents = plan["price_monthly_brl_cents"] if body.billing_cycle == "monthly" else plan["price_yearly_brl_cents"]
    if amount_cents <= 0:
        raise HTTPException(status_code=400, detail="Plano sem preço configurado.")
    amount_brl = amount_cents / 100.0
    frequency = 1 if body.billing_cycle == "monthly" else 12

    # 2. Garante billing_profile (precisa ter CPF/email pra cobrar)
    prof_resp = _req.get(
        f"{os.getenv('SUPABASE_URL', '').rstrip('/')}/rest/v1/billing_profiles",
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        params={"user_id": f"eq.{user.id}", "limit": "1"},
        timeout=10,
    )
    profile = prof_resp.json()[0] if prof_resp.ok and prof_resp.json() else None
    if not profile:
        raise HTTPException(
            status_code=412,
            detail="Complete seu cadastro (CPF/CNPJ + endereço) antes de assinar.",
        )

    # 3. Cria registro pending de subscription pra ter external_reference
    sub_id = str(uuid.uuid4())
    frontend_base = os.getenv("FRONTEND_URL", "https://tracto-eta.vercel.app").rstrip("/")
    backend_base_env = os.getenv("BACKEND_URL")
    if not backend_base_env:
        raise HTTPException(
            status_code=500,
            detail="BACKEND_URL nao configurado. Defina a URL publica da API na Vercel.",
        )
    backend_base = backend_base_env.rstrip("/")
    success_url = f"{frontend_base}/app/billing/success?sub={sub_id}"
    notification_url = f"{backend_base}/api/billing/mercadopago-webhook"

    # 4. Chama Mercado Pago pra criar preapproval
    try:
        mp_resp = await mp.create_preapproval(
            plan_id=plan.get(f"mp_plan_id_{body.billing_cycle}"),  # pode ser None
            payer_email=profile["email"],
            amount_brl=amount_brl,
            frequency_months=frequency,
            reason=f"Tracto {plan['name']} ({body.billing_cycle})",
            external_reference=sub_id,
            back_url=success_url,
            notification_url=notification_url,
            trial_days=7,  # 7 dias trial — ajuste conforme negócio
        )
    except mp.MercadoPagoError as exc:
        logging.error("[billing/checkout] MP rejeitou: %s", exc.detail)
        raise HTTPException(status_code=502, detail=f"Falha no Mercado Pago: {exc.detail}") from exc

    # 5. Salva subscription no DB
    sub_payload = {
        "id": sub_id,
        "user_id": user.id,
        "plan_id": body.plan_id,
        "status": mp_resp.get("status", "pending"),
        "billing_cycle": body.billing_cycle,
        "mp_preapproval_id": mp_resp.get("id"),
        "mp_init_point": mp_resp.get("init_point"),
        "mp_payer_email": profile["email"],
        "started_at": datetime.now().isoformat(),
        # trial_days=7 está passado para o create_preapproval acima.
        # Salvar a data real permite que is_trial expire corretamente no billing_service.
        "trial_end_at": _checkout_trial_end(trial_days=7),
    }
    sb_sub_url = f"{os.getenv('SUPABASE_URL', '').rstrip('/')}/rest/v1/subscriptions"
    _req.post(
        sb_sub_url,
        headers={
            "apikey": key, "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        json=sub_payload,
        timeout=10,
    )

    return {
        "subscription_id": sub_id,
        "mp_preapproval_id": mp_resp.get("id"),
        "checkout_url": mp_resp.get("init_point"),
        "sandbox_url": mp_resp.get("sandbox_init_point"),
        "environment": mp.get_environment(),
    }


@app.post("/api/billing/cancel")
@limiter.limit("10/minute")
async def cancel_subscription(request: Request, user: AuthenticatedUser = Depends(get_current_user)):
    """Cancela a assinatura ativa do usuário."""
    import requests as _req
    from services import mercadopago_service as mp

    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    sb_url = f"{os.getenv('SUPABASE_URL', '').rstrip('/')}/rest/v1/subscriptions"
    resp = _req.get(
        sb_url,
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        params={
            "user_id": f"eq.{user.id}",
            "status": "in.(pending,authorized,paused)",
            "order": "created_at.desc",
            "limit": "1",
        },
        timeout=10,
    )
    if not resp.ok or not resp.json():
        raise HTTPException(status_code=404, detail="Nenhuma assinatura ativa.")
    sub = resp.json()[0]
    mp_id = sub.get("mp_preapproval_id")
    if mp_id:
        try:
            await mp.cancel_preapproval(mp_id)
        except mp.MercadoPagoError as exc:
            logging.warning("[billing/cancel] MP cancel falhou: %s", exc.detail)
    # Atualiza local
    _req.patch(
        sb_url,
        headers={
            "apikey": key, "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        params={"id": f"eq.{sub['id']}"},
        json={"status": "cancelled", "cancelled_at": datetime.now().isoformat()},
        timeout=10,
    )
    return {"ok": True, "subscription_id": sub["id"]}


@app.post("/api/billing/mercadopago-webhook")
@limiter.limit("120/minute")
async def mercadopago_webhook(request: Request):
    """
    Webhook do Mercado Pago. NÃO usa auth — valida via signature HMAC.

    Eventos esperados:
    - payment.created / payment.updated
    - subscription_preapproval.created / updated
    """
    import requests as _req
    from services import mercadopago_service as mp

    body_bytes = await request.body()
    headers = request.headers

    # Query string traz data.id geralmente
    data_id = request.query_params.get("data.id") or request.query_params.get("id")
    event_type = request.query_params.get("type") or request.query_params.get("topic") or "unknown"

    # Tenta JSON body também
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    if not data_id and isinstance(payload, dict):
        data_id = (payload.get("data") or {}).get("id") or payload.get("id")
        event_type = payload.get("type") or payload.get("action") or event_type

    # ── Validação de assinatura ─────────────────────────────────────────────
    if not mp.verify_webhook_signature(
        raw_body=body_bytes,
        x_signature_header=headers.get("x-signature"),
        x_request_id_header=headers.get("x-request-id"),
        data_id=str(data_id) if data_id else None,
    ):
        raise HTTPException(status_code=401, detail="Assinatura de webhook inválida.")

    # ── Idempotência (A-09) ──────────────────────────────────────────────────
    # Chave = request-id (preferido) ou type:data.id. Regras:
    #   • Evento com processed_at != NULL  → duplicado REAL, ignora (200).
    #   • Evento existente com processed_at == NULL → tentativa anterior falhou
    #     ou não concluiu → REPROCESSA (sem reinserir, pra não violar UNIQUE).
    #   • Evento inexistente → registra e processa.
    #   • Falha transitória → mantém processed_at NULL e responde 503 para o
    #     Mercado Pago RETENTAR; no retry o evento é reprocessado.
    event_key = headers.get("x-request-id") or f"{event_type}:{data_id}"
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    sb_evt_url = f"{os.getenv('SUPABASE_URL', '').rstrip('/')}/rest/v1/mp_webhook_events"
    _sb_headers = {"apikey": key, "Authorization": f"Bearer {key}"}

    existing = _req.get(
        sb_evt_url,
        headers=_sb_headers,
        params={
            "mp_event_id": f"eq.{event_key}",
            "select": "mp_event_id,processed_at",
            "limit": "1",
        },
        timeout=10,
    )
    already_registered = False
    if existing.ok and existing.json():
        already_registered = True
        if existing.json()[0].get("processed_at"):
            logging.info("[MP webhook] evento %s já processado, ignorando", event_key)
            return {"status": "duplicate"}
        logging.info("[MP webhook] reprocessando evento %s (processed_at NULL)", event_key)

    # Registra evento somente se ainda não existir (evita conflito de UNIQUE).
    if not already_registered:
        _req.post(
            sb_evt_url,
            headers={**_sb_headers, "Content-Type": "application/json", "Prefer": "return=minimal"},
            json={
                "mp_event_id": event_key,
                "event_type": event_type,
                "action": payload.get("action") if isinstance(payload, dict) else None,
                "raw_payload": payload,
            },
            timeout=10,
        )

    # ── Processa baseado no tipo ────────────────────────────────────────────
    try:
        if event_type in ("payment", "payment.created", "payment.updated"):
            # Busca pagamento detalhado
            if data_id:
                payment = await mp.get_payment(str(data_id))
                await _process_payment_event(payment)
        elif "preapproval" in event_type.lower():
            if data_id:
                preapproval = await mp.get_preapproval(str(data_id))
                await _process_subscription_event(preapproval)
    except Exception as exc:
        logging.exception("[MP webhook] erro processando evento %s: %s", event_type, exc)
        # Registra o erro mas MANTÉM processed_at NULL → permite reprocesso.
        _req.patch(
            sb_evt_url,
            headers={**_sb_headers, "Content-Type": "application/json", "Prefer": "return=minimal"},
            params={"mp_event_id": f"eq.{event_key}"},
            json={"error_message": str(exc)[:500]},
            timeout=10,
        )
        # 503 → Mercado Pago reentrega o evento; reprocessamos no próximo POST.
        raise HTTPException(
            status_code=503,
            detail="Falha transitória ao processar webhook; retente.",
        )

    # Sucesso: marca processed_at e limpa erro de tentativas anteriores.
    _req.patch(
        sb_evt_url,
        headers={**_sb_headers, "Content-Type": "application/json", "Prefer": "return=minimal"},
        params={"mp_event_id": f"eq.{event_key}"},
        json={"processed_at": datetime.now(timezone.utc).isoformat(), "error_message": None},
        timeout=10,
    )
    return {"status": "ok"}


async def _process_payment_event(payment: dict) -> None:
    """Salva transação de pagamento + atualiza subscription se necessário."""
    import requests as _req
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    sb_url = f"{os.getenv('SUPABASE_URL', '').rstrip('/')}/rest/v1/payment_transactions"

    # ── ANTI-FRAUD: NÃO confia no external_reference ──────────────────────
    # Atacante poderia forjar external_reference apontando pra subscription
    # de outro usuário. Resolve user_id e subscription via:
    #   1º mp_preapproval_id (vem do MP, autêntico)
    #   2º payer.id ou payer.email do payment (cross-check)
    mp_preapproval_id = payment.get("preapproval_id") or (
        payment.get("metadata") or {}
    ).get("preapproval_id")
    payer_email = (payment.get("payer") or {}).get("email")
    ext_ref = payment.get("external_reference")
    amount_cents = int(round(float(payment.get("transaction_amount", 0)) * 100))

    payload = {
        "mp_payment_id": str(payment.get("id")),
        "amount_cents": amount_cents,
        "currency": payment.get("currency_id", "BRL"),
        "status": payment.get("status"),
        "payment_method": payment.get("payment_method_id"),
        "payment_type": payment.get("payment_type_id"),
        "description": payment.get("description"),
        "paid_at": payment.get("date_approved"),
        "raw_payload": payment,
    }
    # Resolve subscription pela ORDEM SEGURA:
    sub_row = None
    if mp_preapproval_id:
        sr = _req.get(
            f"{os.getenv('SUPABASE_URL', '').rstrip('/')}/rest/v1/subscriptions",
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
            params={"mp_preapproval_id": f"eq.{mp_preapproval_id}", "limit": "1"},
            timeout=10,
        )
        if sr.ok and sr.json():
            sub_row = sr.json()[0]
    if not sub_row and ext_ref and payer_email:
        # Fallback: external_reference + cross-check do email
        sr = _req.get(
            f"{os.getenv('SUPABASE_URL', '').rstrip('/')}/rest/v1/subscriptions",
            headers={"apikey": key, "Authorization": f"Bearer {key}"},
            params={
                "id": f"eq.{ext_ref}",
                "mp_payer_email": f"eq.{payer_email}",
                "limit": "1",
            },
            timeout=10,
        )
        if sr.ok and sr.json():
            sub_row = sr.json()[0]

    if not sub_row:
        logging.warning(
            "[MP webhook] payment %s sem subscription resolvível (preapproval=%s, ext_ref=%s, email=%s)",
            payment.get("id"), mp_preapproval_id, ext_ref, payer_email,
        )
        return

    payload["subscription_id"] = sub_row["id"]
    payload["user_id"] = sub_row["user_id"]
    payload["mp_preapproval_id"] = sub_row.get("mp_preapproval_id")

    _req.post(
        sb_url,
        headers={
            "apikey": key, "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        params={"on_conflict": "mp_payment_id"},
        json=payload,
        timeout=10,
    )


async def _process_subscription_event(preapproval: dict) -> None:
    """Sincroniza status da subscription com MP e invalida cache de entitlements."""
    import requests as _req
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    sb_url = f"{os.getenv('SUPABASE_URL', '').rstrip('/')}/rest/v1/subscriptions"
    _sb_headers = {"apikey": key, "Authorization": f"Bearer {key}"}

    mp_id = preapproval.get("id")
    if not mp_id:
        return

    # Resolve user_id ANTES do PATCH para poder invalidar o cache depois
    _affected_user_id: str | None = None
    try:
        _r = await asyncio.to_thread(
            _req.get,
            sb_url,
            headers=_sb_headers,
            params={"mp_preapproval_id": f"eq.{mp_id}", "select": "user_id"},
            timeout=10,
        )
        if _r.ok and _r.json():
            _affected_user_id = _r.json()[0].get("user_id")
    except Exception as _exc:
        logging.warning("[billing] falha ao resolver user_id para mp_id=%s: %s", mp_id, _exc)

    # Mapeia status MP → nosso
    mp_status = preapproval.get("status", "").lower()
    status_map = {
        "authorized": "authorized",
        "pending": "pending",
        "paused": "paused",
        "cancelled": "cancelled",
        "finished": "finished",
    }
    local_status = status_map.get(mp_status, "pending")

    update = {
        "status": local_status,
        "last_synced_at": datetime.now(timezone.utc).isoformat(),
    }
    if preapproval.get("next_payment_date"):
        update["current_period_end"] = preapproval["next_payment_date"]

    await asyncio.to_thread(
        _req.patch,
        sb_url,
        headers={**_sb_headers, "Content-Type": "application/json", "Prefer": "return=minimal"},
        params={"mp_preapproval_id": f"eq.{mp_id}"},
        json=update,
        timeout=10,
    )

    # Invalida cache de entitlements — o próximo request do usuário reflete o novo plano
    if _affected_user_id:
        billing_service.invalidate_cache(_affected_user_id)
        logging.info("[billing] cache invalidado para user_id=%s após evento MP %s→%s", _affected_user_id, mp_status, local_status)

def send_push_notification(
    subscription_info: dict,
    title: str,
    body: str,
    url: str = "/app/alerts",
) -> None:
    """
    Envia uma Web Push Notification via pywebpush + VAPID.

    subscription_info deve ter as chaves:
      {"endpoint": str, "keys": {"p256dh": str, "auth": str}}

    Usa as env vars VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY, VAPID_CLAIMS_EMAIL.
    Se alguma env var estiver ausente, loga warning e retorna sem crash.
    """
    vapid_private = os.getenv("VAPID_PRIVATE_KEY")
    vapid_public = os.getenv("VAPID_PUBLIC_KEY")
    vapid_email = os.getenv("VAPID_CLAIMS_EMAIL", "tracto@example.com")

    if not vapid_private or not vapid_public:
        logging.warning(
            "[push] VAPID_PRIVATE_KEY ou VAPID_PUBLIC_KEY não configurados — notificação não enviada."
        )
        return

    try:
        import json as _json
        from pywebpush import webpush, WebPushException

        webpush(
            subscription_info=subscription_info,
            data=_json.dumps({"title": title, "body": body, "url": url}),
            vapid_private_key=vapid_private,
            vapid_claims={"sub": f"mailto:{vapid_email}"},
        )
        logging.info("[push] Notificação enviada para endpoint=%s", subscription_info.get("endpoint", "?")[:60])
    except Exception as exc:
        logging.warning("[push] Falha ao enviar notificação push: %s", exc)


@app.post("/api/push/subscribe")
async def push_subscribe(req: PushSubscriptionCreate, user: AuthenticatedUser = Depends(get_current_user)):
    entitlements = billing_service.get_entitlements(user.id)
    if not entitlements.get("can_use_push"):
        raise HTTPException(status_code=403, detail="Notificacoes push exigem plano Profissional.")

    import requests as _req

    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY", "")
    if not supabase_url or not supabase_key:
        raise HTTPException(status_code=500, detail="Supabase nao configurado.")

    payload = {
        "user_id": user.id,
        "endpoint": req.endpoint,
        "p256dh": req.p256dh,
        "auth": req.auth,
    }
    resp = _req.post(
        f"{supabase_url}/rest/v1/push_subscriptions",
        headers={
            "apikey": supabase_key,
            "Authorization": f"Bearer {supabase_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
        json=payload,
        timeout=10,
    )
    if resp.status_code >= 300:
        logging.error("[push] Falha ao salvar subscription: %s %s", resp.status_code, resp.text[:300])
        raise HTTPException(status_code=502, detail="Falha ao salvar inscricao de push.")

    return {"status": "ok", "message": "Inscricao de push salva com sucesso na base de dados."}

@app.post("/webhooks/whatsapp")
async def whatsapp_webhook(request: Request):
    """
    Webhook Z-API para mensagens WhatsApp recebidas.
    Suporta JSON (Z-API) e form-urlencoded (Twilio legado).
    """
    # ── Autenticação da Z-API ─────────────────────────────────────────────────
    # Valida o token enviado pela Z-API no header 'client-token'.
    # Configure ZAPI_WEBHOOK_SECRET nas variáveis de ambiente da Vercel.
    # Em produção, a ausência do secret rejeita todas as requisições.
    import hmac as _hmac
    _zapi_secret = os.getenv("ZAPI_WEBHOOK_SECRET", "").strip()
    _is_prod = os.getenv("ENVIRONMENT", "development").strip().lower() in ("production", "prod")
    if _zapi_secret:
        _token_received = (
            request.headers.get("client-token")
            or request.headers.get("x-client-token")
            or ""
        ).strip()
        if not _hmac.compare_digest(_token_received, _zapi_secret):
            logging.warning("[whatsapp] Webhook recebido com token inválido — rejeitado.")
            raise HTTPException(status_code=401, detail="Token de webhook inválido.")
    elif _is_prod:
        logging.error("[whatsapp] ZAPI_WEBHOOK_SECRET não configurada em produção — rejeitando requisição.")
        raise HTTPException(status_code=401, detail="Webhook não configurado. Contate o administrador.")

    phone = ""
    body = ""
    try:
        content_type = request.headers.get("content-type", "")
        if "application/json" in content_type:
            payload_json = await request.json()
            phone = str(payload_json.get("phone", "")).strip()
            text_obj = payload_json.get("text") or {}
            body = str(text_obj.get("message", "") if isinstance(text_obj, dict) else text_obj).strip()
        else:
            form_data = await request.form()
            phone = str(form_data.get("From", "") or form_data.get("phone", "")).strip()
            body = str(form_data.get("Body", "") or form_data.get("message", "")).strip()
    except Exception as exc:
        logging.warning("[whatsapp] Erro ao parsear payload: %s", exc)
        return {"status": "ignored", "reason": "Payload inválido"}

    if not phone:
        return {"status": "ignored", "reason": "Número de remetente ausente"}

    if not body:
        return {"status": "ignored", "reason": "Mensagem vazia"}

    # Verifica se o número está cadastrado na tabela profiles
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    supabase_key = os.getenv("SUPABASE_SERVICE_KEY", "")
    user_id: str | None = None

    if supabase_url and supabase_key:
        try:
            import requests as _req
            profiles_resp = _req.get(
                f"{supabase_url}/rest/v1/profiles",
                headers={
                    "apikey": supabase_key,
                    "Authorization": f"Bearer {supabase_key}",
                },
                params={
                    "phone": f"eq.{phone}",
                    "select": "id",
                    "limit": "1",
                },
                timeout=8,
            )
            profiles_resp.raise_for_status()
            profiles = profiles_resp.json()
            if isinstance(profiles, list) and profiles:
                user_id = profiles[0].get("id")
        except Exception as exc:
            logging.warning("[whatsapp] Erro ao buscar perfil phone=%s: %s", phone, exc)

    if not user_id:
        logging.info("[whatsapp] Número %s não registrado na Tracto — ignorando.", phone)
        return {"status": "ok", "message": "Número não registrado. Mensagem ignorada."}

    # ── Verifica entitlement can_use_whatsapp ─────────────────────────────────
    try:
        _wa_ent = await asyncio.to_thread(billing_service.get_entitlements, user_id)
        if not _wa_ent.get("can_use_whatsapp", False):
            logging.info("[whatsapp] user_id=%s plano não inclui WhatsApp — ignorando.", user_id)
            return {"status": "ok", "message": "Plano não inclui atendimento via WhatsApp."}
    except Exception as _ent_exc:
        logging.warning("[whatsapp] Erro ao verificar entitlement user_id=%s: %s — bloqueando por segurança.", user_id, _ent_exc)
        return {"status": "ok", "message": "Não foi possível verificar o plano. Tente novamente."}

    # Busca contexto agronômico da fazenda do usuário
    farm_context_str = "Fazenda sem dados disponíveis no momento."
    try:
        farms = await farm_service.async_get_farms(user_id)
        if farms:
            farm_names = [f.get("name", "") for f in farms if f.get("name")]
            farm_context_str = f"Fazendas do produtor: {', '.join(farm_names)}."
    except Exception as exc:
        logging.warning("[whatsapp] Erro ao buscar fazendas user_id=%s: %s", user_id, exc)
    
    # Gera resposta com Tracto AI e envia via Z-API
    reply_text = ""
    # [Z-API send below] Ã  API do WhatsApp/Twilio
    try:
        reply_text = await asyncio.to_thread(
            generate_chat_response,
            message=body,
            context=(
                f"Origem: WhatsApp. {farm_context_str} "
                "Responda de forma concisa e prática como Tracto AI via WhatsApp."
            ),
            history=[],
        )
    except Exception as exc:
        logging.warning("[whatsapp] Erro ao gerar resposta AI user_id=%s: %s", user_id, exc)
        reply_text = "Olá! Recebi sua mensagem. No momento estou com dificuldade de processar sua solicitação. Tente novamente em instantes."
    # MOCK ESTRUTURAL DE SAÃDA:
    # A Tracto AI roda perfeitamente o contexto, mas a resposta NÃƒO Ã© devolvida
    # pois nÃ£o temos a API do WhatsApp/Twilio configurada e tokenizada.
    # O despache morre em um logger seguro.
    # Envia resposta via Z-API
    sent = await send_whatsapp_reply(phone=phone, message=reply_text)
    logging.info("[whatsapp] phone=%s user_id=%s enviado=%s", phone, user_id, sent)
    return {"status": "ok", "sent": sent}

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


def _planet_cookie_options(request: Request) -> dict:
    """
    Ajusta cookie de sessão Planet para funcionar em deploy cross-origin
    (frontend e backend em domínios diferentes) sem quebrar dev local.
    """
    origin = (request.headers.get("origin") or "").strip().lower()
    is_local_origin = ("localhost" in origin) or ("127.0.0.1" in origin)
    is_https_context = request.url.scheme == "https" or origin.startswith("https://")

    force_cross_site = os.getenv("PLANET_COOKIE_CROSS_SITE", "false").strip().lower() == "true"

    if force_cross_site or (_is_production() and is_https_context and not is_local_origin):
        return {"secure": True, "samesite": "none"}

    return {"secure": False, "samesite": "lax"}


def _build_farm_context_from_snapshot(snapshot: FieldIntelligenceSnapshot) -> str:
    return _build_farm_context_from_metadata(
        metadata={
            "field_id": snapshot.field_id,
            "field_name": snapshot.field_name,
            "crop_type": snapshot.crop_type,
            "variety": snapshot.variety,
            "planting_date": snapshot.planting_date,
            "area_ha": snapshot.area_ha,
            "lat": snapshot.lat,
            "lng": snapshot.lng,
        },
        snapshot=snapshot,
    )


def _build_canonical_chat_metadata(snapshot: FieldIntelligenceSnapshot, field_data: dict) -> dict:
    def _pick(*values):
        for value in values:
            if value is None:
                continue
            if isinstance(value, str) and not value.strip():
                continue
            return value
        return None

    return {
        "field_id": _pick(field_data.get("id"), snapshot.field_id),
        "field_name": _pick(field_data.get("name"), snapshot.field_name, "Talhao"),
        "crop_type": _pick(field_data.get("crop_type"), snapshot.crop_type),
        "variety": _pick(field_data.get("variety"), snapshot.variety),
        "planting_date": _pick(field_data.get("planting_date"), snapshot.planting_date),
        "area_ha": _pick(field_data.get("area_ha"), snapshot.area_ha),
        "lat": _pick(field_data.get("latitude"), snapshot.lat),
        "lng": _pick(field_data.get("longitude"), snapshot.lng),
    }


def _build_farm_context_from_metadata(metadata: dict, snapshot: FieldIntelligenceSnapshot) -> str:
    weather = snapshot.weather or {}
    satellite = snapshot.satellite or {}
    analysis = snapshot.analysis or {}

    def _safe(value, fallback: str = "N/D") -> str:
        if value is None:
            return fallback
        text = str(value).strip()
        return text if text else fallback

    def _area_text(value) -> str:
        if value is None:
            return "Área N/D"
        try:
            return f"{float(value):.2f} ha"
        except (TypeError, ValueError):
            return _safe(value, "Área N/D")

    def _coord_text(lat, lng) -> str:
        try:
            return f"{float(lat):.6f}, {float(lng):.6f}"
        except (TypeError, ValueError):
            return "N/D"

    spray = (analysis.get("spray_window") or {}).get("label") if isinstance(analysis, dict) else "N/D"
    frost = (analysis.get("frost_risk") or {}).get("label") if isinstance(analysis, dict) else "N/D"
    water = (analysis.get("water_stress") or {}).get("label") if isinstance(analysis, dict) else "N/D"

    return "\n".join([
        "METADADOS CANONICOS DO TALHAO:",
        f"- field_id: {_safe(metadata.get('field_id'))}",
        f"- field_name: {_safe(metadata.get('field_name'))}",
        f"- crop_type: {_safe(metadata.get('crop_type'))}",
        f"- variety: {_safe(metadata.get('variety'))}",
        f"- planting_date: {_safe(metadata.get('planting_date'))}",
        f"- area_ha: {_area_text(metadata.get('area_ha'))}",
        f"- coordinates: {_coord_text(metadata.get('lat'), metadata.get('lng'))}",
        f"TALHÃO ATIVO: {_safe(metadata.get('field_name'))} | {_safe(metadata.get('crop_type'))} | {_area_text(metadata.get('area_ha'))} | {_safe(metadata.get('planting_date'))}",
        f"Variedade: {_safe(metadata.get('variety'))}",
        f"Clima atual: Temp {_safe(weather.get('temperature'))}C, Umidade {_safe(weather.get('humidity'))}%, Vento {_safe(weather.get('wind_speed'))} km/h",
        f"Última cena Sentinel-2: {_safe(satellite.get('s2_scene_date') or satellite.get('scene_date'))}",
        f"Última cena Sentinel-1: {_safe(satellite.get('s1_scene_date'))}",
        f"Cache da imagem: hit={_safe(satellite.get('cache_hit'))} | path={_safe(satellite.get('cache_path'))} | gerado={_safe(satellite.get('generated_at'))}",
        f"Análise consolidada: Pulverização {_safe(spray)}, Geada {_safe(frost)}, Estresse hídrico {_safe(water)}",
        f"Atualizado em: {_safe(snapshot.updated_at)}",
    ])


# ── Controle de limite diário de mensagens de chat por usuário ────────────────
# Primário: Supabase (tabela chat_usage) — sobrevive a restarts e múltiplas instâncias.
# Fallback: dict em memória com lock (usado quando Supabase está indisponível).
#
# Schema necessário no Supabase (executar uma vez):
#   CREATE TABLE IF NOT EXISTS chat_usage (
#     user_id    TEXT NOT NULL,
#     usage_date DATE NOT NULL,
#     count      INTEGER NOT NULL DEFAULT 0,
#     updated_at TIMESTAMPTZ DEFAULT NOW(),
#     PRIMARY KEY (user_id, usage_date)
#   );
import threading as _threading
_chat_usage: dict[str, tuple[int, str]] = {}  # user_id → (count, date_str)
_chat_lock = _threading.Lock()

_CHAT_LIMIT_429 = (
    "Limite diário de {limit} mensagens atingido. "
    "Seu contador reinicia à meia-noite (UTC). "
    "Faça upgrade para um plano com mais mensagens."
)


def _check_daily_chat_limit_memory(user_id: str, daily_limit: int) -> None:
    """Fallback em memória (single-instance, reseta com restart)."""
    today = datetime.utcnow().strftime("%Y-%m-%d")
    with _chat_lock:
        count, date = _chat_usage.get(user_id, (0, today))
        if date != today:
            count = 0
        count += 1
        _chat_usage[user_id] = (count, today)
        if count > daily_limit:
            raise HTTPException(
                status_code=429,
                detail=_CHAT_LIMIT_429.format(limit=daily_limit),
            )


async def _check_daily_chat_limit(user_id: str, daily_limit: int) -> None:
    """
    Incrementa e verifica o contador diário no Supabase.
    Fallback para memória se Supabase estiver indisponível.

    Race condition em multi-instância é tolerada: a tabela chat_usage
    garante persistência entre restarts, que é o risco mais crítico.
    """
    today = datetime.utcnow().strftime("%Y-%m-%d")
    try:
        import requests as _req_chat
        _key = os.getenv("SUPABASE_SERVICE_KEY", "")
        _sb = f"{os.getenv('SUPABASE_URL', '').rstrip('/')}/rest/v1/chat_usage"
        _hdrs = {"apikey": _key, "Authorization": f"Bearer {_key}"}

        # Lê contagem atual
        get_resp = await asyncio.to_thread(
            _req_chat.get, _sb,
            headers=_hdrs,
            params={"user_id": f"eq.{user_id}", "usage_date": f"eq.{today}", "select": "count"},
            timeout=3,
        )
        current = 0
        if get_resp.ok:
            rows = get_resp.json()
            if isinstance(rows, list) and rows:
                current = int(rows[0].get("count", 0))

        new_count = current + 1

        # Upsert com novo valor
        await asyncio.to_thread(
            _req_chat.post, _sb,
            headers={**_hdrs, "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"},
            params={"on_conflict": "user_id,usage_date"},
            json={"user_id": user_id, "usage_date": today, "count": new_count, "updated_at": datetime.utcnow().isoformat()},
            timeout=3,
        )

        if new_count > daily_limit:
            raise HTTPException(
                status_code=429,
                detail=_CHAT_LIMIT_429.format(limit=daily_limit),
            )
        return

    except HTTPException:
        raise
    except Exception as exc:
        logging.warning("[chat_limit] Supabase indisponível — usando fallback em memória: %s", exc)

    _check_daily_chat_limit_memory(user_id, daily_limit)


@app.post("/api/chat")
@limiter.limit("5/minute")
async def chat_endpoint(request: Request, chat_req: ChatRequest, _user: AuthenticatedUser = Depends(get_current_user)) -> ChatResponse:
    try:
        # ── Verificação de entitlement: plano precisa ter has_ia_chat ──────────
        # asyncio.to_thread evita bloquear o event loop (billing_service usa requests síncrono)
        ent = await asyncio.to_thread(billing_service.get_entitlements, _user.id, _user.email)
        if not ent.get("has_ia_chat", False):
            raise HTTPException(
                status_code=403,
                detail="Acesso à Tracto IA não está incluído no seu plano atual. Faça upgrade para continuar.",
            )

        # ── Limite diário de mensagens por usuário ─────────────────────────────
        # Dono: ilimitado | Pro: 100/dia | enterprise: 200 | outros com IA: 30
        plan_id = ent.get("plan_id", "free")
        daily_limit = (
            1_000_000 if ent.get("is_owner") or plan_id == "owner"
            else 100 if plan_id == "pro"
            else 200 if plan_id == "enterprise"
            else 30
        )
        await _check_daily_chat_limit(_user.id, daily_limit)

        # field_id canônico e obrigatório
        if not chat_req.field_id or not chat_req.field_id.strip():
            raise HTTPException(status_code=400, detail="field_id inválido ou ausente. Selecione um talhão ativo antes de enviar a pergunta.")

        canonical_field_id = chat_req.field_id.strip()

        # ownership validado no backend (nunca confiar no cliente)
        field_data = await farm_service.async_get_field_by_id(_user.id, canonical_field_id)
        if not field_data:
            raise HTTPException(
                status_code=404,
                detail="Talhão não encontrado, removido ou sem permissão de acesso. Selecione um talhão válido.",
            )

        if not chat_req.messages:
            raise HTTPException(status_code=400, detail="O historico de mensagens esta vazio.")

        # contexto SEMPRE canônico do snapshot backend para o field_id validado
        try:
            snapshot = await build_field_intelligence_snapshot(user_id=_user.id, field_id=canonical_field_id, force_refresh=False)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except Exception as exc:
            logging.error("Falha ao montar snapshot canônico no chat field_id=%s: %s", canonical_field_id, exc)
            raise HTTPException(
                status_code=503,
                detail="Snapshot do talhão indisponível no momento. Tente novamente em alguns segundos.",
            ) from exc

        if not snapshot:
            raise HTTPException(
                status_code=409,
                detail="Snapshot do talhão indisponível. Não é possível responder com segurança sem contexto canônico.",
            )

        canonical_metadata = _build_canonical_chat_metadata(snapshot, field_data)
        farm_context = _build_farm_context_from_metadata(canonical_metadata, snapshot)

        # ── INTEGRAÇÃO CADERNO DE CAMPO ─────────────────────────────────────
        # Busca eventos recentes do caderno (todas as categorias) e adiciona
        # ao contexto da IA. Permite que ela responda sobre:
        #   - Pulverizações registradas (produto, dose, data)
        #   - Adubações + Irrigações
        #   - Ocorrências fitossanitárias (pragas/doenças/plantas daninhas)
        #   - Colheitas (produtividade real)
        #   - Análises de solo importadas
        #   - Observações anotadas pelo produtor
        try:
            notebook_events = await get_notebook_events(canonical_field_id, _user.id, limit=50)
            if notebook_events:
                # Ordena por data ocorrência (mais recente primeiro)
                notebook_events.sort(key=lambda e: e.get('occurred_at') or e.get('created_at') or '', reverse=True)
                events_lines = ["", "CADERNO DE CAMPO — REGISTROS RECENTES (últimos 50):"]
                for ev in notebook_events[:50]:
                    cat = ev.get('category', '?')
                    date = (ev.get('occurred_at') or '')[:10]
                    title = ev.get('title') or '(sem título)'
                    data = ev.get('data') or {}
                    extras = []
                    if isinstance(data, dict):
                        for k in ('product', 'pest_name', 'disease_name', 'species', 'dose_l_ha', 'dose_kg_ha',
                                  'incidence_pct', 'infestation_level', 'volume_L_ha', 'method', 'real_yield_sc_ha',
                                  'estimated_yield_sc_ha', 'NPK', 'pH', 'notes', 'purpose', 'duration_h', 'volume_mm'):
                            v = data.get(k)
                            if v is not None and str(v).strip():
                                extras.append(f"{k}={v}")
                    extras_str = f" | {' · '.join(extras)}" if extras else ""
                    events_lines.append(f"- [{date}] {cat.upper()}: {title}{extras_str}")
                    if ev.get('ai_analysis'):
                        events_lines.append(f"    Análise prévia IA: {ev['ai_analysis'][:200]}")
                farm_context = farm_context + "\n" + "\n".join(events_lines)
        except Exception as _nb_exc:
            logging.warning("[chat] Falha ao injetar caderno no contexto field_id=%s: %s", canonical_field_id, _nb_exc)

        reply = generate_chat_response(
            messages=[message.model_dump() for message in chat_req.messages],
            farm_context=farm_context,
            image_base64=chat_req.image_base64,
            image_mime_type=chat_req.image_mime_type or "image/jpeg",
            hourly_weather=chat_req.hourly_weather,
            user_profile=chat_req.user_profile,
            research_context=chat_req.research_context,
        )

        satellite = snapshot.satellite or {}
        return ChatResponse(
            reply=reply,
            used_field_id=str(canonical_metadata.get("field_id") or snapshot.field_id),
            used_field_name=str(canonical_metadata.get("field_name") or snapshot.field_name),
            used_variety=canonical_metadata.get("variety"),
            used_area_ha=float(canonical_metadata.get("area_ha")) if canonical_metadata.get("area_ha") is not None else None,
            used_planting_date=canonical_metadata.get("planting_date"),
            snapshot_updated_at=snapshot.updated_at,
            s1_scene_date=satellite.get("s1_scene_date"),
            s2_scene_date=satellite.get("s2_scene_date") or satellite.get("scene_date"),
        )
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


@app.post("/api/field-notebook/analyze-document", response_model=FieldDocumentAnalysisResponse)
@limiter.limit("5/minute")
async def analyze_field_document_endpoint(
    request: Request,
    body: FieldDocumentAnalysisRequest,
    _user: AuthenticatedUser = Depends(get_current_user),
):
    allowed_mimes = {"application/pdf", "image/jpeg", "image/png", "image/webp"}
    if body.mime_type not in allowed_mimes:
        raise HTTPException(status_code=400, detail="Formato nao suportado. Envie PDF, JPG, PNG ou WEBP.")

    if len(body.file_base64) > 14_000_000:
        raise HTTPException(status_code=413, detail="Arquivo muito grande. Envie um anexo de ate aproximadamente 10 MB.")

    return analyze_field_document(
        file_base64=body.file_base64,
        mime_type=body.mime_type,
        file_name=body.file_name,
        notebook_section=body.notebook_section,
        field_name=body.field_name,
        notes=body.notes,
    )


@app.get("/api/sentinel/scenes")
@limiter.limit("30/minute")
async def sentinel_scenes_endpoint(
    request: Request,
    field_id: str,
    lookback_days: int = 90,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Retorna cenas Sentinel-1 e Sentinel-2 disponíveis para o talhão
    nos últimos `lookback_days` dias, via Earth Search STAC (gratuito).
    """
    try:
        lookback_days = min(max(lookback_days, 7), 180)

        field_data = await farm_service.async_get_field_by_id(user.id, field_id)
        if not field_data:
            raise HTTPException(
                status_code=404,
                detail="Talhão não encontrado ou sem permissão de acesso.",
            )

        lat = float(field_data.get("latitude", 0))
        lng = float(field_data.get("longitude", 0))
        boundaries = field_data.get("boundaries")

        scenes = get_available_scenes(
            lat=lat,
            lng=lng,
            boundaries=boundaries,
            lookback_days=lookback_days,
            max_results_per_source=5,
        )

        return {
            "field_id": field_id,
            "lookback_days": lookback_days,
            "s2": scenes.get("s2", []),
            "s1": scenes.get("s1", []),
            "s1_available": False,
            "total": len(scenes.get("s2", [])) + len(scenes.get("s1", [])),
        }

    except HTTPException:
        raise
    except Exception as exc:
        logging.error("[/api/sentinel/scenes] Erro field_id=%s: %s", field_id, exc)
        raise HTTPException(status_code=500, detail="Erro ao buscar cenas disponíveis.") from exc


@app.get("/api/sentinel/overlay")
@limiter.limit("20/minute")
async def sentinel_overlay_endpoint(
    request: Request,
    field_id: str,
    source: str = "s2",
    scene_date: str | None = None,
    scene_id: str | None = None,
    cloud_coverage: float | None = None,
    force_refresh: bool = False,
    mode: str = "truecolor",
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Gera e retorna PNG recortado no polígono do talhão via Sentinel Hub Process API.
    source: 's2' (True Color) ou 's1' (Radar SAR). scene_date: ISO date opcional.
    Cache em 2 camadas: memória in-process + Supabase Storage persistente.
    X-Cache: HIT = imagem reutilizada, MISS = gerada agora e salva.
    """
    if source not in ("s1", "s2"):
        raise HTTPException(status_code=400, detail="source deve ser 's1' ou 's2'.")
    if mode not in ("truecolor", "ndvi", "ndre", "evi", "ndmi", "falsecolor", "agriculture"):
        raise HTTPException(status_code=400, detail="mode inválido.")

    # Verifica entitlement de satélite antes de qualquer chamada externa paga
    _sat_ent = await asyncio.to_thread(billing_service.get_entitlements, user.id, user.email)
    if not _sat_ent.get("has_satellite", False):
        raise HTTPException(
            status_code=403,
            detail="Imagens de satélite não estão incluídas no seu plano atual. Faça upgrade para acessar Sentinel, Planet e UP42.",
        )

    try:
        field_data = await farm_service.async_get_field_by_id(user.id, field_id)
        if not field_data:
            raise HTTPException(
                status_code=404,
                detail="Talhão não encontrado ou sem permissão de acesso.",
            )

        lat = float(field_data.get("latitude", 0))
        lng = float(field_data.get("longitude", 0))
        boundaries = field_data.get("boundaries")
        farm_id = field_data.get("farm_id")

        # Verifica credenciais antes de chamar a API paga
        sentinel_id = os.getenv("SENTINEL_CLIENT_ID")
        sentinel_secret = os.getenv("SENTINEL_CLIENT_SECRET")
        if not sentinel_id or not sentinel_secret:
            raise HTTPException(
                status_code=503,
                detail=(
                    "Credenciais Sentinel Hub não configuradas. "
                    "Adicione SENTINEL_CLIENT_ID e SENTINEL_CLIENT_SECRET nas variáveis de ambiente do servidor. "
                    "Obtenha suas credenciais em: https://shapps.dataspace.copernicus.eu/"
                ),
            )

        image_bytes, cache_info = await asyncio.to_thread(
            get_sentinel_overlay_with_cache,
            user.id,
            field_id,
            farm_id,
            lat,
            lng,
            boundaries,
            scene_date,
            source,
            mode,
            scene_id,
            force_refresh,
        )

        if not image_bytes:
            raise HTTPException(
                status_code=503,
                detail=(
                    f"Imagem Sentinel-{'2' if source == 's2' else '1'} não disponível para este talhão e data selecionada. "
                    "Possíveis causas: cobertura de nuvens alta, janela de tempo sem imagem, ou limite de processamento atingido. "
                    "Tente outra data ou aguarde alguns minutos."
                ),
            )

        # X-Scene-Bounds: bbox real usado no recorte (formato SWNE: south,west,north,east)
        # Frontend usa pra criar Leaflet bounds EXATOS sem recalcular.
        scene_bounds_header = None
        bbox = cache_info.get("bbox")
        if bbox and len(bbox) == 4:
            # bbox = [min_lng, min_lat, max_lng, max_lat] → SWNE = south,west,north,east
            scene_bounds_header = f"{bbox[1]},{bbox[0]},{bbox[3]},{bbox[2]}"

        response_headers = {
            # max-age curto + must-revalidate força o browser a re-checar headers
            # (incluindo X-Scene-Bounds) em vez de servir PNG antigo do disk cache.
            "Cache-Control": "public, max-age=300, must-revalidate",
            "X-Field-ID": field_id,
            "X-Source": source.upper(),
            "X-Cache": "HIT" if cache_info.get("cache_hit") else "MISS",
            "X-Scene-Date": cache_info.get("scene_date") or scene_date or "latest",
            "X-Mode": mode,
            "X-Cache-Source": cache_info.get("cache_source") or "unknown",
        }
        if scene_bounds_header:
            response_headers["X-Scene-Bounds"] = scene_bounds_header

        return Response(
            content=image_bytes,
            media_type="image/png",
            headers=response_headers,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logging.error("[/api/sentinel/overlay] Erro field_id=%s source=%s: %s", field_id, source, exc)
        raise HTTPException(status_code=500, detail="Erro interno ao gerar overlay Sentinel.") from exc


@app.post("/api/sentinel/preload")
@limiter.limit("20/minute")
async def sentinel_preload_endpoint(
    request: Request,
    body: SentinelPreloadRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Pré-aquece o cache de uma cena Sentinel antes de o usuário abrir Chat/Relatórios.
    Gera a imagem e salva no Supabase Storage + satellite_artifacts se ainda não existir.
    """
    try:
        field_data = await farm_service.async_get_field_by_id(user.id, body.field_id)
        if not field_data:
            raise HTTPException(status_code=404, detail="Talhão não encontrado ou sem permissão de acesso.")

        lat = float(field_data.get("latitude", 0))
        lng = float(field_data.get("longitude", 0))
        boundaries = field_data.get("boundaries")
        farm_id = field_data.get("farm_id")

        sentinel_id = os.getenv("SENTINEL_CLIENT_ID")
        sentinel_secret = os.getenv("SENTINEL_CLIENT_SECRET")
        if not sentinel_id or not sentinel_secret:
            raise HTTPException(status_code=503, detail="Credenciais Sentinel Hub não configuradas.")

        _bytes, cache_info = await asyncio.to_thread(
            get_sentinel_overlay_with_cache,
            user.id,
            body.field_id,
            farm_id,
            lat,
            lng,
            boundaries,
            body.scene_date,
            body.source,
            body.mode,
            body.scene_id,
            body.force_refresh,
        )

        return {
            "ok": _bytes is not None,
            "field_id": body.field_id,
            "source": body.source,
            "mode": body.mode,
            "scene_id": body.scene_id,
            "scene_date": cache_info.get("scene_date"),
            "cache_hit": cache_info.get("cache_hit", False),
            "image_cached": cache_info.get("cache_hit", False),
            "cache_path": cache_info.get("cache_path"),
            "cache_source": cache_info.get("cache_source"),
            "generated_at": cache_info.get("generated_at"),
        }
    except HTTPException:
        raise
    except Exception as exc:
        logging.error("[/api/sentinel/preload] Erro field_id=%s source=%s: %s", body.field_id, body.source, exc)
        raise HTTPException(status_code=500, detail="Erro ao pré-carregar imagem Sentinel.") from exc


@app.get("/api/planet/scenes")
@limiter.limit("20/minute")
async def planet_scenes_endpoint(
    request: Request,
    field_id: str,
    lookback_days: int = 90,
    user: AuthenticatedUser = Depends(get_current_user),
):
    try:
        lookback_days = min(max(lookback_days, 7), 90)
        field_data = await farm_service.async_get_field_by_id(user.id, field_id)
        if not field_data:
            raise HTTPException(status_code=404, detail="Talhão não encontrado.")
        lat = float(field_data.get("latitude", 0))
        lng = float(field_data.get("longitude", 0))
        boundaries = field_data.get("boundaries")
        scenes = get_planet_scenes(lat=lat, lng=lng, boundaries=boundaries, lookback_days=lookback_days)
        return {"field_id": field_id, "scenes": scenes, "total": len(scenes)}
    except HTTPException:
        raise
    except Exception as exc:
        logging.error("[/api/planet/scenes] Erro field_id=%s: %s", field_id, exc)
        raise HTTPException(status_code=500, detail="Erro ao buscar cenas Planet.") from exc


@app.get("/api/planet/thumbnail/{scene_id}")
@limiter.limit("30/minute")
async def planet_thumbnail_endpoint(
    request: Request,
    scene_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    image_bytes = get_planet_thumbnail(scene_id)
    if not image_bytes:
        raise HTTPException(status_code=503, detail="Thumbnail Planet não disponível.")
    return Response(
        content=image_bytes,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=3600"},
    )


@app.get("/api/planet/scene-overlay")
@limiter.limit("30/minute")
async def planet_scene_overlay_endpoint(
    request: Request,
    scene_id: str,
    field_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    return await _planet_overlay_response(field_id=field_id, scene_id=scene_id, user=user)


@app.post("/api/planet/tile-session")
@limiter.limit("20/minute")
async def planet_tile_session_endpoint(
    request: Request,
    response: Response,
    field_id: str,
    scene_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    field_data = await farm_service.async_get_field_by_id(user.id, field_id)
    if not field_data:
        raise HTTPException(status_code=404, detail="Talhão não encontrado.")

    session_token = create_planet_tile_session(user.id, field_id, scene_id)
    cookie_options = _planet_cookie_options(request)
    response.set_cookie(
        key="planet_tile_session",
        value=session_token,
        httponly=True,
        max_age=600,
        path="/api/planet/tiles",
        secure=cookie_options["secure"],
        samesite=cookie_options["samesite"],
    )
    # Retorna o token também no body para que o frontend possa usá-lo como
    # query param no TileLayer — contorna limitações de cookie cross-origin.
    return {"ok": True, "scene_id": scene_id, "expires_in": 600, "tile_token": session_token}


@app.get("/api/planet/tiles/{z}/{x}/{y}")
@limiter.limit("1200/minute")
async def planet_tile_proxy_endpoint(
    request: Request,
    z: int,
    x: int,
    y: int,
    scene_id: str,
    planet_tile_session: str | None = Cookie(default=None),
    tile_token: str | None = Query(default=None),
):
    # Cookie tem prioridade; tile_token (query param) é o fallback cross-origin
    effective_token = planet_tile_session or tile_token
    session_status = get_planet_tile_session_status(effective_token, scene_id)
    if session_status != "ok":
        logging.info(
            "[/api/planet/tiles] Sessao rejeitada scene_id=%s z=%s x=%s y=%s status=%s",
            scene_id,
            z,
            x,
            y,
            session_status,
        )
        detail_by_status = {
            "missing": "Sessão Planet ausente. Reabra a cena para renovar a sessão.",
            "expired": "Sessão Planet expirada. Reabra a cena para continuar.",
            "scene_mismatch": "Sessão Planet inválida para esta cena. Selecione a cena novamente.",
            "invalid": "Sessão Planet inválida. Reabra a cena para renovar a sessão.",
        }
        raise HTTPException(status_code=401, detail=detail_by_status.get(session_status, "Sessão Planet inválida."))

    tile_bytes, content_type = get_planet_tile(scene_id=scene_id, z=z, x=x, y=y)
    return Response(
        content=tile_bytes,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=900"},
    )


@app.get("/api/planet/overlay")
@limiter.limit("10/minute")
async def planet_overlay_endpoint(
    request: Request,
    field_id: str,
    scene_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    return await _planet_overlay_response(field_id=field_id, scene_id=scene_id, user=user)


async def _planet_overlay_response(
    field_id: str,
    scene_id: str,
    user: AuthenticatedUser,
) -> Response:
    _planet_ent = await asyncio.to_thread(billing_service.get_entitlements, user.id, user.email)
    if not _planet_ent.get("has_satellite", False):
        raise HTTPException(
            status_code=403,
            detail="Imagens de satélite não estão incluídas no seu plano atual. Faça upgrade para acessar Planet.",
        )

    field_data = await farm_service.async_get_field_by_id(user.id, field_id)
    if not field_data:
        raise HTTPException(status_code=404, detail="Talhão não encontrado.")

    lat = float(field_data.get("latitude", 0))
    lng = float(field_data.get("longitude", 0))
    boundaries = field_data.get("boundaries")

    overlay_data = await asyncio.to_thread(
        get_planet_overlay,
        field_id,
        scene_id,
        lat,
        lng,
        boundaries,
    )

    if not overlay_data or not overlay_data.get("image_bytes"):
        raise HTTPException(
            status_code=503,
            detail=(
                "Imagem Planet indisponível para esta cena e talhão. "
                "Tente outra cena ou aguarde a ativação do asset de alta resolução."
            ),
        )

    bounds = overlay_data.get("bounds") or get_bbox_from_boundaries(boundaries, lat, lng)
    bounds_header = ",".join(f"{float(value):.6f}" for value in bounds)

    headers = {
        "Cache-Control": "public, max-age=1800",
        "X-Field-ID": field_id,
        "X-Scene-Id": scene_id,
        "X-Scene-Bounds": bounds_header,
    }

    asset_status = overlay_data.get("asset_status")
    if asset_status:
        headers["X-Asset-Status"] = str(asset_status)

    image_quality = overlay_data.get("image_quality")
    if image_quality:
        headers["X-Image-Quality"] = str(image_quality)

    return Response(
        content=overlay_data["image_bytes"],
        media_type=str(overlay_data.get("content_type") or "image/png"),
        headers=headers,
    )


@app.get("/api/up42/scenes")
@limiter.limit("20/minute")
async def up42_scenes_endpoint(
    request: Request,
    field_id: str,
    lookback_days: int = 90,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Busca cenas disponíveis no marketplace Up42 para o talhão."""
    try:
        lookback_days = min(max(lookback_days, 7), 180)
        field_data = await farm_service.async_get_field_by_id(user.id, field_id)
        if not field_data:
            raise HTTPException(status_code=404, detail="Talhão não encontrado.")
        lat = float(field_data.get("latitude", 0))
        lng = float(field_data.get("longitude", 0))
        boundaries = field_data.get("boundaries")
        scenes = await asyncio.to_thread(
            search_up42_scenes,
            lat=lat, lng=lng, boundaries=boundaries, lookback_days=lookback_days,
        )
        return {"field_id": field_id, "scenes": scenes, "total": len(scenes)}
    except HTTPException:
        raise
    except Exception as exc:
        logging.error("[/api/up42/scenes] Erro field_id=%s: %s", field_id, exc)
        raise HTTPException(status_code=500, detail="Erro ao buscar cenas Up42.") from exc


@app.get("/api/up42/overlay")
@limiter.limit("15/minute")
async def up42_overlay_endpoint(
    request: Request,
    field_id: str,
    scene_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Retorna preview/thumbnail da cena Up42 como PNG, recortada ao talhão."""
    try:
        _up42_ent = await asyncio.to_thread(billing_service.get_entitlements, user.id, user.email)
        if not _up42_ent.get("has_satellite", False):
            raise HTTPException(
                status_code=403,
                detail="Imagens de satélite não estão incluídas no seu plano atual. Faça upgrade para acessar UP42.",
            )

        field_data = await farm_service.async_get_field_by_id(user.id, field_id)
        if not field_data:
            raise HTTPException(status_code=404, detail="Talhão não encontrado.")
        lat = float(field_data.get("latitude", 0))
        lng = float(field_data.get("longitude", 0))
        boundaries = field_data.get("boundaries")

        overlay_data = await asyncio.to_thread(
            get_up42_overlay,
            scene_id, boundaries, lat, lng,
        )

        if not overlay_data or not overlay_data.get("image_bytes"):
            raise HTTPException(
                status_code=503,
                detail="Preview Up42 não disponível para esta cena.",
            )

        bounds = overlay_data["bounds"]  # [s, w, n, e]
        bounds_header = ",".join(f"{v:.6f}" for v in bounds)
        image_bytes = overlay_data["image_bytes"]

        # Salvar no histórico de artefatos (fire-and-forget)
        try:
            import hashlib
            bbox_hash = hashlib.md5(bounds_header.encode()).hexdigest()[:16]
            from services.satellite_history_service import save_satellite_artifact
            asyncio.create_task(asyncio.to_thread(
                save_satellite_artifact,
                user.id, field_id, "up42", "preview",
                scene_id, None, None, bbox_hash,
                f"up42/{field_id}/{scene_id}.png",
                overlay_data.get("provider"),
                None,  # plot_id
                field_data.get("farm_id"),
                len(image_bytes),
            ))
        except Exception:
            pass  # Nunca falha a resposta por causa do histórico

        return Response(
            content=image_bytes,
            media_type="image/png",
            headers={
                "Cache-Control": "public, max-age=3600",
                "X-Field-ID": field_id,
                "X-Scene-Id": scene_id,
                "X-Scene-Bounds": bounds_header,
                "X-Provider": str(overlay_data.get("provider", "Up42")),
                "X-Resolution": str(overlay_data.get("resolution_m", "")),
                "X-Source": "up42",
            },
        )
    except HTTPException:
        raise
    except Exception as exc:
        logging.error("[/api/up42/overlay] Erro field_id=%s scene_id=%s: %s", field_id, scene_id, exc)
        raise HTTPException(
            status_code=503,
            detail=f"Erro ao carregar overlay Up42: {exc}",
        ) from exc


# ══════════════════════════════════════════════════════════════════════════════
# PARCELAS / MICROTALHÕES
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/fields/{field_id}/plots")
@limiter.limit("30/minute")
async def list_plots(
    request: Request,
    field_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Lista parcelas do talhão."""
    field = await farm_service.async_get_field_by_id(user.id, field_id)
    if not field:
        raise HTTPException(status_code=404, detail="Talhão não encontrado.")
    plots = get_plots_by_field(field_id, user.id)
    return {"field_id": field_id, "plots": plots, "total": len(plots)}


@app.post("/api/fields/{field_id}/plots")
@limiter.limit("20/minute")
async def create_plot_endpoint(
    request: Request,
    field_id: str,
    body: PlotCreate,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Cria uma parcela/microtalhão."""
    field = await farm_service.async_get_field_by_id(user.id, field_id)
    if not field:
        raise HTTPException(status_code=404, detail="Talhão não encontrado.")
    try:
        plot = create_plot(field_id, user.id, body.model_dump())
        return plot
    except Exception as exc:
        logging.error("[/api/plots] create error: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao criar parcela.") from exc


@app.patch("/api/plots/{plot_id}")
@limiter.limit("20/minute")
async def update_plot_endpoint(
    request: Request,
    plot_id: str,
    body: PlotUpdate,
    user: AuthenticatedUser = Depends(get_current_user),
):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    result = update_plot(plot_id, user.id, data)
    return result


@app.delete("/api/plots/{plot_id}")
@limiter.limit("20/minute")
async def delete_plot_endpoint(
    request: Request,
    plot_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    ok = delete_plot(plot_id, user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Parcela não encontrada.")
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
# CADERNO DE CAMPO — EVENTOS
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/fields/{field_id}/notebook")
@limiter.limit("30/minute")
async def list_notebook_events(
    request: Request,
    field_id: str,
    category: str | None = None,
    plot_id: str | None = None,
    limit: int = 100,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Lista eventos do caderno de campo."""
    field = await farm_service.async_get_field_by_id(user.id, field_id)
    if not field:
        raise HTTPException(status_code=404, detail="Talhão não encontrado.")
    events = await get_notebook_events(field_id, user.id, category=category, plot_id=plot_id, limit=limit)
    return {"field_id": field_id, "events": events, "total": len(events)}


@app.post("/api/fields/{field_id}/notebook")
@limiter.limit("30/minute")
async def create_notebook_event_endpoint(
    request: Request,
    field_id: str,
    body: NotebookEventCreate,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Cria um evento no caderno de campo."""
    field = await farm_service.async_get_field_by_id(user.id, field_id)
    if not field:
        raise HTTPException(status_code=404, detail="Talhão não encontrado.")
    try:
        event = await create_notebook_event(field_id, user.id, body.model_dump())
        return event
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logging.error("[/api/notebook] create error: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao registrar evento.") from exc


@app.patch("/api/notebook/{event_id}")
@limiter.limit("20/minute")
async def update_notebook_event_endpoint(
    request: Request,
    event_id: str,
    body: NotebookEventUpdate,
    user: AuthenticatedUser = Depends(get_current_user),
):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    result = await update_notebook_event(event_id, user.id, data)
    return result


@app.delete("/api/notebook/{event_id}")
@limiter.limit("20/minute")
async def delete_notebook_event_endpoint(
    request: Request,
    event_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    ok = await delete_notebook_event(event_id, user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Evento não encontrado.")
    return {"ok": True}


# ══════════════════════════════════════════════════════════════════════════════
# HISTÓRICO DE IMAGENS DE SATÉLITE
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/fields/{field_id}/satellite-history")
@limiter.limit("30/minute")
async def satellite_history_endpoint(
    request: Request,
    field_id: str,
    source: str | None = None,
    limit: int = 50,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Retorna histórico de imagens de satélite cacheadas para o talhão."""
    field = await farm_service.async_get_field_by_id(user.id, field_id)
    if not field:
        raise HTTPException(status_code=404, detail="Talhão não encontrado.")
    history = get_satellite_history(field_id, user.id, source=source, limit=limit)
    return {"field_id": field_id, "history": history, "total": len(history)}


@app.get("/api/satellite-artifacts/{artifact_id}/image")
@limiter.limit("60/minute")
async def get_cached_satellite_image(
    request: Request,
    artifact_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Serve a imagem PNG cacheada de um artefato de satélite (sem custo de API externo)."""
    import requests as _req
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    url = f"{os.getenv('SUPABASE_URL', '').rstrip('/')}/rest/v1/satellite_artifacts"
    resp = _req.get(
        url,
        headers={"apikey": key, "Authorization": f"Bearer {key}"},
        params={"id": f"eq.{artifact_id}", "user_id": f"eq.{user.id}", "select": "id,image_path,source,mode,scene_date"},
        timeout=8,
    )
    if not resp.ok or not resp.json():
        raise HTTPException(status_code=404, detail="Artefato não encontrado.")
    artifact = resp.json()[0]
    image_path = artifact.get("image_path")
    if not image_path:
        raise HTTPException(status_code=404, detail="Imagem não disponível.")

    bucket = os.getenv("SATELLITE_CACHE_BUCKET", "satellite-cache")
    img_bytes = supabase_service.download_storage_object(bucket, image_path)
    if not img_bytes:
        raise HTTPException(status_code=404, detail="Arquivo de imagem não encontrado no Storage.")

    headers_out = {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
        "X-Source": artifact.get("source", ""),
        "X-Mode": artifact.get("mode", ""),
        "X-Scene-Date": artifact.get("scene_date") or "",
    }
    return Response(content=img_bytes, media_type="image/png", headers=headers_out)


@app.post("/api/geo/search")
@limiter.limit("10/minute")
async def geo_search_endpoint(
    request: Request,
    body: GeoSearchRequest,
    _user: AuthenticatedUser = Depends(get_current_user),
):
    try:
        result = await search_location(body.query)
        if not result:
            raise HTTPException(status_code=404, detail="Local nao encontrado para a busca informada.")
        return result
    except HTTPException:
        raise
    except GeoProviderError as exc:
        logging.warning("Falha no provedor de geocoding. query=%s erro=%s", body.query, str(exc))
        raise HTTPException(
            status_code=502,
            detail="Erro temporario ao consultar o provedor de localizacao.",
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Local nao encontrado para a busca informada.") from exc
    except Exception as exc:
        logging.error("Erro na busca geografica: %s", exc)
        raise HTTPException(status_code=502, detail="Erro temporario ao consultar o provedor de localizacao.") from exc


@app.post("/api/places/search", response_model=list[PlaceItem])
@limiter.limit("20/minute")
async def places_search_endpoint(
    request: Request,
    body: PlacesSearchRequest,
    _user: AuthenticatedUser = Depends(get_current_user),
):
    """Search for local service providers near a coordinate (server-side proxy to Nominatim)."""
    try:
        results = await search_places_nearby(
            query=body.query,
            lat=body.lat,
            lng=body.lng,
            radius_km=min(body.radius_km, 50.0),
        )
        return results
    except GeoProviderError as exc:
        logging.warning("Falha ao buscar lugares. query=%s erro=%s", body.query, str(exc))
        raise HTTPException(status_code=502, detail="Erro ao buscar prestadores de serviço.") from exc
    except Exception as exc:
        logging.error("Erro em places_search: %s", exc)
        raise HTTPException(status_code=500, detail="Erro interno ao buscar lugares.") from exc


# ---------------------------------------------------------------------------
# Feature 1: Caderno de Campo — /api/fields/{field_id}/logs
# ---------------------------------------------------------------------------

@app.post("/api/fields/{field_id}/logs", status_code=201)
async def create_field_log_endpoint(
    field_id: str,
    body: FieldLogCreate,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Cria um novo registro no caderno de campo para o talhão."""
    try:
        field_data = await farm_service.async_get_field_by_id(user.id, field_id)
        if not field_data:
            raise HTTPException(status_code=404, detail="Talhão não encontrado ou sem permissão de acesso.")

        log = await create_log(
            field_id=field_id,
            user_id=user.id,
            data=body.model_dump(exclude_none=True),
        )
        return log
    except HTTPException:
        raise
    except ValueError as exc:
        logging.error("[/api/fields/%s/logs POST] Configuração inválida: %s", field_id, exc)
        raise HTTPException(status_code=503, detail="Serviço temporariamente indisponível.") from exc
    except Exception as exc:
        logging.error("[/api/fields/%s/logs POST] Erro: %s", field_id, exc)
        raise HTTPException(status_code=500, detail="Erro ao criar registro no caderno de campo.") from exc


@app.get("/api/fields/{field_id}/logs")
async def get_field_logs_endpoint(
    field_id: str,
    limit: int = 50,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Retorna o caderno de campo do talhão (logs ordenados por data desc)."""
    try:
        field_data = await farm_service.async_get_field_by_id(user.id, field_id)
        if not field_data:
            raise HTTPException(status_code=404, detail="Talhão não encontrado ou sem permissão de acesso.")

        logs = await get_field_logs(
            field_id=field_id,
            user_id=user.id,
            limit=min(limit, 200),
        )
        return logs
    except HTTPException:
        raise
    except Exception as exc:
        logging.error("[/api/fields/%s/logs GET] Erro: %s", field_id, exc)
        raise HTTPException(status_code=500, detail="Erro ao buscar caderno de campo.") from exc


@app.delete("/api/fields/{field_id}/logs/{log_id}", status_code=204)
async def delete_field_log_endpoint(
    field_id: str,
    log_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Deleta um registro do caderno de campo verificando pertencimento ao usuário."""
    try:
        # Verifica que o talhão pertence ao usuário
        field_data = await farm_service.async_get_field_by_id(user.id, field_id)
        if not field_data:
            raise HTTPException(status_code=404, detail="Talhão não encontrado ou sem permissão de acesso.")

        deleted = await delete_log(log_id=log_id, user_id=user.id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Registro não encontrado ou sem permissão para deletar.")
        return None  # 204 No Content
    except HTTPException:
        raise
    except Exception as exc:
        logging.error("[/api/fields/%s/logs/%s DELETE] Erro: %s", field_id, log_id, exc)
        raise HTTPException(status_code=500, detail="Erro ao deletar registro do caderno de campo.") from exc


# ---------------------------------------------------------------------------
# Feature 3: API Keys — /api/keys
# ---------------------------------------------------------------------------

@app.post("/api/keys", status_code=201)
async def create_api_key_endpoint(
    body: dict,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Gera uma nova API key para o usuário.
    A chave em plain text é retornada APENAS nesta resposta — guarde-a com segurança.
    """
    try:
        name = str(body.get("name", "")).strip()
        if not name:
            raise HTTPException(status_code=422, detail="O campo 'name' é obrigatório.")

        result = generate_api_key(user_id=user.id, name=name)
        return result
    except HTTPException:
        raise
    except ValueError as exc:
        logging.error("[/api/keys POST] Configuração inválida: %s", exc)
        raise HTTPException(status_code=503, detail="Serviço temporariamente indisponível.") from exc
    except Exception as exc:
        logging.error("[/api/keys POST] Erro: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao gerar API key.") from exc


@app.get("/api/keys")
async def list_api_keys_endpoint(
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Lista as API keys do usuário (sem retornar a chave em plain text)."""
    try:
        keys = list_api_keys(user_id=user.id)
        return keys
    except Exception as exc:
        logging.error("[/api/keys GET] Erro: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao listar API keys.") from exc


@app.delete("/api/keys/{key_id}", status_code=204)
async def revoke_api_key_endpoint(
    key_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Revoga (desativa) uma API key do usuário."""
    try:
        revoked = revoke_api_key(key_id=key_id, user_id=user.id)
        if not revoked:
            raise HTTPException(status_code=404, detail="API key não encontrada ou sem permissão para revogar.")
        return None  # 204 No Content
    except HTTPException:
        raise
    except Exception as exc:
        logging.error("[/api/keys/%s DELETE] Erro: %s", key_id, exc)
        raise HTTPException(status_code=500, detail="Erro ao revogar API key.") from exc


# ---------------------------------------------------------------------------
# Safras — /api/fields/{field_id}/seasons
# ---------------------------------------------------------------------------

@app.post("/api/fields/{field_id}/seasons", status_code=201)
@limiter.limit("30/minute")
async def create_season_endpoint(
    request: Request,
    field_id: str,
    body: SeasonCreate,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Cria uma safra para o talhão."""
    try:
        field_data = await farm_service.async_get_field_by_id(user.id, field_id)
        if not field_data:
            raise HTTPException(status_code=404, detail="Talhão não encontrado ou sem permissão.")
        season = await create_season(field_id=field_id, user_id=user.id, data=body.model_dump(exclude_none=True))
        return season
    except HTTPException:
        raise
    except Exception as exc:
        logging.error("[/api/fields/%s/seasons POST] %s", field_id, exc)
        raise HTTPException(status_code=500, detail="Erro ao criar safra.") from exc


@app.get("/api/fields/{field_id}/seasons")
@limiter.limit("60/minute")
async def get_seasons_endpoint(
    request: Request,
    field_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Lista safras do talhão."""
    try:
        field_data = await farm_service.async_get_field_by_id(user.id, field_id)
        if not field_data:
            raise HTTPException(status_code=404, detail="Talhão não encontrado ou sem permissão.")
        seasons = await get_field_seasons(field_id=field_id, user_id=user.id)
        return seasons
    except HTTPException:
        raise
    except Exception as exc:
        logging.error("[/api/fields/%s/seasons GET] %s", field_id, exc)
        raise HTTPException(status_code=500, detail="Erro ao buscar safras.") from exc


@app.patch("/api/fields/{field_id}/seasons/{season_id}")
@limiter.limit("30/minute")
async def update_season_endpoint(
    request: Request,
    field_id: str,
    season_id: str,
    body: SeasonUpdate,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Atualiza uma safra."""
    try:
        field_data = await farm_service.async_get_field_by_id(user.id, field_id)
        if not field_data:
            raise HTTPException(status_code=404, detail="Talhão não encontrado ou sem permissão.")
        updated = await update_season(season_id=season_id, user_id=user.id, data=body.model_dump(exclude_none=True))
        if not updated:
            raise HTTPException(status_code=404, detail="Safra não encontrada.")
        return updated
    except HTTPException:
        raise
    except Exception as exc:
        logging.error("[/api/fields/%s/seasons/%s PATCH] %s", field_id, season_id, exc)
        raise HTTPException(status_code=500, detail="Erro ao atualizar safra.") from exc


@app.delete("/api/fields/{field_id}/seasons/{season_id}", status_code=204)
@limiter.limit("20/minute")
async def delete_season_endpoint(
    request: Request,
    field_id: str,
    season_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Remove uma safra."""
    try:
        field_data = await farm_service.async_get_field_by_id(user.id, field_id)
        if not field_data:
            raise HTTPException(status_code=404, detail="Talhão não encontrado ou sem permissão.")
        await delete_season(season_id=season_id, user_id=user.id)
        return None
    except HTTPException:
        raise
    except Exception as exc:
        logging.error("[/api/fields/%s/seasons/%s DELETE] %s", field_id, season_id, exc)
        raise HTTPException(status_code=500, detail="Erro ao remover safra.") from exc


# ---------------------------------------------------------------------------
# Janela de Pulverização — /api/weather/spray-window
# ---------------------------------------------------------------------------

@app.post("/api/weather/spray-window")
@limiter.limit("60/minute")
async def spray_window_endpoint(
    request: Request,
    body: SprayWindowRequest,
    _user: AuthenticatedUser = Depends(get_current_user),
):
    """Avalia as condições meteorológicas para pulverização (go/no-go)."""
    try:
        result = evaluate_spray_window(body.model_dump())
        return result
    except Exception as exc:
        logging.error("[/api/weather/spray-window] %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao avaliar janela de pulverização.") from exc


# ---------------------------------------------------------------------------
# ANOVA + Tukey — /api/stats/anova
# ---------------------------------------------------------------------------

@app.post("/api/stats/anova")
@limiter.limit("30/minute")
async def anova_endpoint(
    request: Request,
    body: AnovaRequest,
    _user: AuthenticatedUser = Depends(get_current_user),
):
    """Realiza ANOVA de uma via + Tukey HSD nos grupos fornecidos."""
    try:
        if len(body.groups) < 2:
            raise HTTPException(status_code=400, detail="São necessários pelo menos 2 grupos.")
        for name, values in body.groups.items():
            if len(values) < 2:
                raise HTTPException(status_code=400, detail=f"Grupo '{name}' precisa de pelo menos 2 observações.")
        result = run_anova_tukey(body.groups)
        return result
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        logging.error("[/api/stats/anova] %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao calcular ANOVA.") from exc


# ---------------------------------------------------------------------------
# NDVI por Parcela — /api/fields/{field_id}/parcels/ndvi
# ---------------------------------------------------------------------------

@app.post("/api/fields/{field_id}/parcels/ndvi")
@limiter.limit("20/minute")
async def parcel_ndvi_endpoint(
    request: Request,
    field_id: str,
    body: ParcelNdviRequest,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """Calcula o NDVI médio de uma parcela usando suas boundaries."""
    try:
        field_data = await farm_service.async_get_field_by_id(user.id, field_id)
        if not field_data:
            raise HTTPException(status_code=404, detail="Talhão não encontrado ou sem permissão.")

        boundaries = body.parcel_boundaries
        if not boundaries or len(boundaries) < 3:
            raise HTTPException(status_code=400, detail="São necessários pelo menos 3 pontos para definir a parcela.")

        lats = [p[0] for p in boundaries]
        lngs = [p[1] for p in boundaries]
        center_lat = sum(lats) / len(lats)
        center_lng = sum(lngs) / len(lngs)

        # Calcula área aproximada em ha
        import math as _math
        lat_span = (max(lats) - min(lats)) * 111320
        lng_span = (max(lngs) - min(lngs)) * 111320 * _math.cos(_math.radians(center_lat))
        area_ha = (lat_span * lng_span) / 10000

        # Busca imagem NDVI para as boundaries da parcela
        ndvi_result = await get_ndvi_image(
            lat=center_lat,
            lng=center_lng,
            boundaries=boundaries,
            lookback_days=21,
        )

        ndvi_image_b64 = ndvi_result.get("ndvi_image_base64") if isinstance(ndvi_result, dict) else None
        date_acquired = ndvi_result.get("date_acquired") if isinstance(ndvi_result, dict) else None
        ndvi_analysis = ndvi_result.get("ndvi_analysis", {}) if isinstance(ndvi_result, dict) else {}

        ndvi_medio = None
        for key in ("ndvi_medio", "ndvi_mean", "mean", "ndvi_avg"):
            val = ndvi_analysis.get(key)
            if val is not None:
                try:
                    ndvi_medio = float(val)
                    break
                except (TypeError, ValueError):
                    pass

        # Fallback: calcular da imagem base64 se disponível
        if ndvi_medio is None and ndvi_image_b64:
            try:
                import base64
                from PIL import Image
                import io
                img_bytes = base64.b64decode(ndvi_image_b64)
                img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
                pixels = list(img.getdata())
                # Paleta NDVI: vermelho=baixo, verde=alto
                # Estima NDVI = (G - R) / (G + R + 1) por pixel
                total = 0.0
                count = 0
                for r, g, b in pixels:
                    if r + g > 10:  # ignora pixels escuros/transparentes
                        ndvi_px = (g - r) / (g + r + 1)
                        total += ndvi_px
                        count += 1
                ndvi_medio = round(total / count, 4) if count > 0 else None
            except Exception as img_exc:
                logging.warning("[parcel_ndvi] Falha ao calcular NDVI da imagem: %s", img_exc)

        return {
            "ndvi_medio": ndvi_medio,
            "date": date_acquired,
            "parcel_area_ha": round(area_ha, 3),
            "field_id": field_id,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logging.error("[/api/fields/%s/parcels/ndvi] %s", field_id, exc)
        raise HTTPException(status_code=500, detail="Erro ao calcular NDVI da parcela.") from exc


@app.post("/api/analyze-field", response_model=FieldAnalysisResponse)
@limiter.limit("3/minute")
async def analyze_field_endpoint(request: Request, field_req: FieldAnalysisRequest, _user: AuthenticatedUser = Depends(get_current_user)):
    try:
        effective_crop_type = field_req.crop_type or "NÃ£o informada"
        # Cache key based on location, crop and current date (24h validity semantic)
        date_str = datetime.now().strftime("%Y%m%d")
        cache_key = f"{field_req.lat:.4f}_{field_req.lng:.4f}_{effective_crop_type}_{date_str}"
        cached_result = analysis_cache.get(cache_key)

        if cached_result:
            data = cached_result.copy()
            data["cached"] = True
            return FieldAnalysisResponse(**data)

        is_mock_weather = False
        weather_data = extract_weather_snapshot(field_req.hourly_weather, field_req.forecast_7d)
        if not weather_data:
            weather_data = await fetch_weather_snapshot(field_req.lat, field_req.lng)
        if not weather_data:
            weather_data = _get_mock_weather(field_req.lat, field_req.lng)
            is_mock_weather = True

        season = _get_season()
        now_str = datetime.now().strftime("%d/%m/%Y %H:%M")
        weather_summary = _build_weather_summary(weather_data, season, now_str)
        forecast_str = field_req.forecast_7d or weather_data.get("forecast_7d") or season

        sentinel_data = get_ndvi_image(field_req.lat, field_req.lng, field_req.boundaries, field_req.date_range_days)

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
            boundaries_data=field_req.boundaries is not None and len(field_req.boundaries) >= 3
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
                field_name=field_req.field_name,
                crop_type=effective_crop_type,
                weather_context=weather_summary,
                hourly_weather=field_req.hourly_weather,
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
            fields = [{"name": field_req.field_name, "crop": field_req.crop_type, "lat": field_req.lat, "lng": field_req.lng}]
            weather_forecast = forecast_str
            engine_results = [engine_results]

        alerts = generate_alerts_claude(AlertLike(), {field_req.field_name: ndvi_analysis} if ndvi_analysis else {})

        try:
            client = _get_client()
            response = client.messages.create(
                model=MODEL,
                max_tokens=800,
                temperature=0.3,
                messages=[{"role": "user", "content": _build_report_prompt(field_req, now_str, season, weather_summary, forecast_str, ndvi_analysis)}],
            )
            ai_report = response.content[0].text
        except Exception as exc:
            logging.error("Erro ao gerar relatorio de IA: %s", exc)
            ai_report = "Relatorio nao disponivel no momento."

        result = {
            "field_name": field_req.field_name,
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

        # --- Histórico de análises (best-effort, não bloqueia resposta) ---
        field_id_for_history = getattr(field_req, "field_id", None)
        if field_id_for_history:
            try:
                await save_analysis(
                    supabase_client=None,
                    field_id=str(field_id_for_history),
                    user_id=_user.id,
                    analysis_data=result,
                )
            except Exception as _hist_exc:
                logging.warning("[analyze-field] Falha ao salvar histórico (best-effort): %s", _hist_exc)

        # --- Push notifications para alertas críticos (best-effort) ---
        try:
            critical_alerts = [a for a in (alerts or []) if isinstance(a, dict) and a.get("severity") in ("critical", "high", "alta", "critico")]
            if critical_alerts:
                import requests as _req_push
                _sb_key_push = os.getenv("SUPABASE_SERVICE_KEY", "")
                _push_resp = _req_push.get(
                    f"{os.getenv('SUPABASE_URL', '').rstrip('/')}/rest/v1/push_subscriptions",
                    headers={"apikey": _sb_key_push, "Authorization": f"Bearer {_sb_key_push}"},
                    params={"user_id": f"eq.{_user.id}", "select": "endpoint,p256dh,auth"},
                    timeout=5,
                )
                _push_rows = _push_resp.json() if _push_resp.ok and isinstance(_push_resp.json(), list) else []
                for row in _push_rows:
                    try:
                        sub_info = {
                            "endpoint": row["endpoint"],
                            "keys": {"p256dh": row["p256dh"], "auth": row["auth"]},
                        }
                        first_alert = critical_alerts[0]
                        send_push_notification(
                            subscription_info=sub_info,
                            title=f"Alerta Tracto — {field_req.field_name}",
                            body=first_alert.get("message") or first_alert.get("title") or "Alerta crítico detectado.",
                            url="/app/alerts",
                        )
                    except Exception as _row_exc:
                        logging.warning("[analyze-field] Falha push para subscription: %s", _row_exc)
        except Exception as _push_exc:
            logging.warning("[analyze-field] Falha ao enviar push de alertas: %s", _push_exc)

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
        
        # Se nao houver campos, usamos os dados genÃ©ricos da request
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
                item_crop = f.get("crop") or request.crop_type or "NÃ£o informada"
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
                    item_crop = field.get("crop") or request.crop_type or "NÃ£o informada"
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
            field_id=request.field_id,
            farm_context=request.farm_context,
            created_at=request.created_at,
            updated_at=request.updated_at,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logging.error(
            "Erro ao salvar conversa user_id=%s conversation_id=%s field_id=%s: %s",
            user.id,
            request.conversation_id,
            request.field_id,
            exc,
        )
        raise HTTPException(status_code=500, detail="Erro ao salvar conversa.") from exc


@app.get("/api/conversations")
async def get_conversations_endpoint(
    user: AuthenticatedUser = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
):
    limit = min(max(limit, 1), 100)
    offset = max(offset, 0)
    try:
        return {"conversations": supabase_service.get_conversations(user.id, limit=limit, offset=offset)}
    except Exception as exc:
        logging.error("Erro ao buscar conversas: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao buscar conversas.") from exc


@app.delete("/api/conversations/{conversation_id}")
async def delete_conversation_endpoint(
    conversation_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Remove uma conversa garantindo que pertenÃ§a ao usuÃ¡rio autenticado.
    Retorna 404 se a conversa nÃ£o existir ou nÃ£o pertencer ao usuÃ¡rio.
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
        return {"farms": await farm_service.async_get_farms(user.id)}
    except Exception as exc:
        logging.error("Erro ao buscar fazendas: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao buscar fazendas.") from exc

@app.post("/api/farms/bootstrap")
async def bootstrap_farm_endpoint(user: AuthenticatedUser = Depends(get_current_user)):
    """Garante a criação da fazenda padrão (idempotente)."""
    try:
        return await farm_service.async_ensure_default_farm(user.id)
    except Exception as exc:
        logging.error("Erro no bootstrap de fazenda: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao inicializar fazenda padrao.") from exc

@app.post("/api/farms")
async def save_farm_endpoint(request: FarmCreate, user: AuthenticatedUser = Depends(get_current_user)):
    try:
        return await farm_service.async_save_farm(user.id, request.model_dump())
    except Exception as exc:
        logging.error("Erro ao salvar fazenda: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao salvar fazenda.") from exc

@app.put("/api/farms/{farm_id}")
async def update_farm_endpoint(farm_id: str, request: FarmBase, user: AuthenticatedUser = Depends(get_current_user)):
    try:
        data = request.model_dump()
        data["id"] = farm_id
        return await farm_service.async_save_farm(user.id, data)
    except Exception as exc:
        logging.error("Erro ao atualizar fazenda: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao atualizar fazenda.") from exc

@app.delete("/api/farms/{farm_id}")
async def delete_farm_endpoint(farm_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    try:
        return {"success": await farm_service.async_delete_farm(farm_id, user.id)}
    except Exception as exc:
        logging.error("Erro ao deletar fazenda: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao deletar fazenda.") from exc


# --- Fields Endpoints ---

@app.get("/api/fields")
async def get_fields_endpoint(farm_id: str | None = None, user: AuthenticatedUser = Depends(get_current_user)):
    try:
        return {"fields": await farm_service.async_get_fields(user.id, farm_id)}
    except Exception as exc:
        logging.error("Erro ao buscar talhoes: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao buscar talhoes.") from exc


@app.get("/api/fields/{field_id}/intelligence", response_model=FieldIntelligenceSnapshot)
@limiter.limit("20/minute")
async def get_field_intelligence_endpoint(
    request: Request,
    field_id: str,
    force_refresh: bool = False,
    user: AuthenticatedUser = Depends(get_current_user),
):
    try:
        snapshot = await build_field_intelligence_snapshot(
            user_id=user.id,
            field_id=field_id,
            force_refresh=force_refresh,
        )
        return snapshot
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        logging.error("Erro ao montar snapshot de inteligencia do talhao %s: %s", field_id, exc)
        raise HTTPException(status_code=500, detail="Erro ao montar inteligencia do talhao.") from exc

@app.post("/api/fields")
async def save_field_endpoint(request: FieldCreate, user: AuthenticatedUser = Depends(get_current_user)):
    try:
        # Verificação de limite de talhões pelo plano do usuário
        current_fields = await farm_service.async_get_fields(user.id)
        current_count = len(current_fields) if current_fields else 0
        allowed, err_msg = await asyncio.to_thread(billing_service.check_field_limit, user.id, current_count, user.email)
        if not allowed:
            raise HTTPException(status_code=403, detail=err_msg)

        return await farm_service.async_save_field(user.id, request.model_dump(mode='json', exclude_none=True))
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
        return await farm_service.async_save_field(user.id, data)
    except Exception as exc:
        logging.error("Erro ao atualizar talhao: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao atualizar talhao.") from exc

@app.delete("/api/fields/{field_id}")
async def delete_field_endpoint(field_id: str, user: AuthenticatedUser = Depends(get_current_user)):
    try:
        field_data = await farm_service.async_get_field_by_id(user.id, field_id)
        if not field_data:
            raise HTTPException(status_code=404, detail="Talhão não encontrado ou sem permissão de acesso.")

        supabase_service.delete_satellite_artifacts_for_field(user.id, field_id, SATELLITE_CACHE_BUCKET)
        clear_cached_overlays_for_field(field_id)
        analysis_cache.delete(f"field_intelligence:snapshot:{field_id}")
        analysis_cache.delete(f"field_intelligence:satellite:{field_id}")
        analysis_cache.delete(f"field_intelligence:weather:{field_id}")
        supabase_service.delete_conversations_by_field(user.id, field_id)
        return {"success": await farm_service.async_delete_field(field_id, user.id)}
    except HTTPException:
        raise
    except Exception as exc:
        logging.error("Erro ao deletar talhao: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao deletar talhao.") from exc


@app.get("/api/market/quotes")
@limiter.limit("10/minute")
async def market_quotes_endpoint(
    request: Request,
    _user: AuthenticatedUser = Depends(get_current_user_or_api_key),
):
    """
    Retorna cotacoes de commodities em tempo real (Yahoo Finance Chart API + AwesomeAPI).
    Cache de 30 minutos no servidor. Fallback estático se as fontes falharem.
    """
    try:
        quotes = await get_market_quotes()
        return quotes  # retorna lista direta: QuoteItem[]
    except Exception as exc:
        logging.error("[/api/market/quotes] Erro inesperado: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao buscar cotações de mercado.") from exc


@app.get("/api/fields/{field_id}/analyses")
async def get_field_analyses_endpoint(
    field_id: str,
    limit: int = 30,
    user: AuthenticatedUser = Depends(get_current_user_or_api_key),
):
    """
    Retorna o histórico de análises do talhão (até 30 registros, mais recente primeiro).
    O talhão precisa pertencer ao usuário autenticado.
    """
    try:
        field_data = await farm_service.async_get_field_by_id(user.id, field_id)
        if not field_data:
            raise HTTPException(status_code=404, detail="Talhão não encontrado ou sem permissão de acesso.")

        analyses = await get_field_analyses(
            supabase_client=None,
            field_id=field_id,
            user_id=user.id,
            limit=min(limit, 100),
        )
        return analyses  # retorna lista direta: ApiAnalysisEntry[]
    except HTTPException:
        raise
    except Exception as exc:
        logging.error("[/api/fields/%s/analyses] Erro: %s", field_id, exc)
        raise HTTPException(status_code=500, detail="Erro ao buscar histórico de análises.") from exc


@app.post("/api/verify-recaptcha")
@limiter.limit("10/minute")  # anti-brute-force em fluxos de auth
async def verify_recaptcha(request: Request, body: RecaptchaRequest):
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
                data={"secret": secret_key, "response": body.token},
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


# ─────────────────────────────────────────────────────────────────────────────
# GxE — Análise de Interação Genótipo × Ambiente
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/stats/gxe")
async def gxe_analysis_endpoint(
    body: GxERequest,
    user: AuthenticatedUser = Depends(get_current_user_or_api_key),
):
    """
    Análise de estabilidade Genótipo × Ambiente (Eberhart-Russell 1966).

    Body: { "data": { "Genótipo A": { "Ambiente1": 52.3, "Ambiente2": 48.1 }, ... } }

    Returns:
      - grand_mean: média geral
      - genotypes: [ { genotype, mean, bi, s2di, classification, rank } ]
      - environments: [ { environment, mean, index, type } ]
      - interaction_summary: texto interpretativo
      - recommendation: { best_overall, stable, favorable, unfavorable }
    """
    try:
        result = run_gxe_analysis(body.data)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        logging.error("[GxE] Erro inesperado: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao calcular análise GxE.") from exc


# ─────────────────────────────────────────────────────────────────────────────
# GERMOPLASMA
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/germoplasma/genotypes")
async def api_create_genotype(
    body: GenotypeCreate,
    user: AuthenticatedUser = Depends(get_current_user_or_api_key),
):
    try:
        return await create_genotype(user.id, body.model_dump())
    except Exception as exc:
        logging.error("[germoplasma] create_genotype: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao salvar genótipo.") from exc


@app.get("/api/germoplasma/genotypes")
async def api_get_genotypes(
    user: AuthenticatedUser = Depends(get_current_user_or_api_key),
    limit: int = 100,
    offset: int = 0,
):
    return await get_genotypes(user.id, limit=min(max(limit, 1), 500), offset=max(offset, 0))


@app.patch("/api/germoplasma/genotypes/{genotype_id}")
async def api_update_genotype(
    genotype_id: str,
    body: GenotypeUpdate,
    user: AuthenticatedUser = Depends(get_current_user_or_api_key),
):
    try:
        result = await update_genotype(genotype_id, user.id, body.model_dump(exclude_none=True))
        return result
    except Exception as exc:
        logging.error("[germoplasma] update_genotype %s: %s", genotype_id, exc)
        raise HTTPException(status_code=500, detail="Erro ao atualizar genótipo.") from exc


@app.delete("/api/germoplasma/genotypes/{genotype_id}")
async def api_delete_genotype(
    genotype_id: str,
    user: AuthenticatedUser = Depends(get_current_user_or_api_key),
):
    deleted = await delete_genotype(genotype_id, user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Genótipo não encontrado.")
    return {"deleted": True}


@app.post("/api/germoplasma/crosses")
async def api_create_cross(
    body: CrossCreate,
    user: AuthenticatedUser = Depends(get_current_user_or_api_key),
):
    try:
        return await create_cross(user.id, body.model_dump())
    except Exception as exc:
        logging.error("[germoplasma] create_cross: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao salvar cruzamento.") from exc


@app.get("/api/germoplasma/crosses")
async def api_get_crosses(
    user: AuthenticatedUser = Depends(get_current_user_or_api_key),
):
    return await get_crosses(user.id)


@app.delete("/api/germoplasma/crosses/{cross_id}")
async def api_delete_cross(
    cross_id: str,
    user: AuthenticatedUser = Depends(get_current_user_or_api_key),
):
    deleted = await delete_cross(cross_id, user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Cruzamento não encontrado.")
    return {"deleted": True}


@app.post("/api/germoplasma/generations")
async def api_create_generation(
    body: BreedingGenerationCreate,
    user: AuthenticatedUser = Depends(get_current_user_or_api_key),
):
    try:
        return await create_generation(user.id, body.model_dump())
    except Exception as exc:
        logging.error("[germoplasma] create_generation: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao salvar geração.") from exc


@app.get("/api/germoplasma/generations")
async def api_get_generations(
    genotype_id: str | None = None,
    user: AuthenticatedUser = Depends(get_current_user_or_api_key),
):
    return await get_generations(user.id, genotype_id)


@app.delete("/api/germoplasma/generations/{generation_id}")
async def api_delete_generation(
    generation_id: str,
    user: AuthenticatedUser = Depends(get_current_user_or_api_key),
):
    deleted = await delete_generation(generation_id, user.id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Geração não encontrada.")
    return {"deleted": True}


# ── (A-01) user_app_data: persistência genérica por usuário/namespace ────────
# Substitui o localStorage como fonte de verdade dos dados de melhoramento/
# pesquisa/solo. Tudo escopado por user.id (anti-IDOR), namespace validado.
from typing import Any as _Any  # noqa: E402
from services import user_data_service as _uds  # noqa: E402


class _UserDataPayload(_BM):
    data: _Any


@app.get("/api/user-data/{namespace}")
async def api_get_user_data(
    namespace: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    if not _uds.is_valid_namespace(namespace):
        raise HTTPException(status_code=400, detail="Namespace inválido.")
    try:
        data = await _uds.async_get_user_data(user.id, namespace)
        # 'data' None → ainda não existe no backend; devolve null pro cliente decidir migração.
        return {"namespace": namespace, "data": data}
    except Exception as exc:
        logging.error("[user_data] GET %s: %s", namespace, exc)
        raise HTTPException(status_code=502, detail="Erro ao carregar dados.") from exc


@app.put("/api/user-data/{namespace}")
async def api_put_user_data(
    namespace: str,
    body: _UserDataPayload,
    user: AuthenticatedUser = Depends(get_current_user),
):
    if not _uds.is_valid_namespace(namespace):
        raise HTTPException(status_code=400, detail="Namespace inválido.")
    try:
        saved = await _uds.async_upsert_user_data(user.id, namespace, body.data)
        return {"namespace": namespace, "data": saved}
    except Exception as exc:
        logging.error("[user_data] PUT %s: %s", namespace, exc)
        raise HTTPException(status_code=502, detail="Erro ao salvar dados.") from exc
