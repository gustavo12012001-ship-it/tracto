import { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ServiceProvider {
  id: string;
  name: string;
  category: string;
  categoryId: string;
  rating: number;
  reviewCount: number;
  city: string;
  state: string;
  lat: number;
  lng: number;
  phone: string;
  tags: string[];
  avatarColor: string;
  verified: boolean;
  responseTime: string;
}

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

// ── Categories ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'all', label: 'Todos', icon: 'grid_view' },
  { id: 'mecanico', label: 'Mecânico Agrícola', icon: 'build' },
  { id: 'soldador', label: 'Soldador', icon: 'hardware' },
  { id: 'guincho', label: 'Guincho / Reboque', icon: 'local_shipping' },
  { id: 'agronomo', label: 'Agrônomo / Consultor', icon: 'person_search' },
  { id: 'operador', label: 'Operador de Máquinas', icon: 'agriculture' },
  { id: 'assistencia', label: 'Assistência Técnica', icon: 'settings' },
  { id: 'veterinario', label: 'Veterinário', icon: 'pets' },
  { id: 'eletricista', label: 'Eletricista Rural', icon: 'bolt' },
  { id: 'transporte', label: 'Transporte de Grãos', icon: 'inventory_2' },
  { id: 'terraplanagem', label: 'Terraplanagem', icon: 'terrain' },
];

