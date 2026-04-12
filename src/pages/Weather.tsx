import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore, { type WeatherCache } from '../store/useAppStore';
import { SkeletonCard } from '../components/Skeleton';

// ── WMO Weather Code → icon + label ──────────────────────────────────────────
const WMO_CODES: Record<number, { icon: string; label: string }> = {
  0: { icon: 'wb_sunny', label: 'Céu limpo' },
  1: { icon: 'wb_sunny', label: 'Predominantemente limpo' },
  2: { icon: 'partly_cloudy_day', label: 'Parcialmente nublado' },
  3: { icon: 'cloud', label: 'Nublado' },
  45: { icon: 'foggy', label: 'Neblina' },
  48: { icon: 'foggy', label: 'Neblina com gelo' },
  51: { icon: 'grain', label: 'Chuvisco leve' },
  61: { icon: 'rainy', label: 'Chuva leve' },
  63: { icon: 'rainy', label: 'Chuva moderada' },
  65: { icon: 'rainy', label: 'Chuva forte' },
  71: { icon: 'ac_unit', label: 'Neve leve' },
  80: { icon: 'rainy', label: 'Pancadas de chuva' },
  95: { icon: 'thunderstorm', label: 'Tempestade' },
  99: { icon: 'thunderstorm', label: 'Tempestade com granizo' },
};

const wmo = (code: number) => WMO_CODES[code] ?? { icon: 'cloud', label: 'Variável' };

const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

