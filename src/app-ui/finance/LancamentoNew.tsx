import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Search, X, Plus, CheckCircle, AlertCircle, User, Users, Briefcase, Camera, RotateCcw, RefreshCw, Repeat2, Pencil, Check, PanelRightOpen, PanelRightClose, Sparkles } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { supabase } from '../../lib/supabaseClient';
import { apiBase } from '../../lib/apiBase';
import { checkChurchCashStatus } from '../../lib/financeCashStatus';
import { ReciboModal } from './ReciboModal';
import type { ReciboRow } from './ReciboModal';
import { MemberQuickCreateModal } from '../../components/app-ui/MemberQuickCreateModal';
import { convertToJpeg } from '../../lib/imageConverter';

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
  church_id?: string | null;
  church_name?: string | null;
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
  onSelect: (item: { id: string; label: string; sub?: string }) => void;
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
  lancamentosRecentes, loadRecentes, onClearHistory, caixaId, currentModo, onRepetir, onReciboReady, setCashClosedMessage, defaultTab = 'historico',
}: {
  lancamentosRecentes: LancamentoRecente[];
  loadRecentes: () => void;
  onClearHistory: () => void;
  caixaId: string;
  currentModo: string;
  onRepetir: (l: LancamentoRecente) => void;
  onReciboReady: (row: ReciboRow) => void;
  setCashClosedMessage: (msg: string) => void;
  defaultTab?: 'historico' | 'repetir';
}) {
  const [activeTab, setActiveTab] = useState<'historico' | 'repetir'>(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

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

    const operadorRepetir: string | null = userObjPanel?.fullName || userObjPanel?.email || null;

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
      operador: operadorRepetir,
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
        operador: operadorRepetir,
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
    <div className="w-full flex flex-col gap-2">
      {repeatError && (
        <div className="rounded-[4px] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {repeatError}
        </div>
      )}
      <div className="flex flex-col flex-1" style={{ minHeight: '350px' }}>

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
  const isChurchUser = userObj?.profileType === 'church';
  const operadorNome: string | null = userObj?.fullName || userObj?.email || null;
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
  const [showHistoricoRepetirModal, setShowHistoricoRepetirModal] = useState(false);
  const [modalTab, setModalTab] = useState<'historico' | 'repetir'>('historico');
  const [reciboRow, setReciboRow] = useState<ReciboRow | null>(null);
  const [cashClosedMessage, setCashClosedMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [duplicateTransactionModal, setDuplicateTransactionModal] = useState<{
    show: boolean;
    message: string;
    solution: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // ── AI Reading State ──
  const [aiReading, setAiReading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [aiFavType, setAiFavType] = useState<TipoPessoa>('PJ');
  const fileInputAiRef = useRef<HTMLInputElement>(null);

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  async function handleAiFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setAiFile(f);
    setAiReading(true);
    setError('');
    setAiResult(null);
    try {
      const base64 = await convertToBase64(f);
      const token = localStorage.getItem('mrm_token');
      const res = await fetch(`${apiBase}/ai/read-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ image: base64 }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao ler o documento.');
      }

      const data = await res.json();
      setAiResult(data);
      setAiFavType('PJ'); // Default para PJ em despesas
      setShowAiModal(true);
    } catch (err: any) {
      setError('Erro na leitura com IA: ' + err.message);
    } finally {
      setAiReading(false);
      if (fileInputAiRef.current) fileInputAiRef.current.value = '';
    }
  }

  function handleApproveAi() {
    if (!aiResult) return;
    if (aiFile) {
      setFotoFile(aiFile);
      setFotoPreview(URL.createObjectURL(aiFile));
    }
    
    // Preencher valor formatado (trocando ponto por vírgula)
    if (aiResult.valor !== undefined) {
      const valNum = Number(aiResult.valor);
      setValor(isNaN(valNum) ? String(aiResult.valor || '').replace('.', ',') : valNum.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }

    if (aiResult.data_lancamento) {
      setDataLancamento(aiResult.data_lancamento);
    }

    if (aiResult.referencia) {
      setReferencia(aiResult.referencia);
    }

    if (aiResult.num_doc) {
      setNumDoc(aiResult.num_doc);
    }

    if (aiResult.observacao) {
      setObs(aiResult.observacao);
    }

    // Set tipo pessoa e nome do favorecido conforme selecionado no modal
    setTipoPessoa(aiFavType);
    if (aiFavType === 'PJ') {
      setPjNome(aiResult.favorecido || '');
    } else if (aiFavType === 'NAO_MEMBRO') {
      setNaoMembroNome(aiResult.favorecido || '');
    } else {
      setFavorecidoNome(aiResult.favorecido || '');
    }

    setShowAiModal(false);
  }

  // ── Load base data ────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      let churchQuery = supabase.from('churches').select('id, name').order('name').limit(500);
      if (userProfileType !== 'master' && userProfileType !== 'admin') {
        if (userProfileType === 'campo' && userCampoId) {
          churchQuery = churchQuery.eq('campo_id', userCampoId);
        } else if (profileChurchId) {
          churchQuery = churchQuery.eq('id', profileChurchId);
        }
      }
      const [c, f] = await Promise.all([
        churchQuery,
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
      .select('id, data_lancamento, tipo, valor, favorecido, plano_de_conta, num_doc, church_id, churches(name)')
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
    if (data) {
      const mapped = (data as any[]).map(row => ({
        ...row,
        church_name: row.churches?.name ?? null,
      }));
      setLancamentosRecentes(mapped as LancamentoRecente[]);
    }
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

  // Retorna null = sem filtro (master/admin); array vazio = sem acesso; array com ids = escopo permitido
  async function resolveAllowedChurchIds(): Promise<string[] | null> {
    if (userProfileType === 'master' || userProfileType === 'admin') return null;
    // Perfil campo: acesso amplo a todas as igrejas do campo via join regionais → churches
    if (userProfileType === 'campo' && userCampoId) {
      const { data: regs } = await supabase.from('regionais').select('id').eq('campo_id', userCampoId);
      const regIds = (regs ?? []).map((r: any) => r.id);
      if (regIds.length === 0) return [];
      const { data } = await supabase.from('churches').select('id').in('regional_id', regIds);
      return (data ?? []).map((c: any) => c.id);
    }
    // Perfil igreja: restringe ao caixa ativo ou à própria igreja
    if (caixaId) return [caixaId];
    if (userObj?.churchId) return [userObj.churchId];
    return [];
  }

  async function searchMember(q: string) {
    const trimmed = q.trim();
    const isRol = /^\d+$/.test(trimmed);
    const allowedIds = await resolveAllowedChurchIds();
    if (allowedIds !== null && allowedIds.length === 0) return [];
    let query = supabase
      .from('members')
      .select('id, full_name, rol, church_id, churches(name)')
      .limit(20);
    if (allowedIds !== null && allowedIds.length > 0) {
      query = query.in('church_id', allowedIds);
    }
    if (isRol) {
      query = query.eq('rol', parseInt(trimmed, 10));
    } else {
      query = query.ilike('full_name', `%${trimmed}%`);
    }
    const { data } = await query;
    return (data ?? []).map((m: any) => ({
      id: m.id,
      label: m.full_name,
      sub: (m.rol ? `ROL ${m.rol} - ` : '') + (Array.isArray(m.churches) ? m.churches[0]?.name : m.churches?.name || ''),
    }));
  }

  async function searchChurch(q: string) {
    const allowedChurchIds = await resolveAllowedChurchIds();
    let query = supabase.from('churches').select('id, name').ilike('name', `%${q}%`).limit(20);
    if (allowedChurchIds !== null && allowedChurchIds.length > 0) {
      query = query.in('id', allowedChurchIds);
    } else if (allowedChurchIds !== null && allowedChurchIds.length === 0) {
      return [];
    }
    const { data } = await query;
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

  // Limpa apenas valor e observação após salvar, mantendo favorecido/igreja/campos de configuração
  function limparAposSalvar() {
    setValor('');
    setObs('');
    setFotoFile(null);
    setFotoPreview('');
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Ignora submits disparados por botões dentro dos modais (ReciboModal, etc.)
    // que ficam dentro da <form> mas não têm type="button"
    if (reciboRow || cashClosedMessage || duplicateTransactionModal?.show || showHistoricoRepetirModal) return;
    setError('');
    setSaving(true);

    const handleFail = (msg: string) => {
      setError(msg);
      setSaving(false);
    };

    if (!caixaId) { handleFail('Igreja caixa não definida. Selecione uma igreja.'); return; }
    if (!planoId) { handleFail('Selecione o plano de contas.'); return; }
    if (!tipoDocId) { handleFail('Selecione o tipo de documento.'); return; }
    if (modo === 'DESPESA' && isBlank(numDoc)) { handleFail('Informe o número do documento para a despesa.'); return; }
    if (!formaId) { handleFail('Selecione a forma de pagamento.'); return; }
    if (isBlank(dataLancamento)) { handleFail('Informe a data do lançamento.'); return; }
    if (isBlank(referencia)) { handleFail('Informe a referência do lançamento.'); return; }

    const valorNum = Number(valor.replace(/\./g, '').replace(',', '.'));
    if (!valor || isNaN(valorNum) || valorNum <= 0) { handleFail('Informe um valor válido.'); return; }

    let favNome: string | null = null;
    let memId: string | null = null;

    if (tipoPessoa === 'MEMBRO') {
      favNome = favorecidoNome || null;
      memId = favorecidoId || null;
      if (!memId || isBlank(favNome)) { handleFail(isReceita ? 'Selecione o contribuinte membro.' : 'Selecione o beneficiado membro.'); return; }
    } else if (tipoPessoa === 'IGREJA') {
      favNome = favorecidoNome || null;
      if (!favorecidoId || isBlank(favNome)) { handleFail(isReceita ? 'Selecione a igreja contribuinte.' : 'Selecione a igreja beneficiada.'); return; }
    } else if (tipoPessoa === 'NAO_MEMBRO') {
      favNome = naoMembroNome.trim() || null;
      if (isBlank(favNome)) { handleFail(isReceita ? 'Informe o contribuinte.' : 'Informe o beneficiado.'); return; }
    } else if (tipoPessoa === 'PJ') {
      favNome = pjNome.trim() || null;
      if (isBlank(favNome)) { handleFail(isReceita ? 'Informe a pessoa jurídica contribuinte.' : 'Informe a pessoa jurídica beneficiada.'); return; }
      // memId fica null para PJ — o ID da entidade jurídica vai em id_favorecido_externo
    }

    const plano = planos.find(p => p.id === planoId);
    const forma = formas.find(f => f.id === formaId);
    const tipoDoc = tiposDocs.find(t => t.id === tipoDocId);
    const referenciaTrimmed = referencia.trim();
    const obsTrimmed = obs.trim();
    const numDocTrimmed = numDoc.trim();

    let duplicateQuery = supabase
      .from('livro_caixa')
      .select('id, obs, num_doc')
      .eq('church_id', caixaId)
      .eq('tipo', modo)
      .eq('data_lancamento', dataLancamento)
      .eq('valor', valorNum)
      .limit(5);

    if (memId) {
      duplicateQuery = duplicateQuery.eq('member_id', memId);
    } else {
      duplicateQuery = duplicateQuery
        .eq('tipo_pessoa', tipoPessoa)
        .eq('favorecido', favNome);
    }

    if (numDocTrimmed) {
      duplicateQuery = duplicateQuery.eq('num_doc', numDocTrimmed);
    } else {
      duplicateQuery = duplicateQuery.is('num_doc', null);
    }

    const { data: duplicateRows, error: duplicateError } = await duplicateQuery;
    if (duplicateError) {
      handleFail('Não foi possível validar duplicidade antes de salvar.');
      return;
    }

    if (duplicateRows?.length) {
      const sameObservation = duplicateRows.some((row) => normalizeText(row.obs) === normalizeText(obsTrimmed));
      if (sameObservation) {
        setSaving(false);
        setDuplicateTransactionModal({
          show: true,
          message: 'Lançamento Duplicado Detectado!',
          solution: 'Já existe um lançamento cadastrado exatamente com os mesmos dados (valor, pessoa, data, número de documento e observação).'
        });
        return;
      }
    }

    const cashStatus = await checkChurchCashStatus(caixaId, dataLancamento);
    if (!cashStatus.canInsert) {
      setCashClosedMessage(cashStatus.message);
      setSaving(false);
      return;
    }

    setSaving(true);
    let fotoUrl: string | null = null;

    if (fotoFile) {
      try {
        const convertedFile = await convertToJpeg(fotoFile);
        const token = localStorage.getItem('mrm_token');
        const formData = new FormData();
        formData.append('file', convertedFile);
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
      operador: operadorNome,
    }).select('id, legacy_id').single();
    setSaving(false);

    if (err) {
      const msg = err.message || '';
      if (msg.includes('livro_caixa_member_id_fkey')) {
        setError('O membro selecionado não foi encontrado no cadastro. Verifique se o membro está ativo e tente novamente.');
      } else if (msg.includes('foreign key') || msg.includes('violates')) {
        setError('Referência inválida: um dos campos selecionados não existe no sistema. Verifique os dados e tente novamente.');
      } else {
        setError('Erro ao salvar lançamento: ' + msg);
      }
      return;
    }

    // Limpa campos voláteis para evitar re-submit duplicado
    limparAposSalvar();

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
      operador: operadorNome,
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
  const accentBg = isReceita ? 'bg-[#059669]' : 'bg-red-600';
  const accentHover = isReceita ? 'hover:bg-[#047857]' : 'hover:bg-red-700';
  const accentRing = isReceita ? 'focus:ring-[#10b981]' : 'focus:ring-red-500';
  const accentBorder = isReceita ? 'border-[#10b981]' : 'border-red-500';
  const accentBar = isReceita ? 'bg-[#10b981]' : 'bg-red-500';

  async function searchPJ(q: string) {
    const allowedChurchIds = await resolveAllowedChurchIds();

    let membersQuery = supabase
      .from('members')
      .select('id, full_name, fantasy_name, cnpj, cpf, church_id')
      .eq('member_type', 'PJ')
      .or(`full_name.ilike.%${q}%,fantasy_name.ilike.%${q}%`)
      .limit(20);
    if (allowedChurchIds !== null && allowedChurchIds.length > 0) {
      membersQuery = membersQuery.in('church_id', allowedChurchIds);
    } else if (allowedChurchIds !== null && allowedChurchIds.length === 0) {
      return [];
    }
    const { data: membersData } = await membersQuery;

    let caixaQuery = supabase
      .from('livro_caixa')
      .select('id, favorecido, id_favorecido_externo, church_id')
      .eq('tipo_pessoa', 'PJ')
      .ilike('favorecido', `%${q}%`)
      .not('favorecido', 'is', null)
      .limit(20);
    if (allowedChurchIds !== null && allowedChurchIds.length > 0) {
      caixaQuery = caixaQuery.in('church_id', allowedChurchIds);
    }
    const { data: caixaData } = await caixaQuery;

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

  const formatData = (dtStr: string) => {
    if (!dtStr) return '—';
    const parts = dtStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dtStr;
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 pt-3 pb-3 flex flex-col gap-3 w-full bg-[#fefefe] dark:bg-slate-900 text-slate-800 dark:text-slate-100">
      {/* Header row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/app-ui/finance/cashbook" className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center hover:bg-slate-50 transition-colors flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-[#064e3b] dark:text-emerald-400 leading-tight">
              {isReceita ? 'Inserir Receita' : 'Inserir Despesa'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isReceita ? 'Preencha os dados abaixo para lançar uma nova receita' : 'Preencha os dados abaixo para lançar uma nova despesa'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => setModo('RECEITA')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-[4px] text-xs font-bold transition-colors ${isReceita ? 'bg-[#059669] text-white border border-[#059669]' : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600 hover:bg-slate-50'}`}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
            RECEITA (F2)
          </button>
          <button type="button" onClick={() => setModo('DESPESA')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-[4px] text-xs font-bold transition-colors ${!isReceita ? 'bg-red-600 text-white border border-red-600' : 'bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600 hover:bg-slate-50'}`}>
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
            DESPESA (F4)
          </button>
        </div>
      </div>

      {/* Caixa de Origem row */}
      <div className="bg-white dark:bg-slate-800 rounded-[4px] border border-slate-200 dark:border-slate-700 p-3 py-2 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center flex-shrink-0">
            <ChurchIcon className="w-5 h-5 text-pink-600 dark:text-pink-400" />
          </div>
          <div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold tracking-wider uppercase">CAIXA DE ORIGEM</p>
            <div className="flex items-center gap-2">
              {isChurchUser ? (
                <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                  {caixaNome || 'Igreja não definida'}
                </span>
              ) : (
                <button type="button" onClick={() => setShowCaixaModal(true)}
                  className="font-bold text-slate-800 dark:text-slate-100 text-sm hover:text-indigo-600 transition-colors text-left">
                  {caixaNome || 'Selecione uma igreja'}
                </button>
              )}
              {caixaId && <span className="text-[9px] font-bold bg-[#d1fae5] text-[#047857] dark:bg-emerald-950 dark:text-emerald-400 px-2 py-0.5 rounded-[4px]">ATIVA</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {!isChurchUser && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">Outra igreja</span>
              <div onClick={() => setTransferir(v => !v)} className="cursor-pointer">
                <div className={`w-10 h-5 rounded-full relative transition-colors ${transferir ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${transferir ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {transferir && (
        <div className="bg-white dark:bg-slate-800 rounded-[4px] border border-slate-200 dark:border-slate-700 p-3 shadow-sm -mt-3">
          <button type="button" onClick={() => setShowCaixaModal(true)}
            className="w-full flex items-center gap-2 px-3 py-2 border border-dashed border-indigo-300 rounded-[4px] text-sm text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-colors">
            <Search className="w-4 h-4" />
            {caixaNome ? `Alterar: ${caixaNome}` : 'Buscar igreja...'}
          </button>
        </div>
      )}

      {/* Two Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {/* Left Form */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-[4px] border border-slate-200 dark:border-slate-700 p-4 py-3 shadow-sm">
          {/* Favorecido Section */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white ${isReceita ? 'bg-[#059669]' : 'bg-red-600'}`}>
                {tipoPessoa === 'MEMBRO' ? <User className="w-4.5 h-4.5" /> : <Users className="w-4.5 h-4.5" />}
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Favorecido / Contribuinte</h2>
                <p className="text-xs text-slate-400 dark:text-slate-500">Selecione o tipo de pessoa</p>
              </div>
            </div>

            {/* Person type buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
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
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-[4px] border text-xs font-semibold transition-colors ${tipoPessoa === key ? `${accentBg} text-white border-transparent` : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-slate-400'}`}>
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />{label}
                </button>
              ))}
            </div>

            {/* Search / display field */}
            {(tipoPessoa === 'MEMBRO' || tipoPessoa === 'IGREJA') && (
              <div className="relative">
                <input
                  type="text"
                  readOnly
                  onClick={() => tipoPessoa === 'MEMBRO' ? setShowMemberModal(true) : setShowChurchModal(true)}
                  value={favorecidoNome}
                  placeholder="Busque por nome, CPF ou código..."
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-[4px] text-sm bg-slate-50 dark:bg-slate-700 text-slate-800 dark:text-white placeholder:text-slate-400 cursor-pointer pr-10"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  {favorecidoNome ? (
                    <button type="button" onClick={(e) => { e.stopPropagation(); setFavorecidoId(''); setFavorecidoNome(''); setFavorecidoRol(null); }}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-[4px] flex-shrink-0"><X className="w-3.5 h-3.5 text-slate-500" /></button>
                  ) : (
                    <Search className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </div>
            )}

            {tipoPessoa === 'NAO_MEMBRO' && (
              <div className="relative">
                <input type="text" value={naoMembroNome} onChange={e => setNaoMembroNome(e.target.value)}
                  placeholder="Busque por nome, CPF ou código..."
                  className={`w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-[4px] text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 pr-10`} />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            )}

            {tipoPessoa === 'PJ' && (
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input type="text" value={pjNome} onChange={e => setPjNome(e.target.value)}
                    placeholder="Busque por nome, CPF ou código..."
                    className={`w-full pl-3 pr-10 py-2 border border-slate-200 dark:border-slate-600 rounded-[4px] text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500`} />
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                </div>
                <button type="button" onClick={() => setShowPJModal(true)}
                  className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-[4px] hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors" title="Cadastrar nova PJ">
                  <Plus className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                </button>
                <button type="button" onClick={() => setShowPJSearchModal(true)}
                  className="px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-[4px] hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors" title="Buscar PJ existente">
                  <Search className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                </button>
              </div>
            )}
          </div>

          {/* Form inputs grid */}
          <div className="space-y-3.5">
            {/* Plano de Contas */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Plano de Contas</label>
              <SearchableSelect 
                value={planoId} 
                onChange={setPlanoId}
                options={planos.map(p => ({ id: p.id, label: p.nome }))}
                placeholder="Selecione a categoria..."
                className={`w-full px-3 py-2 border border-slate-200 rounded-[4px] text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600`}
              />
            </div>

            {/* Documento / Numero */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Documento</label>
                <select value={tipoDocId} onChange={e => setTipoDocId(e.target.value)}
                  className={`w-full px-3 py-2 border border-slate-200 rounded-[4px] text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600`}>
                  <option value="">Selecione o tipo...</option>
                  {tiposDocs.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Nº do Documento</label>
                <input type="text" value={numDoc} onChange={e => setNumDoc(e.target.value)}
                  placeholder="Opcional"
                  className={`w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-[4px] text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500`} />
              </div>
            </div>

            {/* Forma de Pagamento */}
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Forma de Pagamento</label>
              <select value={formaId} onChange={e => setFormaId(e.target.value)}
                className={`w-full px-3 py-2 border border-slate-200 rounded-[4px] text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600`}>
                <option value="">Selecione a forma...</option>
                {formas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </div>

            {/* Datas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Data de Lançamento</label>
                <input type="date" value={dataLancamento} onChange={e => setDataLancamento(e.target.value)} required
                  className={`w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-[4px] text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500`} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Referência (Mês/Ano)</label>
                <input type="text" value={referencia} onChange={e => setReferencia(e.target.value)} placeholder="MM/AAAA"
                  className={`w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-[4px] text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500`} />
              </div>
            </div>

            {/* Obs + Valor */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Observações (Opcional)</label>
                <div className="relative">
                  <input type="text" value={obs} onChange={e => setObs(e.target.value.slice(0, 200))} placeholder="Detalhes adicionais sobre este lançamento..."
                    className={`w-full pl-3 pr-12 py-2 border border-slate-200 dark:border-slate-600 rounded-[4px] text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500`} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">{obs.length}/200</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1">Valor (R$)</label>
                <div className={`flex items-stretch border-2 ${accentBorder} rounded-[4px] overflow-hidden`}>
                  <span className="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 font-bold px-3 py-2 flex items-center text-sm border-r border-slate-200 dark:border-slate-600">R$</span>
                  <input type="text" inputMode="numeric" value={valor} onChange={handleValorChange} placeholder="0,00" required
                    className={`w-full px-3 py-2 text-sm font-bold text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none`} />
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-[4px]">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-[4px]">
              <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <p className="text-sm text-emerald-700">Lançamento registrado com sucesso!</p>
            </div>
          )}

          {/* Actions Row: Limpar, Add Imagem, Salvar */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
            {/* Foto preview */}
            {fotoPreview && (
              <div className="flex items-center gap-1.5 mb-3 bg-slate-50 dark:bg-slate-700 px-2 py-1.5 rounded-[4px] border border-slate-200 dark:border-slate-600">
                <img src={fotoPreview} alt="Preview" className="w-8 h-8 object-cover rounded" />
                <span className="text-xs text-slate-500 font-medium truncate flex-1">{fotoFile?.name}</span>
                <button
                  type="button"
                  onClick={() => { setFotoFile(null); setFotoPreview(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFoto} className="hidden" />

            {/* Mobile: Salvar em cima (linha toda), Limpar+Imagem embaixo | Desktop: 3 colunas */}
            <div className="flex flex-col gap-2 sm:hidden">
              <button
                type="submit"
                disabled={saving}
                className={`w-full flex items-center justify-center gap-2 px-3 py-3 ${accentBg} ${accentHover} text-white rounded-[4px] text-sm font-bold transition-colors disabled:opacity-60 shadow-sm`}
              >
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                <span>{saving ? 'Salvando...' : isReceita ? 'Salvar Receita' : 'Salvar Despesa'}</span>
              </button>
              
              <button
                type="button"
                onClick={() => fileInputAiRef.current?.click()}
                disabled={aiReading}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-[4px] text-sm font-bold hover:bg-indigo-100 transition-colors disabled:opacity-60"
              >
                {aiReading ? <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" /> : <Sparkles className="w-4 h-4 text-indigo-500" />}
                <span>{aiReading ? 'Lendo com IA...' : 'Preencher com Imagem'}</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={limpar}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 rounded-[4px] text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                >
                  <RotateCcw className="w-4 h-4 flex-shrink-0" />
                  <span>Limpar</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 rounded-[4px] text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
                >
                  <Camera className="w-4 h-4 flex-shrink-0" />
                  <span>Imagem</span>
                </button>
              </div>
            </div>

            {/* Desktop: 4 colunas lado a lado */}
            <div className="hidden sm:grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={limpar}
                className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 rounded-[4px] text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
              >
                <RotateCcw className="w-4 h-4 flex-shrink-0" />
                <span>Limpar</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2 px-3 py-2.5 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 rounded-[4px] text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
              >
                <Camera className="w-4 h-4 flex-shrink-0" />
                <span>Imagem</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputAiRef.current?.click()}
                disabled={aiReading}
                className="flex items-center justify-center gap-2 px-3 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-[4px] text-sm font-bold hover:bg-indigo-100 transition-colors disabled:opacity-60 animate-pulse-slow"
              >
                {aiReading ? <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" /> : <Sparkles className="w-4 h-4 text-indigo-500" />}
                <span>{aiReading ? 'Lendo...' : 'IA Imagem'}</span>
              </button>
              <button
                type="submit"
                disabled={saving}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 ${accentBg} ${accentHover} text-white rounded-[4px] text-sm font-bold transition-colors disabled:opacity-60 shadow-sm`}
              >
                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                <span>{saving ? 'Salvando...' : isReceita ? 'Salvar Receita' : 'Salvar Despesa'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column (Ticket) */}
        <div className="relative bg-white dark:bg-slate-800 rounded-[4px] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden pb-10 pt-10">
          {/* Jagged top edge simulation */}
          <div className="absolute top-0 left-0 right-0 h-2 bg-repeat-x bg-[top_left]"
               style={{
                 backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='6' viewBox='0 0 12 6'%3E%3Cpath d='M0 0 L6 6 L12 0 Z' fill='%23fefefe'/%3E%3C/svg%3E")`,
                 backgroundSize: '12px 6px'
               }}
          />

          {/* Ticket Header */}
          <div className="flex items-center gap-3 px-5 pt-3 pb-3">
            <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Resumo do Lançamento</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">Confira os detalhes antes de salvar</p>
            </div>
            {/* Ícone Repetir Dízimos inline */}
            <button
              type="button"
              onClick={() => { setModalTab('repetir'); setShowHistoricoRepetirModal(true); }}
              className="p-1.5 rounded-[4px] hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-violet-600 transition-colors flex-shrink-0"
              title="Repetir Dízimos"
            >
              <Repeat2 className="w-4 h-4" />
            </button>
          </div>

          <hr className="border-slate-100 dark:border-slate-700 mx-5" />

          {/* Ticket Details */}
          <div className="text-xs space-y-3 px-5 py-3">
            <div className="flex justify-between gap-4 py-1 border-b border-slate-50 dark:border-slate-700/50">
              <span className="text-slate-500 dark:text-slate-400">Caixa de Origem</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 text-right truncate max-w-[160px]" title={caixaNome}>{caixaNome || '—'}</span>
            </div>
            <div className="flex justify-between gap-4 py-1 border-b border-slate-50 dark:border-slate-700/50">
              <span className="text-slate-500 dark:text-slate-400">Favorecido</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 text-right truncate max-w-[160px]">{
                (tipoPessoa === 'MEMBRO' || tipoPessoa === 'IGREJA' ? favorecidoNome : tipoPessoa === 'NAO_MEMBRO' ? naoMembroNome : pjNome) || '—'
              }</span>
            </div>
            <div className="flex justify-between gap-4 py-1 border-b border-slate-50 dark:border-slate-700/50">
              <span className="text-slate-500 dark:text-slate-400">Categoria</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 text-right truncate max-w-[160px]">{planos.find(p => p.id === planoId)?.nome || '—'}</span>
            </div>
            <div className="flex justify-between gap-4 py-1 border-b border-slate-50 dark:border-slate-700/50">
              <span className="text-slate-500 dark:text-slate-400">Forma de Pagamento</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 text-right truncate max-w-[120px]">{formas.find(f => f.id === formaId)?.nome || '—'}</span>
            </div>
            <div className={`flex justify-between items-center px-3 py-2 rounded-[4px] ${isReceita ? 'bg-emerald-50/60 dark:bg-emerald-950/20' : 'bg-red-50/60 dark:bg-red-950/20'}`}>
              <span className="font-semibold text-slate-600 dark:text-slate-300">Valor</span>
              <span className={`font-bold text-sm ${isReceita ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>R$ {valor || '0,00'}</span>
            </div>
            <div className="flex justify-between gap-4 py-1 border-b border-slate-50 dark:border-slate-700/50">
              <span className="text-slate-500 dark:text-slate-400">Referência</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">{referencia || '—'}</span>
            </div>
            <div className="flex justify-between gap-4 py-1 border-b border-slate-50 dark:border-slate-700/50">
              <span className="text-slate-500 dark:text-slate-400">Data de Lançamento</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 text-right">{formatData(dataLancamento)}</span>
            </div>
          </div>

          {/* Mini Histórico — últimos 5 lançamentos */}
          {lancamentosRecentes.length > 0 && (
            <>
              <hr className="border-slate-100 dark:border-slate-700 mx-5" />
              <div className="px-5 pt-2 pb-1 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Últimos lançamentos</span>
                <button
                  type="button"
                  onClick={() => { setModalTab('historico'); setShowHistoricoRepetirModal(true); }}
                  className="text-[10px] text-emerald-600 hover:underline font-semibold"
                >
                  Ver todos
                </button>
              </div>
              <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {lancamentosRecentes.slice(0, 5).map(l => (
                  <div key={l.id} className="px-5 py-2 flex items-center gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${l.tipo === 'RECEITA' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate">{l.plano_de_conta ?? '—'}</p>
                      <p className="text-[10px] text-slate-400 truncate">{l.favorecido ?? 'Sem dados'} · {new Date(l.data_lancamento + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                      {!isChurchUser && l.church_name && (
                        <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold truncate">{l.church_name}</p>
                      )}
                    </div>
                    <span className={`text-[11px] font-bold flex-shrink-0 ${l.tipo === 'RECEITA' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {l.tipo === 'RECEITA' ? '+' : '-'} R$ {Number(l.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Jagged bottom edge simulation */}
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-repeat-x bg-[bottom_left]"
               style={{
                 backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='6' viewBox='0 0 12 6'%3E%3Cpath d='M0 6 L6 0 L12 6 Z' fill='%23fefefe'/%3E%3C/svg%3E")`,
                 backgroundSize: '12px 6px'
               }}
          />
        </div>
      </div>

      {/* Modals */}
      {showMemberModal && (
        <SearchModal title="Buscar Contribuinte Membro" placeholder="Digite o nome ou ROL..."
          searchFn={searchMember}
          onSelect={item => {
            setFavorecidoId(item.id);
            setFavorecidoNome(item.label);
            const rolMatch = item.sub?.match(/ROL\s+(\S+)/i);
            setFavorecidoRol(rolMatch ? rolMatch[1] : null);
            setShowMemberModal(false);
          }}
          onClose={() => setShowMemberModal(false)} />
      )}
      {showChurchModal && (
        <SearchModal title="Buscar Igreja Contribuinte" placeholder="Digite o nome da igreja..."
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
          onClose={() => { setReciboRow(null); setSuccess(true); setTimeout(() => { setSuccess(false); limparAposSalvar(); }, 500); }}
          onUpdated={(id, changes) => setReciboRow(prev => prev ? { ...prev, ...changes } : prev)}
        />
      )}
      {cashClosedMessage && (
        <CashClosedModal
          message={cashClosedMessage}
          onClose={() => setCashClosedMessage('')}
        />
      )}
      {duplicateTransactionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-700">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Lançamento Duplicado Detectado</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Já existe um lançamento cadastrado exatamente com o mesmo valor, pessoa, data, número de documento e observação.
                </p>
              </div>
            </div>
            
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 dark:bg-amber-900/20 dark:border-amber-900/40 dark:text-amber-300">
              <p className="font-semibold mb-1">Como resolver:</p>
              <p>Se você realmente deseja fazer este lançamento em duplicidade, por favor altere a observação deste lançamento para informar o motivo (ex: "Segunda via", "Referente ao serviço complementar", etc.).</p>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setDuplicateTransactionModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors"
              >
                Entendi, vou ajustar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Histórico + Repetir Modal */}
      {showHistoricoRepetirModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-[4px] border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-[480px] flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
                {modalTab === 'historico' ? 'Histórico de Lançamentos' : 'Repetir Dízimos'}
              </h3>
              <button 
                type="button"
                onClick={() => setShowHistoricoRepetirModal(false)}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-[4px]"
              >
                <X className="w-4 h-4 text-slate-500 dark:text-slate-300" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <HistoricoPanel
                lancamentosRecentes={lancamentosRecentes}
                loadRecentes={loadRecentes}
                onClearHistory={() => setLancamentosRecentes([])}
                caixaId={caixaId}
                currentModo={modo}
                onRepetir={(l) => {
                  setModo(l.tipo as Modo);
                  if (l.plano_de_conta) {
                    const p = planos.find(x => x.nome === l.plano_de_conta);
                    if (p) setPlanoId(p.id);
                  }
                  setValor(Number(l.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                  if (l.favorecido) { setTipoPessoa('NAO_MEMBRO'); setNaoMembroNome(l.favorecido); }
                  loadRecentes();
                  setShowHistoricoRepetirModal(false);
                }}
                onReciboReady={row => setReciboRow(row)}
                setCashClosedMessage={setCashClosedMessage}
                defaultTab={modalTab}
              />
            </div>
          </div>
        </div>
      )}

      {/* Inputs de arquivo ocultos adicionais para a IA */}
      <input ref={fileInputAiRef} type="file" accept="image/*" onChange={handleAiFoto} className="hidden" />

      {/* Modal de confirmação da leitura da IA */}
      {showAiModal && aiResult && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-slate-700 pb-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Resultado da Leitura de IA</h3>
                <p className="text-xs text-slate-400">Verifique os dados extraídos do comprovante</p>
              </div>
            </div>

            <div className="space-y-3.5 mb-5 text-sm">
              <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl space-y-2.5">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Favorecido / Emissor</span>
                  <input
                    type="text"
                    value={aiResult.favorecido || ''}
                    onChange={(e) => setAiResult({ ...aiResult, favorecido: e.target.value })}
                    className="w-full bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600 p-1.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Tipo de Beneficiado</span>
                  <div className="grid grid-cols-3 gap-1.5 mt-1">
                    {(['PJ', 'NAO_MEMBRO', 'MEMBRO'] as TipoPessoa[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setAiFavType(t)}
                        className={`py-1 text-[10px] font-bold rounded-lg border transition-colors ${
                          aiFavType === t 
                            ? 'bg-indigo-600 text-white border-indigo-600' 
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {t === 'PJ' ? 'Jurídica' : t === 'NAO_MEMBRO' ? 'Não Membro' : 'Membro'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Valor do Lançamento</span>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">R$</span>
                    <input
                      type="text"
                      value={aiResult.valor || ''}
                      onChange={(e) => setAiResult({ ...aiResult, valor: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1.5 pl-8 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Data de Lançamento</span>
                  <input
                    type="date"
                    value={aiResult.data_lancamento || ''}
                    onChange={(e) => setAiResult({ ...aiResult, data_lancamento: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1.5 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Competência / Referência</span>
                  <input
                    type="text"
                    value={aiResult.referencia || ''}
                    onChange={(e) => setAiResult({ ...aiResult, referencia: e.target.value })}
                    placeholder="MM/YYYY"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1.5 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>

                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase">Nº Documento / Doc</span>
                  <input
                    type="text"
                    value={aiResult.num_doc || ''}
                    onChange={(e) => setAiResult({ ...aiResult, num_doc: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1.5 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <span className="block text-[10px] font-bold text-slate-400 uppercase">Observação sugerida</span>
                <textarea
                  rows={2}
                  value={aiResult.observacao || ''}
                  onChange={(e) => setAiResult({ ...aiResult, observacao: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1.5 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setShowAiModal(false); setAiFile(null); setAiResult(null); }}
                className="flex-1 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600 dark:text-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Descartar
              </button>
              <button
                type="button"
                onClick={handleApproveAi}
                className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-md"
              >
                Aprovar & Preencher
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
