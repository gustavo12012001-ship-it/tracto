import type { WeatherCache } from '../store/useAppStore';

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
    lat,
    lng,
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
