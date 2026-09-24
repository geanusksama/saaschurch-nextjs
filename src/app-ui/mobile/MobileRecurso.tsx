/**
 * Lista + formulário genéricos de um recurso do App Igreja v3.
 *
 * Tudo que aparece aqui vem de src/lib/mobile/definicoes.ts: colunas da
 * tabela (`lista`), campos do formulário, o que é só leitura, filtro e busca.
 * Para mudar o que o painel mostra de um recurso, mude a definição — esta
 * tela não conhece nenhum recurso pelo nome.
 *
 * Registros-filhos (ingressos de um evento, cores e fotos de um produto,
 * alunos de uma turma) aparecem dentro do formulário do pai, com esta mesma
 * tela em modo compacto.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, ImagePlus, Info, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { ConfirmDialog } from '../../components/app-ui/shared/ConfirmDialog';
import { usePermissions } from '../../lib/usePermissions';
import { RECURSOS, type CampoDef, type RecursoDef } from '../../lib/mobile/definicoes';
import { api, enviarImagem, perfilAtual, type Pagina } from './api';
import { JogoEditor } from './JogoEditor';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const inputCls =
  'w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500';

/** Controles da barra de filtros: altura fixa, largura do conteúdo. */
const filtroCls =
  'h-9 px-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 shrink-0';

/** Primeiro e último dia do mês corrente (AAAA-MM-DD, fuso do navegador). */
function mesCorrente(): [string, string] {
  const hoje = new Date();
  const f = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return [f(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), f(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0))];
}

// ── formatação ─────────────────────────────────────────────────────────────
const brl = (v: unknown) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v ?? 0));

