import { useEffect, useMemo, useState } from 'react';
import { Heart, Users, Plus, TrendingUp, Pencil, Trash2, Building2, UserRound, Music2, Mic2, HandHeart, BookOpen, Camera, Radio, Baby, Sparkles, Shield, GraduationCap, LayoutGrid, List } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ConfirmDialog } from './shared/ConfirmDialog';

import { apiBase } from '../../lib/apiBase';

type CampoOption = {
  id: string;
  name: string;
  code?: string | null;
};

type RegionalOption = {
  id: string;
  name: string;
  code?: string | null;
  campoId: string;
};

type ChurchOption = {
  id: string;
  name: string;
  code?: string | null;
  regionalId?: string;
  regional?: {
    id?: string;
    name?: string;
    campoId?: string;
    campo?: {
      id: string;
      name: string;
    };
  };
};

type MinistryRecord = {
  id: string;
  name: string;
  description?: string | null;
  email?: string | null;
  phone?: string | null;
  color?: string | null;
  icon?: string | null;
  isActive: boolean;
  totalMembers: number;
  activeMembers: number;
  leader?: {
    id: string;
    fullName: string;
  } | null;
};

type MemberOption = {
  id: string;
  fullName: string;
};

type MinistryFormState = {
  id?: string;
  name: string;
  description: string;
  email: string;
  phone: string;
  color: string;
  icon: string;
  leaderId: string;
  isActive: boolean;
};

const initialFormState: MinistryFormState = {
  name: '',
  description: '',
  email: '',
  phone: '',
  color: '#8b5cf6',
  icon: 'heart',
  leaderId: '',
  isActive: true,
};

const ministryIconOptions: Array<{ key: string; label: string; icon: LucideIcon }> = [
  { key: 'heart', label: 'Cuidado', icon: Heart },
  { key: 'music', label: 'Louvor', icon: Music2 },
  { key: 'mic', label: 'Pregação', icon: Mic2 },
  { key: 'hand-heart', label: 'Ação social', icon: HandHeart },
  { key: 'book-open', label: 'Ensino', icon: BookOpen },
  { key: 'camera', label: 'Mídia', icon: Camera },
  { key: 'radio', label: 'Comunicação', icon: Radio },
  { key: 'baby', label: 'Infantil', icon: Baby },
  { key: 'users', label: 'Equipe', icon: Users },
  { key: 'sparkles', label: 'Jovens', icon: Sparkles },
  { key: 'shield', label: 'Intercessão', icon: Shield },
  { key: 'graduation-cap', label: 'Discipulado', icon: GraduationCap },
];

function getMinistryIcon(iconKey?: string | null) {
  return ministryIconOptions.find((option) => option.key === iconKey)?.icon || Heart;
}

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('mrm_user') || '{}');
  } catch {
    return {};
  }
}

