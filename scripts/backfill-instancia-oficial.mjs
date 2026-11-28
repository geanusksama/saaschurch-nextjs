/**
 * backfill-instancia-oficial.mjs
 *
 * Cria/atualiza em whatsapp_instances a instância espelho (provider 'meta') de cada
 * conexão em meta_whatsapp_conexoes e grava meta_whatsapp_conexoes.instancia_id.
 * Idempotente. Mesma regra de src/lib/meta/instanciaCampo.ts (linhaDaInstanciaOficial).
 *
 * Uso:
 *   node scripts/backfill-instancia-oficial.mjs            # simulação (não grava)
 *   node scripts/backfill-instancia-oficial.mjs --aplicar  # grava
 */
import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'
import { linhaDaInstanciaOficial } from '../src/lib/meta/instanciaCampo.ts'

const aplicar = process.argv.includes('--aplicar')
const prisma = new PrismaClient()
const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

async function main() {
  console.log(aplicar ? '\n=== Backfill instância oficial (APLICANDO) ===' : '\n=== Backfill instância oficial (simulação; use --aplicar para gravar) ===')
  const conexoes = await prisma.metaWhatsappConexao.findMany({ orderBy: { conectadoEm: 'asc' } })
  const master = await prisma.user.findFirst({ where: { profileType: 'master' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true } })
  let criadas = 0, atualizadas = 0

  for (const c of conexoes) {
    const linha = linhaDaInstanciaOficial(c)
    const { data: existente, error } = await supa.from('whatsapp_instances').select('id')
      .eq('provider', 'meta').eq('instance_id', linha.instance_id).maybeSingle()
    if (error) throw new Error(error.message)
    const dono = c.conectadoPor ?? master?.id
    console.log(`${existente ? 'atualiza' : 'cria    '} ${linha.instance_id} campo=${c.campoId} nome="${linha.name}" status=${linha.status}`)
    if (!aplicar) continue
    let id = existente?.id
    if (id) {
      const { error: e } = await supa.from('whatsapp_instances').update({ ...linha, updated_at: new Date().toISOString() }).eq('id', id)
      if (e) throw new Error(e.message)
      atualizadas++
    } else {
      if (!dono) throw new Error('Sem usuário para ser dono da instância.')
      const { data, error: e } = await supa.from('whatsapp_instances').insert({ ...linha, owner_user_id: dono }).select('id').single()
      if (e) throw new Error(e.message)
      id = data.id
      criadas++
    }
    await prisma.metaWhatsappConexao.update({ where: { id: c.id }, data: { instanciaId: id } })
  }
  console.log(`\nConexões: ${conexoes.length}${aplicar ? ` | criadas: ${criadas} | atualizadas: ${atualizadas}` : ' (nada gravado)'}`)
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
