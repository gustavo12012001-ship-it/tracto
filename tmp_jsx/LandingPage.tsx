<!DOCTYPE html>
<html lang="pt-BR"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>Tracto | Tecnologia Orbital Proprietária</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,typography,container-queries"></script>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&amp;display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&amp;display=swap" rel="stylesheet"/>
<script>
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        primary: "#F97316",
                        "brand-green": "#064E3B",
                        "background-light": "#F8FAFC",
                        "background-dark": "#0F172A",
                        "accent-green": "#10B981",
                        "soft-gray": "#94A3B8"
                    },
                    fontFamily: {
                        display: ["Plus Jakarta Sans", "sans-serif"],
                        sans: ["Plus Jakarta Sans", "sans-serif"],
                    },
                    borderRadius: {
                        DEFAULT: "8px",
                        '2xl': '16px',
                        '3xl': '24px',
                        '4xl': '32px',
                    },
                },
            },
        };
    </script>
<style type="text/tailwindcss">
        .glass-dark {
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: 1px solid rgba(255, 255, 255, 0.03);
        }
        .hero-gradient {
            background: linear-gradient(to bottom, rgba(15, 23, 42, 0.1) 0%, rgba(15, 23, 42, 0.4) 50%, rgba(15, 23, 42, 0.9) 100%);
        }
        section {
            padding-top: 100px;
            padding-bottom: 100px;
        }
        .section-framed {
            padding-top: 120px;
            padding-bottom: 120px;
        }
        .fade-in-section {
            opacity: 0;
            transform: translateY(20px);
            transition: opacity 1.2s ease-out, transform 1.2s ease-out;
        }
        .fade-in-section.visible {
            opacity: 1;
            transform: translateY(0);
        }
        @media (max-width: 768px) {
            section {
                padding-top: 60px;
                padding-bottom: 60px;
            }
            .section-framed {
                padding-top: 80px;
                padding-bottom: 80px;
            }
        }
    </style>
</head>
<body className="bg-background-light dark:bg-background-dark font-sans text-slate-900 dark:text-slate-100 selection:bg-primary/30 antialiased">
<nav className="fixed top-0 w-full z-50 transition-all duration-300 px-8 py-6">
<div className="max-w-7xl mx-auto flex items-center justify-between glass-dark px-10 py-4 rounded-full border border-white/5 shadow-2xl">
<div className="flex items-center gap-2">
<span className="text-lg font-bold tracking-widest text-white uppercase">Tracto</span>
</div>
<div className="hidden md:flex items-center gap-12 text-[10px] font-medium uppercase tracking-[0.25em] text-white/60">
<a className="hover:text-primary transition-colors" href="#servicos">Serviços</a>
<a className="hover:text-primary transition-colors" href="#proposito">Nosso Propósito</a>
<a className="hover:text-primary transition-colors" href="#precos">Planos</a>
<a className="hover:text-primary transition-colors" href="#contato">Contato</a>
</div>
<div>
<button className="bg-primary hover:bg-orange-600 text-white px-8 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] transition-all hover:scale-105 shadow-lg shadow-primary/10">
                    Começar Agora
                </button>
</div>
</div>
</nav>
<section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-0 pb-0">
<div className="absolute inset-0 z-0">
<img alt="Aerial view of a scenic farm with technical blue and pink overlays, central villa and mountains backdrop" className="w-full h-full object-cover object-center" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBo6DW0mlLl01OpM-nNE6jQApM60H56OazuG6Jtp3sxsgX6lAo1LXOyu_JttoOmPNlnMpgPlQbJpAhDq5VeEUUNcLV1jFe1hEPDKudX7NGU0WVSgc3hERq2HUeSt2HkNDWoWQWwlF30I75vq_BKHkhbJDufw2QngU4jQT4SKPEY6rJ2YTZCTaurJg1CQHmynwgKTdRDiYH-fzqvecmgKWHx6wg-nag-tpEWL2lg4lJTopW21OF_MzEnn1Du38qJ0r4Pkbpcsrxwp90"/>
<div className="absolute inset-0 hero-gradient"></div>
</div>
<div className="relative z-10 max-w-5xl mx-auto px-6 text-center text-white mt-10 fade-in-section">
<h1 className="text-4xl md:text-5xl font-light tracking-tight mb-8 leading-snug">
                O campo em sincronia,<br/><span className="text-primary font-medium">na palma da sua mão.</span>
