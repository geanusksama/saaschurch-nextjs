# SDD.md — Software Design Document
## Módulo de Conciliação Bancária Santander

**Versão:** 1.0.0  
**Data:** 2026-06-10

---

## 1. Arquitetura Técnica

O módulo segue a arquitetura existente do MRM (Next.js App Router + React SPA), com camadas bem definidas e sem acoplamento ao Livro Caixa existente.

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React SPA)                  │
│   ConciliacaoSantander.tsx + componentes auxiliares      │
└────────────────────────┬────────────────────────────────┘
                         │ fetch via apiBase
┌────────────────────────▼────────────────────────────────┐
│               NEXT.JS API ROUTES (Backend)               │
│         /api/santander/* — protegidas por withAuth()     │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│              BACKEND SERVICE (conciliacao.service.ts)    │
│   Orquestra chamadas entre Santander API e banco local   │
└──────────┬─────────────────────────────────┬────────────┘
           │                                 │
┌──────────▼───────────┐       ┌─────────────▼────────────┐
│  Santander Services  │       │  Repositories (Prisma)   │
│  • auth.service      │       │  • credentials.repo      │
│  • accounts.service  │       │  • accounts.repo         │
│  • balance.service   │       │  • movimentos.repo       │
│  • transactions      │       │  • conciliacoes.repo     │
│  • token-cache       │       └──────────────────────────┘
│  • certificate       │
└──────────┬───────────┘
           │ HTTPS + mTLS
┌──────────▼───────────┐
│   API SANTANDER       │
│   trust-open.api...   │
│   (OAuth2 + mTLS)     │
└──────────────────────┘
```

---

## 2. Componentes

### 2.1 Frontend

| Componente | Responsabilidade |
|------------|-----------------|
| `ConciliacaoSantander.tsx` | Container principal, orquestra estado e chamadas |
| `SantanderFilters.tsx` | Filtros de data, conta, tipo, status |
| `SantanderSummaryCards.tsx` | Cards de resumo: créditos, débitos, saldo, diferença |
| `SantanderTable.tsx` | Tabela de movimentos Santander com ações |
| `LivroCaixaTable.tsx` | Tabela de lançamentos do Livro Caixa do mesmo período |
| `LancarNoLivroCaixaModal.tsx` | Modal pré-preenchido para inserir no Livro Caixa |
| `ConciliacaoManualModal.tsx` | Modal para associar manualmente um movimento a um lançamento |

### 2.2 API Routes (Next.js)

| Rota | Método | Responsabilidade |
|------|--------|-----------------|
| `/api/santander/credentials` | GET, POST, PUT | CRUD de credenciais |
| `/api/santander/accounts` | GET | Listar contas (local + sync Santander) |
| `/api/santander/balance` | GET | Consultar saldo de uma conta |
| `/api/santander/transactions` | GET | Consultar e importar extrato |
| `/api/santander/import` | POST | Importar arquivo FEBRABAN 240 |
| `/api/santander/conciliar` | POST | Conciliar movimento com lançamento |
| `/api/santander/lancar` | POST | Inserir movimento no Livro Caixa |
| `/api/santander/export` | GET | Exportar relatórios PDF/CSV |

### 2.3 Santander Services

| Service | Responsabilidade |
|---------|-----------------|
| `santander-auth.service.ts` | OAuth2 client_credentials + mTLS, renovação de token |
| `santander-accounts.service.ts` | GET listagem de contas, paginação, sync local |
| `santander-balance.service.ts` | GET saldo por balance_id |
| `santander-transactions.service.ts` | GET efetivados + provisionados, paginação, normalização |
| `santander-token-cache.service.ts` | Cache em memória com TTL 14 min (1 min de margem) |
| `santander-certificate.service.ts` | Validar cert, verificar vencimento, carregar PEM |

### 2.4 FEBRABAN 240 Services

| Service | Responsabilidade |
|---------|-----------------|
| `febraban240-parser.service.ts` | Ler arquivo .txt linha por linha, extrair campos por posição |
| `febraban240-validator.service.ts` | Validar estrutura (header, lote, detalhe, trailer) |
| `febraban240-mapper.service.ts` | Mapear campos do layout para DTO `SantanderMovimentoDto` |

---

## 3. Camadas

```
Frontend → API Routes → Backend Service → Santander Services / Repositories → Banco / API Santander
```

**Regra:** Nenhuma camada inferior conhece nada da camada superior.  
**Regra:** Santander Services nunca acessam banco diretamente — apenas Repositories fazem isso.  
**Regra:** Frontend nunca recebe token, Client Secret ou chave privada.

---

## 4. Fluxo de Autenticação Santander

```
1. Backend Service chama santander-token-cache.service.getToken(credentialId)
2. Token-cache verifica se há token válido em memória (TTL = 14 min)
3. Se não há token ou está expirado:
   a. Carrega Client Secret descriptografado (AES-256)
   b. Carrega certificado privado (referência segura)
   c. Envia POST https://trust-open.api.santander.com.br/auth/oauth/v2/token
      - Body: client_id, client_secret, grant_type=client_credentials
      - mTLS: certificado no agente TLS (não no body)
   d. Recebe access_token (JWT) com expiração de 900s (15 min)
   e. Armazena em cache com TTL = 840s (14 min)
4. Retorna access_token para o chamador
5. Chamador inclui no header: Authorization: Bearer {token}
                              X-Application-Key: {client_id}
```

**Ambiente Sandbox:**
- Token URL: `https://trust-sandbox.api.santander.com.br/auth/oauth/v2/token`
- API base: `https://trust-sandbox.api.santander.com.br`

**Ambiente Produção:**
- Token URL: `https://trust-open.api.santander.com.br/auth/oauth/v2/token`
- API base: `https://trust-open.api.santander.com.br`

---

## 5. Fluxo de Consulta de Extrato

```
1. Frontend envia GET /api/santander/transactions?credentialId=X&accountId=Y&from=2026-01-01&to=2026-01-31
2. API Route valida token JWT do usuário e permissão financeiro.santander.consultar
3. Backend Service:
   a. Carrega credential + account do banco
   b. Monta transaction_id = "{branch_code}.{account_number_padded}"
   c. Chama santander-transactions.service.getEffective(transaction_id, from, to)
   d. Chama santander-transactions.service.getProvisioned(transaction_id, from, to)
   e. Unifica e normaliza os resultados
   f. Para cada movimento: gera hash_unico
   g. Verifica duplicidade no banco
   h. Insere novos em santander_movimentos
   i. Registra santander_sync_logs
4. Retorna lista de movimentos + totais
```

---

## 6. Fluxo de Gravação no Banco

```
1. Recebe lista normalizada de movimentos
2. Para cada movimento:
   a. Gera hash = sha256(account_id + transaction_date + amount + credit_debit_type + document_number + history_code)
   b. Busca existente por (santander_account_id, hash_unico)
   c. Se NÃO existe: INSERT em santander_movimentos com status='novo'
   d. Se existe: log como duplicado, não insere
3. Registra log em santander_sync_logs com contadores
```

---

## 7. Fluxo de Conciliação

```
1. Backend carrega movimentos Santander com status='novo' do período
2. Carrega lançamentos do Livro Caixa do mesmo período e conta
3. Para cada movimento Santander:
   a. Filtra lançamentos por tipo (RECEITA/DESPESA conforme D/C)
   b. Filtra lançamentos com valor igual
   c. Verifica data (exata ou dentro da tolerância)
   d. Calcula score de match (0-100)
   e. Se score >= 90: match_exato
   f. Se score >= 60: match_sugerido
   g. Caso contrário: sem_lancamento
4. Retorna sugestões ao frontend
5. Usuário confirma, ajusta ou rejeita
6. Confirma: INSERT em santander_conciliacoes, UPDATE status do movimento
```

---

## 8. Fluxo de Inserção no Livro Caixa

```
1. Usuário clica "Inserir no Livro Caixa" em um movimento
2. Frontend abre LancarNoLivroCaixaModal com dados pré-preenchidos
3. Usuário ajusta: plano_de_conta, centro_de_custo, favorecido, observacao
4. Frontend envia POST /api/santander/lancar
5. API Route:
   a. Valida permissão financeiro.santander.lancar_livro_caixa
   b. Verifica cash_status da church para o período
   c. INSERT em livro_caixa (tabela LivroCaixa existente)
   d. UPDATE santander_movimentos SET livro_caixa_id=X, status='lancado'
   e. INSERT em santander_conciliacoes
   f. INSERT em audit_log
6. Retorna success com livro_caixa_id
```

---

## 9. Paginação da API Santander

```
Listagem de Contas:
  - _limit: 1-50 por página
  - _offset: registro inicial

Extrato Efetivado / Provisionado:
  - _limit: 1-750 por página
  - _nextPage: objeto paging da resposta anterior (cursor)
  - Iterar até _pageable._totalRecords == total coletado
```

---

## 10. Decisões Técnicas

| Decisão | Motivo |
|---------|--------|
| Token em memória (não em banco) | Tokens são efêmeros e não devem persistir; evita vazamento |
| AES-256 para Client Secret | Padrão de mercado para secrets em repouso no banco |
| Hash SHA-256 para deduplicação | Determinístico, rápido, sem colisão prática para esse caso de uso |
| Índice único por hash_unico | Garante deduplicação mesmo sob concorrência (constraint SQL) |
| Módulo isolado sem alterar LivroCaixa | Facilita rollback, auditoria independente, testes isolados |
| Paginação cursor (_nextPage) | Necessário para contas com >750 movimentos/período |
| Rate limit interno 10 TPS | Respeita limite Santander; evitar bloqueio da aplicação |
| FEBRABAN 240 como fallback | Permite importação offline para contas sem API ativa |
