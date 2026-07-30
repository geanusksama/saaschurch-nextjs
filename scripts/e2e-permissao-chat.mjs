/**
 * Simulação ponta a ponta do controle do Chat Interno na matriz de permissões.
 *
 * Percorre o caminho real do admin: cria uma FUNÇÃO e um usuário de igreja com
 * sobrescritas salvas (o cenário da Aline — role + 24 sobrescritas), grava as
 * permissões no banco pelo mesmo campo que a tela de Permissões do Usuário usa
 * (users.permissions), lê de volta e resolve o acesso com o resolvedor de
 * produção para responder: o ícone do chat aparece? dá pra bloquear? quem pode
 * excluir mensagem de outro?
 *
 * Importa resolvePermission.ts e permissionCatalog.ts de verdade — o teste roda
 * em cima do código de produção, não de uma cópia da regra.
 *
 * Também cobre a regressão que motivou a chave: uma role antiga não conhece
 * chaves novas, e a whitelist da role negaria o chat para quem já o tinha.
 * E documenta o caso das abas da Gestão Pastoral (whatsapp_campaigns), que é
 * exatamente o que a whitelist bloqueia hoje.
 *
 * Roda contra o banco de verdade, mas cria a própria função e o próprio usuário
 * com prefixo [E2E], sem vínculo com igreja nenhuma — nenhum registro real é
 * tocado. Tudo é apagado no fim (--keep preserva).
 *
 * Uso: npx tsx scripts/e2e-permissao-chat.mjs
 */

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

import { PrismaClient } from '@prisma/client'
import { resolvePermission } from '../src/lib/resolvePermission.ts'
import {
  DEFAULT_PERMISSION_MODULES,
  OPT_OUT_PERMISSION_KEYS,
  mergeModules,
} from '../src/app-ui/system/permissionCatalog.ts'

const prisma = new PrismaClient()
const KEEP = process.argv.includes('--keep')

let passed = 0, failed = 0
const falhas = []
function check(label, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`) }
  else { failed++; falhas.push(label); console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`) }
}
const step = (n, t) => console.log(`\n${'─'.repeat(70)}\n${n}. ${t}\n${'─'.repeat(70)}`)

const criado = { roleId: null, userId: null }

async function limpar() {
  console.log('\n🧹 limpando os dados do teste...')
  if (criado.userId) await prisma.user.delete({ where: { id: criado.userId } }).catch(() => {})
  if (criado.roleId) await prisma.role.delete({ where: { id: criado.roleId } }).catch(() => {})
  console.log('   pronto — banco no estado anterior.')
}

/**
 * O que a tela realmente pergunta: "esse usuário vê/usa o chat?".
 * Sempre com a matriz mesclada (mergeModules) e o usuário lido do banco, igual
 * ao usePermissions em runtime.
 */
function podeNoChat(modules, usuario, action) {
  return resolvePermission({
    key: 'internal_chat',
    action,
    profileType: usuario.profileType,
    modules,
    userOverrides: usuario.permissions || {},
    userRoleId: usuario.roleId,
  })
}

