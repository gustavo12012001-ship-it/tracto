/**
 * (A-01) Camada de persistência server-side para dados que viviam só no
 * localStorage (germoplasma, experimentos, avaliações, solo, blocos de pesquisa).
 *
 * Estratégia "write-through com cache local":
 *  - O backend (tabela user_app_data) é a FONTE DE VERDADE.
 *  - O localStorage vira CACHE (leituras síncronas continuam funcionando, então
 *    as páginas não precisam de refactor async arriscado).
 *  - `hydrateNamespace` roda no mount: puxa do backend e popula o localStorage;
 *    se o backend ainda estiver vazio mas houver dado local, faz a MIGRAÇÃO
 *    one-shot (sobe o localStorage para o backend).
 *  - `persist` grava no localStorage (sync) E dispara o upsert no backend
 *    (best-effort: se a rede falhar, o dado não se perde localmente).
 *
 * Tudo é escopado pelo usuário autenticado no backend (RLS/owner) — o cliente
 * nunca decide o user_id.
 */
import { apiFetch } from './api';

export type Namespace =
  | 'germoplasma'
  | 'experiments'
  | 'avaliacoes'
  | 'fenotipos'
  | 'soil'
  | 'research_blocks';

interface UserDataResponse<T> {
  namespace: string;
  data: T | null;
}

/** Busca o documento do namespace no backend (null se ainda não existe). */
export async function pullUserData<T>(namespace: Namespace): Promise<T | null> {
  const res = await apiFetch<UserDataResponse<T>>(`/api/user-data/${namespace}`, {
    method: 'GET',
    retries: 1,
  });
  return res.data ?? null;
}

/** Salva (upsert) o documento do namespace no backend. */
export async function pushUserData<T>(namespace: Namespace, data: T): Promise<void> {
  await apiFetch<UserDataResponse<T>>(`/api/user-data/${namespace}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
    retries: 1,
  });
}

function readLocal<T>(localKey: string): T | null {
  try {
    const raw = localStorage.getItem(localKey);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeLocal<T>(localKey: string, data: T): void {
  try {
    localStorage.setItem(localKey, JSON.stringify(data));
  } catch {
    /* cota cheia / modo privado — ignora, backend ainda guarda */
  }
}

/**
 * Sincroniza o namespace no mount da página.
 * Retorna o dado efetivo (backend tem prioridade) já gravado no cache local.
 *
 * @param namespace namespace do backend
 * @param localKey  chave do localStorage usada hoje pela página
 * @param isEmpty   opcional: decide se o dado local "conta" para migração
 */
export async function hydrateNamespace<T>(
  namespace: Namespace,
  localKey: string,
  isEmpty?: (d: T | null) => boolean,
): Promise<T | null> {
  let remote: T | null = null;
  try {
    remote = await pullUserData<T>(namespace);
  } catch {
    // Offline ou backend indisponível: usa o cache local como está.
    return readLocal<T>(localKey);
  }

  const local = readLocal<T>(localKey);
  const remoteEmpty = remote == null || (isEmpty ? isEmpty(remote) : false);
  const localHasData = local != null && !(isEmpty ? isEmpty(local) : false);

  if (remoteEmpty && localHasData) {
    // Migração one-shot: sobe o que existe localmente para o backend.
    try {
      await pushUserData<T>(namespace, local as T);
    } catch {
      /* best-effort; tentará de novo na próxima escrita */
    }
    return local;
  }

  // Backend é a fonte de verdade: hidrata o cache local.
  if (remote != null) {
    writeLocal<T>(localKey, remote);
  }
  return remote ?? local;
}

/**
 * Grava localmente (síncrono) e propaga ao backend (best-effort).
 * Use no lugar de `localStorage.setItem` nos save-helpers das páginas.
 */
export function persist<T>(namespace: Namespace, localKey: string, data: T): void {
  writeLocal<T>(localKey, data);
  // fire-and-forget: não bloqueia a UI; falha não perde o dado local.
  void pushUserData<T>(namespace, data).catch(() => {
    /* será re-tentado na próxima escrita / hidratação */
  });
}
