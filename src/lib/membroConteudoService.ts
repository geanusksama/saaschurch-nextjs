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
    .order('publish_date', { ascending: false })
    .limit(limite)

  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    // A tabela conviveu com nomes diferentes de coluna ao longo do tempo;
    // aceitar os dois evita tela vazia por causa de nomenclatura.
    titulo: String(r.title ?? r.titulo ?? 'Pão diário'),
    versiculo: (r.verse_text ?? r.versiculo ?? null) as string | null,
    referencia: (r.verse_reference ?? r.referencia ?? null) as string | null,
    texto: (r.content ?? r.texto ?? r.reflection ?? null) as string | null,
    audio_url: (r.audio_url ?? null) as string | null,
    imagem_url: (r.image_url ?? r.imagem_url ?? null) as string | null,
    data: (r.publish_date ?? r.data ?? null) as string | null,
    autor: (r.author ?? r.autor ?? null) as string | null,
  }))
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
    thumb: (r.thumbnail_url ?? r.thumb_url ?? r.image_url ?? null) as string | null,
    url: (r.video_url ?? r.media_url ?? r.url ?? null) as string | null,
    duracao: (r.duration ?? r.duracao ?? null) as string | null,
    data: (r.published_at ?? r.created_at ?? null) as string | null,
    pregador: (r.speaker ?? r.pregador ?? null) as string | null,
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
  const [perfil, horarios, contatos, acesso, redes] = await Promise.all([
    supabaseAdmin.from('app_location_profiles').select('*').eq('campo_id', campoId).maybeSingle(),
    supabaseAdmin.from('app_location_schedule').select('*').eq('campo_id', campoId).order('ordem'),
    supabaseAdmin.from('app_location_contacts').select('*').eq('campo_id', campoId).order('ordem'),
    supabaseAdmin.from('app_location_access_info').select('*').eq('campo_id', campoId).order('ordem'),
    supabaseAdmin.from('app_location_social_links').select('*').eq('campo_id', campoId).order('ordem'),
  ])

  return {
    perfil: perfil.data ?? null,
    horarios: horarios.data ?? [],
    contatos: contatos.data ?? [],
    acesso: acesso.data ?? [],
    redes: redes.data ?? [],
  }
}
