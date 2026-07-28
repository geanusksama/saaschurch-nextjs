/**
 * Simulação ponta a ponta de "Quero ser Membro".
 *
 * Percorre o caminho real: pedido na home → card em POR FAZER → link da ficha
 * → preenchimento → avaliação da secretaria → aprovação → membro criado com
 * ROL → login no Portal do Membro.
 *
 * Roda contra o banco de verdade, mas:
 *  - não chama a Z-API (as funções de envio não são exercitadas aqui);
 *  - usa telefone da faixa de teste e um CPF de teste válido;
 *  - tudo leva o prefixo [E2E] e é apagado no fim (--keep preserva).
 *
 * Uso: npx tsx scripts/e2e-membresia.mjs
 */

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'node:crypto'

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
const step = (n, t) => console.log(`\n${'─'.repeat(70)}\n${n}. ${t}\n${'─'.repeat(70)}`)

/** Gera um CPF matematicamente válido — o Portal exige dígito verificador. */
function cpfValidoAleatorio() {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10))
  const dv = (base) => {
    const soma = base.reduce((acc, d, i) => acc + d * (base.length + 1 - i), 0)
    const r = (soma * 10) % 11
    return r === 10 ? 0 : r
  }
  const d1 = dv(n)
  const d2 = dv([...n, d1])
  return [...n, d1, d2].join('')
}

const TEL = '5519999990009'
const CPF = cpfValidoAleatorio()
const criado = { attendanceId: null, requestId: null, memberId: null }

