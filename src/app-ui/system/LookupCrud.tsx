/**
 * Tela genérica de CRUD das listas auxiliares (dropdowns) do sistema.
 *
 * A configuração vem de src/lib/lookupRegistry.ts — para adicionar uma lista
 * nova basta registrá-la lá; nenhuma tela nova é necessária.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router';
import { AlertTriangle, ArrowLeft, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

import { apiBase } from '../../lib/apiBase';
import { getLookup, type LookupConfig, type LookupField } from '../../lib/lookupRegistry';
import { ConfirmDialog } from '../../components/app-ui/shared/ConfirmDialog';

type Row = Record<string, unknown> & { id: string };

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('mrm_token') ?? '' : '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

/**
 * Perfil e igreja do usuário logado, do mesmo lugar que o resto do app lê.
 *
 * Numa lista isolada por igreja (`churchField`), o perfil de igreja só enxerga
 * a própria — nem precisa do seletor. Quem administra acima dela escolhe para
 * qual igreja está cadastrando.
 */
function usuarioGuardado(): { profileType?: string; churchId?: string; churchName?: string } {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem('mrm_user') || '{}');
  } catch {
    return {};
  }
}

type IgrejaOpcao = { id: string; name: string };

function emptyFormFor(cfg: LookupConfig): Record<string, unknown> {
  const form: Record<string, unknown> = {};
  for (const f of cfg.fields) {
    form[f.key] = f.type === 'boolean' ? (f.key === cfg.activeField ? true : false) : '';
  }
  return form;
}