</h1>
<p className="text-base md:text-lg text-slate-100 max-w-2xl mx-auto mb-12 font-light leading-loose drop-shadow-md">
                A Tracto une Tecnologia Orbital Proprietária e Nossa Inteligência Agronômica Dedicada diretamente à sua interface mobile para decisões de alta precisão.
            </p>
<div className="flex flex-col sm:flex-row items-center justify-center gap-8">
<a className="bg-primary hover:bg-orange-600 text-white px-12 py-5 rounded-full text-xs font-bold uppercase tracking-widest transition-all hover:shadow-[0_0_40px_rgba(249,115,22,0.4)] active:scale-95" href="#">
                    Começar Agora
                </a>
<a className="text-white hover:text-white/80 text-[10px] uppercase tracking-[0.3em] transition-all drop-shadow-md" href="#proposito">
                    Descobrir o Ecossistema
                </a>
</div>
</div>
</section>
<section className="bg-white dark:bg-slate-900 section-framed" id="proposito">
<div className="max-w-4xl mx-auto px-8 text-center fade-in-section">
<h2 className="text-[10px] font-bold text-primary tracking-[0.5em] uppercase mb-8">Nosso Propósito</h2>
<div className="space-y-8">
<p className="text-2xl md:text-4xl font-light text-slate-900 dark:text-white leading-relaxed tracking-tight">
                    Conectar a inteligência orbital e climática proprietária à simplicidade de um chat intuitivo, transformando dados complexos em decisões diárias e precisas.
                </p>
<p className="text-base md:text-lg text-slate-500 dark:text-slate-400 font-light leading-loose max-w-2xl mx-auto pt-4">
                    Nossa missão é otimizar o manejo, promovendo produtividade e sustentabilidade para a sua lavoura.
                </p>
</div>
</div>
</section>
<section className="bg-background-light dark:bg-slate-950/40 section-framed" id="servicos">
<div className="max-w-7xl mx-auto px-6">
<div className="text-center mb-16 fade-in-section">
<h2 className="text-[10px] font-bold text-primary tracking-[0.4em] uppercase mb-6">Sistemas</h2>
<h3 className="text-2xl md:text-3xl font-light text-slate-900 dark:text-white tracking-tight">Arquitetura de Dados Proprietária</h3>
</div>
<div className="grid md:grid-cols-3 gap-16 lg:gap-24">
<div className="group fade-in-section">
<div className="mb-8 opacity-50 group-hover:opacity-100 transition-opacity">
<span className="material-symbols-outlined text-4xl font-light text-primary">satellite_alt</span>
</div>
<h4 className="text-lg font-semibold mb-4 dark:text-white tracking-tight">Tecnologia Orbital Proprietária</h4>
<p className="text-slate-500 dark:text-slate-400 text-sm leading-loose font-light">
                        Análise de Imagens de Frequência Contínua para monitoramento de índices de vegetação e saúde da plantação com precisão científica.
                    </p>
</div>
<div className="group fade-in-section" style="transition-delay: 200ms;">
<div className="mb-8 opacity-50 group-hover:opacity-100 transition-opacity">
<span className="material-symbols-outlined text-4xl font-light text-primary">analytics</span>
</div>
<h4 className="text-lg font-semibold mb-4 dark:text-white tracking-tight">Análise de Frequência Contínua</h4>
<p className="text-slate-500 dark:text-slate-400 text-sm leading-loose font-light">
                        Processamento ininterrupto de dados ambientais para detecção precoce de anomalias hídricas e estresse biótico.
                    </p>
