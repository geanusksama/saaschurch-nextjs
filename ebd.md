# PRD — Módulo Gestão EBD (Escola Bíblica Dominical) — MRM

## Objetivo

Desenvolver um módulo completo de **Gestão de Escola Bíblica Dominical (EBD)** integrado ao MRM já existente.

O módulo será responsável por gerenciar:

* Cadastro de revistas
* Controle por trimestre
* Controle de estoque
* Compras e entradas
* Separação de pedidos
* Entregas para igrejas
* Controle financeiro
* Ajustes financeiros
* Relatórios
* Histórico
* Impressões
* Permissões
* Dashboard analítico

O objetivo é substituir controles feitos em planilhas e centralizar todo processo operacional da EBD.

---

# Integração com MRM existente

Utilizar estruturas já existentes:

* Igrejas
* Regionais
* Membros
* Usuários
* Departamentos
* Permissões
* Multi-tenant

Não duplicar dados existentes.

Líder EBD deve ser selecionado a partir do cadastro de membros já existente.

---

# Fluxo operacional geral

Fluxo principal:

Sede:

Compra material

↓

Entrada estoque

↓

Separação para igrejas

↓

Entrega

↓

Geração automática de débito financeiro

↓

Recebimentos/Ajustes

↓

Relatórios e histórico

---

# Estrutura do menu

Novo módulo:

📚 Gestão EBD

Submenus:

* Dashboard
* Cadastros
* Estoque
* Separação/Entrega
* Financeiro EBD
* Histórico
* Relatórios
* Configurações

---

# Dashboard

Criar painel analítico contendo:

## Cards

* Total de revistas distribuídas
* Total financeiro pendente
* Igrejas inadimplentes
* Estoque baixo
* Entradas recentes
* Entregas recentes

## Gráficos

### Revistas distribuídas por categoria

Exemplo:

Adultos

Jovens

Kids

Adolescentes

Professor

---

### Distribuição por regional

---

### Financeiro

Recebido

Pendente

Inadimplente

---

### Comparativo por trimestre

---

# Cadastros

## Cadastro de Trimestres

Campos:

| Campo       | Tipo    |
| ----------- | ------- |
| id          | UUID    |
| nome        | texto   |
| ano         | número  |
| data_inicio | data    |
| data_fim    | data    |
| ativo       | boolean |

Exemplos:

Primeiro trimestre 2026

Segundo trimestre 2026

Terceiro trimestre 2026

Quarto trimestre 2026

---

## Cadastro Categorias EBD

Não permitir digitação livre durante lançamentos.

Campos:

| Campo     | Tipo  |
| --------- | ----- |
| id        | UUID  |
| nome      | texto |
| descrição | texto |

Categorias padrão:

* Adultos
* Jovens
* Juvenis
* Adolescentes
* Kids
* Berçário
* Professor
* Material apoio

---

## Cadastro Produtos EBD

Tipos:

* Revista
* Livro
* Material
* Apoio

Campos:

| Campo        | Tipo    |
| ------------ | ------- |
| id           | UUID    |
| código       | texto   |
| nome         | texto   |
| tipo         | enum    |
| categoria_id | UUID    |
| trimestre_id | UUID    |
| ano          | inteiro |
| tema         | texto   |
| descrição    | texto   |
| unidade      | texto   |
| preço_custo  | decimal |
| preço_venda  | decimal |
| ativo        | boolean |

Exemplo:

Categoria:

Adultos

Tema:

Salvação

Ano:

2026

---

# Estoque

Criar controle completo.

---

## Entrada de estoque

Campos:

Fornecedor

Número nota fiscal

Data

Observação

Itens:

Produto

Quantidade

Valor unitário

Valor total

---

Ao salvar:

Atualizar estoque automaticamente.

Gerar histórico:

* Entrada
* Saída
* Ajuste

---

# Tela principal — Separação / Entrega

Tela operacional principal.

Formato semelhante a planilha.

---

## Cabeçalho

Regional

Igreja

Responsável EBD

Data

Status:

