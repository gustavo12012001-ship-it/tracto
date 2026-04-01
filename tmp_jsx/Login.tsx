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
<body className="bg-background-light dark:bg-background-dark font-sans text-slate-900 dark:text-slate-100 selection:bg-primary/30 antialiased"><div className="relative min-h-screen flex items-center justify-center overflow-hidden">
<!-- Background Image -->
<div className="absolute inset-0 z-0">
<img alt="Aerial view of a scenic farm" className="w-full h-full object-cover object-center" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBo6DW0mlLl01OpM-nNE6jQApM60H56OazuG6Jtp3sxsgX6lAo1LXOyu_JttoOmPNlnMpgPlQbJpAhDq5VeEUUNcLV1jFe1hEPDKudX7NGU0WVSgc3hERq2HUeSt2HkNDWoWQWwlF30I75vq_BKHkhbJDufw2QngU4jQT4SKPEY6rJ2YTZCTaurJg1CQHmynwgKTdRDiYH-fzqvecmgKWHx6wg-nag-tpEWL2lg4lJTopW21OF_MzEnn1Du38qJ0r4Pkbpcsrxwp90"/>
<div className="absolute inset-0 bg-slate-950/60"></div>
</div>
<!-- Login Card -->
<div className="relative z-10 w-full max-w-md px-6">
<div className="glass-dark p-10 md:p-12 rounded-[2rem] border border-white/10 shadow-2xl backdrop-blur-3xl">
<div className="text-center mb-10">
<span className="text-2xl font-bold tracking-[0.4em] text-white uppercase block mb-2">Tracto</span>
<p className="text-slate-400 text-[10px] uppercase tracking-[0.2em] font-medium">Acesso ao Ecossistema</p>
</div>
<form className="space-y-6">
<div className="space-y-2">
<label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">Email ou Usuário</label>
<input className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-primary/50 transition-colors text-sm font-light" placeholder="seu@email.com" type="text"/>
</div>
<div className="space-y-2">
<div className="flex justify-between items-center">
<label className="text-[10px] uppercase tracking-widest text-slate-400 font-bold ml-1">Senha</label>
<a className="text-[9px] uppercase tracking-widest text-primary hover:text-orange-400 transition-colors" href="#">Esqueceu?</a>
</div>
<input className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-white placeholder:text-slate-600 focus:outline-none focus:border-primary/50 transition-colors text-sm font-light" placeholder="••••••••" type="password"/>
</div>
<div className="pt-4">
<button className="w-full bg-primary hover:bg-orange-600 text-white py-5 rounded-full text-xs font-bold uppercase tracking-[0.3em] transition-all hover:shadow-[0_0_30px_rgba(249,115,22,0.3)] active:scale-95 shadow-xl shadow-primary/20" type="submit">
                        Entrar
                    </button>
</div>
</form>
<div className="mt-10 text-center">
<p className="text-slate-500 text-[10px] uppercase tracking-widest">
                    Ainda não possui acesso?
                    <a className="text-white hover:text-primary transition-colors font-bold ml-2" href="#">Solicitar Credenciais</a>
</p>
</div>
</div>
<div className="mt-8 text-center">
<a className="text-slate-400 hover:text-white transition-colors text-[9px] uppercase tracking-[0.4em] flex items-center justify-center gap-2" href="/">
<span className="material-symbols-outlined text-sm">arrow_back</span>
                Voltar para o site
            </a>
</div>
</div>
</div></body></html>