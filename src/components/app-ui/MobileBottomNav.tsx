import { useState, type ComponentType } from 'react';
import { Link, useLocation } from 'react-router';
import { AnimatePresence, motion } from 'motion/react';
import { Permissao } from '../../lib/permissoes/Permissao';
import { useFavoritePaths, toggleFavoritePath } from '../../lib/favorites';
import {
  BookOpen, CalendarPlus, ChevronLeft, ChevronRight, ClipboardCheck, Crown, Droplet, LayoutGrid,
  Pin, Plus, ReceiptText, Search, TrendingUp, UserCheck, UserPlus, Users, X,
} from 'lucide-react';

/**
 * Tab bar do painel no celular (< 640px), guia adcampinas-mobile-first
 * (AdminModulos, AdminModulo, AdminAcoes):
 * Módulos · Membros · Criar (FAB escuro) · Lançamento · Gestão de Culto.
 * Nova ordem pedida pelo dono em 02/11/2026 (antes: Início · Membros · Criar
 * · Avisos · Módulos). Início e Avisos seguem no header. Decidido pelo dono
 * em 02/11/2026.
 *
 * Só navegação: não cria regra nova.
 * - Os itens saem de `visibleNavigation`, a mesma lista já filtrada por
 *   permissão que a sidebar usa. Tela que a pessoa não vê, aqui também não
 *   aparece.
 * - "Novo membro" segue `podeCriarMembro`, a mesma regra do botão do header.
 * - O pin das telas usa os mesmos favoritos da sidebar (`lib/favorites`).
 * - O cartão do usuário em Módulos abre a gaveta "Minha Conta" que já existia.
 */

type IconCmp = ComponentType<{ className?: string; strokeWidth?: number }>;
type NavItem = { name: string; path: string; icon: IconCmp; exact?: boolean };
type NavSection = { section: string; items: NavItem[] };

// Criar rápido: atalhos para telas que JÁ existem, agrupados como no guia.
// Pedido do dono (02/11/2026): só o que tesouraria e secretaria usam todo dia.
// Visitante, Ler QR Code, Cobrança Pix e Comunicado saíram daqui (as telas
// continuam no menu Módulos).
const ACOES: { grupo: string; itens: { rotulo: string; path: string; icon: IconCmp; cor: string; precisaCriarMembro?: boolean }[] }[] = [
  {
    grupo: 'Tesouraria',
    itens: [
      { rotulo: 'Lançamento', path: '/app-ui/finance/lancamento/new', icon: TrendingUp, cor: '#c2410c' },
      { rotulo: 'Livro Caixa', path: '/app-ui/finance/cashbook', icon: BookOpen, cor: '#059669' },
      { rotulo: 'Conta a pagar', path: '/app-ui/finance/contas-a-pagar', icon: ReceiptText, cor: '#7c3aed' },
    ],
  },
  {
    grupo: 'Secretaria',
    itens: [
      { rotulo: 'Novo membro', path: '/app-ui/members/new', icon: UserPlus, cor: '#7c3aed', precisaCriarMembro: true },
      { rotulo: 'Batismo', path: '/app-ui/baptism', icon: Droplet, cor: '#dc2626' },
      { rotulo: 'Transferência', path: '/app-ui/transfer', icon: UserCheck, cor: '#0284c7' },
      { rotulo: 'Consagração', path: '/app-ui/consecration', icon: Crown, cor: '#b45309' },
    ],
  },
  {
    grupo: 'Igreja',
    itens: [
      { rotulo: 'Gestão de Culto', path: '/app-ui/culto/gestao', icon: ClipboardCheck, cor: '#2563eb' },
      { rotulo: 'Novo evento', path: '/app-ui/events', icon: CalendarPlus, cor: '#b45309' },
    ],
  },
];

