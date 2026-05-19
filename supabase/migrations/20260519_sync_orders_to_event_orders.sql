-- ============================================================
-- MIGRAÇÃO: Sincroniza tabela `orders` (escrita pelo app Flutter)
--           com `event_orders` (lida pelo MRM/Prisma).
--
-- PROBLEMA IDENTIFICADO:
--   - O app Flutter estava gravando pedidos na tabela `orders`
--     (colunas em inglês: order_number, notes, status=PAID/CANCELLED...)
--   - O MRM/Prisma lê de `event_orders`
--     (colunas em português: numero_pedido, notas, status=PAGO/CANCELADO...)
--   - Resultado: Pipeline de Pedidos no MRM aparecia vazio.
--
-- SOLUÇÃO:
--   1. Migra os pedidos existentes de `orders` → `event_orders`
--   2. Cria trigger em `orders` para sincronizar automaticamente
--      inserções e atualizações futuras → `event_orders`
--   Assim o Flutter pode continuar escrevendo em `orders` sem mudanças.
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- PASSO 1: Migrar pedidos existentes
-- ──────────────────────────────────────────────────────────────

INSERT INTO event_orders (
  id,
  user_id,
  event_id,
  numero_pedido,
  buyer_name,
  buyer_email,
  buyer_phone,
  subtotal,
  desconto,
  total,
  payment_method,
  payment_ref,
  payment_attempts,
  status,
  notas,
  created_at,
  updated_at,
  cancelled_at
)
SELECT
  o.id,
  o.user_id,
  o.event_id,
  o.order_number,                             -- order_number → numero_pedido
  o.buyer_name,
  o.buyer_email,
  NULLIF(TRIM(o.buyer_phone), ''),            -- '' → NULL
  o.total,                                    -- sem subtotal separado → usar total
  0,                                          -- sem desconto separado
  o.total,
  o.payment_method,
  o.payment_ref,
  COALESCE(o.payment_attempts, 0),
  CASE o.status                               -- mapear status inglês → português
    WHEN 'PENDING_PAYMENT'       THEN 'AGUARDANDO_PAGAMENTO'
    WHEN 'PAID'                  THEN 'PAGO'
    WHEN 'CANCELLED'             THEN 'CANCELADO'
    WHEN 'REFUNDED'              THEN 'REEMBOLSADO'
    WHEN 'EXPIRED'               THEN 'EXPIRADO'
    WHEN 'REQUESTING_REFUND'     THEN 'SOLICITANDO_REEMBOLSO'
    ELSE                              'AGUARDANDO_PAGAMENTO'
  END,
  o.notes,                                    -- notes → notas
  o.created_at,
  o.updated_at,
  CASE WHEN o.status = 'CANCELLED' THEN o.updated_at ELSE NULL END
FROM orders o
WHERE NOT EXISTS (
  SELECT 1 FROM event_orders eo WHERE eo.id = o.id
);

-- ──────────────────────────────────────────────────────────────
-- PASSO 2: Função do trigger de sincronização
-- ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_order_to_event_orders()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO event_orders (
      id, user_id, event_id, numero_pedido,
      buyer_name, buyer_email, buyer_phone,
      subtotal, desconto, total,
      payment_method, payment_ref, payment_attempts,
      status, notas, created_at, updated_at, cancelled_at
    ) VALUES (
      NEW.id,
      NEW.user_id,
      NEW.event_id,
      NEW.order_number,
      NEW.buyer_name,
      NEW.buyer_email,
      NULLIF(TRIM(COALESCE(NEW.buyer_phone, '')), ''),
      NEW.total,
      0,
      NEW.total,
      NEW.payment_method,
      NEW.payment_ref,
      COALESCE(NEW.payment_attempts, 0),
      CASE NEW.status
        WHEN 'PENDING_PAYMENT'   THEN 'AGUARDANDO_PAGAMENTO'
        WHEN 'PAID'              THEN 'PAGO'
        WHEN 'CANCELLED'         THEN 'CANCELADO'
        WHEN 'REFUNDED'          THEN 'REEMBOLSADO'
        WHEN 'EXPIRED'           THEN 'EXPIRADO'
        WHEN 'REQUESTING_REFUND' THEN 'SOLICITANDO_REEMBOLSO'
        ELSE                          'AGUARDANDO_PAGAMENTO'
      END,
      NEW.notes,
      NEW.created_at,
      NEW.updated_at,
      CASE WHEN NEW.status = 'CANCELLED' THEN NEW.updated_at ELSE NULL END
    )
    ON CONFLICT (id) DO NOTHING;

  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE event_orders SET
      numero_pedido    = NEW.order_number,
      buyer_name       = NEW.buyer_name,
      buyer_email      = NEW.buyer_email,
      buyer_phone      = NULLIF(TRIM(COALESCE(NEW.buyer_phone, '')), ''),
      subtotal         = NEW.total,
      total            = NEW.total,
      payment_method   = NEW.payment_method,
      payment_ref      = NEW.payment_ref,
      payment_attempts = COALESCE(NEW.payment_attempts, 0),
      status           = CASE NEW.status
                           WHEN 'PENDING_PAYMENT'   THEN 'AGUARDANDO_PAGAMENTO'
                           WHEN 'PAID'              THEN 'PAGO'
                           WHEN 'CANCELLED'         THEN 'CANCELADO'
                           WHEN 'REFUNDED'          THEN 'REEMBOLSADO'
                           WHEN 'EXPIRED'           THEN 'EXPIRADO'
                           WHEN 'REQUESTING_REFUND' THEN 'SOLICITANDO_REEMBOLSO'
                           ELSE                          'AGUARDANDO_PAGAMENTO'
                         END,
      notas            = NEW.notes,
      updated_at       = NEW.updated_at,
      cancelled_at     = CASE WHEN NEW.status = 'CANCELLED' THEN NEW.updated_at ELSE NULL END
    WHERE id = NEW.id;

  ELSIF TG_OP = 'DELETE' THEN
    -- Soft-cancel: não deletar do event_orders, só marca cancelado
    UPDATE event_orders SET
      status       = 'CANCELADO',
      updated_at   = NOW(),
      cancelled_at = NOW()
    WHERE id = OLD.id;
  END IF;

  RETURN NEW;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- PASSO 3: Aplicar trigger na tabela orders
-- ──────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_sync_order_to_event_orders ON orders;

CREATE TRIGGER trg_sync_order_to_event_orders
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW
EXECUTE FUNCTION sync_order_to_event_orders();

-- ──────────────────────────────────────────────────────────────
-- PASSO 4: Verificação (SELECT para confirmar)
-- ──────────────────────────────────────────────────────────────
-- SELECT id, numero_pedido, status, total FROM event_orders ORDER BY created_at;
