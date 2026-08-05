import { useEffect, useRef, useState } from 'react';
import {
  Package, Plus, Search, Trash2, Edit, Eye, RefreshCw, Upload, Printer, ClipboardList,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { ConfirmDialog, AlertDialog } from '../../components/app-ui/shared/ConfirmDialog';
import { apiBase } from '../../lib/apiBase';
import { AssetImportModal } from './AssetImportModal';
import { AssetLabelPrintModal } from './AssetLabelPrintModal';
import { AssetDetailModal } from './AssetDetailModal';
import { AssetFormDrawer } from './AssetFormDrawer';
import { AssetInventoryStartModal } from './AssetInventoryStartModal';
import { DATE_RANGE_PRESETS, currentMonthRange } from './dateRangePresets';
import { locationLabel } from '../../lib/assetLocationOptions';

function perfilAtual(): string {
  try { return JSON.parse(localStorage.getItem('mrm_user') || '{}').profileType || 'church'; }
  catch { return 'church'; }
}

import { usePermissions } from '../../lib/usePermissions';

type Church = { id: string; name: string; code?: string | null; regional?: { id: string; name: string } | null };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AssetRow = any;

const STATUS_LABELS: Record<string, string> = { active: 'Ativo', baixado: 'Baixado', manutencao: 'Manutenção' };
const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700', baixado: 'bg-red-100 text-red-700', manutencao: 'bg-yellow-100 text-yellow-700',
};

