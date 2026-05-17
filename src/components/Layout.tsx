import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../services/supabase';
import { FALLBACK_LOCATION } from '../utils/geolocation';
import { preloadWeather } from '../services/api';
import { ToastProvider } from './ui/Toast';

// ── Theme helpers ─────────────────────────────────────────────────────────────
type Theme = 'dark' | 'light';

function getInitialTheme(): Theme {
  try {
    return (localStorage.getItem('tracto-theme') as Theme) || 'dark';
  } catch {
    return 'dark';
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem('tracto-theme', theme); } catch { /* ignore */ }
}



// ── Nav items por perfil ──────────────────────────────────────────────────────
type NavItem = { to: string; label: string; icon: React.ReactNode; badge?: string };

const iconMap = (name: string) => (
  <span className="material-symbols-outlined" style={{ fontSize: 17 }}>{name}</span>
);

const NAV_PRODUTOR: NavItem[] = [
  { to: '/app/dashboard', label: 'Mapa & Talhões',      icon: iconMap('map') },
  { to: '/app/caderno',   label: 'Caderno de Campo',    icon: iconMap('menu_book') },
  { to: '/app/images',    label: 'Imagens',             icon: iconMap('photo_library') },
  { to: '/app/weather',   label: 'Clima',               icon: iconMap('wb_sunny') },
  { to: '/app/alerts',    label: 'Alertas',             icon: iconMap('notifications_active') },
  { to: '/app/reports',   label: 'Relatórios',           icon: iconMap('bar_chart') },
  { to: '/app/market',    label: 'Mercado',              icon: iconMap('trending_up') },
  { to: '/app/chat',      label: 'Tracto IA',           icon: iconMap('smart_toy'), badge: 'IA' },
];

const NAV_PESQUISADOR: NavItem[] = [
  { to: '/app/dashboard',    label: 'Mapa & Talhões',      icon: iconMap('map') },
  { to: '/app/caderno',      label: 'Caderno de Pesquisa', icon: iconMap('menu_book') },
  { to: '/app/research',     label: 'Pesquisa Agronômica', icon: iconMap('biotech') },
  { to: '/app/germoplasma',  label: 'Germoplasma',         icon: iconMap('genetics') },
  { to: '/app/weather',      label: 'Clima',               icon: iconMap('wb_sunny') },
  { to: '/app/alerts',       label: 'Alertas',             icon: iconMap('notifications_active') },
  { to: '/app/reports',      label: 'Relatórios',           icon: iconMap('bar_chart') },
  { to: '/app/chat',         label: 'MelhorIA',             icon: iconMap('smart_toy'), badge: 'IA' },
];

// Fallback quando nenhum perfil selecionado — mostra tudo
const NAV_DEFAULT: NavItem[] = [
  { to: '/app/dashboard',   label: 'Mapa & Talhões',      icon: iconMap('map') },
  { to: '/app/caderno',     label: 'Caderno de Campo',    icon: iconMap('menu_book') },
  { to: '/app/research',    label: 'Pesquisa',             icon: iconMap('biotech') },
  { to: '/app/germoplasma', label: 'Germoplasma',          icon: iconMap('genetics') },
  { to: '/app/images',      label: 'Imagens',             icon: iconMap('photo_library') },
  { to: '/app/weather',     label: 'Clima',               icon: iconMap('wb_sunny') },
  { to: '/app/alerts',      label: 'Alertas',             icon: iconMap('notifications_active') },
  { to: '/app/reports',     label: 'Relatórios',           icon: iconMap('bar_chart') },
  { to: '/app/market',      label: 'Mercado',              icon: iconMap('trending_up') },
  { to: '/app/chat',        label: 'Tracto IA',           icon: iconMap('smart_toy'), badge: 'IA' },
];

