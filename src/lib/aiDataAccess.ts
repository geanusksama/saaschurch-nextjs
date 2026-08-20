/**
 * Acesso amplo dos agentes de IA às duas tabelas centrais — `livro_caixa` e
 * `members` — e às tabelas que se relacionam com elas, para permitir join.
 *
 * As ferramentas antigas (consultar_livro_caixa, consultar_membros, rankings)
 * respondem perguntas específicas com os totais já calculados. Esta aqui é a
 * saída para o resto: o agente monta o filtro e escolhe as relações que quer
 * trazer junto, em vez de a pergunta esbarrar num parâmetro que ninguém previu.
 *
 * O que NÃO é aberto:
 *  - só leitura: nada aqui grava, e nenhum delegate de escrita é exposto;
 *  - só as tabelas do catálogo abaixo, e só as relações declaradas nelas —
 *    nome de relação fora da lista é ignorado, não repassado ao Prisma;
 *  - o recorte de campo/igreja é aplicado DEPOIS do filtro do agente, com AND,
 *    então nenhum filtro criativo atravessa para outro campo;
 *  - campos sensíveis (senha, token) nunca entram no select das relações.
 *
 * Server-side apenas.
 */

import { prisma } from '@/lib/prisma'

/** Teto de linhas por consulta — a IA não precisa de dump, precisa de recorte. */
export const AI_QUERY_MAX_ROWS = 200

type TabelaSpec = {
  /** delegate do Prisma (só leitura é usada) */
  delegate: () => any
  /** como aplicar o recorte de campo/igreja nesta tabela */
  scope: (fieldChurchIds: string[]) => any
  /** relações que o agente pode pedir em `incluir` */
  relacoes: Record<string, any>
  descricao: string
}

/** Igreja resumida — usada como join em quase tudo. */
const churchSelect = {
  select: { id: true, name: true, addressCity: true, addressState: true, regionalId: true },
}

const memberSelect = {
  select: {
    id: true,
    fullName: true,
    ecclesiasticalTitle: true,
    memberType: true,
    membershipStatus: true,
    churchId: true,
  },
}

export const AI_TABELAS: Record<string, TabelaSpec> = {
  livro_caixa: {
    delegate: () => prisma.livroCaixa,
    scope: (ids) => ({ churchId: { in: ids } }),
    descricao: 'Lançamentos financeiros (receitas, despesas, transferências).',
    relacoes: {
      church: churchSelect,
      member: memberSelect,
      banco: { select: { id: true, nome: true, codigo: true } },
      departamento: { select: { id: true, nome: true } },
      operadorUser: { select: { id: true, fullName: true, email: true } },
      createdByUser: { select: { id: true, fullName: true, email: true } },
    },
  },
  members: {
    delegate: () => prisma.member,
    scope: (ids) => ({ churchId: { in: ids } }),
    descricao: 'Membros e congregados.',
    relacoes: {
      church: churchSelect,
      // O join que liga as duas tabelas centrais: contribuições da pessoa.
      livroCaixaEntries: {
        select: {
          id: true, dataLancamento: true, valor: true, tipo: true,
          planoDeConta: true, categoria: true, favorecido: true, churchId: true,
        },
        orderBy: { dataLancamento: 'desc' },
        take: 50,
      },
      baptisms: true,
      titleHistory: true,
      previousChurches: true,
      occurrences: true,
      eventHistory: true,
      familyRelationships: true,
      churchFunctions: true,
      memberTagAssignments: true,
    },
  },
  churches: {
    delegate: () => prisma.church,
    scope: (ids) => ({ id: { in: ids } }),
    descricao: 'Igrejas/filiais do campo.',
    relacoes: {
      regional: true,
      members: { ...memberSelect, take: 50 },
    },
  },
  bancos: {
    delegate: () => prisma.banco,
    // Cadastro auxiliar do campo — não tem churchId para recortar.
    scope: () => ({}),
    descricao: 'Bancos e caixas cadastrados.',
    relacoes: {},
  },
  departamentos: {
    delegate: () => prisma.departamento,
    scope: () => ({}),
    descricao: 'Departamentos/campanhas de destino dos valores.',
    relacoes: {},
  },
}

