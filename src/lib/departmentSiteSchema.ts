/**
 * Schema compartilhado das páginas de departamento.
 *
 * Um único arquivo descreve os blocos disponíveis, seus campos editáveis e os
 * valores padrão. O builder do CMS monta o formulário a partir daqui e o
 * renderizador público lê o mesmo contrato — nenhum dos dois inventa campo.
 *
 * Usado no servidor (rota pública SSR) e no cliente (builder), então não pode
 * importar nada de React nem de Node.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tokens de estilo
// ─────────────────────────────────────────────────────────────────────────────

/** Tokens que um preset define. Viram CSS custom properties na página. */
export interface StyleTokens {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  secondary: string;
  accent: string;
  radius: string;
  fontTitle: string;
  fontBody: string;
  heroOverlay: string;
  shadow: string;
}

export interface StylePreset {
  id: string;
  nome: string;
  descricao: string;
  tema: "dark" | "light";
  tokens: StyleTokens;
  ordem: number;
}

/**
 * Espelho dos presets da tabela `site_style_presets` (migration 50).
 *
 * O banco é a fonte de verdade — isto aqui é o fallback usado quando a
 * consulta falha e a lista de referência para tipagem. Mantenha os dois em
 * sincronia ao adicionar um preset novo.
 */
export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "midnight", nome: "Midnight Neon", tema: "dark", ordem: 1,
    descricao: "Fundo escuro profundo com acentos neon. Combina com Jovens e Adolescentes.",
    tokens: {
      bg: "#0B0B14", surface: "#14142A", surfaceAlt: "#1C1C3A", border: "#2A2A4E",
      text: "#F5F5FF", textMuted: "#9A9AC0",
      primary: "#7C5CFF", secondary: "#FF3D9A", accent: "#00E5FF",
      radius: "20px", fontTitle: "Space Grotesk", fontBody: "Inter",
      heroOverlay: "linear-gradient(135deg, rgba(124,92,255,.85), rgba(255,61,154,.55))",
      shadow: "0 20px 60px rgba(124,92,255,.25)",
    },
  },
  {
    id: "royal", nome: "Royal Gold", tema: "dark", ordem: 2,
    descricao: "Roxo profundo com dourado. Ar de congresso e celebração — CIBE, Missões.",
    tokens: {
      bg: "#150E24", surface: "#221537", surfaceAlt: "#2E1D49", border: "#3D2A5C",
      text: "#FDF8EC", textMuted: "#BCA9CF",
      primary: "#8E44AD", secondary: "#5B2C87", accent: "#E8C86A",
      radius: "14px", fontTitle: "Playfair Display", fontBody: "Inter",
      heroOverlay: "linear-gradient(160deg, rgba(21,14,36,.92), rgba(142,68,173,.45))",
      shadow: "0 18px 50px rgba(232,200,106,.18)",
    },
  },
  {
    id: "slate", nome: "Slate Minimal", tema: "light", ordem: 3,
    descricao: "Claro, sóbrio e direto. Muito branco e azul discreto — Varões, Diaconato.",
    tokens: {
      bg: "#F7F8FA", surface: "#FFFFFF", surfaceAlt: "#EEF1F6", border: "#DDE2EB",
      text: "#12161F", textMuted: "#5F6B7F",
      primary: "#1B3A6B", secondary: "#3A6EA5", accent: "#0FA3B1",
      radius: "10px", fontTitle: "Inter", fontBody: "Inter",
      heroOverlay: "linear-gradient(180deg, rgba(18,22,31,.55), rgba(18,22,31,.15))",
      shadow: "0 10px 30px rgba(18,22,31,.08)",
    },
  },
  {
    id: "warm", nome: "Warm Editorial", tema: "light", ordem: 4,
    descricao: "Bege e terracota, tipografia serifada. Aconchego — Família, Casais.",
    tokens: {
      bg: "#FBF7F2", surface: "#FFFFFF", surfaceAlt: "#F3EAE0", border: "#E5D7C7",
      text: "#2B211A", textMuted: "#7A6A5C",
      primary: "#B4643C", secondary: "#8C5A3C", accent: "#D9A441",
      radius: "18px", fontTitle: "Fraunces", fontBody: "Inter",
      heroOverlay: "linear-gradient(180deg, rgba(43,33,26,.5), rgba(43,33,26,.1))",
      shadow: "0 14px 40px rgba(180,100,60,.14)",
    },
  },
  {
    id: "academy", nome: "Academy", tema: "light", ordem: 5,
    descricao: "Verde escuro e serifada, cara de escola. EBD, Discipulado, Seminários.",
    tokens: {
      bg: "#F4F6F3", surface: "#FFFFFF", surfaceAlt: "#E7EDE7", border: "#D2DCD2",
      text: "#14231A", textMuted: "#546358",
      primary: "#1F5138", secondary: "#2E7355", accent: "#C9A227",
      radius: "8px", fontTitle: "Lora", fontBody: "Inter",
      heroOverlay: "linear-gradient(180deg, rgba(20,35,26,.6), rgba(20,35,26,.2))",
      shadow: "0 10px 28px rgba(20,35,26,.10)",
    },
  },
  {
    id: "sunrise", nome: "Sunrise Kids", tema: "light", ordem: 6,
    descricao: "Cores vivas, formas arredondadas e muito contraste. Infantil e Kids.",
    tokens: {
      bg: "#FFFDF6", surface: "#FFFFFF", surfaceAlt: "#FFF1D6", border: "#FFE0AE",
      text: "#26221A", textMuted: "#7C7360",
      primary: "#FF7A45", secondary: "#FFB000", accent: "#12B886",
      radius: "28px", fontTitle: "Baloo 2", fontBody: "Nunito",
      heroOverlay: "linear-gradient(135deg, rgba(255,122,69,.75), rgba(255,176,0,.55))",
      shadow: "0 16px 44px rgba(255,122,69,.22)",
    },
  },
  {
    id: "mono", nome: "Mono Store", tema: "light", ordem: 7,
    descricao: "Preto e branco, alto contraste, foco no produto. Ideal para loja.",
    tokens: {
      bg: "#FFFFFF", surface: "#FFFFFF", surfaceAlt: "#F4F4F4", border: "#E4E4E4",
      text: "#000000", textMuted: "#6B6B6B",
      primary: "#000000", secondary: "#333333", accent: "#E11D48",
      radius: "4px", fontTitle: "Inter", fontBody: "Inter",
      heroOverlay: "linear-gradient(180deg, rgba(0,0,0,.35), rgba(0,0,0,0))",
      shadow: "0 8px 24px rgba(0,0,0,.08)",
    },
  },
  {
    id: "worship", nome: "Worship Stage", tema: "dark", ordem: 8,
    descricao: "Escuro com azul cênico e luz de palco. Louvor, Mídia, Coral.",
    tokens: {
      bg: "#080D1A", surface: "#101A30", surfaceAlt: "#16233F", border: "#243354",
      text: "#EAF2FF", textMuted: "#8FA3C4",
      primary: "#2D6CDF", secondary: "#1B3F80", accent: "#66E0C0",
      radius: "16px", fontTitle: "Outfit", fontBody: "Inter",
      heroOverlay: "linear-gradient(140deg, rgba(8,13,26,.9), rgba(45,108,223,.4))",
      shadow: "0 20px 55px rgba(45,108,223,.28)",
    },
  },
];

