# Contas a Pagar — Especificação

Status: aprovado para implementação · Data: 12/08/2026
Origem: `docs/prompt-modulo-contas-a-pagar.md` + decisões da conversa de 12/08/2026.

Esta spec cobre **três entregas** que foram pedidas juntas porque se cruzam:

| # | Entrega | Por que está aqui |
|---|---------|-------------------|
| 1 | Módulo **Contas a Pagar** (novo item no sidebar de Finanças) | entrega principal |
| 2 | Cadastro de **Bancos** e **Departamentos** + uso no lançamento | contas a pagar precisa dizer "de qual banco sai" e "de qual departamento é a despesa"; o Livro Caixa também passa a ter isso |
| 3 | **Auto-preenchimento** do modal de Troca de Dirigente | os números da transição (caixa, médias, membros, obreiros) já existem no banco e hoje são digitados à mão |

---

## 0. Realidade do sistema (levantada no código, não suposta)

O prompt original foi escrito genericamente ("Supabase, RLS, tenant_id"). O que
o repositório tem de fato é diferente em três pontos, e a implementação segue o
que existe:

| O prompt dizia | O que o sistema realmente usa | Decisão |
|---|---|---|
| `tenant_id` em toda tabela | `church_id` → `regional_id` → `campo_id` (`prisma/schema.prisma:90`) | usar `church_id` |
| RLS no Supabase | RLS está **desligado** (`pg_class.relrowsecurity = false` em `livro_caixa`, `assets`, `churches`, `members`); o isolamento é feito na camada de aplicação por `withAuth` + escopo de igreja (ver `src/app/api/assets/route.ts:26-49`) | seguir o padrão da aplicação: `withAuth` + `isRestrictedToOwnChurch` + filtro por campo/regional/igreja. Não introduzir RLS só neste módulo — isso daria falsa sensação de segurança e quebraria as rotas existentes |
| "módulo financeiro/tesouraria, se existir" | existe: tabela `livro_caixa` com **331.484 registros** | a baixa contábil grava no `livro_caixa`, não numa tabela nova |
| "categorias de despesa" | já existe `plano_de_contas` (receita/despesa) e `centro_de_custo` | `tipos_despesa` **referencia** o plano de contas em vez de duplicá-lo |

Outros fatos apurados no banco:

- `livro_caixa.centro_de_custo` é praticamente constante: `'igreja'` em 321.381
  linhas, `NULL` em 10.102, `'Igreja'` em 1. **Não serve** como departamento.
- `livro_caixa.conta_caixa` **não é** o banco, apesar do nome sugerir. Medido no
  banco em 12/08/2026:

  | Valor | Lançamentos | Igrejas distintas |
  |---|---|---|
  | `CONTA CAIXA - AD CAMPINAS SEDE` | 321.367 | **105** |
  | `NULL` | 10.104 | 88 |
  | `CASH ACCOUNT - AD CAMPINAS HEADQUARTERS` | 15 | 2 |

  O mesmo rótulo aparece em 105 igrejas diferentes — é um texto fixo herdado da
  importação do sistema legado, não identifica conta nem igreja. E já está
  abandonado: nos últimos 60 dias entraram 4.751 lançamentos com `conta_caixa`
  vazio contra 19 preenchidos, porque a tela de lançamento atual
  (`LancamentoNew.tsx`) nem grava nesse campo.

  Decisão: `conta_caixa` fica **intocado** como dado histórico, e `banco_id` é
  o campo novo que diz de qual conta bancária/caixa real o dinheiro saiu ou
  entrou. Não há migração de um para o outro — não haveria o que migrar.
- `financial_accounts` e `financial_categories` existem no schema mas estão
  **vazias (0 linhas)** e sem tela — são resquício de um modelo antigo. Não
  reutilizar; usar as tabelas novas em português, coerentes com
  `plano_de_contas` / `forma_pagamento` / `centro_de_custo`.
- Front-end: SPA em `src/spa/routes.tsx`, telas em `src/app-ui/**`, gráficos em
  **recharts** (padrão das telas de finanças), tabelas com filtros no padrão de
  `src/app-ui/assets/AssetsList.tsx`, permissões via `usePermissions` +
  `permissionCatalog.ts`.

---

## 1. Cadastro de Bancos e Departamentos