* Separando
* Separado
* Entregue
* Cancelado

---

## Itens do pedido

Campos:

Produto

Quantidade

Valor unitário

Subtotal

---

Exemplo:

Adultos — 35

Jovens — 20

Adolescentes — 15

Professor — 3

Livro apoio — 2

---

## Sistema deve calcular automaticamente

Quantidade total

Valor total

Saldo anterior

Novo saldo

---

Ao salvar:

### Executar automaticamente:

1. Debitar estoque

2. Gerar débito financeiro da igreja

3. Criar histórico

4. Gerar documento

---

# Impressão de entrega

Criar comprovante estilo nota fiscal.

---

## Cabeçalho

Nome sede

Regional

Igreja

Responsável

Data

Número documento

QR Code

---

## Itens

Produto

Quantidade

Valor unitário

Subtotal

---

## Rodapé

Saldo anterior

Valor entrega

Novo saldo

---

Assinaturas:

Responsável retirada

Responsável entrega

---

Exportar:

* PDF
* Impressão

Preparar estrutura futura para:

* WhatsApp
* E-mail

---

# Financeiro EBD

Tela de consulta:

Filtros:

Regional

Igreja

Trimestre

Ano

Status

---

Mostrar:

Saldo anterior

Novos débitos

Pagamentos

Ajustes

Saldo atual

---

# Ajustes financeiros

Permitir:

* Recebimento
* Crédito
* Desconto
* Correção
* Transferência
* Outros

Campos:

Tipo

Valor

Data

Descrição

Responsável

Observação

Anexo opcional

---

Exemplo:

Débito inicial:

R$1500

Pagamento:

R$500

Saldo:

R$1000

Pagamento:

R$300

Saldo:

R$700

Desconto:

R$100

Saldo:

R$600

---

Nunca excluir movimentações financeiras.

Tudo deve gerar histórico.

---

# Histórico

Criar timeline por igreja.

Eventos:

* Entrada estoque
* Retirada
* Entrega
* Pagamento
* Ajuste
* Cancelamento

Exemplo:

15/01

Retirada Adultos — 30

R$450

---

16/01

Pagamento

R$200

---

18/01

Desconto

R$50

---

# Relatórios

## Relatório retiradas

Filtros:

* Regional
* Igreja
* Trimestre
* Categoria
* Período

---

## Relatório financeiro

Filtros:

* Regional
* Igreja
* Situação

---

## Relatório estoque

Mostrar:

* Entradas
* Saídas
* Saldo

---

## Relatório inadimplência

Mostrar:

Igreja

Regional

Saldo

Dias atraso

---

## Relatório trimestre

Mostrar:

* Quantidade distribuída
* Receita prevista
* Recebido
* Saldo pendente

---

# Permissões

Criar:

EBD_ADMIN

EBD_FINANCEIRO

EBD_ESTOQUE

EBD_LIDER

EBD_VISUALIZAR

---

# Banco de dados

Criar tabelas:

ebd_trimestres

ebd_categorias

ebd_produtos

ebd_estoque

ebd_estoque_movimentos

ebd_entregas

ebd_entrega_itens

ebd_financeiro

ebd_financeiro_movimentos

ebd_historico

---

Todas devem conter:

id UUID

tenant_id

created_at

updated_at

created_by

soft_delete

---

Criar:

* índices
* foreign keys
* constraints
* validações

---

# Front-end

Padrão do MRM:

* React
* Vite
* Tailwind
* Shadcn UI
* Supabase
* TanStack Query
* Zustand

---

Implementar:

* paginação
* pesquisa
* filtros
* exportação PDF
* exportação Excel
* skeleton loading
* cache local
* telas responsivas

---

# Objetivo final

Entregar implementação completa:

✅ Banco

✅ APIs

✅ Regras de negócio

✅ Frontend

✅ Estoque

✅ Financeiro

✅ Impressões

✅ Histórico

✅ Relatórios

✅ Dashboard

✅ Permissões

✅ Multi-tenant

Implementação real e pronta para produção.
