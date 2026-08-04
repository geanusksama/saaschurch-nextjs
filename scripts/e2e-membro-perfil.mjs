/**
 * E2E — Perfil do membro no Portal "Sou Membro" (tela /membro/perfil).
 *
 * Prova a regra que a tela usa para "crescer com quem a pessoa é":
 *  - membro comum: só o resumo — sem GF, sem função, sem ministério, sem
 *    batismo (temVidaEclesiastica = false, nenhum card vazio na tela);
 *  - LÍDER de GF: o bloco do Grupo Familiar vem com o casal de líderes na
 *    ordem certa, horário só HH:mm, endereço, coordenadas numéricas e a
 *    contagem de participantes ativos;
 *  - PARTICIPANTE de GF: o mesmo bloco, porém com vínculo "participante" e a
 *    data de entrada;
 *  - membro com vida eclesiástica: funções vigentes, ministérios (marcando
 *    quando é a liderança) e batismo.
 * Também prova o que NÃO pode aparecer: função encerrada, ministério inativo,
 * GF inativo e membro excluído.
 *
 * O token do /api/membro/perfil é o mesmo member_token de 7 dias do /verify —
 * aqui exercitamos sign/verify para garantir que o id vem do `sub` assinado.
 *
 * Roda contra o banco de verdade: tudo é criado com prefixo [E2E] sob a igreja
 * sede real e apagado no fim (--keep preserva para inspeção).
 *
 * Uso: npx tsx scripts/e2e-membro-perfil.mjs
 */

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

import { PrismaClient } from '@prisma/client'
import { getMembroPerfil } from '../src/lib/membroPerfilService.ts'
import { getMembroAtividades, getMembroPresencas } from '../src/lib/membroAtividadesService.ts'
import { syncCellGroupLeaders } from '../src/lib/cellGroupService.ts'
import { DEFAULT_SEDE_ID } from '../src/lib/gfPublicListService.ts'
import { signToken, verifyToken } from '../src/lib/membroJwt.ts'

const prisma = new PrismaClient()
const KEEP = process.argv.includes('--keep')
const exec = (q) => prisma.$executeRawUnsafe(q)

