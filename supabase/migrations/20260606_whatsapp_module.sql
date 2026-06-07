-- WhatsApp Module (Z-API) — MRM SaasChurch
-- owner_user_id é text (UUID do usuário Prisma) — sem FK para não depender do schema Prisma

CREATE TABLE IF NOT EXISTS whatsapp_instances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  instance_id     text,
  token           text,
  client_token    text,
  status          text DEFAULT 'disconnected',
  owner_user_id   text NOT NULL,
  webhook_url     text,
  phone_number    text,
  is_active       boolean DEFAULT true,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_instances_owner
  ON whatsapp_instances(owner_user_id);

CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id     uuid REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  phone           text NOT NULL,
  contact_name    text,
  status          text DEFAULT 'open',
  ai_enabled      boolean DEFAULT false,
  assigned_to     text,
  owner_user_id   text NOT NULL,
  last_message_at timestamptz,
  last_message    text,
  unread_count    integer DEFAULT 0,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE(instance_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_instance
  ON whatsapp_conversations(instance_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_last_message
  ON whatsapp_conversations(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_owner
  ON whatsapp_conversations(owner_user_id);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  content         text,
  type            text DEFAULT 'text',
  direction       text NOT NULL CHECK (direction IN ('inbound','outbound')),
  status          text DEFAULT 'pending',
  sender_name     text,
  media_url       text,
  media_mime_type text,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation
  ON whatsapp_messages(conversation_id, created_at DESC);

CREATE TABLE IF NOT EXISTS whatsapp_instance_rate_limit (
  instance_id   uuid REFERENCES whatsapp_instances(id) ON DELETE CASCADE PRIMARY KEY,
  last_sent_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS whatsapp_instance_users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id  uuid REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  user_id      text NOT NULL,
  added_by     text,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(instance_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_instance_users_instance
  ON whatsapp_instance_users(instance_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_instance_users_user
  ON whatsapp_instance_users(user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE whatsapp_messages;
