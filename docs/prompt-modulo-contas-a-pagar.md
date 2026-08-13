# Prompt para o Agente de Desenvolvimento — Módulo "Contas a Pagar"

## Contexto do projeto

Você vai desenvolver o módulo **Contas a Pagar** dentro de um SaaS multi-tenant para igrejas. O sistema já existe com banco de dados único no Supabase (Postgres) e front-end na Vercel. Todo o módulo deve respeitar o isolamento multi-tenant (toda tabela precisa de `tenant_id`/`igreja_id`, com RLS no Supabase).

O módulo se inspira no fluxo clássico de Contas a Pagar (emissão → registro → aprovação → pagamento → baixa contábil), mas adaptado à realidade de uma igreja, que tem particularidades importantes:

- Despesas recorrentes e parceladas (ex: pagamento de pastores lançado como 12 parcelas de uma vez, referentes ao ano).
- Parcelas que podem ser pagas **parcialmente** — ex: em um mês só há caixa para pagar parte do valor do pastor, e o restante fica em aberto (débito) atrelado àquela mesma parcela, não como uma parcela nova solta.
- Necessidade de cadastro de **tipos/categorias de despesa** (ex: Folha Pastoral, Aluguel, Água/Luz, Manutenção, Missões, Eventos, etc.) para permitir relatórios financeiros por categoria.

## Objetivo

Desenvolver um módulo completo de Contas a Pagar com:
1. Cadastro de Tipos de Despesa
2. Cadastro de Credores/Beneficiários (pastores, fornecedores, prestadores de serviço, etc.)
3. Lançamento de Contas a Pagar (à vista ou parcelada)
4. Gestão de Parcelas com suporte a **pagamento parcial** e saldo remanescente
5. Aprovação/fluxo de alçada (opcional, mas recomendado)
6. Baixa contábil e conciliação
7. Relatórios e dashboards

---

## 1. Cadastro de Tipos de Despesa (categorias)

Tabela `tipos_despesa`:
- `id`
- `tenant_id`
- `nome` (ex: "Folha Pastoral", "Aluguel", "Energia Elétrica", "Água", "Missões", "Manutenção Predial", "Eventos", "Material de Escritório")
- `categoria_pai_id` (permitir subcategorias — ex: "Folha Pastoral" > "Dízimo Pastoral", "Ajuda de Custo")
- `natureza` (fixa / variável / eventual)
- `centro_de_custo` (opcional, se a igreja tiver departamentos/ministérios)
- `ativo` (boolean)
- `created_at`, `updated_at`

Permitir CRUD completo, com validação para não excluir tipo que já tem despesas vinculadas (apenas inativar).

## 2. Cadastro de Credores/Beneficiários

Tabela `credores`:
- `id`, `tenant_id`
- `nome`
- `tipo` (pessoa física / pessoa jurídica)
- `cpf_cnpj`
- `tipo_credor` (pastor, obreiro, fornecedor, prestador de serviço, órgão público, outro)
- dados bancários (banco, agência, conta, tipo de conta, chave PIX) — para facilitar o registro do pagamento depois
- contato (telefone, e-mail)
- `ativo`

## 3. Lançamento de Conta a Pagar

Tabela `contas_pagar` (o "título" da despesa, o registro-mãe):
- `id`, `tenant_id`
- `tipo_despesa_id`
- `credor_id`
- `descricao`
- `valor_total`
- `data_emissao`
- `forma_pagamento_prevista` (dinheiro, PIX, transferência, boleto, cartão)
- `numero_documento` (nota fiscal, recibo, contrato)
- `recorrente` (boolean)
- `parcelado` (boolean)
- `numero_parcelas`
- `status_geral` (pendente, parcial, pago, atrasado, cancelado) — **calculado a partir das parcelas**, não editado manualmente
- `anexo_documento_url` (contrato, nota fiscal original)
- `observacoes`
- `criado_por`, `created_at`, `updated_at`

Ao marcar como parcelado, o sistema deve gerar automaticamente os registros em `parcelas_contas_pagar` (ver item 4), dividindo o valor total (com opção de valores desiguais por parcela — nem toda despesa parcelada tem parcelas idênticas).

## 4. Parcelas — o coração do módulo

Tabela `parcelas_contas_pagar`:
- `id`, `tenant_id`, `conta_pagar_id`
- `numero_parcela` (1/12, 2/12...)
- `valor_parcela` (valor original devido)
- `valor_pago` (somatório de tudo que já foi pago nessa parcela — calculado)
- `valor_saldo` (`valor_parcela - valor_pago`, sempre recalculado)
- `data_vencimento`
- `status` (pendente, parcial, pago, atrasado, cancelado)
- `created_at`, `updated_at`

**Ponto-chave do seu caso de uso (pagamento parcial do pastor):**
Uma parcela pode receber **múltiplos pagamentos** ao longo do tempo até ser quitada. Por isso, cada parcela não guarda "um pagamento", ela guarda uma **coleção de pagamentos** — como anexos/lançamentos filhos dessa parcela.

