# Fase 5 — Potenciais membros (cadastros de anúncios) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada campo conecta a Página do Facebook da igreja; quem preenche o formulário de um anúncio (Facebook ou Instagram) vira, em até 10 minutos, um card "Potencial membro" no Pipeline da igreja certa e aparece na aba "Potenciais membros" de Comunicação → Gestão.

**Architecture:** Login do Facebook para Empresas com a configuração "ZionByte Potenciais membros" (ID `1463625422591509`, token de usuário do sistema, 60 dias, ativo Páginas) devolve um `code`; o servidor troca por token, lista as Páginas concedidas e grava o token cifrado por campo. Um cron a cada 10 min lista os formulários e lê os cadastros novos de cada formulário ativo, cria o card no pipeline pastoral (tipo `potencial_membro`) sem duplicar e renova o token antes de vencer. Sem webhook `leadgen`.

**Tech Stack:** Next.js 16, Prisma + supabaseAdmin, `node --test` com `.ts` direto, E2E `scripts/e2e-*.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-27-comunicacao-unificada-meta-design.md` (fase 5) + `docs/superpowers/specs/2026-11-23-whatsapp-oficial-meta-design.md` (cadastros entram no pipeline pastoral; formulário ligado a uma igreja; sem ligação → sede do campo). Plano anterior (substituído por este): `docs/superpowers/plans/2026-11-27-whatsapp-oficial-etapa5-potenciais-membros.md`.

## Global Constraints

- No sistema o nome é **"Potenciais membros"** / **"Potencial membro"**, nunca "leads" (pedido do dono).
- Produção em várias igrejas: nada muda para quem não conecta Página. Tabela/coluna nova ⇒ migration + `migrate resolve` + baseline regerado (Ibirité já aceita baseline novo).
- Isolamento por campo ativo (master inclusive): Página, formulários e potenciais membros de um campo nunca aparecem para outro.
- Permissões novas de 3 partes (`modulo.tela.componente`), `<Permissao>` na tela e `exigirPermissao` na rota; `npm run permissoes:arvore`.
- Token cifrado com `META_TOKEN_ENCRYPTION_KEY` (`cifrar`/`decifrar` de `src/lib/meta/cifra.ts`); nunca logado nem devolvido.
- Nunca o mesmo cadastro duas vezes (único `(campo_id, lead_id)`); duplicado de telefone vivo no pipeline do mesmo tipo ⇒ só linha do tempo (`findLiveAttendance` de `src/lib/pastoralDuplicateCheck.ts`).
- Permissões Meta usadas: `leads_retrieval`, `ads_management`, `pages_show_list`, `pages_read_engagement`, `pages_manage_ads` (já "Pronto para teste" no app). Antes da análise do app, só quem tem papel no app conecta.
- `findMany`/`select` com `take`/`limit`; rotas de tela `no-store`; `.env` local = PRODUÇÃO (só a DDL desta fase).
- Com `next dev` rodando: cada `.tsx` numa gravação só; `tsc` no máximo 1 vez com `NODE_OPTIONS=--max-old-space-size=3072`.

## Review Focus

- **Token vencido ou revogado** (60 dias, ou a igreja remove o acesso): cron não quebra; Página vira `erro`, alerta `pagina_erro` uma vez; tela pede para reconectar.
- **Formulário com campos fora do padrão** (sem `full_name`/`phone_number`, perguntas próprias, telefone com +55, espaços): nome/telefone extraídos quando existirem; o resto vai inteiro para "respostas"; sem telefone ⇒ registra `sem_telefone`, sem card.
- **Mesmo cadastro lido de novo** (folga de 10 min na janela, cron sobreposto): uma linha só, um card só.
- **Formulário sem igreja escolhida**: vai para a sede do campo (spec de 23/11).
- **Usuário de outro campo** chamando as rotas com id de Página/formulário de outro campo: 404.

---

### Task 1: Banco — tabelas da fase 5

**Files:** Create `prisma/migrations/20261128030000_meta_potenciais_membros/migration.sql`; Modify `prisma/schema.prisma`; baseline (painelchurch + saaschurch).

