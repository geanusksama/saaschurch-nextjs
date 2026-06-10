# SECURITY.md — Segurança, Criptografia e Auditoria
## Módulo de Conciliação Bancária Santander

**Versão:** 1.0.0  
**Data:** 2026-06-10  
**Classificação:** CONFIDENCIAL — Para auditoria Santander

---

## 1. Superfície de Ataque e Controles

### 1.1 Credenciais da API Santander

| Ativo | Risco | Controle |
|-------|-------|---------|
| Client Secret | Vazamento → acesso não autorizado à conta bancária | AES-256-CBC com IV aleatório; armazenado somente no banco server-side |
| Chave privada do certificado | Comprometimento → bypass do mTLS | Nunca armazenada em VARCHAR; referência para arquivo em diretório fora do webroot |
| Access Token JWT | Interceptação → acesso temporário à API | Token válido apenas no backend; TTL 15 min; nunca retornado ao frontend |
| Client ID | Phishing se exposto | Mascarado nas respostas de API (primeiros/últimos 4 chars visíveis) |

---

## 2. Armazenamento Seguro do Client Secret

### Algoritmo: AES-256-CBC

```
Armazenamento:
1. Gerar IV aleatório de 16 bytes: crypto.randomBytes(16)
2. Usar chave de criptografia do ambiente: process.env.SANTANDER_ENCRYPTION_KEY (32 bytes)
3. Criptografar: AES-256-CBC(client_secret, key, iv)
4. Armazenar: client_secret_encrypted (hex) + client_secret_iv (hex) no banco

Leitura (backend only):
1. Carregar client_secret_encrypted + client_secret_iv do banco
2. Descriptografar: AES-256-CBC-decrypt(encrypted, key, iv)
3. Usar apenas em memória para gerar token
4. NUNCA retornar em nenhuma resposta HTTP
```

**Variável de ambiente obrigatória:**
```
SANTANDER_ENCRYPTION_KEY=<32 bytes hex — gerado uma vez, armazenado em secrets do servidor>
```

**Rotação de chave:**
- Ao rotacionar `SANTANDER_ENCRYPTION_KEY`: re-criptografar todos os registros em transação atômica
- Manter versão antiga ativa por 24h para evitar falha durante rotação
- Logar evento de rotação sem expor chave antiga ou nova

---

## 3. Certificado Digital

### 3.1 Regras do Santander

- Formato: `.PEM`, `.CER` ou `.CRT`
- Tipo: ICP A1 (não SSL DV/OV/EV, não autoassinado)
- Tamanho: mínimo 2048 bits
- Validade mínima: 90 dias
- Cadeia completa: root + intermediário + folha
- Key Usage: Digital Signature ou Key Agreement
- Extended Key Usage: TLS Web Client Authentication (1.3.6.1.5.5.7.3.2)

### 3.2 Armazenamento dos Certificados

```
Certificado público (.crt/.pem):
- Armazenar em path seguro fora do webroot: /secure/certs/{credential_id}_public.pem
- Path armazenado em santander_credentials.certificate_public_path
- Nunca armazenar em banco como TEXT puro
- Nunca expor via API

Chave privada (.key/.pem):
- NUNCA armazenar conteúdo no banco de dados
- NUNCA expor via API
- Armazenar em path com permissão 600 (leitura apenas pelo processo Node.js)
- Path referenciado em santander_credentials.certificate_private_ref (path absoluto ou referência ao vault)
- Considerar uso de HashiCorp Vault ou AWS Secrets Manager para produção
```

### 3.3 Alerta de Vencimento

```typescript
// Verificar no startup e diariamente
if (daysBetween(now, certificate_expires_at) < 30) {
  notifyAdmin('Certificado Santander vence em X dias. Renovar urgente.')
}
if (daysBetween(now, certificate_expires_at) < 7) {
  blockApiCalls(credentialId)
  notifyAdmin('CRÍTICO: Certificado Santander vence em menos de 7 dias.')
}
```

---

## 4. mTLS (TLS Mútuo)

O mTLS é obrigatório para todas as chamadas à API Santander:

```typescript
const agent = new https.Agent({
  cert: fs.readFileSync(certificatePublicPath),
  key: fs.readFileSync(certificatePrivatePath),
  rejectUnauthorized: true, // nunca false em produção
})

// Headers obrigatórios em todas as chamadas
headers: {
  'Authorization': `Bearer ${accessToken}`,
  'X-Application-Key': clientId,
  'Content-Type': 'application/json',
}
```

**Hosts confiados:**
- Sandbox: `trust-sandbox.api.santander.com.br`
- Produção: `trust-open.api.santander.com.br`

**Validação:**
- `rejectUnauthorized: true` — obrigatório
- Nunca desabilitar verificação de certificado do servidor
- Nunca usar `NODE_TLS_REJECT_UNAUTHORIZED=0`

---

## 5. Access Token (JWT)

### 5.1 Geração

```
POST https://trust-open.api.santander.com.br/auth/oauth/v2/token
Content-Type: application/x-www-form-urlencoded
(com mTLS ativo)

Body:
  client_id={CLIENT_ID}
  client_secret={CLIENT_SECRET}
  grant_type=client_credentials
```

### 5.2 Cache e Rotação

```typescript
// Token cache: Map<credentialId, { token, expiresAt }>
// TTL = 840s (14 min) — 1 min antes do vencimento real de 900s (15 min)
// Se token expira: solicitar novo antes de qualquer chamada
// Implementar mutex por credentialId para evitar race condition em geração simultânea
```

### 5.3 Regras de Segurança do Token

- Token NUNCA incluído em logs
- Token NUNCA retornado ao frontend
- Token NUNCA armazenado em banco de dados
- Token NUNCA incluído em `raw_payload` do movimento
- Se token retornar 401: regenerar imediatamente e tentar uma vez
- Se regeneração falhar: logar erro sem expor token, alertar admin