### 1.0 Nada de dropdown fixo no código

Requisito explícito: **todo select do sistema precisa ter cadastro** em
Configurações › Listas e Cadastros Auxiliares. A igreja cria, renomeia e
desativa opção sem depender de deploy.

Além de Bancos e Departamentos, entram como cadastro:

| Lista | Tabela | Alimenta |
|---|---|---|
| Tipos de Credor | `tipos_credor` | `credores.tipo_credor` |
| Naturezas de Despesa | `naturezas_despesa` | `tipos_despesa.natureza` |
| Tipos de Departamento | `tipos_departamento` | `departamentos.tipo` |
| Tipos de Conta Bancária | `tipos_conta_bancaria` | `bancos.tipo_conta` |
| Formas de Pagamento | `forma_pagamento` (já existia) | pagamento da parcela |

Cada uma tem `codigo` (o que fica gravado no registro de negócio, estável) e
`nome` (o rótulo lido pelo usuário, renomeável sem afetar dado já lançado).

Para que um select de um cadastro aponte para outro cadastro, `LookupField`
ganhou `optionsFrom: { lookupKey, valueField, labelField }`
(`src/lib/lookupRegistry.ts`) e a tela genérica `LookupCrud.tsx` passou a
carregar essas opções da lista de origem, filtrando os itens inativos.

**Única exceção, e é proposital:** os *status* (`PENDENTE`, `PARCIAL`, `PAGO`,
`ATRASADO`, `CANCELADA`) e os status de aprovação continuam em código. Eles não
são escolha do usuário — são resultado do motor de recálculo de saldo e
vencimento. Um status cadastrado à mão seria um valor que
`recalcularParcela()` nunca saberia produzir, e a tela mostraria um estado que
o sistema não consegue alcançar.

### 1.1 Decisão de arquitetura

Bancos e Departamentos entram como **listas auxiliares (lookups)**, o mesmo
mecanismo que já serve Plano de Contas, Formas de Pagamento, Tipos de Documento,
Centros de Custo e Zonas (`src/lib/lookupRegistry.ts` + `/api/lookups/[key]` +
tela genérica `/app-ui/config/:lookupKey`).

Motivo: CRUD, tela, permissão e allowlist de SQL já existem e são testados. Um
cadastro dedicado seria ~600 linhas de código novo para o mesmo resultado.

Consequência aceita: como os outros lookups, são **registros globais** (não por
igreja) e a manutenção é de `master`/`admin`. A coluna `church_id` fica na
tabela — anulável — para permitir escopo por igreja no futuro sem migration
destrutiva.

### 1.2 Tabela `bancos`

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid pk | |
| `nome` | varchar(150) NOT NULL | "Banco do Brasil — C/C 12345-6", "Caixa (espécie)" |
| `codigo` | varchar(10) | código FEBRABAN (001, 033, 341…) |
| `agencia` | varchar(20) | |
| `conta` | varchar(30) | |
| `tipo_conta` | varchar(30) | CORRENTE · POUPANCA · CAIXA_ESPECIE · APLICACAO |
| `chave_pix` | varchar(255) | |
| `titular` | varchar(255) | |
| `ativo` | boolean default true | |
| `is_default` | boolean default false | pré-seleção em lançamentos novos |
| `church_id` | uuid null | reservado para escopo futuro |
| `created_at` / `updated_at` | timestamptz | |

### 1.3 Tabela `departamentos`

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid pk | |
| `nome` | varchar(150) NOT NULL | "Missões", "Campanha Templo Novo", "Infantil" |
| `codigo` | varchar(20) | |
| `tipo` | varchar(30) | MINISTERIO · CAMPANHA · SETOR · OBRA · MISSOES · GERAL |
| `descricao` | text | |
| `cor` | varchar(7) | usado nos gráficos |
| `ordem` | int default 0 | posição no dropdown |
| `ativo` | boolean default true | |
| `is_default` | boolean default false | |
| `church_id` | uuid null | |
| `created_at` / `updated_at` | timestamptz | |

> Não confundir com `event_departments` (departamentos do **app móvel/CMS**, com
> slug e site público). São coisas diferentes: aquilo é vitrine, isto é
> classificação financeira. Mantidos separados de propósito.

### 1.2 Código de busca e isolamento por campo

