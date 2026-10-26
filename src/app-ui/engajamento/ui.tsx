/**
 * Peças visuais das telas do Engajamento, no guia de novastelas/guia-style.md
 * (o mesmo da Lista de Membros e do Novo Membro). Cores com significado vão em
 * hex: o tema global repinta as classes verde/âmbar do Tailwind.
 */
import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { FONTE_MODELO_FAMILIA, useFonteModelo } from '../../lib/fonteModelo';

export const cls = {
  botaoSec:
    'flex h-10 items-center gap-2 whitespace-nowrap rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-slate-900 disabled:pointer-events-none disabled:opacity-50 md:px-3.5 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-slate-300',
  botaoPri:
    'flex h-10 items-center gap-2 whitespace-nowrap rounded-[10px] bg-slate-900 px-3.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200',
  botaoIcone:
    'grid h-9 w-9 flex-none place-items-center rounded-[10px] text-slate-600 hover:bg-[#f1f5f9] hover:text-slate-900 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white',
  botaoIconeRisco:
    'grid h-9 w-9 flex-none place-items-center rounded-[10px] text-slate-500 hover:bg-[#fee2e2] hover:text-[#b91c1c] disabled:opacity-40 dark:text-slate-400',
  campo:
    'h-[46px] w-full rounded-xl border-[1.5px] border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-slate-300',
  rotulo: 'mb-1.5 block text-[13px] font-semibold text-[#334155] dark:text-slate-300',
  cartao: 'rounded-[18px] border border-[#e8ecf1] bg-white md:rounded-[22px] dark:border-slate-700 dark:bg-slate-800',
  cabecalhoTabela: 'text-xs font-bold uppercase tracking-[.06em] text-[#64748b] dark:text-slate-400',
  chip: (ligado: boolean) =>
    `flex h-10 items-center gap-2 whitespace-nowrap rounded-full border-[1.5px] px-4 text-sm font-semibold transition-colors ${
      ligado
        ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200'
    }`,
};

export function Tela({ children }: { children: ReactNode }) {
  useFonteModelo();
  return (
    <div
      className="flex min-h-full flex-col bg-[#f4f6f8] text-slate-900 antialiased dark:bg-slate-900 dark:text-slate-100"
      style={{ fontFamily: FONTE_MODELO_FAMILIA }}
    >
      <style>{'@keyframes egRowIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@keyframes egDrawerIn{from{transform:translateX(40px);opacity:0}to{transform:none;opacity:1}}@keyframes egPopIn{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}'}</style>
      {children}
    </div>
  );
}

export function Cabecalho({ icone, titulo, acoes }: { icone: ReactNode; titulo: string; acoes?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-[#e8ecf1] bg-white px-4 py-3 md:px-7 md:py-3.5 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-slate-100 text-slate-700 md:h-10 md:w-10 dark:bg-slate-700 dark:text-slate-200">
          {icone}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="hidden whitespace-nowrap text-xs text-slate-500 md:block dark:text-slate-400">Engajamento</span>
          <span className="truncate text-[17px] font-bold">{titulo}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">{acoes}</div>
    </header>
  );
}

export function Corpo({ children }: { children: ReactNode }) {
  return <div className="box-border flex w-full flex-1 flex-col gap-3 px-3 pb-10 pt-3 md:px-7 md:pt-4">{children}</div>;
}

export function Badge({ bg, fg, children }: { bg: string; fg: string; children: ReactNode }) {
  return (
    <span className="inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-bold" style={{ background: bg, color: fg }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: fg }} />
      {children}
    </span>
  );
}

export function Avatar({ texto, tamanho = 42 }: { texto: string; tamanho?: number }) {
  return (
    <span
      className="grid flex-none place-items-center rounded-full bg-[#f1f5f9] text-[13px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200"
      style={{ width: tamanho, height: tamanho }}
    >
      {texto}
    </span>
  );
}

export function Vazio({ icone, titulo, texto }: { icone: ReactNode; titulo: string; texto: string }) {
  return (
    <section className={`${cls.cartao} flex flex-col items-center gap-1.5 px-6 py-14 text-center`}>
      <span className="mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-[#f1f5f9] text-slate-500 dark:bg-slate-700 dark:text-slate-300">{icone}</span>
      <span className="text-base font-bold">{titulo}</span>
      <span className="max-w-md text-sm text-slate-500 dark:text-slate-400">{texto}</span>
    </section>
  );
}

export function Aviso({ tipo = 'erro', children }: { tipo?: 'erro' | 'info'; children: ReactNode }) {
  const cor = tipo === 'erro'
    ? 'border-[#fecaca] bg-[#fef2f2] text-[#b91c1c] dark:border-red-900 dark:bg-red-950/30 dark:text-red-300'
    : 'border-[#c7d2fe] bg-[#eef2ff] text-[#3730a3] dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200';
  return <div className={`rounded-2xl border px-4 py-3 text-sm ${cor}`}>{children}</div>;
}

/** Fecha com Esc. */
export function useEsc(aberto: boolean, fechar: () => void) {
  useEffect(() => {
    if (!aberto) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [aberto, fechar]);
}

export function Gaveta({ aberta, fechar, titulo, subtitulo, children }: {
  aberta: boolean; fechar: () => void; titulo: string; subtitulo?: string; children: ReactNode;
}) {
  useEsc(aberta, fechar);
  if (!aberta) return null;
  return (
    <div className="fixed inset-0 z-50" style={{ fontFamily: FONTE_MODELO_FAMILIA }}>
      <div className="absolute inset-0 bg-[rgba(15,23,42,.45)]" onClick={fechar} />
      <aside className="absolute bottom-0 right-0 top-0 flex w-full max-w-[440px] animate-[egDrawerIn_.2s_ease] flex-col bg-white shadow-2xl dark:bg-slate-900">
        <div className="flex items-start justify-between gap-3 border-b border-[#e8ecf1] px-5 py-4 dark:border-slate-700">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-bold">{titulo}</div>
            {subtitulo && <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitulo}</div>}
          </div>
          <button type="button" onClick={fechar} title="Fechar" className={cls.botaoIcone}><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </aside>
    </div>
  );
}

export function Modal({ aberto, fechar, titulo, largura = 560, children }: {
  aberto: boolean; fechar: () => void; titulo: string; largura?: number; children: ReactNode;
}) {
  useEsc(aberto, fechar);
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4" style={{ fontFamily: FONTE_MODELO_FAMILIA }}>
      <div className="absolute inset-0 bg-[rgba(15,23,42,.45)]" onClick={fechar} />
      <div
        className="relative flex max-h-[92vh] w-full animate-[egPopIn_.18s_ease] flex-col overflow-hidden rounded-t-[22px] bg-white shadow-[0_30px_70px_-20px_rgba(15,23,42,.45)] sm:rounded-[22px] dark:bg-slate-900"
        style={{ maxWidth: largura }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[#e8ecf1] px-5 py-4 dark:border-slate-700">
          <span className="text-[15px] font-bold">{titulo}</span>
          <button type="button" onClick={fechar} title="Fechar" className={cls.botaoIcone}><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
