"""
market_service.py - cotacoes de commodities.

Fontes:
  - Yahoo Finance Chart API via HTTP para futuros CBOT/NYMEX.
  - AwesomeAPI para cambio USD/BRL spot.
  - Valores estaticos com live=False para boi gordo, ureia e frango.

Cache: 30 minutos em memoria.
"""

import logging
import time
from typing import Any

import httpx

_CACHE: dict[str, Any] = {}
_CACHE_TTL_SECONDS = 30 * 60

_KG_PER_BUSHEL_SOJA = 27.2155
_KG_PER_BUSHEL_MILHO = 25.4012
_LB_PER_SC60_CAFE = 132.277

_YAHOO_TICKERS = ["ZS=F", "ZC=F", "KC=F", "GC=F", "CL=F"]

_STATIC_FALLBACKS = {
    "ZS=F": ("149,50", 0.0),
    "ZC=F": ("68,20", 0.0),
    "KC=F": ("1.890,00", 0.0),
    "GC=F": ("18.200,00", 0.0),
    "CL=F": ("410,00", 0.0),
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
    return f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


async def _fetch_usd_brl() -> float:
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get("https://economia.awesomeapi.com.br/json/last/USD-BRL")
            resp.raise_for_status()
            rate = float(resp.json()["USDBRL"]["bid"])
            logging.info("[market_service] USD/BRL spot=%.4f", rate)
            return rate
    except Exception as exc:
        logging.warning("[market_service] Falha ao buscar USD/BRL: %s; usando fallback 5.20", exc)
        return 5.20


async def _fetch_yahoo_chart_prices() -> dict[str, dict]:
    results: dict[str, dict] = {
        ticker: {"price": 0.0, "prev_close": 0.0, "change_pct": 0.0, "live": False}
        for ticker in _YAHOO_TICKERS
    }

    async with httpx.AsyncClient(timeout=8, follow_redirects=True) as client:
        for ticker in _YAHOO_TICKERS:
            try:
                encoded = ticker.replace("=", "%3D")
                resp = await client.get(
                    f"https://query1.finance.yahoo.com/v8/finance/chart/{encoded}",
                    params={"range": "5d", "interval": "1d"},
                    headers={"User-Agent": "Tracto/1.0"},
                )
                resp.raise_for_status()
                result = (resp.json().get("chart", {}).get("result") or [None])[0]
                quote = (((result or {}).get("indicators") or {}).get("quote") or [{}])[0]
                closes = quote.get("close") or []
                values = [float(value) for value in closes if value is not None and float(value) > 0]
                if not values:
                    continue

                price = values[-1]
                prev = values[-2] if len(values) >= 2 else price
                change_pct = ((price - prev) / prev) * 100.0 if prev else 0.0
                results[ticker] = {
                    "price": price,
                    "prev_close": prev,
                    "change_pct": change_pct,
                    "live": True,
                }
            except Exception as exc:
                logging.warning("[market_service] Yahoo Chart falhou para %s: %s", ticker, exc)

    return results


def _build_quotes(prices: dict[str, dict], usd_brl: float) -> list[dict]:
    quotes: list[dict] = []

    soja = prices.get("ZS=F", {})
    if soja.get("live") and soja["price"] > 0:
        price_brl = _cents_per_bushel_to_brl_sc60(soja["price"], _KG_PER_BUSHEL_SOJA, usd_brl)
        quotes.append({
            "name": "Soja",
            "place": "Paranagua (sc 60kg)",
            "price": _fmt(price_brl),
            "change": round(soja["change_pct"], 2),
            "category": "graos",
            "live": True,
        })
    else:
        fallback_price, fallback_change = _STATIC_FALLBACKS["ZS=F"]
        quotes.append({"name": "Soja", "place": "Paranagua (sc 60kg)", "price": fallback_price, "change": fallback_change, "category": "graos", "live": False})

    milho = prices.get("ZC=F", {})
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
        quotes.append({"name": "Milho", "place": "Campinas (sc 60kg)", "price": fallback_price, "change": fallback_change, "category": "graos", "live": False})

    cafe = prices.get("KC=F", {})
    if cafe.get("live") and cafe["price"] > 0:
        price_brl = _cents_per_lb_to_brl_sc60(cafe["price"], _LB_PER_SC60_CAFE, usd_brl)
        quotes.append({
            "name": "Cafe Arabica",
            "place": "BMEF (sc 60kg)",
            "price": _fmt(price_brl),
            "change": round(cafe["change_pct"], 2),
            "category": "tropicais",
            "live": True,
        })
    else:
        fallback_price, fallback_change = _STATIC_FALLBACKS["KC=F"]
        quotes.append({"name": "Cafe Arabica", "place": "BMEF (sc 60kg)", "price": fallback_price, "change": fallback_change, "category": "tropicais", "live": False})

    ouro = prices.get("GC=F", {})
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
        quotes.append({"name": "Ouro", "place": "NY (oz)", "price": fallback_price, "change": fallback_change, "category": "metais", "live": False})

    petroleo = prices.get("CL=F", {})
    if petroleo.get("live") and petroleo["price"] > 0:
        price_brl = _usd_to_brl(petroleo["price"], usd_brl)
        quotes.append({
            "name": "Petroleo WTI",
            "place": "NYMEX (barril)",
            "price": _fmt(price_brl),
            "change": round(petroleo["change_pct"], 2),
            "category": "energia",
            "live": True,
        })
    else:
        fallback_price, fallback_change = _STATIC_FALLBACKS["CL=F"]
        quotes.append({"name": "Petroleo WTI", "place": "NYMEX (barril)", "price": fallback_price, "change": fallback_change, "category": "energia", "live": False})

    quotes.extend(_STATIC_COMMODITIES)
    return quotes


async def get_market_quotes() -> list[dict]:
    now = time.monotonic()
    cached = _CACHE.get("quotes")
    if cached and (now - cached["ts"]) < _CACHE_TTL_SECONDS:
        logging.debug("[market_service] Cache HIT (%.0fs restantes)", _CACHE_TTL_SECONDS - (now - cached["ts"]))
        return cached["data"]

    try:
        usd_brl = await _fetch_usd_brl()
        prices = await _fetch_yahoo_chart_prices()
        quotes = _build_quotes(prices, usd_brl)
    except Exception as exc:
        logging.error("[market_service] Erro ao montar cotacoes: %s; retornando fallback total", exc)
        quotes = _build_full_fallback()

    _CACHE["quotes"] = {"data": quotes, "ts": now}
    return quotes


def _build_full_fallback() -> list[dict]:
    static_live = [
        {"name": "Soja", "place": "Paranagua (sc 60kg)", "price": _STATIC_FALLBACKS["ZS=F"][0], "change": 0.0, "category": "graos", "live": False},
        {"name": "Milho", "place": "Campinas (sc 60kg)", "price": _STATIC_FALLBACKS["ZC=F"][0], "change": 0.0, "category": "graos", "live": False},
        {"name": "Cafe Arabica", "place": "BMEF (sc 60kg)", "price": _STATIC_FALLBACKS["KC=F"][0], "change": 0.0, "category": "tropicais", "live": False},
        {"name": "Ouro", "place": "NY (oz)", "price": _STATIC_FALLBACKS["GC=F"][0], "change": 0.0, "category": "metais", "live": False},
        {"name": "Petroleo WTI", "place": "NYMEX (barril)", "price": _STATIC_FALLBACKS["CL=F"][0], "change": 0.0, "category": "energia", "live": False},
    ]
    return static_live + list(_STATIC_COMMODITIES)
