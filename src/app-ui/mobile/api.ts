/**
 * Chamadas das telas Mobile para /api/mobile/*. O campo vai sempre junto
 * (`campoId`): o servidor só o respeita para o master; os demais ficam no
 * próprio campo de qualquer jeito (src/lib/mobile/acesso.ts).
 */
import { apiBase } from '../../lib/apiBase';

function lerUsuario(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem('mrm_user') || '{}');
  } catch {
    return {};
  }
}

export function perfilAtual(): string {
  return String(lerUsuario().profileType || 'church');
}

function cabecalhos(json = true): Record<string, string> {
  const token = localStorage.getItem('mrm_token');
  return { ...(json ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

function comCampo(caminho: string): string {
  const campo = localStorage.getItem('mrm_active_field_id') || String(lerUsuario().campoId || '');
  if (!campo) return `${apiBase}/mobile/${caminho}`;
  return `${apiBase}/mobile/${caminho}${caminho.includes('?') ? '&' : '?'}campoId=${encodeURIComponent(campo)}`;
}

export async function api<T = unknown>(caminho: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const r = await fetch(comCampo(caminho), {
    method: init?.method ?? 'GET',
    headers: cabecalhos(),
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((dados as { error?: string }).error || `Erro ${r.status}`);
  return dados as T;
}

/** Sobe a imagem para o bucket do app e devolve a URL pública. */
export async function enviarImagem(arquivo: File, pasta: string): Promise<string> {
  const fd = new FormData();
  fd.append('file', arquivo);
  fd.append('pasta', pasta);
  const r = await fetch(comCampo('upload'), { method: 'POST', headers: cabecalhos(false), body: fd });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((dados as { error?: string }).error || 'Não foi possível enviar a imagem.');
  return (dados as { url: string }).url;
}

export interface Pagina<T> { linhas: T[]; total: number; pagina: number; pageSize: number }
