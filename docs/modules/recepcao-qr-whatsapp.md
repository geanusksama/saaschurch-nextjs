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

## Equipe Pastoral + espera humana (01/11/2026)

- Prompt do dono (`PROMPT_AGENTE_RECEPCAO`): o agente se apresenta como membro
  da equipe pastoral (nomes masculinos/femininos conforme a pessoa), mantém o
  mesmo nome até o fim (`atendente` na memória), "A paz do Senhor", sem
  emojis, trata mensagens picadas como uma só, apresenta os departamentos
  (lista fixa do prompt + os publicados em `department_sites`, com descrição e
  link). Se perguntarem se é robô, não mente. Agente no banco renomeado para
  "Equipe Pastoral".
- Para a função `recepcao` o sistema troca a regra de emoji por "não use
  emojis"; mensagens fixas (fallback e falha do registro) sem emoji.
- **Fila com interrupção** (`src/lib/aiReplyQueue.ts`): marca como visto →
  pausa "lendo" (2,5 s) → gera → confere → pausa final (1,5 s) → envia.
  Mensagem nova ou "digitando..." durante o preparo só empurra o `due_at`; o
  worker vê (`due_at > locked_at`), descarta a resposta e devolve a linha para
  a fila — a próxima passada responde lendo tudo. Corrige também a mensagem
  que chegava no meio do preparo e era apagada sem resposta.
- Limite da Z-API: não existe endpoint para mostrar só "digitando..."; ele vai
  junto do envio (`delayTyping`) e não pode ser cancelado. Por isso o
  "digitando" visível do agente ficou curto (2 a 6 s) — é a única janela em que
  a pessoa voltar a escrever não impede o envio.
- Não verificado ponta a ponta (depende da Z-API real e do relógio da fila).

## Cadastro em 3 opções + pedidos anteriores (01/11/2026)

- Antes dos dados do Quero ser Membro o agente pergunta como a pessoa
  prefere: todas as perguntas de uma vez (numeradas, numa mensagem), uma por
  vez, ou pelo site (link da home + botão de atendimento → Quero ser Membro;
  nada é registrado pela conversa nesse caso). Escolha em `modoCadastro`.
- `src/lib/pedidosDoContato.ts`: pedidos do número no pipeline pastoral
  (últimos 8 dígitos, mesma regra do antiduplicidade), com fase, link de
  acompanhamento `/pastoral/timeline/{id}` (a mesma página pública da home) e
  link da ficha enquanto não preenchida. Entra no contexto; "Quero ser Membro"
  em aberto impede novo registro e o agente manda os links.
- Depois de registrar pelo agente, além da confirmação da rota, a pessoa
  recebe o link de acompanhamento. Em pedido duplicado (409), o aviso leva o
  link do pedido que já existe.
- Verificado só em leitura: busca de pedidos com números reais (acha o
  aberto e o concluído, fase e links corretos); página e API da timeline 200.

## Encaminhamento para líderes + aviso de Quero ser Membro (01/11/2026)

- Configuração na instância (`recepcao.encaminhamentos`: área, líder,
  telefone, sexo opcional; `recepcao.avisoQueroSerMembro`: contatos) e editável
  no modal "Recepção (QR) e webhook".
- `src/lib/encaminharLider.ts`: o agente termina com
  `[[ENCAMINHAR]]{"interesses":[...],"sexo":"M|F","resumo":"..."}[[/ENCAMINHAR]]`;
  depois de responder a pessoa, o sistema manda a cada líder da área (filtra
  por sexo quando configurado) a mensagem identificada como "Secretária
  Virtual da Sede": contato (wa.me), links dos pedidos em aberto, resumo e o
  pedido de retorno para o relatório. Uma vez por área por conversa
  (`metadata.encaminhados`). A conversa com o líder aparece na Caixa de Entrada.
- `src/lib/avisoQueroSerMembro.ts`, no cron `/api/cron/whatsapp-ai`: avisa os
  contatos a cada novo `new_member_requests` (site, básico ou completo, e
  agente). Marca em `metadata.recepcao_aviso_qsm_desde` (fora de `recepcao`); a
  primeira passada só grava a marca, sem despejar o histórico.
- 01/11: instância "geral" trocada de 5519992126683 para 5519982277174
  (pareamento por código, `phone-code`), webhooks reapontados, nome do perfil
  "Pastores da Sede", envio e recebimento testados.

## Resumo só no fim + área padrão + conversa parada (01/11/2026)

- O agente anota as áreas de interesse na memória (`interesses`) e manda o
  `[[ENCAMINHAR]]` uma única vez: na despedida, ou na hora em que a pessoa
  pede para falar com alguém (vai também para a área padrão).
- `padrao` por líder (coluna "Padrão" na tela): recebe quando não há
  interesse definido, a conversa é aleatória ou a pessoa pede atendimento
  humano. Em Campinas: Ajuda pastoral / Pr. Crimério.
- `src/lib/resumoConversaParada.ts` no cron: conversa do QR parada há 2–48 h
  sem nenhum encaminhamento → resumo gerado pela IA e enviado às áreas
  anotadas (ou à padrão). Uma vez (`metadata.resumo_auto_em`). As duas
  conversas de teste existentes foram marcadas para não disparar.

## Ajustes de conversa (01/11/2026, noite)

- Lista de departamentos montada pelo código (`listaParaApresentar`): os 5
  fixos + todas as áreas com líder; o agente apresenta exatamente essa lista.
- Área sem líder → líderes padrão. Padrão = todos os líderes marcados, pelo
  sexo da pessoa (`lideresPadrao`); rótulo "Atendimento geral".
- Varões → Francisco Lima (5519992126683). Crimério padrão (M); enquanto não
  houver líder mulher marcada como padrão, ele recebe também as mulheres.
