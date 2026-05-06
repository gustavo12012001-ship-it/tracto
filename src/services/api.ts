import type { WeatherCache } from '../store/useAppStore';
import { supabase } from './supabase';

export const API_URL = import.meta.env.VITE_API_URL || 'https://tracto-production.up.railway.app';

export async function buildAuthHeaders(): Promise<Record<string, string>> {
  try {
    let {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      const refreshed = await supabase.auth.refreshSession();
      session = refreshed.data.session;
    }

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
      throw new Error(`Falha de conexão com o backend em ${url}. Verifique se o servidor está online, se a URL/API está correta e se o CORS está configurado corretamente.`);
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
  engine_results: Record<string, {
    color: string;
    label: string;
    level: number;
    [key: string]: unknown;
  }>;
  source: string;
}

export interface SnapshotSourceStatus {
  status: 'ok' | 'fallback' | 'unavailable';
  message: string;
  updated_at: string | null;
}

export interface FieldIntelligenceSnapshot {
  field_id: string;
  field_name: string;
  farm_id: string | null;
  farm_name: string | null;
  lat: number;
  lng: number;
  boundaries: [number, number][] | null;
  crop_type: string | null;
  planting_date: string | null;
  variety: string | null;
  area_ha: number | null;
  weather: Record<string, unknown>;
  satellite: Record<string, unknown>;
  analysis: Record<string, unknown>;
  alerts: Array<Record<string, unknown>>;
  report_summary: string;
  weather_status: SnapshotSourceStatus;
  satellite_status: SnapshotSourceStatus;
  analysis_status: SnapshotSourceStatus;
  ai_summary_status: SnapshotSourceStatus;
  updated_at: string;
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

export async function fetchFieldIntelligenceSnapshot(fieldId: string, forceRefresh = false) {
  const query = forceRefresh ? '?force_refresh=true' : '';
  return apiFetch<FieldIntelligenceSnapshot>(`/api/fields/${fieldId}/intelligence${query}`, {
    method: 'GET',
  });
}

// ── Open-Meteo weather fetch (shared — used by Weather page AND Layout preload) ─

const WEATHER_TTL_MS = 30 * 60 * 1000; // 30 min

export async function fetchOpenMeteo(lat: number, lng: number): Promise<WeatherCache> {
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
    lat, lng,
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

/** Pre-load weather silently; skips if cache is fresh (< 30 min old). */
export async function preloadWeather(lat: number, lng: number, current: WeatherCache | null): Promise<WeatherCache | null> {
  if (current && Date.now() - current.fetchedAt < WEATHER_TTL_MS) return null; // still fresh
  try {
    return await fetchOpenMeteo(lat, lng);
  } catch {
    return null;
  }
}
