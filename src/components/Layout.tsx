import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../services/supabase';
import { FALLBACK_LOCATION } from '../utils/geolocation';

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



const NAV_ITEMS = [
  {
    to: '/app/dashboard',
    label: 'Mapa / Talhões',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    to: '/app/weather',
    label: 'Meteorologia',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    to: '/app/chat',
    label: 'Chat IA',
    badge: 'IA',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    to: '/app/alerts',
    label: 'Alertas',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    to: '/app/reports',
    label: 'Relatórios',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    to: '/app/maps',
    label: 'Mapas Agro',
    badge: 'NDVI',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <path d="M9 3v15M15 6v15" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    to: '/app/research',
    label: 'Pesquisa',
    badge: 'NEW',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2v-4M9 21H5a2 2 0 01-2-2v-4m0 0h18" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="2" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    to: '/app/services',
    label: 'Serviços',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    to: '/app/market',
    label: 'Mercado',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    ),
  },
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
  const { alerts } = useAppStore();
  const activeAlertCount = alerts.filter((a) => !a.dismissed).length;
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
        <p className="px-3 pt-3 pb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>Navegação</p>
        {NAV_ITEMS.map((item) => (
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
          --surface: rgba(0,0,0,0.03);
          --border: rgba(0,0,0,0.09);
          --border-strong: rgba(0,0,0,0.18);
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
        /* Bordas claras → bordas escuras suaves */
        [data-theme="light"] [style*="rgba(255,255,255,0.07)"],
        [data-theme="light"] [style*="rgba(255,255,255,0.08)"],
        [data-theme="light"] [style*="rgba(255,255,255,0.09)"],
        [data-theme="light"] [style*="rgba(255,255,255,0.10)"],
        [data-theme="light"] [style*="rgba(255,255,255,0.12)"] {
          border-color: rgba(0,0,0,0.10) !important;
        }
        /* Scrollbar */
        [data-theme="light"] .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); }
        [data-theme="light"] .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.25); }

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
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* TopBar */}
          <header
            className="header-glass flex items-center justify-between px-4 md:px-6 h-16 border-b flex-shrink-0 z-30"
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
                  <div className="absolute top-full left-0 mt-1.5 z-[600] rounded-xl flex flex-col"
                    style={{ background: 'rgba(8,8,9,0.98)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.09)', minWidth: 300, maxHeight: 480, overflowY: 'auto' }}>

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
                  <div className="absolute right-0 top-full mt-2 z-[600] rounded-2xl overflow-hidden flex flex-col"
                    style={{ background: 'rgba(8,8,9,0.98)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.09)', width: 320, maxHeight: 420 }}>
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

          {/* Page Content â€" scrolls correctly on mobile */}
          <main className="flex-1 flex overflow-hidden min-h-0">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
}



