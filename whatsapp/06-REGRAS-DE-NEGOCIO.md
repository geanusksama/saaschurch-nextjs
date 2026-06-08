# 06 — Regras de Negócio — WhatsApp

## REGRAS ABSOLUTAS (nunca violar)

### R1 — Rate limiting de 5 segundos
- **Regra**: Nunca remover ou reduzir o `await sleep(5000)` em `send-message/index.ts`
- **Consequência**: Ban permanente do número WhatsApp na Z-API
- **Localização**: `supabase/functions/send-message/index.ts` — antes de cada chamada Z-API

### R2 — fromMe check no webhook
- **Regra**: Nunca remover a verificação `if (payload.fromMe === true) return 200`
- **Consequência**: Loop infinito — mensagem enviada pelo sistema aciona IA que envia nova mensagem, infinitamente
- **Localização**: `supabase/functions/whatsapp-webhook/index.ts`

### R3 — Webhook sempre retorna 200
- **Regra**: O webhook deve retornar 200 OK mesmo em caso de erro interno
- **Consequência**: Z-API faz retry automático em caso de 4xx/5xx, causando duplicatas
- **Localização**: Bloco try/catch final em `whatsapp-webhook/index.ts`

### R4 — Credenciais Z-API nunca no frontend
- **Regra**: `instance_id`, `token` e `client_token` nunca devem ser expostos no payload de resposta do frontend
- **Implementação**: Edge Functions buscam credenciais do banco server-side; frontend só recebe UUID da instância

### R5 — ai_enabled=false bloqueia tudo
- **Regra**: Quando `ai_enabled=false`, NENHUMA IA responde, independente de qualquer outra configuração
- **Verificação**: Primeira linha de `ai-auto-response` antes de qualquer outra lógica

---

## Regras de instância

- **1 instância = 1 número WhatsApp** (relação 1:1 Z-API ↔ número)
- **N instâncias por tenant** — sem limite fixo (controlado pelo plano de assinatura)
- Instâncias são isoladas por `owner_user_id` com RLS
- Deletar instância remove TODAS as conversas e mensagens (cascade)
- Status possíveis: `connected` / `disconnected` / `connecting` / `qr_code`

---

## Regras de conversa

- **1 conversa por par (instância + phone)** — deduplicação na criação
- Conversa criada automaticamente quando primeiro contato envia mensagem
- Status `open` → `closed` (encerrada manualmente) → pode reabrir para `open`
- `unread_count` incrementa em mensagem inbound, zera quando conversa é aberta
- `last_message_at` sempre atualizado na mensagem inbound ou outbound mais recente

---

## Regras de mensagem

### Tipos suportados

| Tipo | Envio | Recebimento | Notas |
|------|-------|-------------|-------|
| text | Sim | Sim | |
| image | Sim | Sim | URL pública |
| document | Sim | Sim | PDF, DOC, XLS, etc. |
| audio | Sim | Sim | Transcrição via Whisper opcional |
| video | Sim | Sim | |
| link | Sim | Não | Com preview (título, imagem, descrição) |
| reaction | Sim | Sim | Reação a mensagem |
| sticker | Não | Sim | Registrado mas IA não processa |

### Status de entrega (mensagens outbound)
```
pending → sent → delivered → read
                           ↘ failed (erro Z-API)
```
- `pending`: salvo no banco, ainda não enviado
- `sent`: Z-API confirmou envio ao servidor WhatsApp
- `delivered`: entregue no aparelho do destinatário
- `read`: destinatário visualizou a mensagem

---

## Regras de IA

### Controle por conversa
- `ai_enabled=false` → IA completamente desabilitada (override de tudo)
- `ai_enabled=true` → IA ativa, resposta via agente configurado
- Usuário pode toggle a qualquer momento; entra em vigor na próxima mensagem

### Vendor isolation
```
conversa.assigned_to = NULL     → qualquer agente do tenant
conversa.assigned_to = vendedor → APENAS agente do vendedor (owner bloqueado)
agente de outro tenant          → SEMPRE bloqueado
```

### Agrupamento de fragmentos
- Aguarda 7 segundos antes de processar para acumular fragmentos
- Agrupa mensagens enviadas dentro de 18 segundos como uma única intenção
- Evita múltiplas respostas para mensagens fragmentadas

### Deduplicação
- Hash SHA-256 de cada mensagem inbound
- Se mesmo hash dentro de 18s → ignora (não processa)
- Previne double-response em caso de retry do webhook

### Sticky agent
- Último agente bem-sucedido fica registrado em `metadata.sticky_agent_id`
- Próximas mensagens na conversa usam o mesmo agente (continuidade de persona)
- Se sticky agent não disponível → fallback para agente padrão do tenant

---

## Regras de grupos

- Mensagens de grupos têm `phone` terminando em `@g.us`
- Número do remetente está no campo `participant` (não no `phone`)
- IA não responde mensagens de grupo por padrão
- Grupos são identificados mas não criam conversas individuais

---

## Regras de multi-tenant

- Todo acesso ao banco é filtrado por `owner_user_id` via RLS
- Edge Functions validam correspondência de `tenant_id` entre conversa e instância
- Instâncias não podem ser compartilhadas entre tenants
- Credenciais Z-API por instância (não por tenant)

---

## Notificações

- Mensagem inbound → notificação para `assigned_to`
- Se `assigned_to = NULL` → notificação para `owner_user_id` (dono do tenant)
- Notificações salvas em tabela `notifications` com tipo `whatsapp_message`
- Exibidas via `NotificationsPage.tsx` e sino de notificações

---

## Automações

Triggers suportados em automation_flows:
- `keyword`: mensagem contém palavra-chave → dispara fluxo
- `first_message`: primeira mensagem de um número novo → dispara fluxo
- `business_hours`: mensagem fora do horário → ativa agente/resposta automática

---

## Auto-Reações

```
Após resposta da IA, sistema analisa sentimento da mensagem do usuário:
  - Sentimento positivo (obrigado, ok, fechado, perfeito) → reação 👍 ou 🙏
  - Sentimento negativo (reclamação, cancelamento, insatisfeito) → reação 😕
  - Sentimento neutro → sem reação
```

Implementado em `pickAutoReaction()` dentro de `ai-auto-response/index.ts`.
