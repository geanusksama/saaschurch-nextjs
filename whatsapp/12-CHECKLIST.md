# 12 — Checklist Completo — WhatsApp

## Checklist de Setup Inicial

### Banco de dados
- [ ] Tabela `whatsapp_instances` criada com todos os campos
- [ ] Tabela `whatsapp_conversations` criada com todos os campos
- [ ] Tabela `whatsapp_messages` criada com todos os campos
- [ ] Tabela `ai_agent_audit_log` criada
- [ ] Tabela `whatsapp_instance_rate_limit` criada
- [ ] RLS habilitado em TODAS as tabelas do módulo
- [ ] Políticas RLS criadas e testadas
- [ ] Índices de performance criados
- [ ] Realtime habilitado para `whatsapp_messages` e `whatsapp_conversations`
- [ ] Delete cascade configurado corretamente

### Edge Functions
- [ ] `send-message` deployada com sucesso
- [ ] `whatsapp-webhook` deployada com sucesso
- [ ] `whatsapp-instance` deployada com sucesso
- [ ] `ai-auto-response` deployada com sucesso
- [ ] Secrets configurados: `ZAPI_CLIENT_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`

### Configuração Z-API
- [ ] Instância criada no dashboard Z-API
- [ ] instance_id, token, client_token obtidos
- [ ] Webhook configurado na Z-API com URL correta
- [ ] Eventos `ReceivedCallback` e `DeliveryCallback` habilitados
- [ ] QR code escaneado com WhatsApp do número
- [ ] Instância com status `CONNECTED` na Z-API

### Frontend
- [ ] `.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
- [ ] Rota `/chat` configurada no router
- [ ] Rota `/whatsapp-instances` configurada no router

---

## Checklist de Testes — Envio

- [ ] Envio de texto funciona (Chat.tsx)
- [ ] Envio de texto funciona (WhatsAppCompose.tsx dentro de deal)
- [ ] Envio de imagem via URL funciona
- [ ] Envio de documento PDF funciona
- [ ] Envio de áudio funciona
- [ ] Envio de vídeo funciona
- [ ] Rate limiting: mensagem não enviada antes de 5s da anterior
- [ ] Status muda para `sent` após confirmação Z-API
- [ ] Status muda para `delivered` após confirmação de entrega
- [ ] Status muda para `read` após confirmação de leitura
- [ ] Mensagem enviada aparece no Realtime (sem refresh de página)

---

## Checklist de Testes — Recebimento

- [ ] Mensagem de texto inbound aparece na timeline
- [ ] Mensagem de imagem inbound renderiza thumbnail
- [ ] Mensagem de áudio inbound tem player de áudio
- [ ] Mensagem de documento inbound tem link para download
- [ ] Mensagem de vídeo inbound tem player de vídeo
- [ ] `last_message_at` atualizado ao receber mensagem
- [ ] `unread_count` incrementado ao receber mensagem
- [ ] Conversa criada automaticamente para novo número
- [ ] Realtime push funciona sem recarregar a página
- [ ] Mensagem de grupo identificada (suffix @g.us)
- [ ] `fromMe=true` não cria nova mensagem visível (sem loop)

---

## Checklist de Testes — Instâncias

- [ ] Criar nova instância salva corretamente no banco
- [ ] QR code aparece ao criar instância (polling de 3s funcionando)
- [ ] Status muda para `connected` após escanear QR
- [ ] Status visual correto para cada estado (connected/disconnected/qr_code)
- [ ] Deletar instância remove conversas e mensagens (cascade)
- [ ] Reconexão via QR code sem criar nova instância
- [ ] Múltiplas instâncias visíveis e separadas na UI

---

## Checklist de Testes — IA

- [ ] `ai_enabled=false` bloqueia IA completamente (verificar audit log)
- [ ] `ai_enabled=true` ativa resposta automática
- [ ] Resposta chega via WhatsApp em menos de 30 segundos
- [ ] Vendor isolation: agente do admin BLOQUEADO em conversa do vendedor
- [ ] Vendor isolation: agente do vendedor RESPONDE suas próprias conversas
- [ ] Deduplicação: mesma mensagem não gera duas respostas
- [ ] Agrupamento: 3 mensagens rápidas geram apenas 1 resposta IA
- [ ] Sticky agent: segundo turno usa o mesmo agente do primeiro
- [ ] `ai_agent_audit_log` registra entrada após cada decisão
- [ ] Auto-reação: reação 👍 após mensagem positiva do usuário

---

## Checklist de Segurança e Isolamento

- [ ] Tenant A não consegue ver instâncias do Tenant B (testar com 2 tenants)
- [ ] Tenant A não consegue ver conversas do Tenant B
- [ ] Credenciais Z-API não aparecem em nenhuma resposta do frontend
- [ ] RLS bloqueia acesso direto ao banco sem autenticação
- [ ] Edge Functions validam que conversa pertence ao tenant da instância
- [ ] `ai_agent_audit_log` não acessível via RLS anon

---

## Checklist de Performance

- [ ] Lista de conversas carrega em menos de 2 segundos (50+ conversas)
- [ ] Timeline de mensagens carrega em menos de 1 segundo (100 mensagens)
- [ ] Realtime: nova mensagem aparece em menos de 3 segundos
- [ ] QR code polling não causa memory leak (cleanup do interval)
- [ ] Subscription do Realtime tem cleanup no useEffect
- [ ] Índices de banco estão sendo usados (verificar com EXPLAIN)

---

## Checklist pré-deploy em produção

- [ ] Todos os secrets configurados em `supabase secrets`
- [ ] Webhook URL configurada na Z-API (URL de produção, não local)
- [ ] RLS verificado manualmente para cada tabela
- [ ] Edge Functions deployadas e com status `active`
- [ ] `.env` de produção sem credenciais hardcoded
- [ ] Logs de Edge Functions sem erros nos últimos 10 deploys
- [ ] Teste de envio e recebimento em produção com número real
- [ ] `modules/whatsapp-zapi/CHANGELOG.md` atualizado

---

## Checklist pós-modificação de código

Após qualquer modificação no módulo WhatsApp:

- [ ] `await sleep(5000)` ainda presente em `send-message`
- [ ] `fromMe=true` check ainda presente em `whatsapp-webhook`
- [ ] Deduplicação por hash ainda ativa em `ai-auto-response`
- [ ] Vendor isolation (`validateAgentScope`) não foi bypassado
- [ ] RLS policies não foram alteradas sem revisão
- [ ] Novo código não introduz chamada direta à Z-API sem rate limit
- [ ] Memory leaks verificados (subscriptions têm cleanup)
- [ ] TypeScript sem erros (`tsc --noEmit`)
- [ ] CHANGELOG atualizado com a modificação
