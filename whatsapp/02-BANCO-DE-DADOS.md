# 02 — Banco de Dados — WhatsApp

## Tabela: whatsapp_instances

```sql
CREATE TABLE whatsapp_instances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,              -- "Vendas", "Suporte", etc.
  instance_id     text,                       -- ID Z-API da instância
  token           text,                       -- Token Z-API
  client_token    text,                       -- Header Client-Token Z-API
  status          text DEFAULT 'disconnected',-- connected/disconnected/connecting/qr_code
  owner_user_id   uuid REFERENCES profiles(id),
  webhook_url     text,                       -- URL do webhook configurado
  phone_number    text,                       -- Número conectado (pós-QR)
  is_active       boolean DEFAULT true,
  metadata        jsonb DEFAULT '{}',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
```

**RLS**: `owner_user_id = auth.uid()` OU usuário pertence ao mesmo tenant do owner.

---

## Tabela: whatsapp_conversations

```sql
CREATE TABLE whatsapp_conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id      uuid REFERENCES contacts(id),      -- nullable
  instance_id     uuid REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  phone           text NOT NULL,                     -- DDI+número: "5511999990001"
  status          text DEFAULT 'open',               -- open/closed/pending
  ai_enabled      boolean DEFAULT false,             -- ativa resposta IA
  assigned_to     uuid REFERENCES profiles(id),      -- vendedor responsável
  owner_user_id   uuid REFERENCES profiles(id),
  last_message_at timestamptz,
  last_message    text,                              -- preview da última mensagem
  unread_count    integer DEFAULT 0,
  metadata        jsonb DEFAULT '{}',                -- ver campos abaixo
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
```

**metadata JSONB importante**:
```json
{
  "sticky_agent_id": "uuid-do-ultimo-agente-que-respondeu",
  "ai_last_inbound_hash": "hash-sha256-da-ultima-mensagem",
  "ai_last_inbound_at": "2024-01-15T14:30:00.000Z",
  "ai_last_inbound_message_id": "3EB0C5A1B2C3D4E5"
}
```

**RLS**: baseado em `owner_user_id` com herança de tenant.
**Realtime**: habilitado para INSERT e UPDATE.

---

## Tabela: whatsapp_messages

```sql
CREATE TABLE whatsapp_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  content         text,                              -- texto da mensagem
  type            text DEFAULT 'text',               -- text/image/document/audio/video/sticker
  direction       text NOT NULL,                     -- inbound/outbound
  status          text DEFAULT 'pending',            -- pending/sent/delivered/read/failed
  sender_name     text,                              -- nome do remetente (inbound)
  media_url       text,                              -- URL da mídia
  media_mime_type text,                              -- MIME type
  metadata        jsonb DEFAULT '{}',                -- ver campos abaixo
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
```

**metadata JSONB importante**:
```json
{
  "zapi_message_id": "3EB0C5A1B2C3D4E5",
  "zapi_instance_id": "inst_abc123",
  "is_ai_response": true,
  "agent_id": "uuid-do-agente",
  "reply_to_message_id": "uuid-msg-pai",
  "transcription": "texto transcrito do áudio"
}
```

**Realtime**: habilitado para INSERT.

---

## Tabela: ai_agent_audit_log

```sql
CREATE TABLE ai_agent_audit_log (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id                  text,           -- formato: "aiar_{timestamp}_{uuid}"
  conversation_id           uuid REFERENCES whatsapp_conversations(id),
  tenant_id                 uuid,
  instance_id               uuid,
  agent_id                  uuid REFERENCES ai_agents(id),
  agent_name                text,
  conversation_assigned_to  uuid,
  action                    text,           -- responded/blocked/skipped/error
  reason                    text,           -- vendor_match/admin_agent_blocked/tenant_mismatch/...
  details                   jsonb,          -- tokens, prompt, resposta, custo
  created_at                timestamptz DEFAULT now()
);
```

---

## Tabela: whatsapp_instance_rate_limit

```sql
CREATE TABLE whatsapp_instance_rate_limit (
  instance_id   uuid REFERENCES whatsapp_instances(id) PRIMARY KEY,
  last_sent_at  timestamptz DEFAULT now()
);
```

Usado pelo `send-message` para controle de rate limit: antes de enviar, verifica se `now() - last_sent_at >= 5s`.

---

## Índices de Performance

```sql
-- Listagem de conversas por instância (ordenada por última mensagem)
CREATE INDEX idx_conversations_instance_id
  ON whatsapp_conversations(instance_id);

CREATE INDEX idx_conversations_last_message
  ON whatsapp_conversations(last_message_at DESC);

CREATE INDEX idx_conversations_owner
  ON whatsapp_conversations(owner_user_id);

-- Mensagens por conversa (ordenadas por criação)
CREATE INDEX idx_messages_conversation_id
  ON whatsapp_messages(conversation_id, created_at DESC);

-- Auditoria por conversa
CREATE INDEX idx_audit_conversation
  ON ai_agent_audit_log(conversation_id, created_at DESC);
```

---

## Delete Cascade

| Relação | Efeito |
|---------|--------|
| `whatsapp_instances` deletada | Remove todas as `whatsapp_conversations` da instância |
| `whatsapp_conversations` deletada | Remove todas as `whatsapp_messages` da conversa |

---

## Políticas RLS

### whatsapp_instances
```sql
-- SELECT/INSERT/UPDATE/DELETE: apenas o owner do tenant
CREATE POLICY "tenant_isolation" ON whatsapp_instances
  USING (owner_user_id = auth.uid()
    OR owner_user_id IN (
      SELECT owner_id FROM tenant_members WHERE user_id = auth.uid()
    ));
```

### whatsapp_conversations
```sql
-- Vendedor vê suas conversas atribuídas + todas as não atribuídas do tenant
CREATE POLICY "conversation_visibility" ON whatsapp_conversations
  USING (
    owner_user_id = auth.uid()
    OR assigned_to = auth.uid()
    OR (assigned_to IS NULL AND owner_user_id IN (
      SELECT owner_id FROM tenant_members WHERE user_id = auth.uid()
    ))
  );
```

### whatsapp_messages
```sql
-- Visibilidade via conversa pai
CREATE POLICY "message_via_conversation" ON whatsapp_messages
  USING (
    conversation_id IN (
      SELECT id FROM whatsapp_conversations
      WHERE owner_user_id = auth.uid()
         OR assigned_to = auth.uid()
    )
  );
```

---

## Migrations relevantes

```
supabase/migrations/
  20260318120000_remove_master_bypass_whatsapp_rls.sql
  20260318150000_whatsapp_per_user_visibility_rls.sql
  20260322113000_enforce_phone_dedup_contacts_whatsapp.sql
  20260420180000_add_metadata_to_whatsapp_conversations.sql
  20260420223000_add_owner_user_id_to_whatsapp_instances.sql
```

---

## Queries comuns

```sql
-- Buscar conversas abertas de um tenant, ordenadas por última mensagem
SELECT wc.*, wi.name as instance_name, wi.phone_number
FROM whatsapp_conversations wc
JOIN whatsapp_instances wi ON wi.id = wc.instance_id
WHERE wc.owner_user_id = $1
  AND wc.status = 'open'
ORDER BY wc.last_message_at DESC
LIMIT 50;

-- Buscar mensagens de uma conversa
SELECT * FROM whatsapp_messages
WHERE conversation_id = $1
ORDER BY created_at DESC
LIMIT 100;

-- Verificar se já existe conversa para esse phone+instância
SELECT id FROM whatsapp_conversations
WHERE instance_id = $1 AND phone = $2
LIMIT 1;
```
