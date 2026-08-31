/**
 * Configuração da home pública (a tela do "REINAR"), por igreja.
 *
 * O saaschurch é um código só rodando contra um banco por igreja. A home era
 * escrita para a AD Campinas — logo, favicon, título da aba, textos, cores, os
 * ícones e os links estavam cravados no JSX. Agora tudo isso vem de
 * `home_configs` / `home_cards`.
 *
 * Os defaults deste arquivo são NEUTROS — vazios. Cada igreja roda o seu banco,
 * e por um tempo os defaults carregavam o conteúdo da AD Campinas (nome, logo,
 * marca d'água, endereço, horários). O efeito é que toda igreja nova, e toda
 * home cujo dado ainda não foi cadastrado, aparecia com a marca de outra
 * congregação — inclusive piscando o nome antigo enquanto a página carregava.
 *
 * Melhor a home nascer em branco e esperar o cadastro do que mostrar o dado de
 * outra igreja. Onde falta texto a tela mostra um traço; onde falta imagem, não
 * mostra imagem nenhuma.
 *
 * Quem já tinha a home cadastrada não perde nada: os valores estão gravados em
 * `home_configs`, não aqui.
 *
 * O que este módulo deliberadamente NÃO guarda: endereço da sede, telefone,
 * WhatsApp, redes sociais e a programação de cultos. Isso tudo já é cadastrado
 * em Sistema → Informações da Igreja (`headquarters` / `church_schedule`) e
 * duplicar aqui criaria duas verdades para o mesmo dado. A home lê de lá; os
 * cartões apenas apontam para o campo desejado (ver `SEDE_URL_PREFIX`).
 */

// ── Tipos ───────────────────────────────────────────────────────────────────

export type HomeCardAction =
  | 'membro'   // abre o login do Portal do Membro
  | 'peniel'   // abre o modal de inscrição do Peniel
  | 'gf'       // anima o círculo e navega para /gf
  | 'pwa'      // cartão de instalar o app (padrão da plataforma)
  | 'link'     // link externo (YouTube, Instagram, rádio, dízimo…)
  | 'maps'     // "Nossa Sede" — endereço vindo de Informações da Igreja
  | 'agenda'   // "Dias de culto" — programação vinda de Informações da Igreja
  | 'verse';   // abre o modal do versículo

export const HOME_CARD_ACTIONS: HomeCardAction[] = [
  'membro', 'peniel', 'gf', 'pwa', 'link', 'maps', 'agenda', 'verse',
];

/** Ações que a igreja pode ocultar, mas não apagar: são portas do sistema. */
export const PROTECTED_ACTIONS: HomeCardAction[] = ['membro', 'peniel', 'gf'];

/**
 * "Instalar o app" é padrão da plataforma, não escolha da igreja: o cartão já
 * se esconde sozinho quando o navegador não sabe instalar ou o app já está
 * instalado. Não pode ser apagado nem ocultado pela tela de configuração —
 * escondê-lo só tiraria o atalho de quem quer instalar, sem ganho nenhum.
 */
export const LOCKED_ACTIONS: HomeCardAction[] = ['pwa'];

export function isLockedAction(action: HomeCardAction): boolean {
  return LOCKED_ACTIONS.includes(action);
}

export function isProtectedAction(action: HomeCardAction): boolean {
  return PROTECTED_ACTIONS.includes(action) || isLockedAction(action);
}

export interface HomeCard {
  key: string;
  action: HomeCardAction;
  title: string;
  /** "\n" vira quebra de linha na home. */
  subtitle: string | null;
  /** URL externa, caminho interno, ou um apelido `sede:<campo>` (ver abaixo). */
  url: string | null;
  /** Nome dentro de HOME_ICON_CATALOG. */
  icon: string;
  /** null herda o cinza neutro do tema, como os cartões secundários de hoje. */
  iconColor: string | null;
  /** Cor que o ícone e a borda assumem no hover. */
  hoverColor: string | null;
  visible: boolean;
  /** Anel pulsante, como o "Sou Membro" verde. */
  pulse: boolean;
  /** Bolinha verde de "ao vivo" ao lado do subtítulo. */
  liveDot: boolean;
  /** Ocupa as duas colunas do grid. */
  fullWidth: boolean;
}

/**
 * Um cartão pode apontar para uma rede já cadastrada em Informações da Igreja
 * em vez de guardar a URL de novo: `url: 'sede:instagram'`. Assim a igreja
 * troca o Instagram num lugar só e a home acompanha.
 */