// ── Open-Meteo fetch ──────────────────────────────────────────────────────────
async function fetchOpenMeteo(lat: number, lng: number): Promise<WeatherCache> {
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

// ── Component ─────────────────────────────────────────────────────────────────
export default function Weather() {
  const navigate = useNavigate();
  const {
    currentLocation,
    fields,
    activeFieldId,
    weatherCache,
    setWeatherCache,
    fieldIntelligenceById,
    fetchFieldIntelligence,
  } = useAppStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [windyOverlay, setWindyOverlay] = useState<'temp' | 'rain' | 'humidity' | 'wind' | 'clouds'>('temp');

  const activeField = activeFieldId
    ? fields.find((field) => field.id === activeFieldId) ?? null
    : null;

  const loc = activeField
    ? activeField
    : (currentLocation ?? { lat: -18.9188, lng: -48.2768, name: 'Uberlândia, MG' });

  const snapshot = activeFieldId ? fieldIntelligenceById[activeFieldId] : null;

  useEffect(() => {
    if (!activeFieldId) return;
    void fetchFieldIntelligence(activeFieldId, false);
  }, [activeFieldId, fetchFieldIntelligence]);

  useEffect(() => {
    const isCacheValid =
      weatherCache &&
      Math.abs(weatherCache.lat - loc.lat) < 0.01 &&
      Math.abs(weatherCache.lng - loc.lng) < 0.01 &&
      Date.now() - weatherCache.fetchedAt < CACHE_TTL_MS;

    if (isCacheValid) {
      return;
    }

    let mounted = true;
    const loadWeather = async () => {
      setLoading(true);
      setError(null);
      try {
        const cache = await fetchOpenMeteo(loc.lat, loc.lng);
        if (mounted) setWeatherCache(cache);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : 'Erro desconhecido');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadWeather();

    return () => {
      mounted = false;
    };
  }, [loc.lat, loc.lng, weatherCache, setWeatherCache]);

  const w = weatherCache;
  const snapshotWeather = snapshot?.weather as Record<string, unknown> | undefined;
  const hasSnapshotWeather = Boolean(snapshot && snapshot.weather_status.status !== 'unavailable' && snapshotWeather);

  const displayTemperature = hasSnapshotWeather
    ? Number(snapshotWeather?.temperature ?? w?.temperature ?? 0)
    : (w?.temperature ?? 0);
  const displayHumidity = hasSnapshotWeather
    ? Number(snapshotWeather?.humidity ?? w?.humidity ?? 0)
    : (w?.humidity ?? 0);
  const displayWindSpeed = hasSnapshotWeather
    ? Number(snapshotWeather?.wind_speed ?? w?.windSpeed ?? 0)
    : (w?.windSpeed ?? 0);
  const displayCondition = hasSnapshotWeather
    ? String(snapshotWeather?.condition ?? 'Snapshot do talhão')
    : '';

  const sourceLabel = hasSnapshotWeather ? 'Snapshot do talhão ativo' : 'Open-Meteo direto (fallback)';
  const sourceTimestamp = hasSnapshotWeather
    ? (snapshot?.weather_status.updated_at ?? snapshot?.updated_at ?? null)
    : (w ? new Date(w.fetchedAt).toISOString() : null);

  const { icon, label } = w ? wmo(w.weatherCode) : { icon: 'cloud', label: displayCondition };

  // Current hour index for highlighting
  const nowHour = new Date().getHours();

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin" style={{ background: 'var(--bg)' }}>
      <div className="p-5 flex flex-col gap-4 max-w-5xl mx-auto w-full">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Meteorologia</h1>
            <p className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: '#64748b' }}>
              <span className="material-symbols-outlined text-sm" style={{ color: '#ec5b13' }}>location_on</span>
              {loc.name ?? 'Localização atual'} · {activeField ? 'Talhão ativo' : 'Localização atual'} · {sourceLabel}
            </p>
            {(snapshot || w) && (
              <p className="text-[11px] mt-1" style={{ color: '#94a3b8' }}>
                Fonte usada em: {sourceTimestamp ? new Date(sourceTimestamp).toLocaleString('pt-BR') : 'N/D'}{snapshot ? ` · Satélite atualizado em: ${snapshot.satellite_status.updated_at ? new Date(snapshot.satellite_status.updated_at).toLocaleString('pt-BR') : 'N/D'}` : ''}
              </p>
            )}
          </div>
          <button
            onClick={() => {
              setLoading(true);
              Promise.all([
                fetchOpenMeteo(loc.lat, loc.lng).then(setWeatherCache),
                activeFieldId ? fetchFieldIntelligence(activeFieldId, true) : Promise.resolve(null),
              ])
                .catch((e) => setError(e.message))
                .finally(() => setLoading(false));
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', color: '#94a3b8' }}
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Atualizar talhão
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="p-4 rounded-xl flex items-start gap-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <span className="material-symbols-outlined text-red-400 mt-0.5">error</span>
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* ── Mapa Meteorológico Windy ── */}
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.09)' }}>
          {/* Header do mapa */}
          <div className="px-5 py-4 flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-bold text-white">Mapa Meteorológico em Tempo Real</h2>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                Windy · Ao Vivo
              </span>
            </div>
            {/* Seletor de camadas */}
            <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {[
                { key: 'temp', label: 'Temperatura', icon: 'thermostat' },
                { key: 'rain', label: 'Precipitação', icon: 'water_drop' },
                { key: 'humidity', label: 'Umidade', icon: 'humidity_percentage' },
                { key: 'wind', label: 'Vento', icon: 'air' },
                { key: 'clouds', label: 'Nuvens', icon: 'cloud' },
              ].map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => setWindyOverlay(key as typeof windyOverlay)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition-all"
                  style={windyOverlay === key
                    ? { background: 'rgba(236,91,19,0.2)', color: '#ec5b13' }
                    : { color: '#64748b' }
                  }
                >
                  <span className="material-symbols-outlined text-xs">{icon}</span>
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>
          {/* iframe Windy */}
          <iframe
            key={`${loc.lat}-${loc.lng}-${windyOverlay}`}
            src={`https://embed.windy.com/embed.html?type=map&location=coordinates&metricRain=mm&metricTemp=°C&metricWind=km/h&lat=${loc.lat}&lon=${loc.lng}&zoom=8&level=surface&overlay=${windyOverlay}&menu=false&message=true&marker=true&calendar=now&pressure=true&type=map&detail=false&detailLat=${loc.lat}&detailLon=${loc.lng}&distIndicator=false&dMap=0`}
            className="w-full"
            style={{ height: 480, border: 'none', display: 'block' }}
            title="Mapa Meteorológico"
            allowFullScreen
          />
        </div>

        {/* ── Talhões monitorados (referência no Windy) ── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
          <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <h2 className="text-sm font-bold text-white">Talhões monitorados</h2>
            <span className="text-[10px]" style={{ color: '#94a3b8' }}>
              {fields.length} talhão{fields.length !== 1 ? 'ões' : ''}
            </span>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {fields.length === 0 && (
              <div className="p-4 rounded-xl text-xs" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#94a3b8' }}>
                Nenhum talhão cadastrado. Cadastre no mapa para acompanhar no contexto meteorológico.
              </div>
            )}

            {fields.map((field, index) => {
              const isActive = Boolean(activeFieldId && field.id === activeFieldId);
              const windyLink = `https://www.windy.com/-${field.lat},${field.lng}?${field.lat},${field.lng},10`;

              return (
                <div
                  key={field.id ?? `${field.lat}-${field.lng}-${index}`}
                  className="p-4 rounded-xl"
                  style={{
                    background: isActive ? 'rgba(236,91,19,0.08)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isActive ? 'rgba(236,91,19,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold text-white">{field.name ?? `Talhão ${index + 1}`}</p>
                    {isActive && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: 'rgba(236,91,19,0.2)', color: '#ec5b13' }}>
                        ATIVO
                      </span>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: '#94a3b8' }}>Lat {field.lat.toFixed(5)} · Lng {field.lng.toFixed(5)}</p>
                  <p className="text-xs mt-1" style={{ color: '#cbd5e1' }}>
                    Temperatura: {Math.round(displayTemperature)}° · Vento: {Math.round(displayWindSpeed)} km/h · Chuva hoje: {(w?.daily.precipSum[0] ?? 0).toFixed(1)} mm
                  </p>
                  <a
                    href={windyLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 mt-3 text-xs font-semibold"
                    style={{ color: '#60a5fa' }}
                  >
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                    Abrir no Windy
                  </a>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── First Load Loading Skeleton ── */}
        {!w && loading && (
          <div className="space-y-4">
            <SkeletonCard style={{ height: 160 }} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)}
            </div>
            <SkeletonCard style={{ height: 200 }} />
          </div>
        )}

        {/* ── Current Weather Card ── */}
        {w && (
          <div
            className="relative overflow-hidden rounded-2xl p-6 flex flex-col sm:flex-row gap-6"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
          >
            <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full pointer-events-none" style={{ background: '#ec5b13', opacity: 0.07, filter: 'blur(50px)' }} />

            {loading && (
              <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/10">
                <span className="material-symbols-outlined text-xs animate-spin text-orange-500">refresh</span>
                <span className="text-[10px] text-slate-400">Atualizando...</span>
              </div>
            )}

            {/* Main temp */}
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(236,91,19,0.12)' }}>
                <span className="material-symbols-outlined text-5xl" style={{ color: '#ec5b13' }}>{icon}</span>
              </div>
              <div>
                <p className="text-7xl font-black text-white leading-none">{Math.round(displayTemperature)}°</p>
                <p className="text-sm font-semibold capitalize mt-1" style={{ color: '#e2e8f0' }}>{displayCondition || label}</p>
                <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>
                  Máx {Math.round(w.daily.tempMax[0] ?? displayTemperature)}° · Mín {Math.round(w.daily.tempMin[0] ?? displayTemperature)}°
                </p>
              </div>
            </div>

            <div className="hidden sm:block w-px self-stretch" style={{ background: 'rgba(255,255,255,0.07)' }} />

            {/* Quick stats */}
            <div className="flex flex-wrap gap-x-8 gap-y-3 items-center">
              {[
                { icon: 'air', label: 'Vento', val: `${Math.round(displayWindSpeed)} km/h`, color: '#94a3b8' },
                { icon: 'water_drop', label: 'Umidade', val: `${Math.round(displayHumidity)}%`, color: '#60a5fa' },
                { icon: 'umbrella', label: 'Precip. hoje', val: `${(w.daily.precipSum[0] ?? 0).toFixed(1)} mm`, color: '#818cf8' },
              ].map((s) => (
                <div key={s.label}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="material-symbols-outlined text-base" style={{ color: s.color }}>{s.icon}</span>
                    <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: '#64748b' }}>{s.label}</p>
                  </div>
                  <p className="text-lg font-bold text-white">{s.val}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 6 Metrics Grid ── */}
        {w && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Vento', value: `${Math.round(w.windSpeed)} km/h`, icon: 'air', color: '#94a3b8' },
              { label: 'Umidade', value: `${w.humidity}%`, icon: 'water_drop', color: '#60a5fa' },
              { label: 'Visibilidade', value: `${((w.hourly.visibility[nowHour] ?? 10000) / 1000).toFixed(1)} km`, icon: 'visibility', color: '#a78bfa' },
              { label: 'Precip. acumulada (7d)', value: `${w.daily.precipSum.reduce((a, b) => a + (b ?? 0), 0).toFixed(1)} mm`, icon: 'water', color: '#38bdf8' },
              { label: 'Et₀ (hoje)', value: w.daily.et0[0] != null ? `${w.daily.et0[0].toFixed(2)} mm/d` : 'N/D', icon: 'local_florist', color: '#4ade80' },
              { label: 'Chuva hoje', value: `${(w.daily.precipSum[0] ?? 0).toFixed(1)} mm`, icon: 'umbrella', color: '#818cf8' },
            ].map((m) => (
              <div key={m.label} className="p-4 rounded-xl flex items-center gap-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: m.color + '18' }}>
                  <span className="material-symbols-outlined text-xl" style={{ color: m.color }}>{m.icon}</span>
                </div>
                <div>
                  <p className="text-xs font-medium" style={{ color: '#64748b' }}>{m.label}</p>
                  <p className="text-base font-bold text-white mt-0.5">{m.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Dados Agrícolas ── */}
        {w && w.daily.et0.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
            <div className="px-5 py-4 border-b flex items-center gap-2" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <span className="material-symbols-outlined text-xl" style={{ color: '#4ade80' }}>agriculture</span>
              <h2 className="text-sm font-bold text-white">Dados Agrícolas</h2>
              <span className="text-[10px] ml-auto font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>Open-Meteo · Grátis</span>
            </div>
            <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {w.daily.time.slice(0, 4).map((time, i) => {
                const d = new Date(time + 'T12:00:00');
                const dayLabel = i === 0 ? 'Hoje' : DAYS_PT[d.getDay()];
                return (
                  <div key={time} className="p-3 rounded-xl flex flex-col gap-2" style={{ background: i === 0 ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${i === 0 ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.05)'}` }}>
                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: i === 0 ? '#4ade80' : '#64748b' }}>{dayLabel}</p>
                    <div>
                      <p className="text-[10px]" style={{ color: '#64748b' }}>ET₀</p>
                      <p className="text-sm font-bold text-white">{w.daily.et0[i] != null ? `${w.daily.et0[i].toFixed(2)}` : '—'} <span className="text-[10px] font-normal" style={{ color: '#64748b' }}>mm/d</span></p>
                    </div>
                    <div>
                      <p className="text-[10px]" style={{ color: '#64748b' }}>Precipitação</p>
                      <p className="text-sm font-bold text-white">{(w.daily.precipSum[i] ?? 0).toFixed(1)} <span className="text-[10px] font-normal" style={{ color: '#64748b' }}>mm</span></p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Previsão Horária ── */}
        {w && (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <h2 className="text-sm font-bold text-white">Previsão por Hora</h2>
              <span className="text-[10px] font-medium" style={{ color: '#64748b' }}>Próximas 24h</span>
            </div>
            <div className="flex overflow-x-auto scrollbar-thin p-4 gap-3">
              {w.hourly.time.map((t, i) => {
                const h = new Date(t).getHours();
                const isNow = i === 0;
                return (
                  <div
                    key={t}
                    className="flex flex-col items-center gap-2 px-4 py-3 rounded-xl flex-shrink-0 transition-all"
                    style={{
                      background: isNow ? 'rgba(236,91,19,0.12)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isNow ? 'rgba(236,91,19,0.25)' : 'rgba(255,255,255,0.07)'}`,
                      minWidth: 72,
                    }}
                  >
                    <p className="text-[10px] font-semibold" style={{ color: isNow ? '#ec5b13' : '#64748b' }}>
                      {isNow ? 'Agora' : `${h}h`}
                    </p>
                    <span className="material-symbols-outlined text-2xl" style={{ color: isNow ? '#ec5b13' : '#94a3b8' }}>
                      {wmo(w.weatherCode).icon}
                    </span>
                    <p className="text-sm font-bold text-white">{Math.round(w.hourly.temp[i])}°</p>
                    {w.hourly.precip[i] > 0 && (
                      <p className="text-[10px] font-semibold" style={{ color: '#60a5fa' }}>{w.hourly.precip[i].toFixed(1)}mm</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Previsão 7 Dias ── */}
        {w && (
          <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
              <h2 className="text-sm font-bold text-white">Próximos 7 Dias</h2>
            </div>
            <div>
              {w.daily.time.map((time, i) => {
                const d = new Date(time + 'T12:00:00');
                const dayLabel = i === 0 ? 'Hoje' : DAYS_PT[d.getDay()];
                const pct = Math.max(0, Math.min(100, ((w.daily.tempMax[i] - 5) / 35) * 100));
                return (
                  <div key={time} className="flex items-center gap-4 px-5 py-4 border-b last:border-none" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <p className="text-sm font-semibold capitalize text-white w-24 shrink-0">{dayLabel}</p>
                    <span className="material-symbols-outlined text-xl" style={{ color: '#94a3b8' }}>{wmo(w.weatherCode).icon}</span>
                    <div className="flex items-center gap-1.5 flex-1 text-xs" style={{ color: '#64748b' }}>
                      {w.daily.precipSum[i] > 0 && (
                        <span className="flex items-center gap-0.5 text-blue-400">
                          <span className="material-symbols-outlined text-xs">water_drop</span>
                          {w.daily.precipSum[i].toFixed(1)}mm
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm font-bold">
                      <span style={{ color: '#60a5fa' }}>{Math.round(w.daily.tempMin[i])}°</span>
                      <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(to right, #60a5fa, #f97316)' }} />
                      </div>
                      <span style={{ color: '#f97316' }}>{Math.round(w.daily.tempMax[i])}°</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Recomendações ── */}
        {w && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-xl" style={{ color: '#ec5b13' }}>agriculture</span>
                <h3 className="text-sm font-bold text-white">Janela de Pulverização</h3>
              </div>
              <p className="text-xs leading-relaxed text-slate-400">
                Vento atual <span className="text-white font-semibold">{Math.round(w.windSpeed)} km/h</span> e umidade <span className="text-white font-semibold">{w.humidity}%</span> — {w.windSpeed < 15 && w.humidity < 80 ? 'condições favoráveis para aplicação no Talhão Norte.' : 'aguarde condições mais favoráveis.'}
              </p>
              <button
                onClick={() => navigate('/app/reports')}
                className="mt-4 w-full py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90" style={{ background: '#ec5b13' }}>
                Gerar Relatório de Pulverização
              </button>
            </div>
            <div className="p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-xl text-blue-400">water_drop</span>
                <h3 className="text-sm font-bold text-white">Manejo de Irrigação</h3>
              </div>
              <p className="text-xs leading-relaxed text-slate-400">
                ET₀ de <span className="text-white font-semibold">{w.daily.et0[0] != null ? `${w.daily.et0[0].toFixed(2)} mm/d` : 'N/D'}</span> com precipitação prevista de <span className="text-white font-semibold">{(w.daily.precipSum[0] ?? 0).toFixed(1)} mm</span> — {(w.daily.precipSum[0] ?? 0) > 5 ? 'reduza o fluxo de irrigação para evitar desperdício.' : 'recomenda-se irrigação suplementar.'}
              </p>
              <button
                disabled
                title="Em breve"
                className="mt-4 w-full py-2 rounded-xl text-xs font-bold transition-all"
                style={{ background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)', color: '#60a5fa', opacity: 0.5, cursor: 'not-allowed' }}
              >
                Ver Plano de Irrigação
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
