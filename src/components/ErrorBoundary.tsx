import { useRouteError, Link, isRouteErrorResponse } from 'react-router';
import { Home, ArrowLeft, LifeBuoy } from 'lucide-react';

/**
 * Tela de erro de rota (404 e afins).
 *
 * A ilustração é SVG inline de propósito: a tela precisa aparecer inteira
 * mesmo quando o problema é justamente um recurso que não carregou.
 */
export function ErrorBoundary() {
  const error = useRouteError();

  let mensagem: string;
  let status: string | number = 'Erro';

  if (isRouteErrorResponse(error)) {
    status = error.status;
    mensagem = error.statusText || error.data;
  } else if (error instanceof Error) {
    mensagem = error.message;
  } else {
    mensagem = 'Ocorreu um erro desconhecido.';
  }

  const ehNaoEncontrado = status === 404;
  const titulo = ehNaoEncontrado ? 'Esta página não existe' : 'Algo deu errado';
  const descricao = ehNaoEncontrado
    ? 'O endereço que você abriu não está no sistema — pode ter sido movido, renomeado ou o link estar desatualizado.'
    : mensagem;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-2xl text-center">
        <IlustracaoNaoEncontrado />

        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          Erro {status}
        </p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white">
          {titulo}
        </h1>
        <p className="mt-3 mx-auto max-w-md text-slate-600 dark:text-slate-400">
          {descricao}
        </p>

        {ehNaoEncontrado && mensagem && mensagem !== 'Not Found' ? (
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">{mensagem}</p>
        ) : null}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>

          <Link
            to="/app-ui"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-white px-5 py-2.5 text-sm font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
          >
            <Home className="w-4 h-4" />
            Ir para o início
          </Link>

          <Link
            to="/app-ui/help"
            className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <LifeBuoy className="w-4 h-4" />
            Central de ajuda
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Placa de "sem saída" com o 404 — leve, sem dependência de arquivo externo. */
function IlustracaoNaoEncontrado() {
  return (
    <svg
      viewBox="0 0 360 220"
      role="img"
      aria-label="Ilustração de página não encontrada"
      className="mx-auto w-full max-w-xs sm:max-w-sm"
    >
      <defs>
        <linearGradient id="erro-fundo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.10" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>

      <g className="text-slate-400 dark:text-slate-600">
        <circle cx="180" cy="110" r="92" fill="url(#erro-fundo)" />
        <ellipse cx="180" cy="196" rx="104" ry="9" fill="currentColor" opacity="0.18" />
      </g>

      {/* Poste */}
      <rect x="174" y="120" width="12" height="72" rx="4" className="fill-slate-300 dark:fill-slate-700" />

      {/* Placa */}
      <g transform="rotate(-4 180 78)">
        <rect x="66" y="30" width="228" height="96" rx="18" className="fill-white dark:fill-slate-900" />
        <rect
          x="66" y="30" width="228" height="96" rx="18"
          className="fill-none stroke-slate-200 dark:stroke-slate-700"
          strokeWidth="3"
        />
        <text
          x="180" y="95"
          textAnchor="middle"
          className="fill-slate-900 dark:fill-white"
          style={{ fontSize: 52, fontWeight: 800, letterSpacing: '0.04em' }}
        >
          404
        </text>
        <circle cx="88" cy="52" r="4" className="fill-slate-300 dark:fill-slate-700" />
        <circle cx="272" cy="52" r="4" className="fill-slate-300 dark:fill-slate-700" />
      </g>

      {/* Lupa procurando */}
      <g className="text-rose-500">
        <circle cx="268" cy="150" r="20" fill="none" stroke="currentColor" strokeWidth="7" />
        <line x1="283" y1="165" x2="299" y2="181" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      </g>
    </svg>
  );
}
