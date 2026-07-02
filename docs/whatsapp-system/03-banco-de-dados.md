# 03 - Banco de Dados do WhatsApp

A estrutura principal está em [supabase/migrations/20260606_whatsapp_module.sql](../../supabase/migrations/20260606_whatsapp_module.sql).

## Modelo Relacional

```text
whatsapp_instances
  1:N whatsapp_conversations
        1:N whatsapp_messages
  1:N whatsapp_instance_users
  1:1 whatsapp_instance_rate_limit
```

## Tabelas

### `whatsapp_instances`

Armazena cada instância conectada a uma conta/número Z-API.

Campos:

- `id` uuid, PK.
- `name` text, nome amigável exibido na UI.
- `instance_id` text, ID da instância no painel Z-API.
- `token` text, token da instância.
- `client_token` text, token de segurança enviado no header `Client-Token`.
- `status` text, padrão `disconnected`.
- `owner_user_id` text, ID do usuário dono.
- `webhook_url` text, reservado para URL de webhook.
- `phone_number` text, preenchido quando a Z-API retorna número conectado.
- `is_active` boolean, padrão `true`.
- `metadata` jsonb, padrão `{}`.
- `created_at`, `updated_at`.

Índice:

- `idx_whatsapp_instances_owner` em `owner_user_id`.

### `whatsapp_conversations`

Mantém uma conversa por par `instance_id + phone`.

Campos:

- `id` uuid, PK.
- `instance_id` uuid, FK para `whatsapp_instances(id)` com cascade.
- `phone` text, número normalizado.
- `contact_name` text.
- `status` text, padrão `open`.
- `ai_enabled` boolean, padrão `false`.
- `assigned_to` text.
- `owner_user_id` text.
- `last_message_at` timestamptz.
- `last_message` text.
- `unread_count` integer, padrão `0`.
- `metadata` jsonb, padrão `{}`.
- `created_at`, `updated_at`.

Constraints e índices:

- `UNIQUE(instance_id, phone)`.
- `idx_whatsapp_conversations_instance`.
- `idx_whatsapp_conversations_last_message`.
- `idx_whatsapp_conversations_owner`.

Status usados no código:

- Tipos TypeScript: `open`, `closed`, `pending`.
- UI e documentação antiga também mencionam `archived`, mas o tipo atual não inclui `archived`.

### `whatsapp_messages`

Histórico das mensagens inbound e outbound.

Campos:

- `id` uuid, PK.
- `conversation_id` uuid, FK para `whatsapp_conversations(id)` com cascade.
- `content` text.
- `type` text, padrão `text`.
- `direction` text, obrigatório: `inbound` ou `outbound`.
- `status` text, padrão `pending`.
- `sender_name` text.
- `media_url` text.
- `media_mime_type` text.
- `metadata` jsonb, padrão `{}`.
- `created_at`, `updated_at`.

Índice:

- `idx_whatsapp_messages_conversation` em `(conversation_id, created_at DESC)`.

Tipos de mensagem usados:

- `text`
- `image`
- `document`
- `audio`
- `video`
- `sticker`
- `link`

Status usados:

- `pending`
- `sent`
- `delivered`
- `read`
- `failed`
- `deleted` usado pela rota de exclusão, embora não esteja no union TypeScript atual.

Metadados relevantes:

- `zapi_message_id`: usado para atualizar status por callback.
- `reactions`: objeto com contagem de reações.
- `reply_to_id`, `reply_to_content`, `reply_to_sender`: usados em respostas no inbox.

### `whatsapp_instance_rate_limit`

Controla o último envio por instância.

Campos:

- `instance_id` uuid, PK/FK para `whatsapp_instances(id)` com cascade.
- `last_sent_at` timestamptz.

Observação: no serviço server-side existe função `enforceRateLimit`; na rota `/api/whatsapp/send` há também um `sleep(5000)` antes da chamada externa.

### `whatsapp_instance_users`

Relaciona usuários autorizados a uma instância.

Campos:

- `id` uuid, PK.
- `instance_id` uuid, FK para `whatsapp_instances(id)` com cascade.
- `user_id` text.
- `added_by` text.
- `created_at`.

Constraints e índices:

- `UNIQUE(instance_id, user_id)`.
- `idx_whatsapp_instance_users_instance`.
- `idx_whatsapp_instance_users_user`.

## Realtime

A migração adiciona ao `supabase_realtime`:

- `whatsapp_conversations`
- `whatsapp_messages`

Uso no frontend:

- `useWhatsAppConversations` escuta `INSERT` e `UPDATE` em conversas.
- `useWhatsAppMessages` escuta `INSERT` e `UPDATE` em mensagens filtradas pela conversa aberta.

## Pontos de Atenção

- A migração não cria políticas RLS para essas tabelas. O acesso das rotas ocorre via `supabaseAdmin` e validação em aplicação.
- Credenciais Z-API ficam no banco; nunca retornar `token` ou `client_token` para o frontend.
- Cascades removem conversas e mensagens ao apagar instância.
- `owner_user_id` é `text` e não tem FK Prisma, por decisão registrada na própria migração.
