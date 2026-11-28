CREATE INDEX IF NOT EXISTS whatsapp_messages_meta_saida_created_idx
  ON whatsapp_messages (created_at) INCLUDE (conversation_id)
  WHERE direction = 'outbound' AND (metadata->>'meta_message_id') IS NOT NULL;
CREATE INDEX IF NOT EXISTS whatsapp_messages_meta_message_id_idx
  ON whatsapp_messages ((metadata->>'meta_message_id'))
  WHERE (metadata->>'meta_message_id') IS NOT NULL;
CREATE INDEX IF NOT EXISTS pastoral_journey_sends_instance_sent_idx
  ON pastoral_journey_sends (instance_id, sent_at) WHERE status = 'sent';
CREATE INDEX IF NOT EXISTS wa_campaign_recipients_instance_sent_idx
  ON whatsapp_campaign_recipients (instance_id, sent_at) WHERE status = 'sent';
