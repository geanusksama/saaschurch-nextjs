/**
 * Cliente da Gestão de Culto. Tipos e chamadas — a UI não monta URL na mão.
 * Ver docs/modules/gestao-culto/SPEC.md, seção 5.
 */
import { apiBase } from '../../lib/apiBase';

export type Papel =
  | 'FINANCEIRO'
  | 'PRESENCA'
  | 'EXTRA'
  | 'APROVADOR_LOCAL'
  | 'APROVADOR_HOSPEDEIRA'
  | 'PRESIDENTE';

export type Bloco = 'FINANCEIRO' | 'PRESENCA' | 'EXTRA';
export type Nivel = 'LOCAL' | 'HOSPEDEIRA';
export type StatusCulto =
  | 'ABERTO'
  | 'AGUARDANDO_LOCAL'
  | 'APROVADO_LOCAL'
  | 'CONCLUIDO'
  | 'REJEITADO';

export const ROTULO_PAPEL: Record<Papel, string> = {
  FINANCEIRO: 'Tesoureiro (financeiro)',
  PRESENCA: 'Secretário / contagem de presença',
  EXTRA: 'Complemento (outro responsável)',
  APROVADOR_LOCAL: 'Dirigente da igreja',
  APROVADOR_HOSPEDEIRA: 'Dirigente da hospedeira',
  PRESIDENTE: 'Pastor Presidente',
};

export const ROTULO_BLOCO: Record<Bloco, string> = {
  FINANCEIRO: 'Financeiro',
  PRESENCA: 'Presença',
  EXTRA: 'Complemento',
};

export const ROTULO_STATUS: Record<StatusCulto, string> = {
  ABERTO: 'Aguardando envio',
  // O status diz de QUEM se espera a decisão. "Aguardando aprovação" não
  // informava se a bola estava com o dirigente da congregação ou com o da
  // hospedeira, e quem cobrava tinha de adivinhar.
  AGUARDANDO_LOCAL: 'Aguardando o dirigente da congregação',
  APROVADO_LOCAL: 'Aguardando o dirigente hospedeiro',
  CONCLUIDO: 'Concluído',
  REJEITADO: 'Devolvido',
};

/**
 * Colunas do Kanban — três, não uma por status.
 *
 * Cinco colunas obrigavam a varrer a tela para achar o que precisa de ação. O
 * que importa é: falta enviar, falta aprovar, fechou.
 *
 * `REJEITADO` cai em "Aguardando envio" de propósito: devolver é jogar de volta
 * para quem lançou. `APROVADO_LOCAL` fica em "Aguardando aprovação" porque
 * ainda depende da hospedeira. O estado exato continua no card e no detalhe.
 */
export interface ColunaKanban {
  chave: string;
  titulo: string;
  status: StatusCulto[];
}

export const COLUNAS_KANBAN: ColunaKanban[] = [
  { chave: 'enviar', titulo: 'Aguardando envio', status: ['ABERTO', 'REJEITADO'] },
  {
    chave: 'aprovar',
    titulo: 'Aguardando aprovação',
    status: ['AGUARDANDO_LOCAL', 'APROVADO_LOCAL'],
  },
  { chave: 'concluido', titulo: 'Concluído', status: ['CONCLUIDO'] },
];

export interface Lancamento {
  id: string;
  bloco: Bloco;
  enviadoEm: string | null;
  enviadoPorUser?: { id: string; fullName: string } | null;

  totalDizimos: string | number | null;
  totalOfertas: string | number | null;
  qtdDizimos: number | null;
  qtdOfertas: number | null;

  qtdHomens: number | null;
  qtdMulheres: number | null;
  qtdCriancas: number | null;
  qtdVisitantes: number | null;
  qtdConversoes: number | null;
  qtdReconciliacoes: number | null;
  qtdFamilias: number | null;
  cadeirasVazias: number | null;

  texto: string | null;
  anexoUrl: string | null;
  /** Recado do lançador para quem aprova. */
  observacao: string | null;
}

export interface Aprovacao {
  id: string;
  nivel: Nivel;
  decisao: 'APROVADO' | 'REJEITADO';
  motivo: string | null;
  decididoEm: string;
  aprovador?: { id: string; fullName: string } | null;
}

