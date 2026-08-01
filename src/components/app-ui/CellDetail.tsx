import { useParams, Link } from 'react-router';
import { Calendar, ExternalLink, FileText, MapPin, Pencil, Phone, Trash2, User, Users } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { apiBase } from '../../lib/apiBase';
import { buildAddressLabel, buildMapEmbedUrl, buildMapsLink } from '../../lib/geo';
import { AttachMemberModal } from './cells/AttachMemberModal';
import { ConfirmDialog } from './shared/ConfirmDialog';
import { usePermissions } from '../../lib/usePermissions';

function perfilAtual(): string {
  try {
    return JSON.parse(localStorage.getItem('mrm_user') || '{}').profileType || 'church';
  } catch {
    return 'church';
  }
}

interface ImportContact {
  id: string;
  name: string | null;
  phone: string | null;
}

interface CellTag {
  id: string;
  name: string;
  color?: string | null;
}

interface CellMemberLink {
  id: string;
  memberId: string;
  member?: { id: string; fullName?: string | null; mobile?: string | null } | null;
}

interface CellDetailData {
  id: string;
  name: string;
  color?: string | null;
  photo?: string | null;
  cellType?: string | null;
  address?: string | null;
  meetingDay?: string | null;
  meetingTime?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressNeighborhood?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressZipcode?: string | null;
  leader?: { fullName?: string | null; mobile?: string | null; phone?: string | null } | null;
  members?: CellMemberLink[];
  meetings?: Array<{ id: string }>;
  tags?: CellTag[];
}