</div>
<div className="group fade-in-section" style="transition-delay: 400ms;">
<div className="mb-8 opacity-50 group-hover:opacity-100 transition-opacity">
<span className="material-symbols-outlined text-4xl font-light text-primary">memory</span>
</div>
<h4 className="text-lg font-semibold mb-4 dark:text-white tracking-tight">Inteligência Agronômica Dedicada</h4>
<p className="text-slate-500 dark:text-slate-400 text-sm leading-loose font-light">
                        Algoritmos exclusivos traduzem telemetria complexa em recomendações práticas enviadas diretamente para sua interface mobile.
                    </p>
</div>
</div>
</div>
</section>
<section className="bg-white dark:bg-background-dark overflow-hidden section-framed" id="app-showcase">
<div className="max-w-7xl mx-auto px-6">
<div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-32">
<div className="w-full lg:w-1/2 relative fade-in-section">
<div className="relative z-10 w-[280px] md:w-[320px] mx-auto rounded-[3rem] border-[10px] border-slate-900 dark:border-slate-950 bg-slate-900 shadow-2xl overflow-hidden ring-1 ring-white/10">
<div className="bg-brand-green p-4 pt-10 text-white flex items-center gap-4">
<span className="material-symbols-outlined text-lg">arrow_back</span>
<div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden border border-white/20">
<img alt="Tracto AI Avatar" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuA9YpGb0bZjWKAXOj0EldHehbZ3K5vtul8tgwRhsUjRdZ2FASAeb8AD0MCui0QJ2Mp2aYxNuJDOcSaKDBooN80t_4aCJ8mJ9syocA9xkXQ5lN486OD-HlfqsjOrSoAYecg6CIR32ROrEH2JztUZrGJLgcspn8K7GkLepkEhMVSpJTH0_RWRwehawQ_evU9grGQjPDuYWoyFNwALUzf_GdsFCgtFS71Phdl1LWOm13-XIkrXUggFRMMxGmmyxdRkXqybnD-IQCUDjdE"/>
</div>
<div>
<h5 className="text-sm font-bold">Tracto AI</h5>
<p className="text-[10px] opacity-60">online</p>
</div>
</div>
<div className="bg-[#f0f2f5] dark:bg-slate-800 h-[480px] p-4 flex flex-col gap-4 overflow-y-auto">
<div className="bg-white dark:bg-slate-700 p-4 rounded-xl rounded-tl-none shadow-sm max-w-[85%] text-[13px]">
<p className="dark:text-white leading-relaxed">Bom dia. A Tecnologia Orbital identificou uma queda de 15% no vigor vegetativo no Talhão 4. Recomendo inspeção local.</p>
<span className="text-[9px] text-slate-400 mt-2 block text-right">08:30</span>
</div>
<div className="bg-[#dcf8c6] dark:bg-emerald-900/40 p-4 rounded-xl rounded-tr-none shadow-sm max-w-[85%] self-end text-[13px]">
<p className="dark:text-white leading-relaxed">Qual o cenário climático para as próximas horas?</p>
<span className="text-[9px] text-emerald-600/60 dark:text-emerald-400 mt-2 block text-right">08:32</span>
</div>
<div className="bg-white dark:bg-slate-700 p-4 rounded-xl rounded-tl-none shadow-sm max-w-[85%] text-[13px]">
<p className="dark:text-white leading-relaxed">Previsão de precipitação de 5mm para amanhã. A Inteligência Agronômica Dedicada sugere otimizar a nutrição foliar.</p>
<span className="text-[9px] text-slate-400 mt-2 block text-right">08:32</span>
</div>
</div>
</div>
<div className="absolute -top-20 -left-20 w-80 h-80 bg-primary/5 rounded-full blur-[120px] -z-10"></div>
</div>
<div className="w-full lg:w-1/2 space-y-12 fade-in-section" style="transition-delay: 300ms;">
<h2 className="text-2xl md:text-3xl font-light dark:text-white leading-snug tracking-tight">Gestão de alta performance em uma interface minimalista.</h2>
<p className="text-base text-slate-500 dark:text-slate-400 font-light leading-loose">
                        Eliminamos dashboards desnecessários. A Tracto entrega o que é essencial para o produtor onde ele já está.
                    </p>
