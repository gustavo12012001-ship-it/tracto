/**
 * (A-10) Observabilidade — wrapper fino sobre Sentry no frontend.
 *
 * Design:
 * - Zero dependência obrigatória: se `VITE_SENTRY_DSN` não estiver definido, ou
 *   se o pacote `@sentry/react` não estiver instalado, tudo vira no-op silencioso
 *   (apenas console). Assim o build e o `npm ci` continuam verdes sem o SDK.
 * - Para ATIVAR em produção:
 *     1. `npm i @sentry/react`
 *     2. definir `VITE_SENTRY_DSN` no Vercel (Environment Variables)
 *
 * O import é dinâmico com `@vite-ignore` para o Vite não exigir o pacote em
 * build/CI quando ele não está instalado.
 */

type SentryLike = {
  init: (opts: Record<string, unknown>) => void;
  captureException: (e: unknown, ctx?: Record<string, unknown>) => void;
};

let sentry: SentryLike | null = null;
let initialized = false;

const DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const ENV = (import.meta.env.MODE as string | undefined) ?? 'production';
const RELEASE = import.meta.env.VITE_APP_VERSION as string | undefined;

export async function initMonitoring(): Promise<void> {
  if (initialized) return;
  initialized = true;
  if (!DSN) return; // desativado por padrão

  try {
    // Specifier em variável + @vite-ignore: o pacote é opcional, então nem o
    // TypeScript (resolução estática) nem o Vite (bundling) exigem que ele exista.
    const spec = '@sentry/react';
    const mod = (await import(/* @vite-ignore */ spec)) as unknown as SentryLike;
    if (mod && typeof mod.init === 'function') {
      mod.init({
        dsn: DSN,
        environment: ENV,
        release: RELEASE,
        tracesSampleRate: 0.1,
        replaysSessionSampleRate: 0,
        replaysOnErrorSampleRate: 0,
      });
      sentry = mod;
    }
  } catch {
    // Pacote ausente ou falha de init → segue sem observabilidade remota.
    sentry = null;
  }
}

/** Captura uma exceção. Seguro chamar mesmo sem Sentry ativo. */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (sentry) {
    sentry.captureException(error, context ? { extra: context } : undefined);
  } else if (import.meta.env.DEV) {
    console.error('[monitoring] captureException:', error, context);
  }
}
