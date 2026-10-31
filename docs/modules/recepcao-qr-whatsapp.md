# Recepção por QR code no WhatsApp (agente de IA)

Pedido (31/10/2026): um QR code na recepção da igreja. A pessoa lê com o
celular, o WhatsApp abre já com uma mensagem digitada para o número da
instância Z-API, e um agente de IA a recebe e coleta os dados dela.

## Como funciona

1. **QR** = link `https://wa.me/<numero>?text=<mensagem>`. A mensagem contém
   uma palavra-chave (padrão: "cheguei pela recepção").
2. **Webhook** (`src/app/api/whatsapp/webhook/route.ts`): mensagem de texto que
   contém a palavra-chave (sem acento/caixa) entrega a conversa ao agente
   configurado (`ai_enabled = true`, `ai_agent_id`). A partir daí a fila
   existente (`aiReplyQueue` → `generateAgentReply`) responde.
   - Não passa por cima de atendimento: conversa que já tem agente fica com ele;
     conversa sem agente só é entregue se é nova ou ficou 12 h sem mensagens
     (protege quem a equipe clicou "Assumir").
3. **Configuração** fica em `whatsapp_instances.metadata.recepcao`
   (`ativo`, `agentId`, `palavraChave`, `mensagem`, `telefone`). Coluna jsonb já
   existente: **sem mudança de schema, sem baseline**.
4. **Agente**: tela Agentes de IA (`/app-ui/config/ai-agents`), função
   "Recepção (WhatsApp / QR code)", botão "Usar modelo de Recepção" carrega o
   prompt de `PROMPT_AGENTE_RECEPCAO` (`src/lib/recepcaoWhatsapp.ts`), editável.
   Para essa função o texto fixo "sempre traga um versículo" do
   `aiReplyService` não é aplicado.

## Telas

- Instâncias WhatsApp → menu ⋮ → **Recepção (QR) e webhook**
  (`RecepcaoQrModal.tsx`):
  - **Conectar webhook a este sistema**: PUT na Z-API em
    `update-webhook-received`, `update-webhook-received-delivery`,
    `update-webhook-message-status` (→ `/api/whatsapp/webhook`) e
    `update-webhook-chat-presence` (→ `/api/whatsapp/webhook/presence`).
    Endpoints conferidos em developer.z-api.io em 31/10/2026. **O sistema que
    recebia antes deixa de receber.** URL exige https.
  - QR: agente, número, mensagem, palavra-chave, ativo; baixar PNG, imprimir,
    compartilhar (Web Share no celular), copiar link, enviar no WhatsApp.
- Inbox WhatsApp: ícone de robô nas conversas com IA, aba "Com IA", no
  cabeçalho o nome do agente + **Assumir** (desliga a IA) ou
  **Passar para agente…**.
- Configurações de IA: atalhos "Ver / criar agentes" e "QR da recepção e webhook".

## Permissões novas

- `tela_comunicacao.whats_app_instances.qr_recepcao` (salvar; também na rota)
- `tela_comunicacao.whats_app_instances.conectar_webhook` (também na rota)
- `tela_comunicacao.whats_app_instances.compartilhar_qr_recepcao`
- `whatsapp_inbox.whats_app_inbox.assumir_atendimento`
- `whatsapp_inbox.whats_app_inbox.passar_para_agente`

Todas herdam o "Ver" da tela.

## Verificado / não verificado (31/10/2026)

- Verificado: `permissoes:check` ok; eslint sem erro nos arquivos novos;
  `tsc` sem erro novo (os erros que existem são anteriores); regra de
  palavra-chave e link testados com tsx.
- **Não verificado**: fluxo ponta a ponta com a Z-API real (precisa de deploy
  em https e do webhook apontado); E2E de escrita não rodado (o `.env` local
  aponta para produção).

## Secretaria virtual: sequência + "Quero ser Membro" (31/10/2026)

Prompt modelo (`PROMPT_AGENTE_RECEPCAO`, botão "Usar modelo de Secretaria/Recepção"):
nome → já participou de igreja (qual) → pedido especial (opcional) → todas as
opções de atendimento da home → quer agendar visita? quando? → estado civil e
ficha (completa ou básica) → resumo → registro.

- **Contexto vivo** (`src/lib/contextoRecepcao.ts`), montado a cada resposta só
  para agentes com função `recepcao`: opções de atendimento da home
  (`src/lib/servicosHome.ts`, a mesma lista que a `PublicHome` usa, já com o que
  a igreja escondeu/renomeou), cartões visíveis da home, sede (endereço,
  contatos, programação de cultos), site, sugestões de data e o telefone da
  conversa.
- **Data da visita**: qualquer data de hoje em diante (hoje em Brasília). Ainda
  não há agenda fechada; quando houver, a regra fica em `dataVisitaValida`.
- **Registro** (`src/lib/agenteQueroSerMembro.ts`): o agente termina a mensagem
  com `[[QUERO_SER_MEMBRO]]{json}[[/QUERO_SER_MEMBRO]]`; o sistema remove o
  bloco do texto e, **depois** de enviar a resposta, chama o `POST` da rota que
  já existe, `/api/public/pastoral/create-membership-request`, **sem alterá-la**,
  com o mesmo corpo que a home manda. O OTP que a rota exige é gerado no
  servidor (`signToken` + `hashCode`), porque na conversa o número já está
  comprovado.
  - Ficha completa só quando tem o mínimo que a rota aceita (nome, sobrenome,
    nascimento, CPF válido); senão vai o cadastro simples e a pessoa recebe o
    link da ficha na confirmação, como pela home.
  - `campoId` = campo do agente, que define a sede que avalia (igual à aba
    "Dados básicos").
  - A rota grava "via portal público" na timeline; uma nota extra no card
    registra "Pedido feito pelo agente de IA no WhatsApp".
  - A conversa ganha `metadata.quero_ser_membro`, e o agente não gera o pedido
    de novo. Pedido duplicado (regra da rota) é avisado à pessoa; falha vira
    uma mensagem dizendo que a secretaria vai finalizar.
- Não verificado: a criação de ponta a ponta (gravaria no banco de produção).
  Testadas com tsx: extração do bloco, decisão simples/completo, validação de
  data.
