# Tracto — Inteligência Agronômica de Precisão

[![Tracto Banner](https://img.shields.io/badge/Status-Produção-orange?style=for-the-badge&logo=rocket)](https://tracto.ag)

A Tracto é uma plataforma completa de inteligência agronômica que une dados orbitais, motores determinísticos e inteligência artificial para otimizar a tomada de decisão no campo.

## 🚀 Funcionalidades Principais

- **Monitoramento Orbital (NDVI):** Análise de vigor vegetativo via satélite (Sentinel-2) com resoluções temporais otimizadas.
- **Motor Agronômico Determinístico:** Cálculos precisos de janela de pulverização, risco de geada e estresse hídrico.
- **Alertas Inteligentes:** Notificações em tempo real sobre anomalias críticas e condições meteorológicas.
- **Chat Agronômico:** Assistente especializado (Claude 3.5) capaz de analisar imagens de pragas e sintomas na lavoura.
- **Relatórios Automatizados:** Geração de diagnósticos técnicos completos integrando clima e fitossanidade.
- **Gestão de Talhões:** Ferramenta de desenho e categorização de áreas produtivas.

## 🛠️ Stack Tecnológica

### Frontend
- **Framework:** React 19 + TypeScript + Vite
- **Estilização:** TailwindCSS (v4)
- **Mapas:** Leaflet / React-Leaflet
- **Estado:** Zustand (com persistência local)
- **Animações:** Framer Motion

### Backend
- **Linguagem:** Python 3.10+
- **Framework:** FastAPI
- **Processamento:** Httpx (Async)
- **IA:** Anthropic Claude 3.5 Sonnet
- **Banco de Dados:** Supabase (PostgreSQL) + Row Level Security (RLS)

## 📦 Estrutura do Projeto

```bash
├── src/                # Frontend React
│   ├── components/     # UI Reutilizável
│   ├── pages/          # Telas da aplicação
│   ├── services/       # Integração com APIs
│   └── store/          # Estado global (Zustand)
├── tracto-backend/     # Backend FastAPI
│   ├── services/       # Lógica de negócio e IA
│   ├── models.py       # Esquemas de dados (Pydantic)
│   ├── main.py         # Endpoints da API
│   └── sql/            # Scripts de banco de dados
└── public/             # Assets e Service Workers
```

## ⚙️ Configuração e Instalação

### Backend
1. Navegue até `tracto-backend`.
2. Instale as dependências: `pip install -r requirements.txt`.
3. Configure o arquivo `.env` com suas chaves (Anthropic, Supabase, Sentinel Hub).
4. Inicie o servidor: `uvicorn main:app --reload`.

### Frontend
1. Na raiz do projeto, instale as dependências: `npm install`.
2. Configure o arquivo `.env.local` com a URL do backend e chave Supabase.
3. Inicie o ambiente de desenvolvimento: `npm run dev`.

## 📄 Documentação Final
O arquivo `CÓDIGO_FINAL_TRACTO.md` contém a consolidação técnica de todo o projeto para fins de auditoria e backup.

---
**Desenvolvido por Antigravity para a Nexagro.**
