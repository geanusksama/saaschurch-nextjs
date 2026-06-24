# DOCUMENTAÇÃO TÉCNICA COMPLETA — MÓDULO FINANCEIRO/TESOURARIA MRM
## Engenharia Reversa para Implementação no App Flutter/Dart

---

## 1. ARQUITETURA GERAL DO MÓDULO

O módulo financeiro do MRM é centrado na **Tesouraria Principal (Livro Caixa)** — tabela `livro_caixa`, acessada diretamente via Supabase SDK e APIs Next.js.

---

## 2. TABELAS DO BANCO DE DADOS

### 2.1 `livro_caixa` — Tabela Principal de Lançamentos

**Finalidade:** Armazena todos os lançamentos financeiros (receitas, despesas, transferências) de cada igreja.

```sql
CREATE TABLE livro_caixa (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id             UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  data_lancamento       DATE NOT NULL,
  referencia            VARCHAR(100),       -- "MM/AAAA" ex: "04/2025"
  valor                 DECIMAL(15,2) NOT NULL,
  tipo                  VARCHAR(20) NOT NULL,  -- 'RECEITA' | 'DESPESA' | 'TRANSFERENCIA'
  forma_pg              VARCHAR(50),        -- nome da forma de pagamento
  plano_de_conta        VARCHAR(100),       -- nome do plano de contas
  categoria             VARCHAR(100),       -- categoria gerencial
  centro_de_custo       VARCHAR(100),
  num_lancamento        VARCHAR(50),
  num_doc               VARCHAR(50),        -- número do documento
  tipo_documento        VARCHAR(50),        -- nome do tipo de documento
  tipo_pessoa           VARCHAR(20),        -- 'MEMBRO' | 'NAO_MEMBRO' | 'PJ' | 'PF' | 'IGREJA'
  favorecido            VARCHAR(255),       -- nome do contribuinte/beneficiado
  member_id             UUID REFERENCES members(id),
  id_favorecido_externo VARCHAR(100),       -- ROL, CNPJ, ou ID externo
  operador              VARCHAR(255),       -- nome do usuário que registrou
  operador_id           UUID REFERENCES users(id),
  igreja_operador       VARCHAR(255),
  regional              VARCHAR(100),       -- denormalizado para performance
  campo                 VARCHAR(100),       -- denormalizado para performance
  hash                  VARCHAR(255),
  obs                   TEXT,
  foto                  VARCHAR(500),       -- URL do comprovante no Supabase Storage
  identificador         VARCHAR(100),
  conta_caixa           VARCHAR(100),
  situacao              BOOLEAN DEFAULT true,
  deletado_por          VARCHAR(255),
  deleted_at            TIMESTAMPTZ,
  legacy_id             BIGINT,             -- ID do sistema legado importado
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  created_by            UUID REFERENCES users(id),
  updated_by            UUID REFERENCES users(id)
);

-- Índices
CREATE INDEX ON livro_caixa(church_id, data_lancamento);
CREATE INDEX ON livro_caixa(member_id);
CREATE INDEX ON livro_caixa(tipo);
CREATE INDEX ON livro_caixa(plano_de_conta);
CREATE INDEX ON livro_caixa(categoria);
CREATE INDEX ON livro_caixa(centro_de_custo);
CREATE INDEX ON livro_caixa(legacy_id);
CREATE INDEX ON livro_caixa(campo);
CREATE INDEX ON livro_caixa(regional);
```

**Campos obrigatórios:** `id`, `church_id`, `data_lancamento`, `valor`, `tipo`

**Campos calculados (frontend):**
- `liquido` = SUM(valor WHERE tipo='RECEITA') - SUM(valor WHERE tipo='DESPESA')
- `total_dizimos` = SUM(valor WHERE tipo='RECEITA' AND plano_de_conta ILIKE '%dizimo%')
- `total_ofertas` = SUM(valor WHERE tipo='RECEITA' AND plano_de_conta ILIKE '%oferta%')

**Campos usados em filtros:**
- `church_id` (obrigatório no livro caixa principal)
- `data_lancamento` (range: gte/lte)
- `tipo` (RECEITA/DESPESA)
- `favorecido` (ilike para busca por nome)
- `id_favorecido_externo` (ilike para busca por ROL)
- `member_id` (eq para busca por membro)
- `plano_de_conta` (eq ou ilike)

---

### 2.2 `church_cashbook_status` — Controle de Caixa por Mês

**Finalidade:** Controla se um caixa (igreja + mês + ano) está aberto ou fechado para lançamentos.

```sql
CREATE TABLE church_cashbook_status (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id        UUID NOT NULL REFERENCES churches(id),
  reference_year   INT NOT NULL,
  reference_month  INT NOT NULL,          -- 1-12
  status           VARCHAR(20) NOT NULL,  -- 'OPEN' | 'CLOSED'
  allow_until      DATE,                  -- data até quando está permitido mesmo fechado
  notes            TEXT,
  updated_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(church_id, reference_year, reference_month)
);
```

**Lógica de abertura:**
```
isOpen = (status == 'OPEN') OR (allow_until != null AND allow_until >= dataAtual)
```
Quando não há registro na tabela, o caixa é considerado **ABERTO** por padrão.

---

### 2.3 `plano_de_contas` — Plano de Contas

**Finalidade:** Define os planos de conta disponíveis para classificar lançamentos.

```sql
-- Campos consultados no código:
SELECT id, nome, codigo
FROM plano_de_contas
WHERE tipo = 'RECEITA' | 'DESPESA'  -- filtro por tipo do lançamento
AND ativo = true
ORDER BY nome
```

**Campos relevantes:**
- `id` — UUID
- `nome` — nome do plano (armazenado por nome no `livro_caixa.plano_de_conta`)
- `codigo` — código hierárquico (ex: "1.1.1"), opcional
- `tipo` — 'RECEITA' ou 'DESPESA'
- `ativo` — boolean

**Nota importante:** No `livro_caixa`, o campo `plano_de_conta` armazena o **nome** do plano (VARCHAR), não o ID. Isso é intencional para compatibilidade com dados legados.

---

### 2.4 `forma_pagamento` — Formas de Pagamento

```sql
SELECT id, nome
FROM forma_pagamento
WHERE mostrar = true
ORDER BY nome
```

**Campos relevantes:** `id`, `nome`, `mostrar` (boolean — se aparece nos selects)

---

### 2.5 `tipo_documento` — Tipos de Documento

```sql
SELECT id, nome, sigla
FROM tipo_documento
WHERE disponivel_receita = true   -- ou disponivel_despesa = true
AND ativo = true
ORDER BY nome
```

**Campos relevantes:** `id`, `nome`, `sigla`, `disponivel_receita` (boolean), `disponivel_despesa` (boolean), `ativo`

