# 02 - APIs e Endpoints do WhatsApp

Todas as rotas internas, exceto o webhook, usam `withAuth` e esperam `Authorization: Bearer {mrm_token}`.

## Instâncias

### GET `/api/whatsapp/instances`

Lista instâncias disponíveis para o usuário autenticado.

- `master`: vê todas as instâncias.
- demais usuários: veem instâncias próprias e instâncias autorizadas em `whatsapp_instance_users`.
- Não retorna `token` nem `client_token`.

Campos retornados: `id`, `name`, `instance_id`, `status`, `phone_number`, `is_active`, `created_at`, `updated_at`.

### POST `/api/whatsapp/instances`

Cria uma instância Z-API.

Body:

```json
{
  "name": "Secretaria",
  "instance_id": "INSTANCE_ID_ZAPI",
  "token": "TOKEN_ZAPI",
  "client_token": "CLIENT_TOKEN_ZAPI"
}
```

Regras:

- Campos obrigatórios: `name`, `instance_id`, `token`, `client_token`.
- Define `owner_user_id` como o usuário logado.
- Cria com `status = disconnected` e `is_active = true`.

### GET `/api/whatsapp/instances/[id]?action=status`

Consulta status na Z-API.

Efeitos:

- Chama `/status` da Z-API.
- Atualiza `whatsapp_instances.status`.
- Atualiza `phone_number` quando a Z-API retornar esse campo.

### GET `/api/whatsapp/instances/[id]?action=qr-code`

Busca QR Code na Z-API.

Efeitos:

- Chama `/qr-code` da Z-API.
- Atualiza `status = qr_code`.
- Retorna `{ qrCode }`.

### PATCH `/api/whatsapp/instances/[id]`

Atualiza dados simples ou executa ação de lifecycle.

Body para edição:

```json
{
  "name": "Novo nome",
  "is_active": true
}
```

Body para ação:

```json
{
  "action": "disconnect"
}
```

Ações aceitas: `disconnect`, `restart`.

### DELETE `/api/whatsapp/instances/[id]`

Remove a instância do proprietário. Como o banco usa cascade, conversas, mensagens, permissões e rate limit ligados à instância são removidos.

## Usuários Autorizados

### GET `/api/whatsapp/instances/[id]/users`

Lista `user_id` e `created_at` dos usuários autorizados a uma instância. Apenas o dono da instância acessa essa rota.

### POST `/api/whatsapp/instances/[id]/users`

Autoriza um usuário.

```json
{
  "user_id": "uuid-ou-id-do-usuario"
}
```

Usa upsert com conflito em `instance_id,user_id`.

### DELETE `/api/whatsapp/instances/[id]/users?userId=...`

Remove a autorização do usuário informado.

## Conversas

### GET `/api/whatsapp/conversations?instanceId=&status=&search=`

Lista até 100 conversas, ordenadas por `last_message_at` decrescente.

Filtros:

- `instanceId`: filtra por instância.
- `status`: exemplo `open` ou `closed`.
- `search`: busca em `phone`, `contact_name` e `last_message`.

Escopo:

- `master`: vê todas.
- demais usuários: filtrados por `owner_user_id`.

### POST `/api/whatsapp/conversations`

Cria ou atualiza uma conversa manual.

```json
{
  "instance_id": "uuid-da-instancia-no-banco",
  "phone": "+55 (19) 99999-0000",
  "contact_name": "Maria"
}
```

Regras:

- `instance_id` e `phone` são obrigatórios.
- O telefone é normalizado com remoção de tudo que não for número.
- Usa upsert por `instance_id,phone`.
- No código atual, exige que a instância pertença ao usuário.

### PATCH `/api/whatsapp/conversations/[id]`

Atualiza campos controlados:

- `status`
- `ai_enabled`
- `assigned_to`
- `unread_count`
- `contact_name`

É usado para marcar como lida, encerrar, reabrir e editar metadados simples de atendimento.

