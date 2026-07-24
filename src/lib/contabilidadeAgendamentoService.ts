/**
 * contabilidadeAgendamentoService — envio automatico agendado do relatorio
 * contabil via WhatsApp, com comparacao entre versoes de um mesmo periodo.
 *
 * Ver docs/modules/contabilidade-agendamento/SPEC.md para o desenho completo
 * (RF001-RF013). Reaproveita as mesmas regras de filtro de
 * src/lib/contabilidadeService.ts (forma_pg=DINHEIRO, valor>0, campo do
 * contador OU nulo) sem alterar aquele arquivo, ja em producao.
 */

import { supabaseAdmin } from '@/lib/supabase-admin'
import { quickSendWhatsApp } from '@/lib/whatsappSendService'
import { CSV_HEADER, linhaCsv, type LivroCaixaRow } from '@/lib/contabilidadeService'

const CHUNK = 1000
const STORAGE_BUCKET = 'dados'
const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export interface ContabilidadeAgendamento {
  id: string
  acesso_id: string
  ativo: boolean
  frequencia: 'mensal' | 'semanal' | 'manual'
  dia_envio: number
  hora_envio: string // "HH:mm:ss"
  timezone: string
  tipo_periodo: 'mes_corrente' | 'mes_anterior' | 'gap'
  gap_meses: number
  qtd_meses: number
  proximo_envio: string | null
  ultimo_envio: string | null
}

export interface ContabilidadeAcessoLite {
  id: string
  nome: string
  campo: string
  telefone: string
  ativo: boolean
}

// ── Fuso horário sem dependência externa ───────────────────────────────────

function partsInZone(date: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const parts = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value])) as Record<string, string>
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

/** Converte um horário "de parede" (ano/mes/dia/hora local) num Date UTC correto para o timezone informado. */
function zonedWallTimeToUtc(y: number, mo: number, d: number, h: number, mi: number, timeZone: string): Date {
  let guess = new Date(Date.UTC(y, mo - 1, d, h, mi, 0))
  for (let i = 0; i < 2; i++) {
    const p = partsInZone(guess, timeZone)
    const gotAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
    const wantedAsUtc = Date.UTC(y, mo - 1, d, h, mi, 0)
    guess = new Date(guess.getTime() + (wantedAsUtc - gotAsUtc))
  }
  return guess
}

function lastDayOfMonth(y: number, mo: number): number {
  return new Date(Date.UTC(y, mo, 0)).getUTCDate()
}

function parseHora(hora: string): { h: number; m: number } {
  const [h, m] = hora.split(':').map(Number)
  return { h: h || 0, m: m || 0 }
}

/**
 * Proximo disparo estritamente apos `apos`, respeitando frequencia/dia/hora/timezone.
 * 'manual' nunca agenda automaticamente (retorna null).
 */
export function calcularProximoEnvio(ag: ContabilidadeAgendamento, apos: Date = new Date()): Date | null {
  if (ag.frequencia === 'manual') return null

  const { h, m } = parseHora(ag.hora_envio)
  const nowParts = partsInZone(apos, ag.timezone)

  if (ag.frequencia === 'mensal') {
    const diaAlvo = Math.min(Math.max(ag.dia_envio, 1), 28)
    let y = nowParts.year
    let mo = nowParts.month
    let candidato = zonedWallTimeToUtc(y, mo, diaAlvo, h, m, ag.timezone)
    if (candidato.getTime() <= apos.getTime()) {
      mo += 1
      if (mo > 12) { mo = 1; y += 1 }
      candidato = zonedWallTimeToUtc(y, mo, diaAlvo, h, m, ag.timezone)
    }
    return candidato
  }

  // semanal: dia_envio = 0 (domingo) .. 6 (sabado)
  const alvoSemana = ((ag.dia_envio % 7) + 7) % 7
  for (let offset = 0; offset < 8; offset++) {
    const base = new Date(apos.getTime() + offset * 86_400_000)
    const p = partsInZone(base, ag.timezone)
    const diaSemana = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay()
    if (diaSemana !== alvoSemana) continue
    const candidato = zonedWallTimeToUtc(p.year, p.month, p.day, h, m, ag.timezone)
    if (candidato.getTime() > apos.getTime()) return candidato
  }
  return null
}