**Regra de filtragem:**
- Para RECEITA: retorna docs onde `nome LIKE '%RECEITA%'`
- Para DESPESA: retorna docs onde `nome LIKE '%DESPESA%'` OU docs sem 'RECEITA' e sem 'DESPESA' no nome

---

### 2.6 `financial_accounts` — Contas Bancárias/Caixa

```sql
CREATE TABLE financial_accounts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id       UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  account_type    VARCHAR(30) NOT NULL,   -- 'BANCO'|'CAIXA'|'POUPANCA'|etc
  bank_name       VARCHAR(255),
  bank_code       VARCHAR(10),
  agency          VARCHAR(20),
  account_number  VARCHAR(30),
  initial_balance DECIMAL(15,2) DEFAULT 0,
  current_balance DECIMAL(15,2) DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
```

---

### 2.7 `transactions` — Transações Estruturadas

Esta tabela é o modelo "novo" de transações, separado do `livro_caixa` legado. Atualmente coexiste no schema mas **não é usada nas telas principais** do módulo financeiro ativo.

```sql
CREATE TABLE transactions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id             UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  account_id            UUID NOT NULL REFERENCES financial_accounts(id),
  category_id           UUID REFERENCES financial_categories(id),
  type                  VARCHAR(20) NOT NULL,    -- 'income'|'expense'|'transfer'
  amount                DECIMAL(15,2) NOT NULL,
  description           VARCHAR(500) NOT NULL,
  notes                 TEXT,
  transaction_date      DATE NOT NULL,
  due_date              DATE,
  paid_at               TIMESTAMPTZ,
  status                VARCHAR(20) DEFAULT 'pending', -- 'pending'|'paid'|'overdue'
  payment_method        VARCHAR(30),
  payment_proof_url     VARCHAR(500),
  is_recurring          BOOLEAN DEFAULT false,
  recurrence_pattern    VARCHAR(20),
  recurrence_parent_id  UUID REFERENCES transactions(id),
  donor_member_id       UUID REFERENCES members(id),
  transfer_to_account_id UUID REFERENCES financial_accounts(id),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  created_by            UUID REFERENCES users(id),
  updated_by            UUID REFERENCES users(id),
  deleted_at            TIMESTAMPTZ
);
```

---

### 2.8 `offerings` — Ofertas/Dízimos

```sql
CREATE TABLE offerings (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id        UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  transaction_id   UUID REFERENCES transactions(id),
  member_id        UUID REFERENCES members(id),
  offering_type    VARCHAR(30) NOT NULL, -- 'dizimo'|'oferta'|'oferta_especial'
  amount           DECIMAL(15,2) NOT NULL,
  offering_date    DATE NOT NULL,
  payment_method   VARCHAR(30),
  reference_number VARCHAR(100),
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  created_by       UUID REFERENCES users(id)
);
```

---

## 3. TELAS E FLUXOS DO MÓDULO

### 3.1 Livro Caixa (`/app-ui/finance/cashbook`)

**Componente:** `src/app-ui/finance/Cashbook.tsx`

**Ribbon de Controles:**
- **Escopo:** Seletor de Igreja (modal `ChurchPickerModal`), botão "Consultar Livro Caixa", botão "Consultar Lançamento"
- **Período:** Data Inicial + Data Final (default = 1º dia do mês atual até último dia do mês atual)
- **Relatórios:** Botão Imprimir (abre `RelatorioModal`) + Botão Exportar Excel
- **Lançamentos:** Botão "Nova Receita" (navega para `/app-ui/finance/income/new`) + Botão "Nova Despesa" (navega para `/app-ui/finance/expense/new`)

**Painel de Resumo (accordion em mobile, sempre visível no desktop):**
- Líquido (receita - despesa)
- Total Receitas
- Total Despesas
- Total Dízimos (`plano_de_conta ILIKE '%dizimo%'`)
- Total Ofertas (`plano_de_conta ILIKE '%oferta%'`)
- Qtd Receitas / Qtd Despesas / Qtd Dízimos / Qtd Ofertas

**Tabela de Lançamentos:**
- Colunas: Data, Tipo (badge colorido), Favorecido, Plano/Categoria, Forma Pgto, Ref, N° Doc, Valor, Ações
- Ordenação clicável por: `data_lancamento`, `valor`, `tipo`, `favorecido`, `church`, `plano_tipo`
- `plano_tipo` é ordenação especial: Dízimos (0) → Ofertas (1) → Outras Receitas (2) → Despesas (3), depois por data DESC dentro do grupo
- Filtro de tipo: Todos / RECEITA / DESPESA (toggle buttons)
- Paginação: page size configurável, default 100 registros por página
- Ações por linha: Ver comprovante, Editar (abre `EditDrawer`), Excluir (confirmação modal), Imprimir recibo (abre `ReciboModal`)

**Modal "Consultar Lançamento":**
- Busca por: ROL (campo `id_favorecido_externo`) ou Nome (`favorecido`)
- Filtros: período (data inicial/final), tipo (todos/receita/despesa)
- Filtro por Regional → filtra igrejas → filtra lançamentos
- Perfil `church`: restrito à própria `churchId`
- Limite: 5000 registros

**Drawer de Edição (`EditDrawer`):**
- Campos editáveis: `data_lancamento`, `plano_de_conta`, `tipo_documento`, `num_doc`, `forma_pg`, `referencia`, `obs`, `valor`
- Campo **não editável** (read-only): `favorecido`
- UPDATE direto via `supabase.from('livro_caixa').update({...}).eq('id', row.id)`
- Validação: valor > 0

**Exclusão:**
- Exclusão **física** via `supabase.from('livro_caixa').delete().eq('id', row.id)`
- Confirmação com modal antes de executar

---

### 3.2 Novo Lançamento (`/app-ui/finance/lancamento/new`)

**Componente:** `src/app-ui/finance/LancamentoNew.tsx` — **tela principal recomendada**

Formulário unificado que suporta RECEITA e DESPESA.

**Teclas de atalho:**
- `F2` → Modo RECEITA
- `F4` → Modo DESPESA

**Seleção de Caixa (Igreja):**
- Perfil `church`: pré-selecionado com a igreja do usuário (não editável)
- Outros perfis: botão para abrir `SearchModal` para buscar igreja por nome

**Tipos de Pessoa:**
- `MEMBRO` — busca por nome ou ROL na tabela `members`; armazena `member_id` + `favorecido`
- `NAO_MEMBRO` — nome livre; sem `member_id`
- `PJ` — busca em `members WHERE member_type = 'PJ'` E em `livro_caixa WHERE tipo_pessoa = 'PJ'`; armazena `id_favorecido_externo` com CNPJ/doc
- `IGREJA` — busca em `churches` por nome; armazena nome no `favorecido`

