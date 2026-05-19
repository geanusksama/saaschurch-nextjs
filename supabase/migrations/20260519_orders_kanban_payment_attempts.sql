-- ============================================================
-- MIGRAÇÃO: Complementos às tabelas de pedidos do APP
-- Execute no Supabase → SQL Editor (idempotente — pode rodar N vezes)
-- ============================================================

-- 1. Coluna payment_attempts em event_orders (MRM extension)
ALTER TABLE event_orders ADD COLUMN IF NOT EXISTS payment_attempts INTEGER NOT NULL DEFAULT 0;

-- 2. Tabela event_order_items (itens de cada pedido)
CREATE TABLE IF NOT EXISTS event_order_items (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID          NOT NULL REFERENCES event_orders(id) ON DELETE CASCADE,
  event_id    UUID          NOT NULL REFERENCES app_events(id),
  seat_id     UUID,
  sector_id   UUID,
  qty         SMALLINT      NOT NULL DEFAULT 1,
  unit_price  DECIMAL(10,2) NOT NULL DEFAULT 0,
  subtotal    DECIMAL(10,2) NOT NULL DEFAULT 0,
  status      VARCHAR(20)   NOT NULL DEFAULT 'ATIVO',
             -- 'ATIVO' | 'CANCELADO' | 'REEMBOLSADO'
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_order_items_order ON event_order_items (order_id);

-- 3. Tabela event_refunds (solicitações de reembolso)
CREATE TABLE IF NOT EXISTS event_refunds (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID          NOT NULL REFERENCES event_orders(id),
  event_id         UUID          NOT NULL REFERENCES app_events(id),
  user_id          UUID          NOT NULL,
  motivo           TEXT,
  valor_solicitado DECIMAL(10,2) NOT NULL DEFAULT 0,
  status           VARCHAR(20)   NOT NULL DEFAULT 'SOLICITADO',
                   -- 'SOLICITADO' | 'APROVADO' | 'NEGADO' | 'PROCESSADO'
  notas_admin      TEXT,
  processed_by     UUID,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  processed_at     TIMESTAMPTZ
);

-- 3. Tabela event_notifications (notificações in-app)
CREATE TABLE IF NOT EXISTS event_notifications (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID        NOT NULL REFERENCES app_events(id),
  user_id       UUID        NOT NULL,
  order_id      UUID        REFERENCES event_orders(id),
  qrcode_id     UUID,
  tipo          TEXT        NOT NULL,
  titulo        TEXT        NOT NULL,
  mensagem      TEXT,
  aceita        BOOLEAN,
  respondida_em TIMESTAMPTZ,
  lida          BOOLEAN     NOT NULL DEFAULT false,
  lida_em       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Índices para consultas do Kanban
CREATE INDEX IF NOT EXISTS idx_event_orders_status        ON event_orders (status);
CREATE INDEX IF NOT EXISTS idx_event_orders_event_status  ON event_orders (event_id, status);
CREATE INDEX IF NOT EXISTS idx_event_orders_user_status   ON event_orders (user_id, status);
CREATE INDEX IF NOT EXISTS idx_event_qrcodes_event_used   ON event_qrcodes (event_id, is_used);
CREATE INDEX IF NOT EXISTS idx_event_refunds_order        ON event_refunds (order_id);
CREATE INDEX IF NOT EXISTS idx_event_refunds_status       ON event_refunds (status);
CREATE INDEX IF NOT EXISTS idx_event_notifications_user   ON event_notifications (user_id, lida);
CREATE INDEX IF NOT EXISTS idx_event_notifications_event  ON event_notifications (event_id);
CREATE INDEX IF NOT EXISTS idx_event_notifications_order  ON event_notifications (order_id) WHERE order_id IS NOT NULL;