// Uma cor por módulo (fundo suave + ícone), como na tela Módulos do guia.
const CORES_MODULO: Record<string, string> = {
  'Principal': '#475569',
  'Finanças': '#059669',
  'Gestão de Culto': '#2563eb',
  'Secretaria': '#7c3aed',
  'Engajamento': '#db2777',
  'Comunicação': '#ea580c',
  'Ministérios': '#0284c7',
  'GF (Grupos Familiares)': '#d97706',
};
const CORES_EXTRAS = ['#0d9488', '#4f46e5', '#be123c', '#65a30d', '#9333ea', '#0891b2', '#b45309'];
// Cores sólidas das telas dentro do módulo (alternadas, como no guia).
export const CORES_TELAS = ['#0d9488', '#c2410c', '#7c3aed', '#059669', '#ea580c', '#dc2626', '#0284c7', '#1d4ed8', '#d97706', '#0e7490', '#db2777', '#4f46e5'];

// Atalhos do Criar rápido escolhidos pela própria pessoa (pedido do dono em
// 02/11/2026). Guardados só neste navegador, como os favoritos da sidebar.
// Sem escolha salva (null), vale a lista padrão de ACOES.
const CHAVE_CRIAR = 'mrm_criar_rapido_atalhos';

function lerAtalhos(): string[] | null {
  try {
    const bruto = localStorage.getItem(CHAVE_CRIAR);
    const lista: unknown = bruto ? JSON.parse(bruto) : null;
    return Array.isArray(lista) ? lista.filter((p): p is string => typeof p === 'string') : null;
  } catch {
    return null;
  }
}

function gravarAtalhos(lista: string[] | null) {
  try {
    if (lista) localStorage.setItem(CHAVE_CRIAR, JSON.stringify(lista));
    else localStorage.removeItem(CHAVE_CRIAR);
  } catch {
    /* sem armazenamento: a escolha vale até fechar a página */
  }
}

const alfabetico = new Intl.Collator('pt-BR', { sensitivity: 'base' });
const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Telas de formulário (criar/editar) escondem a tab bar no celular, como pede o
 * guia mobile ("Telas de detalhe ou formulário escondem a tab bar"). Só decide
 * o que aparece: a navegação continua a mesma.
 */
export function escondeTabBar(pathname: string) {
  const ultimo = pathname.replace(/\/+$/, '').split('/').pop() ?? '';
  return ultimo === 'new' || ultimo === 'edit' || /-(new|edit)$/.test(ultimo);
}

function isActivePath(pathname: string, item: { path: string; exact?: boolean }) {
  return item.exact
    ? pathname === item.path
    : pathname === item.path || pathname.startsWith(item.path + '/');
}

