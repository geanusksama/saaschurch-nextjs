# Arquitetura do Sistema de Eventos e Compra de Ingressos
> Documento gerado em 2026-05-18  
> **Destino:** agente responsável por implementar o fluxo de compra de ingressos no app Flutter.  
> Use este arquivo como fonte única de verdade sobre banco de dados, regras de negócio e integrações.

---

## 1. Visão Geral

O sistema de eventos do SaasChurch permite que igrejas criem eventos com ou sem mapa de assentos. O usuário do app compra ingressos, recebe QR Codes e faz check-in no dia do evento.

**Stack:** Supabase (PostgreSQL + Auth + Storage) · Flutter (app móvel) · Next.js (painel admin MRM)

**Multi-tenant:** toda query deve incluir `church_id` para isolar dados entre igrejas.

---

## 2. Tabelas e Schema Completo

### 2.1 `app_events` — evento principal

```sql
id                    UUID PRIMARY KEY DEFAULT gen_random_uuid()
church_id             UUID NOT NULL              -- isolamento multi-tenant OBRIGATÓRIO
headquarters_id       UUID                       -- FK → headquarters (opcional)
department_id         UUID                       -- FK → event_departments (ministério)

-- Identidade
nome                  VARCHAR(255) NOT NULL       -- nome exibido no app
descricao             TEXT                        -- descrição longa
categoria             VARCHAR(100)               -- 'Culto' | 'Jovens' | 'Louvor' | livre
tipo_evento           VARCHAR(20) DEFAULT 'LIVRE' -- 'LIVRE' | 'COM_ASSENTO'
icon                  VARCHAR(50)                -- chave do ícone (ver seção 6)
imagem_url            VARCHAR(500)               -- URL do banner/capa
banner_url            VARCHAR(500)               -- alias legado

-- Datas
data_inicio           TIMESTAMPTZ NOT NULL
data_fim              TIMESTAMPTZ NOT NULL

-- Local
local                 VARCHAR(255)               -- ex: 'Templo Central'
local_endereco        TEXT                        -- endereço completo

-- Ingressos e preço
preco                 DECIMAL(10,2) DEFAULT 0
gratuito              BOOLEAN DEFAULT true
capacidade_total      INT                        -- soma de todos os assentos
quantidade_disponivel INT                        -- decrementado nas compras
limite_por_usuario    INT                        -- max ingressos por usuário

-- Políticas
permite_transferencia BOOLEAN DEFAULT false
permite_cancelamento  BOOLEAN DEFAULT false
permite_reembolso     BOOLEAN DEFAULT false

-- Controle
status                VARCHAR(20) DEFAULT 'RASCUNHO'
                      -- 'RASCUNHO' | 'PUBLICADO' | 'ENCERRADO' | 'CANCELADO'
deleted_at            TIMESTAMPTZ                -- soft delete
created_by            UUID
created_at            TIMESTAMPTZ DEFAULT now()
updated_at            TIMESTAMPTZ DEFAULT now()
```

> **Filtro obrigatório no app:** sempre inclua `.eq('church_id', churchId)` e `.eq('status', 'PUBLICADO')` para listar eventos disponíveis.

---

### 2.2 `event_sectors` — salas/ambientes (somente `COM_ASSENTO`)

```sql
id            UUID PRIMARY KEY
event_id      UUID NOT NULL FK → app_events ON DELETE CASCADE
nome          TEXT NOT NULL              -- 'Salão Principal', 'Sala VIP', etc.
andar         INT DEFAULT 1
rows_count    INT DEFAULT 0              -- número de fileiras (A, B, C, ...)
seats_per_row INT DEFAULT 0             -- assentos por fileira
quantidade    INT DEFAULT 0             -- total = rows_count × seats_per_row
preco         DECIMAL(10,2) DEFAULT 0   -- preço por assento nesta sala
cor_hex       VARCHAR(7) DEFAULT '#8b5cf6'
ordem         SMALLINT DEFAULT 0
created_at    TIMESTAMPTZ
```

**Regra:** um evento `COM_ASSENTO` tem 1 ou mais setores. Cada setor pode ter preço diferente.

---

### 2.3 `event_rows` — fileiras de um setor

```sql
id         UUID PRIMARY KEY
event_id   UUID FK → app_events
sector_id  UUID FK → event_sectors ON DELETE CASCADE
nome       TEXT NOT NULL    -- 'A', 'B', 'C', ..., 'Z' (máx 26 fileiras)
ordem      SMALLINT DEFAULT 0
created_at TIMESTAMPTZ
```

---

### 2.4 `event_seats` — assentos individuais

