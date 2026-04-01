
import React from 'react';
import { Link } from 'react-router-dom';

export default function Chat() {
  return (
    <>
      <style>{`
        body { font-family: 'Public Sans', sans-serif; }
        .glass-panel {
            background: rgba(255, 255, 255, 0.03);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
    `}</style>
      
<div className="flex h-screen w-full">

<aside className="w-64 border-r border-gray-800 flex flex-col justify-between py-6 px-4" data-purpose="main-navigation" style={{"backgroundColor": "#0d0d0d"}}><div><div className="mb-10 px-2"><h1 className="text-2xl font-bold tracking-tighter text-white">TRACTO</h1><p className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">Data-Driven AgTech</p></div><nav className="space-y-1"><a className="flex items-center px-3 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" href="#"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg> Mapa / Talhões</a><a className="flex items-center px-3 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" href="#"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg> Meteorologia</a><a className="flex items-center px-3 py-2 text-sm font-medium rounded-lg group bg-primary/10 text-primary" href="#"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg> Chat IA<span className="flex items-center space-x-2 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all"></span></a><a className="flex items-center px-3 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" href="#"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg> Alertas</a><a className="flex items-center px-3 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" href="#"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg> Relatórios</a></nav></div><div><div className="space-y-6 pt-6 border-t border-gray-800"><div className="flex items-center justify-between"><div className="flex items-center space-x-3"><img alt="Dr. Elena Volkov Avatar" className="h-9 w-9 rounded-full border border-gray-700 bg-gray-800" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB91hP93eYL7nJx00nd_AH-i8IAsI7i2UUrhJ0Bjiw7iR3_fJNWo3jAl-CjRXMJxU2onjIVXmExVLDMUkz6hoywxuH9fmS4aX4NryaK5c7qVJy-5V8nYYxRBXBJBo4jrX-6gUff6zhkPvpWkebZfV9k7QafRT78HuW2zWz-mXl5Fj3e7Y_87aTnPokxEksYBHkjsmoPFxonvxCML7bIt5j_gPPlsmjnbFEQ39eOy9pq5GIPWwAP_agakjVT6h904lyP48mkoaYpZ_c"/><div className="min-w-0"><p className="text-sm font-semibold text-white truncate">Dr. Elena Volkov</p><p className="text-[10px] text-gray-500 truncate">Chief Agronomist</p></div></div><button className="text-gray-500 hover:text-white transition-colors"><span className="material-symbols-outlined text-xl">settings</span></button></div><button className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 text-xs font-bold text-red-400 hover:text-red-300 bg-red-400/5 hover:bg-red-400/10 rounded-lg transition-all border border-red-400/10"><span className="material-symbols-outlined text-sm">logout</span><span className="uppercase tracking-widest">Sair do Portal</span></button></div></div></aside>

<main className="flex-grow flex flex-col bg-[#121212]" style={{"backgroundColor": "#0a0a0a"}}>

<header className="h-16 border-b border-gray-800 flex items-center justify-between px-8" data-purpose="top-header" style={{"backgroundColor": "#0a0a0a", "borderBottom": "1px solid rgba(255,255,255,0.05)"}}><div className="flex items-center space-x-6"><div className="flex items-center space-x-3 text-gray-400"><span className="material-symbols-outlined text-xl">location_on</span><div><p className="text-xs font-semibold text-white">Londrina, PR</p><p className="text-[10px] uppercase tracking-wider text-gray-500">Localização Atual</p></div></div><div className="flex items-center space-x-3 ml-4"><div className="h-6 w-px bg-gray-800"></div></div><div className="flex items-center space-x-4"><div className="flex items-center space-x-2"><span className="material-symbols-outlined text-tracto-orange text-xl">light_mode</span><span className="text-sm font-bold">28°C</span></div><div className="flex items-center space-x-2"><span className="material-symbols-outlined text-blue-400 text-xl">water_drop</span><span className="text-sm font-bold text-gray-300">62%</span></div></div></div><div className="flex items-center space-x-4"><div className="relative flex items-center bg-primary hover:bg-[#d45111] transition-all rounded-lg shadow-lg shadow-orange-900/20"><select className="appearance-none bg-transparent border-none text-white text-xs font-bold py-2 pl-4 pr-10 focus:ring-0 cursor-pointer"><option className="bg-tracto-dark text-white" value="mt">FAZENDA MATO GROSSO</option><option className="bg-tracto-dark text-white" value="mg">GLEBA SUL - MG</option><option className="bg-tracto-dark text-white" value="sp">RECANTO DOS IPÊS - SP</option></select><span className="material-symbols-outlined absolute right-3 pointer-events-none text-white text-lg font-bold">expand_more</span></div><button className="flex items-center space-x-2 bg-primary hover:bg-[#d45111] text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg shadow-orange-900/20"><span className="material-symbols-outlined text-sm">add_circle</span><span>NOVO TALHÃO</span></button><button className="p-2 text-gray-400 hover:text-white bg-gray-800/50 rounded-lg relative transition-colors"><span className="material-symbols-outlined">notifications</span><span className="absolute top-2 right-2 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-tracto-dark"></span></button></div></header>

<div className="flex flex-grow overflow-hidden">

<div className="w-80 flex flex-col border-r border-gray-800 bg-tracto-dark/50">
<div className="p-4 border-b border-white/5">
<button className="w-full flex items-center justify-between px-4 py-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
<span className="text-sm font-semibold">Nova Conversa</span>
<span className="material-symbols-outlined">add_comment</span>
</button>
</div>
<div className="flex-grow overflow-y-auto custom-scrollbar p-2">
<div className="px-2 py-4">
<p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4 px-2">Conversas Recentes</p>
<div className="space-y-1">
<div className="px-3 py-4 bg-primary/5 rounded-xl border border-primary/20 cursor-pointer"><h4 className="text-sm font-medium text-primary">Análise de Solo Talhão 02</h4><p className="text-xs text-gray-500 mt-1">Há 2 horas • Recomendações...</p></div>
<div className="px-3 py-4 hover:bg-white/5 rounded-xl cursor-pointer transition-colors">
<h4 className="text-sm font-medium text-slate-300">Risco de Geada v1</h4>
<p className="text-xs text-slate-500 mt-1">Ontem • Dados climáticos</p>
</div>
<div className="px-3 py-4 hover:bg-white/5 rounded-xl cursor-pointer transition-colors">
<h4 className="text-sm font-medium text-slate-300">Produtividade Milho 2024</h4>
<p className="text-xs text-slate-500 mt-1">3 dias atrás • Projeção</p>
</div>
</div>
</div>
</div>
</div>

<div className="flex-grow flex flex-col relative">

<div className="p-6 border-b border-white/5 flex items-center justify-between glass-panel bg-tracto-dark border-gray-800">
<div className="flex items-center gap-3">
<div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
<span className="material-symbols-outlined">smart_toy</span>
</div>
<div>
<h2 className="text-lg font-bold">Tracto AI</h2>
<p className="text-xs font-medium flex items-center gap-1">
<span className="w-1.5 h-1.5 rounded-full animate-pulse bg-primary"></span>
                                    Analista Agronômico Ativo
                                </p>
</div>
</div>
<div className="flex gap-2">
<button className="p-2 hover:bg-white/5 rounded-lg text-slate-400"><span className="material-symbols-outlined">share</span></button>
<button className="p-2 hover:bg-white/5 rounded-lg text-slate-400"><span className="material-symbols-outlined">more_vert</span></button>
</div>
</div>

<div className="flex-grow overflow-y-auto custom-scrollbar p-8 space-y-8">

<div className="flex gap-4 max-w-4xl">
<div className="flex items-center space-x-2 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all">
<span className="material-symbols-outlined text-background-dark text-sm font-bold">bolt</span>
</div>
<div className="space-y-4 flex-grow">
<div className="glass-panel p-6 rounded-2xl rounded-tl-none space-y-4">
<p className="text-sm leading-relaxed text-slate-200">
                                        Olá! Analisei os dados laboratoriais mais recentes do **Talhão 02**. Notei uma deficiência moderada de potássio na camada superficial (0-20cm).
                                    </p>

<div className="grid grid-cols-2 gap-4 mt-4">
<div className="rounded-xl overflow-hidden border border-white/10 bg-black/40 h-48 relative">
<div className="absolute inset-0 opacity-60" data-alt="Satellite thermal map of a farm field" data-location="Londrina, Brazil" style={{"backgroundImage": "url('https", "backgroundSize": "cover"}}></div>
<div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
<div className="absolute bottom-3 left-3">
<p className="material-symbols-outlined">Índice NDVI</p>
<p className="text-xs font-medium">Variação por Talhão</p>
</div>
</div>
<div className="rounded-xl overflow-hidden border border-white/10 bg-black/40 h-48 p-4 flex flex-col justify-between">
<div>
<p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recomendação</p>
<h4 className="text-xl font-bold mt-1">240 kg/ha</h4>
<p className="text-xs text-slate-500 mt-1">Cloreto de Potássio (KCl)</p>
</div>
<div className="flex items-end justify-between">
<div className="flex gap-1">
<div className="w-1.5 h-6 bg-primary/20 rounded-full"></div>
<div className="w-1.5 h-10 bg-primary/40 rounded-full"></div>
<div className="w-1.5 h-14 bg-primary rounded-full"></div>
</div>
<span className="text-[10px] font-bold">+12% ROI Est.</span>
</div>
</div>
</div>
<ul className="space-y-2 pt-2">
<li className="flex items-start gap-2 text-sm text-slate-300">
<span className="material-symbols-outlined text-primary">check_circle</span>
                                            Aplicação recomendada em taxa variável.
                                        </li>
<li className="flex items-start gap-2 text-sm text-slate-300">
<span className="material-symbols-outlined text-primary">check_circle</span>
                                            Janela ideal de aplicação: Próximos 5 dias (janela seca).
                                        </li>
</ul>
</div>
<span className="text-[10px] text-slate-600 font-medium ml-2 uppercase tracking-tighter">Tracto AI • 14:32</span>
</div>
</div>

<div className="flex gap-4 max-w-4xl ml-auto flex-row-reverse">
<div className="w-8 h-8 rounded-lg bg-white/10 flex-shrink-0 flex items-center justify-center">
<span className="material-symbols-outlined text-slate-400 text-sm">person</span>
</div>
<div className="flex flex-col items-end">
<div className="bg-white/5 border border-white/10 p-4 rounded-2xl rounded-tr-none">
<p className="text-sm text-slate-200 leading-relaxed">
                                        Qual o impacto esperado na produtividade se eu adiar essa aplicação por 15 dias?
                                    </p>
</div>
<span className="text-[10px] text-slate-600 font-medium mr-2 mt-2 uppercase tracking-tighter">Você • 14:35</span>
</div>
</div>

<div className="flex gap-4 max-w-4xl">
<div className="flex items-center space-x-2 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all">
<span className="material-symbols-outlined text-background-dark text-sm font-bold">bolt</span>
</div>
<div className="flex items-center gap-1.5 px-6 py-4 glass-panel rounded-2xl rounded-tl-none">
<div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce"></div>
<div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
<div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
</div>
</div>
</div>

<div className="p-6">
<div className="max-w-4xl mx-auto relative flex items-center gap-4 bg-surface-dark/80 backdrop-blur-xl border border-white/10 p-2 pl-4 rounded-2xl shadow-2xl">
<button className="p-2 text-slate-500 hover:text-slate-300 transition-colors">
<span className="material-symbols-outlined">attach_file</span>
</button>
<input className="flex-grow bg-transparent border-none focus:ring-0 text-sm py-3 text-slate-200 placeholder:text-slate-600" placeholder="Pergunte à Tracto AI sobre sua lavoura..." type="text"/>
<button className="flex items-center space-x-2 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all">
<span className="material-symbols-outlined font-bold">arrow_upward</span>
</button>
</div>
<p className="text-center text-[10px] text-slate-600 mt-4 uppercase tracking-[0.2em] font-medium">
                            Tracto AI - Inteligência Proprietária para Agronegócio
                        </p>
</div>
</div>
</div>
</main>
</div>

    </>
  );
}