export const SEDE_URL_PREFIX = 'sede:';

export const SEDE_LINK_FIELDS = [
  { id: 'instagram', label: 'Instagram (Informações da Igreja)' },
  { id: 'youtube', label: 'YouTube (Informações da Igreja)' },
  { id: 'facebook', label: 'Facebook (Informações da Igreja)' },
  { id: 'tiktok', label: 'TikTok (Informações da Igreja)' },
  { id: 'site', label: 'Site (Informações da Igreja)' },
  { id: 'whatsapp', label: 'WhatsApp (Informações da Igreja)' },
] as const;

export type SedeLinkField = (typeof SEDE_LINK_FIELDS)[number]['id'];

export function isSedeUrl(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.startsWith(SEDE_URL_PREFIX);
}

export function sedeUrlField(url: string | null | undefined): SedeLinkField | null {
  if (!isSedeUrl(url)) return null;
  const field = (url as string).slice(SEDE_URL_PREFIX.length) as SedeLinkField;
  return SEDE_LINK_FIELDS.some(f => f.id === field) ? field : null;
}

/** Programação de culto — espelha `church_schedule`, editada em Informações da Igreja. */
export interface HomeScheduleLine {
  dayOfWeek: string;
  name: string;
  time: string;
}

/** Dados da sede lidos de `headquarters` — a home nunca os edita. */
export interface HomeSede {
  churchName: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  instagram: string;
  youtube: string;
  facebook: string;
  tiktok: string;
  site: string;
  schedules: HomeScheduleLine[];
}

export interface HomeServicesConfig {
  enabled: boolean;
  title: string;
  /** ids de FAB_OPTIONS que não aparecem. */
  hidden: string[];
  /** renomes pontuais: { [id]: 'novo rótulo' }. */
  labels: Record<string, string>;
}

export interface HomeConfig {
  // Identidade
  siteTitle: string;
  siteDescription: string;
  faviconUrl: string | null;
  /** null = igreja ainda não subiu logo; a home mostra um espaço neutro. */
  logoUrl: string | null;
  watermarkUrl: string | null;
  pwaName: string;
  pwaShortName: string;
  pwaIcon192: string;
  pwaIcon512: string;
  pwaIconMaskable: string;

  // Hero
  heroEyebrow: string;
  heroTitle: string;
  heroText: string;
  verseRef: string;
  verseLabel: string;
  verseText: string;
  showVerse: boolean;

  // Aparência
  bgDark: string;
  bgLight: string;
  accentColor: string;
  defaultDark: boolean;
  showSymbols: boolean;
  showSpotlights: boolean;
  watermarkOpacity: number;
  symbolColors: string[];

  // Botão flutuante de atendimento
  services: HomeServicesConfig;
}

export interface HomeConfigPayload {
  config: HomeConfig;
  cards: HomeCard[];
  /** Somente leitura aqui — a fonte é Sistema → Informações da Igreja. */
  sede: HomeSede;
}

// ── Catálogo de ícones ──────────────────────────────────────────────────────

/**
 * Catálogo oferecido no modal "Escolher ícone" da tela de configuração: cada
 * entrada tem rótulo em português, a cor da pastilha e a aba em que aparece.
 * Fechado de propósito — o nome vira componente no front, e aceitar qualquer
 * string deixaria um cartão sem ícone. O mapa nome→componente vive em
 * `src/components/public/homeIcons.tsx`.
 *
 * Sem ícones de marca (Instagram, YouTube, Facebook): o lucide os removeu na
 * v1, e o resto do sistema já usa substitutos genéricos.
 */
export type HomeIconCategory = 'principal' | 'igreja' | 'midia' | 'contato' | 'lugar';

export const HOME_ICON_CATEGORIES: { id: HomeIconCategory; label: string }[] = [
  { id: 'principal', label: 'Principais' },
  { id: 'igreja', label: 'Igreja' },
  { id: 'midia', label: 'Mídia' },
  { id: 'contato', label: 'Contato' },
  { id: 'lugar', label: 'Lugar' },
];

export interface HomeIconOption {
  value: string;
  label: string;
  category: HomeIconCategory;
  /** Classe Tailwind da pastilha no seletor (só na tela de configuração). */
  bg: string;
}

