# WhatsApp Oficial (Meta) — Etapa 1: Base — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada campo conecta o próprio número oficial do WhatsApp (Meta Cloud API) por um botão "Conectar com a Meta" e vê o status do número (qualidade, limite diário), com a Política de Privacidade pública que a Meta exige.

**Architecture:** Módulo novo em `src/lib/meta/` (lógica pura, testável com `node --test`) + rotas em `src/app/api/meta/whatsapp/` + tela em `src/app-ui/system/WhatsAppOficial.tsx`. Uma conexão por campo na tabela nova `meta_whatsapp_conexoes`, token cifrado. Webhook por igreja via `override_callback_uri` na conta WhatsApp. Nada é compartilhado com o módulo Z-API.

**Tech Stack:** Next.js 16 (App Router + SPA react-router), Prisma 6 / Postgres (Supabase), Node 24 (`node --test` com strip de tipos), SDK JS da Meta (Embedded Signup v4), Graph API.

**Spec:** `docs/superpowers/specs/2026-11-23-whatsapp-oficial-meta-design.md`

## Global Constraints

- Módulo Z-API intocado: nenhum arquivo `src/lib/whatsapp*.ts`, `src/lib/zapi*.ts`, `src/app/api/whatsapp/**` ou tabela `whatsapp_*` é alterado.
- Uma conexão Meta **por campo**; tudo filtrado por `campoAtivoId(user)` (`src/lib/campoAtivo.ts`), master inclusive.
- Variáveis de ambiente (iguais em todas as igrejas): `META_APP_ID`, `META_APP_SECRET`, `META_ES_CONFIG_ID`, `META_WEBHOOK_VERIFY_TOKEN`, `META_TOKEN_ENCRYPTION_KEY` (64 hex), `META_GRAPH_VERSION` (ex.: `v27.0`).
- Embedded Signup **v4** (v2/v3 depreciados em 15/10/2026).
- AGENTS.md regra nº 1: tabela nova ⇒ migration + `migrate resolve --applied` + regerar baseline (`../painelchurch`) + copiar para `baseline/` + commit nos dois repos.
- AGENTS.md regra nº 2: módulo no `permissionCatalog.ts`, `permKey` no menu, `<Permissao>` em cada botão de ação, `exigirPermissao` na rota com a mesma chave, `npm run permissoes:arvore`.
- `.env` local aponta para PRODUÇÃO: **pedir confirmação ao dono antes de aplicar qualquer DDL**.
- `next dev` rodando: cada `.tsx` alterado numa gravação só; um processo pesado por vez (tsc com heap limitado).
- Visual segue `docs/architecture/GUIA-ESTILO-SILAS.md`.
- Antes de commitar: lint dos arquivos tocados igual ou melhor que antes, checagem de tipos dos arquivos tocados, testes da etapa passando, skill `code-review` na versão final.

## Review Focus

- Chave `META_TOKEN_ENCRYPTION_KEY` ausente/errada ou token cifrado corrompido → rota responde erro claro ("configuração da Meta incompleta" / "reconecte o número"), nunca 500 genérico nem vazamento do token. (Testes nas Tasks 1 e 4.)
- Webhook POST sem `X-Hub-Signature-256` ou com assinatura errada → 401 e nada é processado. (Teste na Task 1 e e2e na Task 4.)
- Usuário sem campo ativo (master sem campo) tenta conectar/ver status → 400 "Selecione um campo", sem gravar. (e2e na Task 4.)
- Número (`phone_number_id`) já conectado a outro campo do mesmo banco → 409, sem sobrescrever. (e2e na Task 4.)
- Token expirado/revogado (Graph erro `code 190`) ao buscar status → conexão marcada `erro` e tela pede para reconectar. (Teste na Task 2.)

---

### Task 1: Cifra, assinatura do webhook e verificação do desafio

**Files:**
- Create: `src/lib/meta/cifra.ts`
- Create: `src/lib/meta/webhookSeguranca.ts`
- Test: `scripts/teste-meta-whatsapp.mjs` (node:test; cresce nas Tasks 1 e 2)

