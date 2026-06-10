# API.md — Endpoints Internos do SAAS
## Módulo de Conciliação Bancária Santander

**Versão:** 1.0.0  
**Data:** 2026-06-10  
**Base URL:** `/api/santander`  
**Autenticação:** Bearer Token (Supabase JWT) via header `Authorization`  
**Permissões:** Verificadas em cada endpoint via `withAuth()` + `withPermission()`

> Todos os endpoints retornam erros no formato padrão do sistema:
> `{ error: string, code?: string }`

---

## 1. Credenciais

### `GET /api/santander/credentials`

Lista as credenciais do campo do usuário autenticado.

**Permissão:** `financeiro.santander.configurar`

**Query Params:**
| Param | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `campo` | string | Não | Filtrar por campo específico (admin only) |

**Response 200:**
```json
{
  "credentials": [
    {
      "id": "uuid",
      "empresa_id": "campo-sp-01",
      "apelido": "Santander SP",
      "ambiente": "producao",
      "client_id": "abc123...",
      "bank_id": "90400888000142",
      "certificate_expires_at": "2026-12-31T00:00:00Z",
      "ativo": true,
      "created_at": "2026-06-01T10:00:00Z"
    }
  ]
}
```

> **Segurança:** `client_secret_encrypted` e `certificate_private_ref` NUNCA são retornados.

---

### `POST /api/santander/credentials`

Cadastra nova credencial Santander.

**Permissão:** `financeiro.santander.configurar`

**Body:**
```json
{
  "empresa_id": "campo-sp-01",
  "apelido": "Santander SP",
  "ambiente": "producao",
  "client_id": "abc123...",
  "client_secret": "secret_plain_text",
  "bank_id": "90400888000142",
  "certificate_public": "-----BEGIN CERTIFICATE-----\n...",
  "certificate_private": "-----BEGIN PRIVATE KEY-----\n...",
  "certificate_expires_at": "2026-12-31",
  "tolerance_days": 2
}
```

**Processamento (backend):**
1. Criptografa `client_secret` com AES-256 → armazena `client_secret_encrypted` + `client_secret_iv`
2. Armazena certificado público no storage seguro
3. Armazena referência à chave privada (não o conteúdo direto em VARCHAR)
4. Nunca retorna os secrets

**Response 201:**
```json
{
  "id": "uuid",
  "apelido": "Santander SP",
  "ambiente": "producao",
  "created_at": "2026-06-10T10:00:00Z"
}
```

---

### `PUT /api/santander/credentials/:id`

Atualiza credencial existente.

**Permissão:** `financeiro.santander.configurar`

**Body:** Mesmo formato do POST, todos os campos opcionais.

**Response 200:** Mesmo formato do GET.

---

### `POST /api/santander/credentials/:id/test`

Testa conectividade com a API Santander usando a credencial.

**Permissão:** `financeiro.santander.configurar`

**Response 200:**
```json
{
  "success": true,
  "message": "Conexão estabelecida com sucesso",
  "ambiente": "producao",
  "tested_at": "2026-06-10T10:00:00Z"
}
```

**Response 400:**
```json
{
  "success": false,
  "error": "Falha na autenticação: credencial inválida ou certificado vencido",
  "code": "SANTANDER_AUTH_FAILED"
}
```

---

## 2. Contas

### `GET /api/santander/accounts`

Lista contas bancárias cadastradas localmente. Opcionalmente sincroniza com a API Santander.

**Permissão:** `financeiro.santander.visualizar`

**Query Params:**
| Param | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `credential_id` | uuid | Sim | ID da credencial |
| `sync` | boolean | Não | Se `true`, busca contas atualizadas na API Santander |

**Response 200:**
```json
{
  "accounts": [
    {
      "id": "uuid",
      "account_id": "0001.000010331607",
      "branch_code": "0001",
      "account_number": "000010331607",
      "account_digit": "7",
      "display_name": "Igreja Central SP",
      "igreja_id": 42,
      "ativa": true
    }
  ],
  "total": 73
}
```

---

## 3. Saldo

### `GET /api/santander/balance`

Consulta saldo de uma conta diretamente na API Santander.

**Permissão:** `financeiro.santander.consultar`

**Query Params:**
| Param | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `credential_id` | uuid | Sim | ID da credencial |
| `account_id` | uuid | Sim | ID da conta local |