export interface Registro {
  id: string;
  churchId: string;
  dataCulto: string;
  /** "19:30" ou null quando não informada (registros anteriores à coluna). */
  horaInicio: string | null;
  horaFim: string | null;
  tipoCulto: string;
  status: StatusCulto;
  observacao: string | null;
  /** A palavra do Pastor Presidente sobre este culto. */
  observacaoPresidente: string | null;
  concluidoEm: string | null;
  hostChurchId: string | null;
  church: {
    id: string;
    name: string;
    isHost: boolean;
    hostChurchId: string | null;
    currentLeaderName: string | null;
  };
  hostChurch?: { id: string; name: string } | null;
  regional?: { id: string; name: string } | null;
  lancamentos: Lancamento[];
  aprovacoes: Aprovacao[];
  blocosExigidos: Bloco[];
  blocosEnviados: Bloco[];
  blocosFaltando: Bloco[];
  minhasPermissoes?: { podeEnviar: Bloco[]; podeAprovar: Nivel[] };
}

export interface MeusPapeis {
  papeis: Papel[];
  posicoes: {
    papel: Papel;
    rotulo: string;
    titulo: string | null;
    churchId: string | null;
    churchName: string | null;
  }[];
  blocosVisiveis: Bloco[];
  podeEnviar: { bloco: Bloco; churchId: string }[];
  podeAprovar: Nivel[];
  visaoCampo: boolean;
  irrestrito: boolean;
  churchIdPadrao: string | null;
}

export interface IgrejaNoPainel {
  churchId: string;
  nome: string;
  dirigente: string | null;
  status: StatusCulto | 'SEM_REGISTRO';
  registroId: string | null;
  dataCulto: string | null;
  totalCultos: number;
  cultosConcluidos: number;
}

export interface GrupoDoPainel {
  tipo: 'HOSPEDEIRA' | 'REGIONAL';
  id: string;
  nome: string;
  dirigente: string | null;
  totalIgrejas: number;
  concluidas: IgrejaNoPainel[];
  pendentes: IgrejaNoPainel[];
  cor: 'VERDE' | 'VERMELHO';
}

export interface Painel {
  nivel: string;
  campoNome: string | null;
  periodo: { de: string; ate: string } | null;
  totais: { grupos: number; igrejas: number; concluidas: number; pendentes: number };
  grupos: GrupoDoPainel[];
}

// ── Resumo hierárquico (o modal) ─────────────────────────────────────────────

export interface TotaisFinanceiro {
  totalDizimos: number;
  totalOfertas: number;
  qtdDizimos: number;
  qtdOfertas: number;
}

export interface TotaisPresenca {
  homens: number;
  mulheres: number;
  jovens: number;
  adolescentes: number;
  criancas: number;
  visitantes: number;
  conversoes: number;
  reconciliacoes: number;
  familias: number;
  cadeirasVazias: number;
  publicoTotal: number;
}

export interface NoResumo {
  tipo: 'GRUPO' | 'IGREJA' | 'CULTO';
  id: string;
  nome: string;
  subtitulo: string | null;
  dirigente: string | null;
  cultos: number;
  concluidos: number;
  cor: 'VERDE' | 'VERMELHO';
  status: StatusCulto | null;
  dataCulto: string | null;
  registroId: string | null;
  financeiro: TotaisFinanceiro | null;
  presenca: TotaisPresenca | null;
  navegavel: boolean;
  tipoGrupo: 'HOSPEDEIRA' | 'REGIONAL' | null;
  /** Recados de cada nível sobre o culto (só em nós do tipo CULTO). */
  observacoes: { autor: string; texto: string }[];
}

export interface Resumo {
  nivel: 'CAMPO' | 'GRUPO' | 'IGREJA';
  id: string | null;
  titulo: string;
  subtitulo: string | null;
  periodo: { de: string; ate: string };
  totais: {
    igrejas: number;
    cultos: number;
    concluidos: number;
    pendentes: number;
    financeiro: TotaisFinanceiro | null;
    presenca: TotaisPresenca | null;
  };
  filhos: NoResumo[];
}

export interface TipoCulto {
  id: string;
  codigo: string;
  nome: string;
  ordem: number | null;
  ativo: boolean;
  is_default: boolean;
}

/** Horário cadastrado em Configurações › Horários de Culto. */
export interface HorarioCulto {
  id: string;
  codigo: string;
  nome: string;
  /** "19:00" — preenche o Início do lançamento. */
  hora_inicio: string | null;
  /** "21:00" — preenche o Fim. Vazio, o lançamento usa início + 1h. */
  hora_fim: string | null;
  ordem: number | null;
  ativo: boolean;
  is_default: boolean;
}

export interface Posicao {
  id: string;
  papel: Papel;
  rotuloPapel: string;
  titulo: string | null;
  isActive: boolean;
  churchId: string | null;
  churchName: string | null;
  user: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
    profileType: string;
  };
  createdAt: string;
}

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('mrm_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  const texto = await res.text();
  const corpo = texto ? JSON.parse(texto) : null;
  if (!res.ok) {
    throw new Error(corpo?.error || `Falha na requisição (${res.status}).`);
  }
  return corpo as T;
}

