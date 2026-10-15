/**
 * Peças comuns do menu Pagamentos (Asaas): chamada à API, formatos e os
 * componentes visuais no mesmo padrão das telas Mobile (slate + roxo).
 */
import { useEffect, useState, type ReactNode } from 'react';
import QRCode from 'qrcode';
import { AlertTriangle, Copy, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiBase } from '../../lib/apiBase';

function lerUsuario(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem('mrm_user') || '{}');
  } catch {
    return {};
  }
}
export const perfilAtual = () => String(lerUsuario().profileType || 'church');

export async function api<T = unknown>(caminho: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const token = localStorage.getItem('mrm_token');
  const campo = localStorage.getItem('mrm_active_field_id') || String(lerUsuario().campoId || '');
  const url = `${apiBase}/asaas/admin/${caminho}${campo ? `${caminho.includes('?') ? '&' : '?'}campoId=${encodeURIComponent(campo)}` : ''}`;
  const r = await fetch(url, {
    method: init?.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as { error?: string }).error || `Erro ${r.status}`);
  return d as T;
}

/** Carrega dados com estado de carregando/erro e recarga manual. */
export function useDados<T>(caminho: string | null, deps: unknown[] = []) {
  const [dados, setDados] = useState<T | null>(null);
  const [resposta, setResposta] = useState<{ chave: string; erro: string | null } | null>(null);
  const [versao, setVersao] = useState(0);
  // "Carregando" = ainda não chegou resposta para a chave atual (caminho + recarga).
  const chave = `${caminho}|${versao}|${JSON.stringify(deps)}`;
  useEffect(() => {
    if (!caminho) return;
    let vivo = true;
    api<T>(caminho)
      .then((d) => {
        if (!vivo) return;
        setDados(d);
        setResposta({ chave, erro: null });
      })
      .catch((e) => vivo && setResposta({ chave, erro: (e as Error).message }));
    return () => {
      vivo = false;
    };
  }, [caminho, chave]);
  const atual = resposta?.chave === chave;
  return { dados, erro: atual ? resposta!.erro : null, carregando: Boolean(caminho) && !atual, recarregar: () => setVersao((v) => v + 1), setDados };
}