export const HOME_ICON_CATALOG: HomeIconOption[] = [
  // Principais
  { value: 'User', label: 'Membro', category: 'principal', bg: 'bg-emerald-600' },
  { value: 'Users', label: 'Pessoas', category: 'principal', bg: 'bg-emerald-700' },
  { value: 'Home', label: 'Casa / GF', category: 'principal', bg: 'bg-amber-600' },
  { value: 'Download', label: 'Instalar app', category: 'principal', bg: 'bg-sky-600' },
  { value: 'Calendar', label: 'Agenda', category: 'principal', bg: 'bg-indigo-600' },
  { value: 'Clock', label: 'Horários', category: 'principal', bg: 'bg-slate-600' },
  { value: 'Info', label: 'Informação', category: 'principal', bg: 'bg-blue-600' },
  { value: 'Circle', label: 'Neutro', category: 'principal', bg: 'bg-slate-500' },

  // Igreja
  { value: 'Dove', label: 'Pomba / Peniel', category: 'igreja', bg: 'bg-yellow-600' },
  { value: 'Church', label: 'Templo', category: 'igreja', bg: 'bg-stone-600' },
  { value: 'Cross', label: 'Cruz', category: 'igreja', bg: 'bg-zinc-700' },
  { value: 'BookOpen', label: 'Bíblia', category: 'igreja', bg: 'bg-amber-700' },
  { value: 'Flame', label: 'Chama', category: 'igreja', bg: 'bg-orange-600' },
  { value: 'Crown', label: 'Coroa', category: 'igreja', bg: 'bg-yellow-700' },
  { value: 'Feather', label: 'Pena', category: 'igreja', bg: 'bg-teal-600' },
  { value: 'Sparkles', label: 'Oração', category: 'igreja', bg: 'bg-violet-600' },
  { value: 'Heart', label: 'Coração', category: 'igreja', bg: 'bg-rose-600' },
  { value: 'HeartHandshake', label: 'Acolhimento', category: 'igreja', bg: 'bg-emerald-600' },
  { value: 'Handshake', label: 'Parceria', category: 'igreja', bg: 'bg-lime-700' },
  { value: 'GraduationCap', label: 'EBD / Ensino', category: 'igreja', bg: 'bg-blue-700' },
  { value: 'Baby', label: 'Infantil', category: 'igreja', bg: 'bg-pink-500' },
  { value: 'Star', label: 'Destaque', category: 'igreja', bg: 'bg-amber-500' },

  // Mídia
  { value: 'Play', label: 'Culto ao vivo', category: 'midia', bg: 'bg-red-600' },
  { value: 'Video', label: 'Vídeo', category: 'midia', bg: 'bg-rose-600' },
  { value: 'Tv', label: 'TV', category: 'midia', bg: 'bg-slate-700' },
  { value: 'Radio', label: 'Rádio', category: 'midia', bg: 'bg-emerald-600' },
  { value: 'Podcast', label: 'Podcast', category: 'midia', bg: 'bg-purple-600' },
  { value: 'Music', label: 'Louvor', category: 'midia', bg: 'bg-fuchsia-600' },
  { value: 'Mic', label: 'Pregação', category: 'midia', bg: 'bg-indigo-700' },
  { value: 'Camera', label: 'Instagram / Fotos', category: 'midia', bg: 'bg-pink-600' },
  { value: 'Image', label: 'Galeria', category: 'midia', bg: 'bg-cyan-600' },
  { value: 'Newspaper', label: 'Notícias', category: 'midia', bg: 'bg-stone-700' },
  { value: 'Share2', label: 'Redes sociais', category: 'midia', bg: 'bg-teal-600' },
  { value: 'Link', label: 'Link', category: 'midia', bg: 'bg-indigo-600' },
  { value: 'Globe', label: 'Site', category: 'midia', bg: 'bg-blue-500' },

  // Contato
  { value: 'MessageSquare', label: 'WhatsApp', category: 'contato', bg: 'bg-green-600' },
  { value: 'Phone', label: 'Telefone', category: 'contato', bg: 'bg-slate-600' },
  { value: 'Mail', label: 'E-mail', category: 'contato', bg: 'bg-blue-600' },
  { value: 'Send', label: 'Enviar', category: 'contato', bg: 'bg-sky-700' },
  { value: 'Bell', label: 'Avisos', category: 'contato', bg: 'bg-amber-600' },
  { value: 'Briefcase', label: 'Secretaria', category: 'contato', bg: 'bg-zinc-600' },
  { value: 'Laptop', label: 'Online', category: 'contato', bg: 'bg-cyan-700' },

  // Lugar e ofertas
  { value: 'MapPin', label: 'Endereço', category: 'lugar', bg: 'bg-blue-600' },
  { value: 'Map', label: 'Mapa', category: 'lugar', bg: 'bg-emerald-700' },
  { value: 'Navigation', label: 'Como chegar', category: 'lugar', bg: 'bg-teal-700' },
  { value: 'Landmark', label: 'Sede', category: 'lugar', bg: 'bg-stone-600' },
  { value: 'DollarSign', label: 'Dízimo', category: 'lugar', bg: 'bg-green-700' },
  { value: 'HandCoins', label: 'Oferta', category: 'lugar', bg: 'bg-lime-600' },
  { value: 'CreditCard', label: 'Pagamento', category: 'lugar', bg: 'bg-indigo-600' },
  { value: 'Wallet', label: 'Carteira', category: 'lugar', bg: 'bg-emerald-800' },
  { value: 'Gift', label: 'Doação', category: 'lugar', bg: 'bg-rose-500' },
  { value: 'Ticket', label: 'Ingresso', category: 'lugar', bg: 'bg-orange-700' },
  { value: 'Sun', label: 'Manhã', category: 'lugar', bg: 'bg-amber-500' },
  { value: 'Moon', label: 'Noite', category: 'lugar', bg: 'bg-slate-800' },
];

