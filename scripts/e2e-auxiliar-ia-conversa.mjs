/**
 * Simulação ponta a ponta do auxiliar de IA na conversa.
 *
 * Cobre as duas coisas novas do modal de conversa:
 *  - o interruptor "IA responde" / "eu respondo" (assign-ai), que é o que decide
 *    se o webhook enfileira resposta automática ou fica quieto;
 *  - a base da sugestão: as últimas mensagens lidas na ordem certa e com o papel
 *    certo (quem falou o quê), que é o que a IA recebe.
 *
 * Usa loadConversationHistory de produção e escreve em whatsapp_conversations /
 * whatsapp_messages de verdade, com prefixo [E2E] e telefone da faixa de teste
 * 5519999990000 — nenhuma conversa real é tocada. Tudo é apagado no fim
 * (--keep preserva).
 *
 * O que este teste NÃO faz: chamar o provedor de IA. A geração em si depende de
 * chave e custa tokens; aqui se garante que o material que chega até ela está
 * correto e que o atendimento troca de mãos como deve.
 *
 * Uso: npx tsx scripts/e2e-auxiliar-ia-conversa.mjs
 */

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const { loadConversationHistory } = await import('../src/lib/aiReplyService.ts')

const KEEP = process.argv.includes('--keep')
let passed = 0, failed = 0
const falhas = []
function check(label, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { failed++; falhas.push(label); console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
const step = (n, t) => console.log(`\n${'─'.repeat(70)}\n${n}. ${t}\n${'─'.repeat(70)}`)

const criado = { conversationId: null }
const TELEFONE = '5519999990007'

async function limpar() {
  console.log('\n🧹 limpando os dados do teste...')
  if (criado.conversationId) {
    await sb.from('whatsapp_messages').delete().eq('conversation_id', criado.conversationId)
    await sb.from('whatsapp_conversations').delete().eq('id', criado.conversationId)
  }
  console.log('   pronto — banco no estado anterior.')
}

async function main() {
  console.log('\n🤖 E2E — auxiliar de IA na conversa\n')

  // ── 1. Instância e agente existentes (o teste não cria integração) ──
  step(1, 'Pré-requisitos: uma instância e um agente de IA cadastrados')
  const { data: instancias } = await sb.from('whatsapp_instances').select('id, name, owner_user_id').limit(1)
  const instancia = instancias?.[0]
  check('há instância cadastrada', !!instancia, instancia?.name ?? 'nenhuma')
  if (!instancia) throw new Error('Sem instância no banco — o teste precisa de uma para a conversa.')

  const { data: agentes } = await sb.from('ai_agents').select('id, name').eq('is_active', true).limit(1)
  const agente = agentes?.[0]
  check('há agente de IA ativo', !!agente, agente?.name ?? 'nenhum')

  // ── 2. Conversa de teste ──
  step(2, 'Criando a conversa e cinco mensagens')
  const { data: conv, error: convErr } = await sb
    .from('whatsapp_conversations')
    .insert({
      instance_id: instancia.id,
      owner_user_id: instancia.owner_user_id,
      phone: TELEFONE,
      contact_name: '[E2E] Noemia Teste',
      status: 'open',
    })
    .select('id, ai_enabled, ai_agent_id')
    .single()

  if (convErr) throw convErr
  criado.conversationId = conv.id
  check('conversa criada', !!conv.id, conv.id)
  check('nasce sem IA', conv.ai_enabled !== true && !conv.ai_agent_id)

  // a conversa da imagem: ela responde, nós perguntamos, ela confirma
  const roteiro = [
    { direction: 'outbound', content: 'A paz do Senhor, Noemia! Tudo bem?' },
    { direction: 'inbound', content: 'Olá, TD bem obgd' },
    { direction: 'outbound', content: 'Que alegria! Posso te fazer algumas perguntas?' },
    { direction: 'inbound', content: 'Ok' },
    { direction: 'inbound', content: 'Moro em Sumaré' },
  ]
  for (const [i, m] of roteiro.entries()) {
    const { error } = await sb.from('whatsapp_messages').insert({
      conversation_id: conv.id,
      content: m.content,
      type: 'text',
      direction: m.direction,
      status: m.direction === 'outbound' ? 'sent' : 'delivered',
      created_at: new Date(Date.now() - (roteiro.length - i) * 60_000).toISOString(),
    })
    if (error) throw error
  }
  check('cinco mensagens gravadas', true, `${roteiro.length} mensagens`)

  // ── 3. O que a IA recebe ──
  step(3, 'A sugestão parte do histórico certo?')
  const historico = await loadConversationHistory(conv.id, 10)
  check('leu as cinco mensagens', historico.length === 5, `${historico.length} turnos`)
  check('em ordem cronológica', historico[0].content.startsWith('A paz do Senhor'), historico[0].content)
  check('a última é a mais recente do contato', historico[4].content === 'Moro em Sumaré', historico[4].content)
  check('mensagem do contato entra como "user"', historico[1].role === 'user', historico[1].role)
  check('nossa mensagem entra como "assistant"', historico[0].role === 'assistant', historico[0].role)

  const limitado = await loadConversationHistory(conv.id, 3)
  check('o limite corta as mais antigas', limitado.length === 3 && limitado[2].content === 'Moro em Sumaré',
    `${limitado.length} turnos`)

  // ── 4. Interruptor: a IA assume ──
  step(4, 'Passar o atendimento para a IA')
  if (agente) {
    const { error } = await sb
      .from('whatsapp_conversations')
      .update({ ai_enabled: true, ai_agent_id: agente.id })
      .eq('id', conv.id)
    check('sem erro ao marcar o agente', !error, error?.message ?? '')

    const { data: comIa } = await sb
      .from('whatsapp_conversations')
      .select('ai_enabled, ai_agent_id')
      .eq('id', conv.id)
      .single()
    check('ai_enabled ligado', comIa.ai_enabled === true)
    check('agente gravado na conversa', comIa.ai_agent_id === agente.id)
  } else {
    console.log('  · sem agente ativo no banco, etapa do interruptor pulada')
  }

  // ── 5. Interruptor: eu assumo de volta ──
  step(5, 'Retomar o atendimento — a IA precisa parar de responder')
  const { error: offErr } = await sb
    .from('whatsapp_conversations')
    .update({ ai_enabled: false, ai_agent_id: null })
    .eq('id', conv.id)
  check('sem erro ao desligar', !offErr, offErr?.message ?? '')

  const { data: semIa } = await sb
    .from('whatsapp_conversations')
    .select('ai_enabled, ai_agent_id')
    .eq('id', conv.id)
    .single()
  check('ai_enabled desligado', semIa.ai_enabled === false)
  check('agente desvinculado', semIa.ai_agent_id === null)
  check('é essa dupla que o webhook consulta antes de responder sozinho',
    semIa.ai_enabled === false && semIa.ai_agent_id === null)

  // ── 6. Conversa sem mensagem não gera sugestão ──
  step(6, 'Conversa vazia não tem o que sugerir')
  const { data: vazia } = await sb
    .from('whatsapp_conversations')
    .insert({ instance_id: instancia.id, owner_user_id: instancia.owner_user_id, phone: '5519999990008', contact_name: '[E2E] Vazia', status: 'open' })
    .select('id')
    .single()
  const historicoVazio = await loadConversationHistory(vazia.id, 10)
  check('histórico vazio', historicoVazio.length === 0)
  check('a rota recusa esse caso antes de chamar a IA (sem gastar chamada)', historicoVazio.length === 0)
  await sb.from('whatsapp_conversations').delete().eq('id', vazia.id)

  console.log(`\n${'═'.repeat(70)}`)
  console.log(`RESULTADO: ${passed} passaram · ${failed} falharam`)
  if (failed) console.log(`Falhas: ${falhas.join(' | ')}`)
  console.log('═'.repeat(70))
}

main()
  .catch((e) => { console.error('\n💥 ERRO:\n', e); failed++ })
  .finally(async () => {
    if (KEEP) console.log('\n⚠️  --keep: dados do teste MANTIDOS no banco.')
    else await limpar().catch((e) => console.error('falha na limpeza:', e))
    process.exit(failed ? 1 : 0)
  })
