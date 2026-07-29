/**
 * Simulação ponta a ponta de Hospedeira, Zona e igrejas anexas.
 *
 * Percorre o caminho real: marcar a igreja central como hospedeira → anexar
 * filhas → reconciliar a seleção → tentar os vínculos proibidos → desmarcar a
 * hospedeira → filtros da listagem e dados do relatório.
 *
 * Roda contra o banco de verdade, mas cria as próprias igrejas com prefixo
 * [E2E] — nenhum registro real é tocado. Tudo é apagado no fim (--keep preserva).
 *
 * Uso: npx tsx scripts/e2e-hospedeira.mjs
 */

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

import { PrismaClient } from '@prisma/client'

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

const TX = { timeout: 20000, maxWait: 10000 }
const criado = { ids: [] }

async function limpar() {
  console.log('\n🧹 limpando os dados do teste...')
  if (criado.ids.length) {
    const lista = criado.ids.map((id) => `'${id}'::uuid`).join(',')
    // solta os vínculos antes de apagar, senão a FK impede a remoção da hospedeira
    await exec(`UPDATE churches SET host_church_id = NULL WHERE id IN (${lista})`).catch(() => {})
    await exec(`DELETE FROM churches WHERE id IN (${lista})`).catch(() => {})
  }
  console.log('   pronto — banco no estado anterior.')
}

/**
 * Reproduz a rota PUT /churches/[id]/hosted: recebe a lista COMPLETA de anexas
 * e reconcilia — quem saiu perde o vínculo, quem entrou passa a apontar para cá.
 */
async function definirAnexas(hostId, churchIds) {
  return prisma.$transaction(async (tx) => {
    const conflito = churchIds.length
      ? await tx.church.findFirst({ where: { id: { in: churchIds }, deletedAt: null, isHost: true }, select: { name: true } })
      : null
    if (conflito) throw new Error(`"${conflito.name}" é hospedeira e não pode ser anexada`)

    if (churchIds.length) await tx.church.update({ where: { id: hostId }, data: { isHost: true, hostChurchId: null } })
    await tx.church.updateMany({
      where: { hostChurchId: hostId, id: { notIn: churchIds.length ? churchIds : ['00000000-0000-0000-0000-000000000000'] } },
      data: { hostChurchId: null },
    })
    if (churchIds.length) await tx.church.updateMany({ where: { id: { in: churchIds }, deletedAt: null }, data: { hostChurchId: hostId } })
    return tx.church.findMany({ where: { hostChurchId: hostId, deletedAt: null }, select: { id: true, name: true, zone: true }, orderBy: [{ zone: 'asc' }, { name: 'asc' }] })
  }, TX)
}