Ajustes pedidos depois da primeira versão, ambos na migration
`20260812150000_bancos_departamentos_por_campo`.

**Código de busca.** Cada banco e departamento tem um código curto e digitável
(`01`, `02`) e o dropdown exibe **"01 - Bradesco"**. É `VARCHAR`, não inteiro:
o identificador de verdade continua sendo o UUID, e texto aceita `001`, `CX-01`
ou o que a igreja preferir.

Em `bancos` isso obrigou a separar dois conceitos que estavam na mesma coluna:

| Coluna | O que identifica |
|---|---|
| `codigo` | **a conta** dentro da igreja (`01` = Itaú c/c 12345) |
| `codigo_febraban` | **a instituição** (341 = Itaú) |

Duas contas no mesmo banco têm o mesmo FEBRABAN, mas precisam de códigos de
busca distintos — por isso não dava para reaproveitar um campo só.

**Isolamento por campo.** `campo_id` com FK em ambas as tabelas. O que isso
implica em cada ponto:

| Operação | Regra |
|---|---|
| Listar | só os itens do campo ativo |
| `?campoId=` na URL | só master pode trocar de contexto; para os demais o campo vem do usuário, senão bastaria editar o querystring |
| Criar | campo carimbado pelo servidor, **nunca** aceito do corpo da requisição |
| Editar / excluir | bloqueado para item de outro campo — filtrar só a listagem não protege a escrita, bastaria conhecer o id |
| Código | único **dentro do campo** (índice parcial, pois código é opcional) |

Os 9 campos receberam sua própria semente `01 - Caixa (espécie)` e
`01 - Geral (Igreja)`. Nenhum registro ficou sem campo.

`LookupConfig` ganhou `campoField` para declarar isso por lista — as listas sem
essa coluna (plano de contas, formas de pagamento) seguem globais.

### 1.3 Bugs corrigidos na API genérica de listas

Dois defeitos que **já existiam** antes deste módulo e apareceram ao exercitar
os cadastros novos:

1. **Coluna integer recebendo texto.** `buildWritableValues` mandava todo valor
   como texto; o Postgres recusa em coluna `integer`
   (`column "ordem" is of type integer but expression is of type text`).
   Atingia `zonas.display_order` desde sempre. Corrigido com o tipo de campo
   `number`, que gera cast explícito (`$3::int`).
2. **Erro cru vazando para a tela.** Um código repetido mostrava
   `Raw query failed. Code: 23505...`. Agora `erroLegivel()` traduz para
   *"Já existe um item com este código neste campo"*. Detalhe apurado no
   caminho: o Prisma **não** repassa o texto `duplicate key` do Postgres — manda
   `Code: 23505` com outra redação, então a primeira versão da tradução não
   pegava.

### 1.4 Ligação com os lançamentos existentes — os 331 mil registros

`livro_caixa` ganha duas colunas anuláveis: `banco_id` e `departamento_id`
(FK `ON DELETE SET NULL`, com índice).

**Decisão sobre o histórico** (delegada ao agente na conversa):

- Os 331.484 lançamentos antigos ficam com `banco_id` e `departamento_id`
  **NULL**. Carimbar um valor inventado em cima de dado histórico seria fabricar
  informação contábil — em prestação de contas isso é pior que o vazio.
- A UI exibe esses casos como **"Não informado"**, e os relatórios os agrupam
  num bucket explícito com esse nome. O usuário vê o buraco, em vez de ver um
  número errado.
- Para **lançamentos novos** o vazio não acontece: o seed cria
  `Caixa (espécie)` como banco `is_default` e `Geral (Igreja)` como departamento
  `is_default`, e o formulário já vem com eles pré-selecionados.
- Quem quiser assumir o histórico como "Geral / Caixa" tem um script opcional
  (`scripts/backfill-livro-caixa-banco-departamento.mjs`, rodado à mão, com
  `--dry-run` por padrão). A escolha fica com a tesouraria, não com o código.

### 1.5 Onde aparece

- `Configurações → Listas e Cadastros Auxiliares → Bancos` e `→ Departamentos`.
- Novo Lançamento do Livro Caixa (`src/app-ui/finance/LancamentoNew.tsx`):
  dois selects novos, pré-selecionados no padrão, gravados no lançamento.
