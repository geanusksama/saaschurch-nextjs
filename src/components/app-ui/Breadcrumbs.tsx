import { Link } from 'react-router';
import { ChevronRight, Home } from 'lucide-react';
import type { Crumb } from '../../lib/breadcrumbTrail';

/**
 * Caminho de navegação ("você está aqui") exibido no topo de toda tela.
 *
 * A trilha vem pronta de `buildBreadcrumbTrail` — aqui é só apresentação. As
 * migalhas com `path` são links de volta; a última nunca tem, porque é o lugar
 * onde a pessoa já está.
 */
export function Breadcrumbs({ trail }: { trail: Crumb[] }) {
  if (trail.length < 2) return null;

  return (
    <nav
      aria-label="Caminho de navegação"
      className="border-b border-slate-200 bg-white/80 px-6 py-2.5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80"
    >
      <ol className="flex flex-wrap items-center gap-1 text-xs">
        {trail.map((crumb, indice) => {
          const ultima = indice === trail.length - 1;
          return (
            <li key={`${crumb.label}-${indice}`} className="flex items-center gap-1">
              {indice > 0 ? <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" /> : null}
              {crumb.path && !ultima ? (
                <Link
                  to={crumb.path}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-slate-500 transition-colors hover:bg-purple-50 hover:text-purple-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-purple-300"
                >
                  {indice === 0 ? <Home className="h-3.5 w-3.5" /> : null}
                  {crumb.label}
                </Link>
              ) : (
                <span
                  aria-current={ultima ? 'page' : undefined}
                  className={
                    ultima
                      ? 'px-1.5 py-0.5 font-semibold text-slate-900 dark:text-slate-100'
                      : 'px-1.5 py-0.5 text-slate-400 dark:text-slate-500'
                  }
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
