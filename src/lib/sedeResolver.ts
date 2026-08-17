/**
 * Resolve a IGREJA SEDE de um campo.
 *
 * Contexto do schema (conferido na base em 2026-07-28):
 *  - `headquarters` é o cadastro da sede do campo (`field_id` → campo), com
 *    contatos, redes sociais e dados fiscais. É o registro que identifica a
 *    sede — mas NÃO tem `church_id`, então não aponta para a linha de
 *    `churches` correspondente.
 *  - `churches.headquarters_id` é FK para `headquarters`, e o vínculo está
 *    sujo: 12 igrejas (inclusive de Aguaí) apontam para "001-Campinas - SEDE".
 *  - o campo de uma igreja vem por `churches.regional_id → regionais.campo_id`.
 *
 * Por isso a resolução é feita pelo caminho confiável (campo → regionais →
 * igrejas) e só então escolhe a sede pelo nome. Enquanto não existir um
 * ponteiro explícito (`headquarters.sede_church_id`), esta é uma heurística —
 * e ela NUNCA devolve uma igreja de outro campo: se não achar, devolve null e
 * quem chamou decide o fallback.
 */

import { supabaseAdmin } from '@/lib/supabase-admin'

export interface SedeResolution {
  churchId: string | null
  churchName: string | null
  /** como foi resolvido — útil para diagnosticar cadastro errado */
  method: 'nome_sede' | 'headquarters' | 'unica_igreja' | 'nao_encontrada'
}

/** Igrejas de um campo, via regionais. */
async function churchesOfCampo(campoId: string): Promise<Array<{ id: string; name: string; headquarters_id: string | null }>> {
  const { data: regionais } = await supabaseAdmin
    .from('regionais')
    .select('id')
    .eq('campo_id', campoId)

  const regionalIds = (regionais ?? []).map(r => r.id)
  if (!regionalIds.length) return []

  const { data: churches } = await supabaseAdmin
    .from('churches')
    .select('id, name, headquarters_id')
    .in('regional_id', regionalIds)
    .is('deleted_at', null)

  return churches ?? []
}

/**
 * Igreja sede do campo escolhido. Devolve `churchId: null` quando não dá para
 * afirmar com segurança — melhor não adivinhar do que cadastrar o membro na
 * igreja errada.
 */
export async function resolveSedeChurchOfCampo(campoId: string): Promise<SedeResolution> {
  try {
    return await resolveInterno(campoId)
  } catch (err) {
    // cadastro de campo incompleto é o estado normal hoje — nunca derrubar o
    // pedido público por causa disso; quem chama decide o fallback
    console.warn('[sedeResolver] falha ao resolver a sede do campo', campoId, err)
    return { churchId: null, churchName: null, method: 'nao_encontrada' }
  }
}

/**
 * Igreja SEDE do campo a que uma igreja pertence.
 *
 * É o caminho do "Quero ser Membro" quando a pessoa escolhe a igreja: quem
 * entrevista e decide é a sede do campo dela (igreja → regional → campo →
 * sede). A própria sede escolhida devolve ela mesma, sem tratamento especial.
 *
 * `churchId: null` quando não dá para afirmar — quem chama decide o fallback,
 * que NUNCA deve ser a sede de outro campo.
 */
export async function resolveSedeChurchOfChurch(
  churchId: string
): Promise<SedeResolution & { campoId: string | null }> {
  try {
    const { data: igreja } = await supabaseAdmin
      .from('churches')
      .select('id, regional_id')
      .eq('id', churchId)
      .is('deleted_at', null)
      .maybeSingle()

    if (!igreja?.regional_id) {
      return { churchId: null, churchName: null, method: 'nao_encontrada', campoId: null }
    }

    const { data: regional } = await supabaseAdmin
      .from('regionais')
      .select('campo_id')
      .eq('id', igreja.regional_id)
      .maybeSingle()

    const campoId = regional?.campo_id ?? null
    if (!campoId) {
      return { churchId: null, churchName: null, method: 'nao_encontrada', campoId: null }
    }

    const sede = await resolveSedeChurchOfCampo(String(campoId))
    return { ...sede, campoId: String(campoId) }
  } catch (err) {
    console.warn('[sedeResolver] falha ao resolver a sede da igreja', churchId, err)
    return { churchId: null, churchName: null, method: 'nao_encontrada', campoId: null }
  }
}