- Todo o módulo de Contas a Pagar (conta, parcela e pagamento).

---

## 2. Módulo Contas a Pagar

### 2.1 Modelo de dados

Cinco tabelas novas. Todas com `church_id` NOT NULL (FK `ON DELETE CASCADE`) e
`deleted_at` para exclusão lógica, seguindo o padrão do repositório.

#### Classificação da despesa — usa o Plano de Contas, sem tabela nova

> **Correção de rumo (13/08/2026).** A primeira versão criou uma tabela
> `tipos_despesa` como cadastro próprio. Estava errado: `plano_de_contas` já
> tem **47 entradas de DESPESA em uso** — `02.148 LUZ`, `02.149 ÁGUA`,
> `02.153 ALUGUEL`, `02.210 MISSÕES`, `02.169 AJUDA DE CUSTO`,
> `02.168 MATERIAL DE LIMPEZA`… Manter as duas obrigaria a tesouraria a
> cadastrar a mesma coisa duas vezes, e as listas divergiriam: o Livro Caixa
> gravaria por um critério e o relatório de contas a pagar somaria por outro.
>
> `tipos_despesa` foi removida (migration `20260813100000`) e
> `contas_pagar.plano_de_conta_id` aponta direto para `plano_de_contas`. As
> duas tabelas estavam com 0 linhas, então não houve migração de dado.

O CRUD do plano de contas já existe em **Configurações › Plano de Contas**
(lookup `chart-of-accounts`). O módulo só consome, filtrando `tipo = 'DESPESA'`
e `ativo`.

Efeito colateral bom: a baixa contábil fica trivial. O `livro_caixa` grava o
plano de conta pelo **nome** (é assim nos 331 mil registros históricos), e agora
esse nome vem direto do vínculo, sem tabela intermediária.

#### `credores` — o único cadastro realmente novo

O Livro Caixa guarda o favorecido como **texto livre**, sem cadastro nenhum de
onde reaproveitar. Por isso credor tem tabela própria, ao contrário da
classificação da despesa (que usa o plano de contas existente).

**Busca de pessoa jurídica** (`GET /api/credores/buscar-pj?q=`). Levantamento no
banco em 13/08/2026, que desmentiu duas suposições:

| Suposição | Realidade |
|---|---|
| `livro_caixa.id_favorecido_externo` guarda o CNPJ | guarda o **id do membro** — 746 dos 1.044 lançamentos PJ apontam para um membro existente |
| `livro_caixa.identificador` guarda o documento | **nulo em 100%** das linhas PJ |
| Não existe cadastro de PJ | **existe**: 126 `members` com `fantasy_name`, documento em `cpf`/`cnpj` |

A busca varre três fontes, em ordem de confiança:

1. **credores PJ já cadastrados** — se houver, avisa que já existe em vez de
   deixar duplicar;
2. **membros-PJ** (`fantasy_name`) — trazem nome e documento, e a seleção grava
   também o `member_id`, que é o que faz o extrato do credor casar com o
   cadastro da pessoa;
3. **favorecido solto do histórico** — só o texto, para PJ que nunca virou membro.

É a mesma fonte que o "Buscar PJ existente" da tela de Lançamento usa, então as
duas telas concordam.

Colunas: `id`, `church_id`, `nome`, `tipo_pessoa` (`PF|PJ`), `cpf_cnpj`,
`tipo_credor` (`PASTOR|OBREIRO|FORNECEDOR|PRESTADOR|ORGAO_PUBLICO|OUTRO`),
`member_id` (FK opcional para `members` — quando o credor é um membro, o extrato
por credor casa com o cadastro), dados bancários (`banco_id`, `banco_nome`,
`agencia`, `conta`, `tipo_conta`, `chave_pix`), contato (`telefone`, `email`),
`ativo`, timestamps.

#### `contas_pagar` (o título)
`id`, `church_id`, `numero` (sequencial por igreja, ex. `CP-2026-000123`),
`tipo_despesa_id`, `credor_id`, `departamento_id`, `banco_id` (previsto),
`descricao`, `valor_total`, `data_emissao`, `forma_pagamento_prevista`,
`numero_documento`, `recorrente`, `parcelado`, `numero_parcelas`,
`status_geral` (**derivado**), `status_aprovacao`, `aprovado_por`,
`data_aprovacao`, `motivo_reprovacao`, `anexo_documento_url`, `observacoes`,
`criado_por`, timestamps, `deleted_at`.