**Interfaces:**
- Produces:
  - `cifrar(texto: string, chaveHex: string): string` e `decifrar(cifrado: string, chaveHex: string): string` — AES-256-GCM, formato `iv:tag:dados` em hex (mesmo esquema de `src/lib/stripeEncrypt.ts`, mas recebendo a chave). Chave fora de 64 hex ⇒ `throw new Error('META_TOKEN_ENCRYPTION_KEY inválida')`. Texto adulterado ⇒ lança.
  - `assinaturaValida(corpoBruto: string, cabecalho: string | null, appSecret: string): boolean` — compara `sha256=<hmac hex>` com `crypto.timingSafeEqual`; cabeçalho ausente ou tamanho diferente ⇒ `false`.
  - `respostaDesafio(params: URLSearchParams, verifyToken: string): string | null` — devolve `hub.challenge` se `hub.mode === 'subscribe'` e `hub.verify_token === verifyToken`; senão `null`.
- Os dois arquivos **não importam nada do projeto** (só `crypto`), para rodar em `node --test`.

- [ ] **Step 1: Write the failing tests** em `scripts/teste-meta-whatsapp.mjs`

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { cifrar, decifrar } from '../src/lib/meta/cifra.ts'
import { assinaturaValida, respostaDesafio } from '../src/lib/meta/webhookSeguranca.ts'

const CHAVE = 'a'.repeat(64)

test('cifra e decifra o token', () => {
  const c = cifrar('EAAG-token', CHAVE)
  assert.notEqual(c, 'EAAG-token')
  assert.equal(decifrar(c, CHAVE), 'EAAG-token')
})
test('chave inválida lança erro claro', () => {
  assert.throws(() => cifrar('x', 'curta'), /META_TOKEN_ENCRYPTION_KEY inválida/)
})
test('cifrado adulterado lança', () => {
  const c = cifrar('x', CHAVE); const p = c.split(':'); p[2] = '00' + p[2].slice(2)
  assert.throws(() => decifrar(p.join(':'), CHAVE))
})
test('assinatura do webhook', () => {
  const corpo = '{"a":1}'
  const sig = 'sha256=' + crypto.createHmac('sha256', 'segredo').update(corpo).digest('hex')
  assert.equal(assinaturaValida(corpo, sig, 'segredo'), true)
  assert.equal(assinaturaValida(corpo, sig, 'outro'), false)
  assert.equal(assinaturaValida(corpo, null, 'segredo'), false)
  assert.equal(assinaturaValida(corpo, 'sha256=abc', 'segredo'), false)
})
test('desafio de verificação', () => {
  const ok = new URLSearchParams({ 'hub.mode': 'subscribe', 'hub.verify_token': 'vt', 'hub.challenge': '123' })
  assert.equal(respostaDesafio(ok, 'vt'), '123')
  assert.equal(respostaDesafio(ok, 'errado'), null)
})
```

- [ ] **Step 2: Run** `node --test scripts/teste-meta-whatsapp.mjs` — Expected: FAIL (módulos não existem).
- [ ] **Step 3: Implement** `src/lib/meta/cifra.ts` e `src/lib/meta/webhookSeguranca.ts` com as assinaturas acima.
- [ ] **Step 4: Run** `node --test scripts/teste-meta-whatsapp.mjs` — Expected: 5 testes PASS.
- [ ] **Step 5: Commit** — `git add src/lib/meta scripts/teste-meta-whatsapp.mjs && git commit -m "WhatsApp oficial: cifra do token e segurança do webhook"`

---

### Task 2: Cliente da Graph API e operações de conexão

**Files:**
- Create: `src/lib/meta/graph.ts`
- Create: `src/lib/meta/conexaoMeta.ts`
- Test: `scripts/teste-meta-whatsapp.mjs` (acrescentar)

**Interfaces:**
- Consumes: nada de outras tasks.
- Produces:
  - `type FetchLike = (url: string, init?: RequestInit) => Promise<Response>`
  - `class ErroGraph extends Error { status: number; codigo: number | null; tokenInvalido: boolean }` — `tokenInvalido = codigo === 190`.
  - `criarGraph(opts: { versao: string; fetch?: FetchLike }): Graph` com `get(caminho, params, token)` e `post(caminho, corpo, token)`; base `https://graph.facebook.com/<versao>/`; resposta com `error` ⇒ lança `ErroGraph` (mensagem = `error.message`, `codigo` = `error.code`).
  - Em `conexaoMeta.ts` (recebem `graph: Graph` por parâmetro; `import type` apenas):
    - `trocarCodigo(graph, { appId, appSecret, code }): Promise<string>` — `GET oauth/access_token?client_id&client_secret&code` ⇒ `access_token`.
    - `registrarNumero(graph, token, phoneNumberId, pin: string): Promise<void>` — `POST <phoneNumberId>/register` `{ messaging_product: 'whatsapp', pin }`.
    - `assinarWebhookDaConta(graph, token, wabaId, { callbackUrl, verifyToken }): Promise<void>` — `POST <wabaId>/subscribed_apps` `{ override_callback_uri, verify_token }`.
    - `lerStatusNumero(graph, token, phoneNumberId): Promise<StatusNumero>` com `StatusNumero = { numero: string; nomeExibicao: string; qualidade: 'GREEN'|'YELLOW'|'RED'|'UNKNOWN'; status: string; limiteDiario: string | null }` — campos `display_phone_number, verified_name, quality_rating, status` e o limite. **Antes de implementar, confirmar na doc atual (versão do `META_GRAPH_VERSION`) em qual objeto fica `whatsapp_business_manager_messaging_limit`** e ajustar a chamada; valor desconhecido ⇒ `null`.
    - `gerarPin(): string` — 6 dígitos com `crypto.randomInt`.

