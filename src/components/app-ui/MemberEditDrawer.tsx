import { useEffect, useState } from 'react';
import { Save, X } from 'lucide-react';

import { apiBase } from '../../lib/apiBase';

type EcclesiasticalTitleOption = {
  id: string;
  name: string;
  abbreviation?: string | null;
  level: number;
};

type Props = {
  memberId: string | null;
  open: boolean;
  onClose: () => void;
  onSaved: (updated: any) => void;
  titles: EcclesiasticalTitleOption[];
};

type FormState = {
  memberType: string;
  fullName: string;
  preferredName: string;
  cnpj: string;
  cpf: string;
  rg: string;
  email: string;
  phone: string;
  mobile: string;
  birthDate: string;
  gender: string;
  maritalStatus: string;
  fatherName: string;
  motherName: string;
  spouseName: string;
  naturalityCity: string;
  naturalityState: string;
  nationality: string;
  addressStreet: string;
  addressNumber: string;
  addressComplement: string;
  addressNeighborhood: string;
  addressCity: string;
  addressState: string;
  addressZipcode: string;
  membershipStatus: string;
  membershipDate: string;
  ecclesiasticalTitleId: string;
  baptismStatus: string;
  baptismDate: string;
  voterRegistration: string;
  voterZone: string;
  voterSection: string;
  notes: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
};

const emptyForm: FormState = {
  memberType: 'MEMBRO',
  fullName: '',
  preferredName: '',
  cnpj: '',
  cpf: '',
  rg: '',
  email: '',
  phone: '',
  mobile: '',
  birthDate: '',
  gender: '',
  maritalStatus: '',
  fatherName: '',
  motherName: '',
  spouseName: '',
  naturalityCity: '',
  naturalityState: '',
  nationality: '',
  addressStreet: '',
  addressNumber: '',
  addressComplement: '',
  addressNeighborhood: '',
  addressCity: '',
  addressState: '',
  addressZipcode: '',
  membershipStatus: 'AGUARDANDO ATIVACAO',
  membershipDate: '',
  ecclesiasticalTitleId: '',
  baptismStatus: '',
  baptismDate: '',
  voterRegistration: '',
  voterZone: '',
  voterSection: '',
  notes: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
};

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

