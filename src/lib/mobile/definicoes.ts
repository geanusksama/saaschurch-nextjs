/**
 * Painel Mobile — o que o painel edita no App Igreja v3 (appv3/app).
 *
 * Um arquivo só descreve cada RECURSO (uma tabela appv3_*): campos, rótulos,
 * o que aparece na lista, o que pode ser editado e a chave de permissão. A
 * tela genérica (src/app-ui/mobile/MobileTela.tsx) monta lista e formulário a
 * partir daqui, e a API genérica (src/app/api/mobile/[recurso]) usa a mesma
 * descrição como lista branca do que aceita gravar — o que não está aqui não
 * chega ao banco.
 *
 * Sem import de servidor: este arquivo roda no navegador também.
 * O escopo (campo, Igreja Mundial, registro-pai) e os efeitos colaterais
 * (ativar ingresso ao confirmar pagamento etc.) ficam em recursosServidor.ts.
 *
 * Documentação do app: appv3/docs (05-BANCO-DE-DADOS.md para as tabelas).
 */

export type TipoCampo =
  | 'texto' | 'textoLongo' | 'numero' | 'dinheiro' | 'bool' | 'data' | 'dataHora'
  | 'imagem' | 'url' | 'opcoes' | 'cor' | 'tags' | 'json' | 'igreja' | 'relacao'
  /** lista de appv3_categorias (tipo em `categoria`); grava o nome */
  | 'categoria'
  /** ministério ativo do campo (tabela ministries do saaschurch) */
  | 'ministerio'
  /** conteúdo de jogo: formulário por jogo que gera o JSON do app (jogoDados.ts) */
  | 'jogo';

export interface CampoDef {
  /** Nome do campo no modelo Prisma (camelCase). */
  col: string;
  rotulo: string;
  tipo: TipoCampo;
  obrigatorio?: boolean;
  /** Mostra na tabela da lista. */
  lista?: boolean;
  /** Só leitura no formulário (vem do app ou do banco). */
  leitura?: boolean;
  opcoes?: [string, string][];
  /** tipo 'relacao': recurso de onde vêm as opções (mesmo escopo). */
  relacao?: string;
  /** tipo 'categoria': qual lista. */
  categoria?: 'EVENTO' | 'PRODUTO';
  ajuda?: string;
  /** Valor inicial ao criar; também o valor quando a pessoa apaga o campo. */
  padrao?: unknown;
  /** Coluna NOT NULL com default no banco (ex.: now()): vazio = deixa o banco decidir / mantém o atual. */
  padraoDoBanco?: boolean;
}

export interface RecursoDef {
  chave: string;
  titulo: string;
  /** Singular, para "Novo …" / "Editar …". */
  item: string;
  permKey: string;
  campos: CampoDef[];
  criar?: boolean;
  excluir?: boolean;
  /** Filho de outro recurso (ex.: opções de ingresso de um evento). */
  pai?: { recurso: string; col: string };
  filhos?: string[];
  /** Filtros da lista: campos de opções, bool ou categoria (ex.: status, publicado). */
  filtros?: string[];
  /** Campo de data usado no filtro "de / até". */
  data?: string;
  /** Orientação mostrada acima da lista. */
  aviso?: string;
  /** Campos usados na busca por texto. */
  busca?: string[];
  vazio?: string;
}

// ── opções reaproveitadas ───────────────────────────────────────────────────
const STATUS_SOLICITACAO: [string, string][] = [
  ['EM_ANALISE', 'Em análise'], ['AGUARDANDO_LINK', 'Em andamento'], ['LINK_ENVIADO', 'Link enviado'],
  ['CONCLUIDA', 'Concluída'], ['RECUSADA', 'Recusada'], ['CANCELADA', 'Cancelada'],
];
const STATUS_CONTRIBUICAO: [string, string][] = [
  ['AGUARDANDO_CONFERENCIA', 'Aguardando conferência'], ['CONFIRMADA', 'Confirmada'],
  ['RECUSADA', 'Não localizada'], ['CANCELADA', 'Cancelada'],
];
const STATUS_PEDIDO: [string, string][] = [
  ['AGUARDANDO_PAGAMENTO', 'Aguardando pagamento'], ['AGUARDANDO_CONFERENCIA', 'Pix informado — conferir'],
  ['PAGO', 'Pago'], ['EM_SEPARACAO', 'Em separação'], ['ENTREGUE', 'Entregue'],
  ['REEMBOLSO_SOLICITADO', 'Reembolso solicitado'], ['REEMBOLSADO', 'Reembolsado'], ['CANCELADO', 'Cancelado'],
];
const STATUS_INGRESSO: [string, string][] = [
  ['AGUARDANDO_PAGAMENTO', 'Aguardando pagamento'], ['ATIVO', 'Ativo'], ['UTILIZADO', 'Utilizado (check-in)'],
  ['REEMBOLSO_SOLICITADO', 'Reembolso solicitado'], ['CANCELADO', 'Cancelado'],
];
const STATUS_REEMBOLSO: [string, string][] = [
  ['SOLICITADO', 'Solicitado'], ['APROVADO', 'Aprovado'], ['NEGADO', 'Negado'], ['PAGO', 'Pago'],
];
const DIAS: [string, string][] = [
  ['0', 'Domingo'], ['1', 'Segunda'], ['2', 'Terça'], ['3', 'Quarta'], ['4', 'Quinta'], ['5', 'Sexta'], ['6', 'Sábado'],
];
const TIPOS_CHAVE_PIX: [string, string][] = [
  ['EMAIL', 'E-mail'], ['TELEFONE', 'Telefone'], ['CNPJ', 'CNPJ'], ['CPF', 'CPF'], ['ALEATORIA', 'Aleatória'],
];
const FINALIDADES_PIX: [string, string][] = [['DIZIMO', 'Dízimo'], ['OFERTA', 'Oferta'], ['LOJA', 'Loja e ingressos']];

