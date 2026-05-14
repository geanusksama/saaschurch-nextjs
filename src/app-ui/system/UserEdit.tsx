import { useEffect, useMemo, useState } from 'react';
import { Building2, MapPinned, Save, Shield, Info, Users } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';

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
  regional?: {
    id?: string;
    campoId?: string;
    name?: string;
    campo?: {
      id: string;
      name: string;
    };
  };
};

type RoleOption = {
  id: string;
  name: string;
  churchId?: string | null;
};

const PROFILE_OPTIONS = [
  { value: 'master', label: 'Master', description: 'Acesso total ao sistema', activeClass: 'border-red-400 bg-red-50 dark:bg-red-900/20' },
  { value: 'admin', label: 'Administrador', description: 'Gestão completa, exceto configurações de sistema', activeClass: 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' },
  { value: 'campo', label: 'Campo', description: 'Acesso multi-igreja no campo', activeClass: 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' },
  { value: 'church', label: 'Igreja', description: 'Acesso limitado à igreja local', activeClass: 'border-green-400 bg-green-50 dark:bg-green-900/20' },
];

export default function UserEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [campos, setCampos] = useState<CampoOption[]>([]);
  const [regionais, setRegionais] = useState<RegionalOption[]>([]);
  const [churches, setChurches] = useState<ChurchOption[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    profileType: 'church',
    campoId: '',
    regionalId: '',
    churchId: '',
    roleId: '',
    isAdmin: false,
    isActive: true,
  });

  const token = localStorage.getItem('mrm_token');

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const [userRes, camposRes, regionaisRes, churchesRes, rolesRes] = await Promise.all([
          fetch(`${apiBase}/users/${id}`, { headers }),
          fetch(`${apiBase}/campos`, { headers }),
          fetch(`${apiBase}/regionais`, { headers }),
          fetch(`${apiBase}/churches`, { headers }),
          fetch(`${apiBase}/roles`, { headers }),
        ]);

        if (!userRes.ok) throw new Error(`Erro ${userRes.status}`);
        if (!camposRes.ok) throw new Error(`Erro ${camposRes.status} ao carregar campos`);
        if (!regionaisRes.ok) throw new Error(`Erro ${regionaisRes.status} ao carregar regionais`);
        if (!churchesRes.ok) throw new Error(`Erro ${churchesRes.status} ao carregar igrejas`);
        if (!rolesRes.ok) throw new Error(`Erro ${rolesRes.status} ao carregar funcoes`);

        const [data, camposData, regionaisData, churchesData, rolesData] = await Promise.all([
          userRes.json(),
          camposRes.json(),
          regionaisRes.json(),
          churchesRes.json(),
          rolesRes.json(),
        ]);

        setCampos(camposData || []);
        setRegionais(regionaisData || []);
        setChurches(churchesData || []);
        setRoles(rolesData || []);
        setForm({
          fullName: data.fullName || '',
          email: data.email || '',
          phone: data.phone || '',
          profileType: data.profileType || 'church',
          campoId: data.campoId || data.campo?.id || '',
          regionalId: data.regionalId || data.regional?.id || '',
          churchId: data.churchId || data.church?.id || '',
          roleId: data.roleId || data.role?.id || '',
          isAdmin: data.isAdmin ?? false,
          isActive: data.isActive ?? true,
        });
      } catch (err: any) {
        setError(err.message || 'Falha ao carregar usuário.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const set = (field: string, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const filteredRegionais = useMemo(() => {
    if (!form.campoId) return regionais;
    return regionais.filter((regional) => regional.campoId === form.campoId);
  }, [regionais, form.campoId]);

  const filteredChurches = useMemo(() => {
    if (form.regionalId) return churches.filter((church) => church.regional?.id === form.regionalId);
    if (!form.campoId) return churches;
    return churches.filter((church) => church.regional?.campoId === form.campoId);
  }, [churches, form.campoId, form.regionalId]);

  const filteredRoles = useMemo(() => {
    if (!form.churchId) {
      return roles.filter((role) => !role.churchId);
    }
    return roles.filter((role) => !role.churchId || role.churchId === form.churchId);
  }, [roles, form.churchId]);

  useEffect(() => {
    if (!form.churchId) return;
    const selectedChurch = churches.find((church) => church.id === form.churchId);
    if (!selectedChurch) return;
    const selectedCampoId = selectedChurch.regional?.campoId || '';
    const selectedRegionalId = selectedChurch.regional?.id || '';
    if (selectedCampoId && selectedCampoId !== form.campoId) {
      set('campoId', selectedCampoId);
    }
    if (selectedRegionalId && selectedRegionalId !== form.regionalId) {
      set('regionalId', selectedRegionalId);
    }
  }, [churches, form.churchId]);

  useEffect(() => {
    if (!form.regionalId) return;
    const selectedRegional = regionais.find((regional) => regional.id === form.regionalId);
    if (!selectedRegional) return;
    if (selectedRegional.campoId && selectedRegional.campoId !== form.campoId) {
      set('campoId', selectedRegional.campoId);
    }
  }, [regionais, form.regionalId]);

  useEffect(() => {
    if (!form.campoId || !form.regionalId) return;
    const regionalStillVisible = filteredRegionais.some((regional) => regional.id === form.regionalId);
    if (!regionalStillVisible) {
      set('regionalId', '');
    }
  }, [filteredRegionais, form.campoId, form.regionalId]);

  useEffect(() => {
    if ((!form.campoId && !form.regionalId) || !form.churchId) return;
    const churchStillVisible = filteredChurches.some((church) => church.id === form.churchId);
    if (!churchStillVisible) {
      set('churchId', '');
    }
  }, [filteredChurches, form.campoId, form.churchId]);

  useEffect(() => {
    if (!form.roleId) return;
    const roleStillVisible = filteredRoles.some((role) => role.id === form.roleId);
    if (!roleStillVisible) {
      set('roleId', '');
    }
  }, [filteredRoles, form.roleId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.fullName.trim()) {
      setError('Nome é obrigatório.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/users/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          fullName: form.fullName,
          phone: form.phone || null,
          profileType: form.profileType,
          campoId: form.campoId || null,
          regionalId: form.regionalId || null,
          churchId: form.churchId || null,
          roleId: form.roleId || null,
          isAdmin: form.isAdmin,
          isActive: form.isActive,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${res.status}`);
      }
      navigate('/app-ui/system/users');
    } catch (err: any) {
      setError(err.message || 'Falha ao salvar alterações.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-20 text-slate-500 dark:text-slate-400">
        Carregando...
      </div>
    );
  }

  const initials = form.fullName.split(' ').map((n: string) => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '??';
  const selectedProfile = PROFILE_OPTIONS.find((p) => p.value === form.profileType);

  return (
    <div className="p-6">
      {/* Breadcrumb */}

      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Editar Usuário</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{form.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/app-ui/system/users"
            className="px-5 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-medium transition-colors"
          >
            Cancelar
          </Link>
          <button
            form="user-edit-form"
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium transition-colors disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form id="user-edit-form" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* ── Coluna principal (2/3) ── */}
          <div className="xl:col-span-2 space-y-6">
            {/* Dados Pessoais */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Dados Pessoais</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Nome Completo <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.fullName}
                    onChange={(e) => set('fullName', e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    disabled
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-slate-400">Email não pode ser alterado aqui.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Telefone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    placeholder="(11) 99999-0000"
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Vinculos Organizacionais</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Campo
                  </label>
                  <div className="relative">
                    <MapPinned className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select
                      value={form.campoId}
                      onChange={(e) => set('campoId', e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Selecione um campo</option>
                      {campos.map((campo) => (
                        <option key={campo.id} value={campo.id}>
                          {campo.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Regional
                  </label>
                  <div className="relative">
                    <MapPinned className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select
                      value={form.regionalId}
                      onChange={(e) => set('regionalId', e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Selecione uma regional</option>
                      {filteredRegionais.map((regional) => (
                        <option key={regional.id} value={regional.id}>
                          {regional.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Igreja
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <select
                      value={form.churchId}
                      onChange={(e) => set('churchId', e.target.value)}
                      className="w-full pl-10 pr-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Selecione uma igreja</option>
                      {filteredChurches.map((church) => (
                        <option key={church.id} value={church.id}>
                          {church.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Funcao
                  </label>
                  <select
                    value={form.roleId}
                    onChange={(e) => set('roleId', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2.5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Selecione uma funcao</option>
                    {filteredRoles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}{role.churchId ? '' : ' • Global'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                O perfil do usuario pode ficar vinculado ao campo, a regional e a igreja para refletir corretamente a hierarquia de acesso.
              </p>
            </div>

            {/* Status */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Status da Conta</h2>
              <div className="grid grid-cols-2 gap-4">
                <label className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  form.isActive ? 'border-green-400 bg-green-50 dark:bg-green-900/20' : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'
                }`}>
                  <input type="radio" name="isActive" checked={form.isActive} onChange={() => set('isActive', true)} className="accent-green-600 w-4 h-4" />
                  <div>
                    <p className="font-semibold text-sm text-slate-900 dark:text-white">Ativo</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Usuário pode acessar o sistema</p>
                  </div>
                </label>
                <label className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  !form.isActive ? 'border-red-400 bg-red-50 dark:bg-red-900/20' : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'
                }`}>
                  <input type="radio" name="isActive" checked={!form.isActive} onChange={() => set('isActive', false)} className="accent-red-600 w-4 h-4" />
                  <div>
                    <p className="font-semibold text-sm text-slate-900 dark:text-white">Inativo</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Acesso bloqueado ao sistema</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Permissões Info */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3 text-sm text-blue-700 dark:text-blue-300">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Permissões granulares por módulo são configuradas na{' '}
                <Link to="/app-ui/permissions-matrix" className="font-semibold underline">Matriz de Permissões</Link>.
                O perfil acima define o nível de acesso padrão.
              </span>
            </div>
          </div>

          {/* ── Coluna lateral (1/3) ── */}
          <div className="space-y-6">
            {/* Preview do usuário */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col items-center text-center gap-3">
              <div className="w-20 h-20 bg-purple-100 dark:bg-purple-900/40 rounded-2xl flex items-center justify-center">
                <span className="text-purple-700 dark:text-purple-300 font-bold text-2xl">{initials}</span>
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{form.fullName || 'Nome do Usuário'}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{form.email}</p>
                {(campos.find((campo) => campo.id === form.campoId)?.name || regionais.find((regional) => regional.id === form.regionalId)?.name || churches.find((church) => church.id === form.churchId)?.name) && (
                  <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                    {campos.find((campo) => campo.id === form.campoId)?.name && (
                      <p>Campo: {campos.find((campo) => campo.id === form.campoId)?.name}</p>
                    )}
                    {regionais.find((regional) => regional.id === form.regionalId)?.name && (
                      <p>Regional: {regionais.find((regional) => regional.id === form.regionalId)?.name}</p>
                    )}
                    {churches.find((church) => church.id === form.churchId)?.name && (
                      <p>Igreja: {churches.find((church) => church.id === form.churchId)?.name}</p>
                    )}
                    {roles.find((role) => role.id === form.roleId)?.name && (
                      <p>Funcao: {roles.find((role) => role.id === form.roleId)?.name}</p>
                    )}
                  </div>
                )}
              </div>
              {selectedProfile && (
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${selectedProfile.activeClass}`}>
                  {selectedProfile.label}
                </span>
              )}
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                form.isActive
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
              }`}>
                {form.isActive ? 'Ativo' : 'Inativo'}
              </span>
            </div>

            {/* Perfil de Acesso */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4 text-slate-400" />
                <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Perfil de Acesso</h2>
              </div>
              <div className="space-y-2">
                {PROFILE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-3 p-3.5 rounded-lg border-2 cursor-pointer transition-all ${
                      form.profileType === opt.value
                        ? opt.activeClass
                        : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                    }`}
                  >
                    <input
                      type="radio"
                      name="profileType"
                      value={opt.value}
                      checked={form.profileType === opt.value}
                      onChange={() => set('profileType', opt.value)}
                      className="accent-purple-600 w-4 h-4"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-slate-900 dark:text-white">{opt.label}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">{opt.description}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isAdmin}
                    onChange={(e) => set('isAdmin', e.target.checked)}
                    className="w-4 h-4 accent-purple-600"
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Administrador do sistema</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">Acesso às configurações avançadas</p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
