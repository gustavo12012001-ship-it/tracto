import json
import logging
import os
from datetime import datetime

import httpx
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, Header, Request, Response, Cookie
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
    GeoSearchRequest,
    FieldIntelligenceSnapshot,
)
from services import supabase_service, farm_service
from services.billing_service import billing_service
from services.ai_service import MODEL, _get_client, analyze_ndvi_image, analyze_weather_map, generate_alerts_claude, generate_chat_response
from services.auth_service import AuthenticatedUser, get_unverified_user_id_from_header, get_current_user
from services.cache_service import analysis_cache
from services.sentinel_service import get_ndvi_image, get_true_color_overlay, get_available_scenes
from services.planet_service import (
    create_planet_tile_session,
    get_planet_tile_session_status,
    get_planet_scenes,
    get_planet_thumbnail,
    get_planet_tile,
)
from services.geo_service import GeoProviderError, search_location
from services.weather_service import extract_weather_snapshot, fetch_weather_snapshot
from services.agronomic_engine import AgronomicEngine
from services.field_intelligence_service import build_field_intelligence_snapshot

# --- Security & Rate Limiting ---

# --- Security & Rate Limiting ---

# O limitador usa IP (get_remote_address) como chave primÃ¡ria para governanÃ§a econÃ´mica.
# A identidade do usuÃ¡rio (context_user_id) Ã© usada apenas para contexto em logs.
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
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health_check():
    return {
        "status": "Tracto backend online",
        "version": APP_VERSION,
        "service": "tracto-backend",
        "timestamp": datetime.now().isoformat(),
    }


@app.get("/api/sentinel/test-auth")
async def sentinel_test_auth():
    """Endpoint temporário para testar autenticação Sentinel. Remover após debug."""
    import os

    client_id = os.getenv("SENTINEL_CLIENT_ID", "NAO_CONFIGURADO")
    client_secret = os.getenv("SENTINEL_CLIENT_SECRET", "NAO_CONFIGURADO")

    # Força renovação do token ignorando cache
    try:
        import httpx

        response = httpx.post(
            "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token",
            data={
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
            },
            timeout=15.0,
        )
        return {
            "client_id": client_id,
            "secret_length": len(client_secret),
            "secret_preview": client_secret[:4] + "..." + client_secret[-4:],
            "http_status": response.status_code,
            "response": response.json(),
        }
    except Exception as e:
        return {"error": str(e), "client_id": client_id}

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
    
    # Buscar contexto agronÃ´mico do usuÃ¡rio
    farms_res = billing_service.supabase.table("farms").select("id, name").eq("user_id", user_id).execute()
    farm_context = f"Fazendas do produtor: {[f['name'] for f in (farms_res.data or [])]}"
    
    # Repassar para ai_service passando o contexto
    # Neste mock completo, a resposta seria enviada de volta Ã  API do WhatsApp/Twilio
    try:
        reply = generate_chat_response(
            message=body,
            context=f"Origem: WhatsApp. {farm_context}. Responda de forma concisa como Tracto AI via WhatsApp.",
            history=[]
        )
    except Exception as e:
        reply = f"Erro na Tracto AI: {str(e)}"
    # MOCK ESTRUTURAL DE SAÃDA:
    # A Tracto AI roda perfeitamente o contexto, mas a resposta NÃƒO Ã© devolvida
    # pois nÃ£o temos a API do WhatsApp/Twilio configurada e tokenizada.
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


def _planet_cookie_options() -> dict:
    if _is_production():
        return {"secure": True, "samesite": "none"}
    return {"secure": False, "samesite": "lax"}


