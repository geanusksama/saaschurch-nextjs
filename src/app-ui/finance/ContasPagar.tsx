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
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Receipt, Plus, Search, RefreshCw, Download, ChevronLeft, ChevronRight,
  ChevronsLeft, ChevronsRight, BarChart3, List, Wallet, AlertTriangle,
  CheckCircle2, Clock, CircleDollarSign, Filter, X, ThumbsUp, Trash2, Eye, Printer,
  ArrowUp, ArrowDown, ArrowUpDown,
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
import { PrintModal } from '../../components/app-ui/shared/PrintModal';
import { printReport, type PrintOrientation } from '../../lib/printReport';
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

const TAMANHOS_PAGINA = [10, 25, 50, 100] as const;

/** Ordenação inicial de cada visão — as chaves que a API aceita em cada rota. */
const ORDEM_PADRAO = {
  titulo: { by: 'dataEmissao', dir: 'desc' as const },
  parcela: { by: 'dataVencimento', dir: 'asc' as const },
};

// ─── impressão ───────────────────────────────────────────────────────────────
// Cada visão tem seu conjunto de campos: o usuário escolhe no modal quais
// viram coluna do PDF e, opcionalmente, por qual deles agrupar.

type CampoImpressao = {
  key: string;
  label: string;
  valor: (r: Row) => string;
  /** Só quando ordenar pelo texto impresso daria errado (datas, valores). */
  ordem?: (r: Row) => string | number;
  /** Vem desmarcado no modal. */
  opcional?: boolean;
};

const CAMPOS_PARCELA: CampoImpressao[] = [
  { key: 'vencimento', label: 'Vencimento', valor: (p) => dataBR(p.dataVencimento), ordem: (p) => String(p.dataVencimento ?? '') },
  { key: 'numero', label: 'Conta', valor: (p) => p.contaPagar?.numero ?? '—' },
  { key: 'descricao', label: 'Descrição', valor: (p) => p.contaPagar?.descricao ?? '—' },
  { key: 'credor', label: 'Credor', valor: (p) => p.contaPagar?.credor?.nome ?? '—' },
  { key: 'plano', label: 'Plano de contas', valor: (p) => p.contaPagar?.planoDeConta?.nome ?? NAO_INFORMADO },
  { key: 'departamento', label: 'Departamento', valor: (p) => p.contaPagar?.departamento?.nome ?? NAO_INFORMADO },
  { key: 'banco', label: 'Banco', valor: (p) => p.contaPagar?.banco?.nome ?? NAO_INFORMADO, opcional: true },
  { key: 'documento', label: 'Documento', valor: (p) => p.contaPagar?.numeroDocumento ?? '—', opcional: true },
  { key: 'parcela', label: 'Parcela', valor: (p) => `${p.numeroParcela}/${p.totalParcelas}` },
  { key: 'valor', label: 'Valor', valor: (p) => formatarBRL(p.valorParcela), ordem: (p) => num(p.valorParcela) },
  { key: 'pago', label: 'Pago', valor: (p) => formatarBRL(p.valorPago), ordem: (p) => num(p.valorPago) },
  { key: 'saldo', label: 'Saldo', valor: (p) => formatarBRL(p.valorSaldo), ordem: (p) => num(p.valorSaldo) },
  { key: 'status', label: 'Status', valor: (p) => STATUS_PARCELA_LABELS[p.status] ?? p.status },
  { key: 'igreja', label: 'Igreja', valor: (p) => p.church?.name ?? '—', opcional: true },
];

const CAMPOS_TITULO: CampoImpressao[] = [
  { key: 'numero', label: 'Conta', valor: (c) => c.numero ?? '—' },
  { key: 'descricao', label: 'Descrição', valor: (c) => c.descricao ?? '—' },
  { key: 'credor', label: 'Credor', valor: (c) => c.credor?.nome ?? '—' },
  { key: 'plano', label: 'Plano de contas', valor: (c) => c.planoDeConta?.nome ?? NAO_INFORMADO },
  { key: 'departamento', label: 'Departamento', valor: (c) => c.departamento?.nome ?? NAO_INFORMADO },
  { key: 'banco', label: 'Banco', valor: (c) => c.banco?.nome ?? NAO_INFORMADO, opcional: true },
  { key: 'documento', label: 'Documento', valor: (c) => c.numeroDocumento ?? '—', opcional: true },
  { key: 'emissao', label: 'Emissão', valor: (c) => dataBR(c.dataEmissao), ordem: (c) => String(c.dataEmissao ?? '') },
  { key: 'parcelas', label: 'Parcelas', valor: (c) => String(c.numeroParcelas ?? 1), ordem: (c) => num(c.numeroParcelas) },
  { key: 'valor', label: 'Valor total', valor: (c) => formatarBRL(c.valorTotal), ordem: (c) => num(c.valorTotal) },
  { key: 'pago', label: 'Pago', valor: (c) => formatarBRL(somaParcelas(c, 'valorPago')), ordem: (c) => somaParcelas(c, 'valorPago') },
  { key: 'saldo', label: 'Saldo', valor: (c) => formatarBRL(somaParcelas(c, 'valorSaldo')), ordem: (c) => somaParcelas(c, 'valorSaldo') },
  { key: 'status', label: 'Status', valor: (c) => STATUS_PARCELA_LABELS[c.statusGeral] ?? c.statusGeral },
  { key: 'aprovacao', label: 'Aprovação', valor: (c) => STATUS_APROVACAO_LABELS[c.statusAprovacao] ?? c.statusAprovacao, opcional: true },
  { key: 'igreja', label: 'Igreja', valor: (c) => c.church?.name ?? '—', opcional: true },
];

