import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, ExternalLink } from 'lucide-react';

// --- Utilitários ---
function getCategory(title: string) {
  const t = title.toLowerCase();
  if (t.includes('soja') || t.includes('amendoim') || t.includes('grão') || t.includes('algodão') || t.includes('café') || t.includes('milho')) return { label: 'Grãos', bg: 'bg-emerald-500/20 text-emerald-400' };
  if (t.includes('boi') || t.includes('carne') || t.includes('pecuária') || t.includes('frango') || t.includes('suíno')) return { label: 'Pecuária', bg: 'bg-amber-500/20 text-amber-400' };
  if (t.includes('diesel') || t.includes('frete') || t.includes('logística') || t.includes('corredor')) return { label: 'Logística', bg: 'bg-blue-500/20 text-blue-400' };
  if (t.includes('praga') || t.includes('lagarta') || t.includes('fungo') || t.includes('doença')) return { label: 'Fitossanidade', bg: 'bg-red-500/20 text-red-400' };
  if (t.includes('fertilizante') || t.includes('ureia') || t.includes('potássio')) return { label: 'Insumos', bg: 'bg-purple-500/20 text-purple-400' };
  if (t.includes('clima') || t.includes('chuva') || t.includes('seca') || t.includes('geada')) return { label: 'Clima', bg: 'bg-cyan-500/20 text-cyan-400' };
  return { label: 'Agro', bg: 'bg-slate-700/50 text-slate-300' };
}

function timeAgo(dateString: string) {
  try {
    // Normalizar a data do RSS caso tenha formato inesperado
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const diff = Math.floor((Date.now() - d.getTime()) / 60000); // mins
    if (diff < 1) return `agora mesmo`;
    if (diff < 60) return `há ${diff}min`;
    if (diff < 1440) return `há ${Math.floor(diff/60)}h`;
    return `há ${Math.floor(diff/1440)}d`;
  } catch {
    return dateString;
  }
}

// --- Interfaces ---
interface NewsItem {
  id: string;
  title: string;
  source: string;
  time: string;
  url: string;
  image?: string;
}

interface RssItem {
  guid?: string;
  title?: string;
  pubDate?: string;
  link?: string;
  thumbnail?: string;
  enclosure?: { link?: string };
}

interface RssResponse {
  status?: string;
  items?: RssItem[];
}



// Valores de commodities ref (já que HG/Awesome não cobrem gratuitamente commodities físicas BR)
const STATIC_COMMODITIES = {
  "GRÃOS": [
    { name: 'Soja', place: 'Paranaguá (sc 60kg)', price: '132,50', change: 1.2, pos: 80 },
    { name: 'Milho', place: 'Campinas (sc 60kg)', price: '58,20', change: -0.5, pos: 40 },
    { name: 'Algodão', place: 'ESALQ (@)', price: '142,30', change: 0.8, pos: 60 },
    { name: 'Café Arábica', place: 'BMEF (sc 60kg)', price: '1.045,00', change: 2.1, pos: 90 },
  ],
  "PECUÁRIA": [
    { name: 'Boi Gordo', place: 'SP (@)', price: '235,00', change: 0.4, pos: 70 },
    { name: 'Frango Congelado', place: 'SP (kg)', price: '7,40', change: -0.2, pos: 45 },
    { name: 'Suíno Vivo', place: 'PR (kg)', price: '6,80', change: 0.1, pos: 55 },
  ],
  "INSUMOS": [
    { name: 'Ureia', place: '(ton)', price: '2.100,00', change: -1.5, pos: 30 },
    { name: 'MAP', place: '(ton)', price: '3.450,00', change: 0.0, pos: 50 },
    { name: 'Potássio (KCl)', place: '(ton)', price: '2.800,00', change: 0.5, pos: 65 },
  ],
  "ENERGIA": [
    { name: 'Petróleo WTI', place: '(barril)', price: '82,50', change: 1.1, pos: 75 },
    { name: 'Ouro', place: '(oz)', price: '2.340,00', change: 0.9, pos: 85 },
    { name: 'Etanol Hidratado', place: 'SP (m³)', price: '2.450,00', change: -0.8, pos: 35 },
  ]
};

