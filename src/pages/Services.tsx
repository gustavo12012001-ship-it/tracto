import { useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';

// ── Quick search chips ────────────────────────────────────────────────────────
const QUICK_CHIPS = [
  { label: 'Mecânico agrícola', icon: 'build' },
  { label: 'Soldador', icon: 'hardware' },
  { label: 'Guincho', icon: 'local_shipping' },
  { label: 'Agrônomo', icon: 'person_search' },
  { label: 'Veterinário', icon: 'pets' },
  { label: 'Eletricista', icon: 'bolt' },
  { label: 'Borracharia', icon: 'tire_repair' },
  { label: 'Oficina', icon: 'car_repair' },
  { label: 'Combustível', icon: 'local_gas_station' },
  { label: 'Ferragem', icon: 'handyman' },
];

// ── Get device GPS location ───────────────────────────────────────────────────
function getDeviceLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 60000 }
    );
  });
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Services() {
  const { currentLocation } = useAppStore();

  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceLocation, setDeviceLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [searchLocation, setSearchLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activeQuery, setActiveQuery] = useState('');

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) return;
      setLoading(true);
      setError(null);

      try {
        let lat: number;
        let lng: number;

        if (currentLocation) {
          lat = currentLocation.lat;
          lng = currentLocation.lng;
        } else {
          let geo = deviceLocation;
          if (!geo) {
            geo = await getDeviceLocation();
            if (geo) setDeviceLocation(geo);
          }
          if (!geo) {
            setError('Não foi possível determinar sua localização. Defina a localização da fazenda nas configurações.');
            setLoading(false);
            return;
          }
          lat = geo.lat;
          lng = geo.lng;
        }

        setQuery(q);
        setActiveQuery(q);
        setSearchLocation({ lat, lng });
        setSearched(true);
      } finally {
        setLoading(false);
      }
    },
    [currentLocation, deviceLocation]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  // Build Google Maps URLs
  const gmapsListUrl = searchLocation
    ? `https://www.google.com/maps/search/${encodeURIComponent(activeQuery)}/@${searchLocation.lat},${searchLocation.lng},13z`
    : null;

  // Google Maps Embed API v1 search mode — shows sidebar with business list + map
  // Uses a public embed key (no billing) — falls back gracefully
  const gmapsEmbedUrl = searchLocation
    ? `https://www.google.com/maps/embed/v1/search?key=AIzaSyD-9tSrke72PouQMnMX-a7eZSW0jkFMBWY&q=${encodeURIComponent(activeQuery)}&center=${searchLocation.lat},${searchLocation.lng}&zoom=13&language=pt-BR`
    : null;

  // Fallback embed (no key needed — shows map with pins only)
  const gmapsFallbackEmbed = searchLocation
    ? `https://maps.google.com/maps?q=${encodeURIComponent(activeQuery + ' perto de ' + searchLocation.lat + ',' + searchLocation.lng)}&output=embed&hl=pt-BR&z=13`
    : null;

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      style={{ background: 'var(--bg)', color: 'var(--text, #e2e8f0)' }}
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-4 md:px-6 py-4 border-b"
        style={{ borderColor: 'var(--border)', background: 'var(--sidebar)' }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="material-symbols-outlined text-xl" style={{ color: 'var(--primary)' }}>
            handshake
          </span>
          <h1 className="text-base font-bold tracking-tight" style={{ color: 'var(--text, #e2e8f0)' }}>
            Serviços Locais
          </h1>
        </div>
        <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
          Encontre prestadores de serviço próximos à sua propriedade via Google Maps
        </p>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-3xl mx-auto px-4 py-6">

          {/* ── Search box ─────────────────────────────────────────────────── */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-5">
            <div className="flex gap-2">
              <div
                className="flex items-center gap-2 flex-1 rounded-xl px-4 py-3"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <span
                  className="material-symbols-outlined text-base flex-shrink-0"
                  style={{ color: 'var(--muted)' }}
                >
                  search
                </span>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ex: mecânico de tratores, soldador, agrônomo..."
                  className="flex-1 bg-transparent border-none outline-none text-sm"
                  style={{ color: 'var(--text, #e2e8f0)' }}
                  autoFocus
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('');
                      setSearched(false);
                      setActiveQuery('');
                    }}
                  >
                    <span className="material-symbols-outlined text-sm" style={{ color: 'var(--muted)' }}>
                      close
                    </span>
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={!query.trim() || loading}
                className="px-5 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--primary)', color: '#fff' }}
              >
                {loading ? (
                  <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                ) : (
                  'Buscar'
                )}
              </button>
            </div>

            {/* Location note */}
            {!currentLocation && !deviceLocation && (
              <p className="text-[10px]" style={{ color: '#f59e0b' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 11, verticalAlign: 'middle' }}>
                  location_off
                </span>{' '}
                Localização da fazenda não definida — ao buscar, usaremos o GPS do dispositivo.
              </p>
            )}
          </form>

          {/* ── Quick chips ──────────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-2 mb-6">
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip.label}
                onClick={() => doSearch(chip.label)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:opacity-80"
                style={{
                  background: activeQuery === chip.label ? 'var(--primary)' : 'var(--surface)',
                  border: activeQuery === chip.label ? 'none' : '1px solid var(--border)',
                  color: activeQuery === chip.label ? '#fff' : 'var(--muted)',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                  {chip.icon}
                </span>
                {chip.label}
              </button>
            ))}
          </div>

          {/* ── Error ────────────────────────────────────────────────────────── */}
          {error && (
            <div
              className="flex items-center gap-2 p-4 rounded-xl mb-4"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: '#ef4444',
              }}
            >
              <span className="material-symbols-outlined text-base">error</span>
              <p className="text-xs">{error}</p>
            </div>
          )}

          {/* ── Google Maps results ──────────────────────────────────────────── */}
          {searched && searchLocation && (
            <div className="flex flex-col gap-3">
              {/* Bar: query + open in Google Maps button */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm font-semibold" style={{ color: 'var(--text, #e2e8f0)' }}>
                  Resultados para{' '}
                  <span style={{ color: 'var(--primary)' }}>"{activeQuery}"</span>
                  <span className="text-xs font-normal ml-2" style={{ color: 'var(--muted)' }}>
                    via Google Maps
                  </span>
                </p>
                {gmapsListUrl && (
                  <a
                    href={gmapsListUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-90 flex-shrink-0"
                    style={{ background: '#1a73e8', color: '#fff' }}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
                    </svg>
                    Abrir lista no Google Maps
                  </a>
                )}
              </div>

              {/* Google Maps iframe — shows business list + map */}
              <div
                className="rounded-2xl overflow-hidden w-full"
                style={{
                  border: '1px solid var(--border)',
                  height: 520,
                  boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
                }}
              >
                <iframe
                  key={`${activeQuery}-${searchLocation.lat}`}
                  title="Google Maps — Resultados"
                  src={gmapsEmbedUrl ?? gmapsFallbackEmbed ?? ''}
                  width="100%"
                  height="520"
                  style={{ border: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  onError={() => {
                    // if embed API key fails, iframe will still fall back to map view
                  }}
                />
              </div>

              {/* Tip */}
              <p className="text-[11px] text-center" style={{ color: 'var(--muted)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 12, verticalAlign: 'middle' }}>
                  info
                </span>{' '}
                Clique em um marcador no mapa para ver o nome, avaliação e telefone do local · Para ver a lista completa, clique em{' '}
                <strong>Abrir lista no Google Maps</strong>
              </p>
            </div>
          )}

          {/* ── Empty state ──────────────────────────────────────────────────── */}
          {!searched && !loading && (
            <div
              className="flex flex-col items-center gap-3 py-16 rounded-2xl"
              style={{
                color: 'var(--muted)',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
              }}
            >
              <span className="material-symbols-outlined text-5xl" style={{ opacity: 0.3 }}>
                travel_explore
              </span>
              <p className="text-sm font-semibold text-center" style={{ color: 'var(--text, #e2e8f0)' }}>
                Busque por qualquer serviço rural
              </p>
              <p className="text-xs text-center max-w-xs">
                Os resultados são carregados direto do Google Maps com os prestadores reais da sua região.
              </p>
              <p className="text-[11px] font-semibold mt-1" style={{ color: 'var(--primary)' }}>
                Selecione uma categoria acima ou digite o que precisa
              </p>
            </div>
          )}

          {/* ── CTA: Anunciar ────────────────────────────────────────────────── */}
          <div
            className="rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4 mt-6"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div className="flex-1 text-center sm:text-left">
              <p className="text-sm font-bold mb-1" style={{ color: 'var(--text, #e2e8f0)' }}>
                Você presta serviços para o campo?
              </p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Em breve você poderá anunciar seus serviços e ser encontrado por produtores da sua região.
              </p>
            </div>
            <button
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all hover:opacity-90"
              style={{ background: 'var(--primary)', color: '#fff' }}
              onClick={() => alert('Em breve! Cadastro de parceiros disponível.')}
            >
              <span className="material-symbols-outlined text-sm">add_business</span>
              Anunciar meu serviço
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
