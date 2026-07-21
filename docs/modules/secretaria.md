# DOCUMENTAÇÃO TÉCNICA COMPLETA — MÓDULO SECRETARIA MRM
## Engenharia Reversa para Implementação no App Flutter/Dart

---

## 1. VISÃO GERAL DO MÓDULO

O módulo de Secretaria do MRM cobre:

1. **Gestão de Membros** — CRUD completo, busca, filtros, perfil, histórico
2. **Sistema Kanban Eclesiástico** — pipeline de processos (Batismo, Transferência, Consagração, Credencial)
3. **Matriz de Decisão (KanMatrixRule)** — regras automáticas que alteram status/título/church ao mover card
4. **Credenciais (tbcredencial)** — emissão e controle de credenciais ministeriais
5. **Ocorrências e Histórico** — registro de movimentos e eventos do membro
6. **Aniversariantes** — listagem com agrupamento por hoje/semana/mês
7. **Verificação de duplicatas** — por CPF ou nome antes de cadastrar

---

## 2. TABELAS DO BANCO DE DADOS

### 2.1 `members` — Tabela Principal de Membros

```sql
CREATE TABLE members (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id               UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  regional_id             UUID REFERENCES regionais(id),
  campo_id                UUID REFERENCES campos(id),
  user_id                 UUID REFERENCES users(id),
  ecclesiastical_title_id UUID REFERENCES ecclesiastical_titles(id),
  member_type             VARCHAR(20) DEFAULT 'MEMBRO',   -- 'MEMBRO' | 'PF' | 'PJ'
  rol                     INT DEFAULT autoincrement(),     -- número do ROL

  -- Identificação pessoal
  full_name               VARCHAR(255) NOT NULL,
  preferred_name          VARCHAR(100),
  fantasy_name            VARCHAR(255),
  photo_url               VARCHAR(500),
  cover_photo_url         TEXT,

  -- Documentos
  cpf                     VARCHAR(14) UNIQUE,
  cnpj                    VARCHAR(18),
  rg                      VARCHAR(20),
  birth_date              DATE,
  gender                  VARCHAR(20),
  marital_status          VARCHAR(20),    -- 'SOLTEIRO' | 'CASADO' | 'VIUVO' | 'DIVORCIADO'

  -- Contato
  email                   VARCHAR(255),
  phone                   VARCHAR(20),
  mobile                  VARCHAR(20),

  -- Endereço
  address_street          VARCHAR(255),
  address_number          VARCHAR(20),
  address_complement      VARCHAR(100),
  address_neighborhood    VARCHAR(100),
  address_city            VARCHAR(100),
  address_state           VARCHAR(50),
  address_zipcode         VARCHAR(10),

  -- Status eclesiástico
  membership_status       VARCHAR(30) DEFAULT 'AGUARDANDO ATIVACAO',
  membership_date         DATE,
  ecclesiastical_title    VARCHAR(120) DEFAULT 'CONGREGADO',
  baptism_status          VARCHAR(20),
  baptism_date            DATE,

  -- Família
  father_name             VARCHAR(255),
  mother_name             VARCHAR(255),
  spouse_id               UUID REFERENCES members(id),
  spouse_name             VARCHAR(255),

  -- Naturalidade
  naturality_city         VARCHAR(100),
  naturality_state        VARCHAR(2),
  nationality             VARCHAR(100),

  -- Eleitorado
  voter_registration      VARCHAR(20),
  voter_zone              VARCHAR(10),
  voter_section           VARCHAR(10),

  -- Trabalho
  occupation              VARCHAR(255),
  company                 VARCHAR(255),

  -- Extras
  notes                   TEXT,
  emergency_contact_name  VARCHAR(255),
  emergency_contact_phone VARCHAR(20),
  search_vector           tsvector,   -- índice de busca full-text

  -- Auditoria
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now(),
  created_by              UUID REFERENCES users(id),
  updated_by              UUID REFERENCES users(id),
  deleted_at              TIMESTAMPTZ   -- soft delete
);

-- Índices
CREATE INDEX ON members(church_id);
CREATE INDEX ON members(campo_id);
CREATE INDEX ON members(ecclesiastical_title_id);
CREATE INDEX ON members(member_type);
CREATE INDEX ON members(regional_id);
CREATE INDEX ON members(membership_status);
```

**Valores padrão importantes:**
- `membership_status` = `'AGUARDANDO ATIVACAO'` ao criar
- `ecclesiastical_title` = `'CONGREGADO'` ao criar
- `member_type` = `'MEMBRO'`

**Membros PF/PJ:** Quando `member_type` é `PF` ou `PJ`, os campos eclesiásticos (`ecclesiastical_title_id`, `ecclesiastical_title`, `baptism_status`, `baptism_date`) são forçados a `null`.

---

### 2.2 `ecclesiastical_titles` — Títulos Eclesiásticos

```sql
CREATE TABLE ecclesiastical_titles (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                     VARCHAR(120) NOT NULL UNIQUE,
  abbreviation             VARCHAR(30),
  level                    INT DEFAULT 0,         -- hierarquia (0=menor)
  grouping                 VARCHAR(120),
  prerequisite_level       INT,
  minimum_age              INT,
  maximum_age              INT,
  prerequisite_occurrence  TEXT,
  is_active                BOOLEAN DEFAULT true,
  is_fixed                 BOOLEAN DEFAULT false, -- não pode ser editado
  is_ecclesiastical_minister BOOLEAN DEFAULT false,
  allow_men                BOOLEAN DEFAULT true,
  allow_women              BOOLEAN DEFAULT true,
  profile                  VARCHAR(120),
  display_order            INT DEFAULT 0,
  consecration_type_key    VARCHAR(50),  -- chave de tipo para consagração
  created_at               TIMESTAMPTZ DEFAULT now(),
  updated_at               TIMESTAMPTZ DEFAULT now(),
  deleted_at               TIMESTAMPTZ
);
```

**Títulos que não aparecem para consagração:** `CONGREGADO`, `MEMBRO` (filtrados por `name NOT IN ('CONGREGADO','MEMBRO')`).

---

### 2.3 `baptisms` — Registro de Batismos

```sql
CREATE TABLE baptisms (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id          UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  member_id          UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  baptism_date       DATE NOT NULL,
  location           VARCHAR(255),
  minister_id        UUID REFERENCES members(id),   -- membro que ministrou
  certificate_number VARCHAR(50) UNIQUE,
  certificate_url    VARCHAR(500),
  witnesses          JSONB,   -- array de testemunhas
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now(),
  created_by         UUID REFERENCES users(id),
  deleted_at         TIMESTAMPTZ
);
```

---

### 2.4 `member_event_history` — Histórico de Eventos do Membro

```sql
CREATE TABLE member_event_history (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id      UUID REFERENCES members(id) ON DELETE SET NULL,
  card_id        UUID REFERENCES kan_cards(id) ON DELETE SET NULL,
  church_id      UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  service_group  VARCHAR(60),   -- ex: 'BATISMO', 'TRANSFERENCIA', 'CONSAGRACAO', 'OCORRENCIA'
  service_name   VARCHAR(255),  -- descrição do serviço
  column_index   INT,           -- posição no kanban (1=entrada, 2=próxima coluna, etc)
  action         VARCHAR(120),  -- nome da ocorrência/ação
  member_city    VARCHAR(100),
  member_state   VARCHAR(50),
  member_country VARCHAR(100),
  notes          TEXT,
  metadata       JSONB,         -- dados extras (source, cardId, serviceId, etc)
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON member_event_history(member_id);
CREATE INDEX ON member_event_history(church_id, created_at);
```

**Campo `destination_church_id`:** Presente no metadata quando há transferência (`doesTransfer = true` na matrix rule).

---

### 2.5 `member_title_history` — Histórico de Títulos

