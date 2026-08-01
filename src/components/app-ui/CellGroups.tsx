import { useCallback, useEffect, useState } from 'react';
import { Plus, Search, Users, Calendar, TrendingUp, User, Network, X, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { apiBase } from '../../lib/apiBase';
import { CellForm, EMPTY_CELL_FORM, leadersFromApi, type CellFormValues } from './cells/CellForm';
import { AlertDialog, ConfirmDialog } from './shared/ConfirmDialog';
import { usePermissions } from '../../lib/usePermissions';

function perfilAtual(): string {
  try {
    return JSON.parse(localStorage.getItem('mrm_user') || '{}').profileType || 'church';
  } catch {
    return 'church';
  }
}

interface CellRow {
  id: string;
  name: string;
  color?: string | null;
  photo?: string | null;
  cellType?: string | null;
  address?: string | null;
  description?: string | null;
  meetingDay?: string | null;
  meetingTime?: string | null;
  leader?: { fullName?: string | null; mobile?: string | null; phone?: string | null } | null;
  leaderId?: string | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  addressNeighborhood?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressZipcode?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  peopleCount?: number;
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('mrm_token') ?? '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export function CellGroups() {
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions(perfilAtual());
  const [cells, setCells] = useState<CellRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [showNew, setShowNew] = useState(false);
  /** null = cadastro novo; id = edicao do GF correspondente. */
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [novo, setNovo] = useState<CellFormValues>(EMPTY_CELL_FORM);
  const [salvando, setSalvando] = useState(false);
  const [erroNovo, setErroNovo] = useState('');
  const [excluindo, setExcluindo] = useState<CellRow | null>(null);
  const [excluindoAgora, setExcluindoAgora] = useState(false);
  const [aviso, setAviso] = useState('');

  const loadData = useCallback(async () => {
    try {
      const cellsRes = await fetch(`${apiBase}/cell-groups`, { headers: authHeaders() }).then((r) => r.json());
      if (Array.isArray(cellsRes)) setCells(cellsRes);
    } catch (err) {
      console.error('[CellGroups]', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function abrirEdicao(cell: CellRow) {
    setEditandoId(cell.id);
    setNovo({
      ...EMPTY_CELL_FORM,
      name: cell.name ?? '',
      network: cell.cellType ?? EMPTY_CELL_FORM.network,
      color: cell.color ?? EMPTY_CELL_FORM.color,
      photo: cell.photo ?? '',
      leaders: leadersFromApi(cell),
      addressStreet: cell.addressStreet ?? '',
      addressNumber: cell.addressNumber ?? '',
      addressComplement: cell.addressComplement ?? '',
      addressNeighborhood: cell.addressNeighborhood ?? '',
      addressCity: cell.addressCity ?? '',
      addressState: cell.addressState ?? '',
      addressZipcode: cell.addressZipcode ?? '',
      latitude: cell.latitude != null ? String(cell.latitude) : '',
      longitude: cell.longitude != null ? String(cell.longitude) : '',
      meetingDay: cell.meetingDay ?? EMPTY_CELL_FORM.meetingDay,
      meetingTime: cell.meetingTime ? String(cell.meetingTime).slice(11, 16) : '',
    });
    setErroNovo('');
    setShowNew(true);
  }

  function fecharModal() {
    setShowNew(false);
    setEditandoId(null);
    setNovo(EMPTY_CELL_FORM);
    setErroNovo('');
  }

  async function salvarNovo() {
    setSalvando(true);
    setErroNovo('');
    try {
      const res = await fetch(
        editandoId ? `${apiBase}/cell-groups/${editandoId}` : `${apiBase}/cell-groups`,
        {
          method: editandoId ? 'PATCH' : 'POST',
          headers: authHeaders(),
          body: JSON.stringify(novo),
        }
      );
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'Erro ao salvar o GF');
      const editou = Boolean(editandoId);
      fecharModal();
      if (editou) loadData();
      else navigate(`/app-ui/cells/${result.id}`);
    } catch (err) {
      setErroNovo(err instanceof Error ? err.message : 'Erro ao salvar o GF');
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    setExcluindoAgora(true);
    try {
      const res = await fetch(`${apiBase}/cell-groups/${excluindo.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (res.ok) {
        await loadData();
      } else {
        const err = await res.json().catch(() => ({}));
        setAviso(err.error ?? 'Não foi possível excluir o GF.');
      }
    } finally {
      setExcluindoAgora(false);
      setExcluindo(null);
    }
  }

  const totalPessoas = cells.reduce((sum, c) => sum + (c.peopleCount ?? 0), 0);

  const filteredCells = cells.filter(
    (c) =>
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.leader?.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-6 text-slate-600">Carregando GFs...</div>;

  const stats = [
    { label: 'Total de GFs', value: cells.length, icon: Users, bg: 'bg-purple-100', fg: 'text-purple-600' },
    { label: 'Pessoas em GFs', value: totalPessoas, icon: User, bg: 'bg-blue-100', fg: 'text-blue-600' },
    { label: 'Com líder definido', value: cells.filter((c) => c.leader?.fullName).length, icon: TrendingUp, bg: 'bg-green-100', fg: 'text-green-600' },
    { label: 'Sem líder definido', value: cells.filter((c) => !c.leader?.fullName).length, icon: Calendar, bg: 'bg-orange-100', fg: 'text-orange-600' },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
            <Network className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">GF (Grupos Familiares)</h1>
            <p className="text-slate-600 dark:text-slate-400">Gerencie grupos e acompanhe crescimento</p>
          </div>
        </div>
        {canCreate('cells') && (
        <button
          onClick={() => {
            setEditandoId(null);
            setNovo(EMPTY_CELL_FORM);
            setErroNovo('');
            setShowNew(true);
          }}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Novo GF
        </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 ${s.bg} rounded-lg flex items-center justify-center`}>
                <s.icon className={`w-6 h-6 ${s.fg}`} />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">{s.label}</p>
                <p className="text-2xl font-bold text-slate-900">{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-6 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Lista de GFs</h2>
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar GFs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-6 py-3 font-semibold">GF</th>
                  <th className="px-4 py-3 font-semibold">Líder</th>
                  <th className="px-4 py-3 font-semibold">Rede</th>
                  <th className="px-4 py-3 font-semibold">Reunião</th>
                  <th className="px-4 py-3 font-semibold text-right">Pessoas</th>
                  <th className="px-4 py-3 font-semibold text-right w-24">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredCells.map((cell) => (
                  <tr
                    key={cell.id}
                    onClick={() => navigate(`/app-ui/cells/${cell.id}`)}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: cell.color || '#8B5CF6' }}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{cell.name}</p>
                          <p className="text-xs text-slate-500 truncate">
                            {cell.address || cell.description || 'Sem endereço'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {cell.leader?.fullName || <span className="text-slate-400">Não definido</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{cell.cellType || '-'}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {cell.meetingDay || '-'} {cell.meetingTime ? String(cell.meetingTime).slice(11, 16) : ''}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{cell.peopleCount ?? 0}</td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {canEdit('cells') && (
                        <button
                          onClick={() => abrirEdicao(cell)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-slate-100"
                          title="Editar GF"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        )}
                        {canDelete('cells') && (
                        <button
                          onClick={() => setExcluindo(cell)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100"
                          title="Excluir GF"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredCells.length === 0 && (
              <p className="text-slate-500 text-center py-8">Nenhum GF encontrado.</p>
            )}
        </div>
      </div>

      <ConfirmDialog
        open={!!excluindo}
        title={excluindo ? `Excluir o GF "${excluindo.name}"?` : 'Excluir GF?'}
        message={
          excluindo?.peopleCount
            ? `As ${excluindo.peopleCount} pessoa(s) do grupo voltam para a fila de quem está sem GF. O GF sai da lista, mas o histórico é preservado.`
            : 'O GF sai da lista, mas o histórico é preservado.'
        }
        confirmLabel="Excluir"
        variant="danger"
        loading={excluindoAgora}
        onConfirm={confirmarExclusao}
        onCancel={() => setExcluindo(null)}
      />

      <AlertDialog
        open={!!aviso}
        title="Não foi possível excluir"
        message={aviso}
        variant="warning"
        onClose={() => setAviso('')}
      />

      {showNew && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{editandoId ? 'Editar GF' : 'Novo GF'}</h2>
                <p className="text-sm text-slate-500">
                  {editandoId ? novo.name : 'Cadastre um novo Grupo Familiar'}
                </p>
              </div>
              <button onClick={fecharModal} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <CellForm
                values={novo}
                onChange={setNovo}
                onSubmit={salvarNovo}
                saving={salvando}
                error={erroNovo}
                submitLabel={editandoId ? 'Salvar alterações' : 'Salvar GF'}
                onCancel={fecharModal}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