Tabela `pagamentos_parcela`:
- `id`, `tenant_id`, `parcela_id`
- `valor_pago`
- `data_pagamento`
- `forma_pagamento` (PIX, dinheiro, transferência, cheque)
- `comprovante_url`
- `observacao` (ex: "pago 60% por falta de caixa, restante fica em aberto")
- `registrado_por`, `created_at`

**Lógica de negócio:**
- Toda vez que um `pagamento_parcela` é inserido, o sistema recalcula `valor_pago` e `valor_saldo` da parcela correspondente.
- Se `valor_saldo == 0` → status da parcela vira `pago`.
- Se `0 < valor_pago < valor_parcela` → status vira `parcial`.
- Se `valor_pago == 0` e `data_vencimento < hoje` → status vira `atrasado`.
- O `status_geral` da conta a pagar (o título-mãe) é derivado do conjunto de parcelas: se todas pagas → `pago`; se pelo menos uma parcial ou paga e outras pendentes → `parcial`; se todas pendentes e alguma vencida → `atrasado`.
- O saldo remanescente de uma parcela paga parcialmente **não vira uma parcela nova**: ele continua sendo dívida da mesma parcela/mês de referência, aparecendo em relatórios de "parcelas em aberto" com o valor residual, até ser quitado (mesmo que isso ocorra em pagamentos futuros, meses depois).
- Permitir edição/estorno de um `pagamento_parcela` (com registro de auditoria de quem alterou e por quê), recalculando os totais.

## 5. Fluxo de aprovação (opcional, mas recomendado para igrejas com tesouraria/conselho)

Tabela `aprovacoes_contas_pagar` (ou campo de status na própria conta):
- `status_aprovacao` (aguardando aprovação, aprovado, reprovado)
- `aprovado_por`
- `data_aprovacao`
- `alcada` (valor mínimo que exige aprovação do tesoureiro/pastor presidente/conselho — configurável por tenant)

Regra: contas acima de um valor configurável só liberam pagamento após aprovação.

## 6. Baixa contábil

Ao registrar um pagamento (total ou parcial), gerar automaticamente um lançamento no módulo financeiro/fluxo de caixa da igreja (se já existir um módulo de tesouraria no SaaS), debitando a conta bancária/caixa usada e permitindo conciliação bancária posterior.

## 7. Relatórios e dashboards

- Contas a pagar por status (pendente, parcial, atrasado, pago) com totais.
- Contas a pagar por tipo de despesa (para saber quanto se gasta com folha pastoral, manutenção, etc.).
- Fluxo de caixa projetado (parcelas a vencer nos próximos 30/60/90 dias).
- Relatório de parcelas com saldo residual em aberto (essencial para o seu caso do pastor).
- Extrato por credor (histórico de tudo pago/devido a um pastor ou fornecedor específico).
- Exportação em PDF/Excel.

## 8. Notificações

- Alerta automático (in-app e/ou e-mail/WhatsApp) de parcelas a vencer em X dias.
- Alerta de parcelas vencidas e não pagas.
- Alerta de parcelas pagas parcialmente com saldo em aberto há mais de X dias.

## 9. Permissões (RBAC)

Definir papéis: quem pode cadastrar tipo de despesa, quem pode lançar conta a pagar, quem pode aprovar, quem pode registrar pagamento, quem só visualiza relatórios (ex: tesoureiro, pastor presidente, secretário financeiro, auditor/conselho fiscal).

## 10. Auditoria

Toda alteração relevante (criação, edição, exclusão/cancelamento de conta, parcela ou pagamento) deve gerar um log de auditoria com usuário, data/hora, e o que mudou (antes/depois), já que envolve dinheiro da igreja e presta contas à membresia/conselho.

---

## Requisitos técnicos gerais

- Multi-tenant: toda tabela com `tenant_id`, RLS habilitado no Supabase.
- Migrations versionadas.
- Validações de negócio no backend, não só no front (ex: não permitir pagamento maior que o saldo da parcela).
- Endpoints de API REST (ou funções Supabase) para: CRUD de tipos de despesa, CRUD de credores, criação de conta a pagar (com geração automática de parcelas), listagem/filtro de parcelas por status/vencimento/credor/tipo, registro de pagamento de parcela (parcial ou total), estorno de pagamento, geração de relatórios.
- Testes cobrindo especialmente a lógica de pagamento parcial e recálculo de saldo (é o ponto mais sensível do sistema).

## Entregável esperado do agente

1. Modelagem do banco (schema SQL/migrations).
2. Implementação das regras de negócio descritas acima (especialmente o motor de cálculo de status/saldo de parcela).
3. Telas: cadastro de tipos de despesa, cadastro de credores, lançamento de conta a pagar (com opção de parcelamento), tela de parcela mostrando histórico de pagamentos (os "anexos" de pagamento), tela de registro de novo pagamento (com campo de valor livre, permitindo pagamento parcial), dashboard e relatórios.
4. Documentação breve do fluxo para o time da igreja que for usar.

