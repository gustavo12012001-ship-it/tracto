import asyncio
import json
import logging
import os
from datetime import datetime

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
from services.billing_service import billing_service
from services.ai_service import MODEL, _get_client, analyze_ndvi_image, analyze_weather_map, generate_alerts_claude, generate_chat_response
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

app = FastAPI(title="Tracto API", description="O motor da plataforma Tracto", version=APP_VERSION)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- Structured Logging Middleware ---
@app.middleware("http")
async def structured_log_middleware(request: Request, call_next):
    request_id = str(uuid.uuid4())
    start_time = time.time()
    
    # ExtraÃ§Ã£o leve do sub_claim para contexto (nao confiavel ate verificado pelo auth_service)
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


allowed_origins_env = os.getenv("ALLOWED_ORIGINS")
if allowed_origins_env:
    allow_origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]
else:
    allow_origins = [
        "https://tracto-eta.vercel.app",
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

# Matches all Vercel preview and production deployments for the tracto project
# e.g. tracto-eta.vercel.app, tracto-git-main-abc123.vercel.app
allow_origin_regex = os.getenv("ALLOWED_ORIGINS_REGEX", r"https://tracto[-a-z0-9]*\.vercel\.app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-API-Key", "Accept", "Origin", "X-Request-ID"],
    expose_headers=["X-Scene-Bounds", "X-Scene-Id", "X-Cache", "X-Cache-Source", "X-Source", "X-Scene-Date", "X-Mode", "X-Request-ID", "X-Provider", "X-Resolution", "X-Asset-Status"],
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
    return billing_service.get_entitlements(user.id)

@app.post("/api/billing/checkout")
async def create_checkout(req: CheckoutRequest, user: AuthenticatedUser = Depends(get_current_user)):
    # MOCK ESTRUTURAL: Nenhum gateway real estÃ¡ conectado (Stripe/Asaas).
    if req.plan_id not in ["pro", "premium"]:
        raise HTTPException(status_code=400, detail="Plano invalido")
    
    return {
        "checkout_url": "https://sandbox.gateway.com/pay/mock_123",
        "message": f"MOCK: Checkout do plano {req.plan_id} via {req.payment_method}. Pagamento nÃ£o efetuado na realidade."
    }

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
    # Salva a subscription na tabela push_subscriptions (upsert por endpoint)
    try:
        billing_service.supabase.table("push_subscriptions").upsert(
            {
                "user_id": user.id,
                "endpoint": req.endpoint,
                "p256dh": req.p256dh,
                "auth": req.auth,
            },
            on_conflict="endpoint",
        ).execute()
    except Exception as exc:
        logging.warning("[push/subscribe] Falha ao salvar subscription no Supabase: %s", exc)
    return {"status": "ok", "message": "Inscricao de push salva com sucesso na base de dados."}

@app.post("/webhooks/whatsapp")
async def whatsapp_webhook(request: Request):
    """
    Webhook Z-API para mensagens WhatsApp recebidas.
    Suporta JSON (Z-API) e form-urlencoded (Twilio legado).
    """
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

    # Busca contexto agronômico da fazenda do usuário
    farm_context_str = "Fazenda sem dados disponíveis no momento."
    try:
        farms = farm_service.get_farms(user_id)
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


@app.post("/api/chat")
@limiter.limit("5/minute")
async def chat_endpoint(request: Request, chat_req: ChatRequest, _user: AuthenticatedUser = Depends(get_current_user)) -> ChatResponse:
    try:
        # field_id canônico e obrigatório
        if not chat_req.field_id or not chat_req.field_id.strip():
            raise HTTPException(status_code=400, detail="field_id inválido ou ausente. Selecione um talhão ativo antes de enviar a pergunta.")

        canonical_field_id = chat_req.field_id.strip()

        # ownership validado no backend (nunca confiar no cliente)
        field_data = farm_service.get_field_by_id(_user.id, canonical_field_id)
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

        field_data = farm_service.get_field_by_id(user.id, field_id)
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

    try:
        field_data = farm_service.get_field_by_id(user.id, field_id)
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
        field_data = farm_service.get_field_by_id(user.id, body.field_id)
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
        field_data = farm_service.get_field_by_id(user.id, field_id)
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
    field_data = farm_service.get_field_by_id(user.id, field_id)
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
    field_data = farm_service.get_field_by_id(user.id, field_id)
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
        field_data = farm_service.get_field_by_id(user.id, field_id)
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
        field_data = farm_service.get_field_by_id(user.id, field_id)
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
    field = farm_service.get_field_by_id(user.id, field_id)
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
    field = farm_service.get_field_by_id(user.id, field_id)
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
    field = farm_service.get_field_by_id(user.id, field_id)
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
    field = farm_service.get_field_by_id(user.id, field_id)
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
    field = farm_service.get_field_by_id(user.id, field_id)
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
        field_data = farm_service.get_field_by_id(user.id, field_id)
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
        field_data = farm_service.get_field_by_id(user.id, field_id)
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
        field_data = farm_service.get_field_by_id(user.id, field_id)
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
        field_data = farm_service.get_field_by_id(user.id, field_id)
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
        field_data = farm_service.get_field_by_id(user.id, field_id)
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
        field_data = farm_service.get_field_by_id(user.id, field_id)
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
        field_data = farm_service.get_field_by_id(user.id, field_id)
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
        field_data = farm_service.get_field_by_id(user.id, field_id)
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
                push_res = billing_service.supabase.table("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", _user.id).execute()
                for row in (push_res.data or []):
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
        return {"farms": farm_service.get_farms(user.id)}
    except Exception as exc:
        logging.error("Erro ao buscar fazendas: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao buscar fazendas.") from exc

@app.post("/api/farms/bootstrap")
async def bootstrap_farm_endpoint(user: AuthenticatedUser = Depends(get_current_user)):
    """
    Endpoint explÃ­cito para garantir a criaÃ§Ã£o da fazenda padrÃ£o (idempotente).
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
        field_data = farm_service.get_field_by_id(user.id, field_id)
        if not field_data:
            raise HTTPException(status_code=404, detail="Talhão não encontrado ou sem permissão de acesso.")

        supabase_service.delete_satellite_artifacts_for_field(user.id, field_id, SATELLITE_CACHE_BUCKET)
        clear_cached_overlays_for_field(field_id)
        analysis_cache.delete(f"field_intelligence:snapshot:{field_id}")
        analysis_cache.delete(f"field_intelligence:satellite:{field_id}")
        analysis_cache.delete(f"field_intelligence:weather:{field_id}")
        supabase_service.delete_conversations_by_field(user.id, field_id)
        return {"success": farm_service.delete_field(field_id, user.id)}
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
    Retorna cotações de commodities em tempo real (yfinance + awesomeapi).
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
        field_data = farm_service.get_field_by_id(user.id, field_id)
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
):
    return await get_genotypes(user.id)


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

