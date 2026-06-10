# ROADMAP.md — Roadmap por Fases
## Módulo de Conciliação Bancária Santander

**Versão:** 1.0.0  
**Data:** 2026-06-10

---

## Fase 1 — Documentação e Modelagem ✅

**Objetivo:** Criar toda a base documental e estrutura do módulo antes de qualquer código.

- [x] SPEC.md — Especificação funcional completa
- [x] SDD.md — Design técnico e arquitetura
- [x] DATABASE.md — Modelo de dados
- [x] API.md — Endpoints internos
- [x] SECURITY.md — Segurança e auditoria
- [x] MCP.md — Contrato para agentes
- [x] SKILL.md — Skill do módulo
- [x] ROADMAP.md — Este arquivo
- [x] Estrutura de pastas criada
- [x] SQL migrations criadas

**Entrega:** Documentação aprovada para revisão de segurança.

---

## Fase 2 — Credenciais Santander

**Objetivo:** Permitir cadastro seguro de credenciais e conectividade com a API Santander.

- [ ] Tabela `santander_credentials` criada no banco
- [ ] Service `santander-certificate.service.ts` — validação e carregamento de cert
- [ ] Service `santander-auth.service.ts` — OAuth2 + mTLS
- [ ] Service `santander-token-cache.service.ts` — cache em memória
- [ ] Repository `santander-credentials.repository.ts`
- [ ] API Route `POST /api/santander/credentials`
- [ ] API Route `GET /api/santander/credentials`
- [ ] API Route `PUT /api/santander/credentials/:id`
- [ ] Tela de configuração de credenciais
- [ ] Botão "Testar Conectividade"
- [ ] Alerta de certificado próximo do vencimento (< 30 dias)

**Critério de aceite:** Conseguir gerar e renovar token com a API Santander.

---

## Fase 3 — Consulta de Contas, Saldos e Extrato

**Objetivo:** Consultar dados bancários reais e armazená-los localmente.

- [ ] Tabela `santander_accounts` criada
- [ ] Tabela `santander_movimentos` criada
- [ ] Tabela `santander_sync_logs` criada
- [ ] Service `santander-accounts.service.ts`
- [ ] Service `santander-balance.service.ts`
- [ ] Service `santander-transactions.service.ts` (efetivados + provisionados + paginação)
- [ ] Repository `santander-accounts.repository.ts`
- [ ] Repository `santander-movimentos.repository.ts`
- [ ] API Route `GET /api/santander/accounts`
- [ ] API Route `GET /api/santander/balance`
- [ ] API Route `GET /api/santander/transactions`
- [ ] Deduplicação por hash_unico
- [ ] Log em `santander_sync_logs`

**Critério de aceite:** Extrato de qualquer conta é consultado, salvo localmente sem duplicidade.

---

## Fase 4 — Tela Banco no Livro Caixa

**Objetivo:** Criar a interface visual para o usuário interagir com os dados Santander.

- [ ] Nova aba "Banco / Santander" no Livro Caixa
- [ ] `SantanderFilters.tsx` — filtros de data, conta, tipo, status
- [ ] `SantanderSummaryCards.tsx` — cards de resumo
- [ ] `SantanderTable.tsx` — tabela de movimentos Santander
- [ ] `LivroCaixaTable.tsx` — tabela de lançamentos do mesmo período
- [ ] `ConciliacaoSantander.tsx` — container principal
- [ ] Botão "Buscar no Santander"
- [ ] Botão "Importar movimentos"
- [ ] Botão "Comparar com Livro Caixa"
- [ ] Botão "Imprimir espelho"
- [ ] Painel lateral de detalhes do movimento

**Critério de aceite:** Usuário consegue visualizar movimentos Santander e Livro Caixa lado a lado.

---

## Fase 5 — Importação FEBRABAN 240

**Objetivo:** Criar alternativa de importação via arquivo para contas sem API ativa.

