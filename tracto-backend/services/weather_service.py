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
