/**
 * Base das páginas públicas de Eventos e Compras: tema (o mesmo da home),
 * dados da vitrine (/api/public/pagamentos/vitrine), carrinho e o menu do topo
 * (Eventos · Compras · Peniel · CIBE), usado também pela home.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { CalendarDays, Moon, ShoppingBag, Sun } from 'lucide-react';
import { apiBase } from '../../../lib/apiBase';
import { DEFAULT_HOME_PAYLOAD, mergeHomePayload, type HomeConfigPayload } from '../../../lib/homeConfig';

export interface Ministerio { id: string; nome: string; site: string | null }
export interface Opcao { id: string; rotulo: string; preco: number }
export interface Evento {
  id: string; titulo: string; tituloCurto: string | null; categoria: string | null; descricao: string | null; local: string | null; endereco: string | null;
  inicio: string; fim: string | null; imagemUrl: string | null; destaque: boolean; ctaTexto: string | null; vagas: number | null; ministerio: Ministerio | null; opcoes: Opcao[];
}
export interface Produto {
  id: string; nome: string; categoria: string | null; descricao: string | null; preco: number; novo: boolean; tamanhos: string[]; ministerio: Ministerio | null;
  cores: { id: string; nome: string; hex: string }[]; imagens: { url: string; corId: string | null; vista: string }[];
}
export interface Vitrine { campo: string | null; pagamento: { pix: boolean; cartao: boolean } | null; ministerios: Ministerio[]; eventos: Evento[]; produtos: Produto[] }

export const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function dataEvento(inicio: string, fim: string | null) {
  const i = new Date(inicio);
  const d = i.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  const h = i.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if (!fim) return `${d} · ${h}`;
  const f = new Date(fim);
  return f.toDateString() === i.toDateString() ? `${d} · ${h}` : `${d} a ${f.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · ${h}`;
}

/** Tema claro/escuro: o mesmo que a home grava. */
export function useTema() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const s = localStorage.getItem('mrm_theme_settings');
      return s ? JSON.parse(s).isDark !== false : true;
    } catch {
      return true;
    }
  });
  const alternar = () => setIsDark((d) => {
    try { localStorage.setItem('mrm_theme_settings', JSON.stringify({ isDark: !d })); } catch { /* sem armazenamento */ }
    return !d;
  });
  return { isDark, alternar };
}

/** Configuração da home (logo e cor de destaque da igreja). */
export function useHome() {
  const [home, setHome] = useState<HomeConfigPayload>(DEFAULT_HOME_PAYLOAD);
  useEffect(() => {
    let vivo = true;
    fetch(`${apiBase}/public/home-config`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo && d) setHome(mergeHomePayload(d)); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);
  return home;
}

export function useVitrine() {
  const [dados, setDados] = useState<Vitrine | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    fetch(`${apiBase}/public/pagamentos/vitrine`, { cache: 'no-store' })
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Erro ao carregar.'); return d; })
      .then((d) => vivo && setDados(d))
      .catch((e) => vivo && setErro((e as Error).message));
    return () => { vivo = false; };
  }, []);
  return { dados, erro };
}

