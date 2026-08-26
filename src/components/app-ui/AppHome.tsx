import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Search, Star, X, LayoutGrid, SearchX } from 'lucide-react';
import { appNavigation } from './AppUI';
import { usePermissions } from '../../lib/usePermissions';
import { useCampoVisible } from '../../lib/campoVisibility';
import { useFavoritePaths, toggleFavoritePath } from '../../lib/favorites';

/**
 * Tela inicial do app (rota index de /app-ui).
 * Substitui as Notificacoes como primeira tela: mostra todos os modulos que o
 * perfil logado pode ver, agrupados por categoria, com os Favoritos no topo.
 */

// Mesmas regras de visibilidade de campo aplicadas na sidebar do AppUI.
const CAMPO_ONLY_PATHS = ['/app-ui/dashboard/field'];
const MASTER_ONLY_CAMPO_PATHS = ['/app-ui/system/campo-senhas'];

/**
 * Paleta viva e variada — as cores giram item a item (nao por familia de
 * categoria), para que a grade nao fique monocromatica. Cada categoria comeca
 * em um ponto diferente da paleta, evitando repetir a mesma sequencia.
 */
const TILE_PALETTE = [
  '#2563eb', // azul
  '#8b5cf6', // violeta
  '#ef4444', // vermelho
  '#f59e0b', // ambar
  '#10b981', // esmeralda
  '#ec4899', // rosa
  '#0891b2', // ciano
  '#f97316', // laranja
  '#6366f1', // indigo
  '#84cc16', // lima
  '#e11d48', // rosa escuro
  '#14b8a6', // teal
  '#a855f7', // roxo
  '#0ea5e9', // azul claro
  '#d97706', // ocre
  '#22c55e', // verde
];

/** Deslocamento inicial da paleta por categoria. */
const SECTION_OFFSET: Record<string, number> = {
  'Principal': 0,
  'Secretaria': 3,
  'Gestão Pastoral': 7,
  'Ministérios': 10,
  'GF (Grupos Familiares)': 4,
  'Patrimônio': 13,
  'Eventos': 1,
  'App Móvel': 8,
  'Finanças': 11,
  'Gestão EBD': 2,
  'Peniel': 5,
  'Sistema': 12,
};

