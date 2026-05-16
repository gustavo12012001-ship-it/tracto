"""
services/billing_service.py — Resolve entitlements (limites/features) do usuário
baseado na assinatura ativa no Mercado Pago.

Fonte de verdade: tabela `plans` (entitlements) JOIN `subscriptions` (status ativo).
Fallback: free plan se sem assinatura ou plan_id desconhecido.
"""

import logging
import os
from typing import Any

import requests

_TIMEOUT = 8


def _headers() -> dict[str, str]:
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    return {"apikey": key, "Authorization": f"Bearer {key}"}


def _supabase_rest(table: str) -> str:
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    return f"{url}/rest/v1/{table}"


# Fallback entitlements caso o DB falhe ou plano não exista
_FREE_FALLBACK: dict[str, Any] = {
    "plan_id": "free",
    "plan_name": "Gratuito",
    "status": "active",
    "max_fields": 1,
    "max_farms": 1,
    "can_use_whatsapp": False,
    "can_use_push": False,
    "has_ia_chat": False,
    "has_satellite": False,
    "billing_cycle": None,
    "current_period_end": None,
    "trial_end_at": None,
}


class BillingService:
    """Entitlements baseados em assinatura ativa do Mercado Pago."""

    def get_user_plan(self, user_id: str) -> dict:
        """
        Retorna a assinatura ativa (status in pending/authorized/paused) ou None.
        """
        try:
            resp = requests.get(
                _supabase_rest("subscriptions"),
                headers=_headers(),
                params={
                    "user_id": f"eq.{user_id}",
                    "status": "in.(pending,authorized,paused)",
                    "order": "created_at.desc",
                    "limit": "1",
                    "select": "id,plan_id,status,billing_cycle,current_period_end,trial_end_at,mp_preapproval_id",
                },
                timeout=_TIMEOUT,
            )
            if not resp.ok:
                logging.warning("[billing] falha get_user_plan: %s", resp.status_code)
                return {"plan_id": "free", "status": "active"}
            rows = resp.json()
            if not rows:
                return {"plan_id": "free", "status": "active"}
            return rows[0]
        except Exception as exc:
            logging.warning("[billing] exceção get_user_plan: %s", exc)
            return {"plan_id": "free", "status": "active"}

    def get_plan_details(self, plan_id: str) -> dict | None:
        """Busca configuração do plano (max_fields, features, preço)."""
        try:
            resp = requests.get(
                _supabase_rest("plans"),
                headers=_headers(),
                params={"id": f"eq.{plan_id}", "limit": "1"},
                timeout=_TIMEOUT,
            )
            if not resp.ok or not resp.json():
                return None
            return resp.json()[0]
        except Exception as exc:
            logging.warning("[billing] exceção get_plan_details: %s", exc)
            return None

    def get_entitlements(self, user_id: str) -> dict:
        """
        Retorna o conjunto de entitlements (features + limites) do usuário,
        baseado na assinatura ATIVA. Cai pra Free se sem assinatura.

        Frontend usa pra mostrar/esconder features. Backend usa pra enforcement
        em endpoints sensíveis (criar field se max_fields atingido, etc).
        """
        sub = self.get_user_plan(user_id)
        plan_id = sub.get("plan_id", "free")
        plan = self.get_plan_details(plan_id)

        if not plan:
            # Plano desconhecido — fallback Free
            return _FREE_FALLBACK.copy()

        return {
            "plan_id": plan_id,
            "plan_name": plan.get("name", "Gratuito"),
            "status": sub.get("status", "active"),
            "max_fields": plan.get("max_fields", 1),
            "max_farms": plan.get("max_farms", 1),
            "can_use_whatsapp": bool(plan.get("has_whatsapp", False)),
            "can_use_push": bool(plan.get("has_push", False)),
            "has_ia_chat": bool(plan.get("has_ia_chat", False)),
            "has_satellite": bool(plan.get("has_satellite", False)),
            "billing_cycle": sub.get("billing_cycle"),
            "current_period_end": sub.get("current_period_end"),
            "trial_end_at": sub.get("trial_end_at"),
            "is_trial": bool(sub.get("trial_end_at")),
        }

    def check_field_limit(self, user_id: str, current_count: int) -> tuple[bool, str | None]:
        """
        Confirma se o usuário pode criar mais um talhão. Retorna (allowed, error_msg).
        """
        ent = self.get_entitlements(user_id)
        max_fields = ent.get("max_fields", 1)
        if current_count >= max_fields:
            return False, (
                f"Limite de {max_fields} talhão(ões) atingido no plano "
                f"{ent.get('plan_name', 'Gratuito')}. Faça upgrade pra adicionar mais."
            )
        return True, None


# Instância global
billing_service = BillingService()
