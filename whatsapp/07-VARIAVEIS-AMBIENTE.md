# 07 — Variáveis de Ambiente — WhatsApp

## Frontend (.env / .env.local)

```env
# Obrigatórias — Supabase
VITE_SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**NUNCA adicionar credenciais Z-API no frontend.** Elas ficam apenas nas Edge Functions (Supabase Secrets).

---

## Edge Functions — Supabase Secrets

Configuração via CLI:
```bash
supabase secrets set NOME=valor
supabase secrets list   # ver secrets configurados
```

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `SUPABASE_URL` | Sim (auto) | URL do projeto Supabase — injetada automaticamente |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim (auto) | Chave service role — injetada automaticamente |
| `SUPABASE_ANON_KEY` | Sim (auto) | Chave anon — injetada automaticamente |
| `ZAPI_CLIENT_TOKEN` | Sim | Client token Z-API padrão do sistema (fallback) |
| `ZAPI_INSTANCE_ID` | Não | ID de instância Z-API padrão (fallback single-tenant legado) |
| `ZAPI_TOKEN` | Não | Token Z-API padrão (fallback single-tenant legado) |

**Nota sobre fallback**: Em modo multi-tenant, as credenciais Z-API vêm da tabela `whatsapp_instances` (por tenant). As variáveis `ZAPI_*` são apenas fallback para sistemas legados single-tenant.

---

## OpenAI (para ai-auto-response)

| Variável | Obrigatória | Descrição |
|----------|-------------|-----------|
| `OPENAI_API_KEY` | Sim | API key OpenAI master (fallback para tenants sem key própria) |

Cada tenant pode configurar sua própria API key em `settings_options.openai_api_key`. Se ausente, usa a key master.

---

## Configuração de Webhook na Z-API

Para cada instância, configurar no dashboard Z-API:
```
Webhook URL: https://{PROJECT_REF}.functions.supabase.co/whatsapp-webhook
Método: POST
Eventos obrigatórios:
  ✓ ReceivedCallback    — mensagens recebidas
  ✓ DeliveryCallback    — confirmações de entrega/leitura
Eventos opcionais:
  ✓ MessageStatusCallback — status de envio
```

---

## Exemplo de .env.local (desenvolvimento)

```env
VITE_SUPABASE_URL=https://abcdefghij.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWoiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYwMDAwMDAwMCwiZXhwIjoxOTAwMDAwMDAwfQ.EXAMPLE
```

---

## Configuração de Secrets em Produção

```bash
# Credenciais Supabase (obrigatórias)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# Z-API (fallback)
supabase secrets set ZAPI_CLIENT_TOKEN=f04a3xxxxxxxx
supabase secrets set ZAPI_INSTANCE_ID=inst_xxxxxxxx
supabase secrets set ZAPI_TOKEN=tok_xxxxxxxx

# OpenAI (para agentes IA)
supabase secrets set OPENAI_API_KEY=sk-proj-xxxxxxxx

# Verificar
supabase secrets list
```

---

## Variáveis em cada Edge Function

| Edge Function | Variáveis usadas |
|--------------|-----------------|
| `send-message` | `ZAPI_CLIENT_TOKEN` (fallback), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `whatsapp-webhook` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |
| `whatsapp-instance` | `SUPABASE_ANON_KEY` (para validar chamada), credenciais Z-API vêm do body |
| `ai-auto-response` | `OPENAI_API_KEY` (fallback), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` |

---

## Configurações por Tenant (banco de dados)

Cada tenant pode ter configurações específicas salvas em `settings_options`:

```typescript
{
  openai_api_key?: string,        // API key OpenAI própria do tenant
  audioTranscription?: boolean,    // habilitar transcrição de áudio via Whisper
  ai_default_model?: string,       // gpt-4 ou gpt-3.5-turbo
  ai_fragment_wait_ms?: number,    // tempo de espera para fragmentos (padrão: 7000)
}
```