// ── Cálculo dos períodos (RF003/RF004) ──────────────────────────────────────

export interface Periodo { ano: number; mes: number }

/**
 * Determina quais meses (ano/mes) devem ser enviados.
 *
 * Regra (parametrizavel, documentada no SPEC): o mes mais recente do lote e
 * calculado a partir de `tipo_periodo`/`gap_meses`; `qtd_meses` extras somam
 * meses anteriores a esse. Ex.: gap=2, qtd=1, hoje=Julho -> [Maio]
 * (bate com o RF003). gap=2, qtd=3, hoje=Julho -> [Marco, Abril, Maio].
 */
export function calcularPeriodos(ag: ContabilidadeAgendamento, referencia: Date = new Date()): Periodo[] {
  const p = partsInZone(referencia, ag.timezone)
  let ultimoIndex = p.year * 12 + (p.month - 1) // mes corrente, base 0

  if (ag.tipo_periodo === 'mes_anterior') ultimoIndex -= 1
  else if (ag.tipo_periodo === 'gap') ultimoIndex -= Math.max(ag.gap_meses, 0)

  const qtd = Math.max(ag.qtd_meses, 1)
  const periodos: Periodo[] = []
  for (let i = qtd - 1; i >= 0; i--) {
    const idx = ultimoIndex - i
    const ano = Math.floor(idx / 12)
    const mes = (idx % 12) + 1
    periodos.push({ ano, mes: mes < 1 ? mes + 12 : mes })
  }
  return periodos
}

// ── Geração do relatório de um período (RF005) ──────────────────────────────

interface LivroCaixaRowComId extends LivroCaixaRow {
  id: string
}

function orCampo(campo: string): string {
  const limpo = campo.replace(/[^\p{L}\p{N} _-]/gu, '')
  return `campo.ilike.${limpo},campo.is.null`
}

/** Mesmos filtros de contabilidadeService.baseQuery, com o id incluso para comparacao de versoes. */
async function* buscarLancamentosComId(campo: string, inicio: string, fim: string): AsyncGenerator<LivroCaixaRowComId[]> {
  let offset = 0
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from('livro_caixa')
      .select('id,data_lancamento,forma_pg,categoria,tipo,plano_de_conta,valor')
      .or(orCampo(campo))
      .eq('forma_pg', 'DINHEIRO')
      .gt('valor', 0)
      .gte('data_lancamento', inicio)
      .lte('data_lancamento', fim)
      .order('data_lancamento', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + CHUNK - 1)

    if (error) throw new Error(error.message)
    const rows = (data ?? []) as LivroCaixaRowComId[]
    if (rows.length === 0) return
    yield rows
    if (rows.length < CHUNK) return
    offset += CHUNK
  }
}

export interface RelatorioPeriodo {
  ano: number
  mes: number
  csvRows: string[]
  ids: string[]
  total: number
  totalValor: number
}