```sql
id             UUID PRIMARY KEY
event_id       UUID FK → app_events
sector_id      UUID FK → event_sectors ON DELETE CASCADE
row_id         UUID FK → event_rows
numero         SMALLINT NOT NULL        -- número da coluna (1, 2, 3, ...)
status         VARCHAR(20) DEFAULT 'LIVRE'
               -- 'LIVRE' | 'RESERVADO' | 'OCUPADO' | 'BLOQUEADO'
reservado_por  UUID                     -- user_id que reservou
reservado_em   TIMESTAMPTZ
reserva_expira TIMESTAMPTZ              -- TTL de reserva temporária (5 minutos)
order_item_id  UUID FK → event_order_items  -- preenchido após pagamento
created_at     TIMESTAMPTZ

UNIQUE (event_id, sector_id, row_id, numero)
INDEX (event_id, status)
```

**Código legível do assento no app:** `{row.nome}{seat.numero}` → ex: `A1`, `B3`, `H12`

**Query Flutter — mapa de assentos de um setor:**
```dart
final seats = await supabase
  .from('event_seats')
  .select('id, numero, status, reserva_expira, row:event_rows!row_id(nome)')
  .eq('sector_id', sectorId)
  .order('row_id')
  .order('numero');
```

---

### 2.5 `event_cart` — carrinho temporário (TTL 5 min)

```sql
id         UUID PRIMARY KEY
user_id    UUID NOT NULL
event_id   UUID FK → app_events ON DELETE CASCADE
seat_id    UUID FK → event_seats   -- assento escolhido (COM_ASSENTO)
sector_id  UUID FK → event_sectors -- setor (LIVRE)
qty        SMALLINT DEFAULT 1
unit_price DECIMAL(10,2)
expires_at TIMESTAMPTZ             -- NOW() + 5 minutos
created_at TIMESTAMPTZ

INDEX (user_id, event_id)
INDEX (expires_at)               -- para job de limpeza de expirados
```

**Regra:** ao adicionar item ao carrinho, o assento muda para `RESERVADO` em `event_seats`. Se o carrinho expirar sem pagamento, o assento volta para `LIVRE`.

---

### 2.6 `event_orders` — pedido de compra

```sql
id              UUID PRIMARY KEY
user_id         UUID NOT NULL
event_id        UUID FK → app_events
numero_pedido   TEXT UNIQUE          -- formato: PED-XXXXXXXX (gerado no app/backend)
buyer_name      TEXT
buyer_email     TEXT
buyer_phone     TEXT
subtotal        DECIMAL(10,2)
desconto        DECIMAL(10,2) DEFAULT 0
total           DECIMAL(10,2)
payment_method  TEXT    -- 'free' | 'pix' | 'credit_card' | 'debit_card'
payment_ref     TEXT    -- ID da transação no gateway de pagamento
notas           TEXT
status          VARCHAR(30) DEFAULT 'AGUARDANDO_PAGAMENTO'
                -- 'AGUARDANDO_PAGAMENTO' | 'PAGO' | 'CANCELADO' | 'REEMBOLSADO' | 'EXPIRADO'
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
cancelled_at    TIMESTAMPTZ

INDEX (user_id, status)
INDEX (event_id, status)
```

**Regra:** 1 pedido pode conter múltiplos ingressos (1 por `event_order_items`). Cada pedido pertence a 1 usuário.

---

### 2.7 `event_order_items` — itens do pedido (1 por ingresso/assento)

```sql
id         UUID PRIMARY KEY
order_id   UUID FK → event_orders ON DELETE CASCADE
event_id   UUID FK → app_events
seat_id    UUID FK → event_seats   -- assento específico (COM_ASSENTO) ou NULL (LIVRE)
sector_id  UUID FK → event_sectors -- setor do assento
qty        SMALLINT DEFAULT 1      -- sempre 1 por assento (COM_ASSENTO)
unit_price DECIMAL(10,2)
subtotal   DECIMAL(10,2)
status     VARCHAR(20) DEFAULT 'ATIVO'
           -- 'ATIVO' | 'CANCELADO' | 'REEMBOLSADO'
created_at TIMESTAMPTZ

INDEX (order_id)
```

**Regra:** para `COM_ASSENTO`, cada item representa exatamente 1 assento → `seat_id` preenchido. Para `LIVRE`, `seat_id` é NULL e `qty` pode ser > 1.

---

### 2.8 `event_qrcodes` — QR Code por ingresso

