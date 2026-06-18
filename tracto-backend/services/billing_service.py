"""
services/billing_service.py â€” Resolve entitlements (limites/features) do usuÃ¡rio
baseado na assinatura ativa no Mercado Pago.

Fonte de verdade: tabela `plans` (entitlements) JOIN `subscriptions` (status ativo).
Fallback: free plan se sem assinatura ou plan_id desconhecido.
"""

import logging
import os
from datetime import datetime, timezone
from typing import Any

import requests

_TIMEOUT = 8


def _headers() -> dict[str, str]:
    key = os.getenv("SUPABASE_SERVICE_KEY", "")
    return {"apikey": key, "Authorization": f"Bearer {key}"}


def _supabase_rest(table: str) -> str:
    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    return f"{url}/rest/v1/{table}"


# Fallback entitlements caso o DB falhe ou plano nÃ£o exista
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
    "current_fields": 0,
    "is_trial": False,
}

# â”€â”€ Allowlist de DONO/ADMIN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# Donos da plataforma recebem acesso TOTAL, ignorando plano/assinatura.
# ConfigurÃ¡vel por ambiente (sem segredos): OWNER_EMAILS e/ou OWNER_USER_IDS
# (separados por vÃ­rgula). DEFAULT_OWNER_EMAILS Ã© uma lista fixa no cÃ³digo para
# funcionar sem precisar mexer no Railway. E-mails nÃ£o sÃ£o segredos.
DEFAULT_OWNER_EMAILS: list[str] = [
    # Donos fixos da plataforma (preenchido a pedido do prÃ³prio dono).
    "gustavo12012001@gmail.com",  # Gustavo Rocha â€” dono
]

_OWNER_FULL_ACCESS: dict[str, Any] = {
    "plan_id": "owner",
    "plan_name": "Acesso Total (Dono)",
    "status": "active",
    "max_fields": 1_000_000,
    "max_farms": 1_000_000,
    "can_use_whatsapp": True,
    "can_use_push": True,
    "has_ia_chat": True,
    "has_satellite": True,
    "billing_cycle": None,
    "current_period_end": None,
    "trial_end_at": None,
    "current_fields": 0,
    "is_trial": False,
    "is_owner": True,
}


def _owner_emails() -> set[str]:
    env = os.getenv("OWNER_EMAILS", "")
    emails = {e.strip().lower() for e in env.split(",") if e.strip()}
    emails.update(e.strip().lower() for e in DEFAULT_OWNER_EMAILS if e.strip())
    return emails


def _owner_user_ids() -> set[str]:
    env = os.getenv("OWNER_USER_IDS", "")
    return {u.strip() for u in env.split(",") if u.strip()}


def is_owner(user_id: str | None, email: str | None = None) -> bool:
    """True se o usuÃ¡rio Ã© dono/admin (acesso total, ignora plano)."""
    if user_id and user_id in _owner_user_ids():
        return True
    if email and email.strip().lower() in _owner_emails():
        return True
    return False

# Cache de entitlements por user_id com TTL de 60s â€” evita 2 HTTP requests ao
# Supabase por request ao /api/chat. (A-03) O armazenamento agora Ã© o cache
# compartilhado (services.shared_cache): Redis se REDIS_URL existir, senÃ£o local.
_ent_cache_ttl: float = 60.0


def _is_trial_active(trial_end_at: str | None) -> bool:
    """Retorna True somente se trial_end_at existe e ainda nÃ£o expirou (UTC)."""
    if not trial_end_at:
        return False
    try:
        end = datetime.fromisoformat(trial_end_at.replace("Z", "+00:00"))
        if end.tzinfo is None:
            end = end.replace(tzinfo=timezone.utc)
        return end > datetime.now(timezone.utc)
    except (ValueError, TypeError, AttributeError):
        return False


def validate_cpf(cpf: str) -> bool:
    """Valida CPF com dÃ­gitos verificadores (MÃ³dulo 11). Rejeita sequÃªncias uniformes."""
    digits = "".join(c for c in cpf if c.isdigit())
    if len(digits) != 11 or len(set(digits)) == 1:
        return False
    # Primeiro dÃ­gito verificador
    total = sum(int(digits[i]) * (10 - i) for i in range(9))
    r = (total * 10) % 11
    if r == 10:
        r = 0
    if r != int(digits[9]):
        return False
    # Segundo dÃ­gito verificador
    total = sum(int(digits[i]) * (11 - i) for i in range(10))
    r = (total * 10) % 11
    if r == 10:
        r = 0
    return r == int(digits[10])


