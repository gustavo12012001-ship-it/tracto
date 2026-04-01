<!DOCTYPE html>

<html lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Tracto | AgTech Dashboard</title>
<!-- Tailwind CSS v3 CDN -->
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<!-- Google Fonts: Inter -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&amp;display=swap" rel="stylesheet"/>
<style data-purpose="typography">
    body {
      font-family: 'Inter', sans-serif;
      background-color: #0a0a0b;
      color: #ffffff;
    }
  </style>
<style data-purpose="custom-colors">
    .bg-tracto-dark { background-color: #0f1115; }
    .bg-tracto-card { background-color: #16191f; }
    .text-tracto-orange { color: #ec9213; }
    .bg-tracto-orange { background-color: #ec9213; }
    .border-tracto-orange { border-color: #ec9213; }
    .accent-green { color: #4ade80; }
    .accent-red { color: #f87171; }
  </style>
<style>{
    * { scrollbar-width: thin; scrollbar-color: #374151 transparent; }
    *::-webkit-scrollbar { width: 6px; display: block; }
    *::-webkit-scrollbar-track { background: transparent; }
    *::-webkit-scrollbar-thumb { background-color: #374151; border-radius: 20px; }
    body { overflow: hidden; }
    main { height: calc(100vh - 4rem); }
  }</style><link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/></head>
<body className="h-screen flex overflow-hidden">
<!-- BEGIN: LeftSidebar -->
<aside className="w-64 bg-tracto-dark border-r border-gray-800 flex flex-col justify-between py-6 px-4" data-purpose="main-navigation">
<div>
<div className="mb-10 px-2">
<h1 className="text-2xl font-bold tracking-tighter text-tracto-orange">TRACTO</h1>
<p className="text-[10px] uppercase tracking-widest text-gray-500 font-medium">Data-Driven AgTech</p>
</div>
<nav className="space-y-1">
<!-- Active Dashboard Link -->
<a className="flex items-center px-3 py-2 text-sm font-medium rounded-lg bg-gray-800 text-tracto-orange group" href="#"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewbox="0 0 24 24"><path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg> Mapa / Talhões<span className="ml-auto w-1.5 h-1.5 rounded-full bg-tracto-orange"></span></a>
<a className="flex items-center px-3 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" href="#"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewbox="0 0 24 24"><path d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg> Meteorologia</a>
<a className="flex items-center px-3 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" href="#"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewbox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg> Chat IA</a>
<a className="flex items-center px-3 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" href="#"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewbox="0 0 24 24"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg> Alertas</a><a className="flex items-center px-3 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors" href="#"><svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewbox="0 0 24 24"><path d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg> Relatórios</a>
</nav>
</div>
<div><div className="space-y-6 pt-6 border-t border-gray-800">
<div className="flex items-center justify-between">
<div className="flex items-center space-x-3">
<img alt="Dr. Elena Volkov Avatar" className="h-9 w-9 rounded-full border border-gray-700 bg-gray-800" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB91hP93eYL7nJx00nd_AH-i8IAsI7i2UUrhJ0Bjiw7iR3_fJNWo3jAl-CjRXMJxU2onjIVXmExVLDMUkz6hoywxuH9fmS4aX4NryaK5c7qVJy-5V8nYYxRBXBJBo4jrX-6gUff6zhkPvpWkebZfV9k7QafRT78HuW2zWz-mXl5Fj3e7Y_87aTnPokxEksYBHkjsmoPFxonvxCML7bIt5j_gPPlsmjnbFEQ39eOy9pq5GIPWwAP_agakjVT6h904lyP48mkoaYpZ_c"/>
<div className="min-w-0">
<p className="text-sm font-semibold text-white truncate">Dr. Elena Volkov</p>
<p className="text-[10px] text-gray-500 truncate">Chief Agronomist</p>
</div>
</div>
<button className="text-gray-500 hover:text-white transition-colors">
<span className="material-symbols-outlined text-xl">settings</span>
</button>
</div>
<button className="w-full flex items-center justify-center space-x-2 px-3 py-2.5 text-xs font-bold text-red-400 hover:text-red-300 bg-red-400/5 hover:bg-red-400/10 rounded-lg transition-all border border-red-400/10">
<span className="material-symbols-outlined text-sm">logout</span>
<span className="uppercase tracking-widest">Sair do Portal</span>
</button>
</div></div>
</aside>
<!-- END: LeftSidebar -->
<div className="flex-1 flex flex-col min-w-0">
<!-- BEGIN: TopBar -->
<header className="h-16 bg-tracto-dark border-b border-gray-800 flex items-center justify-between px-8" data-purpose="top-header"><div className="flex items-center space-x-6">
<div className="flex items-center space-x-3 text-gray-400">
<span className="material-symbols-outlined text-xl">location_on</span>
<div>
<p className="text-xs font-semibold text-white">Londrina, PR</p>
<p className="text-[10px] uppercase tracking-wider text-gray-500">Localização Atual</p>
</div>
</div><div className="flex items-center space-x-3 ml-4">
<div className="h-6 w-px bg-gray-800"></div>
</div>
<div className="h-6 w-px bg-gray-800"></div>
<div className="flex items-center space-x-4">
<div className="flex items-center space-x-2">
<span className="material-symbols-outlined text-tracto-orange text-xl">light_mode</span>
<span className="text-sm font-bold">28°C</span>
</div>
<div className="flex items-center space-x-2">
<span className="material-symbols-outlined text-blue-400 text-xl">water_drop</span>
<span className="text-sm font-bold text-gray-300">62%</span>
</div>
</div>
</div>
<div className="flex items-center space-x-4">
<div className="relative flex items-center bg-tracto-orange hover:bg-orange-600 transition-all rounded-lg shadow-lg shadow-orange-900/20">
<select className="appearance-none bg-transparent border-none text-white text-xs font-bold py-2 pl-4 pr-10 focus:ring-0 cursor-pointer">
<option className="bg-tracto-dark text-white" value="mt">FAZENDA MATO GROSSO</option>
<option className="bg-tracto-dark text-white" value="mg">GLEBA SUL - MG</option>
<option className="bg-tracto-dark text-white" value="sp">RECANTO DOS IPÊS - SP</option>
</select>
<span className="material-symbols-outlined absolute right-3 pointer-events-none text-white text-lg font-bold">expand_more</span>
</div><button className="flex items-center space-x-2 bg-tracto-orange hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg shadow-orange-900/20">
<span className="material-symbols-outlined text-sm">add_circle</span>
<span>NOVO TALHÃO</span>
</button>
<button className="p-2 text-gray-400 hover:text-white bg-gray-800/50 rounded-lg relative transition-colors">
<span className="material-symbols-outlined">notifications</span>
<span className="absolute top-2 right-2 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-tracto-dark"></span>
</button>
</div></header>
<!-- END: TopBar -->
<!-- BEGIN: MainContent -->
<main className="flex-1 flex overflow-hidden">
<!-- Central View -->
<section className="flex-1 p-6 flex flex-col overflow-hidden h-full" data-purpose="dashboard-stats-map">
<!-- Stats Row -->
<!-- Map Section -->
<div className="relative bg-gray-900 rounded-2xl border border-gray-800 flex-1 overflow-hidden flex-grow min-h-0" data-purpose="field-map-container">
<!-- Placeholder Map Background -->
<img alt="Satellite view map" className="w-full h-full object-cover opacity-60" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC3ePFSZHg06uV5cwU-kZgzdx-WOEaQ7MBTUPf4gzksN2BmdIpwgkXa7n7Z_xn3cRjJ6GdUXfBV-ceQwi7dCX-NYrJj37rRCCldKvyzRaIUwqWkCQkID_RdCHOkGQpy0rctEXbvxIe_GQ5r1jWwemrv1rVzeWzZrRXbuhC0J7HK8owkCNJaKhr_ilfo0QYZbH1wpoCxcWY67I-cxNhr4Gk-7gBLkgaDwkyt6CXqxpC-jJbo7_i1LW2weuCOCa_lM-wK5DjnTPhFzB8"/>
<!-- Simulated Field Polygons Overlay -->
<svg className="absolute inset-0 w-full h-full" preserveaspectratio="none" viewbox="0 0 800 500">
<!-- Healthy Field -->
<polygon fill="rgba(74, 222, 128, 0.2)" points="100,100 300,80 320,250 150,280" stroke="#4ade80" stroke-width="2"></polygon>
<!-- Stressed Field -->
<polygon fill="rgba(236, 146, 19, 0.2)" points="350,150 550,130 580,300 400,320" stroke="#ec9213" stroke-width="2"></polygon>
<!-- Another Field -->
<polygon fill="rgba(74, 222, 128, 0.15)" points="200,350 450,340 430,480 180,450" stroke="#4ade80" stroke-width="2"></polygon>
</svg>
<!-- Map Controls -->
<div className="absolute top-6 left-6 flex space-x-2 bg-tracto-dark/80 backdrop-blur-md p-1 rounded-lg border border-gray-700 shadow-xl">
<button className="px-4 py-1.5 text-xs font-semibold rounded bg-gray-700 text-white">Satellite</button>
<button className="px-4 py-1.5 text-xs font-semibold rounded text-gray-400 hover:text-white transition-colors">NDVI</button>
<button className="px-4 py-1.5 text-xs font-semibold rounded text-gray-400 hover:text-white transition-colors">Moisture</button>
</div>
<div className="absolute bottom-6 right-6 flex flex-col space-y-2">
<button className="w-10 h-10 bg-tracto-dark/80 backdrop-blur-md rounded-lg flex items-center justify-center border border-gray-700 hover:bg-gray-800">
<svg className="w-5 h-5" fill="none" stroke="currentColor" viewbox="0 0 24 24"><path d="M12 4v16m8-8H4" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg>
</button>
<button className="w-10 h-10 bg-tracto-dark/80 backdrop-blur-md rounded-lg flex items-center justify-center border border-gray-700 hover:bg-gray-800">
<svg className="w-5 h-5" fill="none" stroke="currentColor" viewbox="0 0 24 24"><path d="M20 12H4" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path></svg>
</button>
</div>
<!-- Legend -->
<div className="absolute bottom-6 left-6 bg-tracto-dark/80 backdrop-blur-md p-3 rounded-lg border border-gray-700 shadow-xl">
<div className="flex items-center space-x-4">
<div className="flex items-center space-x-1.5">
<div className="w-3 h-3 rounded-full bg-green-500"></div>
<span className="text-[10px] uppercase font-bold text-gray-300">Optimum</span>
</div>
<div className="flex items-center space-x-1.5">
<div className="w-3 h-3 rounded-full bg-orange-500"></div>
<span className="text-[10px] uppercase font-bold text-gray-300">Needs Attention</span>
</div>
</div>
</div>
</div>
</section>
<!-- BEGIN: RightSidebar (Intelligence) -->
<aside className="w-80 bg-tracto-dark border-l border-gray-800 flex flex-col p-6 overflow-y-auto" data-purpose="intelligence-sidebar"><div className="grid grid-cols-1 gap-4 mb-8">
<!-- Card 1 -->
<div className="bg-tracto-card p-4 rounded-xl border border-gray-800">
<p className="text-xs text-gray-500 font-medium mb-1">Total Area</p>
<div className="flex items-baseline justify-between">
<h3 className="text-2xl font-bold">12,480 <span className="text-sm font-normal text-gray-400">ha</span></h3>
<span className="text-[11px] text-green-500 font-medium">+2.1%</span>
</div>
<div className="mt-4 h-8 w-full bg-gray-900 rounded-md overflow-hidden relative">
<svg className="absolute bottom-0 w-full h-full" preserveaspectratio="none" viewbox="0 0 100 100">
<path d="M0 80 Q 25 70, 50 85 T 100 60" fill="none" stroke="#4ade80" stroke-width="2"></path>
</svg>
</div>
</div>
<!-- Card 2 -->
<div className="bg-tracto-card p-4 rounded-xl border border-gray-800">
<p className="text-xs text-gray-500 font-medium mb-1">Avg NDVI</p>
<div className="flex items-baseline justify-between">
<h3 className="text-2xl font-bold">0.74</h3>
<span className="text-[11px] text-red-400 font-medium">-0.02</span>
</div>
<div className="mt-4 h-8 w-full bg-gray-900 rounded-md overflow-hidden relative">
<svg className="absolute bottom-0 w-full h-full" preserveaspectratio="none" viewbox="0 0 100 100">
<path d="M0 20 Q 25 40, 50 30 T 100 70" fill="none" stroke="#f87171" stroke-width="2"></path>
</svg>
</div>
</div>
<!-- Card 3 -->
<div className="bg-tracto-card p-4 rounded-xl border border-gray-800">
<p className="text-xs text-gray-500 font-medium mb-1">Precipitation</p>
<div className="flex items-baseline justify-between">
<h3 className="text-2xl font-bold">12.4 <span className="text-sm font-normal text-gray-400">mm</span></h3>
<span className="text-[11px] text-green-500 font-medium">+5.4%</span>
</div>
<div className="mt-4 h-8 w-full bg-gray-900 rounded-md overflow-hidden relative">
<svg className="absolute bottom-0 w-full h-full" preserveaspectratio="none" viewbox="0 0 100 100">
<path d="M0 90 L 20 80 L 40 85 L 60 40 L 80 50 L 100 30" fill="none" stroke="#60a5fa" stroke-width="2"></path>
</svg>
</div>
</div>
<!-- Card 4 -->
<div className="bg-tracto-card p-4 rounded-xl border border-gray-800">
<p className="text-xs text-gray-500 font-medium mb-1">Est. Productivity</p>
<div className="flex items-baseline justify-between">
<h3 className="text-2xl font-bold">4.2 <span className="text-sm font-normal text-gray-400">t/ha</span></h3>
<span className="text-[11px] text-green-500 font-medium">+1.8%</span>
</div>
<div className="mt-4 h-8 w-full bg-gray-900 rounded-md overflow-hidden relative">
<svg className="absolute bottom-0 w-full h-full" preserveaspectratio="none" viewbox="0 0 100 100">
<path d="M0 70 Q 50 60, 100 20" fill="none" stroke="#4ade80" stroke-width="2"></path>
</svg>
</div>
</div>
</div>
<!-- AI Status -->
<div className="mb-8">
<div className="flex items-center justify-between mb-2">
<h4 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Tracto AI Live</h4>
<div className="flex items-center space-x-1.5">
<span className="relative flex h-2 w-2">
<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
<span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
</span>
<span className="text-[10px] text-green-500 font-bold uppercase">Synced</span>
</div>
</div>
<p className="text-xs text-gray-400 leading-relaxed">Analyzing multi-spectral data from Sentinel-2 &amp; Ground Sensors. Accuracy: 98.2%</p>
</div>
<!-- High Priority Alerts -->
<div className="mb-8">
<h4 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-4">High Priority Alerts</h4>
<div className="space-y-4">
<!-- Alert 1 -->
<div className="bg-gray-900 border-l-2 border-tracto-orange p-3 rounded-r-lg">
<p className="text-[10px] font-bold text-tracto-orange uppercase mb-1">Water Stress Detected</p>
<h5 className="text-sm font-semibold mb-2">Field B-12: Corn</h5>
<button className="w-full py-2 bg-tracto-orange hover:bg-orange-600 text-white text-[11px] font-bold rounded transition-colors uppercase">Deploy Irrigation</button>
</div>
<!-- Alert 2 -->
<div className="bg-gray-900 border-l-2 border-blue-500 p-3 rounded-r-lg">
<p className="text-[10px] font-bold text-blue-500 uppercase mb-1">Optimal Harvest Window</p>
<h5 className="text-sm font-semibold mb-2">Field A-04: Soy</h5>
<button className="w-full py-2 border border-blue-500/30 hover:bg-blue-500/10 text-blue-400 text-[11px] font-bold rounded transition-colors uppercase">Schedule Fleet</button>
</div>
</div>
</div>
<!-- Market Intelligence -->
<div className="mb-8 flex-1">
<h4 className="text-[10px] font-bold tracking-widest text-gray-500 uppercase mb-4">Market Intelligence</h4>
<div className="space-y-3">
<div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
<div>
<p className="text-xs font-semibold">Soybean Futures</p>
<p className="text-[10px] text-gray-500">CBOT - MAR 24</p>
</div>
<div className="text-right">
<p className="text-sm font-bold">$12.42</p>
<p className="text-[10px] text-green-500">+1.2%</p>
</div>
</div>
<div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
<div>
<p className="text-xs font-semibold">Logistics Index</p>
<p className="text-[10px] text-gray-500">Region: Midwest</p>
</div>
<div className="text-right">
<p className="text-sm font-bold">104.2</p>
<p className="text-[10px] text-red-400">-0.4%</p>
</div>
</div>
</div>
</div>
<!-- Action Button -->
<button className="w-full py-4 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold rounded-xl border border-gray-700 transition-colors uppercase tracking-widest">
          View Full Intelligence Report
        </button>
</aside>
<!-- END: RightSidebar -->
</main>
<!-- END: MainContent -->
</div>
</body></html>