# Migração AD Vila Solange: Vercel + Supabase Cloud → Coolify (VPS)

Iniciada em 27/10/2026. Padrão decidido pelo dono: **todo campo novo nasce
assim** (app e Supabase self-hosted no Coolify). **Campinas continua na
Vercel/Supabase Cloud — não mexer.**

Só fatos verificados aqui. O que não foi verificado está marcado como tal.

## Alvo

| Item | Valor |
| --- | --- |
| VPS | Hostinger "Uso geral", `srv2101213.hstgr.cloud`, **179.198.117.28** |
| Coolify | v4.5.0, `http://179.198.117.28:8000` (API `/api/v1`) |
| Projeto Coolify | `vila-solange` (uuid `6tpqvud9x5l2c09ngu2iyebe`), ambiente `production` |
| Serviço Supabase | `supabase-vilasolange` (uuid `femp0za7jwlstsd3et6oihaa`) |
| URL Supabase (Kong) | `https://supabaseadvilasolange.zionbyte.com.br` |
| URL do app | `https://advilasolange.zionbyte.com.br` |
| Fonte git | GitHub App `advilasolange` (id 1 no Coolify), enxerga só `geanusksama/saaschurch-nextjs` |

**Não confundir:** `212.85.0.189` (SLS CRM, `srv750239`) é outro servidor, com
outro Supabase (`sls-ferramentas`). Nada da Vila Solange vai para lá.

## Origem (medida em 27/10/2026)

| Item | Valor |
| --- | --- |
| Supabase Cloud | ref `dvdnsbtzheaydwzpyxir`, us-west-2 (credencial: `painelchurch/.env.local`, `INSTANCE_AD_VILA_SOLANGE_DB_URL`) |
| Vercel | projeto `advilasolange` |
| Postgres | 17.6, 35 MB |
| auth.users | 7 |
| storage | 6 buckets (`appv3-privado` privado; `appv3-publico`, `cultos`, `dados`, `dept-media`, `fotos` públicos), 6 objetos, 538 kB |
| extensões | plpgsql, pg_stat_statements, uuid-ossp, pgcrypto, supabase_vault, pg_trgm |

## Decisão: schema pelo baseline, só dados copiados

O template Supabase do Coolify sobe `supabase/postgres:15.8.1.085`; a origem é
17.6. Dump completo entre versões traria os schemas internos (`auth`,
`storage`) da 17 para cima de serviços configurados para a 15. Então:

1. schema `public` criado pelo `scripts/migrate-self.mjs` (o mesmo `baseline/`
   que cria qualquer igreja nova);
2. dados copiados com `pg_dump --data-only` (cliente 17) de `public`,
   `auth.users`, `auth.identities`;
3. buckets e arquivos copiados pela API de storage.

## DNS (Route 53, zona `zionbyte.com.br`)

O curinga `*.zionbyte.com.br` aponta para 212.85.0.189 (SLS CRM) — fica como
está. Registros próprios (têm precedência sobre o curinga):

| Nome | Tipo | Valor | Status |
| --- | --- | --- | --- |
| `advilasolange` | A | 179.198.117.28 | criado e resolvendo (27/10) |
| `supabaseadvilasolange` | A | 179.198.117.28 | criado e resolvendo (27/10) |

## Variáveis do app

As chaves de criptografia/assinatura (`NEXTAUTH_SECRET`, `MEMBRO_JWT_SECRET`,
`*_ENCRYPTION_KEY`, `FACEID_DAO_SECRET`, `CRON_SECRET`…) têm de ser **as
mesmas** do projeto Vercel `advilasolange`, senão dados já criptografados no
banco ficam ilegíveis. Mudam só: `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_URL`, `*_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_APP_URL`.

Crons: na Vercel vinham do `vercel.json` (`/api/cron/contabilidade`,
`/api/cron/whatsapp-ai`, `/api/cron/pastoral-cronograma`, a cada minuto). No
Coolify precisam virar Scheduled Tasks.

