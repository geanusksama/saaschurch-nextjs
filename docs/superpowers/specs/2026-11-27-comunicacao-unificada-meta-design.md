# Comunicação unificada: WhatsApp oficial (Meta) dentro de Comunicação → Gestão, anúncios e potenciais membros

Data: 27/11/2026. Decidido com o dono nesta data. Substitui, no que conflitar, a premissa de 23/11 de que o módulo Meta seria separado e nada seria compartilhado com a Z-API (`2026-11-23-whatsapp-oficial-meta-design.md`).

## Por quê

As igrejas vão anunciar nas redes sociais delas (Instagram/Facebook) convidando pessoas para visitar. Quem preencher o formulário do anúncio precisa entrar numa lista para a igreja atender, convidar e integrar — "um painel de leads, porém voltado para membros da igreja". Além disso, a igreja quer mandar mensagens em massa por grupos: aniversariantes (bom dia, parabéns), novos convertidos, quem visitou a igreja.

Tudo isso já existe em **Comunicação → Gestão** (Pipeline, Envio em Massa, Envios, Importações, Distribuição, Cronograma, Dashboard), mas usa a Z-API. O dono quer **aproveitar o que existe**, acrescentar a criação de anúncios e poder usar a **API oficial da Meta**, em vez de manter um módulo paralelo com telas e tabelas duplicadas.

## Decisões do dono

- **Um número oficial por campo**, isolado como os campos já são. Campinas (sede) tem o seu, Brás o seu, Indaiatuba o seu. Cada campo responde as mensagens que chegam para ele e faz os seus anúncios.
- **Seguir os padrões da Meta**: número dedicado à API (chip próprio), nunca número pessoal em uso no celular. Campinas usará um chip novo.
- Contatos vindos de formulário de anúncio se chamam **"Potenciais membros"** no sistema, nunca "leads".
- Tudo concentrado no painel de Comunicação, com uma aba de **criação de anúncios**.

## Decisão técnica (minha, a partir do "aproveite o que existe"): caminho A

| | Como | Troca | Decisão |
|---|---|---|---|
| A | O número oficial do campo vira **mais uma instância** na lista de números que as telas de hoje já usam; o envio escolhe o caminho (Z-API ou Meta) pelo tipo da instância | Mexe no serviço de envio e nas telas de envio para trocar texto livre por modelo quando a instância é oficial; reaproveita campanhas, conversas, jornadas, importações | **Escolhido** |
| B | Chave por igreja: ligada, tudo sai pela Meta | Mesma adaptação de A por baixo, sem poder escolher por envio; obriga a largar a Z-API de uma vez | Descartado |
| C | Manter o módulo Meta separado (estado de 23/11) | Duas telas de envio em massa, duas caixas de conversa — o que o dono não quer | Descartado |

## Fatos que limitam o desenho (verificados)

- **Mensagem iniciada pela igreja só com modelo aprovado** pela Meta. Texto livre só como resposta, até 24 h depois da última mensagem da pessoa.
- **Cada mensagem tem custo**, cobrado no cartão do campo na Meta (portfólio do campo). A Z-API não cobra por mensagem.
- O número hoje conectado é o **de teste da Meta** (+1 555-164-9830): só envia a até 5 números cadastrados. Não serve para uso real.
- App ZionByte: empresa **verificada** em 27/11/2026; app ainda **não publicado**; análise do app (vídeos) pendente. Antes da análise, só quem tem papel no app conecta números e Páginas — na prática, as igrejas só entram depois da análise.
- Ler cadastros de formulário exige `leads_retrieval`, `ads_management`, `pages_show_list`, `pages_read_engagement`, `pages_manage_ads` (doc da Meta lida em 27/11). Criar anúncio pelo sistema exige `ads_management` com acesso padrão à API de Marketing, e o campo precisa de conta de anúncios com pagamento.
- A documentação lida **não confirma** que cadastros de anúncios do Instagram chegam pelo mesmo caminho; confirmar com anúncio real.
- A ferramenta de cadastro de teste da Meta não funciona com o app em desenvolvimento.

## Como o sistema está hoje (lido no código)