export function MobileBottomNav({
  sections,
  sectionIcons,
  podeCriarMembro,
  displayName,
  displayRole,
  initials,
  onOpenProfile,
}: {
  sections: NavSection[];
  sectionIcons: Record<string, IconCmp>;
  podeCriarMembro: boolean;
  notificationCount: number;
  displayName: string;
  displayRole: string;
  initials: string;
  onOpenProfile: () => void;
}) {
  const location = useLocation();
  const favoritos = useFavoritePaths();
  const [aberto, setAberto] = useState<'criar' | 'modulos' | null>(null);
  const [modulo, setModulo] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  // Só visual: atalhos escolhidos pela pessoa e o modo de edição da gaveta.
  const [meusAtalhos, setMeusAtalhos] = useState<string[] | null>(lerAtalhos);
  const [editandoAtalhos, setEditandoAtalhos] = useState(false);
  const [buscaAtalho, setBuscaAtalho] = useState('');

  const visiveis = new Set(sections.flatMap((s) => s.items.map((i) => i.path)));
  const membrosPath = '/app-ui/members';
  const lancamentoPath = '/app-ui/finance/lancamento/new';
  const gestaoCultoPath = '/app-ui/culto/gestao';
  const temMembros = visiveis.has(membrosPath);
  const temLancamento = visiveis.has(lancamentoPath);
  const temGestaoCulto = visiveis.has(gestaoCultoPath);

  const grupos = ACOES.map((g) => ({
    ...g,
    itens: g.itens.filter((i) => (i.precisaCriarMembro ? podeCriarMembro : visiveis.has(i.path))),
  })).filter((g) => g.itens.length > 0);

  // Catálogo do que a pessoa pode pôr no Criar rápido: os atalhos padrão e
  // qualquer tela que ela já vê no menu (mesma lista filtrada por permissão).
  type Atalho = { rotulo: string; path: string; icon: IconCmp; cor: string };
  const telasDoMenu = sections.flatMap((s) => s.items).filter((i, idx, arr) => arr.findIndex((x) => x.path === i.path) === idx);
  const atalhoDe = (path: string): Atalho | null => {
    const padrao = ACOES.flatMap((g) => g.itens).find((i) => i.path === path);
    if (padrao) return (padrao.precisaCriarMembro ? podeCriarMembro : visiveis.has(padrao.path)) ? padrao : null;
    const idx = telasDoMenu.findIndex((i) => i.path === path);
    if (idx < 0) return null;
    const t = telasDoMenu[idx];
    return { rotulo: t.name, path: t.path, icon: t.icon, cor: CORES_TELAS[idx % CORES_TELAS.length] };
  };
  const listaPadrao = grupos.flatMap((g) => g.itens.map((i) => i.path));
  const listaAtual = meusAtalhos ?? listaPadrao;
  const gruposExibidos: { grupo: string; itens: Atalho[] }[] = meusAtalhos
    ? [{ grupo: 'Meus atalhos', itens: meusAtalhos.map(atalhoDe).filter((a): a is Atalho => a !== null) }]
    : grupos;
  const termoAtalho = normalizar(buscaAtalho.trim());
  const paraAdicionar = [...ACOES.flatMap((g) => g.itens).map((i) => i.path), ...telasDoMenu.map((i) => i.path)]
    .filter((p, idx, arr) => arr.indexOf(p) === idx && !listaAtual.includes(p))
    .map(atalhoDe)
    .filter((a): a is Atalho => a !== null && (!termoAtalho || normalizar(a.rotulo).includes(termoAtalho)))
    .sort((a, b) => alfabetico.compare(a.rotulo, b.rotulo));
  const salvarAtalhos = (lista: string[] | null) => {
    setMeusAtalhos(lista);
    gravarAtalhos(lista);
  };

  const modulos = [...sections].sort((a, b) => alfabetico.compare(a.section, b.section));
  const corDoModulo = (nome: string) => CORES_MODULO[nome] ?? CORES_EXTRAS[Math.max(0, modulos.findIndex((m) => m.section === nome)) % CORES_EXTRAS.length];
  const moduloAberto = modulo ? sections.find((s) => s.section === modulo) ?? null : null;

  const termo = normalizar(busca.trim());
  const modulosFiltrados = termo ? modulos.filter((s) => normalizar(s.section).includes(termo)) : modulos;
  const telasEncontradas = termo
    ? sections.flatMap((s) => s.items.filter((i) => normalizar(i.name).includes(termo)).map((i) => ({ ...i, section: s.section })))
    : [];

  const fechar = () => {
    setAberto(null);
    setModulo(null);
    setBusca('');
    setEditandoAtalhos(false);
    setBuscaAtalho('');
  };

  // Tab bar: ativo em verde-esmeralda, como no guia.
  const cor = (ativo: boolean) => (ativo ? 'text-[#047857] dark:text-[#34d399]' : 'text-[var(--sl-text-3)]');
  const pilula = (ativo: boolean) =>
    `relative grid h-[30px] w-[52px] place-items-center rounded-full transition-colors ${ativo ? 'bg-[#d1fae5] dark:bg-[#10b981]/15' : ''}`;
  const aba = 'flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold';

  const membrosAtivo = !aberto && isActivePath(location.pathname, { path: membrosPath });
  const lancamentoAtivo = !aberto && isActivePath(location.pathname, { path: lancamentoPath });
  const gestaoCultoAtivo = !aberto && isActivePath(location.pathname, { path: gestaoCultoPath });

  /** Linha de tela: ícone sólido colorido, nome, módulo (na busca) e pin de favorito. */
  const linhaDeTela = (item: NavItem & { section?: string }, corSolida: string) => {
    const Icon = item.icon;
    const fixado = favoritos.includes(item.path);
    return (
      <div key={item.path} className="flex min-h-[62px] items-center gap-3 border-b border-[var(--sl-border)] pl-4 pr-2 last:border-b-0">
        <Link to={item.path} onClick={fechar} className="flex min-w-0 flex-1 items-center gap-3 py-2.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] text-white" style={{ background: corSolida }}>
            <Icon className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold text-[var(--sl-text)]">{item.name}</span>
            {item.section && <span className="block truncate text-[12.5px] text-[var(--sl-text-3)]">{item.section}</span>}
          </span>
        </Link>
        <button type="button" onClick={() => toggleFavoritePath(item.path)}
          aria-label={fixado ? `Desafixar ${item.name}` : `Fixar ${item.name}`}
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${fixado ? 'text-[#d97706]' : 'text-[var(--sl-text-4)]'}`}>
          <Pin className={`h-5 w-5 ${fixado ? 'fill-current' : ''}`} strokeWidth={1.8} />
        </button>
      </div>
    );
  };

  if (escondeTabBar(location.pathname)) return null;

  return (
    <>
      {/* ── Tela Módulos (tela cheia acima da tab bar) ───────────────────── */}
      <AnimatePresence>
        {aberto === 'modulos' && (
          <motion.div
            role="dialog"
            aria-label="Módulos"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.18 }}
            onKeyDown={(e) => { if (e.key === 'Escape') fechar(); }}
            className="fixed inset-x-0 top-0 z-30 overflow-y-auto bg-[#F4F6F9] dark:bg-[#0d1017] sm:hidden"
            style={{ bottom: 'calc(64px + max(6px, env(safe-area-inset-bottom)))' }}
          >
            <div className="px-5 pb-6" style={{ paddingTop: 'max(24px, env(safe-area-inset-top))' }}>
              {moduloAberto ? (
                <>
                  <button type="button" onClick={() => setModulo(null)}
                    className="-ml-2 mb-3 inline-flex h-11 items-center gap-1.5 rounded-full px-2 text-[15px] font-medium text-[var(--sl-text-3)]">
                    <ChevronLeft className="h-5 w-5 text-[var(--sl-text)]" /> Módulos
                  </button>
                  <div className="flex items-center gap-3">
                    {(() => {
                      const Icon = sectionIcons[moduloAberto.section] ?? LayoutGrid;
                      const c = corDoModulo(moduloAberto.section);
                      return (
                        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[16px]"
                          style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c }}>
                          <Icon className="h-6 w-6" strokeWidth={1.8} />
                        </span>
                      );
                    })()}
                    <div className="min-w-0">
                      <h1 className="truncate text-[26px] font-extrabold leading-tight tracking-[-0.8px] text-[var(--sl-text)]">{moduloAberto.section}</h1>
                      <p className="text-[13px] text-[var(--sl-text-3)]">
                        {moduloAberto.items.length} {moduloAberto.items.length === 1 ? 'tela' : 'telas'} · toque no pin para fixar
                      </p>
                    </div>
                  </div>
                  <div className="mt-5 overflow-hidden rounded-[20px] border border-[var(--sl-border)] bg-[var(--sl-solid)]">
                    {[...moduloAberto.items]
                      .sort((a, b) => alfabetico.compare(a.name, b.name))
                      .map((item, i) => linhaDeTela(item, CORES_TELAS[i % CORES_TELAS.length]))}
                  </div>
                </>
              ) : (
                <>
                  <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.8px] text-[var(--sl-text)]">Módulos</h1>
                  <p className="mt-1 text-[13.5px] text-[var(--sl-text-3)]">Tudo do sistema, organizado por área.</p>

                  <label className="mt-5 flex h-[52px] items-center gap-3 rounded-[16px] border border-[var(--sl-border)] bg-[var(--sl-solid)] px-4">
                    <Search className="h-5 w-5 shrink-0 text-[var(--sl-text-3)]" />
                    <input
                      value={busca}
                      onChange={(e) => setBusca(e.target.value)}
                      placeholder="Buscar atalho ou módulo"
                      aria-label="Buscar atalho ou módulo"
                      className="min-w-0 flex-1 bg-transparent text-[16px] text-[var(--sl-text)] outline-none placeholder:text-[var(--sl-text-4)]"
                      style={{ border: 0, boxShadow: 'none', minHeight: 0 }}
                    />
                    {busca && (
                      <button type="button" onClick={() => setBusca('')} aria-label="Limpar busca" className="grid h-8 w-8 place-items-center rounded-full text-[var(--sl-text-3)]">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </label>

                  {telasEncontradas.length > 0 && (
                    <>
                      <p className="mb-2 mt-5 px-1 text-[12px] font-bold uppercase tracking-[1.2px] text-[var(--sl-text-3)]">Telas</p>
                      <div className="overflow-hidden rounded-[20px] border border-[var(--sl-border)] bg-[var(--sl-solid)]">
                        {telasEncontradas.map((item, i) => linhaDeTela(item, CORES_TELAS[i % CORES_TELAS.length]))}
                      </div>
                    </>
                  )}

                  {modulosFiltrados.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {modulosFiltrados.map((s) => {
                        const Icon = sectionIcons[s.section] ?? LayoutGrid;
                        const c = corDoModulo(s.section);
                        return (
                          <button key={s.section} type="button" onClick={() => { setModulo(s.section); setBusca(''); }}
                            className="flex min-h-[132px] flex-col items-start justify-between rounded-[20px] border border-[var(--sl-border)] bg-[var(--sl-solid)] p-4 text-left transition active:scale-[.98]">
                            <span className="grid h-[42px] w-[42px] place-items-center rounded-[12px]"
                              style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c }}>
                              <Icon className="h-5 w-5" strokeWidth={1.8} />
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-[15px] font-bold text-[var(--sl-text)]">{s.section}</span>
                              <span className="block text-[12.5px] text-[var(--sl-text-3)]">{s.items.length} {s.items.length === 1 ? 'tela' : 'telas'}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {termo && telasEncontradas.length === 0 && modulosFiltrados.length === 0 && (
                    <p className="mt-6 text-center text-[13.5px] text-[var(--sl-text-3)]">Nada encontrado para “{busca}”.</p>
                  )}

                  {/* Cartão do usuário: abre a gaveta "Minha Conta" (perfil, configurações, sair) */}
                  <button type="button" onClick={() => { fechar(); onOpenProfile(); }}
                    className="mt-4 flex w-full items-center gap-3 rounded-[20px] border border-[var(--sl-border)] bg-[var(--sl-solid)] px-4 py-3 text-left">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#0f172a] text-sm font-bold text-white">{initials}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold text-[var(--sl-text)]">{displayName}</span>
                      <span className="block truncate text-[12.5px] text-[var(--sl-text-3)]">{displayRole}</span>
                    </span>
                    <ChevronRight className="h-5 w-5 text-[var(--sl-text-4)]" />
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <nav
        aria-label="Menu inferior"
        className="fixed inset-x-0 bottom-0 z-40 flex items-end border-t border-[var(--sl-border)] bg-[var(--sl-solid)] px-1 pt-1.5 sm:hidden"
        style={{ paddingBottom: 'max(6px, env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          onClick={() => { setModulo(null); setBusca(''); setAberto(aberto === 'modulos' ? null : 'modulos'); }}
          aria-expanded={aberto === 'modulos'}
          className={`${aba} ${cor(aberto === 'modulos')}`}
        >
          <span className={pilula(aberto === 'modulos')}><LayoutGrid className="h-5 w-5" strokeWidth={1.8} /></span>
          Módulos
        </button>

        {temMembros ? (
          <Link to={membrosPath} onClick={fechar} className={`${aba} ${cor(membrosAtivo)}`}>
            <span className={pilula(membrosAtivo)}><Users className="h-5 w-5" strokeWidth={1.8} /></span>
            Membros
          </Link>
        ) : <span className="flex-1" />}

        {grupos.length > 0 ? (
          <Permissao chave="tela_moldura.app_ui.criar_rapido_celular" rotulo="Criar rápido (menu do celular) — App UI" herda="tela_moldura.view">
          <button
            type="button"
            onClick={() => { setModulo(null); setBusca(''); setAberto(aberto === 'criar' ? null : 'criar'); }}
            aria-label="Criar rápido"
            aria-expanded={aberto === 'criar'}
            className={`${aba} text-[var(--sl-text)]`}
          >
            <span
              className="-mt-[26px] grid h-14 w-14 place-items-center rounded-full bg-[#0f172a] text-white shadow-[0_10px_24px_-8px_rgba(15,23,42,.6)] transition-transform"
              style={{ border: '4px solid var(--sl-solid)', transform: aberto === 'criar' ? 'rotate(45deg)' : undefined }}
            >
              <Plus className="h-6 w-6" />
            </span>
            Criar
          </button>
          </Permissao>
        ) : <span className="flex-1" />}

        {temLancamento ? (
          <Link to={lancamentoPath} onClick={fechar} className={`${aba} ${cor(lancamentoAtivo)}`}>
            <span className={pilula(lancamentoAtivo)}><TrendingUp className="h-5 w-5" strokeWidth={1.8} /></span>
            Lançamento
          </Link>
        ) : <span className="flex-1" />}

        {temGestaoCulto ? (
          <Link to={gestaoCultoPath} onClick={fechar} className={`${aba} ${cor(gestaoCultoAtivo)}`}>
            <span className={pilula(gestaoCultoAtivo)}><ClipboardCheck className="h-5 w-5" strokeWidth={1.8} /></span>
            <span className="whitespace-nowrap">Gestão Culto</span>
          </Link>
        ) : <span className="flex-1" />}

      </nav>

      {/* ── Criar rápido (bottom sheet) ─────────────────────────────────── */}
      <AnimatePresence>
        {aberto === 'criar' && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-[rgba(11,18,32,.5)] sm:hidden"
              onClick={fechar}
            />
            <motion.div
              role="dialog"
              aria-label="Criar rápido"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              onKeyDown={(e) => { if (e.key === 'Escape') fechar(); }}
              className="fixed inset-x-0 bottom-0 z-50 flex max-h-[86vh] flex-col rounded-t-[26px] bg-[var(--sl-solid)] sm:hidden"
              style={{ paddingBottom: 'max(18px, env(safe-area-inset-bottom))' }}
            >
              <div className="mx-auto mt-2.5 h-[5px] w-10 rounded-full bg-[var(--sl-border-2)]" />
              <div className="flex items-center px-5 pb-1 pt-4">
                <p className="flex-1 text-[19px] font-extrabold text-[var(--sl-text)]">{editandoAtalhos ? 'Personalizar' : 'Criar rápido'}</p>
                {editandoAtalhos ? (
                  <Permissao chave="tela_moldura.app_ui.criar_rapido_concluir" rotulo="Concluir personalização do Criar rápido (celular) — App UI" herda="tela_moldura.app_ui.criar_rapido_personalizar">
                  <button type="button" onClick={() => { setEditandoAtalhos(false); setBuscaAtalho(''); }}
                    className="mr-2 h-10 rounded-full bg-[#0f172a] px-4 text-[13.5px] font-bold text-white dark:bg-white dark:text-[#0f172a]">
                    Concluir
                  </button>
                  </Permissao>
                ) : (
                  <Permissao chave="tela_moldura.app_ui.criar_rapido_personalizar" rotulo="Personalizar atalhos do Criar rápido (celular) — App UI" herda="tela_moldura.app_ui.criar_rapido_celular">
                  <button type="button" onClick={() => setEditandoAtalhos(true)}
                    className="mr-2 h-10 rounded-full px-3 text-[13.5px] font-bold text-[#047857] dark:text-[#34d399]">
                    Personalizar
                  </button>
                  </Permissao>
                )}
                <button type="button" onClick={fechar} aria-label="Fechar"
                  className="grid h-10 w-10 place-items-center rounded-full bg-[#F3F4F6] text-[var(--sl-text-2)] dark:bg-[var(--sl-chip)]">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="overflow-y-auto px-5 pb-2">
                {gruposExibidos.map((g) => (
                  <div key={g.grupo} className="mt-3">
                    <p className="mb-2 text-[12px] font-bold uppercase tracking-[1.2px] text-[var(--sl-text-3)]">{editandoAtalhos ? 'Na sua lista' : g.grupo}</p>
                    <div className="grid grid-cols-3 gap-2.5">
                      {g.itens.map((item) => {
                        const Icon = item.icon;
                        const conteudo = (
                          <>
                            <span className="grid h-11 w-11 place-items-center rounded-[13px] text-white" style={{ background: item.cor }}>
                              <Icon className="h-[22px] w-[22px]" strokeWidth={1.8} />
                            </span>
                            <span className="text-[13px] font-bold leading-tight text-[var(--sl-text)]">{item.rotulo}</span>
                          </>
                        );
                        const caixa = 'relative flex min-h-[104px] flex-col items-center justify-center gap-2.5 rounded-[18px] bg-[#F3F4F6] px-2 py-3 text-center transition active:scale-[.97] dark:bg-[var(--sl-chip)]';
                        return editandoAtalhos ? (
                          <div key={item.path + item.rotulo} className={caixa}>
                            {conteudo}
                            <Permissao chave="tela_moldura.app_ui.criar_rapido_tirar" rotulo="Tirar atalho do Criar rápido (celular) — App UI" herda="tela_moldura.app_ui.criar_rapido_personalizar">
                            <button type="button" aria-label={`Tirar ${item.rotulo}`}
                              onClick={() => salvarAtalhos(listaAtual.filter((p) => p !== item.path))}
                              className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-[#dc2626] text-white shadow">
                              <X className="h-4 w-4" />
                            </button>
                            </Permissao>
                          </div>
                        ) : (
                          <Link key={item.path + item.rotulo} to={item.path} onClick={fechar} className={caixa}>
                            {conteudo}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {!editandoAtalhos && gruposExibidos.every((g) => g.itens.length === 0) && (
                  <p className="mt-6 text-center text-[13.5px] text-[var(--sl-text-3)]">Nenhum atalho. Toque em Personalizar para escolher os seus.</p>
                )}

                {editandoAtalhos && (
                  <div className="mt-5">
                    <p className="mb-2 text-[12px] font-bold uppercase tracking-[1.2px] text-[var(--sl-text-3)]">Adicionar</p>
                    <label className="mb-3 flex h-12 items-center gap-3 rounded-[14px] bg-[#F3F4F6] px-4 dark:bg-[var(--sl-chip)]">
                      <Search className="h-5 w-5 shrink-0 text-[var(--sl-text-3)]" />
                      <input
                        value={buscaAtalho}
                        onChange={(e) => setBuscaAtalho(e.target.value)}
                        placeholder="Buscar tela"
                        aria-label="Buscar tela para adicionar"
                        className="min-w-0 flex-1 bg-transparent text-[16px] text-[var(--sl-text)] outline-none placeholder:text-[var(--sl-text-4)]"
                        style={{ border: 0, boxShadow: 'none', minHeight: 0, outline: 'none' }}
                      />
                    </label>
                    <div className="overflow-hidden rounded-[18px] border border-[var(--sl-border)]">
                      {paraAdicionar.map((item) => {
                        const Icon = item.icon;
                        return (
                          <div key={item.path} className="flex min-h-[56px] items-center gap-3 border-b border-[var(--sl-border)] px-3 last:border-b-0">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] text-white" style={{ background: item.cor }}>
                              <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-[var(--sl-text)]">{item.rotulo}</span>
                            <Permissao chave="tela_moldura.app_ui.criar_rapido_por" rotulo="Pôr atalho no Criar rápido (celular) — App UI" herda="tela_moldura.app_ui.criar_rapido_personalizar">
                            <button type="button" aria-label={`Pôr ${item.rotulo}`}
                              onClick={() => salvarAtalhos([...listaAtual, item.path])}
                              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#d1fae5] text-[#047857] dark:bg-[#10b981]/15 dark:text-[#34d399]">
                              <Plus className="h-5 w-5" />
                            </button>
                            </Permissao>
                          </div>
                        );
                      })}
                      {paraAdicionar.length === 0 && (
                        <p className="px-4 py-5 text-center text-[13.5px] text-[var(--sl-text-3)]">Nada a adicionar.</p>
                      )}
                    </div>
                    {meusAtalhos && (
                      <Permissao chave="tela_moldura.app_ui.criar_rapido_padrao" rotulo="Voltar aos atalhos padrão do Criar rápido (celular) — App UI" herda="tela_moldura.app_ui.criar_rapido_personalizar">
                      <button type="button" onClick={() => salvarAtalhos(null)}
                        className="mt-4 w-full rounded-[14px] py-3 text-[13.5px] font-bold text-[var(--sl-text-3)]">
                        Voltar aos atalhos padrão
                      </button>
                      </Permissao>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