## Fatos da Vercel `advilasolange` (27/10)

- Repo `saaschurch-nextjs`, branch de produção `main`, Node 24.x.
- Domínio: só `advilasolange.vercel.app`.
- Variáveis: CONTABILIDADE_CRON_SECRET, CREDENTIAL_IMAGE_BUCKET=fotos,
  CREDENTIAL_IMAGE_FALLBACK_BUCKET=dados, CRON_SECRET, DATABASE_URL,
  DIRECT_URL, FACEID_DAO_SECRET, FACEID_REQUIRE_APPROVAL=false,
  MEMBRO_JWT_SECRET, MIGRATE_ON_BUILD=1, NEXTAUTH_SECRET,
  NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL,
  PASTORAL_JOURNEY_DRY_RUN=0, PUBLIC_DEFAULT_CAMPO_ID=b1540425-e0e7-4c31-ac6b-9cbe498d9f33,
  STRIPE_ENCRYPTION_KEY, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL.

## Como ficou montado no Coolify (fatos de 27/10)

| Recurso | uuid | Notas |
| --- | --- | --- |
| Supabase `supabase-vilasolange` | `femp0za7jwlstsd3et6oihaa` | `connect_to_docker_network=true`: o banco responde em `supabase-db-femp0za7jwlstsd3et6oihaa:5432` na rede interna. **Sem porta pública.** |
| App `app-advilasolange` | `k4fvet80ybedga0mdrzjbppo` | GitHub App `advilasolange`, `main`, nixpacks, porta 3000, auto-deploy ligado |
| Migrador `migrador-vilasolange` | `l1mepfndxtlvxbfdmlttzc3v` | **Temporário.** `postgres:17-alpine` com tarefas `migra-check/run/verify`. Apagar ao fim. |

App:

- `NIXPACKS_NODE_VERSION=22` — o nixpkgs do nixpacks não tem `nodejs_24`
  (1º deploy falhou com `undefined variable 'nodejs_24'`). A Vercel usava 24.x.
- `MIGRATE_ON_BUILD` **não** é variável do app: vai no start command
  (`MIGRATE_ON_BUILD=1 node scripts/migrate-self.mjs && npm start`). O build do
  Coolify não está na rede do Supabase; no start o container está.
- `DATABASE_URL` = `DIRECT_URL` = conexão direta `postgres@supabase-db-…:5432`
  (sem pooler).
- `NEXT_PUBLIC_APP_URL=https://advilasolange.zionbyte.com.br`. Na Vercel ela
  **não existia** — links gerados caíam no fallback `www.adcampinas.com.br`.

Origem e destino no mesmo baseline: a origem está em `25d8ef5ff8c5cde0`, igual
ao `baseline/manifest.json` da `main` em 27/10.

URLs do storage antigo gravadas no banco: só 6, todas em `public.home_configs`
(favicon_url, logo_url, watermark_url, pwa_icon_192/512/maskable). O
`migra-run` as reescreve para `https://supabaseadvilasolange.zionbyte.com.br`.

Check do migrador (17:51): origem 17.6 ok; destino conecta como
`supabase_admin` (superuser), 15.8, 0 usuários.

## O que mordeu (e a correção)

1. **`nodejs_24` não existe no nixpkgs do nixpacks** → 1º deploy falhou.
   Correção: `NIXPACKS_NODE_VERSION=22`.
2. **Postgres self-hosted com `ssl=off`** (conferido: `current_setting('ssl')`
   = off). O `migrate-self.mjs` abre o `pg.Client` com
   `ssl: {rejectUnauthorized:false}` → `The server does not support SSL
   connections` → container em loop de crash (8 restarts) e 0 tabelas criadas.
   Correção **sem mexer em código**: `?sslmode=disable` no `DATABASE_URL` e no
   `DIRECT_URL`. No `pg` 8.21 os parâmetros da URL sobrescrevem as opções do
   construtor (`pg/lib/connection-parameters.js:60`) e `sslmode=disable` vira
   `ssl=false` (`pg-connection-string`). Reproduzido localmente contra um
   postgres:15 sem SSL: sem o parâmetro FAIL, com o parâmetro OK.
   **Vale para todo campo novo no Coolify.**
