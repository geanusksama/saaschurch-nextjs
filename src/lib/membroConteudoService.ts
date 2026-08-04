/**
 * Conteúdo dos módulos do Portal do Membro (Pão diário, Pregações, Agenda,
 * Liderança, Igreja).
 *
 * Tudo é lido pelo campo do membro. O portal usa `supabaseAdmin`, que faz
 * bypass de RLS, então o filtro por `campo_id` é SEMPRE explícito aqui — é a
 * única coisa que impede um membro de Campinas ver o conteúdo de Curitiba.
 */
import { supabaseAdmin } from '@/lib/supabase-admin'

/** Descobre o campo do membro. Sem campo, não há o que mostrar. */
export async function getCampoDoMembro(memberId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('members')
    .select('campo_id, church_id, regional_id')
    .eq('id', memberId)
    .maybeSingle()

  if (data?.campo_id) return data.campo_id

  // Cadastros antigos não têm campo_id preenchido — cai na hierarquia,
  // mesma cadeia de fallback usada por fn_get_my_campo_id() no banco.
  if (data?.regional_id) {
    const { data: reg } = await supabaseAdmin
      .from('regionais').select('campo_id').eq('id', data.regional_id).maybeSingle()
    if (reg?.campo_id) return reg.campo_id
  }
  if (data?.church_id) {
    const { data: ch } = await supabaseAdmin
      .from('churches').select('headquarters_id, regional_id').eq('id', data.church_id).maybeSingle()
    if (ch?.headquarters_id) return ch.headquarters_id
    if (ch?.regional_id) {
      const { data: reg } = await supabaseAdmin
        .from('regionais').select('campo_id').eq('id', ch.regional_id).maybeSingle()
      if (reg?.campo_id) return reg.campo_id
    }
  }
  return null
}

// ── Pão diário ──────────────────────────────────────────────────────────────

export interface PaoDiario {
  id: string
  titulo: string
  versiculo: string | null
  referencia: string | null
  texto: string | null
  audio_url: string | null
  imagem_url: string | null
  data: string | null
  autor: string | null
}

export async function getPaoDiario(campoId: string, limite = 30): Promise<PaoDiario[]> {
  const { data } = await supabaseAdmin
    .from('app_daily_bread_entries')
    .select('*')
    .eq('campo_id', campoId)
    .eq('active', true)
    // a coluna de data é `published_at`; `publish_date` não existe e fazia a
    // consulta falhar, devolvendo lista vazia sempre
    .order('published_at', { ascending: false })
    .limit(limite)

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    // A tabela conviveu com nomes diferentes de coluna ao longo do tempo;
    // aceitar os dois evita tela vazia por causa de nomenclatura.
    titulo: String(r.title ?? r.titulo ?? 'Pão diário'),
    versiculo: (r.summary ?? r.verse_text ?? r.versiculo ?? null) as string | null,
    referencia: (r.bible_reference ?? r.verse_reference ?? r.referencia ?? null) as string | null,
    texto: (r.body_text ?? r.content ?? r.texto ?? null) as string | null,
    audio_url: (r.audio_url ?? null) as string | null,
    imagem_url: (r.image_url ?? r.imagem_url ?? null) as string | null,
    data: (r.published_at ?? r.publish_date ?? r.data ?? null) as string | null,
    autor: (r.author ?? r.autor ?? null) as string | null,
  }))
}

