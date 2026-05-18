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
| Pedidos de ingresso | `event_orders` | join em `app_events.church_id` | `/app-ui/app/orders` |
| Check-in QR Code | `event_qrcodes` | `ticket_code` (por código) | `/app-ui/app/checkin` |
| Reembolsos | `event_refunds` | join em `app_events.church_id` | `/app-ui/app/refunds` |
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
icon_name              TEXT DEFAULT 'BookOpen'  -- ver tabela de valores aceitos abaixo
image_url              TEXT                     -- foto/imagem do devocional (bucket "dados/daily-bread/")
audio_url              TEXT                     -- URL do áudio (bucket "dados/daily-bread/audio/")
audio_duration_seconds INT DEFAULT 0            -- duração em segundos (exibida como MM:SS no app)
play_count             INT DEFAULT 0            -- incrementado pelo app quando usuário toca "Ouvir"
read_count             INT DEFAULT 0            -- incrementado pelo app quando usuário toca "Ler"
share_count            INT DEFAULT 0            -- incrementado pelo app quando usuário compartilha
is_featured            BOOLEAN DEFAULT false
active                 BOOLEAN DEFAULT true
published_at           TIMESTAMPTZ
created_at             TIMESTAMPTZ
updated_at             TIMESTAMPTZ
```

**Valores aceitos para `icon_name`** (ícone exibido no card do app e na lista do MRM):

| Valor | Significado |
| --- | --- |
| `BookOpen` | Bíblia / Estudo (padrão) |
| `Sun` | Manhã / Devoção matinal |
| `Moon` | Noite / Vigília |
| `Heart` | Amor / Graça |
| `Star` | Destaque / Especial |
| `Flame` | Avivamento / Fogo |
| `Music2` | Louvor / Adoração |
| `Sparkles` | Milagres / Graça divina |
| `Lightbulb` | Sabedoria / Revelação |
| `Leaf` | Crescimento / Renovação |
| `HandHeart` | Misericórdia / Compaixão |
| `Feather` | Graça / Leveza |
| `Coffee` | Reflexão / Devoção casual |

> No app Flutter, use o valor de `icon_name` para escolher qual ícone renderizar no card de cada devocional. Valores não reconhecidos devem usar `BookOpen` como fallback.

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
  .select('''
    id, title, summary, body_text, bible_reference,
    accent_hex, icon_name, image_url,
    audio_url, audio_duration_seconds,
    play_count, read_count, share_count,
    is_featured, active, published_at, audience_scope,
    app_daily_bread_likes(count)
  ''')
  .eq('campo_id', campoId)
  .eq('active', true)
  .order('published_at', ascending: false);
```

**Incrementar contadores no app (Flutter):**

```dart
// Quando usuário toca "Ouvir":
await supabase.rpc('increment_bread_counter', params: {'entry_id': id, 'col': 'play_count'});
// Quando usuário toca "Ler":
await supabase.rpc('increment_bread_counter', params: {'entry_id': id, 'col': 'read_count'});
// Quando usuário compartilha:
await supabase.rpc('increment_bread_counter', params: {'entry_id': id, 'col': 'share_count'});
```

> Crie a função RPC no Supabase:

```sql
CREATE OR REPLACE FUNCTION increment_bread_counter(entry_id UUID, col TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('UPDATE app_daily_bread_entries SET %I = %I + 1 WHERE id = $1', col, col) USING entry_id;
END $$;
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

## 4. Eventos — estrutura completa

> **Migration obrigatória:** antes de criar eventos no MRM, execute o arquivo
> `supabase/migrations/20260518_event_features.sql` no Supabase → SQL Editor.

### `app_events` — tabela principal

```sql
id                   UUID PRIMARY KEY
church_id            UUID NOT NULL         -- isolamento obrigatório
nome                 VARCHAR(255) NOT NULL
descricao            TEXT
categoria            VARCHAR(100)          -- 'Culto' | 'Jovens' | 'Louvor' | livre
tipo_evento          VARCHAR(20) DEFAULT 'LIVRE'  -- 'LIVRE' | 'COM_ASSENTO'
icon                 VARCHAR(50)
  -- valores: 'mic' | 'music' | 'book' | 'users' | 'sparkles' | 'heart'
  --          'flame' | 'star' | 'globe' | 'sunrise' | 'ticket'
imagem_url           VARCHAR(500)          -- banner/capa exibida no app
banner_url           VARCHAR(500)          -- alias legado
data_inicio          TIMESTAMPTZ NOT NULL
data_fim             TIMESTAMPTZ NOT NULL
local                VARCHAR(255)
local_endereco       TEXT
preco                DECIMAL(10,2) DEFAULT 0
gratuito             BOOLEAN DEFAULT true
capacidade_total     INT                   -- calculado: soma rows×seats de todos setores
quantidade_disponivel INT                  -- atualizado conforme vendas
limite_por_usuario   INT
permite_transferencia BOOLEAN DEFAULT false
permite_cancelamento  BOOLEAN DEFAULT false
permite_reembolso     BOOLEAN DEFAULT false
status               VARCHAR(20) DEFAULT 'RASCUNHO'
  -- 'RASCUNHO' | 'PUBLICADO' | 'ENCERRADO' | 'CANCELADO'
