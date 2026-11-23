# WhatsApp Oficial (Meta Cloud API) e leads de anúncios — design

Data: 23/11/2026 · Status: aguardando aprovação do dono (perguntas do revisor respondidas)

## Por quê

Hoje o envio de WhatsApp passa pela Z-API, que usa um número de WhatsApp
comum. Envio em massa por esse caminho arrisca o banimento do número. O dono
quer um caminho **oficial e confiável** para disparos em massa, e quer que os
formulários dos anúncios do Facebook e do Instagram cheguem sozinhos ao
sistema.

## Objetivos

- Cada igreja conecta o **próprio número oficial** ao sistema com um botão
  ("Conectar com a Meta"), sem ajuda técnica.
- Envio em massa por **modelos aprovados pela Meta**, respeitando o limite
  diário e a qualidade do número, para não ser bloqueado.
- Ver as respostas das pessoas e responder dentro da janela de 24 h.
- Leads dos formulários de anúncio entram no **pipeline pastoral**.

## Não objetivos

- Mexer no módulo atual (Z-API): telas, rotas, tabelas e crons ficam como
  estão. Nada é compartilhado com ele.
- Migrar números da Z-API para a Meta (pode ser feito depois, pela igreja).
- Agente de IA respondendo no número oficial (fica para depois).
- Ser Solution Partner da Meta (linha de crédito compartilhada).

## Antiobjetivos (falha mesmo funcionando)

- O número de uma igreja ficar com qualidade baixa ou bloqueado por causa
  de um disparo do sistema.
- Uma igreja ver ou usar o número, os modelos ou os leads de outra.
- Qualquer mudança que quebre o WhatsApp Z-API que está em produção.

## Restrições (fatos da documentação da Meta, lida em 23/11/2026)

- **Tech Provider**: um app Meta do sistema (empresa ZyonByte), com o caso de
  uso WhatsApp e o "Tech Provider onboarding" concluído. Exige verificação da
  empresa e App Review com vídeos do app funcionando (envio de mensagem e
  criação de modelo). Permissões em acesso avançado:
  `whatsapp_business_management` e `whatsapp_business_messaging`.
- Antes da aprovação: até **10** contas novas por 7 dias; depois de
  verificação + App Review + Access Verification: **200** por 7 dias.
- **Embedded Signup v4** (v2/v3 depreciados em 15/10/2026). O cliente entra
  com a conta Meta dele, escolhe/cria a conta WhatsApp, confirma o número.
  O sistema recebe `waba_id`, `phone_number_id` e um código trocado no
  servidor por um token do negócio. Depois: registrar o número na Cloud API
  e assinar os webhooks da conta.
- **Cobrança**: cada igreja cadastra a própria forma de pagamento na conta
  Meta dela. Sem isso, não envia. A Meta cobra **por mensagem entregue**,
  por categoria (marketing, utilidade, autenticação, serviço) e país.
- Fora da janela de 24 h, **só modelo aprovado**. Só para quem deu opt-in.
- Limite de pessoas diferentes por dia, por portfólio: 250 (novo) → 2.000
  (empresa verificada) → 10 mil → 100 mil → ilimitado. Campo atual:
  `whatsapp_business_manager_messaging_limit`.
- Qualidade do número: calculada pelos bloqueios, denúncias, silenciamentos
  e arquivamentos dos últimos 7 dias.
- Webhooks: dá para apontar a URL **por conta WhatsApp** (`POST
  /<WABA_ID>/subscribed_apps` com `override_callback_uri` e `verify_token`)
  ou por número. **Não** valem para status de modelo nem alertas da conta.
- Leads: webhook `leadgen` da Página; leitura por `GET /<LEAD_ID>` ou
  `GET /<FORM_ID>/leads` com filtro de data. Permissões `leads_retrieval`,
  `pages_show_list`, `pages_read_engagement`, `pages_manage_ads`,
  `pages_manage_metadata`, `ads_management` (App Review). **A documentação
  lida não confirma** se os leads do Instagram chegam pelo mesmo caminho.

Restrições do sistema:

- Um código, **um banco e um endereço por igreja**. A base é a sede de
  Campinas (Vercel + Supabase Cloud): o módulo é desenvolvido e testado
  aqui. Cada igreja nova ganha a própria VPS (Coolify) com o próprio banco,
  como a Vila Solange, e usa o mesmo módulo, com a sua própria conexão Meta. O app Meta é um só para
  todas.
- Regra nº 1 do AGENTS.md: tabela nova ⇒ regerar o baseline.
- Regra nº 2: tela, botão e ação nova entram na árvore de permissões, e a
  rota que grava recusa a mesma chave (`exigirPermissao`).
- Crons: `vercel.json` na Vercel e "Scheduled Tasks" no Coolify, por igreja,
  com `CRON_SECRET`.