/** 3725 → "1:02:05"; 245 → "4:05". Devolve null se não houver duração. */
function formatarDuracao(segundos: unknown): string | null {
  const s = Number(segundos)
  if (!Number.isFinite(s) || s <= 0) return null
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const seg = Math.floor(s % 60)
  const dd = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${dd(m)}:${dd(seg)}` : `${m}:${dd(seg)}`
}

// ── Pregações / mídia ───────────────────────────────────────────────────────

export interface Pregacao {
  id: string
  titulo: string
  descricao: string | null
  thumb: string | null
  url: string | null
  duracao: string | null
  data: string | null
  pregador: string | null
  /** live | short | sermon | podcast — comanda as abas e o destaque da tela */
  tipo: string
  selo: string | null
  visualizacoes: number
  ao_vivo: boolean
  cor: string | null
}

export async function getPregacoes(campoId: string, limite = 40): Promise<Pregacao[]> {
  const { data } = await supabaseAdmin
    .from('app_media_items')
    .select('*')
    .eq('campo_id', campoId)
    .eq('active', true)
    .eq('publish_status', 'published')
    .order('published_at', { ascending: false })
    .limit(limite)

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    titulo: String(r.title ?? r.titulo ?? 'Sem título'),
    descricao: (r.description ?? r.descricao ?? null) as string | null,
    thumb: (r.thumbnail_url ?? r.poster_url ?? null) as string | null,
    // as colunas reais são watch_url/embed_url — video_url/media_url não existem
    url: (r.watch_url ?? r.embed_url ?? null) as string | null,
    duracao: formatarDuracao(r.duration_seconds),
    data: (r.published_at ?? r.starts_at ?? r.created_at ?? null) as string | null,
    pregador: (r.subtitle ?? null) as string | null,
    tipo: String(r.kind ?? 'sermon'),
    selo: (r.badge_label ?? null) as string | null,
    visualizacoes: Number(r.view_count ?? 0),
    ao_vivo: Boolean(r.is_live_now),
    cor: (r.accent_hex ?? null) as string | null,
  }))
}

// ── Agenda ──────────────────────────────────────────────────────────────────

export interface EventoAgenda {
  id: string
  titulo: string
  descricao: string | null
  banner: string | null
  inicio: string | null
  fim: string | null
  local: string | null
  gratuito: boolean
  preco: number
}

export async function getAgenda(campoId: string, limite = 40): Promise<EventoAgenda[]> {
  const { data } = await supabaseAdmin
    .from('app_events')
    .select('id, nome, title, descricao, description, banner_url, imagem_url, ' +
            'data_inicio, data_fim, local, local_endereco, gratuito, preco, default_price')
    .eq('campo_id', campoId)
    .eq('status', 'PUBLICADO')
    .is('deleted_at', null)
    .order('data_inicio', { ascending: true })
    .limit(limite)
    // O client não conhece o schema: sem isto ele infere um tipo de erro.
    .returns<Record<string, unknown>[]>()

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    titulo: String(r.nome ?? r.title ?? 'Evento'),
    descricao: (r.descricao ?? r.description ?? null) as string | null,
    banner: (r.banner_url ?? r.imagem_url ?? null) as string | null,
    inicio: (r.data_inicio ?? null) as string | null,
    fim: (r.data_fim ?? null) as string | null,
    local: (r.local ?? r.local_endereco ?? null) as string | null,
    gratuito: Boolean(r.gratuito),
    preco: Number(r.preco ?? r.default_price ?? 0),
  }))
}

// ── Liderança ───────────────────────────────────────────────────────────────

export interface Lider {
  id: string
  nome: string
  cargo: string | null
  foto: string | null
  grupo: string | null
  ordem: number
}

export async function getLideranca(campoId: string): Promise<Lider[]> {
  const { data } = await supabaseAdmin
    .from('app_lideranca')
    .select('*')
    .eq('campo_id', campoId)
    .eq('ativo', true)
    .order('ordem', { ascending: true })

  return (data ?? []).map((r: Record<string, unknown>, i: number) => ({
    id: String(r.id),
    nome: String(r.nome ?? r.name ?? ''),
    cargo: (r.cargo ?? r.funcao ?? r.role ?? null) as string | null,
    foto: (r.foto_url ?? r.photo_url ?? r.foto ?? null) as string | null,
    grupo: (r.grupo ?? r.categoria ?? null) as string | null,
    ordem: Number(r.ordem ?? i),
  })).filter(l => l.nome)
}

// ── Igreja (localização e contatos) ─────────────────────────────────────────

export interface DadosIgreja {
  perfil: Record<string, unknown> | null
  horarios: Record<string, unknown>[]
  contatos: Record<string, unknown>[]
  acesso: Record<string, unknown>[]
  redes: Record<string, unknown>[]
}

export async function getIgreja(campoId: string): Promise<DadosIgreja> {
  // A coluna de ordenação destas tabelas é `sort_order` — ordenar por `ordem`
  // faz o PostgREST devolver erro e a lista vinha sempre vazia. Só linhas
  // `active` entram: o CMS despublica escondendo, não apagando.
  const [perfil, horarios, contatos, acesso, redes] = await Promise.all([
    supabaseAdmin.from('app_location_profiles').select('*').eq('campo_id', campoId).eq('active', true).maybeSingle(),
    supabaseAdmin.from('app_location_schedule').select('*').eq('campo_id', campoId).eq('active', true).order('sort_order'),
    supabaseAdmin.from('app_location_contacts').select('*').eq('campo_id', campoId).eq('active', true).order('sort_order'),
    supabaseAdmin.from('app_location_access_info').select('*').eq('campo_id', campoId).eq('active', true).order('sort_order'),
    supabaseAdmin.from('app_location_social_links').select('*').eq('campo_id', campoId).eq('active', true).order('sort_order'),
  ])

  return {
    perfil: perfil.data ?? null,
    horarios: horarios.data ?? [],
    contatos: contatos.data ?? [],
    acesso: acesso.data ?? [],
    redes: redes.data ?? [],
  }
}

export interface Ministerio {
  id: string
  nome: string
  descricao: string | null
  cor: string | null
  icone: string | null
  email: string | null
  telefone: string | null
}

export async function getMinisterios(campoId: string): Promise<Ministerio[]> {
  const { data } = await supabaseAdmin
    .from('ministries')
    .select('id, name, description, color, icon, email, phone, ordem')
    .eq('campo_id', campoId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('ordem', { ascending: true })
    .returns<Record<string, unknown>[]>()

  return (data ?? []).map(m => ({
    id: String(m.id),
    nome: String(m.name ?? ''),
    descricao: (m.description ?? null) as string | null,
    cor: (m.color ?? null) as string | null,
    icone: (m.icon ?? null) as string | null,
    email: (m.email ?? null) as string | null,
    telefone: (m.phone ?? null) as string | null,
  })).filter(m => m.nome)
}

export interface Ingresso {
  id: string
  codigo: string
  evento: string | null
  assento: string | null
  data_evento: string | null
  emitido_em: string | null
  usado: boolean
  cancelado: boolean
}

/**
 * Ingressos do membro.
 *
 * `orders`/`order_qrcodes` são indexados pelo usuário do Supabase Auth, não
 * pelo id do membro — a ponte é `members.user_id`. Quem nunca entrou pelo app
 * Flutter não tem esse vínculo e vê a lista vazia, o que é correto: são
 * ingressos de outra pessoa até que o vínculo exista.
 */
export async function getIngressos(memberId: string, campoId: string): Promise<Ingresso[]> {
  const { data: membro } = await supabaseAdmin
    .from('members')
    .select('user_id')
    .eq('id', memberId)
    .maybeSingle()

  const userId = (membro as { user_id?: string } | null)?.user_id
  if (!userId) return []

  const { data } = await supabaseAdmin
    .from('order_qrcodes')
    .select('id, ticket_code, is_used, is_cancelled, issued_at, event_id, order_items(seat_label)')
    .eq('user_id', userId)
    .eq('campo_id', campoId)
    .order('issued_at', { ascending: false })
    .limit(100)
    .returns<Record<string, unknown>[]>()

  const linhas = data ?? []
  const eventoIds = [...new Set(linhas.map(l => l.event_id).filter(Boolean))] as string[]

  const titulos = new Map<string, { nome: string; data: string | null }>()
  if (eventoIds.length) {
    const { data: evs } = await supabaseAdmin
      .from('app_events')
      .select('id, nome, title, data_inicio')
      .in('id', eventoIds)
      .returns<Record<string, unknown>[]>()
    for (const e of evs ?? []) {
      titulos.set(String(e.id), {
        nome: String(e.nome ?? e.title ?? 'Evento'),
        data: (e.data_inicio ?? null) as string | null,
      })
    }
  }

  return linhas.map(l => {
    const ev = titulos.get(String(l.event_id))
    const item = l.order_items as { seat_label?: string } | null
    return {
      id: String(l.id),
      codigo: String(l.ticket_code ?? ''),
      evento: ev?.nome ?? null,
      assento: item?.seat_label ?? null,
      data_evento: ev?.data ?? null,
      emitido_em: (l.issued_at ?? null) as string | null,
      usado: Boolean(l.is_used),
      cancelado: Boolean(l.is_cancelled),
    }
  })
}

export interface PostFeed {
  id: string
  titulo: string | null
  conteudo: string | null
  midia: string | null
  midia_tipo: string | null
  autor: string | null
  autor_foto: string | null
  curtidas: number
  comentarios: number
  data: string | null
  local: string | null
  verificado: boolean
}

/**
 * Mural do campo. Existe também em POST /api/membro/content?resource=feed, mas
 * lá o campo vem do `campo_id` gravado no token — e cadastro antigo sem
 * campo_id recebe 400. Aqui o campo passa por getCampoDoMembro(), que cai na
 * hierarquia igreja→regional→campo, então o membro antigo também vê o mural.
 */
export async function getFeed(campoId: string, limite = 40): Promise<PostFeed[]> {
  const { data } = await supabaseAdmin
    .from('feed_posts')
    .select('id,title,content,media_url,media_type,author_name,author_avatar_url,likes_count,comments_count,created_at,location,author_verified')
    .eq('campo_id', campoId)
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(limite)

  return (data ?? []).map(p => ({
    id: String(p.id),
    titulo: p.title ?? null,
    conteudo: p.content ?? null,
    midia: p.media_url ?? null,
    midia_tipo: p.media_type ?? null,
    autor: p.author_name ?? null,
    autor_foto: p.author_avatar_url ?? null,
    curtidas: Number(p.likes_count ?? 0),
    comentarios: Number(p.comments_count ?? 0),
    data: p.created_at ?? null,
    local: p.location ?? null,
    verificado: Boolean(p.author_verified),
  }))
}
