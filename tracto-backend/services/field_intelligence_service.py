import asyncio
import logging
from datetime import datetime
from typing import Any

from models import FieldIntelligenceSnapshot, SnapshotSourceStatus
from services import farm_service
from services.agronomic_engine import AgronomicEngine
from services.ai_service import generate_alerts_claude
from services.cache_service import analysis_cache
from services.sentinel_service import get_ndvi_image, get_latest_scene_metadata
from services.weather_service import fetch_weather_snapshot

WEATHER_TIMEOUT_SECONDS = 5.0
SATELLITE_TIMEOUT_SECONDS = 8.0
ANALYSIS_TIMEOUT_SECONDS = 6.0
AI_SUMMARY_TIMEOUT_SECONDS = 4.0


def _first_or_default(value: Any, default: float = 0.0) -> float:
	try:
		if value is None:
			return default
		return float(value)
	except (TypeError, ValueError):
		return default


def _now_iso() -> str:
	return datetime.now().isoformat()


def _cache_key(prefix: str, field_id: str) -> str:
	return f"field_intelligence:{prefix}:{field_id}"


def _safe_boundaries(value: Any) -> list[list[float]] | None:
	if not isinstance(value, list):
		return None

	parsed: list[list[float]] = []
	for point in value:
		if not isinstance(point, (list, tuple)) or len(point) < 2:
			continue
		try:
			parsed.append([float(point[0]), float(point[1])])
		except (TypeError, ValueError):
			continue
	return parsed if len(parsed) >= 3 else None


def _build_weather_fallback() -> dict[str, Any]:
	return {
		"temperature": None,
		"humidity": None,
		"wind_speed": None,
		"rain_accumulation": None,
		"et0": None,
		"condition": "Dados climaticos indisponiveis",
		"forecast_7d": None,
		"updated_at": _now_iso(),
	}


def _build_satellite_fallback(message: str) -> dict[str, Any]:
	return {
		"status": "fallback",
		"provider": "Sentinel-2",
		"scene_date": None,
		"scene_date_br": None,
		"scene_id": None,
		"cloud_coverage": None,
		"message": message,
		"ndvi_image_base64": None,
		"updated_at": _now_iso(),
	}


async def _resolve_weather(lat: float, lng: float, field_id: str) -> tuple[dict[str, Any], SnapshotSourceStatus]:
	cache_key = _cache_key("weather", field_id)
	cached = analysis_cache.get(cache_key)

	try:
		weather = await asyncio.wait_for(fetch_weather_snapshot(lat, lng), timeout=WEATHER_TIMEOUT_SECONDS)
		if weather:
			weather["updated_at"] = _now_iso()
			analysis_cache.set(cache_key, weather, ttl_hours=2)
			return weather, SnapshotSourceStatus(
				status="ok",
				message="Clima atualizado com sucesso.",
				updated_at=weather["updated_at"],
			)
	except asyncio.TimeoutError:
		logging.warning("Timeout ao buscar clima do talhao %s", field_id)
	except Exception as exc:
		logging.warning("Falha ao buscar clima do talhao %s: %s", field_id, exc)

	if isinstance(cached, dict):
		return cached, SnapshotSourceStatus(
			status="fallback",
			message="Clima em fallback de cache.",
			updated_at=cached.get("updated_at"),
		)

	fallback = _build_weather_fallback()
	return fallback, SnapshotSourceStatus(
		status="unavailable",
		message="Clima indisponivel no momento.",
		updated_at=fallback["updated_at"],
	)


async def _resolve_satellite(
	lat: float,
	lng: float,
	boundaries: list[list[float]] | None,
	field_id: str,
) -> tuple[dict[str, Any], SnapshotSourceStatus]:
	cache_key = _cache_key("satellite", field_id)
	cached = analysis_cache.get(cache_key)

	try:
		scene_meta = await asyncio.wait_for(
			asyncio.to_thread(get_latest_scene_metadata, lat, lng, boundaries, 21, 40),
			timeout=SATELLITE_TIMEOUT_SECONDS,
		)
		ndvi_data = await asyncio.wait_for(
			asyncio.to_thread(get_ndvi_image, lat, lng, boundaries, 15),
			timeout=SATELLITE_TIMEOUT_SECONDS,
		)

		if isinstance(scene_meta, dict):
			satellite = {
				**scene_meta,
				"ndvi_image_base64": ndvi_data.get("image_base64") if isinstance(ndvi_data, dict) else None,
				"ndvi_stats": ndvi_data.get("stats") if isinstance(ndvi_data, dict) else None,
				"updated_at": _now_iso(),
			}
			analysis_cache.set(cache_key, satellite, ttl_hours=12)
			return satellite, SnapshotSourceStatus(
				status="ok",
				message="Imagem satelital atualizada.",
				updated_at=satellite["updated_at"],
			)
	except asyncio.TimeoutError:
		logging.warning("Timeout ao buscar satelite do talhao %s", field_id)
	except Exception as exc:
		logging.warning("Falha ao buscar satelite do talhao %s: %s", field_id, exc)

	if isinstance(cached, dict):
		return cached, SnapshotSourceStatus(
			status="fallback",
			message="Satelite em fallback da ultima cena em cache.",
			updated_at=cached.get("updated_at"),
		)

	fallback = _build_satellite_fallback("Nenhuma cena Sentinel-2 disponivel no momento.")
	return fallback, SnapshotSourceStatus(
		status="unavailable",
		message="Satelite indisponivel no momento.",
		updated_at=fallback["updated_at"],
	)


