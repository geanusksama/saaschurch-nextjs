# 04 - Configuração e Regras

## Variáveis de Ambiente

O módulo não usa variáveis `ZAPI_*` globais no código atual. As credenciais da Z-API são armazenadas por instância na tabela `whatsapp_instances`.

Variáveis necessárias indiretamente:

### Backend

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Usadas por [src/lib/supabase-admin.ts](../../src/lib/supabase-admin.ts), que alimenta as rotas server-side.

### Frontend

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Usadas por [src/lib/supabase-browser.ts](../../src/lib/supabase-browser.ts), principalmente para Supabase Realtime no browser.

## Configuração da Instância Z-API

Na UI de instâncias, cadastrar:

- Nome amigável.
- `instance_id` da Z-API.
- `token` da instância.
- `client_token` da Z-API.

Depois:

1. Obter QR Code pela ação da UI.
2. Escanear no WhatsApp do número.
3. Aguardar polling de status até `connected`.
4. Configurar webhook no painel Z-API:

```text
https://{dominio-do-sistema}/api/whatsapp/webhook
```

Eventos esperados:

- mensagens recebidas;
- callbacks de entrega/leitura, como `DeliveryCallback` ou `MessageStatusCallback`.

## Regras de Segurança

- O frontend nunca deve receber `token` nem `client_token`.
- O webhook é público, mas não grava nada se `instanceId` não existir no banco.
- Rotas internas usam `withAuth`.
- Usuário `master` tem leitura ampliada em algumas rotas.
- Proprietário da instância controla QR Code, status, desconexão, exclusão e usuários autorizados.
- Usuários autorizados aparecem na listagem de instâncias, mas o código atual não permite todas as ações administrativas em instância compartilhada.

## Regras de Mensageria

- Nunca remover o bloqueio de `fromMe=true` no webhook.
- Nunca processar grupos sem revisar escopo; hoje `@g.us` é ignorado.
- Número de telefone é normalizado removendo caracteres não numéricos.
- A chave funcional de conversa é `instance_id + phone`.
- Mensagem inbound incrementa `unread_count`.
- Abrir ou selecionar conversa pode zerar `unread_count` via PATCH.
- Exclusão de mensagem é soft delete, não remoção física.

## Rate Limit

Há duas proteções:

- `whatsappSendService.ts` usa `whatsapp_instance_rate_limit` para aguardar o intervalo restante por instância.
- `/api/whatsapp/send` aguarda sempre 5 segundos antes de enviar.

Regra crítica: não reduzir o intervalo de 5 segundos sem validar risco de bloqueio na Z-API/WhatsApp.

## Mídias e Upload

- Upload máximo: 16 MB.
- Bucket: `dados`.
- Caminho: `whatsapp/{arquivo}`.
- A URL pública retornada é enviada para a Z-API como `image`, `document`, `video` ou `audio`.
- Para documento, a rota de envio monta `/send-document/{ext}` a partir do `fileName`.

## Callbacks de Status

O webhook atualiza outbound quando recebe `DeliveryCallback` ou `MessageStatusCallback`.

Mapeamento:

- `SENT` -> `sent`
- `DELIVERED` -> `delivered`
- `READ` -> `read`
- `PLAYED` -> `read`
- demais status: `payload.status.toLowerCase()`

A busca é feita por:

```sql
metadata->>zapi_message_id = payload.messageId
```

## Divergências e Pendências Técnicas

- `ConversationStatus` em TypeScript não inclui `archived`, embora a UI tenha ação de arquivar em menus.
- `MessageStatus` em TypeScript não inclui `deleted`, embora a rota de exclusão use esse status.
- `/api/whatsapp/send` importa `sendTextViaZApi` e `persistOutboundMessage`, mas implementa envio diretamente na rota.
- A tabela não define RLS na migração; o isolamento está concentrado nas rotas com `withAuth` e `owner_user_id`.
- `whatsapp_instance_users` amplia listagem de instâncias, mas rotas de conversa e envio ainda usam `owner_user_id` em pontos importantes.

## Checklist de Setup

- Criar tabelas da migração `20260606_whatsapp_module.sql`.
- Garantir Supabase Realtime em `whatsapp_conversations` e `whatsapp_messages`.
- Configurar envs Supabase de frontend e backend.
- Cadastrar instância com credenciais Z-API.
- Configurar webhook da Z-API para `/api/whatsapp/webhook`.
- Testar QR Code e status.
- Testar envio de texto.
- Testar recebimento inbound.
- Testar callback de leitura/entrega.
- Testar upload de imagem/documento.