**Campos do formulário:**
1. Igreja Caixa (obrigatório)
2. Tipo (RECEITA/DESPESA) via toggle F2/F4
3. Tipo de Pessoa (MEMBRO/IGREJA/NAO_MEMBRO/PJ)
4. Favorecido/Contribuinte (dependente do Tipo de Pessoa)
5. Plano de Contas (obrigatório) — select filtrado por tipo
6. Tipo de Documento (obrigatório) — select filtrado por tipo
7. Número do Documento (obrigatório para DESPESA)
8. Forma de Pagamento (obrigatório)
9. Valor em R$ (obrigatório, > 0)
10. Data do Lançamento (obrigatório, default = hoje)
11. Referência (obrigatório, formato "MM/AAAA")
12. Observações (opcional)
13. Foto/Comprovante (opcional, upload apenas para DESPESA)

**Validações antes do INSERT:**
1. Igreja caixa definida
2. Plano de contas selecionado
3. Tipo de documento selecionado
4. Para DESPESA: número do documento obrigatório
5. Forma de pagamento selecionada
6. Data informada
7. Referência informada
8. Valor > 0
9. Favorecido/contribuinte definido conforme o tipo de pessoa

**Validação de duplicidade:**
```sql
SELECT id, obs FROM livro_caixa
WHERE church_id = :caixaId
  AND tipo = :modo
  AND data_lancamento = :dataLancamento
  AND valor = :valorNum
  AND plano_de_conta = :plano_nome
  AND (
    member_id = :memId
    OR (tipo_pessoa = :tipoPessoa AND favorecido = :favNome)
  )
LIMIT 5
```
- Se encontrar duplicata **sem observação** → bloqueia com mensagem de erro
- Se encontrar duplicata **com mesma observação** → bloqueia com mensagem de erro
- Se encontrar duplicata **com observação diferente** → permite (considerado intencional)

**Verificação de Cash Status (antes do INSERT):**
```
POST /api/finance/cash-status/check
{ churchId, date }
→ { canInsert: boolean, message: string }
```
Se `canInsert = false`, exibe modal `CashClosedModal` e bloqueia o INSERT.

**Upload de comprovante (apenas DESPESA):**
```
POST /api/upload/foto-despesa
Headers: Authorization: Bearer <token>
Body: FormData { file: File }
Response: { url: string }
```

**INSERT:**
```sql
INSERT INTO livro_caixa (
  church_id, data_lancamento, tipo, valor, tipo_pessoa, favorecido,
  member_id, plano_de_conta, forma_pg, tipo_documento, num_doc,
  referencia, obs, foto, id_favorecido_externo, operador
) VALUES (...)
RETURNING id, legacy_id
```

**Tratamento de erros do INSERT:**
- `livro_caixa_member_id_fkey` → "Membro não encontrado no cadastro"
- `foreign key violates` → "Referência inválida"

**Após INSERT:**
- Abre automaticamente `ReciboModal` com o recibo do lançamento
- Limpa campos: valor, obs, foto (mantém: favorecido, caixa, plano, tipo_doc, forma_pg)

**Painel Lateral — Histórico/Repetir Dízimos:**

*Aba Histórico:*
- Últimos 30 lançamentos filtrados pelo escopo do usuário
- Query: `SELECT ... FROM livro_caixa ORDER BY created_at DESC LIMIT 30`
- Filtrado por `church_id` (perfil church), por campo (perfil campo), ou sem filtro (master/admin)

*Aba Repetir Dízimos:*
- Seleção de Igreja + Mês de Referência (mês anterior por padrão)
- Busca dízimos do mês:
  ```sql
  SELECT id, data_lancamento, tipo, valor, favorecido, plano_de_conta,
         forma_pg, tipo_documento, num_doc, obs
  FROM livro_caixa
  WHERE church_id = :churchId
    AND tipo = 'RECEITA'
    AND data_lancamento BETWEEN :dtIni AND :dtFim
    AND plano_de_conta ILIKE '%dizimo%'
  ORDER BY favorecido ASC
  LIMIT 500
  ```
- Lista dízimos com valor editável inline e obs editável (edição local, não persiste no banco)
- Botão "Repetir" por dízimo: verifica cash status → INSERT → exibe recibo
- Campo `referencia` preenchido automaticamente com o mês atual (`MM/AAAA`)
- Ícone de check verde para os já repetidos na sessão

---

### 3.3 Nova Receita — Formulário Simples (`/app-ui/finance/income/new`)

**Componente:** `src/app-ui/finance/IncomeNew.tsx`

Formulário simplificado (sem painel histórico, sem validação de duplicidade avançada):

**Campos:** Igreja*, Data*, Tipo Contribuinte (MEMBRO/NAO_MEMBRO/PF/PJ), Favorecido, Plano de Contas, Tipo Documento, Forma de Pagamento, Nº Doc, Valor*, Referência, Observações

**Após sucesso:** Navega para `/app-ui/finance/cashbook` após 1,5 segundos.

---

### 3.4 Nova Despesa — Formulário Simples (`/app-ui/finance/expense/new`)

**Componente:** `src/app-ui/finance/ExpenseNew.tsx`

Similar ao IncomeNew, diferenças:
- Campo `Favorecido/Fornecedor` (sempre `tipo_pessoa = 'NAO_MEMBRO'`)
- Upload de comprovante (foto/PDF) com preview
- Cores vermelhas na UI

---

### 3.5 Modal de Recibo (`ReciboModal`)

**Componente:** `src/app-ui/finance/ReciboModal.tsx`

**Tipo `ReciboRow`:**
```typescript
type ReciboRow = {
  id: string;
  legacy_id: number | null;
  data_lancamento: string;
  tipo: 'RECEITA' | 'DESPESA';
  valor: number;
  favorecido: string | null;
  rol: string | null;
  plano_de_conta: string | null;
  categoria: string | null;
  forma_pg: string | null;
  referencia: string | null;
  obs: string | null;
  foto: string | null;
  num_doc: string | null;
  tipo_documento: string | null;
  member_id: string | null;
  operador: string | null;
  churches: { name: string } | null;
};
```

**Número do documento exibido:** `legacy_id` || `num_doc` || `id` (truncado se UUID)

**Ações:**
1. **Imprimir** — gera HTML em iframe oculto e chama `window.print()`
2. **Download** — mesmo mecanismo que imprimir
3. **Câmera** — faz upload via `POST /api/upload/foto-despesa` e atualiza `livro_caixa.foto`
4. **Ver Comprovante** — abre `ComprovanteViewer` (zoom/rotate/drag interativo, ESC para fechar)
5. **Observações** — toggle para mostrar/esconder

**`ComprovanteViewer`:** Zoom por scroll do mouse, arrastar para mover, rotacionar 90°, download direto.

---

### 3.6 Modal de Relatório Analítico (`RelatorioModal`)

**Componente:** `src/app-ui/finance/RelatorioModal.tsx`

