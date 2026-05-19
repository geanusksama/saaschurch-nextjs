-- ============================================================
-- MIGRAÇÃO: Corrige trigger de sincronização orders → event_orders
--
-- PROBLEMA: O app Flutter grava status em minúsculas ('paid', 'cancelled')
--           O trigger original comparava em maiúsculas ('PAID', 'CANCELLED')
--           Resultado: todos os updates caíam no ELSE → 'AGUARDANDO_PAGAMENTO'
--
-- SOLUÇÃO: Usar UPPER(NEW.status) na comparação para aceitar qualquer caixa
--          e também mapear variantes comuns (pending, paid, cancelled etc.)
--
-- Execute no Supabase → SQL Editor (pode rodar N vezes, é idempotente)
-- ============================================================

CREATE OR REPLACE FUNCTION sync_order_to_event_orders()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_status TEXT;
  v_cancelled_at TIMESTAMPTZ;
BEGIN

  -- Mapeia status do Flutter (qualquer caixa) → status do MRM
  v_status := CASE UPPER(COALESCE(NEW.status, ''))
    WHEN 'PAID'                  THEN 'PAGO'
    WHEN 'PENDING_PAYMENT'       THEN 'AGUARDANDO_PAGAMENTO'
    WHEN 'PENDING'               THEN 'AGUARDANDO_PAGAMENTO'
    WHEN 'CANCELLED'             THEN 'CANCELADO'
    WHEN 'CANCELED'              THEN 'CANCELADO'
    WHEN 'REFUNDED'              THEN 'REEMBOLSADO'
    WHEN 'EXPIRED'               THEN 'EXPIRADO'
    WHEN 'REQUESTING_REFUND'     THEN 'SOLICITANDO_REEMBOLSO'
    ELSE                              'AGUARDANDO_PAGAMENTO'
  END;

  v_cancelled_at := CASE
    WHEN UPPER(COALESCE(NEW.status, '')) IN ('CANCELLED', 'CANCELED')
    THEN COALESCE(NEW.updated_at, NOW())
    ELSE NULL
  END;

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
      v_status,
      NEW.notes,
      NEW.created_at,
      NEW.updated_at,
      v_cancelled_at
    )
    ON CONFLICT (id) DO UPDATE SET
      status       = EXCLUDED.status,
      updated_at   = EXCLUDED.updated_at,
      cancelled_at = EXCLUDED.cancelled_at,
      total        = EXCLUDED.total,
      subtotal     = EXCLUDED.subtotal;

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
      status           = v_status,
      notas            = NEW.notes,
      updated_at       = NEW.updated_at,
      cancelled_at     = v_cancelled_at
    WHERE id = NEW.id;

  ELSIF TG_OP = 'DELETE' THEN
    UPDATE event_orders SET
      status       = 'CANCELADO',
      updated_at   = NOW(),
      cancelled_at = NOW()
    WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

-- Recriar o trigger (DROP + CREATE para garantir)
DROP TRIGGER IF EXISTS trg_sync_order_to_event_orders ON orders;

CREATE TRIGGER trg_sync_order_to_event_orders
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW
EXECUTE FUNCTION sync_order_to_event_orders();

-- ──────────────────────────────────────────────────────────────
-- Corrigir pedidos existentes que ficaram com status errado
-- (re-sincroniza todos os registros da tabela orders)
-- ──────────────────────────────────────────────────────────────
UPDATE event_orders eo
SET
  status = CASE UPPER(COALESCE(o.status, ''))
    WHEN 'PAID'              THEN 'PAGO'
    WHEN 'PENDING_PAYMENT'   THEN 'AGUARDANDO_PAGAMENTO'
    WHEN 'PENDING'           THEN 'AGUARDANDO_PAGAMENTO'
    WHEN 'CANCELLED'         THEN 'CANCELADO'
    WHEN 'CANCELED'          THEN 'CANCELADO'
    WHEN 'REFUNDED'          THEN 'REEMBOLSADO'
    WHEN 'EXPIRED'           THEN 'EXPIRADO'
    WHEN 'REQUESTING_REFUND' THEN 'SOLICITANDO_REEMBOLSO'
    ELSE                          'AGUARDANDO_PAGAMENTO'
  END,
  total      = o.total,
  subtotal   = o.total,
  updated_at = o.updated_at,
  cancelled_at = CASE
    WHEN UPPER(COALESCE(o.status, '')) IN ('CANCELLED', 'CANCELED')
    THEN COALESCE(o.updated_at, NOW())
    ELSE NULL
  END
FROM orders o
WHERE eo.id = o.id;

-- Verificação rápida:
-- SELECT o.status as status_flutter, eo.status as status_mrm, eo.total
-- FROM orders o JOIN event_orders eo ON eo.id = o.id
-- ORDER BY o.created_at DESC LIMIT 20;