export const HOME_ICON_NAMES: string[] = HOME_ICON_CATALOG.map(i => i.value);

export function isHomeIconName(value: unknown): value is string {
  return typeof value === 'string' && HOME_ICON_NAMES.includes(value);
}

export function homeIconOption(value: string | null | undefined): HomeIconOption {
  return (
    HOME_ICON_CATALOG.find(i => i.value === value) ??
    { value: 'Circle', label: 'Neutro', category: 'principal', bg: 'bg-slate-500' }
  );
}

// ── Defaults: a home de hoje ────────────────────────────────────────────────

export const DEFAULT_SYMBOL_COLORS = [
  '#d4af37', // dourado
  '#22c55e', // esmeralda
  '#38bdf8', // azul céu
  '#f59e0b', // âmbar
  '#a78bfa', // violeta
  '#2dd4bf', // teal
  '#f472b6', // rosa
  '#e2e8f0', // claro
];

export const DEFAULT_VERSE_TEXT =
  'Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, ' +
  'para que todo aquele que nele crê não pereça, mas tenha a vida eterna.';

/**
 * Nome neutro da plataforma. Serve de último recurso para o título da aba e o
 * manifesto, que não podem ficar vazios — e é o nome do sistema, não o de uma
 * igreja: nenhuma congregação aparece na aba de outra.
 */
export const NOME_PLATAFORMA = 'MRM — Gestão Ministerial';
export const NOME_PLATAFORMA_CURTO = 'MRM';

export const DEFAULT_HOME_CONFIG: HomeConfig = {
  // Vazio de propósito: ver o cabeçalho do arquivo. Nada aqui pode carregar a
  // marca de uma igreja específica.
  siteTitle: '',
  siteDescription: '',
  faviconUrl: null,
  logoUrl: null,
  watermarkUrl: null,
  pwaName: '',
  pwaShortName: '',
  // Ícones do PWA continuam com o padrão da plataforma: sem eles o navegador
  // não instala o app, e são genéricos, não a marca de uma igreja.
  pwaIcon192: '/icons/icon-192.png',
  pwaIcon512: '/icons/icon-512.png',
  pwaIconMaskable: '/icons/icon-maskable-512.png',

  heroEyebrow: '',
  heroTitle: '',
  heroText: '',
  verseRef: 'João 3:16',
  verseLabel: 'Leia',
  verseText: DEFAULT_VERSE_TEXT,
  showVerse: true,

  bgDark: '#0a0a0a',
  bgLight: '#f5f4f0',
  accentColor: '#d4af37',
  defaultDark: true,
  showSymbols: true,
  showSpotlights: true,
  watermarkOpacity: 0.05,
  symbolColors: DEFAULT_SYMBOL_COLORS,

  services: {
    enabled: true,
    title: '',
    hidden: [],
    labels: {},
  },
};