def _build_analysis(
	weather: dict[str, Any],
	crop_type: str | None,
	has_satellite_data: bool,
	has_boundaries: bool,
) -> dict[str, Any]:
	engine = AgronomicEngine()
	effective_crop = crop_type or "Nao informada"

	temperature = _first_or_default(weather.get("temperature"), 25.0)
	humidity = _first_or_default(weather.get("humidity"), 60.0)
	wind_speed = _first_or_default(weather.get("wind_speed"), 10.0)
	rain_accumulation = _first_or_default(weather.get("rain_accumulation"), 0.0)

	spray_window = engine.calculate_spray_window(temperature, humidity, wind_speed)
	frost_risk = engine.calculate_frost_risk(temperature, effective_crop)
	water_stress = engine.calculate_water_stress(
		rain_accumulation,
		temperature,
		effective_crop,
		weather.get("et0"),
	)
	confidence = engine.calculate_confidence(
		sat_data=has_satellite_data,
		weather_data=weather.get("temperature") is not None,
		boundaries_data=has_boundaries,
	)

	return {
		"spray_window": spray_window,
		"frost_risk": frost_risk,
		"water_stress": water_stress,
		"confidence": confidence,
		"generated_at": _now_iso(),
	}


def _build_alerts(
	weather: dict[str, Any],
	crop_type: str | None,
	field_name: str,
	lat: float,
	lng: float,
	analysis: dict[str, Any],
) -> list[dict[str, Any]]:
	class AlertLike:
		pass

	alert_like = AlertLike()
	alert_like.temperature = _first_or_default(weather.get("temperature"), 25.0)
	alert_like.humidity = _first_or_default(weather.get("humidity"), 60.0)
	alert_like.rain_accumulation = _first_or_default(weather.get("rain_accumulation"), 0.0)
	alert_like.wind_speed = _first_or_default(weather.get("wind_speed"), 10.0)
	alert_like.crop_type = crop_type or "Nao informada"
	alert_like.et0 = weather.get("et0")
	alert_like.fields = [{"name": field_name, "crop": crop_type, "lat": lat, "lng": lng}]
	alert_like.weather_forecast = weather.get("forecast_7d")
	alert_like.engine_results = [analysis]

	try:
		return generate_alerts_claude(alert_like, {})
	except Exception as exc:
		logging.warning("Falha ao gerar alertas IA para %s: %s", field_name, exc)
		return [
			{
				"id": "A-FALLBACK-001",
				"type": "info",
				"title": "Analise parcial",
				"message": "Algumas fontes externas estao indisponiveis. Revise os dados do talhao antes da acao.",
				"field": field_name,
				"value": "PARCIAL",
				"valueLabel": "status",
				"createdAt": _now_iso(),
			}
		]


async def _build_ai_summary(
	field_name: str,
	crop_type: str | None,
	weather: dict[str, Any],
	satellite: dict[str, Any],
	analysis: dict[str, Any],
) -> tuple[str, SnapshotSourceStatus]:
	base_ready = weather.get("temperature") is not None and analysis.get("confidence") is not None
	if not base_ready:
		return (
			"Dados insuficientes para analise completa.",
			SnapshotSourceStatus(
				status="unavailable",
				message="Resumo textual indisponivel por falta de dados minimos.",
				updated_at=_now_iso(),
			),
		)

	def _compose() -> str:
		forecast = weather.get("forecast_7d") or "Previsao indisponivel"
		scene = satellite.get("scene_date_br") or "N/D"
		return (
			f"Talhao {field_name} ({crop_type or 'Nao informada'}): "
			f"temperatura atual {_first_or_default(weather.get('temperature')):.1f}C, "
			f"umidade {_first_or_default(weather.get('humidity')):.0f}%, "
			f"janela de pulverizacao {analysis.get('spray_window', {}).get('label', 'N/D')}, "
			f"risco de geada {analysis.get('frost_risk', {}).get('label', 'N/D')}, "
			f"estresse hidrico {analysis.get('water_stress', {}).get('label', 'N/D')}. "
			f"Ultima cena Sentinel: {scene}. Previsao resumida: {forecast}."
		)

	try:
		summary = await asyncio.wait_for(asyncio.to_thread(_compose), timeout=AI_SUMMARY_TIMEOUT_SECONDS)
		return (
			summary,
			SnapshotSourceStatus(
				status="ok",
				message="Resumo consolidado gerado.",
				updated_at=_now_iso(),
			),
		)
	except asyncio.TimeoutError:
		return (
			"Dados insuficientes para analise completa.",
			SnapshotSourceStatus(
				status="fallback",
				message="Resumo textual em fallback por timeout.",
				updated_at=_now_iso(),
			),
		)
	except Exception as exc:
		logging.warning("Falha ao gerar resumo textual do snapshot: %s", exc)
		return (
			"Dados insuficientes para analise completa.",
			SnapshotSourceStatus(
				status="fallback",
				message="Resumo textual em fallback por indisponibilidade.",
				updated_at=_now_iso(),
			),
		)


