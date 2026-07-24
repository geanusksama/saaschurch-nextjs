# SPEC — Envio Automático Agendado do Relatório Contábil (WhatsApp)

> Baseado nos requisitos funcionais RF001–RF013 fornecidos pelo usuário em 2026-07-24.
> Complementa o módulo existente [`docs/modules/.. contabilidade (acesso externo)`] —
> ver memória `project_contabilidade_relatorio` e `src/lib/contabilidadeService.ts`.
> Status: implementado nesta sessão · migration **não aplicada** (ver seção Deploy).

## Objetivo

Automatizar o envio periódico do relatório contábil (resumo financeiro + CSV do livro
caixa) via WhatsApp aos contadores já cadastrados em `contabilidade_acessos`, com
agendamento configurável (dia/hora/frequência), definição do período (mês corrente, mês
anterior ou com GAP de meses) e — o requisito central — **comparação automática** entre o
que foi enviado desta vez e o que havia sido enviado da última vez para o mesmo período,
sinalizando lançamentos que desapareceram.

Importante (pedido explícito do usuário): isto **não é polling do frontend**. O disparo é
dirigido por relógio (cron), não por um cliente ficando perguntando "já é hora?" a cada
poucos segundos. Ver "Serviço de agendamento" abaixo.

## Onde fica na UI

Novo card na tela **Configurações do Sistema** (`SystemSettings.tsx`), dentro de uma nova
seção "Contabilidade" (ícone `Calculator`), apontando para
`/app-ui/system/contabilidade-agendamentos`.

Permissão: nova chave `contabilidade_agendamentos` (grupo Comunicação/Contabilidade em
`permissionCatalog.ts`, visível a `master`/`admin`).

Tela `ContabilidadeAgendamentos.tsx` (RF001): tabela com todos os registros de
`contabilidade_acessos` (nome, campo, telefone, status, último envio, próximo envio) +
menu de ações (⋮) que abre `ContabilidadeAgendamentoModal.tsx` (RF002/003/004) e um botão
"Histórico" que abre `ContabilidadeHistoricoDrawer.tsx` (RF009–RF011).

## Modelo de dados (migration nova, aditiva — não toca em tabelas existentes)

`supabase/migrations/20260724_contabilidade_agendamentos.sql`

### `contabilidade_agendamentos` (RF002/RF003/RF004 — config 1:1 por contador)

| coluna | tipo | notas |
|---|---|---|
| id | uuid pk | |
| acesso_id | uuid fk → `contabilidade_acessos(id)` | unique — 1 config por contador |
| ativo | boolean | liga/desliga o envio automático |
| frequencia | text | `mensal` \| `semanal` \| `manual` |
| dia_envio | int | dia do mês (1–28) para `mensal`; dia da semana (0=domingo) para `semanal` |
| hora_envio | time | horário local |
| timezone | text | default `America/Sao_Paulo` |
| tipo_periodo | text | `mes_corrente` \| `mes_anterior` \| `gap` (RF003) |
| gap_meses | int | usado quando `tipo_periodo='gap'` (RF003/RF004) |
| qtd_meses | int | quantos meses consecutivos enviar a partir do período calculado (RF004) |
| proximo_envio | timestamptz | calculado pelo serviço, é o que o cron consulta |
| ultimo_envio | timestamptz | |
| created_by / updated_by | text | email do usuário (RF013) |

### `contabilidade_envios_historico` (RF011)

Uma linha por disparo (automático ou manual): `agendamento_id`, `acesso_id`,
`disparado_em`, `tipo` (`automatico`\|`manual`), `gap_meses`, `qtd_meses`, `periodos`
(jsonb: lista de `{ano,mes,qtd_registros,qtd_divergencias,versao}`), `status`
(`sucesso`\|`erro`\|`parcial`), `tempo_processamento_ms`, `total_registros`,
`total_divergencias`, `erro`, `whatsapp_message_id`.

### `contabilidade_periodos_enviados` (RF008/RF012 — snapshot para comparação)

Uma linha por **versão** de um período enviado: `acesso_id`, `ano`, `mes`, `versao`
(incrementa a cada reenvio do mesmo ano/mês), `lancamento_ids` (jsonb — array dos uuids do
`livro_caixa` que entraram naquele envio), `qtd_registros`, `enviado_em`, `historico_id`.
`UNIQUE(acesso_id, ano, mes, versao)`.

A comparação (RF008/RF012) é sempre feita contra a **última versão** daquele
`acesso_id + ano + mes`: `ids_ausentes = ids_versao_anterior − ids_versao_atual`. Isso é o
que detecta lançamentos que existiam e desapareceram (excluídos ou alterados de período).

### Auditoria (RF013)

Não criamos tabela nova para isso — reaproveitado o que já existe:
- **Alterações de configuração**: `withAuth` já grava automaticamente em `prisma.auditLog`
  toda mutação (POST/PATCH/DELETE) autenticada, incluindo quem fez e o payload
  (`src/lib/auth.ts` → `logMutationAudit`). As rotas de config deste módulo passam por
  `withAuth`, então isso já funciona sem código extra.