**Funcionalidades:**
- Preview em tempo real na tela
- Seleção de colunas: `igreja`, `doc`, `favorecido`, `categoria`, `tipodoc`, `referencia`, `formaPg`, `data`, `valor`, `obs`
- Colunas padrão: `['igreja', 'doc', 'favorecido', 'data', 'valor']`
- Reordenação de colunas (mover para cima/baixo)
- Ordenação por coluna clicável (exceto obs)
- Orientação: Retrato / Paisagem

**Agrupamento e ordenação dos grupos:**
1. Dízimos (plano com 'dizimo' no nome) — primeiros
2. Ofertas (plano com 'oferta' no nome) — segundos
3. Outras Receitas — por nome alfabético
4. Despesas — por nome alfabético

Dentro de cada grupo: ordenado por data DESC por padrão.

**Totalizadores:**
- Total Receita, Total Despesa, Total Dízimos, Total Ofertas
- Qtd Receitas, Qtd Despesas, Qtd Dízimos, Qtd Ofertas
- Líquido (receita - despesa) — em vermelho se negativo

**Subtotal por grupo:** exibido ao final de cada grupo na tabela.

**Observações:** Quando coluna `obs` não está visível e o registro tem observação, exibe em azul na linha abaixo alinhada à coluna `favorecido`.

---

### 3.7 Dashboard de Relatórios (`FinancialReportsDashboard`)

**Componente:** `src/app-ui/finance/FinancialReportsDashboard.tsx`

**KPI Cards (comparação ano a ano):**
- Receita atual vs anterior (% crescimento, média mensal)
- Despesa atual vs anterior (% crescimento, média mensal)
- Saldo atual vs anterior

**Gráfico de Evolução Mensal:** `AreaChart` — Receita + Despesa por mês (últimos 24 meses), linha de saldo acumulado

**Gráfico de Breakdown por Categoria:** `PieChart` — distribuição de receitas por plano de contas + despesas por plano

**Gráfico de Formas de Pagamento:** `PieChart` — distribuição por PIX/Dinheiro/etc para receitas e despesas

**Gráfico de Análise de Dízimos:** `ComposedChart` — quantidade de dizimistas + total de dízimos por mês, com linha de tendência (regressão linear)

**Gráfico de Ranking de Igrejas:** `BarChart` horizontal — Top 15 igrejas por receita (últimos 3 meses)

---

## 4. APIs DO MÓDULO FINANCEIRO

### 4.1 Autenticação

Todos os endpoints usam `withAuth(req, async (user) => {...})`:
```typescript
// Header obrigatório em todas as chamadas:
{ Authorization: "Bearer <mrm_token>" }

// Objeto user disponível nas rotas:
{
  id: string,           // UUID do usuário
  profileType: string,  // 'master'|'admin'|'campo'|'regional'|'church'
  churchId?: string,    // ID da igreja (perfil church)
  campoId?: string,     // ID do campo
  roleName?: string,    // Nome do cargo (secretária, tesoureiro, etc)
}
```

---

### 4.2 Verificação de Cash Status

**`POST /api/finance/cash-status/check`**

```typescript
// Request Body:
{ churchId: string, date: string }  // date: "YYYY-MM-DD"

// Response:
{
  churchId: string,
  date: string,
  year: number,
  month: number,
  canInsert: boolean,
  status: "OPEN" | "CLOSED",
  allowUntil: string | null,  // "YYYY-MM-DD"
  message: string
}

// SQL executado:
SELECT status, allow_until
FROM church_cashbook_status
WHERE church_id = $1::uuid
  AND reference_year = $2::int
  AND reference_month = $3::int
LIMIT 1

// Lógica:
isOpen = (status == 'OPEN') OR (allow_until IS NOT NULL AND allow_until >= date)
// Sem registro = OPEN por padrão
```

**Segurança:** Perfil `church` só pode verificar a sua própria `churchId`.

---

### 4.3 Listar Status de Caixa

**`POST /api/finance/cash-status/list`**

```typescript
// Request Body:
{
  year: number,
  months: number[],        // [1, 2, 3, ..., 12]
  churchIds?: string[],
  regionalIds?: string[],
  search?: string
}

// Response:
{
  rows: Array<{
    churchId: string,
    churchName: string,
    regionalId: string | null,
    regionalName: string,
    months: Array<{
      month: number,
      status: "OPEN" | "CLOSED",
      allowUntil: string | null,
      isOpen: boolean,
      label: string  // "Aberto" | "Fechado" | "Permitido ate YYYY-MM-DD"
    }>
  }>
}

// SQL das igrejas:
SELECT c.id::text, c.name, r.id::text, r.name
FROM churches c LEFT JOIN regionais r ON r.id = c.regional_id
WHERE c.deleted_at IS NULL AND [escopo por campo/regional/igreja]
ORDER BY r.name, c.name

// SQL dos status:
SELECT church_id::text, reference_month, status, allow_until
FROM church_cashbook_status
WHERE reference_year = $1
  AND church_id = ANY($2::uuid[])
  AND reference_month = ANY($3::int[])
```

---

### 4.4 Atualizar Status de Caixa

**`POST /api/finance/cash-status/update`**

```typescript
// Request Body:
{
  year: number,
  months: number[],
  action: "open" | "close" | "allow",
  churchIds?: string[],
  regionalIds?: string[],
  allowUntil?: string,   // obrigatório se action = "allow" ("YYYY-MM-DD")
  notes?: string
}

// Response:
{
  updatedCount: number,
  churches: number,
  months: number[],
  action: string
}

// SQL (UPSERT por igreja x mês):
INSERT INTO church_cashbook_status
  (id, church_id, reference_year, reference_month, status, allow_until, notes, updated_by, created_at, updated_at)
VALUES ($1::uuid, $2::uuid, $3::int, $4::int, $5::varchar, $6::date, $7::text, $8::uuid, now(), now())
ON CONFLICT (church_id, reference_year, reference_month)
DO UPDATE SET
  status = EXCLUDED.status,
  allow_until = EXCLUDED.allow_until,
  notes = EXCLUDED.notes,
  updated_by = EXCLUDED.updated_by,
  updated_at = now()
```

---

### 4.5 Opções de Cash Status

**`GET /api/finance/cash-status/options`**

Retorna regionais e igrejas disponíveis para o usuário usar nos filtros da tela de controle de caixa.

```typescript
// Response:
{
  regionals: Array<{ id: string, name: string }>,
  churches: Array<{ id: string, name: string, regionalId: string | null, regionalName: string }>
}
```

---

### 4.6 Dashboard — Resumo Anual

**`POST /api/finance/dashboard/summary`**