- Não existe página de Política de Privacidade; a Meta exige uma.

## Abordagens consideradas

| | Como | Troca | Decisão |
|---|---|---|---|
| A | App do sistema como Tech Provider; cada igreja conecta o próprio número (Embedded Signup) | Burocracia inicial (verificação + App Review), depois cada igreja se conecta sozinha | **Escolhida pelo dono** |
| B | Uma conta configurada à mão por igreja | No ar mais rápido, mas cada igreja nova exige configuração manual e migrar para A depois exige reconectar | Descartada |
| — | Continuar só na Z-API | Não resolve o risco de banimento | Descartada |

## Como funciona

### 1. Conectar (tela "WhatsApp Oficial")

- Botão **"Conectar com a Meta"** abre o Embedded Signup v4 (SDK JS da Meta,
  configuração do Facebook Login for Business).
- O servidor da igreja troca o código pelo token, registra o número, assina
  os webhooks com `override_callback_uri` apontando para
  `https://<endereço da igreja>/api/meta/whatsapp/webhook`, e grava tudo no
  banco da igreja. **Token criptografado** (padrão de `stripeEncrypt.ts`, com
  chave própria).
- A tela mostra: número, nome de exibição, status, **qualidade**, **limite
  diário** e se a forma de pagamento está pendente (quando a API informar).
- Botão "Desconectar".

### 2. Modelos

- Lista os modelos da conta com status (aprovado, em análise, recusado) e
  categoria. Criar modelo no sistema (texto, variáveis, categoria) envia para
  aprovação da Meta.
- O status é **atualizado por cron** (a Meta não deixa redirecionar esse
  webhook por igreja).

### 3. Envio em massa

- Público: membros e contatos do pipeline pastoral, com filtros. Só entra
  quem tem celular válido e **não pediu para sair**.
- Recomendação na tela (não obrigatória): o primeiro disparo de um campo é
  um modelo de boas-vindas ao canal oficial, com a opção de sair, para
  proteger a qualidade do número.
- Escolhe um modelo **aprovado** e preenche as variáveis (ex.: nome).
- Antes de disparar, a tela mostra quantas pessoas, o limite diário que
  resta e uma estimativa de custo por categoria (sem valor exato).
- O disparo é uma **fila processada por cron**, em lotes. Para sozinho e
  avisa quando: o limite diário acabar (continua no dia seguinte), a
  qualidade cair para baixa, ou a Meta devolver erro de bloqueio.
- Acompanhamento por pessoa: enviado, entregue, lido, falhou (status vindos
  do webhook de mensagens).
- **Sair da lista**: quem responder "SAIR" (ou bloquear) entra numa lista de
  exclusão da igreja e não recebe mais disparos.

### 4. Respostas (caixa de conversas própria)

- Webhook de mensagens recebidas, por igreja. Conversa aberta mostra se a
  janela de 24 h está aberta; dentro dela, resposta livre; fora, só modelo.

### 5. Leads de anúncio

- Conectar a Página do Facebook (e o Instagram, se confirmado) num segundo
  botão "Conectar anúncios".
- Cron busca leads novos por formulário (`/<FORM_ID>/leads` com filtro de
  data) e cria um contato no pipeline pastoral, com origem "Anúncio
  Facebook/Instagram" e o nome do formulário. Evita duplicado pela checagem
  que o pipeline já usa (`pastoralDuplicateCheck`).
- Instagram: testar com anúncio real antes de prometer.

### Configuração única (variáveis de ambiente, iguais em todas as igrejas)

`META_APP_ID`, `META_APP_SECRET`, `META_ES_CONFIG_ID` (Embedded Signup),
`META_LEADS_CONFIG_ID`, `META_WEBHOOK_VERIFY_TOKEN`,
`META_TOKEN_ENCRYPTION_KEY`, `META_GRAPH_VERSION`.

O webhook padrão do app (exigido pela Meta) aponta para a rota de uma igreja
e só responde 200; o que importa chega pelo override de cada igreja.
Cada endereço de igreja precisa estar nos domínios permitidos do app.

### Permissões (árvore)

Módulo novo no catálogo, por exemplo `whatsapp_oficial`, com: ver,
conectar/desconectar, criar modelo, disparar em massa, responder conversa,
conectar anúncios. Cada rota que grava recusa a chave correspondente.

## Ordem de entrega

1. **Base**: Política de Privacidade, configuração do app, conectar número,
   tela de status. (Permite gravar o vídeo do App Review.)
2. **Modelos**.
3. **Envio em massa** com fila, limites e lista de exclusão.
4. **Respostas**.
5. **Leads de anúncio**.

Fases 1–3 são desenvolvidas com o número de teste da Meta (sandbox de 90
dias) e o app em modo de desenvolvimento; o App Review é pedido ao fim da 3.