- **Resultado do envio, erros, divergências, confirmação**: já registrado em
  `contabilidade_envios_historico` (uma linha por disparo, com status/erro/whatsapp_message_id).

## Serviço — `src/lib/contabilidadeAgendamentoService.ts`

- `calcularPeriodos(agendamento, referencia)` → array de `{ano, mes}` a partir de
  `tipo_periodo` + `gap_meses` + `qtd_meses` (RF003/RF004).
- `calcularProximoEnvio(agendamento, apos)` → próxima `timestamptz` respeitando
  `frequencia`/`dia_envio`/`hora_envio`/`timezone`.
- `gerarPeriodo(campo, ano, mes)` → reutiliza `buscarLancamentosEmBlocos` de
  `contabilidadeService.ts` (RF005: reaproveita o relatório contábil já existente) e
  devolve `{ csvRows, ids, total }` para aquele mês.
- `compararComVersaoAnterior(acessoId, ano, mes, idsAtuais)` → busca a última versão em
  `contabilidade_periodos_enviados` e devolve `{ anterior, atual, ausentes: string[] }`
  (RF008).
- `montarResumoFinanceiro(periodos)` / `montarResumoDivergencias(periodos)` → textos da
  mensagem (RF009).
- `processarAgendamento(agendamento, tipo: 'automatico'|'manual')` → orquestra RF005–RF010:
  gera CSV consolidado dos períodos, sobe em `supabase.storage` (bucket `dados`, mesmo
  bucket usado pelos outros uploads do sistema), monta a mensagem, chama
  `quickSendWhatsApp` (módulo WhatsApp existente, `profileType: 'master'` para poder usar
  qualquer instância conectada), grava `contabilidade_envios_historico` +
  `contabilidade_periodos_enviados` (nova versão) e atualiza `ultimo_envio`/`proximo_envio`.

## Serviço de agendamento (RF007) — cron externo, não polling

Este projeto **não tem cron interno rodando dentro do processo Next.js** — o padrão já
usado (`santander-sync.job.ts`) é expor uma rota de job e deixar um cron externo (Vercel
Cron Jobs, cron-job.org, etc.) chamá-la 1x por minuto. Seguimos o mesmo padrão:

`GET /api/cron/contabilidade` — protegida por `CRON_SECRET`. Aceita `Authorization: Bearer
<secret>` (formato que o **Vercel Cron Jobs** injeta sozinho quando existe uma env var
chamada `CRON_SECRET` — não dá pra configurar headers custom em `vercel.json`) ou
`x-cron-secret: <secret>` (para chamada manual/curl ou cron externo tipo cron-job.org). A
cada chamada:

1. Busca `contabilidade_agendamentos` com `ativo=true AND proximo_envio <= now()`.
2. Para cada um, chama `processarAgendamento(agendamento, 'automatico')`.
3. Cada processamento recalcula e grava o `proximo_envio` seguinte — **mesmo em caso de
   erro**, para não travar o agendamento reprocessando o mesmo minuto pra sempre (o erro
   fica registrado no histórico com `status='erro'` e pode ser reenviado manualmente).

Isso satisfaz o requisito do usuário: o disparo acontece na data/hora configurada porque o
cron externo bate no endpoint todo minuto e o endpoint só age quando `proximo_envio` já
passou — não é o frontend nem nenhum processo do app ficando em loop de poucos segundos.

**Deploy — 100% Vercel, sem serviço externo** (plano Pro confirmado, dá pra usar granularidade
de 1 minuto):

- `vercel.json` na raiz já criado com `{ "crons": [{ "path": "/api/cron/contabilidade",
  "schedule": "* * * * *" }] }`.
- Env var `CRON_SECRET` precisa existir nas Environment Variables do projeto na Vercel
  (mesmo valor gerado localmente em `.env.local`) — é o nome que a Vercel reconhece pra
  injetar `Authorization: Bearer <valor>` sozinha em toda chamada de cron, sem precisar
  configurar headers custom.

## Rotas de API

| Rota | Método | RF |
|---|---|---|
| `/api/contabilidade/agendamentos` | GET | RF001 — lista contadores + config + status |
| `/api/contabilidade/agendamentos/[acessoId]` | GET/PUT | RF002/003/004 — ler/salvar config |
| `/api/contabilidade/agendamentos/[acessoId]/enviar-agora` | POST | RF002 (frequência manual / reenvio) |
| `/api/contabilidade/agendamentos/[acessoId]/historico` | GET | RF011 |
| `/api/contabilidade/agendamentos/[acessoId]/historico/[historicoId]` | GET | RF009/RF010 — detalhe + divergências por período |
| `/api/cron/contabilidade` | GET | RF007 |

Todas as rotas `/api/contabilidade/agendamentos/*` passam por `withAuth` (auditoria
automática de config). A rota de cron **não** usa `withAuth` (não há usuário logado
chamando) — usa o secret de header.

## Migration — nota de produção

Igual ao módulo anterior (`contabilidade_acessos`): o `.sql` foi criado mas **não
aplicado**. Sistema em produção — combinar com o usuário quando/como aplicar (mesma regra
de `feedback_producao_confirmar_antes`). Os 3 `CREATE TABLE` são aditivos e não alteram
nada existente.