```typescript
// Request Body:
{ churchId?: string }

// Response:
{
  currentYear: number,
  prevYear: number,
  receita: {
    atual: number,
    anterior: number,
    pct: number | null,   // % crescimento ano a ano
    mediaMensal: number
  },
  despesa: {
    atual: number,
    anterior: number,
    pct: number | null,
    mediaMensal: number
  },
  saldo: { atual: number, anterior: number }
}

// SQL:
SELECT tipo, EXTRACT(YEAR FROM data_lancamento)::int AS ano,
       SUM(valor)::numeric AS total, COUNT(*)::int AS count
FROM livro_caixa lc [JOIN churches+regionais se campo]
WHERE deleted_at IS NULL
  AND data_lancamento >= DATE_TRUNC('year', NOW()) - INTERVAL '1 year'
  [AND escopo por church_id / campo]
GROUP BY tipo, ano
ORDER BY ano, tipo
```

---

### 4.7 Dashboard — Evolução Mensal

**`POST /api/finance/dashboard/monthly-evolution`**

```typescript
// Request Body:
{ churchId?: string, months?: number }  // months: 6-60, default 24

// Response:
{
  data: Array<{
    mes: string,             // "YYYY-MM"
    receita: number,
    despesa: number,
    saldo: number,           // receita - despesa daquele mês
    saldoAcumulado: number   // saldo acumulado desde o primeiro mês da série
  }>
}

// SQL:
SELECT TO_CHAR(data_lancamento, 'YYYY-MM') AS mes, tipo,
       SUM(valor)::numeric AS total, COUNT(*)::int AS count
FROM livro_caixa lc [JOIN]
WHERE deleted_at IS NULL
  AND data_lancamento >= DATE_TRUNC('month', NOW()) - INTERVAL 'N months'
  [AND escopo]
GROUP BY mes, tipo
ORDER BY mes ASC, tipo

// Meses sem registros são preenchidos com zeros para série completa
```

---

### 4.8 Dashboard — Breakdown por Categoria

**`POST /api/finance/dashboard/category-breakdown`**

```typescript
// Request Body:
{ churchId?: string, year?: number }

// Response:
{
  receitas: Array<{ categoria: string, total: number, count: number }>,
  despesas: Array<{ categoria: string, total: number, count: number }>,
  year: number
}

// SQL:
SELECT tipo,
       COALESCE(NULLIF(TRIM(plano_de_conta), ''), 'Sem categoria') AS plano_nome,
       SUM(valor)::numeric AS total, COUNT(*)::int AS qtd
FROM livro_caixa lc [JOIN]
WHERE deleted_at IS NULL
  AND EXTRACT(YEAR FROM data_lancamento) = :year
  [AND escopo]
GROUP BY tipo, plano_nome
ORDER BY tipo, SUM(valor) DESC
```

---

### 4.9 Dashboard — Formas de Pagamento

**`POST /api/finance/dashboard/payment-methods`**

```typescript
// Request Body:
{ churchId?: string, year?: number }

// Response:
{
  receitas: Array<{ forma: string, total: number, count: number }>,
  despesas: Array<{ forma: string, total: number, count: number }>
}

// SQL:
SELECT tipo,
       COALESCE(NULLIF(TRIM(forma_pg), ''), 'Não informado') AS forma,
       SUM(valor)::numeric AS total, COUNT(*)::int AS count
FROM livro_caixa lc [JOIN]
WHERE deleted_at IS NULL
  AND EXTRACT(YEAR FROM data_lancamento) = :year
  [AND escopo]
GROUP BY tipo, forma
ORDER BY tipo, total DESC
```

---

### 4.10 Dashboard — Análise de Dizimistas

**`POST /api/finance/dashboard/tithers-monthly`**

```typescript
// Request Body:
{ churchId?: string, months?: number }  // months: 6-60, default 24

// Response:
{ data: Array<{ mes: string, dizimistas: number, total: number }> }

// SQL:
SELECT TO_CHAR(data_lancamento, 'YYYY-MM') AS mes,
       COUNT(DISTINCT COALESCE(
         NULLIF(TRIM(id_favorecido_externo), ''),
         NULLIF(TRIM(favorecido), ''),
         id::text
       ))::int AS dizimistas,
       SUM(valor)::numeric AS total
FROM livro_caixa lc [JOIN]
WHERE deleted_at IS NULL
  AND tipo = 'RECEITA'
  AND plano_de_conta ILIKE '%dizimo%'
  AND data_lancamento >= DATE_TRUNC('month', NOW()) - INTERVAL 'N months'
  [AND escopo]
GROUP BY mes
ORDER BY mes ASC
```

Identificação única de dizimista: prioridade `id_favorecido_externo` → `favorecido` → `id` do registro.

---

### 4.11 Dashboard — Ranking de Igrejas

**`POST /api/finance/dashboard/church-ranking`**

```typescript
// Request Body:
{ churchId?: string, months?: number }  // months: 1-24, default 3

// Response:
{
  churches: Array<{
    churchId: string,
    churchName: string,
    receita: number,
    despesa: number,
    saldo: number,
    lancamentos: number
  }>
}

// SQL (Top 15 por receita):
SELECT c.name, lc.church_id::text,
       SUM(CASE WHEN tipo = 'RECEITA' THEN valor ELSE 0 END)::numeric AS receita,
       SUM(CASE WHEN tipo = 'DESPESA' THEN valor ELSE 0 END)::numeric AS despesa,
       COUNT(*)::int AS lancamentos
FROM livro_caixa lc
JOIN churches c ON c.id = lc.church_id
[JOIN regionais r ON r.id = c.regional_id WHERE r.campo_id = :campoId]
WHERE deleted_at IS NULL
  AND data_lancamento >= DATE_TRUNC('month', NOW()) - INTERVAL 'N months'
  [AND escopo]
GROUP BY lc.church_id, c.name
ORDER BY receita DESC
LIMIT 15
```

---

### 4.12 Upload de Comprovante

**`POST /api/upload/foto-despesa`**

```typescript
// Request: multipart/form-data
// Headers: Authorization: Bearer <token>
// Body: { file: File }   // aceita image/*, application/pdf

// Processamento:
// 1. Extrai extensão do arquivo
// 2. Gera nome: `${Date.now()}.{ext}`
// 3. Path no Storage: "fotodespesa/{nome}"
// 4. Upload para Supabase Storage bucket "fotos" (upsert: true)
// 5. Gera URL pública

// Response:
{ url: string }  // URL pública permanente do arquivo

// Erros:
// - 400: No file provided
// - 500: Erro no upload ao Storage
```

---

## 5. REGRAS DE SEGURANÇA E PERMISSÕES

### 5.1 Perfis de Usuário

| Perfil | `profileType` | Acesso financeiro |
|--------|--------------|-------------------|
| Master | `master` | Tudo: todos os campos, todas as igrejas |
| Admin | `admin` | Tudo dentro do seu `campoId` |
| Campo | `campo` | Igrejas do seu `campoId` |
| Regional | `regional` | Igrejas da sua `regionalId` |
| Igreja | `church` | Apenas sua própria `churchId` |

### 5.2 Função `isRestrictedToOwnChurch`