// ── Mock data ─────────────────────────────────────────────────────────────────
const MOCK_PROVIDERS: ServiceProvider[] = [
  {
    id: '1',
    name: 'Carlos Eduardo Borges',
    category: 'Mecânico Agrícola',
    categoryId: 'mecanico',
    rating: 4.8,
    reviewCount: 47,
    city: 'Uberlândia',
    state: 'MG',
    lat: -18.9186,
    lng: -48.2772,
    phone: '34991234567',
    tags: ['John Deere', 'Case IH', 'Revisão'],
    avatarColor: '#ec5b13',
    verified: true,
    responseTime: 'Responde em ~1h',
  },
  {
    id: '2',
    name: 'Marcos Antônio Silva',
    category: 'Soldador',
    categoryId: 'soldador',
    rating: 4.6,
    reviewCount: 31,
    city: 'Araguari',
    state: 'MG',
    lat: -18.6483,
    lng: -48.1880,
    phone: '34992345678',
    tags: ['Implementos', 'Estrutura Metálica', 'TIG/MIG'],
    avatarColor: '#3b82f6',
    verified: true,
    responseTime: 'Responde em ~2h',
  },
  {
    id: '3',
    name: 'Paulo Roberto Freitas',
    category: 'Guincho / Reboque',
    categoryId: 'guincho',
    rating: 4.9,
    reviewCount: 62,
    city: 'Uberlândia',
    state: 'MG',
    lat: -18.9352,
    lng: -48.3055,
    phone: '34993456789',
    tags: ['Colheitadeiras', '24h', 'Plantadeiras'],
    avatarColor: '#8b5cf6',
    verified: true,
    responseTime: 'Responde em ~30min',
  },
  {
    id: '4',
    name: 'Dra. Ana Paula Martins',
    category: 'Agrônomo / Consultor',
    categoryId: 'agronomo',
    rating: 5.0,
    reviewCount: 28,
    city: 'Uberaba',
    state: 'MG',
    lat: -19.7480,
    lng: -47.9318,
    phone: '34994567890',
    tags: ['Solos', 'Soja & Milho', 'CREA/MG'],
    avatarColor: '#10b981',
    verified: true,
    responseTime: 'Responde em ~3h',
  },
  {
    id: '5',
    name: 'Rodrigo Henrique Lopes',
    category: 'Operador de Máquinas',
    categoryId: 'operador',
    rating: 4.7,
    reviewCount: 19,
    city: 'Ituiutaba',
    state: 'MG',
    lat: -18.9726,
    lng: -49.4638,
    phone: '34995678901',
    tags: ['Plantio Direto', 'Colheita', 'Pulverização'],
    avatarColor: '#f59e0b',
    verified: false,
    responseTime: 'Responde em ~4h',
  },
  {
    id: '6',
    name: 'Fernando José Carvalho',
    category: 'Assistência Técnica',
    categoryId: 'assistencia',
    rating: 4.5,
    reviewCount: 53,
    city: 'Tupaciguara',
    state: 'MG',
    lat: -18.5927,
    lng: -48.7070,
    phone: '34996789012',
    tags: ['GPS Autônomo', 'Pulverizadores', 'Drones'],
    avatarColor: '#ec4899',
    verified: true,
    responseTime: 'Responde em ~2h',
  },
  {
    id: '7',
    name: 'Dr. Ricardo Almeida',
    category: 'Veterinário',
    categoryId: 'veterinario',
    rating: 4.9,
    reviewCount: 41,
    city: 'Patos de Minas',
    state: 'MG',
    lat: -18.5795,
    lng: -46.5180,
    phone: '34997890123',
    tags: ['Bovinos', 'Reprodução', 'CRMV/MG'],
    avatarColor: '#06b6d4',
    verified: true,
    responseTime: 'Responde em ~1h',
  },
  {
    id: '8',
    name: 'Leandro Ferreira Costa',
    category: 'Eletricista Rural',
    categoryId: 'eletricista',
    rating: 4.4,
    reviewCount: 22,
    city: 'Uberlândia',
    state: 'MG',
    lat: -18.9100,
    lng: -48.2600,
    phone: '34998901234',
    tags: ['Painel Solar', 'Bombeamento', 'Cerca Elétrica'],
    avatarColor: '#eab308',
    verified: false,
    responseTime: 'Responde em ~3h',
  },
  {
    id: '9',
    name: 'Transportes Frutal Ltda',
    category: 'Transporte de Grãos',
    categoryId: 'transporte',
    rating: 4.7,
    reviewCount: 88,
    city: 'Frutal',
    state: 'MG',
    lat: -20.0248,
    lng: -48.9390,
    phone: '34999012345',
    tags: ['Soja', 'Milho', 'Carretas Basculantes'],
    avatarColor: '#64748b',
    verified: true,
    responseTime: 'Responde em ~2h',
  },
  {
    id: '10',
    name: 'Terramax Terraplanagem',
    category: 'Terraplanagem',
    categoryId: 'terraplanagem',
    rating: 4.6,
    reviewCount: 34,
    city: 'Araguari',
    state: 'MG',
    lat: -18.6200,
    lng: -48.1700,
    phone: '34990123456',
    tags: ['Nivelamento', 'Açudes', 'Estradas Internas'],
    avatarColor: '#78350f',
    verified: true,
    responseTime: 'Responde em ~4h',
  },
  {
    id: '11',
    name: 'Jorge Augusto Nunes',
    category: 'Mecânico Agrícola',
    categoryId: 'mecanico',
    rating: 4.3,
    reviewCount: 15,
    city: 'Uberaba',
    state: 'MG',
    lat: -19.7650,
    lng: -47.9100,
    phone: '34991122334',
    tags: ['New Holland', 'Valtra', 'Tratores'],
    avatarColor: '#dc2626',
    verified: false,
    responseTime: 'Responde em ~6h',
  },
  {
    id: '12',
    name: 'Beatriz Souza Nascimento',
    category: 'Agrônomo / Consultor',
    categoryId: 'agronomo',
    rating: 4.8,
    reviewCount: 36,
    city: 'Tupaciguara',
    state: 'MG',
    lat: -18.5800,
    lng: -48.7200,
    phone: '34992233445',
    tags: ['Cafeicultura', 'Fertirrigação', 'CREA/MG'],
    avatarColor: '#059669',
    verified: true,
    responseTime: 'Responde em ~2h',
  },
  {
    id: '13',
    name: 'Willian Gonçalves Prado',
    category: 'Soldador',
    categoryId: 'soldador',
    rating: 4.5,
    reviewCount: 27,
    city: 'Ituiutaba',
    state: 'MG',
    lat: -18.9600,
    lng: -49.4500,
    phone: '34993344556',
    tags: ['Arame de Cerca', 'Porteiras', 'Oxicorte'],
    avatarColor: '#7c3aed',
    verified: false,
    responseTime: 'Responde em ~3h',
  },
  {
    id: '14',
    name: 'Renato Campos Ribeiro',
    category: 'Eletricista Rural',
    categoryId: 'eletricista',
    rating: 4.6,
    reviewCount: 18,
    city: 'Araguari',
    state: 'MG',
    lat: -18.6350,
    lng: -48.2050,
    phone: '34994455667',
    tags: ['Motobombas', 'Automação Rural', 'Alta Tensão'],
    avatarColor: '#b45309',
    verified: true,
    responseTime: 'Responde em ~2h',
  },
];

