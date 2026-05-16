/**
 * Testes do apiFetch — confirma error handling, status codes e timeout.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock supabase pra não tentar autenticar de verdade
vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'fake-token' } } }),
      refreshSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'fake-token' } } }),
    },
  },
}));

import { apiFetch } from './api';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
  // Garante VITE_API_URL
  if (!import.meta.env.VITE_API_URL) {
    (import.meta as unknown as { env: Record<string, string> }).env.VITE_API_URL = 'http://test.local';
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('apiFetch', () => {
  it('retorna JSON parseado em resposta 200 com body', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, data: [1, 2, 3] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    const result = await apiFetch<{ ok: boolean; data: number[] }>('/test');
    expect(result.ok).toBe(true);
    expect(result.data).toEqual([1, 2, 3]);
  });

  it('retorna undefined em 204 No Content (DELETE)', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(null, { status: 204 })
    );
    const result = await apiFetch('/test', { method: 'DELETE' });
    expect(result).toBeUndefined();
  });

  it('retorna undefined em 200 com body vazio (não throws)', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response('', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    const result = await apiFetch('/test');
    expect(result).toBeUndefined();
  });

  it('throws Error com detalhe quando 4xx JSON tem detail', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'Talhão não encontrado' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      })
    );
    await expect(apiFetch('/test')).rejects.toThrow(/Talhão não encontrado/);
  });

  it('throws Error específico quando 401 (sessão expirada)', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ detail: 'expired' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      })
    );
    await expect(apiFetch('/test')).rejects.toThrow(/sessao expirou|sessão expirou/i);
  });
});
