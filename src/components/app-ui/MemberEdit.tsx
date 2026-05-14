import { useEffect, useState } from 'react';
import { Save, User, MapPin, Building, X } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';

import { apiBase } from '../../lib/apiBase';
import { qk } from '../../lib/queryClient';

export function MemberEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    birthDate: '',
    cpf: '',
    rg: '',
    gender: '',
    maritalStatus: '',
    addressStreet: '',
    addressCity: '',
    addressState: '',
    addressZipcode: '',
    baptismStatus: '',
    baptismDate: '',
    membershipDate: '',
    ecclesiasticalTitle: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadMember = async () => {
      try {
        const response = await fetch(`${apiBase}/members/${id}`);
        if (!response.ok) {
          throw new Error('Membro nao encontrado.');
        }
        const data = await response.json();
        setFormData({
          fullName: data.fullName || '',
          email: data.email || '',
          phone: data.phone || '',
          birthDate: data.birthDate ? data.birthDate.slice(0, 10) : '',
          cpf: data.cpf || '',
          rg: data.rg || '',
          gender: data.gender || '',
          maritalStatus: data.maritalStatus || '',
          addressStreet: data.addressStreet || '',
          addressCity: data.addressCity || '',
          addressState: data.addressState || '',
          addressZipcode: data.addressZipcode || '',
          baptismStatus: data.baptismStatus || '',
          baptismDate: data.baptismDate ? data.baptismDate.slice(0, 10) : '',
          membershipDate: data.membershipDate ? data.membershipDate.slice(0, 10) : '',
          ecclesiasticalTitle: data.ecclesiasticalTitle || '',
        });
      } catch (err) {
        setError(err.message || 'Falha ao carregar membro.');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadMember();
    }
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      const response = await fetch(`${apiBase}/members/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          birthDate: formData.birthDate || undefined,
          cpf: formData.cpf || undefined,
          rg: formData.rg || undefined,
          gender: formData.gender || undefined,
          maritalStatus: formData.maritalStatus || undefined,
          addressStreet: formData.addressStreet || undefined,
          addressCity: formData.addressCity || undefined,
          addressState: formData.addressState || undefined,
          addressZipcode: formData.addressZipcode || undefined,
          baptismStatus: formData.baptismStatus || undefined,
          baptismDate: formData.baptismDate || undefined,
          membershipDate: formData.membershipDate || undefined,
          ecclesiasticalTitle: formData.ecclesiasticalTitle || undefined,
        }),
      });

      if (!response.ok) {
        const message = await response.json();
        throw new Error(message.error || 'Falha ao salvar membro.');
      }

      // Atualiza cache imediatamente — lista e detalhe mostram dados novos na hora
      void qc.invalidateQueries({ queryKey: ['secretaria', 'members'] });
      if (id) void qc.invalidateQueries({ queryKey: qk.memberDetail(id) });

      navigate(`/app-ui/members/${id}`);
    } catch (err) {
      setError(err.message || 'Falha ao salvar membro.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <User className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Editar Membro</h1>
              <p className="text-slate-600 dark:text-slate-400">Atualize as informações do membro</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link to={`/app-ui/members/${id}`} className="border border-slate-300 bg-white px-6 py-2 rounded-lg hover:bg-slate-50 transition-colors font-medium">
              Cancelar
            </Link>
            <button
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-60"
              onClick={handleSave}
              disabled={saving}
            >
              <Save className="w-5 h-5" />
              {saving ? 'Salvando...' : 'Salvar Alteracoes'}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 mb-6">
          Carregando membro...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-6">
          {error}
        </div>
      ) : null}

      <div className="max-w-5xl">
        {/* Personal Information */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-6">
            <User className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900">Informações Pessoais</h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Nome Completo *</label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Telefone *</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Data de Nascimento</label>
              <input
                type="date"
                value={formData.birthDate}
                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">CPF</label>
              <input
                type="text"
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">RG</label>
              <input
                type="text"
                value={formData.rg}
                onChange={(e) => setFormData({ ...formData, rg: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Sexo</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione</option>
                <option value="male">Masculino</option>
                <option value="female">Feminino</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Estado Civil</label>
              <select
                value={formData.maritalStatus}
                onChange={(e) => setFormData({ ...formData, maritalStatus: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione</option>
                <option value="single">Solteiro(a)</option>
                <option value="married">Casado(a)</option>
                <option value="divorced">Divorciado(a)</option>
                <option value="widowed">Viuvo(a)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-6">
            <MapPin className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900">Endereço</h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-2">Endereço</label>
              <input
                type="text"
                value={formData.addressStreet}
                onChange={(e) => setFormData({ ...formData, addressStreet: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Cidade</label>
              <input
                type="text"
                value={formData.addressCity}
                onChange={(e) => setFormData({ ...formData, addressCity: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Estado</label>
              <select
                value={formData.addressState}
                onChange={(e) => setFormData({ ...formData, addressState: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione</option>
                <option value="SP">SP</option>
                <option value="RJ">RJ</option>
                <option value="MG">MG</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">CEP</label>
              <input
                type="text"
                value={formData.addressZipcode}
                onChange={(e) => setFormData({ ...formData, addressZipcode: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Church Information */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-6">
            <Building className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-900">Informações Eclesiásticas</h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Título Eclesiástico</label>
              <input
                type="text"
                value={formData.ecclesiasticalTitle}
                onChange={(e) => setFormData({ ...formData, ecclesiasticalTitle: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex.: Pastor, Evangelista, Presbítero"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Batizado</label>
              <select
                value={formData.baptismStatus}
                onChange={(e) => setFormData({ ...formData, baptismStatus: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione</option>
                <option value="baptized">Sim</option>
                <option value="not_baptized">Nao</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Data do Batismo</label>
              <input
                type="date"
                value={formData.baptismDate}
                onChange={(e) => setFormData({ ...formData, baptismDate: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Membro Desde</label>
              <input
                type="date"
                value={formData.membershipDate}
                onChange={(e) => setFormData({ ...formData, membershipDate: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Ministério</label>
              <select
                value={formData.ministry}
                onChange={(e) => setFormData({ ...formData, ministry: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Louvor</option>
                <option>Infantil</option>
                <option>Jovens</option>
                <option>Intercessão</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Célula</label>
              <select
                value={formData.cellGroup}
                onChange={(e) => setFormData({ ...formData, cellGroup: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Célula Central</option>
                <option>Célula Norte</option>
                <option>Célula Sul</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Função</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option>Membro</option>
                <option>Líder de Célula</option>
                <option>Líder de Louvor</option>
                <option>Diácono</option>
                <option>Pastor</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Drawer version (used from MemberProfile) ───────────────────────────────

const EMPTY_FORM = {
  fullName: '', email: '', phone: '', mobile: '', birthDate: '',
  cpf: '', rg: '', gender: '', maritalStatus: '', spouseName: '',
  nationality: '', addressStreet: '', addressCity: '', addressState: '',
  addressZipcode: '', baptismStatus: '', baptismDate: '', membershipDate: '',
  ecclesiasticalTitle: '', membershipStatus: '',
};

function authFetchEdit(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('mrm_token');
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    },
  });
}

export function MemberEditDrawer({
  memberId,
  onClose,
  onSaved,
}: {
  memberId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    authFetchEdit(`${apiBase}/members/${memberId}`)
      .then((r) => { if (!r.ok) throw new Error('Membro não encontrado.'); return r.json(); })
      .then((d) => setForm({
        fullName: d.fullName || '',
        email: d.email || '',
        phone: d.phone || '',
        mobile: d.mobile || '',
        birthDate: d.birthDate ? d.birthDate.slice(0, 10) : '',
        cpf: d.cpf || '',
        rg: d.rg || '',
        gender: d.gender || '',
        maritalStatus: d.maritalStatus || '',
        spouseName: d.spouseName || '',
        nationality: d.nationality || '',
        addressStreet: d.addressStreet || '',
        addressCity: d.addressCity || '',
        addressState: d.addressState || '',
        addressZipcode: d.addressZipcode || '',
        baptismStatus: d.baptismStatus || '',
        baptismDate: d.baptismDate ? d.baptismDate.slice(0, 10) : '',
        membershipDate: d.membershipDate ? d.membershipDate.slice(0, 10) : '',
        ecclesiasticalTitle: d.ecclesiasticalTitle || '',
        membershipStatus: d.membershipStatus || '',
      }))
      .catch((e) => setError(e.message || 'Falha ao carregar.'))
      .finally(() => setLoading(false));
  }, [memberId]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const body: Record<string, string | undefined> = {};
      for (const [k, v] of Object.entries(form)) { body[k] = v || undefined; }
      const r = await authFetchEdit(`${apiBase}/members/${memberId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (!r.ok) { const j = await r.json(); throw new Error(j.error || 'Falha ao salvar.'); }
      onSaved();
    } catch (e: any) {
      setError(e.message || 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const inp = 'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500';
  const lbl = 'block text-xs font-medium text-slate-600 mb-1';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">Editar Membro</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {loading && <div className="text-sm text-slate-500 py-4 text-center">Carregando...</div>}
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

          {!loading && (
            <>
              {/* Dados pessoais */}
              <section>
                <div className="flex items-center gap-1.5 mb-3">
                  <User className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-semibold text-slate-700">Dados Pessoais</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={lbl}>Nome Completo *</label>
                    <input className={inp} value={form.fullName} onChange={(e) => set('fullName', e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>CPF</label>
                    <input className={inp} value={form.cpf} onChange={(e) => set('cpf', e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>RG</label>
                    <input className={inp} value={form.rg} onChange={(e) => set('rg', e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>Data de Nascimento</label>
                    <input type="date" className={inp} value={form.birthDate} onChange={(e) => set('birthDate', e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>Sexo</label>
                    <select className={inp} value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                      <option value="">Selecione</option>
                      <option value="MASCULINO">Masculino</option>
                      <option value="FEMININO">Feminino</option>
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Estado Civil</label>
                    <select className={inp} value={form.maritalStatus} onChange={(e) => set('maritalStatus', e.target.value)}>
                      <option value="">Selecione</option>
                      <option value="SOLTEIRO">Solteiro(a)</option>
                      <option value="CASADO">Casado(a)</option>
                      <option value="DIVORCIADO">Divorciado(a)</option>
                      <option value="VIUVO">Viúvo(a)</option>
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Nome do Cônjuge</label>
                    <input className={inp} value={form.spouseName} onChange={(e) => set('spouseName', e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>Nacionalidade</label>
                    <input className={inp} value={form.nationality} onChange={(e) => set('nationality', e.target.value)} />
                  </div>
                </div>
              </section>

              {/* Contato */}
              <section>
                <div className="flex items-center gap-1.5 mb-3 border-t border-slate-100 pt-4">
                  <span className="text-sm font-semibold text-slate-700">Contato</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>E-mail</label>
                    <input type="email" className={inp} value={form.email} onChange={(e) => set('email', e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>Telefone</label>
                    <input className={inp} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>Celular</label>
                    <input className={inp} value={form.mobile} onChange={(e) => set('mobile', e.target.value)} />
                  </div>
                </div>
              </section>

              {/* Endereço */}
              <section>
                <div className="flex items-center gap-1.5 mb-3 border-t border-slate-100 pt-4">
                  <MapPin className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-semibold text-slate-700">Endereço</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={lbl}>Logradouro</label>
                    <input className={inp} value={form.addressStreet} onChange={(e) => set('addressStreet', e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>Cidade</label>
                    <input className={inp} value={form.addressCity} onChange={(e) => set('addressCity', e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>Estado</label>
                    <input className={inp} maxLength={2} value={form.addressState} onChange={(e) => set('addressState', e.target.value.toUpperCase())} placeholder="SP" />
                  </div>
                  <div>
                    <label className={lbl}>CEP</label>
                    <input className={inp} value={form.addressZipcode} onChange={(e) => set('addressZipcode', e.target.value)} />
                  </div>
                </div>
              </section>

              {/* Informações eclesiásticas */}
              <section>
                <div className="flex items-center gap-1.5 mb-3 border-t border-slate-100 pt-4">
                  <Building className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-semibold text-slate-700">Informações Eclesiásticas</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Título Eclesiástico</label>
                    <input className={inp} value={form.ecclesiasticalTitle} onChange={(e) => set('ecclesiasticalTitle', e.target.value)} placeholder="PASTOR, EVANGELISTA..." />
                  </div>
                  <div>
                    <label className={lbl}>Status do Membro</label>
                    <select className={inp} value={form.membershipStatus} onChange={(e) => set('membershipStatus', e.target.value)}>
                      <option value="">Selecione</option>
                      <option value="ATIVO">Ativo</option>
                      <option value="INATIVO">Inativo</option>
                      <option value="TRANSFERIDO">Transferido</option>
                      <option value="EXCLUIDO">Excluído</option>
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Status do Batismo</label>
                    <select className={inp} value={form.baptismStatus} onChange={(e) => set('baptismStatus', e.target.value)}>
                      <option value="">Selecione</option>
                      <option value="baptized">Batizado</option>
                      <option value="not_baptized">Não Batizado</option>
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Data do Batismo</label>
                    <input type="date" className={inp} value={form.baptismDate} onChange={(e) => set('baptismDate', e.target.value)} />
                  </div>
                  <div>
                    <label className={lbl}>Membro Desde</label>
                    <input type="date" className={inp} value={form.membershipDate} onChange={(e) => set('membershipDate', e.target.value)} />
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </>
  );
}