```typescript
// src/lib/helpers.ts
export function isRestrictedToOwnChurch(user: AuthUser) {
  if (user.profileType === "church") return true;
  // Normaliza o nome do cargo (remove acentos, lowercase)
  const n = normalizeRoleName(user.roleName || "");
  return n.includes("secret") || n.includes("tesour");
}
```

**Regra crítica:** Usuários com cargo "secretário/a" ou "tesoureiro/a" ficam restritos à própria `churchId`, independentemente do `profileType`.

### 5.3 Padrão de Scoping nas Queries

```typescript
// Padrão aplicado em todos os endpoints financeiros:
if (user?.churchId && user?.profileType === "church") {
  // filtra pelo churchId do usuário
  conditions.push(`lc.church_id = $${p}::uuid`);
  params.push(user.churchId);
} else if (reqChurchId) {
  // filtra pelo churchId informado na requisição
  conditions.push(`lc.church_id = $${p}::uuid`);
  params.push(reqChurchId);
} else if (user?.campoId) {
  // filtra por todas as igrejas do campo via JOIN
  conditions.push(`r.campo_id = $${p}::uuid`);
  params.push(user.campoId);
  needsJoin = true;  // JOIN churches c JOIN regionais r ON ...
}
```

### 5.4 Verificação de Acesso ao Cash Status

```typescript
// No endpoint /cash-status/check:
if (isRestrictedToOwnChurch(user) && user.churchId && user.churchId !== churchId) {
  return 403 "Voce nao tem acesso a este caixa."
}
```

### 5.5 Como as Permissões São Carregadas no Frontend

```typescript
// Web (MRM):
localStorage['mrm_user'] = JSON.stringify({
  profileType, churchId, churchName, campoId, fullName, email
})
localStorage['mrm_token'] = "<JWT Bearer token>"

// Leitura:
function readStoredUser() {
  try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); }
  catch { return {}; }
}
```

No Flutter, equivale a armazenar em `SharedPreferences` ou `FlutterSecureStorage`. O token JWT do Supabase Auth é usado diretamente como Bearer.

---

## 6. REGRAS DE BUSCA DE PESSOAS

### 6.1 Busca de Membros

**Tabela:** `members`

```typescript
// Detecta se é busca por ROL (somente dígitos):
const isRol = /^\d+$/.test(trimmed);

// Busca por ROL:
SELECT id, full_name, rol, church_id, churches(name)
FROM members
WHERE rol = :rolNum
LIMIT 20

// Busca por nome:
SELECT id, full_name, rol, church_id, churches(name)
FROM members
WHERE full_name ILIKE '%:termo%'
LIMIT 20

// Resultado exibido: "ROL {rol} - {nome_da_igreja}"
```

**Sem restrição por igreja** — membro de qualquer igreja pode ser selecionado.

### 6.2 Busca de Igrejas

**Tabela:** `churches`

```typescript
// Busca simples (dentro do formulário de lançamento):
SELECT id, name FROM churches WHERE name ILIKE '%:q%' LIMIT 20

// Busca avançada (ChurchPickerModal no Cashbook):
// 1. Tenta via endpoint:
GET /api/churches/search?q={search}&campoId={campoId}
// Retorna: id, name, code, addressCity, addressState, regional.name

// 2. Fallback se endpoint falhar:
SELECT id, name, code, address_city, address_state
FROM churches WHERE name ILIKE '%:q%' LIMIT 40
```

Limite de 60 resultados exibidos no picker modal.

### 6.3 Busca de PJ (Pessoa Jurídica)

```typescript
// Fonte 1: tabela members com member_type = 'PJ':
SELECT id, full_name, fantasy_name, cnpj, cpf
FROM members
WHERE member_type = 'PJ'
  AND (full_name ILIKE '%:q%' OR fantasy_name ILIKE '%:q%')
LIMIT 20

// Fonte 2: lançamentos anteriores com tipo_pessoa = 'PJ':
SELECT id, favorecido, id_favorecido_externo
FROM livro_caixa
WHERE tipo_pessoa = 'PJ'
  AND favorecido ILIKE '%:q%'
  AND favorecido IS NOT NULL
LIMIT 20

// Resultado: deduplica por nome (case-insensitive)
// Exibe: fantasy_name || full_name
// ID retornado: member.id (se de members) ou id_favorecido_externo (se de caixa)
```

### 6.4 Busca por ROL no Livro Caixa

```typescript
// Modo ROL — busca no campo id_favorecido_externo:
WHERE id_favorecido_externo ILIKE '%:term%'

// Modo Nome — busca no campo favorecido:
WHERE favorecido ILIKE '%:term%'
```

---

## 7. REGRAS DE PREENCHIMENTO AUTOMÁTICO

### 7.1 Tipo de Documento — Automático para RECEITA

```typescript
function getReceitaTipoDocumentoPadrao(planoDeContas, tipoDocumentoAtual) {
  const tipoNorm = normalizeText(tipoDocumentoAtual);

  // Se já tem tipo definido, mantém
  if (tipoNorm.includes('recibo receita')) return 'RECIBO RECEITA';
  if (tipoNorm.includes('outros receita')) return 'OUTROS RECEITA';

  // Se o plano é dízimo ou oferta → Recibo Receita automático
  const planoNorm = normalizeText(planoDeContas);
  if (planoNorm.includes('dizimo') || planoNorm.includes('oferta')) {
    return 'RECIBO RECEITA';
  }

  return tipoDocumentoAtual || null;
}
```

### 7.2 Resolução de Valores Armazenados por Nome

Ao carregar um lançamento para edição, os valores armazenados como texto são normalizados para corresponder às opções do select:

```typescript
function normalizeText(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function resolveNamedValue(currentValue: string, options: { nome: string }[]) {
  const match = options.find(opt =>
    normalizeText(opt.nome) === normalizeText(currentValue)
  );
  return match?.nome ?? currentValue;  // retorna o nome canônico ou o valor original
}
```

### 7.3 Referência — Preenchimento Automático

```typescript
// Default no formulário: mês atual no formato MM/AAAA
const d = new Date();
const referencia = `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
// Ex: "06/2026"
```

### 7.4 Igreja — Auto-seleção para Perfil Church

```typescript
// Ao abrir o formulário, se profileType === 'church':
setCaixaId(userObj.churchId);
setCaixaNome(userObj.churchName || churches.find(c => c.id === churchId)?.name);
// Campo fica não editável
```

---

## 8. CRUD DETALHADO — LIVRO CAIXA

### 8.1 CREATE — Novo Lançamento

**Quem pode criar:** Qualquer perfil com acesso à `church_id` informada.

**Sequência obrigatória:**
1. Validar campos obrigatórios (client-side)
2. Verificar duplicidade (query no banco)
3. Verificar cash status (`POST /api/finance/cash-status/check`)
4. Upload de foto se DESPESA e foto selecionada (`POST /api/upload/foto-despesa`)
5. `INSERT INTO livro_caixa (...) RETURNING id, legacy_id`
6. Exibir recibo automaticamente

**Campos inseridos no INSERT:**
```
church_id, data_lancamento, tipo, valor, tipo_pessoa, favorecido,
member_id, plano_de_conta, forma_pg, tipo_documento, num_doc,
referencia, obs, foto, id_favorecido_externo, operador
```

### 8.2 READ — Consultar Lançamentos

**Query principal (Livro Caixa):**
```sql
SELECT id, data_lancamento, tipo, valor, favorecido, plano_de_conta,
       categoria, forma_pg, referencia, obs, foto, legacy_id,
       num_doc, tipo_documento, member_id, church_id, operador,
       churches(name)