```sql
CREATE TABLE member_title_history (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id      UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  church_id      UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  card_id        UUID,          -- card que originou a mudança (opcional)
  previous_title VARCHAR(120),
  new_title      VARCHAR(120) NOT NULL,
  source         VARCHAR(60),   -- 'MATRIZ', 'MANUAL', 'OCORRENCIA_RAPIDA'
  service_group  VARCHAR(60),
  service_name   VARCHAR(255),
  member_city    VARCHAR(100),
  member_state   VARCHAR(50),
  member_country VARCHAR(100),
  notes          TEXT,
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON member_title_history(member_id);
CREATE INDEX ON member_title_history(church_id, created_at);
```

---

### 2.6 `member_occurrences` — Ocorrências do Membro

```sql
CREATE TABLE member_occurrences (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id      UUID REFERENCES members(id),
  church_id      UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  card_id        UUID REFERENCES kan_cards(id),
  name           VARCHAR(160) NOT NULL,
  message        VARCHAR(255),
  service_sigla  VARCHAR(50),
  service_group  VARCHAR(60),
  action         VARCHAR(120),
  column_index   INT,
  member_city    VARCHAR(100),
  member_state   VARCHAR(50),
  member_country VARCHAR(100),
  metadata       JSONB,
  occurred_at    TIMESTAMPTZ DEFAULT now(),
  created_at     TIMESTAMPTZ DEFAULT now(),
  created_by     UUID REFERENCES users(id)
);

CREATE INDEX ON member_occurrences(member_id);
CREATE INDEX ON member_occurrences(church_id, occurred_at);
```

---

### 2.7 `kan_pipelines` — Pipelines do Kanban