- [ ] **Step 1: Write the failing tests** (fetch falso que grava URL/corpo e devolve JSON)

```js
import { criarGraph, ErroGraph } from '../src/lib/meta/graph.ts'
import { trocarCodigo, registrarNumero, assinarWebhookDaConta, lerStatusNumero, gerarPin } from '../src/lib/meta/conexaoMeta.ts'

function fetchFalso(respostas) {
  const chamadas = []
  const f = async (url, init) => { chamadas.push({ url, init }); const r = respostas.shift(); return new Response(JSON.stringify(r.body), { status: r.status ?? 200 }) }
  return { f, chamadas }
}

test('troca o código pelo token', async () => {
  const { f, chamadas } = fetchFalso([{ body: { access_token: 'TK' } }])
  const g = criarGraph({ versao: 'v27.0', fetch: f })
  assert.equal(await trocarCodigo(g, { appId: '1', appSecret: 's', code: 'C' }), 'TK')
  assert.match(chamadas[0].url, /^https:\/\/graph\.facebook\.com\/v27\.0\/oauth\/access_token\?/)
  assert.match(chamadas[0].url, /code=C/)
})
test('assina o webhook com override por conta', async () => {
  const { f, chamadas } = fetchFalso([{ body: { success: true } }])
  await assinarWebhookDaConta(criarGraph({ versao: 'v27.0', fetch: f }), 'TK', 'W1', { callbackUrl: 'https://igreja/api/meta/whatsapp/webhook', verifyToken: 'vt' })
  assert.match(chamadas[0].url, /\/W1\/subscribed_apps$/)
  assert.deepEqual(JSON.parse(chamadas[0].init.body), { override_callback_uri: 'https://igreja/api/meta/whatsapp/webhook', verify_token: 'vt' })
})
test('registra o número com pin', async () => {
  const { f, chamadas } = fetchFalso([{ body: { success: true } }])
  await registrarNumero(criarGraph({ versao: 'v27.0', fetch: f }), 'TK', 'P1', '123456')
  assert.deepEqual(JSON.parse(chamadas[0].init.body), { messaging_product: 'whatsapp', pin: '123456' })
})
test('token inválido vira ErroGraph.tokenInvalido', async () => {
  const { f } = fetchFalso([{ status: 401, body: { error: { message: 'expired', code: 190 } } }])
  await assert.rejects(lerStatusNumero(criarGraph({ versao: 'v27.0', fetch: f }), 'TK', 'P1'), (e) => e instanceof ErroGraph && e.tokenInvalido)
})
test('pin tem 6 dígitos', () => { assert.match(gerarPin(), /^\d{6}$/) })
```