function dataBr(v: unknown, comHora: boolean): string {
  if (!v) return '—';
  const s = String(v);
  if (!comHora) {
    const [a, m, d] = s.slice(0, 10).split('-');
    return d ? `${d}/${m}/${a}` : s;
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? s : dt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** ISO → valor do <input type="datetime-local"> no fuso do navegador. */
function paraLocal(v: unknown): string {
  if (!v) return '';
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function rotuloOpcao(c: CampoDef, v: unknown): string {
  return c.opcoes?.find(([k]) => k === String(v))?.[1] ?? (v == null ? '—' : String(v));
}

function celula(c: CampoDef, v: unknown, r?: Row) {
  if (c.tipo === 'ministerio') v = r?.[`${c.col}Rotulo`] ?? (v ? '…' : null);
  if (v === null || v === undefined || v === '') return <span className="text-slate-400">—</span>;
  switch (c.tipo) {
    case 'bool':
      return v ? (
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">Sim</span>
      ) : (
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300">Não</span>
      );
    case 'dinheiro': return brl(v);
    case 'data': return dataBr(v, false);
    case 'dataHora': return dataBr(v, true);
    case 'opcoes': return rotuloOpcao(c, v);
    case 'imagem': return <img src={String(v)} alt="" className="w-12 h-12 rounded-lg object-cover bg-slate-100" />;
    case 'cor': return <span className="inline-flex items-center gap-2"><span className="w-4 h-4 rounded border" style={{ background: String(v) }} />{String(v)}</span>;
    case 'tags': return (v as string[]).join(', ');
    case 'json': case 'jogo': return <span className="text-slate-400">—</span>;
    default: {
      const s = String(v);
      return <span className="whitespace-pre-line">{s.length > 90 ? `${s.slice(0, 90)}…` : s}</span>;
    }
  }
}

// ── opções de igreja/relação (carregadas uma vez por tela) ──────────────────
let igrejasCache: Promise<{ id: string; nome: string }[]> | null = null;
function igrejasDoCampo() {
  igrejasCache ??= api<{ id: string; nome: string }[]>('igrejas').catch((e) => {
    igrejasCache = null;
    throw e;
  });
  return igrejasCache;
}

function useOpcoesRelacao(c: CampoDef, paiId: string | null) {
  const [opcoes, setOpcoes] = useState<[string, string][]>([]);
  useEffect(() => {
    let vivo = true;
    if (c.tipo === 'igreja') {
      igrejasDoCampo().then((l) => vivo && setOpcoes(l.map((i) => [i.id, i.nome]))).catch(() => {});
    } else if (c.tipo === 'ministerio') {
      api<{ id: string; nome: string }[]>('ministerios').then((l) => vivo && setOpcoes(l.map((i) => [i.id, i.nome]))).catch(() => {});
    } else if (c.tipo === 'categoria' && c.categoria) {
      // só as ativas; a atual (mesmo desativada) entra pelo Campo
      api<Pagina<Row>>(`categorias-${c.categoria === 'EVENTO' ? 'evento' : 'produto'}?tudo=1&f_ativo=true`)
        .then((p) => vivo && setOpcoes(p.linhas.map((r) => [r.nome, r.nome])))
        .catch(() => {});
    } else if (c.tipo === 'relacao' && c.relacao) {
      const def = RECURSOS[c.relacao];
      const rotulo = def.campos.find((x) => x.lista)?.col ?? 'id';
      const extra = def.pai ? (paiId ? `&pai=${paiId}` : null) : '';
      if (extra === null) return;
      api<Pagina<Row>>(`${c.relacao}?tudo=1${extra}`)
        .then((p) => vivo && setOpcoes(p.linhas.map((r) => [r.id, `${r[rotulo] ?? r.id}${r.numero && rotulo !== 'numero' ? ` (${r.numero})` : ''}`])))
        .catch(() => {});
    }
    return () => { vivo = false; };
  }, [c, paiId]);
  return opcoes;
}

// ── campo do formulário ────────────────────────────────────────────────────
function Campo({ c, valor, onChange, pasta, paiId, travado, valores }: {
  c: CampoDef; valor: unknown; onChange: (v: unknown) => void; pasta: string; paiId: string | null; travado: boolean; valores: Row;
}) {
  const opcoesRel = useOpcoesRelacao(c, paiId);
  const [enviando, setEnviando] = useState(false);
  const desab = travado || c.leitura;

  if (c.leitura) {
    let mostra: React.ReactNode = celula(c, valor, valores);
    if (c.tipo === 'json' && valor != null) mostra = <pre className="text-xs whitespace-pre-wrap bg-slate-50 dark:bg-slate-900 rounded-lg p-2 max-h-60 overflow-auto">{JSON.stringify(valor, null, 2)}</pre>;
    if (c.tipo === 'url' && valor) mostra = <a href={String(valor)} target="_blank" rel="noreferrer" className="text-purple-600 underline break-all">Abrir</a>;
    if (c.tipo === 'textoLongo' && valor) mostra = <span className="whitespace-pre-line">{String(valor)}</span>;
    return (
      <div>
        <p className="text-xs font-semibold text-slate-500 mb-1">{c.rotulo}</p>
        <div className="text-sm text-slate-800 dark:text-slate-100">{mostra}</div>
      </div>
    );
  }

  let entrada: React.ReactNode;
  switch (c.tipo) {
    case 'textoLongo':
      entrada = <textarea rows={5} className={inputCls} value={String(valor ?? '')} disabled={desab} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'json':
      entrada = (
        <textarea rows={6} className={`${inputCls} font-mono text-xs`} disabled={desab}
          value={typeof valor === 'string' ? valor : valor == null ? '' : JSON.stringify(valor, null, 2)}
          onChange={(e) => onChange(e.target.value)} />
      );
      break;
    case 'numero':
      entrada = <input type="number" className={inputCls} value={valor == null ? '' : String(valor)} disabled={desab} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'dinheiro':
      entrada = <input type="number" step="0.01" min="0" className={inputCls} value={valor == null ? '' : String(valor)} disabled={desab} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'bool':
      entrada = (
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" className="w-4 h-4 accent-purple-600" checked={Boolean(valor)} disabled={desab} onChange={(e) => onChange(e.target.checked)} />
          {c.rotulo}
        </label>
      );
      break;
    case 'data':
      entrada = <input type="date" className={inputCls} value={valor ? String(valor).slice(0, 10) : ''} disabled={desab} onChange={(e) => onChange(e.target.value)} />;
      break;
    case 'dataHora':
      entrada = (
        <input type="datetime-local" className={inputCls} value={paraLocal(valor)} disabled={desab}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : '')} />
      );
      break;
    case 'opcoes':
      entrada = (
        <select className={inputCls} value={valor == null ? '' : String(valor)} disabled={desab} onChange={(e) => onChange(e.target.value)}>
          {!c.obrigatorio && <option value="">—</option>}
          {c.opcoes?.map(([k, r]) => <option key={k} value={k}>{r}</option>)}
        </select>
      );
      break;
    case 'jogo':
      entrada = <JogoEditor jogo={String(valores.jogo ?? '')} valor={valor} onChange={onChange} travado={Boolean(desab)} />;
      break;
    case 'categoria': {
      const lista = valor && !opcoesRel.some(([k]) => k === valor) ? [[String(valor), `${valor} (desativada)`] as [string, string], ...opcoesRel] : opcoesRel;
      entrada = (
        <select className={inputCls} value={valor == null ? '' : String(valor)} disabled={desab} onChange={(e) => onChange(e.target.value)}>
          <option value="">{lista.length ? '— escolha —' : 'Nenhuma categoria cadastrada'}</option>
          {lista.map(([k, r]) => <option key={k} value={k}>{r}</option>)}
        </select>
      );
      break;
    }
    case 'ministerio':
    case 'igreja':
    case 'relacao':
      entrada = (
        <select className={inputCls} value={valor == null ? '' : String(valor)} disabled={desab} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {opcoesRel.map(([k, r]) => <option key={k} value={k}>{r}</option>)}
        </select>
      );
      break;
    case 'cor':
      entrada = (
        <div className="flex items-center gap-2">
          <input type="color" className="w-10 h-10 rounded border border-slate-200" value={String(valor || '#000000').slice(0, 7)} disabled={desab} onChange={(e) => onChange(e.target.value)} />
          <input className={inputCls} value={String(valor ?? '')} disabled={desab} onChange={(e) => onChange(e.target.value)} />
        </div>
      );
      break;
    case 'tags':
      entrada = (
        <input className={inputCls} disabled={desab} value={Array.isArray(valor) ? valor.join(', ') : String(valor ?? '')}
          onChange={(e) => onChange(e.target.value)} />
      );
      break;
    case 'imagem':
      entrada = (
        <div className="flex items-start gap-3">
          {valor ? <img src={String(valor)} alt="" className="w-20 h-20 rounded-lg object-cover bg-slate-100 flex-shrink-0" /> : null}
          <div className="flex-1 space-y-2">
            <input className={inputCls} placeholder="https://…" value={String(valor ?? '')} disabled={desab} onChange={(e) => onChange(e.target.value)} />
            {!desab && (
              <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs font-semibold cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700">
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                {enviando ? 'Enviando…' : 'Enviar imagem'}
                <input type="file" accept="image/*" className="hidden" disabled={enviando}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = '';
                    if (!f) return;
                    setEnviando(true);
                    try {
                      onChange(await enviarImagem(f, pasta));
                    } catch (err) {
                      toast.error((err as Error).message);
                    } finally {
                      setEnviando(false);
                    }
                  }} />
              </label>
            )}
          </div>
        </div>
      );
      break;
    default:
      entrada = <input className={inputCls} value={String(valor ?? '')} disabled={desab} onChange={(e) => onChange(e.target.value)} />;
  }

  return (
    <div>
      {c.tipo !== 'bool' && (
        <p className="text-xs font-semibold text-slate-500 mb-1">
          {c.rotulo}{c.obrigatorio && <span className="text-rose-500"> *</span>}
        </p>
      )}
      {entrada}
      {c.ajuda && <p className="text-[11px] text-slate-400 mt-1">{c.ajuda}</p>}
    </div>
  );
}