**Processamento:**
- Monta `balance_id` = `{branch_code}.{account_number_padded_12}`
- Chama `GET .../bank_account_information/v1/banks/banks/{bank_id}/balances/{balance_id}`

**Response 200:**
```json
{
  "balance_id": "0001.000010331607",
  "available_amount": 15250.00,
  "blocked_amount": 0.00,
  "automatically_invested_amount": 0.00,
  "queried_at": "2026-06-10T10:30:00Z"
}
```

---

## 4. Extrato / Movimentos

### `GET /api/santander/transactions`

Consulta extrato de uma conta na API Santander (efetivados + provisionados), salva localmente.

**Permissão:** `financeiro.santander.consultar`

**Query Params:**
| Param | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `credential_id` | uuid | Sim | ID da credencial |
| `account_id` | uuid | Sim | ID da conta local |
| `from` | string | Sim | Data início (YYYY-MM-DD) |
| `to` | string | Não | Data fim (YYYY-MM-DD) — padrão: hoje |
| `type` | string | Não | `'all'`, `'credit'`, `'debit'` |
| `status` | string | Não | `'novo'`, `'conciliado'`, `'lancado'`, `'ignorado'` |
| `page` | integer | Não | Página (padrão: 1) |
| `limit` | integer | Não | Máx 100 (padrão: 50) |

**Processamento (backend):**
1. Verifica rate limit (máx 10 req/s ao Santander)
2. Busca efetivados: `GET .../transactions/{transaction_id}`
3. Busca provisionados: `GET .../provisioneds/{provisioned_id}`
4. Pagina automaticamente até buscar todos os registros
5. Deduplicação por hash_unico
6. Salva novos em `santander_movimentos`
7. Registra `santander_sync_logs`

**Response 200:**
```json
{
  "movimentos": [
    {
      "id": "uuid",
      "transaction_date": "2026-06-05",
      "amount": 1500.00,
      "credit_debit_type": "C",
      "transaction_name": "PIX RECEBIDO",
      "category_code": "218",
      "history_code": "0001",
      "history_description": "PAGAMENTO DÍZIMO",
      "document_number": "123456",
      "status": "novo",
      "source": "api"
    }
  ],
  "summary": {
    "total_credito": 45000.00,
    "total_debito": 12000.00,
    "saldo_periodo": 33000.00,
    "total_novo": 45,
    "total_duplicado": 3,
    "total_conciliado": 12
  },
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 57
  },
  "sync_log_id": "uuid"
}
```

---

## 5. Importação FEBRABAN 240

### `POST /api/santander/import`

Importa arquivo FEBRABAN 240 posições (`.txt`).

**Permissão:** `financeiro.santander.importar`

**Body:** `multipart/form-data`
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `file` | File | Arquivo .txt FEBRABAN 240 |
| `credential_id` | string | UUID da credencial |
| `account_id` | string | UUID da conta local |
| `preview` | boolean | Se `true`, retorna preview sem salvar |

**Response 200:**
```json
{
  "total_registros": 95,
  "total_importado": 88,
  "total_duplicado": 7,
  "total_erro": 0,
  "preview": false,
  "movimentos": [...]
}
```

---

## 6. Conciliação

### `POST /api/santander/conciliar`

Associa um movimento Santander a um lançamento do Livro Caixa.

**Permissão:** `financeiro.santander.conciliar`

**Body:**
```json
{
  "santander_movimento_id": "uuid",
  "livro_caixa_id": 1234,
  "tipo_match": "manual",
  "observacao": "Conciliado manualmente — dízimo da célula 12"
}
```

**Response 200:**
```json
{
  "conciliacao_id": "uuid",
  "santander_movimento_id": "uuid",
  "livro_caixa_id": 1234,
  "tipo_match": "manual",
  "conciliado_por": "usuario@email.com",
  "conciliado_em": "2026-06-10T11:00:00Z"
}
```

### `DELETE /api/santander/conciliar/:id`

Desfaz uma conciliação.

**Permissão:** `financeiro.santander.conciliar`

**Response 200:**
```json
{ "message": "Conciliação desfeita com sucesso" }
```

---

## 7. Lançar no Livro Caixa

### `POST /api/santander/lancar`

Insere um movimento Santander como lançamento no Livro Caixa.

