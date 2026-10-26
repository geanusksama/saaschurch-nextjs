/**
 * Cliente do Engajamento. Tipos e chamadas — a UI não monta URL na mão.
 * Ver docs/modules/engajamento/SPEC.md.
 */
import { apiBase } from '../../lib/apiBase';

export type Situacao = 'AUSENTE' | 'DIMINUIU' | 'CONSTANTE' | 'VOLTOU' | 'NOVO';

export const SITUACOES: Array<{ id: Situacao; rotulo: string; dica: string; bg: string; fg: string }> = [
  { id: 'AUSENTE',   rotulo: 'Não apareceram', dica: 'Tinham presença na referência e nenhuma no período recente', bg: '#fee2e2', fg: '#b91c1c' },
  { id: 'DIMINUIU',  rotulo: 'Diminuíram',     dica: 'Ritmo recente caiu para menos da metade da referência',      bg: '#fef3c7', fg: '#a16207' },
  { id: 'CONSTANTE', rotulo: 'Constantes',     dica: 'Presentes nos dois períodos no mesmo ritmo',                  bg: '#dcfce7', fg: '#166534' },
  { id: 'VOLTOU',    rotulo: 'Voltaram',       dica: 'Sem presença na referência, mas com presença antes dela',     bg: '#e0e7ff', fg: '#3730a3' },
  { id: 'NOVO',      rotulo: 'Novos',          dica: 'Primeira presença registrada no período recente',             bg: '#f1f5f9', fg: '#334155' },
];

export interface Periodos {
  refIni: string;
  refFim: string;
  recIni: string;
  recFim: string;
}

export interface LinhaComparacao {
  chave: string;
  pessoaId: string | null;
  memberId: string | null;
  nome: string | null;
  foto: string | null;
  rol: number | null;
  celular: string | null;
  diasRef: number;
  diasRec: number;
  ultimaPresenca: string | null;
  situacao: Situacao;
}

export interface EventoLinhaDoTempo {
  dia: string;
  fonte: 'ROSTO' | 'MARCACAO';
  publicacaoId: string;
  titulo: string | null;
  permalink: string | null;
  imagem: string | null;
  rosto: string | null;
}

export interface Pessoa {
  id: string;
  nome: string | null;
  memberId: string | null;
  rol: number | null;
  foto: string | null;
  oculta: boolean;
  publicacoes: number;
  ultima: string | null;
}

export interface RostoDaPessoa {
  id: string;
  foto: string | null;
  publicacaoId: string;
  dataEvento: string;
  permalink: string | null;
  imagem: string | null;
}

export interface Publicacao {
  id: string;
  origem: 'INSTAGRAM' | 'MANUAL';
  tipo: string | null;
  titulo: string | null;
  legenda: string | null;
  permalink: string | null;
  dataEvento: string;
  publicadoEm: string | null;
  imagens: string[];
  churchId: string | null;
  igreja: string | null;
  marcados?: number;
  semCadastro?: number;
}

export interface Marcacao {
  id: string;
  memberId: string | null;
  nome: string;
  instagram: string | null;
  imagemIndice: number;
  rol: number | null;
  igreja: string | null;
}

export interface MembroBusca {
  id: string;
  nome: string;
  rol: number | null;
  igreja: string | null;
  titulo: string | null;
}

