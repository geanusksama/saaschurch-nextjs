# SPEC.md — Especificação Funcional
## Módulo de Conciliação Bancária Santander

**Versão:** 1.0.0  
**Data:** 2026-06-10  
**Status:** Aprovado para desenvolvimento

---

## 1. Problema Atual

O responsável financeiro do MRM Church CRM precisa, mensalmente:

1. Acessar o internet banking Santander conta por conta (mais de 70 contas, uma por igreja);
2. Baixar ou visualizar extratos de cada conta;
3. Comparar manualmente cada lançamento bancário com o Livro Caixa do sistema;
4. Confirmar ou ajustar em planilhas externas;
5. Repetir o processo para todas as contas de todas as igrejas.

**Impacto:** processo lento (horas por semana), sujeito a erro humano, sem rastreabilidade e sem auditoria automática.

---

## 2. Objetivo

Criar um módulo integrado ao MRM que:

- Conecta diretamente à API oficial Santander (OAuth2 + mTLS);
- Consulta contas, saldos e extratos de todas as contas cadastradas;
- Armazena os movimentos bancários em tabela própria (`santander_movimentos`);
- Compara os movimentos do Santander com os lançamentos do Livro Caixa;
- Permite transformar movimentos bancários em lançamentos do Livro Caixa com poucos cliques;
- Gera relatórios de conciliação, espelhos e logs de auditoria completos.

---

## 3. Fluxo do Usuário

### 3.1 Configuração Inicial (Admin Financeiro)
1. Acessa `Financeiro > Configurações > Santander`;
2. Cadastra credenciais: ClientID, Client Secret (criptografado), certificado público e privado;
3. Seleciona ambiente: Sandbox ou Produção;
4. Sistema valida conectividade com a API Santander;
5. Sistema importa lista de contas disponíveis.

### 3.2 Consulta Diária
1. Acessa `Financeiro > Livro Caixa > Banco / Santander`;
2. Seleciona conta bancária, data inicial e data final;
3. Clica em "Buscar no Santander";
4. Sistema busca movimentos efetivados + provisionados;
5. Movimentos são salvos na tabela `santander_movimentos` (sem duplicidade);
6. Tela exibe movimentos Santander e lançamentos do Livro Caixa lado a lado;
7. Cards de resumo mostram totais, diferenças e status de conciliação.

### 3.3 Conciliação
1. Sistema sugere matches automáticos por valor, data e tipo;
2. Usuário confirma, ajusta ou rejeita sugestões;
3. Movimentos sem lançamento no Livro Caixa ficam marcados como `sem_lancamento`;
4. Usuário pode inserir movimento diretamente no Livro Caixa via modal pré-preenchido;
5. Após confirmação, `livro_caixa_id` é gravado em `santander_movimentos`.

### 3.4 Relatórios
1. Acessa `Financeiro > Livro Caixa > Conciliação > Relatórios`;
2. Seleciona tipo: Espelho Santander, Espelho Livro Caixa ou Relatório de Conciliação;
3. Escolhe conta e período;
4. Exporta em PDF ou CSV.

---

## 4. Requisitos Funcionais

| ID | Requisito |
|----|-----------|
| RF01 | Cadastrar credenciais Santander (ClientID, Client Secret, certificados) por tenant |
| RF02 | Suportar ambientes Sandbox e Produção |
| RF03 | Consultar lista de contas bancárias via API Santander |
| RF04 | Consultar saldo por conta e data |
| RF05 | Consultar extrato efetivado por conta e período (paginado, até 750 por página) |
| RF06 | Consultar lançamentos provisionados por conta e período |
| RF07 | Salvar movimentos em `santander_movimentos` sem duplicidade (hash único) |
| RF08 | Exibir tela lado a lado: movimentos Santander x Livro Caixa |
| RF09 | Gerar score de match automático entre movimentos |
| RF10 | Permitir conciliação manual |
| RF11 | Permitir inserção de movimento Santander no Livro Caixa via modal |
| RF12 | Pré-preencher modal com dados do movimento Santander |
| RF13 | Gravar `livro_caixa_id` e atualizar status após inserção |
| RF14 | Registrar log de auditoria em cada ação |
| RF15 | Gerar Espelho Santander (PDF/CSV) |
| RF16 | Gerar Espelho Livro Caixa (PDF/CSV) |
| RF17 | Gerar Relatório de Conciliação (PDF/CSV) |
| RF18 | Importar arquivo FEBRABAN 240 como alternativa à API |
| RF19 | Validar certificado e alertar quando próximo do vencimento |
| RF20 | Suportar renovação automática de token (expiração: 15 min) |

---

## 5. Requisitos Não Funcionais

| ID | Requisito |
|----|-----------|
| RNF01 | Client Secret e chave privada NUNCA devem ser expostos no frontend |
| RNF02 | Client Secret armazenado com AES-256 no banco |
| RNF03 | Token Santander válido apenas no backend, nunca retornado ao cliente |
| RNF04 | Rate limit interno: máximo 10 req/s para API Santander (conforme limite do banco) |
| RNF05 | Logs de auditoria sem exposição de segredos (mascaramento obrigatório) |
| RNF06 | Tempo de resposta da tela: < 3 segundos para consultas locais |
| RNF07 | Suporte a paginação para contas com volume alto de movimentos |
| RNF08 | Módulo separado, sem acoplar regra Santander dentro do Livro Caixa |
| RNF09 | Todas as rotas protegidas por `withAuth()` e validação de permissão |
| RNF10 | Compatível com ambiente multi-tenant (por `empresa_id` / `campo`) |