async function main() {
  console.log('\n🔐 E2E — Chat Interno no controle de permissões\n')

  // ── 1. A chave existe no catálogo (é o que faz a linha aparecer na matriz) ──
  step(1, 'A linha "Chat Interno" existe na matriz?')
  const modules = mergeModules(null)
  const chat = modules.find((m) => m.key === 'internal_chat')
  check('chave internal_chat está no catálogo', !!chat)
  check('fica no grupo Principal', chat?.group === 'Principal', chat?.group)
  check('rótulo é "Chat Interno"', chat?.name === 'Chat Interno', chat?.name)
  check('view liberado por padrão para igreja', chat?.permissions.view.church === true)
  check('create liberado por padrão para igreja', chat?.permissions.create.church === true)
  check('delete de mensagem alheia só para master', chat?.permissions.delete.church === false && chat?.permissions.delete.master === true)
  check('é chave opt-out', OPT_OUT_PERMISSION_KEYS.has('internal_chat'))

  // ── 2. Matriz antiga salva no banco não some com a linha nova ──
  step(2, 'Uma matriz salva ANTES da chave existir continua mostrando o chat?')
  const matrizAntiga = DEFAULT_PERMISSION_MODULES.filter((m) => m.key !== 'internal_chat')
  const mescladaAntiga = mergeModules(matrizAntiga)
  check('mergeModules recoloca a linha', mescladaAntiga.some((m) => m.key === 'internal_chat'))
  check('nenhuma linha antiga foi perdida', mescladaAntiga.length === DEFAULT_PERMISSION_MODULES.length,
    `${mescladaAntiga.length} linhas`)

  // ── 3. Função e usuário de verdade no banco ──
  // O banco de produção só responde por IPv6; quando não há rota, o teste segue
  // em memória com o MESMO objeto de usuário e avisa no relatório. O que está
  // sendo verificado (a decisão de acesso) é 100% client-side — o banco entra só
  // para provar que users.permissions faz a ida e volta.
  step(3, 'Criando função + usuário de igreja no banco')

  // Sobrescritas como a tela grava: só o grupo Gestão Pastoral em verde.
  // Nada de internal_chat, nada de whatsapp_campaigns — igual ao caso real.
  const sobrescritasDoAdmin = {}
  for (const m of DEFAULT_PERMISSION_MODULES.filter((x) => x.group === 'Gestão Pastoral')) {
    for (const a of ['view', 'create', 'edit', 'delete']) sobrescritasDoAdmin[`${m.key}.${a}`] = true
  }

  let comBanco = true
  let usuario = null
  try {
    const funcao = await prisma.role.create({
      data: { name: `[E2E] Secretaria Chat ${Date.now()}`, description: 'função de teste' },
    })
    criado.roleId = funcao.id
    check('função criada', !!funcao.id, funcao.id)

    usuario = await prisma.user.create({
      data: {
        email: `e2e-perm-chat-${Date.now()}@exemplo.test`,
        fullName: '[E2E] Usuária de Igreja',
        profileType: 'church',
        roleId: funcao.id,
        permissions: sobrescritasDoAdmin,
      },
    })
    criado.userId = usuario.id
    check('usuário criado com função + sobrescritas', !!usuario.id,
      `${Object.keys(sobrescritasDoAdmin).length} sobrescritas`)
  } catch (e) {
    comBanco = false
    usuario = {
      id: 'e2e-em-memoria',
      profileType: 'church',
      roleId: 'e2e-role-em-memoria',
      permissions: sobrescritasDoAdmin,
    }
    const motivo = String(e.message).split('\n').map((l) => l.trim()).find(Boolean) || e.name
    console.log(`  ⚠️  banco inacessível — ${motivo}`)
    console.log('     seguindo em memória — as verificações de decisão de acesso valem igual,')
    console.log('     só a ida e volta em users.permissions não foi exercitada.')
  }

  /** Grava as sobrescritas como a tela de Permissões do Usuário grava. */
  const salvarPermissoes = async (permissions) => {
    if (!comBanco) return { ...usuario, permissions }
    return prisma.user.update({ where: { id: usuario.id }, data: { permissions } })
  }
  const recarregar = async () =>
    comBanco ? prisma.user.findUnique({ where: { id: usuario.id } }) : usuario

  // ── 4. O cenário das imagens: role como whitelist ──
  step(4, 'Com função atribuída e só Gestão Pastoral em verde, o que acontece?')
  const salvo = await recarregar()
  check(comBanco ? 'permissões voltaram do banco' : 'permissões em memória montadas',
    Object.keys(salvo.permissions || {}).length > 0,
    `${Object.keys(salvo.permissions).length} chaves`)

  check('ícone do chat APARECE (opt-out escapa da whitelist)', podeNoChat(modules, salvo, 'view') === true)
  check('pode enviar mensagem', podeNoChat(modules, salvo, 'create') === true)
  check('NÃO pode excluir mensagem de outro', podeNoChat(modules, salvo, 'delete') === false)

  // a mesma whitelist que NÃO afeta o chat é a que derruba as abas do Pastoral
  const abasPastoral = resolvePermission({
    key: 'whatsapp_campaigns', action: 'view', profileType: salvo.profileType,
    modules, userOverrides: salvo.permissions, userRoleId: salvo.roleId,
  })
  check('abas do Pastoral seguem bloqueadas (whatsapp_campaigns não concedido)', abasPastoral === false)

  // ── 5. Bloquear o chat na mão continua funcionando ──
  step(5, 'O admin marca "Ver Chat Interno" em vermelho — o ícone some?')
  const bloqueado = await salvarPermissoes({ ...salvo.permissions, 'internal_chat.view': false })
  check('ícone do chat DESAPARECE', podeNoChat(modules, bloqueado, 'view') === false)
  check('sobrescrita explícita vence o padrão do perfil', bloqueado.permissions['internal_chat.view'] === false)

  step(6, 'E se o admin liberar só o envio, mantendo o ícone escondido?')
  const misto = await salvarPermissoes({ ...bloqueado.permissions, 'internal_chat.delete': true })
  check('excluir mensagem de outro liberado por sobrescrita', podeNoChat(modules, misto, 'delete') === true)
  check('view continua bloqueado', podeNoChat(modules, misto, 'view') === false)

  // ── 7. Usuário sem função (a maioria) ──
  step(7, 'Usuário SEM função cai no padrão do perfil?')
  const semFuncao = comBanco
    ? await prisma.user.update({ where: { id: usuario.id }, data: { roleId: null, permissions: {} } })
    : { ...usuario, roleId: null, permissions: {} }
  check('ícone aparece para igreja', podeNoChat(modules, semFuncao, 'view') === true)
  check('excluir mensagem de outro negado para igreja', podeNoChat(modules, semFuncao, 'delete') === false)

  const comoMaster = { ...semFuncao, profileType: 'master' }
  check('master pode excluir mensagem de outro (comportamento antigo mantido)',
    podeNoChat(modules, comoMaster, 'delete') === true)

  // ── 8. Chave fora do catálogo (o caso settings_zonas) ──
  step(8, 'Chave que não está no catálogo — como o resolvedor responde?')
  const foraDoCatalogo = resolvePermission({
    key: 'settings_zonas', action: 'view', profileType: 'church',
    modules, userOverrides: {}, userRoleId: null,
  })
  check('sem função: liberada para todos (incontrolável — bug conhecido)', foraDoCatalogo === true)
  const foraComRole = resolvePermission({
    key: 'settings_zonas', action: 'view', profileType: 'church',
    modules, userOverrides: { 'members.view': true }, userRoleId: 'qualquer-role',
  })
  check('com função: negada e sem como conceder (bug conhecido)', foraComRole === false)

  console.log(`\n${'═'.repeat(70)}`)
  if (!comBanco) console.log('⚠️  banco inacessível: ida e volta em users.permissions NÃO exercitada.')
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
