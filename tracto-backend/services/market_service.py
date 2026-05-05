"""
market_service.py — Cotações de commodities em tempo real.

Fontes:
  - yfinance → preços CBOT (soja ZS=F, milho ZC=F, café KC=F, ouro GC=F, petróleo CL=F)
  - awesomeapi → câmbio USD/BRL spot
  - Valores estáticos com live=False para boi gordo, ureia e frango.

Cache: 30 minutos em memória.
"""

import asyncio
import logging
import time
from typing import Any

import httpx

# Cache em memória: {"data": list, "ts": float}
_CACHE: dict[str, Any] = {}
_CACHE_TTL_SECONDS = 30 * 60  # 30 minutos

# ---------------------------------------------------------------------------
# Conversão de unidades CBOT → mercado brasileiro
# ---------------------------------------------------------------------------
# Soja/Milho CBOT: cotados em cents/bushel.
#   1 bushel soja  ≈ 27.2155 kg  →  sc 60kg = 60 / 27.2155 bushels
#   1 bushel milho ≈ 25.4012 kg  →  sc 60kg = 60 / 25.4012 bushels
#   price_cbot em cents/bushel → price_cbot / 100 = USD/bushel
#   R$/sc60 = (price_cbot/100) * (60/kg_per_bushel) * usd_brl
_KG_PER_BUSHEL_SOJA = 27.2155
_KG_PER_BUSHEL_MILHO = 25.4012

# Café CBOT (KC=F): cotado em cents/lb.
#   sc 60kg = 132.277 lb  →  R$/sc60 = (price_cents/100) * 132.277 * usd_brl
_LB_PER_SC60_CAFE = 132.277

# Ouro (GC=F): USD/troy oz → mantemos USD/oz, convertemos para BRL
# Petróleo (CL=F): USD/barril → convertemos para BRL


def _cents_per_bushel_to_brl_sc60(price_cents: float, kg_per_bushel: float, usd_brl: float) -> float:
    price_usd_bushel = price_cents / 100.0
    bushels_per_sc60 = 60.0 / kg_per_bushel
    return price_usd_bushel * bushels_per_sc60 * usd_brl


def _cents_per_lb_to_brl_sc60(price_cents: float, lb_per_sc60: float, usd_brl: float) -> float:
    price_usd_lb = price_cents / 100.0
    return price_usd_lb * lb_per_sc60 * usd_brl


def _usd_to_brl(price_usd: float, usd_brl: float) -> float:
    return price_usd * usd_brl


def _fmt(value: float) -> str:
    """Formata número no padrão brasileiro: 1.234,56"""
    return f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


# ---------------------------------------------------------------------------
# Busca assíncrona de câmbio
# ---------------------------------------------------------------------------

async def _fetch_usd_brl() -> float:
    """Retorna a taxa USD/BRL spot. Fallback: 5.20."""
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get("https://economia.awesomeapi.com.br/json/last/USD-BRL")
            resp.raise_for_status()
            data = resp.json()
            rate = float(data["USDBRL"]["bid"])
            logging.info("[market_service] USD/BRL spot=%.4f", rate)
            return rate
    except Exception as exc:
        logging.warning("[market_service] Falha ao buscar USD/BRL: %s — usando fallback 5.20", exc)
        return 5.20


# ---------------------------------------------------------------------------
# Busca de preços via yfinance (síncrono, rodamos em thread)
# ---------------------------------------------------------------------------

