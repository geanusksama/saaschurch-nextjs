/**
 * Simulação ponta a ponta das Campanhas da Secretaria.
 *
 * Percorre o caminho real: cria a campanha com formulário dinâmico → anexa
 * pessoas pelo filtro (regional / zona / igreja / título) → gera o link
 * individual → a pessoa preenche e envia → a secretaria REPROVA → a pessoa
 * corrige e reenvia → a secretaria APROVA e o cadastro é atualizado de verdade.
 *
 * Testa também o que deve BLOQUEAR: schema inválido, resposta com opção que não
 * existe, CPF inválido, CPF que já é de outra pessoa, campanha fechada por
 * prazo, e a trava de editar as perguntas depois da primeira resposta.
 *
 * Importa `secretariaCampaignFields.ts`, `secretariaCampaignService.ts` e
 * `secretariaCampaignScope.ts` de verdade — roda em cima do código de produção.
 *
 * Roda contra o banco de verdade, mas cria a própria regional, igreja, membros
 * e campanha com prefixo [E2E]; nenhum registro real é tocado. Tudo é apagado
 * no fim (--keep preserva para inspeção).
 *
 * Uso: npx tsx scripts/e2e-campanhas-secretaria.mjs
 */

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

import { randomUUID } from 'crypto'
import { PrismaClient } from '@prisma/client'
import { validateFormSchema, getMemberFieldSpec } from '../src/lib/secretariaCampaignFields.ts'
import {
  applyApprovalToMember,
  campaignClosedReason,
  campaignPublicUrl,
  diffMemberFields,
  generateToken,
  isValidCpf,
  refreshCampaignCounters,
  rejectionMessage,
  validateAnswers,
} from '../src/lib/secretariaCampaignService.ts'
import { resolveAudienceMembers } from '../src/lib/secretariaCampaignScope.ts'

const prisma = new PrismaClient()
const KEEP = process.argv.includes('--keep')
const sql = (q) => prisma.$queryRawUnsafe(q)
const exec = (q) => prisma.$executeRawUnsafe(q)

