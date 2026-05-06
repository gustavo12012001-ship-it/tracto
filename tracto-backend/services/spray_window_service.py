"""
spray_window_service.py — Avalia janela de pulverização com base em dados meteorológicos.

Regras agronômicas baseadas em normas ANDEF/MAPA:
  - Vento: ideal 3–10 km/h, limite 15 km/h
  - Umidade: ideal 55–80%, mínimo 40%
  - Temperatura: ideal 15–28°C, máximo 32°C operacional
  - Chuva: sem previsão nas próximas 6h (tempo de carência)
"""

from __future__ import annotations


def evaluate_spray_window(weather: dict) -> dict:
    """
    Avalia condições para pulverização.

    Parameters
    ----------
    weather : dict
        wind_speed     float  km/h
        humidity       float  %
        temperature    float  °C
        rain_next_6h   float  mm  (precipitação prevista próximas 6h)
        rain_next_24h  float  mm
        weather_code   int    (WMO Open-Meteo — 61+ = chuva)

    Returns
    -------
    dict com campos:
        status        "GO" | "CAUTION" | "NO_GO"
        score         int 0-100
        reasons       list[str]   condições negativas
        favorable     list[str]   condições positivas
        best_window   str         sugestão textual
        checklist     list[{item, ok}]
    """
    wind = float(weather.get("wind_speed") or 0)
    humidity = float(weather.get("humidity") or 0)
    temp = float(weather.get("temperature") or 20)
    rain_6h = float(weather.get("rain_next_6h") or 0)
    rain_24h = float(weather.get("rain_next_24h") or 0)
    wmo = int(weather.get("weather_code") or 0)

    reasons: list[str] = []
    favorable: list[str] = []
    score = 100

    # ── Vento ────────────────────────────────────────────────────────────────
    if wind > 15:
        reasons.append(f"Vento muito alto ({wind:.0f} km/h) — limite máximo é 15 km/h")
        score -= 40
    elif wind > 10:
        reasons.append(f"Vento moderado ({wind:.0f} km/h) — risco de deriva aumentado")
        score -= 20
    elif wind < 1:
        reasons.append("Vento muito fraco (<1 km/h) — favorece deriva descendente e concentração de produto")
        score -= 10
    else:
        favorable.append(f"Vento ideal ({wind:.0f} km/h)")

    # ── Umidade ──────────────────────────────────────────────────────────────
    if humidity < 40:
        reasons.append(f"Umidade muito baixa ({humidity:.0f}%) — evaporação excessiva e deriva de gotas finas")
        score -= 35
    elif humidity < 50:
        reasons.append(f"Umidade baixa ({humidity:.0f}%) — risco de evaporação das gotas")
        score -= 15
    elif 55 <= humidity <= 80:
        favorable.append(f"Umidade ideal ({humidity:.0f}%)")
    else:
        favorable.append(f"Umidade adequada ({humidity:.0f}%)")

    # ── Temperatura ──────────────────────────────────────────────────────────
    if temp > 36:
        reasons.append(f"Temperatura muito alta ({temp:.0f}°C) — risco severo de fitotoxicidade e volatilização")
        score -= 35
    elif temp > 32:
        reasons.append(f"Temperatura alta ({temp:.0f}°C) — risco de fitotoxicidade e perda de eficácia")
        score -= 20
    elif temp > 28:
        reasons.append(f"Temperatura elevada ({temp:.0f}°C) — prefira aplicar no início da manhã ou fim de tarde")
        score -= 8
    elif 15 <= temp <= 25:
        favorable.append(f"Temperatura ideal ({temp:.0f}°C)")
    else:
        favorable.append(f"Temperatura adequada ({temp:.0f}°C)")

    # ── Chuva atual (WMO) ────────────────────────────────────────────────────
    if wmo >= 61:
        reasons.append("Chuva em andamento — não aplicar")
        score -= 50
    elif wmo in (51, 53, 55):
        reasons.append("Garoa / chuvisco em andamento — aguardar melhora")
        score -= 30

    # ── Chuva prevista ───────────────────────────────────────────────────────
    if rain_6h > 0.5:
        reasons.append(f"Chuva prevista nas próximas 6h ({rain_6h:.1f} mm) — produto pode ser lavado antes de absorção")
        score -= 30
    elif rain_6h > 0:
        reasons.append(f"Possibilidade de chuva nas próximas 6h ({rain_6h:.1f} mm)")
        score -= 10
    else:
        favorable.append("Sem chuva prevista nas próximas 6h")

    if rain_24h > 5 and rain_6h <= 0.5:
        reasons.append(f"Chuva prevista nas próximas 24h ({rain_24h:.1f} mm) — monitore a janela")
        score -= 8
    elif rain_24h == 0:
        favorable.append("Sem chuva prevista nas próximas 24h")

    # ── Limitar score ────────────────────────────────────────────────────────
    score = max(0, min(100, score))

    # ── Status final ─────────────────────────────────────────────────────────
    has_nogo = wind > 15 or humidity < 40 or temp > 36 or wmo >= 61 or rain_6h > 0.5
    has_caution = wind > 10 or humidity < 50 or temp > 28 or rain_24h > 5 or wmo in (51, 53, 55)

    if has_nogo or score < 35:
        status = "NO_GO"
    elif has_caution or score < 65:
        status = "CAUTION"
    else:
        status = "GO"

    # ── Sugestão de janela ───────────────────────────────────────────────────
    if status == "GO":
        best_window = "Condições favoráveis agora — aplique nas próximas horas"
    elif temp > 28:
        best_window = "Prefira aplicar amanhã entre 06h–09h ou após 17h (temperatura mais baixa)"
    elif wind > 10:
        best_window = "Aguarde redução do vento — geralmente menor ao amanhecer (05h–08h)"
    elif humidity < 50:
        best_window = "Prefira horários de maior umidade: amanhecer ou fim de tarde"
    elif rain_6h > 0:
        best_window = "Aguarde a janela sem chuva — monitore a previsão hora a hora"
    else:
        best_window = "Corrija as condições indicadas antes de aplicar"

    # ── Checklist ────────────────────────────────────────────────────────────
    checklist = [
        {"item": "Vento ≤ 10 km/h", "ok": wind <= 10},
        {"item": "Umidade ≥ 50%", "ok": humidity >= 50},
        {"item": "Temperatura ≤ 30°C", "ok": temp <= 30},
        {"item": "Sem chuva nas próximas 6h", "ok": rain_6h <= 0.5 and wmo < 51},
        {"item": "Sem chuva nas próximas 24h", "ok": rain_24h <= 2},
        {"item": "Sem chuva em andamento", "ok": wmo < 51},
    ]

    return {
        "status": status,
        "score": score,
        "reasons": reasons,
        "favorable": favorable,
        "best_window": best_window,
        "checklist": checklist,
    }