// ── Sidebar content (shared between desktop & mobile drawer) ──────────────────
function SidebarContent({
  onNavClick,
  handleLogout,
  theme,
  toggleTheme,
}: {
  onNavClick?: () => void;
  handleLogout: () => Promise<void>;
  theme: Theme;
  toggleTheme: () => void;
}) {
  const { alerts, userProfile } = useAppStore();
  const activeAlertCount = alerts.filter((a) => !a.dismissed).length;

  const navItems: NavItem[] =
    userProfile === 'produtor'   ? NAV_PRODUTOR :
    userProfile === 'pesquisador' ? NAV_PESQUISADOR :
    NAV_DEFAULT;

  const profileLabel =
    userProfile === 'produtor'    ? '🌾 Produtor Rural' :
    userProfile === 'pesquisador' ? '🔬 Pesquisador' :
    null;

  const [userName, setUserName] = useState('Usuário');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const name = data.user?.user_metadata?.full_name
        || data.user?.email?.split('@')[0]
        || 'Usuário';
      setUserName(name);
    });
  }, []);

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--sidebar)' }}>
      {/* Logo */}
      <div className="px-4 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <img
            src="/tracto-icon.png" onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/tracto-icon.svg"; }}
            alt="Tracto"
            className="tracto-brand-icon flex-shrink-0"
            style={{ width: 36, height: 36, objectFit: 'contain' }}
          />
          <div>
            <h1 className="text-base font-black tracking-[0.15em] text-white leading-none">TRACTO</h1>
            <p className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--muted)' }}>Plataforma AgTech</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto scrollbar-thin">

        {/* Profile badge — apenas exibe o perfil, sem botão de troca */}
        {profileLabel && (
          <div className="px-3 pt-2 pb-1">
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
              {profileLabel}
            </span>
          </div>
        )}

        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavClick}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            {item.icon}
            <span className="flex-1">{item.label}</span>
            {item.to === '/app/alerts' && activeAlertCount > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                {activeAlertCount}
              </span>
            )}
            {item.badge && (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: 'var(--primary-dim)', color: 'var(--primary)' }}>
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User Footer */}
      <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
        {/* Avatar row */}
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'var(--primary)', color: '#fff' }}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">{userName}</p>
            <p className="text-[10px] truncate" style={{ color: 'var(--muted)' }}>
              {userName === 'Usuário' ? 'Carregando...' : 'Administrador'}
            </p>
          </div>
          {/* Settings gear → /app/settings */}
          <NavLink
            to="/app/settings"
            onClick={onNavClick}
            title="Configurações"
            className={({ isActive }) =>
              `flex-shrink-0 transition-colors ${isActive ? 'text-[var(--primary)]' : 'text-slate-600 hover:text-white'}`
            }
          >
            <span className="material-symbols-outlined text-base">settings</span>
          </NavLink>
          {/* Dark / Light toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
            className="flex-shrink-0 text-slate-600 hover:text-white transition-colors"
          >
            <span className="material-symbols-outlined text-base">
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
        </div>

        <NavLink
          to="/app/billing"
          onClick={onNavClick}
          className="w-full flex items-center gap-3 px-4 py-2 mb-2 rounded-lg text-xs font-semibold transition-all hover:bg-white/5"
          style={{ color: '#94a3b8', border: '1px solid rgba(255,255,255,0.04)' }}
        >
          <span className="material-symbols-outlined text-base" style={{ color: 'var(--primary)' }}>credit_card</span>
          Minha Assinatura
        </NavLink>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all"
          style={{ color: '#f87171', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}
        >
          <span className="material-symbols-outlined text-sm">logout</span>
          Sair do Portal
        </button>
      </div>
    </div>
  );
}

// ── Layout ────────────────────────────────────────────────────────────────────
export default function Layout() {
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const selectorRef = useRef<HTMLDivElement>(null);

  // ── Estado de edição inline ───────────────────────────────────────────────
  const [editingFarmId, setEditingFarmId] = useState<string | null>(null);
  const [editFarmName, setEditFarmName] = useState('');
  const [editFarmCity, setEditFarmCity] = useState('');
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [editFieldName, setEditFieldName] = useState('');
  const [editFieldCultura, setEditFieldCultura] = useState('');
  const [editFieldVariedade, setEditFieldVariedade] = useState('');
  const [editFieldPlantio, setEditFieldPlantio] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Apply theme on mount + whenever it changes
  useEffect(() => { applyTheme(theme); }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const {
    farms,
    fields,
    alerts,
    activeFarmId,
    activeFieldId,
    setActiveFarm,
    setActiveField,
    focusActiveField,
    dismissAlert,
    currentLocation,
    resetStore,
    weatherCache,
    setWeatherCache,
    syncFromBackend,
    updateFarmInfo,
    deleteFarm,
    updateField,
    removeField,
  } = useAppStore();

  // Fechar dropdowns ao clicar fora
  useEffect(() => {
    if (!showNotifications && !selectorOpen) return;
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setShowNotifications(false);
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) setSelectorOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifications, selectorOpen]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // Timeout: se backend demorar mais de 5s, continua sem sync
        const timeout = setTimeout(() => {
          useAppStore.setState({ isSyncing: false });
        }, 5000);

        syncFromBackend().finally(() => clearTimeout(timeout));

        // Sempre tenta geolocalizacao no mount; o util decide fallback em caso de erro/negacao.
        const state = useAppStore.getState();
        void state.updateGeolocation();
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        syncFromBackend();
        const state = useAppStore.getState();
        void state.updateGeolocation();
      }
    });

    return () => subscription.unsubscribe();
  }, [syncFromBackend]);

  // ── Pré-carrega meteorologia ao abrir o app ──────────────────────────────────
  useEffect(() => {
    const loc = currentLocation ?? FALLBACK_LOCATION;
    preloadWeather(loc.lat, loc.lng, weatherCache).then((fresh) => {
      if (fresh) setWeatherCache(fresh);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLocation?.lat, currentLocation?.lng]); // re-run if location changes

  const handleLogout = async () => {
    await supabase.auth.signOut();
    resetStore();
    navigate('/login');
  };

  // Determine active farm/field for display
  const temp = weatherCache ? `${Math.round(weatherCache.temperature)}°C` : '–';
  const humidity = weatherCache ? `${weatherCache.humidity}%` : '–';
  const activeFarm = farms.find((farm) => farm.id === activeFarmId) ?? null;


  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap');

        *, *::before, *::after { box-sizing: border-box; }
        html, body, #root { height: 100%; }
        body { font-family: 'Inter', sans-serif; background-color: #080809; color: #f1f5f9; -webkit-font-smoothing: antialiased; }

        :root {
          --primary: #ec5b13;
          --primary-dim: rgba(236,91,19,0.12);
          --primary-border: rgba(236,91,19,0.2);
          --bg: #080809;
          --sidebar: #0c0c0e;
          --surface: rgba(255,255,255,0.03);
          --border: rgba(255,255,255,0.07);
          --border-strong: rgba(255,255,255,0.12);
          --muted: #64748b;
          --text: #e2e8f0;
          --text-secondary: #94a3b8;
        }

        /* ── Light Mode ──────────────────────────────── */
        [data-theme="light"] {
          --primary: #d44e0a;
          --primary-dim: rgba(212,78,10,0.10);
          --primary-border: rgba(212,78,10,0.22);
          --bg: #f4f3ef;
          --sidebar: #ffffff;
          --surface: rgba(0,0,0,0.04);
          --border: rgba(15,23,42,0.18);
          --border-strong: rgba(15,23,42,0.28);
          --muted: #475569;
          --text: #0f172a;
          --text-secondary: #334155;
        }
        [data-theme="light"] body {
          background-color: #f4f3ef;
          color: #0f172a;
        }
        /* Texto claro → escuro no modo claro */
        [data-theme="light"] .text-white { color: #0f172a !important; }
        /* Dark floating panels keep white text even in light mode */
        [data-theme="light"] .always-dark * { color: inherit; }
        [data-theme="light"] .always-dark .text-white { color: #ffffff !important; }
        [data-theme="light"] .always-dark .text-slate-50,
        [data-theme="light"] .always-dark .text-slate-100,
        [data-theme="light"] .always-dark .text-slate-200 { color: #f1f5f9 !important; }
        [data-theme="light"] .always-dark .text-slate-300 { color: #cbd5e1 !important; }
        [data-theme="light"] .always-dark .text-slate-400,
        [data-theme="light"] .always-dark .text-slate-500,
        [data-theme="light"] .always-dark .text-slate-600 { color: #94a3b8 !important; }
        [data-theme="light"] .always-dark [style*="rgba(255,255,255,0.0"],
        [data-theme="light"] .always-dark [style*="rgba(255,255,255,0.1"] { background: rgba(255,255,255,0.06) !important; }
        [data-theme="light"] .always-dark [style*="rgba(255,255,255,0.07)"],
        [data-theme="light"] .always-dark [style*="rgba(255,255,255,0.08)"],
        [data-theme="light"] .always-dark [style*="rgba(255,255,255,0.09)"],
        [data-theme="light"] .always-dark [style*="rgba(255,255,255,0.10)"],
        [data-theme="light"] .always-dark [style*="rgba(255,255,255,0.12)"] { border-color: rgba(255,255,255,0.1) !important; }
        [data-theme="light"] .text-slate-50,
        [data-theme="light"] .text-slate-100,
        [data-theme="light"] .text-slate-200 { color: #1e293b !important; }
        [data-theme="light"] .text-slate-300 { color: #334155 !important; }
        [data-theme="light"] .text-slate-400,
        [data-theme="light"] .text-slate-500 { color: #475569 !important; }
        [data-theme="light"] .text-slate-600 { color: #64748b !important; }
        /* Qualquer elemento com cor branca/clara em inline style → escuro */
        [data-theme="light"] p, [data-theme="light"] span, [data-theme="light"] h1,
        [data-theme="light"] h2, [data-theme="light"] h3, [data-theme="light"] h4,
        [data-theme="light"] h5, [data-theme="light"] label { color: inherit; }
        [data-theme="light"] .header-glass {
          background: rgba(244,243,239,0.95) !important;
        }
        [data-theme="light"] .nav-item { color: #475569; }
        [data-theme="light"] .nav-item:hover { color: #0f172a; background: rgba(0,0,0,0.04); }
        [data-theme="light"] .nav-item.active { color: #d44e0a; background: rgba(212,78,10,0.08); }
        [data-theme="light"] .card-glass { background: rgba(0,0,0,0.02); }

        /* ── Light mode: sobrescrever surfaces escuras ──── */
        [data-theme="light"] .bg-slate-800\/50,
        [data-theme="light"] .bg-slate-700\/50,
        [data-theme="light"] .bg-slate-900 { background-color: rgba(0,0,0,0.06) !important; }
        /* Cards e superfícies com rgba branco */
        [data-theme="light"] [style*="rgba(255,255,255,0.0"],
        [data-theme="light"] [style*="rgba(255,255,255,0.1"] {
          background: rgba(0,0,0,0.03) !important;
        }
        [data-theme="light"] [style*="rgba(255,255,255,0.02)"] { background: rgba(0,0,0,0.03) !important; }
        [data-theme="light"] [style*="rgba(255,255,255,0.03)"] { background: rgba(0,0,0,0.04) !important; }
        [data-theme="light"] [style*="rgba(255,255,255,0.05)"] { background: rgba(0,0,0,0.05) !important; }
        [data-theme="light"] [style*="rgba(255,255,255,0.06)"] { background: rgba(0,0,0,0.06) !important; }
        /* Bordas claras → bordas escuras VISÍVEIS (PERSISTE em todas as áreas) */
        [data-theme="light"] [style*="rgba(255,255,255,0.05)"],
        [data-theme="light"] [style*="rgba(255,255,255,0.06)"],
        [data-theme="light"] [style*="rgba(255,255,255,0.07)"],
        [data-theme="light"] [style*="rgba(255,255,255,0.08)"],
        [data-theme="light"] [style*="rgba(255,255,255,0.09)"],
        [data-theme="light"] [style*="rgba(255,255,255,0.10)"],
        [data-theme="light"] [style*="rgba(255,255,255,0.12)"],
        [data-theme="light"] [style*="rgba(255,255,255,0.15)"] {
          border-color: rgba(15,23,42,0.18) !important;
        }
        /* Bordas explícitas Tailwind (border-white/N) → visíveis no light mode */
        [data-theme="light"] .border-white\/5,
        [data-theme="light"] .border-white\/10,
        [data-theme="light"] .border-white\/15,
        [data-theme="light"] .border-white\/20 {
          border-color: rgba(15,23,42,0.18) !important;
        }
        /* Divider lines em <hr> e elementos com border-t/b/l/r usando rgba branco */
        [data-theme="light"] [style*="borderColor: rgba(255,255,255"],
        [data-theme="light"] [style*="border-color: rgba(255,255,255"],
        [data-theme="light"] [style*="border-top: 1px solid rgba(255,255,255"],
        [data-theme="light"] [style*="border-bottom: 1px solid rgba(255,255,255"],
        [data-theme="light"] [style*="borderTop: '1px solid rgba(255,255,255"],
        [data-theme="light"] [style*="borderBottom: '1px solid rgba(255,255,255"] {
          border-color: rgba(15,23,42,0.18) !important;
        }
        /* Cards/seções com border solid var(--border) ganham sombra leve pra destacar */
        [data-theme="light"] .card-glass,
        [data-theme="light"] [class*="rounded-2xl"][style*="var(--surface)"],
        [data-theme="light"] [class*="rounded-xl"][style*="var(--surface)"] {
          box-shadow: 0 1px 3px rgba(15,23,42,0.05);
        }
        /* Scrollbar */
        [data-theme="light"] .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); }
        [data-theme="light"] .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.25); }
        /* Light mode: map/research panels stay dark always */
        [data-theme="light"] .leaflet-container { filter: none; }

        /* ── AUDITORIA: inline styles brancos hardcoded → escuro no light mode ── */
        /* Não aplica dentro de .always-dark (painéis flutuantes que ficam escuros sempre) */
        [data-theme="light"] :not(.always-dark) :not(.always-dark *)[style*="color: #fff"],
        [data-theme="light"] :not(.always-dark) :not(.always-dark *)[style*="color:#fff"],
        [data-theme="light"] :not(.always-dark) :not(.always-dark *)[style*="color: white"],
        [data-theme="light"] :not(.always-dark) :not(.always-dark *)[style*="color:white"],
        [data-theme="light"] :not(.always-dark) :not(.always-dark *)[style*="color: rgb(255, 255, 255)"],
        [data-theme="light"] :not(.always-dark) :not(.always-dark *)[style*="color: rgb(255,255,255)"] {
          color: #0f172a !important;
        }
        /* Backgrounds brancos hardcoded → fundo bege/claro no light mode */
        [data-theme="light"] :not(.always-dark) :not(.always-dark *)[style*="background: #fff"],
        [data-theme="light"] :not(.always-dark) :not(.always-dark *)[style*="background:#fff"],
        [data-theme="light"] :not(.always-dark) :not(.always-dark *)[style*="background: white"],
        [data-theme="light"] :not(.always-dark) :not(.always-dark *)[style*="background-color: #fff"],
        [data-theme="light"] :not(.always-dark) :not(.always-dark *)[style*="background-color: white"] {
          background: #ffffff !important;
        }
        /* Backgrounds escuros hardcoded em panel (#080809, #0a0a0c, #0c0c0e) → claro */
        [data-theme="light"] :not(.always-dark) [style*="background: #080809"],
        [data-theme="light"] :not(.always-dark) [style*="background:#080809"],
        [data-theme="light"] :not(.always-dark) [style*="background: #0a0a0c"],
        [data-theme="light"] :not(.always-dark) [style*="background:#0a0a0c"],
        [data-theme="light"] :not(.always-dark) [style*="background: #0c0c0e"],
        [data-theme="light"] :not(.always-dark) [style*="background:#0c0c0e"],
        [data-theme="light"] :not(.always-dark) [style*="background: #0d0d0f"] {
          background: #ffffff !important;
          border-color: rgba(0,0,0,0.08) !important;
        }
        /* Cores muted hardcoded típicas → ficam visíveis no light mode */
        [data-theme="light"] :not(.always-dark) [style*="color: #64748b"],
        [data-theme="light"] :not(.always-dark) [style*="color:#64748b"],
        [data-theme="light"] :not(.always-dark) [style*="color: #475569"],
        [data-theme="light"] :not(.always-dark) [style*="color:#475569"] {
          color: #475569 !important;
        }
        [data-theme="light"] :not(.always-dark) [style*="color: #334155"],
        [data-theme="light"] :not(.always-dark) [style*="color:#334155"],
        [data-theme="light"] :not(.always-dark) [style*="color: #1e293b"],
        [data-theme="light"] :not(.always-dark) [style*="color:#1e293b"] {
          color: #64748b !important;
        }
        /* Texto claro slate-200/300 hardcoded → escuro no light */
        [data-theme="light"] :not(.always-dark) [style*="color: #e2e8f0"],
        [data-theme="light"] :not(.always-dark) [style*="color:#e2e8f0"],
        [data-theme="light"] :not(.always-dark) [style*="color: #f1f5f9"],
        [data-theme="light"] :not(.always-dark) [style*="color:#f1f5f9"],
        [data-theme="light"] :not(.always-dark) [style*="color: #cbd5e1"],
        [data-theme="light"] :not(.always-dark) [style*="color:#cbd5e1"],
        [data-theme="light"] :not(.always-dark) [style*="color: #94a3b8"],
        [data-theme="light"] :not(.always-dark) [style*="color:#94a3b8"] {
          color: #1e293b !important;
        }

        /* ── Overlays flutuantes sobre o mapa (dropdowns Ações, Satélite HD, etc) ── */
        /* Mesmo dentro de .always-dark, esses controles devem adaptar ao tema. */
        [data-theme="light"] [style*="rgba(8,8,9,0."],
        [data-theme="light"] [style*="rgba(0,0,0,0.4)"],
        [data-theme="light"] [style*="rgba(0,0,0,0.5)"],
        [data-theme="light"] [style*="rgba(0,0,0,0.55)"],
        [data-theme="light"] [style*="rgba(0,0,0,0.6)"],
        [data-theme="light"] [style*="rgba(0,0,0,0.7)"],
        [data-theme="light"] [style*="rgba(0,0,0,0.75)"],
        [data-theme="light"] [style*="rgba(0,0,0,0.85)"],
        [data-theme="light"] [style*="rgba(0,0,0,0.9)"],
        [data-theme="light"] [style*="rgba(0,0,0,0.92)"],
        [data-theme="light"] [style*="rgba(0,0,0,0.95)"] {
          background: rgba(255, 255, 255, 0.96) !important;
          border-color: rgba(15, 23, 42, 0.12) !important;
          color: #0f172a !important;
        }
        [data-theme="light"] [style*="rgba(8,8,9,0."] *,
        [data-theme="light"] [style*="rgba(0,0,0,0.6)"] *,
        [data-theme="light"] [style*="rgba(0,0,0,0.75)"] *,
        [data-theme="light"] [style*="rgba(0,0,0,0.85)"] *,
        [data-theme="light"] [style*="rgba(0,0,0,0.9)"] *,
        [data-theme="light"] [style*="rgba(0,0,0,0.92)"] *,
        [data-theme="light"] [style*="rgba(0,0,0,0.95)"] * {
          color: #0f172a !important;
        }
        /* Mantém ícones laranja/verde/azul originais dentro dos overlays */
        [data-theme="light"] [style*="rgba(8,8,9,0."] [style*="color: #ec5b13"],
        [data-theme="light"] [style*="rgba(8,8,9,0."] [style*="color: #34d399"],
        [data-theme="light"] [style*="rgba(8,8,9,0."] [style*="color: #60a5fa"],
        [data-theme="light"] [style*="rgba(8,8,9,0."] [style*="color: #a78bfa"],
        [data-theme="light"] [style*="rgba(8,8,9,0."] [style*="color: #f59e0b"],
        [data-theme="light"] [style*="rgba(8,8,9,0."] [style*="color: #fbbf24"],
        [data-theme="light"] [style*="rgba(8,8,9,0."] [style*="color: #f87171"] {
          color: inherit !important;
        }
        /* Placeholder em inputs sobre o mapa fica visível no light mode */
        [data-theme="light"] .always-dark input::placeholder,
        [data-theme="light"] [style*="rgba(8,8,9,0."] input::placeholder {
          color: #64748b !important;
        }

        /* ── Dropdowns nativos <select> e <option> adaptam ao tema ── */
        select { color-scheme: dark; }
        [data-theme="light"] select { color-scheme: light; }
        select option {
          background: #1a1a1c;
          color: #e2e8f0;
        }
        [data-theme="light"] select option {
          background: #ffffff;
          color: #0f172a;
        }
        /* Inputs date/time pickers também */
        input[type="date"], input[type="time"], input[type="datetime-local"] {
          color-scheme: dark;
        }
        [data-theme="light"] input[type="date"],
        [data-theme="light"] input[type="time"],
        [data-theme="light"] input[type="datetime-local"] {
          color-scheme: light;
        }

        /* ── Glass overlay panel — adaptativo claro/escuro ── */
        .glass-overlay {
          background: rgba(8,8,9,0.94) !important;
          backdrop-filter: blur(14px) !important;
          -webkit-backdrop-filter: blur(14px) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          color: #e2e8f0 !important;
        }
        [data-theme="light"] .glass-overlay {
          background: rgba(255,255,255,0.97) !important;
          border: 1px solid rgba(15,23,42,0.1) !important;
          color: #0f172a !important;
          box-shadow: 0 10px 30px rgba(15,23,42,0.08);
        }
        [data-theme="light"] .glass-overlay .text-white {
          color: #0f172a !important;
        }
        /* Cores semânticas internas mantém (laranja, verde, vermelho) */
        [data-theme="light"] .glass-overlay [style*="color: #ec5b13"],
        [data-theme="light"] .glass-overlay [style*="color: #34d399"],
        [data-theme="light"] .glass-overlay [style*="color: #f87171"],
        [data-theme="light"] .glass-overlay [style*="color: #fbbf24"] {
          color: inherit !important;
        }

        /* ── A11y: focus rings em todos elementos interativos ── */
        /* WCAG 2.1: focus visível é obrigatório pra navegação por teclado */
        button:focus-visible,
        a:focus-visible,
        input:focus-visible,
        select:focus-visible,
        textarea:focus-visible,
        [role="button"]:focus-visible {
          outline: 2px solid #ec5b13;
          outline-offset: 2px;
          border-radius: 6px;
        }
        /* Sobrescreve focus:outline-none de Tailwind apenas quando keyboard nav */
        :focus:not(:focus-visible) {
          outline: none;
        }

        /* ── A11y: touch targets mínimo 44px em mobile ── */
        @media (max-width: 768px) {
          button, a[role="button"], a.btn, [role="button"] {
            min-height: 36px;
            min-width: 36px;
          }
        }

        /* ── A11y: screen reader only utility ── */
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }
        .focus\\:not-sr-only:focus {
          position: static;
          width: auto;
          height: auto;
          padding: inherit;
          margin: inherit;
          overflow: visible;
          clip: auto;
          white-space: normal;
        }

        /* ── Reduced motion: respeita preferência do usuário ── */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        }

        /* ── Tracto Input/Select/Label — classes reutilizáveis adaptativas ── */
        .tracto-input, .tracto-select {
          background: rgba(255,255,255,0.05) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          color: var(--text) !important;
        }
        .tracto-input::placeholder { color: #475569 !important; }
        .tracto-input:focus, .tracto-select:focus {
          border-color: rgba(236,91,19,0.45) !important;
          outline: none;
        }
        [data-theme="light"] .tracto-input,
        [data-theme="light"] .tracto-select {
          background: #ffffff !important;
          border: 1px solid rgba(15,23,42,0.15) !important;
          color: #0f172a !important;
        }
        [data-theme="light"] .tracto-input::placeholder { color: #94a3b8 !important; }
        /* Seta do select customizada já que appearance:none remove a nativa */
        .tracto-select {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5L6 7.5L9 4.5' stroke='%2364748b' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E") !important;
          background-repeat: no-repeat !important;
          background-position: right 10px center !important;
          background-size: 12px !important;
          padding-right: 28px !important;
        }
        .tracto-label { color: #64748b; }
        [data-theme="light"] .tracto-label { color: #475569; }
        /* Textos com text-white explícito dentro de overlays mantém visibilidade */
        [data-theme="light"] [style*="rgba(8,8,9,0."] .text-white,
        [data-theme="light"] [style*="rgba(0,0,0,0."] .text-white {
          color: #0f172a !important;
        }

        /* ── Ícone da marca: badge branco arredondado em todos os temas ── */
        .tracto-brand-icon { background: #fff; border-radius: 7px; padding: 2px; }

        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }

        .nav-item {
          display: flex; align-items: center; gap: 10px; padding: 9px 12px;
          border-radius: 10px; font-size: 13px; font-weight: 500; color: #64748b;
          transition: all 0.15s ease; text-decoration: none; position: relative;
        }
        .nav-item:hover { color: #e2e8f0; background: rgba(255,255,255,0.05); }
        .nav-item.active { color: #fff; background: var(--primary-dim); }
        .nav-item.active::before {
          content: ''; position: absolute; left: 0; top: 20%; height: 60%;
          width: 3px; background: var(--primary); border-radius: 99px;
        }

        .card-glass { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; }
        .header-glass { background: rgba(8,8,9,0.85); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }

        /* Mobile drawer overlay */
        .drawer-overlay {
          position: fixed; inset: 0; z-index: 40;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(4px);
          transition: opacity 0.2s ease;
        }
        .drawer-panel {
          position: fixed; top: 0; left: 0; bottom: 0;
          width: 240px; z-index: 50;
          transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
        }
        .drawer-panel.open { transform: translateX(0); }
        .drawer-panel.closed { transform: translateX(-100%); }
      `}</style>

      <div className="flex h-screen w-full overflow-hidden" style={{ background: 'var(--bg)' }}>

        {/* ── Desktop Sidebar (hidden on mobile) ── */}
        <aside className="hidden md:flex w-60 flex-shrink-0 flex-col border-r" style={{ borderColor: 'var(--border)' }}>
          <SidebarContent handleLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />
        </aside>

        {/* â"€â"€ Mobile Drawer Overlay â"€â"€ */}
        {drawerOpen && (
          <div className="drawer-overlay md:hidden" onClick={() => setDrawerOpen(false)} />
        )}

        {/* â"€â"€ Mobile Drawer Panel â"€â"€ */}
        <div className={`drawer-panel md:hidden ${drawerOpen ? 'open' : 'closed'}`} style={{ background: 'var(--sidebar)', borderRight: '1px solid var(--border)' }}>
          {/* Close button */}
          <button
            onClick={() => setDrawerOpen(false)}
            className="absolute top-4 right-4 z-50 w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}
          >
            <span className="material-symbols-outlined text-sm" style={{ color: '#94a3b8' }}>close</span>
          </button>
          <SidebarContent onNavClick={() => setDrawerOpen(false)} handleLogout={handleLogout} theme={theme} toggleTheme={toggleTheme} />
        </div>

        {/* â"€â"€ Main Content â"€â"€ */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* TopBar */}
          <header
            className="header-glass relative flex items-center justify-between px-4 md:px-6 h-16 border-b flex-shrink-0 z-[1001]"
            style={{ borderColor: 'var(--border)' }}
          >
            {/* Left Section: Operational Context */}
            <div className="flex items-center gap-4 md:gap-5">
              {/* Hamburguer â€" mobile only */}
              <button
                onClick={() => setDrawerOpen(true)}
                className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg transition-all"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                aria-label="Abrir menu"
              >
                <span className="material-symbols-outlined text-base" style={{ color: 'var(--muted)' }}>menu</span>
              </button>

              {/* FAZENDA ATIVA — clickable dropdown */}
              <div className="relative" ref={selectorRef}>
                <button
                  type="button"
                  onClick={() => setSelectorOpen((v) => !v)}
                  className="hidden md:flex items-center gap-2 p-1.5 px-3 rounded-xl transition-all"
                  style={{
                    background: selectorOpen ? 'rgba(236,91,19,0.12)' : 'rgba(255,255,255,0.02)',
                    border: selectorOpen ? '1px solid rgba(236,91,19,0.28)' : '1px solid var(--border)',
                    cursor: 'pointer',
                  }}
                >
                  <span className="material-symbols-outlined text-base" style={{ color: 'var(--primary)' }}>home_work</span>
                  <div>
                    <p className="text-[10px] uppercase font-bold tracking-wider leading-none mb-0.5" style={{ color: 'var(--muted)' }}>Fazenda ativa</p>
                    <p className="text-xs font-bold text-white leading-tight truncate max-w-[180px]">
                      {activeFarm?.name ?? 'Nenhuma fazenda'}
                    </p>
                  </div>
                  <span className="material-symbols-outlined text-sm transition-transform duration-200" style={{ color: 'var(--muted)', transform: selectorOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>expand_more</span>
                </button>

                {selectorOpen && (
                  <div className="glass-overlay absolute top-full left-0 mt-1.5 z-[600] rounded-xl flex flex-col"
                    style={{ minWidth: 300, maxHeight: 480, overflowY: 'auto' }}>

                    {farms.length === 0 ? (
                      <p className="px-4 py-4 text-[11px]" style={{ color: '#475569' }}>Nenhuma fazenda cadastrada.</p>
                    ) : farms.map((farm) => {
                      const farmFields = fields.filter((f) => f.farm_id === farm.id);
                      const isEditingThisFarm = editingFarmId === farm.id;

                      return (
                        <div key={farm.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>

                          {/* ── Linha da fazenda ── */}
                          {isEditingThisFarm ? (
                            <div className="px-3 py-2.5 flex flex-col gap-2" style={{ background: 'rgba(236,91,19,0.05)' }}>
                              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#ec5b13' }}>Editar Fazenda</p>
                              <input
                                className="w-full px-3 py-1.5 rounded-lg text-xs text-white focus:outline-none"
                                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                                placeholder="Nome da fazenda"
                                value={editFarmName}
                                onChange={(e) => setEditFarmName(e.target.value)}
                              />
                              <input
                                className="w-full px-3 py-1.5 rounded-lg text-xs text-white focus:outline-none"
                                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                                placeholder="Município / Estado"
                                value={editFarmCity}
                                onChange={(e) => setEditFarmCity(e.target.value)}
                              />
                              <div className="flex gap-1.5">
                                <button
                                  disabled={isSavingEdit}
                                  onClick={async () => {
                                    if (!editFarmName.trim()) return;
                                    setIsSavingEdit(true);
                                    try { await updateFarmInfo(farm.id, editFarmName.trim(), editFarmCity.trim()); setEditingFarmId(null); }
                                    catch { /* silently fail */ }
                                    finally { setIsSavingEdit(false); }
                                  }}
                                  className="flex-1 py-1.5 rounded-lg text-[10px] font-bold text-white disabled:opacity-40"
                                  style={{ background: '#ec5b13' }}>
                                  {isSavingEdit ? 'Salvando...' : 'Salvar'}
                                </button>
                                <button onClick={() => setEditingFarmId(null)}
                                  className="px-3 py-1.5 rounded-lg text-[10px] font-semibold hover:bg-white/10"
                                  style={{ color: '#64748b', border: '1px solid rgba(255,255,255,0.08)' }}>
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 px-2 py-1.5 hover:bg-white/4 transition-all group">
                              <button
                                onClick={() => { setActiveFarm(farm.id); setActiveField(null); navigate('/app/dashboard'); setSelectorOpen(false); }}
                                className="flex-1 flex items-center gap-2 text-left min-w-0">
                                <span className="material-symbols-outlined text-sm flex-shrink-0" style={{ color: 'var(--primary)' }}>home_work</span>
                                <span className="text-[11px] font-bold text-white truncate">{farm.name}</span>
                                {(farm.city ?? farm.description) && (
                                  <span className="text-[10px] shrink-0 ml-1" style={{ color: '#334155' }}>{farm.city ?? farm.description}</span>
                                )}
                              </button>
                              <button
                                onClick={() => { setEditingFarmId(farm.id); setEditFarmName(farm.name); setEditFarmCity(farm.city ?? farm.description ?? ''); setEditingFieldId(null); }}
                                className="p-1 rounded hover:bg-white/10 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all"
                                title="Editar fazenda">
                                <span className="material-symbols-outlined text-sm" style={{ color: '#60a5fa' }}>edit</span>
                              </button>
                              <button
                                onClick={async () => {
                                  if (!window.confirm(`Excluir a fazenda "${farm.name}" e todos os seus talhões?`)) return;
                                  try { await deleteFarm(farm.id); } catch { /* silently fail */ }
                                }}
                                className="p-1 rounded hover:bg-red-500/10 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all"
                                title="Excluir fazenda">
                                <span className="material-symbols-outlined text-sm" style={{ color: '#f87171' }}>delete</span>
                              </button>
                            </div>
                          )}

                          {/* ── Talhões da fazenda ── */}
                          {farmFields.length === 0 ? (
                            <p className="pl-9 pr-3 py-1 text-[10px]" style={{ color: '#1e293b' }}>Sem talhões</p>
                          ) : farmFields.map((field) => {
                            const isEditingThisField = editingFieldId === field.id;
                            return (
                              <div key={field.id} style={{ borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                                {isEditingThisField ? (
                                  <div className="pl-9 pr-3 py-2.5 flex flex-col gap-2" style={{ background: 'rgba(96,165,250,0.04)' }}>
                                    <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#60a5fa' }}>Editar Talhão</p>
                                    <input
                                      className="w-full px-3 py-1.5 rounded-lg text-xs text-white focus:outline-none"
                                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                                      placeholder="Nome do talhão"
                                      value={editFieldName}
                                      onChange={(e) => setEditFieldName(e.target.value)}
                                    />
                                    <div className="grid grid-cols-2 gap-1.5">
                                      <input
                                        className="px-3 py-1.5 rounded-lg text-xs text-white focus:outline-none"
                                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                                        placeholder="Cultura"
                                        value={editFieldCultura}
                                        onChange={(e) => setEditFieldCultura(e.target.value)}
                                      />
                                      <input
                                        className="px-3 py-1.5 rounded-lg text-xs text-white focus:outline-none"
                                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                                        placeholder="Variedade"
                                        value={editFieldVariedade}
                                        onChange={(e) => setEditFieldVariedade(e.target.value)}
                                      />
                                    </div>
                                    <input
                                      type="date"
                                      className="w-full px-3 py-1.5 rounded-lg text-xs text-white focus:outline-none"
                                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                                      value={editFieldPlantio}
                                      onChange={(e) => setEditFieldPlantio(e.target.value)}
                                    />
                                    <div className="flex gap-1.5">
                                      <button
                                        disabled={isSavingEdit}
                                        onClick={async () => {
                                          if (!field.id) return;
                                          setIsSavingEdit(true);
                                          try {
                                            await updateField(field.id, {
                                              name: editFieldName || field.name,
                                              cultura: editFieldCultura || undefined,
                                              variedade: editFieldVariedade || undefined,
                                              dataPlantio: editFieldPlantio || undefined,
                                            });
                                            setEditingFieldId(null);
                                          } catch { /* silently fail */ }
                                          finally { setIsSavingEdit(false); }
                                        }}
                                        className="flex-1 py-1.5 rounded-lg text-[10px] font-bold text-white disabled:opacity-40"
                                        style={{ background: '#60a5fa' }}>
                                        {isSavingEdit ? 'Salvando...' : 'Salvar'}
                                      </button>
                                      <button onClick={() => setEditingFieldId(null)}
                                        className="px-3 py-1.5 rounded-lg text-[10px] font-semibold hover:bg-white/10"
                                        style={{ color: '#64748b', border: '1px solid rgba(255,255,255,0.08)' }}>
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1 pl-9 pr-2 py-1 hover:bg-white/4 transition-all group">
                                    <button
                                      onClick={() => { setActiveField(field.id ?? null); focusActiveField(); navigate('/app/dashboard'); setSelectorOpen(false); }}
                                      className="flex-1 flex items-center gap-1.5 text-left min-w-0">
                                      <span className="material-symbols-outlined text-xs flex-shrink-0" style={{ color: activeFieldId === field.id ? 'var(--primary)' : '#1e3a5f' }}>polyline</span>
                                      <span className="text-[11px] font-medium truncate" style={{ color: activeFieldId === field.id ? '#fff' : '#64748b' }}>{field.name}</span>
                                      {field.areaHa && <span className="text-[9px] ml-1 shrink-0" style={{ color: '#1e293b' }}>{field.areaHa.toFixed(1)} ha</span>}
                                    </button>
                                    <a href={`https://www.google.com/maps?q=${field.lat},${field.lng}`}
                                      target="_blank" rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="p-1 rounded hover:bg-white/10 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all"
                                      title="Ver no Google Maps">
                                      <span className="material-symbols-outlined text-sm" style={{ color: '#4ade80' }}>pin_drop</span>
                                    </a>
                                    <button
                                      onClick={() => { setEditingFieldId(field.id ?? null); setEditFarmName(''); setEditFieldName(field.name ?? ''); setEditFieldCultura(field.cultura ?? ''); setEditFieldVariedade(field.variedade ?? ''); setEditFieldPlantio(field.dataPlantio ?? ''); setEditingFarmId(null); }}
                                      className="p-1 rounded hover:bg-white/10 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all"
                                      title="Editar talhão">
                                      <span className="material-symbols-outlined text-sm" style={{ color: '#60a5fa' }}>edit</span>
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (!field.id || !window.confirm(`Excluir o talhão "${field.name}"?`)) return;
                                        try { await removeField(farm.id, field.id); } catch { /* silently fail */ }
                                      }}
                                      className="p-1 rounded hover:bg-red-500/10 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all"
                                      title="Excluir talhão">
                                      <span className="material-symbols-outlined text-sm" style={{ color: '#f87171' }}>delete</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="hidden xl:flex items-center gap-2 p-1.5 px-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                <span className="material-symbols-outlined text-sm" style={{ color: '#94a3b8' }}>location_on</span>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider leading-none mb-0.5" style={{ color: 'var(--muted)' }}>Localização</p>
                  <p className="text-xs font-bold text-white leading-tight truncate max-w-[180px]">
                    {currentLocation?.name || `${FALLBACK_LOCATION.name} (fallback)`}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Section: Actions & Weather */}
            <div className="flex items-center gap-3 md:gap-4">
              {/* Weather Info â€" hidden on mobile */}
              <div className="hidden lg:flex items-center gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5">
                  <span className="material-symbols-outlined text-base" style={{ color: '#f97316' }}>wb_sunny</span>
                  {temp}
                </span>
                <span className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5">
                  <span className="material-symbols-outlined text-base text-blue-400">humidity_percentage</span>
                  <span style={{ color: 'var(--muted)' }}>{humidity}</span>
                </span>
              </div>

              {/* Caderno de Campo — atalho rápido no header */}
              <button
                onClick={() => void navigate('/app/caderno')}
                title="Caderno de Campo"
                className="p-2 rounded-lg transition-all hover:bg-white/5"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <span className="material-symbols-outlined text-base" style={{ color: 'var(--muted)' }}>menu_book</span>
              </button>

              {/* Notifications */}
              <div className="relative" ref={bellRef}>
                <button
                  onClick={() => setShowNotifications((v) => !v)}
                  className="relative p-2 rounded-lg transition-all hover:bg-white/5"
                  style={{ background: showNotifications ? 'rgba(236,91,19,0.12)' : 'var(--surface)', border: `1px solid ${showNotifications ? 'rgba(236,91,19,0.3)' : 'var(--border)'}` }}
                >
                  <span className="material-symbols-outlined text-base" style={{ color: showNotifications ? '#ec5b13' : 'var(--muted)' }}>notifications</span>
                  {alerts.filter((a) => !a.dismissed).length > 0 && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-4 flex items-center justify-center text-[9px] font-bold rounded-full px-1"
                      style={{ background: '#ef4444', color: '#fff', border: '2px solid var(--bg)' }}>
                      {alerts.filter((a) => !a.dismissed).length > 9 ? '9+' : alerts.filter((a) => !a.dismissed).length}
                    </span>
                  )}
                </button>

                {/* Dropdown de notificações */}
                {showNotifications && (
                  <div className="glass-overlay absolute right-0 top-full mt-2 z-[600] rounded-2xl overflow-hidden flex flex-col"
                    style={{ width: 320, maxHeight: 420 }}>
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                      <p className="text-xs font-bold text-white">Notificações</p>
                      {alerts.filter((a) => !a.dismissed).length > 0 && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>
                          {alerts.filter((a) => !a.dismissed).length} nova{alerts.filter((a) => !a.dismissed).length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Lista */}
                    <div className="overflow-y-auto flex-1" style={{ maxHeight: 300 }}>
                      {alerts.filter((a) => !a.dismissed).length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-10">
                          <span className="material-symbols-outlined text-3xl" style={{ color: '#1e3a2e' }}>check_circle</span>
                          <p className="text-xs font-semibold" style={{ color: '#4ade80' }}>Tudo em ordem</p>
                          <p className="text-[10px] text-center px-6" style={{ color: '#475569' }}>Sem alertas ativos nos seus talhões.</p>
                        </div>
                      ) : (
                        alerts.filter((a) => !a.dismissed).slice(0, 8).map((alert) => (
                          <div key={alert.id} className="flex items-start gap-3 px-4 py-3 hover:bg-white/3 transition-all"
                            style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <span className="text-base flex-shrink-0 mt-0.5">
                              {alert.type === 'critical' ? '🔴' : alert.type === 'warning' ? '🟡' : 'ℹ️'}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white leading-tight">{alert.title}</p>
                              <p className="text-[10px] mt-0.5 line-clamp-2" style={{ color: '#64748b' }}>{alert.message}</p>
                              {alert.field && <p className="text-[9px] mt-1" style={{ color: '#475569' }}>📍 {alert.field}</p>}
                            </div>
                            <button onClick={() => dismissAlert(alert.id)}
                              className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center hover:bg-white/10 transition-all"
                              style={{ color: '#475569' }}>
                              <span className="material-symbols-outlined text-xs">close</span>
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <button
                        onClick={() => { navigate('/app/alerts'); setShowNotifications(false); }}
                        className="w-full py-2 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-80"
                        style={{ background: 'rgba(236,91,19,0.15)', border: '1px solid rgba(236,91,19,0.25)', color: '#ec5b13' }}>
                        Ver todos os alertas
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* Skip to content (a11y) */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[6000] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-orange-500 focus:text-white">
            Pular para o conteúdo
          </a>

          {/* Page Content — scrolls correctly on mobile */}
          <main id="main-content" className="flex-1 flex overflow-hidden min-h-0" role="main">
            <Outlet />
          </main>
        </div>
      </div>

      {/* Toast notifications globais */}
      <ToastProvider />
    </>
  );
}



