/**
 * Aviso ao líder do GF quando alguém é anexado ao grupo dele.
 *
 * O líder recebe um link público com o resumo da conversa que já aconteceu com
 * a pessoa — ele precisa saber quem está chegando e o que já foi falado antes
 * de fazer o primeiro contato.
 *
 * Server-side apenas.
 */

import { supabaseAdmin } from '@/lib/supabase-admin'
import { quickSendWhatsApp } from '@/lib/whatsappSendService'
import { buildGfContactReport } from '@/lib/gfContactReportService'

/**
 * `origin` vem da requisição que anexou a pessoa. Sem ele, testar no localhost
 * geraria um link para o domínio de produção — onde o resumo daquele contato
 * ainda não existe, e o líder receberia um 404.
 */
export function gfResumoPublicUrl(token: string, origin?: string | null): string {
  const base = (origin || process.env.NEXT_PUBLIC_APP_URL || 'https://www.adcampinas.com.br').replace(/\/+$/, '')
  return `${base}/gf-resumo/${token}`
}

interface NotifyInput {
  cell: {
    id: string
    name: string
    leader?: { id: string; fullName: string; mobile: string | null; phone: string | null } | null
  }
  userId: string
  profileType?: string
  contactName: string
  contactPhone: string
  memberId?: string
  importRowId?: string
  /** Campo do usuário — define qual configuração de IA gera a síntese. */
  campoId?: string | null
  /** Origem da requisição que anexou (http://localhost:3000, https://...). */
  origin?: string | null
}

/**
 * Cria o link público e avisa o líder. Falha de envio não derruba a anexação:
 * a pessoa já entrou no GF, e refazer o vínculo só porque o WhatsApp caiu
 * deixaria o cadastro inconsistente.
 */
export async function notifyLeaderOfNewContact(input: NotifyInput) {
  const { data: share, error } = await supabaseAdmin
    .from('cell_group_share_links')
    .insert({
      cell_group_id: input.cell.id,
      member_id: input.memberId ?? null,
      import_row_id: input.importRowId ?? null,
      contact_name: input.contactName,
      contact_phone: (input.contactPhone ?? '').replace(/\D/g, ''),
      created_by: input.userId,
    })
    .select('token')
    .single()

  if (error || !share) {
    console.error('[cellGroupNotify] falha ao criar link público', error)
    return null
  }

  const leaderPhone = (input.cell.leader?.mobile || input.cell.leader?.phone || '').replace(/\D/g, '')
  if (!leaderPhone) return share

  // O líder recebe a síntese já na mensagem: ele precisa saber de quem se trata
  // sem depender de abrir o link. O link continua indo, para o detalhe.
  const parecer = await buildGfContactReport({
    name: input.contactName,
    phone: input.contactPhone,
    campoId: input.campoId ?? null,
    memberId: input.memberId ?? null,
    importRowId: input.importRowId ?? null,
    instanceIds: null,
  }).catch((err) => {
    console.error('[cellGroupNotify] falha ao montar a síntese', err)
    return null
  })

  const contexto: string[] = []
  if (parecer?.sintese) contexto.push('', `_${parecer.sintese}_`)
  if (parecer && !parecer.fatos.respondeu && parecer.fatos.tentativasSemResposta > 0) {
    contexto.push('', `⚠️ Ainda não respondeu — ${parecer.fatos.tentativasSemResposta} tentativa(s) de contato.`)
  }
  if (parecer?.pontosPositivos.length) {
    contexto.push('', `✅ ${parecer.pontosPositivos.slice(0, 2).join(' · ')}`)
  }

  // `null` some; string vazia é linha em branco de propósito.
  const message = [
    `Paz do Senhor, ${input.cell.leader?.fullName?.split(' ')[0] ?? 'líder'}!`,
    '',
    `${input.contactName} foi encaminhado(a) para o seu GF "${input.cell.name}".`,
    input.contactPhone ? `Telefone: ${input.contactPhone}` : null,
    ...contexto,
    '',
    'Resumo completo da conversa:',
    gfResumoPublicUrl(share.token, input.origin),
  ]
    .filter((linha): linha is string => linha !== null)
    .join('\n')

  const result = await quickSendWhatsApp({
    ownerUserId: input.userId,
    profileType: input.profileType,
    phone: leaderPhone,
    message,
    contactName: input.cell.leader?.fullName ?? undefined,
  }).catch((err) => {
    console.error('[cellGroupNotify] falha no envio ao líder', err)
    return null
  })

  if (result?.status === 'error') {
    console.error('[cellGroupNotify] Z-API recusou o envio ao líder:', result.error)
  }

  return share
}
