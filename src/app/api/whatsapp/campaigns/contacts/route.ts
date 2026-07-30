import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/auth'
import { isRestrictedToOwnChurch } from '@/lib/helpers'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAccessibleInstanceIds } from '@/lib/whatsappSendService'

/**
 * GET /api/whatsapp/campaigns/contacts
 * Busca unificada de destinatários para envio em massa.
 *
 * Query:
 *  - source: members | pipeline
 *  - q: nome / ROL / telefone
 *  - dateFrom, dateTo: data de cadastro (YYYY-MM-DD) — ambos opcionais, sem eles busca sem filtro de data
 *  - type: pipeline → attendance_type; members → status (ativo/visitante/...)
 *  - churchId, regionalId, titleId (título eclesiástico — só members)
 *  - limit (default 200, max 1000)
 *
 * Só retorna contatos com telefone (sem telefone não há envio).
 */

export interface MassContact {
  key: string
  source: 'member' | 'pipeline' | 'import'
  sourceId: string
  name: string
  phone: string
  church: string | null
  regional: string | null
  category: string | null
  createdAt: string
  variables: Record<string, string>
  /** mescla com whatsapp_conversations: já existe conversa/chat com esse contato? */
  lastMessage: string | null
  lastMessageAt: string | null
}

/** Mescla cada contato com a última mensagem da conversa (se existir), respeitando
 *  as instâncias que o usuário pode acessar (dono ou autorizado; master vê tudo). */
async function attachConversationPreview(
  contacts: Array<Omit<MassContact, 'lastMessage' | 'lastMessageAt'>>,
  userId: string,
  profileType?: string
): Promise<MassContact[]> {
  if (!contacts.length) return contacts.map(c => ({ ...c, lastMessage: null, lastMessageAt: null }))

  const accessible = await getAccessibleInstanceIds(userId, profileType)
  if (accessible && accessible.size === 0) {
    return contacts.map(c => ({ ...c, lastMessage: null, lastMessageAt: null }))
  }

  const phones = Array.from(new Set(contacts.map(c => c.phone)))
  let query = supabaseAdmin
    .from('whatsapp_conversations')
    .select('phone, instance_id, last_message, last_message_at')
    .in('phone', phones)
    .not('last_message_at', 'is', null)
    .order('last_message_at', { ascending: false })
  if (accessible) query = query.in('instance_id', Array.from(accessible))

  const { data } = await query
  const byPhone = new Map<string, { last_message: string | null; last_message_at: string | null }>()
  for (const row of data ?? []) {
    if (!byPhone.has(row.phone)) {
      byPhone.set(row.phone, { last_message: row.last_message, last_message_at: row.last_message_at })
    }
  }

  return contacts.map(c => ({
    ...c,
    lastMessage: byPhone.get(c.phone)?.last_message ?? null,
    lastMessageAt: byPhone.get(c.phone)?.last_message_at ?? null,
  }))
}

function firstName(full: string): string {
  return (full || '').trim().split(/\s+/)[0] ?? ''
}

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return ''
  const date = typeof d === 'string' ? new Date(d) : d
  return isNaN(date.getTime()) ? '' : date.toLocaleDateString('pt-BR')
}