```sql
id            UUID PRIMARY KEY
order_id      UUID FK → event_orders ON DELETE CASCADE
order_item_id UUID FK → event_order_items  -- item correspondente
event_id      UUID FK → app_events
user_id       UUID
seat_id       UUID FK → event_seats        -- assento vinculado (COM_ASSENTO)
ticket_code   TEXT UNIQUE                  -- código único para leitura no check-in
qr_data       TEXT                         -- conteúdo encodado no QR (JSON ou URL)
is_used       BOOLEAN DEFAULT false
used_at       TIMESTAMPTZ
checked_in_by UUID                         -- operador que fez o check-in
is_cancelled  BOOLEAN DEFAULT false
cancelled_at  TIMESTAMPTZ
created_at    TIMESTAMPTZ

INDEX (event_id, is_used)
```

**Regra:** 1 QR Code por `event_order_item`. Para um pedido com 3 assentos → 3 QR Codes distintos.

**Formato sugerido para `ticket_code`:** `EVT-{eventId[:8]}-{random8}` (ex: `EVT-A1B2C3D4-X9Y8Z7W6`)

**Formato sugerido para `qr_data`:** JSON com dados mínimos:
```json
{
  "tc": "EVT-A1B2C3D4-X9Y8Z7W6",
  "ev": "uuid-do-evento",
  "st": "A3",
  "ui": "uuid-do-usuario"
}
```

---

### 2.9 `event_refunds` — solicitações de reembolso

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
processed_at     TIMESTAMPTZ

INDEX (status)
```

---

### 2.10 `event_notifications` — notificações push/in-app

```sql
id           UUID PRIMARY KEY
event_id     UUID FK → app_events
user_id      UUID
order_id     UUID FK → event_orders
qrcode_id    UUID
tipo         TEXT   -- 'ticket_confirmed' | 'event_reminder' | 'transfer_request' | 'event_cancelled'
titulo       TEXT
mensagem     TEXT
aceita       BOOLEAN         -- para transfer_request: usuário aceitou?
respondida_em TIMESTAMPTZ
lida         BOOLEAN DEFAULT false
lida_em      TIMESTAMPTZ
created_at   TIMESTAMPTZ

INDEX (user_id, lida)
INDEX (event_id)
```

---

### 2.11 `event_participants` — artistas/pregadores do evento

```sql
id         UUID PRIMARY KEY
event_id   UUID FK → app_events ON DELETE CASCADE
nome       VARCHAR(255) NOT NULL
papel      VARCHAR(100)     -- 'Cantor' | 'Pregador' | 'MC' | 'Convidado' | livre
foto_url   TEXT
ordem      SMALLINT DEFAULT 0
created_at TIMESTAMPTZ
```

---

## 3. Diagrama de Relacionamentos

```
app_events
  ├── event_sectors (1:N)
  │     ├── event_rows (1:N)
  │     │     └── event_seats (1:N) ◄─────────────────────────────────┐
  │     └── event_seats (1:N)                                          │
  ├── event_cart (1:N por user_id)                                     │
  ├── event_participants (1:N)                                         │
  └── event_orders (1:N por user_id)                                   │
        └── event_order_items (1:N) ──── seat_id → event_seats ────────┘
              └── event_qrcodes (1:1 por item)
```

---

## 4. Fluxo Completo de Compra

### 4.1 Evento `COM_ASSENTO` (com mapa de cadeiras)

```
1. App lista eventos
   SELECT * FROM app_events
   WHERE church_id = ? AND status = 'PUBLICADO'
   AND tipo_evento = 'COM_ASSENTO'
   AND data_inicio > NOW()
   ORDER BY data_inicio

2. Usuário escolhe evento → app lista setores
   SELECT * FROM event_sectors WHERE event_id = ?

3. Usuário escolhe setor → app carrega mapa de assentos
   SELECT id, numero, status, reserva_expira,
          row:event_rows!row_id(nome)
   FROM event_seats
   WHERE sector_id = ? AND event_id = ?
   -- Assentos com status='RESERVADO' e reserva_expira < NOW()
   -- são tratados como LIVRE pelo app (expirados)

4. Usuário clica assento(s) → RESERVA TEMPORÁRIA (5 min)
   UPDATE event_seats
   SET status = 'RESERVADO',
       reservado_por = auth.uid(),
       reservado_em = NOW(),
       reserva_expira = NOW() + INTERVAL '5 minutes'
   WHERE id = ? AND status = 'LIVRE'  -- condição de corrida protegida

   INSERT INTO event_cart (user_id, event_id, seat_id, sector_id, unit_price, expires_at)
   VALUES (?, ?, ?, ?, ?, NOW() + INTERVAL '5 minutes')

