import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Fallback customizado opcional. Se ausente, usa o fallback padrão. */
  fallback?: ReactNode;
  /** Callback opcional (ex.: enviar para Sentry). */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isChunkError: boolean;
}

/**
 * (A-05) ErrorBoundary global.
 *
 * Captura exceções de render em qualquer subárvore React e mostra um fallback
 * amigável em vez de uma tela branca. Trata especificamente ChunkLoadError
 * (chunk lazy desatualizado após deploy) sugerindo recarregar a página.
 *
 * Erros assíncronos (event handlers, promises) NÃO são capturados por
 * ErrorBoundary — para esses, capturamos via window listeners no main.tsx.
 */
function isChunkLoadError(error: Error | null): boolean {
  if (!error) return false;
  const msg = `${error.name} ${error.message}`;
  return (
    /ChunkLoadError/i.test(msg) ||
    /Loading chunk [\d]+ failed/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg)
  );
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, isChunkError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, isChunkError: isChunkLoadError(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log local; integração com Sentry é injetada via prop onError (A-10).
    console.error('[ErrorBoundary] Erro capturado:', error, info);
    this.props.onError?.(error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.assign('/app/dashboard');
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    const { isChunkError } = this.state;

    return (
      <div
        role="alert"
        className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center"
        style={{ background: 'var(--bg)' }}
      >
        <div className="max-w-md flex flex-col items-center gap-4">
          <div
            aria-hidden="true"
            className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
            style={{ background: 'rgba(249,115,22,0.12)' }}
          >
            ⚠️
          </div>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
            {isChunkError ? 'Nova versão disponível' : 'Algo deu errado'}
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {isChunkError
              ? 'O aplicativo foi atualizado. Recarregue a página para carregar a versão mais recente.'
              : 'Encontramos um erro inesperado. Você pode tentar recarregar a página. Se o problema persistir, entre em contato com o suporte.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={this.handleReload}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
            >
              Recarregar página
            </button>
            {!isChunkError && (
              <button
                type="button"
                onClick={this.handleGoHome}
                className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2"
                style={{ color: 'var(--text)', borderColor: 'var(--border)' }}
              >
                Ir para o início
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
