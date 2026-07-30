/**
 * Central de Ajuda — a documentação do sistema em forma de dado.
 *
 * É a mesma fonte para as duas pontas: a página de ajuda navega por estes
 * artigos, e a IA responde **apenas** com base neles. Documentação nova entra
 * neste arquivo, não em dois lugares.
 *
 * As coleções espelham os blocos do menu, e cada artigo carrega a chave de
 * permissão da tela que explica — é o que faz a ajuda mostrar só o que a pessoa
 * pode usar, inclusive no contexto mandado para a IA.
 *
 * Escrever pensando em quem opera, não em quem programa: o que a tela faz, onde
 * fica, o que costuma dar errado. Sem nome de tabela, sem nome de arquivo.
 */

export interface HelpArticle {
  id: string;
  title: string;
  /** uma linha, mostrada na lista da coleção e abaixo do título do artigo */
  summary?: string;
  /**
   * Chave do permissionCatalog da tela que o artigo explica.
   *
   * Artigo com chave só aparece para quem tem acesso à tela — na navegação, na
   * busca e no contexto da IA. Artigo SEM chave é geral (como "Visão geral do
   * sistema") e aparece sempre.
   */
  permKey?: string;
  /** termos que a busca também considera (sinônimos, nomes antigos) */
  keywords?: string[];
  /** corpo em markdown simples: ##, ###, listas, **negrito**, `código`, imagem */
  body: string;
}

export interface HelpSection {
  id: string;
  title: string;
  description: string;
  /** nome do ícone lucide usado no card da coleção (mapeado na tela) */
  icon?: string;
  articles: HelpArticle[];
}