/** Quem fez o pedido/solicitação (vem do perfil do app; só leitura). */
const PESSOA: CampoDef = { col: 'pessoa', rotulo: 'Pessoa', tipo: 'texto', lista: true, leitura: true };
const IGREJA_LEITURA: CampoDef = { col: 'igreja', rotulo: 'Igreja', tipo: 'texto', lista: true, leitura: true };

const EVENTO_CAMPOS: CampoDef[] = [
  { col: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: true, lista: true },
  { col: 'tituloCurto', rotulo: 'Título curto', tipo: 'texto', ajuda: 'Aparece nos cartões pequenos e no ingresso.' },
  { col: 'categoria', rotulo: 'Categoria', tipo: 'categoria', categoria: 'EVENTO', lista: true, ajuda: 'Cadastre novas na aba Categorias.' },
  { col: 'inicio', rotulo: 'Início', tipo: 'dataHora', obrigatorio: true, lista: true },
  { col: 'fim', rotulo: 'Fim', tipo: 'dataHora' },
  { col: 'local', rotulo: 'Local', tipo: 'texto' },
  { col: 'endereco', rotulo: 'Endereço', tipo: 'texto' },
  { col: 'descricao', rotulo: 'Descrição', tipo: 'textoLongo' },
  { col: 'imagemUrl', rotulo: 'Imagem', tipo: 'imagem' },
  { col: 'capacidade', rotulo: 'Capacidade', tipo: 'numero', ajuda: 'Vazio = sem limite de ingressos.' },
  { col: 'vendidos', rotulo: 'Vendidos', tipo: 'numero', leitura: true, lista: true },
  { col: 'reembolsoAteHoras', rotulo: 'Reembolso até (horas antes)', tipo: 'numero', padrao: 48 },
  { col: 'ctaTexto', rotulo: 'Texto do botão', tipo: 'texto', ajuda: 'Ex.: "Garantir ingresso".' },
  { col: 'destaque', rotulo: 'Destaque', tipo: 'bool' },
  { col: 'publicado', rotulo: 'Publicado no app', tipo: 'bool', lista: true },
];

const NOTICIA_CAMPOS: CampoDef[] = [
  { col: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: true, lista: true },
  { col: 'tag', rotulo: 'Tag', tipo: 'texto', lista: true },
  { col: 'autor', rotulo: 'Autor', tipo: 'texto' },
  { col: 'corpo', rotulo: 'Texto', tipo: 'textoLongo', ajuda: 'Separe os parágrafos com uma linha em branco.' },
  { col: 'imagemUrl', rotulo: 'Imagem', tipo: 'imagem' },
  { col: 'publicadoEm', rotulo: 'Data de publicação', tipo: 'dataHora', lista: true, padraoDoBanco: true, ajuda: 'Vazio = agora.' },
  { col: 'publicado', rotulo: 'Publicado no app', tipo: 'bool', lista: true },
];

const PIX_CAMPOS: CampoDef[] = [
  { col: 'finalidade', rotulo: 'Finalidade', tipo: 'opcoes', opcoes: FINALIDADES_PIX, obrigatorio: true, lista: true },
  { col: 'favorecido', rotulo: 'Favorecido', tipo: 'texto', obrigatorio: true, lista: true, ajuda: 'Nome que aparece no banco de quem paga (até 25 letras no Pix).' },
  { col: 'tipoChave', rotulo: 'Tipo da chave', tipo: 'opcoes', opcoes: TIPOS_CHAVE_PIX, obrigatorio: true },
  { col: 'chave', rotulo: 'Chave Pix', tipo: 'texto', obrigatorio: true, lista: true },
  { col: 'cnpj', rotulo: 'CNPJ', tipo: 'texto' },
  { col: 'cidade', rotulo: 'Cidade', tipo: 'texto', padrao: 'BRASIL' },
  { col: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 },
  { col: 'ativo', rotulo: 'Ativo', tipo: 'bool', padrao: true, lista: true },
];

