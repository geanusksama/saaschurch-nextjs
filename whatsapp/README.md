# Sistema WhatsApp — Documentação Completa para Agente

> Índice mestre de toda a documentação necessária para implementar, manter e evoluir o módulo WhatsApp do CRM Grupo SLS via agente de IA em qualquer sessão.

---

## Arquivos desta pasta

| Arquivo | Conteúdo |
|---------|----------|
| [00-OVERVIEW.md](00-OVERVIEW.md) | Visão geral do sistema, stack, responsabilidades |
| [01-ARQUITETURA.md](01-ARQUITETURA.md) | Diagramas de fluxo, camadas, multi-tenant |
| [02-BANCO-DE-DADOS.md](02-BANCO-DE-DADOS.md) | Schema completo das tabelas, índices, RLS |
| [03-EDGE-FUNCTIONS.md](03-EDGE-FUNCTIONS.md) | Documentação de todas as Edge Functions |
| [04-FRONTEND.md](04-FRONTEND.md) | Páginas, componentes, hooks, serviços frontend |
| [05-AGENTES-IA.md](05-AGENTES-IA.md) | Agentes IA, ai-auto-response, vendor isolation |
| [06-REGRAS-DE-NEGOCIO.md](06-REGRAS-DE-NEGOCIO.md) | Regras críticas, restrições, comportamentos |
| [07-VARIAVEIS-AMBIENTE.md](07-VARIAVEIS-AMBIENTE.md) | Todas as variáveis de ambiente e secrets |
| [08-INTEGRACOES.md](08-INTEGRACOES.md) | Z-API, OpenAI, Supabase Realtime, CRM |
| [09-MCP-AGENT-PROMPT.md](09-MCP-AGENT-PROMPT.md) | Prompt pronto para agente de IA trabalhar no módulo |
| [10-SKILLS.md](10-SKILLS.md) | Skills disponíveis relacionadas ao WhatsApp |
| [11-SCRIPTS.md](11-SCRIPTS.md) | Scripts utilitários, diagnóstico, banco |
| [12-CHECKLIST.md](12-CHECKLIST.md) | Checklist completo de testes e deploy |
| [13-MODULOS-RELACIONADOS.md](13-MODULOS-RELACIONADOS.md) | Módulos que dependem ou são dependidos pelo WhatsApp |

---

## Leitura obrigatória antes de qualquer tarefa

```
1. whatsapp/00-OVERVIEW.md
2. whatsapp/01-ARQUITETURA.md
3. whatsapp/06-REGRAS-DE-NEGOCIO.md  ← CRÍTICO
4. whatsapp/03-EDGE-FUNCTIONS.md     ← para tarefas de backend
5. whatsapp/04-FRONTEND.md           ← para tarefas de frontend
```

---

## Regras absolutas (nunca violar)

1. **NUNCA remover o delay de 5 segundos** no `send-message` — ban permanente do número
2. **NUNCA remover o check `fromMe=true`** no `whatsapp-webhook` — loop infinito de mensagens
3. **NUNCA expor credenciais Z-API** no frontend — sempre via Edge Function
4. **SEMPRE retornar 200 OK** no webhook — Z-API faz retry causando duplicatas

---

## Arquivos de código mais importantes

```
supabase/functions/send-message/index.ts          ← envio de mensagem
supabase/functions/whatsapp-webhook/index.ts      ← recebimento de mensagem
supabase/functions/whatsapp-instance/index.ts     ← gestão de instâncias
supabase/functions/ai-auto-response/index.ts      ← resposta automática IA
src/app/pages/admin/Chat.tsx                       ← interface principal
src/app/pages/admin/WhatsAppInstances.tsx          ← gestão de instâncias
src/app/services/whatsappChatService.ts            ← orquestração frontend
src/hooks/useWhatsAppMessages.ts                   ← realtime de mensagens
src/hooks/useWhatsAppConversations.ts              ← realtime de conversas
```