#### `parcelas_contas_pagar`
`id`, `church_id`, `conta_pagar_id`, `numero_parcela`, `total_parcelas`,
`valor_parcela`, `valor_pago` (derivado), `valor_saldo` (derivado),
`data_vencimento`, `status` (derivado), timestamps.

#### `pagamentos_parcela`
`id`, `church_id`, `parcela_id`, `valor_pago`, `data_pagamento`,
`forma_pagamento`, `banco_id`, `comprovante_url`, `observacao`,
`livro_caixa_id` (FK do lançamento gerado na baixa contábil),
`registrado_por`, `estornado_em`, `estornado_por`, `motivo_estorno`,
`created_at`.

### 2.2 Motor de cálculo — o coração do módulo

Vive em `src/lib/contasPagarService.ts`, é **puro onde dá** (funções de cálculo
sem I/O, para o E2E testar direto) e é chamado sempre dentro de transação.

**Status da parcela** (`recalcularParcela`):

```
valor_pago  = Σ pagamentos não estornados da parcela
valor_saldo = max(0, valor_parcela − valor_pago)

valor_saldo == 0                        → PAGO
0 < valor_pago < valor_parcela          → PARCIAL   (mesmo vencida — parcial vencida
                                                     continua PARCIAL e entra no
                                                     relatório de saldo residual)
valor_pago == 0 e vencimento < hoje     → ATRASADO
valor_pago == 0 e vencimento >= hoje    → PENDENTE
cancelada                               → CANCELADA (fora de todo cálculo)
```

**Status geral da conta** (`derivarStatusGeral`), a partir das parcelas não
canceladas:

```
sem parcelas ativas                     → CANCELADA
todas PAGO                              → PAGO
alguma PAGO ou PARCIAL (e nem todas)    → PARCIAL
nenhuma paga e alguma ATRASADO          → ATRASADO
caso contrário                          → PENDENTE
```

**Regras invioláveis** (validadas no backend, com teste dedicado):

1. `valor_pago` de um pagamento **> 0** e **≤ valor_saldo** da parcela.
   Excesso → HTTP 400 `"Pagamento de R$ X excede o saldo de R$ Y desta parcela."`
2. O saldo residual de uma parcela paga parcialmente **nunca vira parcela nova**.
   Continua na mesma parcela/mês de competência até ser quitado — inclusive
   quando a quitação vem meses depois.
3. Uma parcela pode receber **N pagamentos**; o histórico fica visível na tela
   da parcela, em ordem cronológica.
4. Estorno não apaga: marca `estornado_em`/`estornado_por`/`motivo_estorno`,
   recalcula parcela e conta, e **estorna também o lançamento no livro caixa**
   (soft delete, preenchendo `deletado_por`).
5. Geração de parcelas com valores desiguais é permitida, mas
   `Σ valor_parcela == valor_total` (tolerância de R$ 0,01 para o resíduo da
   divisão, que é jogado na **última** parcela).
6. Conta acima da alçada só aceita pagamento depois de `status_aprovacao = APROVADO`.

**Geração de parcelas** (`gerarParcelas`): à vista = 1 parcela com vencimento na
data informada; parcelada = N parcelas mensais a partir do primeiro vencimento,
`valor_total / N` arredondado a 2 casas com o resíduo na última; datas roladas
com `date-fns` (dia 31 → último dia do mês seguinte).

### 2.3 Aprovação / alçada

Configuração por igreja em `settings` (tabela já existente, chave
`contas_pagar.alcada_aprovacao`, valor em reais; `0` ou ausente = sem alçada).

- Conta com `valor_total >= alçada` nasce `AGUARDANDO_APROVACAO` e é bloqueada
  para pagamento.
- `POST /contas-pagar/[id]/aprovar` e `/reprovar` — exigem permissão
  `contas_pagar_aprovar`, gravam quem/quando e vão para a auditoria.

### 2.4 Baixa contábil

Ao registrar um pagamento (total ou parcial), dentro da **mesma transação**,
é criado um `livro_caixa` com:

`tipo='DESPESA'`, `valor` = valor pago, `data_lancamento` = data do pagamento,
`plano_de_conta` = nome do plano do tipo de despesa, `categoria` = nome do tipo
de despesa, `favorecido` = nome do credor, `member_id` = credor.member_id,
`forma_pg`, `banco_id`, `departamento_id`, `num_doc` = número do documento da
conta, `referencia` = `"CP <numero> parcela n/N"`, `obs` com a observação do
pagamento, `operador_id`/`created_by` = usuário.

O id gerado volta para `pagamentos_parcela.livro_caixa_id`, o que fecha o
caminho de ida e volta (do extrato para a conta e vice-versa) e permite a
conciliação bancária existente.

> Sinal negativo: o `livro_caixa` guarda `valor` positivo e distingue pelo
> campo `tipo` (é o que os 331 mil registros fazem hoje) — a baixa segue igual.

### 2.5 Notificações

Reaproveita o módulo de notificações existente (`notifications`), via o cron já
existente em `/api/cron`. Três gatilhos, configuráveis em `settings`:

- parcelas a vencer em X dias (padrão 3);
- parcelas vencidas e não pagas (diário);
- parcelas com saldo residual em aberto há mais de Y dias (padrão 30).

### 2.6 Permissões (RBAC)

Chaves novas no `permissionCatalog.ts`, grupo Finanças:

| Chave | O que libera |
|---|---|
| `contas_pagar` | ver a tela, listar, filtrar, relatórios (`view`); lançar conta (`create`); editar (`edit`); cancelar/excluir (`delete`) |
| `contas_pagar_aprovar` | aprovar/reprovar conta acima da alçada |
| `contas_pagar_pagar` | registrar pagamento e estornar |
| `settings_bancos` / `settings_departamentos` | manter os cadastros auxiliares |

Padrões: `contas_pagar` liberado a master/admin/campo/igreja para ver e lançar;
aprovar e pagar restritos a master/admin/campo (tesouraria); os cadastros
auxiliares a master/admin, como os outros lookups.

### 2.7 Auditoria

`logMutationAudit` (`src/lib/audit.ts`) já intercepta mutações por rota; recebe
um ramo para `/api/contas-pagar` descrevendo conta/parcela/pagamento. Estorno e
aprovação registram antes/depois no `metadata`.

---

## 3. A tela — "super tela" de gestão

Rota `/app-ui/finance/contas-a-pagar`, arquivo
`src/app-ui/finance/ContasPagar.tsx`. Item novo no sidebar em **Finanças**,
entre "Lançamento" e "Fluxo de Caixa", ícone `Receipt`, permKey `contas_pagar`.

Cabeçalho com 5 KPIs do filtro corrente: Total no período · Em aberto ·
Vencido · Pago · Saldo residual (parciais).

### Aba 1 — Lançamentos

Tabela paginada no padrão `AssetsList`, com:

- **Busca** livre (descrição, número da conta, credor, documento).
- **Filtros**: regional → igreja (cascata), credor, tipo de despesa,
  departamento, banco, status (multi), status de aprovação, faixa de
  vencimento (com presets: mês, 30/60/90 dias, vencidos, tudo), faixa de valor.
- **Modos de visão**: por **título** (contas) ou por **parcela** (é a visão que
  a tesouraria usa no dia a dia — "o que vence essa semana").
- Ordenação por qualquer coluna, seleção múltipla, exportação **Excel** (xlsx,
  já usado no Cashbook) e **PDF/impressão**.
- Linha expansível mostrando as parcelas da conta com barra de progresso pago/saldo.
- Ações: ver, editar, registrar pagamento, aprovar, cancelar.

### Aba 2 — Relatórios e gráficos (recharts)

1. **Por status** — donut com totais (pendente/parcial/atrasado/pago).
2. **Por tipo de despesa** — barras horizontais, top 10 (quanto vai para folha
   pastoral, aluguel, manutenção…).
3. **Por departamento** — barras (Missões, campanhas etc.), com a fatia
   "Não informado" explícita.
4. **Fluxo projetado** — barras empilhadas por mês, próximos 30/60/90 dias,
   separando a vencer × vencido.
5. **Saldo residual em aberto** — tabela ordenada por dias em aberto (o caso do
   pastor pago pela metade), com o total no topo.
