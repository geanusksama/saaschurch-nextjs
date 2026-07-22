import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { verifyToken } from '@/lib/membroJwt'
import { supabaseAdmin } from '@/lib/supabase-admin'

type MemberPayload = {
  sub: string
  church_id?: string
  rol?: number | string
  name?: string
}

// Limites do Control iD (user_set_image.fcgi): JPG/PNG, < 2MB.
const MAX_BYTES = 2 * 1024 * 1024

// Quando true, o cadastro entra como 'needs_approval' e só vai ao aparelho
// depois que a secretaria liberar. Padrão: auto-aprovado.
const REQUIRE_APPROVAL = process.env.FACEID_REQUIRE_APPROVAL === 'true'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { token, photo, allowUpdate } = body as {
    token?: string
    photo?: string
    allowUpdate?: boolean
  }

  if (!token) return NextResponse.json({ error: 'Token obrigatório.' }, { status: 401 })

  const payload = verifyToken<MemberPayload>(token)
  if (!payload) return NextResponse.json({ error: 'Token expirado ou inválido.' }, { status: 401 })

  if (!photo || typeof photo !== 'string') {
    return NextResponse.json({ error: 'Foto obrigatória.' }, { status: 400 })
  }

  // ------------------------------------------------------------------
  // Decodifica e valida a foto antes de gastar uma ida ao aparelho
  // ------------------------------------------------------------------
  const match = /^data:image\/(jpeg|jpg|png);base64,(.+)$/i.exec(photo.trim())
  if (!match) {
    return NextResponse.json(
      { error: 'Formato inválido. Envie uma foto JPG ou PNG.' },
      { status: 400 }
    )
  }

  const ext = match[1].toLowerCase() === 'png' ? 'png' : 'jpg'
  const buffer = Buffer.from(match[2], 'base64')

  if (buffer.length === 0) {
    return NextResponse.json({ error: 'Foto vazia.' }, { status: 400 })
  }
  if (buffer.length > MAX_BYTES) {
    return NextResponse.json(
      { error: 'Foto muito grande. O limite do leitor é 2MB.' },
      { status: 400 }
    )
  }

  // ------------------------------------------------------------------
  // Carrega o membro (fonte da verdade — nunca confiar no que vem do client)
  // ------------------------------------------------------------------
  const { data: member, error: memberError } = await supabaseAdmin
    .from('members')
    .select('id, full_name, cpf, rol, church_id')
    .eq('id', payload.sub)
    .maybeSingle()

  if (memberError) {
    console.error('faceid/enroll: erro ao buscar membro', memberError)
    return NextResponse.json({ error: 'Erro ao carregar seus dados.' }, { status: 500 })
  }
  if (!member) {
    return NextResponse.json({ error: 'Membro não encontrado.' }, { status: 404 })
  }
  if (member.rol === null || member.rol === undefined) {
    return NextResponse.json(
      { error: 'Seu cadastro não possui número de ROL. Procure a secretaria.' },
      { status: 400 }
    )
  }
  if (!member.church_id) {
    return NextResponse.json(
      { error: 'Seu cadastro não está vinculado a uma igreja.' },
      { status: 400 }
    )
  }

  // ------------------------------------------------------------------
  // Dispositivos-alvo do cadastro:
  //   { dispositivos da Sede (is_sede) }              -> todos cadastram
  //   ∪ { vinculados à igreja do membro (primária) }
  //   ∪ { vinculados à igreja do membro (secundária) }
  //
  // Assim o membro de uma congregação cadastra nos leitores da Sede E nos
  // da própria igreja; o da Sede, só nos da Sede. Cada leitor pode ser
  // executado por uma máquina diferente (agent_id) — os jobs se distribuem.
  // ------------------------------------------------------------------
  const { data: devices, error: devError } = await supabaseAdmin
    .from('faceid_devices')
    .select('id, name, local_host, is_active, is_sede, church_id, secondary_church_id')
    .eq('is_active', true)
    .or(
      `is_sede.eq.true,church_id.eq.${member.church_id},secondary_church_id.eq.${member.church_id}`
    )

  if (devError) {
    console.error('faceid/enroll: erro ao buscar dispositivos', devError)
    return NextResponse.json({ error: 'Erro ao localizar os leitores.' }, { status: 500 })
  }

  // Precisa de host local (o agente alcança o aparelho por ele) e, por
  // segurança, remove duplicatas caso um leitor case em mais de um critério.
  const seen = new Set<string>()
  const usable = (devices || []).filter((d) => {
    if (!d.local_host || seen.has(d.id)) return false
    seen.add(d.id)
    return true
  })

  if (usable.length === 0) {
    return NextResponse.json(
      {
        error:
          'Nenhum leitor disponível para o seu cadastro ainda. Procure a secretaria.',
      },
      { status: 409 }
    )
  }

  // ------------------------------------------------------------------
  // Sobe a foto uma única vez; os jobs apenas referenciam a URL
  // ------------------------------------------------------------------
  const batchId = randomUUID()
  const path = `faceid/enroll/${member.id}/${batchId}.${ext}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from('dados')
    .upload(path, buffer, {
      contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
      upsert: true,
    })

  if (uploadError) {
    console.error('faceid/enroll: erro no upload da foto', uploadError)
    return NextResponse.json({ error: 'Não foi possível salvar a foto.' }, { status: 500 })
  }

  // Guarda o CAMINHO no storage, não uma URL pública: foto de rosto é dado
  // biométrico. O agente recebe uma URL assinada de curta duração na hora
  // de processar o job.
  const photoUrl = path

  // ------------------------------------------------------------------
  // Cria um job por dispositivo. O trigger no banco dispara o Realtime
  // para os agentes que estiverem escutando (apenas status 'pending').
  // ------------------------------------------------------------------
  const status = REQUIRE_APPROVAL ? 'needs_approval' : 'pending'

  const jobs = usable.map((d) => ({
    batch_id: batchId,
    // Igreja do DISPOSITIVO (não a do membro): um leitor da Sede fica na
    // igreja Sede mesmo quando quem cadastra é de uma congregação. Cai no
    // church do membro quando o leitor ainda não tem igreja definida.
    church_id: d.church_id || member.church_id,
    device_id: d.id,
    member_id: member.id,
    rol: Number(member.rol),
    nome: member.full_name,
    cpf: member.cpf || null,
    photo_url: photoUrl,
    status,
    allow_update: allowUpdate === true,
  }))

  const { error: insertError } = await supabaseAdmin
    .from('face_enrollment_jobs')
    .insert(jobs)

  if (insertError) {
    console.error('faceid/enroll: erro ao criar jobs', insertError)
    return NextResponse.json({ error: 'Não foi possível registrar a solicitação.' }, { status: 500 })
  }

  return NextResponse.json({
    batch_id: batchId,
    status,
    devices: usable.length,
    message: REQUIRE_APPROVAL
      ? 'Solicitação enviada. Aguardando liberação da secretaria.'
      : 'Solicitação enviada aos leitores da sua igreja.',
  })
}
