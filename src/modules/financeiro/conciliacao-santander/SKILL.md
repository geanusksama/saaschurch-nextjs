# SKILL.md — Skill do Módulo
## Módulo de Conciliação Bancária Santander

**Versão:** 1.0.0  
**Data:** 2026-06-10

---

## Quando usar esta skill

Use esta skill quando o usuário mencionar qualquer um dos seguintes contextos:

- Extrato bancário Santander
- Conciliação bancária
- Livro Caixa x banco
- Movimentos bancários das igrejas
- Importação de extrato
- FEBRABAN 240
- Diferença entre banco e sistema
- Saldo Santander
- Credenciais da API Santander
- Lançamento automático do banco no sistema

---

## O que este módulo faz

O módulo Santander conecta o MRM Church CRM diretamente à API Santander para:

1. **Consultar extratos bancários** de até 70+ contas, uma por igreja
2. **Armazenar movimentos** na tabela `santander_movimentos` sem duplicidade
3. **Comparar** movimentos bancários com lançamentos do Livro Caixa
4. **Sugerir conciliação** automática por valor, data e tipo
5. **Transformar movimentos** bancários em lançamentos do Livro Caixa com um clique
6. **Gerar relatórios** de espelho e conciliação em PDF/CSV

---

## Tabelas para Consultar

### Para verificar status de uma conta bancária

```sql
SELECT sa.branch_code, sa.account_number, sa.display_name, sa.ativa
FROM santander_accounts sa
JOIN santander_credentials sc ON sc.id = sa.credential_id
WHERE sc.campo = '{campo_do_usuario}'
  AND sa.ativa = true;
```

### Para listar movimentos importados de um período

```sql
SELECT 
  transaction_date,
  amount,
  credit_debit_type,
  transaction_name,
  category_code,
  history_description,
  document_number,
  status,
  livro_caixa_id
FROM santander_movimentos
WHERE santander_account_id = '{account_uuid}'
  AND transaction_date BETWEEN '{from}' AND '{to}'
ORDER BY transaction_date DESC;
```

### Para verificar conciliações

```sql
SELECT 
  sm.transaction_date,
  sm.amount,
  sm.credit_debit_type,
  sm.status,
  sc.tipo_match,
  sc.score_match,
  sc.conciliado_por,
  sc.conciliado_em
FROM santander_movimentos sm
LEFT JOIN santander_conciliacoes sc ON sc.santander_movimento_id = sm.id AND sc.status = 'ativo'
WHERE sm.santander_account_id = '{account_uuid}'
  AND sm.transaction_date BETWEEN '{from}' AND '{to}';
```

### Para verificar movimentos sem lançamento no Livro Caixa

```sql
SELECT COUNT(*), SUM(CASE WHEN credit_debit_type = 'C' THEN amount ELSE 0 END) as total_credito
FROM santander_movimentos
WHERE santander_account_id = '{account_uuid}'
  AND status = 'sem_lancamento'
  AND transaction_date BETWEEN '{from}' AND '{to}';
```

### Para verificar último sync

```sql
SELECT status, total_importado, total_duplicado, started_at, finished_at, created_by
FROM santander_sync_logs
WHERE credential_id = '{credential_uuid}'
ORDER BY started_at DESC
LIMIT 5;
```

---

## Como Importar Extrato

1. **Via API** (caminho principal):
   ```
   GET /api/santander/transactions?credential_id=X&account_id=Y&from=2026-06-01&to=2026-06-30
   ```
   O backend busca efetivados + provisionados, pagina automaticamente, deduplica e salva.

2. **Via FEBRABAN 240** (fallback):
   ```
   POST /api/santander/import
   Body: FormData com arquivo .txt e credential_id + account_id
   ```

---

## Como Conciliar

### Conciliação Automática (sugerida pelo sistema)

O sistema compara:
- Valor exatamente igual
- Tipo D/C correspondente ao tipo RECEITA/DESPESA
- Data igual ou dentro da tolerância configurada (padrão: 2 dias)
- Histórico/documento como critério secundário

Score de match:
- `>= 90` → match_exato → conciliação automática
- `60-89` → match_sugerido → aguarda confirmação do usuário
- `< 60` → sem_lancamento → precisa de intervenção manual

### Conciliação Manual

```
POST /api/santander/conciliar
Body: { santander_movimento_id, livro_caixa_id, tipo_match: "manual" }
```

---

## Como Inserir no Livro Caixa

```
POST /api/santander/lancar
Body: {
  santander_movimento_id,
  church_id,
  plano_de_conta,    // obrigatório
  centro_de_custo,   // opcional
  favorecido_nome,   // opcional — pré-preenchido pelo frontend
  forma_pagamento,   // opcional — inferido da categoria
  observacao         // gerado automaticamente com referência Santander
}
```

**Mapeamento automático de categoria → plano de conta:**

| Categoria FEBRABAN | Tipo | Sugestão de Plano |
|-------------------|------|-------------------|
| 218 (Pgto Diversos crédito) | RECEITA | RECEITA_OFERTA |
| 219 (Recebimento Salário) | RECEITA | RECEITA_DIZIMO |
| 209 (TED/DOC crédito) | RECEITA | RECEITA_TRANSFERENCIA |
| 112 (Pgto Fornecedores débito) | DESPESA | DESPESA_FORNECEDOR |
| 113 (Pgto Salário débito) | DESPESA | DESPESA_PESSOAL |
| 120 (TED/DOC débito) | DESPESA | DESPESA_TRANSFERENCIA |
| 126 (Tributos) | DESPESA | DESPESA_TRIBUTO |

---

## O que NUNCA fazer

1. **Nunca** acessar `client_secret_encrypted` ou `client_secret_iv` e retornar ao frontend
2. **Nunca** ler ou retornar `certificate_private_ref` como conteúdo de chave
3. **Nunca** chamar a API Santander diretamente sem passar pelo `santander-auth.service`
4. **Nunca** inserir em `livro_caixa` sem verificar `cash_status` da church primeiro
5. **Nunca** marcar `status = 'lancado'` manualmente no banco — use a API `/lancar`
6. **Nunca** alterar ou deletar `santander_conciliacoes` — use a API `/conciliar/:id`
7. **Nunca** ignorar a deduplicação por hash — evita lançamentos duplos
8. **Nunca** usar tolerância de datas > 7 dias para match automático
9. **Nunca** logar o Access Token Santander
10. **Nunca** burlar as permissões RBAC do módulo

---

## Campos de Referência Cruzada

| Campo Santander | Campo Livro Caixa | Observação |
|----------------|------------------|------------|
| `transaction_date` | `data_lancamento` | Usar mesma data ou ajustar manualmente |
| `amount` | `valor` | Mesmo valor |
| `credit_debit_type = 'C'` | `tipo = 'RECEITA'` | Mapeamento direto |
| `credit_debit_type = 'D'` | `tipo = 'DESPESA'` | Mapeamento direto |
| `history_description` | `observacao` (parte) | Incluir na observação |
| `document_number` | `numero_documento` | Quando disponível |
| `id` (UUID) | — | Referenciado em `santander_movimentos.livro_caixa_id` |

---

## Identificadores Importantes

| Identificador | Formato | Exemplo |
|--------------|---------|---------|
| `bank_id` | CNPJ 14 dígitos | `90400888000142` (Santander) |
| `balance_id` / `statement_id` | agência.conta | `0001.000010331607` |
| `transaction_id` (API Santander) | agência.conta | `0001.000010331607` |
| `credential_id` (interno) | UUID | `uuid-v4` |
| `account_id` (interno) | UUID | `uuid-v4` |
