/**
 * Busca de igreja — o seletor padrão das telas de Finanças.
 *
 * Nasceu dentro do Livro Caixa e foi extraído para cá quando a tela de Blocos
 * de Numeração passou a precisar do mesmo comportamento. Uma implementação só,
 * de propósito: o histórico de "últimas consultadas" vive em localStorage por
 * usuário, então duas cópias do componente dariam duas listas divergentes para
 * a mesma pessoa.
 *
 * O padrão é digitar o nome e clicar em Buscar — nunca consultar a cada tecla.
 * A busca vai a `/api/churches/search`, que varre nome, código, razão social,
 * cidade e regional; com 200 igrejas no campo, disparar isso por tecla digitada
 * é consulta jogada fora.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Building2, MapPin, Search, Users, X } from 'lucide-react';
import { apiBase } from '../../lib/apiBase';

function readStoredUser() {
  try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; }
}

export type ChurchOption = {
  id: string;
  name: string;
  code?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  regionalId?: string | null;
  regional?: { id: string; name: string; campoId?: string } | null;
};

// ─── Histórico das últimas igrejas consultadas ───────────────────────────────
// Guardado por usuário para não vazar entre contas na mesma máquina.
const RECENT_CHURCHES_LIMIT = 5;

function recentChurchesKey(): string {
  try {
    const u = JSON.parse(localStorage.getItem('mrm_user') || '{}');
    return `mrm_recent_churches:${u.id ?? 'anon'}`;
  } catch {
    return 'mrm_recent_churches:anon';
  }
}

export function loadRecentChurches(): ChurchOption[] {
  try {
    const raw = localStorage.getItem(recentChurchesKey());
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((c) => c && c.id && c.name) : [];
  } catch {
    return [];
  }
}

export function pushRecentChurch(church: ChurchOption) {
  try {
    const list = loadRecentChurches().filter((c) => c.id !== church.id);
    list.unshift(church);
    localStorage.setItem(recentChurchesKey(), JSON.stringify(list.slice(0, RECENT_CHURCHES_LIMIT)));
  } catch {
    /* localStorage indisponível: histórico é opcional, segue sem ele */
  }
}

// ─── Church Picker Modal ──────────────────────────────────────────────────────

export function ChurchPickerModal({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (church: ChurchOption | null) => void;
  initialRegionalId?: string;
}) {
  const storedUser = readStoredUser();
  const token = localStorage.getItem('mrm_token') || '';
  const isMasterOrAdmin = storedUser.profileType === 'master' || storedUser.profileType === 'admin';
  const userCampoId = storedUser.campoId || '';

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ChurchOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Ao abrir, já mostra as últimas igrejas consultadas (sem precisar buscar).
  const [recent] = useState<ChurchOption[]>(() => loadRecentChurches());
  const showingRecent = !searched && !search.trim() && recent.length > 0;
  // A navegação por teclado opera sobre a lista que está visível no momento.
  const visible = showingRecent ? recent : results;

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Registra a escolha no histórico antes de devolver ao chamador.
  const handleSelect = (church: ChurchOption) => {
    pushRecentChurch(church);
    onSelect(church);
  };

  useEffect(() => {
    if (activeIndex >= 0) optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  async function doSearch() {
    setSearched(true);
    setActiveIndex(0);
    if (!search.trim()) { setResults([]); return; }
    setLoading(true);
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    const params = new URLSearchParams({ q: search.trim() });
    if (userCampoId && !isMasterOrAdmin) params.set('campoId', userCampoId);
    try {
      const res = await fetch(`${apiBase}/churches/search?${params}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setResults(Array.isArray(data) ? data.slice(0, 60) : []);
      } else {
        // fallback: busca local com supabase se endpoint não estiver disponível
        const { data } = await (await import('../../lib/supabaseClient')).supabase
          .from('churches')
          .select('id, name, code, address_city, address_state')
          .ilike('name', `%${search.trim()}%`)
          .limit(40);
        setResults(
          (data ?? []).map((row: Record<string, unknown>) => ({
            id: row.id as string,
            name: row.name as string,
            code: row.code as string | null,
            addressCity: (row.address_city ?? null) as string | null,
            addressState: (row.address_state ?? null) as string | null,
          }))
        );
      }
    } catch {
      setResults([]);
    }
    setLoading(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, visible.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (visible[activeIndex]) handleSelect(visible[activeIndex]); else doSearch(); }
    else if (e.key === 'Escape') onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-bold text-slate-900">Buscar Igreja</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 flex-shrink-0 space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                ref={inputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Nome, codigo ou regional da igreja..."
                className="w-full rounded-lg border border-emerald-400 py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <button
              onClick={doSearch}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-700 text-white text-sm hover:bg-violet-800 disabled:opacity-60 transition-colors"
            >
              <Search className="w-4 h-4" />
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>Use ↑↓ para navegar</span>
            <span>Enter para selecionar</span>
          </div>
        </div>

        {/* Church list */}
        <div className="overflow-y-auto px-5 pb-5 flex-1 space-y-2 min-h-[120px]">
          {loading && (
            <div className="py-8 text-center">
              <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-slate-400">Buscando igrejas...</p>
            </div>
          )}
          {!loading && !searched && !showingRecent && (
            <div className="py-10 text-center">
              <Search className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Digite o nome da igreja ou ID para buscar</p>
            </div>
          )}
          {!loading && showingRecent && (
            <p className="px-0.5 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Últimas consultadas
            </p>
          )}
          {!loading && searched && results.length === 0 && (
            <div className="py-8 text-center">
              <Building2 className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Nenhuma igreja encontrada.</p>
            </div>
          )}
          {!loading && visible.map((church, idx) => (
            <button
              key={church.id}
              type="button"
              ref={el => { optionRefs.current[idx] = el; }}
              onClick={() => handleSelect(church)}
              onMouseEnter={() => setActiveIndex(idx)}
              className={`block w-full rounded-xl border p-3.5 text-left transition-all ${activeIndex === idx ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'}`}
            >
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${activeIndex === idx ? 'bg-emerald-100' : 'bg-slate-100'}`}>
                  <Building2 className={`w-4 h-4 ${activeIndex === idx ? 'text-emerald-600' : 'text-slate-500'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-slate-900 text-sm truncate">{church.name}</p>
                    {church.code && (
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-mono rounded flex-shrink-0">
                        {church.code}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                    {church.addressCity && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{church.addressCity}
                      </span>
                    )}
                    {church.regional?.name && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />{church.regional.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-5 py-3 flex-shrink-0 flex justify-end items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
