/** Peças compartilhadas da aba Envio (Meta Oficial): classes, selos, barras e tipos. Só apresentação. */
import { Ban, CalendarClock, CheckCheck, CheckCircle2, Clock, Eye, Hourglass, Loader2, PauseCircle, Send, XCircle, type LucideIcon } from 'lucide-react';

export type Disparo = {
  id: string;
  nome: string;
  modeloNome: string;
  idioma: string;
  categoria: string;
  status: string;
  motivo: string | null;
  agendadoPara: string | null;
  total: number;
  enviados: number;
  entregues: number;
  lidos: number;
  falhos: number;
  criadoEm: string;
};

export const ROTULO_DISPARO: Record<string, string> = {
  agendado: 'Agendado',
  enviando: 'Enviando',
  aguardando_limite: 'Aguardando limite',
  pausado: 'Pausado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
};
export const ROTULO_ENVIO: Record<string, string> = {
  pendente: 'Na fila',
  enviando: 'Enviando',
  enviado: 'Enviado',
  entregue: 'Entregue',
  lido: 'Lido',
  falhou: 'Falhou',
  ignorado: 'Ignorado',
};
export const ROTULO_CATEGORIA: Record<string, string> = { MARKETING: 'Marketing', UTILITY: 'Utilidade', AUTHENTICATION: 'Autenticação' };

const VERDE = 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300';
const ambar = 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300';
const VERMELHO = 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300';
const AZUL = 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300';
const NEUTRO = 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200';
const COR_STATUS: Record<string, string> = {
  agendado: AZUL, enviando: AZUL, aguardando_limite: ambar, pausado: ambar, concluido: VERDE, cancelado: NEUTRO,
  pendente: NEUTRO, enviado: AZUL, entregue: VERDE, lido: VERDE, falhou: VERMELHO, ignorado: NEUTRO,
};

const ICONE_STATUS: Record<string, LucideIcon> = {
  agendado: CalendarClock, enviando: Loader2, aguardando_limite: Hourglass, pausado: PauseCircle, concluido: CheckCircle2, cancelado: Ban,
  pendente: Clock, enviado: Send, entregue: CheckCheck, lido: Eye, falhou: XCircle, ignorado: Ban,
};

export function Selo({ status, envio = false }: { status: string; envio?: boolean }) {
  const rotulo = (envio ? ROTULO_ENVIO : ROTULO_DISPARO)[status] ?? status;
  const Icone = ICONE_STATUS[status];
  return (
    <span className={`inline-flex h-[26px] items-center gap-1 whitespace-nowrap rounded-full border px-2.5 text-xs font-bold ${COR_STATUS[status] ?? NEUTRO}`}>
      {Icone && <Icone className={`size-3 ${status === 'enviando' ? 'animate-spin' : ''}`} />}
      {rotulo}
    </span>
  );
}

export function dataHora(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** Barra de proporção (valor sobre total) com rótulo e número. */
export function Barra({ rotulo, valor, total, cor }: { rotulo: string; valor: number; total: number; cor: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((valor / total) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-600 dark:text-slate-300">{rotulo}</span>
        <span className="tabular-nums text-slate-500 dark:text-slate-400">{valor.toLocaleString('pt-BR')} ({pct}%)</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700" role="progressbar" aria-label={rotulo} aria-valuemin={0} aria-valuemax={total} aria-valuenow={valor}>
        <div className={`h-full rounded-full ${cor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export const COR_BARRA = {
  enviado: 'bg-sky-500',
  entregue: 'bg-emerald-500',
  lido: 'bg-emerald-700 dark:bg-emerald-400',
  falhou: 'bg-red-500',
};

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[13px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
      <Loader2 className="size-4 animate-spin" /> {texto}
    </div>
  );
}

export const botaoSec = 'inline-flex h-8 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
export const botaoSecM = 'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700';
export const botaoPri = 'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] bg-slate-900 px-3.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:pointer-events-none disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200';
export const botaoPerigo = 'inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700 disabled:pointer-events-none disabled:opacity-50';
export const entrada = 'w-full rounded-xl border-[1.5px] border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900 focus:shadow-[0_0_0_4px_rgba(15,23,42,.08)] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-slate-300';
export const rotuloCls = 'mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200';
export const dica = 'text-xs text-slate-500 dark:text-slate-400';
export const alerta = 'rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300';
export const cartaoCls = 'rounded-[18px] border border-[#e8ecf1] bg-white p-4 md:rounded-[22px] dark:border-slate-700 dark:bg-slate-800';