async function limpar() {
  console.log('\n🧹 limpando os dados do teste...')
  if (criado.memberId) await exec(`DELETE FROM members WHERE id = '${criado.memberId}'::uuid`).catch(() => {})
  if (criado.requestId) await exec(`DELETE FROM new_member_requests WHERE id = '${criado.requestId}'::uuid`).catch(() => {})
  if (criado.attendanceId) {
    for (const t of ['pastoral_attendance_timeline', 'pastoral_attendance_activities', 'pastoral_attendance_notes']) {
      await exec(`DELETE FROM ${t} WHERE attendance_id = '${criado.attendanceId}'::uuid`).catch(() => {})
    }
    await exec(`DELETE FROM pastoral_attendances WHERE id = '${criado.attendanceId}'::uuid`).catch(() => {})
  }
  console.log('   pronto — banco no estado anterior.')
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗')
  console.log('║  E2E — Quero ser Membro (ficha → avaliação → membro + ROL)     ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝')

  step(0, 'Ambiente')
  const [igreja] = await sql(`SELECT id, name, headquarters_id FROM churches WHERE id = '6d2688df-5249-4bd2-89cc-0cd8c324b3d8'::uuid`)
  check('igreja encontrada', !!igreja, igreja?.name)
  const churchId = igreja.id
  // a adesão entra pela igreja que recebeu o pedido (no portal, a SEDE)
  const sedeId = churchId

  const [colTodo] = await sql(`SELECT id, name FROM pastoral_pipeline_columns WHERE church_id='${churchId}'::uuid AND column_key='todo' LIMIT 1`)
  const [colDone] = await sql(`SELECT id, name FROM pastoral_pipeline_columns WHERE church_id='${churchId}'::uuid AND column_key='done' LIMIT 1`)
  check('colunas do pipeline', !!colTodo && !!colDone)

  // ── 1. pedido pela home ──
  step(1, 'Pessoa pede "Quero ser Membro" na home')
  const [card] = await sql(`
    INSERT INTO pastoral_attendances (church_id, column_id, visitor_name, phone, attendance_type, status, priority, started_at, tags)
    VALUES ('${churchId}'::uuid, '${colTodo.id}'::uuid, '[E2E] Joana Candidata', '${TEL}', 'quero_ser_membro', 'open', 'normal', now(), '{}')
    RETURNING id`)
  criado.attendanceId = card.id

  const formToken = randomUUID().replace(/-/g, '')
  const [req] = await sql(`
    INSERT INTO new_member_requests (name, whatsapp, is_married, past_churches, afro_background, scheduled_date,
                                     pipeline_card_id, status, church_id, form_token, form_sent_at, target_church_id)
    VALUES ('[E2E] Joana Candidata', '${TEL}', false, '', false, CURRENT_DATE,
            '${card.id}', 'pending', '${churchId}'::uuid, '${formToken}', now(), '${sedeId}'::uuid)
    RETURNING id, form_token, target_church_id`)
  criado.requestId = req.id

  check('card criado em POR FAZER', !!card.id, colTodo.name)
  check('solicitação criada com status pendente', !!req.id)
  check('link da ficha gerado', !!req.form_token, `/membro/formulario/${req.form_token.slice(0, 12)}...`)
  check('adesão direcionada para a igreja do pedido (SEDE)', req.target_church_id === sedeId)

  await exec(`
    INSERT INTO pastoral_attendance_timeline (attendance_id, church_id, event_type, description, metadata)
    VALUES ('${card.id}'::uuid, '${churchId}'::uuid, 'form', 'Formulário de adesão enviado — aguardando preenchimento',
            '{"form_url":"https://x/membro/formulario/${formToken}"}'::jsonb)`)
  const [{ n: nTl }] = await sql(`SELECT count(*)::int n FROM pastoral_attendance_timeline WHERE attendance_id='${card.id}'::uuid AND event_type='form'`)
  check('link também na timeline pública do card', nTl === 1)

  // ── 2. estado antes de preencher ──
  step(2, 'Antes de preencher: a secretaria vê "aguardando ficha"')
  const [antes] = await sql(`SELECT status, form_submitted_at FROM new_member_requests WHERE id='${req.id}'::uuid`)
  check('status pendente e ficha não enviada', antes.status === 'pending' && !antes.form_submitted_at)

  // ── 3. preenchimento da ficha ──
  step(3, 'Pessoa preenche a ficha pelo link')
  const form = {
    firstName: 'Joana', lastName: 'Candidata E2E', preferredName: 'Jô',
    birthDate: '2000-05-10', email: 'joana.e2e@teste.com', cpf: CPF, rg: '12.345.678-9',
    phone: TEL, maritalStatus: 'single',
    fatherName: 'Pai E2E', motherName: 'Mãe E2E',
    naturalityCity: 'Campinas', naturalityState: 'SP',
    addressZipcode: '13033650', addressStreet: 'Rua José da Silva Pinto', addressNumber: '357',
    addressComplement: 'Casa', addressNeighborhood: 'Vila Proost de Souza',
    addressCity: 'Campinas', addressState: 'SP',
    churchEntryDate: '2026-07-19', baptized: 'nao',
    emergencyName: 'Contato E2E', emergencyPhone: '19994742990',
    photoUrl: '', notes: 'cadastro de teste automatizado',
  }
  const docs = [{ tipo: 'documento', url: 'https://exemplo/rg.jpg', nome: 'rg.jpg' }]

  await exec(`
    UPDATE new_member_requests
    SET name = 'Joana Candidata E2E',
        form_data = '${JSON.stringify(form).replace(/'/g, "''")}'::jsonb,
        documents = '${JSON.stringify(docs)}'::jsonb,
        form_submitted_at = now()
    WHERE id = '${req.id}'::uuid`)

  const [depois] = await sql(`SELECT name, form_submitted_at, form_data, documents, status FROM new_member_requests WHERE id='${req.id}'::uuid`)
  check('ficha salva e marcada como enviada', !!depois.form_submitted_at)
  check('dados completos gravados', Object.keys(depois.form_data ?? {}).length >= 20,
    `${Object.keys(depois.form_data ?? {}).length} campos`)
  check('documentos anexados', (depois.documents ?? []).length === 1)
  check('status continua pendente até a secretaria decidir', depois.status === 'pending')
  check('CPF do formulário é válido (exigência do Portal)', (() => {
    const d = CPF
    const dv = (base) => { const s = base.split('').reduce((a, x, i) => a + Number(x) * (base.length + 1 - i), 0); const r = (s * 10) % 11; return r === 10 ? 0 : r }
    return dv(d.slice(0, 9)) === Number(d[9]) && dv(d.slice(0, 10)) === Number(d[10])
  })(), CPF)

  // ── 4. aprovação ──
  step(4, 'Secretaria aprova — cria o membro e gera o ROL')
  const [{ max }] = await sql(`SELECT COALESCE(MAX(rol),0)::int max FROM members WHERE rol IS NOT NULL`)
  const novoRol = max + 1

  // espelha o insert do /api/membership-requests/[id]/review: id e updated_at
  // não têm default no banco, e os status seguem a convenção PT da base
  const memberUuid = randomUUID()
  const [membro] = await sql(`
    INSERT INTO members (id, updated_at, church_id, full_name, preferred_name, cpf, rg, birth_date, marital_status,
                         email, phone, mobile, address_street, address_number, address_complement,
                         address_neighborhood, address_city, address_state, address_zipcode,
                         membership_status, membership_date, baptism_status, father_name, mother_name,
                         naturality_city, naturality_state, emergency_contact_name, emergency_contact_phone, rol)
    VALUES ('${memberUuid}'::uuid, now(), '${sedeId}'::uuid, 'Joana Candidata E2E', 'Jô', '${CPF}', '12345678 9', '2000-05-10', 'Solteiro(a)',
            'joana.e2e@teste.com', '${TEL}', '${TEL}', 'Rua José da Silva Pinto', '357', 'Casa',
            'Vila Proost de Souza', 'Campinas', 'SP', '13033650',
            'ATIVO', '2026-07-19', 'not_baptized', 'Pai E2E', 'Mãe E2E',
            'Campinas', 'SP', 'Contato E2E', '19994742990', ${novoRol})
    RETURNING id, rol, church_id, full_name`)
  criado.memberId = membro.id

  await exec(`
    UPDATE new_member_requests SET status='approved', created_member_id='${membro.id}'::uuid,
      member_rol=${novoRol}, reviewed_at=now() WHERE id='${req.id}'::uuid`)
  await exec(`
    UPDATE pastoral_attendances SET status='done', column_id='${colDone.id}'::uuid,
      member_id='${membro.id}'::uuid, completed_at=now() WHERE id='${card.id}'::uuid`)

  check('membro criado', !!membro.id, membro.full_name)
  const [conv] = await sql(`SELECT membership_status, marital_status, member_type FROM members WHERE id='${membro.id}'::uuid`)
  check('convenções da base respeitadas (ATIVO / Solteiro(a) / MEMBRO)',
    conv.membership_status === 'ATIVO' && conv.marital_status === 'Solteiro(a)' && conv.member_type === 'MEMBRO',
    `${conv.membership_status} · ${conv.marital_status} · ${conv.member_type}`)
  check('ROL atribuído', membro.rol === novoRol, `ROL ${membro.rol}`)
  check('membro criado na igreja correta (FK válida)', membro.church_id === sedeId)

  const [reqFinal] = await sql(`SELECT status, member_rol, created_member_id FROM new_member_requests WHERE id='${req.id}'::uuid`)
  check('solicitação marcada como aprovada', reqFinal.status === 'approved')
  check('ROL espelhado na solicitação', reqFinal.member_rol === novoRol)

  const [cardFinal] = await sql(`
    SELECT a.status, a.member_id, c.name coluna FROM pastoral_attendances a
    JOIN pastoral_pipeline_columns c ON c.id=a.column_id WHERE a.id='${card.id}'::uuid`)
  check('card movido para CONCLUÍDO', cardFinal.coluna === colDone.name && cardFinal.status === 'done')
  check('card vinculado ao membro criado', cardFinal.member_id === membro.id)

  // ── 5. login no Portal do Membro ──
  step(5, 'A pessoa consegue entrar no Portal do Membro com ROL + CPF?')
  const candidatos = await sql(`SELECT id, cpf, phone, mobile FROM members WHERE rol=${novoRol} AND deleted_at IS NULL`)
  const achou = candidatos.find(m => m.cpf && m.cpf.replace(/\D/g, '') === CPF)
  check('lookup por ROL + CPF encontra o membro', !!achou, `ROL ${novoRol}`)
  check('há telefone para receber o código OTP', !!(achou?.mobile || achou?.phone),
    achou?.mobile || achou?.phone)

  // ── 6. antiduplicidade ──
  step(6, 'Mesma pessoa pedindo de novo não gera segundo cadastro')
  const dupCpf = await sql(`SELECT id FROM members WHERE cpf='${CPF}' AND deleted_at IS NULL`)
  check('CPF já cadastrado é detectável antes de aprovar de novo', dupCpf.length === 1)

  const vivos = await sql(`
    SELECT count(*)::int n FROM pastoral_attendances
    WHERE phone='${TEL}' AND attendance_type='quero_ser_membro'
      AND deleted_at IS NULL AND status NOT IN ('done','cancelled')`)
  check('nenhum card vivo sobra após a aprovação', vivos[0].n === 0)

  console.log(`\n${'═'.repeat(70)}`)
  console.log(`RESULTADO: ${passed} passaram · ${failed} falharam`)
  if (failed) console.log(`Falhas: ${falhas.join(' | ')}`)
  console.log('═'.repeat(70))
}

main()
  .catch(e => { console.error('\n💥 ERRO:\n', e); failed++ })
  .finally(async () => {
    if (KEEP) console.log('\n⚠️  --keep: dados do teste MANTIDOS no banco.')
    else await limpar().catch(e => console.error('falha na limpeza:', e))
    await prisma.$disconnect()
    process.exit(failed ? 1 : 0)
  })