export const DEFAULT_PRESET_ID = "midnight";

export function getPreset(id: string | null | undefined): StylePreset {
  return STYLE_PRESETS.find((p) => p.id === id) ?? STYLE_PRESETS[0];
}

/** Converte tokens em CSS custom properties para aplicar na raiz da página. */
export function tokensToCssVars(
  tokens: StyleTokens,
  overrides: Partial<StyleTokens> = {},
): Record<string, string> {
  const merged = { ...tokens, ...overrides };
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(merged)) {
    // camelCase → --ds-kebab-case
    vars[`--ds-${k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}`] = String(v);
  }
  return vars;
}

// ─────────────────────────────────────────────────────────────────────────────
// Blocos
// ─────────────────────────────────────────────────────────────────────────────

export type FieldType =
  | "text" | "textarea" | "richtext" | "number" | "boolean"
  | "image" | "video" | "color" | "select" | "url" | "list"
  /** Escolha de uma seção da própria página (usado pelo menu). */
  | "ancora";

export interface BlockField {
  key: string;
  label: string;
  type: FieldType;
  /** Ajuda curta mostrada abaixo do campo no builder. */
  hint?: string;
  options?: { value: string; label: string }[];
  /** Para `list`: descreve os campos de cada item. */
  itemFields?: BlockField[];
  default?: unknown;
}