function formatCpf(value?: string | null) {
  const digits = digitsOnly(value || '').slice(0, 11);
  if (!digits) return '';
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function formatCnpj(value?: string | null) {
  const digits = digitsOnly(value || '').slice(0, 14);
  if (!digits) return '';
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function formatPhone(value?: string | null) {
  const digits = digitsOnly(value || '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

function formatZipcode(value: string) {
  const digits = digitsOnly(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return digits.replace(/(\d{5})(\d{1,3})/, '$1-$2');
}

function normalizeForCompare(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

type CityOption = { city: string; state: string };

async function lookupCityState(cityName: string): Promise<CityOption[]> {
  const trimmedCity = cityName.trim();
  if (!trimmedCity) {
    throw new Error('Informe a cidade para buscar a UF.');
  }
  const response = await fetch(`https://brasilapi.com.br/api/cptec/v1/cidade/${encodeURIComponent(trimmedCity)}`);
  if (!response.ok) {
    throw new Error('Nao foi possivel localizar a cidade informada.');
  }
  const cities = (await response.json()) as Array<{ nome?: string; estado?: string }>;
  const options: CityOption[] = cities
    .filter((c) => c.nome && c.estado)
    .map((c) => ({ city: c.nome as string, state: c.estado as string }));
  if (!options.length) {
    throw new Error('Cidade nao encontrada na base publica.');
  }
  // Deduplicate by city+state
  const seen = new Set<string>();
  return options.filter((o) => {
    const key = `${normalizeForCompare(o.city)}|${o.state}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function MemberEditDrawer({ memberId, open, onClose, onSaved, titles }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lookingUpCityField, setLookingUpCityField] = useState<'naturalityCity' | 'addressCity' | null>(null);
  const [cityOptions, setCityOptions] = useState<{ field: 'naturalityCity' | 'addressCity'; options: CityOption[] } | null>(null);

  useEffect(() => {
    if (!open || !memberId) return;
    const token = localStorage.getItem('mrm_token');
    if (!token) {
      setError('Sessao expirada. Faca login novamente.');
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await fetch(`${apiBase}/members/${memberId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          throw new Error('Falha ao carregar membro.');
        }
        const data = await response.json();
        if (cancelled) return;
        setForm({
          memberType: data.memberType || 'MEMBRO',
          fullName: data.fullName || '',
          preferredName: data.preferredName || '',
          cnpj: formatCnpj(data.cnpj),
          cpf: formatCpf(data.cpf),
          rg: data.rg || '',
          email: data.email || '',
          phone: formatPhone(data.phone),
          mobile: formatPhone(data.mobile),
          birthDate: data.birthDate ? String(data.birthDate).slice(0, 10) : '',
          gender: data.gender || '',
          maritalStatus: data.maritalStatus || '',
          fatherName: data.fatherName || '',
          motherName: data.motherName || '',
          spouseName: data.spouseName || '',
          naturalityCity: data.naturalityCity || '',
          naturalityState: data.naturalityState || '',
          nationality: data.nationality || '',
          addressStreet: data.addressStreet || '',
          addressNumber: data.addressNumber || '',
          addressComplement: data.addressComplement || '',
          addressNeighborhood: data.addressNeighborhood || '',
          addressCity: data.addressCity || '',
          addressState: data.addressState || '',
          addressZipcode: data.addressZipcode || '',
          membershipStatus: data.membershipStatus || 'AGUARDANDO ATIVACAO',
          membershipDate: data.membershipDate ? String(data.membershipDate).slice(0, 10) : '',
          ecclesiasticalTitleId: data.ecclesiasticalTitleRef?.id || data.ecclesiasticalTitleId || '',
          baptismStatus: data.baptismStatus || '',
          baptismDate: data.baptismDate ? String(data.baptismDate).slice(0, 10) : '',
          voterRegistration: data.voterRegistration || '',
          voterZone: data.voterZone || '',
          voterSection: data.voterSection || '',
          notes: data.notes || '',
          emergencyContactName: data.emergencyContactName || '',
          emergencyContactPhone: formatPhone(data.emergencyContactPhone),
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Falha ao carregar membro.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, memberId]);

  if (!open) return null;

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const applyCitySelection = (field: 'naturalityCity' | 'addressCity', option: CityOption) => {
    if (field === 'naturalityCity') {
      setForm((prev) => ({
        ...prev,
        naturalityCity: option.city,
        naturalityState: option.state,
        nationality: prev.nationality || 'Brasileira',
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        addressCity: option.city,
        addressState: option.state,
      }));
    }
    setCityOptions(null);
  };

  const handleLookupCity = async (field: 'naturalityCity' | 'addressCity') => {
    try {
      setLookingUpCityField(field);
      setError('');
      setCityOptions(null);
      const results = await lookupCityState(form[field]);
      const typed = normalizeForCompare(form[field]);
      const exact = results.filter((r) => normalizeForCompare(r.city) === typed);
      if (exact.length === 1) {
        applyCitySelection(field, exact[0]);
        return;
      }
      if (results.length === 1) {
        applyCitySelection(field, results[0]);
        return;
      }
      setCityOptions({ field, options: results });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao consultar a cidade informada.');
    } finally {
      setLookingUpCityField(null);
    }
  };

  const handleSave = async () => {
    if (!memberId) return;
    const token = localStorage.getItem('mrm_token');
    if (!token) {
      setError('Sessao expirada. Faca login novamente.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const payload: Record<string, any> = {
        memberType: form.memberType,
        fullName: form.fullName,
        preferredName: form.preferredName || undefined,
        cnpj: digitsOnly(form.cnpj) || undefined,
        cpf: digitsOnly(form.cpf) || undefined,
        rg: form.rg || undefined,
        email: form.email || undefined,
        phone: digitsOnly(form.phone) || undefined,
        mobile: digitsOnly(form.mobile) || undefined,
        birthDate: form.birthDate || undefined,
        gender: form.gender || undefined,
        maritalStatus: form.maritalStatus || undefined,
        fatherName: form.fatherName || undefined,
        motherName: form.motherName || undefined,
        spouseName: form.spouseName || undefined,
        naturalityCity: form.naturalityCity || undefined,
        naturalityState: form.naturalityState || undefined,
        nationality: form.nationality || undefined,
        addressStreet: form.addressStreet || undefined,
        addressNumber: form.addressNumber || undefined,
        addressComplement: form.addressComplement || undefined,
        addressNeighborhood: form.addressNeighborhood || undefined,
        addressCity: form.addressCity || undefined,
        addressState: form.addressState || undefined,
        addressZipcode: digitsOnly(form.addressZipcode) || undefined,
        membershipStatus: form.membershipStatus,
        membershipDate: form.membershipDate || undefined,
        ecclesiasticalTitleId: form.ecclesiasticalTitleId || undefined,
        baptismStatus: form.baptismStatus || undefined,
        baptismDate: form.baptismDate || undefined,
        voterRegistration: form.voterRegistration || undefined,
        voterZone: form.voterZone || undefined,
        voterSection: form.voterSection || undefined,
        notes: form.notes || undefined,
        emergencyContactName: form.emergencyContactName || undefined,
        emergencyContactPhone: digitsOnly(form.emergencyContactPhone) || undefined,
      };

      const response = await fetch(`${apiBase}/members/${memberId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const msg = await response.json().catch(() => ({}));
        throw new Error(msg.error || 'Falha ao salvar membro.');
      }

      const updated = await response.json();
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar membro.');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500';
  const labelClass = 'mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/40" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full flex-col border-l border-slate-200 bg-white shadow-2xl sm:w-[640px] lg:w-[820px]">
        <header className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Editar Membro</h2>
            <p className="text-xs text-slate-500">Atualize as informações cadastrais do membro</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-600" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="py-20 text-center text-sm text-slate-500">Carregando dados do membro...</div>
          ) : (
            <div className="space-y-6">
              {error ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
              ) : null}

              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-800">Identificação</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className={labelClass}>Tipo</label>
                    <select value={form.memberType} onChange={(e) => update('memberType', e.target.value)} className={inputClass}>
                      <option value="MEMBRO">Membro</option>
                      <option value="PF">PF</option>
                      <option value="PJ">PJ</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Nome completo *</label>
                    <input type="text" value={form.fullName} onChange={(e) => update('fullName', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>CNPJ</label>
                    <input type="text" value={form.cnpj} onChange={(e) => update('cnpj', formatCnpj(e.target.value))} placeholder="00.000.000/0000-00" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Nome preferido</label>
                    <input type="text" value={form.preferredName} onChange={(e) => update('preferredName', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Data de nascimento</label>
                    <input type="date" value={form.birthDate} onChange={(e) => update('birthDate', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>CPF</label>
                    <input type="text" value={form.cpf} onChange={(e) => update('cpf', formatCpf(e.target.value))} placeholder="000.000.000-00" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>RG</label>
                    <input type="text" value={form.rg} onChange={(e) => update('rg', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Gênero</label>
                    <select value={form.gender} onChange={(e) => update('gender', e.target.value)} className={inputClass}>
                      <option value="">Selecione</option>
                      <option value="MASCULINO">Masculino</option>
                      <option value="FEMININO">Feminino</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Estado civil</label>
                    <select value={form.maritalStatus} onChange={(e) => update('maritalStatus', e.target.value)} className={inputClass}>
                      <option value="">Selecione</option>
                      <option value="SOLTEIRO">Solteiro(a)</option>
                      <option value="CASADO">Casado(a)</option>
                      <option value="DIVORCIADO">Divorciado(a)</option>
                      <option value="VIUVO">Viúvo(a)</option>
                      <option value="UNIAO_ESTAVEL">União estável</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Nome do pai</label>
                    <input type="text" value={form.fatherName} onChange={(e) => update('fatherName', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Nome da mãe</label>
                    <input type="text" value={form.motherName} onChange={(e) => update('motherName', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Cônjuge</label>
                    <input type="text" value={form.spouseName} onChange={(e) => update('spouseName', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Nacionalidade</label>
                    <input type="text" value={form.nationality} onChange={(e) => update('nationality', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Cidade de naturalidade</label>
                    <div className="flex gap-2">
                      <input type="text" value={form.naturalityCity} onChange={(e) => update('naturalityCity', e.target.value)} className={inputClass} />
                      <button
                        type="button"
                        onClick={() => handleLookupCity('naturalityCity')}
                        disabled={lookingUpCityField === 'naturalityCity'}
                        className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                      >
                        {lookingUpCityField === 'naturalityCity' ? 'Buscando...' : 'Buscar UF'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>UF de naturalidade</label>
                    <input type="text" maxLength={2} value={form.naturalityState} onChange={(e) => update('naturalityState', e.target.value.toUpperCase())} className={inputClass} />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-800">Contato</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className={labelClass}>E-mail</label>
                    <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Telefone</label>
                    <input type="text" value={form.phone} onChange={(e) => update('phone', formatPhone(e.target.value))} placeholder="(11) 9999-9999" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Celular</label>
                    <input type="text" value={form.mobile} onChange={(e) => update('mobile', formatPhone(e.target.value))} placeholder="(11) 99999-9999" className={inputClass} />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-800">Endereço</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                  <div className="md:col-span-2">
                    <label className={labelClass}>CEP</label>
                    <input type="text" value={form.addressZipcode} onChange={(e) => update('addressZipcode', formatZipcode(e.target.value))} placeholder="00000-000" className={inputClass} />
                  </div>
                  <div className="md:col-span-3">
                    <label className={labelClass}>Logradouro</label>
                    <input type="text" value={form.addressStreet} onChange={(e) => update('addressStreet', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Número</label>
                    <input type="text" value={form.addressNumber} onChange={(e) => update('addressNumber', e.target.value)} className={inputClass} />
                  </div>
                  <div className="md:col-span-3">
                    <label className={labelClass}>Complemento</label>
                    <input type="text" value={form.addressComplement} onChange={(e) => update('addressComplement', e.target.value)} className={inputClass} />
                  </div>
                  <div className="md:col-span-3">
                    <label className={labelClass}>Bairro</label>
                    <input type="text" value={form.addressNeighborhood} onChange={(e) => update('addressNeighborhood', e.target.value)} className={inputClass} />
                  </div>
                  <div className="md:col-span-4">
                    <label className={labelClass}>Cidade</label>
                    <div className="flex gap-2">
                      <input type="text" value={form.addressCity} onChange={(e) => update('addressCity', e.target.value)} className={inputClass} />
                      <button
                        type="button"
                        onClick={() => handleLookupCity('addressCity')}
                        disabled={lookingUpCityField === 'addressCity'}
                        className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                      >
                        {lookingUpCityField === 'addressCity' ? 'Buscando...' : 'Buscar UF'}
                      </button>
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>UF</label>
                    <input type="text" maxLength={2} value={form.addressState} onChange={(e) => update('addressState', e.target.value.toUpperCase())} className={inputClass} />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-800">Vida eclesiástica</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className={labelClass}>Status na membresia</label>
                    <select value={form.membershipStatus} onChange={(e) => update('membershipStatus', e.target.value)} className={inputClass}>
                      <option value="AGUARDANDO ATIVACAO">Aguardando ativação</option>
                      <option value="ATIVO">Ativo</option>
                      <option value="INATIVO">Inativo</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Data da membresia</label>
                    <input type="date" value={form.membershipDate} onChange={(e) => update('membershipDate', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Título eclesiástico</label>
                    <select value={form.ecclesiasticalTitleId} onChange={(e) => update('ecclesiasticalTitleId', e.target.value)} className={inputClass}>
                      <option value="">Selecione o título</option>
                      {titles.map((title) => (
                        <option key={title.id} value={title.id}>
                          {title.abbreviation ? `${title.abbreviation} - ` : ''}
                          {title.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Status do batismo</label>
                    <select value={form.baptismStatus} onChange={(e) => update('baptismStatus', e.target.value)} className={inputClass}>
                      <option value="">Selecione</option>
                      <option value="baptized">Batizado(a)</option>
                      <option value="not_baptized">Não batizado(a)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Data do batismo</label>
                    <input type="date" value={form.baptismDate} onChange={(e) => update('baptismDate', e.target.value)} className={inputClass} />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-800">Título de eleitor</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div>
                    <label className={labelClass}>Inscrição</label>
                    <input type="text" value={form.voterRegistration} onChange={(e) => update('voterRegistration', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Zona</label>
                    <input type="text" value={form.voterZone} onChange={(e) => update('voterZone', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Seção</label>
                    <input type="text" value={form.voterSection} onChange={(e) => update('voterSection', e.target.value)} className={inputClass} />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-800">Contato de emergência</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className={labelClass}>Nome</label>
                    <input type="text" value={form.emergencyContactName} onChange={(e) => update('emergencyContactName', e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Telefone</label>
                    <input type="text" value={form.emergencyContactPhone} onChange={(e) => update('emergencyContactPhone', formatPhone(e.target.value))} className={inputClass} />
                  </div>
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-800">Observações</h3>
                <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={4} className={inputClass} />
              </section>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || saving || !form.fullName.trim()}
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </footer>

        {cityOptions ? (
          <>
            <div className="absolute inset-0 z-[60] bg-slate-900/40" onClick={() => setCityOptions(null)} />
            <div className="absolute left-1/2 top-1/2 z-[70] w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
                <h4 className="text-sm font-semibold text-slate-900">Selecione a cidade</h4>
                <button type="button" onClick={() => setCityOptions(null)} className="rounded p-1 hover:bg-slate-100">
                  <X className="h-4 w-4 text-slate-600" />
                </button>
              </div>
              <p className="px-5 pt-3 text-xs text-slate-500">
                Encontramos {cityOptions.options.length} resultados para "{form[cityOptions.field]}". Escolha a cidade correta:
              </p>
              <ul className="max-h-80 overflow-y-auto p-3">
                {cityOptions.options.map((option) => (
                  <li key={`${option.city}-${option.state}`}>
                    <button
                      type="button"
                      onClick={() => applyCitySelection(cityOptions.field, option)}
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-2 text-left text-sm text-slate-700 hover:border-purple-200 hover:bg-purple-50"
                    >
                      <span>{option.city}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{option.state}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : null}
      </aside>
    </>
  );
}