export const RECURSOS: Record<string, RecursoDef> = {
  // ── Secretaria e dinheiro ────────────────────────────────────────────────
  solicitacoes: {
    chave: 'solicitacoes', titulo: 'Solicitações', item: 'solicitação', permKey: 'mobile_secretaria',
    filtros: ['status'], data: 'criadoEm',
    busca: ['tipo', 'descricao'],
    vazio: 'Nenhuma solicitação feita pelo app.',
    campos: [
      { col: 'protocolo', rotulo: 'Protocolo', tipo: 'texto', lista: true, leitura: true },
      { col: 'tipo', rotulo: 'Tipo', tipo: 'texto', lista: true, leitura: true },
      PESSOA, IGREJA_LEITURA,
      { col: 'criadoEm', rotulo: 'Pedido em', tipo: 'dataHora', lista: true, leitura: true },
      { col: 'descricao', rotulo: 'Descrição', tipo: 'textoLongo', leitura: true },
      { col: 'dados', rotulo: 'Dados enviados', tipo: 'json', leitura: true },
      { col: 'anexo', rotulo: 'Anexo', tipo: 'url', leitura: true },
      { col: 'status', rotulo: 'Status', tipo: 'opcoes', opcoes: STATUS_SOLICITACAO, lista: true, ajuda: 'A pessoa recebe um alerta no app a cada mudança.' },
      { col: 'resposta', rotulo: 'Resposta para a pessoa', tipo: 'textoLongo' },
      { col: 'linkUrl', rotulo: 'Link (documento, formulário, pagamento)', tipo: 'url' },
    ],
  },
  contribuicoes: {
    chave: 'contribuicoes', titulo: 'Dízimos e ofertas', item: 'contribuição', permKey: 'mobile_tesouraria',
    filtros: ['status', 'tipo'], data: 'criadoEm',
    busca: ['autenticacao', 'descricao'],
    vazio: 'Nenhum dízimo ou oferta registrado pelo app.',
    campos: [
      { col: 'autenticacao', rotulo: 'Autenticação', tipo: 'texto', lista: true, leitura: true },
      { col: 'tipo', rotulo: 'Tipo', tipo: 'opcoes', opcoes: [['DIZIMO', 'Dízimo'], ['OFERTA', 'Oferta']], lista: true, leitura: true },
      PESSOA, IGREJA_LEITURA,
      { col: 'valor', rotulo: 'Valor', tipo: 'dinheiro', lista: true, leitura: true },
      { col: 'metodo', rotulo: 'Forma', tipo: 'texto', leitura: true },
      { col: 'pixTxid', rotulo: 'Identificador do Pix (txid)', tipo: 'texto', leitura: true, ajuda: 'Procure este código no extrato do banco.' },
      { col: 'descricao', rotulo: 'Descrição', tipo: 'texto', leitura: true },
      { col: 'criadoEm', rotulo: 'Registrado em', tipo: 'dataHora', lista: true, leitura: true },
      { col: 'status', rotulo: 'Status', tipo: 'opcoes', opcoes: STATUS_CONTRIBUICAO, lista: true, ajuda: 'Confirme só depois de ver o valor no extrato. A pessoa recebe o alerta.' },
      { col: 'confirmadoEm', rotulo: 'Confirmado em', tipo: 'dataHora', leitura: true },
    ],
  },
  pedidos: {
    chave: 'pedidos', titulo: 'Pedidos', item: 'pedido', permKey: 'mobile_pedidos',
    filtros: ['status'], data: 'criadoEm',
    busca: ['pixTxid'],
    vazio: 'Nenhum pedido feito pelo app.',
    campos: [
      { col: 'numero', rotulo: 'Número', tipo: 'texto', lista: true, leitura: true },
      PESSOA,
      { col: 'itensResumo', rotulo: 'Itens', tipo: 'textoLongo', lista: true, leitura: true },
      { col: 'total', rotulo: 'Total', tipo: 'dinheiro', lista: true, leitura: true },
      { col: 'metodo', rotulo: 'Forma', tipo: 'texto', leitura: true },
      { col: 'pixTxid', rotulo: 'Identificador do Pix (txid)', tipo: 'texto', leitura: true },
      { col: 'criadoEm', rotulo: 'Feito em', tipo: 'dataHora', lista: true, leitura: true },
      { col: 'status', rotulo: 'Status', tipo: 'opcoes', opcoes: STATUS_PEDIDO, lista: true, ajuda: '"Pago" ativa os ingressos do pedido. "Cancelado" cancela os ingressos e devolve as vagas.' },
      { col: 'entrega', rotulo: 'Entrega', tipo: 'texto' },
      { col: 'pagoEm', rotulo: 'Pago em', tipo: 'dataHora', leitura: true },
    ],
  },
  ingressos: {
    chave: 'ingressos', titulo: 'Ingressos', item: 'ingresso', permKey: 'mobile_pedidos',
    filtros: ['status'], data: 'criadoEm',
    aviso: 'Ingresso é emitido quando alguém compra pelo app. Para colocar ingressos à venda, abra o evento em Eventos e cadastre os tipos (Inteira, Meia, Gratuito…) na seção "Ingressos à venda".',
    busca: ['codigo', 'rotulo'],
    vazio: 'Nenhum ingresso emitido.',
    campos: [
      { col: 'codigo', rotulo: 'Código', tipo: 'texto', lista: true, leitura: true, ajuda: 'O mesmo do QR code do ingresso.' },
      { col: 'evento', rotulo: 'Evento', tipo: 'texto', lista: true, leitura: true },
      PESSOA,
      { col: 'rotulo', rotulo: 'Ingresso', tipo: 'texto', lista: true, leitura: true },
      { col: 'valorPago', rotulo: 'Valor', tipo: 'dinheiro', leitura: true },
      { col: 'criadoEm', rotulo: 'Emitido em', tipo: 'dataHora', lista: true, leitura: true },
      { col: 'status', rotulo: 'Status', tipo: 'opcoes', opcoes: STATUS_INGRESSO, lista: true, ajuda: 'Na entrada do evento, marque "Utilizado".' },
    ],
  },
  reembolsos: {
    chave: 'reembolsos', titulo: 'Reembolsos', item: 'reembolso', permKey: 'mobile_pedidos',
    filtros: ['status'], data: 'criadoEm',
    
    vazio: 'Nenhum pedido de reembolso.',
    campos: [
      PESSOA,
      { col: 'referencia', rotulo: 'Pedido / ingresso', tipo: 'texto', lista: true, leitura: true },
      { col: 'motivo', rotulo: 'Motivo', tipo: 'texto', lista: true, leitura: true },
      { col: 'valor', rotulo: 'Valor', tipo: 'dinheiro', lista: true, leitura: true },
      { col: 'criadoEm', rotulo: 'Pedido em', tipo: 'dataHora', lista: true, leitura: true },
      { col: 'status', rotulo: 'Status', tipo: 'opcoes', opcoes: STATUS_REEMBOLSO, lista: true, ajuda: '"Pago" encerra o pedido/ingresso como reembolsado; "Negado" devolve ao estado anterior.' },
    ],
  },

  // ── Conteúdo do campo ───────────────────────────────────────────────────
  eventos: {
    chave: 'eventos', titulo: 'Eventos', item: 'evento', permKey: 'mobile_eventos',
    filtros: ['categoria', 'publicado', 'destaque'], data: 'inicio',
    aviso: 'Para vender ingressos: salve o evento e cadastre os tipos de ingresso (Inteira, Meia, Gratuito…) na seção "Ingressos à venda" do próprio evento. Evento sem tipo de ingresso aparece só como divulgação.',
    criar: true, excluir: true, filhos: ['evento-opcoes'], busca: ['titulo', 'categoria'],
    vazio: 'Nenhum evento do campo.',
    campos: [...EVENTO_CAMPOS.slice(0, 9), { col: 'churchId', rotulo: 'Igreja (opcional)', tipo: 'igreja' }, ...EVENTO_CAMPOS.slice(9)],
  },
  'evento-opcoes': {
    chave: 'evento-opcoes', titulo: 'Ingressos à venda', item: 'opção de ingresso', permKey: 'mobile_eventos',
    criar: true, excluir: true, pai: { recurso: 'eventos', col: 'eventoId' },
    vazio: 'Sem opção de ingresso: o evento aparece só como divulgação.',
    campos: [
      { col: 'rotulo', rotulo: 'Nome', tipo: 'texto', obrigatorio: true, lista: true, ajuda: 'Ex.: "Inteira", "Meia", "Gratuito".' },
      { col: 'preco', rotulo: 'Preço', tipo: 'dinheiro', lista: true, padrao: 0 },
      { col: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 },
      { col: 'ativo', rotulo: 'À venda', tipo: 'bool', lista: true, padrao: true },
    ],
  },
  noticias: {
    chave: 'noticias', titulo: 'Notícias', item: 'notícia', permKey: 'mobile_noticias',
    filtros: ['publicado'], data: 'publicadoEm',
    criar: true, excluir: true, busca: ['titulo', 'tag'], vazio: 'Nenhuma notícia do campo.',
    campos: NOTICIA_CAMPOS,
  },
  midias: {
    chave: 'midias', titulo: 'Cultos (vídeos e áudios)', item: 'culto', permKey: 'mobile_midias',
    filtros: ['tipo', 'publicado'], data: 'publicadoEm',
    criar: true, excluir: true, busca: ['titulo', 'pregador', 'serie'],
    vazio: 'Nenhum culto publicado.',
    campos: [
      { col: 'tipo', rotulo: 'Tipo', tipo: 'opcoes', opcoes: [['VIDEO', 'Vídeo'], ['AUDIO', 'Áudio']], obrigatorio: true, lista: true, padrao: 'VIDEO' },
      { col: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: true, lista: true },
      { col: 'pregador', rotulo: 'Pregador', tipo: 'texto', lista: true },
      { col: 'serie', rotulo: 'Série', tipo: 'texto' },
      { col: 'url', rotulo: 'Link do vídeo/áudio', tipo: 'url', obrigatorio: true, ajuda: 'MP4/MP3 toca dentro do app; link do YouTube abre no YouTube.' },
      { col: 'imagemUrl', rotulo: 'Capa', tipo: 'imagem' },
      { col: 'duracaoSeg', rotulo: 'Duração (segundos)', tipo: 'numero', padrao: 0 },
      { col: 'descricao', rotulo: 'Descrição', tipo: 'textoLongo' },
      { col: 'publicadoEm', rotulo: 'Data', tipo: 'data', lista: true, padraoDoBanco: true, ajuda: 'Vazio = hoje.' },
      { col: 'publicado', rotulo: 'Publicado no app', tipo: 'bool', lista: true },
    ],
  },
  'pao-diario': {
    chave: 'pao-diario', titulo: 'Pão diário', item: 'pão diário', permKey: 'mobile_pao_diario',
    filtros: ['publicado'], data: 'data',
    criar: true, excluir: true, busca: ['titulo', 'referencia'], vazio: 'Nenhum pão diário do campo.',
    campos: [
      { col: 'data', rotulo: 'Dia', tipo: 'data', obrigatorio: true, lista: true },
      { col: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: true, lista: true },
      { col: 'tema', rotulo: 'Tema', tipo: 'texto' },
      { col: 'pregador', rotulo: 'Autor', tipo: 'texto', lista: true },
      { col: 'referencia', rotulo: 'Referência', tipo: 'texto', ajuda: 'Ex.: "Salmos 23:1".' },
      { col: 'versiculo', rotulo: 'Versículo', tipo: 'textoLongo' },
      { col: 'corpo', rotulo: 'Reflexão', tipo: 'textoLongo' },
      { col: 'oracao', rotulo: 'Oração', tipo: 'textoLongo' },
      { col: 'audioUrl', rotulo: 'Link do áudio (opcional)', tipo: 'url', ajuda: 'Sem áudio, o app lê o texto em voz alta.' },
      { col: 'publicado', rotulo: 'Publicado no app', tipo: 'bool', lista: true },
    ],
  },
  produtos: {
    chave: 'produtos', titulo: 'Produtos', item: 'produto', permKey: 'mobile_loja',
    filtros: ['categoria', 'ativo', 'novo'],
    criar: true, excluir: true, filhos: ['produto-cores', 'produto-imagens'], busca: ['nome', 'categoria'],
    vazio: 'Nenhum produto na loja.',
    campos: [
      { col: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true, lista: true },
      { col: 'categoria', rotulo: 'Categoria', tipo: 'categoria', categoria: 'PRODUTO', lista: true, ajuda: 'Cadastre novas na aba Categorias.' },
      { col: 'preco', rotulo: 'Preço', tipo: 'dinheiro', obrigatorio: true, lista: true },
      { col: 'descricao', rotulo: 'Descrição', tipo: 'textoLongo' },
      { col: 'tamanhos', rotulo: 'Tamanhos', tipo: 'tags', ajuda: 'Separados por vírgula: P, M, G. Vazio = tamanho único.' },
      { col: 'estoque', rotulo: 'Estoque', tipo: 'numero', ajuda: 'Informativo.' },
      { col: 'novo', rotulo: 'Selo "Novo"', tipo: 'bool' },
      { col: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 },
      { col: 'ativo', rotulo: 'À venda', tipo: 'bool', lista: true, padrao: true },
    ],
  },
  'produto-cores': {
    chave: 'produto-cores', titulo: 'Cores', item: 'cor', permKey: 'mobile_loja',
    criar: true, excluir: true, pai: { recurso: 'produtos', col: 'produtoId' },
    vazio: 'Sem cores: produto de cor única.',
    campos: [
      { col: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true, lista: true },
      { col: 'hex', rotulo: 'Cor', tipo: 'cor', obrigatorio: true, lista: true, padrao: '#111111' },
      { col: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 },
    ],
  },
  'produto-imagens': {
    chave: 'produto-imagens', titulo: 'Fotos', item: 'foto', permKey: 'mobile_loja',
    criar: true, excluir: true, pai: { recurso: 'produtos', col: 'produtoId' },
    vazio: 'Sem fotos.',
    campos: [
      { col: 'url', rotulo: 'Foto', tipo: 'imagem', obrigatorio: true, lista: true },
      { col: 'vista', rotulo: 'Vista', tipo: 'texto', lista: true, padrao: 'Frente' },
      { col: 'corId', rotulo: 'Cor', tipo: 'relacao', relacao: 'produto-cores', ajuda: 'Vazio = vale para todas as cores.' },
      { col: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 },
    ],
  },
  'loja-destaques': {
    chave: 'loja-destaques', titulo: 'Destaques da loja', item: 'destaque', permKey: 'mobile_loja',
    filtros: ['ativo'],
    criar: true, excluir: true, vazio: 'Nenhum destaque no topo da loja.',
    campos: [
      { col: 'kicker', rotulo: 'Chamada pequena', tipo: 'texto' },
      { col: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: true, lista: true },
      { col: 'cta', rotulo: 'Botão', tipo: 'texto', padrao: 'Ver coleção' },
      { col: 'categoria', rotulo: 'Categoria que o botão abre', tipo: 'categoria', categoria: 'PRODUTO', lista: true },
      { col: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 },
      { col: 'ativo', rotulo: 'Ativo', tipo: 'bool', lista: true, padrao: true },
    ],
  },
  'ebd-licoes': {
    chave: 'ebd-licoes', titulo: 'Lições', item: 'lição', permKey: 'mobile_ebd',
    filtros: ['publicado'], data: 'data',
    criar: true, excluir: true, busca: ['titulo', 'trimestre'], vazio: 'Nenhuma lição cadastrada.',
    campos: [
      { col: 'trimestre', rotulo: 'Trimestre', tipo: 'texto', obrigatorio: true, lista: true, ajuda: 'Ex.: "3º trimestre 2026".' },
      { col: 'numero', rotulo: 'Nº da lição', tipo: 'numero', obrigatorio: true, lista: true },
      { col: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: true, lista: true },
      { col: 'data', rotulo: 'Domingo', tipo: 'data', obrigatorio: true, lista: true },
      { col: 'textoBase', rotulo: 'Texto base', tipo: 'texto' },
      { col: 'conteudo', rotulo: 'Conteúdo', tipo: 'textoLongo' },
      { col: 'publicado', rotulo: 'Publicada no app', tipo: 'bool', lista: true },
    ],
  },
  'ebd-turmas': {
    chave: 'ebd-turmas', titulo: 'Turmas', item: 'turma', permKey: 'mobile_ebd',
    filtros: ['ativo'],
    criar: true, excluir: true, filhos: ['ebd-matriculas'], vazio: 'Nenhuma turma cadastrada.',
    campos: [
      { col: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true, lista: true },
      { col: 'professor', rotulo: 'Professor', tipo: 'texto', lista: true },
      { col: 'sala', rotulo: 'Sala', tipo: 'texto' },
      { col: 'churchId', rotulo: 'Igreja (vazio = todas)', tipo: 'igreja' },
      { col: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 },
      { col: 'ativo', rotulo: 'Ativa', tipo: 'bool', lista: true, padrao: true },
    ],
  },
  'ebd-matriculas': {
    chave: 'ebd-matriculas', titulo: 'Alunos', item: 'matrícula', permKey: 'mobile_ebd',
    pai: { recurso: 'ebd-turmas', col: 'turmaId' }, vazio: 'Nenhuma matrícula.',
    campos: [
      PESSOA,
      { col: 'criadoEm', rotulo: 'Pedido em', tipo: 'dataHora', lista: true, leitura: true },
      { col: 'status', rotulo: 'Status', tipo: 'opcoes', opcoes: [['SOLICITADA', 'Solicitada'], ['ATIVA', 'Ativa'], ['CANCELADA', 'Cancelada']], lista: true },
    ],
  },
  jogos: {
    chave: 'jogos', titulo: 'Jogos', item: 'conteúdo de jogo', permKey: 'mobile_ebd',
    filtros: ['jogo', 'ativo'],
    criar: true, excluir: true, vazio: 'Nenhum conteúdo de jogo.',
    campos: [
      { col: 'jogo', rotulo: 'Jogo', tipo: 'opcoes', obrigatorio: true, lista: true, padrao: 'QUIZ',
        opcoes: [['QUIZ', 'Quiz'], ['VF', 'Verdadeiro ou falso'], ['FORCA', 'Forca'], ['CRUZADAS', 'Palavras cruzadas']] },
      { col: 'licaoId', rotulo: 'Lição da EBD (opcional)', tipo: 'relacao', relacao: 'ebd-licoes' },
      { col: 'resumo', rotulo: 'Conteúdo', tipo: 'texto', lista: true, leitura: true },
      { col: 'dados', rotulo: 'Conteúdo', tipo: 'jogo', obrigatorio: true },
      { col: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 },
      { col: 'ativo', rotulo: 'Ativo', tipo: 'bool', lista: true, padrao: true },
    ],
  },
  'categorias-evento': {
    chave: 'categorias-evento', titulo: 'Categorias', item: 'categoria de evento', permKey: 'mobile_eventos',
    filtros: ['ativo'],
    criar: true, excluir: true, busca: ['nome'], vazio: 'Nenhuma categoria de evento.',
    aviso: 'Renomear uma categoria atualiza os eventos que já a usam. Categoria em uso não pode ser excluída — desative.',
    campos: [
      { col: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true, lista: true, ajuda: 'Ex.: Congresso, Culto especial, Retiro.' },
      { col: 'ministryId', rotulo: 'Ministério (opcional)', tipo: 'ministerio', lista: true },
      { col: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 },
      { col: 'ativo', rotulo: 'Ativa', tipo: 'bool', lista: true, padrao: true },
    ],
  },
  'categorias-produto': {
    chave: 'categorias-produto', titulo: 'Categorias', item: 'categoria de produto', permKey: 'mobile_loja',
    filtros: ['ativo'],
    criar: true, excluir: true, busca: ['nome'], vazio: 'Nenhuma categoria de produto.',
    aviso: 'Use o ministério para separar o que cada um vende (Jovens, Adolescentes, CIBE Mulheres…). Renomear atualiza os produtos; categoria em uso não pode ser excluída — desative.',
    campos: [
      { col: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true, lista: true, ajuda: 'Ex.: Camisetas Jovens, Livros, CIBE Mulheres.' },
      { col: 'ministryId', rotulo: 'Ministério (opcional)', tipo: 'ministerio', lista: true },
      { col: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 },
      { col: 'ativo', rotulo: 'Ativa', tipo: 'bool', lista: true, padrao: true },
    ],
  },
  lideranca: {
    chave: 'lideranca', titulo: 'Liderança local', item: 'líder', permKey: 'mobile_comunidade',
    filtros: ['ativo', 'presidente'],
    criar: true, excluir: true, vazio: 'Nenhum líder cadastrado.',
    campos: [
      { col: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true, lista: true },
      { col: 'cargo', rotulo: 'Cargo', tipo: 'texto', lista: true },
      { col: 'conjuge', rotulo: 'Cônjuge', tipo: 'texto' },
      { col: 'fotoUrl', rotulo: 'Foto', tipo: 'imagem' },
      { col: 'palavra', rotulo: 'Palavra', tipo: 'textoLongo' },
      { col: 'churchId', rotulo: 'Igreja (opcional)', tipo: 'igreja' },
      { col: 'presidente', rotulo: 'Pastor presidente', tipo: 'bool', lista: true },
      { col: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 },
      { col: 'ativo', rotulo: 'Ativo', tipo: 'bool', lista: true, padrao: true },
    ],
  },
  'igrejas-perfil': {
    chave: 'igrejas-perfil', titulo: 'Página das igrejas', item: 'página da igreja', permKey: 'mobile_comunidade',
    busca: ['nome'], vazio: 'Nenhuma igreja no campo.',
    campos: [
      { col: 'nome', rotulo: 'Igreja', tipo: 'texto', lista: true, leitura: true },
      { col: 'fotoUrl', rotulo: 'Foto da fachada', tipo: 'imagem', lista: true },
      { col: 'historia', rotulo: 'História', tipo: 'textoLongo' },
      { col: 'marcos', rotulo: 'Marcos da história (JSON)', tipo: 'json', ajuda: '[{"rotulo":"1972","texto":"Fundação"}]', padrao: [] },
    ],
  },
  'ministerios-info': {
    chave: 'ministerios-info', titulo: 'Ministérios no app', item: 'ministério', permKey: 'mobile_comunidade',
    busca: ['nome'], vazio: 'Nenhum ministério ativo no campo (cadastre em Ministérios).',
    campos: [
      { col: 'nome', rotulo: 'Ministério', tipo: 'texto', lista: true, leitura: true },
      { col: 'publico', rotulo: 'Público', tipo: 'texto', lista: true, ajuda: 'Ex.: "Jovens de 18 a 30 anos".' },
      { col: 'agenda', rotulo: 'Agenda', tipo: 'texto', lista: true, ajuda: 'Ex.: "Sábados, 19h30".' },
      { col: 'imagemUrl', rotulo: 'Imagem', tipo: 'imagem' },
    ],
  },
  convites: {
    chave: 'convites', titulo: 'Cartões convite', item: 'modelo de convite', permKey: 'mobile_comunidade',
    filtros: ['diaSemana', 'ativo'],
    criar: true, excluir: true, vazio: 'Nenhum modelo de convite.',
    campos: [
      { col: 'rotulo', rotulo: 'Rótulo', tipo: 'texto', obrigatorio: true, lista: true, ajuda: 'Ex.: "Culto da família".' },
      { col: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: true, lista: true },
      { col: 'diaSemana', rotulo: 'Dia', tipo: 'opcoes', opcoes: DIAS, obrigatorio: true, lista: true, padrao: '0' },
      { col: 'hora', rotulo: 'Hora (HH:MM)', tipo: 'texto', obrigatorio: true, lista: true, padrao: '19:00' },
      { col: 'local', rotulo: 'Local', tipo: 'texto' },
      { col: 'endereco', rotulo: 'Endereço', tipo: 'texto' },
      { col: 'cor', rotulo: 'Cor', tipo: 'cor', padrao: '#D4F53C' },
      { col: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 },
      { col: 'ativo', rotulo: 'Ativo', tipo: 'bool', lista: true, padrao: true },
    ],
  },
  alertas: {
    chave: 'alertas', titulo: 'Avisos para o campo', item: 'aviso', permKey: 'mobile_alertas',
    filtros: ['tipo'], data: 'criadoEm',
    criar: true, excluir: true, vazio: 'Nenhum aviso enviado. Os alertas individuais (secretaria, pagamentos) saem sozinhos.',
    campos: [
      { col: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: true, lista: true },
      { col: 'corpo', rotulo: 'Mensagem', tipo: 'textoLongo', lista: true },
      { col: 'tipo', rotulo: 'Ícone', tipo: 'opcoes', padrao: 'EVENT', lista: true,
        opcoes: [['EVENT', 'Evento'], ['LIVE', 'Ao vivo'], ['GF', 'Grupo familiar'], ['SEC', 'Secretaria']] },
      { col: 'criadoEm', rotulo: 'Enviado em', tipo: 'dataHora', lista: true, leitura: true },
    ],
  },
  perfis: {
    chave: 'perfis', titulo: 'Contas do app', item: 'conta', permKey: 'mobile_membros',
    filtros: ['situacao'], data: 'criadoEm',
    busca: ['nome', 'email'], vazio: 'Ninguém criou conta no app ainda.',
    campos: [
      { col: 'nome', rotulo: 'Nome', tipo: 'texto', lista: true, leitura: true },
      { col: 'email', rotulo: 'E-mail', tipo: 'texto', lista: true, leitura: true },
      { col: 'celular', rotulo: 'Celular', tipo: 'texto', leitura: true },
      IGREJA_LEITURA,
      { col: 'situacao', rotulo: 'Situação', tipo: 'opcoes', lista: true, leitura: true,
        opcoes: [['MEMBRO', 'Membro vinculado'], ['VISITANTE', 'Visitante'], ['EXCLUIDA', 'Conta excluída']] },
      { col: 'criadoEm', rotulo: 'Criada em', tipo: 'dataHora', lista: true, leitura: true },
      { col: 'publico', rotulo: 'Aparece no diretório de membros', tipo: 'bool' },
    ],
  },

  // ── Configurações (Igreja Mundial e Pix) ───────────────────────────────
  pix: {
    chave: 'pix', titulo: 'Pix do campo', item: 'chave Pix', permKey: 'mobile_config',
    filtros: ['finalidade', 'ativo'],
    criar: true, excluir: true, vazio: 'Sem chave Pix: dízimo, oferta e loja ficam sem Pix no app.',
    campos: PIX_CAMPOS,
  },
  'mundial-lideres': {
    chave: 'mundial-lideres', titulo: 'Liderança mundial', item: 'líder mundial', permKey: 'mobile_config',
    filtros: ['ativo'],
    criar: true, excluir: true, vazio: 'Nenhum líder mundial.',
    campos: [
      { col: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true, lista: true },
      { col: 'cargo', rotulo: 'Cargo', tipo: 'texto', lista: true },
      { col: 'fotoUrl', rotulo: 'Foto', tipo: 'imagem' },
      { col: 'desde', rotulo: 'Desde', tipo: 'texto' },
      { col: 'paises', rotulo: 'Países', tipo: 'texto' },
      { col: 'anos', rotulo: 'Anos de ministério', tipo: 'texto' },
      { col: 'citacao', rotulo: 'Citação', tipo: 'textoLongo' },
      { col: 'resumo', rotulo: 'Resumo', tipo: 'textoLongo' },
      { col: 'bio', rotulo: 'Biografia (JSON)', tipo: 'json', padrao: [], ajuda: '[{"titulo":"Chamado","texto":"…"}]' },
      { col: 'fotos', rotulo: 'Galeria (JSON)', tipo: 'json', padrao: [], ajuda: '[{"url":"https://…","legenda":"…"}]' },
      { col: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 },
      { col: 'ativo', rotulo: 'Ativo', tipo: 'bool', lista: true, padrao: true },
    ],
  },
  'mundial-recursos': {
    chave: 'mundial-recursos', titulo: 'Cartões do portal', item: 'cartão', permKey: 'mobile_config',
    filtros: ['ativo'],
    criar: true, excluir: true, vazio: 'Nenhum cartão no portal.',
    campos: [
      { col: 'titulo', rotulo: 'Título', tipo: 'texto', obrigatorio: true, lista: true },
      { col: 'tag', rotulo: 'Tag', tipo: 'texto', lista: true },
      { col: 'descricao', rotulo: 'Descrição', tipo: 'textoLongo' },
      { col: 'cta', rotulo: 'Botão', tipo: 'texto' },
      { col: 'url', rotulo: 'Link', tipo: 'url' },
      { col: 'imagemUrl', rotulo: 'Imagem', tipo: 'imagem' },
      { col: 'ordem', rotulo: 'Ordem', tipo: 'numero', padrao: 0 },
      { col: 'ativo', rotulo: 'Ativo', tipo: 'bool', lista: true, padrao: true },
    ],
  },
  'mundial-eventos': {
    chave: 'mundial-eventos', titulo: 'Eventos mundiais', item: 'evento mundial', permKey: 'mobile_config',
    filtros: ['publicado'], data: 'inicio',
    criar: true, excluir: true, vazio: 'Nenhum evento da Igreja Mundial.',
    campos: EVENTO_CAMPOS.filter((c) => !['capacidade', 'vendidos', 'reembolsoAteHoras'].includes(c.col))
      // a Igreja Mundial é de todos os campos: categoria em texto livre
      .map((c) => (c.col === 'categoria' ? { col: 'categoria', rotulo: 'Categoria', tipo: 'texto' as const, lista: true } : c)),
  },
  'mundial-noticias': {
    chave: 'mundial-noticias', titulo: 'Notícias mundiais', item: 'notícia mundial', permKey: 'mobile_config',
    filtros: ['publicado'], data: 'publicadoEm',
    criar: true, excluir: true, vazio: 'Nenhuma notícia da Igreja Mundial.',
    campos: NOTICIA_CAMPOS,
  },
  'mundial-pix': {
    chave: 'mundial-pix', titulo: 'Pix da Igreja Mundial', item: 'chave Pix', permKey: 'mobile_config',
    filtros: ['finalidade', 'ativo'],
    criar: true, excluir: true, vazio: 'Sem Pix mundial.',
    campos: PIX_CAMPOS.map((c) => (c.col === 'finalidade' ? { ...c, opcoes: FINALIDADES_PIX.slice(0, 2) } : c)),
  },
};