export async function GET(req: NextRequest) {
  return withAuth(req, async (user) => {
    const sp = new URL(req.url).searchParams
    const sourceParam = sp.get('source')
    const source =
      sourceParam === 'pipeline' ? 'pipeline' : sourceParam === 'imports' ? 'imports' : 'members'
    /** lotes de importação escolhidos; vazio = todos os lotes visíveis */
    const batchIds = (sp.get('batchIds') ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
    const q = (sp.get('q') ?? '').trim()
    const dateFrom = sp.get('dateFrom') ?? undefined
    const dateTo = sp.get('dateTo') ?? undefined
    const type = sp.get('type') ?? ''
    const churchId = sp.get('churchId') ?? undefined
    const regionalId = sp.get('regionalId') ?? undefined
    const titleId = sp.get('titleId') ?? undefined
    const limit = Math.min(Math.max(1, Number(sp.get('limit')) || 200), 1000)

    // ── escopo de igreja/campo (mesma regra do módulo de membros) ────────────
    const churchWhere: Record<string, unknown> = { deletedAt: null }
    if (churchId) churchWhere.id = churchId
    else if (regionalId) churchWhere.regionalId = regionalId

    if (user.profileType !== 'master') {
      if (!user.campoId) {
        return NextResponse.json({ error: 'Sem acesso. Campo não definido.' }, { status: 403 })
      }
      churchWhere.regional = {
        ...((churchWhere.regional as Record<string, unknown>) || {}),
        campoId: user.campoId,
      }
    }
    if (isRestrictedToOwnChurch(user)) {
      if (!user.churchId) return NextResponse.json({ error: 'Sem acesso.' }, { status: 403 })
      churchWhere.id = user.churchId
    }

    if (source === 'members') {
      const filters: object[] = [{ church: churchWhere }]

      if (q) {
        const parsedRol = Number(q)
        if (Number.isInteger(parsedRol) && /^\d+$/.test(q)) {
          filters.push({
            OR: [
              { rol: parsedRol },
              { phone: { contains: q } },
              { mobile: { contains: q } },
            ],
          })
        } else {
          const tokens = q.split(/\s+/).filter(Boolean)
          filters.push({
            AND: tokens.map((token) => ({
              OR: [
                { fullName: { startsWith: token, mode: 'insensitive' } },
                { fullName: { contains: ` ${token}`, mode: 'insensitive' } },
              ],
            })),
          })
        }
      }

      if (type) filters.push({ membershipStatus: { contains: type, mode: 'insensitive' } })
      if (dateFrom) filters.push({ createdAt: { gte: new Date(`${dateFrom}T00:00:00`) } })
      if (dateTo) filters.push({ createdAt: { lte: new Date(`${dateTo}T23:59:59`) } })

      // Título eclesiástico — casa por FK (ecclesiasticalTitleId) OU pelo campo
      // texto (muitos membros só têm o texto, sem a FK preenchida)
      if (titleId) {
        const title = await prisma.ecclesiasticalTitle.findUnique({ where: { id: titleId }, select: { name: true } })
        const orConds: object[] = [{ ecclesiasticalTitleId: titleId }]
        if (title) orConds.push({ ecclesiasticalTitle: { equals: title.name, mode: 'insensitive' } })
        filters.push({ OR: orConds })
      }

      // precisa ter algum telefone
      filters.push({ OR: [{ phone: { not: null } }, { mobile: { not: null } }] })

      const members = await prisma.member.findMany({
        where: { deletedAt: null, AND: filters },
        select: {
          id: true, fullName: true, phone: true, mobile: true, email: true,
          rol: true, ecclesiasticalTitle: true, membershipStatus: true, createdAt: true,
          church: { select: { name: true, regional: { select: { name: true } } } },
        },
        orderBy: { fullName: 'asc' },
        take: limit,
      })

      type BaseContact = Omit<MassContact, 'lastMessage' | 'lastMessageAt'>
      const baseContacts: BaseContact[] = members
        .map((m): BaseContact | null => {
          const phone = (m.mobile || m.phone || '').replace(/\D/g, '')
          if (!phone) return null
          const name = m.fullName ?? ''
          return {
            key: `member:${m.id}`,
            source: 'member' as const,
            sourceId: String(m.id),
            name,
            phone,
            church: m.church?.name ?? null,
            regional: m.church?.regional?.name ?? null,
            category: m.membershipStatus ?? null,
            createdAt: m.createdAt?.toISOString() ?? '',
            variables: {
              nome: name,
              primeiro_nome: firstName(name),
              telefone: phone,
              igreja: m.church?.name ?? '',
              regional: m.church?.regional?.name ?? '',
              tipo: m.membershipStatus ?? 'Membro',
              rol: m.rol != null ? String(m.rol) : '',
              cargo: m.ecclesiasticalTitle ?? '',
              email: m.email ?? '',
              data_cadastro: fmtDate(m.createdAt),
              protocolo: String(m.id).slice(0, 8).toUpperCase(),
            },
          }
        })
        .filter((c): c is BaseContact => !!c)

      const contacts = await attachConversationPreview(baseContacts, String(user.id), user.profileType)
      return NextResponse.json({ contacts })
    }

    // ── listas importadas por CSV/Excel (whatsapp_import_rows) ───────────────
    // Serve para disparar só para o lote que a secretaria acabou de subir, em
    // vez de para todo o pipeline. `batchIds` vazio = todos os lotes visíveis.
    if (source === 'imports') {
      let batchQuery = supabaseAdmin
        .from('whatsapp_import_batches')
        .select('id, filename, created_at, church_id')
        .order('created_at', { ascending: false })
        .limit(100)

      // mesmo escopo do GET /api/whatsapp/imports: só o master vê os lotes de todos
      if (user.profileType !== 'master') batchQuery = batchQuery.eq('owner_user_id', String(user.id))
      if (batchIds.length) batchQuery = batchQuery.in('id', batchIds)

      const { data: batches } = await batchQuery
      if (!batches?.length) return NextResponse.json({ contacts: [] })

      const batchById = new Map(batches.map(b => [b.id, b]))

      let rowQuery = supabaseAdmin
        .from('whatsapp_import_rows')
        .select('id, batch_id, name, phone, email, variables, match_status, decision, created_at')
        .in('batch_id', batches.map(b => b.id))
        .not('phone', 'is', null)
        .neq('phone', '')
        // linhas descartadas na análise (telefone inválido, duplicada) não vão
        .neq('decision', 'skip')
        .order('row_number', { ascending: true })
        .limit(limit)

      if (q) {
        const digits = q.replace(/\D/g, '')
        rowQuery = digits
          ? rowQuery.or(`name.ilike.%${q}%,phone.ilike.%${digits}%`)
          : rowQuery.ilike('name', `%${q}%`)
      }
      if (dateFrom) rowQuery = rowQuery.gte('created_at', `${dateFrom}T00:00:00`)
      if (dateTo) rowQuery = rowQuery.lte('created_at', `${dateTo}T23:59:59`)

      const { data: rows, error: rowsErr } = await rowQuery
      if (rowsErr) return NextResponse.json({ error: rowsErr.message }, { status: 500 })

      type BaseContact = Omit<MassContact, 'lastMessage' | 'lastMessageAt'>
      const vistos = new Set<string>()
      const baseContacts: BaseContact[] = []

      for (const row of rows ?? []) {
        const phone = String(row.phone ?? '').replace(/\D/g, '')
        if (!phone) continue
        // o mesmo telefone em dois lotes é uma pessoa só — não manda duas vezes
        if (vistos.has(phone)) continue
        vistos.add(phone)

        const batch = batchById.get(row.batch_id)
        const lista = batch?.filename ?? 'Lista importada'
        const name = row.name ?? ''
        const vars = (row.variables ?? {}) as Record<string, string>

        baseContacts.push({
          key: `import:${row.id}`,
          source: 'import',
          sourceId: String(row.id),
          name,
          phone,
          church: null,
          regional: null,
          category: lista,
          createdAt: row.created_at ?? batch?.created_at ?? '',
          variables: {
            nome: name,
            primeiro_nome: firstName(name),
            telefone: phone,
            igreja: '',
            regional: '',
            tipo: 'Lista importada',
            rol: '',
            cargo: '',
            email: row.email ?? '',
            data_cadastro: fmtDate(row.created_at ?? batch?.created_at),
            lista,
            ...vars,
          },
        })
      }

      const contacts = await attachConversationPreview(baseContacts, String(user.id), user.profileType)
      return NextResponse.json({ contacts })
    }

    // ── pipeline pastoral (pastoral_attendances) ─────────────────────────────
    // resolve igrejas visíveis para aplicar o mesmo escopo no Supabase
    const visibleChurches = await prisma.church.findMany({
      where: churchWhere,
      select: { id: true, name: true, regional: { select: { name: true } } },
    })
    const churchMap = new Map(visibleChurches.map(c => [c.id, c]))
    if (!visibleChurches.length) return NextResponse.json({ contacts: [] })

    let query = supabaseAdmin
      .from('pastoral_attendances')
      .select('id, church_id, member_id, visitor_name, phone, email, attendance_type, title, created_at, members(full_name)')
      .in('church_id', visibleChurches.map(c => c.id))
      .not('phone', 'is', null)
      .neq('phone', '')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (type) query = query.eq('attendance_type', type)
    if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`)
    if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`)

    const { data: rows, error } = await query
    if (error) {
      console.error('[campaigns/contacts] pipeline error', error)
      return NextResponse.json({ error: 'Erro ao buscar pipeline' }, { status: 500 })
    }

    const qLower = q.toLowerCase()
    type BaseContact = Omit<MassContact, 'lastMessage' | 'lastMessageAt'>
    const baseContacts: BaseContact[] = (rows ?? [])
      .map((r): BaseContact | null => {
        const memberJoin = r.members as unknown as { full_name: string | null } | null
        const name = memberJoin?.full_name || r.visitor_name || r.title || 'Sem identificação'
        const phone = String(r.phone ?? '').replace(/\D/g, '')
        if (!phone) return null
        if (q && !name.toLowerCase().includes(qLower) && !phone.includes(q.replace(/\D/g, '') || ' ')) {
          return null
        }
        const church = churchMap.get(r.church_id)
        return {
          key: `pipeline:${r.id}`,
          source: 'pipeline' as const,
          sourceId: String(r.id),
          name,
          phone,
          church: church?.name ?? null,
          regional: church?.regional?.name ?? null,
          category: r.attendance_type ?? null,
          createdAt: r.created_at ?? '',
          variables: {
            nome: name,
            primeiro_nome: firstName(name),
            telefone: phone,
            igreja: church?.name ?? '',
            regional: church?.regional?.name ?? '',
            tipo: r.attendance_type ?? '',
            rol: '',
            cargo: '',
            email: r.email ?? '',
            data_cadastro: fmtDate(r.created_at),
            protocolo: String(r.id).slice(0, 8).toUpperCase(),
          },
        }
      })
      .filter((c): c is BaseContact => !!c)

    const contacts = await attachConversationPreview(baseContacts, String(user.id), user.profileType)
    return NextResponse.json({ contacts })
  })
}