## Decidido pelo dono

- Módulo separado; Z-API intocada.
- Abordagem A (Tech Provider + Embedded Signup).
- Cada igreja paga a Meta direto.
- **Uma conexão Meta por campo**, com o mesmo isolamento por campo que o
  sistema já usa em tudo (confirmado em 23/11/2026).
- **Quem recebe disparo** (23/11/2026): os membros do campo e as pessoas que
  procuraram a igreja (site da igreja, "Quero ser Membro", formulários,
  mensagens) — os contatos que a igreja já recebe no painel. Ter dado o
  número à igreja conta como autorização; não há marcação nova de
  consentimento. Quem pede para sair (ver "Sair da lista") não recebe mais.

## Decisões minhas (o dono pode corrigir)

- Detalhes da conexão por campo (decidida pelo dono, acima): Um banco pode ter mais de
  um campo (Campinas e Aguaí), e o campo ativo filtra tudo
  (`docs/architecture/ISOLAMENTO-CAMPO.md`), como a Z-API já faz em
  `src/lib/whatsappCampo.ts`. Modelos, fila, lista de exclusão, conversas e
  leads pertencem ao campo. O webhook da igreja identifica o campo pelo
  `phone_number_id` de cada evento.
- Status de modelo, qualidade, limite e leads por **cron**, para não
  precisar de servidor central.
- **Webhook padrão do app** aponta para a rota de Campinas, que só responde
  200 e não processa nada. Os eventos que não aceitam override (status de
  modelo, alertas da conta) chegam lá e são descartados de propósito: a
  mesma informação vem pelo cron de cada igreja. O webhook `leadgen` não
  é usado; os leads vêm só pelo cron.
- **Anúncios no mesmo app**, com uma segunda configuração do Facebook Login
  for Business (permissões de Página e anúncios). O App Review dessas
  permissões é pedido **depois** do do WhatsApp, quando a fase 5 estiver
  pronta. Token de Página de longa duração, criptografado no banco do campo;
  quando a Meta recusar o token, a tela pede para reconectar.
- Leads entram no **pipeline pastoral**, não na tabela `leads`. Igreja do
  lead: **cada formulário é ligado a uma igreja na tela de anúncios**; sem
  ligação, vai para a sede do campo.
- Respostas ficam numa caixa de conversas **própria** do módulo.
- **Sair da lista**: resposta com SAIR, PARAR, STOP, CANCELAR ou
  DESCADASTRAR (sem diferenciar maiúsculas e acentos). A Cloud API não avisa
  bloqueio; quando o envio falha com erro de "não pode receber", a pessoa é
  marcada e pulada nos próximos disparos. A tela não promete detectar
  bloqueio.
- **Configuração de cada igreja** (portfólio, verificação, pagamento): a
  tela de conexão mostra um passo a passo e o que está pendente. O disparo
  em massa fica bloqueado enquanto não houver número conectado e modelo
  aprovado; o pagamento pendente é mostrado se a API informar (a confirmar
  na implementação) e, se não informar, o primeiro erro de envio por
  pagamento pausa a fila com aviso.

## Deixado para quem construir

- Nomes de tabelas, colunas e rotas; layout seguindo o guia de estilo
  (`docs/architecture/GUIA-ESTILO-SILAS.md`).
- Tamanho do lote e intervalo da fila, dentro do limite diário.
- Como mostrar a estimativa de custo.

## Adendo aprovado pelo dono (23/11/2026): configuração central e monitor

- **Tela "Meta – App oficial"** na área do administrador master do sistema
  base (Campinas). Mostra e permite mudar: ID do app, configuração do
  Embedded Signup, versão da Graph API, token do webhook; a chave secreta do
  app só pode ser trocada, nunca exibida. Mostra o status (verificação da
  empresa, análise do app, limite de clientes por semana, webhook
  respondendo) e o interruptor **"Liberar conexão para as igrejas"**:
  desligado, as igrejas veem "em breve" no lugar de "Conectar com a Meta".
- **Fonte única da configuração**: fica no banco do sistema base, com a
  chave secreta cifrada. As outras igrejas leem do sistema base por uma rota
  servidor-a-servidor protegida por segredo compartilhado, com cache curto;
  as variáveis de ambiente valem como reserva quando o base não responde.
  Só a conexão depende do base; o envio e o recebimento do dia a dia não.
- **Monitor diário ("agente")**: verifica a versão da Graph API em uso
  contra a data de desativação, tokens recusados, webhook sem resposta e
  qualidade de número baixa; registra alertas na tela do master e avisa o
  dono pelo WhatsApp. **Não muda a configuração sozinho**: propõe a mudança
  e espera o "aprovar" do master na tela.