- [ ] **Step 2: Run** `node --test scripts/teste-meta-whatsapp.mjs` — Expected: novos testes FAIL.
- [ ] **Step 3: Implement** `graph.ts` e `conexaoMeta.ts` (corpo JSON com `Content-Type: application/json`; token no cabeçalho `Authorization: Bearer`, nunca na URL, exceto o `client_secret` exigido pela troca do código).
- [ ] **Step 4: Run** — Expected: todos PASS.
- [ ] **Step 5: Commit** — `git commit -m "WhatsApp oficial: cliente Graph e operações de conexão"`

---

### Task 3: Tabela `meta_whatsapp_conexoes` (banco + baseline)

**Files:**
- Modify: `prisma/schema.prisma` (model novo no fim do bloco de WhatsApp)
- Create: `prisma/migrations/20261124000000_meta_whatsapp_conexoes/migration.sql`
- Modify: `baseline/*.sql`, `baseline/manifest.json` (gerados)

**Interfaces:**
- Produces: `prisma.metaWhatsappConexao` com:

| campo Prisma | coluna | tipo |
|---|---|---|
| id | id | uuid pk default gen_random_uuid() |
| campoId | campo_id | uuid **unique**, FK campos(id) on delete cascade |
| wabaId | waba_id | text not null |
| phoneNumberId | phone_number_id | text not null **unique** |
| numero | numero | text |
| nomeExibicao | nome_exibicao | text |
| tokenCifrado | token_cifrado | text not null |
| pinCifrado | pin_cifrado | text not null |
| status | status | text not null default 'conectado' (`conectado` \| `erro` \| `desconectado`) |
| ultimoErro | ultimo_erro | text |
| conectadoPor | conectado_por | uuid FK users(id) |
| conectadoEm | conectado_em | timestamptz default now() |
| atualizadoEm | atualizado_em | timestamptz @updatedAt |

RLS ligada sem políticas (acesso só pelo servidor), como as demais tabelas sensíveis — conferir o padrão em `baseline/11_rls_policies.sql` antes.

- [ ] **Step 1:** Escrever o model e o `migration.sql` (`create table if not exists`, índices únicos, FK, `alter table ... enable row level security`).
- [ ] **Step 2: PARAR e pedir confirmação ao dono** para aplicar o DDL no banco de referência (produção Campinas). Só seguir com o "sim".
- [ ] **Step 3:** `npx prisma db execute --file prisma/migrations/20261124000000_meta_whatsapp_conexoes/migration.sql` e `npx prisma migrate resolve --applied 20261124000000_meta_whatsapp_conexoes` — Expected: sem erro.
- [ ] **Step 4:** Parar o `next dev`, `npx prisma generate`, religar o `next dev`.
- [ ] **Step 5:** `cd ../painelchurch && npm run baseline:dump`, copiar `baseline/*.sql` e `manifest.json` para `saaschurch-nextjs/baseline/`; conferir `grep -c "meta_whatsapp_conexoes" baseline/05_tables.sql` ≥ 1 e que a versão do `manifest.json` mudou.
- [ ] **Step 6: Commit** nos dois repositórios — `"WhatsApp oficial: tabela de conexões por campo"`.

---

### Task 4: Rotas da API

