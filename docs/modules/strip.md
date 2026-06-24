Documentação principal:

Stripe Docs
https://docs.stripe.com/payments/quickstart?client=next&utm_source=chatgpt.com

Stripe Checkout para 
https://docs.stripe.com/payments/quickstart?client=next&utm_source=chatgpt.com


https://docs.stripe.com/webhooks?utm_source=chatgpt.com

https://docs.stripe.com/billing/subscriptions/overview?utm_source=chatgpt.com

# Integração Completa Stripe no MRM + APP

## Objetivo

Implementar uma integração completa do Stripe dentro do MRM e aplicativo mobile, permitindo que usuários realizem pagamentos e acompanhem todo o ciclo financeiro diretamente no sistema.

O processo deve ser transparente tanto para o usuário final quanto para administradores.

O MRM já possui:

- Sistema de pedidos
- Gestão de eventos e ingressos
- Carrinho
- Tela de pagamento no APP
- Login de usuários
- Banco Supabase
- Sistema multi-tenant

A implementação deverá aproveitar a estrutura existente e evitar duplicações.

---

# Formas de pagamento obrigatórias

Implementar:

### Pagamentos únicos

- PIX
- Cartão de crédito
- Cartão de débito (se disponível)
- Link de pagamento
- Compra de ingressos
- Compra de produtos
- Doações
- Ofertas
- Dízimos

---

### Pagamentos recorrentes

Permitir:

- Dízimo recorrente
- Oferta recorrente
- Assinaturas mensais
- Assinaturas anuais
- Plano personalizado

Exemplos:

Usuário escolhe:

"Doar R$ 50 mensalmente"

ou

"Dízimo automático todo dia 10"

---

# Fluxo do APP

## Compra comum

Fluxo:

Adicionar produto/evento ao carrinho

↓

Finalizar compra

↓

Selecionar forma pagamento

↓

Gerar pagamento Stripe

↓

Aguardar confirmação

↓

Receber retorno webhook

↓

Atualizar status automaticamente

↓

Gerar comprovante

↓

Adicionar no histórico

↓

Enviar notificação

↓

Exibir QRCode se necessário

---

## Fluxo assinatura recorrente

Fluxo:

Selecionar valor

↓

Selecionar frequência:

- semanal
- mensal
- trimestral
- anual

↓

Criar assinatura Stripe

↓

Salvar ID assinatura

↓

Mostrar próxima cobrança

↓

Permitir cancelamento

↓

Permitir alteração valor

↓

Permitir pausa

---

# Tela "Meus pagamentos"

Criar no APP:

Menu:

Meus pagamentos

Submenus:

### Histórico

Mostrar:

- Data
- Tipo
- Valor
- Método
- Status
- Número pedido
- Recibo
- Reembolso

---

### Assinaturas

Mostrar:

- Valor
- Frequência
- Próxima cobrança
- Status
- Alterar
- Cancelar

---

### Solicitações

Mostrar:

- Solicitações de reembolso
- Solicitações pendentes
- Histórico

---

# Solicitação de reembolso

Usuário poderá:

Abrir solicitação

Campos:

Motivo:

- compra indevida
- erro pagamento
- cancelamento
- outro

Descrição

Enviar

Fluxo:

Solicitação criada

↓

Admin recebe

↓

Admin aprova/rejeita

↓

Se aprovado:

Executar reembolso Stripe

↓

Atualizar pedido

↓

Registrar histórico

↓

Notificar usuário

---

# Área administrativa no MRM

Criar módulo:

Financeiro → Stripe

Submenus:

## Dashboard

Mostrar:

- Receita total
- Receita mensal
- PIX recebidos
- Cartões recebidos
- Assinaturas ativas
- Assinaturas canceladas
- Reembolsos
- Ticket médio
- Gráficos

---

## Transações

Mostrar:

- Usuário
- Igreja
- Tipo
- Valor
- Método
- Status
- Data
- Stripe ID

Filtros:

- período
- igreja
- usuário
- status
- método

---

## Assinaturas

Mostrar:

- Assinante
- Valor
- Próxima cobrança
- Status
- Plano

Permitir:

- cancelar
- pausar
- reativar

---

## Reembolsos

Mostrar:

- pedido
- usuário
- valor
- motivo
- status

Permitir:

- aprovar
- rejeitar

---

# Webhooks Stripe

Criar endpoint seguro:

/api/stripe/webhook

Eventos obrigatórios:

checkout.session.completed

payment_intent.succeeded

payment_intent.payment_failed

invoice.paid

invoice.payment_failed

customer.subscription.created

customer.subscription.updated

customer.subscription.deleted

charge.refunded

refund.updated

---

# Banco de dados

Criar ou ajustar tabelas necessárias.

Estruturar:

## Pagamentos

Campos:

- id
- tenant_id
- user_id
- pedido_id
- stripe_payment_id
- stripe_customer_id
- stripe_session_id
- valor
- metodo
- status
- tipo
- data

---

## Assinaturas

Campos:

- id
- tenant_id
- user_id
- stripe_subscription_id
- valor
- frequência
- próxima_cobrança
- status

---

## Reembolsos

Campos:

- id
- pagamento_id
- motivo
- status
- valor
- data

---

## Histórico financeiro

Campos:

- id
- user_id
- evento
- descrição
- data

---

# Segurança

Implementar:

- Webhook signature validation
- Chaves privadas apenas backend
- Nunca expor secret key no app
- JWT autenticação
- Logs completos
- Auditoria

---

# Notificações

Enviar:

APP:

- pagamento aprovado
- pagamento recusado
- assinatura criada
- assinatura cancelada
- reembolso aprovado
- reembolso recusado

Email:

- comprovante
- confirmação

WhatsApp (futuro)

---

# Integração com pedidos existentes

NÃO criar novo sistema de pedidos.

Usar o sistema atual do MRM.

Apenas integrar:

Pedido existente

↓

Pagamento Stripe

↓

Webhook

↓

Atualização automática status

↓

Histórico

↓

Notificações

---

# Resultado esperado

O usuário deve conseguir:

✓ Comprar produtos

✓ Comprar ingressos

✓ Fazer PIX

✓ Pagar cartão

✓ Criar dízimo recorrente

✓ Gerenciar assinaturas

✓ Ver histórico

✓ Solicitar reembolso

✓ Baixar comprovantes

Tudo diretamente pelo aplicativo.

O administrador deve ter gestão completa no MRM.