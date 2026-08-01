/**
 * Anexar pessoas ao GF: membros do cadastro ou contatos de uma lista importada.
 *
 * O contato importado ainda não é membro, então a trava de "um GF por pessoa"
 * dele mora na própria linha do import (cell_group_id) — por isso as duas abas
 * têm o mesmo botão mas chamam a rota com `source` diferente.
 */

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Upload, User, Users, X } from 'lucide-react';
import { apiBase } from '../../../lib/apiBase';
import DateRangeFilter from '../../../app-ui/pastoral/DateRangeFilter';
import { ConfirmDialog } from '../shared/ConfirmDialog';

interface ImportBatch {
  id: string;
  filename: string | null;
  created_at: string;
  total_rows: number | null;
  valid_rows: number | null;
}

interface ImportRow {
  id: string;
  name: string | null;
  phone: string | null;
  match_status: string;
  cell_group_id: string | null;
}

interface MemberOption {
  id: string;
  fullName: string;
  mobile?: string | null;
  phone?: string | null;
}

interface AttachMemberModalProps {
  cellGroupId: string;
  cellGroupNames: Record<string, string>;
  onClose: () => void;
  onAttached: () => void;
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('mrm_token') ?? '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export function AttachMemberModal({ cellGroupId, cellGroupNames, onClose, onAttached }: AttachMemberModalProps) {
  const [tab, setTab] = useState<'members' | 'imports'>('members');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  /** Pendencia de transferencia: a pessoa ja esta em outro GF e precisa de aval. */
  const [transferir, setTransferir] = useState<
    { payload: Record<string, unknown>; key: string; mensagem: string } | null
  >(null);

  const [query, setQuery] = useState('');
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [searching, setSearching] = useState(false);

  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [batchId, setBatchId] = useState('');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [onlyWithoutGf, setOnlyWithoutGf] = useState(true);

  useEffect(() => {
    if (tab !== 'imports') return;
    fetch(`${apiBase}/whatsapp/imports`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => setBatches(d.batches ?? []))
      .catch((err) => console.error('[AttachMemberModal] lotes', err));
  }, [tab]);

  async function selectBatch(id: string) {
    setBatchId(id);
    setRows([]);
    if (!id) return;
    setLoadingRows(true);
    try {
      const res = await fetch(`${apiBase}/whatsapp/imports/${id}`, { headers: authHeaders() });
      const data = await res.json();
      setRows(data.rows ?? []);
    } catch (err) {
      console.error('[AttachMemberModal] linhas', err);
    } finally {
      setLoadingRows(false);
    }
  }

  const visibleBatches = useMemo(() => {
    return batches.filter((b) => {
      const day = String(b.created_at ?? '').slice(0, 10);
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
      return true;
    });
  }, [batches, dateFrom, dateTo]);

  const visibleRows = useMemo(() => {
    if (!batchId) return [];
    return onlyWithoutGf ? rows.filter((r) => !r.cell_group_id) : rows;
  }, [batchId, rows, onlyWithoutGf]);

  async function searchMembers(value: string) {
    setQuery(value);
    if (value.trim().length < 3) {
      setMembers([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`${apiBase}/members?query=${encodeURIComponent(value)}&limit=15`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(data.data || data || []);
      }
    } catch (err) {
      console.error('[AttachMemberModal] busca de membros', err);
    } finally {
      setSearching(false);
    }
  }

  async function attach(payload: Record<string, unknown>, key: string) {
    setBusy(key);
    setError('');
    try {
      const res = await fetch(`${apiBase}/cell-groups/${cellGroupId}/members`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));

      // Ja esta em outro GF: a transferencia so acontece com aval explicito.
      if (res.status === 409 && data.currentCellGroup) {
        setTransferir({ payload, key, mensagem: String(data.error ?? '') });
        return;
      }

      if (!res.ok) throw new Error(data.error || 'Erro ao anexar');

      if (payload.source === 'import') {
        setRows((prev) =>
          prev.map((r) => (r.id === payload.importRowId ? { ...r, cell_group_id: cellGroupId } : r))
        );
      } else {
        setMembers((prev) => prev.filter((m) => m.id !== payload.memberId));
      }
      onAttached();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao anexar');
    } finally {
      setBusy('');
    }
  }

