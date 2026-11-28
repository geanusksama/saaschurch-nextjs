# Comunicação unificada (fases 1–4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O número oficial (Meta) de cada campo passa a ser uma instância nas telas de Comunicação → Gestão: Envio em Massa e Cronograma com modelo aprovado, conversas e agente de IA recebendo e respondendo pelo oficial.

**Architecture:** Cada conexão Meta (`meta_whatsapp_conexoes`, uma por campo) ganha uma linha espelho em `whatsapp_instances` com `provider = 'meta'` e `campo_id`. As funções de envio de `whatsappSendService.ts` passam a desviar pelo `provider`: texto/mídia livre pela Meta só dentro da janela de 24 h; campanhas e jornadas oficiais enviam modelo. O webhook da Meta grava as mensagens recebidas nas mesmas `whatsapp_conversations`/`whatsapp_messages` por uma função comum extraída do webhook da Z-API, e o agente de IA segue a fila de hoje.

**Tech Stack:** Next.js 16 (rotas `src/app/api`), Prisma + supabaseAdmin (Postgres/Supabase), testes `node --test` com `.ts` direto (padrão de `scripts/teste-meta-whatsapp.mjs`), E2E `scripts/e2e-*.mjs`.

**Spec:** `docs/superpowers/specs/2026-11-27-comunicacao-unificada-meta-design.md`

## Global Constraints

- Sistema em produção em várias igrejas: quem só usa Z-API não pode notar diferença nenhuma (comportamento, telas, mensagens).
- Mensagem iniciada pela igreja no oficial só por **modelo aprovado** (`meta_whatsapp_modelos.status = 'APPROVED'` do mesmo campo). Texto/mídia livre no oficial só se a última mensagem **recebida** da pessoa na conversa tem menos de **24 h**.
- Isolamento: instância oficial só aparece/é usada por quem tem o **campo ativo** igual ao `campo_id` dela (master inclusive) — `src/lib/campoAtivo.ts`, `docs/architecture/ISOLAMENTO-CAMPO.md`.
- Disparar pelo oficial (campanha e ligar jornada) exige a chave nova **`whatsapp_oficial.enviar`** (rótulo "Enviar pelo WhatsApp oficial") — `<Permissao>` na tela e `exigirPermissao` na rota (AGENTS.md, regra nº 2; `npm run permissoes:arvore`).
- Campanha não mistura Z-API e oficial: todas as instâncias de uma campanha/jornada têm o mesmo `provider`.
- Jornadas no oficial: um modelo por etapa (`pastoral_journey_steps.meta_modelo_id`); `ai_polish` e mensagem de certificado ignorados no oficial.
- Teto mensal por campo (`meta_whatsapp_conexoes.teto_mensal`, mensagens/mês; null = sem teto): atingido, jornadas oficiais do campo param no mês e grava alerta `envio_pausado`.
- SAIR (SAIR, PARAR, STOP, CANCELAR, DESCADASTRAR — `ehPedidoDeSair` em `src/lib/meta/envio.ts`) recebido pelo oficial grava em `meta_whatsapp_exclusoes` e vale também para campanhas/jornadas **Z-API do mesmo campo**.
- Schema (AGENTS.md, regra nº 1): migration + `migrate resolve` + baseline regerado e copiado; **antes de publicar baseline novo, a Task 1 tem que estar concluída** (Ibirité cai com baseline novo — ver memória/ledger).
- `.env` local aponta para PRODUÇÃO (`ysibqnwgitakofehdxvd`): DDL só a da migration desta etapa.
- `findMany`/`select` sempre com `take`/`limit`. Rotas de tela com `no-store`.
- Com `next dev` rodando, alteração em `.tsx` numa gravação só. Typecheck com `NODE_OPTIONS=--max-old-space-size=4096`, um processo pesado por vez.

## Review Focus

