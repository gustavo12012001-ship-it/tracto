import { useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { FALLBACK_LOCATION } from '../utils/geolocation';
import { apiFetch } from '../services/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface PlaceResult {
  id: number;
  name: string;
  type: string;
  address?: string;
  lat: number;
  lng: number;
  distance?: number; // km
  phone?: string;
  website?: string;
  opening_hours?: string;
}

// ── Quick search chips ─────────────────────────────────────────────────────────
const QUICK_CHIPS = [
  { label: 'Mecânico agrícola', icon: 'build' },
  { label: 'Soldador',          icon: 'hardware' },
  { label: 'Guincho',           icon: 'local_shipping' },
  { label: 'Agrônomo',          icon: 'person_search' },
  { label: 'Veterinário',       icon: 'pets' },
  { label: 'Eletricista',       icon: 'bolt' },
  { label: 'Borracharia',       icon: 'tire_repair' },
  { label: 'Oficina',           icon: 'car_repair' },
  { label: 'Combustível',       icon: 'local_gas_station' },
  { label: 'Ferragem',          icon: 'handyman' },
];


// ── Backend places search (server-side proxy — no CORS issues) ────────────────
async function searchPlaces(query: string, lat: number, lng: number): Promise<PlaceResult[]> {
  const items = await apiFetch<Array<{
    id: number; name: string; type: string; address?: string;
    lat: number; lng: number; distance_km: number;
    phone?: string; website?: string; opening_hours?: string;
  }>>('/api/places/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, lat, lng, radius_km: 15 }),
  });
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    type: item.type,
    address: item.address,
    lat: item.lat,
    lng: item.lng,
    distance: item.distance_km,
    phone: item.phone,
    website: item.website,
    opening_hours: item.opening_hours,
  }));
}

// ── Get device location ───────────────────────────────────────────────────────
function getDeviceLocation(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 60000 }
    );
  });
}

