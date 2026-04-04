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
        client = _get_client()
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
