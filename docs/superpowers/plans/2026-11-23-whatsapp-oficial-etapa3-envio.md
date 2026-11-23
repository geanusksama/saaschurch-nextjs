# WhatsApp Oficial — Etapa 3: Envio em massa — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada campo dispara modelos aprovados para membros e para quem procurou a igreja, em fila por lotes que respeita o limite diário e a qualidade, com acompanhamento por pessoa e lista de exclusão (SAIR).

**Architecture:** Regras puras (público, telefone, variáveis, SAIR, lote) em `src/lib/meta/envio.ts`; serviço com dependências injetadas (`servicoEnvio.ts`) e repositório Prisma (`envioRepo.ts`); três tabelas por campo; cron por minuto processa a fila; o webhook de Campinas (já verificado pela Meta) passa a gravar status de mensagem e SAIR; aba "Envio" da central Meta Oficial, no padrão visual das listagens.

**Tech Stack:** Next.js 16 + SPA react-router, Prisma 6, Supabase Postgres, Graph API v27.0 (`POST /<PHONE_NUMBER_ID>/messages`, `type: template`), lucide-react, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-23-whatsapp-oficial-meta-design.md` (seção "3. Envio em massa", "Decisões minhas" — Sair da lista, e "Decidido pelo dono" — quem recebe).

## Global Constraints

- **Nada pode gerar cobrança no cartão do dono** (pedido de 23/11): testes só com o número de teste da Meta (+1 555 164-9830) e só para destinatários cadastrados no painel; nenhum envio por número real; nenhuma configuração de pagamento.
- Módulo Z-API intocado (nenhum arquivo `src/lib/whatsapp*.ts`, `src/lib/zapi*.ts`, `src/app/api/whatsapp/**`, tabela `whatsapp_*`).
- Tudo por campo (`user.campoId` nas rotas; `campo_id` nas tabelas; webhook acha o campo pelo `phone_number_id`).
- Público: membros do campo (`members`: `fullName`, `preferredName`, `phone`, `churchId`, `campoId`, `membershipStatus`, `ecclesiasticalTitle`, `birthDate`) e interessados (`leads`: `fullName`, `phone`, `source`, `churchId`, `createdAt`). Filtros: membros — igreja, situação, título eclesiástico, aniversariantes do mês; interessados — origem, período de cadastro. Sem telefone válido ou na lista de exclusão ⇒ fora. Mesmo telefone nunca duas vezes no mesmo disparo.
- Telefone: normalizar para E.164 BR só com dígitos (`55` + DDD + celular de 9 dígitos começando com 9); fixo ou inválido ⇒ fora (contado como "sem celular válido").
- Só modelos com status `APPROVED` do próprio campo. Variáveis: `nome` ⇒ `preferredName` ou primeiro nome de `fullName`; `igreja` ⇒ nome da igreja do contato; `data` e `livre` ⇒ valor digitado no disparo.
- Fila: cron a cada minuto (`* * * * *`), lote de até 60 mensagens por campo por execução, prazo total 45 s, concorrência por campo 1; nunca passa do limite diário restante (limite do número − envios das últimas 24 h do campo). Limite acabou ⇒ disparo fica "aguardando limite" e continua sozinho no dia seguinte.
- Para sozinho (status `pausado` com motivo) e grava `meta_alertas` quando: qualidade do número RED; erro da Meta de bloqueio/conta (códigos 131031, 131042, 368, 190); erro de pagamento (131042). Erro por pessoa (ex.: 131026 não é usuário do WhatsApp) ⇒ só aquela pessoa falha.
- Webhook (`src/app/api/meta/whatsapp/webhook/route.ts`, já valida assinatura): `statuses` ⇒ atualiza envio pelo `wamid` (sent/delivered/read/failed, nunca regride); `messages` de texto com SAIR, PARAR, STOP, CANCELAR ou DESCADASTRAR (sem diferenciar maiúsculas/acentos, mensagem inteira após trim) ⇒ entra na lista de exclusão do campo. Sempre responde 200 rápido; erro interno não vira 500 para a Meta.
- Permissões: `whatsapp_oficial.envio.view` (herda `whatsapp_oficial.view`), `.criar` e `.controlar` (pausar/retomar/cancelar) herdam `.envio.view`; `exigirPermissao` nas rotas com a mesma chave.
- AGENTS.md regra nº 1: 3 tabelas novas ⇒ migration + `migrate resolve` + baseline nos dois repos — **DDL só depois do "pode aplicar" do dono**.
- `findMany` sempre com `take` e `orderBy`; contagem de público com `count`, nunca carregando todos; inserção dos envios em lotes (`createMany` de até 1000).
- Transação interativa proibida (pooler); usar `$transaction([...])` em array ou comandos únicos.
- Visual: padrão das listagens (mesmas classes da central Meta Oficial já ajustada em b694711; `docs/architecture/GUIA-ESTILO-SILAS.md`), dark:, ícones só lucide-react, **nenhum emoji**.
- `next dev` rodando: cada `.tsx` numa gravação só; um processo pesado por vez; tsc só dos arquivos tocados com `NODE_OPTIONS=--max-old-space-size=3072`. Testes: `node --test scripts/teste-meta-whatsapp.mjs` (89 hoje, acrescentar).
- Commits em pt-BR terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sem push, sem `git add -f`, nada de `.superpowers/` no commit.

## Review Focus

- Mesmo telefone em membro e interessado (ou dois membros) ⇒ entra uma vez só. (Teste na Task 1.)
- Pessoa responde "Sair " ou "SAÍR" ⇒ entra na exclusão; "quero sair do grupo" não entra (frase inteira). (Teste na Task 1.)
- Limite diário de 250 já usado por outro disparo do mesmo campo ⇒ novo disparo fica "aguardando limite" sem enviar. (Teste na Task 2.)
- Webhook chega com `delivered` depois de `read` ⇒ status continua `read`. (Teste na Task 2.)
- Cancelar no meio ⇒ nenhum envio novo sai no próximo minuto; os já enviados continuam com status atualizado. (Teste na Task 2.)

---

### Task 1: Regras puras do envio

**Files:** Create `src/lib/meta/envio.ts`; Test `scripts/teste-meta-whatsapp.mjs`.

**Interfaces (Produces):**
- `normalizarTelefoneBR(bruto: string | null): string | null`
- `ehPedidoDeSair(texto: string): boolean`
- `primeiroNome(fullName: string, preferredName?: string | null): string`
- `type Contato = { origem: 'membro' | 'interessado'; refId: string; nome: string; telefone: string; igrejaNome: string }`
- `deduplicarPorTelefone(contatos: Contato[]): Contato[]` (mantém o primeiro; membro antes de interessado)
- `montarParametros(variaveis: VariavelModelo[], contato: Contato, valores: { data?: string; livre?: string }): { header?: string[]; body: string[] }` (posicao 0 = cabeçalho)
- `montarMensagemTemplate(telefone, modeloNome, idioma, params): unknown` (corpo do `POST /messages`)
- `tamanhoDoLote(limiteRestante: number, pendentes: number, maxLote = 60): number`
- `const CODIGOS_PARAR_DISPARO = [131031, 131042, 368, 190]`

- [ ] Testes que falham (casos do Review Focus + telefones: `(19) 99212-6683`→`5519992126683`, `19 3333-4444` (fixo, sem 9) → null; `+55 19 99212-6683` e `5519992126683` → `5519992126683`; `123`→null; nome preferido vence; montarParametros com nome+igreja; tamanhoDoLote(0, 100)=0, (250, 10)=10, (250,100)=60).
- [ ] Implementar; testes PASS; commit "WhatsApp oficial: regras do envio em massa".

### Task 2: Tabelas, serviço, fila e webhook

**Files:** Modify `prisma/schema.prisma`; Create migration `20261124040000_meta_whatsapp_envio/migration.sql`, `src/lib/meta/envioRepo.ts`, `src/lib/meta/servicoEnvio.ts`, `src/lib/meta/depsEnvio.ts`; Modify `src/app/api/meta/whatsapp/webhook/route.ts`; Create `src/app/api/cron/meta-envio/route.ts`; Modify `vercel.json`.

**Tabelas:**
- `meta_whatsapp_disparos`: id uuid pk, campo_id fk campos cascade, modelo_id fk meta_whatsapp_modelos (set null), modelo_nome, idioma, categoria, nome text, filtros jsonb, valores jsonb, status text (`agendado|enviando|aguardando_limite|pausado|concluido|cancelado`), motivo text null, agendado_para timestamptz null, total int, enviados int, entregues int, lidos int, falhos int, criado_por uuid fk users set null, criado_em, atualizado_em; index (campo_id, criado_em desc); RLS.
- `meta_whatsapp_envios`: id uuid pk, disparo_id fk cascade, campo_id, origem text, ref_id text, nome text, telefone text, parametros jsonb, status text (`pendente|enviado|entregue|lido|falhou|ignorado`), wamid text null, erro_codigo int null, erro text null, enviado_em, atualizado_em; unique (disparo_id, telefone); unique (wamid) where wamid is not null; index (disparo_id, status), (campo_id, enviado_em); RLS.
- `meta_whatsapp_exclusoes`: id uuid pk, campo_id fk cascade, telefone text, motivo text, criado_em; unique (campo_id, telefone); RLS.

**Serviço (deps injetadas, como servicoModelos):** `contarPublico(campoId, filtros)`, `criarDisparo(campoId, userId, entrada)` (valida modelo APPROVED do campo, monta público com `deduplicarPorTelefone` excluindo lista de exclusão, grava disparo + envios em lotes), `processarFila(campoId, agora)` (lote = `tamanhoDoLote`, envia, grava wamid/erro, atualiza contadores, aplica regras de parada), `pausar/retomar/cancelar`, `aplicarStatusWebhook(evento)`, `registrarSair(phoneNumberId, telefone)`, `limiteRestante(campoId)` (limite do número via status já existente − enviados 24 h).

- [ ] Testes que falham do serviço (deps falsas) cobrindo o Review Focus 3–5, parada por 131042, erro 131026 só falha a pessoa, webhook ignora evento de outro phone_number_id.
- [ ] Migration escrita (NÃO aplicar), schema, repo, serviço, webhook, cron (CRON_SECRET; P2021 ⇒ 200 tabela ausente; sem disparos ativos ⇒ 200 cedo), `vercel.json` cron `* * * * *`.
- [ ] Testes PASS, tsc dos tocados; commit "WhatsApp oficial: fila do envio em massa e status pelo webhook".

### Task 3: Rotas e permissões

**Files:** Create `src/app/api/meta/whatsapp/envio/route.ts` (GET lista, POST cria), `src/app/api/meta/whatsapp/envio/publico/route.ts` (POST conta público com filtros, sem gravar), `src/app/api/meta/whatsapp/envio/[id]/route.ts` (GET detalhe paginado, PATCH acao=pausar|retomar|cancelar), `src/app/api/meta/whatsapp/envio/opcoes/route.ts` (igrejas do campo, títulos, origens, modelos aprovados, limite restante); `scripts/e2e-meta-whatsapp.mjs`.

- [ ] Chaves: GET/publico/opcoes → `whatsapp_oficial.envio.view`; POST → `.envio.criar`; PATCH → `.envio.controlar`. Corpo validado por função pura; 400 com `erros[]`. Disparo de outro campo ⇒ 404.
- [ ] e2e: 401 sem token nas rotas; 404 disparo de outro campo; 400 corpo inválido.
- [ ] commit "WhatsApp oficial: rotas do envio em massa".

### Task 4: Aba Envio

**Files:** Create `src/app-ui/system/metaOficial/Envio.tsx`, `NovoDisparo.tsx`, `DetalheDisparo.tsx`; Modify `MetaOficial.tsx` (aba envio usa `Envio`; declara as 3 chaves com `definirPermissao`), `src/app-ui/system/metaOficial/VisaoGeral.tsx` (passo "Primeiro disparo" se simples).

- [ ] Lista de disparos (tabela no padrão das listagens; cartões no celular) com barras enviado/entregue/lido/falhou e selo de status (lucide).
- [ ] Novo disparo em 3 passos (Público com contagem ao vivo; Modelo aprovado + valores de data/livre com prévia no balão — reusar `PreviaWhatsApp`; Revisão com quantidade, limite restante, aviso de custo pela categoria sem valor, recomendação do 1º disparo de boas-vindas com opção de sair; Disparar agora / Agendar). Sem conexão ou sem modelo aprovado ⇒ estado vazio com atalho.
- [ ] Detalhe: contadores, lista por pessoa paginada, Pausar/Retomar/Cancelar com confirmação no painel.
- [ ] `<Permissao>` em cada ação; `permissoes:arvore`/`check`; eslint/tsc; commit "WhatsApp oficial: aba Envio".

### Task 5: Documentação

- [ ] `docs/modules/whatsapp-oficial.md` seção Etapa 3 (tabelas, fila, regras de parada, SAIR, cron `meta-envio` e Scheduled Task no Coolify, permissões, teste só com número de teste). Commit.