// ── Result Card ───────────────────────────────────────────────────────────────
function PlaceCard({ place, userLat, userLng }: { place: PlaceResult; userLat: number; userLng: number }) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    place.name + (place.address ? ', ' + place.address : '')
  )}&query_place_id=`;
  const dirUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${place.lat},${place.lng}&travelmode=driving`;

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-2.5 transition-all hover:-translate-y-px"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }}
    >
      {/* Name + distance */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold leading-snug" style={{ color: 'var(--text, #e2e8f0)' }}>
          {place.name}
        </h3>
        {place.distance !== undefined && (
          <span
            className="flex items-center gap-0.5 px-2 py-0.5 rounded-lg flex-shrink-0 text-[10px] font-bold"
            style={{ background: 'var(--primary-dim)', border: '1px solid rgba(236,91,19,0.2)', color: 'var(--primary)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 10 }}>pin_drop</span>
            {place.distance.toFixed(1)} km
          </span>
        )}
      </div>

      {/* Type badge */}
      {place.type && (
        <span
          className="self-start text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--muted)' }}
        >
          {place.type}
        </span>
      )}

      {/* Address */}
      {place.address && (
        <p className="text-[11px]" style={{ color: 'var(--muted)' }}>{place.address}</p>
      )}

      {/* Phone + hours */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {place.phone && (
          <a href={`tel:${place.phone}`} className="flex items-center gap-1 text-[11px]" style={{ color: '#4ade80' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>call</span>
            {place.phone}
          </a>
        )}
        {place.opening_hours && (
          <p className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--muted)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>schedule</span>
            {place.opening_hours}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <a
          href={dirUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90 flex-1 justify-center"
          style={{ background: 'var(--primary)', color: '#fff' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>directions</span>
          Como chegar
        </a>
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-90"
          style={{ background: 'var(--primary-dim)', border: '1px solid rgba(236,91,19,0.2)', color: 'var(--primary)' }}
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>
          Maps
        </a>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Services() {
  const { currentLocation } = useAppStore();

  const [query, setQuery]               = useState('');
  const [results, setResults]           = useState<PlaceResult[]>([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [searched, setSearched]         = useState(false);
  const [activeQuery, setActiveQuery]   = useState('');
  const [searchLoc, setSearchLoc]       = useState<{ lat: number; lng: number } | null>(null);
  const [deviceLoc, setDeviceLoc]       = useState<{ lat: number; lng: number } | null>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    setActiveQuery(q);

    try {
      let lat: number, lng: number;

      if (currentLocation) {
        lat = currentLocation.lat; lng = currentLocation.lng;
      } else {
        // Try device GPS, fallback to saved device loc, then FALLBACK_LOCATION
        let geo = deviceLoc;
        if (!geo) { geo = await getDeviceLocation(); if (geo) setDeviceLoc(geo); }
        if (!geo) {
          lat = FALLBACK_LOCATION.lat; lng = FALLBACK_LOCATION.lng;
        } else {
          lat = geo.lat; lng = geo.lng;
        }
      }

      setSearchLoc({ lat, lng });
      const data = await searchPlaces(q, lat, lng);
      setResults(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError('Não foi possível buscar: ' + msg);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [currentLocation, deviceLoc]);

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); doSearch(query); };

  const gmapsUrl = searchLoc
    ? `https://www.google.com/maps/search/${encodeURIComponent(activeQuery)}/@${searchLoc.lat},${searchLoc.lng},13z`
    : null;

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text, #e2e8f0)' }}>

      {/* Header */}
      <div className="flex-shrink-0 px-4 md:px-6 py-4 border-b" style={{ borderColor: 'var(--border)', background: 'var(--sidebar)' }}>
        <div className="flex items-center gap-2 mb-0.5">
          <span className="material-symbols-outlined text-xl" style={{ color: 'var(--primary)' }}>handshake</span>
          <h1 className="text-base font-bold tracking-tight" style={{ color: 'var(--text, #e2e8f0)' }}>Serviços Locais</h1>
        </div>
        <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
          Prestadores de serviço próximos à sua propriedade
        </p>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-2xl mx-auto px-4 py-6">

          {/* Search */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-5">
            <div className="flex gap-2">
              <div className="flex items-center gap-2 flex-1 rounded-xl px-4 py-3"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <span className="material-symbols-outlined text-base flex-shrink-0" style={{ color: 'var(--muted)' }}>search</span>
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
                  <button type="button" onClick={() => { setQuery(''); setSearched(false); setActiveQuery(''); }}>
                    <span className="material-symbols-outlined text-sm" style={{ color: 'var(--muted)' }}>close</span>
                  </button>
                )}
              </div>
              <button type="submit" disabled={!query.trim() || loading}
                className="px-5 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: 'var(--primary)', color: '#fff' }}>
                {loading
                  ? <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                  : 'Buscar'}
              </button>
            </div>
          </form>

          {/* Quick chips */}
          <div className="flex flex-wrap gap-2 mb-6">
            {QUICK_CHIPS.map((chip) => (
              <button key={chip.label} onClick={() => doSearch(chip.label)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all hover:opacity-80"
                style={{
                  background: activeQuery === chip.label ? 'var(--primary)' : 'var(--surface)',
                  border: activeQuery === chip.label ? 'none' : '1px solid var(--border)',
                  color: activeQuery === chip.label ? '#fff' : 'var(--muted)',
                }}>
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>{chip.icon}</span>
                {chip.label}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-4 rounded-xl mb-4"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
              <span className="material-symbols-outlined text-base">error</span>
              <p className="text-xs">{error}</p>
            </div>
          )}

          {/* Skeleton */}
          {loading && (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl p-4 animate-pulse"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', height: 110 }} />
              ))}
            </div>
          )}

          {/* Results */}
          {!loading && searched && (
            <>
              {/* Count + Google Maps button */}
              <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                <p className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                  {results.length === 0
                    ? `Nenhum resultado para "${activeQuery}" nos arredores`
                    : `${results.length} estabelecimento${results.length !== 1 ? 's' : ''} próximos`}
                </p>
                {gmapsUrl && (
                  <a href={gmapsUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold hover:opacity-90"
                    style={{ background: '#1a73e8', color: '#fff' }}>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>
                    Buscar no Google Maps
                  </a>
                )}
              </div>

              {results.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {results.map((r) => (
                    <PlaceCard
                      key={r.id}
                      place={r}
                      userLat={searchLoc?.lat ?? r.lat}
                      userLng={searchLoc?.lng ?? r.lng}
                    />
                  ))}
                </div>
              ) : (
                /* No results: guide user to Google Maps */
                <div className="flex flex-col items-center gap-4 py-12 rounded-2xl"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <span className="material-symbols-outlined text-5xl" style={{ opacity: 0.3 }}>search_off</span>
                  <div className="text-center">
                    <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text, #e2e8f0)' }}>
                      Nenhum cadastro aberto na região
                    </p>
                    <p className="text-xs max-w-xs" style={{ color: 'var(--muted)' }}>
                      O mapa colaborativo ainda não tem esse serviço na sua área. Tente pelo Google Maps que tem cobertura completa.
                    </p>
                  </div>
                  {gmapsUrl && (
                    <a href={gmapsUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold hover:opacity-90"
                      style={{ background: '#1a73e8', color: '#fff' }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>
                      Buscar no Google Maps
                    </a>
                  )}
                </div>
              )}
            </>
          )}

          {/* Empty state */}
          {!searched && !loading && (
            <div className="flex flex-col items-center gap-3 py-16 rounded-2xl"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
              <span className="material-symbols-outlined text-5xl" style={{ opacity: 0.3 }}>travel_explore</span>
              <p className="text-sm font-semibold" style={{ color: 'var(--text, #e2e8f0)' }}>
                Busque por qualquer serviço rural
              </p>
              <p className="text-xs text-center max-w-xs">
                Selecione uma categoria acima ou digite o que precisa. Os resultados são estabelecimentos reais com nome, endereço e rota.
              </p>
            </div>
          )}

          {/* CTA */}
          <div className="rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4 mt-6"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex-1 text-center sm:text-left">
              <p className="text-sm font-bold mb-1" style={{ color: 'var(--text, #e2e8f0)' }}>
                Você presta serviços para o campo?
              </p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                Em breve você poderá anunciar seus serviços e ser encontrado por produtores da sua região.
              </p>
            </div>
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap hover:opacity-90"
              style={{ background: 'var(--primary)', color: '#fff' }}
              onClick={() => alert('Em breve! Cadastro de parceiros disponível.')}>
              <span className="material-symbols-outlined text-sm">add_business</span>
              Anunciar meu serviço
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
