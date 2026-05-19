# Referência de Tabelas — App Móvel SaasChurch

> Atualizado em: 2026-05-18  
> Destino: desenvolvedor do app Flutter — use este arquivo como fonte única de verdade sobre quais tabelas, colunas e filtros usar.

---

## 1. Mapa completo: Funcionalidade → Tabela

| Funcionalidade | Tabela Supabase | Filtro obrigatório | Tela MRM de gestão |
| --- | --- | --- | --- |
| Eventos com ingressos | `app_events` | `church_id` | `/app-ui/app/events` |
| Criar evento | `app_events` INSERT | `church_id` obrigatório | `/app-ui/app/events/new` |
| Departamentos de evento | `event_departments` | `church_id` | `/app-ui/app/departments` |
| Pedidos de ingresso (Kanban) | `event_orders` | join em `app_events.church_id` | `/app-ui/events` (PedidosKanban) |
| Check-in QR Code | `event_qrcodes` | `ticket_code` (por código) | `/app-ui/app/checkin` |
| Reembolsos | `event_refunds` | join em `app_events.church_id` | painel de detalhes do pedido |
| Pão Diário | `app_daily_bread_entries` | `campo_id` | `/app-ui/app/daily-bread` |
| Ministérios | `ministries` | `church_id` | `/app-ui/app/ministries` |
| Membros do ministério | `ministry_members` | `ministry_id` | (via AppMinistries) |
| Pré-cadastros do app | `app_cadastros` | `headquarters_id` | `/app-ui/app/registrations` |

---

## 2. Pão Diário — `app_daily_bread_entries`

> Colunas são em **inglês**. Não existem colunas em português nesta tabela.

```sql
id                     UUID PRIMARY KEY
campo_id               UUID NOT NULL         -- filtro principal
headquarters_id        UUID                  -- opcional
church_id              UUID                  -- opcional (audiência por igreja)
audience_scope         TEXT DEFAULT 'headquarters'  -- 'headquarters' | 'church' | 'global'
title                  TEXT NOT NULL
summary                TEXT
body_text              TEXT
bible_reference        TEXT                  -- ex: "João 3:16"
audio_url              TEXT
audio_duration_seconds INT DEFAULT 0
accent_hex             TEXT DEFAULT '#7c3aed'
icon_name              TEXT DEFAULT 'BookOpen'
is_featured            BOOLEAN DEFAULT false
active                 BOOLEAN DEFAULT true
published_at           TIMESTAMPTZ
created_at             TIMESTAMPTZ
updated_at             TIMESTAMPTZ
```

**Tabela de likes** (somente leitura no app):

```sql
app_daily_bread_likes (
  id         UUID PRIMARY KEY,
  entry_id   UUID FK → app_daily_bread_entries,
  user_id    UUID FK → auth.users,
  created_at TIMESTAMPTZ,
  UNIQUE (entry_id, user_id)
)
```

**Query Flutter — listar devocionais:**

```dart
final res = await supabase
  .from('app_daily_bread_entries')
  .select('id, title, summary, body_text, bible_reference, accent_hex, icon_name, is_featured, active, published_at, audience_scope')
  .eq('campo_id', campoId)
  .eq('active', true)
  .order('published_at', ascending: false);
```

**Endpoint REST alternativo** (`GET /api/daily-bread?campoId={id}&active=true`):

```json
[{
  "id": "uuid",
  "campo_id": "uuid",
  "title": "Título",
  "summary": "Resumo...",
  "body_text": "Texto completo...",
  "bible_reference": "João 3:16",
  "accent_hex": "#f59e0b",
  "icon_name": "BookOpen",
  "is_featured": false,
  "active": true,
  "published_at": "2026-05-18T00:00:00Z",
  "likes_count": 42
}]
```

> `likes_count` é calculado via subquery — não é coluna direta da tabela.

---

## 3. Ministérios — `ministries` + `ministry_members`

```sql
-- ministries
id                  UUID PRIMARY KEY
church_id           UUID NOT NULL         -- isolamento obrigatório
parent_ministry_id  UUID                  -- FK → ministries (hierarquia, opcional)
name                VARCHAR(255) NOT NULL
description         TEXT
leader_id           UUID                  -- FK → members
email               VARCHAR(255)
phone               VARCHAR(20)
color               VARCHAR(7) DEFAULT '#8b5cf6'
icon                VARCHAR(50)
  -- valores aceitos: 'heart' | 'music' | 'mic' | 'hand-heart' | 'book-open'
  --                  'camera' | 'radio' | 'baby' | 'users' | 'sparkles'
  --                  'shield' | 'graduation-cap'
is_active           BOOLEAN DEFAULT true  -- controla visibilidade no app
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
deleted_at          TIMESTAMPTZ           -- soft delete
```

```sql
-- ministry_members
id          UUID PRIMARY KEY
ministry_id UUID FK → ministries
member_id   UUID FK → members
role        VARCHAR(100)   -- cargo/papel no ministério
joined_at   DATE
left_at     DATE
is_active   BOOLEAN DEFAULT true
created_at  TIMESTAMPTZ
UNIQUE (ministry_id, member_id, is_active)
```