<ul className="space-y-8">
<li className="flex gap-6">
<div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/5 text-primary flex items-center justify-center">
<span className="material-symbols-outlined text-xl">notifications_active</span>
</div>
<div>
<h6 className="text-sm font-semibold dark:text-white mb-2 tracking-tight">Alertas Proativos</h6>
<p className="text-sm text-slate-500 dark:text-slate-400 font-light leading-relaxed">Monitoramento automático de variações biométricas.</p>
</div>
</li>
<li className="flex gap-6">
<div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/5 text-primary flex items-center justify-center">
<span className="material-symbols-outlined text-xl">psychology</span>
</div>
<div>
<h6 className="text-sm font-semibold dark:text-white mb-2 tracking-tight">Inteligência Agronômica Dedicada</h6>
<p className="text-sm text-slate-500 dark:text-slate-400 font-light leading-relaxed">Interação direta com nossa tecnologia via linguagem natural.</p>
</div>
</li>
</ul>
<div className="pt-2">
<button className="bg-primary hover:bg-orange-600 text-white px-12 py-5 rounded-full text-[10px] font-bold uppercase tracking-[0.25em] transition-all flex items-center gap-4 shadow-xl shadow-primary/10">
                            Iniciar Acesso
                            <span className="material-symbols-outlined text-lg">trending_flat</span>
</button>
</div>
</div>
</div>
</div>
</section>
<section className="bg-background-light dark:bg-slate-950/20 section-framed min-h-screen flex items-center" id="precos">
<div className="max-w-7xl mx-auto px-6 w-full">
<div className="text-center mb-16 fade-in-section">
<h2 className="text-[10px] font-bold text-primary tracking-[0.4em] uppercase mb-6">Investimento</h2>
<h3 className="text-2xl md:text-3xl font-light text-slate-900 dark:text-white tracking-tight">Planos de Assinatura</h3>
</div>
<div className="grid md:grid-cols-3 gap-10 items-stretch">
<div className="p-10 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex flex-col fade-in-section">
<h4 className="text-sm font-semibold mb-2 dark:text-white tracking-widest uppercase">Familiar</h4>
<p className="text-slate-400 mb-8 font-medium uppercase tracking-[0.2em] text-[10px]">Até 50 hectares</p>
<div className="mb-10">
<span className="text-4xl font-light dark:text-white">R$ 149</span>
<span className="text-slate-400 text-sm">/mês</span>
</div>
<ul className="space-y-6 mb-10 flex-1">
<li className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 font-light">
<span className="material-symbols-outlined text-accent-green text-sm">check</span>
                            Relatório diário mobile
                        </li>
<li className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 font-light">
<span className="material-symbols-outlined text-accent-green text-sm">check</span>
                            Monitoramento Orbital
                        </li>
</ul>
<button className="w-full py-4 rounded-full border border-primary text-primary text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white transition-all">Assinar</button>
</div>
<div className="p-10 rounded-3xl bg-slate-900 dark:bg-brand-green/10 border border-primary flex flex-col relative scale-105 shadow-2xl z-10 fade-in-section" style="transition-delay: 200ms;">
<div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-white px-6 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-[0.3em]">Premium</div>
<h4 className="text-sm font-semibold mb-2 text-white tracking-widest uppercase">Profissional</h4>
<p className="text-slate-500 mb-8 font-medium uppercase tracking-[0.2em] text-[10px]">Até 500 hectares</p>
<div className="mb-10 text-white">
<span className="text-4xl font-light">R$ 499</span>
<span className="text-slate-500 text-sm">/mês</span>
</div>
<ul className="space-y-6 mb-10 flex-1">
<li className="flex items-center gap-4 text-xs text-slate-300 font-light">
<span className="material-symbols-outlined text-primary text-sm">check</span>
                            Monitoramento Ilimitado
                        </li>
