import { apiFetch } from './api';
import type { Alert, Location, WeatherCache } from '../store/useAppStore';

type RawAlert = {
  id?: string;
  type?: string;
  title?: string;
  message?: string;
  createdAt?: string | number;
  field?: string;
  value?: string;
  valueLabel?: string;
};

function normalizeAlertType(type: string | undefined): Alert['type'] {
  return type === 'critical' || type === 'warning' || type === 'info' ? type : 'info';
}

function normalizeTimestamp(createdAt: string | number | undefined, fallback: number) {
  if (typeof createdAt === 'number') return createdAt;
  const parsed = new Date(createdAt ?? '').getTime();
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sumWindow(values: number[] | undefined, days = 7) {
  if (!values || values.length === 0) return 0;
  return values.slice(0, days).reduce((sum, value) => sum + (value ?? 0), 0);
}

export async function generateAlerts(
  weatherCache: WeatherCache | null,
  fields: Location[],
): Promise<Alert[]> {
  const fieldsInfo =
    fields.length > 0
      ? fields.map((location, index) => ({
          name: location.name || `Talhao ${index + 1}`,
          lat: location.lat,
          lng: location.lng,
          crop: location.cultura || null,
          boundaries: location.boundaries || null,
        }))
      : [];

  const distinctCrops = [...new Set(fieldsInfo.map((f) => f.crop).filter(Boolean))];

  const currentCrop =
    distinctCrops.length === 1
      ? (distinctCrops[0] as string)
      : distinctCrops.length > 1
        ? 'Multiplas culturas'
        : null;

  const payload = {
    temperature: weatherCache ? weatherCache.temperature : 25,
    humidity: weatherCache ? weatherCache.humidity : 60,
    rain_accumulation: weatherCache ? sumWindow(weatherCache.daily.precipSum, 7) : 0,
    wind_speed: weatherCache ? weatherCache.windSpeed : 10,
    et0: weatherCache ? sumWindow(weatherCache.daily.et0, 7) : null,
    crop_type: currentCrop,
    fields: fieldsInfo,
    weather_forecast: weatherCache
      ? weatherCache.daily.time
          .slice(0, 7)
          .map((day, index) => `${day}: chuva ${(weatherCache.daily.precipSum[index] ?? 0).toFixed(1)}mm`)
          .join(' | ')
      : null,
  };

  const data = await apiFetch<{ alerts?: RawAlert[] }>('/api/alerts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  if (!Array.isArray(data.alerts)) {
    throw new Error('A API retornou um formato de alertas invalido.');
  }

  const now = Date.now();
  return data.alerts.map((alert, index) => ({
    id: alert.id || `alerta-${now}-${index}`,
    type: normalizeAlertType(alert.type),
    title: alert.title ?? 'Alerta Agronomico',
    message: alert.message ?? '',
    timestamp: normalizeTimestamp(alert.createdAt, now),
    dismissed: false,
    field: alert.field,
    value: alert.value,
    valueLabel: alert.valueLabel,
  }));
}
