import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Search, X, Plus, CheckCircle, AlertCircle, User, Users, Briefcase, Camera, RotateCcw, RefreshCw, Repeat2, Pencil, Check, PanelRightOpen, PanelRightClose } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { supabase } from '../../lib/supabaseClient';
import { apiBase } from '../../lib/apiBase';
import { checkChurchCashStatus } from '../../lib/financeCashStatus';
import { ReciboModal } from './ReciboModal';
import type { ReciboRow } from './ReciboModal';
import { MemberQuickCreateModal } from '../../components/app-ui/MemberQuickCreateModal';

// Ícone de Igreja (cruz)
function ChurchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4M10 4h4" />
      <path d="M5 22V10l7-6 7 6v12" />
      <rect x="9" y="14" width="6" height="8" />
    </svg>
  );
}

// Modal de confirmação de exclusão
function DeleteConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base">Excluir lançamento</h3>
            <p className="text-sm text-slate-500">Esta ação não pode ser desfeita.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 py-2.5 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors">
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

function CashClosedModal({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
            <AlertCircle className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Caixa fechado</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}

function SearchableSelect({ 
  value, 
  onChange, 
  options, 
  placeholder, 
  className 
}: { 
  value: string; 
  onChange: (val: string) => void; 
  options: { id: string; label: string }[]; 
  placeholder: string; 
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(o => 
    normalizeText(o.label).includes(normalizeText(search))
  );

  const selectedOption = options.find(o => o.id === value);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div 
        onClick={() => { setOpen(!open); setSearch(''); }}
        className={`flex items-center justify-between cursor-pointer ${className}`}
      >
        <span className={`truncate ${selectedOption ? '' : 'text-slate-500 dark:text-slate-400'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg className="w-4 h-4 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
      </div>
      
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl flex flex-col" style={{ maxHeight: '300px' }}>
          <div className="p-2 border-b border-slate-100 dark:border-slate-700">
            <input 
              autoFocus
              type="text" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Buscar categoria..." 
              className="w-full px-2 py-1.5 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-400 dark:focus:border-violet-500 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="overflow-y-auto flex-1 p-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-3 text-sm text-slate-500 text-center">Nenhuma categoria encontrada</div>
            ) : (
              filteredOptions.map(o => (
                <div 
                  key={o.id} 
                  onClick={() => { onChange(o.id); setOpen(false); }}
                  className={`px-3 py-2 text-sm cursor-pointer rounded-md mb-0.5 hover:bg-violet-50 dark:hover:bg-slate-700 dark:text-slate-200 ${value === o.id ? 'bg-violet-50 dark:bg-slate-700 font-semibold text-violet-700 dark:text-violet-300' : 'text-slate-700'}`}
                >
                  {o.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Modo = 'RECEITA' | 'DESPESA';
type TipoPessoa = 'MEMBRO' | 'IGREJA' | 'NAO_MEMBRO' | 'PJ';

type Church = { id: string; name: string };
type PlanoDeContas = { id: string; nome: string; codigo: string | null };
type FormaPagamento = { id: string; nome: string };
type TipoDocumento = { id: string; nome: string; sigla: string | null };
type Member = { id: string; nome: string; church?: string };

type LancamentoRecente = {
  id: string;
  data_lancamento: string;
  tipo: string;
  valor: number;
  favorecido: string | null;
  plano_de_conta: string | null;
  forma_pg?: string | null;
  tipo_documento?: string | null;
  num_doc: string | null;
  obs?: string | null;
  repetido_mes?: string | null;
};

function normalizeText(value: string | null | undefined) {
  return (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function isBlank(value: string | null | undefined) {
  return !value || !value.trim();
}

function getReceitaTipoDocumentoPadrao(planoDeContas: string | null | undefined, tipoDocumentoAtual: string | null | undefined) {
  const tipoNormalizado = normalizeText(tipoDocumentoAtual);
  if (tipoNormalizado.includes('recibo receita')) return 'RECIBO RECEITA';
  if (tipoNormalizado.includes('outros receita')) return 'OUTROS RECEITA';

  const planoNormalizado = normalizeText(planoDeContas);
  if (planoNormalizado.includes('dizimo') || planoNormalizado.includes('oferta')) {
    return 'RECIBO RECEITA';
  }

  return tipoDocumentoAtual || null;
}

// ─── Search Modal (Membro ou Igreja) ─────────────────────────────────────────

function SearchModal({
  title,
  placeholder,
  onSelect,
  onClose,
  searchFn,
}: {
  title: string;
  placeholder: string;
  onSelect: (item: { id: string; label: string }) => void;
  onClose: () => void;
  searchFn: (q: string) => Promise<{ id: string; label: string; sub?: string }[]>;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: string; label: string; sub?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); runSearch(''); }, []);

  async function runSearch(q: string) {
    setActiveIdx(0);
    setSearched(true);
    if (q.trim().length < 1) { setResults([]); return; }
    setLoading(true);
    const res = await searchFn(q.trim());
    setResults(res);
    setLoading(false);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[activeIdx]) onSelect(results[activeIdx]);
    if (e.key === 'Enter' && !results[activeIdx]) runSearch(query);
    if (e.key === 'Escape') onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3 p-5 border-b border-slate-100 dark:border-slate-700">
          <ChurchIcon className="w-5 h-5 text-slate-500" />
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 text-base">{title}</h2>
          <button onClick={onClose} className="ml-auto p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"><X className="w-4 h-4 text-slate-500 dark:text-slate-300" /></button>
        </div>
        <div className="p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKey}
                placeholder={placeholder}
                className="w-full pl-9 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 caret-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              onClick={() => runSearch(query)}
              className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 flex items-center gap-1.5"
            >
              <Search className="w-4 h-4" /> Buscar
            </button>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">Use ↓ ↑ para navegar &nbsp;&nbsp; Enter para selecionar</p>
        </div>
        <div className="border-t border-slate-100 dark:border-slate-700 min-h-[120px] max-h-64 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-24 text-slate-400 dark:text-slate-500 text-sm">Buscando...</div>
          )}
          {!loading && searched && results.length === 0 && (
            <div className="flex items-center justify-center h-24 text-slate-400 dark:text-slate-500 text-sm">Nenhum resultado encontrado</div>
          )}
          {!loading && !searched && (
            <div className="flex flex-col items-center justify-center h-24 gap-2 text-slate-400 dark:text-slate-500">
              <Search className="w-8 h-8 text-slate-200 dark:text-slate-700" />
              <p className="text-sm">Digite o nome ou ID para buscar</p>
            </div>
          )}
          {results.map((r, i) => (
            <button
              key={r.id}
              onClick={() => onSelect(r)}
              className={`w-full text-left px-5 py-3 text-sm border-b border-slate-50 dark:border-slate-700 last:border-0 transition-colors ${i === activeIdx ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/60'}`}
            >
              <p className="font-medium text-slate-800 dark:text-slate-100">{r.label}</p>
              {r.sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{r.sub}</p>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Historico Panel ─────────────────────────────────────────────────────────

function HistoricoPanel({
  lancamentosRecentes, loadRecentes, onClearHistory, caixaId, currentModo, onRepetir, onReciboReady,
}: {
  lancamentosRecentes: LancamentoRecente[];
  loadRecentes: () => void;
  onClearHistory: () => void;
  caixaId: string;
  currentModo: string;
  onRepetir: (l: LancamentoRecente) => void;
  onReciboReady: (row: ReciboRow) => void;
}) {
  const [activeTab, setActiveTab] = useState<'historico' | 'repetir'>('historico');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValor, setEditValor] = useState('');
  // Obs editing
  const [editingObsId, setEditingObsId] = useState<string | null>(null);
  const [editObsValue, setEditObsValue] = useState('');
  const [obsModalId, setObsModalId] = useState<string | null>(null);
  const [obsModalValue, setObsModalValue] = useState('');
  const [repetindo, setRepetindo] = useState<string | null>(null);
  const [repeatError, setRepeatError] = useState('');

  // ── Perfil do usuário ──
  const userRawPanel = typeof window !== 'undefined' ? localStorage.getItem('mrm_user') : null;
  const userObjPanel = userRawPanel ? JSON.parse(userRawPanel) : null;
  const profileType: string = userObjPanel?.profileType ?? 'church';
  const isChurchProfile = profileType === 'church';

  // ── Aba Repetir: filtros de igreja e mês ──
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

  // Igreja selecionada para repetir (inicializa com caixaId se perfil church)
  const [repetirChurchId, setRepetirChurchId] = useState<string>(caixaId ?? '');
  const [repetirChurchName, setRepetirChurchName] = useState<string>(isChurchProfile ? (userObjPanel?.churchName ?? '') : '');
  const [showRepetirChurchModal, setShowRepetirChurchModal] = useState(false);
  // Mês no formato yyyy-MM (para input type="month")
  const [repetirMes, setRepetirMes] = useState<string>(prevMonthStr);

  const mesAtualStr = `${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

  // Sincroniza igreja quando caixaId muda externamente (só para church profile)
  useEffect(() => {
    if (isChurchProfile && caixaId) {
      setRepetirChurchId(caixaId);
    }
  }, [caixaId, isChurchProfile]);

  // ── Aba Repetir: lista de dízimos ──
  const [dizimos, setDizimos] = useState<LancamentoRecente[]>([]);
  const [dizimosLoading, setDizimosLoading] = useState(false);
  const [dizimosSearched, setDizimosSearched] = useState(false);
  const [repetidos, setRepetidos] = useState<Set<string>>(new Set());

  // Lista de igrejas disponíveis para select (master/admin)
  const [churchesPanel, setChurchesPanel] = useState<Church[]>([]);
  useEffect(() => {
    if (!isChurchProfile && activeTab === 'repetir' && churchesPanel.length === 0) {
      supabase.from('churches').select('id, name').order('name').limit(500)
        .then(({ data }) => { if (data) setChurchesPanel(data as Church[]); });
    }
  }, [activeTab, isChurchProfile, churchesPanel.length]);

  const mesLabelStr = repetirMes
    ? `${repetirMes.split('-')[1]}/${repetirMes.split('-')[0]}`
    : '—';

  async function loadDizimos() {
    if (!repetirChurchId || !repetirMes) return;
    setRepeatError('');
    setDizimosLoading(true);
    setDizimosSearched(true);
    const [year, month] = repetirMes.split('-').map(Number);
    const dtIni = new Date(year, month - 1, 1).toISOString().split('T')[0];
    const dtFim = new Date(year, month, 0).toISOString().split('T')[0];
    const { data } = await supabase
      .from('livro_caixa')
      .select('id, data_lancamento, tipo, valor, favorecido, plano_de_conta, forma_pg, tipo_documento, num_doc, obs')
      .eq('church_id', repetirChurchId)
      .eq('tipo', 'RECEITA')
      .gte('data_lancamento', dtIni)
      .lte('data_lancamento', dtFim)
      .order('favorecido', { ascending: true })
      .limit(500);
    const filtered = (data ?? []).filter((l: any) => {
      const plano = (l.plano_de_conta ?? '').toLowerCase();
      return plano.includes('dizimo') || plano.includes('dízimo');
    });
    setDizimos(filtered as LancamentoRecente[]);
    setRepetidos(new Set());
    setDizimosLoading(false);
  }

  function handleMesAnterior() {
    const [y, m] = repetirMes.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setRepetirMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    setDizimos([]);
    setDizimosSearched(false);
  }

  async function handleRepetir(l: LancamentoRecente) {
    const targetChurchId = repetirChurchId || caixaId;
    if (!targetChurchId) return;
    setRepetindo(l.id);

    const cashStatus = await checkChurchCashStatus(targetChurchId, now.toISOString().split('T')[0]);
    if (!cashStatus.canInsert) {
      setRepeatError('');
      setCashClosedMessage(cashStatus.message);
      setRepetindo(null);
      return;
    }

    setRepeatError('');
    const { data: inserted, error } = await supabase.from('livro_caixa').insert({
      church_id: targetChurchId || null,
      data_lancamento: now.toISOString().split('T')[0],
      tipo: l.tipo,
      valor: l.valor,
      favorecido: l.favorecido,
      plano_de_conta: l.plano_de_conta,
      forma_pg: l.forma_pg ?? null,
      tipo_documento: l.tipo === 'RECEITA' ? getReceitaTipoDocumentoPadrao(l.plano_de_conta, l.tipo_documento) : (l.tipo_documento ?? null),
      num_doc: l.num_doc ?? null,
      referencia: mesAtualStr,
      obs: l.obs ?? null,
    }).select('id, legacy_id').single();
    if (!error && inserted) {
      setRepetidos(prev => new Set(prev).add(l.id));
      loadRecentes();
      // Gera recibo igual ao lançamento normal
      onReciboReady({
        id: inserted.id ?? '',
        legacy_id: inserted.legacy_id ?? null,
        data_lancamento: now.toISOString().split('T')[0],
        tipo: l.tipo as 'RECEITA' | 'DESPESA',
        valor: l.valor,
        favorecido: l.favorecido,
        rol: null,
        plano_de_conta: l.plano_de_conta,
        categoria: l.plano_de_conta,
        forma_pg: l.forma_pg ?? null,
        referencia: mesAtualStr,
        obs: l.obs ?? null,
        foto: null,
        num_doc: l.num_doc ?? null,
        tipo_documento: l.tipo === 'RECEITA' ? getReceitaTipoDocumentoPadrao(l.plano_de_conta, l.tipo_documento) : (l.tipo_documento ?? null),
        member_id: null,
        operador: null,
        churches: { name: repetirChurchName || '' },
      });
    }
    setRepetindo(null);
  }

  async function handleEditValorSave(l: LancamentoRecente) {
    const num = Number(editValor.replace(/\./g, '').replace(',', '.'));
    if (!isNaN(num) && num > 0) {
      setDizimos(prev => prev.map(d => d.id === l.id ? { ...d, valor: num } : d));
    }
    setEditingId(null);
  }

  function openObsEdit(l: LancamentoRecente) {
    if (l.obs) {
      // Tem observação → abre modal
      setObsModalId(l.id);
      setObsModalValue(l.obs);
    } else {
      // Sem obs → inline
      setEditingObsId(l.id);
      setEditObsValue('');
    }
  }

  function saveObsInline(id: string) {
    setDizimos(prev => prev.map(d => d.id === id ? { ...d, obs: editObsValue.trim() || null } : d));
    setEditingObsId(null);
  }

  function saveObsModal() {
    if (!obsModalId) return;
    setDizimos(prev => prev.map(d => d.id === obsModalId ? { ...d, obs: obsModalValue.trim() || null } : d));
    setObsModalId(null);
  }

  function handleEditValorChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) { setEditValor(''); return; }
    const num = parseInt(raw, 10) / 100;
    setEditValor(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  }

  return (
    <div className="w-full lg:w-[440px] lg:flex-shrink-0 flex flex-col gap-2">
      {repeatError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {repeatError}
        </div>
      )}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col" style={{ maxHeight: 'calc(100vh - 120px)' }}>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 flex-shrink-0">
          <button onClick={() => setActiveTab('historico')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${activeTab === 'historico' ? 'text-slate-800 dark:text-slate-100 border-b-2 border-violet-500' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
            <RotateCcw className="w-3.5 h-3.5" /> Histórico
          </button>
          <button onClick={() => setActiveTab('repetir')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${activeTab === 'repetir' ? 'text-slate-800 dark:text-slate-100 border-b-2 border-violet-500' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
            <Repeat2 className="w-3.5 h-3.5" /> Repetir Dízimos
          </button>
          <button onClick={() => { loadRecentes(); if (activeTab === 'repetir') loadDizimos(); }} className="px-3 text-slate-300 hover:text-slate-500 transition-colors" title="Atualizar">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ── ABA HISTÓRICO ── */}
        {activeTab === 'historico' && (
          <div className="flex flex-col flex-1 min-h-0">
            {lancamentosRecentes.length > 0 && (
              <div className="flex items-center justify-between px-4 py-1.5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/30 flex-shrink-0">
                <span className="text-[10px] text-slate-400">{lancamentosRecentes.length} lançamento{lancamentosRecentes.length !== 1 ? 's' : ''} nesta sessão</span>
                <button
                  onClick={onClearHistory}
                  className="text-[10px] text-red-400 hover:text-red-600 font-semibold transition-colors"
                  title="Limpar histórico local"
                >
                  Limpar
                </button>
              </div>
            )}
            <div className="overflow-y-auto flex-1">
              {lancamentosRecentes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-300 gap-2">
                  <RotateCcw className="w-6 h-6" />
                  <p className="text-xs">Nenhum lançamento nesta sessão</p>
                  <p className="text-[10px] text-slate-300 text-center px-6">Os registros aparecem aqui após salvar</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {lancamentosRecentes.map(l => (
                    <div key={l.id} className="px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-slate-400 dark:text-slate-500">{new Date(l.data_lancamento + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{l.plano_de_conta ?? '—'}</p>
                          <p className="text-[11px] text-slate-400 truncate">{l.favorecido ?? 'Sem dados'}</p>
                        </div>
                        <span className={`text-xs font-bold flex-shrink-0 ${l.tipo === 'RECEITA' ? 'text-emerald-600' : 'text-red-600'}`}>
                          R$ {Number(l.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ABA REPETIR DÍZIMOS ── */}
        {activeTab === 'repetir' && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Filtros */}
            <div className="px-4 py-3 bg-violet-50 dark:bg-violet-900/20 border-b border-violet-100 dark:border-violet-900/40 flex-shrink-0 space-y-2">
              <p className="text-xs text-violet-700 font-semibold">Repetir Dízimos</p>

              {/* Igreja */}
              {isChurchProfile ? (
                <div className="flex items-center gap-2 px-2.5 py-1.5 bg-white rounded-lg border border-violet-200 text-xs text-slate-700">
                  <ChurchIcon className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                  <span className="truncate flex-1">{repetirChurchName || 'Igreja não definida'}</span>
                </div>
              ) : (
                <div>
                  <label className="text-[10px] text-violet-500 font-semibold uppercase tracking-wide mb-1 block">Igreja</label>
                  <button
                    type="button"
                    onClick={() => setShowRepetirChurchModal(true)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-white rounded-lg border border-violet-200 text-xs text-slate-700 hover:border-violet-400 transition-colors text-left"
                  >
                    <ChurchIcon className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                    <span className="truncate flex-1">{repetirChurchName || 'Selecione uma igreja...'}</span>
                    {repetirChurchId && <X className="w-3 h-3 text-slate-400 flex-shrink-0" onClick={e => { e.stopPropagation(); setRepetirChurchId(''); setRepetirChurchName(''); setDizimos([]); setDizimosSearched(false); }} />}
                  </button>
                </div>
              )}

              {/* Mês */}
              <div>
                <label className="text-[10px] text-violet-500 font-semibold uppercase tracking-wide mb-1 block">Mês de Referência</label>
                <div className="flex gap-2">
                  <input
                    type="month"
                    value={repetirMes}
                    onChange={e => { setRepetirMes(e.target.value); setDizimos([]); setDizimosSearched(false); }}
                    className="flex-1 px-2.5 py-1.5 border border-violet-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                  <button
                    type="button"
                    onClick={handleMesAnterior}
                    className="px-2.5 py-1.5 bg-white border border-violet-200 rounded-lg text-[10px] font-semibold text-violet-600 hover:bg-violet-100 transition-colors whitespace-nowrap"
                    title="Ir para o mês anterior"
                  >
                    ← Mês Ant.
                  </button>
                </div>
              </div>

              {/* Botão buscar */}
              <button
                type="button"
                onClick={loadDizimos}
                disabled={!repetirChurchId || !repetirMes || dizimosLoading}
                className="w-full flex items-center justify-center gap-1.5 py-2 bg-violet-600 text-white rounded-lg text-xs font-semibold hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {dizimosLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                {dizimosLoading ? 'Buscando...' : `Buscar Dízimos de ${mesLabelStr}`}
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
            {!dizimosSearched && (
              <div className="flex flex-col items-center justify-center py-10 text-slate-300 gap-2">
                <Repeat2 className="w-6 h-6" />
                <p className="text-xs text-center px-4">Selecione a igreja e o mês, depois clique em Buscar</p>
              </div>
            )}

            {dizimosSearched && dizimosLoading && (
              <div className="flex items-center justify-center py-10">
                <RefreshCw className="w-5 h-5 text-violet-400 animate-spin" />
              </div>
            )}

            {dizimosSearched && !dizimosLoading && dizimos.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-slate-300 gap-2">
                <Repeat2 className="w-6 h-6" />
                <p className="text-xs text-center px-4">Nenhum dízimo encontrado em {mesLabelStr}</p>
              </div>
            )}

            {dizimosSearched && !dizimosLoading && dizimos.length > 0 && (
              <>
                <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/30 flex items-center gap-3 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                  <span className="flex-1">Nome</span>
                  <span className="w-24 text-right">Valor</span>
                  <span className="w-28 text-center">Ação</span>
                </div>
                <div className="divide-y divide-slate-50">
                  {dizimos.map(l => {
                    const jaRepetido = repetidos.has(l.id);
                    return (
                      <div key={l.id} className={`px-4 py-2 transition-colors ${jaRepetido ? 'bg-emerald-50/60' : 'hover:bg-slate-50'}`}>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{l.favorecido ?? '—'}</p>
                            <p className="text-[10px] text-slate-400 truncate">{l.plano_de_conta}</p>
                          </div>

                          {/* Valor (editável inline) */}
                          {editingId === l.id ? (
                            <div className="w-24 flex items-center gap-1">
                              <input autoFocus type="text" inputMode="numeric" value={editValor} onChange={handleEditValorChange}
                                className="w-full px-1.5 py-1 border-2 border-violet-400 rounded text-xs font-bold text-right focus:outline-none" />
                              <button onClick={() => handleEditValorSave(l)} className="p-0.5 bg-violet-500 text-white rounded"><Check className="w-3 h-3" /></button>
                              <button onClick={() => setEditingId(null)} className="p-0.5 border rounded"><X className="w-3 h-3 text-slate-400" /></button>
                            </div>
                          ) : (
                            <div className="w-24 flex items-center justify-end gap-1">
                              <span className="text-xs font-bold text-emerald-600">R$ {Number(l.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              {!jaRepetido && (
                                <button onClick={() => { setEditingId(l.id); setEditValor(Number(l.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })); }}
                                  className="p-0.5 hover:bg-slate-100 rounded text-slate-400 hover:text-violet-600" title="Editar valor"><Pencil className="w-3 h-3" /></button>
                              )}
                            </div>
                          )}

                          {/* Ação */}
                          <div className="w-28 flex justify-center">
                            {jaRepetido ? (
                              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full flex items-center gap-1">
                                <Check className="w-3 h-3" /> Repetido
                              </span>
                            ) : (
                              <button onClick={() => handleRepetir(l)} disabled={repetindo === l.id}
                                className="flex items-center gap-1 px-3 py-1 bg-violet-500 text-white rounded-lg text-[11px] font-semibold hover:bg-violet-600 transition-colors disabled:opacity-50">
                                {repetindo === l.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Repeat2 className="w-3 h-3" />}
                                {repetindo === l.id ? '...' : 'Repetir'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Obs row */}
                        {!jaRepetido && (
                          <div className="mt-1 ml-0">
                            {editingObsId === l.id ? (
                              <div className="flex items-center gap-1 mt-0.5">
                                <input
                                  autoFocus
                                  type="text"
                                  value={editObsValue}
                                  onChange={e => setEditObsValue(e.target.value)}
                                  onKeyDown={e => { if (e.key === 'Enter') saveObsInline(l.id); if (e.key === 'Escape') setEditingObsId(null); }}
                                  placeholder="Adicionar observação..."
                                  className="flex-1 px-2 py-0.5 border border-violet-300 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-violet-400"
                                />
                                <button onClick={() => saveObsInline(l.id)} className="p-0.5 bg-violet-500 text-white rounded"><Check className="w-3 h-3" /></button>
                                <button onClick={() => setEditingObsId(null)} className="p-0.5 border rounded"><X className="w-3 h-3 text-slate-400" /></button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                {l.obs ? (
                                  <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded truncate max-w-[160px]" title={l.obs}>
                                    {l.obs}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-300">sem observação</span>
                                )}
                                <button
                                  onClick={() => openObsEdit(l)}
                                  className="p-0.5 hover:bg-slate-100 rounded text-slate-300 hover:text-amber-600 transition-colors flex-shrink-0"
                                  title={l.obs ? 'Editar observação' : 'Adicionar observação'}
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                {l.obs && (
                                  <button
                                    onClick={() => setDizimos(prev => prev.map(d => d.id === l.id ? { ...d, obs: null } : d))}
                                    className="p-0.5 hover:bg-red-50 rounded text-slate-300 hover:text-red-500 transition-colors flex-shrink-0"
                                    title="Remover observação"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {jaRepetido && l.obs && (
                          <p className="text-[10px] text-amber-600 mt-0.5 truncate">{l.obs}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/30 text-[11px] text-slate-400 dark:text-slate-500">
                  {dizimos.length} dízimo{dizimos.length !== 1 ? 's' : ''} • {repetidos.size} repetido{repetidos.size !== 1 ? 's' : ''}
                </div>
              </>
            )}
            </div>
          </div>
        )}
      </div>

      {/* Modal busca de igreja para Repetir Dízimos */}
      {showRepetirChurchModal && (
        <SearchModal
          title="Selecionar Igreja"
          placeholder="Digite o nome da igreja..."
          onClose={() => setShowRepetirChurchModal(false)}
          onSelect={item => { setRepetirChurchId(item.id); setRepetirChurchName(item.label); setShowRepetirChurchModal(false); setDizimos([]); setDizimosSearched(false); }}
          searchFn={async q => {
            const { data } = await supabase.from('churches').select('id, name').ilike('name', `%${q}%`).limit(30);
            return (data ?? []).map((c: any) => ({ id: c.id, label: c.name }));
          }}
        />
      )}

      {/* Modal editar observação */}
      {obsModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 text-sm">Editar Observação</h3>
              <button onClick={() => setObsModalId(null)} className="p-1 hover:bg-slate-100 rounded"><X className="w-4 h-4" /></button>
            </div>
            <textarea
              autoFocus
              value={obsModalValue}
              onChange={e => setObsModalValue(e.target.value)}
              rows={3}
              placeholder="Digite a observação..."
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
            />
            <p className="text-[10px] text-slate-400 mt-1">Esta edição é apenas local (cópia) — o registro original não será alterado.</p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setObsModalId(null)}
                className="flex-1 py-2 border border-slate-300 rounded-lg text-sm text-slate-600 hover:bg-slate-50">
                Cancelar
              </button>
              <button onClick={saveObsModal}
                className="flex-1 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700">
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* obs modal close */}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LancamentoNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const modoInit = (searchParams.get('tipo') === 'DESPESA' ? 'DESPESA' : 'RECEITA') as Modo;

  // ── Modo ──────────────────────────────────────────────────────────────────
  const [modo, setModo] = useState<Modo>(modoInit);

  // ── User/Igreja caixa ─────────────────────────────────────────────────────
  const userRaw = typeof window !== 'undefined' ? localStorage.getItem('mrm_user') : null;
  const userObj = (() => {
    try {
      return userRaw ? JSON.parse(userRaw) : null;
    } catch {
      return null;
    }
  })();
  const profileChurchId = typeof userObj?.churchId === 'string' ? userObj.churchId : '';
  const profileChurchName = typeof userObj?.churchName === 'string'
    ? userObj.churchName
    : typeof userObj?.church?.name === 'string'
      ? userObj.church.name
      : '';
  const [caixaId, setCaixaId] = useState<string>(profileChurchId);
  const [caixaNome, setCaixaNome] = useState<string>(profileChurchName);
  const [transferir, setTransferir] = useState(false);

  // ── Dados base ────────────────────────────────────────────────────────────
  const [churches, setChurches] = useState<Church[]>([]);
  const [planos, setPlanos] = useState<PlanoDeContas[]>([]);
  const [formas, setFormas] = useState<FormaPagamento[]>([]);
  const [tiposDocs, setTiposDocs] = useState<TipoDocumento[]>([]);
  const [lancamentosRecentes, setLancamentosRecentes] = useState<LancamentoRecente[]>([]);

  // ── Form ──────────────────────────────────────────────────────────────────
  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa>('MEMBRO');
  const [favorecidoId, setFavorecidoId] = useState('');
  const [favorecidoNome, setFavorecidoNome] = useState('');
  const [favorecidoRol, setFavorecidoRol] = useState<string | null>(null);
  const [naoMembroNome, setNaoMembroNome] = useState('');
  const [pjNome, setPjNome] = useState('');
  const [pjDoc, setPjDoc] = useState('');
  const [planoId, setPlanoId] = useState('');
  const [tipoDocId, setTipoDocId] = useState('');
  const [formaId, setFormaId] = useState('');
  const [numDoc, setNumDoc] = useState('');
  const [valor, setValor] = useState('');
  const [dataLancamento, setDataLancamento] = useState(new Date().toISOString().split('T')[0]);
  const [referencia, setReferencia] = useState(() => {
    const d = new Date();
    return `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  });
  const [obs, setObs] = useState('');
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showChurchModal, setShowChurchModal] = useState(false);
  const [showPJModal, setShowPJModal] = useState(false);
  const [showPJSearchModal, setShowPJSearchModal] = useState(false);
  const [showCaixaModal, setShowCaixaModal] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [reciboRow, setReciboRow] = useState<ReciboRow | null>(null);
  const [cashClosedMessage, setCashClosedMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // ── Load base data ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [c, f] = await Promise.all([
        supabase.from('churches').select('id, name').order('name').limit(500),
        supabase.from('forma_pagamento').select('id, nome').eq('mostrar', true).order('nome'),
      ]);
      if (c.data) setChurches(c.data);
      if (f.data) setFormas(f.data);
    })();
  }, []);

  useEffect(() => {
    if (!profileChurchId) return;
    if (caixaId !== profileChurchId) return;

    const matchedChurch = churches.find((church) => church.id === profileChurchId);
    const resolvedChurchName = matchedChurch?.name || profileChurchName;

    if (resolvedChurchName && resolvedChurchName !== caixaNome) {
      setCaixaNome(resolvedChurchName);
    }
  }, [caixaId, caixaNome, churches, profileChurchId, profileChurchName]);

  // Load planos e tiposDocs quando modo muda
  useEffect(() => {
    (async () => {
      setPlanoId('');
      setTipoDocId('');
      const tipo = modo;
      const [p, t] = await Promise.all([
        supabase.from('plano_de_contas').select('id, nome, codigo').eq('tipo', tipo).eq('ativo', true).order('nome'),
        supabase.from('tipo_documento').select('id, nome, sigla')
          .eq(modo === 'RECEITA' ? 'disponivel_receita' : 'disponivel_despesa', true)
          .eq('ativo', true).order('nome'),
      ]);
      if (p.data) setPlanos(p.data);
      if (t.data) {
        setTiposDocs(t.data.filter((doc: any) => {
          const nome = doc.nome.toUpperCase();
          const temReceita = nome.includes('RECEITA');
          const temDespesa = nome.includes('DESPESA');
          if (modo === 'RECEITA') return temReceita; // só docs com RECEITA no nome
          return temDespesa || (!temReceita && !temDespesa); // DESPESA + genéricos
        }));
      }
    })();
  }, [modo]);

  // Perfil do usuário para filtro
  const userProfileType: string = userObj?.profileType ?? 'church';
  const userCampoId: string = userObj?.campoId ?? '';

  // Load lançamentos recentes filtrado por perfil
  const loadRecentes = useCallback(async () => {
    let query = supabase
      .from('livro_caixa')
      .select('id, data_lancamento, tipo, valor, favorecido, plano_de_conta, num_doc, church_id')
      .order('created_at', { ascending: false })
      .limit(30);

    if (caixaId) {
      // Se uma caixa específica está selecionada, filtra por ela
      query = query.eq('church_id', caixaId);
    } else if (userProfileType === 'church' && userObj?.churchId) {
      // Perfil igreja: só vê sua própria igreja
      query = query.eq('church_id', userObj.churchId);
    } else if (userProfileType === 'campo' && userCampoId) {
      // Perfil campo: filtra igrejas do campo via join
      const { data: campoChurches } = await supabase
        .from('churches')
        .select('id')
        .eq('campo_id', userCampoId);
      const ids = (campoChurches ?? []).map((c: any) => c.id);
      if (ids.length > 0) query = query.in('church_id', ids);
    }
    const { data } = await query;
    if (data) setLancamentosRecentes(data as LancamentoRecente[]);
  }, [caixaId, userProfileType, userCampoId]);

  useEffect(() => { loadRecentes(); }, [loadRecentes]);

  // F2 / F4 keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'F2') { e.preventDefault(); setModo('RECEITA'); }
      if (e.key === 'F4') { e.preventDefault(); setModo('DESPESA'); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Search functions ──────────────────────────────────────────────────────
  async function searchMember(q: string) {
    const { data } = await supabase
      .from('members')
      .select('id, full_name, rol, church_id, churches(name)')
      .ilike('full_name', `%${q}%`)
      .limit(20);
    return (data ?? []).map((m: any) => ({
      id: m.id,
      label: m.full_name,
      sub: (m.rol ? `ROL ${m.rol} - ` : '') + (Array.isArray(m.churches) ? m.churches[0]?.name : m.churches?.name || ''),
    }));
  }

  async function searchChurch(q: string) {
    const { data } = await supabase
      .from('churches')
      .select('id, name')
      .ilike('name', `%${q}%`)
      .limit(20);
    return (data ?? []).map((c: { id: string; name: string }) => ({ id: c.id, label: c.name }));
  }

  // ── Foto ──────────────────────────────────────────────────────────────────
  function handleFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFotoFile(f);
    setFotoPreview(URL.createObjectURL(f));
  }

  // ── Clear form ────────────────────────────────────────────────────────────
  function limpar() {
    setFavorecidoId('');
    setFavorecidoNome('');
    setNaoMembroNome('');
    setPjNome('');
    setPjDoc('');
    setPlanoId('');
    setTipoDocId('');
    setFormaId('');
    setNumDoc('');
    setValor('');
    setDataLancamento(new Date().toISOString().split('T')[0]);
    const d = new Date();
    setReferencia(`${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
    setObs('');
    setFotoFile(null);
    setFotoPreview('');
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!caixaId) { setError('Igreja caixa não definida. Selecione uma igreja.'); return; }
    if (!planoId) { setError('Selecione o plano de contas.'); return; }
    if (!tipoDocId) { setError('Selecione o tipo de documento.'); return; }
    if (modo === 'DESPESA' && isBlank(numDoc)) { setError('Informe o número do documento para a despesa.'); return; }
    if (!formaId) { setError('Selecione a forma de pagamento.'); return; }
    if (isBlank(dataLancamento)) { setError('Informe a data do lançamento.'); return; }
    if (isBlank(referencia)) { setError('Informe a referência do lançamento.'); return; }

    const valorNum = Number(valor.replace(/\./g, '').replace(',', '.'));
    if (!valor || isNaN(valorNum) || valorNum <= 0) { setError('Informe um valor válido.'); return; }

    let favNome: string | null = null;
    let memId: string | null = null;

    if (tipoPessoa === 'MEMBRO') {
      favNome = favorecidoNome || null;
      memId = favorecidoId || null;
      if (!memId || isBlank(favNome)) { setError(isReceita ? 'Selecione o contribuinte membro.' : 'Selecione o beneficiado membro.'); return; }
    } else if (tipoPessoa === 'IGREJA') {
      favNome = favorecidoNome || null;
      if (!favorecidoId || isBlank(favNome)) { setError(isReceita ? 'Selecione a igreja contribuinte.' : 'Selecione a igreja beneficiada.'); return; }
    } else if (tipoPessoa === 'NAO_MEMBRO') {
      favNome = naoMembroNome.trim() || null;
      if (isBlank(favNome)) { setError(isReceita ? 'Informe o contribuinte.' : 'Informe o beneficiado.'); return; }
    } else if (tipoPessoa === 'PJ') {
      favNome = pjNome.trim() || null;
      if (isBlank(favNome)) { setError(isReceita ? 'Informe a pessoa jurídica contribuinte.' : 'Informe a pessoa jurídica beneficiada.'); return; }
      if (pjDoc && pjDoc.length === 36) {
        memId = pjDoc;
      }
    }

    const plano = planos.find(p => p.id === planoId);
    const forma = formas.find(f => f.id === formaId);
    const tipoDoc = tiposDocs.find(t => t.id === tipoDocId);
    const referenciaTrimmed = referencia.trim();
    const obsTrimmed = obs.trim();
    const numDocTrimmed = numDoc.trim();

    let duplicateQuery = supabase
      .from('livro_caixa')
      .select('id, obs')
      .eq('church_id', caixaId)
      .eq('tipo', modo)
      .eq('data_lancamento', dataLancamento)
      .eq('valor', valorNum)
      .eq('plano_de_conta', plano?.nome ?? null)
      .limit(5);

    if (memId) {
      duplicateQuery = duplicateQuery.eq('member_id', memId);
    } else {
      duplicateQuery = duplicateQuery
        .eq('tipo_pessoa', tipoPessoa)
        .eq('favorecido', favNome);
    }

    const { data: duplicateRows, error: duplicateError } = await duplicateQuery;
    if (duplicateError) {
      setError('Não foi possível validar duplicidade antes de salvar.');
      return;
    }

    if (duplicateRows?.length) {
      if (!obsTrimmed) {
        setError('Já existe um lançamento com a mesma data, valor e favorecido/beneficiado. Se for intencional, informe uma observação para diferenciar este registro.');
        return;
      }

      const sameObservation = duplicateRows.some((row) => normalizeText(row.obs) === normalizeText(obsTrimmed));
      if (sameObservation) {
        setError('Foi encontrada uma repetição com a mesma observação. Informe uma observação diferente para permitir este lançamento duplicado.');
        return;
      }
    }

    const cashStatus = await checkChurchCashStatus(caixaId, dataLancamento);
    if (!cashStatus.canInsert) { setCashClosedMessage(cashStatus.message); return; }

    setSaving(true);
    let fotoUrl: string | null = null;

    if (fotoFile && modo === 'DESPESA') {
      try {
        const token = localStorage.getItem('mrm_token');
        const formData = new FormData();
        formData.append('file', fotoFile);
        const res = await fetch(`${apiBase}/upload/foto-despesa`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Erro no upload' }));
          setSaving(false);
          setError('Erro ao enviar foto: ' + (err.error || res.statusText));
          return;
        }
        const result = await res.json();
        fotoUrl = result.url;
      } catch (err: any) {
        setSaving(false);
        setError('Erro ao enviar foto: ' + (err?.message || 'Erro desconhecido'));
        return;
      }
    }

    const { data: inserted, error: err } = await supabase.from('livro_caixa').insert({
      church_id: caixaId,
      data_lancamento: dataLancamento,
      tipo: modo,
      valor: valorNum,
      tipo_pessoa: tipoPessoa,
      favorecido: favNome,
      member_id: memId,
      plano_de_conta: plano?.nome ?? null,
      forma_pg: forma?.nome ?? null,
      tipo_documento: tipoDoc?.nome ?? null,
      num_doc: numDocTrimmed || null,
      referencia: referenciaTrimmed || null,
      obs: obsTrimmed || null,
      foto: fotoUrl,
      id_favorecido_externo: tipoPessoa === 'PJ' && pjDoc ? pjDoc : null,
    }).select('id, legacy_id').single();
    setSaving(false);

    if (err) { setError('Erro ao salvar: ' + err.message); return; }

    // Abre recibo automaticamente
    setReciboRow({
      id: inserted?.id ?? '',
      legacy_id: inserted?.legacy_id ?? null,
      data_lancamento: dataLancamento,
      tipo: modo,
      valor: valorNum,
      favorecido: favNome,
      rol: tipoPessoa === 'MEMBRO' ? (favorecidoRol ?? null) : null,
      plano_de_conta: plano?.nome ?? null,
      categoria: plano?.nome ?? null,
      forma_pg: forma?.nome ?? null,
      referencia: referenciaTrimmed || null,
      obs: obsTrimmed || null,
      foto: fotoUrl,
      num_doc: numDocTrimmed || null,
      tipo_documento: tipoDoc?.nome ?? null,
      member_id: memId,
      churches: { name: caixaNome },
    });
    loadRecentes();
  }

  // ── Valor formatting ──────────────────────────────────────────────────
  function handleValorChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, '');
    if (!raw) { setValor(''); return; }
    const num = parseInt(raw, 10) / 100;
    setValor(num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const isReceita = modo === 'RECEITA';
  const accentBg = isReceita ? 'bg-emerald-600' : 'bg-red-600';
  const accentHover = isReceita ? 'hover:bg-emerald-700' : 'hover:bg-red-700';
  const accentRing = isReceita ? 'focus:ring-emerald-500' : 'focus:ring-red-500';
  const accentBorder = isReceita ? 'border-emerald-500' : 'border-red-500';
  const accentBar = isReceita ? 'bg-emerald-500' : 'bg-red-500';

  async function searchPJ(q: string) {
    // Busca PJs na tabela members
    const { data: membersData } = await supabase
      .from('members')
      .select('id, full_name, fantasy_name, cnpj, cpf')
      .eq('member_type', 'PJ')
      .or(`full_name.ilike.%${q}%,fantasy_name.ilike.%${q}%`)
      .limit(20);

    // Busca em lançamentos anteriores com tipo_pessoa PJ
    const { data: caixaData } = await supabase
      .from('livro_caixa')
      .select('id, favorecido, id_favorecido_externo')
      .eq('tipo_pessoa', 'PJ')
      .ilike('favorecido', `%${q}%`)
      .not('favorecido', 'is', null)
      .limit(20);

    // Deduplicate by name
    const seen = new Set<string>();
    const results: { id: string; label: string; sub?: string }[] = [];

    (membersData ?? []).forEach((m: any) => {
      const nome = m.fantasy_name || m.full_name;
      if (nome && !seen.has(nome.toLowerCase())) {
        seen.add(nome.toLowerCase());
        results.push({ id: m.id, label: nome, sub: m.full_name !== nome ? m.full_name : undefined });
      }
    });

    (caixaData ?? []).forEach((r: any) => {
      if (r.favorecido && !seen.has(r.favorecido.toLowerCase())) {
        seen.add(r.favorecido.toLowerCase());
        results.push({ id: r.id_favorecido_externo || r.id, label: r.favorecido });
      }
    });

    return results;
  }

  return (
    <div className="p-4 flex flex-col lg:flex-row gap-4 min-h-0 w-full">

      {/* ── LEFT: form ─────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link to="/app-ui/finance/cashbook" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isReceita ? 'bg-emerald-100' : 'bg-red-100'}`}>
            <span className={`font-bold text-base ${isReceita ? 'text-emerald-600' : 'text-red-600'}`}>{isReceita ? '+' : '−'}</span>
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">{isReceita ? 'Inserir Receita' : 'Inserir Despesa'}</h1>
            <p className="text-xs text-slate-400 hidden sm:block">Preencha os dados abaixo</p>
          </div>
          <div className="ml-auto flex flex-col sm:flex-row flex-shrink-0 gap-1">
            <button type="button" onClick={() => setModo('RECEITA')}
              className={`px-3 py-1.5 rounded-lg sm:rounded-l-lg sm:rounded-r-none text-xs font-bold border transition-colors ${isReceita ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'}`}>
              RECEITA (F2)
            </button>
            <button type="button" onClick={() => setModo('DESPESA')}
              className={`px-3 py-1.5 rounded-lg sm:rounded-r-lg sm:rounded-l-none text-xs font-bold border sm:border-l-0 transition-colors ${!isReceita ? 'bg-red-600 text-white border-red-600' : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600'}`}>
              DESPESA (F4)
            </button>
            <button
              type="button"
              onClick={() => setShowPanel(v => !v)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title={showPanel ? 'Fechar painel lateral' : 'Abrir painel lateral'}
            >
              {showPanel ? <PanelRightClose className="w-5 h-5 text-slate-600" /> : <PanelRightOpen className="w-5 h-5 text-slate-600" />}
            </button>
          </div>
        </div>

        {/* Indicador modo */}
        <div className={`h-1 rounded-full ${accentBar}`} />

        {/* Caixa de Origem */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <ChurchIcon className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide">CAIXA DE ORIGEM</p>
                <button type="button" onClick={() => setShowCaixaModal(true)}
                  className="font-bold text-slate-800 dark:text-slate-100 text-sm hover:text-indigo-600 transition-colors truncate text-left w-full">
                  {caixaNome || 'Selecione uma igreja'}
                </button>
              </div>
              {caixaId && <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex-shrink-0">ATIVA</span>}

              {/* Toggle transferir */}
              <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                <span className="text-xs text-slate-400 hidden sm:block">Outra igreja</span>
                <div onClick={() => setTransferir(v => !v)} className="cursor-pointer">
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${transferir ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${transferir ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Buscar outra igreja (quando transferir ativo) */}
          {transferir && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <button type="button" onClick={() => setShowCaixaModal(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 border border-dashed border-indigo-300 rounded-lg text-sm text-indigo-600 hover:bg-indigo-50 transition-colors">
                <Search className="w-4 h-4" />
                {caixaNome ? `Alterar: ${caixaNome}` : 'Buscar igreja...'}
              </button>
            </div>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 space-y-4">

            {/* Favorecido */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                {isReceita ? 'Favorecido / Contribuinte' : 'Favorecido / Beneficiado'}
              </p>
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mb-3">
                {([
                  { key: 'MEMBRO', label: 'Membro', icon: User },
                  { key: 'IGREJA', label: 'Igreja', icon: ChurchIcon },
                  { key: 'NAO_MEMBRO', label: 'Não Membro', icon: Users },
                  { key: 'PJ', label: 'Jurídica', icon: Briefcase },
                ] as const).map(({ key, label, icon: Icon }) => (
                  <button key={key} type="button"
                    onClick={() => {
                      setTipoPessoa(key);
                      setFavorecidoId('');
                      setFavorecidoNome('');
                      setFavorecidoRol(null);
                      if (key === 'MEMBRO') setShowMemberModal(true);
                      else if (key === 'IGREJA') setShowChurchModal(true);
                      else if (key === 'PJ') setShowPJSearchModal(true);
                    }}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${tipoPessoa === key ? `${accentBg} text-white border-transparent` : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}>
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />{label}
                  </button>
                ))}
              </div>

              {(tipoPessoa === 'MEMBRO' || tipoPessoa === 'IGREJA') && (
                <div className="w-full flex items-center gap-2 px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-slate-50 dark:bg-slate-700">
                  <span className={`flex-1 ${favorecidoNome ? 'text-slate-800 font-medium' : 'text-slate-400'}`}>
                    {favorecidoNome || (tipoPessoa === 'MEMBRO' ? 'Nenhuma seleção' : 'Nenhuma seleção')}
                  </span>
                  {favorecidoNome ? (
                    <button type="button" onClick={() => { setFavorecidoId(''); setFavorecidoNome(''); setFavorecidoRol(null); }}
                      className="p-0.5 hover:bg-slate-200 rounded flex-shrink-0"><X className="w-3 h-3 text-slate-500" /></button>
                  ) : null}
                </div>
              )}

              {tipoPessoa === 'NAO_MEMBRO' && (
                <input type="text" value={naoMembroNome} onChange={e => setNaoMembroNome(e.target.value)}
                  placeholder="Nome do contribuinte / favorecido..."
                  className={`w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 ${accentRing}`} />
              )}

              {tipoPessoa === 'PJ' && (
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" value={pjNome} onChange={e => setPjNome(e.target.value)}
                      placeholder="Nome da empresa..."
                      className={`w-full pl-9 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 ${accentRing}`} />
                  </div>
                  <button type="button" onClick={() => setShowPJModal(true)}
                    className="px-3 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors" title="Cadastrar nova PJ">
                    <Plus className="w-4 h-4 text-slate-600" />
                  </button>
                  <button type="button" onClick={() => setShowPJSearchModal(true)}
                    className="px-3 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors" title="Buscar PJ existente">
                    <Search className="w-4 h-4 text-slate-600" />
                  </button>
                </div>
              )}
            </div>

            {/* Campos principais */}
            <div className="space-y-3">
              {/* Plano de Contas — linha inteira */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Plano de Contas</label>
                <SearchableSelect 
                  value={planoId} 
                  onChange={setPlanoId}
                  options={planos.map(p => ({ id: p.id, label: p.nome }))}
                  placeholder="Selecione a categoria..."
                  className={`w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 ${accentRing} bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600`}
                />
              </div>
              {/* Documento + Nº Doc lado a lado */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Documento</label>
                  <select value={tipoDocId} onChange={e => setTipoDocId(e.target.value)}
                    className={`w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 ${accentRing} bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600`}>
                    <option value="">Tipo...</option>
                    {tiposDocs.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Nº Doc</label>
                  <input type="text" value={numDoc} onChange={e => setNumDoc(e.target.value)}
                    placeholder={modo === 'DESPESA' ? 'Requerido' : 'Opcional'}
                    className={`w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 ${accentRing}`} />
                </div>
              </div>
              {/* Forma Pgto — linha inteira */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Forma de Pagamento</label>
                <select value={formaId} onChange={e => setFormaId(e.target.value)}
                  className={`w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 ${accentRing} bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600`}>
                  <option value="">Selecione...</option>
                  {formas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              </div>
            </div>

            {/* Datas + valor */}
            <div className="space-y-3">
              {/* Data + Referência lado a lado */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Data Lançamento</label>
                  <input type="date" value={dataLancamento} onChange={e => setDataLancamento(e.target.value)} required
                    className={`w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 ${accentRing}`} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Referência (Mês/Ano)</label>
                  <input type="text" value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="MM/AAAA"
                    className={`w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 ${accentRing}`} />
                </div>
              </div>
              {/* Obs + Valor lado a lado */}
              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Observações (Opcional)</label>
                  <input type="text" value={obs} onChange={e => setObs(e.target.value)} placeholder="Detalhes adicionais..."
                    className={`w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 ${accentRing}`} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Valor (R$)</label>
                  <input type="text" inputMode="numeric" value={valor} onChange={handleValorChange} placeholder="0,00" required
                    className={`w-full px-3 py-2.5 border-2 ${accentBorder} rounded-lg text-sm font-bold text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${accentRing}`} />
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <p className="text-sm text-emerald-700">Lançamento registrado com sucesso!</p>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              {/* Comprovante (DESPESA) inline */}
              {modo === 'DESPESA' && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {fotoPreview ? (
                    <>
                      <img src={fotoPreview} alt="comprovante" className="w-8 h-8 object-cover rounded-lg border border-slate-200" />
                      <button type="button" onClick={() => { setFotoFile(null); setFotoPreview(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                        className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-red-500 transition-colors" title="Remover foto">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-2.5 py-2 border border-dashed border-slate-300 rounded-lg text-xs text-slate-500 hover:border-red-400 hover:bg-slate-50 transition-colors whitespace-nowrap">
                      <Camera className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="hidden xs:inline">Foto</span>
                    </button>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFoto} className="hidden" />
                </div>
              )}
              <div className="flex-1" />
              <button type="button" onClick={limpar}
                className="flex items-center gap-1.5 px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-600 hover:bg-slate-50 transition-colors whitespace-nowrap">
                <RotateCcw className="w-3.5 h-3.5" /> Limpar
              </button>
              <button type="submit" disabled={saving}
                className={`flex items-center gap-1.5 px-4 py-2 ${accentBg} ${accentHover} text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-60 whitespace-nowrap`}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ── RIGHT: Histórico + Repetir ──────────────────────────────────── */}
      {showPanel && (
        <HistoricoPanel
          lancamentosRecentes={lancamentosRecentes}
          loadRecentes={loadRecentes}
          onClearHistory={() => setLancamentosRecentes([])}
          caixaId={caixaId}
          currentModo={modo}
          onRepetir={(l) => {
            // Preenche o formulário com os dados do lançamento
            setModo(l.tipo as Modo);
            if (l.plano_de_conta) {
              const p = planos.find(x => x.nome === l.plano_de_conta);
              if (p) setPlanoId(p.id);
            }
            setValor(Number(l.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
            if (l.favorecido) { setTipoPessoa('NAO_MEMBRO'); setNaoMembroNome(l.favorecido); }
            loadRecentes();
          }}
          onReciboReady={row => setReciboRow(row)}
        />
      )}

      {/* ── Modais ── */}
      {showMemberModal && (
        <SearchModal title="Buscar Membro" placeholder="Digite o nome do membro..."
          searchFn={searchMember}
          onSelect={item => {
            setFavorecidoId(item.id);
            setFavorecidoNome(item.label);
            // extrai ROL do sub: "ROL 123 - Igreja"
            const rolMatch = item.sub?.match(/ROL\s+(\S+)/i);
            setFavorecidoRol(rolMatch ? rolMatch[1] : null);
            setShowMemberModal(false);
          }}
          onClose={() => setShowMemberModal(false)} />
      )}
      {showChurchModal && (
        <SearchModal title="Buscar Igreja" placeholder="Digite o nome da igreja..."
          searchFn={searchChurch}
          onSelect={item => { setFavorecidoId(item.id); setFavorecidoNome(item.label); setShowChurchModal(false); }}
          onClose={() => setShowChurchModal(false)} />
      )}
      {showCaixaModal && (
        <SearchModal title="Selecionar Igreja Caixa" placeholder="Digite o nome da igreja..."
          searchFn={searchChurch}
          onSelect={item => { setCaixaId(item.id); setCaixaNome(item.label); setShowCaixaModal(false); setTransferir(false); }}
          onClose={() => setShowCaixaModal(false)} />
      )}
      {showPJSearchModal && (
        <SearchModal title="Buscar Pessoa Jurídica" placeholder="Digite o nome da empresa..."
          searchFn={searchPJ}
          onSelect={item => { setPjNome(item.label); setPjDoc(item.id); setShowPJSearchModal(false); }}
          onClose={() => setShowPJSearchModal(false)} />
      )}
      <MemberQuickCreateModal 
        open={showPJModal}
        type="PJ"
        initialChurchId={caixaId}
        availableChurches={churches.map(c => ({ id: c.id, name: c.name }))}
        onCreated={created => {
          setPjNome(created.fantasyName || created.fullName);
          setPjDoc(created.id);
          setShowPJModal(false);
        }}
        onClose={() => setShowPJModal(false)}
      />
      {reciboRow && (
        <ReciboModal
          row={reciboRow}
          onClose={() => { setReciboRow(null); setSuccess(true); setTimeout(() => { setSuccess(false); limpar(); }, 500); }}
          onUpdated={(id, changes) => setReciboRow(prev => prev ? { ...prev, ...changes } : prev)}
        />
      )}
      {cashClosedMessage && (
        <CashClosedModal
          message={cashClosedMessage}
          onClose={() => setCashClosedMessage('')}
        />
      )}
    </div>
  );
}