let passed = 0, failed = 0
const falhas = []
function check(label, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { failed++; falhas.push(label); console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
const step = (n, t) => console.log(`\n${'─'.repeat(72)}\n${n}. ${t}\n${'─'.repeat(72)}`)

const criado = { memberIds: [], cellIds: [], ministryIds: [], funcaoCatalogoId: null, eventIds: [], rolsLeitor: [] }

async function limpar() {
  console.log('\n🧹 limpando os dados do teste...')
  for (const rol of criado.rolsLeitor) {
    await exec(`DELETE FROM face_presencas WHERE rol = ${rol} AND nome LIKE '[E2E]%'`).catch(() => {})
  }
  for (const id of criado.eventIds) {
    await exec(`DELETE FROM event_attendance WHERE event_id = '${id}'::uuid`).catch(() => {})
    await exec(`DELETE FROM event_registrations WHERE event_id = '${id}'::uuid`).catch(() => {})
    await exec(`DELETE FROM events WHERE id = '${id}'::uuid`).catch(() => {})
  }
  for (const id of criado.memberIds) {
    await exec(`DELETE FROM member_family_relationships WHERE member_id = '${id}'::uuid OR related_member_id = '${id}'::uuid`).catch(() => {})
    await exec(`DELETE FROM baptisms WHERE member_id = '${id}'::uuid`).catch(() => {})
    await exec(`DELETE FROM church_function_history WHERE member_id = '${id}'::uuid`).catch(() => {})
    await exec(`DELETE FROM ministry_members WHERE member_id = '${id}'::uuid`).catch(() => {})
    await exec(`DELETE FROM cell_group_members WHERE member_id = '${id}'::uuid`).catch(() => {})
    await exec(`DELETE FROM cell_group_leaders WHERE member_id = '${id}'::uuid`).catch(() => {})
  }
  for (const id of criado.cellIds) {
    await exec(`DELETE FROM cell_groups WHERE id = '${id}'::uuid`).catch(() => {})
  }
  for (const id of criado.ministryIds) {
    await exec(`DELETE FROM ministries WHERE id = '${id}'::uuid`).catch(() => {})
  }
  for (const id of criado.memberIds) {
    await exec(`DELETE FROM members WHERE id = '${id}'::uuid`).catch(() => {})
  }
  if (criado.funcaoCatalogoId) {
    await exec(`DELETE FROM church_function_catalog WHERE id = '${criado.funcaoCatalogoId}'::uuid`).catch(() => {})
  }
  console.log('   pronto — banco no estado anterior.')
}

async function novoMembro(nome, extra = {}) {
  const m = await prisma.member.create({
    data: {
      churchId: DEFAULT_SEDE_ID,
      fullName: nome,
      membershipStatus: 'ATIVO',
      membershipDate: new Date('2020-03-01'),
      ...extra,
    },
  })
  criado.memberIds.push(m.id)
  return m
}

async function main() {
  console.log('\n👤 E2E — Perfil do membro (Portal "Sou Membro")\n')

  step(1, 'Confirmar que a sede pública existe (senão o teste não faz sentido)')
  // o campo da sede é obrigatório para criar ministério (FK ministries.campo_id
  // é preenchida por trigger a partir da igreja, então mandamos o valor certo)
  const sede = await prisma.church.findUnique({
    where: { id: DEFAULT_SEDE_ID },
    select: { id: true, name: true, regional: { select: { campoId: true } } },
  })
  check('DEFAULT_SEDE_ID aponta para uma igreja real', !!sede, sede?.name ?? 'não encontrada')
  if (!sede) throw new Error('Sede pública (DEFAULT_SEDE_ID) não existe no banco — abortando.')

  // ── 2. membro comum: a tela fica só com o resumo ────────────────────────
  step(2, 'Membro comum — nenhum card extra deve aparecer')

  const comum = await novoMembro('[E2E] Perfil Membro Comum', {
    preferredName: '[E2E] Comum',
    ecclesiasticalTitle: 'CONGREGADO',
    mobile: '19999990401',
    addressStreet: 'Rua do Teste', addressNumber: '10', addressNeighborhood: 'Centro',
    addressCity: 'Campinas', addressState: 'SP',
  })

  const pComum = await getMembroPerfil(comum.id)
  check('perfil do membro comum foi montado', !!pComum)
  check('sem Grupo Familiar', pComum?.gf === null)
  check('sem função na igreja', pComum?.funcoes.length === 0, String(pComum?.funcoes.length))
  check('sem ministério', pComum?.ministerios.length === 0, String(pComum?.ministerios.length))
  check('sem batismo', pComum?.batismo === null)
  check('temVidaEclesiastica = false (tela mostra só o resumo)', pComum?.temVidaEclesiastica === false)
  check('o resumo traz a igreja pelo join', pComum?.member.churchName === sede.name, pComum?.member.churchName)
  check('datas saem como AAAA-MM-DD (não Date cru)', pComum?.member.membershipDate === '2020-03-01', String(pComum?.member.membershipDate))
  check('ROL veio para o card de números', typeof pComum?.member.rol === 'number', String(pComum?.member.rol))
  check('endereço do membro veio para a linha "Endereço"', pComum?.member.addressCity === 'Campinas')

  // ── 3. líder de GF ───────────────────────────────────────────────────────
  step(3, 'Membro que LIDERA um GF — bloco do Grupo Familiar enriquecido')

  const lider = await novoMembro('[E2E] Perfil Líder GF', { mobile: '19999990402', photoUrl: 'https://example.com/lider.jpg' })
  const esposa = await novoMembro('[E2E] Perfil Esposa Líder', { mobile: '19999990403' })
  const participante = await novoMembro('[E2E] Perfil Participante GF', { mobile: '19999990404' })
  const outroParticipante = await novoMembro('[E2E] Perfil Participante 2', { mobile: '19999990405' })

  const gf = await prisma.cellGroup.create({
    data: {
      churchId: sede.id, name: '[E2E] GF Perfil', cellType: 'Mulheres', status: 'active',
      color: '#1d4ed8', photo: 'https://example.com/gf.jpg',
      meetingDay: 'Quinta', meetingTime: new Date('1970-01-01T20:00:00Z'),
      addressStreet: 'Rua Prudente de Moraes', addressNumber: '62', addressNeighborhood: 'Vila Industrial',
      addressCity: 'Campinas', addressState: 'SP', addressZipcode: '13035-000',
      latitude: '-22.91000000', longitude: '-47.05000000',
    },
  })
  criado.cellIds.push(gf.id)
  await syncCellGroupLeaders(gf.id, [lider.id, esposa.id])

  await prisma.cellGroupMember.create({
    data: { cellGroupId: gf.id, memberId: participante.id, joinedAt: new Date('2024-05-10'), isActive: true },
  })
  await prisma.cellGroupMember.create({
    data: { cellGroupId: gf.id, memberId: outroParticipante.id, joinedAt: new Date('2024-06-01'), isActive: true },
  })

  const pLider = await getMembroPerfil(lider.id)
  check('o GF que ela lidera aparece no perfil', pLider?.gf?.id === gf.id, pLider?.gf?.name)
  check('vínculo é "lider"', pLider?.gf?.vinculo === 'lider', pLider?.gf?.vinculo)
  check('os dois líderes vieram (casal)', pLider?.gf?.leaders.length === 2, String(pLider?.gf?.leaders.length))
  check('o principal é o primeiro da lista', pLider?.gf?.leaders[0]?.principal === true && pLider?.gf?.leaders[0]?.name === lider.fullName, pLider?.gf?.leaders[0]?.name)
  check('o segundo líder não é marcado como principal', pLider?.gf?.leaders[1]?.principal === false)
  check('telefone do líder veio (celular na frente do fixo)', pLider?.gf?.leaders[0]?.phone === '19999990402', pLider?.gf?.leaders[0]?.phone)
  check('horário veio só HH:mm (não o DateTime cru)', pLider?.gf?.meetingTime === '20:00', String(pLider?.gf?.meetingTime))
  check('dia da reunião veio', pLider?.gf?.meetingDay === 'Quinta')
  check('endereço estruturado veio (linha "Ver no mapa")', pLider?.gf?.addressStreet === 'Rua Prudente de Moraes' && pLider?.gf?.addressNumber === '62')
  check('coordenadas vieram como número (o embed do mapa depende disso)',
    typeof pLider?.gf?.latitude === 'number' && typeof pLider?.gf?.longitude === 'number',
    `${pLider?.gf?.latitude}, ${pLider?.gf?.longitude}`)
  check('cor do GF veio (pinta o cabeçalho do card)', pLider?.gf?.color === '#1d4ed8')
  check('contagem de participantes ativos bate', pLider?.gf?.memberCount === 2, String(pLider?.gf?.memberCount))
  check('líder não tem data de entrada (ele não é cell_group_member)', pLider?.gf?.joinedAt === null)

  // ── 4. participante de GF ────────────────────────────────────────────────
  step(4, 'Membro que PARTICIPA de um GF — mesmo bloco, vínculo diferente')

  const pPart = await getMembroPerfil(participante.id)
  check('o GF em que participa aparece no perfil', pPart?.gf?.id === gf.id, pPart?.gf?.name)
  check('vínculo é "participante"', pPart?.gf?.vinculo === 'participante', pPart?.gf?.vinculo)
  check('data de entrada veio', pPart?.gf?.joinedAt === '2024-05-10', String(pPart?.gf?.joinedAt))
  check('participante enxerga os líderes do grupo (para chamar no WhatsApp)', pPart?.gf?.leaders.length === 2)
  check('participante não vira líder por engano', pPart?.gf?.leaders.every((l) => l.id !== participante.id))

  // saiu do GF: o card some
  await prisma.cellGroupMember.updateMany({
    where: { cellGroupId: gf.id, memberId: outroParticipante.id },
    data: { isActive: false, leftAt: new Date('2025-01-10') },
  })
  const pSaiu = await getMembroPerfil(outroParticipante.id)
  check('quem saiu do GF deixa de ver o card', pSaiu?.gf === null)
  const pLiderDepois = await getMembroPerfil(lider.id)
  check('a contagem de participantes cai junto', pLiderDepois?.gf?.memberCount === 1, String(pLiderDepois?.gf?.memberCount))

  // ── 5. vida eclesiástica ────────────────────────────────────────────────
  step(5, 'Funções, ministérios e batismo')

  const catalogo = await prisma.churchFunctionCatalog.create({
    data: { name: '[E2E] Secretário de Perfil', abbreviation: 'E2ESEC', isActive: true },
  })
  criado.funcaoCatalogoId = catalogo.id

  await prisma.churchFunctionHistory.create({
    data: {
      churchId: sede.id, memberId: lider.id, functionId: catalogo.id,
      department: 'Secretaria', startDate: new Date('2023-02-01'), isActive: true, isCampoWide: false,
    },
  })
  // função ENCERRADA — não pode aparecer no perfil (o histórico fica no painel)
  await prisma.churchFunctionHistory.create({
    data: {
      churchId: sede.id, memberId: lider.id, functionId: catalogo.id,
      department: 'Antiga', startDate: new Date('2019-01-01'), endDate: new Date('2022-12-31'),
      isActive: false, isCampoWide: false,
    },
  })

  const ministerio = await prisma.ministry.create({
    data: { churchId: sede.id, campoId: sede.regional?.campoId ?? null, name: '[E2E] Ministério de Louvor', color: '#7c3aed', leaderId: lider.id, isActive: true },
  })
  criado.ministryIds.push(ministerio.id)
  const ministerioInativo = await prisma.ministry.create({
    data: { churchId: sede.id, campoId: sede.regional?.campoId ?? null, name: '[E2E] Ministério Encerrado', isActive: false },
  })
  criado.ministryIds.push(ministerioInativo.id)

  await prisma.ministryMember.create({
    data: { ministryId: ministerio.id, memberId: lider.id, role: 'Vocal', joinedAt: new Date('2022-08-15'), isActive: true },
  })
  await prisma.ministryMember.create({
    data: { ministryId: ministerioInativo.id, memberId: lider.id, joinedAt: new Date('2021-01-01'), isActive: true },
  })

  await prisma.baptism.create({
    data: {
      churchId: sede.id, memberId: lider.id, baptismDate: new Date('2018-11-25'),
      location: 'Templo Sede', ministerId: esposa.id, certificateNumber: `E2E-${Date.now() % 100000}`,
    },
  })

  const pRico = await getMembroPerfil(lider.id)
  check('temVidaEclesiastica = true (a tela ganha os cards)', pRico?.temVidaEclesiastica === true)
  check('só a função VIGENTE aparece', pRico?.funcoes.length === 1, String(pRico?.funcoes.length))
  check('nome da função veio do catálogo', pRico?.funcoes[0]?.name === '[E2E] Secretário de Perfil', pRico?.funcoes[0]?.name)
  check('departamento da função veio', pRico?.funcoes[0]?.department === 'Secretaria')
  check('data de início da função veio como AAAA-MM-DD', pRico?.funcoes[0]?.startDate === '2023-02-01', String(pRico?.funcoes[0]?.startDate))
  check('ministério ATIVO aparece', pRico?.ministerios.some((m) => m.id === ministerio.id))
  check('ministério INATIVO não aparece', !pRico?.ministerios.some((m) => m.id === ministerioInativo.id))
  check('marca que a pessoa é a líder do ministério', pRico?.ministerios.find((m) => m.id === ministerio.id)?.isLeader === true)
  check('cor do ministério veio (pinta o ícone da linha)', pRico?.ministerios.find((m) => m.id === ministerio.id)?.color === '#7c3aed')
  check('batismo veio da tabela de batismos', pRico?.batismo?.date === '2018-11-25', String(pRico?.batismo?.date))
  check('local do batismo veio', pRico?.batismo?.location === 'Templo Sede')
  check('ministrante do batismo veio pelo join', pRico?.batismo?.ministerName === esposa.fullName, pRico?.batismo?.ministerName)

  // batismo só no cadastro (sem registro na tabela) ainda precisa aparecer
  const soData = await novoMembro('[E2E] Perfil Só Data de Batismo', { baptismDate: new Date('2015-06-07') })
  const pSoData = await getMembroPerfil(soData.id)
  check('batismo só no cadastro (members.baptism_date) também aparece', pSoData?.batismo?.date === '2015-06-07', String(pSoData?.batismo?.date))
  check('e nesse caso vem sem local/ministrante', pSoData?.batismo?.location === null && pSoData?.batismo?.ministerName === null)
  check('só o batismo já liga o bloco eclesiástico', pSoData?.temVidaEclesiastica === true)

  // ── 6. o que não pode aparecer ──────────────────────────────────────────
  step(6, 'GF inativo, GF excluído e membro excluído')

  await prisma.cellGroup.update({ where: { id: gf.id }, data: { status: 'inactive' } })
  const pGfInativo = await getMembroPerfil(lider.id)
  check('GF inativo some do perfil do líder', pGfInativo?.gf === null)
  const pGfInativoPart = await getMembroPerfil(participante.id)
  check('GF inativo some do perfil do participante', pGfInativoPart?.gf === null)
  await prisma.cellGroup.update({ where: { id: gf.id }, data: { status: 'active' } })

  await prisma.cellGroup.update({ where: { id: gf.id }, data: { deletedAt: new Date() } })
  const pGfApagado = await getMembroPerfil(lider.id)
  check('GF excluído (soft delete) também some', pGfApagado?.gf === null)
  await prisma.cellGroup.update({ where: { id: gf.id }, data: { deletedAt: null } })

  await prisma.member.update({ where: { id: soData.id }, data: { deletedAt: new Date() } })
  const pApagado = await getMembroPerfil(soData.id)
  check('membro excluído não devolve perfil (rota responde 404)', pApagado === null)
  await prisma.member.update({ where: { id: soData.id }, data: { deletedAt: null } })

  check('id inexistente não devolve perfil', (await getMembroPerfil('00000000-0000-0000-0000-000000000000')) === null)

  // ── 7. os ícones de "Meus dados" ────────────────────────────────────────
  step(7, 'Família, presenças, inscrições e dízimos — o que abre nos ícones')

  // filho COM ficha de membro e filho SEM ficha (criança pequena)
  const filhoMembro = await novoMembro('[E2E] Perfil Filho Membro', {
    birthDate: new Date('2012-04-20'), photoUrl: 'https://example.com/filho.jpg',
  })
  await prisma.memberFamilyRelationship.create({
    data: { memberId: lider.id, relatedMemberId: filhoMembro.id, relationshipType: 'FILHO' },
  })
  await prisma.memberFamilyRelationship.create({
    data: {
      memberId: lider.id, relationshipType: 'FILHO',
      relatedName: '[E2E] Filha Pequena', relatedBirthDate: new Date('2021-09-05'), relatedGender: 'FEMININO',
    },
  })
  // o cônjuge entra na lista da família (com o parentesco certo)
  await prisma.memberFamilyRelationship.create({
    data: { memberId: lider.id, relationshipType: 'CONJUGE', relatedMemberId: esposa.id },
  })

  const evento = await prisma.event.create({
    data: {
      churchId: sede.id, title: '[E2E] Culto de Perfil',
      startDatetime: new Date('2025-11-02T19:00:00Z'), endDatetime: new Date('2025-11-02T21:00:00Z'),
      locationName: 'Templo Sede', requiresRegistration: true, isPaid: true, ticketPrice: '50.00',
    },
  })
  criado.eventIds.push(evento.id)

  await prisma.eventAttendance.create({
    data: { eventId: evento.id, memberId: lider.id, present: true, checkinDatetime: new Date('2025-11-02T18:45:00Z'), checkinMethod: 'qrcode' },
  })
  await prisma.eventRegistration.create({
    data: {
      eventId: evento.id, memberId: lider.id, fullName: lider.fullName,
      status: 'confirmed', paymentStatus: 'paid', paymentAmount: '50.00', checkedIn: true,
      registrationDate: new Date('2025-10-01T10:00:00Z'),
    },
  })

  // o leitor facial grava o ROL, não o member_id
  const rolLider = (await prisma.member.findUnique({ where: { id: lider.id }, select: { rol: true } }))?.rol
  criado.rolsLeitor.push(rolLider)
  await prisma.facePresenca.createMany({
    data: [
      { rol: rolLider, nome: '[E2E] Presenca Antiga', horario: new Date('2025-10-05T19:10:00Z'), camera: 'Entrada Principal' },
      { rol: rolLider, nome: '[E2E] Presenca Recente', horario: new Date('2025-12-07T19:05:00Z'), camera: 'Entrada Principal' },
    ],
  })

  const at = await getMembroAtividades(lider.id)
  check('atividades foram montadas', !!at)
  check('o núcleo familiar inteiro entra (2 filhos + cônjuge)', at?.familia.length === 3, String(at?.familia.length))
  check('cada parentesco vem com o rótulo da tela',
    at?.familia.find((f) => f.tipo === 'CONJUGE')?.parentesco === 'Cônjuge' &&
    at?.familia.find((f) => f.tipo === 'FILHO')?.parentesco === 'Filho(a)')
  const filhoComFicha = at?.familia.find((f) => f.ehMembro && f.tipo === 'FILHO')
  check('filho que é membro veio com o nome do cadastro', filhoComFicha?.name === filhoMembro.fullName, filhoComFicha?.name)
  check('e com a foto e o ROL dele', filhoComFicha?.photoUrl === 'https://example.com/filho.jpg' && typeof filhoComFicha?.rol === 'number')
  const filhaSemFicha = at?.familia.find((f) => !f.ehMembro)
  check('criança sem ficha vem pelo related_name', filhaSemFicha?.name === '[E2E] Filha Pequena', filhaSemFicha?.name)
  check('idade é calculada a partir do nascimento', filhaSemFicha?.idade !== null && filhaSemFicha?.idade >= 3, String(filhaSemFicha?.idade))

  check('atividades trazem só a CONTAGEM de presenças (a lista é paginada à parte)',
    at?.presencas === undefined && at?.totais.presencas === 3, String(at?.totais.presencas))

  check('inscrição no evento aparece', at?.inscricoes.length === 1, String(at?.inscricoes.length))
  check('com título, status e pagamento', at?.inscricoes[0]?.titulo === '[E2E] Culto de Perfil' && at?.inscricoes[0]?.status === 'confirmed' && at?.inscricoes[0]?.pagamento === 'paid')
  check('valor vem como número (Decimal quebraria o JSON)', at?.inscricoes[0]?.valor === 50, String(at?.inscricoes[0]?.valor))
  check('check-in do evento vem marcado', at?.inscricoes[0]?.compareceu === true)
  check('totais batem com as listas (são os selinhos dos ícones)',
    at?.totais.familia === at?.familia.length && at?.totais.inscricoes === at?.inscricoes.length)

  // ── dízimos e ofertas: o cadastro da sede do campo ──
  const hqDoCampo = sede.regional?.campoId
    ? await prisma.legacyChurchHeadquarters.findFirst({ where: { fieldId: sede.regional.campoId } })
    : null
  if (hqDoCampo) {
    check('dados de dízimos vieram da sede do campo', !!at?.doacao)
    check('o nome da igreja da doação bate com a headquarters do campo',
      at?.doacao?.churchName === hqDoCampo.churchName, at?.doacao?.churchName ?? '(sem nome)')
    console.log(`     · PIX cadastrado: ${at?.doacao?.pix ? 'sim' : 'não (a tela avisa para procurar a secretaria)'}`)
  } else {
    check('sem headquarters no campo, a doação vem null em vez de quebrar', at?.doacao === null || !!at?.doacao)
    console.log('     · este campo não tem cadastro de headquarters — nada a conferir')
  }

  const vazio = await getMembroAtividades(participante.id)
  check('quem não tem nada recebe listas vazias, não erro', vazio?.familia.length === 0 && vazio?.inscricoes.length === 0)
  check('e os selinhos ficam zerados (o ícone não mostra badge)', vazio?.totais.familia === 0 && vazio?.totais.inscricoes === 0)
  check('membro excluído não devolve atividades (rota responde 404)', (await getMembroAtividades('00000000-0000-0000-0000-000000000000')) === null)

  // ── 8. presenças: período e paginação ──────────────────────────────────
  step(8, 'Presenças — filtro de período e paginação (a lista cresce sem parar)')

  // mais presenças no mesmo dia, para a página encher
  await prisma.facePresenca.createMany({
    data: Array.from({ length: 6 }).map((_, i) => ({
      rol: rolLider,
      nome: '[E2E] Presenca Lote',
      horario: new Date(`2025-12-1${i} 19:0${i}:00Z`),
      camera: 'Entrada Lateral',
    })),
  })

  const tudo = await getMembroPresencas(lider.id, { inicio: '2025-01-01', fim: '2025-12-31', pagina: 1, porPagina: 5 })
  check('a página respeita o tamanho pedido', tudo?.itens.length === 5, String(tudo?.itens.length))
  check('o total é o do período inteiro, não o da página', tudo?.total === 9, String(tudo?.total))
  check('avisa que há mais páginas', tudo?.temMais === true)
  check('a mais recente vem primeiro', tudo?.itens[0]?.data.startsWith('2025-12-1'), tudo?.itens[0]?.data)

  const pag2 = await getMembroPresencas(lider.id, { inicio: '2025-01-01', fim: '2025-12-31', pagina: 2, porPagina: 5 })
  check('a segunda página traz o resto', pag2?.itens.length === 4, String(pag2?.itens.length))
  check('e avisa que acabou', pag2?.temMais === false)
  const idsPag1 = new Set(tudo?.itens.map((i) => i.id))
  check('nenhum item se repete entre as páginas', pag2?.itens.every((i) => !idsPag1.has(i.id)))

  const dezembro = await getMembroPresencas(lider.id, { inicio: '2025-12-01', fim: '2025-12-31' })
  check('filtro de mês corta o que é de fora', dezembro?.total === 7, String(dezembro?.total))
  check('as duas origens continuam juntas no período', dezembro?.itens.every((i) => i.data.startsWith('2025-12')))

  const outubro = await getMembroPresencas(lider.id, { inicio: '2025-10-01', fim: '2025-10-31' })
  check('mês só com presença do leitor traz só ela', outubro?.total === 1 && outubro?.itens[0]?.origem === 'leitor', String(outubro?.total))

  const novembro = await getMembroPresencas(lider.id, { inicio: '2025-11-01', fim: '2025-11-30' })
  check('o dia final entra no intervalo (check-in do dia 2 às 18:45)', novembro?.total === 1, String(novembro?.total))
  check('e é a presença do evento', novembro?.itens[0]?.origem === 'evento' && novembro?.itens[0]?.titulo === '[E2E] Culto de Perfil')

  const vazioPeriodo = await getMembroPresencas(lider.id, { inicio: '2024-01-01', fim: '2024-01-31' })
  check('período sem nada devolve lista vazia, não erro', vazioPeriodo?.total === 0 && vazioPeriodo?.itens.length === 0)
  check('membro inexistente não devolve página', (await getMembroPresencas('00000000-0000-0000-0000-000000000000')) === null)

  // ── 9. o token da rota ──────────────────────────────────────────────────
  step(9, 'member_token — o perfil vem do `sub` assinado, nunca da query')

  const token = signToken({ sub: lider.id, name: lider.fullName }, 7 * 24 * 60 * 60)
  const payload = verifyToken(token)
  check('token de 7 dias abre e traz o id do membro', payload?.sub === lider.id)
  const pPorToken = await getMembroPerfil(payload.sub)
  check('o perfil carregado pelo token é o do dono do token', pPorToken?.member.id === lider.id)
  check('token adulterado é recusado (rota responde 401)', verifyToken(token.slice(0, -2) + 'xy') === null)
  check('token expirado é recusado', verifyToken(signToken({ sub: lider.id }, -10)) === null)
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
