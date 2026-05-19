-- Migration: event_ticket_transfer
-- Cria tabela de histórico de transferências de ingressos

CREATE TABLE IF NOT EXISTS event_ticket_transfer (
  id                UUID        NOT NULL DEFAULT gen_random_uuid(),
  order_id          UUID        NOT NULL,
  from_name         TEXT        NOT NULL,
  from_member_id    UUID,
  to_name           TEXT        NOT NULL,
  to_member_id      UUID,
  transferred_by    TEXT,
  transferred_by_id UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT event_ticket_transfer_pkey PRIMARY KEY (id),
  CONSTRAINT event_ticket_transfer_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES event_orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_event_ticket_transfer_order_id
  ON event_ticket_transfer(order_id);
