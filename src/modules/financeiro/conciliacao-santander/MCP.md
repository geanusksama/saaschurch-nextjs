# MCP.md — Contrato para Agentes MCP
## Módulo de Conciliação Bancária Santander

**Versão:** 1.0.0  
**Data:** 2026-06-10

Este documento define como qualquer agente MCP (Model Context Protocol) deve interagir com o módulo de Conciliação Bancária Santander sem quebrar o sistema.

---

## 1. Contexto do Módulo

O módulo Santander é um sistema financeiro crítico que:
- Gerencia credenciais bancárias criptografadas
- Consulta dados bancários reais em produção
- Altera registros financeiros vinculados ao Livro Caixa
- É auditado pelo Banco Santander

**Classificação de risco:** ALTO — qualquer operação incorreta pode causar duplicidade de lançamentos, exposição de credenciais ou falha em auditoria bancária.

---

## 2. O que o Agente PODE fazer

### 2.1 Leitura (READ ONLY — Seguro)

```
GET /api/santander/credentials       → listar credenciais (sem secrets)
GET /api/santander/accounts          → listar contas cadastradas
GET /api/santander/transactions      → listar movimentos importados (sem buscar na API)
GET /api/santander/audit-logs        → consultar logs de sincronização
```

**Regra:** Operações de leitura são seguras desde que o agente tenha token de usuário válido com as permissões adequadas.

### 2.2 Relatórios (READ ONLY — Seguro)

```
GET /api/santander/export?type=espelho_santander&...
GET /api/santander/export?type=conciliacao&...
```

### 2.3 Sugestão de Ações (recomendado — não executar)

O agente pode analisar movimentos e sugerir ao usuário:
- Quais movimentos têm match com o Livro Caixa
- Quais movimentos precisam ser lançados
- Diferenças entre banco e sistema

---

## 3. O que o Agente NÃO DEVE fazer

| Ação Proibida | Motivo |
|---------------|--------|
| Cadastrar ou editar credenciais Santander | Risco de comprometimento de acesso bancário |
| Acionar sincronização com API Santander em produção sem confirmação do usuário | Pode atingir rate limit e gerar log de auditoria falso |
| Inserir movimentos diretamente no Livro Caixa | Duplicidade de lançamentos financeiros |
| Conciliar movimentos automaticamente sem revisão humana | Conciliação incorreta é difícil de reverter |
| Acessar ou descriptografar Client Secret | Violação de segurança grave |
| Acessar ou ler chave privada do certificado | Violação de segurança grave |
| Deletar movimentos ou credenciais | Perda de dados auditáveis |
| Alterar status de movimentos diretamente no banco | Deve passar pelas APIs com log de auditoria |
| Chamar a API Santander diretamente (bypassando o backend) | Violação do isolamento de token e mTLS |

---

## 4. Tabelas que o Agente pode Consultar

```sql
-- Seguro para leitura
SELECT id, empresa_id, apelido, ambiente, bank_id, ativo, certificate_expires_at
FROM santander_credentials
WHERE campo = '{campo_do_usuario}';
-- NUNCA selecionar: client_secret_encrypted, client_secret_iv, certificate_private_ref

SELECT id, branch_code, account_number, display_name, igreja_id, ativa
FROM santander_accounts
WHERE credential_id = '{credential_id}';

SELECT id, transaction_date, amount, credit_debit_type, transaction_name,
       category_code, history_description, document_number, status, source,
       livro_caixa_id, created_at
FROM santander_movimentos
WHERE santander_account_id = '{account_id}'
  AND transaction_date BETWEEN '{from}' AND '{to}';
-- NUNCA selecionar: raw_payload (pode ter dados sensíveis) sem permissão de auditoria

SELECT * FROM santander_sync_logs WHERE credential_id = '{credential_id}';
-- NUNCA selecionar raw_error sem permissão de auditoria
```

---

## 5. Tabelas que o Agente NÃO PODE Consultar