  async function confirmarTransferencia() {
    if (!transferir) return;
    const { payload, key } = transferir;
    setTransferir(null);
    await attach({ ...payload, force: true }, key);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Anexar pessoas ao GF</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-1 px-6 pt-4">
          <button
            onClick={() => setTab('members')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
              tab === 'members' ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            Membros
          </button>
          <button
            onClick={() => setTab('imports')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium ${
              tab === 'imports' ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Upload className="w-4 h-4" />
            Listas importadas
          </button>
        </div>

        {error && <div className="mx-6 mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}

        {/* Os filtros ficam FORA da area que rola: o calendario do periodo abre
            em posicao absoluta e seria cortado pelo overflow do container. */}
        <div className="px-6 pt-4 pb-2 shrink-0">
          {tab === 'members' ? (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => searchMembers(e.target.value)}
                placeholder="Buscar membro por nome..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          ) : (
            <div className="flex flex-wrap items-end gap-3">
              <DateRangeFilter
                dateFrom={dateFrom}
                dateTo={dateTo}
                onChange={(from, to) => {
                  setDateFrom(from);
                  setDateTo(to);
                }}
              />
              <select
                value={batchId}
                onChange={(e) => selectBatch(e.target.value)}
                className="flex-1 min-w-[220px] px-3 py-2 border border-slate-200 rounded-lg text-sm"
              >
                <option value="">Selecione a lista importada</option>
                {visibleBatches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.filename ?? 'Sem nome'} · {new Date(b.created_at).toLocaleDateString('pt-BR')} ·{' '}
                    {b.total_rows ?? 0} linhas
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={onlyWithoutGf}
                  onChange={(e) => setOnlyWithoutGf(e.target.checked)}
                />
                Só quem está sem GF
              </label>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {tab === 'members' ? (
            <>
              {searching && <p className="text-sm text-slate-500">Buscando...</p>}
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-lg">
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{m.fullName}</p>
                        <p className="text-xs text-slate-500">{m.mobile || m.phone || 'Sem telefone'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => attach({ source: 'member', memberId: m.id }, m.id)}
                      disabled={busy === m.id}
                      className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    >
                      {busy === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Anexar'}
                    </button>
                  </div>
                ))}
                {!searching && query.length >= 3 && !members.length && (
                  <p className="text-sm text-slate-500">Nenhum membro encontrado.</p>
                )}
              </div>
            </>
          ) : (
            <>
              {loadingRows && <p className="text-sm text-slate-500">Carregando contatos...</p>}
              <div className="space-y-2">
                {visibleRows.map((r) => {
                  const inGroup = r.cell_group_id;
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between p-3 border border-slate-100 rounded-lg"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{r.name || 'Sem nome'}</p>
                        <p className="text-xs text-slate-500">
                          {r.phone || 'Sem telefone'}
                          {inGroup && (
                            <span className="ml-2 text-amber-600">
                              · já está no GF {cellGroupNames[inGroup] ?? ''}
                            </span>
                          )}
                        </p>
                      </div>
                      <button
                        onClick={() => attach({ source: 'import', importRowId: r.id }, r.id)}
                        disabled={busy === r.id || inGroup === cellGroupId}
                        className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                      >
                        {busy === r.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : inGroup === cellGroupId ? (
                          'Neste GF'
                        ) : (
                          'Anexar'
                        )}
                      </button>
                    </div>
                  );
                })}
                {batchId && !loadingRows && !visibleRows.length && (
                  <p className="text-sm text-slate-500">Nenhum contato nesta lista com esse filtro.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!transferir}
        title="Transferir de GF?"
        message={
          transferir
            ? `${transferir.mensagem}. Ao confirmar, a pessoa sai do grupo atual e passa a fazer parte deste. A saída fica registrada no histórico.`
            : undefined
        }
        confirmLabel="Transferir"
        variant="warning"
        onConfirm={confirmarTransferencia}
        onCancel={() => setTransferir(null)}
      />
    </div>
  );
}