- Tamanho: no máximo 2 parágrafos; acima de ~550 caracteres a IA reescreve
  curto antes de enviar (questionário numerado passa). "Digitando" ~12
  caracteres/s, 3–15 s.
- Conversa fluida (sem repetir aberturas, sem se reapresentar). Atendente pelo
  nome do perfil do WhatsApp; se o sexo só ficar claro depois, "vou te passar
  para..." e troca o nome.
- Reação com emoji (`src/lib/reacaoAgente.ts`, Z-API send-reaction): só 🙏 e 👍;
  o texto nunca leva emoji (removido no código).
- Trava contra resposta em dobro: o envio confere se a linha da fila ainda é
  do worker (status e locked_at).

## Voz (ElevenLabs), assunto reservado, GF, aprendizado e Relatórios (12/11/2026)

- **Voz** (`src/lib/elevenlabs.ts`, `src/lib/respostaEmAudio.ts`): áudio recebido
  é transcrito (scribe_v1) só para o agente — fica em
  `whatsapp_messages.metadata.transcricao`, a conversa continua mostrando o
  áudio. Se a pessoa falou por áudio, a resposta sai em áudio (voz masculina
  para homem, feminina para mulher/desconhecido), com "Gravando áudio..."
  (`delayTyping` do `send-audio`). Link, questionário e opções vão também por
  escrito. Falha na voz = resposta por escrito, como antes. Áudio só aciona a
  IA onde a ElevenLabs está ligada para o campo do agente (outras igrejas: igual
  a antes). Configuração em `settings.elevenlabs_configuration` (por campo), tela
  Configurações → Integrações → ElevenLabs (`/app-ui/system/elevenlabs`,
  permissão `elevenlabs_config`). Em Campinas: ligada, Lucas (M) / Keren (F).
- **Assunto reservado** (denúncia, reclamação, situação delicada): bloco
  `[[ENCAMINHAR]]` com `"reservado":true`; vai SÓ para `recepcao.contatoReservado`
  (modal da recepção). Depois disso todo resumo da conversa vai só para ele.
  Sem contato: ninguém recebe. Falha no envio: não marca como entregue (o
  resumo automático tenta de novo). Áudio de resposta em conversa reservada
  não vai para o storage público. Em Campinas: Pr. Crimério (556384672640).
- **Perfil e GF** (`src/lib/encaminharGf.ts`): o agente pergunta tempo na Sede
  e se alguém já a abordou; monta perfil (faixa etária, perfil, bairro);
  apresenta os GFs (mesma lista da página pública `/gf`, só para o campo da
  sede), sugere pelo perfil e, quando a pessoa aceita, `[[GF]]{"gf","resumo"}`
  avisa na hora os líderes daquele GF (uma vez por GF por conversa).
- **Aprendizado diário** (`src/lib/aprendizadoAgente.ts`, cron whatsapp-ai):
  uma vez por dia por agente, lições gerais tiradas das conversas entram no
  prompt (`settings.ai_agente_aprendizado:<agentId>`). Nunca lê conversa
  reservada; lição com telefone/link é descartada.
- **Relatórios** (Caixa → aba Relatórios, `RelatoriosAtendimento.tsx`,
  `/api/whatsapp/relatorios`, `src/lib/relatorioAtendimento.ts`): período e
  departamento, indicadores, gráficos, conversas resumidas/expandidas, resumo
  de conversa e relatório da IA. Reservado só como número. Permissões
  `whatsapp_inbox.whats_app_inbox.relatorios` e `...relatorio_ia` (a Caixa é
  exclusiva do master).
- **Novidades na telinha de atualização**: `public/novidades.json` — a cada
  versão, nova entrada no topo.
- Verificado: typecheck sem erro novo, lint, `permissoes:check`,
  `scripts/e2e-voz-relatorios.mjs` 30/30 (rotas reais, dados [E2E] apagados),
  `scripts/e2e-zapi-inbound.mjs` 53/53, voz e transcrição reais na ElevenLabs.
- **Não verificado**: conversa real ponta a ponta pela Z-API (depende do
  deploy); o prompt do agente gravado no banco só deve ser atualizado junto
  com o deploy (o código antigo não conhece o bloco reservado).

## Relatórios pela análise das conversas + isolamento por campo + sininho (12/11/2026, noite)

- Relatórios leem TODAS as conversas com mensagem da pessoa no período (não só
  as do agente). Cada uma é analisada pela IA (`relatorio_analise` no
  metadata; refeita só quando chega mensagem nova; 12 por pedido, a tela repete
  sozinha). Números internos (líderes, reservado, avisos, líderes de GF) ficam
  de fora. Gráficos: linha por dia, pizza de sexo, tipo e faixa etária, barras
  de tempo na Sede, departamento, GF e teor. Clique em indicador ou gráfico abre
  a lista com Exportar Excel (CSV) e Imprimir.
- Campo da instância = campo do agente de recepção dela (`src/lib/whatsappCampo.ts`).
  A Caixa (lista de conversas) e os Relatórios filtram pelo campo ativo,
  master inclusive. Instância sem agente segue visível (sem campo definido).
  Antes, o master em Aguaí via as conversas de Campinas.
- Sininho (`src/lib/alertasIgreja.ts`): alerta de card da Secretaria
  (kan_action) só para a igreja do card e para quem vê o campo inteiro
  (master, perfil campo, admin do campo). Testado com os 195 alertas reais.
- Menu "WhatsApp (Caixa)" → "WhatsApp Geral"; a Caixa abre em Relatórios.
- ElevenLabs: botão Ouvir em cada voz (frase de exemplo em português).
- E2E `scripts/e2e-voz-relatorios.mjs`: 33/33.
