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
import { Prisma } from '@prisma/client'

/** Teto de linhas por consulta — a IA não precisa de dump, precisa de recorte. */
export const AI_QUERY_MAX_ROWS = 200

type TabelaSpec = {
  /**
   * A que especialidade a tabela pertence. O agente "financeiro" não enxerga
   * as tabelas de pessoas e vice-versa — sem isso o Auxiliar Pastoral
   * respondia "crescimento da igreja" com total de dízimos.
   * 'ambos' = cadastro auxiliar que serve aos dois (igrejas).
   */
  grupo: 'financeiro' | 'pessoas' | 'ambos'
  /** nome do model no Prisma — de onde a estrutura de campos é lida */
  modelo: string
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

/** Recortes de tenant reaproveitados pelas tabelas do catálogo. */
const porIgreja = (ids: string[]) => ({ churchId: { in: ids } })
const porIgrejaId = (ids: string[]) => ({ id: { in: ids } })
const peloMembro = (ids: string[]) => ({ member: { churchId: { in: ids } } })
const semRecorte = () => ({})

/**
 * Catálogo de tabelas que o agente pode ler.
 *
 * `modelo` é o nome do model no Prisma — é a partir dele que a estrutura de
 * campos é lida do schema em tempo de execução (ver camposDaTabela). Assim a
 * lista de campos nunca fica desatualizada em relação ao banco: quando alguém
 * acrescenta uma coluna, o agente passa a enxergá-la sem ninguém editar isto.
 */
export const AI_TABELAS: Record<string, TabelaSpec> = {
  // ── Pessoas e igreja ────────────────────────────────────────────────────
  members: {
    grupo: 'ambos',
    modelo: 'Member',
    delegate: () => prisma.member,
    scope: porIgreja,
    descricao: 'Membros e congregados. memberType MEMBRO = pessoa da igreja; PJ/PF = fornecedor cadastrado pela tela de Lançamento. membershipDate = data de entrada; birthDate = nascimento; ecclesiasticalTitle = cargo; latitude/longitude = endereço da pessoa.',
    relacoes: {
      church: churchSelect,
      livroCaixaEntries: {
        select: { id: true, dataLancamento: true, valor: true, tipo: true, planoDeConta: true, categoria: true, favorecido: true, churchId: true },
        orderBy: { dataLancamento: 'desc' }, take: 50,
      },
      titleHistory: true, previousChurches: true, occurrences: true,
      eventHistory: true, familyRelationships: true, churchFunctions: true,
      memberTagAssignments: true, baptisms: true,
    },
  },
  churches: {
    grupo: 'ambos',
    modelo: 'Church',
    delegate: () => prisma.church,
    scope: porIgrejaId,
    descricao: 'Igrejas/filiais. currentLeaderName e currentLeaderRole = DIRIGENTE atual e o cargo dele; latitude/longitude = endereço da igreja; regionalId liga à regional.',
    relacoes: { regional: true, leaderHistory: true, members: { ...memberSelect, take: 50 } },
  },
  regionais: {
    grupo: 'ambos',
    modelo: 'Regional',
    delegate: () => prisma.regional,
    scope: semRecorte,
    descricao: 'Regionais do campo (agrupam as igrejas).',
    relacoes: { churches: churchSelect },
  },
  historico_dirigentes: {
    grupo: 'pessoas',
    modelo: 'ChurchLeaderHistory',
    delegate: () => prisma.churchLeaderHistory,
    scope: porIgreja,
    descricao: 'Trocas de dirigente da igreja: quem saiu, quem entrou, data de posse (entryDate), motivo e os números congelados na posse (membros, obreiros, caixa, distância).',
    relacoes: { church: churchSelect, newLeaderMember: memberSelect, previousLeaderMember: memberSelect },
  },
  historico_titulos: {
    grupo: 'pessoas',
    modelo: 'MemberTitleHistory',
    delegate: () => prisma.memberTitleHistory,
    scope: peloMembro,
    descricao: 'Histórico de título eclesiástico do membro (mudança de cargo, com data).',
    relacoes: { member: memberSelect },
  },
  historico_funcoes: {
    grupo: 'pessoas',
    modelo: 'ChurchFunctionHistory',
    delegate: () => prisma.churchFunctionHistory,
    scope: peloMembro,
    descricao: 'Funções exercidas na igreja (secretário, tesoureiro, líder...), com início, fim e isCampoWide.',
    relacoes: { member: memberSelect },
  },
  historico_eventos: {
    grupo: 'pessoas',
    modelo: 'MemberEventHistory',
    delegate: () => prisma.memberEventHistory,
    scope: peloMembro,
    descricao: 'Linha do tempo do membro: admissão, desligamento, readmissão, transferência.',
    relacoes: { member: memberSelect },
  },
  ocorrencias: {
    grupo: 'pessoas',
    modelo: 'MemberOccurrence',
    delegate: () => prisma.memberOccurrence,
    scope: peloMembro,
    descricao: 'Ocorrências pastorais e disciplinares registradas para o membro.',
    relacoes: { member: memberSelect },
  },
  familiares: {
    grupo: 'pessoas',
    modelo: 'MemberFamilyRelationship',
    delegate: () => prisma.memberFamilyRelationship,
    scope: peloMembro,
    descricao: 'Núcleo familiar. relatedMemberId nulo = familiar sem cadastro (nome em relatedName).',
    relacoes: { member: memberSelect, relatedMember: memberSelect },
  },
  igrejas_anteriores: {
    grupo: 'pessoas',
    modelo: 'MemberPreviousChurch',
    delegate: () => prisma.memberPreviousChurch,
    scope: peloMembro,
    descricao: 'Igrejas por onde o membro passou antes desta — é aqui que se vê quem VEIO DE OUTRA IGREJA/ministério.',
    relacoes: { member: memberSelect },
  },
  grupos_familiares: {
    grupo: 'pessoas',
    modelo: 'CellGroup',
    delegate: () => prisma.cellGroup,
    scope: porIgreja,
    descricao: 'Grupos familiares/células, com líder e endereço.',
    relacoes: { church: churchSelect },
  },
  batismos: {
    grupo: 'pessoas',
    modelo: 'Baptism',
    delegate: () => prisma.baptism,
    scope: porIgreja,
    descricao: 'Tabela de batismos do cadastro do membro. ATENÇÃO: está VAZIA — os batismos reais são processos do pipeline (use processos_secretaria).',
    relacoes: { member: memberSelect, church: churchSelect },
  },
  pipeline: {
    grupo: 'pessoas',
    modelo: 'KanCard',
    delegate: () => prisma.kanCard,
    scope: porIgreja,
    descricao: 'Processos da secretaria. service.serviceGroup separa BATISMO, CONSAGRACAO, TRANSFERENCIA, REQUERIMENTO, CADASTRO e CREDENCIAL. intendedTitle = cargo pretendido na consagração; churchId = origem e destinationChurchId = destino.',
    relacoes: {
      member: memberSelect, church: churchSelect, destinationChurch: churchSelect,
      service: { select: { id: true, sigla: true, description: true, serviceGroup: true } },
      stage: true,
    },
  },
  pipeline_servicos: {
    grupo: 'pessoas',
    modelo: 'KanService',
    delegate: () => prisma.kanService,
    scope: semRecorte,
    descricao: 'Catálogo de tipos de processo do pipeline (sigla, descrição, serviceGroup).',
    relacoes: {},
  },

  // ── Financeiro ──────────────────────────────────────────────────────────
  livro_caixa: {
    grupo: 'financeiro',
    modelo: 'LivroCaixa',
    delegate: () => prisma.livroCaixa,
    scope: porIgreja,
    descricao: 'Lançamentos financeiros (receitas, despesas, transferências).',
    relacoes: {
      church: churchSelect, member: memberSelect,
      banco: { select: { id: true, nome: true, codigo: true } },
      departamento: { select: { id: true, nome: true } },
      operadorUser: { select: { id: true, fullName: true, email: true } },
      createdByUser: { select: { id: true, fullName: true, email: true } },
    },
  },
  bancos: {
    grupo: 'financeiro',
    modelo: 'Banco',
    delegate: () => prisma.banco,
    scope: semRecorte,
    descricao: 'Bancos e caixas cadastrados.',
    relacoes: {},
  },
  departamentos: {
    grupo: 'financeiro',
    modelo: 'Departamento',
    delegate: () => prisma.departamento,
    scope: semRecorte,
    descricao: 'Departamentos/campanhas de destino dos valores.',
    relacoes: {},
  },
}

export const AI_TABELAS_NOMES = Object.keys(AI_TABELAS)

/**
 * Estrutura de campos de uma tabela, lida do schema do Prisma em tempo de
 * execução.
 *
 * O agente errava filtro por não saber o nome do campo — chutava "nome" onde é
 * "fullName", ou procurava transferência dentro de members. Com a lista real em
 * mãos ele monta o filtro certo, e a lista nunca desatualiza: sai do mesmo
 * schema que gera o client.
 */
export function camposDaTabela(nome: string): {
  tabela?: string
  erro?: string
  descricao?: string
  campos?: { campo: string; tipo: string; obrigatorio: boolean }[]
  relacoes?: string[]
} {
  const spec = AI_TABELAS[nome]
  if (!spec) return { erro: `Tabela "${nome}" não existe no catálogo.` }

  const modelo = Prisma.dmmf.datamodel.models.find(m => m.name === spec.modelo)
  if (!modelo) return { erro: `Modelo ${spec.modelo} não encontrado no schema.` }

  return {
    tabela: nome,
    descricao: spec.descricao,
    campos: modelo.fields
      // Relações saem daqui: elas vão no parâmetro `incluir`, não no filtro.
      .filter(f => f.kind === 'scalar' || f.kind === 'enum')
      .map(f => ({
        campo: f.name,
        tipo: f.isList ? `${f.type}[]` : f.type,
        obrigatorio: f.isRequired && !f.hasDefaultValue,
      })),
    relacoes: Object.keys(spec.relacoes),
  }
}

/**
 * Tabelas que um agente pode consultar, pela especialidade dele.
 * O agente geral/pastoral fica com as pessoas; o financeiro, com o dinheiro.
 */
export function tabelasPorEspecialidade(role: string | null | undefined): string[] {
  const grupo = String(role) === 'financeiro' ? 'financeiro' : 'pessoas'
  return Object.entries(AI_TABELAS)
    .filter(([, spec]) => spec.grupo === grupo || spec.grupo === 'ambos')
    .map(([nome]) => nome)
}

/** Lista curta (nome — descrição) das tabelas liberadas, para o prompt. */
export function listarTabelas(permitidas: string[]): string {
  return permitidas
    .map(nome => `${nome}: ${AI_TABELAS[nome]?.descricao ?? ''}`)
    .join('\n')
}

/** Descrição do catálogo para colar no schema da ferramenta. */
export function descreverTabelas(permitidas?: string[]): string {
  return Object.entries(AI_TABELAS)
    .filter(([nome]) => !permitidas || permitidas.includes(nome))
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
  fieldChurchIds: string[] | null,
  permitidas?: string[]
): Promise<ConsultaDadosResult> {
  const nomeTabela = String(args.tabela || '')
  const spec = AI_TABELAS[nomeTabela]
  const liberada = !permitidas || permitidas.includes(nomeTabela)
  if (!spec || !liberada) {
    return {
      erro: `Tabela "${nomeTabela}" não disponível para este assistente.`,
      tabelasDisponiveis: permitidas ?? AI_TABELAS_NOMES,
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


/** Dias em que a migração carimbou membros em lote — não são entradas reais. */
const LOTES_MIGRACAO_MEMBROS = ['2024-03-08', '2024-08-03']

export interface CrescimentoArgs {
  data_inicio?: string
  data_fim?: string
  igreja?: string
  agrupar_por?: 'mes' | 'ano' | 'igreja'
}

/**
 * Crescimento de membros, contado pelo servidor.
 *
 * Existe para tirar a resposta das mãos do modelo. A regra "use membershipDate,
 * nunca createdAt, e filtre memberType MEMBRO" estava só no prompt — e prompt é
 * recomendação, não garantia. Aqui a coluna certa e os filtros certos são
 * estrutura: não há como o agente contar pela coluna errada.
 *
 * - membershipDate = data de ENTRADA na igreja. createdAt marca a chegada da
 *   linha no banco (a migração de 07/05/2026 carimbou 25.982 no mesmo dia).
 * - memberType MEMBRO exclui os fornecedores PJ que a tela de Lançamento grava
 *   nesta mesma tabela.
 * - Os dois dias de lote da migração saem da contagem e são informados à parte,
 *   para ninguém apresentar importação como crescimento.
 */
export async function crescimentoMembros(
  args: CrescimentoArgs,
  fieldChurchIds: string[] | null
) {
  const where: any = {
    deletedAt: null,
    memberType: 'MEMBRO',
    membershipDate: { not: null },
  }
  if (fieldChurchIds !== null) where.churchId = { in: fieldChurchIds }
  if (args.igreja) where.church = { name: { contains: args.igreja, mode: 'insensitive' } }
  if (args.data_inicio || args.data_fim) {
    where.membershipDate = {
      not: null,
      ...(args.data_inicio ? { gte: new Date(args.data_inicio) } : {}),
      ...(args.data_fim ? { lte: new Date(args.data_fim) } : {}),
    }
  }

  const linhas = await prisma.member.findMany({
    where,
    select: { membershipDate: true, church: { select: { name: true } } },
  })

  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const reais = linhas.filter(l => l.membershipDate && !LOTES_MIGRACAO_MEMBROS.includes(iso(l.membershipDate)))
  const doLote = linhas.length - reais.length

  const agruparPor = args.agrupar_por || 'mes'
  const chaveDe = (l: typeof linhas[number]) => {
    const d = l.membershipDate as Date
    if (agruparPor === 'igreja') return l.church?.name || '(sem igreja)'
    if (agruparPor === 'ano') return String(d.getUTCFullYear())
    return iso(d).slice(0, 7)
  }

  const mapa = new Map<string, number>()
  for (const l of reais) mapa.set(chaveDe(l), (mapa.get(chaveDe(l)) ?? 0) + 1)

  const serie = Array.from(mapa.entries())
    .map(([chave, novos]) => ({ periodo: chave, novosMembros: novos }))
    .sort((a, b) => (agruparPor === 'igreja' ? b.novosMembros - a.novosMembros : a.periodo.localeCompare(b.periodo)))

  return {
    total: reais.length,
    agrupadoPor: agruparPor,
    periodo: { de: args.data_inicio || '(início)', ate: args.data_fim || '(hoje)' },
    igreja: args.igreja || 'todas as igrejas do campo',
    serie,
    ...(doLote > 0
      ? {
          excluidosDaMigracao: doLote,
          alertaMigracao: `${doLote} cadastro(s) do período têm data de entrada nos dias de importação em lote (${LOTES_MIGRACAO_MEMBROS.join(' e ')}) e NÃO entraram na contagem, porque não representam entrada real de pessoas. Informe isso ao usuário.`,
        }
      : {}),
    observacao:
      'Contagem feita pelo servidor por membershipDate (data de entrada na igreja), apenas memberType MEMBRO. Use exatamente estes números; não recalcule e não use createdAt.',
  }
}


/** Dia em que a migração criou os cards do pipeline em lote. */
const LOTE_MIGRACAO_PIPELINE = '2024-08-11'

export interface ProcessosArgs {
  tipo?: string
  data_inicio?: string
  data_fim?: string
  igreja?: string
  status?: string
  agrupar_por?: 'mes' | 'ano' | 'status' | 'igreja' | 'tipo'
  base_da_data?: 'abertura' | 'conclusao'
}

/**
 * Processos da secretaria contados pelo servidor: batismo, consagração,
 * transferência, requerimentos, cadastro e credencial.
 *
 * Existe pelo mesmo motivo de crescimentoMembros: o modelo consultava a tabela
 * `members` para responder "houve transferência?" e devolvia zero, enquanto o
 * pipeline tinha os processos na tela. Instrução em prompt não resolveu; aqui a
 * tabela certa é estrutura.
 *
 * Transferência tem duas pontas: quando se filtra por igreja, a contagem separa
 * o que SAIU (igreja de origem) do que ENTROU (igreja de destino) — somar os
 * dois seria contar o mesmo processo duas vezes.
 */
export async function processosSecretaria(
  args: ProcessosArgs,
  fieldChurchIds: string[] | null
) {
  const campoData = args.base_da_data === 'conclusao' ? 'closedAt' : 'createdAt'

  const where: any = { deletedAt: null }
  if (args.tipo) where.service = { serviceGroup: String(args.tipo).toUpperCase() }
  if (args.data_inicio || args.data_fim) {
    where[campoData] = {
      ...(args.data_inicio ? { gte: new Date(args.data_inicio) } : {}),
      ...(args.data_fim ? { lte: new Date(`${args.data_fim}T23:59:59.999Z`) } : {}),
    }
  }

  // Recorte de campo: a igreja de origem OU a de destino precisa ser do campo.
  if (fieldChurchIds !== null) {
    where.OR = [
      { churchId: { in: fieldChurchIds } },
      { destinationChurchId: { in: fieldChurchIds } },
    ]
  }

  /**
   * O status de verdade é `statusLabel`, NUNCA `status`.
   *
   * `status` não acompanha o card quando ele anda no pipeline: em agosto/2026 os
   * 51 batismos estavam todos com status "pendente" no banco, enquanto a tela
   * de Batismo mostrava 4 pendentes e 47 aprovados. A tela acerta porque lê a
   * coluna do card (Baptism.tsx conta por `columnIndex`), e `statusLabel` é o
   * nome dessa coluna — bate com ela linha a linha. Perguntado por batismos
   * aprovados em agosto, o agente respondeu ZERO lendo o campo velho.
   *
   * `statusLabel` está preenchido em 100% dos 91.705 cards, nos seis grupos de
   * serviço — não há buraco que justifique voltar ao campo antigo.
   *
   * A distribuição é levantada ANTES de filtrar, por dois motivos: é ela que
   * traduz o termo do usuário para os rótulos que existem de fato (comparando
   * sem acento, senão "concluido" não acha "Concluído (legado)"), e é ela que
   * responde "então o que tem?" quando o filtro devolve zero — o momento exato
   * em que o modelo é mais tentado a inventar uma distribuição.
   */
  const distribuicaoDeStatus = await prisma.kanCard.groupBy({
    by: ['statusLabel'],
    where,
    _count: { _all: true },
  })

  const semAcento = (v: string) =>
    v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  const rotulosQueCasam = args.status
    ? distribuicaoDeStatus
        .map(d => d.statusLabel)
        .filter((r): r is string => !!r && semAcento(r).includes(semAcento(String(args.status))))
    : null

  if (rotulosQueCasam) where.statusLabel = { in: rotulosQueCasam }

  const cards = await prisma.kanCard.findMany({
    where,
    select: {
      status: true, statusLabel: true, createdAt: true, closedAt: true, candidateName: true,
      intendedTitle: true, protocol: true,
      service: { select: { serviceGroup: true, description: true } },
      church: { select: { name: true } },
      destinationChurch: { select: { name: true } },
      member: { select: { fullName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 5000,
  })

  const bate = (nome?: string | null) =>
    !!nome && !!args.igreja && nome.toLowerCase().includes(String(args.igreja).toLowerCase())

  const filtrados = args.igreja
    ? cards.filter(c => bate(c.church?.name) || bate(c.destinationChurch?.name))
    : cards

  const dataDe = (c: typeof cards[number]) => (campoData === 'closedAt' ? c.closedAt : c.createdAt) ?? c.createdAt
  const iso = (d: Date) => d.toISOString().slice(0, 10)

  const doLote = filtrados.filter(c => iso(c.createdAt) === LOTE_MIGRACAO_PIPELINE).length
  const reais = filtrados.filter(c => iso(c.createdAt) !== LOTE_MIGRACAO_PIPELINE)

  const agruparPor = args.agrupar_por || 'mes'
  const chaveDe = (c: typeof cards[number]) => {
    if (agruparPor === 'status') return c.statusLabel || '(sem status)'
    if (agruparPor === 'tipo') return c.service?.serviceGroup || '(sem tipo)'
    if (agruparPor === 'igreja') return c.church?.name || '(sem igreja)'
    const d = dataDe(c)
    return agruparPor === 'ano' ? String(d.getUTCFullYear()) : iso(d).slice(0, 7)
  }

  const mapa = new Map<string, number>()
  for (const c of reais) mapa.set(chaveDe(c), (mapa.get(chaveDe(c)) ?? 0) + 1)
  const serie = Array.from(mapa.entries())
    .map(([periodo, qtd]) => ({ periodo, quantidade: qtd }))
    .sort((a, b) => (agruparPor === 'mes' || agruparPor === 'ano'
      ? a.periodo.localeCompare(b.periodo)
      : b.quantidade - a.quantidade))

  // Transferência tem duas pontas; somá-las contaria o processo duas vezes.
  const porPonta = args.igreja
    ? {
        sairamDestaIgreja: reais.filter(c => bate(c.church?.name)).length,
        entraramNestaIgreja: reais.filter(c => bate(c.destinationChurch?.name)).length,
      }
    : undefined

  return {
    tipo: args.tipo ? String(args.tipo).toUpperCase() : 'todos',
    baseDaData: campoData === 'closedAt' ? 'data de conclusão' : 'data de abertura',
    periodo: { de: args.data_inicio || '(início)', ate: args.data_fim || '(hoje)' },
    igreja: args.igreja || 'todas as igrejas do campo',
    total: reais.length,
    agrupadoPor: agruparPor,
    serie,
    ...(porPonta ? { porPonta } : {}),
    ...(doLote > 0
      ? {
          excluidosDaMigracao: doLote,
          alertaMigracao: `${doLote} processo(s) do período foram criados em ${LOTE_MIGRACAO_PIPELINE}, o dia da importação, e NÃO entraram na contagem. Informe isso ao usuário.`,
        }
      : {}),
    amostra: reais.slice(0, 15).map(c => ({
      protocolo: c.protocol,
      pessoa: c.member?.fullName || c.candidateName,
      tipo: c.service?.description,
      status: c.statusLabel,
      origem: c.church?.name,
      destino: c.destinationChurch?.name,
      abertura: iso(c.createdAt),
      conclusao: c.closedAt ? iso(c.closedAt) : null,
    })),
    ...(args.status ? { statusFiltrado: args.status, rotulosQueCasaram: rotulosQueCasam } : {}),
    statusExistentesNoPeriodo: distribuicaoDeStatus
      .map(d => ({ status: d.statusLabel || '(sem status)', quantidade: d._count._all }))
      .sort((a, b) => b.quantidade - a.quantidade),
    avisoStatus:
      'Distribuição REAL das situações no mesmo período e escopo, ignorando o filtro de status. São EXATAMENTE estas as situações que existem: ao dizer quais são, use somente esta lista, nunca cite de memória nem suponha. Se o filtro devolveu zero, a resposta está aqui.',
    observacao:
      'Contagem feita pelo servidor sobre os processos do pipeline da secretaria. Use exatamente estes números. A lista "amostra" é só ilustrativa (máx. 15) — nunca conte por ela.',
  }
}