def _fetch_yfinance_prices() -> dict[str, dict]:
    """
    Retorna dict ticker → {price, prev_close, change_pct, live}.
    Executa de forma síncrona (chamado via asyncio.to_thread).
    """
    tickers_needed = ["ZS=F", "ZC=F", "KC=F", "GC=F", "CL=F"]
    results: dict[str, dict] = {}

    try:
        import yfinance as yf  # importação local para não falhar se ausente
        data = yf.download(
            tickers=" ".join(tickers_needed),
            period="2d",
            interval="1d",
            progress=False,
            auto_adjust=True,
            threads=True,
        )
        close_df = data.get("Close") if hasattr(data, "get") else None
        if close_df is None:
            # yfinance retornou DataFrame diretamente
            try:
                close_df = data["Close"]
            except Exception:
                close_df = None

        for ticker in tickers_needed:
            try:
                if close_df is not None and ticker in close_df.columns:
                    series = close_df[ticker].dropna()
                    if len(series) >= 2:
                        price = float(series.iloc[-1])
                        prev = float(series.iloc[-2])
                        change_pct = ((price - prev) / prev) * 100.0 if prev else 0.0
                        results[ticker] = {"price": price, "prev_close": prev, "change_pct": change_pct, "live": True}
                        continue
                    elif len(series) == 1:
                        price = float(series.iloc[-1])
                        results[ticker] = {"price": price, "prev_close": price, "change_pct": 0.0, "live": True}
                        continue
            except Exception as exc:
                logging.warning("[market_service] Erro ao extrair %s do DataFrame: %s", ticker, exc)

            # Fallback: Ticker individual
            try:
                tk = yf.Ticker(ticker)
                info = tk.fast_info
                price = float(getattr(info, "last_price", None) or 0)
                prev = float(getattr(info, "previous_close", None) or price)
                if price and price > 0:
                    change_pct = ((price - prev) / prev) * 100.0 if prev else 0.0
                    results[ticker] = {"price": price, "prev_close": prev, "change_pct": change_pct, "live": True}
                else:
                    results[ticker] = {"price": 0.0, "prev_close": 0.0, "change_pct": 0.0, "live": False}
            except Exception as exc2:
                logging.warning("[market_service] yfinance fallback falhou para %s: %s", ticker, exc2)
                results[ticker] = {"price": 0.0, "prev_close": 0.0, "change_pct": 0.0, "live": False}

    except ImportError:
        logging.warning("[market_service] yfinance não instalado — usando valores estáticos.")
        for ticker in tickers_needed:
            results[ticker] = {"price": 0.0, "prev_close": 0.0, "change_pct": 0.0, "live": False}
    except Exception as exc:
        logging.warning("[market_service] Erro geral no yfinance: %s", exc)
        for ticker in tickers_needed:
            results.setdefault(ticker, {"price": 0.0, "prev_close": 0.0, "change_pct": 0.0, "live": False})

    return results


# ---------------------------------------------------------------------------
# Valores estáticos de fallback (live=False)
# ---------------------------------------------------------------------------

_STATIC_FALLBACKS = {
    # ticker → (price_brl_formatted, change_pct)
    "ZS=F": ("149,50", 0.0),   # Soja R$/sc 60kg
    "ZC=F": ("68,20", 0.0),    # Milho R$/sc 60kg
    "KC=F": ("1.890,00", 0.0), # Café R$/sc 60kg
    "GC=F": ("18.200,00", 0.0), # Ouro R$/oz
    "CL=F": ("410,00", 0.0),   # Petróleo R$/barril
}

_STATIC_COMMODITIES = [
    {
        "name": "Boi Gordo",
        "place": "B3 (arroba)",
        "price": "298,50",
        "change": 0.0,
        "category": "pecuaria",
        "live": False,
    },
    {
        "name": "Ureia",
        "place": "Porto (ton)",
        "price": "2.150,00",
        "change": 0.0,
        "category": "insumos",
        "live": False,
    },
    {
        "name": "Frango Inteiro",
        "place": "Sudeste (kg)",
        "price": "6,80",
        "change": 0.0,
        "category": "proteina",
        "live": False,
    },
]


# ---------------------------------------------------------------------------
# Montagem da lista final
# ---------------------------------------------------------------------------

