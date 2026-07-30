/**
 * Central de Ajuda — a documentação do sistema em forma de dado.
 *
 * É a mesma fonte para as duas pontas: o painel de ajuda navega por estes
 * artigos, e a IA responde **apenas** com base neles (o prompt de
 * `/api/help/ask` proíbe inventar o que não está aqui). Documentação nova entra
 * neste arquivo, não em dois lugares.
 *
 * Escrever pensando em quem opera, não em quem programa: o que a tela faz, onde
 * fica, o que costuma dar errado. Sem nome de tabela, sem nome de arquivo.
 */

export interface HelpArticle {
  id: string;
  title: string;
  /** rota do sistema que o artigo explica, quando existe */
  path?: string;
  /** termos que a busca também considera (sinônimos, nomes antigos) */
  keywords?: string[];
  /** corpo em markdown simples: ##, listas, **negrito** */
  body: string;
}

export interface HelpSection {
  id: string;
  title: string;
  description: string;
  articles: HelpArticle[];
}

export const HELP_SECTIONS: HelpSection[] = [
  // ═══════════════════════════════════════════════════════════ Primeiros passos
  {
    id: 'inicio',
    title: 'Primeiros passos',
    description: 'Como o sistema é organizado e como se achar nele.',
    articles: [
      {
        id: 'visao-geral',
        title: 'Visão geral do sistema',
        keywords: ['começar', 'introdução', 'menu', 'navegação'],
        body: `
O sistema é dividido em blocos no menu da esquerda:

- **Principal** — Dashboard, Caixa de Entrada, Notificações e o Chat Interno.
- **Secretaria** — o cadastro dos membros e tudo que gira em torno dele: pipeline,
  batismo, consagração, transferência, credenciais, campanhas, relatórios.
- **Gestão Pastoral** — acompanhamento de visitantes e novos convertidos, discipulado,
  envio em massa por WhatsApp e o cronograma de acompanhamento.
- **Ministérios** e **GF (Grupos Familiares)** — equipes, escalas e células.
- **Comunicação** — caixa de entrada do WhatsApp e as instâncias conectadas.
- **Eventos**, **App Móvel**, **Financeiro** e **Sistema** (configurações e permissões).

Na barra de cima ficam a busca global (Ctrl+K), o botão **Mais**, **Novo Membro**,
o modo escuro, as notificações e esta Central de Ajuda.

O que você vê no menu depende das suas permissões. Se um item não aparece, é
permissão — fale com quem administra o sistema.
`,
      },
      {
        id: 'busca-global',
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
        title: 'Por que eu não vejo tudo',
        keywords: ['permissão', 'acesso negado', 'não aparece', 'escopo'],
        body: `
O que cada pessoa enxerga é limitado em duas camadas:

1. **Escopo** — de qual campo, regional e igreja você faz parte. Perfil de igreja e
   funções de secretaria/tesouraria enxergam só a própria igreja; o perfil master
   enxerga tudo.
2. **Permissões** — a matriz em *Sistema → Permissões*, com quatro ações por
   módulo: **Ver**, **Criar**, **Editar** e **Excluir**.

Atenção a uma regra que confunde: quando um usuário tem uma **função** atribuída,
as permissões viram lista branca — tudo que não está explicitamente marcado fica
negado. Por isso um recurso novo pode sumir para quem tem função até alguém
marcá-lo na matriz.
`,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════ Secretaria
  {
    id: 'secretaria',
    title: 'Secretaria',
    description: 'Cadastro de membros, processos eclesiásticos e documentos.',
    articles: [
      {
        id: 'cadastro-membro',
        title: 'Cadastrar e editar um membro',
        path: '/app-ui/members',
        keywords: ['novo membro', 'ficha', 'rol', 'cpf'],
        body: `
**Novo Membro** fica no botão verde da barra superior e em *Secretaria → Lista de Membros*.

Antes de salvar, o sistema procura duplicidade por **CPF** e por nome parecido —
se aparecer aviso, confira antes de continuar: dois cadastros da mesma pessoa
bagunçam ROL, presença e financeiro.

O **ROL** é um número inteiro e global: não se repete entre igrejas e não é
reaproveitado. Ele é gerado pelo sistema, não se digita.

Para editar, abra o perfil e use **Editar**. Mudanças de igreja, título e situação
não se fazem por edição direta — elas têm processo próprio (transferência,
consagração, pipeline).
`,
      },
      {
        id: 'campanhas',
        title: 'Campanhas',
        path: '/app-ui/secretariat/campaigns',
        keywords: ['formulário', 'atualização de dados', 'atualizar foto', 'link', 'aprovar', 'reprovar', 'comunicado'],
        body: `
Campanha é um pedido da secretaria a um grupo de pessoas — atualizar a foto,
confirmar o endereço, enviar um documento — ou apenas um comunicado.

## Criar
Em *Secretaria → Campanhas*, clique em **Nova campanha**:

- **Nome** e **Motivo** (o motivo é interno, não aparece para quem preenche).
- **Descrição** é o texto que a pessoa lê ao abrir o link.
- **Tipo**: *Formulário* (recebe resposta e passa por aprovação) ou *Comunicado*
  (só envia texto, imagem e link/vídeo, sem resposta).

## Montar o formulário
Cada pergunta tem um tipo: texto curto ou longo, número, data, e-mail, telefone,
CPF, lista suspensa, escolha única, múltipla escolha, foto ou PDF.

O campo mais importante é **"Atualiza qual campo do cadastro?"**. É ele que faz a
aprovação gravar a resposta no cadastro do membro. Pergunta sem esse vínculo fica
guardada só na campanha.

As perguntas **travam assim que chega a primeira resposta** — mudar o formulário
no meio deixaria as respostas anteriores ilegíveis. Para mudar, crie outra campanha.

## Distribuir
Duas formas, que se combinam:

- **Copiar link** — o link avulso serve para qualquer canal. Quem abre precisa se
  identificar com **ROL + CPF** (a menos que você desmarque a exigência).
- **Anexar pessoas** — abre o filtro por regional, zona, igreja, título
  eclesiástico e situação, cada bloco com *marcar todos / desmarcar todos*. Depois
  de anexar, o botão **Enviar** dispara pelo WhatsApp, e cada pessoa recebe o seu
  link individual, que já abre identificado.

Escolha a instância do WhatsApp na edição da campanha. O envio respeita a pausa
entre mensagens para não derrubar o número — deixe a aba aberta até terminar.

## Conferir e decidir
A aba **Respostas** lista o que chegou. Ao abrir uma resposta você vê o que foi
enviado e, logo abaixo, **o que muda no cadastro**, campo a campo, no formato
"valor atual → valor novo", com uma caixa de seleção em cada linha.

- **Aprovar** grava no cadastro só os campos marcados e registra uma ocorrência no
  histórico do membro.
- **Reprovar** exige o motivo, e é esse motivo que a pessoa recebe no WhatsApp
  junto com o link para corrigir e reenviar.

Resposta aprovada não reabre: o dado já foi para o cadastro.

## O que costuma dar errado
- **"Escolha a instância do WhatsApp"** — a campanha está sem instância; edite-a.
- **Ninguém pendente de envio** — ou já enviou para todos, ou as pessoas anexadas
  estão sem telefone.
- **CPF já pertence a outra pessoa** — a aprovação para aí, de propósito: dois
  cadastros com o mesmo CPF quebrariam o acesso ao Portal do Membro.
`,
      },
      {
        id: 'quero-ser-membro',
        title: 'Quero ser Membro (ficha de adesão)',
        path: '/app-ui/membership-requests',
        keywords: ['adesão', 'novo convertido', 'ficha', 'aprovar cadastro'],
        body: `
Quem pede para ser membro recebe um link de ficha pelo WhatsApp. A pessoa preenche
sem login — o token do link é a credencial.

A secretaria avalia em *Secretaria → Quero ser Membro*. Aprovar **cria o membro**
com número de ROL e abre o card de admissão no pipeline, que é quem define título
e situação. Reprovar cancela o card e devolve o motivo.

A adesão entra sempre pela **sede** da igreja escolhida.
`,
      },
      {
        id: 'pipeline-secretaria',
        title: 'Pipeline da Secretaria',
        path: '/app-ui/secretariat/pipeline',
        keywords: ['kanban', 'card', 'processo', 'matriz de decisão'],
        body: `
O pipeline é o quadro dos processos eclesiásticos: batismo, transferência,
consagração, credencial, admissão.

Mover um card entre colunas pode disparar a **matriz de decisão** — regras que
alteram a situação, o título eclesiástico ou a igreja do membro automaticamente e
gravam a ocorrência no histórico. Por isso mover card não é um gesto cosmético:
confira a coluna de destino antes.
`,
      },
      {
        id: 'qrcode',
        title: 'Ler QR Code',
        path: '/app-ui/qr-reader',
        keywords: ['canhoto', 'documento', 'scanner', 'consagração'],
        body: `
Lê o QR do canhoto dos documentos emitidos pelo sistema e abre o registro
correspondente para conferência.

O QR alterna de lado no canhoto de propósito — é o que permite distinguir a via
da secretaria da via do membro sem depender de carimbo.
`,
      },
      {
        id: 'transferencia',
        title: 'Transferência de membro',
        path: '/app-ui/transfer',
        keywords: ['mudança de igreja', 'carta'],
        body: `
A transferência move o membro de uma igreja para outra preservando o ROL e o
histórico. O processo passa pelo pipeline: enquanto o card não chega na coluna
final, o membro continua vinculado à igreja de origem.
`,
      },
      {
        id: 'credenciais',
        title: 'Credenciais',
        path: '/app-ui/credentials',
        keywords: ['carteirinha', 'modelo', 'emissão'],
        body: `
Emissão e controle das credenciais ministeriais. Os modelos (layout, campos, foto)
ficam em *Modelos de Credencial*; a emissão usa a foto do cadastro do membro — por
isso campanhas de atualização de foto costumam vir antes de uma emissão em lote.
`,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════ Gestão Pastoral
  {
    id: 'pastoral',
    title: 'Gestão Pastoral',
    description: 'Acompanhamento de visitantes, envio em massa e cronograma.',
    articles: [
      {
        id: 'pastoral-hub',
        title: 'A tela de Gestão e suas abas',
        path: '/app-ui/pastoral-kanban',
        keywords: ['pipeline pastoral', 'visitante', 'acolhimento'],
        body: `
*Gestão Pastoral → Gestão* concentra tudo em abas:

- **Pipeline** — o quadro dos atendimentos e visitantes.
- **Envio em Massa** — dispara WhatsApp para um grupo escolhido.
- **Envios** — histórico de quem recebeu, quem respondeu (verde) e quem não (amarelo).
- **Importações** — listas de contatos vindas de CSV/Excel.
- **Cronograma** — o acompanhamento programado por grupo de chegada.

Todas essas abas dependem da permissão de **Campanhas de WhatsApp**, que fica no
grupo *Comunicação* da matriz — liberar o grupo Gestão Pastoral inteiro não abre
aba nenhuma.
`,
      },
      {
        id: 'envio-massa',
        title: 'Envio em massa por WhatsApp',
        keywords: ['disparo', 'campanha whatsapp', 'variáveis', 'instância'],
        body: `
Escolha a origem dos contatos (membros, pipeline ou uma lista importada), aplique
os filtros, escreva a mensagem e selecione as instâncias.

Na mensagem você pode usar variáveis entre chaves duplas — *primeiro_nome*,
*igreja*, *regional*, *rol*, entre outras — que são trocadas por destinatário.

O envio é escalonado: há uma pausa mínima entre mensagens de uma mesma instância,
porque disparo em rajada faz o WhatsApp banir o número. Usar mais instâncias
aumenta a velocidade sem diminuir a pausa.

**Deixe a aba aberta durante o envio** — é ela que conduz a fila.
`,
      },
      {
        id: 'importacao-csv',
        title: 'Importar lista de contatos (CSV/Excel)',
        keywords: ['planilha', 'lote', 'importar contatos'],
        body: `
A importação analisa o arquivo linha a linha antes de qualquer envio e mostra o
de-para: telefone inválido, número repetido no arquivo, contato que já é membro e
contato que já está no pipeline.

Por padrão **quem já é membro ou já está no pipeline não recebe** — existe uma
caixa "enviar mesmo assim" para os casos em que isso é intencional. Telefone
inválido ou repetido nunca é enviado.
`,
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════ Comunicação
  {
    id: 'comunicacao',
    title: 'Comunicação',
    description: 'WhatsApp, instâncias e chat interno.',
    articles: [
      {
        id: 'whatsapp-instancias',
        title: 'Instâncias do WhatsApp',
        path: '/app-ui/system/whatsapp',
        keywords: ['qr code', 'conectar', 'desconectado', 'z-api', 'número'],
        body: `
Cada instância é um número de WhatsApp conectado ao sistema, e a conexão é feita
lendo um **QR Code** com o aparelho — igual ao WhatsApp Web.

Sinais de que algo está errado:

- **Desconectada** — leia o QR de novo. Enquanto isso, nenhum envio sai por ela.
- **Mensagens não chegam na Caixa de Entrada** — normalmente é o webhook da
  instância; quem administra o sistema resolve.

Cada instância tem uma lista de usuários autorizados. Quem não está na lista não
envia por ela. O perfil master usa qualquer instância.
`,
      },
      {
        id: 'whatsapp-inbox',
        title: 'Caixa de Entrada do WhatsApp',
        path: '/app-ui/communication/whatsapp-inbox',
        keywords: ['conversa', 'atendimento', 'responder', 'ia'],
        body: `
Mostra as conversas em tempo real. Dá para responder pela tela, atribuir a
conversa a um agente e ligar o **agente de IA**, que responde automaticamente
usando o prompt configurado.

O interruptor de quem responde a conversa evita o pior cenário: humano e IA
respondendo a mesma pessoa ao mesmo tempo.
`,
      },
      {
        id: 'chat-interno',
        title: 'Chat interno',
        keywords: ['balão', 'conversa entre usuários'],
        body: `
O balão no canto inferior direito é o chat entre usuários do sistema. Aceita
texto, arquivo e áudio. Você sempre pode excluir a própria mensagem; excluir a de
outra pessoa depende de permissão.
`,
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════ Financeiro
  {
    id: 'financeiro',
    title: 'Financeiro',
    description: 'Livro caixa, lançamentos e relatórios.',
    articles: [
      {
        id: 'livro-caixa',
        title: 'Livro Caixa e lançamentos',
        path: '/app-ui/finance',
        keywords: ['dízimo', 'oferta', 'despesa', 'receita', 'caixa'],
        body: `
Os lançamentos são classificados pelo **plano de contas** — é ele que separa
dízimo, oferta e as demais receitas nos relatórios. Classificar errado no
lançamento significa relatório errado depois.

Ao registrar um dízimo com o membro identificado, há a opção de enviar o **recibo
por WhatsApp** direto da tela de confirmação.
`,
      },
      {
        id: 'contabilidade',
        title: 'Relatório para a contabilidade',
        keywords: ['csv', 'envio automático', 'agendamento', 'exportar'],
        body: `
Gera o arquivo do período no formato que a contabilidade recebe. Há também o envio
automático agendado, que dispara o relatório por WhatsApp na periodicidade
configurada, sem ninguém precisar lembrar.
`,
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════ Sistema
  {
    id: 'sistema',
    title: 'Sistema',
    description: 'Usuários, permissões, listas auxiliares e o app.',
    articles: [
      {
        id: 'permissoes',
        title: 'Matriz de permissões',
        path: '/app-ui/system',
        keywords: ['acesso', 'função', 'role', 'liberar', 'bloquear'],
        body: `
A matriz cruza os módulos do sistema com quatro ações: **Ver**, **Criar**,
**Editar** e **Excluir**. Cada perfil (master, admin, campo, igreja) tem um padrão,
e cada usuário pode ter sobrescritas.

A regra que mais causa dúvida: **usuário com função atribuída tem as permissões
tratadas como lista branca**. Só vale o que está marcado. Quando um módulo novo
entra no sistema, ele não aparece para essas pessoas até ser marcado.

Se alguém diz "sumiu do meu menu", comece por aqui.
`,
      },
      {
        id: 'listas-auxiliares',
        title: 'Listas e cadastros auxiliares',
        keywords: ['zonas', 'títulos eclesiásticos', 'configuração', 'lookup'],
        body: `
Zonas, títulos eclesiásticos, tipos de serviço e as demais listas que alimentam os
seletores do sistema ficam nas configurações. Renomear um item da lista não
reescreve o histórico: registros antigos guardam o nome que valia na época.
`,
      },
      {
        id: 'pwa',
        title: 'Instalar o sistema no celular e atualizar',
        keywords: ['app', 'instalar', 'nova versão', 'atualizar', 'pwa'],
        body: `
O sistema pode ser instalado como aplicativo pelo próprio navegador ("Adicionar à
tela de início").

Quando sai uma versão nova, aparece um aviso pedindo para recarregar. A atualização
**não** é forçada no meio do seu trabalho, de propósito — você recarrega quando
terminar o que está fazendo. Se algo parecer desatualizado, feche e abra o app.
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
export function searchHelp(query: string, limit = 12): HelpHit[] {
  const termos = normalizar(query).split(/\s+/).filter(t => t.length > 1);
  if (!termos.length) return [];

  const hits: HelpHit[] = [];
  for (const section of HELP_SECTIONS) {
    for (const article of section.articles) {
      const titulo = normalizar(article.title);
      const chaves = normalizar((article.keywords ?? []).join(' '));
      const corpo = normalizar(article.body);

      let score = 0;
      for (const t of termos) {
        if (titulo.includes(t)) score += 10;
        if (chaves.includes(t)) score += 6;
        if (corpo.includes(t)) score += 2;
      }
      if (score > 0) hits.push({ section, article, score });
    }
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** Todo o texto da ajuda, para servir de contexto à IA. */
export function helpCorpus(): string {
  return HELP_SECTIONS.map(s =>
    [
      `# ${s.title} — ${s.description}`,
      ...s.articles.map(a =>
        [`## ${a.title}`, a.path ? `(tela: ${a.path})` : '', a.body.trim()].filter(Boolean).join('\n')
      ),
    ].join('\n\n')
  ).join('\n\n---\n\n');
}

export function findArticle(articleId: string): HelpHit | null {
  for (const section of HELP_SECTIONS) {
    const article = section.articles.find(a => a.id === articleId);
    if (article) return { section, article, score: 0 };
  }
  return null;
}