/** Telas do menu Mobile: cada uma junta recursos em abas. */
export interface TelaDef { chave: string; titulo: string; sub: string; recursos: string[] }

export const TELAS: Record<string, TelaDef> = {
  secretaria: { chave: 'secretaria', titulo: 'Secretaria do app', sub: 'Pedidos de documento, carta, batismo e cadastro feitos pelo app.', recursos: ['solicitacoes'] },
  tesouraria: { chave: 'tesouraria', titulo: 'Dízimos e ofertas do app', sub: 'Conferência dos Pix informados no app.', recursos: ['contribuicoes'] },
  pedidos: { chave: 'pedidos', titulo: 'Pedidos e ingressos', sub: 'Compras da loja, ingressos e reembolsos.', recursos: ['pedidos', 'ingressos', 'reembolsos'] },
  eventos: { chave: 'eventos', titulo: 'Eventos', sub: 'Agenda do campo no app, com venda de ingressos.', recursos: ['eventos', 'categorias-evento'] },
  noticias: { chave: 'noticias', titulo: 'Notícias', sub: 'Notícias do campo no app.', recursos: ['noticias'] },
  cultos: { chave: 'cultos', titulo: 'Cultos', sub: 'Vídeos e áudios da aba Cultos.', recursos: ['midias'] },
  'pao-diario': { chave: 'pao-diario', titulo: 'Pão diário', sub: 'Devocional do dia.', recursos: ['pao-diario'] },
  loja: { chave: 'loja', titulo: 'Loja', sub: 'Produtos e destaques da loja do app.', recursos: ['produtos', 'loja-destaques', 'categorias-produto'] },
  ebd: { chave: 'ebd', titulo: 'EBD e jogos', sub: 'Lições, turmas, matrículas e conteúdo dos jogos.', recursos: ['ebd-licoes', 'ebd-turmas', 'jogos'] },
  comunidade: { chave: 'comunidade', titulo: 'Igreja e liderança', sub: 'Liderança local, página das igrejas, ministérios e convites.', recursos: ['lideranca', 'igrejas-perfil', 'ministerios-info', 'convites'] },
  alertas: { chave: 'alertas', titulo: 'Avisos', sub: 'Aviso para todas as pessoas do campo no sino do app.', recursos: ['alertas'] },
  contas: { chave: 'contas', titulo: 'Contas do app', sub: 'Quem criou conta no app deste campo.', recursos: ['perfis'] },
};