FROM livro_caixa
WHERE data_lancamento >= :dataInicio
  AND data_lancamento <= :dataFim
  [AND church_id = :churchId]
ORDER BY data_lancamento DESC
LIMIT 5000
```

**Paginação:** Client-side. Todos os dados são carregados de uma vez (até 5000 registros) e paginados localmente em grupos de 100 (configurável pelo usuário).

**Ordenação:** Client-side com `Array.sort()` — colunas: `data_lancamento`, `valor`, `tipo`, `favorecido`, `church`, `plano_tipo`.

**Filtro por tipo:** Client-side — `rows.filter(r => r.tipo === filterType)`.

### 8.3 UPDATE — Editar Lançamento

**Quem pode editar:** Mesmo escopo que CREATE.

**Campos editáveis** (via EditDrawer):
```
data_lancamento, plano_de_conta, tipo_documento,
num_doc, forma_pg, referencia, obs, valor
```

**Campos NÃO editáveis:** `favorecido`, `member_id`, `tipo`, `church_id`

```sql
UPDATE livro_caixa
SET data_lancamento = $1, plano_de_conta = $2, tipo_documento = $3,
    num_doc = $4, forma_pg = $5, referencia = $6, obs = $7, valor = $8
WHERE id = $9
```

**Validação:** `valor > 0`

### 8.4 DELETE — Excluir Lançamento

**Quem pode excluir:** Mesmo escopo.

**Tipo:** Exclusão **física** (hard delete):
```sql
DELETE FROM livro_caixa WHERE id = :id
```

**Confirmação:** Modal de confirmação antes de executar.

**Impacto:** Sem cascata. Apenas o registro é removido.

---

## 9. GERAÇÃO DE PDF / RELATÓRIOS

### 9.1 Recibo Individual — Estrutura HTML

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px;
           color:#000; padding:20px; max-width:580px; }
    @media print {
      body { padding:5mm; }
      @page { margin:8mm; size: A4 portrait; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <p>ADCampinas</p>
  <p>{nome_da_igreja}</p>
  <p class="title">RECIBO</p>
  <p>{ROL se membro} {favorecido}</p>
  <hr>
  <p>Número do Documento: {legacy_id || num_doc || id}</p>
  <p>Referência: {referencia} | {TIPO em cor: verde=receita, vermelho=despesa}</p>
  [se obs: <p style="border-left:3px solid #999">Obs: {obs}</p>]
  <hr>
  <table>
    <thead>REF/DATA | CONTA - CATEGORIA | FORMA PAGTO | VALOR</thead>
    <tbody>
      <tr>{data_br} | {plano_de_conta} - {tipo} | {forma_pg} | R$ {valor}</tr>
    </tbody>
  </table>
  <hr>
  {forma_pg}: R$ {valor}
  Total geral: R$ {valor}  [negrito, tamanho 13px]
  <p>VALOR TOTAL POR EXTENSO: {valorPorExtenso(valor)}</p>
  <div class="footer">
    <p>Lançado por: {operador}</p>
    <p>Emitido em: {datetime agora em pt-BR}</p>
  </div>
  [se incluirComprovante && foto:
    <hr>
    COMPROVANTE ANEXADO
    <img src="{foto_url}" style="max-width:100%; max-height:160mm" />
  ]
</body>
</html>
```

**Mecanismo de impressão:**
```typescript
const iframe = document.createElement('iframe');
iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;';
document.body.appendChild(iframe);
iframe.contentDocument.write(html);
iframe.contentWindow.addEventListener('afterprint', () => document.body.removeChild(iframe));
setTimeout(() => iframe.contentWindow.print(), 500);
```

---

### 9.2 Função `valorPorExtenso`

```typescript
function valorPorExtenso(valor: number): string {
  // Converte: 150.50 → "CENTO E CINQUENTA REAIS E CINQUENTA CENTAVOS"
  // Converte: 1000   → "MIL REAIS"
  // Converte: 1      → "UM REAL"
  // Converte: 0.01   → "UM CENTAVO"
  // Converte: 0      → "ZERO REAIS"
  // Range: até 999.999,99
}
```

Arrays usados:
- `U[]` — unidades/dezenas especiais (0-19)
- `D[]` — dezenas (20, 30, ..., 90)
- `C[]` — centenas (100, 200, ..., 900)

---

### 9.3 Relatório Analítico — Estrutura HTML

```html
<!DOCTYPE html>
<head>
  <style>
    @page { size: A4 portrait|landscape; margin: 10mm; }
    /* Fonte: Arial, 11px */
    /* table, totals grid, section headers */
  </style>
</head>
<body>
  <h1>RELATÓRIO</h1>
  <p>Analítico</p>

  <!-- Cabeçalho: Igreja + Período -->
  <div class="hdr">
    <div>Igreja: {churchName || 'Todas'}</div>
    <div>Período: {dataInicio_br} a {dataFim_br}</div>
  </div>

  <!-- Grid de totais (4 colunas) -->
  <div class="totals">
    Total Receita: R$ {totalReceita} (verde)
    Total Despesa: R$ {totalDespesa} (vermelho)
    Total Dízimos: R$ {totalDizimos}
    Total Ofertas: R$ {totalOfertas}
  </div>
  <div class="totals2">
    Qtd Receitas: {n}  |  Qtd Despesas: {n}  |  Qtd Dízimos: {n}  |  Qtd Ofertas: {n}
  </div>
  <div class="liquido" [style vermelho se negativo]>Líquido: R$ {liquido}</div>

  <!-- Tabela por grupo (plano de contas) -->
  <table>
    <thead>
      <tr>{colunas selecionadas com label}</tr>
    </thead>
    <!-- Para cada grupo: -->
    <tbody>
      <tr>[NOME DO GRUPO em destaque, cor verde/vermelho]</tr>
      <tr>[dados]</tr>
      [se obs não é coluna visível mas existe:
        <tr><td colspan="...">[obs em azul]</td></tr>
      ]
      <tr>[subtotal do grupo alinhado à coluna valor]</tr>
      <tr>[espaçamento]</tr>
    </tbody>
  </table>
</body>
```