/**
 * Usado quando o banco não tem sede cadastrada. Vazio: endereço, telefone e
 * programação de outra igreja no ar são pior do que campo em branco — alguém
 * liga para o número errado.
 */
export const DEFAULT_HOME_SEDE: HomeSede = {
  churchName: '',
  address: '',
  phone: '',
  whatsapp: '',
  email: '',
  instagram: '',
  youtube: '',
  facebook: '',
  tiktok: '',
  site: '',
  schedules: [],
};

export const DEFAULT_HOME_CARDS: HomeCard[] = [
  {
    key: 'membro', action: 'membro', icon: 'User',
    title: 'Sou Membro',
    subtitle: 'Acesse sua área exclusiva\nde membro da igreja.',
    url: null, iconColor: '#22c55e', hoverColor: null,
    visible: true, pulse: true, liveDot: false, fullWidth: false,
  },
  {
    key: 'peniel', action: 'peniel', icon: 'Dove',
    title: 'Inscrições Peniel e consultar inscrições',
    subtitle: 'Um lugar de encontro, fé e transformação.\nFaça sua inscrição ou consulte uma já realizada.',
    url: null, iconColor: '#d4af37', hoverColor: null,
    visible: true, pulse: false, liveDot: false, fullWidth: false,
  },
  {
    key: 'gf', action: 'gf', icon: 'Home',
    title: 'Grupos Familiares',
    subtitle: 'Encontre um GF perto de você\ne conheça o líder e o horário.',
    url: null, iconColor: '#f59e0b', hoverColor: null,
    visible: true, pulse: false, liveDot: false, fullWidth: false,
  },
  {
    key: 'pwa', action: 'pwa', icon: 'Download',
    title: 'Instalar o app',
    subtitle: 'Adicione à tela de início\ne abra direto, sem navegador.',
    url: null, iconColor: null, hoverColor: null,
    visible: true, pulse: false, liveDot: false, fullWidth: false,
  },
  {
    key: 'youtube', action: 'link', icon: 'Play',
    title: 'Culto ao vivo',
    subtitle: 'Assista o culto ao vivo pela internet\nem nosso canal no Youtube',
    url: 'sede:youtube',
    iconColor: null, hoverColor: '#ff0000',
    visible: true, pulse: false, liveDot: false, fullWidth: false,
  },
  {
    key: 'radio', action: 'link', icon: 'Radio',
    title: '102,9',
    subtitle: 'Mais FM ao vivo',
    url: 'https://maisfm1029.com.br/',
    iconColor: null, hoverColor: '#00b894',
    visible: true, pulse: false, liveDot: true, fullWidth: false,
  },
  {
    key: 'instagram', action: 'link', icon: 'Camera',
    title: 'Instagram',
    subtitle: 'Saiba o que está acontecendo, siga-nos\nnas redes sociais',
    url: 'sede:instagram',
    iconColor: null, hoverColor: '#ec4899',
    visible: true, pulse: false, liveDot: false, fullWidth: false,
  },
  {
    key: 'sede', action: 'maps', icon: 'MapPin',
    title: 'Nossa Sede',
    subtitle: null, // endereço e telefone vêm de Informações da Igreja
    url: null, iconColor: null, hoverColor: '#60a5fa',
    visible: true, pulse: false, liveDot: false, fullWidth: false,
  },
  {
    key: 'cultos', action: 'agenda', icon: 'Users',
    title: 'Dias de culto',
    subtitle: null, // programação vem de Informações da Igreja
    url: null, iconColor: null, hoverColor: null,
    visible: true, pulse: false, liveDot: false, fullWidth: true,
  },
];

// ── Saneamento e merge ──────────────────────────────────────────────────────

const HEX = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value);
}

/** Aceita http(s), caminhos internos e apelidos `sede:`; recusa `javascript:`. */
export function isSafeUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  if (sedeUrlField(value)) return true;
  return /^https?:\/\//i.test(value) || value.startsWith('/');
}

function str(value: unknown, fallback: string): string {
  const v = typeof value === 'string' ? value.trim() : '';
  return v ? v : fallback;
}

