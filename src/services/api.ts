import type { WeatherCache } from '../store/useAppStore';
import { supabase } from './supabase';

export const API_URL = import.meta.env.VITE_API_URL || '';

async function buildAuthHeaders() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      return {};
    }

    return {
      Authorization: `Bearer ${session.access_token}`,
    };
  } catch {
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
    if (err instanceof TypeError && err.message === 'Failed to fetch') {
      throw new Error(`O servidor Backend/API não está acessível em ${API_URL}. Verifique se ele está rodando.`);
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
  engine_results: Record<string, any>;
  source: string;
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
