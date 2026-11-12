/**
 * E2E da voz do agente (ElevenLabs), do assunto reservado e dos Relatórios
 * da Caixa do WhatsApp (12/11/2026).
 *
 * Cria tudo com prefixo [E2E] num CAMPO PRÓPRIO: campo, usuário administrador
 * com login, agente de IA (inativo — nenhum cron/webhook o usa), instância
 * WhatsApp falsa (sem credenciais reais: nada é enviado) e conversas com a
 * memória do agente. Nenhum registro real é tocado. Tudo é apagado no fim
 * (--keep preserva para inspeção).
 *
 *  1. /api/integracoes/elevenlabs: grava, mascara a chave, mantém a chave
 *     quando a tela devolve a máscara, testa a conexão (lista vozes).
 *  2. Voz de ponta a ponta na ElevenLabs: fala masculina → storage → a
 *     transcrição devolve o texto (é o caminho do áudio recebido).
 *  3. Assunto reservado sem contato configurado: NINGUÉM recebe (nem líder
 *     de área, nem padrão) e a conversa fica marcada.
 *  4. /api/whatsapp/relatorios: contagens, filtro por departamento, conversa
 *     reservada só como número (sem nome/telefone), resumo de reservada
 *     recusado, período inválido recusado.
 *
 * Precisa do servidor rodando. Usa a chave da ElevenLabs gravada para o campo
 * de Campinas (só leitura) — sem ela, os passos 1 e 2 são pulados.
 * Uso: npx tsx scripts/e2e-voz-relatorios.mjs [--keep] [--base=http://localhost:3005]
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

import { randomUUID } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'
import { encaminharParaLideres } from '../src/lib/encaminharLider.ts'
import { sintetizarFala, transcreverAudio, lerConfigElevenLabs, ELEVENLABS_PADRAO } from '../src/lib/elevenlabs.ts'

const prisma = new PrismaClient()
const BASE = (process.argv.find((a) => a.startsWith('--base=')) || '--base=http://localhost:3000').slice(7)
const KEEP = process.argv.includes('--keep')
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const CAMPO_CAMPINAS = '7e1cfbf6-f7b5-48d0-8926-7ed272e07e1d'

const SUFIXO = randomUUID().slice(0, 8)
const EMAIL = `e2e-voz-${SUFIXO}@example.com`
let falhas = 0
let passos = 0
function ok(nome, condicao, detalhe = '') {
  passos++
  if (condicao) console.log(`  ok   ${nome}`)
  else { falhas++; console.log(`  FALHA ${nome}${detalhe ? ` — ${detalhe}` : ''}`) }
}

async function pegarToken() {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: EMAIL })
  if (error) throw new Error(`generateLink: ${error.message}`)
  const anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } })
  const { data: s, error: e } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' })
  if (e) throw new Error(`verifyOtp: ${e.message}`)
  return s.session.access_token
}

async function api(caminho, token, { metodo = 'GET', corpo } = {}) {
  const r = await fetch(`${BASE}${caminho}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  return { status: r.status, json: await r.json().catch(() => null) }
}

const criados = { campoId: null, userId: null, authId: null, agentId: null, instanciaId: null, arquivos: [] }

async function limpar() {
  if (criados.instanciaId) {
    // conversas caem em cascata com a instância
    await admin.from('whatsapp_instances').delete().eq('id', criados.instanciaId)
  }
  if (criados.arquivos.length) await admin.storage.from('dados').remove(criados.arquivos)
  if (criados.campoId) await prisma.setting.deleteMany({ where: { campoId: criados.campoId } })
  if (criados.agentId) {
    await prisma.setting.deleteMany({ where: { settingKey: `ai_agente_aprendizado:${criados.agentId}` } })
    await prisma.aiAgent.delete({ where: { id: criados.agentId } }).catch(() => undefined)
  }
  if (criados.userId) {
    await prisma.auditLog.deleteMany({ where: { userId: criados.userId } }).catch(() => undefined)
    await prisma.user.delete({ where: { id: criados.userId } }).catch((e) => console.log('  (limpeza user)', e.message))
  }
  if (criados.authId) await admin.auth.admin.deleteUser(criados.authId).catch(() => undefined)
  if (criados.campoId) await prisma.campo.delete({ where: { id: criados.campoId } }).catch((e) => console.log('  (limpeza campo)', e.message))
}

const hoje = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10)

async function main() {
  console.log(`E2E voz + reservado + relatórios — ${BASE}`)
  const campo = await prisma.campo.create({ data: { name: `[E2E] Campo Voz ${SUFIXO}`, code: `E2E-V-${SUFIXO}` } })
  criados.campoId = campo.id
  const auth = await admin.auth.admin.createUser({ email: EMAIL, email_confirm: true, password: randomUUID() })
  if (auth.error) throw new Error(`createUser: ${auth.error.message}`)
  criados.authId = auth.data.user.id
  const user = await prisma.user.create({ data: { email: EMAIL, fullName: `[E2E] Admin Voz ${SUFIXO}`, profileType: 'admin', campoId: campo.id } })
  criados.userId = user.id
  const token = await pegarToken()

  // chave real (só leitura) — a de Campinas
  const linhaCampinas = await prisma.setting.findFirst({ where: { settingKey: 'elevenlabs_configuration', campoId: CAMPO_CAMPINAS } })
  const chave = lerConfigElevenLabs(linhaCampinas?.settingValue ?? null).apiKey

  console.log('\n1. Tela da ElevenLabs (rota)')
  let r = await api('/api/integracoes/elevenlabs', token)
  ok('GET sem configuração → desligada, sem chave', r.status === 200 && r.json?.ativo === false && r.json?.temChave === false, `status ${r.status}`)
  r = await api('/api/integracoes/elevenlabs', token, { metodo: 'POST', corpo: { ativo: true } })
  ok('ligar sem chave → 400', r.status === 400, `status ${r.status}`)
  if (chave) {
    r = await api('/api/integracoes/elevenlabs', token, { metodo: 'POST', corpo: { ativo: true, apiKey: chave, responderComAudio: true } })
    ok('salvar com chave → 200 e chave mascarada', r.status === 200 && r.json?.apiKey?.includes('•••') && r.json?.apiKey !== chave, `status ${r.status}`)
    const mascara = r.json?.apiKey
    r = await api('/api/integracoes/elevenlabs', token, { metodo: 'POST', corpo: { ativo: true, apiKey: mascara, vozMasculina: ELEVENLABS_PADRAO.vozMasculina } })
    const gravada = await prisma.setting.findFirst({ where: { settingKey: 'elevenlabs_configuration', campoId: campo.id } })
    ok('salvar com a máscara mantém a chave verdadeira', lerConfigElevenLabs(gravada?.settingValue).apiKey === chave)
    ok('gravou no campo do usuário (não no de Campinas)', gravada?.campoId === campo.id)
    r = await api('/api/integracoes/elevenlabs?test=true', token, { metodo: 'POST', corpo: { apiKey: mascara } })
    ok('testar conexão → lista vozes', r.status === 200 && Array.isArray(r.json?.vozes) && r.json.vozes.length > 0, `status ${r.status} ${r.json?.error ?? ''}`)
    r = await api('/api/integracoes/elevenlabs', token)
    ok('GET devolve vozes e nunca a chave', r.status === 200 && r.json?.temChave === true && !JSON.stringify(r.json).includes(chave))

    console.log('\n2. Voz de ponta a ponta (ElevenLabs)')
    const cfg = { ...lerConfigElevenLabs(gravada?.settingValue) }
    const frase = 'A paz do Senhor. Seja muito bem-vindo à nossa igreja.'
    const mp3 = await sintetizarFala(cfg, frase, 'M')
    ok('fala masculina gerada (MP3)', !!mp3 && mp3.length > 1000, `${mp3?.length ?? 0} bytes`)
    const caminho = `whatsapp/agente-voz/e2e-${SUFIXO}.mp3`
    const up = await admin.storage.from('dados').upload(caminho, mp3, { contentType: 'audio/mpeg' })
    criados.arquivos.push(caminho)
    ok('áudio publicado no storage', !up.error, up.error?.message)
    const url = admin.storage.from('dados').getPublicUrl(caminho).data.publicUrl
    const texto = await transcreverAudio(chave, url, 'audio/mpeg')
    ok('transcrição devolve o que foi falado', !!texto && /paz do senhor/i.test(texto) && /bem-vindo/i.test(texto), texto ?? '(nada)')
    const fem = await sintetizarFala(cfg, 'Olá.', 'F')
    ok('fala feminina gerada', !!fem && fem.length > 500)
  } else {
    console.log('  (pulado: Campinas sem chave da ElevenLabs gravada)')
  }

  console.log('\n3. Assunto reservado sem contato configurado')
  const agente = await prisma.aiAgent.create({
    data: { campoId: campo.id, name: `[E2E] Agente ${SUFIXO}`, role: 'recepcao', systemPrompt: 'e2e', isActive: false },
  })
  criados.agentId = agente.id
  const { data: inst, error: eInst } = await admin.from('whatsapp_instances').insert({
    name: `[E2E] Instância ${SUFIXO}`, instance_id: `e2e-${SUFIXO}`, token: 'e2e', client_token: 'e2e',
    status: 'disconnected', owner_user_id: user.id, is_active: false,
    metadata: { recepcao: {
      ativo: false, agentId: agente.id,
      encaminhamentos: [
        { interesse: 'Jovens', nome: '[E2E] Líder Jovens', telefone: '5500000000001', sexo: '', padrao: false },
        { interesse: 'Atendimento geral', nome: '[E2E] Padrão', telefone: '5500000000002', sexo: '', padrao: true },
      ],
      contatoReservado: null,
    } },
  }).select('id').single()
  if (eInst) throw new Error(`instância: ${eInst.message}`)
  criados.instanciaId = inst.id

  const agora = new Date().toISOString()
  const conv = (telefone, nome, meta) => ({
    instance_id: inst.id, phone: telefone, contact_name: nome, owner_user_id: user.id, status: 'open',
    ai_enabled: true, ai_agent_id: agente.id, last_message_at: agora, metadata: { origem: 'recepcao_qr', recepcao_inicio: agora, ...meta },
  })
  const { data: convs, error: eConv } = await admin.from('whatsapp_conversations').insert([
    conv('5500000000010', '[E2E] Ana', { recepcao_estado: {
      nome: '[E2E] Ana', sexo: 'F', igrejaAnterior: 'Batista', tempoNaSede: '3 meses', jaFoiAbordado: false, conheceGF: false,
      gfInteresse: 'Hineni', interesses: ['Jovens'], faixaEtaria: 'jovem', assunto: 'visita', querVisita: true, pedidoEspecial: 'saúde',
    } }),
    conv('5500000000011', '[E2E] Bruno', { recepcao_estado: { nome: '[E2E] Bruno', igrejaAnterior: 'não', tempoNaSede: 'primeira vez', jaFoiAbordado: true, interesses: [] } }),
    conv('5500000000012', '[E2E] Carla', { recepcao_estado: { nome: '[E2E] Carla', assuntoReservado: true, assunto: 'denúncia contra obreiro' } }),
  ]).select('id, phone')
  if (eConv) throw new Error(`conversas: ${eConv.message}`)
  const reservada = convs.find((c) => c.phone === '5500000000012')

  const env = await encaminharParaLideres({
    instanceId: inst.id, conversationId: reservada.id, telefoneContato: reservada.phone,
    dados: { interesses: ['Jovens', 'Atendimento geral'], sexo: 'F', resumo: 'conteúdo sigiloso' },
  })
  ok('nada enviado (nem líder de área nem padrão)', env.enviados === 0, JSON.stringify(env))
  ok('acusa falta do contato reservado', env.semLider.includes('Assunto reservado'))
  const { data: depois } = await admin.from('whatsapp_conversations').select('metadata').eq('id', reservada.id).single()
  ok('conversa marcada como reservada', depois.metadata.assunto_reservado === true)
  ok('áreas marcadas como tratadas (não repetem depois)', !!depois.metadata.encaminhados?.jovens && !!depois.metadata.encaminhados?.['atendimento geral'])
  const { count: msgsLider } = await admin.from('whatsapp_conversations').select('id', { count: 'exact', head: true })
    .eq('instance_id', inst.id).in('phone', ['5500000000001', '5500000000002'])
  ok('nenhuma conversa criada com os líderes', (msgsLider ?? 0) === 0)

  console.log('\n4. Relatórios da Caixa (rota)')
  r = await api(`/api/whatsapp/relatorios?de=${hoje}&ate=${hoje}`, token)
  ok('admin não vê (Caixa é exclusiva do master) → 403', r.status === 403, `status ${r.status}`)
  // a Caixa é só do master (permissionCatalog): o resto roda como master do campo E2E
  await prisma.user.update({ where: { id: user.id }, data: { profileType: 'master' } })
  // withAuth guarda o usuário do token por 10 s (src/lib/auth.ts, TTL_MS)
  await new Promise((ok) => setTimeout(ok, 11_000))
  r = await api(`/api/whatsapp/relatorios?de=${hoje}&ate=${hoje}`, token)
  ok('GET do período → 200', r.status === 200, `status ${r.status} ${r.json?.error ?? ''}`)
  const t = r.json?.totais ?? {}
  ok('3 atendimentos, 3 pelo QR', t.conversas === 3 && t.viaQr === 3, JSON.stringify(t))
  ok('1 de outra igreja e 1 sem igreja anterior', t.deOutraIgreja === 1 && t.semIgrejaAnterior === 1)
  ok('1 já abordado e 1 não abordado', t.jaAbordados === 1 && t.naoAbordados === 1)
  ok('1 reservado, contado só como número', t.reservados === 1)
  const linhaReservada = r.json?.conversas?.find((c) => c.id === reservada.id)
  ok('reservada sem nome, telefone nem assunto', linhaReservada?.nome === 'Assunto reservado' && linhaReservada?.telefone === '' && !JSON.stringify(r.json).includes('denúncia contra obreiro'))
  ok('pedido de oração contado sem expor o conteúdo', t.pedidosOracao === 1 && !JSON.stringify(r.json).includes('saúde'))
  ok('tempo na sede agrupado', r.json?.porTempoNaSede?.some((x) => x.rotulo === '1 a 11 meses') && r.json?.porTempoNaSede?.some((x) => x.rotulo === 'Primeira vez'))
  ok('GF de interesse aparece', r.json?.porGf?.some((x) => x.rotulo === 'Hineni'))
  r = await api(`/api/whatsapp/relatorios?de=${hoje}&ate=${hoje}&departamento=Jovens`, token)
  ok('filtro por departamento (Jovens) → só a Ana', r.status === 200 && r.json?.conversas?.length === 1 && r.json.conversas[0].nome === '[E2E] Ana', JSON.stringify(r.json?.conversas?.map((c) => c.nome)))
  r = await api('/api/whatsapp/relatorios', token, { metodo: 'POST', corpo: { acao: 'resumo', conversationId: reservada.id } })
  ok('resumo de conversa reservada recusado', r.status === 400, `status ${r.status}`)
  r = await api(`/api/whatsapp/relatorios?de=${hoje}&ate=2020-01-01`, token)
  ok('período invertido → 400', r.status === 400)
  r = await api(`/api/whatsapp/relatorios?de=2026-11-01&ate=2026-11-12`, token)
  ok('não vê conversas de Campinas (outro campo)', r.status === 200 && r.json?.totais?.conversas === 3, JSON.stringify(r.json?.totais?.conversas))
}

main()
  .catch((e) => { falhas++; console.error('\nERRO', e) })
  .finally(async () => {
    if (KEEP) console.log(`\n--keep: dados [E2E] ${SUFIXO} mantidos`)
    else { await limpar(); console.log(`\nlimpeza feita ([E2E] ${SUFIXO})`) }
    await prisma.$disconnect()
    console.log(`\n${passos - falhas}/${passos} ok${falhas ? ` — ${falhas} FALHA(S)` : ''}`)
    process.exit(falhas ? 1 : 0)
  })
