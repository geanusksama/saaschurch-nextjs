# DATABASE.md — Modelo de Dados
## Módulo de Conciliação Bancária Santander

**Versão:** 1.0.0  
**Data:** 2026-06-10  
**Banco:** PostgreSQL (Supabase)  
**ORM:** Prisma

> **Regra:** Todas as tabelas são novas. Nenhuma tabela existente é alterada.

---

## 1. Diagrama de Relacionamento

```
santander_credentials (1)
    └──< santander_accounts (N)
              └──< santander_movimentos (N)
                        └──< santander_conciliacoes (N)
                        └── livro_caixa.id (FK referência)

santander_credentials (1)
    └──< santander_sync_logs (N)
```

---

## 2. Tabela: `santander_credentials`

Armazena as credenciais de acesso à API Santander por empresa/campo.

| Campo | Tipo | Nulo | Descrição |
|-------|------|------|-----------|
| `id` | UUID | NÃO | PK, gerado automaticamente |
| `empresa_id` | VARCHAR(50) | NÃO | Identificador do campo/tenant |
| `campo` | VARCHAR(20) | NÃO | Código do campo (usado no scope) |
| `apelido` | VARCHAR(100) | NÃO | Nome amigável da credencial |
| `ambiente` | VARCHAR(10) | NÃO | `'sandbox'` ou `'producao'` |
| `client_id` | VARCHAR(200) | NÃO | ClientID da aplicação Santander |
| `client_secret_encrypted` | TEXT | NÃO | Client Secret criptografado (AES-256) |
| `client_secret_iv` | VARCHAR(64) | NÃO | IV para descriptografia AES-256 |
| `bank_id` | VARCHAR(14) | NÃO | CNPJ do banco. Ex: `90400888000142` |
| `certificate_public_path` | TEXT | NÃO | Caminho/referência ao certificado público |
| `certificate_private_ref` | TEXT | NÃO | Referência segura à chave privada (não o conteúdo) |
| `certificate_expires_at` | TIMESTAMPTZ | SIM | Data de vencimento do certificado |
| `tolerance_days` | SMALLINT | NÃO | Tolerância em dias para match (padrão: 2) |
| `ativo` | BOOLEAN | NÃO | Se a credencial está ativa |
| `created_at` | TIMESTAMPTZ | NÃO | Data de criação |
| `updated_at` | TIMESTAMPTZ | NÃO | Data de atualização |
| `created_by` | VARCHAR(100) | SIM | Email do usuário que criou |
| `updated_by` | VARCHAR(100) | SIM | Email do último usuário que editou |

**Índices:**
- PK: `id`
- UNIQUE: `(empresa_id, ambiente)` — uma credencial por empresa por ambiente
- INDEX: `campo`

---

## 3. Tabela: `santander_accounts`

Contas bancárias Santander vinculadas a cada credencial.

| Campo | Tipo | Nulo | Descrição |
|-------|------|------|-----------|
| `id` | UUID | NÃO | PK |
| `credential_id` | UUID | NÃO | FK → `santander_credentials.id` |
| `account_id` | VARCHAR(100) | NÃO | accountId retornado pela API |
| `bank_id` | VARCHAR(14) | NÃO | CNPJ do banco |
| `compe_code` | VARCHAR(3) | SIM | Código COMPE do banco |
| `branch_code` | VARCHAR(5) | NÃO | Código da agência (4 dígitos) |
| `account_number` | VARCHAR(12) | NÃO | Número da conta (12 dígitos) |
| `account_digit` | VARCHAR(1) | SIM | Dígito verificador da conta |
| `display_name` | VARCHAR(100) | NÃO | Nome amigável para exibição |
| `igreja_id` | INTEGER | SIM | FK opcional → `church.id` do sistema |
| `ativa` | BOOLEAN | NÃO | Se a conta está ativa para consulta |
| `created_at` | TIMESTAMPTZ | NÃO | Data de criação |
| `updated_at` | TIMESTAMPTZ | NÃO | Data de atualização |

**Campo derivado (não armazenado):**
- `statement_id` = `LPAD(branch_code, 4, '0') + '.' + LPAD(account_number, 12, '0')`
- Ex: `0001.000010331607`

**Índices:**
- PK: `id`
- INDEX: `credential_id`
- UNIQUE: `(credential_id, branch_code, account_number)`
- INDEX: `igreja_id`

---

## 4. Tabela: `santander_movimentos`

Movimentos bancários importados da API ou arquivo FEBRABAN 240.

| Campo | Tipo | Nulo | Descrição |
|-------|------|------|-----------|
| `id` | UUID | NÃO | PK |
| `credential_id` | UUID | NÃO | FK → `santander_credentials.id` |
| `santander_account_id` | UUID | NÃO | FK → `santander_accounts.id` |
| `account_id` | VARCHAR(100) | NÃO | accountId Santander |
| `transaction_id` | VARCHAR(200) | SIM | ID da transação na API |
| `transaction_date` | DATE | NÃO | Data do movimento (YYYY-MM-DD) |
| `accounting_date` | DATE | SIM | Data contábil (YYYY-MM-DD) |
| `amount` | DECIMAL(15,2) | NÃO | Valor do movimento (sempre positivo) |
| `credit_debit_type` | VARCHAR(1) | NÃO | `'C'` = Crédito, `'D'` = Débito |
| `transaction_name` | VARCHAR(200) | SIM | Nome/descrição da transação |
| `category_code` | VARCHAR(3) | SIM | Categoria FEBRABAN (101-127 débito, 201-222 crédito) |
| `history_code` | VARCHAR(4) | SIM | Código de histórico bancário |
| `history_description` | VARCHAR(200) | SIM | Descrição do histórico |
| `document_number` | VARCHAR(50) | SIM | Número do documento |
| `complement` | VARCHAR(200) | SIM | Complemento do histórico |
| `raw_payload` | JSONB | SIM | Payload bruto da API para auditoria |
| `source` | VARCHAR(20) | NÃO | `'api'`, `'febraban'`, `'importacao'` |
| `status` | VARCHAR(25) | NÃO | Ver domínio abaixo |
| `livro_caixa_id` | INTEGER | SIM | FK → `livro_caixa.id` (quando lançado) |
| `hash_unico` | VARCHAR(64) | NÃO | SHA-256 para deduplicação |
| `created_at` | TIMESTAMPTZ | NÃO | Data de criação |
| `updated_at` | TIMESTAMPTZ | NÃO | Data de atualização |
| `imported_by` | VARCHAR(100) | SIM | Email de quem importou |

