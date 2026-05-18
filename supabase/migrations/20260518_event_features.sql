-- ============================================================
-- MIGRAÇÃO: Funcionalidades de Eventos com Ingressos
-- Execute no Supabase → SQL Editor (idempotente — pode rodar N vezes)
-- ============================================================

-- 1. COLUNAS EXTRAS EM app_events
-- (capacidade_total, tipo_evento, icon, imagem_url, categoria, etc.)
ALTER TABLE app_events
  ADD COLUMN IF NOT EXISTS tipo_evento           VARCHAR(20)    DEFAULT 'LIVRE',
  ADD COLUMN IF NOT EXISTS icon                  VARCHAR(50),
  ADD COLUMN IF NOT EXISTS imagem_url            VARCHAR(500),
  ADD COLUMN IF NOT EXISTS categoria             VARCHAR(100),
  ADD COLUMN IF NOT EXISTS gratuito              BOOLEAN        DEFAULT true,
  ADD COLUMN IF NOT EXISTS permite_transferencia BOOLEAN        DEFAULT false,
  ADD COLUMN IF NOT EXISTS permite_cancelamento  BOOLEAN        DEFAULT false,
  ADD COLUMN IF NOT EXISTS permite_reembolso     BOOLEAN        DEFAULT false,
  ADD COLUMN IF NOT EXISTS capacidade_total      INT,
  ADD COLUMN IF NOT EXISTS quantidade_disponivel INT,
  ADD COLUMN IF NOT EXISTS limite_por_usuario    INT,
  ADD COLUMN IF NOT EXISTS local_endereco        TEXT,
  ADD COLUMN IF NOT EXISTS headquarters_id       UUID,
  ADD COLUMN IF NOT EXISTS department_id         UUID,
  ADD COLUMN IF NOT EXISTS created_by            UUID,
  ADD COLUMN IF NOT EXISTS updated_at            TIMESTAMPTZ    DEFAULT NOW();

-- 2. SETORES / SALAS / AMBIENTES (event_sectors)
CREATE TABLE IF NOT EXISTS event_sectors (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID          NOT NULL REFERENCES app_events(id) ON DELETE CASCADE,
  nome          TEXT          NOT NULL,
  andar         INT           DEFAULT 1,
  rows_count    INT           DEFAULT 0,
  seats_per_row INT           DEFAULT 0,
  quantidade    INT           DEFAULT 0,
  preco         DECIMAL(10,2) DEFAULT 0,
  cor_hex       VARCHAR(7)    DEFAULT '#8b5cf6',
  ordem         SMALLINT      DEFAULT 0,
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);
-- Se a tabela já existia sem as colunas novas:
ALTER TABLE event_sectors
  ADD COLUMN IF NOT EXISTS andar         INT  DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rows_count    INT  DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seats_per_row INT  DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_event_sectors_event ON event_sectors(event_id);

