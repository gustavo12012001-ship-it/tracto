import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { supabase } from '../services/supabase';



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
    to: '/app/market',
    label: 'Mercado',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
      </svg>
    ),
  },
];

// â”€â”€ Sidebar content (shared between desktop & mobile drawer) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SidebarContent({ onNavClick, handleLogout }: { onNavClick?: () => void, handleLogout: () => Promise<void> }) {
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
      <div className="px-5 py-5 border-b" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-base font-black tracking-[0.15em] text-white">TRACTO</h1>
        <p className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--muted)' }}>Plataforma AgTech</p>
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
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'var(--primary)', color: '#fff' }}>
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">{userName}</p>
            <p className="text-[10px] truncate" style={{ color: 'var(--muted)' }}>
              {userName === 'Usuário' ? 'Carregando...' : 'Administrador'}
            </p>
          </div>
          <button className="text-slate-600 hover:text-white transition-colors flex-shrink-0">
            <span className="material-symbols-outlined text-base">settings</span>
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

// â”€â”€ Layout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function Layout() {
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const {
    farms,
    fields,
    activeFarmId,
    activeFieldId,
    currentLocation,
    resetStore,
    weatherCache,
    syncFromBackend,
  } = useAppStore();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // Timeout: se backend demorar mais de 5s, continua sem sync
        const timeout = setTimeout(() => {
          useAppStore.setState({ isSyncing: false });
        }, 5000);
        
        syncFromBackend().finally(() => clearTimeout(timeout));

        // Trigger geolocation on mount if not already precise/denied
        const state = useAppStore.getState();
        if (state.locationStatus === 'loading' || state.locationStatus === 'fallback') {
          state.updateGeolocation();
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        syncFromBackend();
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
  const temp = weatherCache ? `${Math.round(weatherCache.temperature)}Â°C` : 'â€”';
  const humidity = weatherCache ? `${weatherCache.humidity}%` : 'â€”';
  const activeFarm = farms.find((farm) => farm.id === activeFarmId) ?? null;
  const activeField = fields.find((field) => field.id === activeFieldId) ?? null;
  const activeContextTitle = activeField ? 'Talhão ativo' : 'Fazenda ativa';
  const activeContextLabel = activeField
    ? `${activeFarm?.name ?? 'Fazenda'} · ${activeField.name ?? 'Talhão'}`
    : activeFarm
      ? activeFarm.name
      : 'Nenhuma fazenda selecionada';


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
        }

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

        {/* â”€â”€ Desktop Sidebar (hidden on mobile) â”€â”€ */}
        <aside className="hidden md:flex w-60 flex-shrink-0 flex-col border-r" style={{ borderColor: 'var(--border)' }}>
          <SidebarContent handleLogout={handleLogout} />
        </aside>

        {/* â”€â”€ Mobile Drawer Overlay â”€â”€ */}
        {drawerOpen && (
          <div className="drawer-overlay md:hidden" onClick={() => setDrawerOpen(false)} />
        )}

        {/* â”€â”€ Mobile Drawer Panel â”€â”€ */}
        <div className={`drawer-panel md:hidden ${drawerOpen ? 'open' : 'closed'}`} style={{ background: 'var(--sidebar)', borderRight: '1px solid var(--border)' }}>
          {/* Close button */}
          <button
            onClick={() => setDrawerOpen(false)}
            className="absolute top-4 right-4 z-50 w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.09)' }}
          >
            <span className="material-symbols-outlined text-sm" style={{ color: '#94a3b8' }}>close</span>
          </button>
          <SidebarContent onNavClick={() => setDrawerOpen(false)} handleLogout={handleLogout} />
        </div>

        {/* â”€â”€ Main Content â”€â”€ */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* TopBar */}
          <header
            className="header-glass flex items-center justify-between px-4 md:px-6 h-14 border-b flex-shrink-0 z-30"
            style={{ borderColor: 'var(--border)' }}
          >
            {/* Left Section: User Location & Operational Context */}
            <div className="flex items-center gap-6">
              {/* Hamburguer â€” mobile only */}
              <button
                onClick={() => setDrawerOpen(true)}
                className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg transition-all"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                aria-label="Abrir menu"
              >
                <span className="material-symbols-outlined text-base" style={{ color: 'var(--muted)' }}>menu</span>
              </button>

              {/* 1. Sua LocalizaÃ§Ã£o (GeogrÃ¡fica) */}
              <div className="flex items-center gap-2 p-1.5 px-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                <span className="material-symbols-outlined text-base" style={{ color: 'var(--primary)' }}>location_on</span>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider leading-none mb-0.5" style={{ color: 'var(--muted)' }}>Sua LocalizaÃ§Ã£o</p>
                  <p className="text-xs font-bold text-white leading-tight truncate max-w-[120px] md:max-w-none">
                    {currentLocation?.name || 'Londrina, PR'}
                  </p>
                </div>
              </div>

              <div className="hidden md:flex items-center gap-2 p-1.5 px-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}>
                <span className="material-symbols-outlined text-base" style={{ color: 'var(--primary)' }}>pin_drop</span>
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider leading-none mb-0.5" style={{ color: 'var(--muted)' }}>{activeContextTitle}</p>
                  <p className="text-xs font-bold text-white leading-tight truncate max-w-[220px]">
                    {activeContextLabel}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Section: Actions & Weather */}
            <div className="flex items-center gap-4">
              {/* Weather Info â€” hidden on mobile */}
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

              {/* Seletor unificado: Fazenda → Talhão */}
              <div className="relative hidden md:flex items-center rounded-lg overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <span className="material-symbols-outlined text-sm pl-3 pointer-events-none" style={{ color: 'var(--primary)' }}>agriculture</span>
                <select
                  className="appearance-none bg-transparent border-none text-white text-[10px] font-bold py-2 pl-2 pr-8 focus:outline-none cursor-pointer"
                  value={activeFieldId || activeFarmId || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    const store = useAppStore.getState();
                    const isField = store.fields.some((f) => f.id === val);
                    if (isField) {
                      store.setActiveField(val);
                      // Navegar para o mapa ao selecionar talhão
                      navigate('/app/dashboard');
                    } else {
                      store.setActiveFarm(val);
                      store.setActiveField(null);
                    }
                  }}
                >
                  {farms.length === 0 ? (
                    <option value="" disabled>NENHUMA FAZENDA</option>
                  ) : (
                    farms.map((farm) => (
                      <optgroup key={farm.id} label={farm.name.toUpperCase()} style={{ background: '#0c0c0e' }}>
                        {fields.filter((field) => field.farm_id === farm.id).length === 0 ? (
                          <option value={farm.id} style={{ background: '#0c0c0e' }}>Sem talhões cadastrados</option>
                        ) : (
                          fields.filter((field) => field.farm_id === farm.id).map((field) => (
                            <option key={field.id} value={field.id} style={{ background: '#0c0c0e' }}>
                              {field.name?.toUpperCase()}
                            </option>
                          ))
                        )}
                      </optgroup>
                    ))
                  )}
                </select>
                <span className="material-symbols-outlined absolute right-2 pointer-events-none text-base" style={{ color: 'var(--muted)' }}>expand_more</span>
              </div>

              {/* Notifications */}
              <button className="relative p-2 rounded-lg transition-all" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <span className="material-symbols-outlined text-base" style={{ color: 'var(--muted)' }}>notifications</span>
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2" style={{ background: '#ef4444', borderColor: 'var(--bg)' }} />
              </button>
            </div>
          </header>

          {/* Page Content â€” scrolls correctly on mobile */}
          <main className="flex-1 flex overflow-hidden min-h-0">
            <Outlet />
          </main>
        </div>
      </div>
    </>
  );
}