6. **Extrato por credor** — seleciona o credor e vê tudo devido/pago a ele.
7. **Evolução mensal** — linha de previsto × pago nos últimos 12 meses.

Tudo respeita os filtros da aba 1 e exporta.

> **Não há aba "Cadastros".** Uma terceira aba com a listagem de credores foi
> construída e removida: pesava a tela para uma listagem que ninguém pediu. O
> cadastro de credor virou modal aberto por um **"+"** ao lado do próprio campo
> Credor — é lançando a conta que se percebe que falta um, e assim o recém-criado
> já sai selecionado sem perder o que estava digitado.

### Modais

- **Nova conta a pagar** (drawer): credor, plano de contas, departamento, banco,
  valor, emissão, documento, à vista/parcelada com prévia editável das parcelas
  (permite valores desiguais), anexo, observações.
- **Novo credor** (modal, sem listagem): dados cadastrais, bancários e vínculo
  opcional com o membro. Para **pessoa jurídica**, tem busca — ver abaixo.
- **Detalhe da parcela**: cabeçalho com devido/pago/saldo, histórico de
  pagamentos (os "anexos" de pagamento), botão de estorno por pagamento.
- **Registrar pagamento**: valor livre (default = saldo), data, forma, banco,
  comprovante, observação; avisa em destaque quando o valor é menor que o saldo
  ("ficará R$ X em aberto nesta parcela").

---

## 4. Auto-preenchimento da Troca de Dirigente

Hoje, ao abrir "Novo Dirigente" (`src/components/app-ui/Churches.tsx:3144`), o
bloco "Resumo da transição" abre **vazio** e é digitado à mão, apesar de todos
os números existirem no banco.

Novo endpoint `GET /api/churches/[id]/leader-snapshot?date=YYYY-MM-DD`
(`withAuth` + `assertChurchAccess`), devolvendo o retrato da igreja na data de
entrada informada:

| Campo do modal | Origem | Definição |
|---|---|---|
| Caixa atual | `livro_caixa` | Σ RECEITA − Σ DESPESA da igreja, `situacao = true`, `deleted_at IS NULL`, até a data (inclusive) |
| Maior valor de entrada | `livro_caixa` | maior `valor` com `tipo = 'RECEITA'` nos últimos 12 meses |
| Média de entrada | `livro_caixa` | Σ RECEITA dos últimos 12 meses ÷ nº de meses **com movimento** (média por mês vazio distorce igreja nova) |
| Média de saída | `livro_caixa` | idem para DESPESA |
| Total de membros | `members` | `church_id`, `deleted_at IS NULL` (mesma contagem que `/leader-report` já usa) |
| Total de obreiros | `members` + `ecclesiastical_titles` | membros com **título eclesiástico de nível ≥ 1** — ver abaixo |

#### Como "obreiro" é definido

A primeira versão contava funções ativas em `church_function_history` e dava
**0** em produção — aquela tabela guarda função administrativa (dirigente,
líder de jovens) e está praticamente vazia. O que caracteriza obreiro é o
**título eclesiástico**.

Três caminhos foram descartados por não sobreviverem aos dados reais:

| Caminho | Por que não |
|---|---|
| `church_function_history` | quase vazia — resultado 0 |
| `members.ecclesiastical_title_id` (FK) | preenchida em **159 de 26.158** membros |
| flag `is_ecclesiastical_minister` | inconsistente na base: `PASTOR` = false, `PASTORA` = true, `BISPO` = false |

O que funciona é o `level` do catálogo, que está coerente:

| Nível | Títulos |
|---|---|
| 0 | CONGREGADO, MEMBRO |
| 1 | COOPERADOR, COOPERADORA |
| 2 | DIACONO, DIACONISA |
| 3 | PRESBITERO |
| 4 | EVANGELISTA, MISSIONARIO, MISSIONARIA |
| 5 | PASTOR, PASTORA |
| 47 | BISPO |

**Obreiro = nível ≥ 1** (consagrado a alguma função ministerial).

O casamento entre `members.ecclesiastical_title` (texto) e o nome do catálogo é
feito sem acento e sem caixa — a base tem `PRESBÍTERO`/`PRESBITERO` e
`DIÁCONO`/`DIACONO` convivendo.