- [ ] `febraban240-parser.service.ts` — leitura por posição das 240 colunas
- [ ] `febraban240-validator.service.ts` — validação de estrutura
- [ ] `febraban240-mapper.service.ts` — mapeamento para DTO
- [ ] API Route `POST /api/santander/import`
- [ ] Componente de upload de arquivo na tela
- [ ] Preview dos registros antes de confirmar importação

**Critério de aceite:** Arquivo FEBRABAN 240 é importado e movimentos são salvos na mesma tabela que a API.

---

## Fase 6 — Conciliação Livro Caixa x Santander

**Objetivo:** Comparar automaticamente os movimentos bancários com os lançamentos do sistema.

- [ ] Tabela `santander_conciliacoes` criada
- [ ] Repository `santander-conciliacoes.repository.ts`
- [ ] Algoritmo de match por: data (tolerância 0-2 dias), valor, tipo D/C, documento, histórico
- [ ] Score de match (0-100) por movimento
- [ ] Status: match_exato, match_sugerido, sem_lancamento, sem_movimento_bancario, duplicado
- [ ] API Route `POST /api/santander/conciliar`
- [ ] `ConciliacaoManualModal.tsx` — seleção manual de lançamento candidato
- [ ] Exibição de score de match na tabela

**Critério de aceite:** Sistema mostra matches automáticos, usuário confirma ou ajusta conciliação.

---

## Fase 7 — Geração de Lançamentos no Livro Caixa

**Objetivo:** Transformar movimento Santander em lançamento do Livro Caixa com poucos cliques.

- [ ] `LancarNoLivroCaixaModal.tsx` — modal pré-preenchido
- [ ] Sugestão automática de tipo (RECEITA/DESPESA por D/C)
- [ ] Sugestão de plano de conta por categoria FEBRABAN
- [ ] Verificação de `cash_status` antes de inserir
- [ ] API Route `POST /api/santander/lancar`
- [ ] UPDATE `santander_movimentos.livro_caixa_id` e `status = 'lancado'`
- [ ] INSERT em `santander_conciliacoes` automático

**Critério de aceite:** Movimento Santander vira lançamento no Livro Caixa em ≤ 3 cliques.

---

## Fase 8 — Relatórios e Impressão

**Objetivo:** Gerar espelhos e relatórios de conciliação para auditoria e arquivo.

- [ ] Espelho Santander (conta, período, saldo inicial, movimentos, total C/D, saldo final)
- [ ] Espelho Livro Caixa (mesmo período, lançamentos do sistema, totais, diferença)
- [ ] Relatório de Conciliação (movimentos conciliados, pendentes, lançados, diferenças)
- [ ] Exportação PDF
- [ ] Exportação CSV
- [ ] API Route `GET /api/santander/export`

**Critério de aceite:** Relatórios gerados em PDF e CSV com todos os dados corretos.

---

## Fase 9 — Automação e Alertas

**Objetivo:** Criar jobs opcionais para sincronização automática e alertas proativos.

- [ ] `santander-sync.job.ts` — busca extrato diariamente por conta
- [ ] Alerta: falha de autenticação Santander
- [ ] Alerta: certificado vencendo (< 30 dias)
- [ ] Alerta: diferenças > X% entre banco e Livro Caixa
- [ ] Notificação ao responsável financeiro
- [ ] Configuração: ativar/desativar automação por credencial
- [ ] Interface de configuração de jobs na tela de credenciais

**Critério de aceite:** Jobs configurados funcionam sem intervenção manual; alertas chegam ao responsável.

---

## Linha do Tempo Estimada

| Fase | Estimativa | Dependência |
|------|-----------|-------------|
| Fase 1 | 1 dia | — |
| Fase 2 | 3 dias | Fase 1 |
| Fase 3 | 4 dias | Fase 2 |
| Fase 4 | 3 dias | Fase 3 |
| Fase 5 | 2 dias | Fase 1 |
| Fase 6 | 3 dias | Fases 3 e 4 |
| Fase 7 | 2 dias | Fases 4 e 6 |
| Fase 8 | 2 dias | Fases 6 e 7 |
| Fase 9 | 3 dias | Fase 3 |
| **Total** | **~23 dias** | — |