5. Usuário confirma dados + pagamento
   -- Gerar numero_pedido único: 'PED-' || to_char(NOW(), 'YYYYMMDDHH24MISS') || random(4 chars)

   INSERT INTO event_orders (user_id, event_id, numero_pedido, buyer_name, buyer_email,
                              buyer_phone, subtotal, total, payment_method, status)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pix'|'free', 'AGUARDANDO_PAGAMENTO')

   -- Para cada assento selecionado:
   INSERT INTO event_order_items (order_id, event_id, seat_id, sector_id, qty, unit_price, subtotal)
   VALUES (?, ?, ?, ?, 1, ?, ?)

6. Pagamento confirmado → finaliza compra
   UPDATE event_orders SET status = 'PAGO', updated_at = NOW() WHERE id = ?

   -- Para cada order_item:
   UPDATE event_seats
   SET status = 'OCUPADO', order_item_id = ?
   WHERE id = ?

   -- Gerar QR Code para cada item:
   INSERT INTO event_qrcodes (order_id, order_item_id, event_id, user_id, seat_id,
                               ticket_code, qr_data)
   VALUES (?, ?, ?, ?, ?, 'EVT-{eventId[:8]}-{random8}', '{"tc":"...","ev":"...","st":"A3","ui":"..."}')

   -- Notificação:
   INSERT INTO event_notifications (event_id, user_id, order_id, tipo, titulo, mensagem)
   VALUES (?, ?, ?, 'ticket_confirmed', 'Ingresso confirmado!', 'Seu ingresso para X está confirmado.')

   -- Limpar carrinho:
   DELETE FROM event_cart WHERE user_id = ? AND event_id = ?

7. App exibe QR Codes
   SELECT eq.ticket_code, eq.qr_data, eq.is_used,
          es.numero, er.nome AS fileira
   FROM event_qrcodes eq
   JOIN event_order_items oi ON oi.id = eq.order_item_id
   LEFT JOIN event_seats es ON es.id = eq.seat_id
   LEFT JOIN event_rows er ON er.id = es.row_id
   WHERE eq.order_id = ?
```

### 4.2 Evento `LIVRE` (sem mapa de assentos)

```
1–3. Mesmos passos de listagem/seleção de evento

4. Usuário escolhe quantidade de ingressos
   -- Verificar limite_por_usuario e quantidade_disponivel

5. Confirma pagamento
   INSERT INTO event_orders (mesmos campos)

   -- 1 item por ingresso, sem seat_id:
   INSERT INTO event_order_items (order_id, event_id, seat_id=NULL, sector_id=NULL, qty=N, ...)

6. Pagamento confirmado
   UPDATE event_orders SET status = 'PAGO'

   -- Decrementar disponíveis:
   UPDATE app_events
   SET quantidade_disponivel = quantidade_disponivel - N
   WHERE id = ? AND quantidade_disponivel >= N

   -- Gerar 1 QR Code por ingresso (qty=3 → 3 QR Codes):
   INSERT INTO event_qrcodes ... (seat_id = NULL)