@app.post("/api/chat")
@limiter.limit("5/minute")
async def chat_endpoint(request: Request, chat_req: ChatRequest, _user: AuthenticatedUser = Depends(get_current_user)):
    try:
        if not chat_req.messages:
            raise HTTPException(status_code=400, detail="O historico de mensagens esta vazio.")

        reply = generate_chat_response(
            messages=[message.model_dump() for message in chat_req.messages],
            farm_context=chat_req.farm_context,
            image_base64=chat_req.image_base64,
            image_mime_type=chat_req.image_mime_type or "image/jpeg",
            hourly_weather=chat_req.hourly_weather,
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
    mode: str = "truecolor",
    user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Gera e retorna PNG recortado no polígono do talhão via Sentinel Hub Process API.
    source: 's2' (True Color) ou 's1' (Radar SAR). scene_date: ISO date opcional.
    """
    if source not in ("s1", "s2"):
        raise HTTPException(status_code=400, detail="source deve ser 's1' ou 's2'.")
    if mode not in ("truecolor", "ndvi", "falsecolor", "agriculture"):
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

        image_bytes = get_true_color_overlay(
            field_id=field_id,
            lat=lat,
            lng=lng,
            boundaries=boundaries,
            date_range_days=30,
            scene_date=scene_date,
            source=source,
            mode=mode,
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

        return Response(
            content=image_bytes,
            media_type="image/png",
            headers={
                "Cache-Control": "public, max-age=1800",
                "X-Field-ID": field_id,
                "X-Source": source,
                "X-Scene-Date": scene_date or "latest",
                "X-Mode": mode,
            },
        )
    except HTTPException:
        raise
    except Exception as exc:
        logging.error("[/api/sentinel/overlay] Erro field_id=%s source=%s: %s", field_id, source, exc)
        raise HTTPException(status_code=500, detail="Erro interno ao gerar overlay Sentinel.") from exc


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
    cookie_options = _planet_cookie_options()
    response.set_cookie(
        key="planet_tile_session",
        value=session_token,
        httponly=True,
        max_age=600,
        path="/api/planet/tiles",
        secure=cookie_options["secure"],
        samesite=cookie_options["samesite"],
    )
    return {"ok": True, "scene_id": scene_id, "expires_in": 600}


@app.get("/api/planet/tiles/{z}/{x}/{y}")
@limiter.limit("240/minute")
async def planet_tile_proxy_endpoint(
    request: Request,
    z: int,
    x: int,
    y: int,
    scene_id: str,
    planet_tile_session: str | None = Cookie(default=None),
):
    session_status = get_planet_tile_session_status(planet_tile_session, scene_id)
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

    try:
        tile_bytes, content_type = get_planet_tile(scene_id=scene_id, z=z, x=x, y=y)
        return Response(
            content=tile_bytes,
            media_type=content_type,
            headers={"Cache-Control": "public, max-age=900"},
        )
    except httpx.HTTPStatusError as exc:
        status_code = exc.response.status_code if exc.response is not None else 502
        detail = "Tile Planet indisponível."
        if status_code in (401, 403):
            detail = "Acesso Planet indisponível ou quota excedida."
        elif status_code == 404:
            detail = "Tile Planet não encontrado para esta cena."
        raise HTTPException(status_code=502, detail=detail) from exc
    except httpx.TimeoutException as exc:
        raise HTTPException(status_code=504, detail="Timeout ao buscar tile Planet.") from exc
    except Exception as exc:
        logging.error("[/api/planet/tiles] Erro scene_id=%s z=%s x=%s y=%s: %s", scene_id, z, x, y, exc)
        raise HTTPException(status_code=502, detail="Falha ao buscar tile Planet.") from exc


@app.get("/api/planet/overlay")
@limiter.limit("10/minute")
async def planet_overlay_endpoint(
    request: Request,
    field_id: str,
    scene_id: str,
    user: AuthenticatedUser = Depends(get_current_user),
):
    from services.planet_service import get_planet_overlay

    if _is_production() and os.getenv("ENABLE_PLANET_OVERLAY_LEGACY", "false").strip().lower() != "true":
        raise HTTPException(
            status_code=410,
            detail="Endpoint legado desabilitado em produção. Use /api/planet/tile-session + /api/planet/tiles.",
        )

    field_data = farm_service.get_field_by_id(user.id, field_id)
    if not field_data:
        raise HTTPException(status_code=404, detail="Talhão não encontrado.")

    lat = float(field_data.get("latitude", 0))
    lng = float(field_data.get("longitude", 0))
    boundaries = field_data.get("boundaries")
    image_bytes = get_planet_overlay(field_id=field_id, scene_id=scene_id, lat=lat, lng=lng, boundaries=boundaries)

    if not image_bytes:
        raise HTTPException(
            status_code=503,
            detail=(
                "Imagem Planet indisponível para esta cena. "
                "Verifique os logs para o status dos tiles. "
                "Isso pode indicar que o plano Planet não inclui acesso a tile streaming."
            ),
        )

    return Response(
        content=image_bytes,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=1800"},
    )


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
    user: AuthenticatedUser = Depends(get_current_user),
):
    try:
        snapshot = await build_field_intelligence_snapshot(user_id=user.id, field_id=field_id)
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