export async function gerarRelatorioPeriodo(campo: string, { ano, mes }: Periodo): Promise<RelatorioPeriodo> {
  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`
  const fim = `${ano}-${String(mes).padStart(2, '0')}-${String(lastDayOfMonth(ano, mes)).padStart(2, '0')}`

  const csvRows: string[] = []
  const ids: string[] = []
  let totalValor = 0

  for await (const bloco of buscarLancamentosComId(campo, inicio, fim)) {
    for (const row of bloco) {
      csvRows.push(linhaCsv(row))
      ids.push(row.id)
      const v = typeof row.valor === 'string' ? parseFloat(row.valor) : row.valor
      if (v) totalValor += Number(v)
    }
  }

  return { ano, mes, csvRows, ids, total: ids.length, totalValor }
}

// ── Comparação com a versão anterior (RF008/RF012) ──────────────────────────

export interface ComparacaoPeriodo {
  ano: number
  mes: number
  versaoAnterior: number | null
  qtdAnterior: number | null
  qtdAtual: number
  diferenca: number | null
  ausentes: string[] // ids que existiam na ultima versao e sumiram desta vez
}

export async function compararComVersaoAnterior(acessoId: string, periodo: RelatorioPeriodo): Promise<ComparacaoPeriodo> {
  const { data: anterior } = await supabaseAdmin
    .from('contabilidade_periodos_enviados')
    .select('versao, lancamento_ids, qtd_registros')
    .eq('acesso_id', acessoId)
    .eq('ano', periodo.ano)
    .eq('mes', periodo.mes)
    .order('versao', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!anterior) {
    return {
      ano: periodo.ano, mes: periodo.mes,
      versaoAnterior: null, qtdAnterior: null,
      qtdAtual: periodo.total, diferenca: null, ausentes: [],
    }
  }

  const idsAnteriores: string[] = Array.isArray(anterior.lancamento_ids) ? anterior.lancamento_ids : []
  const atuaisSet = new Set(periodo.ids)
  const ausentes = idsAnteriores.filter((id) => !atuaisSet.has(id))

  return {
    ano: periodo.ano, mes: periodo.mes,
    versaoAnterior: anterior.versao,
    qtdAnterior: anterior.qtd_registros,
    qtdAtual: periodo.total,
    diferenca: periodo.total - anterior.qtd_registros,
    ausentes,
  }
}

// ── Mensagem (RF006/RF009) ──────────────────────────────────────────────────

function fmtMoeda(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const DIAS_SEMANA_PT = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']

/** Descreve a configuração atual em texto, pra deixar claro no próprio WhatsApp o que está agendado (RF002). */
function descreverAgendamento(ag: ContabilidadeAgendamento): string {
  const hora = (ag.hora_envio || '').slice(0, 5)
  if (ag.frequencia === 'manual') return 'Este relatório é enviado manualmente, sem agendamento automático.'
  if (ag.frequencia === 'semanal') {
    const dia = DIAS_SEMANA_PT[((ag.dia_envio % 7) + 7) % 7]
    return `Este relatório é enviado automaticamente toda ${dia}, às ${hora}.`
  }
  return `Este relatório é enviado automaticamente todo dia ${ag.dia_envio} de cada mês, às ${hora}.`
}

export function montarMensagem(
  nomeContador: string,
  relatorios: RelatorioPeriodo[],
  comparacoes: ComparacaoPeriodo[],
  ag?: ContabilidadeAgendamento
): string {
  const linhasResumo = relatorios.map((r) => `• ${MESES_PT[r.mes - 1]}/${r.ano}: ${r.total} lançamentos — ${fmtMoeda(r.totalValor)}`)

  const linhasDivergencia = comparacoes.map((c) => {
    const label = `${MESES_PT[c.mes - 1]}/${c.ano}`
    if (c.versaoAnterior === null) return `• ${label}: primeiro envio deste período`
    if (c.diferenca === 0) return `• ${label}: sem alterações`
    return `• ${label}: anterior ${c.qtdAnterior} → atual ${c.qtdAtual} (${c.diferenca! > 0 ? '+' : ''}${c.diferenca} registros)`
  })

  const temDivergencia = comparacoes.some((c) => (c.diferenca ?? 0) !== 0 || c.ausentes.length > 0)

  const partes = [
    `📊 *Relatório Contábil — ${nomeContador}*`,
    '',
    '*Resumo financeiro:*',
    ...linhasResumo,
    '',
    '*Comparativo com o último envio:*',
    ...linhasDivergencia,
  ]

  if (temDivergencia) {
    partes.push('', '⚠️ Foram encontrados lançamentos que sumiram desde o último envio — confira o CSV em anexo.')
  }

  partes.push('', 'CSV em anexo com os lançamentos detalhados.')

  if (ag) {
    partes.push('', `_${descreverAgendamento(ag)} Para alterar a data, o horário ou o período enviado, solicite ao administrador do sistema._`)
  }

  return partes.join('\n')
}

// ── Orquestração (RF005-RF010) ──────────────────────────────────────────────

async function construirAnalise(ag: ContabilidadeAgendamento, acesso: ContabilidadeAcessoLite) {
  const periodos = calcularPeriodos(ag)
  const relatorios = await Promise.all(periodos.map((p) => gerarRelatorioPeriodo(acesso.campo, p)))
  const comparacoes = await Promise.all(relatorios.map((r) => compararComVersaoAnterior(acesso.id, r)))
  return { relatorios, comparacoes }
}

export interface AnalisePeriodo {
  ano: number
  mes: number
  totalRegistros: number
  totalValor: number
  versaoAnterior: number | null
  qtdAnterior: number | null
  diferenca: number | null
  ausentes: number
}

export interface AnaliseAgendamento {
  periodos: AnalisePeriodo[]
  mensagemPreview: string
}

/**
 * Só analisa (RF008/RF009) — não sobe CSV, não envia WhatsApp, não grava nada.
 * Usado pela UI pra mostrar "o que vai ser enviado" antes do usuário confirmar.
 */
export async function analisarAgendamento(ag: ContabilidadeAgendamento, acesso: ContabilidadeAcessoLite): Promise<AnaliseAgendamento> {
  const { relatorios, comparacoes } = await construirAnalise(ag, acesso)

  const periodos: AnalisePeriodo[] = relatorios.map((r, i) => ({
    ano: r.ano,
    mes: r.mes,
    totalRegistros: r.total,
    totalValor: r.totalValor,
    versaoAnterior: comparacoes[i].versaoAnterior,
    qtdAnterior: comparacoes[i].qtdAnterior,
    diferenca: comparacoes[i].diferenca,
    ausentes: comparacoes[i].ausentes.length,
  }))

  return { periodos, mensagemPreview: montarMensagem(acesso.nome, relatorios, comparacoes, ag) }
}

export interface ProcessarResultado {
  status: 'sucesso' | 'erro' | 'parcial'
  totalRegistros: number
  totalDivergencias: number
  erro?: string
  whatsappMessageId?: string
  periodos: Array<{ ano: number; mes: number; qtd_registros: number; qtd_divergencias: number; versao: number }>
}

export async function processarAgendamento(
  ag: ContabilidadeAgendamento,
  acesso: ContabilidadeAcessoLite,
  tipo: 'automatico' | 'manual'
): Promise<ProcessarResultado> {
  const inicio = Date.now()

  try {
    const { relatorios, comparacoes } = await construirAnalise(ag, acesso)

    const csvLinhas = [CSV_HEADER, ...relatorios.flatMap((r) => r.csvRows)]
    const csvBuffer = Buffer.from(csvLinhas.join('\n'), 'utf-8')
    const fileName = `contabilidade-${acesso.campo}-${new Date().toISOString().slice(0, 10)}.csv`
    const path = `contabilidade-envios/${acesso.id}/${Date.now()}-${fileName}`

    const { error: upErr } = await supabaseAdmin.storage.from(STORAGE_BUCKET).upload(path, csvBuffer, {
      contentType: 'text/csv',
      upsert: false,
    })
    if (upErr) throw new Error(`upload_csv: ${upErr.message}`)

    const { data: urlData } = supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(path)
    const mensagem = montarMensagem(acesso.nome, relatorios, comparacoes, ag)

    const envio = await quickSendWhatsApp({
      ownerUserId: 'system-contabilidade-cron',
      profileType: 'master',
      phone: acesso.telefone,
      message: mensagem,
      contactName: acesso.nome,
      documentUrl: urlData.publicUrl,
      fileName,
    })

    if (envio.status === 'error') throw new Error(envio.error || 'falha_envio_whatsapp')

    // Grava a nova versao de cada periodo (para a proxima comparacao) e o historico.
    const totalRegistros = relatorios.reduce((s, r) => s + r.total, 0)
    const totalDivergencias = comparacoes.reduce((s, c) => s + c.ausentes.length, 0)

    const { data: historico, error: histErr } = await supabaseAdmin
      .from('contabilidade_envios_historico')
      .insert({
        agendamento_id: ag.id,
        acesso_id: acesso.id,
        tipo,
        gap_meses: ag.gap_meses,
        qtd_meses: ag.qtd_meses,
        periodos: relatorios.map((r, i) => ({
          ano: r.ano, mes: r.mes, qtd_registros: r.total,
          qtd_divergencias: comparacoes[i].ausentes.length,
        })),
        status: 'sucesso',
        tempo_processamento_ms: Date.now() - inicio,
        total_registros: totalRegistros,
        total_divergencias: totalDivergencias,
        whatsapp_message_id: envio.messageId || null,
      })
      .select('id')
      .single()
    if (histErr) throw new Error(`historico: ${histErr.message}`)

    for (let i = 0; i < relatorios.length; i++) {
      const r = relatorios[i]
      const c = comparacoes[i]
      const proximaVersao = (c.versaoAnterior ?? 0) + 1
      await supabaseAdmin.from('contabilidade_periodos_enviados').insert({
        acesso_id: acesso.id,
        historico_id: historico?.id,
        ano: r.ano,
        mes: r.mes,
        versao: proximaVersao,
        lancamento_ids: r.ids,
        qtd_registros: r.total,
      })
    }

    return {
      status: 'sucesso',
      totalRegistros,
      totalDivergencias,
      whatsappMessageId: envio.messageId || undefined,
      periodos: relatorios.map((r, i) => ({
        ano: r.ano, mes: r.mes, qtd_registros: r.total,
        qtd_divergencias: comparacoes[i].ausentes.length,
        versao: (comparacoes[i].versaoAnterior ?? 0) + 1,
      })),
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await supabaseAdmin.from('contabilidade_envios_historico').insert({
      agendamento_id: ag.id,
      acesso_id: acesso.id,
      tipo,
      gap_meses: ag.gap_meses,
      qtd_meses: ag.qtd_meses,
      status: 'erro',
      tempo_processamento_ms: Date.now() - inicio,
      erro: msg.slice(0, 2000),
    })
    return { status: 'erro', totalRegistros: 0, totalDivergencias: 0, erro: msg, periodos: [] }
  }
}

/** Lista completa dos lancamentos ausentes de um periodo, para o detalhamento (RF010). */
export async function buscarDivergenciasDetalhe(acessoId: string, ano: number, mes: number) {
  const { data: versoes } = await supabaseAdmin
    .from('contabilidade_periodos_enviados')
    .select('versao, lancamento_ids, qtd_registros, enviado_em')
    .eq('acesso_id', acessoId)
    .eq('ano', ano)
    .eq('mes', mes)
    .order('versao', { ascending: false })
    .limit(2)

  if (!versoes || versoes.length < 2) return { ausentes: [], atual: versoes?.[0] ?? null, anterior: null }

  const [atual, anterior] = versoes
  const idsAnteriores: string[] = Array.isArray(anterior.lancamento_ids) ? anterior.lancamento_ids : []
  const idsAtuais = new Set<string>(Array.isArray(atual.lancamento_ids) ? atual.lancamento_ids : [])
  const ausentesIds = idsAnteriores.filter((id) => !idsAtuais.has(id))

  if (ausentesIds.length === 0) return { ausentes: [], atual, anterior }

  const { data: lancamentos } = await supabaseAdmin
    .from('livro_caixa')
    .select('id,data_lancamento,forma_pg,categoria,tipo,plano_de_conta,valor')
    .in('id', ausentesIds)

  return { ausentes: lancamentos ?? [], atual, anterior }
}