---

## 6. Proteção das Rotas da API Interna

Todas as rotas `/api/santander/*` devem usar:

```typescript
// Autenticação obrigatória
export async function withAuth(req, handler) { ... }

// Permissão específica por endpoint
export async function withPermission(user, permission: SantanderPermission) {
  const hasPermission = await checkPermission(user.profileType, user.churchId, permission)
  if (!hasPermission) throw new ApiError(403, 'Permissão negada')
}

// Escopo: campo/church
export function scopeFilter(user) {
  if (user.profileType === 'master') return {}
  if (user.profileType === 'admin') return { campo: user.campoId }
  if (user.profileType === 'campo') return { campo: user.campoId }
  return { church_id: user.churchId } // church/tesoureiro
}
```

---

## 7. Rate Limiting

### 7.1 Rate Limit da API Santander

- Limite: **10 TPS** (transações por segundo) global para toda a aplicação
- Implementação: semáforo interno ou queue com delay

```typescript
// Rate limiter: no máximo 10 chamadas por segundo
class SantanderRateLimiter {
  private queue: Array<() => void> = []
  private runningCount = 0
  private readonly MAX_CONCURRENT = 10

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // aguarda slot disponível
    // controla via semáforo e setTimeout de 100ms entre slots
  }
}
```

### 7.2 Rate Limit Interno da API do SAAS

- Limite por usuário: 30 req/min para rotas Santander
- Implementação: verificar no middleware via Redis ou in-memory counter
- Retorno ao exceder: `HTTP 429 Too Many Requests`

---

## 8. Logs de Auditoria (sem exposição de secrets)

Toda ação relevante deve gerar log na tabela `santander_sync_logs` e/ou log de auditoria geral do sistema.

### 8.1 Ações auditadas

| Ação | Log gerado |
|------|-----------|
| Cadastro de credencial | Usuário, campo, ambiente, timestamp |
| Atualização de credencial | Usuário, campos alterados (sem secrets), timestamp |
| Teste de conectividade | Usuário, resultado (sucesso/falha), timestamp |
| Consulta de extrato | Usuário, conta, período, total importado, timestamp |
| Importação FEBRABAN 240 | Usuário, arquivo (nome), total registros, timestamp |
| Conciliação manual | Usuário, movimento_id, livro_caixa_id, timestamp |
| Lançamento no Livro Caixa | Usuário, movimento_id, livro_caixa_id, valor, timestamp |
| Desfazer conciliação | Usuário, conciliacao_id, timestamp |
| Ignorar movimento | Usuário, movimento_id, timestamp |

### 8.2 O que NUNCA logar

- Client Secret (nem criptografado, nem em claro)
- Access Token JWT
- Chave privada ou conteúdo de certificado
- Número de conta completo em mensagens de erro (usar últimos 4 dígitos)
- Payload completo de erros que possa conter tokens

### 8.3 Mascaramento

```typescript
function maskClientId(clientId: string): string {
  return clientId.slice(0, 4) + '****' + clientId.slice(-4)
}

function maskAccountNumber(account: string): string {
  return '****' + account.slice(-4)
}

function sanitizeErrorForLog(error: unknown): string {
  const msg = String(error)
  // Remove padrões de token: JWT (3 partes base64 com pontos)
  return msg.replace(/[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, '[TOKEN_REDACTED]')
}
```

---

## 9. Criptografia em Repouso

| Dado | Proteção |
|------|----------|
| Client Secret | AES-256-CBC, IV aleatório por credencial |
| Chave privada do cert | Fora do banco (path apenas) |
| Dados bancários (movimentos) | Banco cifrado em repouso (Supabase/PostgreSQL com TDE) |
| raw_payload | JSONB no banco — sem tokens, validado antes de salvar |

---

## 10. Criptografia em Trânsito

- HTTPS obrigatório em todas as comunicações
- mTLS obrigatório para API Santander
- TLS 1.2+ para comunicações com Supabase
- Certificados do servidor com validade e cadeia verificada

---

## 11. Controle de Acesso — Modelo RBAC

```
Perfil master → acesso total a todas as operações em todos os campos
Perfil admin → acesso total no próprio campo
Perfil campo → consultar, importar, conciliar, lançar (no próprio campo)
Tesoureiro → consultar, importar, conciliar, lançar (na própria church)
Secretaria → sem acesso ao módulo Santander
Membro → sem acesso
```

**Configurar (cadastrar credencial):** apenas master e admin  
**Auditoria:** apenas master e admin

---

## 12. Checklist de Segurança para Auditoria Santander

- [x] Client Secret nunca em texto puro no banco
- [x] Client Secret criptografado com AES-256
- [x] Chave privada nunca armazenada como texto no banco
- [x] Token JWT nunca retornado ao frontend
- [x] Token JWT nunca em logs
- [x] mTLS habilitado e obrigatório (`rejectUnauthorized: true`)
- [x] Rate limit respeitado (10 TPS)
- [x] Rotas protegidas por autenticação e autorização
- [x] Logs de auditoria para todas as ações sensíveis
- [x] Mascaramento de dados sensíveis em logs e respostas
- [x] Validação de certificado (tipo, cadeia, vencimento)
- [x] Alerta de vencimento de certificado com 30 dias de antecedência
- [x] Scope por campo/church (multi-tenant)
- [x] Dados bancários cifrados em repouso
- [x] HTTPS obrigatório em toda a cadeia
- [x] Sem `NODE_TLS_REJECT_UNAUTHORIZED=0` em produção
- [x] Sem segredos em variáveis de ambiente públicas ou no código-fonte
- [x] Deduplicação para evitar duplicidade de dados financeiros
