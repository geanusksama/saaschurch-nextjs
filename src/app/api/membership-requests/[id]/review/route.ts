import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendTextViaZApi, ensureConversation, persistOutboundMessage } from '@/lib/whatsappSendService'
import { openAdmissionCard } from '@/lib/memberAdmission'
import { randomUUID } from 'crypto'

/**
 * Convenções da tabela `members` conferidas na base (não são as do formulário):
 *  - membership_status usa PT maiúsculo ('ATIVO'), não 'active'
 *  - marital_status usa 'Solteiro(a)' etc., não 'single'
 *  - id e updated_at NÃO têm default no banco (o Prisma preenche client-side),
 *    então o insert direto precisa mandar os dois
 */
const MARITAL_MAP: Record<string, string> = {
  single: 'Solteiro(a)',
  married: 'Casado(a)',
  divorced: 'Divorciado(a)',
  widowed: 'Viúvo(a)',
}

/**
 * POST /api/membership-requests/[id]/review — decisão da secretaria.
 *
 * body: { decision: 'approved' | 'rejected', notes?: string }
 *
 * Aprovar cria o MEMBRO de verdade a partir do formulário, gera o ROL e avisa
 * a pessoa por WhatsApp. Reprovar exige motivo e também avisa, para ninguém
 * ficar sem resposta.
 *
 * O ROL é um inteiro global (não é por igreja): o próximo é o maior + 1.
 * A adesão entra sempre pela SEDE — a transferência para a congregação é um
 * passo posterior da secretaria.
 */

/** Próximo número de rol. Global, como o resto da base já usa. */
async function nextRol(): Promise<number> {
  const { data } = await supabaseAdmin
    .from('members')
    .select('rol')
    .not('rol', 'is', null)
    .order('rol', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data?.rol ?? 0) + 1
}

/**
 * Igreja em que o membro é cadastrado.
 *
 * ATENÇÃO: `churches.headquarters_id` NÃO aponta para outra igreja — é FK para
 * a tabela `headquarters` (cadastro de contatos/redes da sede), e dezenas de
 * igrejas compartilham o mesmo registro. Usar aquele id como church_id estoura
 * a FK de `members`.
 *
 * A adesão entra pela igreja que recebeu o pedido, que no portal público já é
 * a SEDE (DEFAULT_SEDE_ID em create-membership-request). A transferência para
 * a congregação continua sendo passo posterior da secretaria.
 */
async function resolveChurchId(churchId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('churches')
    .select('id')
    .eq('id', churchId)
    .is('deleted_at', null)
    .maybeSingle()
  return data?.id ?? churchId
}