- `whatsapp_instances` (Z-API): pertence a um **usuário** (`owner_user_id`) com usuários autorizados em `whatsapp_instance_users`; **não tem campo**. Master usa qualquer uma.
- Envio: `src/lib/whatsappSendService.ts` (`quickSendWhatsApp`, `sendTextViaZApi`…), conversas em `whatsapp_conversations`/`whatsapp_messages`.
- Envio em massa: `whatsapp_campaigns` + `whatsapp_campaign_recipients` + `whatsapp_campaign_instances` (tela `PastoralMassSend.tsx`).
- Cronograma/Envios: jornadas `pastoral_journeys`, `pastoral_journey_steps`, `pastoral_journey_enrollments`, `pastoral_journey_sends`, `pastoral_journey_messages` (telas `PastoralCronograma.tsx`, `JourneySends.tsx`).
- Pipeline pastoral: `pastoral_pipelines`, `pastoral_pipeline_columns`, `pastoral_attendances` (+ timeline), antiduplicidade em `src/lib/pastoralDuplicateCheck.ts`.
- Módulo Meta (etapas 1–3, no ar): `meta_whatsapp_conexoes` (**uma por campo**), `meta_whatsapp_modelos`, `meta_whatsapp_disparos/envios/exclusoes`, central `/app-ui/system/meta-oficial`, crons `meta-modelos`, `meta-envio`, `meta-monitor`, webhook `/api/meta/whatsapp/webhook` (recebe e ainda não processa mensagens).

## Objetivos

1. Cada campo conecta o seu número oficial (já existe) e ele **aparece como instância "Oficial Meta"** nas telas de Comunicação → Gestão, **só para usuários com aquele campo ativo** (master inclusive, regra do campo ativo).
2. **Envio em Massa** com instância oficial: no lugar do texto livre, escolher um **modelo aprovado** do campo e preencher as variáveis (nome, igreja, data…). Mostrar contagem e aviso de custo antes de disparar; respeitar limite diário e qualidade do número; quem pediu para sair (SAIR/PARAR…) nunca recebe.
3. **Cronograma/jornadas** (aniversário, novos convertidos, visitantes) com instância oficial: cada etapa da jornada aponta para um modelo aprovado.
4. **Respostas** que chegam ao número oficial entram nas **mesmas conversas** de hoje; responder em texto livre dentro das 24 h; fora delas, a tela pede um modelo.
5. **Potenciais membros**: o campo conecta a sua Página do Facebook (com o Instagram ligado), escolhe para que igreja vai cada formulário, e cada cadastro vira card "Potencial membro" no Pipeline daquela igreja, sem duplicar, além de aparecer numa aba "Potenciais membros".
6. **Anúncios**: aba para criar anúncio de cadastro (objetivo Cadastros, Instagram/Facebook, formulário instantâneo) pela conta de anúncios do campo.

## Não objetivos

- Tirar a Z-API. Ela continua para quem usa, do jeito que está.
- Um app Meta por igreja ou por campo (o ZionByte serve a todos, como provedor de tecnologia).
- Detectar bloqueio do número pela pessoa (a Meta não informa).

## Antiobjetivos (falhou mesmo que funcione)

- Um campo ver número, conversa, potencial membro ou anúncio de outro campo.
- Sair mensagem iniciada pela igreja em texto livre pela Meta (o número é penalizado).
- Disparo cobrado sem a pessoa ver antes quantas mensagens vai mandar.
- Quebrar as telas de hoje para quem usa só Z-API.

## Fases (ordem de entrega)

1. **Número oficial como instância**: tipo da instância (Z-API | Meta) e o campo dela; o número conectado na central passa a ter a sua instância; o serviço de envio escolhe o caminho pelo tipo; listas de instâncias filtram as oficiais pelo campo ativo.
2. **Envio em Massa com modelo**: seletor de modelo e variáveis quando a instância é oficial; processamento pela fila oficial (limite diário, SAIR, não reenviar o que pode ter saído — regras das etapas 2/3 reaproveitadas). A aba "Envio" da central Meta Oficial é aposentada; a aba "Modelos" continua (é onde se cria e acompanha o modelo).
3. **Cronograma/jornadas com modelo**.
4. **Conversas**: webhook do número oficial grava em `whatsapp_conversations`/`whatsapp_messages`; resposta livre na janela de 24 h.
5. **Potenciais membros** (plano já escrito: `docs/superpowers/plans/2026-11-27-whatsapp-oficial-etapa5-potenciais-membros.md`, ajustar para a aba ficar em Comunicação → Gestão).
6. **Anúncios** (depois da análise de `ads_management`).