function colorFor(section: string, index: number) {
  const offset = SECTION_OFFSET[section] ?? 0;
  return TILE_PALETTE[(offset + index * 3) % TILE_PALETTE.length];
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

type HomeItem = {
  name: string;
  path: string;
  icon: any;
  section: string;
  color: string;
};

function AppTile({ item, favorite, onToggleFavorite }: {
  item: HomeItem;
  favorite: boolean;
  onToggleFavorite: (path: string) => void;
}) {
  const Icon = item.icon;
  return (
    <div className="group relative flex flex-col items-center">
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggleFavorite(item.path);
        }}
        title={favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        aria-label={favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
        className={`absolute -top-1 right-1 z-10 rounded-full p-1 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 ${
          favorite
            ? 'text-amber-500 opacity-100'
            : 'text-slate-300 hover:text-amber-500 dark:text-slate-600'
        }`}
      >
        <Star className={`h-4 w-4 ${favorite ? 'fill-current' : ''}`} />
      </button>

      <Link
        to={item.path}
        className="flex w-full flex-col items-center gap-2 rounded-2xl px-1 py-2 outline-none transition hover:bg-slate-100/70 focus-visible:ring-2 focus-visible:ring-purple-300 dark:hover:bg-slate-800/60"
      >
        <span
          style={{ '--tile-color': item.color } as CSSProperties}
          className="app-tile-icon flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm transition group-hover:-translate-y-0.5 group-hover:shadow-md sm:h-16 sm:w-16"
        >
          <Icon className="h-7 w-7 sm:h-8 sm:w-8" />
        </span>
        <span className="line-clamp-2 text-center text-[11px] font-medium leading-tight text-slate-700 sm:text-xs dark:text-slate-300">
          {item.name}
        </span>
      </Link>
    </div>
  );
}

export function AppHome() {
  const [query, setQuery] = useState('');
  const favoritePaths = useFavoritePaths();

  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('mrm_user') || '{}');
    } catch {
      return {};
    }
  }, []);
  const profileType: string = storedUser?.profileType || 'church';
  const { canView } = usePermissions(profileType);
  const campoVisible = useCampoVisible();

  const isCampoAllowed = (path: string) => {
    if (MASTER_ONLY_CAMPO_PATHS.includes(path)) return profileType === 'master';
    if (CAMPO_ONLY_PATHS.includes(path)) return profileType === 'master' && campoVisible;
    return true;
  };

  /** Secoes ja filtradas pela permissao do perfil logado. */
  const visibleSections = useMemo(
    () =>
      appNavigation
        .map((section) => ({
          section: section.section,
          items: section.items
            .filter((item) => (!item.permKey || canView(item.permKey)) && isCampoAllowed(item.path))
            .map((item, index): HomeItem => ({
              name: item.name,
              path: item.path,
              icon: item.icon,
              section: section.section,
              color: colorFor(section.section, index),
            })),
        }))
        .filter((section) => section.items.length > 0),
    [canView, profileType, campoVisible],
  );

  const allItems = useMemo(() => visibleSections.flatMap((s) => s.items), [visibleSections]);

  const normalizedQuery = normalize(query.trim());
  const matches = (item: HomeItem) =>
    !normalizedQuery || normalize(`${item.name} ${item.section}`).includes(normalizedQuery);

  const filteredSections = visibleSections
    .map((section) => ({ ...section, items: section.items.filter(matches) }))
    .filter((section) => section.items.length > 0);

  const favoriteItems = favoritePaths
    .map((path) => allItems.find((item) => item.path === path))
    .filter((item): item is HomeItem => Boolean(item))
    .filter(matches);

  const toggleFavorite = toggleFavoritePath;

  const hasResults = filteredSections.length > 0 || favoriteItems.length > 0;

  return (
    <div className="min-h-full bg-slate-50 px-4 py-6 sm:px-6 lg:px-8 dark:bg-slate-900">
      <div className="mx-auto max-w-7xl">
        {/* Busca */}
        <div className="mb-8">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar aplicativo ou funcao..."
              aria-label="Buscar aplicativo ou funcao"
              className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-11 text-sm text-slate-700 shadow-sm outline-none transition focus:border-purple-300 focus:ring-2 focus:ring-purple-100 sm:text-base dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:focus:border-purple-500/40 dark:focus:ring-purple-500/10"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                title="Limpar busca"
                aria-label="Limpar busca"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Favoritos */}
        {favoriteItems.length > 0 && (
          <section className="mb-10">
            <div className="mb-4 flex items-center gap-2">
              <Star className="h-4 w-4 fill-current text-amber-500" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Favoritos</h2>
            </div>
            <div className="grid grid-cols-3 gap-x-2 gap-y-5 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 xl:grid-cols-11">
              {favoriteItems.map((item) => (
                <AppTile
                  key={`fav-${item.path}`}
                  item={item}
                  favorite
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          </section>
        )}

        {/* Categorias */}
        {filteredSections.map((section) => (
          <section key={section.section} className="mb-10">
            <div className="mb-4 flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-slate-400" />
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">{section.section}</h2>
              <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {section.items.length}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-x-2 gap-y-5 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-9 xl:grid-cols-11">
              {section.items.map((item) => (
                <AppTile
                  key={`${section.section}-${item.path}`}
                  item={item}
                  favorite={favoritePaths.includes(item.path)}
                  onToggleFavorite={toggleFavorite}
                />
              ))}
            </div>
          </section>
        ))}

        {!hasResults && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <SearchX className="h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="font-medium text-slate-700 dark:text-slate-200">Nenhum aplicativo encontrado</p>
            <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
              Tente outro termo ou limpe a busca para ver todos os modulos disponiveis para o seu perfil.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AppHome;