async def build_field_intelligence_snapshot(user_id: str, field_id: str) -> FieldIntelligenceSnapshot:
	snapshot_cache_key = _cache_key("snapshot", field_id)
	cached_snapshot = analysis_cache.get(snapshot_cache_key)
	if isinstance(cached_snapshot, dict):
		try:
			logging.info("field_intelligence_snapshot cache hit field_id=%s", field_id)
			return FieldIntelligenceSnapshot(**cached_snapshot)
		except Exception as exc:
			logging.warning("Snapshot em cache invalido para field_id=%s. Recalculando. erro=%s", field_id, exc)
	else:
		logging.info("field_intelligence_snapshot cache miss field_id=%s", field_id)

	field = farm_service.get_field_by_id(user_id=user_id, field_id=field_id)
	if not field:
		raise ValueError("Talhao nao encontrado para o usuario autenticado.")

	farms = farm_service.get_farms(user_id=user_id)
	farm_name = None
	farm_id = field.get("farm_id")
	if farm_id:
		for farm in farms:
			if farm.get("id") == farm_id:
				farm_name = farm.get("name")
				break

	lat = _first_or_default(field.get("latitude"))
	lng = _first_or_default(field.get("longitude"))
	boundaries = _safe_boundaries(field.get("boundaries"))

	weather, weather_status = await _resolve_weather(lat, lng, field_id)
	satellite, satellite_status = await _resolve_satellite(lat, lng, boundaries, field_id)

	try:
		analysis = await asyncio.wait_for(
			asyncio.to_thread(
				_build_analysis,
				weather,
				field.get("crop_type"),
				satellite.get("scene_date") is not None,
				boundaries is not None,
			),
			timeout=ANALYSIS_TIMEOUT_SECONDS,
		)
		analysis_status = SnapshotSourceStatus(
			status="ok",
			message="Analise deterministico-consolidada gerada.",
			updated_at=analysis.get("generated_at"),
		)
	except asyncio.TimeoutError:
		analysis = {
			"spray_window": {"label": "Dados insuficientes", "level": 0, "color": "gray"},
			"frost_risk": {"label": "Nao avaliado", "level": 0, "color": "gray"},
			"water_stress": {"label": "Nao avaliado", "level": 0, "color": "gray"},
			"confidence": 0.0,
			"generated_at": _now_iso(),
		}
		analysis_status = SnapshotSourceStatus(
			status="fallback",
			message="Analise em fallback por timeout.",
			updated_at=analysis.get("generated_at"),
		)
	except Exception as exc:
		logging.warning("Falha na analise deterministica do talhao %s: %s", field_id, exc)
		analysis = {
			"spray_window": {"label": "Dados insuficientes", "level": 0, "color": "gray"},
			"frost_risk": {"label": "Nao avaliado", "level": 0, "color": "gray"},
			"water_stress": {"label": "Nao avaliado", "level": 0, "color": "gray"},
			"confidence": 0.0,
			"generated_at": _now_iso(),
		}
		analysis_status = SnapshotSourceStatus(
			status="fallback",
			message="Analise em fallback por indisponibilidade.",
			updated_at=analysis.get("generated_at"),
		)

	alerts = _build_alerts(
		weather=weather,
		crop_type=field.get("crop_type"),
		field_name=field.get("name") or "Talhao",
		lat=lat,
		lng=lng,
		analysis=analysis,
	)

	report_summary, ai_summary_status = await _build_ai_summary(
		field_name=field.get("name") or "Talhao",
		crop_type=field.get("crop_type"),
		weather=weather,
		satellite=satellite,
		analysis=analysis,
	)

	snapshot = FieldIntelligenceSnapshot(
		field_id=field_id,
		field_name=field.get("name") or "Talhao",
		farm_id=farm_id,
		farm_name=farm_name,
		lat=lat,
		lng=lng,
		boundaries=boundaries,
		crop_type=field.get("crop_type"),
		planting_date=field.get("planting_date"),
		variety=field.get("variety"),
		area_ha=field.get("area_ha"),
		weather=weather,
		satellite=satellite,
		analysis=analysis,
		alerts=alerts,
		report_summary=report_summary,
		weather_status=weather_status,
		satellite_status=satellite_status,
		analysis_status=analysis_status,
		ai_summary_status=ai_summary_status,
		updated_at=_now_iso(),
	)

	analysis_cache.set(snapshot_cache_key, snapshot.model_dump(), ttl_hours=0.5)
	return snapshot