**Files:**
- Create: `src/lib/meta/configMeta.ts` — `lerConfigMeta(): Promise<ConfigMeta>` (nesta task lê as 6 variáveis de ambiente; faltando ou **vazia** alguma ⇒ `throw new ErroConfigMeta('Configuração da Meta incompleta: <nomes>')`). A Task 8 troca a fonte para a configuração central, mantendo esta assinatura. Timeout/AbortError da Graph ⇒ 504 com mensagem amigável.
- Create: `src/lib/meta/conexaoRepo.ts` — `buscarConexaoDoCampo(campoId)`, `salvarConexao(dados)`, `marcarErro(campoId, msg)`, `desconectar(campoId)`.
- Create: `src/app/api/meta/whatsapp/config/route.ts` — `GET` (withAuth): `{ appId, configId, graphVersion }` (nunca o segredo).
- Create: `src/app/api/meta/whatsapp/conexao/route.ts` — `GET` status; `POST` conectar; `DELETE` desconectar.
- Create: `src/app/api/meta/whatsapp/webhook/route.ts` — `GET` desafio; `POST` valida assinatura e responde 200 (sem processar nesta etapa).
- Test: `scripts/e2e-meta-whatsapp.mjs`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces (contrato HTTP usado pela tela):
  - `GET /api/meta/whatsapp/conexao` ⇒ `200 { conectado: false }` ou `200 { conectado: true, status, numero, nomeExibicao, qualidade, limiteDiario, ultimoErro }`. Busca o status na Graph na hora; `ErroGraph.tokenInvalido` ⇒ `marcarErro(campo, 'Token recusado pela Meta. Reconecte o número.')` e devolve `status: 'erro'`.
  - `POST /api/meta/whatsapp/conexao` body `{ code, wabaId, phoneNumberId }` ⇒ troca código, gera PIN, registra número, assina webhook com `callbackUrl = <origin da requisição>/api/meta/whatsapp/webhook`, lê status, grava. `201` com o mesmo formato do GET.
  - `DELETE /api/meta/whatsapp/conexao` ⇒ `desconectar(campo)`; `200 { conectado: false }`.
  - Regras comuns: `withAuth`; sem campo ativo ⇒ `400 { error: 'Selecione um campo antes de conectar o WhatsApp oficial.' }`; `POST` exige `exigirPermissao(user, 'whatsapp_oficial.conexao.conectar')`, `DELETE` exige `'whatsapp_oficial.conexao.desconectar'`, `GET` exige `'whatsapp_oficial.view'`; `phoneNumberId` já ligado a outro campo ⇒ `409`; `ErroConfigMeta` ⇒ `503` com a mensagem; resposta nunca contém token nem PIN; rotas com `cache: no-store`.

- [ ] **Step 1: Write the failing e2e** `scripts/e2e-meta-whatsapp.mjs` (mesmo esqueleto de `scripts/e2e-campanhas-secretaria.mjs`; `BASE=http://localhost:3000`), cobrindo:
  - `GET /webhook?hub.mode=subscribe&hub.verify_token=<env>&hub.challenge=42` ⇒ `200` corpo `42`; token errado ⇒ `403`.
  - `POST /webhook` sem assinatura ⇒ `401`; com assinatura correta (HMAC de `META_APP_SECRET`) ⇒ `200`.
  - `GET /conexao` sem token ⇒ `401`.
  - Com usuário de teste com campo: `GET /conexao` ⇒ `{ conectado: false }`.
  - Gravação direta via Prisma de uma conexão falsa em outro campo com `phoneNumberId: 'e2e-dup'`; `POST /conexao` com o mesmo id ⇒ `409` (o servidor deve checar o duplicado **antes** de chamar a Meta). Limpar no fim.
  - Usuário de teste **sem campo ativo**: `GET` e `POST /conexao` ⇒ `400` com "Selecione um campo", nada gravado.
  - Conexão do campo de teste gravada com `tokenCifrado: 'lixo'`: `GET /conexao` ⇒ `200` com `status: 'erro'` e `ultimoErro` pedindo para reconectar (nunca 500, nunca o token na resposta). Limpar no fim.
- [ ] **Step 2: Run** `node scripts/e2e-meta-whatsapp.mjs` com o `next dev` no ar — Expected: FAIL (rotas inexistentes).
- [ ] **Step 3: Implement** os arquivos acima.
- [ ] **Step 4: Run** — Expected: todos os checks OK; `node --test scripts/teste-meta-whatsapp.mjs` continua PASS.
- [ ] **Step 5: Commit** — `"WhatsApp oficial: rotas de conexão, status e webhook"`

---

### Task 5: Tela "WhatsApp Oficial" e permissões

**Files:**
- Create: `src/app-ui/system/WhatsAppOficial.tsx`
- Create: `src/lib/meta/embeddedSignup.ts` (cliente) — `carregarSdkMeta(appId, versao): Promise<void>` e `abrirEmbeddedSignup(configId): Promise<{ code: string; wabaId: string; phoneNumberId: string }>`. **Antes de implementar, ler a página da v4** (`developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/version-4`) e seguir o formato de `FB.login` e do evento de mensagem que ela descreve.
- Modify: `src/app-ui/system/permissionCatalog.ts` — módulo `{ group: 'Comunicação', name: 'WhatsApp Oficial (Meta)', key: 'whatsapp_oficial', permissions: mkPerms(admin(), admin(), admin(), admin()) }`.
- Modify: `src/components/app-ui/AppUI.tsx` — item no grupo "Sistema", logo após "WhatsApp Instâncias": `{ name: 'WhatsApp Oficial', path: '/app-ui/system/whatsapp-oficial', icon: BadgeCheck, permKey: 'whatsapp_oficial' }`.
- Modify: `src/spa/routes.tsx` — `{ path: "system/whatsapp-oficial", Component: WhatsAppOficial }`.
- Modify: `src/lib/permissoes/arvore.generated.ts` (gerado).