/** Executa e devolve o erro do banco, se houver — para testar as regras que devem BLOQUEAR. */
async function tentar(fn) {
  try { await fn(); return null } catch (e) { return e }
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗')
  console.log('║  E2E — Hospedeira, Zona e igrejas anexas                       ║')
  console.log('╚═══════════════════════════════════════════════════════════════╝')

  step(0, 'Ambiente')
  const [regional] = await sql(`SELECT id, name FROM regionais WHERE deleted_at IS NULL ORDER BY name LIMIT 1`)
  check('regional encontrada', !!regional, regional?.name)
  if (!regional) throw new Error('sem regional')

  const stamp = Date.now().toString().slice(-6)
  let seq = 0
  const novaIgreja = async (nome, zone) => {
    // `code` é único por regional — o contador evita colisão entre "Filha Um",
    // "Filha Dois" e "Filha Tres", que truncados dariam o mesmo sufixo.
    seq += 1
    const c = await prisma.church.create({
      data: { regionalId: regional.id, name: `[E2E] ${nome}`, code: `E2E-H${stamp}-${seq}`, zone },
      select: { id: true, name: true, zone: true },
    })
    criado.ids.push(c.id)
    return c
  }
  const host = await novaIgreja('Central Hospedeira', 'Zona Leste')
  const f1 = await novaIgreja('Filha Um', 'Zona Leste')
  const f2 = await novaIgreja('Filha Dois', 'Zona Sul')
  const f3 = await novaIgreja('Filha Tres', 'Zona Leste')
  const outra = await novaIgreja('Outra Hospedeira', 'Zona Oeste')
  check('5 igrejas de teste criadas', criado.ids.length === 5)
  check('zona gravada no cadastro', host.zone === 'Zona Leste' && f2.zone === 'Zona Sul')

  // ── 1. marcar hospedeira e anexar ──
  step(1, 'Marcando como hospedeira e anexando filhas')
  let anexas = await definirAnexas(host.id, [f1.id, f2.id])
  check('duas filhas anexadas', anexas.length === 2, anexas.map((a) => a.name).join(', '))
  const hostDepois = await prisma.church.findUnique({ where: { id: host.id }, select: { isHost: true, hostChurchId: true } })
  check('igreja virou hospedeira', hostDepois.isHost === true)
  check('hospedeira não fica anexada a ninguém', hostDepois.hostChurchId === null)
  const f1Depois = await prisma.church.findUnique({ where: { id: f1.id }, select: { hostChurchId: true, isHost: true } })
  check('filha aponta para a hospedeira', f1Depois.hostChurchId === host.id)
  check('filha não é marcada como hospedeira', f1Depois.isHost === false)

  // ── 2. reconciliação ──
  step(2, 'Reenviando a lista: quem saiu perde o vínculo, quem entrou ganha')
  anexas = await definirAnexas(host.id, [f2.id, f3.id])
  const ids = anexas.map((a) => a.id).sort()
  check('conjunto trocado corretamente', ids.length === 2 && ids.includes(f2.id) && ids.includes(f3.id))
  const f1Solta = await prisma.church.findUnique({ where: { id: f1.id }, select: { hostChurchId: true } })
  check('filha removida ficou sem vínculo', f1Solta.hostChurchId === null)

  // ── 3. regras que devem bloquear ──
  step(3, 'As regras proibidas são mesmo bloqueadas?')
  await prisma.church.update({ where: { id: outra.id }, data: { isHost: true } })
  let erro = await tentar(() => definirAnexas(host.id, [f2.id, outra.id]))
  check('anexar uma hospedeira é recusado', !!erro, erro?.message?.slice(0, 60))

  erro = await tentar(() => exec(`UPDATE churches SET is_host = true, host_church_id = '${host.id}'::uuid WHERE id = '${f2.id}'::uuid`))
  const nomeCheck = (e) => (e?.message?.match(/violates check constraint "([^"]+)"/) || [])[1]
  check('banco impede hospedeira anexada', nomeCheck(erro) === 'churches_host_not_hosted_check', nomeCheck(erro))

  erro = await tentar(() => exec(`UPDATE churches SET host_church_id = id WHERE id = '${f3.id}'::uuid`))
  check('banco impede auto-hospedagem', nomeCheck(erro) === 'churches_host_not_self_check', nomeCheck(erro))

  erro = await tentar(() => exec(`UPDATE churches SET host_church_id = '00000000-0000-0000-0000-000000000999'::uuid WHERE id = '${f3.id}'::uuid`))
  check('banco impede hospedeira inexistente', !!erro)

  const aindaAnexas = await prisma.church.count({ where: { hostChurchId: host.id } })
  check('vínculos válidos sobreviveram às tentativas', aindaAnexas === 2, `${aindaAnexas}`)

  // ── 4. filtros da listagem ──
  step(4, 'Os filtros da listagem separam hospedeiras, anexas e zonas?')
  const soHospedeiras = await prisma.church.count({ where: { isHost: true, id: { in: criado.ids } } })
  check('filtro "somente hospedeiras"', soHospedeiras === 2, `${soHospedeiras} (central + outra)`)
  const soAnexas = await prisma.church.count({ where: { hostChurchId: { not: null }, id: { in: criado.ids } } })
  check('filtro "somente anexas"', soAnexas === 2, `${soAnexas}`)
  const semVinculo = await prisma.church.count({ where: { isHost: false, hostChurchId: null, id: { in: criado.ids } } })
  check('filtro "sem vínculo"', semVinculo === 1, `${semVinculo} (a filha desanexada)`)
  const zonaLeste = await prisma.church.count({ where: { zone: 'Zona Leste', id: { in: criado.ids } } })
  check('filtro por zona', zonaLeste === 3, `${zonaLeste} na Zona Leste`)

  // ── 5. relatório da hospedeira ──
  step(5, 'O relatório encontra a hospedeira e as filhas agrupadas por zona?')
  const relatorio = await prisma.church.findUnique({
    where: { id: host.id },
    select: {
      name: true, code: true, zone: true, isHost: true,
      regional: { select: { name: true } },
      hostedChurches: { select: { name: true, code: true, zone: true, currentLeaderName: true, addressCity: true }, orderBy: [{ zone: 'asc' }, { name: 'asc' }] },
    },
  })
  check('cabeçalho traz a hospedeira', relatorio.isHost && !!relatorio.name, relatorio.name)
  check('cabeçalho traz zona e regional', !!relatorio.zone && !!relatorio.regional?.name, `${relatorio.zone} · ${relatorio.regional.name}`)
  check('corpo lista as filhas', relatorio.hostedChurches.length === 2, `${relatorio.hostedChurches.length}`)
  const zonas = [...new Set(relatorio.hostedChurches.map((c) => c.zone))]
  check('filhas trazem zona para o agrupamento', zonas.every(Boolean), zonas.join(' / '))

  // ── 5b. cadastro de zonas ──
  step('5b', 'O cadastro de Zonas alimenta o dropdown e respeita as regras?')
  const semeadas = await sql(`SELECT name, display_order, is_active FROM zonas WHERE deleted_at IS NULL ORDER BY display_order NULLS LAST, name`)
  check('tabela de zonas existe e está semeada', semeadas.length >= 7, `${semeadas.length} zona(s)`)
  check('as zonas usadas no teste estão no cadastro', ['Zona Leste', 'Zona Sul', 'Zona Oeste'].every((z) => semeadas.some((r) => r.name === z)))
  check('ordem de exibição definida', semeadas.every((r) => r.display_order !== null))

  const dupErro = await tentar(() => exec(`INSERT INTO zonas (name) VALUES ('zona leste')`))
  check('nome duplicado é recusado (case-insensitive)', !!dupErro, 'zonas_name_unique')

  const nova = await sql(`INSERT INTO zonas (name, display_order) VALUES ('[E2E] Zona Teste', 99) RETURNING id, name`)
  const zonaId = nova[0].id
  await exec(`UPDATE zonas SET is_active = false WHERE id = '${zonaId}'::uuid`)
  const ativas = await sql(`SELECT name FROM zonas WHERE deleted_at IS NULL AND is_active = true`)
  check('zona desativada sai da lista de ativas', !ativas.some((r) => r.name === '[E2E] Zona Teste'))

  await exec(`UPDATE zonas SET deleted_at = now() WHERE id = '${zonaId}'::uuid`)
  const viva = await sql(`SELECT id FROM zonas WHERE id = '${zonaId}'::uuid AND deleted_at IS NULL`)
  check('exclusão é lógica (soft delete)', viva.length === 0)
  await exec(`DELETE FROM zonas WHERE id = '${zonaId}'::uuid`)

  const igrejaComZona = await prisma.church.findUnique({ where: { id: f2.id }, select: { zone: true } })
  check('igreja guarda o NOME da zona, não um id', igrejaComZona.zone === 'Zona Sul', igrejaComZona.zone)

  // ── 6. desmarcar hospedeira ──
  step(6, 'Desmarcar a hospedeira solta as filhas?')
  await prisma.$transaction(async (tx) => {
    await tx.church.update({ where: { id: host.id }, data: { isHost: false } })
    await tx.church.updateMany({ where: { hostChurchId: host.id }, data: { hostChurchId: null } })
  }, TX)
  const sobraram = await prisma.church.count({ where: { hostChurchId: host.id } })
  check('nenhuma filha aponta para ex-hospedeira', sobraram === 0)
  const hostFinal = await prisma.church.findUnique({ where: { id: host.id }, select: { isHost: true } })
  check('igreja deixou de ser hospedeira', hostFinal.isHost === false)

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
    await prisma.$disconnect()
    process.exit(failed ? 1 : 0)
  })