---

## 6. Regras de Negócio

### RN01 — Deduplicação de Movimentos
- Hash único gerado a partir de: `account_id + transaction_date + amount + credit_debit_type + document_number + history_code`
- Se hash já existir na tabela, movimento é ignorado (status: `duplicado`)
- Log de importação registra `total_duplicado`

### RN02 — Tolerância de Datas na Conciliação
- Match aceita diferença de 0 a 2 dias (configurável por credencial)
- Se data, valor e tipo coincidem: `match_exato`
- Se valor e tipo coincidem mas data difere em até 2 dias: `match_sugerido`

### RN03 — Geração de Status de Conciliação
| Status | Condição |
|--------|----------|
| `match_exato` | Movimento Santander encontrou lançamento exatamente igual no Livro Caixa |
| `match_sugerido` | Encontrou lançamento provável (data ±2 dias) |
| `sem_lancamento` | Existe no Santander, não existe no Livro Caixa |
| `sem_movimento_bancario` | Existe no Livro Caixa, não apareceu no Santander |
| `duplicado` | Movimento já importado anteriormente (mesmo hash) |
| `ignorado` | Usuário marcou manualmente para ignorar |
| `lancado` | Movimento Santander já virou lançamento no Livro Caixa |

### RN04 — Inserção no Livro Caixa
- Crédito Santander → sugerir tipo `RECEITA`
- Débito Santander → sugerir tipo `DESPESA`
- Campo `observacao` deve conter referência: `"Santander | {transaction_id} | {history_description}"`
- Após inserção: gravar `livro_caixa_id`, atualizar `status = 'lancado'`, criar registro em `santander_conciliacoes`

### RN05 — Permissões
- Somente perfis com `financeiro.santander.configurar` podem cadastrar/editar credenciais
- Usuários sem `financeiro.santander.consultar` não podem buscar na API Santander
- Perfil `church` pode consultar apenas contas vinculadas à sua igreja
- Perfil `campo` pode consultar todas as contas do seu campo

### RN06 — Certificado
- Sistema alerta quando `certificate_expires_at` < 30 dias
- API nega consulta se certificado vencido
- Certificado privado nunca é retornado em nenhuma API response

### RN07 — Automação
- Sincronização automática não é ativada por padrão
- Somente admin financeiro pode ativar jobs de sincronização
- Falha de autenticação gera alerta imediato ao responsável

---

## 7. Telas

### 7.1 Configurações Santander
- Rota: `/financeiro/configuracoes/santander`
- Campos: ClientID, Client Secret (mascarado), certificado público (upload), certificado privado (upload seguro), ambiente, bank_id, ativo
- Botão: Testar Conectividade
- Botão: Importar Contas

### 7.2 Banco / Santander (Livro Caixa)
- Rota: `/financeiro/livro-caixa/banco`
- Layout: filtros + cards resumo + tabela Santander + tabela Livro Caixa + painel lateral

### 7.3 Modal Inserir no Livro Caixa
- Pré-preenchido com dados do movimento Santander
- Campos editáveis: plano de conta, centro de custo, favorecido, observação

### 7.4 Modal Conciliação Manual
- Lista movimentos candidatos do Livro Caixa para o mesmo período
- Score de match exibido para cada candidato

---

## 8. Permissões por Perfil

| Permissão | master | admin | campo | tesoureiro | secretaria |
|-----------|--------|-------|-------|------------|------------|
| visualizar | ✓ | ✓ | ✓ | ✓ | — |
| configurar | ✓ | ✓ | — | — | — |
| consultar | ✓ | ✓ | ✓ | ✓ | — |
| importar | ✓ | ✓ | ✓ | ✓ | — |
| conciliar | ✓ | ✓ | ✓ | ✓ | — |
| lancar_livro_caixa | ✓ | ✓ | ✓ | ✓ | — |
| ignorar | ✓ | ✓ | ✓ | — | — |
| exportar | ✓ | ✓ | ✓ | ✓ | — |
| auditoria | ✓ | ✓ | — | — | — |

---

## 9. Critérios de Aceite

- [ ] Credenciais Santander podem ser cadastradas com segurança (Client Secret nunca exposto)
- [ ] Sistema consulta lista de contas Santander
- [ ] Sistema consulta saldo por conta
- [ ] Sistema consulta extrato por conta e período com paginação correta
- [ ] Movimentos são salvos sem duplicidade (hash único funciona)
- [ ] Aba "Banco" aparece dentro do Livro Caixa sem quebrar abas existentes
- [ ] Usuário consegue comparar Santander x Livro Caixa lado a lado
- [ ] Sistema mostra diferenças com status correto
- [ ] Usuário consegue transformar movimento em lançamento do Livro Caixa
- [ ] Sistema registra conciliação com usuário e data
- [ ] Sistema gera Espelho Santander em PDF/CSV
- [ ] Sistema gera Espelho Livro Caixa em PDF/CSV
- [ ] Sistema gera Relatório de Conciliação em PDF/CSV
- [ ] Todos os documentos SPEC, SDD, MCP, SKILL, API, DATABASE, SECURITY e ROADMAP estão criados
- [ ] Nenhum fluxo antigo do Livro Caixa foi quebrado
- [ ] Nenhum segredo é exposto em logs ou respostas de API
