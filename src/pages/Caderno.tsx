import { useState } from 'react';
import FieldLog from './FieldLog';
import SoilData from './SoilData';
import Seasons from './Seasons';
import Calculator from './Calculator';

type CadernoTab = 'diario' | 'solo' | 'safras' | 'calculadora';

const TABS: { id: CadernoTab; label: string; icon: string }[] = [
  { id: 'diario',      label: 'Diário de Campo',   icon: 'menu_book'  },
  { id: 'solo',        label: 'Solo & Adubação',   icon: 'science'    },
  { id: 'safras',      label: 'Safras',             icon: 'grass'      },
  { id: 'calculadora', label: 'Calculadora',        icon: 'calculate'  },
];

export default function Caderno() {
  const [activeTab, setActiveTab] = useState<CadernoTab>('diario');

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--bg)' }}>

      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-1 px-4 py-2 flex-shrink-0 overflow-x-auto scrollbar-thin"
        style={{ background: 'var(--sidebar)', borderBottom: '1px solid var(--border)' }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all"
            style={
              activeTab === tab.id
                ? { background: 'var(--primary-dim)', color: 'var(--primary)', border: '1px solid var(--primary-border)' }
                : { color: 'var(--muted)', border: '1px solid transparent' }
            }
          >
            <span className="material-symbols-outlined text-sm">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Content — all tabs kept mounted to preserve state ───────────────── */}
      <div style={{ display: activeTab === 'diario'      ? 'flex' : 'none', flex: 1, minHeight: 0, overflow: 'hidden', flexDirection: 'column' }}>
        <FieldLog />
      </div>
      <div style={{ display: activeTab === 'solo'        ? 'flex' : 'none', flex: 1, minHeight: 0, overflow: 'hidden', flexDirection: 'column' }}>
        <SoilData />
      </div>
      <div style={{ display: activeTab === 'safras'      ? 'flex' : 'none', flex: 1, minHeight: 0, overflow: 'hidden', flexDirection: 'column' }}>
        <Seasons />
      </div>
      <div style={{ display: activeTab === 'calculadora' ? 'flex' : 'none', flex: 1, minHeight: 0, overflow: 'hidden', flexDirection: 'column' }}>
        <Calculator />
      </div>

    </div>
  );
}
