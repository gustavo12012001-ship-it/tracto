"""
(A-10) Observabilidade backend — inicialização guardada do Sentry.

Design:
- No-op se `SENTRY_DSN` não estiver definido (padrão), então nada muda em dev
  ou em ambientes sem observabilidade.
- Se o DSN estiver definido mas o pacote `sentry-sdk` não estiver instalado,
  apenas loga um aviso e segue — não derruba o boot.
- Com DSN + pacote, registra as integrações Starlette/FastAPI, que capturam
  automaticamente exceções não tratadas dos endpoints.

Para ativar em produção (Railway):
    1. (já em requirements.txt) `sentry-sdk[fastapi]`
    2. definir `SENTRY_DSN` nas variáveis de ambiente
"""

import logging
import os


def init_sentry() -> bool:
    """Inicializa o Sentry se configurado. Retorna True se ativado."""
    dsn = os.getenv("SENTRY_DSN")
    if not dsn:
        return False

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration
    except ImportError:
        logging.warning(
            "[sentry] SENTRY_DSN definido, mas 'sentry-sdk' não está instalado; "
            "observabilidade remota desativada. Rode: pip install 'sentry-sdk[fastapi]'"
        )
        return False

    try:
        sentry_sdk.init(
            dsn=dsn,
            environment=os.getenv("ENVIRONMENT", "production"),
            release=os.getenv("APP_VERSION"),
            traces_sample_rate=float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
            # Não enviar PII (emails/tokens) por padrão.
            send_default_pii=False,
            integrations=[StarletteIntegration(), FastApiIntegration()],
        )
        logging.info("[sentry] Observabilidade backend ativada (env=%s).",
                     os.getenv("ENVIRONMENT", "production"))
        return True
    except Exception as exc:  # noqa: BLE001
        logging.warning("[sentry] Falha ao inicializar Sentry: %s", exc)
        return False
