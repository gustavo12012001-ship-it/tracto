import { useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ServiceResult {
  osm_id: number;
  name: string;
  display_name: string;
  lat: number;
  lng: number;
  type: string;
  distance?: number; // km
}

interface Sponsored {
  id: string;
  name: string;
  description: string;
  logo?: string;
  contact: string;
  category: string;
}

// ── Sponsored partners (empty — add real partners here) ───────────────────────
const SPONSORED: Sponsored[] = [];

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

// ── Haversine distance (km) ────────────────────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Nominatim search ──────────────────────────────────────────────────────────
async function searchNominatim(
  query: string,
  lat: number,
  lng: number
): Promise<ServiceResult[]> {
  const delta = 1.5; // ~150 km bounding box
  const viewbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;

  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '20',
    countrycodes: 'br',
    viewbox,
    bounded: '0',
  });

  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    { headers: { 'Accept-Language': 'pt-BR', 'User-Agent': 'TractoAgTech/1.0' } }
  );
  if (!res.ok) throw new Error('Falha ao buscar no Nominatim');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any[] = await res.json();

  return data.map((item) => ({
    osm_id: item.osm_id,
    name: item.name || item.display_name.split(',')[0],
    display_name: item.display_name,
    lat: parseFloat(item.lat),
    lng: parseFloat(item.lon),
    type: item.type ?? item.category ?? '',
    distance: haversine(lat, lng, parseFloat(item.lat), parseFloat(item.lon)),
  }));
}

// ── Helper: short address ─────────────────────────────────────────────────────
function shortAddress(display_name: string): string {
  const parts = display_name.split(',').map((s) => s.trim());
  return parts.slice(0, 3).join(', ');
}

// ── ResultCard ────────────────────────────────────────────────────────────────
function ResultCard({ result }: { result: ServiceResult }) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    result.name + ' ' + result.display_name
  )}`;

  const distLabel =
    result.distance !== undefined ? `${result.distance.toFixed(1)} km` : '–';

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2.5 transition-all hover:translate-y-[-1px]"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
      }}
    >
      {/* Name + distance */}
      <div className="flex items-start justify-between gap-2">
        <h3
          className="text-sm font-semibold leading-snug"
          style={{ color: 'var(--text, #e2e8f0)' }}
        >
          {result.name}
        </h3>
        <span
          className="flex items-center gap-1 px-2 py-0.5 rounded-lg flex-shrink-0 text-[10px] font-bold"
          style={{
            background: 'var(--primary-dim)',
            border: '1px solid rgba(236,91,19,0.18)',
            color: 'var(--primary)',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 11 }}>
            pin_drop
          </span>
          {distLabel}
        </span>
      </div>

      {/* Address */}
      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>
        {shortAddress(result.display_name)}
      </p>

      {/* Type badge */}
      {result.type && (
        <span
          className="self-start text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border)',
            color: 'var(--muted)',
          }}
        >
          {result.type.replace(/_/g, ' ')}
        </span>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 flex-1 justify-center"
          style={{ background: 'var(--primary)', color: '#fff' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
            map
          </span>
          Ver no mapa
        </a>
        <a
          href={`https://www.google.com/search?q=${encodeURIComponent(result.name + ' ' + shortAddress(result.display_name))}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
          style={{
            background: 'var(--primary-dim)',
            border: '1px solid rgba(236,91,19,0.2)',
            color: 'var(--primary)',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
            search
          </span>
          Google
        </a>
      </div>
    </div>
  );
}