def validate_cnpj(cnpj: str) -> bool:
    """Valida CNPJ com dÃ­gitos verificadores (MÃ³dulo 11). Rejeita sequÃªncias uniformes."""
    digits = "".join(c for c in cnpj if c.isdigit())
    if len(digits) != 14 or len(set(digits)) == 1:
        return False

    def _check(d: str, weights: list[int]) -> bool:
        total = sum(int(d[i]) * weights[i] for i in range(len(weights)))
        r = total % 11
        expected = 0 if r < 2 else 11 - r
        return expected == int(d[len(weights)])

    return _check(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) and \
           _check(digits, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])



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
            logging.warning("[billing] exceÃ§Ã£o get_user_plan: %s", exc)
            return {"plan_id": "free", "status": "active"}

    def get_plan_details(self, plan_id: str) -> dict | None:
        """Busca configuraÃ§Ã£o do plano (max_fields, features, preÃ§o)."""
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
            logging.warning("[billing] exceÃ§Ã£o get_plan_details: %s", exc)
            return None

    def count_fields(self, user_id: str) -> int:
        """Conta talhÃµes atuais do usuÃ¡rio para compor entitlements."""
        try:
            resp = requests.get(
                _supabase_rest("fields"),
                headers={**_headers(), "Prefer": "count=exact"},
                params={"user_id": f"eq.{user_id}", "select": "id"},
                timeout=_TIMEOUT,
            )
            if not resp.ok:
                logging.warning("[billing] falha count_fields: %s", resp.status_code)
                return 0
            content_range = resp.headers.get("content-range", "")
            if "/" in content_range:
                total = content_range.rsplit("/", 1)[-1]
                if total.isdigit():
                    return int(total)
            return len(resp.json())
        except Exception as exc:
            logging.warning("[billing] exceÃ§Ã£o count_fields: %s", exc)
            return 0

    def _compute_entitlements(self, user_id: str) -> dict:
        """Busca entitlements frescos no Supabase (sem cache)."""
        sub = self.get_user_plan(user_id)
        plan_id = sub.get("plan_id", "free")
        plan = self.get_plan_details(plan_id)

        if not plan:
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
            "current_fields": self.count_fields(user_id),
            # is_trial = True somente enquanto a data de tÃ©rmino ainda nÃ£o chegou
            "is_trial": _is_trial_active(sub.get("trial_end_at")),
        }

    def get_entitlements(self, user_id: str, email: str | None = None) -> dict:
        """
        Retorna o conjunto de entitlements do usuÃ¡rio com cache TTL de 60s.

        Frontend usa pra mostrar/esconder features. Backend usa pra enforcement
        em endpoints sensÃ­veis (satÃ©lite, IA, WhatsApp, limite de talhÃµes).

        Donos (allowlist) recebem ACESSO TOTAL, ignorando plano e cache.

        (A-03) Usa o cache compartilhado: Redis quando REDIS_URL estÃ¡ definida
        (consistente entre instÃ¢ncias), senÃ£o cache local em memÃ³ria.
        """
        # Dono â†’ acesso total, sem consultar plano nem cache.
        if is_owner(user_id, email):
            return _OWNER_FULL_ACCESS.copy()

        from services.shared_cache import cache as _shared

        ckey = f"entitlements:{user_id}"
        cached = _shared.get_json(ckey)
        if isinstance(cached, dict):
            return cached.copy()

        result = self._compute_entitlements(user_id)
        _shared.set_json(ckey, result, ttl_seconds=_ent_cache_ttl)
        return result.copy()

    def invalidate_cache(self, user_id: str) -> None:
        """Remove entitlements do cache (chamar apÃ³s webhook de billing confirmado)."""
        from services.shared_cache import cache as _shared
        _shared.delete(f"entitlements:{user_id}")

    def check_field_limit(self, user_id: str, current_count: int, email: str | None = None) -> tuple[bool, str | None]:
        """
        Confirma se o usuÃ¡rio pode criar mais um talhÃ£o. Retorna (allowed, error_msg).
        """
        ent = self.get_entitlements(user_id, email)
        max_fields = ent.get("max_fields", 1)
        if current_count >= max_fields:
            return False, (
                f"Limite de {max_fields} talhÃ£o(Ãµes) atingido no plano "
                f"{ent.get('plan_name', 'Gratuito')}. FaÃ§a upgrade pra adicionar mais."
            )
        return True, None

# InstÃ¢ncia global
billing_service = BillingService()