Título digitado que **não existe** no catálogo (`PASTOR PRESIDENTE`,
`DIACONIZA`, lixo de digitação) **não entra no total** — não dá para afirmar
que é obreiro — e volta em `titulosForaDoCatalogo` para a secretaria corrigir.
Silenciar seria esconder um erro de cadastro.

Aferição em AD Campinas — SEDE (12/08/2026): 871 obreiros de 2.645 membros,
com a soma de todas as faixas reconciliando exatamente com o total de membros.

O campo "Total de obreiros" no modal ganha um link **"Ver por título"**, que
abre o detalhamento: quantos presbíteros, diáconos, evangelistas etc., mais os
não-obreiros (nível 0) como contexto e o aviso dos títulos fora do catálogo.
| Distância (km) | já existe | mantida como está |

Comportamento na tela:

- Ao **abrir** uma troca nova, busca o snapshot e preenche os seis campos;
  enquanto carrega, os campos mostram "Calculando…" (placeholder, igual ao que a
  distância já faz).
- Ao **mudar a data de entrada**, recalcula (é um retrato *daquela* data).
- Todos os campos continuam **editáveis** — o valor sugerido não trava nada.
- Um botão "Recalcular" ao lado do bloco restaura os valores do sistema, e uma
  legenda diz de onde vieram ("Calculado do Livro Caixa até 12/08/2026").
- Na **edição** de uma movimentação antiga, **não** preenche: o registro
  histórico é um retrato congelado da posse e não pode ser sobrescrito por
  números de hoje. (Mesma lógica que o campo `distance_km` já documenta no
  schema.)
- Igreja sem lançamento no período → campos ficam vazios, com a legenda
  "Sem lançamentos no período" — melhor que sugerir zero.

---

## 5. Testes

`scripts/e2e-contas-a-pagar.mjs`, no padrão dos 17 E2E existentes: cria campo,
regional, igreja, membros e usuário com prefixo `[E2E]`, importa o serviço de
produção, roda contra o banco real e limpa tudo no fim (`--keep` preserva).

Resultado da última execução: **111 verificações, 0 falhas**
(`npx tsx scripts/e2e-contas-a-pagar.mjs`).

Cenários obrigatórios:

1. **Seed**: bancos, departamentos, tipos de despesa e credores criados.
2. Conta **à vista** → 1 parcela, status PENDENTE.
3. Conta **parcelada em 12** (o caso do pastor) → 12 parcelas mensais, soma
   igual ao total, resíduo na última.
4. **Pagamento parcial** (60%) → parcela PARCIAL, saldo correto, conta PARCIAL.
5. **Segundo pagamento** meses depois → parcela PAGO, saldo 0, e o saldo residual
   **nunca** virou parcela nova (contagem de parcelas continua 12).
6. **Pagamento acima do saldo** → rejeitado.
7. **Vencida sem pagamento** → ATRASADO; vencida com pagamento parcial →
   continua PARCIAL.
8. **Baixa contábil**: cada pagamento gera 1 `livro_caixa` DESPESA com banco e
   departamento preenchidos e vínculo de ida e volta.
9. **Estorno** → pagamento marcado, parcela volta a PARCIAL/PENDENTE, lançamento
   do livro caixa estornado.
10. **Alçada**: conta acima do limite bloqueia pagamento até aprovar.
11. **Status geral** derivado em todas as combinações.
12. **Relatórios**: totais por status, por tipo, por departamento, projeção 30/60/90
    e saldo residual batem com o que foi lançado.
13. **Filtros da tela**: cada filtro da aba 1 aplicado ao mesmo dataset retorna o
    subconjunto esperado (é o teste "da tela", exercitando a mesma query da API).
14. **Isolamento**: usuário restrito à própria igreja não enxerga conta de outra.

---

## 6. Fora de escopo (declarado)

- Integração de pagamento automático com banco (remessa CNAB/pix em lote). O
  módulo Santander existente cuida de extrato/conciliação; emissão de pagamento
  é outro projeto.
- Rateio de uma mesma conta entre vários departamentos (hoje é 1 departamento
  por conta). Se a igreja precisar, vira `contas_pagar_rateio` numa fase 2.
- Migração dos 331 mil lançamentos históricos para banco/departamento — fica no
  script opcional, decisão da tesouraria (§1.4).