deleted_at           TIMESTAMPTZ           -- soft delete
created_at           TIMESTAMPTZ
updated_at           TIMESTAMPTZ
```

### `event_participants` — participantes/artistas do evento

```sql
id         UUID PRIMARY KEY
event_id   UUID FK → app_events (ON DELETE CASCADE)
nome       VARCHAR(255) NOT NULL
papel      VARCHAR(100)  -- 'Cantor' | 'Pregador' | 'MC' | 'Convidado' | livre
foto_url   TEXT          -- URL da foto de perfil do participante
ordem      SMALLINT DEFAULT 0
created_at TIMESTAMPTZ
```

**Query Flutter — listar participantes:**

```dart
final parts = await supabase
  .from('event_participants')
  .select('id, nome, papel, foto_url')
  .eq('event_id', eventId)
  .order('ordem');
```

### `event_sectors` — salas/ambientes do evento (para COM_ASSENTO)

```sql
id            UUID PRIMARY KEY
event_id      UUID FK → app_events (ON DELETE CASCADE)
nome          TEXT NOT NULL        -- 'Salão Principal', 'Sala VIP', etc.
andar         INT DEFAULT 1        -- andar do espaço
rows_count    INT DEFAULT 0        -- número de fileiras (A, B, C, ...)
seats_per_row INT DEFAULT 0        -- assentos por fileira (colunas)
quantidade    INT DEFAULT 0        -- total = rows_count × seats_per_row
preco         DECIMAL(10,2) DEFAULT 0  -- preço por assento nesta sala
cor_hex       VARCHAR(7) DEFAULT '#8b5cf6'
ordem         SMALLINT DEFAULT 0
created_at    TIMESTAMPTZ
```

### `event_rows` — fileiras dentro de um setor

```sql
id         UUID PRIMARY KEY
event_id   UUID FK → app_events
sector_id  UUID FK → event_sectors (ON DELETE CASCADE)
nome       TEXT NOT NULL    -- 'A', 'B', 'C', ... até 'Z' (máx 26 fileiras)
ordem      SMALLINT DEFAULT 0
created_at TIMESTAMPTZ
```

### `event_seats` — assentos individuais

```sql
id             UUID PRIMARY KEY
event_id       UUID FK → app_events
sector_id      UUID FK → event_sectors
row_id         UUID FK → event_rows
numero         SMALLINT NOT NULL    -- número da coluna (1, 2, 3, ...)
status         VARCHAR(20) DEFAULT 'LIVRE'
               -- 'LIVRE' | 'RESERVADO' | 'OCUPADO' | 'BLOQUEADO'
reservado_por  UUID                 -- user_id que reservou
reservado_em   TIMESTAMPTZ
reserva_expira TIMESTAMPTZ          -- TTL de reserva (ex: 5 min)
order_item_id  UUID FK → event_order_items
created_at     TIMESTAMPTZ
UNIQUE (event_id, sector_id, row_id, numero)
```

**Código de assento no app:** `{row.nome}{seat.numero}` → ex: `A1`, `B3`, `H12`

**Query Flutter — mapa de assentos de um setor:**

```dart
final seats = await supabase
  .from('event_seats')
  .select('id, numero, status, row:event_rows!row_id(nome)')
  .eq('sector_id', sectorId)
  .order('row_id')
  .order('numero');
```

### `event_orders` — pedidos de ingresso

```sql
id              UUID PRIMARY KEY
user_id         UUID NOT NULL
event_id        UUID FK → app_events
numero_pedido   TEXT UNIQUE      -- formato: P{timestamp}
buyer_name      TEXT
buyer_email     TEXT
buyer_phone     TEXT
subtotal        DECIMAL(10,2)
desconto        DECIMAL(10,2) DEFAULT 0
total           DECIMAL(10,2)
payment_method  TEXT    -- 'free' | 'pix' | 'credit_card'
payment_ref     TEXT
status          VARCHAR(30) DEFAULT 'AGUARDANDO_PAGAMENTO'
                -- 'AGUARDANDO_PAGAMENTO' | 'PAGO' | 'CANCELADO' | 'REEMBOLSADO' | 'EXPIRADO'
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
cancelled_at    TIMESTAMPTZ
```

### `event_order_items` — itens de um pedido (1 por assento)

```sql
id         UUID PRIMARY KEY
order_id   UUID FK → event_orders
event_id   UUID FK → app_events
seat_id    UUID FK → event_seats  -- assento específico (COM_ASSENTO)
sector_id  UUID FK → event_sectors
qty        SMALLINT DEFAULT 1
unit_price DECIMAL(10,2)
subtotal   DECIMAL(10,2)
status     VARCHAR(20) DEFAULT 'ATIVO'  -- 'ATIVO' | 'CANCELADO' | 'REEMBOLSADO'
created_at TIMESTAMPTZ
```

### `event_qrcodes` — QR Code por ingresso (1 por assento/item)

```sql
id            UUID PRIMARY KEY
order_id      UUID FK → event_orders
order_item_id UUID FK → event_order_items
event_id      UUID FK → app_events
user_id       UUID
seat_id       UUID FK → event_seats  -- assento vinculado
ticket_code   TEXT UNIQUE            -- código único para leitura
qr_data       TEXT                   -- conteúdo encodado no QR
is_used       BOOLEAN DEFAULT false
used_at       TIMESTAMPTZ
checked_in_by UUID
is_cancelled  BOOLEAN DEFAULT false
cancelled_at  TIMESTAMPTZ
created_at    TIMESTAMPTZ
```

### `event_refunds` — reembolsos

```sql
id               UUID PRIMARY KEY
order_id         UUID FK → event_orders
event_id         UUID FK → app_events
user_id          UUID
motivo           TEXT
valor_solicitado DECIMAL(10,2)
status           VARCHAR(20) DEFAULT 'SOLICITADO'
                 -- 'SOLICITADO' | 'APROVADO' | 'NEGADO' | 'PROCESSADO'
