/**
 * E2E do Envio em Massa pelo número oficial (Meta): cria uma campanha com modelo e 2
 * destinatários (um na lista de exclusão), roda 2 ticks reais de processCampaignTick com a
 * Graph FALSA (nenhuma chamada à Meta) e confere 1 `sent` + 1 `skipped`, a conversa e a
 * mensagem com metadata.meta_message_id. O banco é o de produção: o script cria só linhas
 * próprias (prefixo E2E) e apaga tudo no finally.
 *
 * Uso: npx tsx scripts/e2e-campanha-oficial.mjs
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })
import { randomUUID } from 'node:crypto'

const { prisma } = await import('../src/lib/prisma.ts')
const { supabaseAdmin } = await import('../src/lib/supabase-admin.ts')
const { processCampaignTick } = await import('../src/lib/whatsappCampaignService.ts')
const { telefonesExcluidos } = await import('../src/lib/meta/envioRepo.ts')
const modelosRepo = await import('../src/lib/meta/modelosRepo.ts')

const TAG = `E2E-${randomUUID().slice(0, 8)}`
const DONO = `e2e-campanha-oficial-${TAG}`
const TEL_OK = '5511999990001'
const TEL_EXCLUIDO = '5511999990002'
let passou = 0, falhou = 0
const ok = (rotulo, cond, det = '') => { cond ? passou++ : falhou++; console.log(`  ${cond ? '✓' : '✗'} ${rotulo}${det ? ` — ${det}` : ''}`) }
const criado = { instanciaId: null, modeloId: null, campanhaId: null, campoId: null, exclusaoId: null }

try {
  const campo = await prisma.campo.findFirst({ select: { id: true } })
  if (!campo) throw new Error('nenhum campo no banco')
  criado.campoId = campo.id

  const { data: inst, error: eInst } = await supabaseAdmin.from('whatsapp_instances').insert({
    name: `${TAG} Oficial`, instance_id: `meta:${TAG}`, provider: 'meta', campo_id: campo.id,
    status: 'connected', is_active: true, owner_user_id: DONO,
  }).select('id').single()
  if (eInst) throw new Error(`instância: ${eInst.message}`)
  criado.instanciaId = inst.id

  const modelo = await prisma.metaWhatsappModelo.create({
    data: {
      campoId: campo.id, wabaId: `waba-${TAG}`, metaTemplateId: `tpl-${TAG}`, nome: `e2e_${TAG.toLowerCase().replace(/-/g, '_')}`,
      idioma: 'pt_BR', categoria: 'UTILITY', status: 'APPROVED',
      componentes: [{ type: 'BODY', text: 'Paz, {{1}}! Aviso da {{2}}.' }],
      variaveis: [{ posicao: 1, tipo: 'nome', exemplo: 'Ana' }, { posicao: 2, tipo: 'igreja', exemplo: 'AD' }],
    },
  })
  criado.modeloId = modelo.id
  const excl = await prisma.metaWhatsappExclusao.create({ data: { campoId: campo.id, telefone: TEL_EXCLUIDO, motivo: 'e2e' } })
  criado.exclusaoId = excl.id

  const { data: camp, error: eCamp } = await supabaseAdmin.from('whatsapp_campaigns').insert({
    owner_user_id: DONO, name: `${TAG} campanha`, message_template: `Modelo oficial: ${modelo.nome}`,
    status: 'running', interval_seconds: 5, total_recipients: 2, started_at: new Date().toISOString(),
    meta_modelo_id: modelo.id, meta_variaveis: { 1: 'nome', 2: 'igreja' },
  }).select('id').single()
  if (eCamp) throw new Error(`campanha: ${eCamp.message}`)
  criado.campanhaId = camp.id
  await supabaseAdmin.from('whatsapp_campaign_instances').insert({ campaign_id: camp.id, instance_id: inst.id })
  for (const [nome, phone] of [['Maria Souza', TEL_OK], ['Joao Excluido', TEL_EXCLUIDO]]) {
    const { error } = await supabaseAdmin.from('whatsapp_campaign_recipients').insert({
      campaign_id: camp.id, source: 'member', source_id: `${TAG}-${phone}`, name: nome, phone, variables: { igreja: 'AD Teste' },
    })
    if (error) throw new Error(`destinatário: ${error.message}`)
    await new Promise((r) => setTimeout(r, 50)) // created_at distinto: ordem estável
  }

  // Graph falsa: guarda o que seria enviado; nenhuma chamada de rede.
  const posts = []
  const deps = {
    conexao: async () => ({ phoneNumberId: 'PN-E2E', token: 'token-falso' }),
    lerStatus: async () => ({ qualidade: 'GREEN', limiteDiario: 'TIER_250' }),
    excluido: async (campoId, tel) => (await telefonesExcluidos(campoId, [tel])).size > 0,
    modelo: async (campoId, id) => modelosRepo.buscar(campoId, id),
    usadosEm24h: async () => 0,
    graph: { post: async (caminho, corpo) => { posts.push({ caminho, corpo }); return { messages: [{ id: `wamid.${TAG}` }] } } },
  }

  console.log('\nTick 1 (destinatário normal)')
  const t1 = await processCampaignTick(camp.id, { depsOficial: deps })
  ok('evento sent', t1.event?.status === 'sent', JSON.stringify(t1.event?.error ?? ''))
  ok('Graph falsa recebeu 1 modelo com os parâmetros', posts.length === 1
    && posts[0].corpo.template.components[0].parameters.map((p) => p.text).join('|') === 'Maria|AD Teste', JSON.stringify(posts[0]?.corpo?.template?.components))

  console.log('\nTick 2 (destinatário em exclusão)')
  const t2 = await processCampaignTick(camp.id, { depsOficial: deps })
  ok('evento skipped', t2.event?.status === 'skipped')
  ok('nenhum POST novo à Graph', posts.length === 1)
  ok('campanha concluída', t2.done === true)

  console.log('\nBanco')
  const { data: rec } = await supabaseAdmin.from('whatsapp_campaign_recipients').select('phone,status').eq('campaign_id', camp.id)
  const st = Object.fromEntries((rec ?? []).map((r) => [r.phone, r.status]))
  ok('1 sent + 1 skipped', st[TEL_OK] === 'sent' && st[TEL_EXCLUIDO] === 'skipped', JSON.stringify(st))
  const { data: c } = await supabaseAdmin.from('whatsapp_campaigns').select('status,sent_count').eq('id', camp.id).single()
  ok('campanha completed, sent_count 1', c?.status === 'completed' && c?.sent_count === 1, JSON.stringify(c))
  const { data: conv } = await supabaseAdmin.from('whatsapp_conversations').select('id,phone').eq('instance_id', inst.id)
  ok('conversa gravada só para quem recebeu', conv?.length === 1 && conv[0].phone === TEL_OK)
  const { data: msgs } = await supabaseAdmin.from('whatsapp_messages').select('content,status,direction,metadata').eq('conversation_id', conv?.[0]?.id ?? randomUUID())
  ok('mensagem outbound com meta_message_id', msgs?.length === 1 && msgs[0].direction === 'outbound' && msgs[0].status === 'sent'
    && msgs[0].metadata?.meta_message_id === `wamid.${TAG}` && msgs[0].content === 'Paz, Maria! Aviso da AD Teste.', JSON.stringify(msgs))
} catch (e) {
  falhou++
  console.error('ERRO:', e)
} finally {
  console.log('\nLimpando...')
  const del = async (q) => { try { await q } catch (e) { console.error('  limpeza:', e?.message ?? e) } }
  if (criado.instanciaId) {
    const { data: convs } = await supabaseAdmin.from('whatsapp_conversations').select('id').eq('instance_id', criado.instanciaId)
    for (const cv of convs ?? []) await del(supabaseAdmin.from('whatsapp_messages').delete().eq('conversation_id', cv.id))
    await del(supabaseAdmin.from('whatsapp_conversations').delete().eq('instance_id', criado.instanciaId))
  }
  if (criado.campanhaId) {
    await del(supabaseAdmin.from('whatsapp_campaign_recipients').delete().eq('campaign_id', criado.campanhaId))
    await del(supabaseAdmin.from('whatsapp_campaign_instances').delete().eq('campaign_id', criado.campanhaId))
    await del(supabaseAdmin.from('whatsapp_campaigns').delete().eq('id', criado.campanhaId))
  }
  if (criado.instanciaId) await del(supabaseAdmin.from('whatsapp_instances').delete().eq('id', criado.instanciaId))
  if (criado.exclusaoId) await del(prisma.metaWhatsappExclusao.delete({ where: { id: criado.exclusaoId } }))
  if (criado.modeloId) await del(prisma.metaWhatsappModelo.delete({ where: { id: criado.modeloId } }))
  await prisma.$disconnect()
  console.log(`\n${passou} ok, ${falhou} falha(s)`)
  process.exit(falhou ? 1 : 0)
}
