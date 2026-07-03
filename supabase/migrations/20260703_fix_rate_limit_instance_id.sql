-- Correção: whatsapp_instance_rate_limit.instance_id era uuid (FK), mas todo o
-- código (enforceRateLimit em whatsappSendService e a rota /api/whatsapp/send)
-- grava o instance_id TEXTO da Z-API. O upsert falhava silenciosamente e o
-- rate limit nunca era persistido. Passa a coluna para text, alinhada ao código.
ALTER TABLE whatsapp_instance_rate_limit
  DROP CONSTRAINT IF EXISTS whatsapp_instance_rate_limit_instance_id_fkey;

ALTER TABLE whatsapp_instance_rate_limit
  ALTER COLUMN instance_id TYPE text USING instance_id::text;