3. **`truncate auth.users cascade` atinge `public`**: tabelas como
   `app_cadastros`, `orders`, `event_participants` têm FK para `auth.users`.
   Na 1ª cópia o truncate de auth rodou depois da carga de `public`; não houve
   perda (verificação posterior: 736 = 736, essas tabelas estão vazias na
   origem), mas o script foi corrigido para carregar auth **antes** de `public`.
4. `/_next/image` com o domínio novo responde 400 (`next.config.ts` só libera
   `*.supabase.co`). **Sem impacto**: nenhum componente importa `next/image`
   (as duas ocorrências são o matcher do `proxy.ts` e um comentário).

## Resultados verificados (27/10)

- `migrate-self` no start: `banco atualizado para 25d8ef5ff8c5cde0` (338
  tabelas, 4392 colunas, 1343 policies, 13_storage 20 statements). Next 16.2.6
  `Ready`, 0 restarts, `https://advilasolange.zionbyte.com.br/` = 200.
- Cópia (`migra-run`, 15:01–15:02): public 330 tabelas / **736 linhas** nos
  dois lados, contagem tabela a tabela **igual**; auth.users 7 = 7;
  auth.identities 7 = 7; URLs antigas em home_configs: 0. Único erro do
  pg_restore: `transaction_timeout` (parâmetro de sessão do PG17, não é dado).
- Storage: 6 objetos (todos `dados/home/*_vilasolange.png`, 91.835 bytes)
  copiados pela API; tamanho e sha256 iguais; URL pública 200 image/png. A home
  do app já carrega a imagem do domínio novo.
- Crons criados como Scheduled Tasks do app, **desligados** (ligar só na
  virada, para não rodar em dobro com a Vercel — whatsapp-ai e
  pastoral-cronograma mandam mensagem):
  `cron-contabilidade` (e2a41oh3j89falultsrdrcq1), `cron-whatsapp-ai`
  (rax8yqd9eispnxy9fxytseja), `cron-pastoral-cronograma`
  (iajziyy4gvlruax13y8l4ceb). Comando: `curl … -H "x-cron-secret:
  $CRON_SECRET" http://localhost:3000/api/cron/<nome>`. Testado sem segredo:
  401 (curl existe no container, rota responde e recusa).

## Cadastros básicos do financeiro (27/10)

Fato: o banco da Vila Solange **nunca teve** `forma_pagamento`,
`plano_de_contas`, `tipo_documento`, `bancos` nem `departamentos` (0 na origem
Supabase Cloud; a cópia não perdeu nada). Por decisão do dono, os catálogos
gerais foram copiados de Campinas:

- Leitura de Campinas (`ysibqnwgitakofehdxvd`) só com `BEGIN READ ONLY` /
  `pg_dump`. Atenção: `PGOPTIONS=-c default_transaction_read_only=on` **não
  vale** pelo pooler do Supabase (`show` devolveu `off`); `BEGIN READ ONLY`
  vale (CREATE recusado, testado).
- As três tabelas são gerais: `plano_de_contas.church_id` nulo nas 50 linhas;
  sem FK, só `UNIQUE(legacy_id)`. A coluna texto `campo` ('campinas') não é
  filtrada em nenhum ponto do `src/`.
- Copiados: forma_pagamento 9, tipo_documento 8, plano_de_contas 49. Fora: o
  tipo de documento `TESTE` e o plano `CONTA TESTE`.
- Gravados nos **dois** bancos da Vila Solange (antigo `dvdnsbtzheaydwzpyxir`
  e novo), com `ON CONFLICT DO NOTHING` em transação única — assim a recópia
  da virada mantém os catálogos.
