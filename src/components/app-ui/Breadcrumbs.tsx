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
export function Breadcrumbs({ trail, naBarra = false }: { trail: Crumb[]; naBarra?: boolean }) {
  if (trail.length < 2) return null;

  return (
    <nav
      aria-label="Caminho de navegação"
      className={
        naBarra
          ? 'min-w-0'
          : 'border-b border-slate-200 bg-white/80 px-6 py-2.5 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80'
      }
    >
      {/* naBarra: dentro da barra superior, numa linha só e só texto
          (sem casinha, sem setas, separado por "/"). */}
      <ol className={naBarra ? 'flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-[13px]' : 'flex flex-wrap items-center gap-1 text-xs'}>
        {trail.map((crumb, indice) => {
          const ultima = indice === trail.length - 1;
          return (
            <li key={`${crumb.label}-${indice}`} className={naBarra ? 'flex min-w-0 items-center gap-1.5' : 'flex items-center gap-1'}>
              {indice > 0 ? (
                naBarra
                  ? <span aria-hidden className="text-slate-300 dark:text-slate-600">/</span>
                  : <ChevronRight className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" />
              ) : null}
              {naBarra ? (
                // Classes sem "bg-purple-*": o tema global pinta qualquer classe que contenha isso.
                crumb.path && !ultima ? (
                  <Link to={crumb.path} className="truncate text-slate-500 transition-colors hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-white">
                    {crumb.label}
                  </Link>
                ) : (
                  <span
                    aria-current={ultima ? 'page' : undefined}
                    className={ultima ? 'truncate font-semibold text-slate-900 dark:text-slate-100' : 'truncate text-slate-400 dark:text-slate-500'}
                  >
                    {crumb.label}
                  </span>
                )
              ) : crumb.path && !ultima ? (
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