async function notifyWhatsApp(phone: string, message: string, contactName?: string) {
  const { data: instance } = await supabaseAdmin
    .from('whatsapp_instances')
    .select('id, name, instance_id, token, client_token, owner_user_id')
    .eq('is_active', true)
    .eq('status', 'connected')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!instance) {
    console.warn('[membership review] nenhuma instância conectada — aviso não enviado')
    return false
  }

  try {
    const normalized = String(phone).replace(/\D/g, '')
    const result = await sendTextViaZApi(instance, normalized, message, { delayTyping: 2 })
    if (result.status !== 'sent') return false
    const conversationId = await ensureConversation(
      instance.id,
      instance.owner_user_id,
      normalized,
      contactName
    )
    await persistOutboundMessage(conversationId, message, result.messageId || undefined)
    return true
  } catch (err) {
    console.error('[membership review] falha ao avisar por WhatsApp', err)
    return false
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuth(req, async (user) => {
    const { id } = await ctx.params
    const body = await req.json().catch(() => ({}))
    const decision = body.decision
    const notes = String(body.notes ?? '').trim()
    /**
     * Aprovar conclui o CADASTRO, não o processo de acolhimento: por padrão o
     * card FICA onde está e a pessoa segue recebendo o cronograma do 1º mês.
     * `closeProcess` é a exceção — encerra o acolhimento junto com a aprovação.
     */
    const closeProcess = body.closeProcess === true

    if (!['approved', 'rejected'].includes(decision)) {
      return NextResponse.json({ error: 'Decisão inválida.' }, { status: 400 })
    }
    if (decision === 'rejected' && !notes) {
      return NextResponse.json(
        { error: 'Informe o motivo da reprovação — ele vai para a pessoa.' },
        { status: 400 }
      )
    }

    const { data: request } = await supabaseAdmin
      .from('new_member_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (!request) {
      return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
    }
    if (request.status === 'approved') {
      return NextResponse.json(
        { error: 'Esta solicitação já foi aprovada e o membro já existe.' },
        { status: 409 }
      )
    }
    if (!request.form_submitted_at && decision === 'approved') {
      return NextResponse.json(
        { error: 'O formulário ainda não foi preenchido — não há o que aprovar.' },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()
    const form = (request.form_data ?? {}) as Record<string, string>
    const churchId = await resolveChurchId(request.target_church_id ?? request.church_id)

    let memberId: string | null = null
    let rol: number | null = null
    let admission: Awaited<ReturnType<typeof openAdmissionCard>> = null

    // ── APROVAR: cria o membro ──
    if (decision === 'approved') {
      // já existe alguém com este CPF? não duplica cadastro
      const cpf = String(form.cpf ?? '').replace(/\D/g, '')
      if (cpf) {
        const { data: existing } = await supabaseAdmin
          .from('members')
          .select('id, full_name, rol')
          .eq('cpf', cpf)
          .is('deleted_at', null)
          .maybeSingle()
        if (existing) {
          return NextResponse.json(
            {
              error: `Já existe um membro com este CPF: ${existing.full_name} (ROL ${existing.rol ?? '—'}). ` +
                'Verifique antes de aprovar.',
            },
            { status: 409 }
          )
        }
      }

      rol = await nextRol()
      const fullName = `${form.firstName ?? ''} ${form.lastName ?? ''}`.trim() || request.name

      const { data: member, error: memberErr } = await supabaseAdmin
        .from('members')
        .insert({
          // sem default no banco — o Prisma gera do lado do cliente
          id: randomUUID(),
          updated_at: now,
          church_id: churchId,
          full_name: fullName,
          preferred_name: form.preferredName || null,
          photo_url: form.photoUrl || null,
          cpf: cpf || null,
          rg: form.rg || null,
          birth_date: form.birthDate || null,
          marital_status: MARITAL_MAP[form.maritalStatus ?? ''] ?? form.maritalStatus ?? null,
          email: form.email || null,
          phone: String(request.whatsapp ?? '').replace(/\D/g, '') || null,
          mobile: String(form.phone ?? '').replace(/\D/g, '') || null,
          address_street: form.addressStreet || null,
          address_number: form.addressNumber || null,
          address_complement: form.addressComplement || null,
          address_neighborhood: form.addressNeighborhood || null,
          address_city: form.addressCity || null,
          address_state: form.addressState || null,
          address_zipcode: String(form.addressZipcode ?? '').replace(/\D/g, '') || null,
          membership_status: 'ATIVO',
          membership_date: form.churchEntryDate || now.slice(0, 10),
          baptism_status: form.baptized === 'sim' ? 'baptized' : 'not_baptized',
          baptism_date: form.baptismDate || null,
          father_name: form.fatherName || null,
          mother_name: form.motherName || null,
          naturality_city: form.naturalityCity || null,
          naturality_state: form.naturalityState || null,
          emergency_contact_name: form.emergencyName || null,
          emergency_contact_phone: String(form.emergencyPhone ?? '').replace(/\D/g, '') || null,
          notes: form.notes || null,
          rol,
          created_by: user.id ? String(user.id) : null,
          updated_by: user.id ? String(user.id) : null,
        })
        .select('id')
        .single()

      if (memberErr || !member) {
        return NextResponse.json(
          { error: `Falha ao criar o membro: ${memberErr?.message ?? 'erro desconhecido'}` },
          { status: 500 }
        )
      }
      memberId = member.id

      /**
       * Aprovar a ficha equivale a mover o card de Cadastro de "Pendente" para
       * "Aprovado" no pipeline: a matriz é quem troca o título eclesiástico,
       * ativa a situação e grava a ocorrência no perfil.
       *
       * Antes o membro nascia com `ATIVO` na mão e sem histórico nenhum, o que
       * deixava o perfil dele diferente do de quem entrou pelo botão Novo
       * Membro. O card não existia porque este fluxo cria o membro por outro
       * caminho — agora ele é aberto aqui.
       */
      admission = await openAdmissionCard({
        member: { id: member.id, churchId, fullName },
        user,
        upToColumnIndex: 2,
        note: 'Adesão aprovada pela ficha do "Quero ser Membro".',
      })
    }

    // ── atualiza a solicitação ──
    await supabaseAdmin
      .from('new_member_requests')
      .update({
        status: decision,
        review_notes: notes || null,
        reviewed_by: user.id ? String(user.id) : null,
        reviewed_at: now,
        created_member_id: memberId,
        member_rol: rol,
        target_church_id: churchId,
        updated_at: now,
      })
      .eq('id', id)

    // ── card do pipeline ──
    // Reprovar cancela o card. Aprovar NÃO: o cadastro foi concluído, mas o
    // acolhimento continua — a pessoa segue no pipeline recebendo o cronograma.
    // Só `closeProcess` (a exceção) encerra os dois de uma vez.
    const moverCard = decision === 'rejected' || closeProcess
    if (request.pipeline_card_id) {
      if (moverCard) {
        const targetKey = decision === 'rejected' ? 'cancelled' : 'done'
        const { data: cols } = await supabaseAdmin
          .from('pastoral_pipeline_columns')
          .select('id, column_key')
          .eq('church_id', request.church_id)
        const targetCol = cols?.find(c => c.column_key === targetKey)

        if (targetCol) {
          await supabaseAdmin
            .from('pastoral_attendances')
            .update({
              status: targetKey,
              column_id: targetCol.id,
              member_id: memberId,
              completed_at: targetKey === 'done' ? now : null,
              cancelled_at: targetKey === 'cancelled' ? now : null,
              cancel_reason: decision === 'rejected' ? notes : null,
            })
            .eq('id', request.pipeline_card_id)
        }
      } else {
        // vincula o membro ao card sem tirá-lo da coluna atual
        await supabaseAdmin
          .from('pastoral_attendances')
          .update({ member_id: memberId })
          .eq('id', request.pipeline_card_id)
      }

      await supabaseAdmin.from('pastoral_attendance_timeline').insert({
        attendance_id: request.pipeline_card_id,
        church_id: request.church_id,
        event_type: decision === 'approved' ? 'approved' : 'rejected',
        description:
          decision === 'rejected'
            ? `Adesão reprovada — ${notes}`
            : closeProcess
              ? `Adesão aprovada com ROL ${rol} — acolhimento encerrado junto`
              : `Cadastro aprovado com ROL ${rol} — acolhimento segue em andamento`,
        created_by: user.id ? String(user.id) : null,
      })
    }

    // ── avisa a pessoa ──
    const firstName = String(request.name ?? '').trim().split(/\s+/)[0] || 'irmão(ã)'
    const { data: church } = await supabaseAdmin
      .from('churches')
      .select('name')
      .eq('id', churchId)
      .maybeSingle()

    const message =
      decision === 'approved'
        ? `Que alegria, *${firstName}*! 🎉\n\n` +
          `Sua solicitação de membresia foi *APROVADA* e seu cadastro já está ativo na ${church?.name ?? 'nossa igreja'}.\n\n` +
          `📋 *Seu número de ROL: ${rol}*\n\n` +
          `Guarde esse número — é com ele que você acessa o Portal do Membro e se identifica na secretaria.\n\n` +
          `"Assim, já não sois estrangeiros, mas concidadãos dos santos e da família de Deus." (Efésios 2:19)\n\n` +
          `Seja muito bem-vindo(a) à família! Deus abençoe sua vida. 🙏`
        : `Olá, *${firstName}*.\n\n` +
          `Analisamos sua solicitação de membresia e, por ora, ela *não pôde ser aprovada*.\n\n` +
          `*Motivo:* ${notes}\n\n` +
          `Isso não é um "não" definitivo: regularizando o que foi apontado, é só nos procurar que damos ` +
          `andamento. Estamos à disposição para te ajudar nesse processo.\n\n` +
          `Que Deus abençoe sua vida! 🙏`

    const notified = await notifyWhatsApp(String(request.whatsapp), message, request.name)

    return NextResponse.json({
      ok: true,
      decision,
      memberId,
      rol,
      churchId,
      notified,
      closeProcess,
      admissionCard: admission,
    })
  })
}
