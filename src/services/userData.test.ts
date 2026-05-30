/**
 * (A-01) Testes do userData — write-through backend + migração one-shot.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./api', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from './api';
import { hydrateNamespace, persist, pullUserData } from './userData';

const mockedFetch = vi.mocked(apiFetch);

beforeEach(() => {
  localStorage.clear();
  mockedFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('hydrateNamespace', () => {
  it('hidrata o localStorage a partir do backend (backend é fonte de verdade)', async () => {
    mockedFetch.mockResolvedValueOnce({ namespace: 'soil', data: { a: 1 } } as never);
    const result = await hydrateNamespace<{ a: number }>('soil', 'soil-key');
    expect(result).toEqual({ a: 1 });
    expect(JSON.parse(localStorage.getItem('soil-key')!)).toEqual({ a: 1 });
  });

  it('migra dado local para o backend quando o backend está vazio', async () => {
    localStorage.setItem('soil-key', JSON.stringify({ local: true }));
    // 1ª chamada: GET → null; 2ª chamada: PUT (migração)
    mockedFetch
      .mockResolvedValueOnce({ namespace: 'soil', data: null } as never)
      .mockResolvedValueOnce({ namespace: 'soil', data: { local: true } } as never);

    const result = await hydrateNamespace('soil', 'soil-key');
    expect(result).toEqual({ local: true });
    // segunda chamada foi um PUT
    expect(mockedFetch).toHaveBeenCalledTimes(2);
    expect(mockedFetch.mock.calls[1][1]?.method).toBe('PUT');
  });

  it('cai para cache local quando o backend está offline', async () => {
    localStorage.setItem('soil-key', JSON.stringify({ cached: 1 }));
    mockedFetch.mockRejectedValueOnce(new Error('network'));
    const result = await hydrateNamespace('soil', 'soil-key');
    expect(result).toEqual({ cached: 1 });
  });
});

describe('persist', () => {
  it('grava local imediatamente e dispara PUT ao backend', async () => {
    mockedFetch.mockResolvedValue({ namespace: 'soil', data: {} } as never);
    persist('soil', 'soil-key', { x: 9 });
    // local é síncrono
    expect(JSON.parse(localStorage.getItem('soil-key')!)).toEqual({ x: 9 });
    // backend chamado (fire-and-forget)
    await Promise.resolve();
    expect(mockedFetch).toHaveBeenCalledWith(
      '/api/user-data/soil',
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});

describe('pullUserData', () => {
  it('retorna null quando o backend não tem dado', async () => {
    mockedFetch.mockResolvedValueOnce({ namespace: 'soil', data: null } as never);
    expect(await pullUserData('soil')).toBeNull();
  });
});