### DELETE `/api/whatsapp/conversations/[id]`

Remove a conversa do proprietário. As mensagens são removidas por cascade.

## Mensagens

### GET `/api/whatsapp/messages?conversationId=&limit=50&offset=0`

Carrega mensagens de uma conversa em ordem crescente por `created_at`.

Regras:

- `conversationId` é obrigatório.
- `limit` máximo: 200.
- Retorna `{ messages, total, hasMore }`.
- `master` vê todas; demais usuários precisam ser donos da conversa.

### PATCH `/api/whatsapp/messages/[id]`

Alterna reação em `metadata.reactions`.

```json
{
  "reaction": "👍"
}
```

### DELETE `/api/whatsapp/messages/[id]`

Soft delete:

- `status = deleted`
- `content = null`

## Envio e Upload

### POST `/api/whatsapp/send`

Envia mensagem outbound a partir do inbox.

Body base:

```json
{
  "conversationId": "uuid-da-conversa",
  "content": "A paz do Senhor!",
  "type": "text"
}
```

Body com mídia:

```json
{
  "conversationId": "uuid-da-conversa",
  "content": "Segue o arquivo",
  "type": "document",
  "mediaUrl": "https://...",
  "fileName": "documento.pdf"
}
```

Tipos suportados na rota: `text`, `image`, `document`, `video`, `audio`.

Efeitos:

1. Valida conversa e instância.
2. Insere mensagem outbound com `status = pending`.
3. Aguarda 5 segundos.
4. Chama o endpoint correspondente da Z-API.
5. Atualiza mensagem para `sent` ou `failed`.
6. Salva `metadata.zapi_message_id` quando a Z-API retorna ID.
7. Atualiza `last_message` e `last_message_at` da conversa.
8. Atualiza `whatsapp_instance_rate_limit`.

### POST `/api/whatsapp/upload`

Recebe `multipart/form-data` com campo `file`.

Regras:

- Tamanho máximo: 16 MB.
- Salva no bucket `dados`, caminho `whatsapp/{timestamp-random}.{ext}`.
- Retorna `url`, `fileName` original e `mimeType`.

### POST `/api/whatsapp/webhook`

Webhook público da Z-API.

Comportamento:

- Retorna `200` sempre.
- Ignora payload inválido sem `instanceId`.
- Ignora `fromMe=true`.
- Ignora grupos `@g.us`.
- Para `DeliveryCallback` ou `MessageStatusCallback`, atualiza status da outbound por `metadata->>zapi_message_id`.
- Para mensagem inbound, localiza instância por `instance_id`, normaliza telefone, cria conversa se necessário e insere mensagem.

Payload inbound típico:

```json
{
  "instanceId": "INSTANCE_ID_ZAPI",
  "messageId": "MSG_ID_ZAPI",
  "phone": "5511999990001@s.whatsapp.net",
  "fromMe": false,
  "type": "text",
  "senderName": "Maria",
  "text": {
    "message": "Olá"
  }
}
```

## Endpoints Externos da Z-API

O projeto chama:

- `POST https://api.z-api.io/instances/{instance_id}/token/{token}/send-text`
- `POST https://api.z-api.io/instances/{instance_id}/token/{token}/send-image`
- `POST https://api.z-api.io/instances/{instance_id}/token/{token}/send-document/{ext}`
- `POST https://api.z-api.io/instances/{instance_id}/token/{token}/send-video`
- `POST https://api.z-api.io/instances/{instance_id}/token/{token}/send-audio`
- `GET https://api.z-api.io/instances/{instance_id}/token/{token}/status`
- `GET https://api.z-api.io/instances/{instance_id}/token/{token}/qr-code`
- `POST https://api.z-api.io/instances/{instance_id}/token/{token}/disconnect`
- `POST https://api.z-api.io/instances/{instance_id}/token/{token}/restart`

Todas as chamadas enviam header `Client-Token`.