async function resolveInterno(campoId: string): Promise<SedeResolution> {
  const churches = await churchesOfCampo(campoId)

  // nome do campo, para desempatar entre várias "Sede" no mesmo campo
  const { data: campo } = await supabaseAdmin
    .from('campos').select('name').eq('id', campoId).maybeSingle()
  const campoNome = String(campo?.name ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

  // campo com uma igreja só: não há ambiguidade
  if (churches.length === 1) {
    return { churchId: churches[0].id, churchName: churches[0].name, method: 'unica_igreja' }
  }

  // sem igreja no regional NÃO encerra a busca: o caminho da headquarters
  // (1c, abaixo) ainda resolve pelo nome do campo
  const semAcento = (v: string) =>
    v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

  // 1) a regra do negócio: nome com "Sede", separado por campo
  const porNome = churches.filter(c => /\bsede\b/i.test(c.name))
  if (porNome.length === 1) {
    return { churchId: porNome[0].id, churchName: porNome[0].name, method: 'nome_sede' }
  }

  // 1b) mais de uma "Sede" no mesmo campo — acontece quando igrejas de outro
  //     campo estão penduradas no regional (ex.: as de Aguaí dentro de
  //     Campinas). Fica a que também traz o nome do campo.
  if (porNome.length > 1 && campoNome) {
    const doCampo = porNome.filter(c => semAcento(c.name).includes(campoNome))
    if (doCampo.length === 1) {
      return { churchId: doCampo[0].id, churchName: doCampo[0].name, method: 'nome_sede' }
    }
  }

  // 1c) o campo não tem igreja pendurada em regional nenhum (cadastro
  //      incompleto). Cai no caminho da headquarters: ela sabe o campo
  //      (`field_name`), então procura no cadastro inteiro a igreja "Sede"
  //      daquele campo — que é a regra que o usuário descreveu.
  if (!churches.length || !porNome.length) {
    const { data: hqCampo } = await supabaseAdmin
      .from('headquarters')
      .select('field_name')
      .eq('field_id', campoId)
      .limit(1)
      .maybeSingle()

    const chave = semAcento(String(hqCampo?.field_name ?? campoNome))
    if (chave) {
      const { data: todas } = await supabaseAdmin
        .from('churches')
        .select('id, name')
        .ilike('name', '%sede%')
        .is('deleted_at', null)

      const doCampo = (todas ?? []).filter(c => semAcento(c.name).includes(chave))
      if (doCampo.length === 1) {
        return { churchId: doCampo[0].id, churchName: doCampo[0].name, method: 'headquarters' }
      }
      // várias "Sede" com o nome do campo (ex.: "AD Aguaí - Sede" e
      // "AD Aguaí 015 - Sede"): fica a de nome mais curto, que é a matriz
      if (doCampo.length > 1) {
        const escolhida = [...doCampo].sort((a, b) => a.name.length - b.name.length)[0]
        return { churchId: escolhida.id, churchName: escolhida.name, method: 'headquarters' }
      }
    }
  }

  // 2) empate no nome: desempata pela headquarters do próprio campo
  const { data: hq } = await supabaseAdmin
    .from('headquarters')
    .select('id')
    .eq('field_id', campoId)
    .limit(1)
    .maybeSingle()

  if (hq) {
    const candidatas = (porNome.length ? porNome : churches).filter(c => c.headquarters_id === hq.id)
    if (candidatas.length === 1) {
      return { churchId: candidatas[0].id, churchName: candidatas[0].name, method: 'headquarters' }
    }
  }

  // ainda ambíguo: quem chamou decide o fallback em vez de a gente chutar
  return { churchId: null, churchName: null, method: 'nao_encontrada' }
}