// ── SponsoredCard ─────────────────────────────────────────────────────────────
function SponsoredCard({ sponsor }: { sponsor: Sponsored }) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2.5 relative"
      style={{
        background: 'var(--surface)',
        border: '2px solid var(--primary)',
        boxShadow: '0 0 0 4px var(--primary-dim)',
      }}
    >
      <span
        className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-widest"
        style={{ background: 'var(--primary)', color: '#fff' }}
      >
        Patrocinado
      </span>
      <div className="flex items-center gap-3 pr-20">
        {sponsor.logo ? (
          <img src={sponsor.logo} alt={sponsor.name} className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{ background: 'var(--primary)' }}
          >
            {sponsor.name[0]}
          </div>
        )}
        <div>
          <h3 className="text-sm font-bold" style={{ color: 'var(--text, #e2e8f0)' }}>
            {sponsor.name}
          </h3>
          <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
            {sponsor.category}
          </p>
        </div>
      </div>
      <p className="text-xs" style={{ color: 'var(--muted)' }}>
        {sponsor.description}
      </p>
      <a
        href={`tel:${sponsor.contact}`}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold justify-center transition-all hover:opacity-90"
        style={{ background: 'var(--primary)', color: '#fff' }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
          call
        </span>
        Entrar em contato
      </a>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Services() {
  const { currentLocation } = useAppStore();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ServiceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) return;
      setQuery(q);

      // Use farm location if available, fallback to center of Brazil
      const lat = currentLocation?.lat ?? -15.8;
      const lng = currentLocation?.lng ?? -47.9;

      setLoading(true);
      setError(null);
      setSearched(true);

      try {
        const res = await searchNominatim(q, lat, lng);
        // Sort by distance
        const sorted = res.sort((a, b) => (a.distance ?? 9999) - (b.distance ?? 9999));
        setResults(sorted);
      } catch {
        setError('Não foi possível realizar a busca. Tente novamente.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [currentLocation]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

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
          <span
            className="material-symbols-outlined text-xl"
            style={{ color: 'var(--primary)' }}
          >
            handshake
          </span>
          <h1
            className="text-base font-bold tracking-tight"
            style={{ color: 'var(--text, #e2e8f0)' }}
          >
            Serviços Locais
          </h1>
        </div>
        <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
          Encontre prestadores de serviço próximos à sua propriedade
        </p>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-2xl mx-auto px-4 py-8">
          {/* ── Search box ─────────────────────────────────────────────────── */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-6">
            <label
              className="text-sm font-semibold"
              style={{ color: 'var(--text, #e2e8f0)' }}
            >
              O que você precisa?
            </label>
            <div className="flex gap-2">
              <div
                className="flex items-center gap-2 flex-1 rounded-xl px-4 py-3"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                }}
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
                      setResults([]);
                      setSearched(false);
                    }}
                  >
                    <span
                      className="material-symbols-outlined text-sm"
                      style={{ color: 'var(--muted)' }}
                    >
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
                  <span className="material-symbols-outlined text-base animate-spin">
                    progress_activity
                  </span>
                ) : (
                  'Buscar'
                )}
              </button>
            </div>

            {/* Location note */}
            {!currentLocation && (
              <p className="text-[10px]" style={{ color: '#f59e0b' }}>
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 11, verticalAlign: 'middle' }}
                >
                  location_off
                </span>{' '}
                Localização da fazenda não definida — resultados podem não estar próximos de você.
              </p>
            )}
          </form>

          {/* ── Quick chips ──────────────────────────────────────────────────── */}
          {!searched && (
            <div className="flex flex-wrap gap-2 mb-8">
              {QUICK_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => doSearch(chip.label)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:opacity-80"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--muted)',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                    {chip.icon}
                  </span>
                  {chip.label}
                </button>
              ))}
            </div>
          )}

          {/* ── Sponsored (future partners) ──────────────────────────────────── */}
          {SPONSORED.length > 0 && (
            <div className="mb-6">
              <p
                className="text-[10px] font-semibold uppercase tracking-widest mb-3"
                style={{ color: 'var(--muted)' }}
              >
                Parceiros recomendados
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {SPONSORED.map((s) => (
                  <SponsoredCard key={s.id} sponsor={s} />
                ))}
              </div>
            </div>
          )}

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

          {/* ── Loading skeleton ─────────────────────────────────────────────── */}
          {loading && (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-xl p-4 animate-pulse"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', height: 120 }}
                />
              ))}
            </div>
          )}

          {/* ── Results ──────────────────────────────────────────────────────── */}
          {!loading && searched && (
            <>
              <p className="text-xs font-semibold mb-4" style={{ color: 'var(--muted)' }}>
                {results.length === 0
                  ? 'Nenhum resultado encontrado'
                  : `${results.length} resultado${results.length !== 1 ? 's' : ''} para "${query}"`}
              </p>

              {results.length > 0 && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    {results.map((r) => (
                      <ResultCard key={r.osm_id} result={r} />
                    ))}
                  </div>

                  {/* "Ver mais no Google Maps" */}
                  <div className="flex justify-center mb-8">
                    <a
                      href={`https://www.google.com/maps/search/${encodeURIComponent(
                        query + (currentLocation ? ` perto de ${currentLocation.lat},${currentLocation.lng}` : ' Brasil')
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold transition-all hover:opacity-80"
                      style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        color: 'var(--muted)',
                      }}
                    >
                      <span className="material-symbols-outlined text-sm">open_in_new</span>
                      Ver mais resultados no Google Maps
                    </a>
                  </div>
                </>
              )}
            </>
          )}

          {/* ── Empty state (before first search) ───────────────────────────── */}
          {!searched && !loading && (
            <div
              className="flex flex-col items-center gap-3 py-12"
              style={{ color: 'var(--muted)' }}
            >
              <span className="material-symbols-outlined text-5xl" style={{ opacity: 0.3 }}>
                travel_explore
              </span>
              <p className="text-sm font-semibold text-center">
                Busque por qualquer serviço rural
              </p>
              <p className="text-xs text-center max-w-xs">
                Resultados reais do OpenStreetMap — sem dados fictícios.
              </p>
            </div>
          )}

          {/* ── CTA: Anunciar ──────────────────────────────────────────────── */}
          <div
            className="rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
            }}
          >
            <div className="flex-1 text-center sm:text-left">
              <p className="text-sm font-bold mb-1" style={{ color: 'var(--text, #e2e8f0)' }}>
                Você presta serviços para o campo?
              </p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Em breve você poderá anunciar seus serviços aqui e ser encontrado por produtores da sua região.
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
