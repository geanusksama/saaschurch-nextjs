# 11 — Scripts e Comandos Úteis — WhatsApp

## Diagnóstico rápido

### Ver logs das Edge Functions em tempo real
```bash
# Webhook de recebimento (mais usado para debug)
supabase functions logs whatsapp-webhook --tail

# Envio de mensagem
supabase functions logs send-message --tail

# Resposta automática IA
supabase functions logs ai-auto-response --tail

# Gestão de instâncias
supabase functions logs whatsapp-instance --tail
```

### Verificar instâncias do banco
```sql
-- Listar instâncias com status
SELECT id, name, status, phone_number, is_active, owner_user_id, created_at
FROM whatsapp_instances
ORDER BY created_at DESC;

-- Instâncias de um tenant específico
SELECT id, name, instance_id, status, phone_number
FROM whatsapp_instances
WHERE owner_user_id = '{USER_UUID}';
```

### Verificar conversas recentes
```sql
-- Últimas 20 conversas abertas
SELECT wc.id, wc.phone, wc.status, wc.ai_enabled, wc.last_message_at,
       wc.unread_count, wi.name as instance_name
FROM whatsapp_conversations wc
JOIN whatsapp_instances wi ON wi.id = wc.instance_id
WHERE wc.status = 'open'
ORDER BY wc.last_message_at DESC
LIMIT 20;

-- Conversa específica por telefone
SELECT * FROM whatsapp_conversations
WHERE phone LIKE '%{PHONE_FRAGMENT}%'
LIMIT 5;
```

### Verificar mensagens de uma conversa
```sql
-- Últimas 30 mensagens de uma conversa
SELECT id, content, type, direction, status, created_at,
       metadata->>'zapi_message_id' as zapi_id
FROM whatsapp_messages
WHERE conversation_id = '{CONVERSATION_UUID}'
ORDER BY created_at DESC
LIMIT 30;

-- Verificar se mensagem chegou no banco
SELECT COUNT(*) FROM whatsapp_messages
WHERE conversation_id = '{CONVERSATION_UUID}'
  AND created_at > now() - interval '5 minutes';
```

---

## Deploy

### Deploy de Edge Functions
```bash
# Individual
supabase functions deploy send-message
supabase functions deploy whatsapp-webhook
supabase functions deploy whatsapp-instance
supabase functions deploy ai-auto-response
supabase functions deploy auto-activate-agent

# Todas as funções de uma vez
supabase functions deploy

# Com verificação de TypeScript
supabase functions deploy --verify-jwt send-message
```

### Configurar secrets de produção
```bash
# Secrets obrigatórios para WhatsApp
supabase secrets set ZAPI_CLIENT_TOKEN=f04a3xxxxxxxxxxxx
supabase secrets set OPENAI_API_KEY=sk-proj-xxxxxxxxxxxx

# Verificar secrets configurados (não mostra valores)
supabase secrets list

# Remover secret
supabase secrets unset NOME_DO_SECRET
```

---

## Banco de Dados

### Aplicar migrations
```bash
# Aplicar todas as migrations pendentes
supabase db push

# Ver migrations aplicadas
supabase migration list

# Criar nova migration
supabase migration new nome_da_migration
```

### Testar RLS localmente
```sql
-- Simular usuário específico e testar query
BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims = '{"sub": "{USER_UUID}"}';

  -- Deve retornar apenas dados do tenant do usuário
  SELECT id, phone, status FROM whatsapp_conversations LIMIT 5;
ROLLBACK;
```

### Reset de contadores
```sql
-- Zerar unread_count de todas as conversas de um tenant
UPDATE whatsapp_conversations
SET unread_count = 0
WHERE owner_user_id = '{USER_UUID}';

-- Fechar conversas inativas (sem mensagem há 30 dias)
UPDATE whatsapp_conversations
SET status = 'closed'
WHERE status = 'open'
  AND last_message_at < now() - interval '30 days'
  AND owner_user_id = '{USER_UUID}';
```

---

## Audit Log de IA

### Ver ações recentes dos agentes
```sql
-- Últimas 50 ações de agentes
SELECT trace_id, action, reason, agent_name,
       details->>'tokens_used' as tokens,
       created_at
FROM ai_agent_audit_log
ORDER BY created_at DESC
LIMIT 50;

-- Por conversa específica
SELECT * FROM ai_agent_audit_log
WHERE conversation_id = '{CONVERSATION_UUID}'
ORDER BY created_at DESC;

-- Contar bloqueios por vendor isolation
SELECT reason, COUNT(*) as total
FROM ai_agent_audit_log
WHERE action = 'blocked'
  AND created_at > now() - interval '24 hours'
GROUP BY reason
ORDER BY total DESC;
```

---

## Testar webhook localmente

### Simular payload Z-API (ReceivedCallback)
```bash
# Chamar webhook localmente com payload de teste
curl -X POST http://localhost:54321/functions/v1/whatsapp-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "instanceId": "inst_test123",
    "messageId": "3EB0TEST001",
    "phone": "5511999990001@s.whatsapp.net",
    "fromMe": false,
    "type": "ReceivedCallback",
    "text": { "message": "Olá, preciso de informações sobre o Corolla" },
    "senderName": "João Silva",
    "momment": 1700000000000
  }'
```

### Simular envio de mensagem
```bash
# Chamar send-message com credenciais de teste
curl -X POST http://localhost:54321/functions/v1/send-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {SUPABASE_ANON_KEY}" \
  -d '{
    "to": "5511999990001",
    "message": "Olá! Em que posso ajudar?",
    "instanceId": "inst_test123",
    "token": "tok_test",
    "clientToken": "client_tok_test",
    "type": "text"
  }'
```

---

## Iniciar ambiente local
```bash
# Iniciar Supabase localmente
supabase start

# Ver URL e chaves locais
supabase status

# Iniciar Edge Functions em modo dev (hot reload)
supabase functions serve --env-file .env.local

# Parar tudo
supabase stop
```

---

## Scripts de diagnóstico rápido

### Verificar saúde do módulo WhatsApp
```sql
-- Estatísticas gerais
SELECT
  (SELECT COUNT(*) FROM whatsapp_instances WHERE is_active = true) as instancias_ativas,
  (SELECT COUNT(*) FROM whatsapp_conversations WHERE status = 'open') as conversas_abertas,
  (SELECT COUNT(*) FROM whatsapp_messages WHERE created_at > now() - interval '1 hour') as mensagens_ultima_hora,
  (SELECT COUNT(*) FROM ai_agent_audit_log WHERE created_at > now() - interval '1 hour') as acoes_ia_ultima_hora;
```

### Verificar instâncias desconectadas
```sql
SELECT id, name, status, phone_number, updated_at
FROM whatsapp_instances
WHERE status != 'connected'
  AND is_active = true
ORDER BY updated_at DESC;
```

### Encontrar conversas com IA ativa mas sem agente configurado
```sql
SELECT wc.id, wc.phone, wc.ai_enabled, wc.assigned_to
FROM whatsapp_conversations wc
WHERE wc.ai_enabled = true
  AND NOT EXISTS (
    SELECT 1 FROM ai_agents aa
    WHERE aa.owner_user_id = wc.owner_user_id
      AND aa.is_active = true
  )
LIMIT 10;
```
