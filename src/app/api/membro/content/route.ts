import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/membroJwt'
import { supabaseAdmin } from '@/lib/supabase-admin'

type MemberPayload = {
  sub: string
  campo_id?: string
  church_id?: string
}

const ALLOWED = ['feed', 'lideranca', 'testemunhos', 'pao-diario', 'pregacoes', 'agenda'] as const
type Resource = typeof ALLOWED[number]

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { token, resource, params = {} } = body as { token?: string; resource?: string; params?: Record<string, unknown> }

  if (!token) return NextResponse.json({ error: 'Token obrigatório.' }, { status: 401 })
  if (!resource || !ALLOWED.includes(resource as Resource)) {
    return NextResponse.json({ error: 'Recurso inválido.' }, { status: 400 })
  }

  const payload = verifyToken<MemberPayload>(token)
  if (!payload) return NextResponse.json({ error: 'Token expirado ou inválido.' }, { status: 401 })

  const campoId = payload.campo_id
  if (!campoId) return NextResponse.json({ error: 'Campo não identificado.' }, { status: 400 })

  let data: unknown[] = []
  let error: unknown = null

  switch (resource as Resource) {
    case 'feed': {
      const q = await supabaseAdmin
        .from('feed_posts')
        .select('id,title,content,media_url,media_type,author_name,author_avatar_url,likes_count,comments_count,created_at')
        .eq('campo_id', campoId)
        .eq('is_published', true)
        .order('created_at', { ascending: false })
        .limit(40)
      data = q.data || []; error = q.error
      break
    }

    case 'lideranca': {
      const q = await supabaseAdmin
        .from('app_lideranca')
        .select('id,nome,cargo,descricao,foto_url,tipo,ordem')
        .eq('campo_id', campoId)
        .eq('ativo', true)
        .order('ordem', { ascending: true })
      data = q.data || []; error = q.error
      break
    }

    case 'testemunhos': {
      const q = await supabaseAdmin
        .from('app_testemunhos')
        .select('id,autor,titulo,corpo,likes,created_at')
        .eq('campo_id', campoId)
        .eq('ativo', true)
        .order('created_at', { ascending: false })
        .limit(30)
      data = q.data || []; error = q.error
      break
    }

    case 'pao-diario': {
      const today = new Date().toISOString().split('T')[0]
      const q = await supabaseAdmin
        .from('app_daily_bread_entries')
        .select('id,title,verse_reference,verse_text,content,date,author')
        .eq('campo_id', campoId)
        .lte('date', today)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle()
      data = q.data ? [q.data] : []; error = q.error
      break
    }

    case 'pregacoes': {
      const q = await supabaseAdmin
        .from('app_media_items')
        .select('id,title,description,thumbnail_url,kind,duration_seconds,published_at,speaker_name')
        .in('kind', ['sermon', 'short', 'clip', 'podcast'])
        .eq('publish_status', 'published')
        .order('published_at', { ascending: false })
        .limit(30)
      data = q.data || []; error = q.error
      break
    }

    case 'agenda': {
      const { from, to } = params as { from?: string; to?: string }
      if (!from || !to) return NextResponse.json({ error: 'Parâmetros from/to obrigatórios.' }, { status: 400 })
      const q = await supabaseAdmin
        .from('tbeventos')
        .select('*')
        .eq('campo_id', campoId)
        .gte('data', from)
        .lte('data', to)
        .order('data', { ascending: true })
      data = q.data || []; error = q.error
      break
    }
  }

  if (error) {
    console.error(`[membro/content] ${resource}:`, error)
    return NextResponse.json({ error: 'Erro ao buscar dados.' }, { status: 500 })
  }

  return NextResponse.json({ data })
}