function somaParcelas(conta: Row, campo: string) {
  return (conta.parcelas ?? []).reduce((s: number, p: Row) => s + num(p[campo]), 0);
}

/** Agrupamentos: o `value` é a chave da linha impressa. */
type GrupoImpressao = { value: string; label: string; valor?: (r: Row) => string };

// O mês sai como AAAA-MM porque o printReport ordena os grupos pelo próprio
// título — "ago/26" antes de "jan/26" confundiria a tesouraria.
const GRUPOS_PARCELA: GrupoImpressao[] = [
  { value: 'credor', label: 'Credor' },
  { value: 'plano', label: 'Plano de contas' },
  { value: 'departamento', label: 'Departamento' },
  { value: 'status', label: 'Status' },
  { value: 'numero', label: 'Conta' },
  { value: 'igreja', label: 'Igreja' },
  { value: 'mesVencimento', label: 'Mês de vencimento', valor: (p) => String(p.dataVencimento ?? '').slice(0, 7) || '—' },
];

const GRUPOS_TITULO: GrupoImpressao[] = [
  { value: 'credor', label: 'Credor' },
  { value: 'plano', label: 'Plano de contas' },
  { value: 'departamento', label: 'Departamento' },
  { value: 'status', label: 'Status' },
  { value: 'aprovacao', label: 'Aprovação' },
  { value: 'igreja', label: 'Igreja' },
  { value: 'mesEmissao', label: 'Mês de emissão', valor: (c) => String(c.dataEmissao ?? '').slice(0, 7) || '—' },
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
  // Perfil igreja (e secretaria/tesouraria) vê apenas a própria igreja — mesma
  // regra do resto do sistema, aplicada no servidor em escopoDeIgrejas().
  const papelUsuario = String(storedUser.roleName || '').toLowerCase();
  const soIgrejaPropria = perfil === 'church'
    || papelUsuario.includes('secret') || papelUsuario.includes('tesour');

  const [aba, setAba] = useState<'lancamentos' | 'relatorios'>('lancamentos');
  // A tela abre na visão do título; a quebra por parcela é a segunda aba.
  const [visao, setVisao] = useState<'titulo' | 'parcela'>('titulo');

  // ── filtros (compartilhados pelas duas abas) ───────────────────────────────
  const [busca, setBusca] = useState('');
  const [regionalId, setRegionalId] = useState('');
  const [churchId, setChurchId] = useState('');
  // Credor, plano de contas, departamento e banco são seleção múltipla: são os
  // filtros que a tesouraria abre direto no cabeçalho da coluna.
  const [credorId, setCredorId] = useState<string[]>([]);
  const [planoDeContaId, setPlanoDeContaId] = useState<string[]>([]);
  const [departamentoId, setDepartamentoId] = useState<string[]>([]);
  const [bancoId, setBancoId] = useState<string[]>([]);
  // A tela abre mostrando o que ainda se deve — é para isso que ela é aberta.
  const [status, setStatus] = useState<string[]>(['PENDENTE']);
  const [statusAprovacao, setStatusAprovacao] = useState('');
  const [vencimentoDe, setVencimentoDe] = useState('');
  const [vencimentoAte, setVencimentoAte] = useState('');
  const [presetVenc, setPresetVenc] = useState('tudo');
  const [valorMin, setValorMin] = useState('');
  const [valorMax, setValorMax] = useState('');
  const [soComSaldo, setSoComSaldo] = useState(false);
  const [soParceladas, setSoParceladas] = useState(false);
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
  const [pageSize, setPageSize] = useState(25);
  // A ordenação roda no servidor: ordenar só a página aberta ordenaria o
  // pedaço errado. As chaves são as que a API aceita em cada visão.
  const [ordem, setOrdem] = useState<{ by: string; dir: 'asc' | 'desc' }>(ORDEM_PADRAO.titulo);

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
  const [imprimirAberto, setImprimirAberto] = useState(false);

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

  // Só a busca textual espera: digitar dispararia uma consulta por tecla. Clique
  // em chip, filtro de coluna ou check aplica na hora.
  const [buscaAtrasada, setBuscaAtrasada] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setBuscaAtrasada(busca), 300);
    return () => clearTimeout(t);
  }, [busca]);

  // ── query string comum ─────────────────────────────────────────────────────
  const params = useCallback(() => {
    const p = new URLSearchParams();
    const busca = buscaAtrasada;
    if (busca) p.set('q', busca);
    if (churchId) p.set('churchId', churchId);
    else if (regionalId) p.set('regionalId', regionalId);
    else if (campoAtivo) p.set('campoId', campoAtivo);
    if (credorId.length) p.set('credorId', credorId.join(','));
    if (planoDeContaId.length) p.set('planoDeContaId', planoDeContaId.join(','));
    if (departamentoId.length) p.set('departamentoId', departamentoId.join(','));
    if (bancoId.length) p.set('bancoId', bancoId.join(','));
    if (status.length) p.set('status', status.join(','));
    if (statusAprovacao) p.set('statusAprovacao', statusAprovacao);
    if (vencimentoDe) p.set('vencimentoDe', vencimentoDe);
    if (vencimentoAte) p.set('vencimentoAte', vencimentoAte);
    if (valorMin) p.set('valorMin', valorMin);
    if (valorMax) p.set('valorMax', valorMax);
    if (soComSaldo) p.set('comSaldo', '1');
    if (soParceladas) p.set('parceladas', '1');
    return p;
  }, [buscaAtrasada, churchId, regionalId, campoAtivo, credorId, planoDeContaId, departamentoId,
      bancoId, status, statusAprovacao, vencimentoDe, vencimentoAte, valorMin, valorMax,
      soComSaldo, soParceladas]);

  /** Assinatura dos filtros: muda só quando algum filtro muda de verdade. */
  const chaveFiltros = useMemo(() => params().toString(), [params]);

  // Requisição em andamento: ao trocar de filtro rápido, a anterior é abortada
  // em vez de disputar quem escreve na tela por último.
  const emVoo = useRef<AbortController | null>(null);

  const carregarLista = useCallback(async (p: number) => {
    emVoo.current?.abort();
    const controle = new AbortController();
    emVoo.current = controle;

    setCarregando(true);
    setErro('');
    try {
      const qs = params();
      qs.set('page', String(p));
      qs.set('pageSize', String(pageSize));
      qs.set('sortBy', ordem.by);
      qs.set('sortDir', ordem.dir);
      const rota = visao === 'parcela' ? 'contas-pagar/parcelas' : 'contas-pagar';
      const res = await fetch(`${apiBase}/${rota}?${qs}`, { headers: authHeaders, signal: controle.signal });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || `Erro ${res.status}`);
      }
      const json = await res.json();
      setLinhas(json.data ?? []);
      setTotal(json.total ?? 0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      if (e?.name === 'AbortError') return; // outra carga assumiu
      setErro(e.message || 'Falha ao carregar as contas a pagar.');
      setLinhas([]);
      setTotal(0);
    } finally {
      if (!controle.signal.aborted) setCarregando(false);
    }
  }, [authHeaders, params, visao, pageSize, ordem]);

  // Os KPIs e os gráficos são 7 agregações no Postgres: só rodam quando o
  // FILTRO muda. Virar página, reordenar ou trocar de visão não mexe neles.
  const emVooRel = useRef<AbortController | null>(null);

  const carregarRelatorios = useCallback(async () => {
    emVooRel.current?.abort();
    const controle = new AbortController();
    emVooRel.current = controle;

    setCarregandoRel(true);
    try {
      const res = await fetch(`${apiBase}/contas-pagar/relatorios?${params()}`, {
        headers: authHeaders, signal: controle.signal,
      });
      if (!res.ok) throw new Error('Falha ao carregar relatórios.');
      const json = await res.json();
      setRelatorios(json);
      setTotais(json.totais);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setRelatorios(null);
    } finally {
      if (!controle.signal.aborted) setCarregandoRel(false);
    }
  }, [authHeaders, params]);

  /**
   * Uma carga por combinação de filtro/página/ordem/visão.
   *
   * A assinatura evita o disparo duplo clássico: mudar o filtro estando na
   * página 3 volta para a 1, o efeito roda de novo com a mesma combinação e
   * simplesmente não repete a requisição.
   */
  const ultimaLista = useRef('');
  const ultimoRelatorio = useRef('');
  useEffect(() => {
    const paginaAlvo = ultimaLista.current.startsWith(`${chaveFiltros}|`) ? pagina : 1;
    // Filtrar estando na página 3 mostraria vazio: o resultado novo tem menos
    // páginas.
    if (paginaAlvo !== pagina) setPagina(1);

    const assinatura = `${chaveFiltros}|${paginaAlvo}|${pageSize}|${ordem.by}|${ordem.dir}|${visao}`;
    if (ultimaLista.current !== assinatura) {
      ultimaLista.current = assinatura;
      carregarLista(paginaAlvo);
    }
    if (ultimoRelatorio.current !== chaveFiltros) {
      ultimoRelatorio.current = chaveFiltros;
      carregarRelatorios();
    }
  }, [chaveFiltros, pagina, pageSize, ordem, visao, carregarLista, carregarRelatorios]);

  // Recarrega a mesma combinação (botão Atualizar, depois de salvar/excluir).
  // As assinaturas não mudam: o que está carregado continua sendo o mesmo.
  const recarregar = () => {
    carregarLista(pagina);
    carregarRelatorios();
  };

  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));

  const regionais = useMemo(
    () => Array.from(new Map(igrejas.filter((c) => c.regional).map((c) => [c.regional.id, c.regional.name])).entries()),
    [igrejas]
  );
  const igrejasFiltradas = regionalId ? igrejas.filter((c) => c.regional?.id === regionalId) : igrejas;

  /** Clique no cabeçalho: mesma coluna inverte o sentido, outra começa asc. */
  function alternarOrdem(chave: string) {
    setOrdem((a) => (a.by === chave ? { by: chave, dir: a.dir === 'asc' ? 'desc' : 'asc' } : { by: chave, dir: 'asc' }));
    setPagina(1);
  }

  function trocarVisao(nova: 'titulo' | 'parcela') {
    setVisao(nova);
    setOrdem(ORDEM_PADRAO[nova]);
    setPagina(1);
  }

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
    setBusca(''); setRegionalId(''); setChurchId(''); setCredorId([]); setPlanoDeContaId([]);
    setDepartamentoId([]); setBancoId([]); setStatus([]); setStatusAprovacao('');
    setVencimentoDe(''); setVencimentoAte(''); setPresetVenc('tudo');
    setValorMin(''); setValorMax(''); setSoComSaldo(false); setSoParceladas(false);
  }

  const filtrosAtivos = [
    busca, regionalId, churchId, statusAprovacao, vencimentoDe, vencimentoAte, valorMin, valorMax,
  ].filter(Boolean).length
    + status.length + credorId.length + planoDeContaId.length + departamentoId.length + bancoId.length
    + (soComSaldo ? 1 : 0) + (soParceladas ? 1 : 0);

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
      if (!res.ok) throw new Error(json.error || 'Falha ao excluir.');
      // A API responde como a conta saiu: apagada de vez (sem histórico de
      // pagamento) ou cancelada logicamente (com histórico a preservar).
      toast.success(json.modo === 'apagada'
        ? 'Conta excluída junto com as parcelas.'
        : 'Conta cancelada. O histórico de pagamentos foi preservado.');
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

  // Filtros dos cabeçalhos: as opções saem dos mesmos cadastros dos dropdowns,
  // e o estado é o mesmo dos filtros gerais — marcar no cabeçalho ou no painel
  // avançado dá no mesmo resultado.
  const filtrosColuna: FiltrosDeColuna = useMemo(() => ({
    credor: {
      opcoes: credores.map((c: Row) => ({ valor: c.id, rotulo: c.nome })),
      selecionados: credorId,
      onMudar: (v) => { setCredorId(v); setPagina(1); },
    },
    plano: {
      opcoes: planosDespesa.map((p: Row) => ({ valor: p.id, rotulo: rotuloComCodigo(p) })),
      selecionados: planoDeContaId,
      onMudar: (v) => { setPlanoDeContaId(v); setPagina(1); },
    },
    departamento: {
      opcoes: [
        { valor: 'sem', rotulo: NAO_INFORMADO },
        ...departamentos.map((d: Row) => ({ valor: d.id, rotulo: rotuloComCodigo(d) })),
      ],
      selecionados: departamentoId,
      onMudar: (v) => { setDepartamentoId(v); setPagina(1); },
    },
    status: {
      opcoes: STATUS_OPCOES.map((s) => ({ valor: s, rotulo: STATUS_PARCELA_LABELS[s] })),
      selecionados: status,
      onMudar: (v) => { setStatus(v); setPagina(1); },
    },
  }), [credores, planosDespesa, departamentos, credorId, planoDeContaId, departamentoId, status]);

  // ── impressão ──────────────────────────────────────────────────────────────
  // Imprime o que os filtros selecionam, não só a página aberta: a tesouraria
  // leva o relatório inteiro para a reunião.
  const campos = visao === 'parcela' ? CAMPOS_PARCELA : CAMPOS_TITULO;
  const grupos = visao === 'parcela' ? GRUPOS_PARCELA : GRUPOS_TITULO;

  async function imprimir(orientation: PrintOrientation, sortBy: string, colunas: string[], grupo?: boolean | string) {
    const grupoKey = typeof grupo === 'string' ? grupo : '';
    try {
      const qs = params();
      qs.set('page', '1');
      qs.set('pageSize', '500');
      const rota = visao === 'parcela' ? 'contas-pagar/parcelas' : 'contas-pagar';
      const res = await fetch(`${apiBase}/${rota}?${qs}`, { headers: authHeaders });
      if (!res.ok) throw new Error('Falha ao buscar os dados para impressão.');
      const json = await res.json();
      const dados: Row[] = json.data ?? [];
      if (!dados.length) { toast.error('Nada para imprimir com os filtros atuais.'); return; }
      if ((json.total ?? dados.length) > dados.length) {
        toast.warning(`Imprimindo os primeiros ${dados.length} de ${json.total} registros — refine os filtros para um relatório completo.`);
      }

      const campoOrdem = campos.find((c) => c.key === sortBy);
      if (campoOrdem) {
        const chave = campoOrdem.ordem ?? campoOrdem.valor;
        dados.sort((a, b) => {
          const va = chave(a); const vb = chave(b);
          return typeof va === 'number' && typeof vb === 'number'
            ? va - vb
            : String(va).localeCompare(String(vb), 'pt-BR', { numeric: true });
        });
      }

      const extras = grupos.filter((g) => g.valor);
      const linhasImpressao = dados.map((d) => {
        const linha: Record<string, string> = {};
        for (const c of campos) linha[c.key] = c.valor(d);
        for (const g of extras) linha[g.value] = g.valor!(d);
        return linha;
      });

      const periodo = vencimentoDe || vencimentoAte
        ? `Vencimento ${vencimentoDe ? dataBR(vencimentoDe) : '…'} a ${vencimentoAte ? dataBR(vencimentoAte) : '…'}`
        : 'Todos os vencimentos';

      printReport({
        title: 'Contas a Pagar',
        subtitle: `${visao === 'parcela' ? 'Por parcela' : 'Por conta'} · ${periodo}`,
        orientation,
        columns: campos.filter((c) => colunas.includes(c.key)).map((c) => ({ key: c.key, label: c.label })),
        rows: linhasImpressao,
        groupByKey: grupoKey || undefined,
        groupByLabel: grupos.find((g) => g.value === grupoKey)?.label,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      toast.error(e.message || 'Falha ao imprimir.');
    }
  }

  // ── KPIs ───────────────────────────────────────────────────────────────────
  // `tom` vira a classe do card (ver globals.css): verde o que entrou, laranja
  // o que falta, vermelho o que atrasou, amarelo o resíduo.
  const kpis = [
    { label: 'Total no período', valor: num(totais?.total), icone: CircleDollarSign, tom: '' },
    { label: 'Já pago', valor: num(totais?.pago), icone: CheckCircle2, tom: 'kpi-card--pago' },
    { label: 'Em aberto', valor: num(totais?.saldo), icone: Clock, tom: 'kpi-card--aberto' },
    { label: 'Vencido', valor: num(totais?.vencido), icone: AlertTriangle, tom: 'kpi-card--vencido' },
    { label: 'Saldo residual', valor: num(totais?.saldo_residual), icone: Wallet, tom: 'kpi-card--residual' },
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
          <button onClick={() => setImprimirAberto(true)} className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium">
            <Printer className="w-4 h-4" /> Imprimir
          </button>
          {canCreate('contas_pagar') && (
            <button onClick={() => setDrawer({ aberto: true, contaId: null })} className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 text-sm font-medium">
              <Plus className="w-4 h-4" /> Nova Conta
            </button>
          )}
        </div>
      </div>

      {/* KPIs — compactos: ícone, rótulo e valor na mesma linha, para sobrar
          altura de tela para a tabela, que é onde o trabalho acontece. */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 mb-4">
        {kpis.map((k) => (
          <div key={k.label} className={`kpi-card ${k.tom} flex items-center gap-2 rounded-lg border px-3 py-2`}>
            <div className="kpi-icone w-7 h-7 shrink-0 rounded-lg flex items-center justify-center">
              <k.icone className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 leading-tight">{k.label}</div>
              <div className="kpi-valor text-base font-bold leading-tight">{formatarBRL(k.valor)}</div>
            </div>
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

      {/* Filtros — busca, chips e botões dividem a mesma linha; só quebram
          quando a tela é estreita demais para todos. */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 mb-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar descrição, conta, credor ou documento..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            />
          </div>

          {STATUS_OPCOES.map((s) => (
            <button
              key={s}
              onClick={() => alternarStatus(s)}
              // O chip usa a mesma cor do selo da tabela: laranja = pendente,
              // amarelo = parcial, vermelho = atrasado, verde = pago.
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors status-chip status-chip--${s.toLowerCase()} ${
                status.includes(s) ? 'is-ativo' : ''
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
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300" title="Mostra só os títulos divididos em mais de uma parcela">
            <input type="checkbox" checked={soParceladas} onChange={(e) => setSoParceladas(e.target.checked)} />
            Só parceladas
          </label>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => setFiltrosAbertos((v) => !v)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                filtrosAtivos ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-300' : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600'
              }`}
            >
              <Filter className="w-4 h-4" /> Filtros{filtrosAtivos ? ` (${filtrosAtivos})` : ''}
            </button>
            {filtrosAtivos > 0 && (
              <button onClick={limparFiltros} className="flex items-center gap-1 px-2 py-1.5 text-xs text-slate-500 hover:text-slate-700">
                <X className="w-4 h-4" /> Limpar
              </button>
            )}
          </div>
        </div>

        {filtrosAbertos && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
            {/* Perfil igreja só enxerga a própria igreja — o servidor já força
                isso; sem os seletores a tela não promete o que não entrega. */}
            {!soIgrejaPropria && (
              <>
                <select value={regionalId} onChange={(e) => { setRegionalId(e.target.value); setChurchId(''); }} className={inputCls}>
                  <option value="">Todas as regionais</option>
                  {regionais.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
                </select>
                <select value={churchId} onChange={(e) => setChurchId(e.target.value)} className={inputCls}>
                  <option value="">{regionalId ? 'Todas desta regional' : 'Todas as igrejas'}</option>
                  {igrejasFiltradas.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </>
            )}
            {/* Credor, plano, departamento e banco moram no cabeçalho da coluna
                (seleção múltipla). Aqui fica só o banco, que não tem coluna. */}
            <select
              value={bancoId[0] ?? ''}
              onChange={(e) => setBancoId(e.target.value ? [e.target.value] : [])}
              className={inputCls}
            >
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
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              {/* "Por conta" primeiro: é a visão do título, como a tela abre. */}
              {([
                { key: 'titulo', label: 'Por conta' },
                { key: 'parcela', label: 'Por parcela' },
              ] as const).map((v) => (
                <button
                  key={v.key}
                  onClick={() => trocarVisao(v.key)}
                  className={`px-4 py-2 text-sm font-medium ${visao === v.key ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <Paginacao
              pagina={pagina} totalPaginas={totalPaginas} total={total} pageSize={pageSize}
              onPagina={setPagina}
              onPageSize={(n) => { setPageSize(n); setPagina(1); }}
            />
          </div>

          {/* A tabela não é esvaziada durante a recarga: trocar de filtro
              mantém as linhas antigas esmaecidas até as novas chegarem, em vez
              de piscar um "Carregando..." em branco a cada clique. */}
          <div className={`relative bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto transition-opacity ${
            carregando && linhas.length ? 'opacity-60' : ''
          }`}>
            {carregando && linhas.length > 0 && (
              <div className="absolute right-3 top-2 z-10 flex items-center gap-1.5 rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] font-semibold text-white">
                <RefreshCw className="w-3 h-3 animate-spin" /> Atualizando
              </div>
            )}
            {carregando && !linhas.length ? (
              <div className="py-16 text-center text-slate-500">Carregando...</div>
            ) : !linhas.length ? (
              <div className="py-16 text-center text-slate-400">Nenhuma conta a pagar encontrada com estes filtros.</div>
            ) : visao === 'parcela' ? (
              <TabelaParcelas linhas={linhas} onAbrir={setParcelaAberta} ordem={ordem} onOrdenar={alternarOrdem} filtros={filtrosColuna} />
            ) : (
              <TabelaContas
                linhas={linhas}
                ordem={ordem}
                onOrdenar={alternarOrdem}
                filtros={filtrosColuna}
                expandida={contaExpandida}
                onExpandir={(id) => setContaExpandida((a) => (a === id ? null : id))}
                onAbrirParcela={setParcelaAberta}
                onEditar={canEdit('contas_pagar') ? (id) => setDrawer({ aberto: true, contaId: id }) : undefined}
                onCancelar={canDelete('contas_pagar') ? setCancelarAlvo : undefined}
                onAprovar={aprovar}
              />
            )}
          </div>

          <div className="flex justify-end mt-3 px-1">
            <Paginacao
              pagina={pagina} totalPaginas={totalPaginas} total={total} pageSize={pageSize}
              onPagina={setPagina}
              onPageSize={(n) => { setPageSize(n); setPagina(1); }}
            />
          </div>
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
          onMudou={recarregar}
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

      {/* `key` remonta o modal ao trocar de visão: as colunas oferecidas mudam. */}
      <PrintModal
        key={visao}
        open={imprimirAberto}
        onClose={() => setImprimirAberto(false)}
        onPrint={imprimir}
        defaultSort={visao === 'parcela' ? 'vencimento' : 'emissao'}
        sortOptions={campos.map((c) => ({ value: c.key, label: c.label }))}
        columnOptions={campos.map((c) => ({ value: c.key, label: c.label, defaultChecked: !c.opcional }))}
        groupOptions={grupos.map((g) => ({ value: g.value, label: g.label }))}
      />

      <ConfirmDialog
        open={Boolean(cancelarAlvo)}
        title="Excluir conta a pagar"
        message={`Excluir a conta ${cancelarAlvo?.numero ?? ''}? As parcelas vão junto. Se a conta já teve algum pagamento, ela é cancelada em vez de apagada, para não deixar despesa órfã no livro caixa.`}
        confirmLabel="Excluir conta"
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

const thCls = 'px-4 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase whitespace-nowrap';
const tdCls = 'px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap';

type Ordem = { by: string; dir: 'asc' | 'desc' };

/**
 * Navegação de páginas + quantos registros mostrar. Aparece antes e depois da
 * tabela: com 100 linhas na tela, rolar até o rodapé para virar a página é
 * trabalho à toa.
 */
function Paginacao({
  pagina, totalPaginas, total, pageSize, onPagina, onPageSize,
}: {
  pagina: number;
  totalPaginas: number;
  total: number;
  pageSize: number;
  onPagina: (p: number) => void;
  onPageSize: (n: number) => void;
}) {
  const inicio = total ? (pagina - 1) * pageSize + 1 : 0;
  const fim = Math.min(pagina * pageSize, total);
  const btn = 'p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent';

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
      <span className="whitespace-nowrap">
        {total ? `${inicio}–${fim} de ${total}` : 'Nenhum registro'}
      </span>

      <label className="flex items-center gap-1 whitespace-nowrap">
        Mostrar
        <select
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
          className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-200"
        >
          {TAMANHOS_PAGINA.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>

      <div className="flex items-center gap-1">
        <button onClick={() => onPagina(1)} disabled={pagina <= 1} className={btn} title="Primeira página"><ChevronsLeft className="w-4 h-4" /></button>
        <button onClick={() => onPagina(Math.max(1, pagina - 1))} disabled={pagina <= 1} className={btn} title="Página anterior"><ChevronLeft className="w-4 h-4" /></button>
        <span className="px-2 text-sm font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">{pagina} / {totalPaginas}</span>
        <button onClick={() => onPagina(Math.min(totalPaginas, pagina + 1))} disabled={pagina >= totalPaginas} className={btn} title="Próxima página"><ChevronRight className="w-4 h-4" /></button>
        <button onClick={() => onPagina(totalPaginas)} disabled={pagina >= totalPaginas} className={btn} title="Última página"><ChevronsRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

type FiltrosDeColuna = {
  credor: FiltroColuna;
  plano: FiltroColuna;
  departamento: FiltroColuna;
  status: FiltroColuna;
};

export type OpcaoFiltro = { valor: string; rotulo: string };

/** Filtro de coluna: seleção múltipla com marcar/desmarcar tudo. */
export type FiltroColuna = {
  opcoes: OpcaoFiltro[];
  selecionados: string[];
  onMudar: (valores: string[]) => void;
};

/**
 * Cabeçalho da tabela: rótulo, ordenação (quando a coluna tem `chave`) e
 * filtro (quando recebe `filtro`).
 *
 * Ordenar sem `chave` não é oferecido de propósito — a API só ordena por
 * colunas que existem na tabela do banco, e ordenar no navegador daria uma
 * ordem válida só para as 25 linhas abertas, não para as 300 filtradas.
 */
function Th({
  children, chave, ordem, onOrdenar, alinhamento = 'left', filtro,
}: {
  children: React.ReactNode;
  chave?: string;
  ordem?: Ordem;
  onOrdenar?: (chave: string) => void;
  alinhamento?: 'left' | 'right';
  filtro?: FiltroColuna;
}) {
  const ativa = Boolean(chave && ordem?.by === chave);
  return (
    <th className={`${thCls} ${alinhamento === 'right' ? 'text-right' : ''}`}>
      <span className={`inline-flex items-center gap-1 ${alinhamento === 'right' ? 'justify-end' : ''}`}>
        {chave && onOrdenar ? (
          <button
            onClick={() => onOrdenar(chave)}
            className={`inline-flex items-center gap-1 uppercase hover:text-slate-900 dark:hover:text-white ${ativa ? 'text-slate-900 dark:text-white' : ''}`}
            title="Ordenar por esta coluna"
          >
            {children}
            {ativa
              ? (ordem?.dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
              : <ArrowUpDown className="w-3 h-3 opacity-30" />}
          </button>
        ) : (
          children
        )}
        {filtro ? <MenuFiltroColuna {...filtro} /> : null}
      </span>
    </th>
  );
}

const LARGURA_MENU = 256; // w-64

/**
 * O menu é renderizado num portal, fora da tabela.
 *
 * O container da tabela tem `overflow-x-auto` para as colunas largas rolarem —
 * e overflow recorta qualquer filho posicionado, então um dropdown normal
 * apareceria cortado dentro da tabela. Portal + posição fixa calculada a partir
 * do botão resolve sem abrir mão da rolagem horizontal.
 */
function MenuFiltroColuna({ opcoes, selecionados, onMudar }: FiltroColuna) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [posicao, setPosicao] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const caixa = useRef<HTMLDivElement | null>(null);
  const menu = useRef<HTMLDivElement | null>(null);

  const posicionar = useCallback(() => {
    const alvo = caixa.current?.getBoundingClientRect();
    if (!alvo) return;
    // Encosta na direita quando não há espaço para abrir à esquerda do botão.
    const left = Math.max(8, Math.min(alvo.left, window.innerWidth - LARGURA_MENU - 8));
    setPosicao({ top: alvo.bottom + 4, left });
  }, []);

  useEffect(() => {
    if (!aberto) return;
    posicionar();

    function aoClicar(e: MouseEvent) {
      const alvo = e.target as Node;
      if (caixa.current?.contains(alvo) || menu.current?.contains(alvo)) return;
      setAberto(false);
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === 'Escape') setAberto(false);
    }
    // `capture` pega também a rolagem do container da tabela, não só a da janela.
    document.addEventListener('mousedown', aoClicar);
    document.addEventListener('keydown', aoTeclar);
    window.addEventListener('scroll', posicionar, true);
    window.addEventListener('resize', posicionar);
    return () => {
      document.removeEventListener('mousedown', aoClicar);
      document.removeEventListener('keydown', aoTeclar);
      window.removeEventListener('scroll', posicionar, true);
      window.removeEventListener('resize', posicionar);
    };
  }, [aberto, posicionar]);

  const visiveis = busca.trim()
    ? opcoes.filter((o) => o.rotulo.toLowerCase().includes(busca.trim().toLowerCase()))
    : opcoes;

  function alternar(valor: string) {
    onMudar(selecionados.includes(valor) ? selecionados.filter((v) => v !== valor) : [...selecionados, valor]);
  }

  return (
    <div className="relative inline-block" ref={caixa}>
      <button
        onClick={() => setAberto((v) => !v)}
        title={selecionados.length ? `${selecionados.length} selecionado(s)` : 'Filtrar por esta coluna'}
        className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 ${
          selecionados.length ? 'text-rose-600' : 'text-slate-400'
        }`}
      >
        <Filter className={`w-3.5 h-3.5 ${selecionados.length ? 'fill-current' : ''}`} />
      </button>

      {aberto && createPortal(
        <div
          ref={menu}
          style={{ top: posicao.top, left: posicao.left, width: LARGURA_MENU }}
          className="fixed z-[60] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-2xl normal-case"
        >
          {opcoes.length > 8 && (
            <div className="p-2 border-b border-slate-100 dark:border-slate-700">
              <input
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar..."
                className="w-full px-2 py-1.5 text-xs font-normal rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          )}

          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-700 text-[11px] font-semibold">
            <button onClick={() => onMudar(opcoes.map((o) => o.valor))} className="text-rose-600 hover:underline">
              Selecionar todos
            </button>
            <button
              onClick={() => onMudar([])}
              disabled={!selecionados.length}
              className="text-slate-500 hover:underline disabled:opacity-40 disabled:no-underline"
            >
              Remover todos
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {visiveis.length === 0 ? (
              <p className="px-3 py-3 text-xs font-normal text-slate-400">Nada encontrado.</p>
            ) : visiveis.map((o) => (
              <label
                key={o.valor}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-normal text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selecionados.includes(o.valor)}
                  onChange={() => alternar(o.valor)}
                  className="accent-rose-600"
                />
                <span className="truncate" title={o.rotulo}>{o.rotulo}</span>
              </label>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function TabelaParcelas({
  linhas, onAbrir, ordem, onOrdenar, filtros,
}: {
  linhas: Row[];
  onAbrir: (id: string) => void;
  ordem: Ordem;
  onOrdenar: (chave: string) => void;
  filtros: FiltrosDeColuna;
}) {
  const th = { ordem, onOrdenar };
  return (
    <table className="w-full">
      <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <tr>
          <Th chave="dataVencimento" {...th}>Vencimento</Th>
          <Th>Conta</Th>
          <Th filtro={filtros.credor}>Credor</Th>
          <Th filtro={filtros.plano}>Plano de contas</Th>
          <Th filtro={filtros.departamento}>Departamento</Th>
          <Th>Parcela</Th>
          <Th chave="valorParcela" alinhamento="right" {...th}>Valor</Th>
          <Th alinhamento="right">Pago</Th>
          <Th chave="valorSaldo" alinhamento="right" {...th}>Saldo</Th>
          <Th chave="status" filtro={filtros.status} {...th}>Status</Th>
          <Th>Ações</Th>
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
            <td className={`${tdCls} text-right valor-pago`}>{formatarBRL(p.valorPago)}</td>
            <td className={`${tdCls} text-right font-semibold ${num(p.valorSaldo) > 0 ? 'valor-devendo' : 'valor-pago'}`}>{formatarBRL(p.valorSaldo)}</td>
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
  linhas, expandida, onExpandir, onAbrirParcela, onEditar, onCancelar, onAprovar, ordem, onOrdenar, filtros,
}: {
  linhas: Row[];
  expandida: string | null;
  onExpandir: (id: string) => void;
  onAbrirParcela: (id: string) => void;
  onEditar?: (id: string) => void;
  onCancelar?: (conta: Row) => void;
  onAprovar: (id: string, aprovado: boolean) => void;
  ordem: Ordem;
  onOrdenar: (chave: string) => void;
  filtros: FiltrosDeColuna;
}) {
  const th = { ordem, onOrdenar };
  return (
    <table className="w-full">
      <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <tr>
          <Th chave="numero" {...th}>Conta</Th>
          <Th filtro={filtros.credor}>Credor</Th>
          <Th filtro={filtros.plano}>Tipo</Th>
          <Th filtro={filtros.departamento}>Departamento</Th>
          <Th chave="dataEmissao" {...th}>Emissão</Th>
          <Th>Parcelas</Th>
          <Th chave="valorTotal" alinhamento="right" {...th}>Total</Th>
          <Th chave="statusGeral" filtro={filtros.status} {...th}>Status</Th>
          <Th>Aprovação</Th>
          <Th>Ações</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
        {linhas.map((c) => {
          const pago = (c.parcelas ?? []).reduce((s: number, p: Row) => s + num(p.valorPago), 0);
          const progresso = num(c.valorTotal) ? Math.min(100, (pago / num(c.valorTotal)) * 100) : 0;
          // Parcela cancelada não conta: ela não é dívida nem quitação.
          const parcelasVivas = (c.parcelas ?? []).filter((p: Row) => p.status !== 'CANCELADA');
          const quitadas = parcelasVivas.filter((p: Row) => p.status === 'PAGO').length;
          const aPagar = parcelasVivas.length - quitadas;
          const faltaEmReais = parcelasVivas.reduce((s: number, p: Row) => s + num(p.valorSaldo), 0);
          return (
            <Fragment key={c.id}>
              {/* A linha inteira abre e fecha as parcelas; os botões da coluna
                  de ações param o clique para não expandir junto. */}
              <tr
                onClick={() => onExpandir(c.id)}
                className={`cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 ${
                  expandida === c.id ? 'bg-slate-50 dark:bg-slate-800/60' : ''
                }`}
              >
                <td className={tdCls}>
                  <div className="font-medium text-slate-900 dark:text-slate-100">{c.numero}</div>
                  <div className="text-xs text-slate-500 max-w-[240px] truncate">{c.descricao}</div>
                </td>
                <td className={tdCls}>{c.credor?.nome ?? '—'}</td>
                <td className={tdCls}>{c.planoDeConta?.nome ?? NAO_INFORMADO}</td>
                <td className={tdCls}>{c.departamento?.nome ?? NAO_INFORMADO}</td>
                <td className={tdCls}>{dataBR(c.dataEmissao)}</td>
                {/* A barra mostra o quanto do valor já saiu; o texto abaixo diz
                    quantas parcelas ainda faltam — que é a pergunta que a
                    tesouraria faz olhando a lista. */}
                <td className={tdCls} title={aPagar ? `Falta pagar ${formatarBRL(faltaEmReais)}` : 'Conta quitada'}>
                  <div className="flex items-center gap-2">
                    <span>{c.numeroParcelas}x</span>
                    <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div className="h-full" style={{ width: `${progresso}%`, backgroundColor: '#10b981' }} />
                    </div>
                  </div>
                  <div className="text-[11px] mt-0.5">
                    <span className="valor-pago font-semibold">{quitadas} paga{quitadas === 1 ? '' : 's'}</span>
                    {aPagar > 0 && (
                      <span className="valor-devendo font-semibold"> · faltam {aPagar}</span>
                    )}
                  </div>
                </td>
                <td className={`${tdCls} text-right font-semibold`}>{formatarBRL(c.valorTotal)}</td>
                <td className={tdCls}><Badge status={c.statusGeral} /></td>
                <td className={tdCls}>
                  <span className="text-xs">{STATUS_APROVACAO_LABELS[c.statusAprovacao] ?? c.statusAprovacao}</span>
                </td>
                <td className={tdCls} onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    <button onClick={() => onExpandir(c.id)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title={expandida === c.id ? 'Ocultar parcelas' : 'Ver parcelas'}>
                      <Eye className={`w-4 h-4 ${expandida === c.id ? 'text-rose-600' : 'text-slate-500'}`} />
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
                      {/* Cada card puxa a cor do status da parcela — o mesmo
                          semáforo dos selos, para ler a conta de relance. */}
                      {(c.parcelas ?? []).map((p: Row) => (
                        <button
                          key={p.id}
                          onClick={() => onAbrirParcela(p.id)}
                          className={`text-left rounded-lg border p-3 transition-colors parcela-card parcela-card--${String(p.status).toLowerCase()}`}
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
            </Fragment>
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