- **Conversa sem mensagem recebida há > 24 h** (atendente responde pela Caixa, agente de IA atrasado): a Meta recusaria; esperado = não envia, erro claro "fora da janela de 24 h, use um modelo" — teste na Task 4.
- **Número só com Z-API tocando o código novo** (tick de campanha, jornada, webhook Z-API depois da extração): comportamento idêntico ao de hoje — testes de regressão nas Tasks 4, 6, 7.
- **Usuário de outro campo / master com outro campo ativo** pedindo a lista de instâncias, a campanha ou a conversa do oficial: não vê, 404 — testes nas Tasks 3 e 5.
- **Mesma mensagem recebida duas vezes pela Meta** (reentrega do webhook): uma linha só em `whatsapp_messages` (chave `metadata->>meta_message_id`) — teste na Task 7.
- **Modelo deixa de estar aprovado (PAUSED/DISABLED) com campanha/jornada rodando**: para aquele envio, marca erro, não manda texto livre no lugar — teste nas Tasks 5 e 6.

---

### Task 1: Pré-requisito — donos das tabelas no banco de Ibirité

Sem isto, todo baseline novo derruba Ibirité (27/11: `must be owner of …`, app em loop de reinício).

**Files:**
- Create: `docs/infra/IBIRITE-DONOS-DO-BANCO.md` (o que foi feito e como conferir)

- [ ] **Step 1:** Descobrir como chegar ao Postgres de Ibirité como superusuário (Supabase self-hosted no Coolify `coolify.ibirite.adcampinas.com.br`, VPS 189.24.15.192; token em `~/.coolify_ibirite_token`). Se só houver caminho com senha/SSH que o dono precisa fornecer, parar e pedir ao dono.
- [ ] **Step 2:** Listar donos: `select tableowner, count(*) from pg_tables where schemaname in ('public','app') group by 1;` (idem `pg_sequences`, `pg_views`, `pg_namespace` de `app`). Esperado: aparecer um dono diferente do usuário da `DATABASE_URL` do app.
- [ ] **Step 3:** Transferir para o usuário do app (`ALTER TABLE/SEQUENCE/VIEW … OWNER TO <usuário do app>`; `ALTER SCHEMA app OWNER TO …`), gerado por consulta ao catálogo, numa transação.
- [ ] **Step 4:** Repetir o Step 2. Esperado: um único dono (o do app). Registrar no doc.
- [ ] **Step 5:** Commit do doc.

### Task 2: Banco — colunas novas (aditivas)

**Files:**
- Create: `prisma/migrations/20261128000000_comunicacao_oficial/migration.sql`
- Modify: `prisma/schema.prisma` (modelos `MetaWhatsappConexao`, e os que existirem para as tabelas abaixo; tabelas só usadas via supabaseAdmin não precisam de modelo)
- Modify: `baseline/*` (regerado) e `../painelchurch/baseline/*`

**Interfaces — Produces (colunas):**
- `whatsapp_instances.provider text not null default 'zapi'` (`'zapi' | 'meta'`), `whatsapp_instances.campo_id uuid null` (FK `campos`, `on delete set null`), índice único parcial em `(provider, instance_id)`.
- `meta_whatsapp_conexoes.instancia_id uuid null` (FK `whatsapp_instances`, `on delete set null`), `meta_whatsapp_conexoes.teto_mensal integer null`.
- `whatsapp_campaigns.meta_modelo_id uuid null`, `whatsapp_campaigns.meta_variaveis jsonb null` (mapa `posição → origem`: `{"1":"nome","2":"igreja"}` ou texto fixo `{"3":{"fixo":"..."}}`).
- `pastoral_journey_steps.meta_modelo_id uuid null`.
- `whatsapp_messages`: nenhuma coluna; id da Meta vai em `metadata.meta_message_id`.

