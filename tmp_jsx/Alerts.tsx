<!DOCTYPE html>

<html className="dark" lang="pt-BR"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Tracto - Alertas de Campo</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@300;400;500;600;700&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script id="tailwind-config">
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        "primary": "#ec5b13",
                        "background-light": "#f8f6f6",
                        "background-dark": "#1a1310",
                        "slate-card": "#261c18",
                    },
                    fontFamily: {
                        "display": ["Public Sans"]
                    },
                    borderRadius: {"DEFAULT": "0.25rem", "lg": "0.5rem", "xl": "0.75rem", "full": "9999px"},
                },
            },
        }
    </script>
<style>{
        body { font-family: 'Public Sans', sans-serif; }
        .glass-card {
            background: rgba(38, 28, 24, 0.6);
            backdrop-filter: blur(12px);
            border: 1px solid rgba(236, 91, 19, 0.1);
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #3d2a22; border-radius: 10px; }
    }</style>
</head>
<body className="bg-background-light dark:bg-background-dark text-slate-900 dark:text-slate-100 antialiased overflow-hidden">
<div className="flex h-screen w-full">
<!-- Sidebar -->
<aside className="w-72 bg-[#140e0b] border-r border-primary/10 flex flex-col justify-between p-6" style="background-color: #0d0d0d;"><div><div className="mb-10 px-2"><h1 className="text-2xl font-bold tracking-tighter text-white">TRACTO</h1><p className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">Data-Driven AgTech</p></div><nav className="space-y-1"><a className="flex items-center px-3 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" href="#"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewbox="0 0 24 24"><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg> Mapa / Talhões</a><a className="flex items-center px-3 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" href="#"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewbox="0 0 24 24"><path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg> Meteorologia</a><a className="flex items-center px-3 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" href="#"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewbox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg> Chat IA</a><a className="flex items-center px-3 py-2 text-sm font-medium rounded-lg group bg-primary/10 text-primary" href="#"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewbox="0 0 24 24"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg> Alertas</a><a className="flex items-center px-3 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" href="#"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewbox="0 0 24 24"><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg> Relatórios</a></nav></div><div><div className="space-y-6 pt-6 border-t border-gray-800"><div className="flex items-center justify-between"><div className="flex items-center space-x-3"><img alt="Dr. Elena Volkov Avatar" className="h-9 w-9 rounded-full border border-gray-700 bg-gray-800" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB91hP93eYL7nJx00nd_AH-i8IAsI7i2UUrhJ0Bjiw7iR3_fJNWo3jAl-CjRXMJxU2onjIVXmExVLDMUkz6hoywxuH9fmS4aX4NryaK5c7qVJy-5V8nYYxRBXBJBo4jrX-6gUff6zhkPvpWkebZfV9k7QafRT78HuW2zWz-mXl5Fj3e7Y_87aTnPokxEksYBHkjsmoPFxonvxCML7bIt5j_gPPlsmjnbFEQ39eOy9pq5GIPWwAP_agakjVT6h904lyP48mkoaYpZ_c"/><div className="min-w-0"><p className="text-sm font-semibold text-white truncate">Dr. Elena Volkov</p><p className="text-[10px] text-gray-500 truncate">Chief Agronomist</p></div></div><button className="text-gray-500 hover:text-white transition-colors"><span className="material-symbols-outlined text-xl">settings</span></button></div><button className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 text-xs font-bold text-red-400 hover:text-red-300 bg-red-400/5 hover:bg-red-400/10 rounded-lg transition-all border border-red-400/10"><span className="material-symbols-outlined text-sm">logout</span><span className="uppercase tracking-widest">Sair do Portal</span></button></div></div></aside>
<!-- Main Content Area -->
<main className="flex-1 flex flex-col overflow-hidden bg-background-dark" style="background-color: #0a0a0a;">
<!-- Header -->
<header className="h-16 border-b border-gray-800 flex items-center justify-between px-8" data-purpose="top-header" style="background-color: #0a0a0a; border-bottom: 1px solid rgba(255,255,255,0.05);"><div className="flex items-center space-x-6"><div className="flex items-center space-x-3 text-gray-400"><span className="material-symbols-outlined text-xl">location_on</span><div><p className="text-xs font-semibold text-white">Londrina, PR</p><p className="text-[10px] uppercase tracking-wider text-gray-500">Localização Atual</p></div></div><div className="flex items-center space-x-3 ml-4"><div className="h-6 w-px bg-gray-800"></div></div><div className="flex items-center space-x-4"><div className="flex items-center space-x-2"><span className="material-symbols-outlined text-primary text-xl">light_mode</span><span className="text-sm font-bold">28°C</span></div><div className="flex items-center space-x-2"><span className="material-symbols-outlined text-blue-400 text-xl">water_drop</span><span className="text-sm font-bold text-gray-300">62%</span></div></div></div><div className="flex items-center space-x-4"><div className="relative flex items-center bg-primary hover:bg-[#d45111] transition-all rounded-lg shadow-lg shadow-orange-900/20"><select className="appearance-none bg-transparent border-none text-white text-xs font-bold py-2 pl-4 pr-10 focus:ring-0 cursor-pointer"><option className="bg-tracto-dark text-white" value="mt">FAZENDA MATO GROSSO</option><option className="bg-tracto-dark text-white" value="mg">GLEBA SUL - MG</option><option className="bg-tracto-dark text-white" value="sp">RECANTO DOS IPÊS - SP</option></select><span className="material-symbols-outlined absolute right-3 pointer-events-none text-white text-lg font-bold">expand_more</span></div><button className="flex items-center space-x-2 bg-primary hover:bg-[#d45111] text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg shadow-orange-900/20"><span className="material-symbols-outlined text-sm">add_circle</span><span>NOVO TALHÃO</span></button><button className="p-2 text-gray-400 hover:text-white bg-gray-800/50 rounded-lg relative transition-colors"><span className="material-symbols-outlined">notifications</span><span className="absolute top-2 right-2 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-tracto-dark"></span></button></div></header>
<!-- Alerts Content -->
<div className="flex-1 overflow-y-auto custom-scrollbar p-10">
<!-- Status Row -->
<div className="flex gap-4 mb-8">
<button className="glass-card rounded-xl overflow-hidden flex items-stretch border-l-4 border-primary">
<div className="flex items-center gap-4">
<div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center"><span className="material-symbols-outlined text-primary">warning</span></div>
<div>
<p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Críticos</p>
<p className="text-2xl font-bold text-slate-100">02</p>
</div>
</div>
<span className="material-symbols-outlined text-slate-600">chevron_right</span>
</button>
<button className="glass-card rounded-xl overflow-hidden flex items-stretch border-l-4 border-primary">
<div className="flex items-center gap-4">
<div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center"><span className="material-symbols-outlined text-primary">warning</span></div>
<div>
<p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Avisos</p>
<p className="text-2xl font-bold text-slate-100">02</p>
</div>
</div>
<span className="material-symbols-outlined text-slate-600">chevron_right</span>
</button>
<button className="glass-card rounded-xl overflow-hidden flex items-stretch border-l-4 border-primary">
<div className="flex items-center gap-4">
<div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center"><span className="material-symbols-outlined text-primary">warning</span></div>
<div>
<p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Informativos</p>
<p className="text-2xl font-bold text-slate-100">02</p>
</div>
</div>
<span className="material-symbols-outlined text-slate-600">chevron_right</span>
</button>
</div>
<h3 className="text-slate-100 font-bold mb-6 flex items-center gap-2">
<span className="material-symbols-outlined text-primary text-xl font-variation-fill-1">feed</span>
                    Feed de Atividades em Tempo Real
                </h3>
<!-- Alerts Grid/List -->
<div className="grid grid-cols-1 gap-4">
<!-- Alert: Frost Risk (Critical) -->
<div className="glass-card rounded-xl overflow-hidden flex items-stretch border-l-4 border-primary">
<div className="w-48 bg-cover bg-center shrink-0" data-alt="Satellite imagery showing temperature gradient for frost prediction" style="background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuCDjc_X0LxRUZlbmcusNSwssyFP7Bwl7qJM3j3UJR1Yj9CC74HJbsPdaGpUt6MiGTIftUjbWwDVEJw0f8B0Ksg68nszYhCiEWg_GFT63ToETJ1Q2SBeqig1i3nhKPJZPnL9H7uf9lUijehvkYgM36sNDvEqskJtMOQqQsDQfjaTFUhkYfV_dyfMclxa7TQhq8AgwPmzfOvN8MJpnKc80jb-xFe8sJ18mt6qbekLuCE7N_tvzDxl3RwApayIFdDKdjVvvTRssCDkyWE')"></div>
<div className="p-6 flex-1 flex flex-col justify-between">
<div className="flex justify-between items-start">
<div>
<div className="flex items-center gap-2 mb-1">
<span className="px-2 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded uppercase">ALERTA</span>
<span className="text-slate-500 text-[11px] font-medium tracking-tight">ID: #4492 • Hoje, 05:30h</span>
</div>
<h4 className="text-slate-100 text-lg font-bold">Risco Iminente de Geada Severa</h4>
<p className="text-slate-400 text-sm mt-2 max-w-2xl">
                                        Detectada queda brusca de temperatura no <span className="text-slate-200 font-semibold">Talhão Sul (Setor 04)</span>. 
                                        Previsão de 1.5°C às 03:00h da madrugada. Recomendamos acionamento imediato de protocolos de proteção térmica e irrigação preventiva.
                                    </p>
</div>
<div className="text-right">
<div className="flex flex-col items-end">
<span className="text-red-500 text-2xl font-bold">1.5°C</span>
<span className="text-slate-500 text-[10px] font-bold uppercase">Temp. Prevista</span>
</div>
</div>
</div>
<div className="flex items-center justify-between mt-6 pt-4 border-t border-primary/5">
<div className="flex items-center gap-6">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-primary text-sm">water_drop</span>
<span className="text-slate-300 text-xs font-medium">Umidade: 78%</span>
</div>
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-primary text-sm">air</span>
<span className="text-slate-300 text-xs font-medium">Vento: 4km/h NO</span>
</div>
</div>
<div className="flex gap-2">
<button className="px-4 py-2 rounded-lg bg-slate-card text-slate-300 text-xs font-bold border border-primary/10 hover:bg-primary/5">Ignorar</button>
<button className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:bg-orange-600 shadow-lg shadow-primary/20">Ver Detalhes do Talhão</button>
</div>
</div>
</div>
</div>
<!-- Alert: Pest Detection (Warning) -->
<div className="glass-card rounded-xl overflow-hidden flex items-stretch border-l-4 border-primary">
<div className="w-48 bg-cover bg-center shrink-0" data-alt="Macro view of pest damage on soybean leaves detected by drone" style="background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuCE3DfRWN3zxvQXAFotrlmQe0Q0vMdfoXrHUQckCpZg6hqKEjbPbs-rl4-dHbT8p4J05WYp7zjPOpTtSkm7E3WVvOeS5FAl2HMsEN1PvT00u8moFQw0ysK_NGQc9LbgIUKiq7Bm1kJM4aeQHkGM3jgU0I4i8mhJ1XEr1wM7QrTiyunPJsdrOjH5T_g-PyY6YhHlMqVTWfEMkfFcvigDOnswi97NUTES14OFNjmj7-O39wjdaYp6TvC-IQB0nll23T391scynQjjb9g')"></div>
<div className="p-6 flex-1 flex flex-col justify-between">
<div className="flex justify-between items-start">
<div>
<div className="flex items-center gap-2 mb-1">
<span className="px-2 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded uppercase">ALERTA</span>
<span className="text-slate-500 text-[11px] font-medium tracking-tight">ID: #4489 • Ontem, 16:45h</span>
</div>
<h4 className="text-slate-100 text-lg font-bold">Detecção de Pragas (Spodoptera frugiperda)</h4>
<p className="text-slate-400 text-sm mt-2 max-w-2xl">
                                        Imagens de drone detectaram manchas de infestação de lagarta-do-cartucho acima do limiar econômico no <span className="text-slate-200 font-semibold">Talhão Leste</span>. 
                                        Incidência estimada em 12% da área total monitorada.
                                    </p>
</div>
<div className="text-right">
<div className="flex flex-col items-end">
<span className="text-amber-500 text-2xl font-bold">12%</span>
<span className="text-slate-500 text-[10px] font-bold uppercase">Incidência</span>
</div>
</div>
</div>
<div className="flex items-center justify-between mt-6 pt-4 border-t border-primary/5">
<div className="flex items-center gap-6">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-primary text-sm">grid_view</span>
<span className="text-slate-300 text-xs font-medium">Área: 45ha afetados</span>
</div>
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-primary text-sm">map</span>
<span className="text-slate-300 text-xs font-medium">Mapa de Calor Gerado</span>
</div>
</div>
<div className="flex gap-2">
<button className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:bg-orange-600 shadow-lg shadow-primary/20 flex items-center gap-2">
<span className="material-symbols-outlined text-sm font-bold">map</span>
                                        Abrir Mapa de Calor
                                    </button>
</div>
</div>
</div>
</div>
<!-- Alert: Soil Moisture (Warning) -->
<div className="glass-card rounded-xl overflow-hidden flex items-stretch border-l-4 border-primary">
<div className="w-48 bg-cover bg-center shrink-0" data-alt="Sensory data chart for soil moisture anomalies in farmland" style="background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuD42CvYDKbL7YvTykjtmlt04rgt4pIPPsLxLQ7IPyd82mflzjbRyHKSZfwcvak3AFk-AzS7DBAv3lHupxDTRqAfCm-vJMULQeUhkwfpWcftTTDp74oSDGgzTHizbhB7cUWgf0vbqH_IAV_xzBv2TNeNp7E7yC64NfrMitgE2IZtkU6qeJMCeGzx5ozL3wqpr_XP_6o5CiATia8hvIUb-nDMdS2anUaYK0ZadEuH6Pwr2AVCLPdDyIyOgL-8u3_hgrJd5K-bjZspMrg')"></div>
<div className="p-6 flex-1 flex flex-col justify-between">
<div className="flex justify-between items-start">
<div>
<div className="flex items-center gap-2 mb-1">
<span className="px-2 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded uppercase">ALERTA</span>
<span className="text-slate-500 text-[11px] font-medium tracking-tight">ID: #4485 • Ontem, 09:12h</span>
</div>
<h4 className="text-slate-100 text-lg font-bold">Anomalia de Umidade do Solo</h4>
<p className="text-slate-400 text-sm mt-2 max-w-2xl">
                                        Sensores IOT reportaram queda de umidade abaixo do ponto de murcha permanente no <span className="text-slate-200 font-semibold">Talhão Central - Gleba B</span>. 
                                        Possível falha no sistema de pivô central ou entupimento de bicos.
                                    </p>
</div>
<div className="text-right">
<div className="flex flex-col items-end">
<span className="text-amber-500 text-2xl font-bold">22%</span>
<span className="text-slate-500 text-[10px] font-bold uppercase">Umidade Atual</span>
</div>
</div>
</div>
<div className="flex items-center justify-between mt-6 pt-4 border-t border-primary/5">
<div className="flex items-center gap-6">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-primary text-sm">settings_input_component</span>
<span className="text-slate-300 text-xs font-medium">Sensores: S-024, S-029</span>
</div>
</div>
<div className="flex gap-2">
<button className="px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:bg-orange-600 shadow-lg shadow-primary/20">Checar Telemetria</button>
</div>
</div>
</div>
</div>
<!-- Alert: Harvest Window (Informative) -->
<div className="glass-card rounded-xl overflow-hidden flex items-stretch border-l-4 border-primary">
<div className="w-48 bg-cover bg-center shrink-0" data-alt="Iconic representation of harvest readiness timeline" style="background-image: url('https://lh3.googleusercontent.com/aida-public/AB6AXuBAx9vjU7bgzg9RbnzNECnQnUHeZfqMpLebhURKFfqF8LLodHJHreoYMSFcJ1bw5rn2waRQBbo1hwXzFWi1jrOqILck02_9IMDs_u-9atD81_pz6fstbc21kmCu_yU1TG_PX4lMwEYoGCuGNXUMgwUghkhp7ubaSy5VDdZKVpX0gF5FxYD-Rh2w-KCaRBgkbezeupJ6mkokJwtDRTkLPOdryMzh2x0kQYUuUS-f5S9lKxzinD4EWDhmLk5MCGmqXGq5aKX0ge2YWXk')"></div>
<div className="p-6 flex-1 flex flex-col justify-between">
<div className="flex justify-between items-start">
<div>
<div className="flex items-center gap-2 mb-1">
<span className="px-2 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded uppercase">ALERTA</span>
<span className="text-slate-500 text-[11px] font-medium tracking-tight">ID: #4470 • 2 dias atrás</span>
</div>
<h4 className="text-slate-100 text-lg font-bold">Janela de Colheita Otimizada</h4>
<p className="text-slate-400 text-sm mt-2 max-w-2xl">
                                        Análise climática preditiva indica janela ideal para colheita de soja entre os dias 15 e 22 de Março. 
                                        Baixa probabilidade de precipitação superior a 5mm para o período.
                                    </p>
</div>
<div className="text-right">
<div className="flex flex-col items-end">
<span className="text-blue-500 text-2xl font-bold">94%</span>
<span className="text-slate-500 text-[10px] font-bold uppercase">Confiança IA</span>
</div>
</div>
</div>
<div className="flex items-center justify-between mt-6 pt-4 border-t border-primary/5">
<div className="flex items-center gap-6">
<div className="flex items-center gap-2">
<span className="material-symbols-outlined text-primary text-sm">calendar_month</span>
<span className="text-slate-300 text-xs font-medium">Início: 15/03/2024</span>
</div>
</div>
<div className="flex gap-2">
<button className="px-4 py-2 rounded-lg bg-slate-card text-slate-300 text-xs font-bold border border-primary/10 hover:bg-primary/5">Planejar Logística</button>
</div>
</div>
</div>
</div>
</div>
</div>
</main>
</div>
</body></html>