// ── Star rating component ─────────────────────────────────────────────────────
function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <span
          key={s}
          className="material-symbols-outlined"
          style={{
            fontSize: 12,
            color: s <= Math.round(rating) ? '#f59e0b' : 'var(--border)',
            fontVariationSettings: s <= Math.round(rating) ? "'FILL' 1" : "'FILL' 0",
          }}
        >
          star
        </span>
      ))}
    </span>
  );
}

// ── Sort options ──────────────────────────────────────────────────────────────
type SortOption = 'distance' | 'rating' | 'recent';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'distance', label: 'Mais próximo' },
  { value: 'rating', label: 'Melhor avaliado' },
  { value: 'recent', label: 'Mais recente' },
];

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Services() {
  const { currentLocation } = useAppStore();

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('distance');

  // Compute distance for each provider
  const providersWithDistance = useMemo(() => {
    return MOCK_PROVIDERS.map((p) => ({
      ...p,
      distance:
        currentLocation
          ? haversine(currentLocation.lat, currentLocation.lng, p.lat, p.lng)
          : null,
    }));
  }, [currentLocation]);

  // Count per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: MOCK_PROVIDERS.length };
    MOCK_PROVIDERS.forEach((p) => {
      counts[p.categoryId] = (counts[p.categoryId] ?? 0) + 1;
    });
    return counts;
  }, []);

  // Filter + sort
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    let list = providersWithDistance.filter((p) => {
      const matchCat = selectedCategory === 'all' || p.categoryId === selectedCategory;
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)) ||
        p.city.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });

    if (sortBy === 'distance') {
      list = list.sort((a, b) => {
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
    } else if (sortBy === 'rating') {
      list = list.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
    } else {
      // 'recent' — stable order from mock (id ascending treated as "most recent" last)
      list = list.sort((a, b) => Number(b.id) - Number(a.id));
    }

    return list;
  }, [providersWithDistance, selectedCategory, searchQuery, sortBy]);

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      style={{ background: 'var(--bg)', color: 'var(--text, #e2e8f0)' }}
    >
      {/* ── Top search bar ────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 px-4 md:px-6 py-3 border-b flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4"
        style={{ borderColor: 'var(--border)', background: 'var(--sidebar)' }}
      >
        {/* Title + search */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="material-symbols-outlined text-lg flex-shrink-0" style={{ color: 'var(--primary)' }}>
            handshake
          </span>
          <h1 className="text-sm font-bold tracking-tight whitespace-nowrap" style={{ color: 'var(--text, #e2e8f0)' }}>
            Serviços Locais
          </h1>
          <div
            className="flex items-center gap-2 flex-1 rounded-lg px-3 py-1.5"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <span className="material-symbols-outlined text-base flex-shrink-0" style={{ color: 'var(--muted)' }}>
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar mecânico, soldador, agrônomo..."
              className="flex-1 bg-transparent border-none outline-none text-xs"
              style={{ color: 'var(--text, #e2e8f0)' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}>
                <span className="material-symbols-outlined text-sm" style={{ color: 'var(--muted)' }}>
                  close
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Sort selector */}
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 flex-shrink-0"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <span className="material-symbols-outlined text-sm flex-shrink-0" style={{ color: 'var(--muted)' }}>
            sort
          </span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="bg-transparent border-none outline-none text-xs font-semibold cursor-pointer"
            style={{ color: 'var(--text, #e2e8f0)' }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} style={{ background: 'var(--sidebar)' }}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Body: sidebar + results ────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left sidebar */}
        <aside
          className="hidden md:flex w-56 flex-shrink-0 flex-col border-r overflow-y-auto scrollbar-thin"
          style={{ borderColor: 'var(--border)', background: 'var(--sidebar)' }}
        >
          <p
            className="px-4 pt-4 pb-2 text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--muted)' }}
          >
            Categorias
          </p>
          <div className="px-2 flex flex-col gap-0.5">
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.id;
              const count = categoryCounts[cat.id] ?? 0;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all"
                  style={{
                    background: isActive ? 'var(--primary-dim)' : 'transparent',
                    color: isActive ? 'var(--primary)' : 'var(--muted)',
                    fontWeight: isActive ? 600 : 400,
                    fontSize: 12,
                  }}
                >
                  <span
                    className="material-symbols-outlined flex-shrink-0"
                    style={{ fontSize: 16, color: isActive ? 'var(--primary)' : 'var(--muted)' }}
                  >
                    {cat.icon}
                  </span>
                  <span className="flex-1 truncate">{cat.label}</span>
                  {count > 0 && (
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={{
                        background: isActive ? 'var(--primary-dim)' : 'rgba(255,255,255,0.05)',
                        color: isActive ? 'var(--primary)' : 'var(--muted)',
                      }}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* CTA footer */}
          <div className="mt-auto p-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <button
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all hover:opacity-90"
              style={{ background: 'var(--primary)', color: '#fff' }}
            >
              <span className="material-symbols-outlined text-sm">add_circle</span>
              Cadastrar meu serviço
            </button>
            <p className="text-[10px] text-center mt-2" style={{ color: 'var(--muted)' }}>
              Apareça para agricultores da região
            </p>
          </div>
        </aside>

        {/* Results grid */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 md:p-5">
          {/* Mobile category chips */}
          <div className="flex md:hidden gap-2 mb-4 overflow-x-auto pb-1 scrollbar-thin">
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                  style={{
                    background: isActive ? 'var(--primary)' : 'var(--surface)',
                    border: `1px solid ${isActive ? 'var(--primary)' : 'var(--border)'}`,
                    color: isActive ? '#fff' : 'var(--muted)',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                    {cat.icon}
                  </span>
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Results header */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
              {filtered.length} prestador{filtered.length !== 1 ? 'es' : ''} encontrado
              {filtered.length !== 1 ? 's' : ''}
              {selectedCategory !== 'all' && (
                <span style={{ color: 'var(--primary)' }}>
                  {' '}·{' '}
                  {CATEGORIES.find((c) => c.id === selectedCategory)?.label}
                </span>
              )}
            </p>
            {!currentLocation && (
              <span
                className="text-[10px] font-medium px-2 py-1 rounded-lg"
                style={{
                  background: 'rgba(245,158,11,0.12)',
                  color: '#f59e0b',
                  border: '1px solid rgba(245,158,11,0.25)',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 12, verticalAlign: 'middle' }}>
                  location_off
                </span>{' '}
                Localização indisponível
              </span>
            )}
          </div>

          {/* Card grid */}
          {filtered.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-3 py-16"
              style={{ color: 'var(--muted)' }}
            >
              <span className="material-symbols-outlined text-4xl">search_off</span>
              <p className="text-sm font-semibold">Nenhum prestador encontrado</p>
              <p className="text-xs">Tente ajustar os filtros ou a busca</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filtered.map((provider) => (
                <ProviderCard key={provider.id} provider={provider} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Provider card ─────────────────────────────────────────────────────────────
function ProviderCard({
  provider,
}: {
  provider: ServiceProvider & { distance: number | null };
}) {
  const initials = provider.name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  const distanceLabel =
    provider.distance !== null ? `${Math.round(provider.distance)} km` : '–';

  const whatsappUrl = `https://wa.me/55${provider.phone}?text=${encodeURIComponent(
    `Olá ${provider.name.split(' ')[0]}, encontrei seu serviço no Tracto AgTech e gostaria de mais informações.`
  )}`;

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3 transition-all hover:translate-y-[-1px]"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
      }}
    >
      {/* Top row: avatar + name + distance badge */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 text-white"
          style={{ background: provider.avatarColor }}
        >
          {initials}
        </div>

        {/* Name / category */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-sm font-semibold leading-snug truncate" style={{ color: 'var(--text, #e2e8f0)' }}>
              {provider.name}
            </h3>
            {provider.verified && (
              <span
                className="material-symbols-outlined flex-shrink-0"
                style={{ fontSize: 14, color: '#3b82f6', fontVariationSettings: "'FILL' 1" }}
                title="Perfil verificado"
              >
                verified
              </span>
            )}
          </div>
          <p className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--muted)' }}>
            {provider.category}
          </p>
        </div>

        {/* Distance badge */}
        <div
          className="flex items-center gap-1 px-2 py-1 rounded-lg flex-shrink-0"
          style={{
            background: 'var(--primary-dim)',
            border: '1px solid rgba(236,91,19,0.18)',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 12, color: 'var(--primary)' }}>
            pin_drop
          </span>
          <span className="text-[10px] font-bold" style={{ color: 'var(--primary)' }}>
            {distanceLabel}
          </span>
        </div>
      </div>

      {/* Rating + city */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Stars rating={provider.rating} />
          <span className="text-[11px] font-semibold" style={{ color: 'var(--text, #e2e8f0)' }}>
            {provider.rating.toFixed(1)}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
            ({provider.reviewCount})
          </span>
        </div>
        <span className="w-px h-3" style={{ background: 'var(--border)' }} />
        <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--muted)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
            location_on
          </span>
          {provider.city}, {provider.state}
        </span>
        <span className="w-px h-3" style={{ background: 'var(--border)' }} />
        <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--muted)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
            schedule
          </span>
          {provider.responseTime}
        </span>
      </div>

      {/* Tags */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {provider.tags.map((tag) => (
          <span
            key={tag}
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border)',
              color: 'var(--muted)',
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 pt-1">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 flex-1 justify-center"
          style={{ background: '#16a34a', color: '#fff' }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M11.994 2C6.477 2 2 6.477 2 11.994c0 1.97.563 3.807 1.537 5.366L2 22l4.752-1.524A9.951 9.951 0 0011.994 22C17.511 22 22 17.522 22 11.994 22 6.477 17.511 2 11.994 2zm.006 18.105a8.127 8.127 0 01-4.198-1.161l-.301-.179-3.12 1.002.982-3.038-.196-.312a8.116 8.116 0 01-1.27-4.423c0-4.487 3.652-8.139 8.139-8.139 2.174 0 4.218.848 5.754 2.389a8.09 8.09 0 012.385 5.75c0 4.487-3.652 8.111-8.175 8.111z"/>
          </svg>
          WhatsApp
        </a>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90"
          style={{
            background: 'var(--primary-dim)',
            border: '1px solid rgba(236,91,19,0.2)',
            color: 'var(--primary)',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
            person
          </span>
          Ver perfil
        </button>
      </div>
    </div>
  );
}