/** Abas da tela Configurações que usam a tela genérica. */
export const RECURSOS_CONFIG = ['pix', 'mundial-lideres', 'mundial-recursos', 'mundial-eventos', 'mundial-noticias', 'mundial-pix'];

/** Dados da Igreja Mundial (Configurações). Mesma lista branca no servidor. */
export const MUNDIAL_CAMPOS: CampoDef[] = [
  { col: 'nome', rotulo: 'Nome completo', tipo: 'texto', obrigatorio: true },
  { col: 'sigla', rotulo: 'Sigla', tipo: 'texto', padrao: 'AD' },
  { col: 'nomeCurto', rotulo: 'Nome curto', tipo: 'texto', padrao: 'ASSEMBLEIA DE DEUS' },
  { col: 'tituloPortal', rotulo: 'Título da tela inicial', tipo: 'textoLongo', ajuda: 'Aparece antes do login. Quebra de linha vale.' },
  { col: 'subtituloPortal', rotulo: 'Subtítulo da tela inicial', tipo: 'textoLongo' },
  { col: 'logoUrl', rotulo: 'Logo', tipo: 'imagem' },
  { col: 'cnpj', rotulo: 'CNPJ', tipo: 'texto' },
  { col: 'radioNome', rotulo: 'Nome da rádio', tipo: 'texto' },
  { col: 'radioUrl', rotulo: 'Link da rádio (stream)', tipo: 'url' },
  { col: 'ativo', rotulo: 'Ativa', tipo: 'bool', padrao: true },
];
