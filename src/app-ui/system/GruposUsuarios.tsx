/**
 * Configurações → Grupos de Usuários — no modelo do Active Directory.
 *
 * O grupo junta usuários e leva as regras: quais telas, menus e botões eles
 * usam (árvore de check/uncheck) e quais igrejas acessam. Estando em ao menos
 * um grupo, o usuário vale só pela regra do(s) grupo(s); a categoria
 * (tesoureiro, secretário...) e as permissões pessoais ficam guardadas sem
 * efeito. Vários grupos somam: basta um liberar.
 *
 * A árvore sai do catálogo de módulos + das marcações <Permissao> do código
 * (src/lib/permissoes/arvore.generated.ts). Ver
 * docs/modules/permissoes-granulares/SPEC.md.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiBase } from '../../lib/apiBase';
import {
  DEFAULT_PERMISSION_MODULES,
  PERMISSION_GROUPS,
  type PermissionModule,
} from './permissionCatalog';
import { COMPONENTES_PERMISSAO } from '../../lib/permissoes/arvore.generated';
import { ACOES_MODULO, ROTULO_ACAO, type DefPermissao } from '../../lib/permissoes/definir';

type Mapa = Record<string, boolean>;

interface GrupoResumo {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  _count: { users: number; igrejas: number };
}

interface UsuarioDoGrupo {
  id: string;
  fullName: string;
  email: string;
  profileType: string;
  isActive: boolean;
  role?: { name: string } | null;
  church?: { id: string; name: string } | null;
}

interface GrupoDetalhe {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  permissions: Mapa;
  users: UsuarioDoGrupo[];
  igrejas: string[];
}

interface IgrejaOpcao {
  id: string;
  name: string;
  code?: string | null;
}

function headers(json = false): Record<string, string> {
  const token = localStorage.getItem('mrm_token');
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function api<T>(caminho: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${apiBase}${caminho}`, {
    ...init,
    cache: 'no-store',
    headers: { ...headers(Boolean(init?.body)), ...(init?.headers as Record<string, string>) },
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error || `Erro ${r.status}`);
  return d as T;
}

/** Filhos diretos de cada chave na árvore (pai = `herda`). */
const FILHOS: Map<string, DefPermissao[]> = (() => {
  const m = new Map<string, DefPermissao[]>();
  for (const d of COMPONENTES_PERMISSAO) m.set(d.herda, [...(m.get(d.herda) ?? []), d]);
  return m;
})();

/** Chave + todos os descendentes (para marcar/desmarcar em cascata). */
function comDescendentes(chave: string): string[] {
  return [chave, ...(FILHOS.get(chave) ?? []).flatMap((f) => comDescendentes(f.chave))];
}

const TODAS_AS_CHAVES = [
  ...DEFAULT_PERMISSION_MODULES.flatMap((m) => ACOES_MODULO.map((a) => `${m.key}.${a}`)),
  ...COMPONENTES_PERMISSAO.map((d) => d.chave),
];