**Interfaces — Produces:**
- `meta_paginas`: `id uuid pk`, `campo_id uuid not null` (FK campos cascade), `page_id text`, `page_nome text`, `token_cifrado text not null`, `token_expira_em timestamptz null`, `status text not null default 'ativa'` (`ativa|erro|desconectada`), `erro_mensagem text`, `conectado_por uuid`, `conectado_em timestamptz default now()`, `ultima_leitura_em timestamptz`; único `(campo_id, page_id)`; RLS ligado sem política.
- `meta_formularios`: `id uuid pk`, `campo_id`, `page_id text`, `form_id text`, `nome text`, `status_meta text`, `church_id uuid null`, `ativo boolean not null default true`, `ultimo_cadastro_em timestamptz`, `atualizado_em timestamptz default now()`; único `(campo_id, form_id)`.
- `meta_potenciais_membros`: `id uuid pk`, `campo_id`, `lead_id text`, `form_id text`, `page_id text`, `ad_id text`, `church_id uuid`, `nome text`, `telefone text`, `email text`, `respostas jsonb`, `criado_meta_em timestamptz`, `recebido_em timestamptz default now()`, `attendance_id uuid null`, `situacao text not null` (`novo|duplicado|sem_telefone`); único `(campo_id, lead_id)`; índice `(campo_id, recebido_em desc)`.
- `meta_app_config.leads_config_id text null` (configuração central do base; reserva `META_LEADS_CONFIG_ID`).

- [ ] Step 1: migration (só aditivo, `IF NOT EXISTS`) + modelos Prisma.
- [ ] Step 2: aplicar em Campinas (`db execute` → `migrate resolve` → `generate`), conferir pelo `information_schema`.
- [ ] Step 3: gravar `leads_config_id = '1463625422591509'` na linha `id=1` de `meta_app_config` de Campinas (UPDATE de 1 linha, aprovado pelo dono).
- [ ] Step 4: regerar baseline (cópia temporária do `dump-baseline.mjs` com caminhos `/mnt/dados/projetos`), diff filtrado só com as tabelas/coluna novas, copiar, commit nos dois repos (sem push).

### Task 2: Núcleo puro — extrair o potencial membro do cadastro

**Files:** Create `src/lib/meta/potenciais.ts`; Test `scripts/teste-meta-whatsapp.mjs`.

**Produces:**
- `extrairPotencial(fieldData: Array<{ name: string; values: string[] }>): { nome: string | null; telefone: string | null; email: string | null; respostas: Record<string, string> }` — nome de `full_name`, ou `first_name` + `last_name`; telefone de `phone_number` normalizado com `normalizarTelefoneBR` (`src/lib/meta/envio.ts`); e-mail de `email`; `respostas` = todos os campos (nome original → valores juntos por ", ").
- `textoDoCard(p, formNome: string): string` — "Cadastro pelo formulário <formNome> (anúncio Facebook/Instagram)." + uma linha por resposta.
- `tokenPrecisaRenovar(expiraEm: Date | null, agora: Date): boolean` — true se faltam ≤ 7 dias (null ⇒ false).

- [ ] Testes: `full_name` + `phone_number` "+55 (19) 99212-6683" → telefone "5519992126683"; `first_name`/`last_name`; sem telefone ⇒ `telefone: null`; pergunta própria vai para `respostas`; `tokenPrecisaRenovar` com 8 dias = false, 7 = true.
- [ ] FAIL → implementar → PASS → commit.

### Task 3: Conectar e desconectar a Página

**Files:** Create `src/lib/meta/paginaMeta.ts` (Graph, deps injetadas), `src/app/api/meta/potenciais/pagina/route.ts` (POST), `src/app/api/meta/potenciais/pagina/[id]/route.ts` (DELETE); Modify `src/lib/meta/configCentral.ts` (expor `leadsConfigId` no GET servidor-a-servidor e na visão do master) e a aba App (`src/app-ui/system/MetaAppConfig.tsx`: campo "Configuração de login — Potenciais membros").

**Interfaces:** antes de escrever, ler na documentação oficial da Meta (developers.facebook.com, Login do Facebook para Empresas e tokens de usuário do sistema de integração empresarial) como (a) trocar o `code` pelo token de usuário do sistema, (b) listar as Páginas concedidas a esse token, (c) obter o token de Página se for o caso, e (d) renovar/consultar a expiração do token de 60 dias. Registrar as URLs lidas no relatório; não inventar endpoint.
- `conectarPagina(code: string, ctx: { campoId: string; userId: string }): Promise<Array<{ pageId: string; nome: string }>>` — grava cada Página concedida em `meta_paginas` com token cifrado e `token_expira_em`.
- `desconectarPagina(id: string, campoId: string): Promise<void>` — status `desconectada`, apaga o token.
- Rotas: `withAuth`, campo ativo, `exigirPermissao(user, 'whatsapp_oficial.potenciais.conectar')`; id de outro campo ⇒ 404.

- [ ] Testes com Graph falso: troca de code, lista de Páginas gravada cifrada; erro da Meta ⇒ mensagem clara sem token; desconectar de outro campo ⇒ não altera.
- [ ] FAIL → implementar → PASS → commit.