export interface BlockVariant {
  id: string;
  label: string;
  /** Descrição do layout, para o usuário escolher sem precisar testar. */
  descricao: string;
}

export interface BlockDefinition {
  tipo: string;
  label: string;
  /** Nome do ícone lucide-react usado no painel do builder. */
  icone: string;
  descricao: string;
  /** Agrupamento na biblioteca de blocos. */
  grupo: "Destaque" | "Conteúdo" | "Mídia" | "Pessoas" | "Conversão" | "Estrutura";
  variantes: BlockVariant[];
  campos: BlockField[];
}

const ALIGN_OPTIONS = [
  { value: "left", label: "Esquerda" },
  { value: "center", label: "Centro" },
  { value: "right", label: "Direita" },
];

/**
 * Biblioteca de blocos. Cada entrada vira um card arrastável no builder.
 *
 * Blocos `evento` e `loja` são especiais: não guardam conteúdo nas props, eles
 * consultam os eventos e produtos do departamento em tempo de renderização.
 * Por isso o botão de inscrição some sozinho quando o prazo passa — a página
 * não precisa ser republicada.
 */
export const BLOCK_LIBRARY: BlockDefinition[] = [
  {
    tipo: "menu", label: "Menu / Topo", icone: "Menu", grupo: "Estrutura",
    descricao:
      "Barra de navegação no topo com a logo e os links. Cada item pode apontar " +
      "para uma seção da própria página — ao clicar, a página rola até lá.",
    variantes: [
      { id: "simples", label: "Logo à esquerda", descricao: "Logo de um lado, links do outro" },
      { id: "centralizado", label: "Logo ao centro", descricao: "Links dos dois lados da logo" },
      { id: "cta", label: "Com botão", descricao: "Links e um botão de destaque à direita" },
      { id: "transparente", label: "Transparente", descricao: "Sem fundo, sobreposto ao hero" },
      { id: "pilulas", label: "Pílulas", descricao: "Links dentro de cápsulas arredondadas" },
      { id: "empilhado", label: "Empilhado", descricao: "Logo em cima, links embaixo, centralizado" },
    ],
    campos: [
      { key: "logo", label: "Logo", type: "image", hint: "Envie a imagem da marca", default: "" },
      { key: "titulo", label: "Nome (se não houver logo)", type: "text", default: "" },
      { key: "alturaLogo", label: "Altura da logo (px)", type: "number", default: 36 },
      { key: "fixo", label: "Fixar no topo ao rolar", type: "boolean", default: true },
      { key: "itens", label: "Itens do menu", type: "list",
        itemFields: [
          { key: "label", label: "Texto", type: "text" },
          { key: "ancora", label: "Ir para a seção", type: "ancora" },
          { key: "url", label: "Ou link externo", type: "url" },
        ],
        default: [] },
      { key: "ctaTexto", label: "Texto do botão", type: "text", hint: "Usado na variante Com botão", default: "" },
      { key: "ctaUrl", label: "Link do botão", type: "url", default: "" },
    ],
  },
  {
    tipo: "html", label: "HTML próprio", icone: "Code", grupo: "Conteúdo",
    descricao:
      "Cole seu próprio HTML e CSS. Útil para incorporar mapas, formulários de " +
      "terceiros ou montar uma seção do zero.",
    variantes: [
      { id: "contido", label: "Contido", descricao: "Dentro da largura do site" },
      { id: "largura-total", label: "Largura total", descricao: "De ponta a ponta da tela" },
    ],
    campos: [
      { key: "html", label: "HTML", type: "richtext",
        hint: "Tags <script> e atributos onclick são removidos por segurança", default: "" },
      { key: "css", label: "CSS (opcional)", type: "richtext",
        hint: "Aplicado apenas dentro deste bloco", default: "" },
      { key: "espacamento", label: "Espaçamento", type: "select", default: "md",
        options: [{ value: "none", label: "Nenhum" }, { value: "sm", label: "Pequeno" },
                  { value: "md", label: "Médio" }, { value: "lg", label: "Grande" }] },
    ],
  },
  {
    tipo: "container", label: "Container", icone: "Columns", grupo: "Estrutura",
    descricao:
      "Caixa com colunas para montar seu próprio arranjo: texto, imagem e botão " +
      "lado a lado, com fundo e espaçamento à sua escolha.",
    variantes: [
      { id: "2-colunas", label: "2 colunas", descricao: "Lado a lado" },
      { id: "3-colunas", label: "3 colunas", descricao: "Três caixas" },
      { id: "4-colunas", label: "4 colunas", descricao: "Quatro caixas" },
      { id: "destaque", label: "Caixa única", descricao: "Uma caixa larga com fundo" },
    ],
    campos: [
      { key: "titulo", label: "Título da seção", type: "text", default: "" },
      { key: "fundo", label: "Cor de fundo", type: "color", hint: "Vazio = fundo do tema", default: "" },
      { key: "borda", label: "Mostrar borda nas caixas", type: "boolean", default: true },
      { key: "alinhamento", label: "Alinhamento", type: "select", options: ALIGN_OPTIONS, default: "left" },
      { key: "colunas", label: "Caixas", type: "list",
        itemFields: [
          { key: "icone", label: "Ícone (emoji)", type: "text" },
          { key: "imagem", label: "Imagem", type: "image" },
          { key: "titulo", label: "Título", type: "text" },
          { key: "texto", label: "Texto", type: "textarea" },
          { key: "botaoTexto", label: "Texto do botão", type: "text" },
          { key: "botaoUrl", label: "Link do botão", type: "url" },
        ], default: [] },
    ],
  },
  {
    tipo: "tabela", label: "Tabela", icone: "Table", grupo: "Conteúdo",
    descricao: "Tabela de preços, horários ou comparativos.",
    variantes: [
      { id: "listrada", label: "Listrada", descricao: "Linhas alternadas" },
      { id: "linhas", label: "Só linhas", descricao: "Divisórias finas" },
      { id: "cartao", label: "Cartão", descricao: "Com borda e cantos arredondados" },
    ],
    campos: [
      { key: "titulo", label: "Título", type: "text", default: "" },
      { key: "colunas", label: "Cabeçalho", type: "list",
        itemFields: [{ key: "titulo", label: "Título da coluna", type: "text" }], default: [] },
      { key: "linhas", label: "Linhas", type: "list",
        itemFields: [
          { key: "celulas", label: "Células (separe por | )", type: "text" },
          { key: "destaque", label: "Destacar esta linha", type: "boolean" },
        ], default: [] },
    ],
  },
  {
    tipo: "hero", label: "Hero", icone: "LayoutTemplate", grupo: "Destaque",
    descricao: "Abertura da página, em tela cheia ou dividida.",
    variantes: [
      { id: "center", label: "Centralizado", descricao: "Título grande no centro sobre imagem de fundo" },
      { id: "split", label: "Dividido", descricao: "Texto de um lado, imagem do outro" },
      { id: "video", label: "Vídeo de fundo", descricao: "Vídeo em loop atrás do título" },
      { id: "carousel", label: "Carrossel", descricao: "Vários slides alternando automaticamente" },
      { id: "minimal", label: "Minimalista", descricao: "Só tipografia, sem imagem" },
      { id: "gradient", label: "Gradiente", descricao: "Fundo em degradê com as cores do tema" },
    ],
    campos: [
      { key: "titulo", label: "Título", type: "text", default: "Bem-vindo" },
      { key: "subtitulo", label: "Subtítulo", type: "textarea", default: "" },
      { key: "badge", label: "Etiqueta", type: "text", hint: "Texto pequeno acima do título", default: "" },
      { key: "imagem", label: "Imagem de fundo", type: "image", default: "" },
      { key: "video", label: "Vídeo de fundo", type: "video", hint: "Usado na variante Vídeo", default: "" },
      { key: "overlay", label: "Escurecer fundo (%)", type: "number", default: 50 },
      { key: "altura", label: "Altura", type: "select", default: "lg",
        options: [{ value: "sm", label: "Baixa" }, { value: "md", label: "Média" },
                  { value: "lg", label: "Alta" }, { value: "full", label: "Tela cheia" }] },
      { key: "alinhamento", label: "Alinhamento", type: "select", options: ALIGN_OPTIONS, default: "center" },
      { key: "ctaTexto", label: "Texto do botão", type: "text", default: "" },
      { key: "ctaUrl", label: "Link do botão", type: "url", default: "" },
      { key: "slides", label: "Slides", type: "list",
        hint: "Usado na variante Carrossel — cada slide pode ter seu próprio texto",
        itemFields: [
          { key: "imagem", label: "Imagem", type: "image" },
          { key: "titulo", label: "Título", type: "text" },
          { key: "subtitulo", label: "Subtítulo", type: "text" },
          { key: "ctaTexto", label: "Texto do botão", type: "text" },
          { key: "ctaUrl", label: "Link do botão", type: "url" },
        ], default: [] },
      { key: "efeito", label: "Efeito de transição", type: "select", default: "fade",
        hint: "Como um slide dá lugar ao próximo",
        options: [
          { value: "fade", label: "Suave (fade)" },
          { value: "deslizar", label: "Deslizar" },
          { value: "zoom", label: "Zoom" },
          { value: "empurrar", label: "Empurrar para cima" },
          { value: "cortina", label: "Cortina" },
        ] },
      { key: "autoplay", label: "Passar sozinho", type: "boolean", default: true },
      { key: "intervalo", label: "Segundos por slide", type: "number", default: 6 },
      { key: "setas", label: "Mostrar setas", type: "boolean", default: true },
    ],
  },
  {
    tipo: "texto", label: "Texto", icone: "Type", grupo: "Conteúdo",
    descricao: "Parágrafos, títulos de seção e citações.",
    variantes: [
      { id: "default", label: "Simples", descricao: "Bloco de texto corrido" },
      { id: "duas-colunas", label: "Duas colunas", descricao: "Texto dividido em duas colunas" },
      { id: "destaque", label: "Destaque", descricao: "Fundo colorido com borda lateral" },
      { id: "citacao", label: "Citação", descricao: "Aspas grandes e tipografia serifada" },
    ],
    campos: [
      { key: "titulo", label: "Título da seção", type: "text", default: "" },
      { key: "conteudo", label: "Conteúdo", type: "richtext", default: "" },
      { key: "alinhamento", label: "Alinhamento", type: "select", options: ALIGN_OPTIONS, default: "left" },
      { key: "autor", label: "Autor", type: "text", hint: "Usado na variante Citação", default: "" },
    ],
  },
  {
    tipo: "galeria", label: "Galeria", icone: "Grid3X3", grupo: "Mídia",
    descricao: "Fotos em grade, mosaico ou carrossel.",
    variantes: [
      { id: "grade", label: "Grade", descricao: "Colunas iguais" },
      { id: "mosaico", label: "Mosaico", descricao: "Alturas variadas, estilo Pinterest" },
      { id: "carrossel", label: "Carrossel", descricao: "Rolagem horizontal" },
      { id: "destaque", label: "Uma grande", descricao: "Primeira foto grande, resto pequeno" },
    ],
    campos: [
      { key: "titulo", label: "Título", type: "text", default: "" },
      { key: "colunas", label: "Colunas", type: "number", default: 3 },
      { key: "legendas", label: "Mostrar legendas", type: "boolean", default: false },
      { key: "fotos", label: "Fotos", type: "list",
        itemFields: [
          { key: "url", label: "Imagem", type: "image" },
          { key: "legenda", label: "Legenda", type: "text" },
        ], default: [] },
    ],
  },
  {
    tipo: "video", label: "Vídeo", icone: "Video", grupo: "Mídia",
    descricao: "YouTube, Vimeo ou arquivo direto.",
    variantes: [
      { id: "default", label: "Padrão", descricao: "Player centralizado" },
      { id: "largura-total", label: "Largura total", descricao: "Ocupa toda a largura da tela" },
      { id: "lado-a-lado", label: "Com texto", descricao: "Vídeo de um lado, texto do outro" },
    ],
    campos: [
      { key: "titulo", label: "Título", type: "text", default: "" },
      { key: "url", label: "URL do vídeo", type: "video", default: "" },
      { key: "descricao", label: "Descrição", type: "textarea", default: "" },
    ],
  },
  {
    tipo: "eventos", label: "Eventos", icone: "Calendar", grupo: "Conversão",
    descricao:
      "Lista os eventos do departamento. O botão de inscrição aparece só dentro do prazo; " +
      "depois o evento vira histórico automaticamente.",
    variantes: [
      { id: "cards", label: "Cards", descricao: "Grade de cartões com banner" },
      { id: "lista", label: "Lista", descricao: "Linhas compactas com data à esquerda" },
      { id: "destaque", label: "Próximo em destaque", descricao: "O mais próximo grande, os outros abaixo" },
      { id: "agenda", label: "Agenda", descricao: "Agrupado por mês" },
    ],
    campos: [
      { key: "titulo", label: "Título da seção", type: "text", default: "Próximos eventos" },
      { key: "limite", label: "Quantos mostrar", type: "number", default: 6 },
      { key: "mostrarPassados", label: "Mostrar histórico de eventos encerrados", type: "boolean", default: true },
      { key: "textoBotao", label: "Texto do botão de inscrição", type: "text", default: "Inscrever-se" },
      { key: "textoEncerrado", label: "Texto quando encerrado", type: "text", default: "Inscrições encerradas" },
    ],
  },
  {
    tipo: "loja", label: "Loja", icone: "ShoppingBag", grupo: "Conversão",
    descricao: "Produtos do departamento (camisetas, livros) com carrinho e checkout.",
    variantes: [
      { id: "vitrine", label: "Vitrine", descricao: "Grade de produtos com preço" },
      { id: "carrossel", label: "Carrossel", descricao: "Rolagem horizontal, ideal para poucos itens" },
      { id: "destaque", label: "Destaques", descricao: "Só os produtos marcados como destaque" },
    ],
    campos: [
      { key: "titulo", label: "Título da seção", type: "text", default: "Loja" },
      { key: "subtitulo", label: "Subtítulo", type: "text", default: "" },
      { key: "limite", label: "Quantos mostrar", type: "number", default: 8 },
      { key: "colunas", label: "Colunas", type: "number", default: 4 },
      { key: "categoria", label: "Filtrar por categoria", type: "text", hint: "Vazio = todas", default: "" },
    ],
  },
  {
    tipo: "formulario", label: "Formulário", icone: "ClipboardList", grupo: "Conversão",
    descricao: "Captação de contato ou pré-inscrição.",
    variantes: [
      { id: "default", label: "Padrão", descricao: "Campos empilhados" },
      { id: "compacto", label: "Compacto", descricao: "Uma linha só, para e-mail" },
      { id: "lado-a-lado", label: "Com texto", descricao: "Texto à esquerda, formulário à direita" },
    ],
    campos: [
      { key: "titulo", label: "Título", type: "text", default: "Fale com a gente" },
      { key: "descricao", label: "Descrição", type: "textarea", default: "" },
      { key: "textoBotao", label: "Texto do botão", type: "text", default: "Enviar" },
      { key: "mensagemSucesso", label: "Mensagem de sucesso", type: "textarea", default: "Recebemos seu contato!" },
      { key: "campos", label: "Campos", type: "list",
        itemFields: [
          { key: "label", label: "Rótulo", type: "text" },
          { key: "tipo", label: "Tipo", type: "select",
            options: [
              { value: "text", label: "Texto" }, { value: "email", label: "E-mail" },
              { value: "tel", label: "Telefone" }, { value: "cpf", label: "CPF" },
              { value: "date", label: "Data" }, { value: "textarea", label: "Texto longo" },
              { value: "select", label: "Escolha" },
            ] },
          { key: "obrigatorio", label: "Obrigatório", type: "boolean" },
        ],
        default: [
          { label: "Nome", tipo: "text", obrigatorio: true },
          { label: "Telefone", tipo: "tel", obrigatorio: true },
          { label: "CPF", tipo: "cpf", obrigatorio: true },
        ] },
    ],
  },
  {
    tipo: "equipe", label: "Equipe", icone: "Users", grupo: "Pessoas",
    descricao: "Líderes e voluntários do departamento.",
    variantes: [
      { id: "cards", label: "Cards", descricao: "Foto quadrada com nome e função" },
      { id: "circulos", label: "Círculos", descricao: "Fotos redondas em linha" },
      { id: "lista", label: "Lista", descricao: "Foto pequena com bio ao lado" },
    ],
    campos: [
      { key: "titulo", label: "Título", type: "text", default: "Nossa equipe" },
      { key: "colunas", label: "Colunas", type: "number", default: 4 },
      { key: "pessoas", label: "Pessoas", type: "list",
        itemFields: [
          { key: "foto", label: "Foto", type: "image" },
          { key: "nome", label: "Nome", type: "text" },
          { key: "funcao", label: "Função", type: "text" },
          { key: "bio", label: "Bio", type: "textarea" },
        ], default: [] },
    ],
  },
  {
    tipo: "depoimentos", label: "Depoimentos", icone: "MessageSquare", grupo: "Pessoas",
    descricao: "Testemunhos de quem participa.",
    variantes: [
      { id: "cards", label: "Cards", descricao: "Grade de cartões" },
      { id: "carrossel", label: "Carrossel", descricao: "Um por vez, com setas" },
      { id: "destaque", label: "Destaque", descricao: "Um depoimento grande e centralizado" },
    ],
    campos: [
      { key: "titulo", label: "Título", type: "text", default: "" },
      { key: "itens", label: "Depoimentos", type: "list",
        itemFields: [
          { key: "texto", label: "Depoimento", type: "textarea" },
          { key: "nome", label: "Nome", type: "text" },
          { key: "foto", label: "Foto", type: "image" },
        ], default: [] },
    ],
  },
  {
    tipo: "numeros", label: "Números", icone: "BarChart3", grupo: "Conteúdo",
    descricao: "Estatísticas do departamento em destaque.",
    variantes: [
      { id: "linha", label: "Em linha", descricao: "Números lado a lado" },
      { id: "cards", label: "Cards", descricao: "Cada número em um cartão" },
    ],
    campos: [
      { key: "titulo", label: "Título", type: "text", default: "" },
      { key: "itens", label: "Números", type: "list",
        itemFields: [
          { key: "valor", label: "Valor", type: "text" },
          { key: "rotulo", label: "Rótulo", type: "text" },
        ], default: [] },
    ],
  },
  {
    tipo: "faq", label: "Perguntas frequentes", icone: "HelpCircle", grupo: "Conteúdo",
    descricao: "Lista de perguntas que abre e fecha.",
    variantes: [
      { id: "acordeao", label: "Acordeão", descricao: "Uma aberta por vez" },
      { id: "duas-colunas", label: "Duas colunas", descricao: "Perguntas lado a lado" },
    ],
    campos: [
      { key: "titulo", label: "Título", type: "text", default: "Dúvidas frequentes" },
      { key: "itens", label: "Perguntas", type: "list",
        itemFields: [
          { key: "pergunta", label: "Pergunta", type: "text" },
          { key: "resposta", label: "Resposta", type: "textarea" },
        ], default: [] },
    ],
  },
  {
    tipo: "agenda", label: "Programação", icone: "Clock", grupo: "Conteúdo",
    descricao: "Horários fixos de encontros e cultos.",
    variantes: [
      { id: "semana", label: "Por dia da semana", descricao: "Agrupado por dia" },
      { id: "lista", label: "Lista", descricao: "Linhas simples" },
    ],
    campos: [
      { key: "titulo", label: "Título", type: "text", default: "Programação" },
      { key: "itens", label: "Horários", type: "list",
        itemFields: [
          { key: "dia", label: "Dia", type: "text" },
          { key: "hora", label: "Horário", type: "text" },
          { key: "descricao", label: "Descrição", type: "text" },
          { key: "local", label: "Local", type: "text" },
        ], default: [] },
    ],
  },
  {
    tipo: "cta", label: "Chamada para ação", icone: "Megaphone", grupo: "Conversão",
    descricao: "Faixa com uma mensagem e um botão.",
    variantes: [
      { id: "faixa", label: "Faixa", descricao: "Fundo colorido de ponta a ponta" },
      { id: "card", label: "Card", descricao: "Caixa arredondada centralizada" },
      { id: "imagem", label: "Com imagem", descricao: "Imagem de fundo com overlay" },
    ],
    campos: [
      { key: "titulo", label: "Título", type: "text", default: "" },
      { key: "subtitulo", label: "Subtítulo", type: "textarea", default: "" },
      { key: "imagem", label: "Imagem de fundo", type: "image", default: "" },
      { key: "ctaTexto", label: "Texto do botão", type: "text", default: "Quero participar" },
      { key: "ctaUrl", label: "Link do botão", type: "url", default: "" },
    ],
  },
  {
    tipo: "mapa", label: "Mapa", icone: "MapPin", grupo: "Estrutura",
    descricao: "Localização com endereço.",
    variantes: [
      { id: "default", label: "Padrão", descricao: "Mapa com endereço embaixo" },
      { id: "lado-a-lado", label: "Com informações", descricao: "Mapa à esquerda, dados à direita" },
    ],
    campos: [
      { key: "titulo", label: "Título", type: "text", default: "Como chegar" },
      { key: "endereco", label: "Endereço", type: "text", default: "" },
      { key: "zoom", label: "Zoom", type: "number", default: 15 },
    ],
  },
  {
    tipo: "contato", label: "Contato e redes", icone: "Share2", grupo: "Estrutura",
    descricao: "WhatsApp, Instagram, YouTube e telefone.",
    variantes: [
      { id: "linha", label: "Em linha", descricao: "Ícones lado a lado" },
      { id: "cards", label: "Cards", descricao: "Cada canal em um cartão" },
    ],
    campos: [
      { key: "titulo", label: "Título", type: "text", default: "Fale com a gente" },
      { key: "whatsapp", label: "WhatsApp", type: "text", default: "" },
      { key: "instagram", label: "Instagram", type: "text", default: "" },
      { key: "youtube", label: "YouTube", type: "url", default: "" },
      { key: "email", label: "E-mail", type: "text", default: "" },
    ],
  },
  {
    tipo: "espacador", label: "Espaço", icone: "Minus", grupo: "Estrutura",
    descricao: "Respiro ou linha divisória entre seções.",
    variantes: [
      { id: "espaco", label: "Espaço vazio", descricao: "Só respiro" },
      { id: "linha", label: "Linha", descricao: "Divisor fino" },
      { id: "onda", label: "Onda", descricao: "Transição curva entre seções" },
    ],
    campos: [
      { key: "altura", label: "Altura", type: "select", default: "md",
        options: [{ value: "sm", label: "Pequeno" }, { value: "md", label: "Médio" }, { value: "lg", label: "Grande" }] },
    ],
  },
];