- [ ] **Step 1:** Escrever a migration (só `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, FKs em bloco `do $$ … exception when duplicate_object`).
- [ ] **Step 2:** Aplicar em produção (Campinas): `npx prisma db execute --file … && npx prisma migrate resolve --applied 20261128000000_comunicacao_oficial && npx prisma generate`. Conferir pelo `information_schema.columns` as 7 colunas.
- [ ] **Step 3:** Regerar baseline (cópia temporária do `dump-baseline.mjs` com caminhos `/mnt/dados/projetos`), conferir que o diff só traz as colunas novas, copiar para `saaschurch-nextjs/baseline/`.
- [ ] **Step 4:** Commit nos dois repositórios (não publicar ainda; publica junto com a Task 3).

### Task 3: Instância espelho do número oficial e isolamento por campo

**Files:**
- Create: `src/lib/meta/instanciaOficial.ts`
- Modify: `src/lib/meta/servicoConexao.ts` (ao conectar/desconectar), `src/lib/whatsappSendService.ts` (`getAccessibleInstanceIds`, `getActiveInstance`), `src/app/api/whatsapp/instances/route.ts`, `src/lib/whatsappCampo.ts` (`instanciasComCampo`: usar `campo_id` quando `provider = 'meta'`)
- Create: `scripts/backfill-instancia-oficial.mjs` (cria a instância das conexões já existentes)
- Test: `scripts/teste-meta-whatsapp.mjs`

**Interfaces — Produces:**
- `sincronizarInstanciaOficial(conexao: { id: string; campoId: string; phoneNumberId: string; numero: string | null; nomeExibicao: string | null; status: string; conectadoPor: string | null }): Promise<string>` → id da instância; upsert por `(provider='meta', instance_id='meta:' + phoneNumberId)`, `name = 'Oficial Meta – ' + numero`, `status = 'connected' | 'disconnected'`, `is_active` = conectado, grava `meta_whatsapp_conexoes.instancia_id`.
- `filtrarPorCampo<T extends { provider?: string; campo_id?: string | null }>(lista: T[], campoAtivo: string | null): T[]` — Z-API passa sempre; `meta` só se `campo_id === campoAtivo`.

- [ ] **Step 1:** Testes: `filtrarPorCampo` mantém todas as Z-API, só a oficial do campo ativo; campo ativo null ⇒ nenhuma oficial. `instanciasComCampo` devolve `campoId` da coluna para `provider='meta'`.
- [ ] **Step 2:** Rodar `node --test scripts/teste-meta-whatsapp.mjs` → FAIL.
- [ ] **Step 3:** Implementar; nas listas de instâncias e em `getAccessibleInstanceIds` aplicar o filtro com o campo ativo do usuário (master inclusive).
- [ ] **Step 4:** Testes passam; typecheck sem erro novo nos arquivos tocados.
- [ ] **Step 5:** Rodar o backfill em Campinas (número de teste) e conferir a linha em `whatsapp_instances` e `meta_whatsapp_conexoes.instancia_id`.
- [ ] **Step 6:** Commit; publicar Tasks 2+3 (Vercel e Coolify); conferir Ibirité no ar (`/auth/login` 200) e o log `banco … aplicando <versão nova>` sem erro.

### Task 4: Envio livre desviado pelo provider (janela de 24 h)

**Files:**
- Create: `src/lib/meta/envioLivre.ts`
- Modify: `src/lib/whatsappSendService.ts` (`sendTextViaZApi`, `sendImageViaZApi`, `sendAudioViaZApi`, `sendDocumentViaZApi`, `markMessageAsRead`)
- Test: `scripts/teste-meta-whatsapp.mjs`

**Interfaces — Consumes:** `whatsapp_instances.provider`, `meta_whatsapp_conexoes.instancia_id` (Task 2/3); `criarGraph`, `decifrar`.
**Produces:**
- `dentroDaJanela(ultimaRecebidaEm: Date | null, agora: Date): boolean` (24 h exatas).
- `enviarLivreMeta(instancia: { id: string }, para: string, conteudo: { tipo: 'texto' | 'imagem' | 'audio' | 'documento'; texto?: string; url?: string; nomeArquivo?: string }): Promise<SendMessageResult>`; fora da janela devolve `{ status: 'error', error: 'fora_da_janela_24h' }` sem chamar a Graph.
- As funções `send*ViaZApi` mantêm assinatura; se `instance.provider === 'meta'` chamam `enviarLivreMeta`. O tipo `WhatsAppInstance` ganha `provider?: string; campo_id?: string | null`.

- [ ] **Step 1:** Testes: `dentroDaJanela` (23h59 true, 24h01 false, null false); `enviarLivreMeta` com Graph falso — dentro da janela chama `/{phone_number_id}/messages` com `type: 'text'`; fora não chama e devolve `fora_da_janela_24h`; instância `zapi` não passa por `enviarLivreMeta` (regressão).
- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3:** Commit.

### Task 5: Envio em Massa com modelo

**Files:**
- Modify: `src/app/api/whatsapp/campaigns/route.ts` (criar), `src/lib/whatsappCampaignService.ts` (`processCampaignTick`), `src/app-ui/pastoral/PastoralMassSend.tsx`
- Create: `src/lib/meta/campanhaOficial.ts`
- Modify: `src/app-ui/system/permissionCatalog.ts`, `src/lib/permissoes/arvore.generated.ts`
- Test: `scripts/teste-meta-whatsapp.mjs`, `scripts/e2e-campanha-oficial.mjs` (novo)

**Interfaces — Produces:**
- `validarCampanhaOficial(entrada: { instancias: Array<{ provider: string; campo_id: string | null }>; campoAtivo: string; modelo: { status: string; campoId: string } | null; variaveis: Record<string, unknown> }): { ok: true } | { ok: false; erro: string }` — mistura de providers, modelo ausente/não aprovado/de outro campo, variável faltando ⇒ erro.
- `parametrosDoDestinatario(meta_variaveis, destinatario: { name: string | null; variables: Record<string, string> }, igrejaNome: string): string[]` (reaproveitar `montarParametros` de `src/lib/meta/envio.ts`).
- No tick: instância `meta` ⇒ pula quem está em `meta_whatsapp_exclusoes` do campo (status `skipped`), respeita limite diário do número (o mesmo cálculo do `servicoEnvio.ts`), envia modelo com `montarMensagemTemplate`; erro de modelo (códigos em `CODIGOS_PARAR_DISPARO`) pausa a campanha e grava alerta `envio_pausado`. Instância `zapi` inalterada, exceto pular exclusões do campo (Task 8).

- [ ] **Step 1:** Testes unitários de `validarCampanhaOficial` (5 casos acima) e `parametrosDoDestinatario`.
- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3:** Rota de criação: com instância oficial, `exigirPermissao(user, 'whatsapp_oficial.enviar')`, valida, grava `meta_modelo_id`/`meta_variaveis`; campanha cuja instância é de outro campo ⇒ 404.
- [ ] **Step 4:** Tela (gravação única do `.tsx`): ao escolher instância oficial, a caixa de mensagem vira seletor de modelo aprovado (GET `/api/meta/whatsapp/modelos`), prévia no balão, mapeamento das variáveis (Nome da pessoa / Nome da igreja / Texto fixo), aviso "Serão enviadas N mensagens pelo WhatsApp oficial; cada mensagem é cobrada pela Meta no cartão do campo." antes de disparar; botão de disparo dentro de `<Permissao chave="whatsapp_oficial.enviar" rotulo="Enviar pelo WhatsApp oficial" herda="whatsapp.campaigns">` (conferir no catálogo a chave que hoje decide o botão e usar como `herda`).
- [ ] **Step 4b (pedido do dono, 27/11):** na mesma gravação da tela:
  - Instância **Z-API** escolhida: aviso fixo "Envio em massa pela Z-API não é oficial: enviar muitas mensagens, ou mensagens parecidas em sequência, pode fazer o WhatsApp banir este número. Ao continuar, a igreja assume esse risco." + caixa obrigatória "Estou ciente e assumo o risco" (sem marcar, o botão de disparo fica desabilitado; o aceite é gravado em `whatsapp_campaigns.metadata.risco_zapi_aceito_por/em` se a coluna `metadata` existir — conferir; senão, só exigir na tela).
  - Instância **oficial** escolhida: texto fixo "Pelo WhatsApp oficial, toda mensagem enviada pela igreja segue um modelo aprovado pela Meta. Esse padrão é exigido pela Meta. Escolha um modelo aprovado abaixo ou crie um novo — ele passa pela aprovação da Meta antes de poder ser usado." + lista só de modelos `APPROVED` + botão **Criar modelo** que abre o editor existente (aba Modelos da central, `?aba=modelos&novo=1`) em nova guia, dentro de `<Permissao chave="whatsapp_oficial.modelos.criar" …>`.
- [ ] **Step 5:** `npm run permissoes:arvore`; `npm run permissoes:check` passa.
- [ ] **Step 6:** E2E `scripts/e2e-campanha-oficial.mjs`: cria campanha oficial com 2 destinatários (um em exclusão), roda 2 ticks com Graph falso, confere 1 `sent` + 1 `skipped`, conversa e mensagem gravadas; limpa tudo.
- [ ] **Step 7:** Commit.

### Task 5b: Sugerir modelo com IA (pedido do dono, 27/11)

**Files:**
- Create: `src/lib/meta/sugestaoModelo.ts`, `src/app/api/meta/whatsapp/modelos/sugerir/route.ts`
- Modify: editor de modelos da central (localizar o componente da aba Modelos em `src/app-ui/system/metaOficial/` — ler antes), `permissionCatalog.ts` + árvore
- Test: `scripts/teste-meta-whatsapp.mjs`

**Interfaces — Consumes:** `generateAiText` e `getAiConfig(campoId)` de `src/lib/aiConfig.ts` (ler a assinatura); `validarRascunho`/`normalizarRascunho` de `src/lib/meta/modelos.ts`.
**Produces:** `sugerirModelo(pedido: { descricao: string; categoria: 'MARKETING' | 'UTILITY'; igrejaNome: string }, gerar: (prompt: string) => Promise<string>): Promise<{ ok: true; rascunho: Rascunho } | { ok: false; erro: string }>` — o texto da IA é pedido em JSON (título, corpo com `{{1}}`… e exemplos, rodapé opcional, até 3 botões), passa por `normalizarRascunho` + `validarRascunho`; inválido ⇒ uma nova tentativa com o erro no prompt, depois `ok: false`.

- [ ] **Step 1:** Testes com `gerar` falso: JSON válido vira rascunho válido; corpo começando com variável é recusado e refeito; resposta que não é JSON ⇒ `ok: false` com mensagem clara.
- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3:** Rota `POST …/modelos/sugerir` (`exigirPermissao(user, 'whatsapp_oficial.modelos.criar')`, campo ativo, só devolve o rascunho — **não** cria na Meta). No editor, botão **Sugerir com IA** (campo "O que a mensagem deve dizer?") preenche o formulário para a pessoa revisar e enviar para aprovação como hoje. Chave `whatsapp_oficial.modelos.sugerir` com `herda="whatsapp_oficial.modelos.criar"`.
- [ ] **Step 4:** Commit.

### Task 6: Cronograma/jornadas com modelo e teto mensal

**Files:**
- Modify: `src/lib/pastoralJourneyService.ts` (envio da etapa ~linha 583–660 e `processJourneyTick`), tela do editor de etapas (`src/app-ui/pastoral/JourneyMatrixEditor.tsx` — ler antes) e rota que grava etapas (localizar pelo `from('pastoral_journey_steps').update`/`insert`)
- Create: `src/lib/meta/tetoMensal.ts`
- Modify: `src/app-ui/system/WhatsAppOficial.tsx` (campo "Teto mensal de mensagens" na aba Conexão) e rota `src/app/api/meta/whatsapp/config/route.ts` (gravar `teto_mensal`, permissão `whatsapp_oficial.enviar`)
- Test: `scripts/teste-meta-whatsapp.mjs`

**Interfaces — Produces:**
- `podeEnviarNoMes(teto: number | null, enviadosNoMes: number): boolean`.
- `contarEnviadosNoMes(campoId: string, agora: Date): Promise<number>` — mensagens `outbound` com `metadata.meta_message_id` das instâncias oficiais do campo desde o dia 1 (fuso America/Sao_Paulo).
- `previsaoMensal(jornada): Promise<number>` — inscritos ativos × etapas ativas restantes no mês (estimativa mostrada ao ligar).

- [ ] **Step 1:** Testes: `podeEnviarNoMes` (null sempre true; 99/100 true; 100/100 false); etapa sem `meta_modelo_id` em jornada oficial ⇒ envio vira erro "etapa sem modelo" (não manda texto); `ai_polish` ignorado no oficial; jornada Z-API idêntica (regressão).
- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3:** No tick: teto atingido ⇒ não envia, deixa o envio pendente para o mês seguinte e grava alerta `envio_pausado` uma vez por campo/mês.
- [ ] **Step 4:** Tela do editor (gravação única): quando a jornada tem instância oficial, cada etapa mostra o seletor de modelo aprovado; ligar a jornada mostra a previsão mensal e exige `whatsapp_oficial.enviar`.
- [ ] **Step 5:** Commit.

### Task 7: Conversas e agente de IA pelo número oficial

**Files:**
- Create: `src/lib/whatsappRecebida.ts` — extraído do webhook Z-API (busca/cria conversa, grava mensagem, atualiza conversa, recepção por QR, enfileira resposta do agente)
- Modify: `src/app/api/whatsapp/webhook/route.ts` (passa a chamar a função comum; sem mudança de comportamento), `src/lib/meta/servicoEnvio.ts` (`processarWebhook`: eventos `messages` ⇒ função comum; `statuses` ⇒ também atualiza `whatsapp_messages` por `metadata->>meta_message_id`)
- Create: `src/lib/meta/entradaMeta.ts` — converte mensagem da Meta (texto, imagem, áudio, documento, botão/resposta rápida, reação) no formato que a função comum recebe (mesma forma que `parseInbound` devolve)
- Test: `scripts/teste-meta-whatsapp.mjs`

**Interfaces — Produces:**
- `registrarMensagemRecebida(entrada: { instancia: { id: string; owner_user_id: string; metadata: unknown }; telefone: string; nomeRemetente: string | null; mensagem: { type: string; content: string; preview: string; mediaUrl: string | null; mediaMime: string | null; extra: Record<string, unknown> }; idExterno: string; chaveId: 'zapi_message_id' | 'meta_message_id' }): Promise<void>` — idempotente por `metadata->>chaveId`.
- `converterMensagemMeta(msg: unknown, contatos: unknown): { telefone, nomeRemetente, mensagem, idExterno } | null`.

- [ ] **Step 1:** Testes: `converterMensagemMeta` para texto, botão de resposta rápida, imagem (mídia vira id para buscar depois), tipo desconhecido ⇒ preview "[mensagem não suportada]"; idempotência (mesmo `idExterno` duas vezes ⇒ uma linha, com repositório falso).
- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3:** Extrair a lógica do webhook Z-API sem mudar nada do que ele faz (diff revisado linha a linha); teste de regressão com payload Z-API de texto gravando a mesma coisa que antes.
- [ ] **Step 4:** Mídia recebida pela Meta: baixar por `GET /{media_id}` com o token do campo e subir no mesmo storage que a Z-API usa (ler `parseInbound`/upload atual antes); áudio da pessoa segue o fluxo de transcrição atual.
- [ ] **Step 5:** Resposta do agente sai pelas funções da Task 4 (texto e áudio pela Meta dentro da janela). Teste real com o número de teste: mandar mensagem do celular do dono para o número de teste, ver a conversa na Caixa e a resposta do agente chegar.
- [ ] **Step 6:** Commit.

### Task 8: SAIR vale para os dois caminhos do campo

**Files:**
- Create: `src/lib/meta/exclusoesCampo.ts`
- Modify: `src/lib/whatsappCampaignService.ts`, `src/lib/pastoralJourneyService.ts`
- Test: `scripts/teste-meta-whatsapp.mjs`

**Interfaces — Produces:** `telefonesExcluidos(campoId: string, telefones: string[]): Promise<Set<string>>` (compara pelos últimos 8 dígitos, como `pastoralDuplicateCheck`).

- [ ] **Step 1:** Testes: telefone excluído no oficial é pulado em campanha/jornada Z-API **do mesmo campo** (status `skipped`, motivo "pediu para sair"); de outro campo não é afetado; instância Z-API sem campo (sem agente de recepção) não consulta exclusões (comportamento de hoje).
- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3:** Commit.

### Task 9: Fechamento — central, documentação e publicação

**Files:**
- Modify: `src/app-ui/system/MetaOficial.tsx` (aba "Envio" vira atalho para Comunicação → Gestão → Envio em Massa; abas Modelos/Conexão/App continuam), `docs/modules/whatsapp-oficial.md` (seção nova "Comunicação unificada"), `vercel.json` (sem cron novo; conferir)
- Test: todos

- [ ] **Step 1:** `node --test scripts/teste-meta-whatsapp.mjs` (todos), E2E de escrita das Tasks 5 e 7, `npm run permissoes:check`, typecheck filtrado, eslint nos arquivos tocados.
- [ ] **Step 2:** Rodar a skill `code-review` e corrigir o que for real.
- [ ] **Step 3:** Commit, push; conferir Campinas e Ibirité no ar e o log do migrate-self em Ibirité.
- [ ] **Step 4:** Roteiro do dia da troca para o dono (desligar Z-API do número de Campinas → conectar na Meta → conferir instância oficial, envio de teste, conversa, agente).