function qs(params: Record<string, string | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

export const cultoApi = {
  meusPapeis: () => req<MeusPapeis>('/culto/meus-papeis'),

  listarRegistros: (f: {
    de?: string;
    ate?: string;
    churchId?: string | null;
    status?: string | null;
    tipoCulto?: string | null;
    hostChurchId?: string | null;
    horaDe?: string | null;
    horaAte?: string | null;
  }) =>
    req<Registro[]>(
      `/culto/registros${qs({
        de: f.de,
        ate: f.ate,
        church_id: f.churchId,
        status: f.status,
        tipo_culto: f.tipoCulto,
        host_church_id: f.hostChurchId,
        hora_de: f.horaDe,
        hora_ate: f.horaAte,
      })}`,
    ),

  obterRegistro: (id: string) => req<Registro>(`/culto/registros/${id}`),

  abrirRegistro: (dados: {
    churchId?: string | null;
    dataCulto: string;
    horaInicio?: string | null;
    horaFim?: string | null;
    tipoCulto?: string;
    observacao?: string;
  }) => req<Registro>('/culto/registros', { method: 'POST', body: JSON.stringify(dados) }),

  excluirRegistro: (id: string) => req<{ ok: true }>(`/culto/registros/${id}`, { method: 'DELETE' }),

  enviarBloco: (registroId: string, bloco: Bloco, dados: Record<string, unknown>) =>
    req<{ status: StatusCulto; faltando: Bloco[] }>(`/culto/registros/${registroId}/lancamentos`, {
      method: 'PUT',
      body: JSON.stringify({ bloco, ...dados }),
    }),

  decidir: (registroId: string, nivel: Nivel, decisao: 'APROVADO' | 'REJEITADO', motivo?: string) =>
    req<{ status: StatusCulto }>(`/culto/registros/${registroId}/aprovacoes`, {
      method: 'POST',
      body: JSON.stringify({ nivel, decisao, motivo }),
    }),

  painel: (f: {
    de?: string;
    ate?: string;
    tipoCulto?: string | null;
    hostChurchId?: string | null;
  }) =>
    req<Painel>(
      `/culto/painel${qs({
        de: f.de,
        ate: f.ate,
        tipo_culto: f.tipoCulto,
        host_church_id: f.hostChurchId,
      })}`,
    ),

  resumo: (f: {
    nivel: 'CAMPO' | 'GRUPO' | 'IGREJA';
    id?: string | null;
    tipoGrupo?: 'HOSPEDEIRA' | 'REGIONAL' | null;
    de?: string;
    ate?: string;
    tipoCulto?: string | null;
  }) =>
    req<Resumo>(
      `/culto/resumo${qs({
        nivel: f.nivel,
        id: f.id,
        tipo_grupo: f.tipoGrupo,
        de: f.de,
        ate: f.ate,
        tipo_culto: f.tipoCulto,
      })}`,
    ),

  /** Tipos de culto do cadastro (Configurações › Listas). */
  tiposCulto: async (): Promise<TipoCulto[]> => {
    const bruto = await req<{ data?: TipoCulto[] } | TipoCulto[]>('/lookups/tipos-culto');
    const lista = Array.isArray(bruto) ? bruto : (bruto?.data ?? []);
    return lista.filter((t) => t.ativo !== false);
  },

  /** Horários de culto daquela igreja (Configurações › Horários de Culto). */
  horariosCulto: async (churchId?: string | null): Promise<HorarioCulto[]> => {
    // Cada igreja tem os seus: sem passar a igreja, o servidor devolve a do
    // usuário logado — o master, que troca de igreja na tela, passa qual é.
    const bruto = await req<{ data?: HorarioCulto[] } | HorarioCulto[]>(
      `/lookups/horarios-culto${qs({ churchId })}`,
    );
    const lista = Array.isArray(bruto) ? bruto : (bruto?.data ?? []);
    return lista.filter((h) => h.ativo !== false);
  },

  /**
   * Todos os horários da igreja, inclusive os desativados — é a lista do modal
   * de cadastro, onde o secretário precisa ver o que já criou.
   */
  listarHorariosCulto: (churchId?: string | null) =>
    req<HorarioCulto[]>(`/lookups/horarios-culto${qs({ churchId })}`),

  criarHorarioCulto: (dados: {
    codigo: string;
    nome: string;
    hora_inicio: string;
    hora_fim?: string | null;
    ordem?: number;
    churchId?: string | null;
  }) => req<{ id: string }[]>('/lookups/horarios-culto', { method: 'POST', body: JSON.stringify(dados) }),

  excluirHorarioCulto: (id: string) =>
    req<null>(`/lookups/horarios-culto/${id}`, { method: 'DELETE' }),

  /** Grava a observação do Pastor Presidente no culto. */
  observacaoPresidente: (registroId: string, texto: string) =>
    req<{ id: string }>(`/culto/registros/${registroId}`, {
      method: 'PATCH',
      body: JSON.stringify({ observacaoPresidente: texto }),
    }),

  /** Nós do organograma com o cadeado ligado (visão de valores bloqueada). */
  visaoBloqueada: () =>
    req<{ churchIds: string[]; podeMexer?: boolean }>('/culto/visao-bloqueada'),

  bloquearVisao: (churchId: string, bloqueado: boolean) =>
    req<{ churchId: string; bloqueado: boolean }>('/culto/visao-bloqueada', {
      method: 'POST',
      body: JSON.stringify({ churchId, bloqueado }),
    }),

  listarPosicoes: (churchId?: string | null) =>
    req<Posicao[]>(`/culto/posicoes${qs({ church_id: churchId })}`),

  anexarPosicao: (dados: {
    userId: string;
    papel: Papel;
    churchId?: string | null;
    titulo?: string | null;
  }) => req<Posicao>('/culto/posicoes', { method: 'POST', body: JSON.stringify(dados) }),

  removerPosicao: (id: string) => req<{ ok: true }>(`/culto/posicoes/${id}`, { method: 'DELETE' }),

  alternarPosicao: (id: string, isActive: boolean) =>
    req<Posicao>(`/culto/posicoes/${id}`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),

  buscarUsuarios: (search: string, churchId?: string | null) =>
    req<{ data?: unknown[] } | unknown[]>(
      `/users${qs({ search, churchId: churchId ?? undefined, limit: '20' })}`,
    ),

  listarIgrejas: () => req<unknown>('/churches?limit=500'),
};

/** dd/mm/aaaa a partir de ISO, sem deslocar por fuso. */
export function fmtData(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dia = String(d.getUTCDate()).padStart(2, '0');
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}/${d.getUTCFullYear()}`;
}

export function fmtMoeda(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Intervalo padrão dos filtros: os últimos 7 dias.
 *
 * Igual ao padrão do servidor (`periodoDaQuery` em cultoService.ts) — se os
 * dois divergirem, a tela mostra um intervalo e consulta outro. Uma semana
 * responde "fecharam o culto de domingo?"; o mês inteiro deixava quase toda
 * igreja vermelha e o painel não informava nada.
 */
export function periodoPadrao(): { de: string; ate: string } {
  const hoje = new Date();
  const p = (d: Date) => d.toISOString().slice(0, 10);
  const fim = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate()));
  const inicio = new Date(fim);
  inicio.setUTCDate(inicio.getUTCDate() - 6);
  return { de: p(inicio), ate: p(fim) };
}


/**
 * Formata o que o usuário digita como moeda brasileira, enquanto digita.
 *
 * Trabalha em centavos: "1234" vira "12,34". Evita o vaivém de cursor de
 * máscaras que tentam interpretar ponto e vírgula no meio da digitação.
 */
export function mascaraMoeda(valor: string): string {
  const digitos = String(valor ?? '').replace(/\D/g, '');
  if (!digitos) return '';
  const centavos = Number(digitos) / 100;
  return centavos.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "1.234,56" → 1234.56, para mandar ao servidor. */
export function moedaParaNumero(valor: string): number | null {
  const digitos = String(valor ?? '').replace(/\D/g, '');
  if (!digitos) return null;
  return Number(digitos) / 100;
}

/** 1234.56 → "1.234,56", para preencher o campo ao reabrir. */
export function numeroParaMoeda(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '';
  const n = Number(valor);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


/**
 * "Manhã", "Tarde" ou "Noite" a partir da hora de início.
 *
 * O quadro mostra o relógio, mas quem lê procura o turno: "o da noite já
 * fechou?". Derivar da hora — e não guardar o horário escolhido no registro —
 * faz o rótulo valer também para os cultos lançados antes do cadastro de
 * horários existir.
 */
export function turnoDoCulto(horaInicio?: string | null): string | null {
  const m = /^(\d{1,2}):/.exec(String(horaInicio ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  if (h < 12) return 'Manhã';
  if (h < 18) return 'Tarde';
  return 'Noite';
}

/** "19:30" pronto para exibir; traço quando o culto não tem hora informada. */
export function fmtHora(inicio?: string | null, fim?: string | null): string {
  if (!inicio && !fim) return '';
  if (inicio && fim) return `${inicio}–${fim}`;
  return inicio ?? fim ?? '';
}