interface Pessoa {
  key: string;
  id: string;
  nome: string;
  telefone: string;
  origem: 'member' | 'import';
  /** Token do link público que o líder recebeu, quando já foi gerado. */
  token?: string;
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem('mrm_token') ?? '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export function CellDetail() {
  const { id } = useParams();
  const { canEdit, canDelete } = usePermissions(perfilAtual());
  const [cell, setCell] = useState<CellDetailData | null>(null);
  const [importContacts, setImportContacts] = useState<ImportContact[]>([]);
  const [cellNames, setCellNames] = useState<Record<string, string>>({});
  const [tokenPorPessoa, setTokenPorPessoa] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showAttach, setShowAttach] = useState(false);
  const [removendo, setRemovendo] = useState<Pessoa | null>(null);
  const [removendoAgora, setRemovendoAgora] = useState(false);

  const loadCell = useCallback(async () => {
    try {
      const [cellRes, contactsRes, groupsRes] = await Promise.all([
        fetch(`${apiBase}/cell-groups/${id}`, { headers: authHeaders() }),
        fetch(`${apiBase}/cell-groups/${id}/contacts`, { headers: authHeaders() }),
        fetch(`${apiBase}/cell-groups`, { headers: authHeaders() }),
      ]);
      if (!cellRes.ok) throw new Error('Não encontrado');
      setCell(await cellRes.json());
      if (contactsRes.ok) {
        const payload = await contactsRes.json();
        setImportContacts(payload.contacts ?? []);
        setTokenPorPessoa(payload.shareTokens ?? {});
      }
      if (groupsRes.ok) {
        const groups = await groupsRes.json();
        setCellNames(Object.fromEntries((groups ?? []).map((g: { id: string; name: string }) => [g.id, g.name])));
      }
    } catch (err) {
      console.error('[CellDetail]', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadCell();
  }, [loadCell]);

  async function confirmarRemocao() {
    if (!removendo) return;
    setRemovendoAgora(true);
    try {
      const payload =
        removendo.origem === 'member'
          ? { source: 'member', memberId: removendo.id }
          : { source: 'import', importRowId: removendo.id };
      const res = await fetch(`${apiBase}/cell-groups/${id}/members`, {
        method: 'DELETE',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      if (res.ok) await loadCell();
    } finally {
      setRemovendoAgora(false);
      setRemovendo(null);
    }
  }

  if (loading) return <div className="p-6 text-slate-600">Carregando GF...</div>;

  if (!cell) {
    return (
      <div className="p-6">
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-slate-600 dark:text-slate-400">GF não encontrado</p>
          <Link to="/app-ui/cells" className="text-purple-600 hover:text-purple-700 mt-4 inline-block">
            Voltar para GFs
          </Link>
        </div>
      </div>
    );
  }

  const addressLabel = buildAddressLabel(cell) || cell.address || '';
  const mapUrl = buildMapEmbedUrl(cell);
  const mapsLink = buildMapsLink(cell);

  const pessoas: Pessoa[] = [
    ...(cell.members ?? []).map((m) => ({
      key: `m:${m.memberId}`,
      id: m.memberId as string,
      nome: m.member?.fullName ?? 'Sem nome',
      telefone: m.member?.mobile ?? '',
      origem: 'member' as const,
      token: tokenPorPessoa[`m:${m.memberId}`],
    })),
    ...importContacts.map((c) => ({
      key: `i:${c.id}`,
      id: c.id,
      nome: c.name ?? 'Sem nome',
      telefone: c.phone ?? '',
      origem: 'import' as const,
      token: tokenPorPessoa[`i:${c.id}`],
    })),
  ];
  const totalPeople = pessoas.length;

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${cell.color || '#8B5CF6'}22` }}
          >
            {cell.photo ? (
              <img src={cell.photo} alt={cell.name} className="w-12 h-12 rounded-xl object-cover" />
            ) : (
              <Users className="w-6 h-6" style={{ color: cell.color || '#8B5CF6' }} />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{cell.name}</h1>
            <p className="text-slate-600 dark:text-slate-400">{cell.cellType || 'GF'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/app-ui/cells/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            <Pencil className="w-4 h-4" />
            Editar
          </Link>
          {canEdit('cell_group_members') && (
          <button
            onClick={() => setShowAttach(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Users className="w-4 h-4" />
            Anexar pessoas
          </button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Informações do GF</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <User className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Líder</p>
                  <p className="font-semibold text-slate-900">{cell.leader?.fullName || 'Não definido'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Phone className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Telefone</p>
                  <p className="font-semibold text-slate-900">{cell.leader?.mobile || cell.leader?.phone || '-'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-600 dark:text-slate-400">Endereço</p>
                  <p className="font-semibold text-slate-900">{addressLabel || '-'}</p>
                  {mapsLink && (
                    <a
                      href={mapsLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 mt-1"
                    >
                      Abrir no Google Maps <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Horário</p>
                  <p className="font-semibold text-slate-900">
                    {cell.meetingDay || '-'} às {cell.meetingTime ? String(cell.meetingTime).slice(11, 16) : '-'}
                  </p>
                </div>
              </div>
            </div>

            {mapUrl && (
              <iframe
                title="Mapa do GF"
                src={mapUrl}
                className="w-full h-56 rounded-lg border border-slate-200 mt-4"
                loading="lazy"
              />
            )}
          </div>

          {/* Uma lista so: para o lider, quem veio do cadastro e quem veio de uma
              lista importada e a mesma coisa - gente do GF dele. A origem vira
              etiqueta, nao uma secao separada (duas secoes davam a impressao de
              que nada tinha sido anexado). */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Pessoas do GF</h2>
            <p className="text-sm text-slate-500 mb-4">{pessoas.length} pessoa(s) neste grupo</p>
            <div className="space-y-2">
              {pessoas.map((p) => (
                <div
                  key={p.key}
                  className="flex items-center justify-between gap-3 p-3 border border-slate-100 rounded-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{p.nome}</p>
                      <p className="text-xs text-slate-500">
                        {p.telefone || 'Sem telefone'}
                        <span
                          className={`ml-2 px-1.5 py-0.5 rounded-full ${
                            p.origem === 'member'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {p.origem === 'member' ? 'Membro' : 'Lista importada'}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.token && (
                      <a
                        href={`/gf-resumo/${p.token}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-400 hover:text-purple-600"
                        title="Abrir o resumo que o lider recebeu"
                      >
                        <FileText className="w-4 h-4" />
                      </a>
                    )}
                    {canDelete('cell_group_members') && (
                    <button
                      onClick={() => setRemovendo(p)}
                      className="text-slate-400 hover:text-red-500"
                      title="Remover do GF"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    )}
                  </div>
                </div>
              ))}
              {!pessoas.length && (
                <p className="text-sm text-slate-500">
                  Ninguem anexado ainda. Use “Anexar pessoas” para trazer membros do cadastro ou
                  contatos de uma lista importada.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Estatísticas</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-600 mb-2">Total de pessoas</p>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span className="text-2xl font-bold text-slate-900">{totalPeople}</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-2">Reuniões registradas</p>
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-orange-600" />
                  <span className="text-2xl font-bold text-slate-900">{cell.meetings?.length ?? 0}</span>
                </div>
              </div>
            </div>
          </div>

          {!!cell.tags?.length && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h3 className="font-bold text-slate-900 mb-1">Tag do GF</h3>
              <p className="text-xs text-slate-500 mb-3">
                Aplicada automaticamente no perfil de quem participa do grupo.
              </p>
              <div className="flex flex-wrap gap-2">
                {cell.tags?.map((t) => (
                  <span
                    key={t.id}
                    className="text-xs font-semibold px-2.5 py-1 rounded-full text-white"
                    style={{ backgroundColor: t.color || '#8b5cf6' }}
                  >
                    {t.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!removendo}
        title="Remover do GF?"
        message={
          removendo
            ? `${removendo.nome} sai do GF ${cell.name} e volta para a fila de quem está sem grupo. O histórico da conversa não é apagado.`
            : undefined
        }
        confirmLabel="Remover"
        variant="danger"
        loading={removendoAgora}
        onConfirm={confirmarRemocao}
        onCancel={() => setRemovendo(null)}
      />

      {showAttach && (
        <AttachMemberModal
          cellGroupId={String(id)}
          cellGroupNames={cellNames}
          onClose={() => setShowAttach(false)}
          onAttached={loadCell}
        />
      )}
    </div>
  );
}