### Task 4: Formulários, leitura dos cadastros e cron

**Files:** Create `src/lib/meta/servicoPotenciais.ts` (deps injetadas), `src/app/api/cron/meta-potenciais/route.ts`, `src/app/api/meta/potenciais/sincronizar/route.ts`; Modify `vercel.json` (`*/10 * * * *`), mapas de rótulo do pipeline (`src/lib/pastoralService.ts:~1000` e os mapas `TYPE_LABELS` das telas listadas por `grep -rln TYPE_LABELS src`) com `potencial_membro: 'Potencial membro'`.

**Produces:**
- `sincronizarFormularios(campoId)`: `GET /{page}/leadgen_forms` → upsert em `meta_formularios` preservando `church_id`/`ativo`.
- `lerCadastros(campoId)`: por formulário ativo, `GET /{form}/leads` desde `ultimo_cadastro_em − 10 min` (filtro `time_created` se aceito no endpoint do formulário; senão paginar do mais novo e parar no primeiro `lead_id` já gravado); cada cadastro: `extrairPotencial` → insert `ON CONFLICT (campo_id, lead_id) DO NOTHING`; só se inseriu: sem telefone ⇒ `sem_telefone`; com telefone ⇒ `findLiveAttendance({ churchId, phone, attendanceType: 'potencial_membro' })` — vivo ⇒ linha do tempo no card existente + `duplicado`; senão cria card (pipeline/coluna "todo" da igreja, mesmo padrão de `src/app/api/public/pastoral/create-attendance/route.ts`) + timeline "Recebido do formulário <nome> (anúncio Facebook/Instagram)" e grava `attendance_id`.
- Igreja do card = `church_id` do formulário, senão a sede do campo (ler como o código atual acha a sede: `DEFAULT_SEDE_ID`/`sedeNoCampoAtivo`).
- Cron: `CRON_SECRET`; 3 campos por vez; prazo 45 s; renova token quando `tokenPrecisaRenovar`; token recusado ⇒ Página `erro` + alerta `pagina_erro` (vai ao master pelo encaminhamento existente); tabela ausente ⇒ 200 `tabela ausente`.

- [ ] Testes com deps falsas: cadastro novo vira card; o mesmo cadastro de novo não duplica; telefone vivo no pipeline ⇒ só linha do tempo; sem telefone ⇒ sem card; formulário sem igreja ⇒ sede; token recusado ⇒ Página `erro` e 1 alerta.
- [ ] FAIL → implementar → PASS; E2E `scripts/e2e-potenciais.mjs` com Graph falso contra o banco de referência, limpando tudo no fim → commit.

### Task 5: Tela — aba "Potenciais membros"

**Files:** Create `src/app-ui/pastoral/PotenciaisMembros.tsx`; Modify `src/app-ui/pastoral/PastoralHub.tsx` (aba nova, ícone `UserPlus`, `<Permissao chave="pastoral_visits.pastoral_hub.potenciais" rotulo="Potenciais membros — Pastoral Hub" herda="pastoral_visits.view">`), `src/app-ui/system/permissionCatalog.ts` (se preciso), rota `GET /api/meta/potenciais` (Página, formulários, últimos 100 recebidos, paginado) e `PATCH /api/meta/potenciais/formularios/[id]` (igreja de destino e ativo; `whatsapp_oficial.potenciais.configurar`).

- [ ] Página: nome, situação, **Conectar Página** (popup do SDK da Meta com `config_id` = `leadsConfigId`, mesmo carregamento de `src/lib/meta/embeddedSignup.ts`) e **Desconectar**; aviso quando o token estiver perto de vencer ou com erro.
- [ ] Formulários: nome, situação na Meta, igreja de destino (igrejas do campo), ativo.
- [ ] Recebidos: nome, telefone mascarado (`mascararTelefone`), formulário, igreja, data, situação, link para o card; botão **Buscar agora** (`/sincronizar`).
- [ ] `npm run permissoes:arvore`, `permissoes:check` → commit.

### Task 6: Fechamento

- [ ] Docs: seção "Fase 5 — Potenciais membros" em `docs/modules/whatsapp-oficial.md` (configuração 1463625422591509, cron, Scheduled Task `cron-meta-potenciais` `*/10 * * * *` nas igrejas do Coolify, teste com anúncio real só no Instagram para fechar a dúvida da documentação).
- [ ] Testes completos, `permissoes:check`, revisão final, publicação, Scheduled Task em Ibirité via API do Coolify (Vila Solange: pedir token ao dono).
