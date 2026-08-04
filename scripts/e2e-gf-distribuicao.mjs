/**
 * E2E — Distribuição inteligente: contato importado → GF mais próximo.
 *
 * Prova as regras que a tela de Distribuição usa, exercitando as MESMAS
 * funções que a rota chama em produção (gfDistribuicaoService), e não uma
 * cópia:
 *  - o endereço é procurado primeiro nas colunas da planilha importada,
 *    aceitando as variações de nome que aparecem nos arquivos reais
 *    ("Endereço", "endereco_completo", "CEP", "Bairro"...);
 *  - o GF escolhido é o mais PERTO de verdade (Haversine), não o primeiro da
 *    lista nem o do mesmo bairro por coincidência de nome;
 *  - GF sem coordenada, inativo ou de outra igreja não entra na disputa;
 *  - quem já está num GF não volta para a fila — nem quem foi conectado por
 *    esta tela, nem quem é membro e foi anexado pela tela do GF;
 *  - a lista de "já conectados" traz o GF ATUAL, para poder desfazer.
 *
 * O que NÃO é exercitado aqui, de propósito: a leitura do endereço na conversa
 * (depende de chamar a IA configurada do campo, que custa tokens e varia de
 * resposta) e a geocodificação (Nominatim/ViaCEP são serviços externos e o
 * teste ficaria dependente de rede alheia). Essas duas etapas são isoladas em
 * funções próprias — aqui testamos a decisão, que é a regra de negócio.
 *
 * Roda contra o banco de verdade: tudo é criado com prefixo [E2E] sob a igreja
 * sede real e apagado no fim (--keep preserva para inspeção).
 *
 * Uso: npx tsx scripts/e2e-gf-distribuicao.mjs
 */

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

import { PrismaClient } from '@prisma/client'
import { createClient } from '@supabase/supabase-js'
import {
  enderecoDoArquivo,
  listarGfsCandidatos,
  gfMaisProximo,
  listarParesPendentes,
} from '../src/lib/gfDistribuicaoService.ts'
import { DEFAULT_SEDE_ID } from '../src/lib/gfPublicListService.ts'

const prisma = new PrismaClient()
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)
const KEEP = process.argv.includes('--keep')
const exec = (q) => prisma.$executeRawUnsafe(q)

