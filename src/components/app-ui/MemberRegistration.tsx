import { useEffect, useMemo, useState } from 'react';
import { Save, User, Phone, MapPin, Heart, Users, X, Search, CheckCircle, UserCircle, Droplets, Star, ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';

import { apiBase } from '../../lib/apiBase';

const BRAZIL_STATES = [
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapa' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceara' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espirito Santo' },
  { value: 'GO', label: 'Goias' },
  { value: 'MA', label: 'Maranhao' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PA', label: 'Para' },
  { value: 'PB', label: 'Paraiba' },
  { value: 'PR', label: 'Parana' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piaui' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondonia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'Sao Paulo' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'TO', label: 'Tocantins' },
];

const initialFormData = {
  regionalId: '',
  churchId: '',
  ministryId: '',
  ministryRole: 'Participante',
  firstName: '',
  lastName: '',
  preferredName: '',
  email: '',
  phone: '',
  mobile: '',
  birthDate: '',
  gender: '',
  maritalStatus: '',
  cpf: '',
  rg: '',
  fatherName: '',
  motherName: '',
  spouseName: '',
  naturalityCity: '',
  naturalityState: '',
  nationality: '',
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  zipCode: '',
  baptized: false,
  baptismDate: '',
  membershipDate: '',
  membershipStatus: 'AGUARDANDO ATIVACAO',
  ecclesiasticalTitleId: '',
  voterRegistration: '',
  voterZone: '',
  voterSection: '',
  notes: '',
  emergencyName: '',
  emergencyPhone: '',
  rol: '',
};

type FormState = typeof initialFormData;

type RegionalOption = {
  id: string;
  name: string;
  code?: string | null;
  campoId: string;
};

type CampoOption = {
  id: string;
  name: string;
  code?: string | null;
};

type ChurchOption = {
  id: string;
  code?: string | null;
  name: string;
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

type EcclesiasticalTitleOption = {
  id: string;
  name: string;
  abbreviation?: string | null;
  level: number;
};

type MinistryOption = {
  id: string;
  name: string;
  description?: string | null;
  totalMembers?: number;
  leader?: {
    id: string;
    fullName: string;
  } | null;
};

type CityLookupResponse = {
  nome?: string;
  estado?: string;
};

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

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

function formatCpf(value: string) {
  const digits = digitsOnly(value).slice(0, 11);

  if (!digits) {
    return '';
  }

  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function formatPhone(value: string) {
  const digits = digitsOnly(value).slice(0, 11);

  if (!digits) {
    return '';
  }

  if (digits.length <= 10) {
    return digits
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }

  return digits
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

function sortEcclesiasticalTitles(titles: EcclesiasticalTitleOption[]) {
  return [...titles].sort((left, right) => {
    const levelDiff = (left.level || 0) - (right.level || 0);
    if (levelDiff !== 0) {
      return levelDiff;
    }

    return left.name.localeCompare(right.name, 'pt-BR');
  });
}

async function lookupCep(cep: string): Promise<{ street: string; neighborhood: string; city: string; state: string } | null> {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return null;
    return {
      street: data.logradouro || '',
      neighborhood: data.bairro || '',
      city: data.localidade || '',
      state: data.uf || '',
    };
  } catch {
    return null;
  }
}

async function lookupCityState(cityName: string): Promise<Array<{ city: string; state: string }>> {
  const trimmedCity = cityName.trim();

  if (!trimmedCity) {
    throw new Error('Informe a cidade para buscar a UF.');
  }

  const response = await fetch(`https://brasilapi.com.br/api/cptec/v1/cidade/${encodeURIComponent(trimmedCity)}`);

  if (!response.ok) {
    throw new Error('Nao foi possivel localizar a cidade informada.');
  }

  const cities = (await response.json()) as CityLookupResponse[];
  const options = cities
    .filter((c) => c.nome && c.estado)
    .map((c) => ({ city: c.nome as string, state: c.estado as string }));

  if (!options.length) {
    throw new Error('Cidade nao encontrada na base publica.');
  }

  const seen = new Set<string>();
  return options.filter((o) => {
    const key = `${normalizeRoleName(o.city)}|${o.state}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

type SavedMemberSummary = {
  id: string;
  fullName: string;
  rol?: string | number | null;
  membershipStatus: string;
  ecclesiasticalTitle?: string | null;
  churchName?: string | null;
  churchId: string;
};

export function MemberRegistration() {
  const token = localStorage.getItem('mrm_token');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const storedUser = readStoredUser();
  const activeFieldId = localStorage.getItem('mrm_active_field_id') || storedUser.campoId || '';
  const activeFieldName = localStorage.getItem('mrm_active_field_name') || storedUser.campoName || '';
  // Somente master/admin podem trocar Campo, Regional e Igreja
  const isMasterOrAdmin = storedUser.profileType === 'master' || storedUser.profileType === 'admin';
  const canChooseChurch = isMasterOrAdmin;
  const canChooseField = isMasterOrAdmin;
  const [selectedFieldId, setSelectedFieldId] = useState(activeFieldId);
  const [formData, setFormData] = useState<FormState>(initialFormData);

  const [fields, setFields] = useState<CampoOption[]>([]);
  const [regionais, setRegionais] = useState<RegionalOption[]>([]);
  const [churches, setChurches] = useState<ChurchOption[]>([]);
  const [ecclesiasticalTitles, setEcclesiasticalTitles] = useState<EcclesiasticalTitleOption[]>([]);
  const [ministries, setMinistries] = useState<MinistryOption[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingChurches, setLoadingChurches] = useState(true);
  const [loadingMinistries, setLoadingMinistries] = useState(false);
  const [lookingUpCityField, setLookingUpCityField] = useState<'city' | 'naturalityCity' | null>(null);
  const [lookingUpCep, setLookingUpCep] = useState(false);
  const [savedMember, setSavedMember] = useState<SavedMemberSummary | null>(null);
  const [cityOptions, setCityOptions] = useState<{ field: 'city' | 'naturalityCity'; options: Array<{ city: string; state: string }> } | null>(null);

  const selectedChurch = useMemo(
    () => churches.find((church) => church.id === formData.churchId) || null,
    [churches, formData.churchId],
  );

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

    if (!formData.regionalId) {
      return churchesInField;
    }

    return churchesInField.filter((church) => church.regional?.id === formData.regionalId);
  }, [churches, selectedFieldId, formData.regionalId]);

  useEffect(() => {
    const loadChurches = async () => {
      if (!token) {
        setError('Sessão expirada. Faça login novamente.');
        setLoadingChurches(false);
        return;
      }

      try {
        setLoadingChurches(true);
        setError('');
        const query = selectedFieldId ? `?fieldId=${encodeURIComponent(selectedFieldId)}` : '';
        const [fieldsResponse, regionaisResponse, churchesResponse, titlesResponse] = await Promise.all([
          fetch(`${apiBase}/campos`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${apiBase}/regionais`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${apiBase}/churches${query}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${apiBase}/ecclesiastical-titles`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!fieldsResponse.ok || !regionaisResponse.ok || !churchesResponse.ok || !titlesResponse.ok) {
          if (
            fieldsResponse.status === 401 ||
            fieldsResponse.status === 403 ||
            regionaisResponse.status === 401 ||
            regionaisResponse.status === 403 ||
            churchesResponse.status === 401 ||
            churchesResponse.status === 403 ||
            titlesResponse.status === 401 ||
            titlesResponse.status === 403
          ) {
            throw new Error('Sessão expirada. Faça login novamente.');
          }
          throw new Error('Falha ao carregar campos, regionais, igrejas e títulos eclesiásticos.');
        }

        const [fieldsData, regionaisData, churchesData, titlesData] = await Promise.all([
          fieldsResponse.json(),
          regionaisResponse.json(),
          churchesResponse.json(),
          titlesResponse.json(),
        ]);

        const resolvedFieldId = selectedFieldId || activeFieldId || fieldsData[0]?.id || '';
        const scopedRegionais = resolvedFieldId
          ? regionaisData.filter((regional: RegionalOption) => regional.campoId === resolvedFieldId)
          : regionaisData;
        const scopedChurches = resolvedFieldId
          ? churchesData.filter((church: ChurchOption) => church.regional?.campoId === resolvedFieldId || church.regional?.campo?.id === resolvedFieldId)
          : churchesData;

        setFields(Array.isArray(fieldsData) ? fieldsData : []);
        setRegionais(regionaisData);
        setChurches(churchesData);
        const nextTitles = sortEcclesiasticalTitles(Array.isArray(titlesData) ? titlesData : []);
        setEcclesiasticalTitles(nextTitles);

        const defaultTitle = nextTitles.find((title: EcclesiasticalTitleOption) => normalizeRoleName(title.name) === 'congregado') || nextTitles[0] || null;

        if (canChooseField && resolvedFieldId && resolvedFieldId !== selectedFieldId) {
          setSelectedFieldId(resolvedFieldId);
        }

        const loggedChurch = churchesData.find((church: ChurchOption) => church.id === storedUser.churchId) || null;
        const preferredChurch = scopedChurches.find((church: ChurchOption) => church.id === loggedChurch?.id) || scopedChurches[0] || null;
        const preferredRegional = scopedRegionais.find((regional: RegionalOption) => regional.id === preferredChurch?.regional?.id)
          || scopedRegionais[0]
          || null;

        setFormData((prev) => ({
          ...prev,
          regionalId: scopedRegionais.some((regional: RegionalOption) => regional.id === prev.regionalId)
            ? prev.regionalId
            : preferredRegional?.id || '',
          churchId: scopedChurches.some((church: ChurchOption) => church.id === prev.churchId)
            ? prev.churchId
            : preferredChurch?.id || '',
          ecclesiasticalTitleId: nextTitles.some((title: EcclesiasticalTitleOption) => title.id === prev.ecclesiasticalTitleId)
            ? prev.ecclesiasticalTitleId
            : defaultTitle?.id || '',
          membershipStatus: prev.membershipStatus || 'AGUARDANDO ATIVACAO',
        }));
      } catch (err) {
        setError(err.message || 'Falha ao carregar campos, regionais e igrejas.');
      } finally {
        setLoadingChurches(false);
      }
    };

    loadChurches();
  }, [activeFieldId, canChooseField, selectedFieldId, storedUser.churchId, token]);

  useEffect(() => {
    if (!canChooseField) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      regionalId: '',
      churchId: '',
    }));
  }, [canChooseField, selectedFieldId]);

  useEffect(() => {
    if (!formData.churchId) {
      setMinistries([]);
      setFormData((prev) => ({
        ...prev,
        ministryId: '',
        ministryRole: 'Participante',
      }));
      return;
    }

    const church = churches.find((item) => item.id === formData.churchId);
    if (!church?.regional?.id || church.regional.id === formData.regionalId) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      regionalId: church.regional?.id || prev.regionalId,
    }));
  }, [churches, formData.churchId, formData.regionalId]);

  useEffect(() => {
    if (!formData.regionalId || !formData.churchId) {
      return;
    }

    const churchStillVisible = filteredChurches.some((church) => church.id === formData.churchId);
    if (churchStillVisible) {
      return;
    }

    setFormData((prev) => ({
      ...prev,
      churchId: '',
    }));
  }, [filteredChurches, formData.regionalId, formData.churchId]);

  useEffect(() => {
    const loadMinistries = async () => {
      if (!token || !formData.churchId) {
        return;
      }

      try {
        setLoadingMinistries(true);
        const response = await fetch(`${apiBase}/churches/${formData.churchId}/ministries`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            throw new Error('Sessão expirada. Faça login novamente.');
          }

          throw new Error('Falha ao carregar ministérios da igreja.');
        }

        const ministriesData = await response.json();
        const nextMinistries = Array.isArray(ministriesData) ? ministriesData : [];
        setMinistries(nextMinistries);
        setFormData((prev) => ({
          ...prev,
          ministryId: nextMinistries.some((ministry: MinistryOption) => ministry.id === prev.ministryId) ? prev.ministryId : '',
          ministryRole: prev.ministryId ? prev.ministryRole || 'Participante' : 'Participante',
        }));
      } catch (err) {
        setMinistries([]);
        setFormData((prev) => ({
          ...prev,
          ministryId: '',
          ministryRole: 'Participante',
        }));
        setError(err.message || 'Falha ao carregar ministérios da igreja.');
      } finally {
        setLoadingMinistries(false);
      }
    };

    loadMinistries();
  }, [formData.churchId, token]);

  const updateFormValue = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const applyCitySelection = (field: 'city' | 'naturalityCity', option: { city: string; state: string }) => {
    if (field === 'city') {
      setFormData((prev) => ({
        ...prev,
        city: option.city,
        state: option.state,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        naturalityCity: option.city,
        naturalityState: option.state,
        nationality: prev.nationality || 'Brasileira',
      }));
    }
    setCityOptions(null);
  };

  const handleLookupCity = async (field: 'city' | 'naturalityCity') => {
    try {
      setLookingUpCityField(field);
      setError('');
      setCityOptions(null);
      const results = await lookupCityState(formData[field]);
      const typed = normalizeRoleName(formData[field]);
      const exact = results.filter((r) => normalizeRoleName(r.city) === typed);
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
      setError(err.message || 'Falha ao consultar a cidade informada.');
    } finally {
      setLookingUpCityField(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!formData.churchId) {
      setError('Selecione a igreja.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        fullName: `${formData.firstName} ${formData.lastName}`.trim(),
        rol: formData.rol ? Number(formData.rol) : undefined,
        preferredName: formData.preferredName || undefined,
        cpf: formData.cpf || undefined,
        rg: formData.rg || undefined,
        email: formData.email,
        phone: formData.phone,
        mobile: formData.mobile || undefined,
        birthDate: formData.birthDate || undefined,
        gender: formData.gender || undefined,
        maritalStatus: formData.maritalStatus || undefined,
        fatherName: formData.fatherName || undefined,
        motherName: formData.motherName || undefined,
        spouseName: formData.spouseName || undefined,
        naturalityCity: formData.naturalityCity || undefined,
        naturalityState: formData.naturalityState || undefined,
        nationality: formData.nationality || undefined,
        addressStreet: formData.street || undefined,
        addressNumber: formData.number || undefined,
        addressComplement: formData.complement || undefined,
        addressNeighborhood: formData.neighborhood || undefined,
        addressCity: formData.city || undefined,
        addressState: formData.state || undefined,
        addressZipcode: formData.zipCode || undefined,
        membershipStatus: formData.membershipStatus || 'AGUARDANDO ATIVACAO',
        membershipDate: formData.membershipDate || undefined,
        ecclesiasticalTitleId: formData.ecclesiasticalTitleId || undefined,
        baptismDate: formData.baptismDate || undefined,
        baptismStatus: formData.baptized ? 'baptized' : 'not_baptized',
        voterRegistration: formData.voterRegistration || undefined,
        voterZone: formData.voterZone || undefined,
        voterSection: formData.voterSection || undefined,
        ministryId: formData.ministryId || undefined,
        ministryRole: formData.ministryId ? formData.ministryRole || 'Participante' : undefined,
        notes: formData.notes || undefined,
        emergencyContactName: formData.emergencyName || undefined,
        emergencyContactPhone: formData.emergencyPhone || undefined,
      };

      if (!payload.fullName) {
        throw new Error('Informe o nome do membro.');
      }

      const response = await fetch(`${apiBase}/churches/${formData.churchId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await response.json();
        throw new Error(message.error || 'Falha ao salvar membro.');
      }

      const savedData = await response.json();
      const defaultTitle = ecclesiasticalTitles.find((title) => normalizeRoleName(title.name) === 'congregado') || null;
      const titleObj = ecclesiasticalTitles.find((t) => t.id === formData.ecclesiasticalTitleId);
      const church = churches.find((c) => c.id === formData.churchId);

      // Invalida cache da lista — novo membro aparece imediatamente ao voltar
      void qc.invalidateQueries({ queryKey: ['secretaria', 'members'] });

      setSavedMember({
        id: savedData.id,
        fullName: `${formData.firstName} ${formData.lastName}`.trim(),
        rol: savedData.rol ?? savedData.id,
        membershipStatus: formData.membershipStatus,
        ecclesiasticalTitle: titleObj?.name || null,
        churchName: church?.name || null,
        churchId: formData.churchId,
      });

      setFormData((prev) => ({
        ...initialFormData,
        regionalId: prev.regionalId,
        churchId: prev.churchId,
        ecclesiasticalTitleId: defaultTitle?.id || '',
      }));
    } catch (err) {
      setError(err.message || 'Falha ao salvar membro.');
    } finally {
      setSaving(false);
    }
  };

  const handleLookupCep = async () => {
    setLookingUpCep(true);
    setError('');
    try {
      const result = await lookupCep(formData.zipCode);
      if (!result) {
        setError('CEP não encontrado. Verifique e tente novamente.');
        return;
      }
      setFormData((prev) => ({
        ...prev,
        street: result.street || prev.street,
        neighborhood: result.neighborhood || prev.neighborhood,
        city: result.city || prev.city,
        state: result.state || prev.state,
      }));
    } catch {
      setError('Falha ao consultar o CEP.');
    } finally {
      setLookingUpCep(false);
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8 w-full">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <User className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Novo Membro</h1>
            <p className="text-slate-600 dark:text-slate-400">Preencha as informações do novo membro</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="w-full space-y-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-indigo-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Vinculo com Igreja</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                {canChooseField ? 'Campo *' : 'Campo Atual'}
              </label>
              {canChooseField ? (
                <select
                  required
                  value={selectedFieldId}
                  onChange={(event) => setSelectedFieldId(event.target.value)}
                  disabled={loadingChurches}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500"
                >
                  <option value="">{loadingChurches ? 'Carregando...' : 'Selecione o campo'}</option>
                  {fields.map((field) => (
                    <option key={field.id} value={field.id}>
                      {field.code ? `${field.code} - ` : ''}{field.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex min-h-[46px] items-center rounded-lg border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700">
                  {activeFieldName || selectedChurch?.regional?.campo?.name || storedUser.campoName || 'Sem campo definido'}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Regional *
              </label>
              <select
                required
                value={formData.regionalId}
                onChange={(e) => setFormData((prev) => ({ ...prev, regionalId: e.target.value, churchId: '' }))}
                disabled={!canChooseChurch || loadingChurches}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500"
              >
                <option value="">{loadingChurches ? 'Carregando...' : 'Selecione a regional'}</option>
                {filteredRegionais.map((regional) => (
                  <option key={regional.id} value={regional.id}>
                    {regional.code ? `${regional.code} - ` : ''}{regional.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Igreja *
              </label>
              <select
                required
                value={formData.churchId}
                onChange={(e) => setFormData((prev) => ({ ...prev, churchId: e.target.value }))}
                disabled={!canChooseChurch || loadingChurches}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500"
              >
                <option value="">{loadingChurches ? 'Carregando...' : 'Selecione a igreja'}</option>
                {filteredChurches.map((church) => (
                  <option key={church.id} value={church.id}>
                    {church.code ? `${church.code} - ` : ''}{church.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

        </div>

        {/* Personal Information */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-purple-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Informações Pessoais</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Nome *
              </label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => updateFormValue('firstName', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Digite o nome"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Sobrenome *
              </label>
              <input
                type="text"
                required
                value={formData.lastName}
                onChange={(e) => updateFormValue('lastName', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Digite o sobrenome"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Nome Preferido
              </label>
              <input
                type="text"
                value={formData.preferredName}
                onChange={(e) => updateFormValue('preferredName', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Como gosta de ser chamado(a)"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                ROL
              </label>
              <input
                type="number"
                min="1"
                value={formData.rol}
                onChange={(e) => updateFormValue('rol', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Gerado automaticamente"
              />
              <p className="mt-1 text-xs text-slate-400">Deixe em branco para gerar automaticamente. Duplicatas são permitidas.</p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                CPF *
              </label>
              <input
                type="text"
                required
                value={formData.cpf}
                onChange={(e) => updateFormValue('cpf', formatCpf(e.target.value))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="000.000.000-00"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                RG *
              </label>
              <input
                type="text"
                required
                value={formData.rg}
                onChange={(e) => updateFormValue('rg', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Digite o RG"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => updateFormValue('email', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="exemplo@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Telefone *
              </label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => updateFormValue('phone', formatPhone(e.target.value))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="(11) 98765-4321"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Celular *
              </label>
              <input
                type="tel"
                required
                value={formData.mobile}
                onChange={(e) => updateFormValue('mobile', formatPhone(e.target.value))}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="(11) 98765-4321"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Data de Nascimento *
              </label>
              <input
                type="date"
                required
                value={formData.birthDate}
                onChange={(e) => updateFormValue('birthDate', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Gênero *
              </label>
              <select
                required
                value={formData.gender}
                onChange={(e) => updateFormValue('gender', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Selecione</option>
                <option value="MASCULINO">Masculino</option>
                <option value="FEMININO">Feminino</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Estado Civil *
              </label>
              <select
                required
                value={formData.maritalStatus}
                onChange={(e) => updateFormValue('maritalStatus', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Selecione</option>
                <option value="SOLTEIRO">Solteiro(a)</option>
                <option value="CASADO">Casado(a)</option>
                <option value="DIVORCIADO">Divorciado(a)</option>
                <option value="VIUVO">Viúvo(a)</option>
                <option value="UNIAO_ESTAVEL">União estável</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Situação do Membro *
              </label>
              <select
                required
                value={formData.membershipStatus}
                onChange={(e) => updateFormValue('membershipStatus', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="AGUARDANDO ATIVACAO">Aguardando Ativação</option>
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Título Eclesiástico *
              </label>
              <select
                required
                value={formData.ecclesiasticalTitleId}
                onChange={(e) => updateFormValue('ecclesiasticalTitleId', e.target.value)}
                disabled={loadingChurches}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500"
              >
                <option value="">{loadingChurches ? 'Carregando...' : 'Selecione o título'}</option>
                {ecclesiasticalTitles.map((title) => (
                  <option key={title.id} value={title.id}>
                    {title.abbreviation ? `${title.abbreviation} - ` : ''}{title.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Ministério Inicial
              </label>
              <select
                value={formData.ministryId}
                onChange={(e) => {
                  updateFormValue('ministryId', e.target.value);
                  if (!e.target.value) {
                    updateFormValue('ministryRole', 'Participante');
                  }
                }}
                disabled={!formData.churchId || loadingMinistries}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500"
              >
                <option value="">{loadingMinistries ? 'Carregando...' : 'Sem ministério inicial'}</option>
                {ministries.map((ministry) => (
                  <option key={ministry.id} value={ministry.id}>
                    {ministry.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Função no Ministério
              </label>
              <input
                type="text"
                value={formData.ministryRole}
                onChange={(e) => updateFormValue('ministryRole', e.target.value)}
                disabled={!formData.ministryId}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="Ex.: Participante, Líder de Setor, Auxiliar"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-sky-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Filiacao e Naturalidade</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Nome do Pai *
              </label>
              <input
                type="text"
                required
                value={formData.fatherName}
                onChange={(e) => updateFormValue('fatherName', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Nome completo do pai"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Nome da Mae *
              </label>
              <input
                type="text"
                required
                value={formData.motherName}
                onChange={(e) => updateFormValue('motherName', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Nome completo da mae"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Conjuge {formData.maritalStatus === 'CASADO' ? '*' : ''}
              </label>
              <input
                type="text"
                required={formData.maritalStatus === 'CASADO'}
                value={formData.spouseName}
                onChange={(e) => updateFormValue('spouseName', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Nome do conjuge"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Naturalidade *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={formData.naturalityCity}
                  onChange={(e) => updateFormValue('naturalityCity', e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Cidade de nascimento"
                />
                <button
                  type="button"
                  onClick={() => handleLookupCity('naturalityCity')}
                  disabled={lookingUpCityField === 'naturalityCity'}
                  className="shrink-0 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {lookingUpCityField === 'naturalityCity' ? 'Buscando...' : 'Buscar UF'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                UF da Naturalidade *
              </label>
              <select
                required
                value={formData.naturalityState}
                onChange={(e) => updateFormValue('naturalityState', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Selecione</option>
                {BRAZIL_STATES.map((stateOption) => (
                  <option key={stateOption.value} value={stateOption.value}>
                    {stateOption.value} - {stateOption.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Nacionalidade *
              </label>
              <input
                type="text"
                required
                value={formData.nationality}
                onChange={(e) => updateFormValue('nationality', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Ex.: Brasileira"
              />
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-6">
            {error}
          </div>
        ) : null}

        {/* Address */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <MapPin className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Endereço</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <div className="md:col-span-1">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                CEP
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.zipCode}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 8);
                    updateFormValue('zipCode', v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v);
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleLookupCep(); } }}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="00000-000"
                  maxLength={9}
                />
                <button
                  type="button"
                  onClick={handleLookupCep}
                  disabled={lookingUpCep || formData.zipCode.replace(/\D/g, '').length < 8}
                  className="shrink-0 flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                >
                  <Search className="w-4 h-4" />
                  {lookingUpCep ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
            </div>

            <div className="md:col-span-1 xl:col-span-3">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Rua
              </label>
              <input
                type="text"
                value={formData.street}
                onChange={(e) => updateFormValue('street', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Nome da rua"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Número
              </label>
              <input
                type="text"
                value={formData.number}
                onChange={(e) => updateFormValue('number', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Nº"
              />
            </div>

            <div className="md:col-span-1 xl:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Complemento
              </label>
              <input
                type="text"
                value={formData.complement}
                onChange={(e) => updateFormValue('complement', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Apto, bloco, etc."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Bairro
              </label>
              <input
                type="text"
                value={formData.neighborhood}
                onChange={(e) => updateFormValue('neighborhood', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Bairro"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Cidade
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => updateFormValue('city', e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Cidade"
                />
                <button
                  type="button"
                  onClick={() => handleLookupCity('city')}
                  disabled={lookingUpCityField === 'city'}
                  className="shrink-0 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {lookingUpCityField === 'city' ? 'Buscando...' : 'Buscar UF'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Estado
              </label>
              <select
                value={formData.state}
                onChange={(e) => updateFormValue('state', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Selecione</option>
                {BRAZIL_STATES.map((stateOption) => (
                  <option key={stateOption.value} value={stateOption.value}>
                    {stateOption.value} - {stateOption.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Church Information */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Heart className="w-5 h-5 text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Informações Eclesiásticas</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Data de Entrada na Igreja
              </label>
              <input
                type="date"
                value={formData.membershipDate}
                onChange={(e) => updateFormValue('membershipDate', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-center gap-6 pt-8">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.baptized}
                  onChange={(e) => updateFormValue('baptized', e.target.checked)}
                  className="w-5 h-5 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <span className="text-sm font-semibold text-slate-700">Já é batizado(a)</span>
              </label>
            </div>

            {formData.baptized && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Data do Batismo
                </label>
                <input
                  type="date"
                  value={formData.baptismDate}
                  onChange={(e) => updateFormValue('baptismDate', e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Documentacao Complementar</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Titulo de Eleitor *
              </label>
              <input
                type="text"
                required
                value={formData.voterRegistration}
                onChange={(e) => updateFormValue('voterRegistration', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Numero do titulo"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Zona *
              </label>
              <input
                type="text"
                required
                value={formData.voterZone}
                onChange={(e) => updateFormValue('voterZone', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Zona eleitoral"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Secao *
              </label>
              <input
                type="text"
                required
                value={formData.voterSection}
                onChange={(e) => updateFormValue('voterSection', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Secao eleitoral"
              />
            </div>

            <div className="md:col-span-2 xl:col-span-3">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Observacoes *
              </label>
              <textarea
                required
                rows={4}
                value={formData.notes}
                onChange={(e) => updateFormValue('notes', e.target.value)}
                className="w-full resize-y rounded-lg border border-slate-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Informacoes complementares do membro"
              />
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <Phone className="w-5 h-5 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Contato de Emergência</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Nome Completo
              </label>
              <input
                type="text"
                value={formData.emergencyName}
                onChange={(e) => updateFormValue('emergencyName', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Nome do contato"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Telefone
              </label>
              <input
                type="tel"
                value={formData.emergencyPhone}
                onChange={(e) => updateFormValue('emergencyPhone', e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="(11) 98765-4321"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4">
          <button
            type="submit"
            className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-60"
            disabled={saving || loadingChurches || !formData.churchId}
          >
            <Save className="w-5 h-5" />
            {saving ? 'Salvando...' : 'Salvar Membro'}
          </button>
          <Link
            to="/app-ui/members"
            className="px-6 py-3 border border-slate-200 rounded-lg font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </Link>
        </div>
      </form>

      {cityOptions ? (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/50" onClick={() => setCityOptions(null)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <h4 className="text-sm font-semibold text-slate-900">Selecione a cidade</h4>
              <button type="button" onClick={() => setCityOptions(null)} className="rounded p-1 hover:bg-slate-100">
                <X className="h-4 w-4 text-slate-600" />
              </button>
            </div>
            <p className="px-5 pt-3 text-xs text-slate-500">
              Encontramos {cityOptions.options.length} resultados para "{formData[cityOptions.field]}". Escolha a cidade correta:
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

      {/* Success modal after member registration */}
      {savedMember ? (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm" />
          <div className="fixed left-1/2 top-1/2 z-50 w-[92%] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
                  <CheckCircle className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-indigo-200">Membro cadastrado</p>
                  <h3 className="text-lg font-bold text-white">Cadastro realizado com sucesso!</h3>
                </div>
              </div>
            </div>

            {/* Member summary */}
            <div className="px-6 py-5">
              <p className="mb-4 text-sm text-slate-500">Resumo do novo membro cadastrado:</p>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-base font-bold text-slate-900">{savedMember.fullName}</p>
                {savedMember.churchName && (
                  <p className="mt-0.5 text-xs text-slate-500">{savedMember.churchName}</p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {savedMember.rol && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                      ROL {savedMember.rol}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    {savedMember.membershipStatus}
                  </span>
                  {savedMember.ecclesiasticalTitle && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-700">
                      {savedMember.ecclesiasticalTitle}
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => { setSavedMember(null); navigate(`/app-ui/secretariat/pipeline?memberId=${savedMember.id}&service=BATISMO`); }}
                  className="flex items-center gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100"
                >
                  <Droplets className="h-4 w-4 shrink-0" />
                  Incluir no Batismo
                  <ArrowRight className="ml-auto h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => { setSavedMember(null); navigate(`/app-ui/secretariat/pipeline?memberId=${savedMember.id}&service=CONSAGRACAO`); }}
                  className="flex items-center gap-2.5 rounded-lg border border-purple-200 bg-purple-50 px-4 py-3 text-sm font-semibold text-purple-700 transition-colors hover:bg-purple-100"
                >
                  <Star className="h-4 w-4 shrink-0" />
                  Incluir na Consagração
                  <ArrowRight className="ml-auto h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => { setSavedMember(null); navigate(`/app-ui/members/${savedMember.id}`); }}
                  className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <UserCircle className="h-4 w-4 shrink-0" />
                  Ver Ficha do Membro
                  <ArrowRight className="ml-auto h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSavedMember(null)}
                  className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                >
                  <Users className="h-4 w-4 shrink-0" />
                  Novo Cadastro
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