- RLS: política `sistema_acesso` (só `authenticated`, `fn_usuario_sistema()`),
  igual no antigo e no novo; com a chave anon a API devolve `[]` nos dois.
- `bancos` e `departamentos` (pedido do dono, depois): em Campinas são o
  mesmo padrão repetido nos 9 campos (criado em 12/08), `church_id` nulo —
  banco "Caixa (espécie)" 01 CAIXA_ESPECIE padrão; departamento "Geral
  (Igreja)" 01 GERAL padrão; e "Departamento de MIssões" 02-MISSOES CAMPANHA
  em um campo só. Recriados para o único campo da Vila Solange
  (`advilasolange`, `b1540425-e0e7-4c31-ac6b-9cbe498d9f33`), com IDs novos
  **iguais nos dois bancos** (banco `0d1b4996-…`, Geral `072d2248-…`,
  Missões `39eef769-…`) e "MIssões" corrigido para "Missões". Insert com
  `where not exists (campo_id, codigo)`.
- Dono confirmou na tela (27/10): formas de pagamento, documentos e plano de
  contas aparecendo.

## Virada (feita em 27/10, ~18:20 UTC)

1. Dono testou login e telas do financeiro no endereço novo.
2. Vercel `advilasolange` (`prj_CAiKcIaKIQfsemZFJRvqNcJ9Akye`) **pausado**
   pela API: `paused=True`, `advilasolange.vercel.app` = 503. Projeto de
   Campinas `saaschurch-nextjs` (`prj_lRm88fLt5lEWrIyJY9ermpEAZRbn`) conferido
   **não pausado**.
3. Recópia **dispensada**, por fato: banco antigo 805 linhas = 736 da cópia +
   69 dos catálogos inseridos nos dois; nenhuma outra gravação no antigo. O
   novo tinha 818 = 805 + 13 `audit_logs` do uso do dono. Recopiar só apagaria
   esses 13.
4. 3 crons ligados; 1ª execução 18:23 UTC: os três `200`.
5. `migrador-vilasolange` apagado (com volumes e configuração).
6. Painel Coolify em `https://advscoolify.zionbyte.com.br` (registro A →
   179.198.117.28; Let's Encrypt até 25/01/2027).

Pendências do dono: revogar os tokens expostos na conversa (Coolify nº 1
e nº 2, e o token Vercel usado na migração). O banco Supabase Cloud
`dvdnsbtzheaydwzpyxir` continua existindo (fica como backup até o dono
decidir apagar). Não verificado ainda: o webhook do GitHub disparando deploy
no Coolify — conferir no 1º push na `main`.

## Progresso

- [x] Projeto `vila-solange` criado no Coolify
- [x] Serviço Supabase criado, domínio do Kong definido, start enfileirado
- [x] Supabase no ar e saudável (27/10 14:43; Let's Encrypt emitido, válido até 25/01/2027)
- [x] DNS criado no Route 53 e conferido no NS da AWS
- [x] Variáveis da Vercel `advilasolange` obtidas (19 chaves; produção = branch `main`, já usa `MIGRATE_ON_BUILD=1`)
- [x] Chaves do Supabase novo lidas (token Coolify nº 2, com `read:sensitive`); anon testada no Kong: `/rest/v1/` = 200
- [x] Schema aplicado (migrate-self no start; baseline 25d8ef5ff8c5cde0)
- [x] Dados copiados (public, auth, storage) e contagens conferidas
- [x] App criado no Coolify (branch `main`, nixpacks, 20 variáveis)
- [x] Crons (3) criados no Coolify, desligados até a virada
- [x] Deploy no ar (200)
- [x] Teste de login e telas do financeiro pelo dono
- [x] Virada: Vercel `advilasolange` pausado, crons ligados (200), migrador apagado
- [ ] Confirmar auto-deploy do Coolify no 1º push na `main`
- [ ] Revogar tokens expostos (Coolify nº 1 e 2, Vercel)