-- 3. FILEIRAS DE ASSENTOS (event_rows)
CREATE TABLE IF NOT EXISTS event_rows (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID        NOT NULL REFERENCES app_events(id)      ON DELETE CASCADE,
  sector_id  UUID        NOT NULL REFERENCES event_sectors(id)   ON DELETE CASCADE,
  nome       TEXT        NOT NULL,   -- 'A', 'B', 'C', ...
  ordem      SMALLINT    DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_rows_sector ON event_rows(sector_id);

-- 4. ASSENTOS INDIVIDUAIS (event_seats)
CREATE TABLE IF NOT EXISTS event_seats (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id       UUID        NOT NULL REFERENCES app_events(id)     ON DELETE CASCADE,
  sector_id      UUID        NOT NULL REFERENCES event_sectors(id)  ON DELETE CASCADE,
  row_id         UUID        REFERENCES event_rows(id)              ON DELETE CASCADE,
  numero         SMALLINT    NOT NULL,   -- número da coluna (1, 2, 3, ...)
  status         VARCHAR(20) DEFAULT 'LIVRE',
                 -- 'LIVRE' | 'RESERVADO' | 'OCUPADO' | 'BLOQUEADO'
  reservado_por  UUID,
  reservado_em   TIMESTAMPTZ,
  reserva_expira TIMESTAMPTZ,
  order_item_id  UUID,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (event_id, sector_id, row_id, numero)
);
CREATE INDEX IF NOT EXISTS idx_event_seats_event_status ON event_seats(event_id, status);

-- 5. PARTICIPANTES / ARTISTAS DO EVENTO (event_participants)
CREATE TABLE IF NOT EXISTS event_participants (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   UUID         NOT NULL REFERENCES app_events(id) ON DELETE CASCADE,
  nome       VARCHAR(255) NOT NULL,
  papel      VARCHAR(100),    -- 'Cantor', 'Pregador', 'MC', 'Convidado', etc.
  foto_url   TEXT,
  ordem      SMALLINT     DEFAULT 0,
  created_at TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_participants_event ON event_participants(event_id);

-- 6. PEDIDOS (event_orders) — garante colunas do schema atual
ALTER TABLE event_orders
  ADD COLUMN IF NOT EXISTS numero_pedido  TEXT,
  ADD COLUMN IF NOT EXISTS buyer_name     TEXT,
  ADD COLUMN IF NOT EXISTS buyer_email    TEXT,
  ADD COLUMN IF NOT EXISTS buyer_phone    TEXT,
  ADD COLUMN IF NOT EXISTS subtotal       DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto       DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total          DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_ref    TEXT,
  ADD COLUMN IF NOT EXISTS notas          TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ DEFAULT NOW();

-- Garante UNIQUE em numero_pedido se a coluna foi criada agora
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'event_orders'::regclass
      AND conname = 'event_orders_numero_pedido_key'
  ) THEN
    ALTER TABLE event_orders ADD CONSTRAINT event_orders_numero_pedido_key UNIQUE (numero_pedido);
  END IF;
END $$;

-- 7. ITENS DE PEDIDO (event_order_items)
CREATE TABLE IF NOT EXISTS event_order_items (
  id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID          NOT NULL REFERENCES event_orders(id)   ON DELETE CASCADE,
  event_id   UUID          NOT NULL REFERENCES app_events(id),
  seat_id    UUID          REFERENCES event_seats(id),
  sector_id  UUID          REFERENCES event_sectors(id),
  qty        SMALLINT      DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  subtotal   DECIMAL(10,2) NOT NULL,
  status     VARCHAR(20)   DEFAULT 'ATIVO',  -- 'ATIVO' | 'CANCELADO' | 'REEMBOLSADO'
  created_at TIMESTAMPTZ   DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_order_items_order ON event_order_items(order_id);

-- 8. QRCODES (event_qrcodes) — garante colunas extras
ALTER TABLE event_qrcodes
  ADD COLUMN IF NOT EXISTS order_item_id UUID,
  ADD COLUMN IF NOT EXISTS seat_id       UUID  REFERENCES event_seats(id),
  ADD COLUMN IF NOT EXISTS user_id       UUID,
  ADD COLUMN IF NOT EXISTS qr_data       TEXT,
  ADD COLUMN IF NOT EXISTS is_cancelled  BOOLEAN     DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelled_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checked_in_by UUID;

-- 9. DEPARTAMENTOS DE EVENTOS (event_departments)
CREATE TABLE IF NOT EXISTS event_departments (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id  UUID         NOT NULL,
  nome       VARCHAR(255) NOT NULL,
  descricao  TEXT,
  icone      VARCHAR(50),
  cor        VARCHAR(7)   DEFAULT '#8b5cf6',
  slug       VARCHAR(100),
  ordem      SMALLINT     DEFAULT 0,
  ativo      BOOLEAN      DEFAULT true,
  created_at TIMESTAMPTZ  DEFAULT NOW(),
  updated_at TIMESTAMPTZ  DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_event_departments_church ON event_departments(church_id);

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================
