
import React from 'react';
import { Link } from 'react-router-dom';

export default function Reports() {
  return (
    <>
      <style>{`body { font-family: 'Public Sans', sans-serif; }
        .glass-card {
            background: rgba(38, 28, 24, 0.6);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(236, 91, 19, 0.1);
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3d2a22; border-radius: 10px; }`}</style>
      
<div className="flex h-screen overflow-hidden">

<aside className="w-72 bg-[#0d0d0d] border-r border-primary/10 flex flex-col justify-between p-6"><div><div className="mb-10 px-2"><h1 className="text-2xl font-bold tracking-tighter text-white">TRACTO</h1><p className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">Data-Driven AgTech</p></div><nav className="space-y-1"><a className="flex items-center px-3 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" href="#"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg> Mapa / Talhões</a><a className="flex items-center px-3 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" href="#"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg> Meteorologia</a><a className="flex items-center px-3 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" href="#"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg> Chat IA</a><a className="flex items-center px-3 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" href="#"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg> Alertas</a><a className="flex items-center px-3 py-2 text-sm font-medium rounded-lg group bg-primary/10 text-primary" href="#"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg> Relatórios</a></nav></div><div><div className="space-y-6 pt-6 border-t border-gray-800"><div className="flex items-center justify-between"><div className="flex items-center space-x-3"><img alt="Dr. Elena Volkov Avatar" className="h-9 w-9 rounded-full border border-gray-700 bg-gray-800" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB91hP93eYL7nJx00nd_AH-i8IAsI7i2UUrhJ0Bjiw7iR3_fJNWo3jAl-CjRXMJxU2onjIVXmExVLDMUkz6hoywxuH9fmS4aX4NryaK5c7qVJy-5V8nYYxRBXBJBo4jrX-6gUff6zhkPvpWkebZfV9k7QafRT78HuW2zWz-mXl5Fj3e7Y_87aTnPokxEksYBHkjsmoPFxonvxCML7bIt5j_gPPlsmjnbFEQ39eOy9pq5GIPWwAP_agakjVT6h904lyP48mkoaYpZ_c"/><div className="min-w-0"><p className="text-sm font-semibold text-white truncate">Dr. Elena Volkov</p><p className="text-[10px] text-gray-500 truncate">Chief Agronomist</p></div></div><button className="text-gray-500 hover:text-white transition-colors"><span className="material-symbols-outlined text-xl">settings</span></button></div><button className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 text-xs font-bold text-red-400 hover:text-red-300 bg-red-400/5 hover:bg-red-400/10 rounded-lg transition-all border border-red-400/10"><span className="material-symbols-outlined text-sm">logout</span><span className="uppercase tracking-widest">Sair do Portal</span></button></div></div></aside>

<main className="flex-1 flex flex-col overflow-hidden bg-background-dark" style={{"backgroundColor": "#0a0a0a"}}>

<header className="h-16 border-b border-gray-800 flex items-center justify-between px-8" style={{"backgroundColor": "#0a0a0a", "borderBottom": "1px solid rgba(255,255,255,0.05)"}}><div className="flex items-center space-x-6"><div className="flex items-center space-x-3 text-gray-400"><span className="material-symbols-outlined text-xl">location_on</span><div><p className="text-xs font-semibold text-white">Uberlândia, MG</p><p className="text-[10px] uppercase tracking-wider text-gray-500">Localização Atual</p></div></div><div className="flex items-center space-x-3 ml-4"><div className="h-6 w-px bg-gray-800"></div></div><div className="flex items-center space-x-4"><div className="flex items-center space-x-2"><span className="material-symbols-outlined text-primary text-xl">light_mode</span><span className="text-sm font-bold">24°C</span></div><div className="flex items-center space-x-2"><span className="material-symbols-outlined text-blue-400 text-xl">water_drop</span><span className="text-sm font-bold text-gray-300">45%</span></div></div></div><div className="flex items-center space-x-4"><div className="relative flex items-center bg-primary hover:bg-[#d45111] transition-all rounded-lg shadow-lg shadow-orange-900/20"><select className="appearance-none bg-transparent border-none text-white text-xs font-bold py-2 pl-4 pr-10 focus:ring-0 cursor-pointer"><option className="bg-tracto-dark text-white" value="mt">FAZENDA SANTA HELENA</option><option className="bg-tracto-dark text-white" value="mg">GLEBA SUL - MG</option></select><span className="material-symbols-outlined absolute right-3 pointer-events-none text-white text-lg font-bold">expand_more</span></div><button className="flex items-center space-x-2 bg-primary hover:bg-[#d45111] text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg shadow-orange-900/20"><span className="material-symbols-outlined text-sm">add_circle</span><span>NOVO TALHÃO</span></button><button className="p-2 text-gray-400 hover:text-white bg-gray-800/50 rounded-lg relative transition-colors"><span className="material-symbols-outlined text-xl">notifications</span><span className="absolute top-2 right-2 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-tracto-dark"></span></button></div></header>

<div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">

<div className="flex items-end justify-between">
<div>
<h1 className="text-2xl font-bold tracking-tight text-white mb-2">Relatórios</h1>
<p className="text-sm text-slate-500">Análise detalhada de produtividade e índices NDVI por período e talhão.</p>
</div>
<div className="flex gap-2">
<button className="bg-gray-800/50 text-slate-300 hover:bg-gray-800 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border border-white/5 transition-colors"><span className="material-symbols-outlined text-sm">calendar_month</span>
                            Últimos 6 meses
                        </button>
</div>
</div>

<section>
<h2 className="text-lg font-bold text-slate-100 mb-6 flex items-center gap-2"><span className="material-symbols-outlined text-primary text-xl">query_stats</span>Resumo da Safra</h2>
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

<div className="glass-card rounded-2xl p-6 relative overflow-hidden group">
<div className="flex justify-between items-start mb-6">
<div>
<p className="text-sm text-slate-500 font-medium uppercase tracking-wider mb-1">Tendência de Produtividade</p>
<h3 className="text-4xl font-black text-white">4.2 <span className="text-lg font-medium text-slate-500 tracking-normal">t/ha</span></h3>
</div>
<div className="bg-primary/20 text-primary px-2 py-1 rounded-md text-xs font-bold">
                                    +12.5%
                                </div>
</div>

<div className="h-48 w-full mt-4">
<svg className="w-full h-full drop-shadow-[0_0_8px_rgba(236,91,19,0.3)]" viewBox="0 0 500 150">
<defs>
<lineargradient id="grad1" x1="0%" x2="0%" y1="0%" y2="100%">
<stop offset="0%" style={{"stopColor": "rgba(236,91,19,0.3)", "stopOpacity": "1"}}></stop>
<stop offset="100%" style={{"stopColor": "rgba(236,91,19,0)", "stopOpacity": "0"}}></stop>
</lineargradient>
</defs>
<path d="M0,130 L50,110 L100,120 L150,80 L200,90 L250,50 L300,70 L350,30 L400,45 L450,15 L500,25" fill="none" stroke="#ec5b13" strokeLinecap="round" strokeWidth="4"></path>
<path d="M0,130 L50,110 L100,120 L150,80 L200,90 L250,50 L300,70 L350,30 L400,45 L450,15 L500,25 V150 H0 Z" fill="url(#grad1)"></path>
</svg>
</div>
<div className="flex justify-between mt-4 px-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
<span>Jan</span><span>Fev</span><span>Mar</span><span>Abr</span><span>Mai</span><span>Jun</span>
</div>
</div>

<div className="glass-card rounded-2xl p-6 relative overflow-hidden group">
<div className="flex justify-between items-start mb-6">
<div>
<p className="text-sm text-slate-500 font-medium uppercase tracking-wider mb-1">Média de NDVI</p>
<h3 className="text-4xl font-black text-white">0.78 <span className="text-lg font-medium text-slate-500 tracking-normal">score</span></h3>
</div>
<div className="bg-red-500/20 text-red-500 px-2 py-1 rounded-md text-xs font-bold">
                                    -2.1%
                                </div>
</div>
<div className="h-48 w-full mt-4">
<svg className="w-full h-full" viewBox="0 0 500 150">
<defs>
<lineargradient id="grad2" x1="0%" x2="0%" y1="0%" y2="100%">
<stop offset="0%" style={{"stopColor": "rgba(255,255,255,0.1)", "stopOpacity": "1"}}></stop>
<stop offset="100%" style={{"stopColor": "rgba(255,255,255,0)", "stopOpacity": "0"}}></stop>
</lineargradient>
</defs>
<path d="M0,40 L50,45 L100,35 L150,55 L200,65 L250,50 L300,60 L350,75 L400,80 L450,90 L500,85" fill="none" stroke="rgba(255,255,255,0.4)" stroke-dasharray="8,4" strokeWidth="3"></path>
<path d="M0,35 L50,30 L100,40 L150,35 L200,45 L250,40 L300,50 L350,65 L400,75 L450,85 L500,95" fill="none" stroke="#ec5b13" strokeLinecap="round" strokeWidth="4"></path>
<path d="M0,35 L50,30 L100,40 L150,35 L200,45 L250,40 L300,50 L350,65 L400,75 L450,85 L500,95 V150 H0 Z" fill="url(#grad2)"></path>
</svg>
</div>
<div className="flex justify-between mt-4 px-2 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
<span>Jan</span><span>Fev</span><span>Mar</span><span>Abr</span><span>Mai</span><span>Jun</span>
</div>
</div>
</div>
</section>

<section>
<div className="flex items-center justify-between mb-6">
<h2 className="text-lg font-bold text-slate-100 mb-6 flex items-center gap-2"><span className="material-symbols-outlined text-primary text-xl">feed</span>Relatórios Gerados</h2>
<button className="bg-primary/10 text-primary px-4 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-primary/20 transition-all border border-primary/10"><span className="material-symbols-outlined text-sm">filter_alt</span>
                            Filtrar
                        </button>
</div>
<div className="glass-card rounded-2xl overflow-hidden">
<table className="w-full text-left border-collapse">
<thead>
<tr className="bg-zinc-900/50 border-b border-zinc-800">
<th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Nome do Relatório</th>
<th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Data</th>
<th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Talhão</th>
<th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
<th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Ações</th>
</tr>
</thead>
<tbody className="divide-y divide-zinc-900">
<tr className="hover:bg-zinc-900/30 transition-colors group">
<td className="px-6 py-5">
<div className="flex items-center gap-3">
<span className="material-symbols-outlined text-primary">analytics</span>
<span className="font-semibold text-slate-200">Produtividade Semanal - Sul 01</span>
</div>
</td>
<td className="px-6 py-5 text-slate-400 text-sm">12 Out, 2023</td>
<td className="px-6 py-5">
<span className="px-3 py-1 bg-zinc-800 text-slate-300 rounded-full text-xs font-medium">Talhão 04 (Soja)</span>
</td>
<td className="px-6 py-5">
<div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
<span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                                            Processado
                                        </div>
</td>
<td className="px-6 py-5 text-right">
<div className="flex items-center justify-end gap-3">
<button className="w-9 h-9 flex items-center justify-center bg-zinc-900 text-slate-400 hover:text-primary hover:bg-zinc-800 rounded-lg transition-all">
<span className="material-symbols-outlined text-lg">visibility</span>
</button>
<button className="w-9 h-9 flex items-center justify-center bg-zinc-900 text-slate-400 hover:text-primary hover:bg-zinc-800 rounded-lg transition-all">
<span className="material-symbols-outlined text-lg">download</span>
</button>
</div>
</td>
</tr>
<tr className="hover:bg-zinc-900/30 transition-colors group">
<td className="px-6 py-5">
<div className="flex items-center gap-3">
<span className="material-symbols-outlined text-primary">eco</span>
<span className="font-semibold text-slate-200">Análise de Solo &amp; NDVI</span>
</div>
</td>
<td className="px-6 py-5 text-slate-400 text-sm">10 Out, 2023</td>
<td className="px-6 py-5">
<span className="px-3 py-1 bg-zinc-800 text-slate-300 rounded-full text-xs font-medium">Talhão 02 (Arroz)</span>
</td>
<td className="px-6 py-5">
<div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
<span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                            Processado
                                        </div>
</td>
<td className="px-6 py-5 text-right">
<div className="flex items-center justify-end gap-3">
<button className="w-9 h-9 flex items-center justify-center bg-zinc-900 text-slate-400 hover:text-primary hover:bg-zinc-800 rounded-lg transition-all">
<span className="material-symbols-outlined text-lg">visibility</span>
</button>
<button className="w-9 h-9 flex items-center justify-center bg-zinc-900 text-slate-400 hover:text-primary hover:bg-zinc-800 rounded-lg transition-all">
<span className="material-symbols-outlined text-lg">download</span>
</button>
</div>
</td>
</tr>
<tr className="hover:bg-zinc-900/30 transition-colors group">
<td className="px-6 py-5">
<div className="flex items-center gap-3">
<span className="material-symbols-outlined text-primary">water_drop</span>
<span className="font-semibold text-slate-200">Relatório de Stress Hídrico</span>
</div>
</td>
<td className="px-6 py-5 text-slate-400 text-sm">05 Out, 2023</td>
<td className="px-6 py-5">
<span className="px-3 py-1 bg-zinc-800 text-slate-300 rounded-full text-xs font-medium">Todos os Talhões</span>
</td>
<td className="px-6 py-5">
<div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-wider">
<span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
                                            Arquivado
                                        </div>
</td>
<td className="px-6 py-5 text-right">
<div className="flex items-center justify-end gap-3">
<button className="w-9 h-9 flex items-center justify-center bg-zinc-900 text-slate-400 hover:text-primary hover:bg-zinc-800 rounded-lg transition-all">
<span className="material-symbols-outlined text-lg">visibility</span>
</button>
<button className="w-9 h-9 flex items-center justify-center bg-zinc-900 text-slate-400 hover:text-primary hover:bg-zinc-800 rounded-lg transition-all">
<span className="material-symbols-outlined text-lg">download</span>
</button>
</div>
</td>
</tr>
<tr className="hover:bg-zinc-900/30 transition-colors group">
<td className="px-6 py-5">
<div className="flex items-center gap-3">
<span className="material-symbols-outlined text-primary">assessment</span>
<span className="font-semibold text-slate-200">Fechamento de Safra 22/23</span>
</div>
</td>
<td className="px-6 py-5 text-slate-400 text-sm">28 Set, 2023</td>
<td className="px-6 py-5">
<span className="px-3 py-1 bg-zinc-800 text-slate-300 rounded-full text-xs font-medium">Geral Fazenda</span>
</td>
<td className="px-6 py-5">
<div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
<span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                            Processado
                                        </div>
</td>
<td className="px-6 py-5 text-right">
<div className="flex items-center justify-end gap-3">
<button className="w-9 h-9 flex items-center justify-center bg-zinc-900 text-slate-400 hover:text-primary hover:bg-zinc-800 rounded-lg transition-all">
<span className="material-symbols-outlined text-lg">visibility</span>
</button>
<button className="w-9 h-9 flex items-center justify-center bg-zinc-900 text-slate-400 hover:text-primary hover:bg-zinc-800 rounded-lg transition-all">
<span className="material-symbols-outlined text-lg">download</span>
</button>
</div>
</td>
</tr>
</tbody>
</table>
<div className="bg-zinc-900/30 px-6 py-4 border-t border-zinc-900 flex justify-between items-center">
<span className="text-xs text-slate-500 font-medium tracking-wider uppercase">Mostrando 4 de 24 relatórios</span>
<div className="flex gap-2">
<button className="bg-gray-800/50 text-slate-300 hover:bg-gray-800 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border border-white/5 transition-colors"><span className="material-symbols-outlined text-sm">calendar_month</span>
                            Últimos 6 meses
                        </button>
<button className="bg-gray-800/50 text-slate-300 hover:bg-gray-800 px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 border border-white/5 transition-colors"><span className="material-symbols-outlined text-sm">calendar_month</span>
                            Últimos 6 meses
                        </button>
</div>
</div>
</div>
</section>
</div>
</main>
</div>

    </>
  );
}