export default function GruposUsuarios() {
  const [grupos, setGrupos] = useState<GrupoResumo[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<GrupoDetalhe | null>(null);
  const [aba, setAba] = useState<'regras' | 'usuarios' | 'igrejas'>('regras');
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Sem setState antes do await: o primeiro "carregando" vem do estado inicial,
  // e os recarregamentos mantêm a lista na tela até chegar a nova.
  const carregarLista = useCallback(async () => {
    try {
      const lista = await api<GrupoResumo[]>('/grupos-usuarios');
      setGrupos(lista);
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setCarregandoLista(false);
    }
  }, []);

  const carregarDetalhe = useCallback(async (id: string) => {
    try {
      setDetalhe(await api<GrupoDetalhe>(`/grupos-usuarios/${id}`));
      setErro(null);
    } catch (e) {
      setErro((e as Error).message);
    }
  }, []);

  // Carga inicial: setState só nos callbacks da promessa (mesmo padrão das
  // Posições do Culto). Os recarregamentos usam carregarLista.
  useEffect(() => {
    let vivo = true;
    api<GrupoResumo[]>('/grupos-usuarios')
      .then((lista) => vivo && setGrupos(lista))
      .catch((e) => vivo && setErro((e as Error).message))
      .finally(() => vivo && setCarregandoLista(false));
    return () => {
      vivo = false;
    };
  }, []);

  /** Abre um grupo: limpa o anterior (spinner) e busca o novo. */
  function abrir(id: string) {
    setSelecionado(id);
    setAba('regras');
    setDetalhe(null);
    void carregarDetalhe(id);
  }

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return t ? grupos.filter((g) => g.name.toLowerCase().includes(t)) : grupos;
  }, [grupos, busca]);

  async function aposMudanca() {
    await carregarLista();
    if (selecionado) await carregarDetalhe(selecionado);
  }

  async function excluir() {
    if (!detalhe) return;
    if (
      !window.confirm(
        `Excluir o grupo "${detalhe.name}"? Os ${detalhe.users.length} usuário(s) dele voltam às regras que tinham antes.`,
      )
    )
      return;
    try {
      await api(`/grupos-usuarios/${detalhe.id}`, { method: 'DELETE' });
      toast.success('Grupo excluído.');
      setSelecionado(null);
      setDetalhe(null);
      await carregarLista();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="p-6 flex flex-col gap-4 h-[calc(100vh-4rem)] min-h-0">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Grupos de Usuários</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Como no Active Directory: crie o grupo, marque as telas, menus e botões que ele usa e as
          igrejas que acessa, e coloque os usuários nele. Quem está em grupo vale só pela regra do
          grupo — a categoria (tesoureiro, secretário…) e as permissões pessoais ficam guardadas sem
          efeito. Em mais de um grupo, basta um liberar.
        </p>
      </div>

      {erro && (
        <div className="shrink-0 flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-4 flex-1 min-h-0">
        {/* ── Lista de grupos ─────────────────────────────────────────── */}
        <section className="flex flex-col min-h-0 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="shrink-0 p-3 border-b border-slate-100 dark:border-slate-700 space-y-2">
            <button
              onClick={() => setCriando(true)}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 px-3 py-2 text-sm font-semibold text-white"
            >
              <Plus className="w-4 h-4" /> Novo grupo
            </button>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar grupo…"
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {carregandoLista && (
              <div className="flex justify-center py-8 text-slate-400">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            )}
            {!carregandoLista && filtrados.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-slate-400">
                {grupos.length ? 'Nenhum grupo com esse nome.' : 'Nenhum grupo criado neste campo.'}
              </p>
            )}
            {filtrados.map((g) => {
              const ativo = g.id === selecionado;
              return (
                <button
                  key={g.id}
                  onClick={() => abrir(g.id)}
                  style={
                    ativo
                      ? {
                          backgroundColor: 'var(--theme-soft-bg)',
                          borderLeftColor: 'var(--theme-primary)',
                          color: 'var(--theme-primary)',
                        }
                      : undefined
                  }
                  className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 border-l-[3px] ${
                    ativo ? '' : 'border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-900/60'
                  }`}
                >
                  <Users className={`w-4 h-4 shrink-0 ${ativo ? '' : 'text-slate-400'}`} />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-sm truncate ${
                        ativo ? 'font-semibold' : 'font-medium text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {g.name}
                      {!g.isActive && (
                        <span className="ml-1.5 text-[10px] uppercase font-bold text-slate-400">inativo</span>
                      )}
                    </span>
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                      {g._count.users} usuário(s) · {g._count.igrejas || 'sem'} igreja(s)
                    </span>
                  </span>
                  <ChevronRight className="w-4 h-4 shrink-0 text-slate-300 dark:text-slate-600" />
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Grupo aberto ────────────────────────────────────────────── */}
        <section className="flex flex-col min-h-0 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          {!selecionado && (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 p-10 text-center text-slate-400">
              <Users className="w-8 h-8" />
              <p className="text-sm">Escolha um grupo ao lado ou crie um novo.</p>
            </div>
          )}
          {selecionado && !detalhe && (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}
          {selecionado && detalhe && (
            <>
              <CabecalhoGrupo key={detalhe.id} grupo={detalhe} onSalvo={aposMudanca} onExcluir={excluir} />
              <div className="shrink-0 flex gap-1 px-4 border-b border-slate-100 dark:border-slate-700">
                {(
                  [
                    ['regras', 'Regras (telas, menus e botões)'],
                    ['usuarios', `Usuários (${detalhe.users.length})`],
                    ['igrejas', `Igrejas (${detalhe.igrejas.length || 'todas da lotação'})`],
                  ] as const
                ).map(([k, rotulo]) => (
                  <button
                    key={k}
                    onClick={() => setAba(k)}
                    className={`px-3 py-2.5 text-sm font-medium border-b-2 -mb-px ${
                      aba === k
                        ? 'border-slate-800 text-slate-900 dark:border-white dark:text-white'
                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400'
                    }`}
                  >
                    {rotulo}
                  </button>
                ))}
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                {aba === 'regras' && <AbaRegras key={detalhe.id} grupo={detalhe} onSalvo={aposMudanca} />}
                {aba === 'usuarios' && <AbaUsuarios key={detalhe.id} grupo={detalhe} onMudou={aposMudanca} />}
                {aba === 'igrejas' && <AbaIgrejas key={detalhe.id} grupo={detalhe} onSalvo={aposMudanca} />}
              </div>
            </>
          )}
        </section>
      </div>

      {criando && (
        <ModalNovoGrupo
          onFechar={() => setCriando(false)}
          onCriado={async (id) => {
            setCriando(false);
            await carregarLista();
            abrir(id);
          }}
        />
      )}
    </div>
  );
}

// ─── Cabeçalho: nome, descrição, ativo, excluir ─────────────────────────────

function CabecalhoGrupo({
  grupo,
  onSalvo,
  onExcluir,
}: {
  grupo: GrupoDetalhe;
  onSalvo: () => Promise<void>;
  onExcluir: () => void;
}) {
  const [nome, setNome] = useState(grupo.name);
  const [descricao, setDescricao] = useState(grupo.description ?? '');
  const [salvando, setSalvando] = useState(false);
  const mudou = nome.trim() !== grupo.name || descricao.trim() !== (grupo.description ?? '');

  async function salvar(extra: Record<string, unknown> = {}) {
    setSalvando(true);
    try {
      await api(`/grupos-usuarios/${grupo.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: nome, description: descricao, ...extra }),
      });
      toast.success('Grupo salvo.');
      await onSalvo();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="shrink-0 p-4 border-b border-slate-100 dark:border-slate-700 flex flex-wrap items-start gap-3">
      <div className="flex-1 min-w-[16rem] space-y-2">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="w-full text-lg font-bold bg-transparent border-b border-transparent hover:border-slate-200 focus:border-slate-400 dark:hover:border-slate-600 text-slate-900 dark:text-white focus:outline-none"
        />
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Descrição (opcional)"
          className="w-full text-sm bg-transparent border-b border-transparent hover:border-slate-200 focus:border-slate-400 dark:hover:border-slate-600 text-slate-600 dark:text-slate-300 focus:outline-none"
        />
      </div>
      <div className="flex items-center gap-2">
        <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={grupo.isActive}
            disabled={salvando}
            onChange={(e) => void salvar({ isActive: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300"
          />
          Ativo
        </label>
        {mudou && (
          <button
            onClick={() => void salvar()}
            disabled={salvando}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Salvar nome
          </button>
        )}
        <button
          onClick={onExcluir}
          title="Excluir grupo"
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {!grupo.isActive && (
        <p className="w-full text-xs text-amber-700 dark:text-amber-400">
          Grupo inativo: não vale para ninguém. Os usuários dele seguem as regras de antes.
        </p>
      )}
    </div>
  );
}

// ─── Aba Regras: árvore de check/uncheck ────────────────────────────────────

function AbaRegras({ grupo, onSalvo }: { grupo: GrupoDetalhe; onSalvo: () => Promise<void> }) {
  const [regras, setRegras] = useState<Mapa>(() => ({ ...(grupo.permissions ?? {}) }));
  const [filtroGrupo, setFiltroGrupo] = useState('');
  const [busca, setBusca] = useState('');
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [salvando, setSalvando] = useState(false);

  const original = useMemo(() => JSON.stringify(grupo.permissions ?? {}), [grupo.permissions]);
  const sujo = JSON.stringify(regras) !== original;

  /** Valor marcado: explícito, senão herdado do pai no próprio grupo. */
  const marcado = useCallback(
    (chave: string): boolean => {
      let atual: string | undefined = chave;
      for (let i = 0; atual && i < 50; i++) {
        if (atual in regras) return regras[atual] === true;
        atual = COMPONENTES_PERMISSAO.find((d) => d.chave === atual)?.herda;
      }
      return false;
    },
    [regras],
  );

  function alternar(chave: string, valor: boolean) {
    setRegras((r) => {
      const n = { ...r };
      // Desmarcar o pai desmarca os filhos (D7); marcar só mexe na própria chave.
      for (const k of valor ? [chave] : comDescendentes(chave)) n[k] = valor;
      return n;
    });
  }

  function marcarModulos(mods: PermissionModule[], valor: boolean) {
    setRegras((r) => {
      const n = { ...r };
      for (const m of mods)
        for (const a of ACOES_MODULO) for (const k of comDescendentes(`${m.key}.${a}`)) n[k] = valor;
      return n;
    });
  }

  async function salvar() {
    setSalvando(true);
    try {
      // Grava o mapa completo das chaves conhecidas: o que a tela mostra é
      // exatamente o que vale. Chave nova (botão marcado depois) herda do pai.
      const completo: Mapa = {};
      for (const k of TODAS_AS_CHAVES) completo[k] = marcado(k);
      await api(`/grupos-usuarios/${grupo.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ permissions: completo }),
      });
      toast.success('Regras do grupo salvas. Valem para os usuários em até 10 segundos.');
      await onSalvo();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  const t = busca.trim().toLowerCase();
  const casa = (m: PermissionModule) =>
    !t ||
    m.name.toLowerCase().includes(t) ||
    ACOES_MODULO.some((a) =>
      comDescendentes(`${m.key}.${a}`).some((k) =>
        COMPONENTES_PERMISSAO.find((d) => d.chave === k)?.rotulo.toLowerCase().includes(t),
      ),
    );

  const secoes = PERMISSION_GROUPS.filter((g) => !filtroGrupo || g === filtroGrupo)
    .map((g) => ({ g, mods: DEFAULT_PERMISSION_MODULES.filter((m) => m.group === g && casa(m)) }))
    .filter((s) => s.mods.length);

  const totalLiberadas = TODAS_AS_CHAVES.filter((k) => marcado(k)).length;

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="shrink-0 flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <select
          value={filtroGrupo}
          onChange={(e) => setFiltroGrupo(e.target.value)}
          className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
        >
          <option value="">Todos os módulos</option>
          {PERMISSION_GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[12rem]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar tela ou botão…"
            className="w-full border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none"
          />
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          {totalLiberadas} de {TODAS_AS_CHAVES.length} liberada(s)
        </span>
        <button
          onClick={() => void salvar()}
          disabled={!sujo || salvando}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar regras
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {secoes.map(({ g, mods }) => (
          <div key={g}>
            <div className="sticky top-0 z-10 flex items-center justify-between bg-slate-50 dark:bg-slate-900 px-4 py-1.5 border-y border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {g}
              </span>
              <span className="flex gap-3 text-[11px] font-semibold">
                <button onClick={() => marcarModulos(mods, true)} className="text-slate-600 hover:underline dark:text-slate-300">
                  marcar tudo
                </button>
                <button onClick={() => marcarModulos(mods, false)} className="text-slate-600 hover:underline dark:text-slate-300">
                  desmarcar tudo
                </button>
              </span>
            </div>
            {mods.map((m) => {
              const filhosDoModulo = ACOES_MODULO.flatMap((a) => FILHOS.get(`${m.key}.${a}`) ?? []);
              const aberto = abertos.has(m.key) || Boolean(t);
              return (
                <div key={m.key} className="border-b border-slate-100 dark:border-slate-700/60">
                  <div className="flex items-center gap-2 px-4 py-2">
                    <button
                      onClick={() =>
                        setAbertos((s) => {
                          const n = new Set(s);
                          if (n.has(m.key)) n.delete(m.key);
                          else n.add(m.key);
                          return n;
                        })
                      }
                      disabled={!filhosDoModulo.length}
                      className="w-5 text-slate-400 disabled:opacity-0"
                      title={filhosDoModulo.length ? 'Ver botões desta tela' : undefined}
                    >
                      {aberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <span className="flex-1 min-w-0 text-sm text-slate-800 dark:text-slate-100 truncate">
                      {m.name}
                      {filhosDoModulo.length > 0 && (
                        <span className="ml-2 text-[11px] text-slate-400">
                          {filhosDoModulo.length} componente(s)
                        </span>
                      )}
                    </span>
                    {ACOES_MODULO.map((a) => (
                      <Caixa
                        key={a}
                        rotulo={ROTULO_ACAO[a]}
                        marcado={marcado(`${m.key}.${a}`)}
                        onChange={(v) => alternar(`${m.key}.${a}`, v)}
                      />
                    ))}
                  </div>
                  {aberto &&
                    ACOES_MODULO.map((a) =>
                      (FILHOS.get(`${m.key}.${a}`) ?? []).map((f) => (
                        <NoComponente
                          key={f.chave}
                          def={f}
                          nivel={1}
                          paiLiberado={marcado(`${m.key}.${a}`)}
                          marcado={marcado}
                          alternar={alternar}
                        />
                      )),
                    )}
                </div>
              );
            })}
          </div>
        ))}
        {secoes.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">Nada encontrado.</p>
        )}
      </div>
    </div>
  );
}

function NoComponente({
  def,
  nivel,
  paiLiberado,
  marcado,
  alternar,
}: {
  def: DefPermissao;
  nivel: number;
  paiLiberado: boolean;
  marcado: (k: string) => boolean;
  alternar: (k: string, v: boolean) => void;
}) {
  const valor = paiLiberado && marcado(def.chave);
  const filhos = FILHOS.get(def.chave) ?? [];
  return (
    <>
      <label
        style={{ paddingLeft: `${1.25 + nivel * 1.5}rem` }}
        className={`flex items-center gap-2 pr-4 py-1.5 text-sm ${
          paiLiberado ? 'text-slate-700 dark:text-slate-200 cursor-pointer' : 'text-slate-400 cursor-not-allowed'
        }`}
        title={paiLiberado ? def.chave : 'Bloqueado porque o item acima está desmarcado'}
      >
        <input
          type="checkbox"
          checked={valor}
          disabled={!paiLiberado}
          onChange={(e) => alternar(def.chave, e.target.checked)}
          className="h-4 w-4 rounded border-slate-300"
        />
        <span className="truncate">{def.rotulo}</span>
        <span className="text-[10px] text-slate-400 truncate">{def.chave}</span>
      </label>
      {filhos.map((f) => (
        <NoComponente
          key={f.chave}
          def={f}
          nivel={nivel + 1}
          paiLiberado={valor}
          marcado={marcado}
          alternar={alternar}
        />
      ))}
    </>
  );
}

function Caixa({
  rotulo,
  marcado,
  onChange,
}: {
  rotulo: string;
  marcado: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!marcado)}
      title={`${rotulo}: ${marcado ? 'liberado' : 'bloqueado'}`}
      className={`w-[4.5rem] shrink-0 inline-flex items-center justify-center gap-1 rounded-md border px-1.5 py-1 text-[11px] font-semibold ${
        marcado
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
          : 'border-slate-200 bg-white text-slate-400 dark:border-slate-700 dark:bg-slate-800'
      }`}
    >
      {marcado ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
      {rotulo}
    </button>
  );
}

// ─── Aba Usuários ───────────────────────────────────────────────────────────

function AbaUsuarios({ grupo, onMudou }: { grupo: GrupoDetalhe; onMudou: () => Promise<void> }) {
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<UsuarioDoGrupo[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const noGrupo = useMemo(() => new Set(grupo.users.map((u) => u.id)), [grupo.users]);

  // Abaixo de 2 letras não busca; a lista some por derivação, sem setState.
  const termo = busca.trim();
  const mostrados = termo.length >= 2 ? resultados : [];
  useEffect(() => {
    const t = termo;
    if (t.length < 2) return;
    const timer = setTimeout(() => {
      setBuscando(true);
      fetch(`${apiBase}/users?${new URLSearchParams({ search: t, limit: '20' })}`, {
        headers: headers(),
      })
        .then((r) => r.json())
        .then((d) => setResultados(Array.isArray(d) ? d : (d.data ?? [])))
        .catch(() => setResultados([]))
        .finally(() => setBuscando(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [termo]);

  async function adicionar(id: string) {
    setOcupado(id);
    try {
      await api(`/grupos-usuarios/${grupo.id}/usuarios`, {
        method: 'POST',
        body: JSON.stringify({ userIds: [id] }),
      });
      toast.success('Usuário adicionado ao grupo.');
      await onMudou();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  async function remover(u: UsuarioDoGrupo) {
    setOcupado(u.id);
    try {
      await api(`/grupos-usuarios/${grupo.id}/usuarios?userId=${u.id}`, { method: 'DELETE' });
      toast.success(`${u.fullName} saiu do grupo.`);
      await onMudou();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar usuário por nome ou e-mail para adicionar…"
            className="w-full border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none"
          />
        </div>
        {(buscando || mostrados.length > 0) && (
          <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
            {buscando && (
              <div className="flex justify-center py-4 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            )}
            {!buscando &&
              mostrados.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <LinhaUsuario u={u} />
                  {noGrupo.has(u.id) ? (
                    <span className="text-xs text-slate-400">já está</span>
                  ) : (
                    <button
                      onClick={() => void adicionar(u.id)}
                      disabled={ocupado !== null}
                      className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-600 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
                    >
                      {ocupado === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                      Adicionar
                    </button>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Enquanto estiver neste grupo, a categoria e as permissões pessoais do usuário ficam guardadas
        sem efeito. Ao sair de todos os grupos, ele volta exatamente ao que tinha.
      </p>

      <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
        {grupo.users.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">Nenhum usuário neste grupo.</p>
        )}
        {grupo.users.map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <LinhaUsuario u={u} />
            <button
              onClick={() => void remover(u)}
              disabled={ocupado !== null}
              title="Tirar do grupo"
              className="shrink-0 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 disabled:opacity-50"
            >
              {ocupado === u.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function LinhaUsuario({ u }: { u: UsuarioDoGrupo }) {
  return (
    <div className="min-w-0">
      <div className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
        {u.fullName}
        {u.isActive === false && (
          <span className="ml-1.5 text-[10px] uppercase font-bold text-slate-400">inativo</span>
        )}
      </div>
      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
        {u.email}
        {u.role?.name ? ` · categoria ${u.role.name}` : ''}
        {u.church?.name ? ` · ${u.church.name}` : ''}
      </div>
    </div>
  );
}

// ─── Aba Igrejas ────────────────────────────────────────────────────────────

function AbaIgrejas({ grupo, onSalvo }: { grupo: GrupoDetalhe; onSalvo: () => Promise<void> }) {
  const [igrejas, setIgrejas] = useState<IgrejaOpcao[]>([]);
  const [marcadas, setMarcadas] = useState<Set<string>>(() => new Set(grupo.igrejas));
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    fetch(`${apiBase}/churches?slim=1`, { headers: headers() })
      .then((r) => r.json())
      .then((d) => setIgrejas(Array.isArray(d) ? d : []))
      .catch(() => setIgrejas([]))
      .finally(() => setCarregando(false));
  }, []);

  const sujo =
    marcadas.size !== grupo.igrejas.length || grupo.igrejas.some((id) => !marcadas.has(id));
  const t = busca.trim().toLowerCase();
  const visiveis = t
    ? igrejas.filter((c) => c.name.toLowerCase().includes(t) || (c.code ?? '').toLowerCase().includes(t))
    : igrejas;

  async function salvar() {
    setSalvando(true);
    try {
      await api(`/grupos-usuarios/${grupo.id}/igrejas`, {
        method: 'PUT',
        body: JSON.stringify({ churchIds: [...marcadas] }),
      });
      toast.success('Igrejas do grupo salvas.');
      await onSalvo();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="shrink-0 flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
        <div className="relative flex-1 min-w-[12rem]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar igreja…"
            className="w-full border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none"
          />
        </div>
        <button
          onClick={() => setMarcadas(new Set(visiveis.map((c) => c.id).concat([...marcadas])))}
          className="text-xs font-semibold text-slate-600 hover:underline dark:text-slate-300"
        >
          marcar visíveis
        </button>
        <button
          onClick={() => setMarcadas(new Set())}
          className="text-xs font-semibold text-slate-600 hover:underline dark:text-slate-300"
        >
          limpar
        </button>
        <span className="text-xs text-slate-500">{marcadas.size} marcada(s)</span>
        <button
          onClick={() => void salvar()}
          disabled={!sujo || salvando}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar igrejas
        </button>
      </div>
      <p className="shrink-0 px-4 pt-3 text-xs text-slate-500 dark:text-slate-400">
        Nenhuma marcada: cada usuário continua vendo a igreja da própria lotação, como hoje. Com
        igrejas marcadas, os usuários do grupo acessam exatamente estas (somadas às de outros grupos
        dele).
      </p>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 pt-2">
        {carregando ? (
          <div className="flex justify-center py-8 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-4">
            {visiveis.map((c) => (
              <label key={c.id} className="flex items-center gap-2 py-1.5 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marcadas.has(c.id)}
                  onChange={(e) =>
                    setMarcadas((s) => {
                      const n = new Set(s);
                      if (e.target.checked) n.add(c.id);
                      else n.delete(c.id);
                      return n;
                    })
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{c.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Novo grupo ─────────────────────────────────────────────────────────────

function ModalNovoGrupo({
  onFechar,
  onCriado,
}: {
  onFechar: () => void;
  onCriado: (id: string) => void;
}) {
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function criar() {
    setSalvando(true);
    setErro(null);
    try {
      const g = await api<{ id: string }>('/grupos-usuarios', {
        method: 'POST',
        body: JSON.stringify({ name: nome, description: descricao }),
      });
      toast.success('Grupo criado. Agora marque as regras e adicione os usuários.');
      onCriado(g.id);
    } catch (e) {
      setErro((e as Error).message);
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onFechar}>
      <div
        className="w-full max-w-md bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Novo grupo de usuários</h3>
          <button onClick={onFechar} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Nome *</span>
            <input
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Tesoureiro geral"
              className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Descrição</span>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="mt-1 w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:outline-none"
            />
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            O grupo nasce sem nada liberado. Quem for colocado nele só usa o que você marcar.
          </p>
          {erro && <p className="text-xs text-rose-600">{erro}</p>}
          <button
            onClick={() => void criar()}
            disabled={!nome.trim() || salvando}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Criar grupo
          </button>
        </div>
      </div>
    </div>
  );
}