export default function AssetsList() {
  const { canCreate, canEdit, canDelete } = usePermissions(perfilAtual());
  const token = localStorage.getItem('mrm_token');

  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  const defaultRange = currentMonthRange();
  const [searchTerm, setSearchTerm] = useState('');
  const [regionalId, setRegionalId] = useState('');
  const [churchId, setChurchId] = useState('');
  const [sector, setSector] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);
  const [activePreset, setActivePreset] = useState('month');

  const [churches, setChurches] = useState<Church[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<AssetRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [showInventoryStart, setShowInventoryStart] = useState(false);
  const [viewAssetId, setViewAssetId] = useState<string | null>(null);
  const [formDrawer, setFormDrawer] = useState<{ open: boolean; assetId: string | null }>({ open: false, assetId: null });

  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
  const storedUser = (() => { try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; } })();
  const activeFieldId = localStorage.getItem('mrm_active_field_id') || storedUser.campoId || '';

  useEffect(() => {
    const fieldQuery = activeFieldId ? `?fieldId=${encodeURIComponent(activeFieldId)}` : '';
    fetch(`${apiBase}/churches${fieldQuery}`, { headers: authHeaders })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setChurches(Array.isArray(data) ? data : data.data || []))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFieldId]);

  const load = async (p = page) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set('q', searchTerm);
      if (regionalId) params.set('regionalId', regionalId);
      if (churchId) params.set('churchId', churchId);
      if (!regionalId && !churchId && activeFieldId) params.set('campoId', activeFieldId);
      if (sector) params.set('sector', sector);
      if (status) params.set('status', status);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      params.set('page', String(p));
      params.set('pageSize', String(pageSize));

      const res = await fetch(`${apiBase}/assets?${params.toString()}`, { headers: authHeaders });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `Erro ${res.status}`); }
      const json = await res.json();
      setAssets(json.data ?? []);
      setTotal(json.total ?? 0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setError(e.message || 'Falha ao carregar bens.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(1); setPage(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setPage(1); load(1); }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, regionalId, churchId, sector, status, dateFrom, dateTo]);

  useEffect(() => { load(page); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const regionalOptions = Array.from(
    new Map(churches.filter((c) => c.regional).map((c) => [c.regional!.id, c.regional!.name])).entries()
  );

  // Cascata: com uma regional selecionada, a lista de igrejas mostra só as dela.
  const churchOptions = regionalId ? churches.filter((c) => c.regional?.id === regionalId) : churches;

  function handleRegionalChange(value: string) {
    setRegionalId(value);
    // Igreja escolhida antes não pertence mais à regional selecionada — evita
    // ficar com um filtro de igreja "fantasma" que não aparece mais na lista.
    if (value && churchId) {
      const stillValid = churches.some((c) => c.id === churchId && c.regional?.id === value);
      if (!stillValid) setChurchId('');
    }
  }

  function applyPreset(key: string) {
    const preset = DATE_RANGE_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    const { from, to } = preset.range();
    setActivePreset(key);
    setDateFrom(from);
    setDateTo(to);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.length === assets.length ? [] : assets.map((a) => a.id)));
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`${apiBase}/assets/${deleteTarget.id}`, { method: 'DELETE', headers: authHeaders });
      if (!res.ok) throw new Error('Falha ao excluir.');
      setAssets((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setDeleteTarget(null);
      toast.success('Bem excluído.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setAlertMessage(e.message || 'Não foi possível excluir.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="p-6 text-slate-900 dark:text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
            <Package className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Bens e Patrimônio</h1>
            <p className="text-slate-600 dark:text-slate-400">Cadastro e controle de bens móveis das igrejas</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/app-ui/asset-inventories"
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium transition-colors"
          >
            <ClipboardList className="w-4 h-4" /> Inventários
          </Link>
          <button
            onClick={() => setShowInventoryStart(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-white rounded-lg hover:bg-slate-800 text-sm font-medium transition-colors"
          >
            <ClipboardList className="w-4 h-4" /> Iniciar Inventário
          </button>
          <button
            onClick={() => setShowPrint(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium transition-colors"
          >
            <Printer className="w-4 h-4" /> Imprimir Etiquetas {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
          </button>
          {canCreate('assets') && (
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-medium transition-colors"
            >
              <Upload className="w-4 h-4" /> Importar CSV
            </button>
          )}
          {canCreate('assets') && (
            <button
              onClick={() => setFormDrawer({ open: true, assetId: null })}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" /> Novo Bem
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => load()} className="flex items-center gap-1 text-red-600 hover:text-red-800 font-medium">
            <RefreshCw className="w-4 h-4" /> Tentar novamente
          </button>
        </div>
      )}

      {/* Filtros */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-6 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, código ou descrição..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
          />
        </div>
        <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pb-1">
          <select value={regionalId} onChange={(e) => handleRegionalChange(e.target.value)} className="flex-shrink-0 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white">
            <option value="">Todas as regionais</option>
            {regionalOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <select value={churchId} onChange={(e) => setChurchId(e.target.value)} className="flex-shrink-0 max-w-56 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white">
            <option value="">{regionalId ? 'Todas as igrejas desta regional' : 'Todas as igrejas'}</option>
            {churchOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input
            type="text"
            placeholder="Setor..."
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="flex-shrink-0 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white w-28"
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="flex-shrink-0 px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white">
            <option value="">Todos os status</option>
            <option value="active">Ativo</option>
            <option value="manutencao">Manutenção</option>
            <option value="baixado">Baixado</option>
          </select>

          <div className="flex-shrink-0 w-px self-stretch bg-slate-200 dark:bg-slate-700" />

          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setActivePreset(''); }} className="flex-shrink-0 px-2 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm" />
          <span className="flex-shrink-0 text-sm text-slate-500">até</span>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setActivePreset(''); }} className="flex-shrink-0 px-2 py-2 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm" />

          {DATE_RANGE_PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPreset(p.key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                activePreset === p.key
                  ? 'bg-amber-600 border-amber-600 text-white'
                  : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500 dark:text-slate-400">Carregando...</div>
        ) : assets.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-slate-400 dark:text-slate-500">Nenhum bem encontrado.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-3 py-3"><input type="checkbox" checked={selectedIds.length === assets.length} onChange={toggleSelectAll} /></th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Foto</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Código</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Nome</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Setor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Igreja</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Local</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {assets.map((asset) => (
                <tr key={asset.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <td className="px-3 py-3"><input type="checkbox" checked={selectedIds.includes(asset.id)} onChange={() => toggleSelect(asset.id)} /></td>
                  <td className="px-4 py-3">
                    {asset.photoUrl ? (
                      <img src={asset.photoUrl} alt={asset.name} className="w-10 h-10 rounded-lg object-cover border border-slate-200" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                        <Package className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{asset.code}</td>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{asset.name}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{asset.sector || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">{asset.church?.name || '—'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
                    {locationLabel(asset.locationType, asset.locationDetail)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${STATUS_COLORS[asset.status] || 'bg-slate-100 text-slate-700'}`}>
                      {STATUS_LABELS[asset.status] || asset.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setViewAssetId(asset.id)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" title="Ver detalhes">
                        <Eye className="w-4 h-4 text-slate-500" />
                      </button>
                      {canEdit('assets') && (
                        <button onClick={() => setFormDrawer({ open: true, assetId: asset.id })} className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors" title="Editar">
                          <Edit className="w-4 h-4 text-blue-600" />
                        </button>
                      )}
                      {canDelete('assets') && (
                        <button onClick={() => setDeleteTarget(asset)} className="p-1.5 hover:bg-red-100 rounded-lg transition-colors" title="Excluir">
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > pageSize && (
        <div className="flex items-center justify-between mt-4 px-1">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} de {total} bens
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"><ChevronsLeft className="w-4 h-4" /></button>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
            <span className="px-3 py-1 text-sm font-medium">{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30"><ChevronsRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir bem"
        message={`Tem certeza que deseja excluir "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => (deleting ? null : setDeleteTarget(null))}
      />
      <AlertDialog open={Boolean(alertMessage)} title="Atenção" message={alertMessage} variant="warning" onClose={() => setAlertMessage('')} />

      {showImport && (
        <AssetImportModal
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); load(page); }}
        />
      )}
      {showPrint && (
        <AssetLabelPrintModal
          assets={selectedIds.length > 0 ? assets.filter((a) => selectedIds.includes(a.id)) : assets}
          onClose={() => setShowPrint(false)}
        />
      )}
      {viewAssetId && (
        <AssetDetailModal
          assetId={viewAssetId}
          onClose={() => setViewAssetId(null)}
          onEdit={(id) => { setViewAssetId(null); setFormDrawer({ open: true, assetId: id }); }}
        />
      )}
      {formDrawer.open && (
        <AssetFormDrawer
          assetId={formDrawer.assetId}
          onClose={() => setFormDrawer({ open: false, assetId: null })}
          onSaved={() => { setFormDrawer({ open: false, assetId: null }); load(page); }}
        />
      )}
      {showInventoryStart && (
        <AssetInventoryStartModal onClose={() => setShowInventoryStart(false)} />
      )}
    </div>
  );
}