export default function LookupCrud() {
  // A rota é /app-ui/config/:lookupKey
  const { lookupKey } = useParams<{ lookupKey: string }>();
  const cfg = useMemo(() => (lookupKey ? getLookup(lookupKey) : null), [lookupKey]);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Seletor de igreja das listas isoladas por igreja (ex.: horários de culto).
  const usuario = useMemo(usuarioGuardado, []);
  const precisaEscolherIgreja = Boolean(cfg?.churchField) && usuario.profileType !== 'church';
  const [igrejas, setIgrejas] = useState<IgrejaOpcao[]>([]);
  const [churchId, setChurchId] = useState<string>(usuario.churchId ?? '');

  /**
   * Opções dos selects que vêm de outra lista cadastrada (`optionsFrom`).
   * Nenhum dropdown daqui tem opção fixa: o conteúdo é sempre o que está
   * cadastrado, e some da lista assim que o item é desativado.
   */
  const [opcoesDinamicas, setOpcoesDinamicas] = useState<Record<string, { value: string; label: string }[]>>({});

  useEffect(() => {
    if (!cfg) return;
    const comOrigem = cfg.fields.filter((f) => f.optionsFrom);
    if (!comOrigem.length) return;
    (async () => {
      const resultado: Record<string, { value: string; label: string }[]> = {};
      await Promise.all(
        comOrigem.map(async (f) => {
          const origem = f.optionsFrom!;
          try {
            const res = await fetch(`${apiBase}/lookups/${origem.lookupKey}`, { headers: authHeaders() });
            if (!res.ok) return;
            const linhas = (await res.json()) as Row[];
            const origemCfg = getLookup(origem.lookupKey);
            const campoAtivo = origemCfg?.activeField;
            resultado[f.key] = linhas
              .filter((l) => (campoAtivo ? l[campoAtivo] !== false : true))
              .map((l) => ({
                value: String(l[origem.valueField ?? 'codigo'] ?? ''),
                label: String(l[origem.labelField ?? 'nome'] ?? ''),
              }))
              .filter((o) => o.value);
          } catch { /* select fica vazio; o cadastro de origem resolve */ }
        })
      );
      setOpcoesDinamicas(resultado);
    })();
  }, [cfg]);

  const opcoesDoCampo = useCallback(
    (f: LookupField) => (f.optionsFrom ? opcoesDinamicas[f.key] ?? [] : f.options ?? []),
    [opcoesDinamicas]
  );

  useEffect(() => {
    if (!precisaEscolherIgreja) return;
    fetch(`${apiBase}/churches?slim=1`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((d) => {
        const lista: IgrejaOpcao[] = Array.isArray(d) ? d : [];
        setIgrejas(lista);
        setChurchId((atual) => atual || lista[0]?.id || '');
      })
      .catch(() => toast.error('Não foi possível carregar a lista de igrejas.'));
  }, [precisaEscolherIgreja]);

  const load = useCallback(async () => {
    if (!cfg) return;
    // Sem igreja escolhida a lista fica vazia de propósito: o servidor não tem
    // como saber de quem é o cadastro, e mostrar o de todas seria justamente o
    // vazamento que o isolamento por igreja existe para impedir.
    if (cfg.churchField && precisaEscolherIgreja && !churchId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const q = cfg.churchField && churchId ? `?churchId=${encodeURIComponent(churchId)}` : '';
      const res = await fetch(`${apiBase}/lookups/${cfg.key}${q}`, { headers: authHeaders() });
      if (!res.ok) throw new Error('Falha ao carregar a lista.');
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar a lista.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [cfg, churchId, precisaEscolherIgreja]);

  useEffect(() => { load(); }, [load]);

  if (!cfg) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-500">Lista de configuração não encontrada.</p>
        <Link to="/app-ui/system-settings" className="text-sm text-purple-600 hover:underline">Voltar para Configurações</Link>
      </div>
    );
  }

  const listFields = cfg.fields.filter((f) => f.inList);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyFormFor(cfg));
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (row: Row) => {
    const next: Record<string, unknown> = {};
    for (const f of cfg.fields) {
      next[f.key] = f.type === 'boolean' ? !!row[f.key] : (row[f.key] ?? '');
    }
    setEditingId(row.id);
    setForm(next);
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    for (const f of cfg.fields) {
      if (f.required && !String(form[f.key] ?? '').trim()) {
        setFormError(`${f.label} é obrigatório.`);
        return;
      }
    }
    setSaving(true);
    setFormError('');
    try {
      const url = editingId ? `${apiBase}/lookups/${cfg.key}/${editingId}` : `${apiBase}/lookups/${cfg.key}`;
      const res = await fetch(url, {
        method: editingId ? 'PATCH' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(cfg.churchField && churchId ? { ...form, churchId } : form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Falha ao salvar.');
      }
      toast.success(editingId ? 'Item atualizado.' : 'Item criado.');
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  // Liga/desliga o campo "ativo" direto da listagem.
  const toggleActive = async (row: Row) => {
    if (!cfg.activeField) return;
    try {
      const res = await fetch(`${apiBase}/lookups/${cfg.key}/${row.id}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({ [cfg.activeField]: !row[cfg.activeField] }),
      });
      if (!res.ok) throw new Error('Falha ao alterar o status.');
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao alterar o status.');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`${apiBase}/lookups/${cfg.key}/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Falha ao excluir.');
      }
      toast.success('Item excluído.');
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao excluir.');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = search.trim()
    ? rows.filter((r) =>
        cfg.fields.some((f) => String(r[f.key] ?? '').toLowerCase().includes(search.trim().toLowerCase()))
      )
    : rows;

  const renderCell = (row: Row, f: LookupField) => {
    if (f.type === 'boolean') {
      const on = !!row[f.key];
      const isActiveCol = f.key === cfg.activeField;
      return (
        <button
          type="button"
          onClick={() => isActiveCol && toggleActive(row)}
          disabled={!isActiveCol}
          title={isActiveCol ? 'Clique para alternar' : undefined}
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            on ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
          } ${isActiveCol ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
        >
          {on ? 'Sim' : 'Não'}
        </button>
      );
    }
    if (f.type === 'select') {
      const opt = opcoesDoCampo(f).find((o) => o.value === row[f.key]);
      return <span className="text-slate-700">{opt?.label ?? String(row[f.key] ?? '—')}</span>;
    }
    return <span className="text-slate-700">{String(row[f.key] ?? '') || '—'}</span>;
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/app-ui/system-settings"
            className="mb-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Configurações
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">{cfg.label}</h1>
          <p className="text-sm text-slate-500">{cfg.description}</p>
          {/* Lista por igreja: o cadastro é de UMA congregação por vez. Quem é
              da própria igreja não escolhe nada — vê só o dela. */}
          {precisaEscolherIgreja && (
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                Igreja
              </span>
              <select
                value={churchId}
                onChange={(e) => setChurchId(e.target.value)}
                className="min-w-[16rem] rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">Selecione a igreja...</option>
                {igrejas.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
        <button
          onClick={openCreate}
          disabled={precisaEscolherIgreja && !churchId}
          title={precisaEscolherIgreja && !churchId ? 'Escolha a igreja primeiro.' : undefined}
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Novo item
        </button>
      </div>

      {cfg.warning && (
        <div className="mb-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <p>{cfg.warning}</p>
        </div>
      )}

      <div className="mb-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar..."
          className="w-full max-w-sm rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                {listFields.map((f) => (
                  <th key={f.key} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {f.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={listFields.length + 1} className="px-4 py-10 text-center text-slate-400">
                    <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" /> Carregando...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={listFields.length + 1} className="px-4 py-10 text-center text-sm text-slate-400">
                    Nenhum item cadastrado.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    {listFields.map((f) => (
                      <td key={f.key} className="px-4 py-3">{renderCell(row, f)}</td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(row)}
                          title="Editar"
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(row)}
                          title="Excluir"
                          className="rounded p-1.5 text-slate-500 hover:bg-red-100 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        {filtered.length} item(ns){search.trim() ? ` de ${rows.length}` : ''}
      </p>

      {/* Modal criar/editar */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                {editingId ? `Editar ${cfg.label}` : `Novo item — ${cfg.label}`}
              </h3>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1 hover:bg-slate-100">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
              )}

              {cfg.fields.map((f) => (
                <div key={f.key}>
                  {f.type === 'boolean' ? (
                    <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={!!form[f.key]}
                        onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.checked }))}
                        className="h-4 w-4 accent-purple-600"
                      />
                      <span className="text-sm text-slate-700">
                        {f.label}
                        {f.help && <span className="block text-xs text-slate-400">{f.help}</span>}
                      </span>
                    </label>
                  ) : (
                    <>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                        {f.label}{f.required ? ' *' : ''}
                      </label>
                      {f.type === 'select' ? (
                        <select
                          value={String(form[f.key] ?? '')}
                          onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="">Selecione...</option>
                          {opcoesDoCampo(f).map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={f.type === 'number' ? 'number' : f.type === 'time' ? 'time' : 'text'}
                          value={String(form[f.key] ?? '')}
                          onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                      )}
                      {f.help && <p className="mt-1 text-xs text-slate-400">{f.help}</p>}
                    </>
                  )}
                </div>
              ))}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir item?"
        message={`O item será removido da lista "${cfg.label}". Se ele estiver em uso, a exclusão será bloqueada — nesse caso, desative-o.`}
        confirmLabel="Excluir"
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