export const HELP_SECTIONS: HelpSection[] = [
  // ═══════════════════════════════════════════════════════ Primeiros passos
  {
    id: 'inicio',
    icon: 'Rocket',
    title: 'Primeiros passos',
    description: 'Como o sistema é organizado e como se achar nele.',
    articles: [
      {
        id: 'visao-geral',
        summary: 'Os blocos do menu e o que cada um guarda.',
        title: 'Visão geral do sistema',
        keywords: ['começar', 'introdução', 'menu', 'navegação', 'módulos'],
        body: `
O menu da esquerda é dividido em blocos:

- **Principal** — Dashboard, Caixa de Entrada e Notificações.
- **Secretaria** — o cadastro dos membros e tudo que gira em torno dele: pipeline, batismo, consagração, transferência, credenciais, requerimentos, campanhas, presença e relatórios.
- **Gestão Pastoral** — acompanhamento de visitantes e novos convertidos, discipulado, envio em massa e cronograma.
- **Ministérios** — departamentos, equipes e escalas de serviço.
- **GF (Grupos Familiares)** — as células e os relatórios de reunião.
- **Comunicação** — caixa de entrada do WhatsApp e as instâncias conectadas.
- **Eventos** — agenda, ingressos, check-in e Pão Diário.
- **App Móvel** — tudo que alimenta o aplicativo do membro.
- **Finanças** — livro caixa, lançamentos, fluxo de caixa e relatórios.
- **Gestão EBD** — revistas da Escola Bíblica: estoque, entrega e cobrança.
- **Peniel** — inscrições e check-in do evento.
- **Sistema** — usuários, permissões, listas auxiliares e auditoria.

Na barra de cima ficam a busca global, o botão **Mais**, **Novo Membro**, o modo escuro, as notificações e esta Central de Ajuda.

O que você vê no menu depende das suas permissões. Se um bloco inteiro não aparece, é permissão — não é defeito.
`,
      },
      {
        id: 'busca-global',
        summary: 'Achar um membro por nome ou ROL sem caçar no menu.',
        title: 'Busca global (Ctrl+K)',
        keywords: ['procurar', 'localizar membro', 'atalho'],
        body: `
A caixa no topo procura membro por **nome** ou por **número de ROL**.

- Digite e pressione **Enter** para abrir o resultado completo.
- **Ctrl+K** foca a busca de qualquer tela.
- As últimas buscas ficam salvas e aparecem ao clicar na caixa; dá para limpar.
`,
      },
      {
        id: 'escopo-acesso',
        summary: 'Por que um módulo não aparece para você.',
        title: 'Por que eu não vejo tudo',
        keywords: ['permissão', 'acesso negado', 'não aparece', 'escopo', 'sumiu'],
        body: `
O que cada pessoa enxerga é limitado em duas camadas.

## 1. Escopo
De qual campo, regional e igreja você faz parte. Perfil de igreja e as funções de secretaria e tesouraria enxergam só a própria igreja; o perfil de campo enxerga o campo; o master enxerga tudo.

O escopo vale para os **dados**: mesmo com permissão de ver a Lista de Membros, você só vê os membros das igrejas que alcança.

## 2. Permissões
A matriz cruza cada módulo com quatro ações: **Ver**, **Criar**, **Editar** e **Excluir**. O escopo diz *quais registros*; a permissão diz *o que você pode fazer* com eles.

## A regra que mais confunde
Quando o usuário tem uma **função** atribuída, as permissões viram lista branca: só vale o que está explicitamente marcado. Um módulo novo no sistema não aparece para essas pessoas até alguém marcá-lo.

Se alguém disser "sumiu do meu menu", é quase sempre isso.
`,
      },
      {
        id: 'notificacoes',
        permKey: 'notifications',
        summary: 'O sino da barra e o que gera aviso.',
        title: 'Notificações',
        keywords: ['sino', 'avisos', 'alertas'],
        body: `
O sino na barra superior mostra os avisos gerados pelo próprio sistema: movimentações de processo, pedidos que precisam da sua ação e lembretes.

O número vermelho conta só as não lidas. Abrir a notificação a marca como lida.
`,
      },
      {
        id: 'caixa-entrada',
        permKey: 'inbox',
        summary: 'O que chegou e está esperando você.',
        title: 'Caixa de Entrada',
        keywords: ['pendências', 'inbox', 'a fazer'],
        body: `
Reúne o que chegou para você tratar, sem precisar caçar tela por tela. Serve como a lista do que está pendente da sua parte.
`,
      },
      {
        id: 'pwa',
        summary: 'Instalar no celular e o aviso de versão nova.',
        title: 'Instalar no celular e atualizar',
        keywords: ['app', 'instalar', 'nova versão', 'atualizar', 'pwa', 'tela de início'],
        body: `
O sistema pode ser instalado como aplicativo pelo próprio navegador, em **Adicionar à tela de início**. Ele passa a abrir em janela própria, sem a barra do navegador.

Quando sai uma versão nova, aparece um aviso pedindo para recarregar. A atualização **não** é forçada no meio do seu trabalho, de propósito — você recarrega quando terminar o que está fazendo.

Se algo parecer desatualizado ou estranho, feche e abra o app: ele pega a versão nova.
`,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════ Secretaria
  {
    id: 'secretaria',
    icon: 'FolderOpen',
    title: 'Secretaria',
    description: 'Cadastro de membros, processos eclesiásticos e documentos.',
    articles: [
      {
        id: 'cadastro-membro',
        permKey: 'members',
        summary: 'Criar e editar a ficha, o número de ROL e a checagem de duplicidade.',
        title: 'Cadastrar e editar um membro',
        keywords: ['novo membro', 'ficha', 'rol', 'cpf', 'perfil'],
        body: `
**Novo Membro** fica no botão verde da barra superior e em *Secretaria → Lista de Membros*.

Antes de salvar, o sistema procura duplicidade por **CPF** e por nome parecido. Se aparecer aviso, confira antes de continuar: dois cadastros da mesma pessoa bagunçam ROL, presença e financeiro, e juntar depois dá muito mais trabalho.

O **ROL** é um número inteiro e global: não se repete entre igrejas e não é reaproveitado. Ele é gerado pelo sistema, não se digita.

Para editar, abra o perfil e use **Editar**. Mudanças de igreja, título eclesiástico e situação de membresia **não** se fazem por edição direta — elas têm processo próprio (transferência, consagração, pipeline), que é o que garante o registro no histórico.

## Abas do perfil
- **Histórico** — as ocorrências do membro: batismo, consagração, transferência, dirigência, campanhas.
- **Funções** — o histórico de funções exercidas nas igrejas.
- **Documentos** e **Anotações** — anexos e observações internas.
- **Família** — cônjuge e parentesco entre membros.
`,
      },
      {
        id: 'quero-ser-membro',
        permKey: 'members',
        summary: 'A ficha de adesão que vira cadastro depois de aprovada.',
        title: 'Quero ser Membro (ficha de adesão)',
        keywords: ['adesão', 'novo convertido', 'ficha', 'aprovar cadastro', 'solicitação'],
        body: `
Quem pede para ser membro recebe um link de ficha pelo WhatsApp. A pessoa preenche sem login — o link é a credencial.

A secretaria avalia em *Secretaria → Quero ser Membro*:

- **Aprovar** cria o membro com número de ROL e abre o card de admissão no pipeline, que é quem define título e situação. O acolhimento continua depois disso.
- **Reprovar** cancela o card e devolve o motivo para a pessoa.

A adesão entra sempre pela **sede** da igreja escolhida.

## O que costuma dar errado
- **CPF já cadastrado** — a aprovação para, de propósito. Confira se não é a mesma pessoa.
- **Ficha ainda não preenchida** — não há o que aprovar até a pessoa enviar.
`,
      },
      {
        id: 'importacao-membros',
        permKey: 'member_import',
        summary: 'Trazer uma lista de membros de planilha.',
        title: 'Importação de Membros',
        keywords: ['planilha', 'excel', 'csv', 'importar', 'lote'],
        body: `
Traz uma lista de membros a partir de planilha, em vez de cadastrar um a um.

Confira a prévia antes de confirmar: a importação cria cadastro de verdade, com ROL, e desfazer é trabalhoso. Preste atenção especial em CPF repetido e em igreja de destino.
`,
      },
      {
        id: 'campanhas',
        permKey: 'secretaria_campanhas',
        summary: 'Formulários enviados aos membros; a aprovação atualiza o cadastro.',
        title: 'Campanhas',
        keywords: ['formulário', 'atualização de dados', 'atualizar foto', 'link', 'aprovar', 'reprovar', 'comunicado'],
        body: `
Campanha é um pedido da secretaria a um grupo de pessoas — atualizar a foto, confirmar o endereço, enviar um documento — ou apenas um comunicado.

## Criar
Em *Secretaria → Campanhas*, clique em **Nova campanha**:

- **Nome** e **Motivo** (o motivo é interno, não aparece para quem preenche).
- **Descrição** é o texto que a pessoa lê ao abrir o link.
- **Tipo**: *Formulário* (recebe resposta e passa por aprovação) ou *Comunicado* (só envia texto, imagem e link/vídeo, sem resposta).

## Montar o formulário
Cada pergunta tem um tipo: texto curto ou longo, número, data, e-mail, telefone, CPF, lista suspensa, escolha única, múltipla escolha, foto ou PDF.

O campo mais importante é **"Atualiza qual campo do cadastro?"**. É ele que faz a aprovação gravar a resposta no cadastro do membro. Pergunta sem esse vínculo fica guardada só na campanha.

Nem todo campo pode ser atualizado por campanha: ROL, igreja, título e situação ficam de fora de propósito, porque têm processo próprio.

As perguntas **travam assim que chega a primeira resposta** — mudar o formulário no meio deixaria as respostas anteriores ilegíveis. Para mudar, crie outra campanha.

## Distribuir
Duas formas, que se combinam:

- **Copiar link** — serve para qualquer canal. Quem abre precisa se identificar com **ROL + CPF**, a menos que você desmarque a exigência.
- **Anexar pessoas** — filtro por regional, zona, igreja, título eclesiástico e situação, cada bloco com *marcar todos / desmarcar todos*. Depois de anexar, o botão **Enviar** dispara pelo WhatsApp e cada pessoa recebe o seu link individual, que já abre identificado.

Escolha a instância do WhatsApp na edição da campanha. O envio respeita a pausa entre mensagens para não derrubar o número — deixe a aba aberta até terminar.

## Conferir e decidir
A aba **Respostas** lista o que chegou. Ao abrir uma resposta você vê o que foi enviado e, logo abaixo, **o que muda no cadastro**, campo a campo, no formato "valor atual → valor novo", com uma caixa de seleção em cada linha.

- **Aprovar** grava no cadastro só os campos marcados e registra uma ocorrência no histórico do membro.
- **Reprovar** exige o motivo, e é esse motivo que a pessoa recebe no WhatsApp junto com o link para corrigir e reenviar.

Resposta aprovada não reabre: o dado já foi para o cadastro.

## O que costuma dar errado
- **"Escolha a instância do WhatsApp"** — a campanha está sem instância; edite-a.
- **Ninguém pendente de envio** — ou já enviou para todos, ou as pessoas anexadas estão sem telefone.
- **CPF já pertence a outra pessoa** — a aprovação para aí, de propósito.
`,
      },
      {
        id: 'pipeline-secretaria',
        permKey: 'crm_pipeline',
        summary: 'O quadro dos processos e a matriz que muda título e situação.',
        title: 'Pipeline da Secretaria',
        keywords: ['kanban', 'card', 'processo', 'matriz de decisão', 'etapa'],
        body: `
O pipeline é o quadro dos processos eclesiásticos: batismo, transferência, consagração, credencial, admissão. Cada card é um processo de uma pessoa, e as colunas são as etapas.

Mover um card entre colunas pode disparar a **matriz de decisão** — regras que alteram a situação, o título eclesiástico ou a igreja do membro automaticamente e gravam a ocorrência no histórico.

Por isso arrastar card não é gesto cosmético: confira a coluna de destino antes. Algumas etapas exigem documento anexado e recusam o movimento sem ele.
`,
      },
      {
        id: 'configurar-pipelines',
        permKey: 'pipeline_config',
        summary: 'Definir as colunas de cada processo e as regras da matriz.',
        title: 'Configurar Pipelines',
        keywords: ['colunas', 'etapas', 'matriz', 'regras'],
        body: `
Aqui se define quantas colunas cada processo tem, o nome de cada etapa e o que acontece quando um card chega nela.

É a tela que alimenta a **matriz de decisão** do pipeline: mudança de título, mudança de situação, exigência de documento. Mexer aqui muda o comportamento de todos os cards daquele processo, inclusive os que já estão em andamento.
`,
      },
      {
        id: 'servicos-ocorrencias',
        permKey: 'services',
        summary: 'Os tipos de serviço do sistema e a matriz de decisão de cada um.',
        title: 'Serviços e Ocorrências',
        keywords: ['serviço', 'sigla', 'ocorrência', 'matriz de decisão'],
        body: `
Lista os serviços que o sistema reconhece (batismo, consagração, transferência, credencial e os demais), cada um com sua sigla de referência, descrição e os pipelines em que aparece.

É daqui que sai o nome das ocorrências que caem no histórico do membro. Configurar a matriz de decisão de um serviço define o que acontece com o membro quando o processo dele avança.
`,
      },
      {
        id: 'batismo',
        permKey: 'baptism',
        summary: 'Turmas, candidatos e a confirmação do batismo.',
        title: 'Batismo',
        keywords: ['batizar', 'candidato', 'turma', 'águas'],
        body: `
Organiza os candidatos e os eventos de batismo. O candidato entra pelo pipeline, e a confirmação registra a data de batismo no cadastro e a ocorrência no histórico.

Confirmar pode ser feito pela tela ou pelo **leitor de QR Code**, lendo o canhoto do candidato no dia.
`,
      },
      {
        id: 'consagracao',
        permKey: 'consecration',
        summary: 'Elevação de título eclesiástico e seus pré-requisitos.',
        title: 'Consagração',
        keywords: ['título', 'presbítero', 'diácono', 'ministro', 'elevação'],
        body: `
Trata a mudança de título eclesiástico. Cada título tem pré-requisitos configurados (nível anterior, idade, ocorrência exigida), e o processo passa pelo pipeline.

O título do membro só muda quando o card chega na etapa correspondente — não se troca o título editando o cadastro à mão.

No leitor de QR Code, a consagração só é liberada na etapa **Documentos Aprovados**; antes disso o leitor recusa, de propósito.
`,
      },
      {
        id: 'transferencia',
        permKey: 'transfer',
        summary: 'Mover um membro de igreja preservando ROL e histórico.',
        title: 'Transferência de membro',
        keywords: ['mudança de igreja', 'carta', 'transferir'],
        body: `
A transferência move o membro de uma igreja para outra preservando o **ROL** e todo o histórico.

O processo passa pelo pipeline: enquanto o card não chega na etapa final, o membro continua vinculado à igreja de origem. Isso é intencional — evita que a pessoa suma da igreja antiga antes de a nova confirmar.
`,
      },
      {
        id: 'credenciais',
        permKey: 'credentials',
        summary: 'Emissão e controle das carteirinhas ministeriais.',
        title: 'Credenciais',
        keywords: ['carteirinha', 'emissão', 'ministerial', 'validade'],
        body: `
Emissão e controle das credenciais ministeriais.

A credencial usa a **foto do cadastro** do membro. Por isso campanhas de atualização de foto normalmente vêm antes de uma emissão em lote: foto ruim no cadastro vira carteirinha ruim.

O pedido de credencial passa pelo pipeline, como os demais processos.
`,
      },
      {
        id: 'modelos-credencial',
        permKey: 'credential_models',
        summary: 'O layout das carteirinhas: campos, foto e arte.',
        title: 'Modelos de Credencial',
        keywords: ['layout', 'modelo', 'arte', 'frente e verso'],
        body: `
Define o desenho da credencial: onde entra a foto, quais campos aparecem, a arte de frente e verso.

Um modelo é usado por muitas emissões — alterar o modelo muda as próximas emissões, não as já impressas.
`,
      },
      {
        id: 'requerimentos',
        permKey: 'requirements',
        summary: 'Processos administrativos eclesiásticos e seu andamento.',
        title: 'Requerimentos',
        keywords: ['processo administrativo', 'pedido', 'protocolo'],
        body: `
Reúne os processos administrativos eclesiásticos, com filtro por campo, regional, igreja, situação e período.

Serve para acompanhar o que foi pedido, por quem, e em que pé está.
`,
      },
      {
        id: 'qrcode',
        permKey: 'qr_reader',
        summary: 'Ler o canhoto dos documentos emitidos pelo sistema.',
        title: 'Ler QR Code',
        keywords: ['canhoto', 'documento', 'scanner', 'câmera', 'confirmar'],
        body: `
Lê o QR do canhoto dos documentos emitidos pelo sistema e abre o registro correspondente para conferência, com as ações de **confirmar** ou registrar **desistência**.

Aceita o código pela câmera, pela URL ou digitado.

O QR alterna de lado no canhoto de propósito — é o que permite distinguir a via da secretaria da via do membro sem depender de carimbo.

## O que costuma dar errado
- **"QR de outro tipo"** — o leitor está no modo errado (Batismo × Consagração). Troque o modo.
- **Etapa bloqueada** — a consagração só confirma em *Documentos Aprovados*, e algumas etapas exigem documento anexado.
`,
      },
      {
        id: 'presenca-facial',
        permKey: 'attendance',
        summary: 'Registro de presença por reconhecimento facial.',
        title: 'Presença Facial',
        keywords: ['frequência', 'culto', 'face id', 'reconhecimento'],
        body: `
Registro de presença nos cultos por reconhecimento facial, com filtros por período, igreja, nome e dia da semana.

Serve tanto para conferir quem esteve quanto para acompanhar frequência ao longo do tempo.
`,
      },
      {
        id: 'gerar-ticket',
        permKey: 'presence_tickets',
        summary: 'Tíquetes de presença para imprimir e distribuir.',
        title: 'Gerar Ticket',
        keywords: ['tíquete', 'imprimir', 'culto', 'presença'],
        body: `
Cria e imprime tíquetes de presença, identificados por código e vinculados ao membro (ROL) e à data do culto.

A tela lista os tíquetes já criados, com paginação, para reimpressão e conferência.
`,
      },
      {
        id: 'igrejas',
        permKey: 'churches',
        summary: 'Cadastro das igrejas, dirigente, zona e hospedeira.',
        title: 'Igrejas',
        keywords: ['congregação', 'dirigente', 'zona', 'regional', 'anexa'],
        body: `
Cadastro das igrejas: dados, endereço, contatos, **zona** geográfica e a relação com a regional.

Dois conceitos que costumam confundir:

- **Hospedeira e anexas** — a igreja central da regional pode receber outras como anexas.
- **Troca de dirigente** — tem processo próprio, que registra entrada e saída e gera ocorrência no perfil do membro. Não se troca o dirigente apenas editando o texto do cadastro.
`,
      },
      {
        id: 'contatos-leads',
        permKey: 'crm_leads',
        summary: 'Pessoas que ainda não são membros e o acompanhamento delas.',
        title: 'Contatos / Leads',
        keywords: ['visitante', 'lead', 'prospecto', 'crm'],
        body: `
Guarda pessoas que ainda não são membros: visitantes, interessados, contatos vindos de eventos.

É a base de quem pode virar membro depois. Quando a pessoa entra de fato, ela vira cadastro de membro pelo processo de adesão.
`,
      },
      {
        id: 'documentos-word',
        permKey: 'word_docs',
        summary: 'Editor de documentos e mala direta com dados do cadastro.',
        title: 'Documentos',
        keywords: ['word', 'ofício', 'carta', 'mala direta', 'modelo'],
        body: `
Editor de documentos do sistema: cartas, ofícios e declarações a partir de modelos.

A **mala direta** preenche o modelo com os dados do cadastro, gerando um documento por pessoa selecionada — em vez de digitar nome, ROL e igreja um a um.
`,
      },
      {
        id: 'relatorios-secretaria',
        permKey: 'reports',
        summary: 'Relatórios de membresia e movimento, com filtros e exportação.',
        title: 'Relatórios da Secretaria',
        keywords: ['exportar', 'excel', 'pdf', 'listagem', 'estatística'],
        body: `
Relatórios de membresia e movimento, com filtro por campo, regional, igreja, situação e período, e exportação.

Os números respeitam seu escopo: você só soma o que enxerga.
`,
      },
      {
        id: 'aniversariantes',
        permKey: 'birthdays',
        summary: 'Quem faz aniversário hoje, na semana e no mês.',
        title: 'Aniversariantes',
        keywords: ['aniversário', 'parabéns', 'felicitação'],
        body: `
Lista os aniversariantes agrupados por hoje, semana e mês.

Tem o botão de mandar **parabéns pelo WhatsApp** direto da lista. Se não houver instância conectada, ele cai para abrir a conversa no WhatsApp do seu aparelho.
`,
      },
    ],
  },

  // ═════════════════════════════════════════════════════════ Gestão Pastoral
  {
    id: 'pastoral',
    icon: 'HeartHandshake',
    title: 'Gestão Pastoral',
    description: 'Acolhimento, envio em massa, cronograma e discipulado.',
    articles: [
      {
        id: 'pastoral-hub',
        permKey: 'whatsapp_campaigns',
        summary: 'As abas de acompanhamento e de que permissão elas dependem.',
        title: 'A tela de Gestão e suas abas',
        keywords: ['pipeline pastoral', 'visitante', 'acolhimento', 'kanban'],
        body: `
*Gestão Pastoral → Gestão* concentra tudo em abas:

- **Pipeline** — o quadro dos atendimentos e visitantes, por etapa de acolhimento.
- **Envio em Massa** — dispara WhatsApp para um grupo escolhido.
- **Envios** — histórico de quem recebeu, quem respondeu (verde) e quem não (amarelo), com reenvio.
- **Importações** — listas de contatos vindas de planilha.
- **Cronograma** — o acompanhamento programado por grupo de chegada.
- **Dashboard** — os números do acolhimento.

## Atenção à permissão
Todas essas abas dependem da permissão de **Campanhas de WhatsApp**, que fica no grupo *Comunicação* da matriz. Liberar o grupo Gestão Pastoral inteiro **não** abre aba nenhuma — é a causa mais comum de "a tela abre vazia".
`,
      },
      {
        id: 'envio-massa',
        permKey: 'whatsapp_campaigns',
        summary: 'Disparar WhatsApp para um grupo, com variáveis por destinatário.',
        title: 'Envio em massa por WhatsApp',
        keywords: ['disparo', 'campanha whatsapp', 'variáveis', 'instância', 'mensagem'],
        body: `
Escolha a origem dos contatos (membros, pipeline ou uma lista importada), aplique os filtros, escreva a mensagem e selecione as instâncias.

Na mensagem você pode usar variáveis entre chaves duplas — *primeiro_nome*, *nome*, *igreja*, *regional*, *rol*, *cargo* — trocadas por destinatário. Os chips das variáveis podem ser arrastados para dentro do texto.

Dá para anexar uma imagem (a mensagem vira a legenda) e um link, que entra no fim.

## Por que demora
O envio é escalonado: há uma pausa mínima entre mensagens de uma mesma instância, porque disparo em rajada faz o WhatsApp banir o número. Usar mais instâncias aumenta a velocidade sem diminuir a pausa.

**Deixe a aba aberta durante o envio** — é ela que conduz a fila.
`,
      },
      {
        id: 'importacao-csv',
        permKey: 'whatsapp_campaigns',
        summary: 'Subir uma planilha de contatos e entender o que foi descartado.',
        title: 'Importar lista de contatos (CSV/Excel)',
        keywords: ['planilha', 'lote', 'importar contatos', 'de-para'],
        body: `
A importação analisa o arquivo linha a linha **antes** de qualquer envio e mostra o de-para: telefone inválido, número repetido no arquivo, contato que já é membro e contato que já está no pipeline (com a fase em que está).

Por padrão **quem já é membro ou já está no pipeline não recebe** — existe a caixa "enviar mesmo assim" para os casos em que isso é intencional. Telefone inválido ou repetido nunca é enviado.

O resultado fica guardado na aba **Importações**, exportável, para você conferir depois por que alguém não recebeu.
`,
      },
      {
        id: 'cronograma',
        permKey: 'whatsapp_campaigns',
        summary: 'Mensagens programadas de acompanhamento por grupo de chegada.',
        title: 'Cronograma de acompanhamento',
        keywords: ['automático', 'agendado', 'primeiro mês', 'follow-up'],
        body: `
Programa o acompanhamento de quem chegou: cada grupo de chegada recebe as mensagens da sua etapa, no dia certo, sem ninguém precisar lembrar.

O disparo é automático. Se as mensagens pararem de sair, o problema costuma ser a instância desconectada ou o contato sem telefone válido.
`,
      },
      {
        id: 'discipulado',
        permKey: 'discipleship',
        summary: 'Turmas, currículo e o avanço de cada discípulo.',
        title: 'Discipulado',
        keywords: ['curso', 'turma', 'currículo', 'lição', 'acompanhamento'],
        body: `
Acompanha quem está sendo discipulado: a turma, o currículo em uso e a lição em que cada pessoa está.

Serve para enxergar quem travou no meio do caminho e precisa de contato.
`,
      },
      {
        id: 'relatorios-pastorais',
        permKey: 'pastoral_reports',
        summary: 'Números de visitas, atendimentos e acolhimento.',
        title: 'Relatórios Pastorais',
        keywords: ['visita', 'atendimento', 'aconselhamento', 'estatística'],
        body: `
Consolida visitas, atendimentos e o andamento do acolhimento, com filtro por período e igreja.

Os números respeitam seu escopo de acesso.
`,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════ Ministérios
  {
    id: 'ministerios',
    icon: 'Users',
    title: 'Ministérios',
    description: 'Departamentos, equipes e escalas de serviço.',
    articles: [
      {
        id: 'ministerios',
        permKey: 'ministries',
        summary: 'Os departamentos da igreja e quem participa de cada um.',
        title: 'Todos os Ministérios',
        keywords: ['departamento', 'louvor', 'infantil', 'membro do ministério'],
        body: `
Lista os ministérios e departamentos, com os membros vinculados a cada um e a liderança responsável.

O vínculo é com o cadastro de membros — a pessoa não é digitada de novo aqui.
`,
      },
      {
        id: 'equipes-escalas',
        permKey: 'ministry_teams',
        summary: 'Montar equipes e escalar quem serve em cada data.',
        title: 'Equipes e Escalas',
        keywords: ['escala', 'plantão', 'serviço', 'rodízio'],
        body: `
Organiza as equipes dentro de um ministério e monta a escala: quem serve em qual data e função.

Serve para o rodízio não depender do grupo de WhatsApp e da memória de alguém.
`,
      },
    ],
  },

  // ══════════════════════════════════════════════════════ Grupos Familiares
  {
    id: 'gf',
    icon: 'Home',
    title: 'GF (Grupos Familiares)',
    description: 'As células, os encontros e os relatórios de reunião.',
    articles: [
      {
        id: 'gf',
        permKey: 'cells',
        summary: 'Os grupos, o anfitrião, o líder e os participantes.',
        title: 'Todos os GF',
        keywords: ['célula', 'grupo familiar', 'anfitrião', 'líder', 'encontro'],
        body: `
Cadastro dos Grupos Familiares: onde se reúnem, em que dia, quem lidera, quem hospeda e quem participa.

Os participantes vêm do cadastro de membros; visitantes do grupo podem ser registrados como contatos.
`,
      },
      {
        id: 'relatorios-gf',
        permKey: 'cell_reports',
        summary: 'O relatório de cada reunião e o acompanhamento por grupo.',
        title: 'Relatórios de GF',
        keywords: ['reunião', 'presença', 'visitantes', 'oferta do grupo'],
        body: `
Cada reunião gera um relatório: quem foi, quantos visitantes, o que aconteceu.

A leitura útil não é o relatório isolado, mas a sequência: grupo que para de enviar relatório costuma ser grupo que parou de se reunir.
`,
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════ Comunicação
  {
    id: 'comunicacao',
    icon: 'MessagesSquare',
    title: 'Comunicação',
    description: 'WhatsApp, instâncias conectadas e chat interno.',
    articles: [
      {
        id: 'whatsapp-instancias',
        permKey: 'whatsapp_instances',
        summary: 'Conectar um número por QR Code e o que fazer quando cai.',
        title: 'Instâncias do WhatsApp',
        keywords: ['qr code', 'conectar', 'desconectado', 'número', 'celular'],
        body: `
Cada instância é um número de WhatsApp ligado ao sistema, e a conexão é feita lendo um **QR Code** com o aparelho — igual ao WhatsApp Web.

Cada instância tem uma lista de usuários autorizados: quem não está na lista não envia por ela. O perfil master usa qualquer instância.

## Sinais de que algo está errado
- **Desconectada** — leia o QR de novo. Enquanto isso, nenhum envio sai por ela e as campanhas param.
- **Mensagens não chegam na Caixa de Entrada** — normalmente é a configuração de recebimento da instância; quem administra o sistema resolve.
- **Número banido** — quase sempre é disparo em rajada. O sistema já impõe pausa entre mensagens justamente para evitar isso; não contorne.
`,
      },
      {
        id: 'whatsapp-inbox',
        permKey: 'whatsapp_inbox',
        summary: 'Conversas em tempo real, atribuição e o agente de IA.',
        title: 'Caixa de Entrada do WhatsApp',
        keywords: ['conversa', 'atendimento', 'responder', 'ia', 'agente'],
        body: `
Mostra as conversas em tempo real. Dá para responder pela tela, atribuir a conversa a um agente e ligar o **agente de IA**, que responde automaticamente usando o prompt configurado.

Existe um interruptor de quem responde a conversa. Ele evita o pior cenário: humano e IA respondendo a mesma pessoa ao mesmo tempo.

Há também o resumo e a sugestão de resposta por IA, para quem pega uma conversa longa no meio.
`,
      },
      {
        id: 'chat-interno',
        permKey: 'internal_chat',
        summary: 'O chat entre usuários do sistema.',
        title: 'Chat interno',
        keywords: ['balão', 'conversa entre usuários', 'mensagem interna'],
        body: `
O balão no canto inferior direito é o chat entre usuários do sistema. Aceita texto, arquivo e áudio.

Você sempre pode excluir a própria mensagem; excluir a de outra pessoa depende de permissão.
`,
      },
    ],
  },

  // ═════════════════════════════════════════════════════════════════ Eventos
  {
    id: 'eventos',
    icon: 'Calendar',
    title: 'Eventos',
    description: 'Agenda, ingressos, check-in e Pão Diário.',
    articles: [
      {
        id: 'agenda',
        permKey: 'events',
        summary: 'Criar e acompanhar os eventos da igreja.',
        title: 'Agenda de eventos',
        keywords: ['evento', 'programação', 'calendário', 'congresso'],
        body: `
Cadastro e acompanhamento dos eventos: data, local, descrição e inscrições.

O evento criado aqui é o mesmo que aparece no aplicativo do membro, quando marcado para isso.
`,
      },
      {
        id: 'ingressos',
        permKey: 'tickets',
        summary: 'Venda e controle de ingressos dos eventos.',
        title: 'Ingressos',
        keywords: ['venda', 'ticket', 'lote', 'pagamento'],
        body: `
Controla a venda de ingressos: lotes, valores e o que já foi vendido.

O pagamento e o pedido do comprador aparecem no bloco **App Móvel**, em *Pedidos*.
`,
      },
      {
        id: 'checkin',
        permKey: 'checkin',
        summary: 'Registrar entrada no evento ou no culto.',
        title: 'Check-in',
        keywords: ['entrada', 'presença', 'portaria', 'qr'],
        body: `
Registra a entrada no evento ou culto. Pode ser feito pela busca do membro ou pela leitura do QR do ingresso.

O histórico de check-in fica disponível para conferência depois.
`,
      },
      {
        id: 'pao-diario',
        permKey: 'daily_bread',
        summary: 'A devocional publicada para os membros.',
        title: 'Pão Diário',
        keywords: ['devocional', 'meditação', 'palavra do dia'],
        body: `
Publicação da devocional diária, que aparece para os membros no aplicativo.
`,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════ App Móvel
  {
    id: 'app',
    icon: 'Smartphone',
    title: 'App Móvel',
    description: 'Tudo que alimenta o aplicativo do membro.',
    articles: [
      {
        id: 'app-dashboard',
        permKey: 'app_dashboard',
        summary: 'Os números de uso do aplicativo.',
        title: 'Dashboard do App',
        keywords: ['aplicativo', 'uso', 'métricas'],
        body: `
Reúne os números do aplicativo: cadastros, acessos e movimento das telas publicadas.

É a visão de quem cuida do conteúdo do app.
`,
      },
      {
        id: 'cms-departamentos',
        permKey: 'cms_departments',
        summary: 'Montar as páginas dos departamentos que aparecem no app.',
        title: 'CMS Departamentos',
        keywords: ['portal', 'página', 'conteúdo', 'departamento', 'modelo'],
        body: `
Monta as páginas de cada departamento que o membro vê no aplicativo: textos, imagens e blocos.

Há pré-visualização antes de publicar — use-a, porque a página vai para o celular de todo mundo.
`,
      },
      {
        id: 'app-eventos',
        permKey: 'app_events',
        summary: 'Os eventos com ingresso publicados no app.',
        title: 'Eventos com Ingressos',
        keywords: ['evento no app', 'venda', 'ingresso'],
        body: `
Controla quais eventos aparecem no aplicativo com venda de ingresso, com os lotes e valores.
`,
      },
      {
        id: 'app-pedidos',
        permKey: 'app_orders',
        summary: 'As compras feitas pelo aplicativo.',
        title: 'Pedidos',
        keywords: ['compra', 'pagamento', 'comprador', 'status'],
        body: `
Lista os pedidos feitos no aplicativo, com comprador, valor e situação do pagamento.

É por aqui que se confere se um pagamento entrou antes de liberar o ingresso.
`,
      },
      {
        id: 'app-checkin',
        permKey: 'app_checkin',
        summary: 'Validar o ingresso na entrada do evento.',
        title: 'Check-in QR Code',
        keywords: ['portaria', 'validar', 'entrada', 'ingresso'],
        body: `
Lê o QR do ingresso comprado no aplicativo e valida a entrada.

Ingresso já usado é recusado — é o que evita a mesma entrada valer duas vezes.
`,
      },
      {
        id: 'app-reembolsos',
        permKey: 'app_refunds',
        summary: 'Pedidos de devolução e a decisão sobre cada um.',
        title: 'Reembolsos',
        keywords: ['estorno', 'devolução', 'cancelar compra'],
        body: `
Lista os pedidos de reembolso com o motivo informado pelo comprador, para aprovação ou recusa, com espaço para a observação interna.
`,
      },
      {
        id: 'meus-pagamentos',
        permKey: 'stripe_meus_pagamentos',
        summary: 'Os seus próprios pagamentos no sistema.',
        title: 'Meus Pagamentos',
        keywords: ['recibo', 'minha compra', 'cobrança'],
        body: `
Mostra os pagamentos ligados ao seu próprio usuário — não os da igreja.
`,
      },
      {
        id: 'app-programacao',
        permKey: 'app_hq_schedule',
        summary: 'A programação de cultos publicada no app.',
        title: 'Programação',
        keywords: ['horário', 'culto', 'agenda da sede'],
        body: `
Define a programação de cultos e atividades que o membro vê no aplicativo.
`,
      },
      {
        id: 'app-como-chegar',
        permKey: 'app_hq_access',
        summary: 'Endereço e orientações de acesso mostrados no app.',
        title: 'Como Chegar',
        keywords: ['endereço', 'mapa', 'localização', 'acesso'],
        body: `
Endereço, mapa e orientações de acesso exibidos no aplicativo.
`,
      },
      {
        id: 'app-cadastros',
        permKey: 'app_registrations',
        summary: 'Quem se cadastrou pelo aplicativo e a aprovação.',
        title: 'Cadastros no App',
        keywords: ['aprovar', 'rejeitar', 'inscrição', 'conta'],
        body: `
Lista quem se cadastrou pelo aplicativo, com aprovação e rejeição — inclusive em lote, para quando chega muita gente de uma vez.
`,
      },
      {
        id: 'app-midia',
        permKey: 'app_media',
        summary: 'Pregações e vídeos publicados no app.',
        title: 'Mídia / Pregações',
        keywords: ['vídeo', 'pregação', 'áudio', 'youtube'],
        body: `
Publica pregações e vídeos que aparecem para o membro no aplicativo.
`,
      },
      {
        id: 'app-notificacoes',
        permKey: 'app_notifications',
        summary: 'Enviar aviso push para quem usa o aplicativo.',
        title: 'Notificações do App',
        keywords: ['push', 'aviso', 'mensagem no celular'],
        body: `
Envia notificação para os aparelhos com o aplicativo instalado.

Vale a mesma prudência do envio em massa: aviso demais faz o membro desligar as notificações, e aí você perde o canal.
`,
      },
      {
        id: 'app-feed',
        permKey: 'app_feed',
        summary: 'As publicações do mural do aplicativo.',
        title: 'Feed do App',
        keywords: ['mural', 'post', 'publicação'],
        body: `
Gerencia as publicações do mural que o membro vê ao abrir o aplicativo.
`,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════ Finanças
  {
    id: 'financeiro',
    icon: 'Wallet',
    title: 'Finanças',
    description: 'Livro caixa, lançamentos, banco e relatórios.',
    articles: [
      {
        id: 'livro-caixa',
        permKey: 'cashbook',
        summary: 'O livro do mês, com abertura e fechamento por igreja.',
        title: 'Livro Caixa',
        keywords: ['dízimo', 'oferta', 'despesa', 'receita', 'caixa', 'fechamento'],
        body: `
O livro caixa mostra as entradas e saídas do período, por igreja.

## Plano de contas
Os lançamentos são classificados pelo **plano de contas** — é ele que separa dízimo, oferta e as demais receitas nos relatórios. Classificar errado no lançamento significa relatório errado depois, e o conserto é lançamento por lançamento.

## Abertura e fechamento
O caixa tem situação por mês e igreja. Mês fechado não aceita lançamento novo — se precisar corrigir algo de um mês fechado, o caixa precisa ser reaberto por quem tem permissão.

Algumas igrejas ficam com o caixa permanentemente aberto, por configuração.
`,
      },
      {
        id: 'lancamento',
        permKey: 'finance_entries',
        summary: 'Registrar uma entrada ou saída, com comprovante e recibo.',
        title: 'Novo Lançamento',
        keywords: ['receita', 'despesa', 'comprovante', 'recibo', 'dizimista'],
        body: `
Registra uma entrada ou saída: valor, data, plano de contas, forma de pagamento, tipo de documento e centro de custo.

Dá para anexar o **comprovante** e, quando a receita é de um membro identificado, gerar o **recibo** — inclusive enviando por WhatsApp direto da tela de confirmação.

Identificar o dizimista é o que alimenta a análise de dizimistas depois. Lançamento sem identificação não some do caixa, mas some dessa leitura.
`,
      },
      {
        id: 'fluxo-caixa',
        permKey: 'cash_flow',
        summary: 'Entradas e saídas ao longo do tempo.',
        title: 'Fluxo de Caixa',
        keywords: ['saldo', 'evolução', 'mês a mês', 'projeção'],
        body: `
Mostra a evolução de entradas e saídas ao longo do tempo, para enxergar tendência em vez de um mês isolado.
`,
      },
      {
        id: 'santander',
        permKey: 'santander_view',
        summary: 'Conciliação com o extrato bancário.',
        title: 'Banco / Santander',
        keywords: ['extrato', 'conciliação', 'banco', 'ofx'],
        body: `
Traz o movimento bancário para conferir contra o que foi lançado no livro caixa.

A conciliação é o que revela lançamento esquecido e valor digitado errado.
`,
      },
      {
        id: 'planilhas',
        permKey: 'spreadsheets',
        summary: 'Planilha dentro do sistema, com fórmulas e formatação.',
        title: 'Planilhas',
        keywords: ['excel', 'célula', 'fórmula', 'mesclar', 'classificar'],
        body: `
Uma planilha dentro do sistema, com mesclar células, classificar, filtrar e formatar — para o trabalho que hoje sai do sistema e vai parar no Excel.
`,
      },
      {
        id: 'diretoria',
        permKey: 'finance_executive',
        summary: 'Painel executivo: dizimistas, situação e comparativos.',
        title: 'Diretoria',
        keywords: ['painel executivo', 'dizimista', 'ranking', 'gestão'],
        body: `
Painel executivo financeiro, com a análise de dizimistas: situação de cada um, última contribuição e comparativos por período.

É a leitura de gestão, não a operação do dia. Depende dos lançamentos estarem com dizimista identificado e plano de contas correto.
`,
      },
      {
        id: 'relatorios-financeiros',
        permKey: 'finance_reports',
        summary: 'Relatórios do período, por categoria, forma e igreja.',
        title: 'Relatórios Financeiros',
        keywords: ['exportar', 'resumo anual', 'categoria', 'ranking'],
        body: `
Relatórios do período: resumo, evolução mensal, quebra por categoria e por forma de pagamento, e comparativo entre igrejas.

Tudo respeitando seu escopo de acesso.
`,
      },
      {
        id: 'contabilidade',
        permKey: 'finance_reports',
        summary: 'O arquivo para a contabilidade e o envio automático.',
        title: 'Relatório para a contabilidade',
        keywords: ['csv', 'envio automático', 'agendamento', 'contador'],
        body: `
Gera o arquivo do período no formato que a contabilidade recebe.

Há também o **envio automático agendado**, que dispara o relatório por WhatsApp na periodicidade configurada, sem ninguém precisar lembrar todo mês.
`,
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════ Gestão EBD
  {
    id: 'ebd',
    icon: 'BookOpen',
    title: 'Gestão EBD',
    description: 'Revistas da Escola Bíblica: estoque, entrega e cobrança.',
    articles: [
      {
        id: 'ebd-visao',
        permKey: 'ebd_dashboard',
        summary: 'Como o módulo funciona de ponta a ponta e o painel de números.',
        title: 'Como a EBD funciona',
        keywords: ['escola bíblica', 'revista', 'trimestre', 'visão geral'],
        body: `
O módulo substitui o controle de revistas que antes vivia em planilha. O caminho é sempre o mesmo:

1. A **sede compra** o material e dá entrada no estoque.
2. A sede **separa** os pedidos das igrejas.
3. A **entrega** é registrada, com impressão do comprovante.
4. O valor entregue vira **cobrança** no financeiro da EBD.
5. O pagamento é registrado, e o que não foi pago aparece como inadimplência.

Tudo é organizado por **trimestre** — é o trimestre que separa um ciclo do outro nos relatórios e no estoque.

## Dashboard
O painel traz revistas distribuídas por categoria, distribuição por regional, a situação financeira e o comparativo entre trimestres.

O módulo usa os cadastros que já existem: igrejas, regionais, membros e usuários. O líder da EBD é escolhido a partir do cadastro de membros, não digitado de novo.
`,
      },
      {
        id: 'ebd-cadastros',
        permKey: 'ebd_cadastros',
        summary: 'Trimestres, categorias e produtos da EBD.',
        title: 'Cadastros da EBD',
        keywords: ['trimestre', 'categoria', 'produto', 'revista', 'preço'],
        body: `
Três cadastros sustentam o módulo:

- **Trimestres** — o ciclo. Tudo (estoque, entrega, cobrança, relatório) é organizado por ele.
- **Categorias** — como as revistas são agrupadas (por faixa etária, por tipo).
- **Produtos** — as revistas em si, com preço.

Comece pelo trimestre: sem ele aberto, não há onde lançar entrada nem entrega.
`,
      },
      {
        id: 'ebd-estoque',
        permKey: 'ebd_estoque',
        summary: 'Entrada do material comprado e o saldo disponível.',
        title: 'Estoque',
        keywords: ['entrada', 'compra', 'quantidade', 'saldo'],
        body: `
Registra a entrada do material que a sede comprou e mostra o saldo disponível por produto e trimestre.

O saldo cai automaticamente conforme as entregas são registradas — não se dá baixa à mão.

Se o saldo não bater, o motivo mais comum é entrega registrada sem a entrada correspondente, ou entrada lançada no trimestre errado.
`,
      },
      {
        id: 'ebd-entrega',
        permKey: 'ebd_entrega',
        summary: 'Separar o pedido da igreja, entregar e imprimir o comprovante.',
        title: 'Separação e Entrega',
        keywords: ['pedido', 'separar', 'romaneio', 'imprimir', 'igreja'],
        body: `
É a tela do dia a dia. Você monta o pedido da igreja escolhendo os produtos e as quantidades; o sistema calcula os valores.

Ao confirmar a entrega, duas coisas acontecem de uma vez: o **estoque baixa** e o valor vira **cobrança no financeiro da EBD**.

A impressão do comprovante traz o cabeçalho com a igreja e a data, os itens entregues e o rodapé com o total — é o documento que fica com quem retirou.

Confira a igreja e o trimestre antes de confirmar: a entrega mexe em estoque e em dinheiro ao mesmo tempo.
`,
      },
      {
        id: 'ebd-financeiro',
        permKey: 'ebd_financeiro',
        summary: 'O que cada igreja deve, o que pagou e os ajustes.',
        title: 'Financeiro da EBD',
        keywords: ['cobrança', 'pagamento', 'devedor', 'inadimplência', 'ajuste'],
        body: `
Mostra o que cada igreja deve pela revista retirada, o que já pagou e o saldo.

Os **ajustes financeiros** existem para os casos que não são entrega nem pagamento: devolução, desconto combinado, correção de um lançamento errado. Todo ajuste fica registrado — é o que permite explicar depois por que o saldo mudou.
`,
      },
      {
        id: 'ebd-historico',
        permKey: 'ebd_historico',
        summary: 'Tudo que aconteceu, na ordem em que aconteceu.',
        title: 'Histórico da EBD',
        keywords: ['registro', 'log', 'quem fez', 'auditoria'],
        body: `
Registra as movimentações do módulo na ordem: entradas, entregas, pagamentos e ajustes.

É onde se procura quando alguém pergunta "quem entregou isso, e quando?".
`,
      },
      {
        id: 'ebd-relatorios',
        permKey: 'ebd_relatorios',
        summary: 'Retiradas, financeiro, estoque, inadimplência e trimestre.',
        title: 'Relatórios da EBD',
        keywords: ['retirada', 'inadimplência', 'exportar', 'fechamento'],
        body: `
Cinco leituras diferentes do mesmo movimento:

- **Retiradas** — o que cada igreja levou.
- **Financeiro** — cobrado, pago e saldo.
- **Estoque** — o que entrou, o que saiu, o que restou.
- **Inadimplência** — quem está devendo.
- **Trimestre** — o fechamento do ciclo.

O relatório de inadimplência é o que costuma ser usado para a cobrança; o de trimestre, para fechar o ciclo antes de abrir o próximo.
`,
      },
    ],
  },

  // ═════════════════════════════════════════════════════════════════ Peniel
  {
    id: 'peniel',
    icon: 'Bird',
    title: 'Peniel',
    description: 'Inscrições, vagas e check-in do evento.',
    articles: [
      {
        id: 'peniel-dashboard',
        permKey: 'peniel',
        summary: 'Confirmados, fila de espera, vagas e valor arrecadado.',
        title: 'Gestão Peniel',
        keywords: ['inscrição', 'vaga', 'fila de espera', 'confirmado', 'retiro'],
        body: `
O painel do Peniel mostra os números que importam para conduzir o evento: **confirmados**, **fila de espera**, **vagas no próximo evento** e **valor arrecadado**.

A inscrição é feita por uma ficha própria, e a pessoa entra como confirmada ou vai para a fila conforme a disponibilidade de vaga.

A fila de espera não é decoração: quando abre vaga, é dela que sai o próximo.
`,
      },
      {
        id: 'peniel-checkin',
        permKey: 'peniel_checkin',
        summary: 'Ler o QR da inscrição na chegada.',
        title: 'Check-in do Peniel',
        keywords: ['qr', 'entrada', 'chegada', 'portaria'],
        body: `
Lê o QR da inscrição e registra a chegada do participante.

Inscrição não confirmada ou já usada é recusada na leitura.
`,
      },
    ],
  },

  // ════════════════════════════════════════════════════════════════ Sistema
  {
    id: 'sistema',
    icon: 'Settings',
    title: 'Sistema',
    description: 'Usuários, permissões, listas auxiliares e auditoria.',
    articles: [
      {
        id: 'usuarios',
        permKey: 'system_users',
        summary: 'Criar usuário, definir perfil, função e lotação.',
        title: 'Usuários',
        keywords: ['conta', 'acesso', 'senha', 'perfil', 'função', 'lotação'],
        body: `
Cadastro de quem entra no sistema. Cada usuário tem:

- **Perfil** — master, campo, regional ou igreja. Define o alcance dos dados.
- **Função** — o cargo (secretaria, tesouraria, ...). É a função que ativa a regra de lista branca das permissões.
- **Lotação** — campo, regional e igreja a que pertence.

## Copiar permissões
Na tela de permissões do usuário existem **Copiar** e **Colar**: configure um usuário-modelo, copie, abra outro e cole. Na lista de usuários, com algo copiado, aparece **Colar para filtrados**, que aplica de uma vez aos usuários exibidos com os filtros ativos.

Atenção: ele aplica aos usuários **da página exibida**. Se a lista tem mais de uma página, repita nas demais.
`,
      },
      {
        id: 'permissoes',
        permKey: 'system_roles',
        summary: 'A matriz de acesso e a regra de lista branca que confunde.',
        title: 'Funções e Permissões',
        keywords: ['acesso', 'função', 'role', 'liberar', 'bloquear', 'matriz'],
        body: `
A matriz cruza os módulos do sistema com quatro ações: **Ver**, **Criar**, **Editar** e **Excluir**. Cada perfil tem um padrão, e cada usuário pode ter sobrescritas próprias.

## A regra que mais causa dúvida
**Usuário com função atribuída tem as permissões tratadas como lista branca.** Só vale o que está marcado. Quando um módulo novo entra no sistema, ele não aparece para essas pessoas até ser marcado — mesmo que o padrão do perfil dele fosse liberado.

Se alguém diz "sumiu do meu menu" ou "o módulo novo não apareceu", comece por aqui.

## Dica de uso
Dá para alternar a coluna inteira (Ver, Criar, Editar, Excluir) de uma vez, respeitando o filtro de grupo que estiver ativo. Filtrar o grupo *Secretaria* e liberar a coluna Ver é bem mais rápido que marcar linha por linha.
`,
      },
      {
        id: 'configuracoes',
        permKey: 'system_settings',
        summary: 'Dados da igreja, identidade visual e preferências.',
        title: 'Configurações',
        keywords: ['logo', 'cores', 'nome da igreja', 'fuso', 'idioma'],
        body: `
Dados da instituição, identidade visual (logo e cores), fuso horário e as demais preferências gerais do sistema.
`,
      },
      {
        id: 'listas-auxiliares',
        permKey: 'system_settings',
        summary: 'Zonas, títulos e as listas que alimentam os seletores.',
        title: 'Listas e cadastros auxiliares',
        keywords: ['zonas', 'títulos eclesiásticos', 'plano de contas', 'lookup', 'tipos'],
        body: `
As listas que alimentam os seletores do sistema: zonas, títulos eclesiásticos, tipos de serviço, plano de contas, formas de pagamento, tipos de documento.

Renomear um item da lista **não** reescreve o histórico: registros antigos guardam o nome que valia na época. Isso é proposital — mantém o histórico legível.

Excluir um item que já está em uso é o que costuma dar problema. Prefira desativar.
`,
      },
      {
        id: 'senha-campos',
        permKey: 'campo_passwords',
        summary: 'A senha que libera a troca de campo.',
        title: 'Senha dos Campos',
        keywords: ['trocar campo', 'senha', 'acesso a outro campo'],
        body: `
Quem administra vários campos troca de campo informando uma senha. Esta tela é onde essa senha é definida.

A troca de campo muda tudo que você enxerga a partir dali — é por isso que ela é protegida.
`,
      },
      {
        id: 'auditoria',
        permKey: 'audit_log',
        summary: 'Quem alterou o quê, e quando.',
        title: 'Log de Auditoria',
        keywords: ['histórico', 'alteração', 'quem fez', 'rastreio'],
        body: `
Registra as alterações feitas no sistema: quem, o quê e quando.

É a tela para responder "quem mudou isso?" sem depender da memória de ninguém.
`,
      },
      {
        id: 'integracoes',
        permKey: 'integrations',
        summary: 'Serviços externos ligados ao sistema.',
        title: 'Integrações',
        keywords: ['api', 'webhook', 'externo', 'chave'],
        body: `
Configuração dos serviços externos ligados ao sistema, como pagamento, WhatsApp e IA.

Mexer aqui afeta funcionalidades inteiras de uma vez — uma chave errada derruba o envio de mensagens ou o recebimento de pagamentos.
`,
      },
    ],
  },
];

// ── Utilidades usadas pelas duas pontas ──────────────────────────────────────

export interface HelpHit {
  section: HelpSection;
  article: HelpArticle;
  score: number;
}

/** Decide se o usuário pode ver a tela de uma chave do permissionCatalog. */
export type CanView = (permKey: string) => boolean;

/**
 * Recorta a documentação para o que o usuário pode usar.
 *
 * Aplicado nas TRÊS pontas — navegação, busca e o contexto mandado para a IA —
 * e sempre no servidor no caso da IA. Filtrar só na tela seria decoração: quem
 * perguntasse pelo chat receberia a explicação de qualquer jeito.
 *
 * Seção que fica sem artigo nenhum some da lista.
 */
export function filterHelpSections(canView: CanView): HelpSection[] {
  return HELP_SECTIONS.map(s => ({
    ...s,
    articles: s.articles.filter(a => !a.permKey || canView(a.permKey)),
  })).filter(s => s.articles.length > 0);
}

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * Busca por termos. Pontuação simples e previsível: título vale mais que
 * palavra-chave, que vale mais que corpo. Sem fuzzy — na dúvida o usuário
 * reformula, e resultado errado com cara de certo é pior que nenhum resultado.
 */
export function searchHelp(query: string, limit = 12, sections: HelpSection[] = HELP_SECTIONS): HelpHit[] {
  const termos = normalizar(query).split(/\s+/).filter(t => t.length > 1);
  if (!termos.length) return [];

  const hits: HelpHit[] = [];
  for (const section of sections) {
    for (const article of section.articles) {
      const titulo = normalizar(article.title);
      const resumo = normalizar(article.summary ?? '');
      const chaves = normalizar((article.keywords ?? []).join(' '));
      const corpo = normalizar(article.body);

      let score = 0;
      for (const t of termos) {
        if (titulo.includes(t)) score += 10;
        if (chaves.includes(t)) score += 6;
        if (resumo.includes(t)) score += 4;
        if (corpo.includes(t)) score += 2;
      }
      if (score > 0) hits.push({ section, article, score });
    }
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** O texto da ajuda que serve de contexto à IA — já recortado por permissão. */
export function helpCorpus(sections: HelpSection[] = HELP_SECTIONS): string {
  return sections
    .map(s =>
      [
        `# ${s.title} — ${s.description}`,
        ...s.articles.map(a => [`## ${a.title}`, a.summary ?? '', a.body.trim()].filter(Boolean).join('\n')),
      ].join('\n\n')
    )
    .join('\n\n---\n\n');
}

export function findArticle(articleId: string, sections: HelpSection[] = HELP_SECTIONS): HelpHit | null {
  for (const section of sections) {
    const article = section.articles.find(a => a.id === articleId);
    if (article) return { section, article, score: 0 };
  }
  return null;
}