export const brl = (v: unknown) =>
  v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function dataBr(v: unknown, hora = false) {
  if (!v) return '—';
  const s = String(v);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00`) : new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return hora ? d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : d.toLocaleDateString('pt-BR');
}

export const hojeIso = (somaDias = 0) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(Date.now() + somaDias * 86_400_000));

export async function copiar(texto: string, msg = 'Copiado') {
  try {
    await navigator.clipboard.writeText(texto);
    toast.success(msg);
  } catch {
    toast.error('Não foi possível copiar.');
  }
}

// ── Visual ────────────────────────────────────────────────────────────────

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Cartao({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700', className)}>{children}</div>;
}

export function Metrica({ rotulo, valor, sub, icone: Icone, tom = 'purple' }: { rotulo: string; valor: ReactNode; sub?: ReactNode; icone: React.ElementType; tom?: 'purple' | 'emerald' | 'amber' | 'sky' | 'rose' | 'slate' }) {
  const tons: Record<string, string> = {
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30',
    sky: 'bg-sky-50 text-sky-600 dark:bg-sky-900/30',
    rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30',
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-700',
  };
  return (
    <Cartao className="p-4 flex items-start gap-3">
      <div className={cx('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', tons[tom])}>
        <Icone className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 dark:text-slate-400">{rotulo}</p>
        <p className="text-xl font-bold text-slate-800 dark:text-white truncate">{valor}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </Cartao>
  );
}

const ESTADOS: Record<string, [string, string]> = {
  PAGO: ['Pago', 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'],
  PENDENTE: ['Aguardando', 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'],
  VENCIDO: ['Vencido', 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'],
  CANCELADO: ['Cancelado', 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'],
  ESTORNADO: ['Estornado', 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300'],
  RECUSADO: ['Recusado', 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'],
  ATIVA: ['Ativa', 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'],
  PAUSADA: ['Pausada', 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'],
  INADIMPLENTE: ['Em aberto', 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'],
  CANCELADA: ['Cancelada', 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'],
};

/** Status do Asaas que merecem rótulo próprio além do estado. */
const DETALHE_STATUS: Record<string, string> = {
  CONFIRMED: 'Confirmado (a liquidar)', RECEIVED: 'Recebido', RECEIVED_IN_CASH: 'Em dinheiro', REFUND_REQUESTED: 'Estorno solicitado',
  REFUND_IN_PROGRESS: 'Estorno em andamento', CHARGEBACK_REQUESTED: 'Chargeback', CHARGEBACK_DISPUTE: 'Chargeback em disputa',
  AWAITING_RISK_ANALYSIS: 'Em análise', AWAITING_CHARGEBACK_REVERSAL: 'Aguardando reversão',
};

export function Selo({ estado, status }: { estado: string; status?: string }) {
  const [rotulo, classe] = ESTADOS[estado] ?? [estado, 'bg-slate-100 text-slate-600'];
  const detalhe = status ? DETALHE_STATUS[status] : null;
  return (
    <span title={status} className={cx('inline-flex px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap', classe)}>
      {detalhe && estado === 'PAGO' && status !== 'RECEIVED' ? detalhe : rotulo}
    </span>
  );
}

export const ORIGENS: Record<string, string> = {
  CONTRIBUICAO: 'Dízimo/oferta (app)', PEDIDO: 'Loja/ingresso (app)', ASSINATURA: 'Recorrência', AVULSA: 'Cobrança rápida', LINK: 'Link de pagamento',
};

export function Botao({ children, onClick, tipo = 'primario', disabled, carregando, className, title }: {
  children: ReactNode; onClick?: () => void; tipo?: 'primario' | 'secundario' | 'perigo' | 'fantasma'; disabled?: boolean; carregando?: boolean; className?: string; title?: string;
}) {
  const tipos = {
    primario: 'bg-purple-600 hover:bg-purple-700 text-white',
    secundario: 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700',
    perigo: 'bg-rose-600 hover:bg-rose-700 text-white',
    fantasma: 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700',
  };
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled || carregando}
      className={cx('inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed', tipos[tipo], className)}>
      {carregando && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Campo({ rotulo, children, ajuda }: { rotulo: string; children: ReactNode; ajuda?: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{rotulo}</span>
      {children}
      {ajuda && <span className="block text-[11px] text-slate-400 mt-1">{ajuda}</span>}
    </label>
  );
}

export const inputCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/40';

export function Carregando() {
  return <div className="flex items-center gap-2 p-8 justify-center text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>;
}

export function Erro({ msg, onTentar }: { msg: string; onTentar?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 text-sm">
      <AlertTriangle className="w-4 h-4 flex-shrink-0" /> <span className="flex-1">{msg}</span>
      {onTentar && <Botao tipo="secundario" onClick={onTentar}>Tentar de novo</Botao>}
    </div>
  );
}

export function Vazio({ icone: Icone, titulo, sub, acao }: { icone: React.ElementType; titulo: string; sub?: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 py-12 px-4">
      <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center"><Icone className="w-6 h-6 text-purple-600" /></div>
      <p className="font-semibold text-slate-700 dark:text-slate-200">{titulo}</p>
      {sub && <p className="text-sm text-slate-500 max-w-md">{sub}</p>}
      {acao}
    </div>
  );
}

export function Gaveta({ aberta, titulo, onFechar, children, largura = 'max-w-xl' }: { aberta: boolean; titulo: ReactNode; onFechar: () => void; children: ReactNode; largura?: string }) {
  if (!aberta) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onFechar} />
      <div className={cx('relative w-full h-full bg-slate-50 dark:bg-slate-900 shadow-xl overflow-y-auto', largura)}>
        <div className="sticky top-0 z-10 flex items-center gap-3 px-5 py-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <div className="flex-1 min-w-0 font-bold text-slate-800 dark:text-white">{titulo}</div>
          <button onClick={onFechar} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

/** QR a partir de imagem base64 do Asaas ou de um texto (link/copia-e-cola). */
export function Qr({ imagem, texto, tamanho = 220 }: { imagem?: string | null; texto?: string | null; tamanho?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (imagem || !texto) return;
    QRCode.toDataURL(texto, { margin: 1, width: tamanho * 2 }).then(setUrl).catch(() => setUrl(null));
  }, [imagem, texto, tamanho]);
  const src = imagem ? `data:image/png;base64,${imagem}` : url;
  if (!src) return <div style={{ width: tamanho, height: tamanho }} className="rounded-xl bg-slate-100 dark:bg-slate-700 animate-pulse" />;
  return <img src={src} alt="QR Code" width={tamanho} height={tamanho} className="rounded-xl bg-white p-2 border border-slate-200" />;
}

export function CopiaECola({ texto, rotulo = 'Copiar' }: { texto: string; rotulo?: string }) {
  return (
    <div className="flex items-center gap-2 p-1.5 pl-3 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
      <code className="flex-1 min-w-0 truncate text-xs text-slate-600 dark:text-slate-300">{texto}</code>
      <Botao tipo="primario" onClick={() => copiar(texto)} className="!py-1.5"><Copy className="w-3.5 h-3.5" />{rotulo}</Botao>
    </div>
  );
}

export function Interruptor({ ligado, onChange, rotulo, sub }: { ligado: boolean; onChange: (v: boolean) => void; rotulo: string; sub?: string }) {
  return (
    <button type="button" onClick={() => onChange(!ligado)} className="flex items-center gap-3 text-left w-full">
      <span className={cx('relative w-10 h-6 rounded-full transition-colors flex-shrink-0', ligado ? 'bg-purple-600' : 'bg-slate-300 dark:bg-slate-600')}>
        <span className={cx('absolute top-1 w-4 h-4 rounded-full bg-white transition-all', ligado ? 'left-5' : 'left-1')} />
      </span>
      <span>
        <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">{rotulo}</span>
        {sub && <span className="block text-xs text-slate-500">{sub}</span>}
      </span>
    </button>
  );
}

export function confirmar(msg: string) {
  return window.confirm(msg);
}
