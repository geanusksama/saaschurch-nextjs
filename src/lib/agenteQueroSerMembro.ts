/**
 * "Quero ser Membro" pelo agente de IA do WhatsApp.
 *
 * Reaproveita a rota pública que já funciona
 * (/api/public/pastoral/create-membership-request) SEM alterá-la: monta o
 * mesmo corpo que a home envia e chama o POST dela. A rota exige o OTP do
 * WhatsApp; aqui ele é gerado no servidor, porque na conversa o número já está
 * comprovado — é a própria pessoa escrevendo dele.
 *
 * Dados básicos ou ficha completa: a ficha só vai se tiver o mínimo que a rota
 * aceita (nome, sobrenome, nascimento e CPF válido). Senão vai o básico e a
 * pessoa recebe o link da ficha na confirmação, como pela home.
 */

import { randomInt } from 'crypto'
import { NextRequest } from 'next/server'
import { POST as criarPedidoPelaRota } from '@/app/api/public/pastoral/create-membership-request/route'
import { hashCode, signToken, validateCpf } from '@/lib/membroJwt'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const MARCA_INICIO = '[[QUERO_SER_MEMBRO]]'
export const MARCA_FIM = '[[/QUERO_SER_MEMBRO]]'
/** Memória do atendimento: o agente reescreve a cada resposta; a pessoa não vê. */
export const MARCA_ESTADO_INICIO = '[[ESTADO]]'
export const MARCA_ESTADO_FIM = '[[/ESTADO]]'

/** Campos da ficha completa (os mesmos de FichaCompleta, na home). */
const CAMPOS_FICHA = [
  'firstName', 'lastName', 'preferredName', 'birthDate', 'gender', 'maritalStatus',
  'cpf', 'rg', 'email', 'phone', 'fatherName', 'motherName', 'spouseName',
  'naturalityCity', 'naturalityState', 'addressZipcode', 'addressStreet', 'addressNumber',
  'addressComplement', 'addressNeighborhood', 'addressCity', 'addressState',
  'pastChurch', 'ecclesiasticalTitle', 'churchEntryDate', 'baptized', 'baptismDate',
  'emergencyName', 'emergencyPhone', 'notes',
] as const

export interface DadosQueroSerMembro {
  nome?: string
  estadoCivil?: string
  igrejaAnterior?: string
  matrizAfricana?: boolean
  dataVisita?: string
  ficha?: Record<string, unknown>
}

/** Tira um bloco [[X]]{json}[[/X]] do texto. Bloco quebrado some do texto e volta null. */
function extrairBloco<T>(texto: string, ini: string, fim: string): { texto: string; dados: T | null } {
  const i = texto.indexOf(ini)
  if (i < 0) return { texto, dados: null }
  const f = texto.indexOf(fim, i)
  const bruto = texto.slice(i + ini.length, f < 0 ? undefined : f)
  const limpo = (texto.slice(0, i) + (f < 0 ? '' : texto.slice(f + fim.length))).trim()
  try {
    const json = bruto.replace(/^[\s`]*(json)?/i, '').replace(/[\s`]*$/, '')
    return { texto: limpo, dados: JSON.parse(json) as T }
  } catch {
    console.error('[agenteQueroSerMembro] bloco inválido', ini, bruto.slice(0, 300))
    return { texto: limpo, dados: null }
  }
}

/** Separa o bloco de ação do texto que vai para a pessoa. */
export function extrairAcao(texto: string): { texto: string; dados: DadosQueroSerMembro | null } {
  return extrairBloco<DadosQueroSerMembro>(texto, MARCA_INICIO, MARCA_FIM)
}

/** Separa o bloco de memória (estado do atendimento). */
export function extrairEstado(texto: string): { texto: string; estado: Record<string, unknown> | null } {
  const r = extrairBloco<Record<string, unknown>>(texto, MARCA_ESTADO_INICIO, MARCA_ESTADO_FIM)
  const ok = r.dados && typeof r.dados === 'object' && !Array.isArray(r.dados) ? r.dados : null
  return { texto: r.texto, estado: ok }
}

/** Mesmas datas que a home oferece: próximos 20 dias, sem domingo. */
export function datasDisponiveis(hoje = new Date()): string[] {
  const out: string[] = []
  for (let i = 1; i <= 20; i++) {
    const d = new Date(hoje)
    d.setDate(hoje.getDate() + i)
    if (d.getDay() !== 0) out.push(d.toISOString().slice(0, 10))
  }
  return out
}

