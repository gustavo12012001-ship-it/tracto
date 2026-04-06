import json
import logging
import os
from datetime import datetime

import httpx
from dotenv import load_dotenv
from typing import Optional

load_dotenv()

from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, Header, Request, Query, Response
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
    LatestSceneRequest,
    GeoSearchRequest,
    FieldIntelligenceSnapshot,
)
from services import supabase_service, farm_service
from services.billing_service import billing_service
from services.ai_service import MODEL, _get_client, analyze_ndvi_image, analyze_weather_map, generate_alerts_claude, generate_chat_response
from services.auth_service import AuthenticatedUser, get_unverified_user_id_from_header, get_current_user
from services.cache_service import analysis_cache
from services.sentinel_service import get_ndvi_image, get_latest_scene_metadata, get_tile_image
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


@app.post("/api/sentinel/latest-scene")
@limiter.limit("12/minute")
async def latest_sentinel_scene_endpoint(
    request: Request,
    scene_req: LatestSceneRequest,
    _user: AuthenticatedUser = Depends(get_current_user),
):
    try:
        return get_latest_scene_metadata(
            lat=scene_req.lat,
            lng=scene_req.lng,
            boundaries=scene_req.boundaries,
            lookback_days=scene_req.lookback_days,
            max_cloud_coverage=scene_req.max_cloud_coverage,
        )
    except Exception as exc:
        logging.error("Erro ao buscar metadados de cena Sentinel-2: %s", exc)
        raise HTTPException(status_code=500, detail="Erro ao buscar cena Sentinel-2 recente.") from exc


@app.get("/api/sentinel/tile/{z}/{x}/{y}")
@limiter.limit("100/minute")
async def sentinel_tile_proxy(z: int, x: int, y: int, request: Request):
    """
    Proxy autenticado de tiles Sentinel-2 TRUE-COLOR via Process API (OAuth).
    Sem dependência de SENTINEL_INSTANCE_ID — sempre busca cena mais recente.
    """
    img_bytes = get_tile_image(z, x, y)

    if not img_bytes:
        # Retorna tile transparente 1x1 para não quebrar o mapa
        transparent_1x1 = (
            b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
            b"\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t"
            b"\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a"
            b"\x1f\x1e\x1d\x1a\x1c\x1c $.\' \",#\x1c\x1c(7),01444\x1f\'9=82<.342\x1e"
            b"\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00"
            b"\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00"
            b"\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xc4\x00"
            b"\xb5\x10\x00\x02\x01\x03\x03\x02\x04\x03\x05\x05\x04\x04\x00\x00"
            b"\x01}\x01\x02\x03\x00\x04\x11\x05\x12!1A\x06\x13Qa\x07\"q\x142\x81"
            b"\x91\xa1\x08#B\xb1\xc1\x15R\xd1\xf0$3br\x82\t\n\x16\x17\x18\x19"
            b"\x1a%&\'()*456789:CDEFGHIJSTUVWXYZcdefghijstuvwxyz\x83\x84\x85\x86"
            b"\x87\x88\x89\x8a\x92\x93\x94\x95\x96\x97\x98\x99\x9a\xa2\xa3\xa4"
            b"\xa5\xa6\xa7\xa8\xa9\xaa\xb2\xb3\xb4\xb5\xb6\xb7\xb8\xb9\xba\xc2"
            b"\xc3\xc4\xc5\xc6\xc7\xc8\xc9\xca\xd2\xd3\xd4\xd5\xd6\xd7\xd8\xd9"
            b"\xda\xe1\xe2\xe3\xe4\xe5\xe6\xe7\xe8\xe9\xea\xf1\xf2\xf3\xf4\xf5"
            b"\xf6\xf7\xf8\xf9\xfa\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xfb\xd4"
            b"P\x00\x00\x00\x00\x1f\xff\xd9"
        )
        return Response(content=transparent_1x1, media_type="image/jpeg")

    return Response(
        content=img_bytes,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "public, max-age=3600",
            "X-Sentinel-Source": "process-api",
        },
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