export interface ContaInstagram {
  /** App da Meta configurado no servidor; sem ele não há "Entrar com Instagram". */
  appId: string | null;
  conectado: boolean;
  username: string | null;
  churchId: string | null;
  igreja: string | null;
  tokenExpiraEm: string | null;
  ultimaSincronizacao: string | null;
  ultimoErro: string | null;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('mrm_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const ehForm = init?.body instanceof FormData;
  const res = await fetch(`${apiBase}${path}`, {
    cache: 'no-store',
    ...init,
    headers: {
      ...(ehForm ? {} : { 'Content-Type': 'application/json' }),
      ...authHeaders(),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  const texto = await res.text();
  let corpo: { error?: string } | null = null;
  try { corpo = texto ? JSON.parse(texto) : null; } catch { /* resposta não-JSON */ }
  if (!res.ok) throw new Error(corpo?.error || `Falha na requisição (${res.status}).`);
  return corpo as T;
}

function qs(params: Record<string, string | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export interface FiltroComparativo extends Periodos {
  soDomingos: boolean;
}

function qsFiltro(f: FiltroComparativo, extra: Record<string, string> = {}) {
  return qs({ refIni: f.refIni, refFim: f.refFim, recIni: f.recIni, recFim: f.recFim, soDomingos: f.soDomingos ? '1' : null, ...extra });
}

export const engajamentoApi = {
  comparativo: (f: FiltroComparativo) =>
    req<{ linhas: LinhaComparacao[] }>(`/engajamento/comparativo${qsFiltro(f)}`),
  linhaDoTempo: (chave: string, f: FiltroComparativo) =>
    req<{ eventos: EventoLinhaDoTempo[] }>(`/engajamento/comparativo/historico${qsFiltro(f, { chave })}`),

  publicacoes: (f: { de: string; ate: string; churchId: string | null; q: string; pendentes: boolean }) =>
    req<{ publicacoes: Publicacao[] }>(`/engajamento/publicacoes${qs({ de: f.de, ate: f.ate, churchId: f.churchId, q: f.q, pendentes: f.pendentes ? '1' : null })}`),
  publicacao: (id: string) => req<{ publicacao: Publicacao; marcacoes: Marcacao[] }>(`/engajamento/publicacoes/${id}`),
  novaPublicacao: (form: FormData) => req<{ id: string }>('/engajamento/publicacoes', { method: 'POST', body: form }),
  editarPublicacao: (id: string, dados: { dataEvento?: string; churchId?: string | null; titulo?: string | null }) =>
    req<{ ok: true }>(`/engajamento/publicacoes/${id}`, { method: 'PATCH', body: JSON.stringify(dados) }),
  excluirPublicacao: (id: string) => req<{ ok: true }>(`/engajamento/publicacoes/${id}`, { method: 'DELETE' }),
  marcar: (id: string, dados: { memberId?: string; nome?: string; instagram?: string; imagemIndice: number }) =>
    req<{ id: string }>(`/engajamento/publicacoes/${id}/marcacoes`, { method: 'POST', body: JSON.stringify(dados) }),
  desmarcar: (id: string, marcacaoId: string) =>
    req<{ ok: true }>(`/engajamento/publicacoes/${id}/marcacoes/${marcacaoId}`, { method: 'DELETE' }),
  buscarMembros: (q: string) => req<{ membros: MembroBusca[] }>(`/engajamento/membros${qs({ q })}`),

  conta: () => req<ContaInstagram>('/engajamento/instagram'),
  /** Volta do login do Instagram: troca o code pelo token no servidor. */
  concluirLogin: (code: string, redirectUri: string) =>
    req<ContaInstagram>('/engajamento/instagram', { method: 'POST', body: JSON.stringify({ code, redirectUri }) }),
  desconectar: () => req<ContaInstagram>('/engajamento/instagram', { method: 'DELETE' }),
  sincronizar: (dias: number) =>
    req<{ novas: number; atualizadas: number; falhas: number; restam: boolean; encontradas: number }>(
      '/engajamento/instagram/sincronizar', { method: 'POST', body: JSON.stringify({ dias }) }),

  rostosPendentes: () =>
    req<{ restantes: number; publicacoes: Array<{ id: string; dataEvento: string; imagens: string[] }> }>('/engajamento/rostos/pendentes'),
  gravarRostos: (publicacaoId: string, rostos: unknown[]) =>
    req<{ rostos: number; pessoasNovas: number }>('/engajamento/rostos', { method: 'POST', body: JSON.stringify({ publicacaoId, rostos }) }),
  apagarRostos: () => req<{ ok: true; recortesApagados: number }>('/engajamento/rostos', { method: 'DELETE' }),
  tirarRosto: (rostoId: string) => req<{ ok: true }>(`/engajamento/rostos/${rostoId}`, { method: 'DELETE' }),

  pessoas: (filtro: string, q: string) => req<{ pessoas: Pessoa[] }>(`/engajamento/pessoas${qs({ filtro, q })}`),
  pessoa: (id: string) => req<{ pessoa: Pessoa & { nomeLivre: string | null }; rostos: RostoDaPessoa[] }>(`/engajamento/pessoas/${id}`),
  editarPessoa: (id: string, dados: { nome?: string | null; memberId?: string | null; oculta?: boolean; foto?: string }) =>
    req<{ ok: true }>(`/engajamento/pessoas/${id}`, { method: 'PATCH', body: JSON.stringify(dados) }),
  juntarPessoas: (id: string, outraId: string) =>
    req<{ ok: true }>(`/engajamento/pessoas/${id}/juntar`, { method: 'POST', body: JSON.stringify({ outraId }) }),
};

// ─── datas ──────────────────────────────────────────────────────────────────

/** YYYY-MM-DD no fuso local. */
export function ymd(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00`);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export function dataBr(dia: string | null | undefined): string {
  if (!dia) return '—';
  const [a, m, d] = dia.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

export function diasAtras(dia: string | null): string {
  if (!dia) return '';
  const n = Math.round((Date.parse(`${ymd(new Date())}T12:00:00`) - Date.parse(`${dia}T12:00:00`)) / 86_400_000);
  if (n <= 0) return 'hoje';
  if (n === 1) return 'ontem';
  return `há ${n} dias`;
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}