**Query Flutter — listar ministérios com líder:**

```dart
final res = await supabase
  .from('ministries')
  .select('id, name, description, color, icon, is_active, email, phone, leader:members!leader_id(id, full_name)')
  .eq('church_id', churchId)
  .eq('is_active', true)
  .isFilter('deleted_at', null)
  .order('name');
```

**Query Flutter — membros de um ministério:**

```dart
final members = await supabase
  .from('ministry_members')
  .select('id, role, joined_at, member:members(id, full_name, photo_url)')
  .eq('ministry_id', ministryId)
  .eq('is_active', true);
```

---

## 4. Eventos — `app_events` e tabelas relacionadas

```sql
-- app_events
id           UUID PRIMARY KEY
church_id    UUID NOT NULL    -- isolamento obrigatório
nome         TEXT
descricao    TEXT
data_inicio  TIMESTAMPTZ
data_fim     TIMESTAMPTZ
local        TEXT
status       TEXT             -- 'RASCUNHO' | 'PUBLICADO' | 'ENCERRADO' | 'CANCELADO'
banner_url   TEXT
preco        NUMERIC
capacidade   INT
deleted_at   TIMESTAMPTZ      -- soft delete
created_at   TIMESTAMPTZ
```

```sql
-- event_departments
id          UUID PRIMARY KEY
event_id    UUID FK → app_events
church_id   UUID NOT NULL
nome        TEXT
descricao   TEXT
created_at  TIMESTAMPTZ
```

```sql
-- event_orders  (sem church_id direto — filtrar via join em app_events)
id              UUID PRIMARY KEY
event_id        UUID FK → app_events
user_id         UUID NOT NULL
numero_pedido   TEXT UNIQUE      -- formato: PED-YYYYMMDDHHMMSS-XXXX
buyer_name      TEXT
buyer_email     TEXT
buyer_phone     TEXT
subtotal        DECIMAL(10,2) DEFAULT 0
desconto        DECIMAL(10,2) DEFAULT 0
total           DECIMAL(10,2) DEFAULT 0
payment_method  TEXT             -- 'free' | 'pix' | 'credit_card' | 'debit_card'
payment_ref     TEXT             -- ID da transação no gateway
payment_attempts INT DEFAULT 0  -- tentativas de cobrança (coluna MRM)
notas           TEXT
status          TEXT             -- 'AGUARDANDO_PAGAMENTO' | 'PAGO' | 'CANCELADO'
                                 -- | 'REEMBOLSADO' | 'EXPIRADO'
created_at      TIMESTAMPTZ DEFAULT now()
updated_at      TIMESTAMPTZ DEFAULT now()
cancelled_at    TIMESTAMPTZ
```

```sql
-- event_qrcodes
id            UUID PRIMARY KEY
order_id      UUID FK → event_orders ON DELETE CASCADE
order_item_id UUID FK → event_order_items  -- item correspondente
event_id      UUID FK → app_events
user_id       UUID
seat_id       UUID FK → event_seats        -- assento vinculado (COM_ASSENTO)
ticket_code   TEXT UNIQUE                  -- código único para leitura no check-in
qr_data       TEXT                         -- conteúdo encodado no QR (JSON)
is_used       BOOLEAN DEFAULT false
used_at       TIMESTAMPTZ
checked_in_by UUID                         -- operador que fez check-in
is_cancelled  BOOLEAN DEFAULT false
cancelled_at  TIMESTAMPTZ
created_at    TIMESTAMPTZ DEFAULT now()
```

```sql
-- event_refunds  (sem church_id direto — filtrar via join em app_events)
id               UUID PRIMARY KEY
order_id         UUID FK → event_orders
event_id         UUID FK → app_events
user_id          UUID NOT NULL
motivo           TEXT
valor_solicitado DECIMAL(10,2) DEFAULT 0
status           TEXT DEFAULT 'SOLICITADO'
                 -- 'SOLICITADO' | 'APROVADO' | 'NEGADO' | 'PROCESSADO'
notas_admin      TEXT             -- notas do admin ao aprovar/negar
processed_by     UUID             -- admin que processou
created_at       TIMESTAMPTZ DEFAULT now()
updated_at       TIMESTAMPTZ DEFAULT now()
processed_at     TIMESTAMPTZ
```

---

## 5. Pré-cadastros do app — `app_cadastros`

> **ATENÇÃO:** Esta tabela é uma **fila de pré-cadastros**, NÃO uma tabela de membros.  
> O registro pelo app **não cria um membro** no sistema MRM automaticamente.  
> O operador precisa revisar a fila em `/app-ui/app/registrations` e aprovar manualmente.  
> A funcionalidade de "converter em membro" (campo `member_id`) **ainda não está implementada** — é trabalho futuro.