export const AI_TABELAS_NOMES = Object.keys(AI_TABELAS)

/** Descrição do catálogo para colar no schema da ferramenta. */
export function descreverTabelas(): string {
  return Object.entries(AI_TABELAS)
    .map(([nome, spec]) => {
      const rels = Object.keys(spec.relacoes)
      return `${nome} — ${spec.descricao}${rels.length ? ` Relações: ${rels.join(', ')}.` : ''}`
    })
    .join(' | ')
}

/**
 * Só deixa passar as relações do catálogo. Nome desconhecido é descartado em
 * silêncio (a resposta informa quais valeram), para o agente não conseguir
 * alcançar uma tabela por caminho indireto.
 */
function montarInclude(spec: TabelaSpec, incluir: unknown): { include: any; usadas: string[]; ignoradas: string[] } {
  const pedidas = Array.isArray(incluir) ? incluir.map(String) : []
  const include: any = {}
  const usadas: string[] = []
  const ignoradas: string[] = []
  for (const nome of pedidas) {
    if (Object.prototype.hasOwnProperty.call(spec.relacoes, nome)) {
      include[nome] = spec.relacoes[nome]
      usadas.push(nome)
    } else {
      ignoradas.push(nome)
    }
  }
  return { include: usadas.length ? include : undefined, usadas, ignoradas }
}

export interface ConsultaDadosArgs {
  tabela?: string
  filtros?: any
  incluir?: string[]
  ordenar?: { campo?: string; direcao?: 'asc' | 'desc' }
  limite?: number
  contar?: boolean
}

export interface ConsultaDadosResult {
  tabela?: string
  erro?: string
  tabelasDisponiveis?: string[]
  total?: number
  retornados?: number
  relacoesIncluidas?: string[]
  relacoesIgnoradas?: string[]
  observacao?: string
  registros?: any[]
}

/**
 * Executa a consulta pedida pelo agente. `fieldChurchIds` null = master sem
 * campo definido (vê tudo, como nas outras ferramentas do chat).
 */
export async function consultarDados(
  args: ConsultaDadosArgs,
  fieldChurchIds: string[] | null
): Promise<ConsultaDadosResult> {
  const nomeTabela = String(args.tabela || '')
  const spec = AI_TABELAS[nomeTabela]
  if (!spec) {
    return {
      erro: `Tabela "${nomeTabela}" não disponível.`,
      tabelasDisponiveis: AI_TABELAS_NOMES,
    }
  }

  // Filtro do agente e recorte de tenant entram como AND: o segundo não pode
  // ser sobrescrito por uma chave repetida no primeiro.
  const filtroAgente = args.filtros && typeof args.filtros === 'object' ? args.filtros : {}
  const where: any =
    fieldChurchIds === null
      ? filtroAgente
      : { AND: [filtroAgente, spec.scope(fieldChurchIds)] }

  const { include, usadas, ignoradas } = montarInclude(spec, args.incluir)

  const limite = Math.max(1, Math.min(Number(args.limite) || 50, AI_QUERY_MAX_ROWS))
  const orderBy = args.ordenar?.campo
    ? { [args.ordenar.campo]: args.ordenar.direcao === 'asc' ? 'asc' : 'desc' }
    : undefined

  const delegate = spec.delegate()

  // O total conta a consulta inteira; a lista é a fatia. Sem isso o agente
  // acha que "10 registros" é o universo e responde errado.
  const total = await delegate.count({ where })
  const registros =
    args.contar === true
      ? []
      : await delegate.findMany({ where, ...(include ? { include } : {}), ...(orderBy ? { orderBy } : {}), take: limite })

  return {
    tabela: nomeTabela,
    total,
    retornados: registros.length,
    ...(usadas.length ? { relacoesIncluidas: usadas } : {}),
    ...(ignoradas.length ? { relacoesIgnoradas: ignoradas } : {}),
    observacao:
      total > registros.length && args.contar !== true
        ? `A consulta casa ${total} registros; foram retornados ${registros.length} (limite). Para contagens use o campo "total", nunca conte a lista. Para somas de dinheiro use consultar_totais/ranking_*.`
        : `Todos os ${total} registros que casam com o filtro estão na lista.`,
    registros,
  }
}