export function getBlockDefinition(tipo: string): BlockDefinition | undefined {
  return BLOCK_LIBRARY.find((b) => b.tipo === tipo);
}

/** Props iniciais de um bloco recém-adicionado, a partir dos defaults. */
export function defaultProps(tipo: string): Record<string, unknown> {
  const def = getBlockDefinition(tipo);
  if (!def) return {};
  const props: Record<string, unknown> = {};
  for (const campo of def.campos) {
    props[campo.key] = campo.default ?? (campo.type === "list" ? [] : "");
  }
  return props;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipos das linhas do banco
// ─────────────────────────────────────────────────────────────────────────────

export interface DepartmentSite {
  id: string;
  campo_id: string | null;
  department_id: string;
  slug: string;
  titulo: string;
  subtitulo: string | null;
  descricao: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  cor_primaria: string | null;
  cor_secundaria: string | null;
  cor_destaque: string | null;
  tema: string;
  preset: string;
  tokens_override: Partial<StyleTokens>;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  payment_link: string | null;
  whatsapp_number: string | null;
  instagram: string | null;
  youtube: string | null;
  status: "RASCUNHO" | "PUBLICADO";
  published_at: string | null;
}

export interface SiteBlock {
  id: string;
  site_id: string;
  tipo: string;
  variante: string;
  ordem: number;
  props: Record<string, unknown>;
  props_publicado: Record<string, unknown> | null;
  visivel: boolean;
}

/**
 * Props que devem ser renderizadas.
 *
 * No site publicado usamos o snapshot congelado em `props_publicado`, para que
 * edições em andamento no builder não vazem para o público antes de publicar.
 * Na pré-visualização usamos `props`, que é o rascunho.
 */
export function blockProps(block: SiteBlock, modo: "publicado" | "rascunho"): Record<string, unknown> {
  if (modo === "rascunho") return block.props ?? {};
  return block.props_publicado ?? block.props ?? {};
}