```
santander_credentials.client_secret_encrypted  → PROIBIDO
santander_credentials.client_secret_iv         → PROIBIDO
santander_credentials.certificate_private_ref  → PROIBIDO
santander_movimentos.raw_payload               → apenas com permissão auditoria
santander_sync_logs.raw_error                  → apenas com permissão auditoria
```

---

## 6. Fluxo Correto para Agente Executar Ações

Quando o usuário pede ao agente para realizar uma ação de escrita, o agente deve:

1. **Verificar permissão do usuário:** confirmar que o usuário tem a permissão necessária
2. **Descrever a ação ao usuário:** explicar o que será feito e quais dados serão alterados
3. **Solicitar confirmação explícita:** aguardar resposta do usuário
4. **Chamar o endpoint interno** (não o banco diretamente)
5. **Confirmar o resultado ao usuário**

### Exemplo — Lançar no Livro Caixa

```
❌ ERRADO: Agente chama POST /api/santander/lancar sem confirmação
✅ CORRETO:
  1. "Encontrei o movimento PIX de R$ 500,00 de 05/06/2026 da conta 0001.****1607."
  2. "Posso lançar como RECEITA - DÍZIMO no Livro Caixa da Igreja Central?"
  3. Usuário confirma: "Sim"
  4. Agente chama POST /api/santander/lancar
  5. Agente confirma: "Lançamento realizado com sucesso. ID: 5678."
```

---

## 7. Parâmetros Obrigatórios por Operação

| Operação | Parâmetros obrigatórios |
|----------|------------------------|
| Listar movimentos | `credential_id`, `account_id`, `from`, `to` |
| Consultar saldo | `credential_id`, `account_id` |
| Lançar no Livro Caixa | `santander_movimento_id`, `church_id`, `plano_de_conta` |
| Conciliar | `santander_movimento_id`, `livro_caixa_id` |
| Exportar relatório | `type`, `credential_id`, `account_id`, `from`, `to` |

---

## 8. Resposta de Erro Esperada

Todos os endpoints retornam erros no formato:

```json
{
  "error": "Descrição do erro sem secrets",
  "code": "SANTANDER_AUTH_FAILED"
}
```

O agente deve tratar os seguintes códigos:

| Código | Ação do Agente |
|--------|---------------|
| `SANTANDER_AUTH_FAILED` | Informar usuário que credenciais precisam ser verificadas. NÃO tentar reautenticar automaticamente. |
| `SANTANDER_CERT_EXPIRED` | Informar que certificado está vencido. Orientar contato com admin. |
| `SANTANDER_RATE_LIMIT` | Aguardar 10 segundos antes de tentar novamente. Máximo 3 tentativas. |
| `MOVIMENTO_ALREADY_LANCADO` | Informar que o movimento já foi lançado. Não tentar novamente. |
| `CASH_STATUS_FECHADO` | Informar que o período está fechado. Orientar abertura pelo gestor. |
| `403` | Informar que o usuário não tem permissão para esta operação. |

---

## 9. Identificadores de Conta

Para referenciar uma conta bancária Santander:

```
account_id (interno, UUID): referência ao registro em santander_accounts
statement_id (Santander): formato "{branch_code}.{account_number}" — 4 + "." + 12 chars
Ex: "0001.000010331607"
```

O agente deve usar sempre `account_id` (UUID) ao chamar APIs internas.  
O `statement_id` é montado pelo backend automaticamente.

---

## 10. Ambiente e Configuração

O agente deve verificar qual ambiente está ativo antes de qualquer ação:

```
ambiente = 'sandbox'   → chamadas vão para trust-sandbox.api.santander.com.br (dados fictícios)
ambiente = 'producao'  → chamadas vão para trust-open.api.santander.com.br (dados reais)
```

Em ambiente `sandbox`: agente pode sugerir testes livremente.  
Em ambiente `producao`: exigir confirmação dobrada antes de qualquer escrita.