**Interfaces:**
- Consumes: contrato HTTP da Task 4.
- A tela mostra:
  - Sem conexão: texto curto do que é, passo a passo (empresa verificada no Gerenciador de Negócios, forma de pagamento na conta WhatsApp da Meta) e o botão **"Conectar com a Meta"** dentro de `<Permissao chave="whatsapp_oficial.conexao.conectar" rotulo="Conectar com a Meta" herda="whatsapp_oficial.edit">`.
  - Conectado: número, nome de exibição, status, qualidade (verde/amarelo/vermelho com texto, não só cor), limite diário, e **"Desconectar"** em `<Permissao chave="whatsapp_oficial.conexao.desconectar" rotulo="Desconectar número" herda="whatsapp_oficial.delete">` com confirmação na própria tela (sem `window.confirm`).
  - `status: 'erro'`: faixa com `ultimoErro` e o botão "Reconectar" (mesma chave de conectar).
  - Erros 400/409/503 aparecem como texto na tela.

- [ ] **Step 1:** Implementar catálogo, menu, rota e tela (cada `.tsx` numa gravação só).
- [ ] **Step 2: Run** `npm run permissoes:arvore` e `npm run permissoes:check` — Expected: "Árvore em dia", auditoria ok, marcações ok.
- [ ] **Step 3: Verificar no navegador** (`/app-ui/system/whatsapp-oficial`): sem conexão mostra o botão; com o app em modo de desenvolvimento e o número de teste da Meta, o fluxo conecta e a tela mostra o número. Registrar o que foi visto.
- [ ] **Step 4: Commit** — `"WhatsApp oficial: tela de conexão e status"`

---

### Task 6: Página pública de Política de Privacidade

**Files:**
- Create: `src/app/privacidade/page.tsx` (server component estático, `export const metadata = { title: 'Política de Privacidade' }`)

**Interfaces:**
- URL pública `/privacidade`, sem login, com âncora `#exclusao-de-dados`. Conferir que `src/proxy.ts` não reescreve `/privacidade` (só reescreve slugs de departamento publicados) e acrescentar `"privacidade"` ao conjunto `RESERVADOS`.
- Conteúdo (português, linguagem simples): quem é o controlador (ZyonByte, com os dados que o dono informar), que dados o sistema guarda (cadastro de membros, contatos, mensagens do WhatsApp, leads de anúncios), para quê, com quem compartilha (Meta, para envio de mensagens), retenção, direitos LGPD, como pedir exclusão (`#exclusao-de-dados`, com o e-mail de contato informado pelo dono) e data de atualização. **O texto final é revisado pelo dono antes do commit.**

- [ ] **Step 1:** Implementar a página e o `RESERVADOS`.
- [ ] **Step 2: Run** `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/privacidade` — Expected: `200`, e o HTML contém `exclusao-de-dados`.
- [ ] **Step 3:** Mostrar o texto ao dono; ajustar.
- [ ] **Step 4: Commit** — `"Política de Privacidade pública (exigida pela Meta)"`

---

### Task 7: Configuração do app Meta e das igrejas

**Files:**
- Create: `docs/modules/whatsapp-oficial.md` — o que é o módulo, variáveis de ambiente, onde cadastrar cada uma (Vercel de Campinas; Coolify de cada VPS), domínios a liberar no app Meta, como uma igreja nova se conecta, e o que fica para as próximas etapas.

