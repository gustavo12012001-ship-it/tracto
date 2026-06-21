"""
services/mercadopago_service.py — Integração com Mercado Pago.

Suporta:
- Criação de plano de assinatura (preapproval_plan)
- Criação de assinatura recorrente (preapproval)
- Cancelamento de assinatura
- Consulta de pagamento
- Validação de webhook signature

Docs oficiais:
- https://www.mercadopago.com.br/developers/pt/reference/subscriptions/_preapproval_plan/post
- https://www.mercadopago.com.br/developers/pt/reference/subscriptions/_preapproval/post
- https://www.mercadopago.com.br/developers/pt/docs/notifications/webhooks
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import os
from typing import Any

import httpx

# ── Configuração ─────────────────────────────────────────────────────────────
MP_BASE_URL = "https://api.mercadopago.com"
MP_TIMEOUT_SECONDS = 15.0


def _get_access_token() -> str:
    """
    Retorna o access token configurado (sandbox ou produção).
    Configure via env var MERCADO_PAGO_ACCESS_TOKEN na Vercel.
    """
    token = os.getenv("MERCADO_PAGO_ACCESS_TOKEN", "").strip()
    if not token:
        raise RuntimeError(
            "MERCADO_PAGO_ACCESS_TOKEN não configurada. "
            "Adicione a chave em Vercel > Environment Variables."
        )
    return token


def _is_sandbox() -> bool:
    """True se a chave configurada é de teste (sandbox)."""
    token = os.getenv("MERCADO_PAGO_ACCESS_TOKEN", "")
    return token.startswith("TEST-")


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {_get_access_token()}",
        "Content-Type": "application/json",
        "X-Idempotency-Key": "",  # preenchido por request quando necessário
    }


def get_environment() -> str:
    """Retorna 'sandbox' ou 'production' baseado na chave."""
    return "sandbox" if _is_sandbox() else "production"


# ── Webhook signature verification ──────────────────────────────────────────

def verify_webhook_signature(
    *,
    raw_body: bytes,
    x_signature_header: str | None,
    x_request_id_header: str | None,
    data_id: str | None,
) -> bool:
    """
    Verifica a assinatura HMAC SHA256 do webhook Mercado Pago.

    Mercado Pago envia o header `x-signature` no formato:
        ts=1234567890,v1=abc123hash

    O hash é HMAC-SHA256 sobre o template:
        id:{data.id};request-id:{x-request-id};ts:{ts};

    Docs: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks#securitybitabouttheorigin

    Args:
        raw_body: body original (não usado pra preapproval, mas útil pra outros eventos)
        x_signature_header: valor do header 'x-signature'
        x_request_id_header: valor do header 'x-request-id'
        data_id: id do recurso (vem na query string ?data.id=XXX ou no body)

    Returns:
        True se a assinatura é válida, False caso contrário.
    """
    secret = os.getenv("MERCADO_PAGO_WEBHOOK_SECRET", "").strip()
    is_production = os.getenv("ENVIRONMENT", "").lower() in ("production", "prod")
    if not secret:
        if is_production:
            # PRODUÇÃO sem secret = REJEITA. Não dá pra arriscar fraude monetária.
            logging.error(
                "[MP] MERCADO_PAGO_WEBHOOK_SECRET ausente em produção — webhook REJEITADO."
            )
            return False
        # Apenas em dev/sandbox: avisa mas aceita
        logging.warning(
            "[MP] MERCADO_PAGO_WEBHOOK_SECRET não configurada (modo dev). "
            "CONFIGURE EM PRODUÇÃO."
        )
        return True

    if not x_signature_header:
        logging.warning("[MP] Webhook sem header x-signature — rejeitado.")
        return False

    # Parse "ts=...,v1=..."
    parts = {}
    for pair in x_signature_header.split(","):
        if "=" in pair:
            k, v = pair.split("=", 1)
            parts[k.strip()] = v.strip()

    ts = parts.get("ts")
    v1 = parts.get("v1")
    if not ts or not v1:
        logging.warning("[MP] Header x-signature malformado: %s", x_signature_header)
        return False

    # Template HMAC
    template = f"id:{data_id};request-id:{x_request_id_header or ''};ts:{ts};"

    expected = hmac.new(
        secret.encode("utf-8"),
        template.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    is_valid = hmac.compare_digest(expected, v1)
    if not is_valid:
        logging.warning("[MP] Webhook signature inválida. Template: %s", template)
    return is_valid


# ── HTTP helpers ─────────────────────────────────────────────────────────────

async def _post(path: str, payload: dict, idempotency_key: str | None = None) -> dict:
    headers = _headers()
    if idempotency_key:
        headers["X-Idempotency-Key"] = idempotency_key
    async with httpx.AsyncClient(timeout=MP_TIMEOUT_SECONDS) as client:
        resp = await client.post(f"{MP_BASE_URL}{path}", headers=headers, json=payload)
        if resp.status_code >= 400:
            logging.error("[MP] POST %s falhou: %s %s", path, resp.status_code, resp.text[:500])
            try:
                detail = resp.json()
            except Exception:
                detail = {"raw": resp.text}
            raise MercadoPagoError(resp.status_code, detail)
        return resp.json()


async def _get(path: str) -> dict:
    async with httpx.AsyncClient(timeout=MP_TIMEOUT_SECONDS) as client:
        resp = await client.get(f"{MP_BASE_URL}{path}", headers=_headers())
        if resp.status_code >= 400:
            logging.error("[MP] GET %s falhou: %s %s", path, resp.status_code, resp.text[:500])
            try:
                detail = resp.json()
            except Exception:
                detail = {"raw": resp.text}
            raise MercadoPagoError(resp.status_code, detail)
        return resp.json()


async def _put(path: str, payload: dict) -> dict:
    async with httpx.AsyncClient(timeout=MP_TIMEOUT_SECONDS) as client:
        resp = await client.put(f"{MP_BASE_URL}{path}", headers=_headers(), json=payload)
        if resp.status_code >= 400:
            logging.error("[MP] PUT %s falhou: %s %s", path, resp.status_code, resp.text[:500])
            try:
                detail = resp.json()
            except Exception:
                detail = {"raw": resp.text}
            raise MercadoPagoError(resp.status_code, detail)
        return resp.json()


class MercadoPagoError(Exception):
    def __init__(self, status_code: int, detail: Any):
        self.status_code = status_code
        self.detail = detail
        super().__init__(f"Mercado Pago error {status_code}: {detail}")


# ── Preapproval plans (templates de assinatura) ──────────────────────────────

async def create_preapproval_plan(
    *,
    reason: str,
    amount_brl: float,
    frequency_months: int,
    back_url: str,
) -> dict:
    """
    Cria um PLANO de assinatura (template). Use uma vez por plano (Pro/Enterprise).
    Retorne o `id` e salve em plans.mp_plan_id_monthly/yearly.
    """
    payload = {
        "reason": reason,
        "auto_recurring": {
            "frequency": frequency_months,
            "frequency_type": "months",
            "transaction_amount": float(amount_brl),
            "currency_id": "BRL",
        },
        "back_url": back_url,
        "payment_methods_allowed": {
            "payment_types": [{"id": "credit_card"}],
        },
    }
    return await _post("/preapproval_plan", payload)


# ── Preapproval (assinatura individual de um usuário) ───────────────────────

async def create_preapproval(
    *,
    plan_id: str | None,
    payer_email: str,
    amount_brl: float,
    frequency_months: int,
    reason: str,
    external_reference: str,
    back_url: str,
    notification_url: str,
    trial_days: int = 0,
) -> dict:
    """
    Cria uma assinatura ativa pro usuário. Retorna `init_point` (URL pra redirect)
    + `id` da assinatura. Backend usa o ID pra atualizar via webhook.

    Args:
        plan_id: ID do preapproval_plan (opcional — se omitir cria standalone)
        payer_email: email do usuário (precisa ter conta MP ou criar na hora)
        amount_brl: valor periódico (R$)
        frequency_months: 1 (mensal) ou 12 (anual)
        reason: descrição cobrada (aparece pro usuário)
        external_reference: nosso ID interno (subscription_id UUID)
        back_url: URL pra onde o usuário volta após pagamento
        notification_url: URL do nosso webhook
        trial_days: dias de trial grátis (0 = cobra imediatamente)
    """
    from datetime import datetime, timedelta, timezone

    now = datetime.now(timezone.utc)
    start_date = now + timedelta(days=trial_days) if trial_days > 0 else now

    payload: dict[str, Any] = {
        "reason": reason,
        "external_reference": external_reference,
        "payer_email": payer_email,
        "back_url": back_url,
        "auto_recurring": {
            "frequency": frequency_months,
            "frequency_type": "months",
            "transaction_amount": float(amount_brl),
            "currency_id": "BRL",
            "start_date": start_date.strftime("%Y-%m-%dT%H:%M:%S.%fZ")[:-4] + "Z",
        },
        "status": "pending",
        "notification_url": notification_url,
    }
    if plan_id:
        payload["preapproval_plan_id"] = plan_id

    return await _post("/preapproval", payload, idempotency_key=external_reference)


async def create_pix_preference(
    *,
    title: str,
    amount_brl: float,
    payer_email: str,
    external_reference: str,
    success_url: str,
    pending_url: str,
    failure_url: str,
    notification_url: str,
) -> dict:
    """
    Cria checkout avulso por Pix. Nao e recorrente: o backend libera o periodo
    contratado quando o webhook do pagamento chegar como approved.
    """
    payload = {
        "items": [
            {
                "title": title,
                "quantity": 1,
                "currency_id": "BRL",
                "unit_price": float(amount_brl),
            }
        ],
        "payer": {"email": payer_email},
        "external_reference": external_reference,
        "back_urls": {
            "success": success_url,
            "pending": pending_url,
            "failure": failure_url,
        },
        "notification_url": notification_url,
        "payment_methods": {
            "default_payment_method_id": "pix",
            "excluded_payment_types": [
                {"id": "credit_card"},
                {"id": "debit_card"},
                {"id": "ticket"},
            ],
            "installments": 1,
        },
        "statement_descriptor": "TRACTO",
    }
    return await _post("/checkout/preferences", payload, idempotency_key=external_reference)


async def get_preapproval(mp_preapproval_id: str) -> dict:
    """Busca status atual da assinatura no MP."""
    return await _get(f"/preapproval/{mp_preapproval_id}")


async def cancel_preapproval(mp_preapproval_id: str) -> dict:
    """Cancela a assinatura (status='cancelled')."""
    return await _put(f"/preapproval/{mp_preapproval_id}", {"status": "cancelled"})


async def pause_preapproval(mp_preapproval_id: str) -> dict:
    """Pausa temporariamente (status='paused')."""
    return await _put(f"/preapproval/{mp_preapproval_id}", {"status": "paused"})


# ── Payments ────────────────────────────────────────────────────────────────

async def get_payment(payment_id: str) -> dict:
    """Busca detalhes de um pagamento pelo ID."""
    return await _get(f"/v1/payments/{payment_id}")


# ── Helpers ─────────────────────────────────────────────────────────────────

def brl_cents_to_decimal(cents: int) -> float:
    """Converte centavos pra reais decimais (1990 → 19.90)."""
    return round(cents / 100.0, 2)


def is_active_status(mp_status: str | None) -> bool:
    """Retorna True se o status MP corresponde a uma assinatura efetivamente ativa."""
    return mp_status in {"authorized", "active"}
