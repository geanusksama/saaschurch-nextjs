-- Associação de usuários autorizados por instância WhatsApp
-- Isolamento: apenas usuários listados aqui podem usar o número

CREATE TABLE IF NOT EXISTS whatsapp_instance_users (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id  uuid REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  user_id      text NOT NULL,  -- ID do User (Prisma)
  added_by     uuid,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(instance_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_instance_users_instance
  ON whatsapp_instance_users(instance_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_instance_users_user
  ON whatsapp_instance_users(user_id);
