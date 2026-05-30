/**
 * (A-05) Testes do ErrorBoundary — fallback amigável e detecção de ChunkLoadError.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ErrorBoundary from './ErrorBoundary';

function Boom({ error }: { error: Error }): never {
  throw error;
}

beforeEach(() => {
  // ErrorBoundary loga via console.error — silencia ruído no output do teste.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('renderiza os filhos quando não há erro', () => {
    render(
      <ErrorBoundary>
        <p>conteúdo ok</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('conteúdo ok')).toBeDefined();
  });

  it('mostra fallback genérico em erro de render e chama onError', () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError}>
        <Boom error={new Error('falha qualquer')} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText('Algo deu errado')).toBeDefined();
    expect(screen.getByText('Recarregar página')).toBeDefined();
    expect(onError).toHaveBeenCalledOnce();
  });

  it('detecta ChunkLoadError e mostra mensagem de nova versão', () => {
    const chunkErr = new Error('Loading chunk 5 failed.');
    chunkErr.name = 'ChunkLoadError';
    render(
      <ErrorBoundary>
        <Boom error={chunkErr} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Nova versão disponível')).toBeDefined();
  });

  it('usa fallback customizado quando fornecido', () => {
    render(
      <ErrorBoundary fallback={<p>fallback custom</p>}>
        <Boom error={new Error('x')} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('fallback custom')).toBeDefined();
  });
});
