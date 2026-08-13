# Contas a Pagar — Plano de Desenvolvimento

Companheiro da [SPEC.md](./SPEC.md). Ordem de execução, arquivos tocados e
critério de pronto de cada fase.

Princípio que guia tudo: **migration aditiva**. Nenhuma tabela existente é
recriada, nenhuma coluna existente muda de tipo, nada é apagado. Os 331.484
lançamentos do `livro_caixa` só ganham duas colunas anuláveis.

---

## Fase 1 — Banco de dados

**Arquivo:** `prisma/migrations/20260812120000_contas_a_pagar/migration.sql`

1. `bancos`, `departamentos` (cadastros auxiliares).
2. `ALTER TABLE livro_caixa ADD COLUMN banco_id / departamento_id` (nullable,
   FK `ON DELETE SET NULL`, índices).
3. `tipos_despesa`, `credores`, `contas_pagar`, `parcelas_contas_pagar`,
   `pagamentos_parcela`.
4. Índices de leitura: `(church_id, data_vencimento)` e `(church_id, status)` nas
   parcelas, `(church_id, status_geral)` nas contas, `(parcela_id)` nos pagamentos.
5. Seed dos padrões: banco `Caixa (espécie)` e departamento `Geral (Igreja)`,
   ambos `is_default = true`, via `INSERT ... ON CONFLICT DO NOTHING`.

**Pronto quando:** migration aplicada e `SELECT` em cada tabela nova responde;
`livro_caixa` continua com 331.484 linhas e as duas colunas novas em NULL.

**Arquivo:** `prisma/schema.prisma` — models `Banco`, `Departamento`,
`TipoDespesa`, `Credor`, `ContaPagar`, `ParcelaContaPagar`, `PagamentoParcela`,
mais os dois campos novos em `LivroCaixa` e as relations inversas em `Church`,
`Member` e `User`.

**Pronto quando:** `npx prisma generate` passa e `npx prisma migrate diff`
não acusa divergência entre schema e banco.

---

## Fase 2 — Motor de regras (o núcleo)

**Arquivo:** `src/lib/contasPagarService.ts`

Funções puras (testáveis sem banco):

- `gerarParcelas({ valorTotal, numeroParcelas, primeiroVencimento, valoresManuais? })`
- `statusDaParcela({ valorParcela, valorPago, dataVencimento, cancelada, hoje })`
- `derivarStatusGeral(parcelas)`
- `validarPagamento({ valorPago, valorSaldo })`
- `numeroDaConta(ultimoNumero, ano)`

Funções transacionais (recebem o `tx` do Prisma):

- `recalcularParcela(tx, parcelaId)` → recalcula pago/saldo/status
- `recalcularConta(tx, contaId)` → recalcula `status_geral`
- `registrarPagamento(tx, dados)` → valida, insere, baixa no livro caixa, recalcula
- `estornarPagamento(tx, pagamentoId, motivo, usuario)` → marca, estorna a baixa, recalcula

**Pronto quando:** as funções puras têm cobertura no E2E (fase 8) e o
`registrarPagamento` roda inteiro dentro de uma transação — nunca deixa parcela
recalculada sem o lançamento do livro caixa, nem o inverso.

---

## Fase 3 — Cadastros auxiliares (nenhum dropdown fixo no código)

**Migration:** `prisma/migrations/20260812130000_listas_contas_a_pagar/migration.sql`
— `tipos_credor`, `naturezas_despesa`, `tipos_departamento`,
`tipos_conta_bancaria`, cada uma com `codigo`/`nome`/`ordem`/`ativo`/`is_default`
e conteúdo inicial editável.

**Arquivos:**
- `src/lib/lookupRegistry.ts` — entradas `bancos`, `departamentos` e as quatro
  listas acima; `LookupField` ganha `optionsFrom` para um select de um cadastro
  apontar para outro cadastro
- `src/app-ui/system/LookupCrud.tsx` — carrega as opções da lista de origem e
  filtra os itens inativos
- `src/app-ui/system/permissionCatalog.ts` — seis chaves `settings_*` novas
- `src/components/app-ui/SystemSettings.tsx` — seis cards em "Listas e Cadastros
  Auxiliares"

Sem código de CRUD novo: a API `/api/lookups/[key]` e a tela
`/app-ui/config/:lookupKey` já atendem por configuração.

**Pronto quando:** todo select do módulo (banco, departamento, tipo de credor,
natureza, tipo de departamento, tipo de conta, forma de pagamento) é alimentado
por um cadastro editável em Configurações — nenhuma opção fica no código.

---

## Fase 4 — API

**Arquivos** (todos `withAuth` + escopo de igreja no padrão de `/api/assets`):