```sql
CREATE TABLE kan_pipelines (
  id        INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name      VARCHAR(120) NOT NULL,
  type      VARCHAR(120),   -- tipo/categoria do pipeline
  hash      VARCHAR(60),
  campo     VARCHAR(120),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

### 2.8 `kan_services` — Catálogo de Serviços Eclesiásticos

```sql
CREATE TABLE kan_services (
  id            INT PRIMARY KEY,           -- ID fixo (não gerado)
  sigla         VARCHAR(50) NOT NULL,      -- ex: 'BATISMO', 'TRANS', 'CONSAG', 'SOLCRED'
  description   VARCHAR(255) NOT NULL,
  servico       VARCHAR(120),
  service_group VARCHAR(60),  -- 'BATISMO'|'TRANSFERENCIA'|'CONSAGRACAO'|'CREDENCIAL'
  uses_matrix   BOOLEAN DEFAULT false,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
```

**`service_group` é a chave de roteamento para encontrar o serviço certo por processo.**

---

### 2.9 `kan_stages` — Etapas do Pipeline

```sql
CREATE TABLE kan_stages (
  id          INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  pipeline_id INT NOT NULL REFERENCES kan_pipelines(id) ON DELETE CASCADE,
  service_id  INT REFERENCES kan_services(id),
  name        VARCHAR(120) NOT NULL,
  description VARCHAR(255),
  author      VARCHAR(120),
  campo       VARCHAR(120),
  hash        VARCHAR(60),
  show        BOOLEAN DEFAULT true,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
```

---

### 2.10 `kan_columns` — Colunas do Kanban

```sql
CREATE TABLE kan_columns (
  id           INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  stage_id     INT NOT NULL REFERENCES kan_stages(id) ON DELETE CASCADE,
  name         VARCHAR(120) NOT NULL,   -- ex: 'Pendente', 'Aprovado', 'Cancelado'
  column_index INT NOT NULL,            -- posição: 1=entrada, 2,3...=progresso
  color        VARCHAR(20) DEFAULT 'blue',
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(stage_id, column_index)
);
```

---

### 2.11 `kan_matrix_rules` — Matriz de Decisão

```sql
CREATE TABLE kan_matrix_rules (
  id                  INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  service_id          INT NOT NULL REFERENCES kan_services(id) ON DELETE CASCADE,
  column_index        INT NOT NULL,     -- qual coluna aciona a regra
  stage_id            INT REFERENCES kan_stages(id),
  age_min             INT DEFAULT 0,
  age_max             INT DEFAULT 0,
  is_active           BOOLEAN DEFAULT true,

  -- Ações no membro
  change_status       BOOLEAN DEFAULT false,
  new_status          VARCHAR(60),      -- novo membershipStatus
  change_title        BOOLEAN DEFAULT false,
  new_title           VARCHAR(60),      -- novo ecclesiasticalTitle
  does_transfer       BOOLEAN DEFAULT false, -- faz transferência de igreja

  -- Ocorrências
  insert_occurrence   BOOLEAN DEFAULT true,
  occurrence_name     VARCHAR(120),     -- nome da ocorrência a inserir
  message             VARCHAR(255),

  -- Permissões extras
  allow_message       BOOLEAN DEFAULT false,
  allow_doc_model     BOOLEAN DEFAULT false,
  doc_model           VARCHAR(120),
  allow_attachments   BOOLEAN DEFAULT false,
  require_document    BOOLEAN DEFAULT false,

  -- Credenciais
  generates_credential BOOLEAN DEFAULT false,
  credential_kind     VARCHAR(60),
  credential_model    VARCHAR(60),
  credential_validity VARCHAR(60),

  -- Serviço extra encadeado
  servico_extra       VARCHAR(60),
  description         VARCHAR(255),

  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE(service_id, column_index)
);
```

**Como a matriz funciona:**
Ao mover um card para a coluna `column_index`, o sistema busca a regra `WHERE service_id = card.serviceId AND column_index = novaColuna`. Se encontrada, executa:
1. Se `change_status`: atualiza `members.membership_status = new_status.toUpperCase()`
2. Se `change_title`: atualiza `members.ecclesiastical_title = new_title`, busca `ecclesiastical_titles` por nome e atualiza o FK
3. Se `does_transfer`: atualiza `members.church_id = card.destination_church_id`
4. Se `insert_occurrence != false`: insere em `member_event_history`

---

### 2.12 `kan_cards` — Cards do Kanban (Processos)

```sql
CREATE TABLE kan_cards (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  protocol                VARCHAR(60) UNIQUE NOT NULL,  -- gerado: "{HASH}-{SIGLA}-{ANO}"
  stage_id                INT NOT NULL REFERENCES kan_stages(id),
  service_id              INT NOT NULL REFERENCES kan_services(id),
  column_id               INT REFERENCES kan_columns(id),
  column_index            INT DEFAULT 1,

  -- Relacionamentos
  church_id               UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  member_id               UUID REFERENCES members(id),
  destination_church_id   UUID REFERENCES churches(id),  -- destino na transferência

  -- Regionais
  origin_regional_id      UUID REFERENCES regionais(id),
  destination_regional_id UUID REFERENCES regionais(id),

  -- Igrejas requerentes
  requester_church_id     UUID REFERENCES churches(id),
  requested_church_id     UUID REFERENCES churches(id),
  requester_name          VARCHAR(255),

  -- Dados do candidato no momento do processo
  candidate_name          VARCHAR(255),
  current_title           VARCHAR(60),    -- título atual ao abrir o processo
  intended_title          VARCHAR(60),    -- título pretendido (consagração)

  -- Status
  status                  VARCHAR(60) DEFAULT 'pendente',
  status_label            VARCHAR(120),

  -- Textos
  subject                 VARCHAR(255),
  justification           TEXT,
  observations            TEXT,
  description             TEXT,

  -- Aprovação
  approved_by             UUID,
  approved_at             TIMESTAMPTZ,

  -- Extras
  metadata                JSONB,    -- dados específicos do fluxo (baptismDate, consecrationDate, etc)
  attachments             JSONB,    -- array de anexos [{type, url, name}]

  -- Datas
  opened_at               TIMESTAMPTZ DEFAULT now(),
  closed_at               TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now(),
  created_by              UUID REFERENCES users(id),
  updated_by              UUID REFERENCES users(id),
  deleted_at              TIMESTAMPTZ

);

CREATE INDEX ON kan_cards(church_id);
CREATE INDEX ON kan_cards(stage_id, status);
CREATE INDEX ON kan_cards(service_id);
CREATE INDEX ON kan_cards(opened_at);
```

**Geração do protocolo:**
```typescript
function buildProtocol(sigla: string) {
  const year = new Date().getFullYear();
  const prefix = crypto.randomUUID().replace(/-/g, '').substring(0, 5).toUpperCase();
  return `${prefix}-${sigla}-${year}`;
  // Ex: "A3F7B-BATISMO-2026"
}
```

---

### 2.13 `tbcredencial` — Credenciais (Supabase direto, não Prisma)

Esta tabela é acessada via `supabaseAdmin` diretamente, **não** via Prisma ORM.

```sql
-- Colunas relevantes consultadas no código:
id              UUID PRIMARY KEY
nome            TEXT                -- nome do titular
tipo            TEXT NOT NULL       -- tipo de credencial
numero          TEXT                -- número da credencial
idtbmembro      INT                 -- ID legado do membro
member_id       UUID                -- FK para members.id
church_id       UUID                -- FK para churches.id
requester_user_id UUID              -- usuário que solicitou
igrejasolicitante TEXT              -- nome formatado da igreja
datavalidade    DATE
dataemissao     DATE
situacao        TEXT DEFAULT 'Pendente'  -- 'Pendente'|'Aprovada'|'Emitida'|'Cancelada'
obs             TEXT
kan_card_id     UUID                -- FK para kan_cards.id
card_protocol   TEXT
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
```

---

### 2.14 `church_function_history` — Funções Exercidas pelo Membro

Tabela **compartilhada** entre a aba "Funcoes" da tela de Editar Igreja e a aba
"Funções" do perfil do membro. Como as duas telas gravam aqui, o que é criado de
um lado aparece automaticamente no outro — não há sincronização.

O catálogo de funções (`church_function_catalog`) é **global** (uma lista para todo
o sistema) e tem CRUD em Configurações → Listas Auxiliares.

```sql
CREATE TABLE church_function_history (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id     UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  member_id     UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  function_id   UUID NOT NULL REFERENCES church_function_catalog(id) ON DELETE RESTRICT,
  department    VARCHAR(150),        -- texto livre, sem tabela de apoio
  start_date    DATE NOT NULL,
  end_date      DATE,                -- preenchida = função encerrada
  notes         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  is_campo_wide BOOLEAN NOT NULL DEFAULT false,  -- alcance de campo (ver abaixo)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL,
  deleted_at    TIMESTAMPTZ          -- exclusão lógica
);

CREATE INDEX ON church_function_history(church_id, function_id);
CREATE INDEX ON church_function_history(member_id);

-- Impede duas funções ATIVAS iguais na mesma igreja/departamento.
CREATE UNIQUE INDEX church_function_history_active_department_unique
  ON church_function_history (church_id, function_id, COALESCE(department, ''))
  WHERE deleted_at IS NULL AND end_date IS NULL AND is_active = true;
```

**Regras de negócio:**

| Regra | Comportamento |
|---|---|
| Múltiplas ativas | Um membro **pode** ter várias funções ativas ao mesmo tempo. |
| Unicidade (dirigente) | Se o catálogo tem `is_leader_role`, só pode haver **uma** ativa por `(church_id, function_id)`, ignorando departamento. |
| Unicidade (demais) | Considera também o departamento: `(church_id, function_id, department)`. |
| `is_campo_wide` | A função é sempre gravada numa igreja (`church_id`). A flag apenas indica que o **alcance** é todo o campo, não só aquela igreja. Por padrão `false`. |
| Encerramento | Preencher `end_date` força `is_active = false` (a função vai para o histórico). |
| Exclusão | Lógica (`deleted_at`), com `is_active = false` e `end_date` preenchida. |

A regra de unicidade está centralizada em `src/lib/churchFunctions.ts`
(`findActiveFunctionConflict`) e é usada por todas as rotas de escrita.

---

### 2.15 `member_family_relationships` — Núcleo Familiar

Guarda filhos, cônjuge, pais e irmãos. O familiar **não precisa ser um membro
cadastrado**: quando `related_member_id` é nulo, os dados da pessoa ficam nas
colunas `related_*` (caso comum de filhos pequenos).

```sql
CREATE TABLE member_family_relationships (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id          UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  related_member_id  UUID REFERENCES members(id) ON DELETE CASCADE,  -- NULL = não é membro
  relationship_type  VARCHAR(30) NOT NULL,  -- 'FILHO'|'CONJUGE'|'PAI_MAE'|'IRMAO'
  related_name       VARCHAR(255),          -- usado quando related_member_id IS NULL
  related_birth_date DATE,
  related_gender     VARCHAR(20),
  notes              TEXT,
  created_by         UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL,
  deleted_at         TIMESTAMPTZ            -- exclusão lógica
);

CREATE INDEX ON member_family_relationships(member_id);
CREATE INDEX ON member_family_relationships(related_member_id);
```

> **Histórico:** a tabela existia desde o init mas nunca foi usada, e exigia
> `related_member_id NOT NULL` — o que impedia cadastrar filho sem cadastro de
> membro. A restrição foi removida e o `UNIQUE(member_id, related_member_id,
> relationship_type)` original foi trocado por índices simples, porque com valores
> `NULL` o Postgres não deduplica e um membro pode ter vários filhos avulsos.

**Validação na API:** é obrigatório informar `related_member_id` **ou**
`related_name`. Quando há membro vinculado, `related_name` é gravado como `NULL`
(o nome vem do cadastro do membro).

---

### 2.16 `face_presencas` — Presença Facial (origem dos gráficos do perfil)

Tabela de check-ins por reconhecimento facial. **Não tem FK para `members`** — o
casamento membro↔presença é feito por `rol` **OU** por `nome` (maiúsculas, sem
espaços nas pontas), mesmo critério usado no módulo de Presença Facial.

```sql
-- Colunas relevantes (tabela criada fora das migrations do Prisma):
id              UUID PRIMARY KEY
rol             INT                 -- casa com members.rol (pode ser NULL)
nome            VARCHAR(255) NOT NULL
cargo           VARCHAR(100)
horario         TIMESTAMP NOT NULL  -- momento do check-in
confianca       FLOAT
camera          VARCHAR(100)
igreja_regional VARCHAR(255)
campo           VARCHAR(255)
church_id       UUID
data_registro   TIMESTAMP NOT NULL DEFAULT now()

-- Índices adicionados para a agregação por membro:
CREATE INDEX face_presencas_rol_idx        ON face_presencas (rol);
CREATE INDEX face_presencas_horario_idx    ON face_presencas (horario);
CREATE INDEX face_presencas_nome_upper_idx ON face_presencas (UPPER(TRIM(nome)));
```

**Convenção de período (importante):** o sistema usa **dois** períodos com corte
às **13h** — `Manhã` (< 13h) e `Noite` (>= 13h). Essa é a regra de `getPeriod` em
`AttendanceModule.tsx` e deve ser seguida em qualquer tela nova, senão os números
não batem entre o perfil do membro e o módulo de Presença Facial.

---

## 3. TELAS E FLUXOS DO MÓDULO

### 3.1 Lista de Membros (`/app-ui/members`)

**Componentes:** `Members.tsx`, `MembersGrid.tsx`

**Filtros disponíveis:**
- Busca por nome (startsWith ou contains por tokens) ou número do ROL (se string só dígitos)
- `churchId` — filtrar por igreja específica
- `regionalId` — filtrar por regional
- `campoId` — filtrar por campo
- `memberType` — `ALL` | `MEMBRO` | `PF` | `PJ`
- `status` — `ativo` | `inativo` | `visitante` | `aguardando` (separados por vírgula para múltiplos)
- `maritalStatus` — `casado` | `solteiro` | `viuvo` | `divorciado` | `__NONE__`
- `titleId` — ID(s) de título eclesiástico, separados por vírgula; `__NONE__` para sem título

**Paginação:** Server-side. Parâmetros: `page` (default 1), `pageSize` (default 20, máx 5000).

**Resposta paginada:**
```json
{
  "data": [...],
  "total": 100,
  "activeCount": 80,
  "inactiveCount": 10,
  "churchCount": 5
}
```

**Modo legado (com `limit`):** Retorna array simples, sem paginação.

**Include padrão retornado:**
```typescript
{
  church: { id, name, code, regional: { id, name, code, campoId, campo: { id, name } } },
  regional: { id, name, code },
  ecclesiasticalTitleRef: { id, name, abbreviation, level }
}
```

**Filtro de status (lógica):**
- `ativo`: membership_status NOT IN (null, '', 'aguard%', 'inativ%', 'deslig%', 'visit%')
- `inativo`: membership_status ILIKE '%inativ%' OR ILIKE '%deslig%'
- `visitante`: membership_status IS NULL OR = '' OR ILIKE '%visit%'
- `aguardando`: membership_status ILIKE '%aguard%'

---

### 3.2 Perfil do Membro (`/app-ui/members/:id`)

**Componente:** `MemberProfile.tsx`

**Dados carregados:**
```typescript
// GET /api/members/:id
{
  id, rol, fullName, preferredName, photoUrl, coverPhotoUrl,
  cpf, rg, birthDate, gender, maritalStatus,
  email, phone, mobile,
  addressStreet, addressNumber, addressComplement, addressNeighborhood,
  addressCity, addressState, addressZipcode,
  membershipStatus, membershipDate, ecclesiasticalTitle, baptismStatus, baptismDate,
  fatherName, motherName, spouseName,
  naturalityCity, naturalityState, nationality,
  occupation, company, notes,
  emergencyContactName, emergencyContactPhone,
  memberType, cnpj,
  church: { id, name, code, regional: { campo } },
  regional: { id, name },
  ecclesiasticalTitleRef: { id, name, abbreviation, level },
  ministryMemberships: [{ ministry: { id, name } }]   // ministérios ativos
}
```

**Abas do perfil:** Histórico · Títulos · **Funções** · **Família**

**Cabeçalho:** além do título eclesiástico, exibe as **funções ativas** do membro
(selo verde; com sufixo "· Campo" quando `is_campo_wide`).

#### 3.2.1 Aba Funções

- `GET /api/members/:id/functions` — todas as funções do membro (ativas primeiro).
- `POST /api/members/:id/functions` — cria. `churchId` assume a igreja do membro
  quando não informado; aceita `isCampoWide`.
- `PATCH` / `DELETE` reaproveitam `/api/church-function-history/:id`.
- Catálogo do dropdown: `GET /api/church-functions/catalog`.

Campos do formulário: função, departamento, início, término, switch **Ativa** e
switch **Abrange todo o campo**. Ver regras em §2.14.

#### 3.2.2 Aba Família

- `GET /api/members/:id/family` — vínculos agrupados por tipo.
- `POST /api/members/:id/family` — exige `relationshipType` e (`relatedMemberId`
  **ou** `relatedName`).
- `PATCH` / `DELETE /api/members/:id/family/:relId` — exclusão lógica.

A tela permite cadastrar familiar **avulso** (nome, nascimento, sexo) ou
**vincular um membro existente** via busca; nesse caso mostra link para o perfil
dele. A idade é calculada a partir da data de nascimento (do membro vinculado ou
do cadastro avulso).

> A tela `FamilyRelationships.tsx` (rota `/app-ui/members/:id/family`) é um
> **mockup legado** com nomes fixos e botão sem ação. A implementação real é a
> aba Família do perfil.

#### 3.2.3 Card de Presença

`GET /api/members/:id/attendance-stats` (aceita `de` e `ate`) retorna:

```typescript
{
  byDay: number[],                    // 7 posições, Dom..Sáb
  byPeriod: { manha: number, noite: number },
  total: number,                      // total de detecções
  distinctDays: number,               // dias distintos com presença
  lastPresence: { horario, igrejaRegional } | null,
  matchedBy: 'rol+nome' | 'nome'
}
```

A agregação é feita **no servidor** (`GROUP BY` sobre `face_presencas`) porque
`/api/face-presence` limita `pageSize` a 100 — somar no cliente truncaria
silenciosamente quem tem mais de 100 presenças.

> **Correção importante:** até a versão anterior esses gráficos liam
> `/api/members/:id/event-history`, que é a **trilha de auditoria do CRM**. Os
> números mostravam "dia da semana em que alguém editou o cadastro", não presença.
> Um membro que nunca frequentou, mas cujo registro foi editado três vezes numa
> terça, aparecia com pico na terça.

---

### 3.3 Editar Membro (`PATCH /api/members/:id`)

**Validações antes do PATCH:**
1. `ecclesiasticalTitleId` é validado: deve existir em `ecclesiastical_titles` WHERE `isActive = true AND deletedAt IS NULL`
2. Se `ecclesiasticalTitleId` informado, `ecclesiasticalTitle` é sincronizado com o nome do título (evita divergência)
3. Se `memberType = 'PF'` ou `'PJ'`, força `ecclesiasticalTitleId = null`, `ecclesiasticalTitle = null`, `baptismStatus = null`, `baptismDate = null`
4. Se `cnpj` informado, verifica unicidade: `WHERE cnpj = valor AND deletedAt IS NULL AND id != membroAtual`
5. Se `churchId` muda, resolve `regionalId` da nova igreja automaticamente

**Campos aceitos no PATCH body:** Qualquer campo do model `Member`.

**Campos com tratamento especial:**
```typescript
birthDate: data.birthDate ? new Date(data.birthDate) : undefined,
membershipDate: data.membershipDate ? new Date(data.membershipDate) : undefined,
baptismDate: data.baptismDate ? new Date(data.baptismDate) : undefined,
updatedBy: user.id  // preenchido automaticamente
```

---

### 3.4 Excluir Membro (`DELETE /api/members/:id`)

**Dois modos:**
- **Soft delete (padrão):** `DELETE /api/members/:id` → seta `deleted_at = now()`
- **Hard delete (permanente):** `DELETE /api/members/:id?permanent=true` → transação que:
  1. `UPDATE kan_cards SET member_id = NULL WHERE member_id = id`
  2. `DELETE FROM member_event_history WHERE member_id = id`
  3. `DELETE FROM members WHERE id = id`

**Segurança:** `assertChurchAccess` — apenas mesma igreja ou admin/master pode excluir.

---

### 3.5 Verificação de Duplicata (`GET /api/members/check`)

```typescript
// Antes de cadastrar novo membro, verificar:
GET /api/members/check?cpf=12345678901
GET /api/members/check?name=João Silva

// Resposta se encontrado:
{ exists: true, type: 'cpf'|'name', member: { id, fullName, cpf, churchId, church } }

// Resposta se não encontrado:
{ exists: false }
```

**Lógica:** Prioridade CPF → se não encontrar por CPF, tenta por nome exato (case-insensitive).

---

### 3.6 Aniversariantes (`GET /api/members/birthdays`)

```typescript
// Parâmetros:
?month=6          // mês alvo (default: mês atual)
&churchId=uuid    // filtrar por igreja
&churchIds=id,id  // múltiplas igrejas
&campoId=uuid     // filtrar por campo
&regionalId=uuid  // filtrar por regional

// Resposta:
{
  stats: {
    today: 3,        // aniversariantes hoje
    thisWeek: 12,    // próximos 6 dias
    thisMonth: 45,   // este mês
    nextMonth: 38    // próximo mês
  },
  members: [{
    id, name, fullName, day, month, age,
    phone, email, photoUrl, church, churchId,
    membershipStatus, daysUntil, today: boolean
  }]
}
```

**Ordenação:** Por `day` (dia do mês) crescente.

---

## 4. SISTEMA KANBAN ECLESIÁSTICO

### 4.1 Visão Geral

O sistema usa um **Kanban configurável** para gerenciar processos eclesiásticos. Cada processo (Batismo, Transferência, Consagração, Credencial) é um **Card** que percorre colunas de um **Stage**. Ao chegar em cada coluna, a **Matriz de Regras** dispara ações automáticas no membro.

```
KanPipeline → KanStage (ligado a KanService) → KanColumn (columnIndex 1,2,3...)
                                                      ↓
                                                  KanCard (instância do processo)
                                                      ↓
                                               KanMatrixRule (ações automáticas)
```

### 4.2 Fluxo genérico de abertura de processo

Todo processo segue a mesma sequência:
1. Buscar serviço: `KanService WHERE serviceGroup = '{GRUPO}' AND isActive = true`
2. Buscar stage: `KanStage WHERE serviceId = service.id AND isActive = true`
3. Buscar primeira coluna: `KanColumn WHERE stageId = stage.id AND columnIndex = 1`
4. Criar `KanCard` na coluna 1
5. Aplicar `KanMatrixRule` para `(serviceId, columnIndex=1)` → dispara ocorrência + muda status/título se configurado

### 4.3 Pipeline — SecretariatPipeline

**Tela principal:** `src/app-ui/ecclesiastical/SecretariatPipeline.tsx`

Exibe todos os cards em modo Kanban (colunas) ou Lista. Suporta:
- Filtro por service (BATISMO, TRANSFERENCIA, CONSAGRACAO, CREDENCIAL)
- Mover cards entre colunas (drag ou botões)
- Exportar para Excel
- Imprimir relatório
- Chat por card (mensagens internas)
- Anexos por card
- Visualizar detalhes do membro no card

**Tipos de `Card` exibidos:**
```typescript
type Card = {
  id: string;
  protocol: string;             // ex: "A3F7B-BATISMO-2026"
  candidateName: string | null;
  currentTitle?: string | null;
  intendedTitle?: string | null;
  status: string;
  statusLabel: string | null;
  columnIndex: number;
  openedAt: string | null;
  closedAt: string | null;
  church?: { id, name, code } | null;
  destinationChurch?: { id, name, code } | null;
  member?: { id, fullName, rol, ecclesiasticalTitle, membershipStatus } | null;
  service?: { sigla, description } | null;
  column?: { id, name, columnIndex, color } | null;
};
```

---

## 5. APIS DO MÓDULO

### 5.1 Autenticação

Mesma estrutura do módulo financeiro:
```typescript
Headers: { Authorization: "Bearer <mrm_token>" }
// user.profileType: 'master'|'admin'|'campo'|'regional'|'church'
// user.churchId, user.campoId, user.roleName
```

### 5.2 Listar/Buscar Membros

**`GET /api/members`**

```typescript
// Query params:
q            // busca por nome (tokens) ou ROL (se dígitos)
churchId     // filtrar por igreja
regionalId   // filtrar por regional
campoId      // filtrar por campo
churchIds    // múltiplas igrejas separadas por vírgula
limit        // modo legado: retorna array simples (máx 500)
page         // página (default 1)
pageSize     // por página (default 20, máx 5000)
memberType   // ALL|MEMBRO|PF|PJ
status       // ativo|inativo|visitante|aguardando (vírgula para múltiplos)
maritalStatus // casado|solteiro|viuvo|divorciado|__NONE__
titleId      // UUID(s) de título eclesiástico|__NONE__

// Resposta paginada:
{
  data: Member[],
  total: number,
  activeCount: number,
  inactiveCount: number,
  churchCount: number
}

// Resposta legada (com limit):
Member[]
```

**Busca por nome (lógica):**
```typescript
// 1 token:
fullName STARTS WITH token OR fullName CONTAINS ' {token}'

// múltiplos tokens (AND entre todos):
fullName STARTS WITH token1 AND fullName STARTS WITH token2 ...
```

**Segurança:** `isRestrictedToOwnChurch` → restringe ao `churchId` do usuário.

---

### 5.3 Buscar Membro por ID

**`GET /api/members/:id`**

```typescript
// Response: Member completo com:
// church.regional.campo, ecclesiasticalTitleRef, ministryMemberships(ativas)

// Validação:
// - ID deve ser UUID válido
// - assertChurchAccess: master/admin passam sempre; church/secretária/tesoureiro só da própria igreja
```

---

### 5.4 Atualizar Membro

**`PATCH /api/members/:id`**

```typescript
// Body: qualquer campo do modelo Member
// Campos com tratamento especial:
{
  ecclesiasticalTitleId: string | null,  // sincroniza ecclesiasticalTitle automaticamente
  memberType: "MEMBRO" | "PF" | "PJ",   // limpa campos eclesiásticos se PF/PJ
  churchId: string,                      // resolve regionalId automaticamente se mudar
  cnpj: string,                          // valida unicidade
  birthDate: string | null,
  membershipDate: string | null,
  baptismDate: string | null
}

// Resposta: Member atualizado (sem includes)
```

---

### 5.5 Excluir Membro

**`DELETE /api/members/:id`**
**`DELETE /api/members/:id?permanent=true`**

```typescript
// Soft delete (padrão): seta deleted_at, status 204
// Hard delete (permanent=true): transação remove ocorrências e card references, status 204
```

---

### 5.6 Registrar Ocorrência Rápida

**`POST /api/members/:id/occurrences`**

```typescript
// Modo 1 — ocorrência direta (sem matrix):
{
  action: string,           // OBRIGATÓRIO
  notes?: string,
  serviceGroup?: string,    // default: "OCORRENCIA"
  serviceName?: string,     // default: "Ocorrência"
  metadata?: object
}
// → insere em member_event_history

// Modo 2 — ocorrência via matriz (com serviceId):
{
  serviceId: number,        // ID do KanService
  columnIndex?: number,     // coluna que determina qual regra aplicar
  notes?: string,
  date?: string,            // data de referência
  targetChurchId?: string   // destino se doesTransfer=true
}
// → busca KanMatrixRule(serviceId, columnIndex)
// → aplica: change_status, change_title, does_transfer
// → insere em member_event_history
// → insere em member_title_history se change_title

// Resposta Modo 1: { id, memberId, ... }
// Resposta Modo 2: { appliedActions: string[] }
```

---

### 5.7 Histórico de Eventos do Membro

**`GET /api/members/:id/event-history`**

```typescript
// Response: Array<MemberEventHistory> com enriquecimento:
[{
  id, memberId, cardId, churchId,
  serviceGroup, serviceName, columnIndex,
  action, notes, metadata, createdAt,
  card: { id, protocol, church: { name }, openedAt },   // se tem card
  createdByUser: { id, fullName }                       // se tem usuário
}]
// Limite: 200 registros, ordenados por createdAt DESC
```

---

### 5.8 Histórico de Títulos do Membro

**`GET /api/members/:id/title-history`**

```typescript
// Response: Array<MemberTitleHistory> com:
[{
  id, memberId, churchId, cardId,
  previousTitle, newTitle, source,
  serviceGroup, serviceName, notes, createdAt,
  createdByUser: { id, fullName }
}]
// Limite: 100 registros, ordenados por createdAt DESC
```

---

### 5.9 Batismo — Abrir Processo

**`POST /api/baptism/requests`**

```typescript
// Request Body:
{
  memberId: string,        // OBRIGATÓRIO
  baptismDate?: string,    // "YYYY-MM-DD"
  notes?: string
}

// Sequência interna:
// 1. Busca KanService WHERE serviceGroup = 'BATISMO' AND isActive = true
// 2. Busca KanStage WHERE serviceId = service.id AND isActive = true
//    (fallback: via KanMatrixRule WHERE serviceId AND columnIndex = 1)
// 3. Busca KanColumn WHERE columnIndex = 1
// 4. Cria KanCard com:
//    - protocol: buildProtocol(service.sigla)
//    - stageId, serviceId, columnId, columnIndex = 1
//    - churchId: membro.churchId
//    - memberId, candidateName: membro.fullName
//    - status: 'pendente', statusLabel: firstColumn.name
//    - metadata: { flowType: 'batismo', baptismDate }
// 5. Aplica KanMatrixRule(serviceId, columnIndex=1) → insere ocorrência

// Response:
{
  ok: true,
  card: KanCard (com church, member, service)
}
```

---

### 5.10 Batismo — Mover Card de Coluna

**`PATCH /api/baptism/requests/:id`**

```typescript
// Request Body:
{
  columnIndex?: number,
  status?: string,
  statusLabel?: string,
  observations?: string
}
// Atualiza o card, SEM reaplicar a matrix rule automaticamente.
// Para aplicar a matrix ao mover coluna, usar o SecretariatPipeline que tem lógica própria.
```

---

### 5.11 Transferência — Dashboard

**`GET /api/transfer/dashboard`**

```typescript
// Response:
{
  canManage: boolean,  // master ou admin
  queue: KanCard[],    // todos os cards de TRANSFERENCIA no escopo do usuário
  statusOptions: [{ value, label, columnIndex }],
  stats: {
    pendingCount: number,   // cards na coluna 1
    approvedCount: number,  // cards na coluna 2
    totalCount: number
  }
}
// KanCard inclui: church, destinationChurch, member, service, column
```

---

### 5.12 Transferência — Abrir Processo

**`POST /api/transfer/requests`**

```typescript
// Request Body:
{
  memberId: string,          // OBRIGATÓRIO
  targetChurchId?: string,   // destino da transferência
  destinationChurchId?: string,  // alias de targetChurchId
  notes?: string
}

// Sequência interna:
// 1. Busca KanService WHERE serviceGroup = 'TRANSFERENCIA' AND isActive = true
// 2. Busca KanStage e primeira coluna
// 3. Cria KanCard com:
//    - destinationChurchId: targetChurchId || destinationChurchId
//    - metadata: { flowType: 'transferencia', targetChurchId }
// 4. Aplica KanMatrixRule(serviceId, columnIndex=1)

// Validação: destinationChurchId ≠ church_id do membro (não pode transferir pra mesma)

// Response:
{ ok: true, card: KanCard }
```

---

### 5.13 Consagração — Abrir Processo

**`POST /api/consecration/requests`**

```typescript
// Request Body:
{
  memberId: string,           // OBRIGATÓRIO
  titleId?: string,           // UUID do EcclesiasticalTitle desejado
  intendedTitle?: string,     // nome do título (alternativo a titleId)
  serviceId?: number,         // forçar service específico
  consecrationDate?: string,  // data: só master/admin podem definir
  notes?: string
}

// Sequência interna:
// 1. Resolve título → busca em ecclesiastical_titles WHERE isActive AND NOT IN ('CONGREGADO','MEMBRO')
// 2. Resolve serviço de consagração:
//    - serviceGroup = 'CONSAGRACAO' OU sigla/description match ao título
//    - Match por abbreviation (sigla normalizada) ou nome
// 3. Resolve stage de consagração:
//    - Por nome: kanStage WHERE name ILIKE '%Consagra%'
//    - Fallback: via KanMatrixRule → stageId
//    - Fallback: via KanService
// 4. Resolve data de consagração:
//    - Se master/admin: usa consecrationDate || próxima agenda do campo
//    - Demais: usa próxima agenda do campo (obrigatório)
// 5. Cria KanCard com intendedTitle = título.name
// 6. Aplica matrix rule

// Próxima agenda (SQL):
SELECT cs.* FROM consecration_schedules cs
JOIN churches c ON c.id = cs.church_id
LEFT JOIN regionais r ON r.id = c.regional_id
JOIN churches tc ON tc.id = :membrosChurchId
LEFT JOIN regionais tr ON tr.id = tc.regional_id
WHERE cs.is_active = TRUE AND cs.scheduled_date >= CURRENT_DATE
  AND (cs.church_id = tc.id OR r.campo_id = tr.campo_id)
ORDER BY CASE WHEN cs.church_id = tc.id THEN 0 WHEN c.parent_church_id IS NULL THEN 1 ELSE 2 END,
         cs.scheduled_date ASC
LIMIT 1

// Response:
{
  ok: true, card: KanCard,
  nextConsecration: schedule | null,
  intendedTitle: string,
  consecrationDate: string
}
```

---

### 5.14 Credenciais — Listar

**`GET /api/credential-requests`**

```typescript
// Query params:
?situacao=Pendente    // filtrar por situação
&church_id=uuid       // filtrar por igreja

// Segurança:
// canSeeAll = master|admin|campo → sem restrição
// outros → restritos à própria church_id

// Response: Array<tbcredencial> (máx 500), ordenado por created_at DESC
```

---

### 5.15 Credenciais — Criar Solicitação

**`POST /api/credential-requests`**

```typescript
// Request Body:
{
  memberId: string,          // OBRIGATÓRIO (ou idtbmembro legado)
  tipo: string,              // OBRIGATÓRIO — tipo de credencial
  nome?: string,             // nome (default: membro.fullName)
  numero?: string,
  igrejasolicitante?: string,
  datavalidade?: string,
  dataemissao?: string,
  situacao?: string,         // default: 'Pendente'
  obs?: string,
  idtbmembro?: number        // ID legado (fallback para memberId)
}

// Sequência interna:
// 1. Busca KanService WHERE (sigla = 'SOLCRED' OR serviceGroup = 'CREDENCIAL')
// 2. Insere em tbcredencial via supabaseAdmin
// 3. Cria KanCard vinculado
// 4. Atualiza tbcredencial.kan_card_id e card_protocol
// 5. Cria Notification para o usuário (não-fatal)

// Response:
{ ok: true, request: tbcredencial, card: KanCard }
```

---

### 5.16 Credenciais — Atualizar

**`PATCH /api/credential-requests/:id`**

```typescript
// Body: qualquer combinação de:
{ situacao, obs, datavalidade, dataemissao, nome, numero }

// Atualiza na tbcredencial (supabaseAdmin)
```

---

### 5.17 Credenciais — Excluir

**`DELETE /api/credential-requests/:id`**

```typescript
// Segurança: canSeeAll (master|admin|campo) OU church_id do usuário == church_id da credencial

// Sequência:
// 1. Deleta da tbcredencial
// 2. Se tinha kan_card_id: soft-delete do KanCard (deletedAt = now())
```

---

## 6. REGRAS DE PERMISSÃO (SECRETARIA)

### 6.1 `assertChurchAccess`

```typescript
async function assertChurchAccess(user, churchId, prisma): Promise<boolean> {
  if (user.profileType === "master" || user.profileType === "admin") return true;
  if (!isRestrictedToOwnChurch(user)) return true;  // campo/regional livres
  if (user.churchId === churchId) return true;        // mesma igreja
  return false;
}
```

### 6.2 `kanScopeFilter` — Filtro de Escopo para Kanban

```typescript
function kanScopeFilter(user) {
  const isSecret   = roleName.includes('secret');
  const isTesour   = roleName.includes('tesour');
  const isAtSede   = user.churchId && !user.parentChurchId;
  const seesAllInCampo = profileType === 'admin' || profileType === 'campo'
    || (profileType === 'church' && isAtSede && !isSecret && !isTesour);

  if (profileType === 'master')         return {};  // sem filtro
  if (seesAllInCampo && user.campoId)   return { church: { regional: { campoId: user.campoId } } };
  if (profileType === 'church' || isRestrictedToOwnChurch(user)) {
    if (user.churchId) return { churchId: user.churchId };
  }
  if (user.campoId)                     return { church: { regional: { campoId: user.campoId } } };
  return {};
}
```

**Regra especial:** Igreja **sede** (sem `parentChurchId`) vê todos os cards do campo, exceto se for secretária/tesoureira.

### 6.3 Credenciais — Permissão

```typescript
function canSeeAll(user) {
  return user.profileType === 'master'
      || user.profileType === 'admin'
      || user.profileType === 'campo';
}
// Outros perfis: filtrado pelo church_id do usuário
```

---

## 7. FLUXO DA MATRIZ DE DECISÃO — PASSO A PASSO

Quando um card é movido para uma nova coluna (via pipeline ou via endpoint de update):

```typescript
// 1. Buscar a regra:
SELECT * FROM kan_matrix_rules
WHERE service_id = card.serviceId AND column_index = novaColuna
LIMIT 1

// 2. Se change_status && new_status:
UPDATE members SET membership_status = UPPER(rule.new_status) WHERE id = card.member_id

// 3. Se change_title && new_title:
SELECT id FROM ecclesiastical_titles
WHERE name ILIKE rule.new_title AND deleted_at IS NULL AND is_active = true

UPDATE members SET
  ecclesiastical_title = rule.new_title,
  ecclesiastical_title_id = titleRecord.id  // se encontrado
WHERE id = card.member_id

// 4. Se does_transfer && card.destination_church_id:
SELECT regional_id FROM churches WHERE id = card.destination_church_id

UPDATE members SET
  church_id = card.destination_church_id,
  regional_id = destChurch.regional_id
WHERE id = card.member_id

// 5. Se insert_occurrence != false:
INSERT INTO member_event_history (
  member_id, church_id, service_group, service_name,
  column_index, action, notes, metadata, card_id, created_by
) VALUES (
  card.member_id, card.church_id,
  service.sigla, service.description,
  novaColuna,
  rule.occurrence_name || service.description || 'MOVIMENTO',
  extraMessage || rule.message,
  { source: 'MATRIX', cardId: card.id },
  card.id, user.id
)
```

---

## 8. BUSCA DE MEMBROS — REGRAS DETALHADAS

### 8.1 Por Nome

```typescript
// 1 token:
WHERE full_name ILIKE '{token}%' OR full_name ILIKE '% {token}%'

// Múltiplos tokens (AND entre todos):
WHERE (full_name ILIKE 'João%' OR full_name ILIKE '% João%')
  AND (full_name ILIKE 'Silva%' OR full_name ILIKE '% Silva%')
```

### 8.2 Por ROL (número)

```typescript
// Se a string de busca é somente dígitos:
WHERE rol = parseInt(q)
```

### 8.3 Por CPF

```typescript
// GET /api/members/check?cpf=12345678901
WHERE cpf CONTAINS '12345678901' AND deleted_at IS NULL
// (sem formatação — só dígitos)
```

### 8.4 Por Nome Exato (verificação de duplicata)

```typescript
// GET /api/members/check?name=João Silva
WHERE full_name = 'João Silva' (case-insensitive) AND deleted_at IS NULL
```

---

## 9. TIPOS E ENUMS DO MÓDULO

```typescript
// Tipo de membro:
type MemberType = 'MEMBRO' | 'PF' | 'PJ'

// Status de membresia (valores comuns):
// 'AGUARDANDO ATIVACAO' | 'ATIVO' | 'INATIVO' | 'DESLIGADO' | 'VISITANTE'
// Filtros usam ILIKE, não enum rígido

// Estado civil:
type MaritalStatus = 'SOLTEIRO' | 'CASADO' | 'VIUVO' | 'DIVORCIADO'

// Gênero:
type Gender = 'MASCULINO' | 'FEMININO' | string  // campo livre

// Status de batismo:
type BaptismStatus = string  // campo livre (ex: 'BATIZADO', 'AGUARDANDO')

// Status do card:
type CardStatus = 'pendente' | 'aprovado' | 'cancelado' | 'concluido' | string

// Situação da credencial (tbcredencial):
type CredentialSituacao = 'Pendente' | 'Aprovada' | 'Emitida' | 'Cancelada'

// Grupos de serviço (service_group):
type ServiceGroup = 'BATISMO' | 'TRANSFERENCIA' | 'CONSAGRACAO' | 'CREDENCIAL' | string

// Fonte da ocorrência de título:
type TitleHistorySource = 'MATRIZ' | 'MANUAL' | 'OCORRENCIA_RAPIDA'

// Tipo de relacionamento familiar:
type FamilyRelationshipType = string  // 'FILHO' | 'PAI' | 'MAE' | 'IRMAO' | etc
```

---

## 10. TABELAS AUXILIARES CONSULTADAS

```sql
-- Títulos eclesiásticos (para filtros e selects):
SELECT id, name, abbreviation, level, display_order, allow_men, allow_women,
       is_active, minimum_age, maximum_age, consecration_type_key
FROM ecclesiastical_titles
WHERE is_active = true AND deleted_at IS NULL
ORDER BY display_order ASC, level ASC, name ASC

-- Para consagração (exclui base):
WHERE name NOT IN ('CONGREGADO', 'MEMBRO')

-- Regionais:
SELECT id, name, code FROM regionais ORDER BY name

-- Igrejas da regional:
SELECT id, name, code FROM churches WHERE regional_id = :id AND deleted_at IS NULL ORDER BY name

-- Serviços kanban ativos:
SELECT id, sigla, description, service_group FROM kan_services WHERE is_active = true ORDER BY id

-- Colunas de um stage:
SELECT id, name, column_index, color FROM kan_columns WHERE stage_id = :stageId ORDER BY column_index
```

---

## 11. OBSERVAÇÕES CRÍTICAS PARA O FLUTTER

1. **Soft delete em membros:** A query deve sempre incluir `deleted_at IS NULL`. Ao deletar, usar soft delete por padrão.

2. **Sincronismo título:** Ao salvar um membro com `ecclesiasticalTitleId`, sempre sincronizar também o campo `ecclesiasticalTitle` (texto) para manter compatibilidade com legado.

3. **Fix de divergência de título:** No GET de membros, o código verifica se `ecclesiasticalTitleRef.name !== ecclesiasticalTitle` (case-insensitive) — se diferente, anula o ref e usa apenas o campo texto. Implementar a mesma lógica no Flutter.

4. **Busca por tokens:** Busca por nome deve implementar split em espaços e AND entre todos os tokens.

5. **Protocolo único:** O protocolo do KanCard é gerado no servidor (`buildProtocol`). Não deve ser gerado no Flutter.

6. **Matrix Rule é server-side:** Nunca implementar lógica da matriz no Flutter. Ao mover um card, chamar o endpoint de update — o servidor aplica as regras.

7. **Credenciais via supabaseAdmin:** A tabela `tbcredencial` é acessada pelo backend via chave de serviço do Supabase. O Flutter não acessa essa tabela diretamente — sempre via API.

8. **assertChurchAccess é implícito:** Todos os endpoints de membro verificam se o usuário tem acesso à `church_id` do membro. O Flutter deve tratar o 403 adequadamente.

9. **Consagração requer agenda:** Perfis não-admin precisam de uma `consecration_schedule` ativa para o campo antes de abrir consagração. Se não existir, a API retorna 400.

10. **Verificação de duplicata ANTES de cadastrar:** Chamar `GET /api/members/check?cpf=` E `?name=` antes do POST de novo membro.

11. **Títulos e gênero:** `EcclesiasticalTitle` tem `allow_men` e `allow_women`. O Flutter deve filtrar os títulos disponíveis com base no gênero do membro.

12. **Status de membresia não é enum:** O campo `membership_status` é VARCHAR livre. Filtros usam ILIKE. Os valores padrão conhecidos são: `ATIVO`, `AGUARDANDO ATIVACAO`, `INATIVO`, `DESLIGADO`, `VISITANTE`.

13. **ROL é autoincrement:** Ao criar membro, o ROL é atribuído automaticamente pelo banco. Não enviar `rol` no POST.

14. **Atualização de `regionalId` automática:** Ao mudar `churchId` de um membro, o backend resolve automaticamente o `regionalId` correto. O Flutter pode enviar só o `churchId`.

15. **Histórico: 200 eventos / 100 títulos:** Ao paginar histórico no app, considerar esses limites dos endpoints atuais.

---

## 12. FLUXOS COMPLETOS POR PROCESSO

### 12.1 Fluxo de Batismo

```
1. App busca membro: GET /api/members?q=João
2. App verifica se membro pode ser batizado
   (baptismStatus != 'BATIZADO')
3. App abre processo: POST /api/baptism/requests
   { memberId, baptismDate?, notes? }
4. Sistema cria KanCard na coluna 1 (Pendente)
5. Matrix rule coluna 1 é aplicada:
   - Pode inserir ocorrência "Candidato ao Batismo"
   - Pode mudar status do membro para "AGUARDANDO BATISMO"
6. Secretaria acompanha no Pipeline
7. Ao aprovar (mover para coluna aprovação):
   - Matrix rule pode mudar status → "BATIZADO"
   - Insere ocorrência de batismo
8. (Opcional) Registrar batismo formal: POST /api/baptism/schedules
```

### 12.2 Fluxo de Transferência

```
1. App busca membro: GET /api/members/:id
2. App seleciona igreja destino: GET /api/churches/search?q=...
3. App abre transferência: POST /api/transfer/requests
   { memberId, targetChurchId, notes? }
4. Sistema cria KanCard na coluna 1
5. Matrix rule coluna 1: insere ocorrência "Pedido de Transferência"
6. Secretaria aprova no pipeline (move para coluna 2)
7. Matrix rule coluna 2 (se doesTransfer=true):
   - members.church_id = destinationChurchId
   - members.regional_id = destChurch.regionalId
8. Card fica como registro da transferência
```

### 12.3 Fluxo de Consagração

```
1. App busca membro e seus títulos disponíveis
2. GET /api/ecclesiastical-titles (filtrado: not CONGREGADO/MEMBRO, ativos)
3. Verifica próxima agenda: GET /api/consecration/schedules (campo)
4. App abre consagração: POST /api/consecration/requests
   { memberId, titleId, notes? }
5. Sistema resolve service, stage e data
6. Cria KanCard com currentTitle e intendedTitle
7. Ao concluir (coluna final):
   - Matrix rule muda ecclesiasticalTitle → novo título
   - Insere em member_title_history
   - Insere ocorrência de consagração
```

### 12.4 Fluxo de Credencial

```
1. App busca membro: GET /api/members/:id
2. App solicita credencial: POST /api/credential-requests
   { memberId, tipo, datavalidade?, notes? }
3. Insere em tbcredencial (status: 'Pendente')
4. Cria KanCard vinculado
5. Secretaria do campo processa
6. Emissão: PATCH /api/credential-requests/:id
   { situacao: 'Emitida', dataemissao, numero }
```

---

## 13. ESTRUTURA DE DADOS RETORNADOS — REFERÊNCIA RÁPIDA

### 13.1 Member (listagem)

```typescript
{
  id: string, rol: number, fullName: string, preferredName: string | null,
  photoUrl: string | null, email: string | null, phone: string | null, mobile: string | null,
  cpf: string | null, birthDate: string | null, gender: string | null,
  maritalStatus: string | null, membershipStatus: string | null,
  ecclesiasticalTitle: string | null, baptismStatus: string | null,
  memberType: string, churchId: string, createdAt: string,
  church: { id, name, code, regional: { id, name, code, campoId, campo: { id, name } } },
  regional: { id, name, code } | null,
  ecclesiasticalTitleRef: { id, name, abbreviation, level } | null
}
```

### 13.2 KanCard (pipeline)

```typescript
{
  id: string, protocol: string, candidateName: string | null,
  currentTitle: string | null, intendedTitle: string | null,
  status: string, statusLabel: string | null, columnIndex: number,
  churchId: string, memberId: string | null,
  destinationChurchId: string | null,
  observations: string | null, metadata: object | null,
  openedAt: string, closedAt: string | null,
  church: { id, name, code }, destinationChurch: { id, name, code } | null,
  member: { id, fullName, rol, ecclesiasticalTitle, membershipStatus } | null,
  service: { id, sigla, description, serviceGroup } | null,
  column: { id, name, columnIndex, color } | null
}
```

### 13.3 MemberEventHistory

```typescript
{
  id: string, memberId: string | null, cardId: string | null,
  churchId: string, serviceGroup: string | null, serviceName: string | null,
  columnIndex: number | null, action: string | null, notes: string | null,
  metadata: object | null, createdAt: string,
  card: { id, protocol, church: { name }, openedAt } | null,
  createdByUser: { id, fullName } | null
}
```

---

## 14. CONFIGURAÇÃO DE AMBIENTE

```
Supabase URL:    ysibqnwgitakofehdxvd.supabase.co
tbcredencial:    acessada via supabaseAdmin (service role key) — não via Prisma
Token:           JWT do Supabase Auth, Bearer em todas as chamadas da API
```

---

## 15. IMPLEMENTAÇÃO NO APP FLUTTER — STATUS

**Arquivo:** `novoChurch/lib/main.dart`

### Telas implementadas

| Classe Flutter | Rota | Fonte de dados | Status |
|---|---|---|---|
| `MembrosScreen` | `/admin/membros` | Supabase direto (`members`) | ✅ Lista com busca/filtro |
| `BatismoScreen` | `/admin/batismo` | Supabase direto (`kan_cards`) + FAB API | ✅ Lista + Novo Batismo |
| `ConsagracaoScreen` | `/admin/consagracao` | Supabase direto (`kan_cards`) + FAB API | ✅ Lista + Nova Consagração |
| `TransferenciaScreen` | `/admin/transferencia` | Supabase direto (`kan_cards`) + FAB API | ✅ Lista + Nova Transferência |
| `CredenciaisScreen` | `/admin/credenciais` | Supabase direto (`tbcredencial`) + FAB API | ✅ Lista + Nova Credencial |
| `RequerimentosScreen` | `/admin/requerimentos` | Supabase direto (`kan_cards`) | ✅ Lista somente leitura |
| `AniversariantesScreen` | `/admin/aniversariantes` | Supabase direto (`members`) | ✅ Por mês com destaque hoje |
| `PipelineScreen` | `/admin/pipeline` | Supabase direto (`kan_cards`) | ✅ Lista + visão Kanban |

### Helpers e widgets compartilhados

| Símbolo | Descrição |
|---|---|
| `_secChurchId(sc)` | Resolve church_id correto: `membro.idigreja` (chiesa) ou `null` (campo/admin/master = sem filtro) |
| `_secApiBase(sc)` | Base URL da API MRM (alias de `_financeApiBase`) |
| `_secPost(sc, path, body)` | POST autenticado para a API MRM com token Supabase |
| `_MemberSearchField` | Widget de busca de membro por nome ou ROL com autocomplete |
| `_SecSheet` | Layout base dos formulários (bottom sheet) |
| `_NovoBatismoSheet` | Formulário: membro + data + obs → `POST /api/baptism/requests` |
| `_NovaTransferenciaSheet` | Formulário: membro + busca de igreja destino + obs → `POST /api/transfer/requests` |
| `_NovaConsagracaoSheet` | Formulário: membro + dropdown de títulos eclesiásticos → `POST /api/consecration/requests` |
| `_NovaCredencialSheet` | Formulário: membro + chips de tipo + validade → `POST /api/credential-requests` |
| `_KanCardDetailSheet` | Detalhe do card com botões para mover entre colunas (`PATCH /api/baptism/requests/:id`) |
| `_kanCardTile` | Widget de card kanban (aceita `onTap` para abrir detalhe) |

### Scoping de queries — regra implementada

```dart
// novoChurch/lib/main.dart
String? _secChurchId(SessionController sc) {
  final id = sc.membro?.idigreja;
  return (id != null && id.isNotEmpty) ? id : null;
}
// null → sem filtro church_id (campo/admin/master veem tudo via RLS)
// UUID → filtra pelo church_id da igreja do membro logado
```

### Chamadas de API (lançamentos) — CORS em localhost

As chamadas `_secPost(...)` para o MRM (`https://www.adcampinas.com.br/api/...`) são **bloqueadas por CORS em localhost:8080** (ambiente de desenvolvimento). Funcionam normalmente em:
- App mobile nativo (Android/iOS) — sem restrição CORS
- Produção web no mesmo domínio

**Para testar em dev:** Configurar o MRM Next.js com `Access-Control-Allow-Origin: http://localhost:8080` ou usar proxy.

### Navegação para a Secretaria

O módulo é acessado via `SecretariaScreen` (hub central) que contém:
- Busca global de membros por nome/ROL
- Drawer lateral com todos os submódulos
- `_adminNavigate(context, path, sc)` — roteador centralizado

**Acesso:** Requer perfil CRM ativo (`hasCrmProfile = true`) ou role master/admin.