function normalizeRoleName(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function Ministries() {
  const token = localStorage.getItem('mrm_token');
  const storedUser = readStoredUser();
  const activeFieldId = localStorage.getItem('mrm_active_field_id') || storedUser.campoId || '';
  const normalizedRoleName = normalizeRoleName(storedUser.roleName);
  const isSecretaryOrTreasurer = normalizedRoleName.includes('secret') || normalizedRoleName.includes('tesour');
  const canChooseField = !isSecretaryOrTreasurer;
  const canChooseRegional = !isSecretaryOrTreasurer;
  const canChooseChurch = !isSecretaryOrTreasurer;

  const [fields, setFields] = useState<CampoOption[]>([]);
  const [regionais, setRegionais] = useState<RegionalOption[]>([]);
  const [churches, setChurches] = useState<ChurchOption[]>([]);
  const [ministries, setMinistries] = useState<MinistryRecord[]>([]);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState(activeFieldId);
  const [selectedRegionalId, setSelectedRegionalId] = useState(storedUser.regionalId || '');
  const [selectedChurchId, setSelectedChurchId] = useState(storedUser.churchId || '');
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingMinistries, setLoadingMinistries] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formState, setFormState] = useState<MinistryFormState>(initialFormState);

  const filteredRegionais = useMemo(() => {
    if (!selectedFieldId) {
      return regionais;
    }

    return regionais.filter((regional) => regional.campoId === selectedFieldId);
  }, [regionais, selectedFieldId]);

  const filteredChurches = useMemo(() => {
    const churchesInField = churches.filter((church) => {
      if (!selectedFieldId) {
        return true;
      }

      return church.regional?.campoId === selectedFieldId || church.regional?.campo?.id === selectedFieldId;
    });

    if (!selectedRegionalId) {
      return churchesInField;
    }

    return churchesInField.filter((church) => church.regional?.id === selectedRegionalId || church.regionalId === selectedRegionalId);
  }, [churches, selectedFieldId, selectedRegionalId]);

  const stats = useMemo(() => {
    const totalMinistries = ministries.length;
    const activeMembers = ministries.reduce((sum, ministry) => sum + ministry.activeMembers, 0);
    const ministriesWithLeader = ministries.filter((ministry) => ministry.leader?.id).length;
    const activationRate = totalMinistries ? Math.round((ministries.filter((ministry) => ministry.isActive).length / totalMinistries) * 100) : 0;

    return { totalMinistries, activeMembers, ministriesWithLeader, activationRate };
  }, [ministries]);

  useEffect(() => {
    const loadFilters = async () => {
      if (!token) {
        setError('Sessao expirada. Faca login novamente.');
        setLoadingFilters(false);
        return;
      }

      try {
        setLoadingFilters(true);
        setError('');

        const fieldQuery = selectedFieldId ? `?fieldId=${encodeURIComponent(selectedFieldId)}` : '';
        const [fieldsResponse, regionaisResponse, churchesResponse] = await Promise.all([
          fetch(`${apiBase}/campos`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${apiBase}/regionais${fieldQuery}`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${apiBase}/churches${fieldQuery}`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (!fieldsResponse.ok || !regionaisResponse.ok || !churchesResponse.ok) {
          throw new Error('Falha ao carregar campos, regionais e igrejas.');
        }

        const [fieldsData, regionaisData, churchesData] = await Promise.all([
          fieldsResponse.json(),
          regionaisResponse.json(),
          churchesResponse.json(),
        ]);

        const nextFields = Array.isArray(fieldsData) ? fieldsData : [];
        const nextRegionais = Array.isArray(regionaisData) ? regionaisData : [];
        const nextChurches = Array.isArray(churchesData) ? churchesData : [];

        setFields(nextFields);
        setRegionais(nextRegionais);
        setChurches(nextChurches);

        if (!canChooseField && activeFieldId && activeFieldId !== selectedFieldId) {
          setSelectedFieldId(activeFieldId);
        }

        if (!canChooseRegional && storedUser.regionalId && storedUser.regionalId !== selectedRegionalId) {
          setSelectedRegionalId(storedUser.regionalId);
        }

        const allowedChurches = nextChurches.filter((church: ChurchOption) => {
          if (selectedRegionalId) {
            return church.regional?.id === selectedRegionalId || church.regionalId === selectedRegionalId;
          }

          return true;
        });

        if (!canChooseChurch && storedUser.churchId && storedUser.churchId !== selectedChurchId) {
          setSelectedChurchId(storedUser.churchId);
        } else if (!selectedChurchId && allowedChurches[0]?.id) {
          setSelectedChurchId(allowedChurches[0].id);
        } else if (selectedChurchId && !allowedChurches.some((church: ChurchOption) => church.id === selectedChurchId)) {
          setSelectedChurchId(allowedChurches[0]?.id || '');
        }
      } catch (loadError) {
        setFields([]);
        setRegionais([]);
        setChurches([]);
        setError(loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar os filtros.');
      } finally {
        setLoadingFilters(false);
      }
    };

    loadFilters();
  }, [token, selectedFieldId, selectedRegionalId, selectedChurchId, activeFieldId, canChooseField, canChooseRegional, canChooseChurch, storedUser.regionalId, storedUser.churchId]);

  useEffect(() => {
    const loadMembers = async () => {
      if (!token || !selectedChurchId) {
        setMembers([]);
        setLoadingMembers(false);
        return;
      }

      try {
        setLoadingMembers(true);
        const response = await fetch(`${apiBase}/churches/${selectedChurchId}/members`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error('Falha ao carregar membros da igreja.');
        }

        const data = await response.json();
        const nextMembers = Array.isArray(data) ? data : [];
        setMembers(nextMembers);
        setFormState((prev) => ({
          ...prev,
          leaderId: nextMembers.some((member: MemberOption) => member.id === prev.leaderId) ? prev.leaderId : '',
        }));
      } catch (loadError) {
        setMembers([]);
        setFormState((prev) => ({ ...prev, leaderId: '' }));
        setError(loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar os membros da igreja.');
      } finally {
        setLoadingMembers(false);
      }
    };

    if (!loadingFilters) {
      loadMembers();
    }
  }, [token, selectedChurchId, loadingFilters]);

  useEffect(() => {
    const loadMinistries = async () => {
      if (!token || !selectedChurchId) {
        setMinistries([]);
        setLoadingMinistries(false);
        return;
      }

      try {
        setLoadingMinistries(true);
        setError('');

        const response = await fetch(`${apiBase}/churches/${selectedChurchId}/ministries`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error('Falha ao carregar ministerios.');
        }

        const data = await response.json();
        setMinistries(Array.isArray(data) ? data : []);
      } catch (loadError) {
        setMinistries([]);
        setError(loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar os ministerios.');
      } finally {
        setLoadingMinistries(false);
      }
    };

    if (!loadingFilters) {
      loadMinistries();
    }
  }, [token, selectedChurchId, loadingFilters]);

  const resetForm = () => {
    setFormState(initialFormState);
    setFormOpen(false);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!token || !selectedChurchId) {
      setError('Selecione a igreja para cadastrar o ministerio.');
      return;
    }

    if (!formState.name.trim()) {
      setError('Informe o nome do ministerio.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const url = formState.id ? `${apiBase}/ministries/${formState.id}` : `${apiBase}/churches/${selectedChurchId}/ministries`;
      const method = formState.id ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formState.name.trim(),
          description: formState.description || undefined,
          email: formState.email || undefined,
          phone: formState.phone || undefined,
          color: formState.color || undefined,
          icon: formState.icon || undefined,
          leaderId: formState.leaderId || undefined,
          isActive: formState.isActive,
        }),
      });

      if (!response.ok) {
        const message = await response.json();
        throw new Error(message.error || 'Falha ao salvar ministerio.');
      }

      const savedMinistry = await response.json();
      setMinistries((prev) => {
        const remaining = prev.filter((item) => item.id !== savedMinistry.id);
        return [...remaining, savedMinistry].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
      });
      resetForm();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Nao foi possivel salvar o ministerio.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (ministry: MinistryRecord) => {
    setFormState({
      id: ministry.id,
      name: ministry.name,
      description: ministry.description || '',
      email: ministry.email || '',
      phone: ministry.phone || '',
      color: ministry.color || '#8b5cf6',
      icon: ministry.icon || 'heart',
      leaderId: ministry.leader?.id || '',
      isActive: ministry.isActive,
    });
    setFormOpen(true);
  };

  const handleDelete = (ministryId: string) => {
    const target = ministries.find((m) => m.id === ministryId);
    setDeleteTarget({ id: ministryId, name: target?.name || 'este ministério' });
  };

  const confirmDelete = async () => {
    if (!token || !deleteTarget) return;
    try {
      setDeleting(true);
      setError('');
      const response = await fetch(`${apiBase}/ministries/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error('Falha ao remover ministério.');
      }

      setMinistries((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Não foi possível remover o ministério.');
    } finally {
      setDeleting(false);
    }
  };

  const selectedChurch = churches.find((church) => church.id === selectedChurchId) || null;
  const selectedFormIcon = getMinistryIcon(formState.icon);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <Heart className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Ministérios</h1>
            <p className="text-slate-600 dark:text-slate-400">Gerencie departamentos e equipes ministeriais</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormState(initialFormState);
            setFormOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium"
        >
          <Plus className="w-5 h-5" />
          Novo Ministério
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Campo</label>
          <select
            value={selectedFieldId}
            onChange={(event) => {
              setSelectedFieldId(event.target.value);
              setSelectedRegionalId('');
              setSelectedChurchId('');
            }}
            disabled={!canChooseField || loadingFilters}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:text-slate-500"
          >
            <option value="">Todos os campos</option>
            {fields.map((field) => (
              <option key={field.id} value={field.id}>
                {field.code ? `${field.code} - ` : ''}{field.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Regional</label>
          <select
            value={selectedRegionalId}
            onChange={(event) => {
              setSelectedRegionalId(event.target.value);
              setSelectedChurchId('');
            }}
            disabled={!canChooseRegional || loadingFilters}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:text-slate-500"
          >
            <option value="">Todas as regionais</option>
            {filteredRegionais.map((regional) => (
              <option key={regional.id} value={regional.id}>
                {regional.code ? `${regional.code} - ` : ''}{regional.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Igreja</label>
          <select
            value={selectedChurchId}
            onChange={(event) => setSelectedChurchId(event.target.value)}
            disabled={!canChooseChurch || loadingFilters}
            className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 disabled:text-slate-500"
          >
            <option value="">Selecione a igreja</option>
            {filteredChurches.map((church) => (
              <option key={church.id} value={church.id}>
                {church.code ? `${church.code} - ` : ''}{church.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-slate-600 dark:text-slate-400 truncate">Total Ministérios</p>
            <p className="text-xl font-bold text-slate-900">{stats.totalMinistries}</p>
          </div>
          <div className="w-9 h-9 shrink-0 bg-purple-100 rounded-lg flex items-center justify-center">
            <Heart className="w-4 h-4 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-slate-600 dark:text-slate-400 truncate">Membros Ativos</p>
            <p className="text-xl font-bold text-slate-900">{stats.activeMembers}</p>
          </div>
          <div className="w-9 h-9 shrink-0 bg-blue-100 rounded-lg flex items-center justify-center">
            <Users className="w-4 h-4 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-slate-600 dark:text-slate-400 truncate">Com Líder Definido</p>
            <p className="text-xl font-bold text-slate-900">{stats.ministriesWithLeader}</p>
          </div>
          <div className="w-9 h-9 shrink-0 bg-green-100 rounded-lg flex items-center justify-center">
            <UserRound className="w-4 h-4 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-slate-600 dark:text-slate-400 truncate">Taxa de Ativação</p>
            <p className="text-xl font-bold text-slate-900">{stats.activationRate}%</p>
          </div>
          <div className="w-9 h-9 shrink-0 bg-orange-100 rounded-lg flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-orange-600" />
          </div>
        </div>
      </div>

      {formOpen ? (
        <form onSubmit={handleSubmit} className="mb-8 rounded-xl border border-slate-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{formState.id ? 'Editar Ministério' : 'Novo Ministério'}</h2>
              <p className="text-sm text-slate-500">O ministério começa sem líder. O vínculo de membros será refletido automaticamente no card.</p>
            </div>
            <button type="button" onClick={resetForm} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
              Fechar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Nome *</label>
              <input
                type="text"
                value={formState.name}
                onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Ex.: Louvor e Adoração"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Ícone</label>
              <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <span className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl overflow-hidden shadow-md" style={{ backgroundColor: formState.color }}>
                  <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10 pointer-events-none" />
                  <selectedFormIcon className="w-5 h-5 text-white relative z-10 drop-shadow" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {ministryIconOptions.find((option) => option.key === formState.icon)?.label || 'Ícone selecionado'}
                  </p>
                  <p className="text-xs text-slate-500">Escolha em uma lista visual abaixo</p>
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Descrição</label>
              <textarea
                value={formState.description}
                onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 min-h-[96px]"
                placeholder="Resumo do propósito do ministério"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Escolher ícone</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {ministryIconOptions.map((option) => {
                  const OptionIcon = option.icon;
                  const isSelected = formState.icon === option.key;

                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setFormState((prev) => ({ ...prev, icon: option.key }))}
                      className={`flex items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                        isSelected
                          ? 'border-purple-500 bg-purple-50 text-purple-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-lg flex-shrink-0 relative overflow-hidden flex items-center justify-center shadow-sm" style={{ backgroundColor: isSelected ? '#7c3aed' : formState.color }}>
                        <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10 pointer-events-none" />
                        <OptionIcon className="w-4 h-4 text-white relative z-10 drop-shadow" />
                      </div>
                      <span className="text-sm font-medium">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Líder do Ministério</label>
              <select
                value={formState.leaderId}
                onChange={(event) => setFormState((prev) => ({ ...prev, leaderId: event.target.value }))}
                disabled={!selectedChurchId || loadingMembers}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-50 disabled:text-slate-500"
              >
                <option value="">{loadingMembers ? 'Carregando membros...' : 'Sem líder definido'}</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">Esta lista vem da tabela real de membros da igreja selecionada.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">E-mail</label>
              <input
                type="email"
                value={formState.email}
                onChange={(event) => setFormState((prev) => ({ ...prev, email: event.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="ministerio@igreja.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Telefone</label>
              <input
                type="text"
                value={formState.phone}
                onChange={(event) => setFormState((prev) => ({ ...prev, phone: event.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="(11) 99999-9999"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Cor</label>
              <input
                type="color"
                value={formState.color}
                onChange={(event) => setFormState((prev) => ({ ...prev, color: event.target.value }))}
                className="w-full h-[46px] px-2 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={formState.isActive}
                onChange={(event) => setFormState((prev) => ({ ...prev, isActive: event.target.checked }))}
              />
              Ministério ativo
            </label>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={resetForm} className="px-4 py-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-60">
              {saving ? 'Salvando...' : formState.id ? 'Atualizar Ministério' : 'Criar Ministério'}
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loadingMinistries ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Carregando ministérios...
        </div>
      ) : null}

      <div className="mb-8">
        <div className="flex items-center justify-between mb-6 gap-3">
          <h2 className="text-xl font-bold text-slate-900">Departamentos Ministeriais</h2>
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'cards' ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              Cards
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === 'table' ? 'bg-purple-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <List className="w-4 h-4" />
              Tabela
            </button>
          </div>
        </div>

        {viewMode === 'cards' ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ministries.map((ministry) => {
            const engagement = ministry.totalMembers ? Math.round((ministry.activeMembers / ministry.totalMembers) * 100) : 0;
            const MinistryIcon = getMinistryIcon(ministry.icon);

            return (
              <div key={ministry.id} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <span className="relative flex h-12 w-12 items-center justify-center rounded-xl overflow-hidden shadow-md" style={{ backgroundColor: ministry.color || '#8b5cf6' }}>
                    <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10 pointer-events-none" />
                    <MinistryIcon className="w-6 h-6 text-white relative z-10 drop-shadow" />
                  </span>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                    {ministry.totalMembers}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-lg mb-2">{ministry.name}</h3>
                <p className="text-sm text-slate-600 mb-1">Líder: {ministry.leader?.fullName || 'Não definido'}</p>
                <p className="text-xs text-slate-500 min-h-[32px]">{ministry.description || 'Sem descrição cadastrada.'}</p>

                <div className="space-y-2 mb-4 mt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Total de Membros</span>
                    <span className="font-semibold text-slate-900">{ministry.totalMembers}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Membros Ativos</span>
                    <span className="font-semibold text-green-600">{ministry.activeMembers}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Status</span>
                    <span className={`font-semibold ${ministry.isActive ? 'text-green-600' : 'text-slate-500'}`}>
                      {ministry.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div className="h-2 rounded-full" style={{ width: `${engagement}%`, backgroundColor: ministry.color || '#8b5cf6' }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{engagement}% engajamento</p>
                </div>

                <div className="flex gap-2">
                  <button type="button" onClick={() => handleEdit(ministry)} className="flex-1 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 font-medium flex items-center justify-center gap-2">
                    <Pencil className="w-4 h-4" />
                    Editar
                  </button>
                  <button type="button" onClick={() => handleDelete(ministry.id)} className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        ) : (
          <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Ministério</th>
                  <th className="px-4 py-3">Líder</th>
                  <th className="px-4 py-3 text-center">Total</th>
                  <th className="px-4 py-3 text-center">Ativos</th>
                  <th className="px-4 py-3 text-center">Engajamento</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ministries.map((ministry) => {
                  const engagement = ministry.totalMembers ? Math.round((ministry.activeMembers / ministry.totalMembers) * 100) : 0;
                  const MinistryIcon = getMinistryIcon(ministry.icon);
                  return (
                    <tr key={ministry.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl overflow-hidden shadow-md" style={{ backgroundColor: ministry.color || '#8b5cf6' }}>
                            <span className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/10 to-black/10 pointer-events-none" />
                            <MinistryIcon className="w-4 h-4 text-white relative z-10 drop-shadow" />
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">{ministry.name}</p>
                            {ministry.description ? <p className="text-xs text-slate-500 truncate">{ministry.description}</p> : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{ministry.leader?.fullName || <span className="text-slate-400">Não definido</span>}</td>
                      <td className="px-4 py-3 text-center font-semibold text-slate-900">{ministry.totalMembers}</td>
                      <td className="px-4 py-3 text-center font-semibold text-green-600">{ministry.activeMembers}</td>
                      <td className="px-4 py-3 text-center text-slate-700">{engagement}%</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${ministry.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {ministry.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button type="button" onClick={() => handleEdit(ministry)} className="rounded-lg border border-purple-200 p-2 text-purple-600 hover:bg-purple-50" title="Editar">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => handleDelete(ministry.id)} className="rounded-lg bg-slate-900 p-2 text-white hover:bg-slate-800" title="Excluir">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loadingMinistries && !ministries.length ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            Nenhum ministério cadastrado para a igreja selecionada.
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remover ministério"
        message={deleteTarget ? `Tem certeza que deseja remover "${deleteTarget.name}"? Esta ação não pode ser desfeita.` : ''}
        confirmLabel="Remover"
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => (deleting ? null : setDeleteTarget(null))}
      />
    </div>
  );
}