let passed = 0, failed = 0
const falhas = []
function check(label, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { failed++; falhas.push(label); console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
const step = (n, t) => console.log(`\n${'─'.repeat(72)}\n${n}. ${t}\n${'─'.repeat(72)}`)

const criado = { cellIds: [], memberIds: [], batchId: null, rowIds: [], outraIgrejaId: null, regionalId: null, campoId: null }

async function limpar() {
  console.log('\n🧹 limpando os dados do teste...')
  if (criado.batchId) {
    await supabase.from('whatsapp_import_rows').delete().eq('batch_id', criado.batchId)
    await supabase.from('whatsapp_import_batches').delete().eq('id', criado.batchId)
  }
  for (const id of criado.memberIds) {
    await exec(`DELETE FROM cell_group_members WHERE member_id = '${id}'::uuid`).catch(() => {})
  }
  for (const id of criado.cellIds) await exec(`DELETE FROM cell_groups WHERE id = '${id}'::uuid`).catch(() => {})
  for (const id of criado.memberIds) await exec(`DELETE FROM members WHERE id = '${id}'::uuid`).catch(() => {})
  if (criado.outraIgrejaId) await exec(`DELETE FROM churches WHERE id = '${criado.outraIgrejaId}'::uuid`).catch(() => {})
  if (criado.regionalId) await exec(`DELETE FROM regionais WHERE id = '${criado.regionalId}'::uuid`).catch(() => {})
  if (criado.campoId) await exec(`DELETE FROM campos WHERE id = '${criado.campoId}'::uuid`).catch(() => {})
  console.log('   pronto — banco no estado anterior.')
}

async function main() {
  console.log('\n🗺️  E2E — Distribuição de contatos importados para o GF mais próximo\n')

  step(1, 'Confirmar a sede e que as colunas da migration existem')

  const sede = await prisma.church.findUnique({ where: { id: DEFAULT_SEDE_ID }, select: { id: true, name: true } })
  check('DEFAULT_SEDE_ID aponta para uma igreja real', !!sede, sede?.name ?? 'não encontrada')
  if (!sede) throw new Error('Sede pública não existe no banco — abortando.')

  const { error: erroColunas } = await supabase
    .from('whatsapp_import_rows')
    .select('id, address_text, address_zipcode, address_source, latitude, longitude, suggested_cell_group_id, suggested_distance_km, analyzed_at, analysis_note')
    .limit(1)
  check('colunas da distribuição existem (migration aplicada)', !erroColunas, erroColunas?.message ?? 'ok')
  if (erroColunas) throw new Error('Aplique supabase/migrations/20260803_gf_distribuicao.sql antes de rodar este teste.')

  // ── 2. endereço vindo da planilha ───────────────────────────────────────
  step(2, 'Ler o endereço das colunas da planilha, com os nomes que aparecem de verdade')

  const comAcento = enderecoDoArquivo(
    { 'Endereço': 'Rua Barão de Jaguara', 'Número': '100', 'Bairro': 'Centro', 'Cidade': 'Campinas', 'UF': 'SP', 'CEP': '13010-111' },
    {},
  )
  check('junta rua, número, bairro, cidade e UF num texto só',
    comAcento.texto === 'Rua Barão de Jaguara, 100, Centro, Campinas, SP', comAcento.texto)
  check('CEP sai só com dígitos', comAcento.cep === '13010111', comAcento.cep)

  const semAcento = enderecoDoArquivo({ endereco_completo: 'Av. Brasil, 500 - Jd. Chapadão', cep: '13070-000' }, {})
  check('aceita nome de coluna sem acento e com underscore', semAcento.texto === 'Av. Brasil, 500 - Jd. Chapadão', semAcento.texto)

  const soCep = enderecoDoArquivo({ CEP: '13035375' }, {})
  check('planilha só com CEP ainda serve', soCep.cep === '13035375' && soCep.texto === null)

  const cepQuebrado = enderecoDoArquivo({ cep: '123' }, {})
  check('CEP inválido é descartado (não vira consulta perdida)', cepQuebrado.cep === null)

  const nasVariaveis = enderecoDoArquivo({}, { Bairro: 'Vila Industrial', Cidade: 'Campinas' })
  check('também lê das variáveis da campanha', nasVariaveis.texto === 'Vila Industrial, Campinas', nasVariaveis.texto)

  const semNada = enderecoDoArquivo({ nome: 'Fulano', telefone: '19999990000' }, {})
  check('planilha sem endereço devolve vazio (vai para a IA depois)', semNada.texto === null && semNada.cep === null)

  // ── 3. o GF mais próximo ────────────────────────────────────────────────
  step(3, 'Escolher o GF mais próximo — e ignorar quem não pode entrar na disputa')

  const lider = await prisma.member.create({
    data: { churchId: sede.id, fullName: '[E2E] Líder Distribuição', mobile: '19999990501', membershipStatus: 'ATIVO' },
  })
  criado.memberIds.push(lider.id)

  // Centro de Campinas
  const gfCentro = await prisma.cellGroup.create({
    data: {
      churchId: sede.id, name: '[E2E] GF Centro Dist', status: 'active', leaderId: lider.id, color: '#22c55e',
      addressStreet: 'Rua Barão de Jaguara', addressNumber: '100', addressCity: 'Campinas', addressState: 'SP',
      latitude: '-22.90556000', longitude: '-47.06083000',
    },
  })
  criado.cellIds.push(gfCentro.id)

  // Barão Geraldo — ~8 km do centro
  const gfBarao = await prisma.cellGroup.create({
    data: {
      churchId: sede.id, name: '[E2E] GF Barão Dist', status: 'active', leaderId: lider.id, color: '#3b82f6',
      addressStreet: 'Av. Albino J. B. de Oliveira', addressCity: 'Campinas', addressState: 'SP',
      latitude: '-22.81667000', longitude: '-47.06667000',
    },
  })
  criado.cellIds.push(gfBarao.id)

  // sem coordenada — nunca pode ser escolhido
  const gfSemCoord = await prisma.cellGroup.create({
    data: { churchId: sede.id, name: '[E2E] GF Sem Coordenada', status: 'active', leaderId: lider.id, addressCity: 'Campinas' },
  })
  criado.cellIds.push(gfSemCoord.id)

  // inativo bem em cima do ponto de teste — a armadilha
  const gfInativo = await prisma.cellGroup.create({
    data: {
      churchId: sede.id, name: '[E2E] GF Inativo Dist', status: 'inactive', leaderId: lider.id,
      latitude: '-22.90560000', longitude: '-47.06080000',
    },
  })
  criado.cellIds.push(gfInativo.id)

  const stamp = Date.now() % 100000
  const campo = await prisma.campo.create({ data: { name: '[E2E] Campo Dist', code: `E2EDC${stamp}` } })
  criado.campoId = campo.id
  const regional = await prisma.regional.create({ data: { name: '[E2E] Regional Dist', code: `E2EDR${stamp}`, campoId: campo.id } })
  criado.regionalId = regional.id
  const outraIgreja = await prisma.church.create({ data: { name: '[E2E] Outra Igreja Dist', code: `E2EDI${stamp}`, regionalId: regional.id } })
  criado.outraIgrejaId = outraIgreja.id
  const gfOutraIgreja = await prisma.cellGroup.create({
    data: {
      churchId: outraIgreja.id, name: '[E2E] GF de Outra Igreja Dist', status: 'active',
      latitude: '-22.90550000', longitude: '-47.06070000',
    },
  })
  criado.cellIds.push(gfOutraIgreja.id)

  const candidatos = await listarGfsCandidatos(sede.id)
  const nomes = candidatos.map((g) => g.name)
  check('GF ativo com coordenada entra na disputa', nomes.includes('[E2E] GF Centro Dist') && nomes.includes('[E2E] GF Barão Dist'))
  check('GF SEM coordenada fica de fora', !nomes.includes('[E2E] GF Sem Coordenada'))
  check('GF INATIVO fica de fora (mesmo colado no endereço)', !nomes.includes('[E2E] GF Inativo Dist'))
  check('GF de OUTRA igreja fica de fora', !nomes.includes('[E2E] GF de Outra Igreja Dist'))
  check('o líder e o telefone dele vêm junto (o Conectar avisa esse número)',
    candidatos.find((g) => g.name === '[E2E] GF Centro Dist')?.leaderPhone === '19999990501')

  // pessoa morando no centro: o GF do centro tem que ganhar
  const noCentro = gfMaisProximo({ latitude: -22.9056, longitude: -47.0608 }, candidatos)
  check('quem mora no centro é indicado ao GF do centro', noCentro?.gf.name === '[E2E] GF Centro Dist', noCentro?.gf.name)
  check('a distância é pequena (menos de 1 km)', noCentro?.km < 1, `${noCentro?.km?.toFixed(2)} km`)

  // pessoa morando em Barão Geraldo: o outro GF tem que ganhar
  const emBarao = gfMaisProximo({ latitude: -22.8167, longitude: -47.0667 }, candidatos)
  check('quem mora em Barão Geraldo é indicado ao GF de lá', emBarao?.gf.name === '[E2E] GF Barão Dist', emBarao?.gf.name)
  check('e a escolha muda mesmo com o outro GF existindo', emBarao?.gf.id !== noCentro?.gf.id)

  const semCandidatos = gfMaisProximo({ latitude: -22.9, longitude: -47.0 }, [])
  check('sem nenhum GF candidato não escolhe ninguém (a tela avisa)', semCandidatos === null)

  // ── 4. a fila de pares pendentes ────────────────────────────────────────
  step(4, 'A fila que a tela mostra: só quem tem sugestão e ainda não foi conectado')

  const { data: lote, error: erroLote } = await supabase
    .from('whatsapp_import_batches')
    .insert({ church_id: sede.id, owner_user_id: 'e2e', filename: '[E2E] lista distribuicao.csv', total_rows: 3, valid_rows: 3 })
    .select('id')
    .single()
  if (erroLote) throw new Error(`falha ao criar o lote: ${erroLote.message}`)
  criado.batchId = lote.id

  const linhas = [
    // já analisada, com sugestão e sem GF: ESTA aparece
    {
      batch_id: lote.id, row_number: 1, name: '[E2E] Pendente Centro', phone: '19999990601',
      raw: { Endereço: 'Rua Barão de Jaguara, 100', Cidade: 'Campinas' },
      address_text: 'Rua Barão de Jaguara, 100, Campinas', latitude: -22.90556, longitude: -47.06083,
      address_source: 'arquivo', suggested_cell_group_id: gfCentro.id, suggested_distance_km: 0.05,
      analyzed_at: new Date().toISOString(),
    },
    // já conectada a um GF: NÃO aparece
    {
      batch_id: lote.id, row_number: 2, name: '[E2E] Já Conectado', phone: '19999990602', raw: {},
      cell_group_id: gfCentro.id, address_text: 'Rua X', latitude: -22.9, longitude: -47.06,
      suggested_cell_group_id: gfCentro.id, suggested_distance_km: 0.5, analyzed_at: new Date().toISOString(),
    },
    // analisada e sem endereço: NÃO aparece na fila (não há o que conectar)
    {
      batch_id: lote.id, row_number: 3, name: '[E2E] Sem Endereço', phone: '19999990603', raw: {},
      analyzed_at: new Date().toISOString(), analysis_note: 'Nenhum endereço na planilha nem na conversa.',
    },
  ]
  const { data: inseridas, error: erroLinhas } = await supabase
    .from('whatsapp_import_rows').insert(linhas).select('id, name')
  if (erroLinhas) throw new Error(`falha ao criar as linhas: ${erroLinhas.message}`)
  criado.rowIds = (inseridas ?? []).map((r) => r.id)

  const pares = await listarParesPendentes({ batchId: lote.id, churchId: sede.id })
  const porNome = Object.fromEntries(pares.map((p) => [p.nome, p]))

  check('contato com sugestão e sem GF aparece na fila', !!porNome['[E2E] Pendente Centro'])
  check('quem JÁ está num GF não volta para a fila', !porNome['[E2E] Já Conectado'])
  check('quem ficou sem endereço não aparece (nada a conectar)', !porNome['[E2E] Sem Endereço'])
  check('o par traz o GF sugerido com nome e líder',
    porNome['[E2E] Pendente Centro']?.gf?.name === '[E2E] GF Centro Dist',
    porNome['[E2E] Pendente Centro']?.gf?.name)
  check('a distância vem como número para a tela mostrar em km',
    typeof porNome['[E2E] Pendente Centro']?.distanciaKm === 'number',
    String(porNome['[E2E] Pendente Centro']?.distanciaKm))
  check('a origem do endereço vem junto (planilha ou conversa)',
    porNome['[E2E] Pendente Centro']?.origemEndereco === 'arquivo')

  // conectar = a rota grava cell_group_id; a fila tem que esvaziar
  await supabase
    .from('whatsapp_import_rows')
    .update({ cell_group_id: gfCentro.id })
    .eq('id', criado.rowIds[0])

  const depois = await listarParesPendentes({ batchId: lote.id, churchId: sede.id })
  check('depois de conectado o par sai da fila', !depois.some((p) => p.nome === '[E2E] Pendente Centro'))

  // ── 5. quem já está em GF pelo CADASTRO também sai da fila ──────────────
  step(5, 'Membro já anexado por outra tela não volta a ser distribuído')

  const membroComGf = await prisma.member.create({
    data: { churchId: sede.id, fullName: '[E2E] Membro Já Anexado', mobile: '19999990701', membershipStatus: 'ATIVO' },
  })
  criado.memberIds.push(membroComGf.id)
  await prisma.cellGroupMember.create({
    data: { cellGroupId: gfBarao.id, memberId: membroComGf.id, joinedAt: new Date(), isActive: true },
  })

  const membroSemGf = await prisma.member.create({
    data: { churchId: sede.id, fullName: '[E2E] Membro Sem GF', mobile: '19999990702', membershipStatus: 'ATIVO' },
  })
  criado.memberIds.push(membroSemGf.id)

  const { data: novasLinhas, error: erroNovas } = await supabase.from('whatsapp_import_rows').insert([
    {
      batch_id: lote.id, row_number: 4, name: '[E2E] Linha do Membro Anexado', phone: '19999990701', raw: {},
      matched_member_id: membroComGf.id, match_status: 'member',
      address_text: 'Rua Y', latitude: -22.9, longitude: -47.06,
      suggested_cell_group_id: gfCentro.id, suggested_distance_km: 0.7, analyzed_at: new Date().toISOString(),
    },
    {
      batch_id: lote.id, row_number: 5, name: '[E2E] Linha do Membro Livre', phone: '19999990702', raw: {},
      matched_member_id: membroSemGf.id, match_status: 'member',
      address_text: 'Rua Z', latitude: -22.9, longitude: -47.06,
      suggested_cell_group_id: gfCentro.id, suggested_distance_km: 0.8, analyzed_at: new Date().toISOString(),
    },
  ]).select('id, name')
  if (erroNovas) throw new Error(`falha ao criar as linhas de membro: ${erroNovas.message}`)
  criado.rowIds.push(...(novasLinhas ?? []).map((r) => r.id))

  const fila = await listarParesPendentes({ batchId: lote.id, churchId: sede.id })
  const naFila = fila.map((p) => p.nome)
  check('membro JÁ anexado a um GF pelo cadastro não aparece na fila',
    !naFila.includes('[E2E] Linha do Membro Anexado'))
  check('membro sem GF continua na fila para ser distribuído',
    naFila.includes('[E2E] Linha do Membro Livre'))

  // sair do GF devolve a pessoa para a fila
  await prisma.cellGroupMember.updateMany({
    where: { memberId: membroComGf.id, isActive: true },
    data: { isActive: false, leftAt: new Date() },
  })
  const filaDepois = await listarParesPendentes({ batchId: lote.id, churchId: sede.id })
  check('quem saiu do GF volta para a fila',
    filaDepois.some((p) => p.nome === '[E2E] Linha do Membro Anexado'))

  // ── 6. a lista de já conectados (para desfazer) ─────────────────────────
  step(6, 'Aba "Já conectados": quem desfazer, com o GF atual')

  const conectados = await listarParesPendentes({ batchId: lote.id, churchId: sede.id, conectados: true })
  const nomesConectados = conectados.map((p) => p.nome)
  check('quem tem cell_group_id aparece na lista de conectados',
    nomesConectados.includes('[E2E] Pendente Centro') && nomesConectados.includes('[E2E] Já Conectado'),
    nomesConectados.join(' · '))
  check('quem ainda espera NÃO aparece nos conectados', !nomesConectados.includes('[E2E] Linha do Membro Livre'))
  check('o par conectado traz o GF ATUAL (não a sugestão)',
    conectados.find((p) => p.nome === '[E2E] Pendente Centro')?.gf?.name === '[E2E] GF Centro Dist')
  check('e vem marcado como conectado, para a tela mostrar o Desconectar',
    conectados.every((p) => p.conectado === true))
}

main()
  .catch((err) => {
    failed++
    falhas.push(`exceção: ${err.message}`)
    console.error('\n💥', err)
  })
  .finally(async () => {
    if (!KEEP) await limpar()
    else console.log('\n⚠️  --keep: dados do teste preservados no banco.')

    console.log(`\n${'═'.repeat(72)}`)
    console.log(`  ${passed} passou · ${failed} falhou`)
    if (falhas.length) {
      console.log('\n  falhas:')
      for (const f of falhas) console.log(`   · ${f}`)
    }
    console.log(`${'═'.repeat(72)}\n`)

    await prisma.$disconnect()
    process.exit(failed ? 1 : 0)
  })