Cada fase vai ao ar sozinha. Pela regra de produção, nenhuma fase muda o comportamento de quem só usa Z-API.

## Decisões do dono sobre as dúvidas do revisor (27/11/2026, "pode seguir com as sugestões")

1. **Custo nas jornadas automáticas**: ao ligar uma jornada no número oficial, a tela mostra a previsão de mensagens por mês; o campo define um **teto mensal** de mensagens pelo oficial. Atingido o teto, a jornada pausa (não envia mais no mês) e gera alerta (`envio_pausado`, que chega ao master).
2. **Jornadas existentes**: no número oficial, **cada etapa aponta para um modelo aprovado** (escolhido da lista do campo). Imagem/link vão no próprio modelo; reescrita por IA (`ai_polish`) e mensagem de certificado ficam desligadas no oficial. Sem conversão automática: as jornadas continuam na Z-API; para usar no oficial, a igreja liga cada etapa a um modelo. Um modelo por etapa (não por perfil).
3. **Quem usa**: a instância oficial aparece para quem tem o campo ativo (master inclusive). **Disparar** por ela (Envio em Massa e ligar jornada) exige a permissão nova "Enviar pelo WhatsApp oficial"; ler/responder conversas segue a permissão de conversas atual.
4. **Agente de IA** responde pelo número oficial dentro das 24 h, texto e áudio pela Meta; regras do agente (denúncia só para o Pr. Crimério) sem mudança.
5. **SAIR**: quem pede para sair pelo oficial deixa de receber também pela Z-API do mesmo campo (envio em massa e jornadas).

Ordem combinada: construir as fases 1 a 4, testar com o número de teste da Meta, e só então o dono desliga a Z-API do número atual de Campinas e o conecta na Meta (o mesmo número; pode ser trocado no futuro pela central).

## Cobrança (decisão do dono, 28/11/2026: caminho A, "sempre bem claro o que vai gastar")

- Cada campo paga direto à Meta, no cartão cadastrado na própria conta da Meta (o sistema nunca toca em dinheiro). Sem crédito pré-pago no sistema (exigiria a ZionByte virar parceira de soluções e assumir a fatura).
- Fatos da página oficial de preços da Meta (lida em 28/11/2026): cobrança **por mensagem entregue** desde 01/07/2025; Brasil, utilidade e autenticação: **US$ 0,0068** por mensagem (0,68 ¢); marketing: só na planilha oficial (não lida — não usar valor de terceiros sem o master confirmar); 1.000 mensagens de serviço grátis por número por mês; cobrança em BRL disponível desde 01/07/2026 (fatura do Facebook Brasil); o webhook de status traz `pricing` com `billable` e `category` por mensagem.
- Na tela: antes de cada disparo e ao ligar jornada, **valor estimado** = quantidade × preço da categoria do modelo, na moeda do campo, com o texto "Valor estimado com a tabela da Meta; a Meta cobra no cartão do campo só as mensagens entregues." Se o preço da categoria não estiver preenchido, a tela diz "preço não configurado" em vez de inventar valor.
- **Medidor do mês** na central: mensagens cobradas no mês (pelo `pricing.billable` do webhook) × preço = gasto estimado, e quanto falta até o teto.
- **Tabela de preços editável pelo master** (configuração central, por categoria e moeda), com a data de vigência e o link da tabela oficial.
- Passo a passo na aba Conexão para cadastrar o cartão no Gerenciador de Pagamentos da Meta.

## Pendências do dono

- Campinas: usar o número que hoje está na Z-API (decisão de 27/11), conectando na Meta só depois das fases 1–4 prontas. Demais campos: número dedicado cada um.
- Configuração "Potenciais membros" no Login do Facebook para Empresas (fase 5).
- Vídeos da análise do app (WhatsApp agora; Páginas/cadastros e anúncios depois).
- Token novo do Coolify da Vila Solange.

## Deixado para quem construir

- Nomes de colunas, como ligar a conexão Meta à instância (coluna nova em `whatsapp_instances` ou tabela de ligação), layout dentro do guia de estilo (`docs/architecture/GUIA-ESTILO-SILAS.md`), tamanho do lote da fila, texto do aviso de custo.
- Reaproveitar ou migrar o histórico das tabelas `meta_whatsapp_disparos/envios` quando a aba Envio for aposentada.