export async function post<T>(caminho: string, corpo: unknown): Promise<T> {
  const r = await fetch(`${apiBase}/public/pagamentos/${caminho}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as { error?: string }).error || 'Não foi possível concluir.');
  return d as T;
}

export async function get<T>(caminho: string): Promise<T> {
  const r = await fetch(`${apiBase}/public/pagamentos/${caminho}`, { cache: 'no-store' });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as { error?: string }).error || 'Erro.');
  return d as T;
}

// ── Carrinho (fica no navegador até o pagamento) ──────────────────────────

export interface ItemCarrinho {
  chave: string; tipo: 'PRODUTO' | 'INGRESSO'; nome: string; detalhe: string | null; preco: number; quantidade: number; imagem: string | null;
  produtoId?: string; tamanho?: string; corId?: string; opcaoId?: string;
}
const CHAVE_CARRINHO = 'site_carrinho_v1';

export function useCarrinho() {
  const [itens, setItens] = useState<ItemCarrinho[]>(() => {
    try { return JSON.parse(localStorage.getItem(CHAVE_CARRINHO) || '[]'); } catch { return []; }
  });
  const salvar = useCallback((l: ItemCarrinho[]) => {
    setItens(l);
    try { localStorage.setItem(CHAVE_CARRINHO, JSON.stringify(l)); } catch { /* sem armazenamento */ }
  }, []);
  return {
    itens,
    total: itens.reduce((s, i) => s + i.preco * i.quantidade, 0),
    qtd: itens.reduce((s, i) => s + i.quantidade, 0),
    adicionar: (i: ItemCarrinho) => {
      const ja = itens.find((x) => x.chave === i.chave);
      salvar(ja ? itens.map((x) => (x.chave === i.chave ? { ...x, quantidade: Math.min(20, x.quantidade + i.quantidade) } : x)) : [...itens, i]);
    },
    mudar: (chave: string, quantidade: number) => salvar(quantidade <= 0 ? itens.filter((x) => x.chave !== chave) : itens.map((x) => (x.chave === chave ? { ...x, quantidade: Math.min(20, quantidade) } : x))),
    limpar: () => salvar([]),
  };
}

// ── Menu do topo ───────────────────────────────────────────────────────────

/**
 * Links do topo: Eventos · Compras · Peniel · CIBE — só texto, sem caixa alta
 * (pedido do dono); o ativo ganha um traço na cor da igreja.
 */
export function NavPublica({ isDark, accent, onPeniel, className }: { isDark: boolean; accent: string; onPeniel?: () => void; className?: string }) {
  const { pathname, search } = useLocation();
  const dep = new URLSearchParams(search).get('dep')?.toLowerCase();
  const itens: { rotulo: string; to?: string; ativo: boolean; onClick?: () => void }[] = [
    { rotulo: 'Eventos', to: '/eventos', ativo: pathname === '/eventos' && !dep },
    { rotulo: 'Compras', to: '/loja', ativo: pathname === '/loja' && !dep },
    onPeniel ? { rotulo: 'Peniel', onClick: onPeniel, ativo: false } : { rotulo: 'Peniel', to: '/peniel', ativo: pathname === '/peniel' },
    { rotulo: 'CIBE', to: '/eventos?dep=cibe', ativo: dep === 'cibe' },
  ];
  const cor = isDark ? 'text-white/60 hover:text-white' : 'text-slate-500 hover:text-slate-900';
  return (
    <nav className={cx('flex items-center gap-6 md:gap-9 text-[13px] md:text-sm font-semibold tracking-wide', className)}>
      {itens.map((i) => {
        const conteudo = (
          <span className="relative py-2 inline-block">
            {i.rotulo}
            <span className={cx('absolute left-0 right-0 -bottom-0.5 h-[2px] rounded-full transition-all duration-300', i.ativo ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0')} style={{ background: accent }} />
          </span>
        );
        const cls = cx('transition-colors', i.ativo ? (isDark ? 'text-white' : 'text-slate-900') : cor);
        return i.to
          ? <Link key={i.rotulo} to={i.to} className={cls}>{conteudo}</Link>
          : <button key={i.rotulo} type="button" onClick={i.onClick} className={cls}>{conteudo}</button>;
      })}
    </nav>
  );
}

export interface Hero {
  selo: string;
  titulo: ReactNode;
  texto: string;
  /** Botão principal (cheio, na cor da igreja) e secundários (contorno). */
  acoes: { rotulo: string; icone?: React.ElementType; onClick: () => void; principal?: boolean }[];
  /** Imagens dos cartões empilhados à direita (próximos eventos / produtos). */
  cartoes: { imagem: string | null; rotulo: string; titulo: string }[];
}

/**
 * Moldura de Eventos e Compras no desenho da página do Peniel: cabeçalho com
 * a marca da igreja, menu em texto e "Voltar"; hero com selo, título grande,
 * texto, botões e cartões empilhados.
 */
export function PaginaPublica({ hero, children, direita }: {
  hero?: (ctx: { isDark: boolean; accent: string }) => Hero;
  children: (ctx: { isDark: boolean; accent: string }) => ReactNode;
  direita?: (ctx: { isDark: boolean; accent: string }) => ReactNode;
}) {
  const { isDark, alternar } = useTema();
  const home = useHome();
  const cfg = home.config;
  const accent = cfg.accentColor || '#d4af37';
  const ctx = { isDark, accent };
  const h = hero?.(ctx);
  const contorno = isDark ? 'text-white/70 hover:text-white border-white/10 hover:bg-white/5' : 'text-slate-600 hover:text-slate-900 border-black/10 hover:bg-black/5';
  return (
    <div className={cx('min-h-screen relative overflow-hidden', isDark ? 'text-white' : 'text-slate-900')}
      style={{ background: isDark ? `radial-gradient(1200px 600px at 80% -10%, ${accent}1f, transparent 60%), #0a0a0a` : `radial-gradient(1200px 600px at 80% -10%, ${accent}26, transparent 60%), #f8fafc` }}>
      <header className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between gap-4 relative z-20">
        <Link to="/" className="flex items-center gap-3.5 min-w-0">
          {cfg.logoUrl
            ? <img src={cfg.logoUrl} alt="" className={cx('w-10 h-10 rounded-xl object-cover border', isDark ? 'border-white/10' : 'border-black/10')} />
            : <span className={cx('w-10 h-10 rounded-xl border', isDark ? 'border-white/10 bg-white/5' : 'border-black/10 bg-black/5')} />}
          <span className="min-w-0 hidden sm:block">
            <span className="block text-lg font-black tracking-widest uppercase leading-none truncate">{cfg.siteTitle || 'Igreja'}</span>
            <span className={cx('block text-[9px] font-bold tracking-widest uppercase mt-1', isDark ? 'text-white/40' : 'text-slate-400')}>Eventos e compras</span>
          </span>
        </Link>
        <NavPublica isDark={isDark} accent={accent} className="hidden md:flex" />
        <div className="flex items-center gap-2 shrink-0">
          {direita?.(ctx)}
          <button onClick={alternar} title={isDark ? 'Tema claro' : 'Tema escuro'} className={cx('w-9 h-9 rounded-full border flex items-center justify-center', contorno)}>
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>
          <Link to="/" className={cx('text-xs font-bold px-4 py-2 rounded-full border transition-all', contorno)}>Voltar</Link>
        </div>
      </header>
      <div className="md:hidden flex justify-center px-6 -mt-2 relative z-20"><NavPublica isDark={isDark} accent={accent} /></div>

      {h && (
        <section className="max-w-7xl mx-auto px-6 py-12 md:py-20 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center relative z-10">
          <div className="lg:col-span-7 space-y-7">
            <span className={cx('inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-[10px] font-extrabold uppercase tracking-[0.2em]', isDark ? 'border-white/10 bg-white/5' : 'border-black/10 bg-white')} style={{ color: accent }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accent }} />{h.selo}
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]">{h.titulo}</h1>
            <p className={cx('text-base md:text-lg leading-relaxed max-w-xl', isDark ? 'text-white/60' : 'text-slate-600')}>{h.texto}</p>
            <div className="flex flex-wrap gap-3">
              {h.acoes.map((a) => (
                <button key={a.rotulo} onClick={a.onClick}
                  className={cx('inline-flex items-center gap-2 px-6 py-3.5 rounded-full text-sm font-bold transition-all', a.principal ? 'text-black hover:brightness-110 shadow-lg' : cx('border', contorno))}
                  style={a.principal ? { background: accent, boxShadow: `0 10px 30px -10px ${accent}` } : undefined}>
                  {a.icone && <a.icone className="w-4 h-4" />}{a.rotulo}
                </button>
              ))}
            </div>
          </div>
          <div className="lg:col-span-5 relative h-72 sm:h-80 hidden sm:block">
            {h.cartoes.slice(0, 3).reverse().map((c, i, arr) => {
              const pos = arr.length - 1 - i; // 0 = o da frente
              return (
                <div key={c.titulo + i}
                  className={cx('absolute rounded-3xl overflow-hidden border shadow-2xl transition-transform duration-500 hover:-translate-y-1', isDark ? 'border-white/10 bg-[#141414]' : 'border-black/10 bg-white')}
                  style={{ width: '82%', height: '78%', right: `${pos * 7}%`, top: `${pos * 9}%`, transform: `rotate(${pos * 3}deg)`, opacity: 1 - pos * 0.25, zIndex: 10 - pos }}>
                  {c.imagem
                    ? <img src={c.imagem} alt="" className="absolute inset-0 w-full h-full object-cover" />
                    : <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${accent}55, transparent)` }} />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 inset-x-0 p-5">
                    <span className="block w-8 h-[3px] rounded-full mb-2" style={{ background: accent }} />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">{c.rotulo}</p>
                    <p className="text-base font-extrabold text-white leading-snug line-clamp-2">{c.titulo}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {h && <div className={cx('max-w-7xl mx-auto border-t', isDark ? 'border-white/10' : 'border-black/10')} />}
      <main className="max-w-7xl mx-auto px-6 pt-10 pb-20 relative z-10">{children(ctx)}</main>
    </div>
  );
}

export function Vazio({ isDark, icone: Icone = CalendarDays, titulo, sub }: { isDark: boolean; icone?: React.ElementType; titulo: string; sub?: string }) {
  return (
    <div className={cx('rounded-3xl p-10 text-center', isDark ? 'bg-white/5 ring-1 ring-white/10' : 'bg-white ring-1 ring-black/5')}>
      <Icone className="w-8 h-8 mx-auto mb-3 opacity-60" />
      <p className="font-semibold">{titulo}</p>
      {sub && <p className="text-sm opacity-60 mt-1">{sub}</p>}
    </div>
  );
}

export { ShoppingBag };
