/**
 * Contas a Pagar — tela de gestão.
 *
 * Duas abas sobre o MESMO conjunto de filtros:
 *   1. Lançamentos — tabela com busca, filtros, dois modos de visão
 *      (por título e por parcela) e exportação.
 *   2. Relatórios  — os gráficos e o relatório de saldo residual.
 *
 * As agregações vêm prontas de /api/contas-pagar/relatorios: somar parcela a
 * parcela no navegador não escala num período longo.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Receipt, Plus, Search, RefreshCw, Download, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, BarChart3, List, Wallet, AlertTriangle,
  CheckCircle2, Clock, CircleDollarSign, Filter, X, ThumbsUp, Trash2, Eye,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { apiBase } from '../../lib/apiBase';
import { usePermissions } from '../../lib/usePermissions';
import { ConfirmDialog } from '../../components/app-ui/shared/ConfirmDialog';
import {
  STATUS_PARCELA_LABELS, STATUS_PARCELA_CORES, STATUS_PARCELA_HEX,
  STATUS_APROVACAO_LABELS, formatarBRL, NAO_INFORMADO,
} from '../../lib/contasPagarRules';
import { ContaPagarFormDrawer, rotuloComCodigo } from './ContaPagarFormDrawer';
import { ParcelaDetailModal } from './ParcelaDetailModal';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

const STATUS_OPCOES = ['PENDENTE', 'PARCIAL', 'ATRASADO', 'PAGO'] as const;

function perfilAtual(): string {
  try { return JSON.parse(localStorage.getItem('mrm_user') || '{}').profileType || 'church'; }
  catch { return 'church'; }
}

function inicioDoMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function fimDoMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}
function emDias(dias: number) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}
function dataBR(valor: string | null | undefined) {
  if (!valor) return '—';
  return new Date(`${String(valor).slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR');
}
function mesBR(mes: string) {
  const [ano, m] = String(mes).split('-');
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  return `${nomes[Number(m) - 1] ?? m}/${String(ano).slice(2)}`;
}
const num = (v: unknown) => Number(v ?? 0);

const PRESETS_VENCIMENTO = [
  { key: 'mes', label: 'Este mês', range: () => ({ de: inicioDoMes(), ate: fimDoMes() }) },
  { key: '30', label: '30 dias', range: () => ({ de: new Date().toISOString().slice(0, 10), ate: emDias(30) }) },
  { key: '60', label: '60 dias', range: () => ({ de: new Date().toISOString().slice(0, 10), ate: emDias(60) }) },
  { key: '90', label: '90 dias', range: () => ({ de: new Date().toISOString().slice(0, 10), ate: emDias(90) }) },
  { key: 'tudo', label: 'Tudo', range: () => ({ de: '', ate: '' }) },
];

export default function ContasPagar() {
  const perfil = perfilAtual();
  const { canCreate, canEdit, canDelete } = usePermissions(perfil);
  const token = localStorage.getItem('mrm_token');
  const authHeaders = useMemo<Record<string, string>>(
    () => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }),
    [token]
  );
  const storedUser = (() => { try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; } })();
  const campoAtivo = localStorage.getItem('mrm_active_field_id') || storedUser.campoId || '';

  const [aba, setAba] = useState<'lancamentos' | 'relatorios'>('lancamentos');
  const [visao, setVisao] = useState<'titulo' | 'parcela'>('parcela');

  // ── filtros (compartilhados pelas duas abas) ───────────────────────────────
  const [busca, setBusca] = useState('');
  const [regionalId, setRegionalId] = useState('');
  const [churchId, setChurchId] = useState('');
  const [credorId, setCredorId] = useState('');
  const [planoDeContaId, setPlanoDeContaId] = useState('');
  const [departamentoId, setDepartamentoId] = useState('');
  const [bancoId, setBancoId] = useState('');
  const [status, setStatus] = useState<string[]>([]);
  const [statusAprovacao, setStatusAprovacao] = useState('');
  const [vencimentoDe, setVencimentoDe] = useState('');
  const [vencimentoAte, setVencimentoAte] = useState('');
  const [presetVenc, setPresetVenc] = useState('tudo');
  const [valorMin, setValorMin] = useState('');
  const [valorMax, setValorMax] = useState('');
  const [soComSaldo, setSoComSaldo] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);

  // ── dados ──────────────────────────────────────────────────────────────────
  const [linhas, setLinhas] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [totais, setTotais] = useState<Row | null>(null);
  const [relatorios, setRelatorios] = useState<Row | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [carregandoRel, setCarregandoRel] = useState(false);
  const [erro, setErro] = useState('');
  const [pagina, setPagina] = useState(1);
  const pageSize = 25;

  const [igrejas, setIgrejas] = useState<Row[]>([]);
  const [credores, setCredores] = useState<Row[]>([]);
  // Classificação da despesa: vem do PLANO DE CONTAS que a igreja já usa no
  // Livro Caixa — não existe cadastro paralelo de "tipos de despesa".
  const [planosDespesa, setPlanosDespesa] = useState<Row[]>([]);
  const [departamentos, setDepartamentos] = useState<Row[]>([]);
  const [bancos, setBancos] = useState<Row[]>([]);

  const [drawer, setDrawer] = useState<{ aberto: boolean; contaId: string | null }>({ aberto: false, contaId: null });
  const [parcelaAberta, setParcelaAberta] = useState<string | null>(null);
  const [contaExpandida, setContaExpandida] = useState<string | null>(null);
  const [cancelarAlvo, setCancelarAlvo] = useState<Row | null>(null);
  const [cancelando, setCancelando] = useState(false);

  // ── carga das listas auxiliares ────────────────────────────────────────────
  // Exposta como callback porque a aba Cadastros chama de volta ao criar um
  // credor: o dropdown do lançamento precisa vê-lo sem recarregar a página.
  const recarregarAuxiliares = useCallback(async () => {
    const escopo = campoAtivo ? `?fieldId=${encodeURIComponent(campoAtivo)}` : '';
    const pega = async (url: string) => {
      try {
        const r = await fetch(url, { headers: authHeaders });
        if (!r.ok) return [];
        const j = await r.json();
        return Array.isArray(j) ? j : (j.data ?? []);
      } catch { return []; }
    };
    const [ig, cr, pl, dp, bc] = await Promise.all([
      pega(`${apiBase}/churches${escopo}`),
      pega(`${apiBase}/credores?ativo=1`),
      pega(`${apiBase}/lookups/chart-of-accounts`),
      pega(`${apiBase}/lookups/departamentos`),
      pega(`${apiBase}/lookups/bancos`),
    ]);
    setIgrejas(ig);
    setCredores(cr);
    setPlanosDespesa(pl.filter((x: Row) => x.tipo === 'DESPESA' && x.ativo !== false));
    setDepartamentos(dp.filter((d: Row) => d.ativo !== false));
    setBancos(bc.filter((b: Row) => b.ativo !== false));
  }, [authHeaders, campoAtivo]);

  useEffect(() => { void recarregarAuxiliares(); }, [recarregarAuxiliares]);

  // ── query string comum ─────────────────────────────────────────────────────
  const params = useCallback(() => {
    const p = new URLSearchParams();
    if (busca) p.set('q', busca);
    if (churchId) p.set('churchId', churchId);
    else if (regionalId) p.set('regionalId', regionalId);
    else if (campoAtivo) p.set('campoId', campoAtivo);
    if (credorId) p.set('credorId', credorId);
    if (planoDeContaId) p.set('planoDeContaId', planoDeContaId);
    if (departamentoId) p.set('departamentoId', departamentoId);
    if (bancoId) p.set('bancoId', bancoId);
    if (status.length) p.set('status', status.join(','));
    if (statusAprovacao) p.set('statusAprovacao', statusAprovacao);
    if (vencimentoDe) p.set('vencimentoDe', vencimentoDe);
    if (vencimentoAte) p.set('vencimentoAte', vencimentoAte);
    if (valorMin) p.set('valorMin', valorMin);
    if (valorMax) p.set('valorMax', valorMax);
    if (soComSaldo) p.set('comSaldo', '1');
    return p;
  }, [busca, churchId, regionalId, campoAtivo, credorId, planoDeContaId, departamentoId,
      bancoId, status, statusAprovacao, vencimentoDe, vencimentoAte, valorMin, valorMax, soComSaldo]);

  const carregarLista = useCallback(async (p = 1) => {
    setCarregando(true);
    setErro('');
    try {
      const qs = params();
      qs.set('page', String(p));
      qs.set('pageSize', String(pageSize));
      const rota = visao === 'parcela' ? 'contas-pagar/parcelas' : 'contas-pagar';
      const res = await fetch(`${apiBase}/${rota}?${qs}`, { headers: authHeaders });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || `Erro ${res.status}`);
      }
      const json = await res.json();
      setLinhas(json.data ?? []);
      setTotal(json.total ?? 0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setErro(e.message || 'Falha ao carregar as contas a pagar.');
      setLinhas([]);
      setTotal(0);
    } finally {
      setCarregando(false);
    }
  }, [authHeaders, params, visao]);

  const carregarRelatorios = useCallback(async () => {
    setCarregandoRel(true);
    try {
      const res = await fetch(`${apiBase}/contas-pagar/relatorios?${params()}`, { headers: authHeaders });
      if (!res.ok) throw new Error('Falha ao carregar relatórios.');
      const json = await res.json();
      setRelatorios(json);
      setTotais(json.totais);
    } catch {
      setRelatorios(null);
    } finally {
      setCarregandoRel(false);
    }
  }, [authHeaders, params]);

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      setPagina(1);
      carregarLista(1);
      carregarRelatorios();
    }, 350);
    return () => { if (debounce.current) clearTimeout(debounce.current); };
  }, [carregarLista, carregarRelatorios]);

  // Só a troca de página recarrega aqui: mudança de filtro já é tratada pelo
  // efeito com debounce acima, e incluir `carregarLista` nas dependências
  // faria as duas cargas dispararem juntas a cada tecla digitada.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { carregarLista(pagina); }, [pagina]);

  const recarregar = () => { carregarLista(pagina); carregarRelatorios(); };

  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));

  const regionais = useMemo(
    () => Array.from(new Map(igrejas.filter((c) => c.regional).map((c) => [c.regional.id, c.regional.name])).entries()),
    [igrejas]
  );
  const igrejasFiltradas = regionalId ? igrejas.filter((c) => c.regional?.id === regionalId) : igrejas;

  function alternarStatus(valor: string) {
    setStatus((atual) => (atual.includes(valor) ? atual.filter((s) => s !== valor) : [...atual, valor]));
  }

  function aplicarPreset(key: string) {
    const preset = PRESETS_VENCIMENTO.find((p) => p.key === key);
    if (!preset) return;
    const { de, ate } = preset.range();
    setPresetVenc(key);
    setVencimentoDe(de);
    setVencimentoAte(ate);
  }

  function limparFiltros() {
    setBusca(''); setRegionalId(''); setChurchId(''); setCredorId(''); setPlanoDeContaId('');
    setDepartamentoId(''); setBancoId(''); setStatus([]); setStatusAprovacao('');
    setVencimentoDe(''); setVencimentoAte(''); setPresetVenc('tudo');
    setValorMin(''); setValorMax(''); setSoComSaldo(false);
  }

  const filtrosAtivos = [
    busca, regionalId, churchId, credorId, planoDeContaId, departamentoId, bancoId,
    statusAprovacao, vencimentoDe, vencimentoAte, valorMin, valorMax,
  ].filter(Boolean).length + status.length + (soComSaldo ? 1 : 0);

  async function aprovar(contaId: string, aprovado: boolean) {
    const motivo = aprovado ? '' : window.prompt('Motivo da reprovação:') || '';
    if (!aprovado && !motivo.trim()) return;
    const res = await fetch(`${apiBase}/contas-pagar/${contaId}/aprovar`, {
      method: 'POST', headers: authHeaders, body: JSON.stringify({ aprovado, motivo }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(json.error || 'Falha ao registrar a aprovação.'); return; }
    toast.success(aprovado ? 'Conta aprovada.' : 'Conta reprovada.');
    recarregar();
  }

  async function confirmarCancelamento() {
    if (!cancelarAlvo) return;
    setCancelando(true);
    try {
      const res = await fetch(`${apiBase}/contas-pagar/${cancelarAlvo.id}`, { method: 'DELETE', headers: authHeaders });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Falha ao cancelar.');
      toast.success('Conta cancelada.');
      setCancelarAlvo(null);
      recarregar();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCancelando(false);
    }
  }

  function exportarExcel() {
    if (!linhas.length) { toast.error('Nada para exportar com os filtros atuais.'); return; }
    const dados = visao === 'parcela'
      ? linhas.map((p, i) => ({
          '#': i + 1,
          'Conta': p.contaPagar?.numero ?? '',
          'Descrição': p.contaPagar?.descricao ?? '',
          'Credor': p.contaPagar?.credor?.nome ?? '',
          'Plano de contas': p.contaPagar?.planoDeConta?.nome ?? NAO_INFORMADO,
          'Departamento': p.contaPagar?.departamento?.nome ?? NAO_INFORMADO,
          'Banco': p.contaPagar?.banco?.nome ?? NAO_INFORMADO,
          'Parcela': `${p.numeroParcela}/${p.totalParcelas}`,
          'Vencimento': dataBR(p.dataVencimento),
          'Valor (R$)': num(p.valorParcela),
          'Pago (R$)': num(p.valorPago),
          'Saldo (R$)': num(p.valorSaldo),
          'Status': STATUS_PARCELA_LABELS[p.status] ?? p.status,
          'Igreja': p.church?.name ?? '',
        }))
      : linhas.map((c, i) => ({
          '#': i + 1,
          'Conta': c.numero,
          'Descrição': c.descricao,
          'Credor': c.credor?.nome ?? '',
          'Plano de contas': c.planoDeConta?.nome ?? NAO_INFORMADO,
          'Departamento': c.departamento?.nome ?? NAO_INFORMADO,
          'Banco': c.banco?.nome ?? NAO_INFORMADO,
          'Emissão': dataBR(c.dataEmissao),
          'Parcelas': c.numeroParcelas,
          'Valor total (R$)': num(c.valorTotal),
          'Status': STATUS_PARCELA_LABELS[c.statusGeral] ?? c.statusGeral,
          'Aprovação': STATUS_APROVACAO_LABELS[c.statusAprovacao] ?? c.statusAprovacao,
          'Igreja': c.church?.name ?? '',
        }));

    const ws = XLSX.utils.json_to_sheet(dados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contas a Pagar');
    XLSX.writeFile(wb, `contas-a-pagar_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const kpis = [
    { label: 'Total no período', valor: num(totais?.total), icone: CircleDollarSign, cor: 'text-slate-600', fundo: 'bg-slate-100 dark:bg-slate-800' },
    { label: 'Já pago', valor: num(totais?.pago), icone: CheckCircle2, cor: 'text-emerald-600', fundo: 'bg-emerald-100 dark:bg-emerald-900/30' },
    { label: 'Em aberto', valor: num(totais?.saldo), icone: Clock, cor: 'text-blue-600', fundo: 'bg-blue-100 dark:bg-blue-900/30' },
    { label: 'Vencido', valor: num(totais?.vencido), icone: AlertTriangle, cor: 'text-red-600', fundo: 'bg-red-100 dark:bg-red-900/30' },
    { label: 'Saldo residual', valor: num(totais?.saldo_residual), icone: Wallet, cor: 'text-amber-600', fundo: 'bg-amber-100 dark:bg-amber-900/30' },
  ];

  const inputCls = 'px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white';

  return (
    <div className="p-6 text-slate-900 dark:text-slate-100">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-rose-100 dark:bg-rose-900/30 rounded-xl flex items-center justify-center">
            <Receipt className="w-6 h-6 text-rose-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Contas a Pagar</h1>
            <p className="text-slate-600 dark:text-slate-400">Lançamento, parcelas, pagamento parcial e prestação de contas</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={recarregar} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium">
            <RefreshCw className="w-4 h-4" /> Atualizar
          </button>
          <button onClick={exportarExcel} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium">
            <Download className="w-4 h-4" /> Exportar
          </button>
          {canCreate('contas_pagar') && (
            <button onClick={() => setDrawer({ aberto: true, contaId: null })} className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 text-sm font-medium">
              <Plus className="w-4 h-4" /> Nova Conta
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${k.fundo}`}>
                <k.icone className={`w-4 h-4 ${k.cor}`} />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{k.label}</span>
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white">{formatarBRL(k.valor)}</div>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div className="flex items-center gap-1 mb-4 border-b border-slate-200 dark:border-slate-700">
        {([
          { key: 'lancamentos', label: 'Lançamentos', icone: List },
          { key: 'relatorios', label: 'Relatórios', icone: BarChart3 },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setAba(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              aba === t.key
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <t.icone className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por descrição, número da conta, credor ou documento..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            />
          </div>
          <button
            onClick={() => setFiltrosAbertos((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border ${
              filtrosAtivos ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-300' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'
            }`}
          >
            <Filter className="w-4 h-4" /> Filtros{filtrosAtivos ? ` (${filtrosAtivos})` : ''}
          </button>
          {filtrosAtivos > 0 && (
            <button onClick={limparFiltros} className="flex items-center gap-1 px-3 py-2.5 text-sm text-slate-500 hover:text-slate-700">
              <X className="w-4 h-4" /> Limpar
            </button>
          )}
        </div>

        {/* Status: sempre visível — é o filtro mais usado */}
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_OPCOES.map((s) => (
            <button
              key={s}
              onClick={() => alternarStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                status.includes(s)
                  ? 'bg-rose-600 border-rose-600 text-white'
                  : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'
              }`}
            >
              {STATUS_PARCELA_LABELS[s]}
            </button>
          ))}
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" />
          {PRESETS_VENCIMENTO.map((p) => (
            <button
              key={p.key}
              onClick={() => aplicarPreset(p.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                presetVenc === p.key
                  ? 'bg-slate-800 border-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                  : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300'
              }`}
            >
              {p.label}
            </button>
          ))}
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 ml-1">
            <input type="checkbox" checked={soComSaldo} onChange={(e) => setSoComSaldo(e.target.checked)} />
            Só com saldo residual
          </label>
        </div>

        {filtrosAbertos && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
            <select value={regionalId} onChange={(e) => { setRegionalId(e.target.value); setChurchId(''); }} className={inputCls}>
              <option value="">Todas as regionais</option>
              {regionais.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
            </select>
            <select value={churchId} onChange={(e) => setChurchId(e.target.value)} className={inputCls}>
              <option value="">{regionalId ? 'Todas desta regional' : 'Todas as igrejas'}</option>
              {igrejasFiltradas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={credorId} onChange={(e) => setCredorId(e.target.value)} className={inputCls}>
              <option value="">Todos os credores</option>
              {credores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <select value={planoDeContaId} onChange={(e) => setPlanoDeContaId(e.target.value)} className={inputCls}>
              <option value="">Todo o plano de contas</option>
              {planosDespesa.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
            <select value={departamentoId} onChange={(e) => setDepartamentoId(e.target.value)} className={inputCls}>
              <option value="">Todos os departamentos</option>
              <option value="sem">{NAO_INFORMADO}</option>
              {departamentos.map((d) => <option key={d.id} value={d.id}>{rotuloComCodigo(d)}</option>)}
            </select>
            <select value={bancoId} onChange={(e) => setBancoId(e.target.value)} className={inputCls}>
              <option value="">Todos os bancos</option>
              <option value="sem">{NAO_INFORMADO}</option>
              {bancos.map((b) => <option key={b.id} value={b.id}>{rotuloComCodigo(b)}</option>)}
            </select>
            <select value={statusAprovacao} onChange={(e) => setStatusAprovacao(e.target.value)} className={inputCls}>
              <option value="">Qualquer aprovação</option>
              {Object.entries(STATUS_APROVACAO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <div className="flex items-center gap-1">
              <input type="date" value={vencimentoDe} onChange={(e) => { setVencimentoDe(e.target.value); setPresetVenc(''); }} className={`${inputCls} w-full`} />
              <span className="text-xs text-slate-500">até</span>
              <input type="date" value={vencimentoAte} onChange={(e) => { setVencimentoAte(e.target.value); setPresetVenc(''); }} className={`${inputCls} w-full`} />
            </div>
            <div className="flex items-center gap-1">
              <input type="number" placeholder="Valor mín." value={valorMin} onChange={(e) => setValorMin(e.target.value)} className={`${inputCls} w-full`} />
              <input type="number" placeholder="Valor máx." value={valorMax} onChange={(e) => setValorMax(e.target.value)} className={`${inputCls} w-full`} />
            </div>
          </div>
        )}
      </div>

      {erro && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-lg text-sm flex items-center justify-between">
          <span>{erro}</span>
          <button onClick={recarregar} className="flex items-center gap-1 font-medium"><RefreshCw className="w-4 h-4" /> Tentar novamente</button>
        </div>
      )}

      {aba === 'lancamentos' ? (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              {([
                { key: 'parcela', label: 'Por parcela' },
                { key: 'titulo', label: 'Por conta' },
              ] as const).map((v) => (
                <button
                  key={v.key}
                  onClick={() => { setVisao(v.key); setPagina(1); }}
                  className={`px-4 py-2 text-sm font-medium ${visao === v.key ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <span className="text-sm text-slate-500">{total} registro(s)</span>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
            {carregando ? (
              <div className="py-16 text-center text-slate-500">Carregando...</div>
            ) : !linhas.length ? (
              <div className="py-16 text-center text-slate-400">Nenhuma conta a pagar encontrada com estes filtros.</div>
            ) : visao === 'parcela' ? (
              <TabelaParcelas linhas={linhas} onAbrir={setParcelaAberta} />
            ) : (
              <TabelaContas
                linhas={linhas}
                expandida={contaExpandida}
                onExpandir={(id) => setContaExpandida((a) => (a === id ? null : id))}
                onAbrirParcela={setParcelaAberta}
                onEditar={canEdit('contas_pagar') ? (id) => setDrawer({ aberto: true, contaId: id }) : undefined}
                onCancelar={canDelete('contas_pagar') ? setCancelarAlvo : undefined}
                onAprovar={aprovar}
              />
            )}
          </div>

          {total > pageSize && (
            <div className="flex items-center justify-between mt-4 px-1">
              <span className="text-sm text-slate-500">
                {(pagina - 1) * pageSize + 1}–{Math.min(pagina * pageSize, total)} de {total}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPagina(1)} disabled={pagina === 1} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"><ChevronsLeft className="w-4 h-4" /></button>
                <button onClick={() => setPagina((p) => Math.max(1, p - 1))} disabled={pagina === 1} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
                <span className="px-3 py-1 text-sm font-medium">{pagina} / {totalPaginas}</span>
                <button onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
                <button onClick={() => setPagina(totalPaginas)} disabled={pagina === totalPaginas} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"><ChevronsRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </>
      ) : (
        <AbaRelatorios dados={relatorios} carregando={carregandoRel} onAbrirParcela={setParcelaAberta} />
      )}

      {drawer.aberto && (
        <ContaPagarFormDrawer
          contaId={drawer.contaId}
          credores={credores}
          planosDespesa={planosDespesa}
          departamentos={departamentos}
          bancos={bancos}
          igrejas={igrejas}
          onFechar={() => setDrawer({ aberto: false, contaId: null })}
          onCredorCriado={recarregarAuxiliares}
          onSalvo={() => { setDrawer({ aberto: false, contaId: null }); recarregar(); }}
        />
      )}

      {parcelaAberta && (
        <ParcelaDetailModal
          parcelaId={parcelaAberta}
          bancos={bancos}
          onFechar={() => setParcelaAberta(null)}
          onMudou={recarregar}
        />
      )}

      <ConfirmDialog
        open={Boolean(cancelarAlvo)}
        title="Cancelar conta a pagar"
        message={`Cancelar a conta ${cancelarAlvo?.numero ?? ''}? As parcelas em aberto serão canceladas junto.`}
        confirmLabel="Cancelar conta"
        variant="danger"
        loading={cancelando}
        onConfirm={confirmarCancelamento}
        onCancel={() => (cancelando ? null : setCancelarAlvo(null))}
      />
    </div>
  );
}

// ─── tabelas ─────────────────────────────────────────────────────────────────

function Badge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${STATUS_PARCELA_CORES[status] ?? 'bg-slate-100 text-slate-700'}`}>
      {STATUS_PARCELA_LABELS[status] ?? status}
    </span>
  );
}

const thCls = 'px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase whitespace-nowrap';
const tdCls = 'px-4 py-3 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap';

function TabelaParcelas({ linhas, onAbrir }: { linhas: Row[]; onAbrir: (id: string) => void }) {
  return (
    <table className="w-full">
      <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <tr>
          <th className={thCls}>Vencimento</th>
          <th className={thCls}>Conta</th>
          <th className={thCls}>Credor</th>
          <th className={thCls}>Plano de contas</th>
          <th className={thCls}>Departamento</th>
          <th className={thCls}>Parcela</th>
          <th className={`${thCls} text-right`}>Valor</th>
          <th className={`${thCls} text-right`}>Pago</th>
          <th className={`${thCls} text-right`}>Saldo</th>
          <th className={thCls}>Status</th>
          <th className={thCls}>Ações</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
        {linhas.map((p) => (
          <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
            <td className={tdCls}>{dataBR(p.dataVencimento)}</td>
            <td className={tdCls}>
              <div className="font-medium text-slate-900 dark:text-slate-100">{p.contaPagar?.numero}</div>
              <div className="text-xs text-slate-500 max-w-[220px] truncate">{p.contaPagar?.descricao}</div>
            </td>
            <td className={tdCls}>{p.contaPagar?.credor?.nome ?? '—'}</td>
            <td className={tdCls}>{p.contaPagar?.planoDeConta?.nome ?? NAO_INFORMADO}</td>
            <td className={tdCls}>{p.contaPagar?.departamento?.nome ?? NAO_INFORMADO}</td>
            <td className={tdCls}>{p.numeroParcela}/{p.totalParcelas}</td>
            <td className={`${tdCls} text-right`}>{formatarBRL(p.valorParcela)}</td>
            <td className={`${tdCls} text-right text-emerald-600`}>{formatarBRL(p.valorPago)}</td>
            <td className={`${tdCls} text-right font-semibold`}>{formatarBRL(p.valorSaldo)}</td>
            <td className={tdCls}><Badge status={p.status} /></td>
            <td className={tdCls}>
              <button onClick={() => onAbrir(p.id)} className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700">
                Abrir
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TabelaContas({
  linhas, expandida, onExpandir, onAbrirParcela, onEditar, onCancelar, onAprovar,
}: {
  linhas: Row[];
  expandida: string | null;
  onExpandir: (id: string) => void;
  onAbrirParcela: (id: string) => void;
  onEditar?: (id: string) => void;
  onCancelar?: (conta: Row) => void;
  onAprovar: (id: string, aprovado: boolean) => void;
}) {
  return (
    <table className="w-full">
      <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <tr>
          <th className={thCls}>Conta</th>
          <th className={thCls}>Credor</th>
          <th className={thCls}>Tipo</th>
          <th className={thCls}>Departamento</th>
          <th className={thCls}>Emissão</th>
          <th className={thCls}>Parcelas</th>
          <th className={`${thCls} text-right`}>Total</th>
          <th className={thCls}>Status</th>
          <th className={thCls}>Aprovação</th>
          <th className={thCls}>Ações</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
        {linhas.map((c) => {
          const pago = (c.parcelas ?? []).reduce((s: number, p: Row) => s + num(p.valorPago), 0);
          const progresso = num(c.valorTotal) ? Math.min(100, (pago / num(c.valorTotal)) * 100) : 0;
          return (
            <>
              <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <td className={tdCls}>
                  <button onClick={() => onExpandir(c.id)} className="text-left">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{c.numero}</div>
                    <div className="text-xs text-slate-500 max-w-[240px] truncate">{c.descricao}</div>
                  </button>
                </td>
                <td className={tdCls}>{c.credor?.nome ?? '—'}</td>
                <td className={tdCls}>{c.planoDeConta?.nome ?? NAO_INFORMADO}</td>
                <td className={tdCls}>{c.departamento?.nome ?? NAO_INFORMADO}</td>
                <td className={tdCls}>{dataBR(c.dataEmissao)}</td>
                <td className={tdCls}>
                  <div className="flex items-center gap-2">
                    <span>{c.numeroParcelas}x</span>
                    <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${progresso}%` }} />
                    </div>
                  </div>
                </td>
                <td className={`${tdCls} text-right font-semibold`}>{formatarBRL(c.valorTotal)}</td>
                <td className={tdCls}><Badge status={c.statusGeral} /></td>
                <td className={tdCls}>
                  <span className="text-xs">{STATUS_APROVACAO_LABELS[c.statusAprovacao] ?? c.statusAprovacao}</span>
                </td>
                <td className={tdCls}>
                  <div className="flex items-center gap-1">
                    <button onClick={() => onExpandir(c.id)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Ver parcelas">
                      <Eye className="w-4 h-4 text-slate-500" />
                    </button>
                    {c.statusAprovacao === 'AGUARDANDO' && (
                      <button onClick={() => onAprovar(c.id, true)} className="p-1.5 rounded-lg hover:bg-emerald-100" title="Aprovar">
                        <ThumbsUp className="w-4 h-4 text-emerald-600" />
                      </button>
                    )}
                    {onEditar && (
                      <button onClick={() => onEditar(c.id)} className="px-2 py-1 rounded-lg text-xs font-semibold hover:bg-blue-100 text-blue-600">Editar</button>
                    )}
                    {onCancelar && (
                      <button onClick={() => onCancelar(c)} className="p-1.5 rounded-lg hover:bg-red-100" title="Cancelar">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
              {expandida === c.id && (
                <tr key={`${c.id}-parcelas`} className="bg-slate-50 dark:bg-slate-800/40">
                  <td colSpan={10} className="px-6 py-3">
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {(c.parcelas ?? []).map((p: Row) => (
                        <button
                          key={p.id}
                          onClick={() => onAbrirParcela(p.id)}
                          className="text-left rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 hover:border-rose-300"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-slate-500">Parcela {p.numeroParcela}/{p.totalParcelas}</span>
                            <Badge status={p.status} />
                          </div>
                          <div className="text-sm font-semibold">{formatarBRL(p.valorParcela)}</div>
                          <div className="text-xs text-slate-500">
                            Vence {dataBR(p.dataVencimento)} · pago {formatarBRL(p.valorPago)} · saldo {formatarBRL(p.valorSaldo)}
                          </div>
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
            </>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── aba 2 ───────────────────────────────────────────────────────────────────

function Painel({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{titulo}</h3>
        {subtitulo && <p className="text-xs text-slate-500">{subtitulo}</p>}
      </div>
      {children}
    </div>
  );
}

const CORES_GRAFICO = ['#e11d48', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#14b8a6', '#f97316', '#64748b'];

function AbaRelatorios({
  dados, carregando, onAbrirParcela,
}: { dados: Row | null; carregando: boolean; onAbrirParcela: (id: string) => void }) {
  if (carregando) return <div className="py-16 text-center text-slate-500">Calculando relatórios...</div>;
  if (!dados) return <div className="py-16 text-center text-slate-400">Sem dados para os filtros atuais.</div>;

  const porStatus = (dados.porStatus ?? []).map((s: Row) => ({
    nome: STATUS_PARCELA_LABELS[s.status] ?? s.status,
    valor: num(s.valor),
    cor: STATUS_PARCELA_HEX[s.status] ?? '#64748b',
  }));
  const porTipo = (dados.porTipoDespesa ?? []).map((t: Row) => ({ nome: t.nome, valor: num(t.valor), saldo: num(t.saldo) }));
  const porDepto = (dados.porDepartamento ?? []).map((d: Row) => ({ nome: d.nome, valor: num(d.valor), saldo: num(d.saldo), cor: d.cor }));
  const projecao = (dados.projecao ?? []).map((p: Row) => ({ mes: mesBR(p.mes), Vencido: num(p.vencido), 'A vencer': num(p.a_vencer) }));
  const evolucao = (dados.evolucaoMensal ?? []).map((e: Row) => ({ mes: mesBR(e.mes), Previsto: num(e.previsto), Pago: num(e.pago) }));
  const residual = dados.saldoResidual ?? [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tooltipBRL = (v: any) => formatarBRL(v);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Painel titulo="Por status" subtitulo="Onde está o dinheiro das parcelas do período">
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={porStatus} dataKey="valor" nameKey="nome" innerRadius={60} outerRadius={100} paddingAngle={2}>
              {porStatus.map((s: Row, i: number) => <Cell key={i} fill={s.cor} />)}
            </Pie>
            <Tooltip formatter={tooltipBRL} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </Painel>

      <Painel titulo="Por plano de contas" subtitulo="Quanto vai para luz, água, aluguel, missões...">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={porTipo} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="nome" width={140} tick={{ fontSize: 11 }} />
            <Tooltip formatter={tooltipBRL} />
            <Bar dataKey="valor" name="Total" fill="#e11d48" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Painel>

      <Painel titulo="Por departamento" subtitulo={`Missões, campanhas, obra. "${NAO_INFORMADO}" = lançado antes do cadastro de departamentos`}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={porDepto} layout="vertical" margin={{ left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
            <YAxis type="category" dataKey="nome" width={140} tick={{ fontSize: 11 }} />
            <Tooltip formatter={tooltipBRL} />
            <Bar dataKey="valor" name="Total" radius={[0, 4, 4, 0]}>
              {porDepto.map((d: Row, i: number) => <Cell key={i} fill={d.cor || CORES_GRAFICO[i % CORES_GRAFICO.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Painel>

      <Painel titulo="Fluxo projetado" subtitulo="Saldo devedor por mês de vencimento">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={projecao}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={tooltipBRL} />
            <Legend />
            <Bar dataKey="Vencido" stackId="a" fill="#ef4444" />
            <Bar dataKey="A vencer" stackId="a" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Painel>

      <Painel titulo="Previsto × pago" subtitulo="Evolução mensal">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={evolucao}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={tooltipBRL} />
            <Legend />
            <Line type="monotone" dataKey="Previsto" stroke="#64748b" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Pago" stroke="#10b981" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Painel>

      <Painel
        titulo="Saldo residual em aberto"
        subtitulo="Parcelas pagas em parte que ainda devem — ordenadas pelo tempo em aberto"
      >
        {!residual.length ? (
          <div className="py-10 text-center text-sm text-slate-400">Nenhuma parcela com saldo residual.</div>
        ) : (
          <div className="max-h-[260px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 text-left">Credor / conta</th>
                  <th className="py-2 text-right">Saldo</th>
                  <th className="py-2 text-right">Dias</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {residual.map((r: Row) => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer" onClick={() => onAbrirParcela(r.id)}>
                    <td className="py-2">
                      <div className="font-medium">{r.credor_nome ?? '—'}</div>
                      <div className="text-xs text-slate-500">
                        {r.conta_numero} · parcela {r.numero_parcela}/{r.total_parcelas} · vence {dataBR(r.data_vencimento)}
                      </div>
                    </td>
                    <td className="py-2 text-right font-semibold text-amber-600">{formatarBRL(r.valor_saldo)}</td>
                    <td className="py-2 text-right">{Math.max(0, Number(r.dias_em_aberto ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>
    </div>
  );
}