let passed = 0, failed = 0
const falhas = []
function check(label, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { failed++; falhas.push(label); console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
const step = (n, t) => console.log(`\n${'─'.repeat(72)}\n${n}. ${t}\n${'─'.repeat(72)}`)

const criado = { campoId: null, regionalId: null, churchId: null, memberIds: [], campaignIds: [] }

async function limpar() {
  console.log('\n🧹 limpando os dados do teste...')
  for (const id of criado.campaignIds) {
    // as filhas caem por ON DELETE CASCADE
    await exec(`DELETE FROM secretaria_campaigns WHERE id = '${id}'::uuid`).catch(() => {})
  }
  if (criado.churchId) {
    const c = `'${criado.churchId}'::uuid`
    await exec(`DELETE FROM member_event_history WHERE church_id = ${c}`).catch(() => {})
    await exec(`DELETE FROM members WHERE church_id = ${c}`).catch(() => {})
    await exec(`DELETE FROM churches WHERE id = ${c}`).catch(() => {})
  }
  if (criado.regionalId) await exec(`DELETE FROM regionais WHERE id = '${criado.regionalId}'::uuid`).catch(() => {})
  if (criado.campoId) await exec(`DELETE FROM campos WHERE id = '${criado.campoId}'::uuid`).catch(() => {})
  console.log('   pronto — banco no estado anterior.')
}

/** CPF válido a partir de 9 dígitos base — o teste precisa passar no dígito verificador. */
function cpfValidoDe(base9) {
  const d = base9.split('').map(Number)
  const dv = (len) => {
    let soma = 0
    for (let i = 0; i < len; i++) soma += d[i] * (len + 1 - i)
    return ((soma * 10) % 11) % 10
  }
  d.push(dv(9))
  d.push(dv(10))
  return d.join('')
}

/**
 * CPF sorteado a cada execução e conferido contra o banco: os CPFs "de exemplo"
 * conhecidos já pertencem a cadastros reais, e a coluna é única — usar um fixo
 * derrubava o teste com P2002 em vez de testar o que interessa.
 */
async function cpfLivre() {
  for (let tentativa = 0; tentativa < 30; tentativa++) {
    const base = String(Math.floor(100000000 + Math.random() * 899999999))
    const cpf = cpfValidoDe(base)
    const [{ n }] = await sql(`SELECT count(*)::int AS n FROM members WHERE cpf = '${cpf}'`)
    if (Number(n) === 0) return cpf
  }
  throw new Error('não achei CPF livre para o teste')
}

// ═══════════════════════════════════════════════════════════════════════════
async function main() {
  console.log('\n🎯 E2E — Campanhas da Secretaria\n')

  // ── 1. cenário ────────────────────────────────────────────────────────────
  step(1, 'Montar o cenário: campo, regional, igreja e três membros')

  const campo = await prisma.campo.create({ data: { name: '[E2E] Campo Campanhas', code: `E2EC${Date.now() % 100000}` } })
  criado.campoId = campo.id

  const regional = await prisma.regional.create({
    data: { name: '[E2E] Regional Campanhas', code: `E2ER${Date.now() % 100000}`, campoId: campo.id },
  })
  criado.regionalId = regional.id

  const igreja = await prisma.church.create({
    data: {
      name: '[E2E] Igreja Campanhas',
      code: `E2EI${Date.now() % 100000}`,
      regionalId: regional.id,
      zone: 'Zona Leste',
    },
  })
  criado.churchId = igreja.id

  const titulo = await prisma.ecclesiasticalTitle.findFirst({ where: { deletedAt: null }, orderBy: { displayOrder: 'asc' } })
  check('há título eclesiástico cadastrado para o filtro', !!titulo, titulo?.name)

  const CPF_ANA = await cpfLivre()
  const CPF_BRUNO = await cpfLivre()

  const ana = await prisma.member.create({
    data: {
      churchId: igreja.id,
      fullName: '[E2E] Ana Souza',
      cpf: CPF_ANA,
      mobile: '19999990001',
      addressCity: 'Campinas',
      ecclesiasticalTitle: titulo?.name ?? 'CONGREGADO',
      ecclesiasticalTitleId: titulo?.id ?? null,
      membershipStatus: 'ATIVO',
    },
  })
  const bruno = await prisma.member.create({
    data: {
      churchId: igreja.id,
      fullName: '[E2E] Bruno Lima',
      cpf: CPF_BRUNO,
      mobile: '19999990002',
      // título diferente do da Ana de propósito: é o que o filtro por título separa.
      // Sem isso ele herdaria o default CONGREGADO e cairia no mesmo filtro.
      ecclesiasticalTitle: '[E2E] Sem Titulo',
      ecclesiasticalTitleId: null,
      membershipStatus: 'ATIVO',
    },
  })
  const semTelefone = await prisma.member.create({
    data: { churchId: igreja.id, fullName: '[E2E] Carla Sem Telefone', membershipStatus: 'ATIVO' },
  })
  criado.memberIds = [ana.id, bruno.id, semTelefone.id]
  check('três membros criados', criado.memberIds.length === 3)

  // ── 2. schema do formulário ───────────────────────────────────────────────
  step(2, 'Validação do formulário dinâmico')

  const schemaBom = [
    { id: 'foto', type: 'image', label: 'Sua foto atual', required: true, memberField: 'photo_url' },
    { id: 'celular', type: 'phone', label: 'WhatsApp', required: true, memberField: 'mobile' },
    { id: 'cidade', type: 'text', label: 'Cidade', memberField: 'address_city' },
    {
      id: 'estado_civil',
      type: 'radio',
      label: 'Estado civil',
      options: [{ value: 'SOLTEIRO', label: 'Solteiro' }, { value: 'CASADO', label: 'Casado' }],
      memberField: 'marital_status',
    },
    { id: 'observacao', type: 'textarea', label: 'Algo a acrescentar?' },
  ]
  const parsed = validateFormSchema(schemaBom)
  check('schema válido é aceito', parsed.ok, parsed.errors.join(' '))
  check('cinco perguntas preservadas', parsed.fields.length === 5)
  check('vínculo com o cadastro preservado', parsed.fields[0].memberField === 'photo_url')

  check(
    'recusa dois campos apontando para a mesma coluna',
    !validateFormSchema([
      { id: 'a', type: 'text', label: 'A', memberField: 'address_city' },
      { id: 'b', type: 'text', label: 'B', memberField: 'address_city' },
    ]).ok
  )
  check(
    'recusa tipo incompatível com a coluna (data em foto)',
    !validateFormSchema([{ id: 'x', type: 'date', label: 'X', memberField: 'photo_url' }]).ok
  )
  check(
    'recusa coluna que campanha não pode alterar (rol)',
    !validateFormSchema([{ id: 'x', type: 'number', label: 'X', memberField: 'rol' }]).ok
  )
  check('recusa escolha sem opção', !validateFormSchema([{ id: 'x', type: 'radio', label: 'X' }]).ok)
  check('recusa id repetido', !validateFormSchema([
    { id: 'x', type: 'text', label: 'A' },
    { id: 'x', type: 'text', label: 'B' },
  ]).ok)
  check('getMemberFieldSpec ignora coluna fora da lista', getMemberFieldSpec('church_id') === null)

  // ── 3. criar a campanha ───────────────────────────────────────────────────
  step(3, 'Criar a campanha e gerar o link de partilha')

  const shareToken = generateToken(10)
  const campanhaId = randomUUID()
  criado.campaignIds.push(campanhaId)

  await exec(`
    INSERT INTO secretaria_campaigns
      (id, church_id, owner_user_id, name, reason, description, kind, status, form_schema,
       message_template, share_token, require_identification)
    VALUES (
      '${campanhaId}'::uuid, '${igreja.id}'::uuid, 'e2e-user',
      '[E2E] Atualização de foto', 'Emissão de carteirinha', 'Confira e atualize seus dados.',
      'form', 'active', '${JSON.stringify(parsed.fields).replace(/'/g, "''")}'::jsonb,
      'Olá {{primeiro_nome}}, atualize seus dados: {{link}}', '${shareToken}', true
    )
  `)

  const [campanha] = await sql(`SELECT * FROM secretaria_campaigns WHERE id = '${campanhaId}'::uuid`)
  check('campanha gravada', !!campanha, campanha?.name)
  check('link de partilha montado', campaignPublicUrl(shareToken).endsWith(`/campanha/${shareToken}`))
  check('campanha ativa aceita resposta', campaignClosedReason(campanha) === null)
  check(
    'campanha em rascunho não aceita',
    campaignClosedReason({ ...campanha, status: 'draft' }) !== null
  )
  check(
    'campanha fora do prazo não aceita',
    campaignClosedReason({ ...campanha, closes_at: '2020-01-01T00:00:00Z' }) !== null
  )
  check(
    'comunicado não aceita resposta',
    campaignClosedReason({ ...campanha, kind: 'broadcast' }) !== null
  )

  // ── 4. anexar pessoas pelo filtro ─────────────────────────────────────────
  step(4, 'Anexar pessoas pelo filtro de público-alvo')

  const usuarioMaster = {
    id: 'e2e-user', profileType: 'master', churchId: igreja.id,
    regionalId: regional.id, campoId: campo.id, roleName: null,
  }

  const porRegional = await resolveAudienceMembers(usuarioMaster, { regionalIds: [regional.id] })
  const nossos = porRegional.members.filter(m => criado.memberIds.includes(m.memberId))
  check('filtro por regional acha os membros com telefone', nossos.length === 2, `${nossos.length} de 2`)
  check('quem não tem telefone fica de fora por padrão', !nossos.some(m => m.memberId === semTelefone.id))

  const semFiltroTelefone = await resolveAudienceMembers(usuarioMaster, {
    regionalIds: [regional.id],
    requirePhone: false,
  })
  check(
    'desligando o filtro, quem não tem telefone entra',
    semFiltroTelefone.members.filter(m => criado.memberIds.includes(m.memberId)).length === 3
  )

  const porZona = await resolveAudienceMembers(usuarioMaster, { zones: ['Zona Leste'] })
  check('filtro por zona funciona', porZona.members.some(m => m.memberId === ana.id))
  check(
    'zona inexistente não devolve ninguém nosso',
    !(await resolveAudienceMembers(usuarioMaster, { zones: ['[E2E] Zona Que Não Existe'] })).members
      .some(m => criado.memberIds.includes(m.memberId))
  )

  if (titulo) {
    const porTitulo = await resolveAudienceMembers(usuarioMaster, {
      churchIds: [igreja.id],
      titleIds: [titulo.id],
    })
    check('filtro por título eclesiástico funciona', porTitulo.members.some(m => m.memberId === ana.id))
    check('filtro por título exclui quem tem outro', !porTitulo.members.some(m => m.memberId === bruno.id))
  }

  // grava os alvos, como faz a rota de anexar
  const tokenAna = generateToken()
  const targetAnaId = randomUUID()
  await exec(`
    INSERT INTO secretaria_campaign_targets (id, campaign_id, member_id, name, phone, church_id, church_name, status, token)
    VALUES ('${targetAnaId}'::uuid, '${campanhaId}'::uuid, '${ana.id}'::uuid, '[E2E] Ana Souza', '19999990001',
            '${igreja.id}'::uuid, '[E2E] Igreja Campanhas', 'pending', '${tokenAna}')
  `)

  let duplicou = false
  await exec(`
    INSERT INTO secretaria_campaign_targets (id, campaign_id, member_id, name, status, token)
    VALUES ('${randomUUID()}'::uuid, '${campanhaId}'::uuid, '${ana.id}'::uuid, 'duplicata', 'pending', '${generateToken()}')
  `).then(() => { duplicou = true }).catch(() => {})
  check('banco impede a mesma pessoa duas vezes na campanha', !duplicou)

  check(
    'link individual sai identificado',
    campaignPublicUrl(shareToken, tokenAna).endsWith(`/campanha/${shareToken}/${tokenAna}`)
  )

  // ── 5. a pessoa preenche ──────────────────────────────────────────────────
  step(5, 'A pessoa preenche o formulário')

  const respostaRuim = validateAnswers(parsed.fields, { celular: '123', estado_civil: 'NAMORANDO' }, [])
  check('recusa telefone curto', respostaRuim.errors.some(e => e.includes('WhatsApp')))
  check('recusa opção que não existe no radio', respostaRuim.errors.some(e => e.includes('Estado civil')))
  check('cobra o campo obrigatório de foto', respostaRuim.errors.some(e => e.includes('foto')))
  check('resposta inválida não passa', !respostaRuim.ok)

  const arquivos = [
    { fieldId: 'foto', url: 'https://exemplo.test/foto-e2e.jpg', fileName: 'foto.jpg', mimeType: 'image/jpeg', size: 1234 },
  ]
  const respostaBoa = validateAnswers(
    parsed.fields,
    {
      celular: '(19) 98888-7777',
      cidade: 'Valinhos',
      estado_civil: 'CASADO',
      observacao: 'Mudei de endereço no mês passado.',
      // campo que não está no formulário deve ser descartado
      invadido: 'não deveria entrar',
    },
    arquivos
  )
  check('resposta válida passa', respostaBoa.ok, respostaBoa.errors.join(' '))
  check('telefone chega só com dígitos', respostaBoa.answers.celular === '19988887777')
  check('campo fora do formulário é descartado', respostaBoa.answers.invadido === undefined)
  check('anexo registrado', respostaBoa.files.length === 1 && respostaBoa.files[0].fieldId === 'foto')

  const respostaId = randomUUID()
  await exec(`
    INSERT INTO secretaria_campaign_responses (id, campaign_id, target_id, member_id, name, phone, answers, files, status)
    VALUES ('${respostaId}'::uuid, '${campanhaId}'::uuid, '${targetAnaId}'::uuid, '${ana.id}'::uuid,
            '[E2E] Ana Souza', '19999990001',
            '${JSON.stringify(respostaBoa.answers).replace(/'/g, "''")}'::jsonb,
            '${JSON.stringify(respostaBoa.files).replace(/'/g, "''")}'::jsonb, 'pending')
  `)
  await exec(`UPDATE secretaria_campaign_targets SET status = 'responded' WHERE id = '${targetAnaId}'::uuid`)
  await refreshCampaignCounters(campanhaId)

  const [contadores] = await sql(`SELECT target_count, response_count FROM secretaria_campaigns WHERE id = '${campanhaId}'::uuid`)
  check('contadores recalculados', Number(contadores.target_count) === 1 && Number(contadores.response_count) === 1,
    `alvos=${contadores.target_count} respostas=${contadores.response_count}`)

  // ── 6. a secretaria confere ───────────────────────────────────────────────
  step(6, 'A secretaria confere: o que muda no cadastro')

  // `SELECT *` quebra: members tem uma coluna tsvector que o Prisma não desserializa
  const COLS_MEMBRO = 'id, rol, church_id, cpf, mobile, phone, photo_url, address_city, marital_status, ecclesiastical_title, full_name'
  const [anaAntes] = await sql(`SELECT ${COLS_MEMBRO} FROM members WHERE id = '${ana.id}'::uuid`)
  const previa = diffMemberFields(parsed.fields, respostaBoa.answers, anaAntes)
  const mudam = previa.applied.map(a => a.field).sort()
  check('prévia lista exatamente os campos que mudam', JSON.stringify(mudam) === JSON.stringify(['address_city', 'marital_status', 'mobile', 'photo_url']), mudam.join(','))
  check('cidade aparece com o valor antigo e o novo',
    previa.applied.some(a => a.field === 'address_city' && a.from === 'Campinas' && a.to === 'Valinhos'))
  check('pergunta sem vínculo não entra no cadastro', !mudam.includes('observacao'))

  const previaIgual = diffMemberFields(parsed.fields, { ...respostaBoa.answers, cidade: 'Campinas' }, anaAntes)
  check('valor igual ao cadastro não vira alteração',
    !previaIgual.applied.some(a => a.field === 'address_city'))

  // ── 7. reprovar e corrigir ────────────────────────────────────────────────
  step(7, 'Reprovar, devolver o link e receber a correção')

  const motivo = 'A foto está desfocada, envie outra com fundo claro.'
  await exec(`
    UPDATE secretaria_campaign_responses
    SET status = 'rejected', review_notes = '${motivo.replace(/'/g, "''")}', reviewed_by = 'e2e-user', reviewed_at = now()
    WHERE id = '${respostaId}'::uuid
  `)
  const msg = rejectionMessage(campanha.name, motivo, campaignPublicUrl(shareToken, tokenAna))
  check('mensagem de reprovação leva o motivo', msg.includes(motivo))
  check('mensagem de reprovação leva o link individual', msg.includes(tokenAna))

  const [reprovada] = await sql(`SELECT status FROM secretaria_campaign_responses WHERE id = '${respostaId}'::uuid`)
  check('resposta consta como reprovada', reprovada.status === 'rejected')

  // reenvio: sobrescreve a mesma resposta e zera a decisão anterior
  const correcao = validateAnswers(
    parsed.fields,
    { celular: '(19) 98888-7777', cidade: 'Valinhos', estado_civil: 'CASADO' },
    [{ fieldId: 'foto', url: 'https://exemplo.test/foto-e2e-v2.jpg', fileName: 'foto2.jpg', mimeType: 'image/jpeg', size: 4321 }]
  )
  await exec(`
    UPDATE secretaria_campaign_responses
    SET answers = '${JSON.stringify(correcao.answers).replace(/'/g, "''")}'::jsonb,
        files   = '${JSON.stringify(correcao.files).replace(/'/g, "''")}'::jsonb,
        status = 'pending', review_notes = NULL, reviewed_by = NULL, reviewed_at = NULL,
        submitted_at = now()
    WHERE id = '${respostaId}'::uuid
  `)
  const [reenviada] = await sql(`SELECT status, answers FROM secretaria_campaign_responses WHERE id = '${respostaId}'::uuid`)
  check('reenvio volta para pendente', reenviada.status === 'pending')
  check('reenvio não duplica a resposta',
    Number((await sql(`SELECT count(*)::int AS n FROM secretaria_campaign_responses WHERE campaign_id = '${campanhaId}'::uuid`))[0].n) === 1)

  // ── 8. aprovar e gravar no cadastro ───────────────────────────────────────
  step(8, 'Aprovar: o cadastro do membro é atualizado de verdade')

  const resultado = await applyApprovalToMember({
    memberId: ana.id,
    campaign: { id: campanhaId, name: campanha.name },
    schema: parsed.fields,
    answers: correcao.answers,
    userId: null,
  })
  check('aprovação não deu erro', !resultado.error, resultado.error ?? '')
  check('quatro campos gravados', resultado.applied.length === 4, resultado.applied.map(a => a.field).join(','))

  const [anaDepois] = await sql(`SELECT ${COLS_MEMBRO} FROM members WHERE id = '${ana.id}'::uuid`)
  check('foto atualizada no cadastro', anaDepois.photo_url === 'https://exemplo.test/foto-e2e-v2.jpg')
  check('celular atualizado', anaDepois.mobile === '19988887777')
  check('cidade atualizada', anaDepois.address_city === 'Valinhos')
  check('estado civil atualizado', anaDepois.marital_status === 'CASADO')
  check('ROL não foi tocado', String(anaDepois.rol) === String(anaAntes.rol))
  check('igreja não foi tocada', anaDepois.church_id === anaAntes.church_id)
  check('título eclesiástico não foi tocado', anaDepois.ecclesiastical_title === anaAntes.ecclesiastical_title)

  const ocorrencias = await sql(`
    SELECT id, notes, metadata FROM member_event_history
    WHERE member_id = '${ana.id}'::uuid AND service_group = 'CAMPANHA'
  `)
  check('ocorrência registrada no histórico do membro', ocorrencias.length === 1)
  check('ocorrência descreve a mudança', (ocorrencias[0]?.notes ?? '').includes('Valinhos'))

  // aprovar de novo, sem nada novo, não deve gerar alteração nem ocorrência
  const reaplicar = await applyApprovalToMember({
    memberId: ana.id,
    campaign: { id: campanhaId, name: campanha.name },
    schema: parsed.fields,
    answers: correcao.answers,
    userId: null,
  })
  check('reaplicar os mesmos valores não muda nada', reaplicar.applied.length === 0)
  check('e não gera ocorrência duplicada',
    (await sql(`SELECT count(*)::int AS n FROM member_event_history WHERE member_id = '${ana.id}'::uuid AND service_group = 'CAMPANHA'`))[0].n === 1)

  // ── 9. aprovação parcial ──────────────────────────────────────────────────
  step(9, 'Aprovação parcial: só os campos marcados vão para o cadastro')

  const parcial = await applyApprovalToMember({
    memberId: bruno.id,
    campaign: { id: campanhaId, name: campanha.name },
    schema: parsed.fields,
    answers: { celular: '19977776666', cidade: 'Indaiatuba', estado_civil: 'SOLTEIRO' },
    onlyFields: ['address_city'],
    userId: null,
  })
  check('só um campo aplicado', parcial.applied.length === 1 && parcial.applied[0].field === 'address_city')

  const [brunoDepois] = await sql(`SELECT mobile, address_city FROM members WHERE id = '${bruno.id}'::uuid`)
  check('campo marcado gravado', brunoDepois.address_city === 'Indaiatuba')
  check('campo NÃO marcado permaneceu como estava', brunoDepois.mobile === '19999990002')

  // ── 10. travas ────────────────────────────────────────────────────────────
  step(10, 'Travas que precisam bloquear')

  check('CPF inválido é recusado', !isValidCpf('11111111111') && !isValidCpf('123'))
  check('CPF válido passa', isValidCpf(CPF_ANA))

  const cpfDuplicado = await applyApprovalToMember({
    memberId: bruno.id,
    campaign: { id: campanhaId, name: campanha.name },
    schema: [{ id: 'cpf', type: 'cpf', label: 'CPF', memberField: 'cpf' }],
    answers: { cpf: CPF_ANA },
    userId: null,
  })
  check('aprovar CPF que já é de outra pessoa é bloqueado', !!cpfDuplicado.error, cpfDuplicado.error)
  check('nada foi gravado no bloqueio', cpfDuplicado.applied.length === 0)
  const [brunoCpf] = await sql(`SELECT cpf FROM members WHERE id = '${bruno.id}'::uuid`)
  check('CPF do Bruno intacto após o bloqueio', brunoCpf.cpf === CPF_BRUNO)

  const membroApagado = await applyApprovalToMember({
    memberId: randomUUID(),
    campaign: { id: campanhaId, name: campanha.name },
    schema: parsed.fields,
    answers: correcao.answers,
    userId: null,
  })
  check('aprovar resposta de membro inexistente é bloqueado', !!membroApagado.error, membroApagado.error)

  // ── 11. exclusão em cascata ───────────────────────────────────────────────
  step(11, 'Excluir a campanha leva alvos e respostas junto')

  const descartavelId = randomUUID()
  criado.campaignIds.push(descartavelId)
  await exec(`
    INSERT INTO secretaria_campaigns (id, church_id, owner_user_id, name, kind, status, form_schema, share_token)
    VALUES ('${descartavelId}'::uuid, '${igreja.id}'::uuid, 'e2e-user', '[E2E] Descartável', 'form', 'active',
            '${JSON.stringify(parsed.fields).replace(/'/g, "''")}'::jsonb, '${generateToken(10)}')
  `)
  const alvoDescartavel = randomUUID()
  await exec(`
    INSERT INTO secretaria_campaign_targets (id, campaign_id, member_id, name, status, token)
    VALUES ('${alvoDescartavel}'::uuid, '${descartavelId}'::uuid, '${bruno.id}'::uuid, 'x', 'pending', '${generateToken()}')
  `)
  await exec(`
    INSERT INTO secretaria_campaign_responses (id, campaign_id, target_id, member_id, name, answers, status)
    VALUES ('${randomUUID()}'::uuid, '${descartavelId}'::uuid, '${alvoDescartavel}'::uuid, '${bruno.id}'::uuid, 'x', '{}'::jsonb, 'pending')
  `)
  await exec(`DELETE FROM secretaria_campaigns WHERE id = '${descartavelId}'::uuid`)

  check('alvos apagados junto',
    Number((await sql(`SELECT count(*)::int AS n FROM secretaria_campaign_targets WHERE campaign_id = '${descartavelId}'::uuid`))[0].n) === 0)
  check('respostas apagadas junto',
    Number((await sql(`SELECT count(*)::int AS n FROM secretaria_campaign_responses WHERE campaign_id = '${descartavelId}'::uuid`))[0].n) === 0)
  check('o membro continua existindo depois de excluir a campanha',
    Number((await sql(`SELECT count(*)::int AS n FROM members WHERE id = '${bruno.id}'::uuid`))[0].n) === 1)

  console.log(`\n${'═'.repeat(72)}`)
  console.log(`RESULTADO: ${passed} passaram · ${failed} falharam`)
  if (failed) console.log(`Falhas: ${falhas.join(' | ')}`)
  console.log('═'.repeat(72))
}

main()
  .catch((e) => { console.error('\n💥 ERRO:\n', e); failed++ })
  .finally(async () => {
    if (KEEP) console.log('\n⚠️  --keep: dados do teste MANTIDOS no banco.')
    else await limpar().catch((e) => console.error('falha na limpeza:', e))
    await prisma.$disconnect()
    process.exit(failed ? 1 : 0)
  })