function nullableStr(value: unknown, fallback: string | null): string | null {
  if (value === null) return null;
  const v = typeof value === 'string' ? value.trim() : '';
  return v ? v : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function color(value: unknown, fallback: string): string {
  return isHexColor(value) ? value : fallback;
}

function nullableColor(value: unknown, fallback: string | null): string | null {
  if (value === null) return null;
  return isHexColor(value) ? value : fallback;
}

/** Endereço da sede → busca no Google Maps. */
export function mapsUrlFor(sede: HomeSede): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sede.address)}`;
}

/** WhatsApp da sede → link wa.me com só os dígitos. */
export function whatsappUrlFor(numero: string): string {
  const digitos = (numero || '').replace(/\D/g, '');
  if (!digitos) return '';
  const comDDI = digitos.length <= 11 ? `55${digitos}` : digitos;
  return `https://wa.me/${comDDI}`;
}

/** Resolve o destino final de um cartão, seguindo apelidos `sede:`. */
export function resolveCardUrl(card: HomeCard, sede: HomeSede): string | null {
  const campo = sedeUrlField(card.url);
  if (!campo) return card.url;
  if (campo === 'whatsapp') return whatsappUrlFor(sede.whatsapp || sede.phone) || null;
  const valor = (sede[campo] || '').trim();
  if (!valor) return null;
  return /^https?:\/\//i.test(valor) ? valor : `https://${valor}`;
}

function mergeServices(raw: unknown): HomeServicesConfig {
  const d = DEFAULT_HOME_CONFIG.services;
  if (!raw || typeof raw !== 'object') return { ...d, hidden: [], labels: {} };
  const s = raw as Record<string, unknown>;
  const labels: Record<string, string> = {};
  if (s.labels && typeof s.labels === 'object') {
    for (const [k, v] of Object.entries(s.labels as Record<string, unknown>)) {
      if (typeof v === 'string' && v.trim()) labels[k] = v.trim();
    }
  }
  return {
    enabled: bool(s.enabled, d.enabled),
    title: str(s.title, d.title),
    hidden: Array.isArray(s.hidden) ? s.hidden.filter((h): h is string => typeof h === 'string') : [],
    labels,
  };
}

/** Aplica sobre o default o que veio do banco/API, campo a campo. */
export function mergeHomeConfig(raw: unknown): HomeConfig {
  const d = DEFAULT_HOME_CONFIG;
  if (!raw || typeof raw !== 'object') return { ...d };
  const c = raw as Record<string, unknown>;

  const opacity = Number(c.watermarkOpacity);

  return {
    siteTitle: str(c.siteTitle, d.siteTitle),
    siteDescription: str(c.siteDescription, d.siteDescription),
    faviconUrl: isSafeUrl(c.faviconUrl) ? (c.faviconUrl as string) : d.faviconUrl,
    logoUrl: isSafeUrl(c.logoUrl) ? (c.logoUrl as string) : d.logoUrl,
    watermarkUrl: c.watermarkUrl === null
      ? null
      : (isSafeUrl(c.watermarkUrl) ? (c.watermarkUrl as string) : d.watermarkUrl),
    pwaName: str(c.pwaName, str(c.siteTitle, d.pwaName)),
    pwaShortName: str(c.pwaShortName, str(c.siteTitle, d.pwaShortName)),
    pwaIcon192: isSafeUrl(c.pwaIcon192) ? (c.pwaIcon192 as string) : d.pwaIcon192,
    pwaIcon512: isSafeUrl(c.pwaIcon512) ? (c.pwaIcon512 as string) : d.pwaIcon512,
    pwaIconMaskable: isSafeUrl(c.pwaIconMaskable) ? (c.pwaIconMaskable as string) : d.pwaIconMaskable,

    heroEyebrow: str(c.heroEyebrow, d.heroEyebrow),
    heroTitle: str(c.heroTitle, d.heroTitle),
    heroText: str(c.heroText, d.heroText),
    verseRef: str(c.verseRef, d.verseRef),
    verseLabel: str(c.verseLabel, d.verseLabel),
    verseText: str(c.verseText, d.verseText),
    showVerse: bool(c.showVerse, d.showVerse),

    bgDark: color(c.bgDark, d.bgDark),
    bgLight: color(c.bgLight, d.bgLight),
    accentColor: color(c.accentColor, d.accentColor),
    defaultDark: bool(c.defaultDark, d.defaultDark),
    showSymbols: bool(c.showSymbols, d.showSymbols),
    showSpotlights: bool(c.showSpotlights, d.showSpotlights),
    watermarkOpacity: Number.isFinite(opacity)
      ? Math.min(1, Math.max(0, opacity))
      : d.watermarkOpacity,
    symbolColors: Array.isArray(c.symbolColors) && c.symbolColors.some(isHexColor)
      ? c.symbolColors.filter(isHexColor)
      : d.symbolColors,

    services: mergeServices(c.services ?? c.servicesConfig),
  };
}