// ── formulário (painel lateral) ────────────────────────────────────────────
function Editor({ def, inicial, paiId, podeEditar, podeExcluir, onFechar, onSalvo, onExcluir }: {
  def: RecursoDef; inicial: Row | null; paiId: string | null; podeEditar: boolean; podeExcluir: boolean;
  onFechar: () => void; onSalvo: (r: Row) => void; onExcluir: (r: Row) => void;
}) {
  const novo = inicial === null;
  const [valores, setValores] = useState<Row>(() => {
    if (!novo) return { ...inicial };
    return Object.fromEntries(def.campos.filter((c) => !c.leitura).map((c) => [c.col, c.padrao ?? (c.tipo === 'bool' ? false : '')]));
  });
  const [salvando, setSalvando] = useState(false);

  // Detalhe completo (solicitação traz o link assinado do anexo).
  useEffect(() => {
    if (novo || !inicial?.id) return;
    let vivo = true;
    api<Row>(`${def.chave}/${inicial.id}`).then((r) => vivo && setValores((v) => ({ ...r, ...pendentes(v, inicial) })) ).catch(() => {});
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def.chave, inicial?.id]);

  const salvar = async () => {
    const corpo: Row = {};
    for (const c of def.campos) if (!c.leitura) corpo[c.col] = valores[c.col];
    setSalvando(true);
    try {
      const r = novo
        ? await api<Row>(def.chave, { method: 'POST', body: { ...corpo, ...(paiId ? { __pai: paiId } : {}) } })
        : await api<Row>(`${def.chave}/${inicial!.id}`, { method: 'PATCH', body: corpo });
      toast.success(novo ? `${cap(def.item)} criado(a)` : 'Alterações salvas');
      onSalvo(r);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const travado = !podeEditar && !novo;
  const idAtual = novo ? null : (inicial!.id as string);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onFechar}>
      <div className="w-full max-w-xl h-full bg-white dark:bg-slate-800 shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="flex-1 font-bold text-slate-800 dark:text-white">{novo ? `Novo(a) ${def.item}` : cap(def.item)}</h2>
          <button onClick={onFechar} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700" title="Fechar"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {def.campos.filter((c) => !(novo && c.leitura)).map((c) => (
            <Campo key={c.col} c={c} valor={valores[c.col]} valores={valores} pasta={def.chave} travado={travado}
              paiId={def.pai ? paiId : idAtual}
              onChange={(v) => setValores((s) => ({ ...s, [c.col]: v }))} />
          ))}
          {!novo && def.filhos?.map((f) => (
            <div key={f} className="pt-2 border-t border-slate-200 dark:border-slate-700">
              <MobileRecurso recurso={f} paiId={idAtual} compacto />
            </div>
          ))}
          {novo && def.filhos?.length ? (
            <p className="text-xs text-slate-400">Salve primeiro para cadastrar {def.filhos.map((f) => RECURSOS[f].titulo.toLowerCase()).join(' e ')}.</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 px-5 py-3 border-t border-slate-200 dark:border-slate-700">
          {!novo && def.excluir && podeExcluir && (
            <button onClick={() => onExcluir(inicial!)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20">
              <Trash2 className="w-4 h-4" /> Excluir
            </button>
          )}
          <div className="flex-1" />
          <button onClick={onFechar} className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">Fechar</button>
          {(novo || podeEditar) && def.campos.some((c) => !c.leitura) && (
            <button onClick={salvar} disabled={salvando} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-semibold">
              {salvando && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Mantém o que a pessoa já digitou se o detalhe chegar depois. */
function pendentes(atual: Row, inicial: Row): Row {
  return Object.fromEntries(Object.entries(atual).filter(([k, v]) => v !== inicial[k]));
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Filtro da lista: opções do campo, Sim/Não ou categorias cadastradas. */
function FiltroSelect({ c, valor, onChange }: { c: CampoDef; valor: string; onChange: (v: string) => void }) {
  const opcoesCat = useOpcoesRelacao(c, null);
  const opcoes: [string, string][] =
    c.tipo === 'bool' ? [['true', 'Sim'], ['false', 'Não']] : c.tipo === 'categoria' ? opcoesCat : c.opcoes ?? [];
  return (
    <select value={valor} onChange={(e) => onChange(e.target.value)} className={`${filtroCls} max-w-[190px]`} title={c.rotulo}>
      <option value="">{c.rotulo}: todos</option>
      {opcoes.map(([k, r]) => <option key={k} value={k}>{c.tipo === 'bool' ? `${c.rotulo}: ${r}` : r}</option>)}
    </select>
  );
}

// ── lista ──────────────────────────────────────────────────────────────────
export function MobileRecurso({ recurso, paiId = null, compacto = false }: { recurso: string; paiId?: string | null; compacto?: boolean }) {
  const def = RECURSOS[recurso];
  const { canView, canCreate, canEdit, canDelete } = usePermissions(perfilAtual());
  const colunas = useMemo(() => def.campos.filter((c) => c.lista), [def]);
  const camposFiltro = useMemo(() => (def.filtros ?? []).map((f) => def.campos.find((c) => c.col === f)).filter(Boolean) as CampoDef[], [def]);

  const [dados, setDados] = useState<Pagina<Row>>({ linhas: [], total: 0, pagina: 1, pageSize: 30 });
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [filtros, setFiltros] = useState<Record<string, string>>({});
  // Com data, a lista abre no mês corrente (1º ao último dia).
  const [mesIni, mesFim] = useMemo(() => mesCorrente(), []);
  const [de, setDe] = useState(def.data ? mesIni : '');
  const [ate, setAte] = useState(def.data ? mesFim : '');
  const filtrado = Object.values(filtros).some(Boolean) || !!buscaAplicada || (def.data ? de !== mesIni || ate !== mesFim : false);
  const [tamanho, setTamanho] = useState(30);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<Row | null | undefined>(undefined); // undefined = fechado, null = novo
  const [excluirAlvo, setExcluirAlvo] = useState<Row | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  // A consulta é função dos filtros; "carregando" é a consulta atual ainda
  // não ter voltado. O estado só muda quando a resposta chega.
  const consulta = useMemo(() => {
    const p = new URLSearchParams();
    if (compacto) p.set('tudo', '1'); else p.set('pagina', String(pagina));
    if (paiId) p.set('pai', paiId);
    if (!compacto) p.set('pageSize', String(tamanho));
    if (buscaAplicada) p.set('q', buscaAplicada);
    for (const [k, v] of Object.entries(filtros)) if (v) p.set(`f_${k}`, v);
    if (de) p.set('de', de);
    if (ate) p.set('ate', ate);
    return `${recurso}?${p}#${versao}`;
  }, [recurso, paiId, compacto, pagina, tamanho, buscaAplicada, filtros, de, ate, versao]);
  const [respondida, setRespondida] = useState<string | null>(null);
  const carregando = respondida !== consulta;
  const carregar = useCallback(() => setVersao((v) => v + 1), []);

  useEffect(() => {
    let vivo = true;
    api<Pagina<Row>>(consulta.split('#')[0])
      .then((d) => { if (vivo) { setDados(d); setErro(null); } })
      .catch((e) => { if (vivo) setErro((e as Error).message); })
      .finally(() => { if (vivo) setRespondida(consulta); });
    return () => { vivo = false; };
  }, [consulta]);

  if (!canView(def.permKey)) {
    return <p className="text-sm text-slate-500">Sem acesso a {def.titulo.toLowerCase()}.</p>;
  }

  const paginas = Math.max(1, Math.ceil(dados.total / dados.pageSize));
  const podeCriar = def.criar && canCreate(def.permKey) && (!def.pai || paiId);

  const excluir = async () => {
    if (!excluirAlvo) return;
    setExcluindo(true);
    try {
      await api(`${recurso}/${excluirAlvo.id}`, { method: 'DELETE' });
      toast.success('Excluído');
      setExcluirAlvo(null);
      setEditando(undefined);
      void carregar();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <div>
      {/* Uma linha só: busca, filtros, período e botões; em tela estreita rola para o lado. */}
      <div className={`flex items-center gap-2 ${compacto ? 'mb-2' : 'mb-3 overflow-x-auto pb-1'}`}>
        {compacto ? (
          <h3 className="flex-1 text-sm font-bold text-slate-700 dark:text-slate-200">{def.titulo} <span className="text-slate-400 font-normal">({dados.total})</span></h3>
        ) : (
          <>
            {def.busca?.length ? (
              <div className="relative shrink-0 w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar… (Enter)"
                  onKeyDown={(e) => { if (e.key === 'Enter') { setPagina(1); setBuscaAplicada(busca.trim()); } }}
                  className={`${filtroCls} w-full pl-9`} />
              </div>
            ) : null}
            {camposFiltro.map((c) => (
              <FiltroSelect key={c.col} c={c} valor={filtros[c.col] ?? ''}
                onChange={(v) => { setPagina(1); setFiltros((f) => ({ ...f, [c.col]: v })); }} />
            ))}
            {def.data && (
              <div className="flex items-center gap-1 text-xs text-slate-500 shrink-0">
                <span>De</span>
                <input type="date" value={de} onChange={(e) => { setPagina(1); setDe(e.target.value); }} className={filtroCls} />
                <span>até</span>
                <input type="date" value={ate} onChange={(e) => { setPagina(1); setAte(e.target.value); }} className={filtroCls} />
              </div>
            )}
            {filtrado && (
              <button type="button" onClick={() => { setFiltros({}); setDe(def.data ? mesIni : ''); setAte(def.data ? mesFim : ''); setBusca(''); setBuscaAplicada(''); setPagina(1); }}
                className="h-9 px-2.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 shrink-0 whitespace-nowrap">
                Limpar filtros
              </button>
            )}
            <div className="flex-1" />
          </>
        )}
        {podeCriar && (
          <button onClick={() => setEditando(null)}
            className={`flex items-center gap-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-semibold shrink-0 whitespace-nowrap ${compacto ? 'px-2.5 py-1 text-xs' : 'h-9 px-4 text-sm'}`}>
            <Plus className="w-4 h-4" /> {compacto ? 'Adicionar' : `Novo(a) ${def.item}`}
          </button>
        )}
      </div>

      {!compacto && def.aviso && (
        <div className="flex items-start gap-2 px-4 py-3 mb-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-purple-800 dark:text-purple-200 text-sm">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" /> {def.aviso}
        </div>
      )}
      {erro && (
        <div className="flex items-center gap-2 px-4 py-3 mb-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {erro}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-500">
            <tr>{colunas.map((c) => <th key={c.col} className="text-left font-semibold px-3 py-2 whitespace-nowrap">{c.rotulo}</th>)}</tr>
          </thead>
          <tbody>
            {carregando && dados.linhas.length === 0 ? (
              <tr><td colSpan={colunas.length} className="px-3 py-6 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
            ) : dados.linhas.length === 0 ? (
              <tr><td colSpan={colunas.length} className="px-3 py-6 text-center text-slate-400">{def.vazio ?? 'Nada cadastrado.'}</td></tr>
            ) : dados.linhas.map((r) => (
              <tr key={r.id} onClick={() => setEditando(r)} className="border-t border-slate-100 dark:border-slate-700 hover:bg-purple-50/50 dark:hover:bg-slate-700/40 cursor-pointer align-top">
                {colunas.map((c) => <td key={c.col} className="px-3 py-2">{celula(c, r[c.col], r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!compacto && (
        <div className="flex flex-wrap items-center justify-end gap-2 mt-3 text-sm text-slate-500">
          <span>{dados.total} {dados.total === 1 ? 'registro' : 'registros'} · página {Math.min(pagina, paginas)} de {paginas}</span>
          <select value={tamanho} onChange={(e) => { setPagina(1); setTamanho(Number(e.target.value)); }} className={filtroCls} title="Linhas por página">
            {[10, 20, 30, 50, 100].map((n) => <option key={n} value={n}>{n} por página</option>)}
          </select>
          <button disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
          <button disabled={pagina >= paginas} onClick={() => setPagina((p) => p + 1)} className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
        </div>
      )}

      {editando !== undefined && (
        <Editor key={editando?.id ?? 'novo'} def={def} inicial={editando} paiId={paiId} podeEditar={canEdit(def.permKey)} podeExcluir={canDelete(def.permKey)}
          onFechar={() => setEditando(undefined)}
          onSalvo={(r) => { setEditando(editando === null && def.filhos?.length ? r : undefined); void carregar(); }}
          onExcluir={setExcluirAlvo} />
      )}

      <ConfirmDialog open={!!excluirAlvo} title={`Excluir ${def.item}?`} variant="danger" loading={excluindo}
        message="Some do app na hora. Não dá para desfazer."
        confirmLabel="Excluir" onConfirm={excluir} onCancel={() => setExcluirAlvo(null)} />
    </div>
  );
}