def _build_quotes(yf_prices: dict[str, dict], usd_brl: float) -> list[dict]:
    quotes: list[dict] = []

    # --- Soja CBOT ---
    soja = yf_prices.get("ZS=F", {})
    if soja.get("live") and soja["price"] > 0:
        price_brl = _cents_per_bushel_to_brl_sc60(soja["price"], _KG_PER_BUSHEL_SOJA, usd_brl)
        quotes.append({
            "name": "Soja",
            "place": "Paranaguá (sc 60kg)",
            "price": _fmt(price_brl),
            "change": round(soja["change_pct"], 2),
            "category": "graos",
            "live": True,
        })
    else:
        fallback_price, fallback_change = _STATIC_FALLBACKS["ZS=F"]
        quotes.append({
            "name": "Soja",
            "place": "Paranaguá (sc 60kg)",
            "price": fallback_price,
            "change": fallback_change,
            "category": "graos",
            "live": False,
        })

    # --- Milho CBOT ---
    milho = yf_prices.get("ZC=F", {})
    if milho.get("live") and milho["price"] > 0:
        price_brl = _cents_per_bushel_to_brl_sc60(milho["price"], _KG_PER_BUSHEL_MILHO, usd_brl)
        quotes.append({
            "name": "Milho",
            "place": "Campinas (sc 60kg)",
            "price": _fmt(price_brl),
            "change": round(milho["change_pct"], 2),
            "category": "graos",
            "live": True,
        })
    else:
        fallback_price, fallback_change = _STATIC_FALLBACKS["ZC=F"]
        quotes.append({
            "name": "Milho",
            "place": "Campinas (sc 60kg)",
            "price": fallback_price,
            "change": fallback_change,
            "category": "graos",
            "live": False,
        })

    # --- Café Arábica CBOT ---
    cafe = yf_prices.get("KC=F", {})
    if cafe.get("live") and cafe["price"] > 0:
        price_brl = _cents_per_lb_to_brl_sc60(cafe["price"], _LB_PER_SC60_CAFE, usd_brl)
        quotes.append({
            "name": "Café Arábica",
            "place": "BMEF (sc 60kg)",
            "price": _fmt(price_brl),
            "change": round(cafe["change_pct"], 2),
            "category": "tropicais",
            "live": True,
        })
    else:
        fallback_price, fallback_change = _STATIC_FALLBACKS["KC=F"]
        quotes.append({
            "name": "Café Arábica",
            "place": "BMEF (sc 60kg)",
            "price": fallback_price,
            "change": fallback_change,
            "category": "tropicais",
            "live": False,
        })

    # --- Ouro ---
    ouro = yf_prices.get("GC=F", {})
    if ouro.get("live") and ouro["price"] > 0:
        price_brl = _usd_to_brl(ouro["price"], usd_brl)
        quotes.append({
            "name": "Ouro",
            "place": "NY (oz)",
            "price": _fmt(price_brl),
            "change": round(ouro["change_pct"], 2),
            "category": "metais",
            "live": True,
        })
    else:
        fallback_price, fallback_change = _STATIC_FALLBACKS["GC=F"]
        quotes.append({
            "name": "Ouro",
            "place": "NY (oz)",
            "price": fallback_price,
            "change": fallback_change,
            "category": "metais",
            "live": False,
        })

    # --- Petróleo WTI ---
    petroleo = yf_prices.get("CL=F", {})
    if petroleo.get("live") and petroleo["price"] > 0:
        price_brl = _usd_to_brl(petroleo["price"], usd_brl)
        quotes.append({
            "name": "Petróleo WTI",
            "place": "NYMEX (barril)",
            "price": _fmt(price_brl),
            "change": round(petroleo["change_pct"], 2),
            "category": "energia",
            "live": True,
        })
    else:
        fallback_price, fallback_change = _STATIC_FALLBACKS["CL=F"]
        quotes.append({
            "name": "Petróleo WTI",
            "place": "NYMEX (barril)",
            "price": fallback_price,
            "change": fallback_change,
            "category": "energia",
            "live": False,
        })

    # Commodities estáticas
    quotes.extend(_STATIC_COMMODITIES)

    return quotes


# ---------------------------------------------------------------------------
# Ponto de entrada público
# ---------------------------------------------------------------------------

async def get_market_quotes() -> list[dict]:
    """
    Retorna cotações de commodities. Cache de 30 minutos em memória.
    Nunca lança exceção — retorna fallback completo em caso de erro.
    """
    now = time.monotonic()
    cached = _CACHE.get("quotes")
    if cached and (now - cached["ts"]) < _CACHE_TTL_SECONDS:
        logging.debug("[market_service] Cache HIT (%.0fs restantes)", _CACHE_TTL_SECONDS - (now - cached["ts"]))
        return cached["data"]

    try:
        usd_brl, yf_prices = await asyncio.gather(
            _fetch_usd_brl(),
            asyncio.to_thread(_fetch_yfinance_prices),
        )
        quotes = _build_quotes(yf_prices, usd_brl)
    except Exception as exc:
        logging.error("[market_service] Erro ao montar cotações: %s — retornando fallback total", exc)
        quotes = _build_full_fallback()

    _CACHE["quotes"] = {"data": quotes, "ts": now}
    return quotes


def _build_full_fallback() -> list[dict]:
    """Retorna lista de fallback estático completa quando tudo falha."""
    static_live = [
        {"name": "Soja", "place": "Paranaguá (sc 60kg)", "price": _STATIC_FALLBACKS["ZS=F"][0], "change": 0.0, "category": "graos", "live": False},
        {"name": "Milho", "place": "Campinas (sc 60kg)", "price": _STATIC_FALLBACKS["ZC=F"][0], "change": 0.0, "category": "graos", "live": False},
        {"name": "Café Arábica", "place": "BMEF (sc 60kg)", "price": _STATIC_FALLBACKS["KC=F"][0], "change": 0.0, "category": "tropicais", "live": False},
        {"name": "Ouro", "place": "NY (oz)", "price": _STATIC_FALLBACKS["GC=F"][0], "change": 0.0, "category": "metais", "live": False},
        {"name": "Petróleo WTI", "place": "NYMEX (barril)", "price": _STATIC_FALLBACKS["CL=F"][0], "change": 0.0, "category": "energia", "live": False},
    ]
    return static_live + list(_STATIC_COMMODITIES)