```
src/app/api/contas-pagar/route.ts                      GET lista · POST cria (gera parcelas)
src/app/api/contas-pagar/[id]/route.ts                 GET · PATCH · DELETE (cancelamento lógico)
src/app/api/contas-pagar/[id]/aprovar/route.ts         POST aprovar/reprovar
src/app/api/contas-pagar/parcelas/route.ts             GET visão por parcela (filtros da tela)
src/app/api/contas-pagar/parcelas/[id]/route.ts        GET parcela + histórico de pagamentos
src/app/api/contas-pagar/parcelas/[id]/pagamentos/route.ts        POST registra pagamento
src/app/api/contas-pagar/pagamentos/[id]/estorno/route.ts         POST estorna
src/app/api/contas-pagar/relatorios/route.ts           GET agregações da aba 2
src/app/api/tipos-despesa/route.ts + /[id]/route.ts    CRUD (exclusão bloqueada se em uso)
src/app/api/credores/route.ts + /[id]/route.ts         CRUD
```

**Pronto quando:** cada rota responde 200 com escopo correto e 403 para usuário
de outra igreja; validações devolvem 400/409 com mensagem em português.

---

## Fase 5 — Banco e departamento no lançamento do Livro Caixa

**Arquivo:** `src/app-ui/finance/LancamentoNew.tsx`

Dois selects novos (carregados de `/api/lookups/bancos` e
`/api/lookups/departamentos`, filtrando `ativo`), pré-selecionados no
`is_default`, gravados junto com o lançamento. Sem mexer no resto do fluxo.

**Pronto quando:** um lançamento novo nasce com `banco_id` e `departamento_id`
preenchidos e o Livro Caixa mostra as colunas.

---

## Fase 6 — Tela de gestão

**Arquivos:**
```
src/app-ui/finance/ContasPagar.tsx              tela principal (2 abas + KPIs)
src/app-ui/finance/ContaPagarFormDrawer.tsx     nova/editar conta, com prévia das parcelas
src/app-ui/finance/ParcelaDetailModal.tsx       parcela + histórico + estorno
src/app-ui/finance/PagamentoModal.tsx           registrar pagamento (valor livre)
src/app-ui/finance/contasPagarLabels.ts         rótulos/cores de status, compartilhados
```

Registro: `src/spa/routes.tsx` (rota), `src/components/app-ui/AppUI.tsx`
(item do sidebar em Finanças + título da página),
`src/app-ui/system/permissionCatalog.ts` (chaves da fase 2.6 da spec).

**Pronto quando:** as duas abas carregam com dados de verdade, os filtros
combinam entre si, a exportação sai e as ações (lançar, pagar, aprovar,
estornar) funcionam ponta a ponta pela UI.

---

## Fase 7 — Troca de Dirigente (auto-preenchimento)

**Arquivos:**
- `src/app/api/churches/[id]/leader-snapshot/route.ts` (novo)
- `src/components/app-ui/Churches.tsx` (efeito de preenchimento + estado de carregando + botão "Recalcular")

Regra crítica: só preenche em **troca nova**; edição de registro histórico não é
tocada.

**Pronto quando:** abrir "Novo Dirigente" traz os seis números preenchidos,
mudar a data recalcula, e abrir "Editar Troca" não altera nada.

---

## Fase 8 — E2E com seed

**Arquivo:** `scripts/e2e-contas-a-pagar.mjs`

Os 14 cenários da §5 da spec. Importa `src/lib/contasPagarService.ts` de verdade
(padrão do `e2e-patrimonio.mjs`), cria seu próprio campo/regional/igreja/membros
com prefixo `[E2E]`, e limpa tudo no fim.

Uso: `npx tsx scripts/e2e-contas-a-pagar.mjs` (`--keep` preserva os dados).

**Pronto quando:** todos os checks passam com o banco real.

---

## Fase 9 — Fechamento

- `npx tsc --noEmit` limpo nos arquivos novos.
- `npx eslint` nos arquivos novos.
- `docs/modules/contas-a-pagar/MANUAL.md` — o passo a passo para a tesouraria da
  igreja (o entregável #4 do prompt original).
- Script opcional de backfill do histórico, com `--dry-run` por padrão.

---

## Riscos e como estão tratados

| Risco | Tratamento |
|---|---|
| Migration pesada na tabela de 331 mil linhas | só `ADD COLUMN` anulável (não reescreve a tabela no Postgres) e `CREATE INDEX` — sem `NOT NULL` e sem `DEFAULT` volátil |
| Divergência entre `valor_pago` gravado e a soma real dos pagamentos | `valor_pago`/`valor_saldo` são sempre reescritos por `recalcularParcela` dentro da transação; nenhuma rota grava esses campos direto |
| Pagamento gravado sem baixa no livro caixa (ou vice-versa) | tudo numa transação só |
| Estorno criando furo contábil | estorno é lógico nos dois lados e recalcula em cascata |
| Dado histórico ficar "errado" com banco/departamento inventados | fica NULL e aparece como "Não informado"; backfill é opcional e manual |
| Tela ficar lenta com muitas parcelas | paginação server-side, agregações no Postgres (não no cliente), índices da fase 1 |