- [ ] **Step 1:** No app Meta (pelo navegador, com o dono): caso de uso WhatsApp, "Tech Provider onboarding", configuração do Embedded Signup (gera `META_ES_CONFIG_ID`), URL do webhook padrão `https://<domínio de Campinas>/api/meta/whatsapp/webhook` com o `META_WEBHOOK_VERIFY_TOKEN`, campos `messages` assinados, domínio de Campinas liberado, URL da Política de Privacidade. **Aceite de termos e dados da empresa: o dono clica.**
- [ ] **Step 2:** Gerar `META_TOKEN_ENCRYPTION_KEY` (`openssl rand -hex 32`) e `META_WEBHOOK_VERIFY_TOKEN`; cadastrar as 6 variáveis na Vercel (Campinas) e no `.env.local` — o dono confirma antes de mexer na Vercel.
- [ ] **Step 3:** Escrever `docs/modules/whatsapp-oficial.md`.
- [ ] **Step 4:** Teste ponta a ponta no ambiente de Campinas com o número de teste: conectar, ver status, desconectar.
- [ ] **Step 5: Commit** — `"WhatsApp oficial: documentação e configuração"`. Push só com autorização do dono.

---

### Task 8: Configuração central do app Meta e tela do master (adendo de 23/11)

**Files:**
- Modify: `prisma/schema.prisma` + migration `meta_app_config` (linha única: app_id, es_config_id, graph_version, webhook_verify_token, app_secret_cifrado, conexao_liberada boolean default false, atualizado_por, atualizado_em) + baseline (Regra nº 1; DDL só com "sim" do dono).
- Create: `src/lib/meta/configCentral.ts` — no sistema base (env `META_CONFIG_BASE=1`) lê do banco; nas demais igrejas busca `GET <META_CONFIG_URL>/api/meta/app-config` com cabeçalho `x-meta-config-token: <META_CONFIG_SYNC_TOKEN>`, cache de 5 min; se falhar, cai nas variáveis de ambiente.
- Modify: `src/lib/meta/configMeta.ts` — `lerConfigMeta()` passa a usar `configCentral`.
- Create: `src/app/api/meta/app-config/route.ts` — `GET` servidor-a-servidor (token compartilhado, `timingSafeEqual`), só no base; `PUT` para o master (withAuth + `exigirPermissao(user, 'meta_app.config.editar')`), segredo só substituído quando enviado.
- Create: `src/app-ui/system/MetaAppConfig.tsx` + menu (grupo Sistema, `permKey: 'meta_app'`) + rota `system/meta-app` + catálogo (`meta_app`, só master) + `<Permissao>` nos botões + `npm run permissoes:arvore`.
- Modify: tela da Task 5 — com `conexao_liberada = false` mostra "Em breve" no lugar do botão; a rota `POST /conexao` recusa com 403 "Conexão ainda não liberada pelo administrador".
- Test: `scripts/teste-meta-whatsapp.mjs` (cache e reserva por env, com fetch falso) e `scripts/e2e-meta-whatsapp.mjs` (GET sem token ⇒ 401; PUT sem permissão ⇒ 403; segredo nunca aparece no GET).

### Task 9: Monitor diário da Meta (adendo de 23/11)

**Files:**
- Create: `src/lib/meta/monitorMeta.ts` — `verificarMeta(): Promise<AlertaMeta[]>`: versão em uso vs. data de desativação (tabela de versões no código, atualizável pelo master), conexões com `status='erro'`, qualidade `RED`/`YELLOW`, webhook do base respondendo ao desafio.
- Create: migration `meta_alertas` (id, campo_id null, tipo, mensagem, proposta jsonb null, criado_em, resolvido_em) + baseline (DDL com "sim" do dono).
- Create: `src/app/api/cron/meta-monitor/route.ts` (CRON_SECRET, mesmo padrão de `src/app/api/cron/pastoral-cronograma/route.ts`) + `vercel.json` (diário) + Scheduled Task do Coolify documentada.
- Modify: tela da Task 8 — lista de alertas; alerta com `proposta` tem botão "Aprovar" que aplica a mudança na configuração central (ex.: nova versão da Graph API).
- Aviso por WhatsApp ao dono: usa o envio existente (só leitura/uso de `src/lib/whatsappSendService.ts`, sem alterá-lo), número configurável na tela; sem instância configurada, só registra na tela.
- Test: `scripts/teste-meta-whatsapp.mjs` com casos de versão perto da desativação, conexão em erro e qualidade baixa.