**Permissão:** `financeiro.santander.lancar_livro_caixa`

**Body:**
```json
{
  "santander_movimento_id": "uuid",
  "church_id": "IGR-0042",
  "plano_de_conta": "RECEITA_DIZIMO",
  "centro_de_custo": "GERAL",
  "favorecido_nome": "Fiel João Silva",
  "favorecido_tipo": "MEMBRO",
  "forma_pagamento": "PIX",
  "observacao": "Dízimo via PIX — Santander | 0001.000010331607 | PIX RECEBIDO",
  "data_referencia": "06/2026"
}
```

**Processamento (backend):**
1. Valida permissão
2. Busca movimento Santander e confirma que não está `lancado` ou `ignorado`
3. Verifica `cash_status` da church para o período
4. INSERT em `livro_caixa` com dados do movimento + ajustes do usuário
5. UPDATE `santander_movimentos.livro_caixa_id` e `status = 'lancado'`
6. INSERT em `santander_conciliacoes` com `tipo_match = 'automatico'`
7. INSERT em log de auditoria

**Response 201:**
```json
{
  "livro_caixa_id": 5678,
  "santander_movimento_id": "uuid",
  "conciliacao_id": "uuid",
  "message": "Movimento lançado no Livro Caixa com sucesso"
}
```

---

## 8. Exportação de Relatórios

### `GET /api/santander/export`

Gera relatório em PDF ou CSV.

**Permissão:** `financeiro.santander.exportar`

**Query Params:**
| Param | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-----------|
| `type` | string | Sim | `'espelho_santander'`, `'espelho_livro_caixa'`, `'conciliacao'` |
| `credential_id` | uuid | Sim | ID da credencial |
| `account_id` | uuid | Sim | ID da conta |
| `from` | string | Sim | Data início (YYYY-MM-DD) |
| `to` | string | Sim | Data fim (YYYY-MM-DD) |
| `format` | string | Não | `'pdf'` (padrão) ou `'csv'` |

**Response 200:** Arquivo binário (PDF ou CSV) com header `Content-Disposition: attachment`.

---

## 9. Logs de Auditoria

### `GET /api/santander/audit-logs`

Consulta logs de sincronização e auditoria.

**Permissão:** `financeiro.santander.auditoria`

**Query Params:**
| Param | Tipo | Descrição |
|-------|------|-----------|
| `credential_id` | uuid | Filtrar por credencial |
| `account_id` | string | Filtrar por conta |
| `from` | string | Data início |
| `to` | string | Data fim |
| `status` | string | `'sucesso'`, `'erro'`, `'parcial'` |

**Response 200:**
```json
{
  "logs": [
    {
      "id": "uuid",
      "account_id": "0001.000010331607",
      "data_inicio": "2026-06-01",
      "data_fim": "2026-06-10",
      "status": "sucesso",
      "total_importado": 88,
      "total_duplicado": 7,
      "source": "api",
      "started_at": "2026-06-10T10:00:00Z",
      "finished_at": "2026-06-10T10:00:12Z",
      "created_by": "admin@campo.com"
    }
  ]
}
```

> **Segurança:** `raw_error` é retornado apenas para perfil `master` ou `admin`.

---

## 10. Códigos de Erro Específicos

| Código | HTTP | Descrição |
|--------|------|-----------|
| `SANTANDER_AUTH_FAILED` | 401 | Falha na autenticação com a API Santander |
| `SANTANDER_CERT_EXPIRED` | 400 | Certificado vencido ou inválido |
| `SANTANDER_RATE_LIMIT` | 429 | Rate limit interno excedido |
| `SANTANDER_ACCOUNT_NOT_FOUND` | 404 | Conta não encontrada na API |
| `MOVIMENTO_ALREADY_LANCADO` | 409 | Movimento já foi lançado no Livro Caixa |
| `MOVIMENTO_IGNORADO` | 409 | Movimento está marcado como ignorado |
| `CASH_STATUS_FECHADO` | 422 | Período do Livro Caixa fechado para a igreja |
| `DUPLICATE_HASH` | 409 | Movimento já importado (hash duplicado) |
| `CREDENTIAL_NOT_FOUND` | 404 | Credencial não encontrada ou sem permissão |
| `FEBRABAN_PARSE_ERROR` | 422 | Arquivo FEBRABAN 240 inválido |
