# 05 - Fluxos Principais

## 1. Cadastrar e Conectar Instância

1. Usuário abre a tela de instâncias.
2. Frontend chama `GET /api/whatsapp/instances`.
3. Usuário cadastra `name`, `instance_id`, `token` e `client_token`.
4. Frontend chama `POST /api/whatsapp/instances`.
5. Banco cria instância com `status = disconnected`.
6. Usuário solicita QR Code.
7. Frontend chama `GET /api/whatsapp/instances/[id]?action=qr-code`.
8. Backend chama Z-API `/qr-code`.
9. Banco atualiza `status = qr_code`.
10. UI mostra QR Code e faz polling de status a cada 3 segundos.
11. Ao conectar, `GET action=status` atualiza `status = connected` e `phone_number`.

## 2. Receber Mensagem Inbound

1. Contato envia mensagem para o número conectado.
2. Z-API chama `POST /api/whatsapp/webhook`.
3. Webhook descarta:
   - mensagens `fromMe=true`;
   - payload sem `instanceId`;
   - mensagens de grupo `@g.us`.
4. Webhook localiza `whatsapp_instances` por `instance_id = payload.instanceId`.
5. Telefone é normalizado.
6. Webhook busca conversa por `instance_id + phone`.
7. Se não existir, cria conversa `status = open`.
8. Webhook detecta tipo: texto, imagem, documento, áudio, vídeo ou sticker.
9. Insere registro em `whatsapp_messages` com:
   - `direction = inbound`;
   - `status = delivered`;
   - `metadata.zapi_message_id`.
10. Atualiza conversa:
   - `last_message`;
   - `last_message_at`;
   - `unread_count + 1`;
   - `updated_at`.
11. Supabase Realtime atualiza inbox e timeline.

## 3. Enviar Mensagem pelo Inbox

1. Usuário seleciona uma conversa.
2. UI carrega mensagens por `GET /api/whatsapp/messages`.
3. Usuário digita ou anexa mídia.
4. Para mídia, UI primeiro chama `POST /api/whatsapp/upload`.
5. UI chama `POST /api/whatsapp/send`.
6. Backend valida conversa e instância.
7. Backend insere mensagem outbound com `status = pending`.
8. Backend aguarda 5 segundos.
9. Backend chama endpoint Z-API adequado:
   - texto: `/send-text`;
   - imagem: `/send-image`;
   - documento: `/send-document/{ext}`;
   - vídeo: `/send-video`;
   - áudio: `/send-audio`.
10. Backend atualiza mensagem para `sent` ou `failed`.
11. Se houver ID externo, salva `metadata.zapi_message_id`.
12. Atualiza `last_message`, `last_message_at` e `whatsapp_instance_rate_limit`.
13. UI recebe a nova mensagem por Realtime.

## 4. Atualizar Status de Entrega

1. Z-API chama webhook com `DeliveryCallback` ou `MessageStatusCallback`.
2. Webhook lê `payload.messageId` e `payload.status`.
3. Converte status para padrão interno.
4. Atualiza `whatsapp_messages.status` buscando por `metadata.zapi_message_id`.
5. Realtime atualiza ícone da mensagem no inbox.

## 5. Criar Conversa Manual

1. Usuário clica em nova conversa.
2. Escolhe instância e informa telefone.
3. Frontend chama `POST /api/whatsapp/conversations`.
4. Backend normaliza o telefone.
5. Backend valida que a instância pertence ao usuário.
6. Backend faz upsert por `instance_id + phone`.
7. UI seleciona a conversa criada.
8. Próximo envio usa o fluxo normal de envio.

## 6. Marcar Conversa como Lida

1. Usuário seleciona conversa no inbox.
2. Hook chama `PATCH /api/whatsapp/conversations/[id]`.
3. Body contém `{ "unread_count": 0 }`.
4. Backend valida escopo da conversa.
5. Banco atualiza `unread_count`.
6. Realtime reflete contador zerado.

## 7. Encerrar e Reabrir Conversa

Encerrar:

```json
{
  "status": "closed"
}
```

Reabrir:

```json
{
  "status": "open"
}
```

O composer bloqueia envio quando a conversa está encerrada e mostra ação para reabrir.

## 8. Reagir e Excluir Mensagem

Reação:

1. UI chama `PATCH /api/whatsapp/messages/[id]`.
2. Body contém a reação.
3. Backend alterna contagem em `metadata.reactions`.

Exclusão:

1. UI chama `DELETE /api/whatsapp/messages/[id]`.
2. Backend define `status = deleted` e `content = null`.
3. UI mostra "Mensagem excluída".

## 9. Envio Programático por Outros Módulos

Fluxo típico via `quickSendWhatsApp`:

1. Módulo informa `ownerUserId`, `phone`, `message` e opcionalmente `instanceId`, `imageUrl` ou `documentUrl`.
2. Serviço busca instância conectada:
   - por `instanceId`, se informado;
   - ou primeira instância ativa/conectada do owner;
   - `master` pode usar qualquer instância conectada.
3. Serviço normaliza telefone.
4. Serviço chama Z-API respeitando rate limit.
5. Serviço garante conversa com `ensureConversation`.
6. Serviço persiste outbound com `persistOutboundMessage`.

Esse padrão é usado em automações como OTP, notificações pastorais, Peniel e recibos.
