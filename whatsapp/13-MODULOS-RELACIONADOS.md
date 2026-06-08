# 13 — Módulos Relacionados ao WhatsApp

## Dependências diretas (módulos que o WhatsApp usa)

### modules/agentes-ia/
**Relação**: O WhatsApp usa agentes IA para respostas automáticas

Arquivos críticos:
- `modules/agentes-ia/README.md` — visão geral
- `modules/agentes-ia/EDGE_FUNCTIONS.md` — ai-auto-response, openai-chat
- `supabase/functions/ai-auto-response/index.ts` — implementação

Tabelas compartilhadas: `ai_agents`, `ai_agent_interactions`, `ai_agent_audit_log`

---

### modules/openai/
**Relação**: Proxy para OpenAI GPT-4 e Whisper

Arquivos críticos:
- `supabase/functions/openai-chat/index.ts` — chamado por ai-auto-response
- `supabase/functions/openai-transcribe/index.ts` — transcrição de áudios

---

### modules/chat/
**Relação**: Infraestrutura de chat compartilhada (componentes UI, hooks base)

Arquivos críticos:
- `modules/chat/README.md`
- `modules/chat/EDGE_FUNCTIONS.md`
- `src/app/components/chat/` — componentes de chat

---

### modules/supabase/
**Relação**: Infraestrutura de banco e Edge Functions

Arquivos críticos:
- `modules/supabase/README.md`
- `supabase/config.toml` — configuração do projeto Supabase
- `supabase/migrations/` — migrations relevantes

---

## Módulos que dependem do WhatsApp

### modules/crm/
**Relação**: CRM usa WhatsApp para comunicação com leads/clientes

Pontos de integração:
- `WhatsAppCompose.tsx` — envio de WhatsApp dentro do deal
- `whatsapp_conversations.contact_id` → `contacts.id`
- Atividades CRM registradas após envio WhatsApp

---

### modules/automacoes/
**Relação**: Automações podem ser disparadas por eventos WhatsApp

Pontos de integração:
- `whatsapp-webhook` invoca `automation-scheduler` quando trigger ativo
- Tipos de trigger: `keyword`, `first_message`, `business_hours`
- Nó "Enviar WhatsApp" disponível em fluxos de automação

---

### modules/campanhas-ia/
**Relação**: Campanhas de IA usam WhatsApp como canal de saída

Pontos de integração:
- Campanhas disparam `send-message` em massa (respeitando rate limit)
- Respostas dos destinatários chegam via `whatsapp-webhook`

---

### modules/notificacoes/
**Relação**: Mensagens inbound WhatsApp geram notificações

Pontos de integração:
- `whatsapp-webhook` insere em tabela `notifications`
- `NotificationsPage.tsx` exibe notificações com link para conversa

---

### modules/leads/
**Relação**: Contatos de conversas WhatsApp podem virar leads

Pontos de integração:
- Automação pode criar lead quando nova conversa WhatsApp chega
- `whatsapp_conversations.contact_id` → `contacts.id` → `leads`

---

## Mapa de dependência completo

```
modules/whatsapp-zapi
├── DEPENDE DE:
│   ├── modules/agentes-ia      (ai-auto-response, openai-chat)
│   ├── modules/openai          (openai-chat, openai-transcribe)
│   ├── modules/chat            (componentes UI, infraestrutura)
│   └── modules/supabase        (banco, Edge Functions runtime)
│
└── É DEPENDIDO POR:
    ├── modules/crm             (WhatsAppCompose, histórico de atividades)
    ├── modules/automacoes      (triggers por mensagem WhatsApp)
    ├── modules/campanhas-ia    (envio em massa via WhatsApp)
    ├── modules/notificacoes    (alertas de nova mensagem)
    └── modules/leads           (geração de leads por conversa)
```

---

## Referências no SYSTEM_MAP

Para detalhes técnicos aprofundados, consultar:
- `auditoria/mapa-do-sistema/SYSTEM_MAP.md` — Seção "Módulo 3: WhatsApp Z-API"
- `auditoria/mapa-do-sistema/SYSTEM_MAP.md` — Seção "Agentes IA"
- `auditoria/mapa-do-sistema/SYSTEM_MAP.md` — Seção "Edge Functions de Comunicação"

---

## Arquivos de código mais citados em outros módulos

Quando outro módulo precisa interagir com WhatsApp, tipicamente importa de:

```typescript
// Serviço de conversa (mais importado)
import { whatsappConversationService } from '@/services/whatsappConversationService'

// Serviço de chat (para envio de mensagem a partir de outros módulos)
import { whatsappChatService } from '@/app/services/whatsappChatService'

// Tipos
import type { WhatsAppConversation, WhatsAppMessage } from '@/types/whatsapp'
```

Chamada direta à Edge Function (de outros módulos ou automações):
```typescript
const { data, error } = await supabase.functions.invoke('send-message', {
  body: {
    to: contactPhone,
    message: messageContent,
    instanceId: instance.instance_id,
    token: instance.token,
    clientToken: instance.client_token,
    type: 'text'
  }
})
```