export function mergeHomeSede(raw: unknown): HomeSede {
  const d = DEFAULT_HOME_SEDE;
  if (!raw || typeof raw !== 'object') return { ...d, schedules: d.schedules.map(s => ({ ...s })) };
  const s = raw as Record<string, unknown>;

  const schedules = Array.isArray(s.schedules)
    ? s.schedules
        .filter((l): l is Record<string, unknown> => !!l && typeof l === 'object')
        .map(l => ({
          dayOfWeek: str(l.dayOfWeek, ''),
          name: str(l.name, ''),
          time: str(l.time, ''),
        }))
        .filter(l => l.dayOfWeek && l.name)
    : [];

  return {
    churchName: str(s.churchName, d.churchName),
    address: str(s.address, d.address),
    phone: str(s.phone, d.phone),
    whatsapp: str(s.whatsapp, str(s.phone, d.whatsapp)),
    email: str(s.email, ''),
    instagram: str(s.instagram, ''),
    youtube: str(s.youtube, ''),
    facebook: str(s.facebook, ''),
    tiktok: str(s.tiktok, ''),
    site: str(s.site, ''),
    // Sem programação cadastrada, a home mostra a de hoje em vez de um cartão
    // vazio — a igreja substitui em Informações da Igreja.
    schedules: schedules.length ? schedules : d.schedules.map(l => ({ ...l })),
  };
}

/** Sanea um cartão vindo de fora; devolve null se não dá para aproveitar. */
export function mergeHomeCard(raw: unknown, index: number): HomeCard | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;

  const action = HOME_CARD_ACTIONS.includes(c.action as HomeCardAction)
    ? (c.action as HomeCardAction)
    : 'link';
  const key = str(c.key, `card_${index}`).slice(0, 60);
  const title = str(c.title, '').slice(0, 160);
  if (!title) return null;

  // Link sem destino não é cartão, é um buraco na tela.
  const url = isSafeUrl(c.url) ? (c.url as string) : null;
  if (action === 'link' && !url) return null;

  return {
    key,
    action,
    title,
    subtitle: nullableStr(c.subtitle, null),
    url,
    icon: isHomeIconName(c.icon) ? c.icon : 'Circle',
    iconColor: nullableColor(c.iconColor, null),
    hoverColor: nullableColor(c.hoverColor, null),
    // "Instalar o app" não obedece a configuração: é padrão da plataforma.
    visible: isLockedAction(action) ? true : bool(c.visible, true),
    pulse: bool(c.pulse, false),
    liveDot: bool(c.liveDot, false),
    fullWidth: bool(c.fullWidth, false),
  };
}

/**
 * A lista do banco SUBSTITUI a default inteira — sem isso não haveria como
 * apagar um cartão (ele voltaria pelo merge). Lista ausente ou vazia cai no
 * default, que é o caso da igreja que nunca abriu a tela de configuração.
 *
 * O cartão de instalar o app é reposto se sumir: ele é padrão da plataforma.
 */
export function mergeHomeCards(raw: unknown): HomeCard[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_HOME_CARDS.map(c => ({ ...c }));
  }
  const cards = raw
    .map((c, i) => mergeHomeCard(c, i))
    .filter((c): c is HomeCard => c !== null);

  if (!cards.length) return DEFAULT_HOME_CARDS.map(c => ({ ...c }));

  for (const acao of LOCKED_ACTIONS) {
    if (!cards.some(c => c.action === acao)) {
      const padrao = DEFAULT_HOME_CARDS.find(c => c.action === acao);
      if (padrao) cards.push({ ...padrao });
    }
  }
  return cards;
}

export function mergeHomePayload(raw: unknown): HomeConfigPayload {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    config: mergeHomeConfig(r.config),
    cards: mergeHomeCards(r.cards),
    sede: mergeHomeSede(r.sede),
  };
}

export const DEFAULT_HOME_PAYLOAD: HomeConfigPayload = {
  config: DEFAULT_HOME_CONFIG,
  cards: DEFAULT_HOME_CARDS,
  sede: DEFAULT_HOME_SEDE,
};