notas_admin      TEXT
processed_by     UUID
created_at       TIMESTAMPTZ
updated_at       TIMESTAMPTZ
```

### Fluxo completo de compra (COM_ASSENTO)

```text
Usuário escolhe evento → seleciona sala → clica assento
        │
        ▼ (reserva temporária 5 min)
event_seats.status = 'RESERVADO'
event_seats.reserva_expira = NOW() + 5min
        │
        ▼ Confirma compra + pagamento
event_orders INSERT (status = 'AGUARDANDO_PAGAMENTO' → 'PAGO')
event_order_items INSERT (1 por assento)
event_seats.status = 'OCUPADO'
event_seats.order_item_id = item.id
event_qrcodes INSERT (1 QR por assento, ticket_code único)
        │
        ▼ App exibe QR codes
event_qrcodes.ticket_code → QR Code exibido por assento (E3, D3, etc.)
        │
        ▼ Check-in (leitura do QR pelo operador MRM)
event_qrcodes.is_used = true
event_qrcodes.used_at = NOW()
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
| `src/app-ui/app/AppDailyBread.tsx` | Corrigido: colunas em inglês; `body_text` carregado no edit; seletor de `icon_name` por entrada; ícone dinâmico na lista |
| `src/app-ui/app/AppEvents.tsx` | Adicionado filtro `church_id` |
| `src/app-ui/app/AppEventNew.tsx` | **Reescrito completo:** layout 2 colunas full-width; ícone, imagem (URL ou upload → bucket "dados"), categoria, tipo, salas+fileiras+assentos, participantes, prévia do mapa |
| `src/app-ui/app/AppEventDepartments.tsx` | Filtro + `church_id` no INSERT |
| `src/app-ui/app/AppEventOrders.tsx` | Filtro via join `app_events!inner` |
| `src/app-ui/app/AppEventRefunds.tsx` | Filtro via join `app_events!inner` |
| `src/app-ui/app/AppRegistrations.tsx` | `headquarters_id` via API; corrigido `notas_admin` → `observacoes` |
| `src/app-ui/app/AppDashboard.tsx` | Stats reais do banco + card de Ministérios |
| `src/app-ui/app/AppMinistries.tsx` | Criado — gestão de ministérios isolado por `church_id` |
| `src/spa/routes.tsx` | Rotas `/app-ui/app/daily-bread` e `/app-ui/app/ministries` adicionadas |
| `src/components/app-ui/AppUI.tsx` | Sidebar App Móvel: Pão Diário e Ministérios adicionados |

## 9. Bucket de mídias — Supabase Storage

**Bucket:** `dados`

Todas as mídias do sistema (banners de eventos, fotos de participantes, etc.) devem ser enviadas para este bucket.

| Pasta | Uso |
| --- | --- |
| `events/` | Banners/imagens de eventos |

O MRM usa upload direto via Supabase Storage SDK:

```typescript
const { error } = await supabase.storage.from('dados').upload(`events/${uuid}.jpg`, file);
const { data: { publicUrl } } = supabase.storage.from('dados').getPublicUrl(path);
// publicUrl é salvo em app_events.imagem_url
```

No app Flutter, leia `imagem_url` normalmente — é uma URL pública.

---

## 10. Migration SQL — execute antes de criar eventos

**Arquivo:** `supabase/migrations/20260518_event_features.sql`

Execute no painel Supabase → SQL Editor. É idempotente (pode rodar várias vezes sem erro).

O que ela faz:

- Adiciona colunas a `app_events`: `tipo_evento`, `icon`, `imagem_url`, `categoria`, `gratuito`, `capacidade_total`, `permite_*`, `limite_por_usuario`, `local_endereco`
- Cria/atualiza `event_sectors` com colunas `andar`, `rows_count`, `seats_per_row`
- Cria `event_rows`, `event_seats` (se não existirem)
- Cria `event_participants` (nova tabela)
- Cria `event_departments` (nova tabela — categorias organizadoras dos eventos por `church_id`)
- Atualiza `event_orders` e `event_qrcodes` com colunas do schema atual