export function dataVisitaValida(iso: string, agora = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const d = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== iso) return false
  // "hoje" em Brasília (UTC-3), não em UTC: às 22h o UTC já está no dia seguinte
  const hojeBrt = new Date(agora.getTime() - 3 * 3_600_000).toISOString().slice(0, 10)
  return iso >= hojeBrt
}

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim())

/** Ficha só quando tem o mínimo que a rota aceita; senão null (vai o básico). */
export function montarFicha(raw: Record<string, unknown> | undefined, telefone: string): Record<string, string> | null {
  if (!raw || typeof raw !== 'object') return null
  const ficha: Record<string, string> = {}
  for (const k of CAMPOS_FICHA) ficha[k] = s(raw[k])
  ficha.cpf = ficha.cpf.replace(/\D/g, '')
  ficha.addressZipcode = ficha.addressZipcode.replace(/\D/g, '')
  if (!ficha.phone) ficha.phone = telefone
  const temMinimo = ficha.firstName && ficha.lastName && /^\d{4}-\d{2}-\d{2}$/.test(ficha.birthDate) && validateCpf(ficha.cpf)
  return temMinimo ? ficha : null
}

export type ResultadoQueroSerMembro =
  | { ok: true; modo: 'basico' | 'completo'; attendanceId: string }
  | { ok: false; duplicado: boolean; erro: string; attendanceId?: string }

export async function registrarQueroSerMembro(params: {
  dados: DadosQueroSerMembro
  telefone: string
  campoId: string | null
  conversationId: string
}): Promise<ResultadoQueroSerMembro> {
  const { dados, conversationId } = params
  const telefone = params.telefone.replace(/\D/g, '')
  const ficha = montarFicha(dados.ficha, telefone)

  const nome = ficha ? `${ficha.firstName} ${ficha.lastName}`.trim() : s(dados.nome)
  if (!nome) return { ok: false, duplicado: false, erro: 'nome ausente' }

  // Ainda não há agenda de entrevistas: vale qualquer data de hoje em diante
  const data = s(dados.dataVisita)
  if (!dataVisitaValida(data)) {
    return { ok: false, duplicado: false, erro: `data de visita inválida ou no passado: ${data || 'vazia'}` }
  }

  const estadoCivil = ficha?.maritalStatus || s(dados.estadoCivil)
  const igrejaAnterior = ficha?.pastChurch || s(dados.igrejaAnterior)

  // OTP gerado aqui: a rota confere telefone + hash do código, igual à home
  const code = String(randomInt(100000, 1000000))
  const otp_token = signToken({ phone: telefone, code_hash: hashCode(code) }, 5 * 60)

  const corpo = {
    name: nome,
    whatsapp: telefone,
    isMarried: estadoCivil === 'married',
    pastChurches: igrejaAnterior,
    afroBackground: dados.matrizAfricana === true,
    scheduledDate: data,
    campoId: params.campoId || undefined,
    formData: ficha ?? undefined,
    otp_token,
    code,
  }

  const req = new NextRequest('http://interno/api/public/pastoral/create-membership-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  const res = await criarPedidoPelaRota(req)
  const json = (await res.json().catch(() => ({}))) as { attendanceId?: string; error?: string; duplicate?: boolean }

  if (!res.ok || !json.attendanceId) {
    return {
      ok: false,
      duplicado: res.status === 409 || !!json.duplicate,
      erro: json.error ?? `HTTP ${res.status}`,
      // no 409 a rota devolve o card que já existe
      attendanceId: json.attendanceId,
    }
  }

  // A rota registra "via portal público"; a origem real fica na timeline do card
  const { data: card } = await supabaseAdmin
    .from('pastoral_attendances')
    .select('church_id')
    .eq('id', json.attendanceId)
    .maybeSingle()
  if (card?.church_id) await supabaseAdmin.from('pastoral_attendance_timeline').insert({
    attendance_id: json.attendanceId,
    church_id: card.church_id,
    event_type: 'note',
    description: `Pedido feito pelo agente de IA no WhatsApp (${ficha ? 'ficha completa' : 'dados básicos'}).`,
    metadata: { conversation_id: conversationId },
  }).then(({ error }) => { if (error) console.error('[agenteQueroSerMembro] timeline', error.message) })

  return { ok: true, modo: ficha ? 'completo' : 'basico', attendanceId: json.attendanceId }
}
