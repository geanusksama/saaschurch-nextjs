# WhatsApp Oficial — Etapa 2: Modelos e central Meta Oficial — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada campo cria, acompanha e exclui modelos de mensagem do WhatsApp oficial, numa central "Meta Oficial" que reúne tudo do módulo (visão geral, conexão, modelos, próximas etapas e app oficial do master).

**Architecture:** Regras puras de modelo (validação e montagem do corpo da Graph) em `src/lib/meta/modelos.ts`; serviço com dependências injetadas (`servicoModelos.ts`) que fala com `/<WABA_ID>/message_templates` usando o token cifrado da conexão do campo e espelha os modelos numa tabela por campo; rotas finas; cron de hora em hora; uma tela-central com abas que reaproveita as telas da Etapa 1.

**Tech Stack:** Next.js 16 App Router + SPA react-router, Prisma 6, Supabase Postgres, Graph API v27.0, lucide-react, Tailwind, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-23-whatsapp-oficial-meta-design.md` (seção "Adendo aprovado pelo dono (23/11/2026): Etapa 2").

## Global Constraints

- Módulo Z-API intocado: nenhum arquivo `src/lib/whatsapp*.ts`, `src/lib/zapi*.ts`, `src/app/api/whatsapp/**` ou tabela `whatsapp_*` é alterado.
- Tudo por campo: `user.campoId` (como as rotas da Etapa 1); modelo de outro campo → 404.
- Token da Meta só no servidor, decifrado com `META_TOKEN_ENCRYPTION_KEY`; nenhuma resposta leva token.
- Graph: `POST /<WABA_ID>/message_templates`, `GET /<WABA_ID>/message_templates?fields=id,name,language,category,status,rejected_reason,components&limit=100`, `DELETE /<WABA_ID>/message_templates?hsm_id=<id>&name=<nome>`. Token no cabeçalho (`criarGraph`).
- Regras da Meta validadas antes de enviar: nome `^[a-z0-9_]{1,512}$`; categoria `MARKETING` ou `UTILITY`; idioma `pt_BR`; cabeçalho texto ≤ 60 caracteres com no máximo 1 variável; corpo 1–1024 caracteres; rodapé ≤ 60 sem variável; até 3 botões `QUICK_REPLY` com texto ≤ 25; variáveis `{{n}}` sequenciais a partir de 1, sem pular número; corpo não começa nem termina com variável; cada variável com exemplo não vazio.
- Variáveis amigáveis: `nome` (Nome da pessoa), `igreja` (Nome da igreja), `data` (Data), `livre` (Texto livre) — guardadas junto do modelo para a Etapa 3 preencher.
- **Ícones só de `lucide-react`, no padrão do sistema. Nenhum emoji em tela, rótulo ou mensagem** (pedido do dono, 23/11).
- Visual segue `docs/architecture/GUIA-ESTILO-SILAS.md` (inclui variantes `dark:`).
- AGENTS.md regra nº 1: tabela nova ⇒ migration + `migrate resolve --applied` + baseline regerado (`../painelchurch`, contorno NODE_PATH + SOURCE_DB_URL) + cópia para `baseline/` + commit nos dois repos. **DDL em produção só depois do "pode aplicar" do dono.**
- AGENTS.md regra nº 2: chaves no `permissionCatalog.ts`, `<Permissao>` em cada botão de ação com `herda`, `exigirPermissao` com a mesma chave na rota, `npm run permissoes:arvore` e `permissoes:check`.
- `findMany` sempre com `take` (≤ 200) e `orderBy`.
- Rotas de tela com `Cache-Control: no-store` (`SEM_CACHE`).
- `next dev` pode estar rodando: cada `.tsx` numa gravação só; um processo pesado por vez; typecheck só dos arquivos tocados com `NODE_OPTIONS=--max-old-space-size=3072`.
- Node: `export PATH=$HOME/.nvm/versions/node/v24.22.0/bin:$PATH`. Testes: `node --test scripts/teste-meta-whatsapp.mjs` (acrescentar, nunca quebrar os 62 existentes).
- Commits em pt-BR terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sem push.

## Review Focus

- Campo sem conexão (ou desconectado) abre Modelos ou clica Atualizar → mensagem "Conecte o número primeiro", sem chamar a Meta e sem 500. (Teste na Task 2.)
- Meta recusa a criação (nome repetido, regra de conteúdo) → mensagem da Meta mostrada em português, nada gravado como aprovado. (Teste na Task 2.)
- Sincronização com modelo apagado direto na Meta → some da lista do sistema; modelo criado direto na Meta → aparece. (Teste na Task 2.)
- Token recusado (código 190) durante sincronização/criação → conexão marcada erro e mensagem "Reconecte o número". (Teste na Task 2.)
- Usuário de um campo tenta excluir modelo de outro campo pelo id → 404, nada apagado. (e2e na Task 3.)

---

### Task 1: Regras puras dos modelos

**Files:**
- Create: `src/lib/meta/modelos.ts`
- Test: `scripts/teste-meta-whatsapp.mjs` (acrescentar bloco "modelos")

**Interfaces:**
- Produces:
  - `type VariavelModelo = { posicao: number; tipo: 'nome' | 'igreja' | 'data' | 'livre'; exemplo: string }`
  - `type BotaoModelo = { texto: string }`
  - `type RascunhoModelo = { nome: string; categoria: 'MARKETING' | 'UTILITY'; cabecalho?: string; corpo: string; rodape?: string; botoes?: BotaoModelo[]; variaveis: VariavelModelo[] }`
  - `function nomeDoTitulo(titulo: string): string` — minúsculas, sem acento, espaço→`_`, remove o resto, corta em 512.
  - `function validarRascunho(r: RascunhoModelo): string[]` — lista de erros em português (vazia = ok).
  - `function montarCorpoGraph(r: RascunhoModelo): { name: string; language: 'pt_BR'; category: string; components: unknown[] }` — HEADER(format TEXT, example.header_text quando tem variável), BODY(example.body_text: [[exemplos em ordem]]), FOOTER, BUTTONS(QUICK_REPLY).
  - `function normalizarDaMeta(t: any): { metaTemplateId: string; nome: string; idioma: string; categoria: string; status: string; motivoRecusa: string | null; componentes: unknown[] }`
  - `const ROTULO_STATUS: Record<string, string>` — APPROVED Aprovado, PENDING Em análise, REJECTED Recusado, PAUSED Pausado, DISABLED Desativado, outros → o próprio valor.

- [ ] **Step 1: Testes que falham** — `nomeDoTitulo('Culto de Ceia!')` → `'culto_de_ceia'`; rascunho válido com `{{1}}` no meio → `[]`; corpo `'{{1}} olá'` → erro de início; `'olá {{2}}'` sem `{{1}}` → erro de sequência; rodapé com `{{1}}` → erro; 4 botões → erro; botão com 26 caracteres → erro; exemplo vazio → erro; `montarCorpoGraph` com uma variável no corpo gera `example.body_text` `[['Maria']]`; sem cabeçalho não gera HEADER; `normalizarDaMeta` com `rejected_reason: 'NONE'` → `motivoRecusa: null`.
- [ ] **Step 2:** rodar `node --test scripts/teste-meta-whatsapp.mjs` → FAIL (função inexistente).
- [ ] **Step 3:** implementar em `src/lib/meta/modelos.ts` (sem import do Prisma; só TypeScript puro).
- [ ] **Step 4:** rodar de novo → todos PASS (62 antigos + novos).
- [ ] **Step 5:** commit "WhatsApp oficial: regras dos modelos de mensagem".

### Task 2: Tabela, serviço e sincronização de modelos

**Files:**
- Modify: `prisma/schema.prisma` (model `MetaWhatsappModelo`, relação em `Campo`)
- Create: `prisma/migrations/20261124030000_meta_whatsapp_modelos/migration.sql`
- Create: `src/lib/meta/servicoModelos.ts`, `src/lib/meta/modelosRepo.ts`
- Test: `scripts/teste-meta-whatsapp.mjs`

**Interfaces:**
- Consumes: Task 1; `ConexaoRegistro`, `ErroServico`, `MSG_TOKEN_RECUSADO`, `MSG_TIMEOUT` de `servicoConexao.ts`; `Graph`/`ErroGraph`; `cifra.decifrar`; `conexaoRepo.buscarConexaoDoCampo` e `marcarErro`.
- Tabela `meta_whatsapp_modelos`: `id uuid pk default gen_random_uuid()`, `campo_id uuid not null fk campos on delete cascade`, `waba_id text not null`, `meta_template_id text not null`, `nome text not null`, `idioma text not null default 'pt_BR'`, `categoria text not null`, `status text not null`, `motivo_recusa text null`, `componentes jsonb not null default '[]'`, `variaveis jsonb not null default '[]'`, `criado_por uuid null fk users`, `criado_em timestamptz default now()`, `atualizado_em timestamptz not null default now()`, `sincronizado_em timestamptz null`; `unique (campo_id, meta_template_id)`; `index (campo_id, nome)`; RLS ligado (como `meta_alertas`).
- Produces (`servicoModelos.ts`, dependências injetadas como em `servicoConexao`):
  - `type DepsModelos = { repo: {...listar, substituirDoCampo, inserir, buscar, remover}, conexoes: { buscarConexaoDoCampo, marcarErro }, graph: Graph, chave: string, cifra: { decifrar } }`
  - `listarModelos(deps, campoId): Promise<ModeloResumo[]>` (do banco, take 200, orderBy atualizado_em desc)
  - `sincronizarModelos(deps, campoId): Promise<{ total: number }>` — lê até 5 páginas de 100 da Meta; substitui o espelho do campo mantendo `variaveis` e `criado_por` dos que já existiam (casando por `meta_template_id`).
  - `criarModelo(deps, campoId, userId, rascunho): Promise<ModeloResumo>` — valida (400 com a lista), POST, grava com status da resposta (`PENDING` se vier vazio).
  - `excluirModelo(deps, campoId, id): Promise<void>` — busca pelo id **e** campo (senão 404), DELETE na Meta com `hsm_id` e `name`, remove do banco. Se a Meta disser que não existe mais, remove do banco mesmo assim.
  - `const MSG_SEM_CONEXAO = 'Conecte o número do WhatsApp Oficial antes de usar os modelos.'`
  - Erros: código 190 → `marcarErro` + `ErroServico(401, MSG_TOKEN_RECUSADO)`; timeout → 504 `MSG_TIMEOUT`; outro ErroGraph → 502 "A Meta recusou: <mensagem>".

- [ ] **Step 1: Testes que falham** (deps falsas): sem conexão → `ErroServico` 409 `MSG_SEM_CONEXAO` e graph não chamado; conexão `desconectado` → idem; sincronizar com Meta devolvendo [A(novo), B(existente com variaveis)] e banco com [B, C] → banco final [A, B com variaveis preservadas], C removido; criar com rascunho inválido → 400 e graph não chamado; criar válido → POST em `<waba>/message_templates` e repo.inserir com status `PENDING`; Graph lança código 190 → `marcarErro` chamado e 401; excluir id de outro campo → 404 e graph não chamado.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** schema + migration SQL + `modelosRepo.ts` (Prisma, `take: 200`, `deleteMany` + `createMany` em `$transaction` de array para substituir) + `servicoModelos.ts`.
- [ ] **Step 4:** testes PASS; typecheck dos arquivos tocados.
- [ ] **Step 5:** commit "WhatsApp oficial: tabela e serviço de modelos" (migration **não** aplicada: o controlador aplica depois do OK do dono, junto com o baseline).

### Task 3: Rotas, permissões e cron

**Files:**
- Create: `src/app/api/meta/whatsapp/modelos/route.ts` (GET lista, POST cria), `src/app/api/meta/whatsapp/modelos/[id]/route.ts` (DELETE), `src/app/api/meta/whatsapp/modelos/sincronizar/route.ts` (POST), `src/app/api/cron/meta-modelos/route.ts`, `src/lib/meta/depsModelos.ts`
- Modify: `vercel.json` (cron `"/api/cron/meta-modelos"` em `"15 * * * *"`), `scripts/e2e-meta-whatsapp.mjs`

**Interfaces:**
- Chaves: GET e sincronizar → `whatsapp_oficial.modelos.view`; POST → `whatsapp_oficial.modelos.criar`; DELETE → `whatsapp_oficial.modelos.excluir`.
- Respostas: GET `{ modelos: ModeloResumo[], conectado: boolean }` (sem conexão: `{ modelos: [], conectado: false }` com 200); erros `{ error }` com o status do `ErroServico`; `SEM_CACHE`.
- Cron: `CRON_SECRET` como `cron/meta-monitor`; percorre conexões `status = 'conectado'` (take 200), prazo total 45 s, concorrência 3, um erro por campo não para os outros; tabela ausente (P2021) → 200 `{ ok:false, motivo:'tabela ausente' }`.

- [ ] **Step 1:** e2e (estender `scripts/e2e-meta-whatsapp.mjs`): sem token → 401 nas 4 rotas; DELETE de uuid inexistente → 404; POST com rascunho inválido → 400 com lista de erros; GET sem conexão → 200 `conectado:false`.
- [ ] **Step 2:** implementar as rotas e o cron.
- [ ] **Step 3:** rodar e2e com `MRM_TOKEN` (só depois da tabela aplicada; se ainda não aplicada, registrar no relatório e rodar só os casos 401) e testes unitários.
- [ ] **Step 4:** commit "WhatsApp oficial: rotas e cron dos modelos".

### Task 4: Central "Meta Oficial" (abas, cartão e menu)

**Files:**
- Create: `src/app-ui/system/MetaOficial.tsx`, `src/app-ui/system/metaOficial/VisaoGeral.tsx`, `src/app-ui/system/metaOficial/EmBreve.tsx`
- Modify: `src/app-ui/system/WhatsAppOficial.tsx` e `MetaAppConfig.tsx` (exportar o conteúdo como componente embutível `embutido` sem cabeçalho de página, sem mudar lógica), `src/spa/routes.tsx` (rota `system/meta-oficial`; rotas antigas viram `<Navigate>` para `?aba=conexao` e `?aba=app`), `src/components/app-ui/AppUI.tsx` (um item "Meta Oficial" no lugar dos dois; nome amigável), `src/components/app-ui/SystemSettings.tsx` (cartão `meta-oficial` em Comunicação, `permKey: 'whatsapp_oficial'`), `src/app-ui/system/permissionCatalog.ts`

**Interfaces:**
- Abas (`?aba=`): `visao-geral` (padrão), `conexao`, `modelos` (Task 5 — até lá, `EmBreve`), `envio` (Etapa 3), `conversas` (Etapa 4), `leads` (Etapa 5), `app` (só `profileType === 'master'` e `meta_app`).
- Ícones lucide: `LayoutDashboard`, `Smartphone`, `FileText`, `Send`, `MessagesSquare`, `Megaphone`, `ShieldCheck`; marca da central `BadgeCheck`.
- Visão geral lê `GET /api/meta/whatsapp/conexao`, `GET /api/meta/whatsapp/config`, `GET /api/meta/whatsapp/modelos` e mostra: cartão Conexão (número, qualidade em selo colorido, limite), cartão Modelos (aprovados / em análise / recusados), cartão Liberação, lista "Próximos passos" com ícone `CheckCircle2`/`Circle` por item, e atalhos externos (`ExternalLink`) para o WhatsApp Manager e Pagamentos da Meta. Falha de uma chamada não derruba as outras.
- Permissões novas no catálogo (sub-chaves de `whatsapp_oficial`): `whatsapp_oficial.modelos.view` (herda `whatsapp_oficial.view`), `.criar`, `.excluir` (herdam `whatsapp_oficial.modelos.view`).

- [ ] **Step 1:** implementar; abas acessíveis por teclado (`role="tablist"`), em tela estreita viram rolagem horizontal.
- [ ] **Step 2:** `npm run permissoes:arvore`, `npm run permissoes:check`, typecheck e lint dos arquivos tocados.
- [ ] **Step 3:** conferir no navegador (dev local, usuário master): cartão em Configurações → Comunicação abre a central; rotas antigas caem na aba certa; aba App só para master.
- [ ] **Step 4:** commit "WhatsApp oficial: central Meta Oficial com abas".

### Task 5: Aba Modelos

**Files:**
- Create: `src/app-ui/system/metaOficial/Modelos.tsx`, `src/app-ui/system/metaOficial/EditorModelo.tsx`, `src/app-ui/system/metaOficial/PreviaWhatsApp.tsx`
- Modify: `src/app-ui/system/MetaOficial.tsx` (aba `modelos` usa `Modelos`)

**Interfaces:**
- Consumes: rotas da Task 3; `validarRascunho`, `nomeDoTitulo`, `ROTULO_STATUS` da Task 1 (mesma validação no navegador e no servidor).
- Lista: tabela (ou cartões no celular) com nome, categoria, situação em selo (Aprovado verde, Em análise âmbar, Recusado vermelho com motivo em dica, Pausado/Desativado cinza), atualizado em; busca por nome e filtro por situação; botão "Atualizar" (`RefreshCw`) com estado carregando; sem conexão: estado vazio com botão para a aba Conexão.
- Editor (painel lateral): título → nome gerado (editável), categoria (Marketing/Utilidade com explicação de uma linha), cabeçalho, corpo com botões de variável (`User`, `Church`, `CalendarDays`, `Type`) que inserem `{{n}}` na posição do cursor e pedem o exemplo, rodapé, botões de resposta rápida (até 3, `Plus`/`X`), contador de caracteres, erros de `validarRascunho` ao vivo; à direita `PreviaWhatsApp` (balão estilo WhatsApp com exemplos aplicados, botões abaixo).
- Ações: Criar (`<Permissao chave="whatsapp_oficial.modelos.criar" herda="whatsapp_oficial.modelos.view">`), Duplicar (abre o editor preenchido com nome `_copia`; mesma chave de criar), Excluir com confirmação no próprio painel (sem `window.confirm`) (`whatsapp_oficial.modelos.excluir`).

- [ ] **Step 1:** implementar.
- [ ] **Step 2:** `permissoes:arvore`/`check`, typecheck e lint dos arquivos tocados, testes unitários.
- [ ] **Step 3:** conferir no navegador: estado sem conexão; editor valida e mostra prévia; nenhum emoji na tela.
- [ ] **Step 4:** commit "WhatsApp oficial: aba Modelos com editor e prévia".

### Task 6: Documentação e fechamento

**Files:**
- Modify: `docs/modules/whatsapp-oficial.md` (central, modelos, rotas, cron `meta-modelos`, tarefa no Coolify), `/mnt/dados/projetos/FRONTBACK/docs_pdf_zionbyte/whatsapp-oficial-23-11.html` + PDF regerado (feito pelo controlador).

- [ ] **Step 1:** atualizar a documentação do módulo.
- [ ] **Step 2:** commit "WhatsApp oficial: documentação da Etapa 2".