```sql
id               UUID PRIMARY KEY
user_id          UUID              -- FK → auth.users (opcional — usuário autenticado no app)
headquarters_id  UUID              -- FK → headquarters (sede do campo — filtro principal)
nome             VARCHAR(255) NOT NULL
email            VARCHAR(255)
telefone         VARCHAR(20)
cpf              VARCHAR(14)
data_nascimento  DATE
status           VARCHAR(30) DEFAULT 'PENDENTE'
member_id        UUID              -- FK → members — preenchido ao vincular (FUTURO)
observacoes      TEXT              -- notas internas do admin
created_at       TIMESTAMPTZ
updated_at       TIMESTAMPTZ
```

**Valores de `status`:**

| Valor | Significado |
| --- | --- |
| `PENDENTE` | Aguardando revisão do admin |
| `APROVADO` | Admin aprovou — ainda não vinculado a membro |
| `REJEITADO` | Admin rejeitou o cadastro |
| `VINCULADO` | Vinculado a um membro do MRM (FUTURO) |

**Fluxo:**

```text
Usuário se cadastra no app
        │
        ▼
app_cadastros  ← status = 'PENDENTE'
        │
        ▼  Admin revisa no MRM
        │
        ├── Rejeita ──► status = 'REJEITADO'
        │
        └── Aprova ───► status = 'APROVADO'
                              │
                              ▼  (FUTURO — não implementado)
                        Admin vincula ao membro
                              │
                              ▼
                        status = 'VINCULADO'
                        member_id = <uuid>
```

**Query Flutter — criar pré-cadastro:**

```dart
await supabase.from('app_cadastros').insert({
  'user_id': supabase.auth.currentUser?.id,  // opcional
  'headquarters_id': headquartersId,          // obrigatório
  'nome': nome,
  'email': email,
  'telefone': telefone,
  'cpf': cpf,
  'data_nascimento': dataNascimento?.toIso8601String().substring(0, 10),
  'status': 'PENDENTE',
});
```

**Como obter `headquarters_id`:**

```http
GET /api/headquarters?fieldId={campoId}
Authorization: Bearer {token}
```

Retorna lista — usar o `id` do **primeiro item** como `headquarters_id`.

---

## 6. Tabelas do app que o MRM não gerencia diretamente

| Tabela | Filtro | O que é |
| --- | --- | --- |
| `headquarters` | `field_id` | Dados da sede do campo |
| `church_schedule` | `headquarters_id` | Agenda/programação da sede |
| `church_access_info` | `headquarters_id` | Como chegar à sede |
| `churches` | `id` | Dados da igreja |
| `church_contacts` | `church_id` | Contatos da igreja |
| `tbeventos` | `campo_id` | Programação anual do campo |
| `members` | `church_id` | Membros (gerenciados no módulo de Membros do MRM) |

---

## 7. Isolamento multi-tenant — regra de ouro

Toda query **deve** incluir o filtro correto para evitar vazamento de dados entre igrejas:

| Nível | Coluna de filtro | Como obter no app |
| --- | --- | --- |
| Igreja | `church_id` | `mrm_user.churchId` (localStorage MRM) / `user_metadata.church_id` (Supabase Auth) |
| Campo | `campo_id` | `mrm_user.campoId` |
| Sede | `headquarters_id` | `GET /api/headquarters?fieldId={campoId}` → primeiro item |

**Perfis de acesso (`profileType`):**

| Valor | Acesso |
| --- | --- |
| `master` | Todos os campos e igrejas |
| `admin` | Administrativo — campo completo |
| `campo` | Restrito ao campo |
| `church` | Restrito à sua igreja (`churchId` obrigatório) |

---

## 8. Arquivos modificados no MRM (referência para o dev)

| Arquivo | O que foi feito |
| --- | --- |
| `src/app-ui/app/AppDailyBread.tsx` | Corrigido: colunas em português trocadas pelos nomes reais em inglês |
| `src/app-ui/app/AppEvents.tsx` | Adicionado filtro `church_id` |
| `src/app-ui/app/AppEventNew.tsx` | Adicionado `church_id` no INSERT (estava faltando — campo obrigatório) |
| `src/app-ui/app/AppEventDepartments.tsx` | Filtro + `church_id` no INSERT |
| `src/app-ui/app/AppEventOrders.tsx` | Filtro via join `app_events!inner` |
| `src/app-ui/app/AppEventRefunds.tsx` | Filtro via join `app_events!inner` |
| `src/app-ui/app/AppRegistrations.tsx` | `headquarters_id` via API; corrigido `notas_admin` → `observacoes` |
| `src/app-ui/app/AppDashboard.tsx` | Stats reais do banco + card de Ministérios |
| `src/app-ui/app/AppMinistries.tsx` | Criado — gestão de ministérios isolado por `church_id` |
| `src/spa/routes.tsx` | Rotas `/app-ui/app/daily-bread` e `/app-ui/app/ministries` adicionadas |
| `src/components/app-ui/AppUI.tsx` | Sidebar App Móvel: Pão Diário e Ministérios adicionados |