const TICKER_ITEMS = [
  { name: 'Soja', price: 'R$ 132,50', change: +1.2 },
  { name: 'Milho', price: 'R$ 58,20', change: -0.5 },
  { name: 'Algodão', price: 'R$ 142,30', change: +0.8 },
  { name: 'Café', price: 'R$ 1.045,00', change: +2.1 },
  { name: 'Boi Gordo', price: 'R$ 235,00', change: +0.4 },
  { name: 'Frango', price: 'R$ 7,40', change: -0.2 },
  { name: 'Suíno', price: 'R$ 6,80', change: +0.1 },
  { name: 'Petróleo', price: 'US$ 82,50', change: +1.1 },
  { name: 'Ouro', price: 'US$ 2.340', change: +0.9 },
  { name: 'Ureia', price: 'R$ 2.100', change: -1.5 },
  { name: 'USD', price: 'R$ 4,95', change: -0.3 }, 
  { name: 'EUR', price: 'R$ 5,35', change: +0.2 }, 
  { name: 'GBP', price: 'R$ 6,24', change: +0.4 }, 
];

export default function Market() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // BLOCO 2 — Notícias via RSS
  const fetchNews = async () => {
    try {
      const rssUrl = 'https://www.canalrural.com.br/feed/';
      const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`);
      const data = await res.json() as RssResponse;
      if (data.status === 'ok' && data.items) {
        const formattedNews = data.items.slice(0, 5).map((item, index) => ({
          id: item.guid ?? `${item.link ?? 'news'}-${index}`,
          title: item.title ?? 'Sem título',
          source: 'Canal Rural',
          time: timeAgo(item.pubDate ?? ''),
          url: item.link ?? '#',
          // A API rss2json costuma extrair thumbnail/enclosure
          image: item.thumbnail || item.enclosure?.link || undefined
        }));
        setNews(formattedNews);
        setLastUpdate(new Date());
      }
    } catch (e) {
      console.error('Erro ao buscar notícias RSS:', e);
    }
  };



  useEffect(() => {
    const initialFetch = window.setTimeout(() => {
      void fetchNews();
    }, 0);
    
    // Updates
    const inv1 = window.setInterval(() => {
      void fetchNews();
    }, 5 * 60 * 1000); // 5 mins
    
    return () => {
      window.clearTimeout(initialFetch);
      window.clearInterval(inv1);
    };
  }, []);

  const topNews = news[0];
  const gridNews = news.slice(1, 5);

  return (
    <div className="min-h-screen font-sans pb-16 overflow-x-hidden selection:bg-orange-500/30" style={{ background: '#080809' }}>
      
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-wrap {
          width: 200%;
          display: flex;
          animation: marquee 30s linear infinite;
        }
        .ticker-wrap:hover {
          animation-play-state: paused;
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .glass-panel {
          background: rgba(255,255,255,0.02);
          border: 0.5px solid rgba(255,255,255,0.08);
        }
      `}</style>

      {/* BLOCO 1 — TICKER ANIMADO */}
      <div 
        className="w-full relative overflow-hidden flex items-center h-10 select-none"
        style={{ background: 'rgba(236,91,19,0.08)', borderBottom: '1px solid rgba(236,91,19,0.2)' }}
      >
        <div className="ticker-wrap absolute flex whitespace-nowrap">
          {/* Ticker duplo para animação contínua */}
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <div key={i} className="flex items-center mx-6 gap-2 text-xs font-semibold">
              <span className="text-slate-300">{item.name}</span>
              <span className="text-white">{item.price}</span>
              <span className={`flex items-center gap-0.5 ${item.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {item.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(item.change).toFixed(2)}%
              </span>
              <span className="mx-4 text-slate-600 font-normal">·</span>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-10">
        
        {/* CABEÇALHO */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white mb-1">Mercado Financeiro</h1>
            <p className="text-slate-400 text-sm">Cotações e análises do agronegócio em tempo real</p>
          </div>
          <div className="flex items-center justify-between md:justify-end gap-4">
            <p className="text-xs text-slate-500 font-medium flex items-center gap-2">
              <span className="relative flex w-2 h-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full w-2 h-2 bg-green-500"></span>
              </span>
              Atualizado às {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>

        {/* 3 Colunas: Esquerda (2/3) Notícias | Direita (1/3) Painel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* BLOCO 2 — NOTÍCIAS */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Destaque Principal */}
            {topNews ? (
              <a 
                href={topNews.url} target="_blank" rel="noopener noreferrer"
                className="group relative block rounded-2xl overflow-hidden h-[400px] transition-transform duration-200 hover:-translate-y-1 glass-panel"
              >
                {topNews.image ? (
                  <img src={topNews.image} alt={topNews.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                ) : (
                  <div className="absolute inset-0 w-full h-full flex items-center justify-center transition-transform duration-700 group-hover:scale-105" style={{ background: 'linear-gradient(135deg, #0f2617 0%, #1a3d20 30%, #2d5a27 60%, #1c3a18 100%)' }}>
                    <span className="material-symbols-outlined text-[80px] text-white/20">agriculture</span>
                  </div>
                )}
                
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
                
                <div className="absolute bottom-0 left-0 p-8 w-full">
                  <div className="flex items-center gap-3 mb-4">
                    <span className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] rounded ${getCategory(topNews.title).bg}`}>
                      {getCategory(topNews.title).label}
                    </span>
                    <span className="text-xs text-slate-300 font-medium">{topNews.time}</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-white leading-snug group-hover:text-[#ec5b13] transition-colors line-clamp-2">
                    {topNews.title}
                  </h2>
                  <p className="text-xs text-slate-400 mt-4 flex items-center gap-1.5 font-medium tracking-wide">
                    {topNews.source}
                    <ExternalLink className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </p>
                </div>
              </a>
            ) : (
              <div className="h-[400px] rounded-2xl animate-pulse glass-panel" />
            )}

            {/* Grid Secundário: 2x2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {gridNews.length > 0 ? gridNews.map(item => (
                <a 
                  key={item.id} 
                  href={item.url} target="_blank" rel="noopener noreferrer"
                  className="group flex flex-col rounded-2xl overflow-hidden transition-transform duration-200 hover:-translate-y-1 glass-panel"
                >
                  <div className="h-44 relative overflow-hidden">
                    {item.image ? (
                      <img src={item.image} alt={item.title} className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    ) : (
                      <div className="absolute inset-0 w-full h-full flex items-center justify-center transition-transform duration-700 group-hover:scale-105" style={{ background: 'linear-gradient(135deg, #0f2617 0%, #1a3d20 30%, #2d5a27 60%, #1c3a18 100%)' }}>
                        <span className="material-symbols-outlined text-[60px] text-white/20">agriculture</span>
                      </div>
                    )}
                  </div>
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                        <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest rounded ${getCategory(item.title).bg}`}>
                            {getCategory(item.title).label}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">{item.time}</span>
                        </div>
                        <h3 className="text-sm font-bold text-slate-100 leading-snug line-clamp-2 group-hover:text-[#ec5b13] transition-colors mb-4">
                        {item.title}
                        </h3>
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">
                        {item.source}
                    </p>
                  </div>
                </a>
              )) : (
                 Array(4).fill(0).map((_, i) => <div key={i} className="h-64 rounded-2xl animate-pulse glass-panel" />)
              )}
            </div>
          </div>

          {/* BLOCO 3 — PAINEL DE PREÇOS */}
          <div className="lg:col-span-1 flex flex-col gap-8">
            
            {Object.entries(STATIC_COMMODITIES).map(([cat, items]) => (
              <div key={cat} className="space-y-4">
                <h3 className="text-[10px] font-bold text-[#ec5b13] uppercase tracking-[0.2em] pl-1 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ec5b13]"></span>
                  {cat}
                </h3>
                <div className="flex flex-col gap-3">
                  {items.map(item => (
                    <div 
                      key={item.name} 
                      className="group p-4 rounded-xl relative overflow-hidden transition-all duration-200 hover:border-[#ec5b13] glass-panel"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                            {item.name} 
                            <span className="text-[9px] font-medium text-slate-500 uppercase px-1.5 py-0.5 bg-slate-800/50 rounded" title="Preço de Referência Base">(ref.)</span>
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{item.place}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-bold text-white tracking-tight mb-0.5">R$ {item.price}</p>
                          <p className={`text-[10px] font-bold flex items-center justify-end gap-0.5 ${item.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {item.change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                            {item.change > 0 ? '+' : ''}{item.change.toFixed(2)}%
                          </p>
                        </div>
                      </div>
                      
                      {/* Bar indicator */}
                      <div className="h-1 w-full bg-slate-800/50 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-1000"
                          style={{ 
                            width: `${item.pos}%`, 
                            background: item.change >= 0 ? '#4ade80' : '#f87171' 
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

          </div>
        </div>



      </div>
    </div>
  );
}
