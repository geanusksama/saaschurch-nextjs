# Sumário para Outra IA

Use este resumo quando precisar passar contexto rápido para outro agente.

## Contexto

O projeto tem um módulo WhatsApp em Next.js App Router integrado à Z-API. A documentação consolidada está em `docs/whatsapp-system/`. O código real fica principalmente em `src/app/api/whatsapp/*`, `src/lib/whatsappSendService.ts`, `src/types/whatsapp.ts`, hooks `src/hooks/useWhatsApp*.ts` e telas `src/components/app-ui-screens/communication/*`.

## Arquitetura

- Provedor externo: Z-API (`https://api.z-api.io`).
- Banco/storage/realtime: Supabase.
- UI: React/Next.js com hooks próprios.
- Auth interna: rotas usam `withAuth`; webhook é público e defensivo.
- Credenciais Z-API ficam em `whatsapp_instances`, não em env global nem no frontend.

## Tabelas

- `whatsapp_instances`: instâncias Z-API, credenciais, status, owner.
- `whatsapp_conversations`: conversa por instância e telefone.
- `whatsapp_messages`: histórico inbound/outbound.
- `whatsapp_instance_rate_limit`: último envio por instância.
- `whatsapp_instance_users`: usuários autorizados a visualizar/usar instância compartilhada.

Migração: `supabase/migrations/20260606_whatsapp_module.sql`.

## Rotas Críticas

- `POST /api/whatsapp/webhook`: recebe inbound e callbacks; sempre retorna 200.
- `POST /api/whatsapp/send`: envia mensagem pelo inbox; cria pending, espera 5s, chama Z-API e atualiza status.
- `POST /api/whatsapp/upload`: salva mídia no bucket `dados/whatsapp`.
- `GET/POST /api/whatsapp/instances`: lista/cria instâncias.
- `GET/PATCH/DELETE /api/whatsapp/instances/[id]`: status, QR Code, disconnect/restart, edição, exclusão.
- `GET/POST /api/whatsapp/conversations`: lista/cria conversas.
- `PATCH/DELETE /api/whatsapp/conversations/[id]`: status, leitura, assigned, nome, remoção.
- `GET /api/whatsapp/messages`: pagina mensagens.
- `PATCH/DELETE /api/whatsapp/messages/[id]`: reação e soft delete.

## Regras que Não Podem Ser Quebradas

- Não expor `token` ou `client_token` para o frontend.
- Não remover `fromMe=true` no webhook.
- Não processar grupos `@g.us` sem decisão explícita.
- Não reduzir o rate limit de 5 segundos sem revisar risco de bloqueio.
- Webhook deve retornar 200 mesmo em erro.
- `metadata.zapi_message_id` é necessário para callbacks de entrega/leitura.
- Conversa é identificada por `instance_id + phone`.

## Fluxos

- Inbound: Z-API -> webhook -> busca instância -> normaliza telefone -> cria/busca conversa -> insere mensagem -> atualiza unread/last_message -> Realtime.
- Outbound inbox: UI -> `/send` -> pending -> espera 5s -> Z-API -> sent/failed -> last_message -> Realtime.
- Outbound programático: módulo interno -> `quickSendWhatsApp` -> busca instância conectada -> Z-API -> garante conversa -> persiste mensagem.
- Status: Z-API callback -> webhook -> atualiza mensagem por `metadata.zapi_message_id`.

## Pendências Técnicas Conhecidas

- `MessageStatus` TypeScript não inclui `deleted`, mas a rota usa.
- `ConversationStatus` TypeScript não inclui `archived`, mas a UI tem ação de arquivar.
- Algumas rotas reconhecem instâncias autorizadas na listagem, mas ações de conversa/envio ainda dependem de `owner_user_id`.
- Migração não define RLS; isolamento está nas rotas com `withAuth`.