7. App exibe QR Codes (sem informação de assento)
```

---

## 5. Regras de Negócio Críticas

### 5.1 Reserva e concorrência

- O assento só pode ser reservado se `status = 'LIVRE'` **no momento do UPDATE** (use condição `WHERE status = 'LIVRE'` para evitar double-booking).
- Reservas expiram em **5 minutos** (`reserva_expira < NOW()`). O app deve tratar assentos com `status = 'RESERVADO'` e `reserva_expira` no passado como `LIVRE` na UI.
- Use **Supabase Realtime** para atualizar o mapa de assentos em tempo real enquanto outros usuários reservam.
- Um job periódico (ou trigger PostgreSQL) deve limpar reservas expiradas:
  ```sql
  UPDATE event_seats
  SET status = 'LIVRE', reservado_por = NULL, reservado_em = NULL, reserva_expira = NULL
  WHERE status = 'RESERVADO' AND reserva_expira < NOW();
  ```

### 5.2 Limite por usuário

- Antes de reservar, verificar:
  ```sql
  SELECT COUNT(*) FROM event_order_items oi
  JOIN event_orders o ON o.id = oi.order_id
  WHERE o.user_id = ? AND oi.event_id = ? AND o.status IN ('PAGO', 'AGUARDANDO_PAGAMENTO')
  ```
  Se `COUNT >= app_events.limite_por_usuario`, recusar.

### 5.3 Evento gratuito

- Se `app_events.gratuito = true`, o pedido vai direto para `status = 'PAGO'` sem gateway de pagamento.
- `payment_method = 'free'`, `total = 0`.

### 5.4 Cancelamento e reembolso

- Para cancelar um ingresso, o usuário precisa que `app_events.permite_cancelamento = true`.
- O fluxo de cancelamento:
  1. `event_order_items.status = 'CANCELADO'`
  2. `event_seats.status = 'LIVRE'` (libera o assento)
  3. `event_qrcodes.is_cancelled = true`
  4. Se pagou: `INSERT INTO event_refunds` com `status = 'SOLICITADO'`
  5. Admin no MRM aprova o reembolso (`status → 'PROCESSADO'`)

### 5.5 Transferência de ingresso

- Só disponível se `app_events.permite_transferencia = true`.
- Fluxo via `event_notifications` com `tipo = 'transfer_request'`:
  1. Usuário A solicita transferência para Usuário B → `INSERT INTO event_notifications (aceita = NULL)`
  2. Usuário B aceita → `event_qrcodes.user_id = B.id`, `event_orders.user_id = B.id`

---

## 6. Valores de `icon` do evento

| Chave | Ícone sugerido no app |
|---|---|
| `mic` | Microfone — Louvor/Música ao vivo |
| `music` | Nota musical — Show/Concerto |
| `book` | Livro aberto — Ensino/Pregação |
| `users` | Grupo — Encontro/Conferência |
| `sparkles` | Estrelas — Evento de jovens |
| `heart` | Coração — Adoração/Amor |
| `flame` | Chama — Avivamento/Jejum |
| `star` | Estrela — Evento especial |
| `globe` | Globo — Missões |
| `sunrise` | Sol nascendo — Culto matinal |
| `ticket` | Ingresso — Conferência/Show |

---

## 7. Isolamento Multi-Tenant

Toda query no app **deve** incluir o filtro de `church_id`:

```dart
// Sempre obtido de:
final churchId = supabase.auth.currentUser?.userMetadata?['church_id'];
// ou do token JWT: supabase.auth.currentUser?.userMetadata?['church_id']
```

| Tabela | Filtro direto |
|---|---|
| `app_events` | `church_id` |
| `event_orders` | join em `app_events.church_id` |
| `event_qrcodes` | join em `app_events.church_id` |
| `event_refunds` | join em `app_events.church_id` |
| `event_sectors` | via `event_id` → `app_events.church_id` |
| `event_seats` | via `event_id` → `app_events.church_id` |

---

## 8. Supabase Realtime — Assinatura Recomendada

```dart
// Escuta mudanças no mapa de assentos de um setor em tempo real:
supabase
  .from('event_seats')
  .stream(primaryKey: ['id'])
  .eq('sector_id', sectorId)
  .listen((rows) {
    // Atualiza estado local com novos status dos assentos
    setState(() => seats = rows);
  });
```

---

## 9. Endpoints do Painel MRM (para referência)

| Tela MRM | Rota |
|---|---|
| Lista de eventos | `/app-ui/app/events` |
| Criar evento | `/app-ui/app/events/new` |
| Visualizar evento | `/app-ui/app/events/:id` |
| Editar evento | `/app-ui/app/events/:id/edit` |
| Pedidos/ingressos | `/app-ui/app/orders` |
| Check-in (leitura QR) | `/app-ui/app/checkin` |
| Reembolsos | `/app-ui/app/refunds` |

---

## 10. Checklist do Fluxo de Compra no App

- [ ] Listar eventos publicados com filtro `church_id` + `status = 'PUBLICADO'`
- [ ] Exibir detalhes do evento: nome, data, local, preço, capacidade disponível, participantes
- [ ] Para `COM_ASSENTO`: listar setores com preço e cor
- [ ] Para `COM_ASSENTO`: renderizar mapa de assentos com status visual (livre/reservado/ocupado)
- [ ] Usar Supabase Realtime para atualizar mapa enquanto outros reservam
- [ ] Reserva temporária ao clicar assento (UPDATE + INSERT em `event_cart`)
- [ ] Timer regressivo de 5 minutos visível ao usuário
- [ ] Formulário de dados do comprador (nome, e-mail, telefone)
- [ ] Integração com gateway de pagamento (PIX, cartão)
- [ ] Para eventos gratuitos: confirmar direto sem gateway
- [ ] Gerar `numero_pedido` único
- [ ] INSERT em `event_orders` + `event_order_items`
- [ ] UPDATE em `event_seats` para `OCUPADO`
- [ ] INSERT em `event_qrcodes` (1 por assento/ingresso)
- [ ] Exibir QR Codes gerados na tela de confirmação
- [ ] Página "Meus Ingressos": listar `event_qrcodes` com seat + evento
- [ ] Tela de cancelamento (se `permite_cancelamento = true`)
- [ ] Tela de transferência (se `permite_transferencia = true`)
- [ ] Notificações via `event_notifications`
