# 01 - Arquitetura do Módulo WhatsApp

## Visão Geral

O módulo WhatsApp é uma integração server-side com a Z-API. O frontend nunca recebe token, client token ou credenciais sensíveis da Z-API. Essas credenciais ficam salvas em `whatsapp_instances` e são usadas apenas por rotas de backend ou serviços server-side.

## Componentes

### Entrada

- `POST /api/whatsapp/webhook`: webhook público chamado pela Z-API.
- Rotas internas em `/api/whatsapp/*`: usadas pela UI e por módulos do sistema.

### Aplicação

- [src/lib/whatsappSendService.ts](../../src/lib/whatsappSendService.ts): serviço de alto nível para envio programático, usado por módulos como pastoral, membro, Peniel, aniversariantes e recibos.
- [src/app/api/whatsapp/send/route.ts](../../src/app/api/whatsapp/send/route.ts): envio a partir do inbox.
- [src/app/api/whatsapp/webhook/route.ts](../../src/app/api/whatsapp/webhook/route.ts): persistência de inbound e callbacks de status.

### Persistência

- Supabase Postgres: instâncias, conversas, mensagens, permissões e rate limit.
- Supabase Storage: bucket `dados`, pasta lógica `whatsapp/`, para arquivos enviados pelo inbox.
- Supabase Realtime: tabelas `whatsapp_conversations` e `whatsapp_messages`.

### Interface

- [WhatsAppInbox.tsx](../../src/components/app-ui-screens/communication/WhatsAppInbox.tsx): inbox, lista de conversas, timeline, anexos, reações, respostas, encaminhamento e gravação/upload de áudio.
- [WhatsAppInstances.tsx](../../src/components/app-ui-screens/communication/WhatsAppInstances.tsx): cadastro de instâncias, QR Code, status, desconexão e usuários autorizados.
- Hooks:
  - [useWhatsAppConversations.ts](../../src/hooks/useWhatsAppConversations.ts)
  - [useWhatsAppMessages.ts](../../src/hooks/useWhatsAppMessages.ts)
  - [useWhatsAppInstances.ts](../../src/hooks/useWhatsAppInstances.ts)

## Fluxo Arquitetural

1. O usuário abre a tela de WhatsApp.
2. O frontend lê `mrm_token` do `localStorage` e chama rotas internas com `Authorization: Bearer`.
3. As rotas usam `withAuth` para validar usuário e escopo.
4. As rotas consultam o Supabase via `supabaseAdmin`.
5. Quando necessário, o backend chama a Z-API com `instance_id`, `token` e `client_token`.
6. O webhook recebe mensagens inbound e callbacks da Z-API.
7. O webhook cria ou atualiza conversas e insere mensagens.
8. Supabase Realtime atualiza a lista de conversas e a timeline aberta.

## Decisões Importantes

- A integração usa Z-API, não a API oficial da Meta.
- A URL base da Z-API está hardcoded como `https://api.z-api.io`.
- O webhook deve retornar `200` sempre, inclusive em erro, para evitar retries indevidos da Z-API.
- Mensagens `fromMe=true` são ignoradas no webhook para evitar loop.
- Mensagens de grupo são ignoradas quando `phone` termina com `@g.us`.
- O rate limit mínimo é 5 segundos por instância. Não reduzir sem avaliar risco de bloqueio do número.
- `GET /api/whatsapp/instances` lista instâncias próprias e autorizadas; ações administrativas em `/instances/[id]` exigem propriedade da instância no código atual.

## Integrações Internas que Usam WhatsApp

Além do inbox, há módulos que reutilizam [whatsappSendService.ts](../../src/lib/whatsappSendService.ts):

- `src/app/api/whatsapp/send-birthday/route.ts`
- `src/app/api/whatsapp/send-tithe-receipt/route.ts`
- `src/app/api/membro/send-otp/route.ts`
- `src/app/api/pastoral/notify*.ts`
- `src/app/api/peniel/*`, via [src/lib/penielTicket.ts](../../src/lib/penielTicket.ts)

Esses fluxos geralmente usam `quickSendWhatsApp`, `sendTextViaZApi`, `sendImageViaZApi` ou `sendDocumentViaZApi`.