---

## 10. EXPORT EXCEL

```typescript
// Biblioteca: xlsx (sheet.js)
// Função: exportToExcel(rows, dateFrom, dateTo)

// Colunas exportadas:
'#', 'Data', 'Tipo', 'Favorecido', 'Plano de Conta', 'Categoria',
'Forma Pgto', 'Nº Doc', 'Referência', 'Valor (R$)', 'Igreja', 'Observação', 'Operador'

// Largura das colunas (wch):
[4, 12, 10, 30, 25, 20, 16, 12, 16, 14, 28, 30, 20]

// Nome do arquivo gerado: livro-caixa_{dateFrom}_{dateTo}.xlsx
// Nome do sheet: 'Livro Caixa'
// Campo Valor: Number (não string) para permitir soma no Excel
// Campo Data: formatado em pt-BR (dd/mm/yyyy)
```

---

## 11. CONTROLE DE AUDITORIA

### 11.1 Campos de Auditoria no `livro_caixa`

| Campo | Tipo | Conteúdo |
|-------|------|---------|
| `operador` | VARCHAR(255) | Nome do usuário que lançou (denormalizado) |
| `operador_id` | UUID | FK para `users.id` |
| `created_by` | UUID | FK para `users.id` |
| `updated_by` | UUID | FK para `users.id` |
| `created_at` | TIMESTAMPTZ | Data/hora de criação |
| `updated_at` | TIMESTAMPTZ | Data/hora de última atualização |
| `deleted_at` | TIMESTAMPTZ | Data de exclusão (campo existe mas hard delete é usado) |
| `deletado_por` | VARCHAR(255) | Nome de quem deletou |
| `legacy_id` | BIGINT | ID do sistema legado (para rastrear importações) |

---

## 12. TABELAS DE APOIO (LOOKUP TABLES)

```sql
-- Consultadas no início de cada tela de lançamento:

-- 1. Plano de Contas:
SELECT id, nome, codigo
FROM plano_de_contas
WHERE tipo = 'RECEITA' | 'DESPESA'
  AND ativo = true
ORDER BY nome

-- 2. Formas de Pagamento:
SELECT id, nome
FROM forma_pagamento
WHERE mostrar = true
ORDER BY nome

-- 3. Tipos de Documento:
SELECT id, nome, sigla
FROM tipo_documento
WHERE (disponivel_receita = true | disponivel_despesa = true)
  AND ativo = true
ORDER BY nome
-- Após carregar, filtro adicional no client:
-- RECEITA: nome LIKE '%RECEITA%'
-- DESPESA: nome LIKE '%DESPESA%' ou genérico (sem 'RECEITA' e sem 'DESPESA' no nome)

-- 4. Regionais (para filtros):
SELECT id, name FROM regionais ORDER BY name

-- 5. Igrejas de uma regional:
SELECT id, name FROM churches WHERE regional_id = :regionalId ORDER BY name

-- 6. Igrejas do campo (para perfil campo):
SELECT id, name FROM churches WHERE campo_id = :campoId ORDER BY name
```

---

## 13. TIPOS E ENUMS

```typescript
// Tipo de lançamento:
type TipoLancamento = 'RECEITA' | 'DESPESA' | 'TRANSFERENCIA'

// Tipo de pessoa:
type TipoPessoa = 'MEMBRO' | 'NAO_MEMBRO' | 'PJ' | 'PF' | 'IGREJA'

// Status de caixa:
type CashStatus = 'OPEN' | 'CLOSED'

// Ação de cash status:
type CashAction = 'open' | 'close' | 'allow'

// Perfis de usuário:
type ProfileType = 'master' | 'admin' | 'campo' | 'regional' | 'church'

// Colunas do relatório:
type ColKey = 'igreja' | 'doc' | 'favorecido' | 'categoria' | 'tipodoc' |
              'referencia' | 'formaPg' | 'data' | 'valor' | 'obs'

// Ordenação:
type SortDir = 'asc' | 'desc'

// Chaves de ordenação do livro caixa:
type SortKey = 'data_lancamento' | 'valor' | 'tipo' | 'favorecido' | 'church' | 'plano_tipo'
```

---

## 14. OBSERVAÇÕES CRÍTICAS PARA O FLUTTER

1. **Armazenamento de nomes vs IDs:** O `livro_caixa` armazena o **nome** do plano de contas, forma de pagamento e tipo de documento (não o UUID). Isso é legado e deve ser mantido.

2. **Cash Status sempre verificado antes de INSERT:** Antes de qualquer lançamento, chamar `POST /api/finance/cash-status/check`. Se `canInsert = false`, bloquear com mensagem.

3. **Validação de duplicidade no cliente antes do INSERT:** Implementar a mesma lógica (mesmo church_id + tipo + data + valor + plano + favorecido/member_id).

4. **Fotos de despesa:** Upload via multipart/form-data para `/api/upload/foto-despesa`. URL retornada vai no campo `foto`.

5. **Scope de permissões:** O token JWT deve ser enviado em todas as chamadas. As APIs fazem restrição server-side baseada no token.

6. **Número do documento é obrigatório para DESPESA**, opcional para RECEITA.

7. **Observação diferenciada para duplicatas:** Para inserir lançamento duplicado intencionalmente, informar observação **diferente** da existente.

8. **Repetição de dízimos:** Funcionalidade especial que copia lançamentos de dízimos de um mês para o atual. Cada repetição verifica cash status + INSERT + exibe recibo.

9. **Paginação client-side:** Todas as buscas retornam até 5000 registros de uma vez. Paginação é feita localmente.

10. **Normalização de texto:** Comparações de nomes sempre via normalize NFD + lowercase para evitar problemas com acentos.

11. **Valor em centavos no input:** No formulário, o campo de valor usa máscara de centavos — o usuário digita apenas dígitos e o sistema divide por 100 para obter o valor decimal.

12. **Armazenamento de credenciais no Flutter:**
    - Token JWT → `FlutterSecureStorage` (equivalente ao `localStorage['mrm_token']`)
    - Dados do usuário → `SharedPreferences` (equivalente ao `localStorage['mrm_user']`)

13. **URL base da API:** Configurada em `src/lib/apiBase.ts`. No Flutter, equivale a uma constante de ambiente apontando para o domínio do MRM.

14. **Supabase bucket para fotos:** `fotos`, subpath `fotodespesa/`. Acesso público. Arquivo: `{timestamp}.{ext}`.

---

## 15. CONFIGURAÇÃO DE AMBIENTE

```
Supabase URL:       ysibqnwgitakofehdxvd.supabase.co
Supabase bucket:    fotos  (subpath: fotodespesa/)
Auth:               JWT Bearer via Supabase Auth, validado pelo MRM
API Next.js base:   configurado em src/lib/apiBase.ts
```
