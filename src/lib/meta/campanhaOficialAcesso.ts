/**
 * Isolamento das campanhas pelo número oficial: campanha com meta_modelo_id só é vista e
 * controlada no campo do seu número; retomar e processar exigem a permissão de envio oficial.
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../supabase-admin'
import { exigirPermissao } from '../permissoes/servidor'
import { campanhaVisivelNoCampo } from './campanhaOficial'

type UsuarioCampo = Parameters<typeof exigirPermissao>[0]

/** campo_id do número oficial de cada campanha (só as que têm instância oficial). */
export async function camposDasCampanhas(ids: string[]): Promise<Map<string, string | null>> {
  const mapa = new Map<string, string | null>()
  if (!ids.length) return mapa
  const { data } = await supabaseAdmin
    .from('whatsapp_campaign_instances')
    .select('campaign_id, whatsapp_instances(campo_id, provider)')
    .in('campaign_id', ids)
  for (const r of data ?? []) {
    const i = r.whatsapp_instances as unknown as { campo_id: string | null; provider: string } | null
    if (i?.provider === 'meta') mapa.set(r.campaign_id as string, i.campo_id)
  }
  return mapa
}

/**
 * null = pode seguir. Campanha oficial de outro campo ⇒ 404; com `exigirEnvio`, também a
 * permissão whatsapp_oficial.campanha.enviar. Campanha Z-API passa sem nenhuma checagem.
 */
export async function barrarCampanhaOficial(
  user: UsuarioCampo & { campoId?: string | null },
  campanha: { id: string; meta_modelo_id?: string | null },
  opts: { exigirEnvio?: boolean } = {},
): Promise<NextResponse | null> {
  if (!campanha.meta_modelo_id) return null
  const campos = await camposDasCampanhas([campanha.id])
  if (!campanhaVisivelNoCampo(campanha, campos.get(campanha.id) ?? null, user.campoId)) {
    return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })
  }
  if (opts.exigirEnvio) return exigirPermissao(user, 'whatsapp_oficial.campanha.enviar')
  return null
}