**Domínio do campo `status`:**
- `novo` — importado, ainda não analisado
- `match_exato` — conciliado automaticamente (match perfeito)
- `match_sugerido` — há lançamento candidato no Livro Caixa
- `sem_lancamento` — não encontrou correspondência
- `sem_movimento_bancario` — apenas no Livro Caixa (movimento virtual)
- `conciliado` — conciliado manualmente pelo usuário
- `ignorado` — marcado para ignorar
- `lancado` — transformado em lançamento no Livro Caixa
- `duplicado` — hash já existia, não inserido novamente

**Índices:**
- PK: `id`
- UNIQUE: `hash_unico` — garante deduplicação
- INDEX: `(santander_account_id, transaction_date)`
- INDEX: `status`
- INDEX: `livro_caixa_id`
- INDEX: `credential_id`

---

## 5. Tabela: `santander_conciliacoes`

Registro das conciliações entre movimentos Santander e lançamentos do Livro Caixa.

| Campo | Tipo | Nulo | Descrição |
|-------|------|------|-----------|
| `id` | UUID | NÃO | PK |
| `santander_movimento_id` | UUID | NÃO | FK → `santander_movimentos.id` |
| `livro_caixa_id` | INTEGER | NÃO | FK → `livro_caixa.id` |
| `tipo_match` | VARCHAR(20) | NÃO | `'automatico'`, `'manual'`, `'sugerido'` |
| `score_match` | SMALLINT | SIM | Score de match 0-100 |
| `status` | VARCHAR(20) | NÃO | `'ativo'`, `'desfeito'` |
| `observacao` | TEXT | SIM | Observação do usuário |
| `conciliado_por` | VARCHAR(100) | NÃO | Email do usuário |
| `conciliado_em` | TIMESTAMPTZ | NÃO | Data/hora da conciliação |
| `created_at` | TIMESTAMPTZ | NÃO | Data de criação |

**Índices:**
- PK: `id`
- INDEX: `santander_movimento_id`
- INDEX: `livro_caixa_id`
- UNIQUE: `(santander_movimento_id, livro_caixa_id)` WHERE status='ativo'

---

## 6. Tabela: `santander_sync_logs`

Log de cada sincronização realizada (importação via API ou arquivo).

| Campo | Tipo | Nulo | Descrição |
|-------|------|------|-----------|
| `id` | UUID | NÃO | PK |
| `credential_id` | UUID | NÃO | FK → `santander_credentials.id` |
| `account_id` | VARCHAR(100) | NÃO | Account consultado |
| `data_inicio` | DATE | NÃO | Início do período consultado |
| `data_fim` | DATE | NÃO | Fim do período consultado |
| `status` | VARCHAR(20) | NÃO | `'sucesso'`, `'erro'`, `'parcial'` |
| `source` | VARCHAR(20) | NÃO | `'api'`, `'febraban'`, `'manual'` |
| `total_importado` | INTEGER | NÃO | Total de movimentos novos inseridos |
| `total_duplicado` | INTEGER | NÃO | Total de duplicados ignorados |
| `total_erro` | INTEGER | NÃO | Total de linhas com erro de parsing |
| `error_message` | TEXT | SIM | Mensagem de erro (sem secrets) |
| `raw_error` | JSONB | SIM | Detalhes do erro para debug |
| `started_at` | TIMESTAMPTZ | NÃO | Início da sincronização |
| `finished_at` | TIMESTAMPTZ | SIM | Fim da sincronização |
| `created_by` | VARCHAR(100) | SIM | Email do usuário que iniciou |

**Índices:**
- PK: `id`
- INDEX: `(credential_id, account_id, data_inicio)`
- INDEX: `status`
- INDEX: `started_at`

---

## 7. Campos de Segurança por Tabela

| Tabela | Campo Sensível | Proteção |
|--------|---------------|----------|
| `santander_credentials` | `client_secret_encrypted` | AES-256, IV separado |
| `santander_credentials` | `certificate_private_ref` | Apenas referência, não o conteúdo |
| `santander_movimentos` | `raw_payload` | JSONB — sem tokens, sem secrets |
| `santander_sync_logs` | `error_message` | Mascarar ClientID/tokens antes de salvar |

---

## 8. Referências SQL

Ver arquivos em `/sql/`:
- `001_create_santander_credentials.sql`
- `002_create_santander_accounts.sql`
- `003_create_santander_movimentos.sql`
- `004_create_santander_conciliacoes.sql`
- `005_create_santander_sync_logs.sql`
