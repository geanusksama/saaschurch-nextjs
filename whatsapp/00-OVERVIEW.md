# 00 — Overview do Sistema WhatsApp

## O que é

Módulo de integração WhatsApp do CRM Grupo SLS via **Z-API** (gateway WhatsApp Business). Permite que cada empresa (tenant) conecte múltiplos números WhatsApp, gerencie conversas com clientes em tempo real, e ative respostas automáticas via agentes de IA.

---

## Provedor

- **Z-API** — gateway WhatsApp Business (não é API oficial Meta)
- Funciona emulando sessão WhatsApp Web por QR code
- Endpoint base: `https://api.z-api.io`
- Docs: https://developer.z-api.io

---

## Stack técnica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Estado | TanStack Query + Supabase Realtime |
| Backend | Deno (Supabase Edge Functions) |
| Banco | PostgreSQL (Supabase) com RLS |
| IA | OpenAI GPT-4 (agentes) + Whisper (transcrição) |
| Auth | Supabase Auth (JWT) |
| Deploy | Vercel (frontend) + Supabase (backend) |

---

## Funcionalidades do módulo

### Instâncias
- Criar/deletar instâncias Z-API por tenant
- Conectar número via QR code (polling de status)
- Ver status (connected/disconnected/qr_code)
- Múltiplas instâncias por tenant (ilimitado)

### Conversas
- Criar conversa ao receber primeira mensagem de um número
- Vincular conversa a contato do CRM
- Atribuir conversa a vendedor (`assigned_to`)
- Fechar/reabrir conversas
- Filtrar por status, instância, vendedor

### Mensagens
- Enviar: texto, imagem, áudio, vídeo, documento, link
- Receber todos os tipos acima + sticker
- Status de entrega: pending → sent → delivered → read
- Realtime push via Supabase Realtime (sem polling)
- Histórico completo com scroll infinito

### IA Automática
- Ativar/desativar IA por conversa (`ai_enabled`)
- Configurar agente com system prompt personalizado
- Vendor isolation: agente do vendedor só responde suas conversas
- Sticky agent: continuidade de persona entre turnos
- Agrupamento de fragmentos (evita múltiplas respostas)
- Transcrição de áudio via Whisper
- Audit log de todas as ações do agente

### Integrações
- CRM: enviar WhatsApp direto de um deal
- Automações: disparar fluxo por palavra-chave ou primeira mensagem
- Notificações: alertar vendedor em nova mensagem inbound

---

## Responsabilidades por arquivo

```
supabase/functions/
  send-message/         → proxy Z-API para envio, rate limiting
  whatsapp-webhook/     → receptor de eventos da Z-API
  whatsapp-instance/    → gestão de lifecycle de instâncias
  ai-auto-response/     → resposta automática IA
  auto-activate-agent/  → ativa agente por regra

src/app/pages/admin/
  Chat.tsx                        → interface principal de chat
  WhatsAppInstances.tsx           → gestão de instâncias
  communication/CaixaDeEntradaPage.tsx → caixa de entrada unificada

src/app/services/
  whatsappChatService.ts          → orquestra envio + contexto de chat
  whatsappInstancesService.ts     → CRUD de instâncias (frontend)

src/services/
  whatsappService.ts              → utilitários compartilhados
  whatsappConversationService.ts  → CRUD de conversas (banco)
  whatsappMessageService.ts       → CRUD de mensagens (banco)
  whatsappInstanceService.ts      → acesso direto a instâncias (banco)

src/hooks/
  useWhatsAppConversations.ts     → lista + realtime de conversas
  useWhatsAppMessages.ts          → mensagens + realtime por conversa
  useWhatsAppInstances.ts         → lista instâncias do tenant

src/app/components/
  chat/ChatMessageInput.tsx       → input de mensagem na tela Chat
  crm/WhatsAppCompose.tsx         → composer WhatsApp dentro do CRM deal
```

---

## Modelo de dados resumido

```
whatsapp_instances         (1 instância = 1 número Z-API por tenant)
  └── whatsapp_conversations (1 conversa = 1 número de contato por instância)
        └── whatsapp_messages   (histórico completo de mensagens)

ai_agent_audit_log         (log forense de toda ação de agente IA)
```

---

## Pontos de entrada para o agente

Dependendo da tarefa, o ponto de entrada varia:

| Tarefa | Ponto de entrada |
|--------|-----------------|
| Enviar mensagem | `whatsappChatService.ts` → `send-message` |
| Receber mensagem | `whatsapp-webhook` → `webhook-handler` |
| Gestão de instância | `whatsappInstancesService.ts` → `whatsapp-instance` |
| Resposta IA | `whatsapp-webhook` → `ai-auto-response` |
| Interface de chat | `Chat.tsx` + hooks |
| Banco de dados | tabelas `whatsapp_*` |