<li className="flex items-center gap-4 text-xs text-slate-300 font-light">
<span className="material-symbols-outlined text-primary text-sm">check</span>
                            Suporte Prioritário
                        </li>
</ul>
<button className="w-full py-4 rounded-full bg-primary text-white text-[10px] font-bold uppercase tracking-widest hover:bg-orange-600 transition-all shadow-lg shadow-primary/20">Assinar</button>
</div>
<div className="p-10 rounded-3xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex flex-col fade-in-section" style="transition-delay: 400ms;">
<h4 className="text-sm font-semibold mb-2 dark:text-white tracking-widest uppercase">Enterprise</h4>
<p className="text-slate-400 mb-8 font-medium uppercase tracking-[0.2em] text-[10px]">Área Ilimitada</p>
<div className="mb-10">
<span className="text-2xl font-light dark:text-white">Sob consulta</span>
</div>
<ul className="space-y-6 mb-10 flex-1">
<li className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 font-light">
<span className="material-symbols-outlined text-accent-green text-sm">check</span>
                            Integração via API
                        </li>
<li className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 font-light">
<span className="material-symbols-outlined text-accent-green text-sm">check</span>
                            Consultoria Individual
                        </li>
</ul>
<button className="w-full py-4 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Contato</button>
</div>
</div>
</div>
</section>
<footer className="bg-slate-950 text-white pt-24 pb-12 px-8" id="contato">
<div className="max-w-7xl mx-auto">
<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-16 lg:gap-32 mb-16 fade-in-section">
<div className="col-span-1 lg:col-span-2">
<span className="text-xl font-bold tracking-[0.3em] mb-6 block">TRACTO</span>
<p className="text-slate-500 text-sm max-w-sm leading-loose font-light mb-8">
                        Liderando a revolução digital no campo com Tecnologia Orbital Proprietária e inteligência de precisão.
                    </p>
<div className="flex gap-8">
<a className="text-slate-600 hover:text-primary transition-colors" href="#">
<svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"></path></svg>
</a>
</div>
</div>
<div>
<h5 className="text-[10px] font-bold mb-8 uppercase tracking-[0.3em]">Ecossistema</h5>
<ul className="space-y-4 text-slate-500 text-xs font-light tracking-wide">
<li><a className="hover:text-primary transition-colors" href="#servicos">Serviços</a></li>
<li><a className="hover:text-primary transition-colors" href="#proposito">Propósito</a></li>
<li><a className="hover:text-primary transition-colors" href="#precos">Planos</a></li>
<li><a className="hover:text-primary transition-colors" href="#">Segurança IP</a></li>
</ul>
</div>
<div>
<h5 className="text-[10px] font-bold mb-8 uppercase tracking-[0.3em]">Contato</h5>
<ul className="space-y-6 text-slate-500 text-xs font-light">
<li className="flex items-center gap-4">
<span className="material-symbols-outlined text-primary text-lg">mail</span>
                            contato@tracto.ag
                        </li>
<li className="flex items-center gap-4">
<span className="material-symbols-outlined text-primary text-lg">call</span>
                            +55 (11) 99999-9999
                        </li>
</ul>
</div>
</div>
<div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-8 fade-in-section">
<div className="text-slate-600 text-[10px] uppercase tracking-[0.2em]">
                    © 2024 Tracto Agricultural Technologies.
                </div>
<div>
<button className="bg-primary/10 border border-primary/20 text-primary px-10 py-4 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-primary hover:text-white transition-all">
                        Começar Agora
                    </button>
</div>
</div>
</div>
</footer>
<script>
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const targetId = this.getAttribute('href');
                const target = document.querySelector(targetId);
                if (target) {
                    window.scrollTo({
                        top: target.offsetTop - 100,
                        behavior: 'smooth'
                    });
                }
            });
        });
        const observerOptions = {
            threshold: 0.1
        };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, observerOptions);
        document.querySelectorAll('.fade-in-section').forEach(section => {
            observer.observe(section);
        });
    </script>

</body></html>