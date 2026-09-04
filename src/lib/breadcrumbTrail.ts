/**
 * Monta o caminho de navegação ("você está aqui") de qualquer tela do app.
 *
 * A trilha NÃO tem mapa próprio de rotas. Ela é derivada das duas listas que já
 * existem e que alguém mantém de qualquer jeito ao criar uma tela nova:
 *
 *   - `appNavigation`   — as seções e itens do menu lateral
 *   - `settingsSections`— os cartões de Configurações (as telas que não estão
 *                         no menu lateral, como as listas auxiliares)
 *
 * Fosse um terceiro mapa, ele envelheceria sozinho: a tela nova apareceria no
 * menu e o breadcrumb continuaria mudo. Aqui, cadastrar a tela no menu já dá o
 * caminho de volta de graça.
 */

export type TrailSource = {
  section: string;
  items: { name: string; path: string }[];
};

export type Crumb = {
  label: string;
  /** Ausente = não é link (a seção não tem tela própria, e a folha é o "aqui"). */
  path?: string;
};

const CONFIG_PATH = '/app-ui/system-settings';

/**
 * Casa respeitando a fronteira de segmento: `/app-ui/church` não pode casar com
 * `/app-ui/churches`, senão a ficha de uma tela cairia embaixo de outra.
 */
function cobre(base: string, pathname: string) {
  return pathname === base || pathname.startsWith(`${base}/`);
}

function acharMelhor(fontes: TrailSource[], pathname: string) {
  let melhor: { section: string; name: string; path: string } | null = null;
  for (const fonte of fontes) {
    for (const item of fonte.items) {
      if (!item.path || !cobre(item.path, pathname)) continue;
      // O caminho mais específico vence: /app-ui/members/import antes de
      // /app-ui/members.
      if (!melhor || item.path.length > melhor.path.length) {
        melhor = { section: fonte.section, name: item.name, path: item.path };
      }
    }
  }
  return melhor;
}

/** Um id (uuid ou número) não vira rótulo — ninguém lê isso como lugar. */
function ehIdentificador(segmento: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(segmento) || /^\d+$/.test(segmento);
}

function rotuloDoSegmento(pathname: string) {
  const segmentos = pathname.split('/').filter(Boolean);
  const ultimo = segmentos[segmentos.length - 1] ?? '';
  if (!ultimo || ehIdentificador(ultimo)) return 'Detalhes';
  return ultimo
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (letra) => letra.toUpperCase());
}

export function buildBreadcrumbTrail(params: {
  pathname: string;
  navigation: TrailSource[];
  settings: TrailSource[];
  homePath: string;
  /** Título amigável da tela, quando houver (getFriendlyScreenName). */
  screenName?: string;
}): Crumb[] {
  const { pathname, navigation, settings, homePath, screenName } = params;

  const inicio: Crumb = { label: 'Início', path: homePath };
  if (pathname === homePath) return [{ label: 'Início' }];

  const crumbs: Crumb[] = [inicio];

  // O menu lateral tem prioridade: é o caminho que a pessoa percorreu.
  const noMenu = acharMelhor(navigation, pathname);
  const emConfig = noMenu ? null : acharMelhor(settings, pathname);
  const alvo = noMenu ?? emConfig;

  if (emConfig) {
    // Tela de Configurações: o caminho de volta passa pela tela de cartões.
    crumbs.push({ label: 'Configurações', path: CONFIG_PATH });
    crumbs.push({ label: emConfig.section });
    crumbs.push({ label: emConfig.name, path: emConfig.path });
  } else if (noMenu) {
    crumbs.push({ label: noMenu.section });
    crumbs.push({ label: noMenu.name, path: noMenu.path });
  }

  // Subpágina (ficha, edição, novo): só entra se for mesmo outro lugar.
  if (!alvo || alvo.path !== pathname) {
    const folha = screenName?.trim() || rotuloDoSegmento(pathname);
    if (folha && folha !== alvo?.name) crumbs.push({ label: folha });
  }

  // A última migalha é onde a pessoa está — não é link para lugar nenhum.
  const ultima = crumbs[crumbs.length - 1];
  if (ultima) delete ultima.path;

  return crumbs;
}
