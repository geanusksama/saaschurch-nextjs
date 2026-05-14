import { useEffect, useMemo, useState } from 'react';
import { Building2, Eye, EyeOff, Info, MapPinned, Save, Shield, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router';

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

export default function UserNew() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    password: '',
  });

  const token = localStorage.getItem('mrm_token');

  const set = (field: string, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const [camposRes, regionaisRes, churchesRes, rolesRes] = await Promise.all([
          fetch(`${apiBase}/campos`, { headers }),
          fetch(`${apiBase}/regionais`, { headers }),
          fetch(`${apiBase}/churches`, { headers }),
          fetch(`${apiBase}/roles`, { headers }),
        ]);

        if (!camposRes.ok) throw new Error(`Erro ${camposRes.status} ao carregar campos`);
        if (!regionaisRes.ok) throw new Error(`Erro ${regionaisRes.status} ao carregar regionais`);
        if (!churchesRes.ok) throw new Error(`Erro ${churchesRes.status} ao carregar igrejas`);
        if (!rolesRes.ok) throw new Error(`Erro ${rolesRes.status} ao carregar funcoes`);

        const [camposData, regionaisData, churchesData, rolesData] = await Promise.all([
          camposRes.json(),
          regionaisRes.json(),
          churchesRes.json(),
          rolesRes.json(),
        ]);

        setCampos(camposData);
        setRegionais(regionaisData);
        setChurches(churchesData);
        setRoles(rolesData);
      } catch (err: any) {
        setError(err.message || 'Falha ao carregar campos e igrejas.');
      }
    };

    loadOptions();
  }, [token]);

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
    if (!form.fullName.trim() || !form.email.trim()) {
      setError('Nome e email são obrigatórios.');
      return;
    }
    if (form.password && form.password.length < 6) {
      setError('Senha deve ter pelo menos 6 caracteres.');
      return;
    }
    setSaving(true);
    try {
      // 1. Cria o usuário no Supabase Auth via backend (usa service_role) se senha fornecida
      if (form.password) {
        const authRes = await fetch(`${apiBase}/users/create-supabase-auth`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ email: form.email, password: form.password }),
        });
        if (!authRes.ok) {
          const body = await authRes.json().catch(() => ({}));
          // Ignora se usuário já existe no auth (409) — perfil pode ser criado mesmo assim
          if (authRes.status !== 409) {
            throw new Error(body.error || `Erro ao criar conta: ${authRes.status}`);
          }
        }
      }

      // 2. Cria o perfil no banco via API backend
      const res = await fetch(`${apiBase}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          phone: form.phone || undefined,
          profileType: form.profileType,
          campoId: form.campoId || undefined,
          regionalId: form.regionalId || undefined,
          churchId: form.churchId || undefined,
          roleId: form.roleId || undefined,
          isAdmin: form.isAdmin,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erro ${res.status}`);
      }
      navigate('/app-ui/system/users');
    } catch (err: any) {
      setError(err.message || 'Falha ao criar usuário.');
    } finally {
      setSaving(false);
    }
  };

  const selectedProfile = PROFILE_OPTIONS.find((p) => p.value === form.profileType);

  return (
    <div className="p-6">
      {/* Breadcrumb */}

      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Novo Usuário</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Cadastre um novo usuário do sistema</p>
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
            form="user-new-form"
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium transition-colors disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Criando...' : 'Criar Usuário'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form id="user-new-form" onSubmit={handleSubmit}>
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
                    placeholder="Ex.: João da Silva"
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    placeholder="joao@email.com"
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    required
                  />
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
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Campo</label>
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
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Regional</label>
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
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Igreja</label>
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
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Funcao</label>
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
                Defina o campo, a regional e a igreja do perfil para que os filtros e o contexto do usuario respeitem a hierarquia da organização.
              </p>
            </div>

            {/* Senha */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Senha de Acesso</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Deixe em branco se o usuário irá definir a própria senha pelo e-mail de convite.
              </p>
              <div className="relative max-w-sm">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-3 py-2.5 pr-10 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Info */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3 text-sm text-blue-700 dark:text-blue-300">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Permissões granulares por módulo são configuradas na{' '}
                <Link to="/app-ui/permissions-matrix" className="font-semibold underline">Matriz de Permissões</Link>.
                O perfil selecionado define o nível de acesso padrão.
              </span>
            </div>
          </div>

          {/* ── Coluna lateral (1/3) ── */}
          <div className="space-y-6">
            {/* Preview */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col items-center text-center gap-3">
              <div className="w-20 h-20 bg-purple-100 dark:bg-purple-900/40 rounded-2xl flex items-center justify-center">
                <Users className="w-8 h-8 text-purple-500 dark:text-purple-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{form.fullName || 'Nome do Usuário'}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{form.email || 'email@exemplo.com'}</p>
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
                    id="isAdmin"
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
