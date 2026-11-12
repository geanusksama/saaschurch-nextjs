import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  Church,
  Droplets,
  Heart,
  IdCard,
  Loader2,
  MapPin,
  Pencil,
  Phone,
  Plus,
  SquareCheckBig,
  Star,
  Trash2,
  User,
  UserCircle,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';

import { apiBase } from '../../lib/apiBase';
import { useCampoVisible } from '../../lib/campoVisibility';
import { supabase } from '../../lib/supabaseClient';
import { LocationPicker } from './shared/LocationPicker';
import {
  PreviousChurchFields,
  emptyPreviousChurchForm,
  previousChurchPayload,
  type PreviousChurchForm,
} from './shared/PreviousChurchFields';
import { Permissao } from '../../lib/permissoes/Permissao';
import { FONTE_MODELO_FAMILIA, useFonteModelo } from '../../lib/fonteModelo';

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
  latitude: '',
  longitude: '',
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

// ── Assistente: as 8 etapas do cadastro ─────────────────────────────────────
// `req` são os mesmos campos que o formulário antigo marcava como obrigatórios
// (required) — a validação só mudou de lugar: do navegador para as etapas.

type StepId = 'vinculo' | 'identidade' | 'documentos' | 'contato' | 'familia' | 'endereco' | 'igreja' | 'revisao';

type StepDef = {
  id: StepId;
  short: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  req: Array<keyof FormState>;
};

const STEPS: StepDef[] = [
  { id: 'vinculo', short: 'Vínculo', title: 'A qual igreja ele(a) pertence?', desc: 'Comece escolhendo a regional e a igreja deste novo membro.', icon: Church, req: ['regionalId', 'churchId'] },
  { id: 'identidade', short: 'Identidade', title: 'Quem é o novo membro?', desc: 'Nome, foto e alguns dados básicos para reconhecê-lo(a).', icon: User, req: ['firstName', 'lastName', 'birthDate', 'gender', 'maritalStatus'] },
  { id: 'documentos', short: 'Documentos', title: 'Documentos', desc: 'CPF e RG são obrigatórios. O ROL é gerado sozinho se ficar em branco.', icon: IdCard, req: ['cpf', 'rg'] },
  { id: 'contato', short: 'Contato', title: 'Como falar com ele(a)?', desc: 'Telefones, e-mail e alguém para chamar em uma emergência.', icon: Phone, req: [] },
  { id: 'familia', short: 'Família e origem', title: 'Família e origem', desc: 'Filiação, cônjuge e de onde o membro vem.', icon: Users, req: ['fatherName', 'motherName', 'naturalityCity', 'naturalityState', 'nationality'] },
  { id: 'endereco', short: 'Endereço', title: 'Onde ele(a) mora?', desc: 'Digite o CEP e nós preenchemos o resto para você.', icon: MapPin, req: [] },
  { id: 'igreja', short: 'Vida na igreja', title: 'Vida na igreja', desc: 'Situação, título, ministério e trajetória eclesiástica.', icon: Heart, req: ['membershipStatus', 'ecclesiasticalTitleId'] },
  { id: 'revisao', short: 'Revisão', title: 'Tudo certo?', desc: 'Confira o resumo. Toque em qualquer bloco para editar.', icon: SquareCheckBig, req: [] },
];

const REQUIRED_LABELS: Record<string, string> = {
  campo: 'Campo',
  regionalId: 'Regional',
  churchId: 'Igreja',
  firstName: 'Nome',
  lastName: 'Sobrenome',
  birthDate: 'Nascimento',
  gender: 'Gênero',
  maritalStatus: 'Estado civil',
  cpf: 'CPF',
  rg: 'RG',
  fatherName: 'Pai',
  motherName: 'Mãe',
  naturalityCity: 'Naturalidade',
  naturalityState: 'UF natal',
  nationality: 'Nacionalidade',
  membershipStatus: 'Situação',
  ecclesiasticalTitleId: 'Título',
};

// Travas que o navegador aplicava no formulário antigo (dentro de <form>):
// type="email" e ROL com type="number" min="1". O assistente não submete um
// <form>, então elas são conferidas aqui ao salvar. Regex do e-mail = a da
// especificação HTML (WHATWG) usada pelo navegador.
const EMAIL_VALIDO = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

const GENDER_OPTIONS = [
  { value: 'MASCULINO', label: 'Masculino' },
  { value: 'FEMININO', label: 'Feminino' },
];

const MARITAL_OPTIONS = [
  { value: 'SOLTEIRO', label: 'Solteiro(a)' },
  { value: 'CASADO', label: 'Casado(a)' },
  { value: 'UNIAO_ESTAVEL', label: 'União estável' },
  { value: 'DIVORCIADO', label: 'Divorciado(a)' },
  { value: 'VIUVO', label: 'Viúvo(a)' },
];

const STATUS_LABELS: Record<string, string> = {
  'AGUARDANDO ATIVACAO': 'Aguardando ativação',
  ATIVO: 'Ativo',
  DESLIGADO: 'Desligado',
};

// "image/" + "*" separado de propósito: os scripts de permissão tiram
// comentários de bloco antes de ler o código, e o literal com barra-asterisco
// abriria um "comentário" que engolia os <Permissao> seguintes até o próximo
// fechamento — sumindo com eles da árvore.
const ACEITA_IMAGEM = 'image/' + '*';

// Campos: a borda fica de fora para poder trocar pela de "faltando".
const CAMPO_BASE =
  'w-full rounded-[14px] border-[1.5px] bg-white px-4 text-[15px] text-slate-900 outline-none transition-shadow placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:disabled:bg-slate-800';
const BORDA_OK =
  'border-slate-200 focus:border-slate-900 focus:shadow-[0_0_0_4px_rgba(15,23,42,.08)] dark:border-slate-600 dark:focus:border-slate-300 dark:focus:shadow-[0_0_0_4px_rgba(255,255,255,.08)]';
const BORDA_FALTA =
  'border-red-300 focus:border-red-500 focus:shadow-[0_0_0_4px_rgba(220,38,38,.08)] dark:border-red-500/60';
const BORDA_EMERGENCIA =
  'border-[#f3d4d4] focus:border-red-600 focus:shadow-[0_0_0_4px_rgba(220,38,38,.08)] dark:border-red-900/60';

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
    .replace(/[̀-ͯ]/g, '')
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

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
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

// ── Peças visuais do assistente ─────────────────────────────────────────────

function Field({ label, hint, className = '', children }: { label: ReactNode; hint?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <label className={`flex min-w-0 flex-col gap-2 text-[13px] font-semibold text-slate-700 dark:text-slate-300 ${className}`}>
      {label}
      {children}
      {hint}
    </label>
  );
}

function SelectBox({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={`${className} appearance-none pr-11`}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
    </div>
  );
}

function Chips<T extends string | boolean>({
  options,
  value,
  onPick,
  falta = false,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onPick: (value: T) => void;
  falta?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map((option) => {
        const on = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onPick(option.value)}
            className={`h-12 rounded-full border-[1.5px] px-[22px] text-[15px] font-semibold transition-all ${
              on
                ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                : `${falta ? 'border-red-300 dark:border-red-500/60' : 'border-slate-200 dark:border-slate-600'} bg-white text-slate-900 hover:border-slate-400 dark:bg-slate-900 dark:text-white`
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function Painel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-4 rounded-[20px] border border-[#eef2f6] bg-slate-50 p-5 md:p-6 dark:border-slate-700 dark:bg-slate-900/60 ${className}`}>
      {children}
    </div>
  );
}

/** Botão redondo do rodapé. Componente próprio para poder ir dentro de <Permissao> na última etapa. */
function BotaoAvancar({ onClick, disabled, icon: Icon, verde, girando }: { onClick: () => void; disabled?: boolean; icon: LucideIcon; verde: boolean; girando?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Avançar"
      className={`grid h-14 w-14 flex-none place-items-center rounded-full text-white transition-transform hover:scale-[1.06] active:scale-[.96] disabled:cursor-wait disabled:opacity-70 md:h-[72px] md:w-[72px] ${
        verde
          ? 'bg-[#15803d] shadow-[0_14px_30px_-12px_rgba(21,128,61,.7)]'
          : 'bg-slate-900 shadow-[0_14px_30px_-12px_rgba(15,23,42,.6)] dark:bg-white dark:text-slate-900'
      }`}
    >
      <Icon className={`h-6 w-6 md:h-[30px] md:w-[30px] ${girando ? 'animate-spin' : ''}`} strokeWidth={2.2} />
    </button>
  );
}

export function MemberRegistration() {
  const token = localStorage.getItem('mrm_token');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const storedUser = readStoredUser();
  const activeFieldId = localStorage.getItem('mrm_active_field_id') || storedUser.campoId || '';
  const activeFieldName = localStorage.getItem('mrm_active_field_name') || storedUser.campoName || '';
  const isMasterOrAdmin = storedUser.profileType === 'master' || storedUser.profileType === 'admin';
  const isCampoOrAbove = isMasterOrAdmin || storedUser.profileType === 'campo';
  const canChooseChurch = isCampoOrAbove;
  const canChooseField = isMasterOrAdmin;
  const [selectedFieldId, setSelectedFieldId] = useState(activeFieldId);
  // Campo não aparece no cadastro: vem da igreja/sede do usuário.
  const campoVisible = useCampoVisible();
  const location = useLocation();
  const prefill = location.state?.prefill;
  const [formData, setFormData] = useState<FormState>(initialFormData);

  useEffect(() => {
    if (prefill) {
      setFormData((prev) => ({
        ...prev,
        firstName: prefill.firstName || '',
        lastName: prefill.lastName || '',
        phone: prefill.phone || '',
        mobile: prefill.mobile || '',
        maritalStatus: prefill.maritalStatus || '',
        churchId: prefill.churchId || prev.churchId,
        notes: prefill.notes || '',
      }));
    }
  }, [prefill]);

  // Fonte do modelo (Plus Jakarta Sans) — carregada uma vez, só quando a tela abre.
  useFonteModelo();

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
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const [savedMember, setSavedMember] = useState<SavedMemberSummary | null>(null);
  const [cityOptions, setCityOptions] = useState<{ field: 'city' | 'naturalityCity'; options: Array<{ city: string; state: string }> } | null>(null);

  // Etapa atual, a mais distante já visitada e se a pessoa já tentou salvar
  // (só depois disso os campos obrigatórios vazios ficam vermelhos).
  const [step, setStep] = useState(0);
  const [seen, setSeen] = useState(0);
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const topoRef = useRef<HTMLDivElement>(null);

  // Histórico em outras igrejas: fica só em memória até o membro existir —
  // cada linha é gravada logo depois da criação, via /previous-churches.
  const [previousChurches, setPreviousChurches] = useState<PreviousChurchForm[]>([]);
  const [prevChurchModalOpen, setPrevChurchModalOpen] = useState(false);
  const [prevChurchForm, setPrevChurchForm] = useState<PreviousChurchForm>(emptyPreviousChurchForm);
  const [prevChurchError, setPrevChurchError] = useState('');

  const openPrevChurchCreate = () => {
    setPrevChurchForm({ ...emptyPreviousChurchForm });
    setPrevChurchError('');
    setPrevChurchModalOpen(true);
  };

  const openPrevChurchEdit = (entry: PreviousChurchForm) => {
    setPrevChurchForm({ ...entry });
    setPrevChurchError('');
    setPrevChurchModalOpen(true);
  };

  const savePrevChurch = () => {
    if (!prevChurchForm.churchName.trim()) {
      setPrevChurchError('Informe o nome da igreja.');
      return;
    }
    setPreviousChurches((prev) => {
      if (prevChurchForm.id) {
        return prev.map((item) => (item.id === prevChurchForm.id ? prevChurchForm : item));
      }
      const localId = globalThis.crypto?.randomUUID?.() ?? String(Date.now());
      return [...prev, { ...prevChurchForm, id: localId }];
    });
    setPrevChurchModalOpen(false);
  };

  const removePrevChurch = (id: string) => {
    setPreviousChurches((prev) => prev.filter((item) => item.id !== id));
  };

  // Foto: só em memória até salvar (upload ao storage acontece no submit).
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Selecione um arquivo de imagem.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('A imagem deve ter no máximo 5MB.'); return; }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };
  const [duplicateMember, setDuplicateMember] = useState<{ exists: boolean; type: 'cpf' | 'name' | 'rol'; sameCampo: boolean; member: any } | null>(null);

  const handleCheckDuplicate = async () => {
    if (!formData.cpf && (!formData.firstName || !formData.lastName) && !formData.rol) return;
    try {
      const qCpf = formData.cpf ? formData.cpf.replace(/[^\d]/g, '') : '';
      const qName = `${formData.firstName} ${formData.lastName}`.trim();
      const qRol = formData.rol ? formData.rol.trim() : '';
      const query = new URLSearchParams();
      if (qCpf) query.append('cpf', qCpf);
      if (qName) query.append('name', qName);
      if (qRol) query.append('rol', qRol);
      if (!query.toString()) return;

      const res = await fetch(`${apiBase}/members/check?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.exists) {
          setDuplicateMember(data);
        } else {
          setDuplicateMember(null);
        }
      }
    } catch {}
  };

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

        // Só o perfil de igreja já vem com a própria igreja/regional marcada;
        // os demais perfis começam em "Selecione" e escolhem.
        const preselecionar = storedUser.profileType === 'church';
        const loggedChurch = churchesData.find((church: ChurchOption) => church.id === storedUser.churchId) || null;
        const preferredChurch = preselecionar
          ? scopedChurches.find((church: ChurchOption) => church.id === loggedChurch?.id) || scopedChurches[0] || null
          : null;
        const preferredRegional = preselecionar
          ? scopedRegionais.find((regional: RegionalOption) => regional.id === preferredChurch?.regional?.id)
            || scopedRegionais[0]
            || null
          : null;

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
        setError(errorMessage(err, 'Falha ao carregar campos, regionais e igrejas.'));
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
        setError(errorMessage(err, 'Falha ao carregar ministérios da igreja.'));
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
      setError(errorMessage(err, 'Falha ao consultar a cidade informada.'));
    } finally {
      setLookingUpCityField(null);
    }
  };

  const salvarMembro = async () => {
    setError('');

    if (duplicateMember && (duplicateMember.type === 'cpf' || duplicateMember.type === 'rol')) {
      setError(`O cadastro não pode ser salvo pois o ${duplicateMember.type.toUpperCase()} informado já está em uso.`);
      return;
    }

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
        latitude: formData.latitude || undefined,
        longitude: formData.longitude || undefined,
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

      // Upload da foto só agora (ao salvar). Path temporário por não existir id
      // ainda; a URL pública vai junto no payload de criação.
      if (photoFile) {
        // Roda só no clique de salvar (não no render) — o lint não enxerga isso
        // porque salvarMembro é chamado via avancar → salvar.
        // eslint-disable-next-line react-hooks/purity
        const uid =(globalThis.crypto?.randomUUID?.() ?? String(Date.now()));
        const path = `fotos_membros/novos/${uid}.jpg`;
        const { error: upErr } = await supabase.storage
          .from('dados')
          .upload(path, photoFile, { upsert: true, contentType: photoFile.type || 'image/jpeg' });
        if (upErr) throw new Error('Falha ao enviar a foto: ' + upErr.message);
        (payload as Record<string, unknown>).photoUrl = supabase.storage.from('dados').getPublicUrl(path).data.publicUrl;
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

      // Histórico em outras igrejas: só agora existe o id do membro. Uma falha
      // aqui não invalida o cadastro — avisamos e seguimos.
      if (previousChurches.length > 0 && savedData.id) {
        const results = await Promise.allSettled(
          previousChurches.map((entry) =>
            fetch(`${apiBase}/members/${savedData.id}/previous-churches`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify(previousChurchPayload(entry)),
            }).then((r) => {
              if (!r.ok) throw new Error('falha');
              return r;
            })
          )
        );
        if (results.some((r) => r.status === 'rejected')) {
          setError('Membro salvo, mas parte do histórico em outras igrejas não foi gravada. Confira na ficha do membro.');
        }
      }

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
      setPhotoFile(null);
      setPhotoPreview(null);
      setPreviousChurches([]);
      setCepStatus('idle');
      setTentouSalvar(false);
      topoRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } catch (err) {
      setError(errorMessage(err, 'Falha ao salvar membro.'));
    } finally {
      setSaving(false);
    }
  };

  // CEP: busca sozinho quando o oitavo dígito entra.
  const buscarCep = async (cep: string) => {
    setCepStatus('loading');
    const result = await lookupCep(cep);
    if (!result) {
      setCepStatus('err');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      street: result.street || prev.street,
      neighborhood: result.neighborhood || prev.neighborhood,
      city: result.city || prev.city,
      state: result.state || prev.state,
    }));
    setCepStatus('ok');
  };

  // ── Navegação entre etapas ────────────────────────────────────────────────

  const lastStep = STEPS.length - 1;
  // Campo era obrigatório (required) no formulário antigo quando aparece e é escolhível.
  const campoObrigatorio = campoVisible && canChooseField;
  const requiredOf = (st: StepDef): string[] => (st.id === 'vinculo' && campoObrigatorio ? ['campo', ...st.req] : st.req);
  const missingOf = (st: StepDef) =>
    requiredOf(st).filter((key) => (key === 'campo' ? !selectedFieldId : !formData[key as keyof FormState]));
  const emailInvalido = !!formData.email.trim() && !EMAIL_VALIDO.test(formData.email.trim());
  const rolInvalido = !!formData.rol && !(Number.isInteger(Number(formData.rol)) && Number(formData.rol) >= 1);
  const allMissing = STEPS.flatMap((st) => missingOf(st));
  const pronto = allMissing.length === 0;
  const falta = (key: keyof FormState) => tentouSalvar && !formData[key];
  const campo = (key?: keyof FormState, altura = 'h-14') => `${CAMPO_BASE} ${altura} ${key && falta(key) ? BORDA_FALTA : BORDA_OK}`;

  const goTo = (index: number) => {
    // Sair de Identidade/Documentos confere duplicidade de nome/CPF/ROL —
    // trocar de etapa pelo Enter não dispara o onBlur do campo.
    if ((STEPS[step].id === 'identidade' || STEPS[step].id === 'documentos') && index !== step) {
      void handleCheckDuplicate();
    }
    setStep(index);
    setSeen((prev) => Math.max(prev, index));
    topoRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const irParaPendencia = () => {
    setTentouSalvar(true);
    const index = STEPS.findIndex((st) => missingOf(st).length > 0);
    if (index >= 0) goTo(index);
  };

  const salvar = () => {
    if (saving || savedMember) return;
    if (!pronto) {
      irParaPendencia();
      return;
    }
    if (rolInvalido || emailInvalido) {
      setTentouSalvar(true);
      goTo(STEPS.findIndex((st) => st.id === (rolInvalido ? 'documentos' : 'contato')));
      setError(rolInvalido ? 'O ROL deve ser um número inteiro a partir de 1.' : 'Informe um e-mail válido.');
      return;
    }
    void salvarMembro();
  };

  const avancar = () => {
    if (saving || savedMember) return;
    if (step < lastStep) {
      goTo(step + 1);
      return;
    }
    salvar();
  };

  const onKeyDownCard = (event: React.KeyboardEvent) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    if ((event.target as HTMLElement).tagName !== 'INPUT') return;
    event.preventDefault();
    avancar();
  };

  const novoCadastro = () => {
    setSavedMember(null);
    setError('');
    setStep(0);
    setSeen(0);
  };

  const filledRequired = STEPS.reduce((acc, st) => acc + requiredOf(st).length - missingOf(st).length, 0);
  const totalRequired = STEPS.reduce((acc, st) => acc + requiredOf(st).length, 0);
  const progresso = savedMember ? 100 : Math.round((filledRequired / totalRequired) * 100);

  const stepsView = STEPS.map((st, index) => {
    // Depois de salvar o formulário já foi limpo para o próximo cadastro —
    // a lateral mostra o que foi gravado: tudo concluído.
    const miss = savedMember ? 0 : missingOf(st).length;
    const active = index === step && !savedMember;
    const visited = (index <= seen && !active) || !!savedMember;
    const isReview = st.id === 'revisao';
    const done = visited && !miss && (!isReview || !!savedMember);
    const warn = visited && miss > 0;
    return {
      ...st,
      index,
      active,
      done,
      warn,
      visited,
      meta: active
        ? 'Preenchendo agora'
        : done
          ? 'Concluído'
          : warn
            ? `${miss} ${miss > 1 ? 'pendentes' : 'pendente'}`
            : isReview
              ? 'Conferir e salvar'
              : st.req.length
                ? `${st.req.length} obrigatórios`
                : 'Opcional',
    };
  });

  const iconeTom = (s: { active: boolean; done: boolean; warn: boolean }) =>
    s.active
      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
      : s.done
        ? 'bg-[#dcfce7] text-[#15803d] dark:bg-[#052e16]/60 dark:text-[#86efac]'
        : s.warn
          ? 'bg-[#fef3c7] text-[#b45309] dark:bg-[#451a03]/50 dark:text-[#fcd34d]'
          : 'bg-[#e9edf2] text-slate-500 dark:bg-slate-700 dark:text-slate-300';

  const selectedRegional = regionais.find((regional) => regional.id === formData.regionalId) || null;
  const selectedTitle = ecclesiasticalTitles.find((title) => title.id === formData.ecclesiasticalTitleId) || null;
  const mostrarConjuge = formData.maritalStatus === 'CASADO' || formData.maritalStatus === 'UNIAO_ESTAVEL' || !!formData.spouseName;

  const resumo = (id: StepId) => {
    const junta = (partes: Array<string | false | null | undefined>) => partes.filter(Boolean).join(' · ');
    const data = (v: string) => (v ? v.split('-').reverse().join('/') : '');
    const linhas: Partial<Record<StepId, string>> = {
      vinculo: junta([
        selectedChurch && `${selectedChurch.code ? `${selectedChurch.code} · ` : ''}${selectedChurch.name}`,
        selectedRegional && `${selectedRegional.code ? `${selectedRegional.code} - ` : ''}${selectedRegional.name}`,
      ]),
      identidade: junta([
        `${formData.firstName} ${formData.lastName}`.trim(),
        data(formData.birthDate),
        MARITAL_OPTIONS.find((o) => o.value === formData.maritalStatus)?.label,
      ]),
      documentos: junta([formData.cpf && `CPF ${formData.cpf}`, formData.rg && `RG ${formData.rg}`, formData.rol && `ROL ${formData.rol}`]),
      contato: junta([formData.mobile || formData.phone, formData.email]),
      familia: junta([
        formData.fatherName,
        formData.motherName,
        formData.naturalityCity && `${formData.naturalityCity}${formData.naturalityState ? `/${formData.naturalityState}` : ''}`,
      ]),
      endereco: junta([
        formData.street && `${formData.street}${formData.number ? `, ${formData.number}` : ''}`,
        formData.city && `${formData.city}${formData.state ? `/${formData.state}` : ''}`,
      ]),
      igreja: junta([
        selectedTitle && `${selectedTitle.abbreviation ? `${selectedTitle.abbreviation} · ` : ''}${selectedTitle.name}`,
        STATUS_LABELS[formData.membershipStatus] || formData.membershipStatus,
        formData.baptized && 'Batizado(a)',
      ]),
    };
    return linhas[id] || 'Nada preenchido';
  };

  const cur = STEPS[step];
  const CurIcon = cur.icon;
  const ultima = step === lastStep;
  const proximoRotulo = ultima ? (pronto ? 'Salvar membro' : 'Completar pendências') : 'Continuar';
  const proximoDica = ultima
    ? pronto
      ? 'Tudo pronto para salvar'
      : 'Leva você ao primeiro campo faltando'
    : `Próximo: ${STEPS[step + 1].short} · Enter ↵`;

  const cepMensagem = {
    idle: { texto: 'Rua, bairro, cidade e estado são preenchidos automaticamente.', cor: 'text-slate-500' },
    loading: { texto: 'Buscando endereço…', cor: 'text-slate-500' },
    ok: { texto: 'Endereço encontrado. Só falta o número.', cor: 'text-[#15803d] dark:text-[#4ade80]' },
    err: { texto: 'CEP não encontrado. Preencha manualmente.', cor: 'text-red-700 dark:text-red-400' },
  }[cepStatus];

  const botaoBuscarUf = (field: 'city' | 'naturalityCity') => (
    <button
      type="button"
      onClick={() => handleLookupCity(field)}
      disabled={lookingUpCityField === field || !formData[field].trim()}
      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      {lookingUpCityField === field ? 'Buscando...' : 'Buscar UF'}
    </button>
  );

  return (
    <div
      ref={topoRef}
      className="flex min-h-full scroll-mt-0 flex-col bg-[#f4f6f8] text-slate-900 antialiased dark:bg-slate-900 dark:text-white"
      style={{ fontFamily: FONTE_MODELO_FAMILIA }}
    >
      <style>{'@keyframes nmStepIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}'}</style>

      {/* Cabeçalho */}
      {/* No celular este cabeçalho some: a seta de voltar fica na barra do app. */}
      <header className="sticky top-0 z-20 hidden items-center justify-between gap-3 border-b border-[#e8ecf1] bg-white px-7 py-4 md:flex dark:border-slate-700 dark:bg-slate-800">
        <div className="flex min-w-0 items-center gap-2 md:gap-4">
          <div className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
            <UserPlus className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <span className="whitespace-nowrap text-[17px] font-bold">Novo membro</span>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <div className="hidden items-center gap-3 md:flex">
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-[#eef2f6] dark:bg-slate-700">
              <div className="h-full rounded-full bg-slate-900 transition-[width] duration-400 ease-out dark:bg-white" style={{ width: `${progresso}%` }} />
            </div>
            <span className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">{progresso}%</span>
          </div>
          {/* Salvar fica só no fim, na Revisão. */}
          <Link
            to="/app-ui/members"
            className="flex h-10 items-center whitespace-nowrap rounded-[10px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            Cancelar
          </Link>
        </div>
      </header>

      <div className="box-border flex w-full flex-1 items-stretch gap-8 px-3 pb-4 pt-4 md:px-7 md:pb-7 md:pt-7">
        {/* Etapas — lateral */}
        <aside className="sticky top-[100px] hidden self-start w-[260px] flex-none flex-col gap-1.5 xl:flex">
          <span className="px-3 pb-2 text-xs font-bold uppercase tracking-[.08em] text-slate-400">Etapas do cadastro</span>
          {stepsView.map((s) => {
            const Icon = s.done ? Check : s.icon;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => !savedMember && goTo(s.index)}
                className={`flex w-full items-center gap-3.5 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-white dark:hover:bg-slate-800 ${
                  s.active ? 'bg-white shadow-[0_1px_2px_rgba(15,23,42,.06),0_8px_24px_-12px_rgba(15,23,42,.18)] dark:bg-slate-800' : ''
                }`}
              >
                <span className={`grid h-[46px] w-[46px] flex-none place-items-center rounded-[14px] transition-all ${iconeTom(s)}`}>
                  <Icon className="h-[22px] w-[22px]" strokeWidth={1.8} />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className={`text-sm font-bold ${s.active || s.visited ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}>{s.short}</span>
                  <span className={`text-xs font-medium ${s.warn ? 'text-[#b45309] dark:text-[#fbbf24]' : 'text-slate-400'}`}>{s.meta}</span>
                </span>
              </button>
            );
          })}
        </aside>

        <main className="flex min-w-0 flex-1 flex-col gap-5">
          {/* Etapas — topo (telas menores) */}
          <div className="flex items-center justify-between gap-1.5 overflow-x-auto px-0.5 py-1 xl:hidden">
            {stepsView.map((s, i) => {
              const Icon = s.done ? Check : s.icon;
              return (
                <div key={s.id} className={`flex items-center gap-1.5 ${i < lastStep ? 'md:flex-1' : ''}`}>
                  <button
                    type="button"
                    title={s.short}
                    onClick={() => !savedMember && goTo(s.index)}
                    className={`grid h-9 w-9 flex-none place-items-center rounded-[11px] transition-all md:h-[52px] md:w-[52px] md:rounded-2xl ${iconeTom(s)}`}
                  >
                    <Icon className="h-[18px] w-[18px] md:h-[22px] md:w-[22px]" strokeWidth={1.8} />
                  </button>
                  {i < lastStep && (
                    <span className={`hidden h-0.5 min-w-3 flex-1 rounded-sm md:block ${i < seen ? 'bg-slate-900 dark:bg-white' : 'bg-slate-200 dark:bg-slate-700'}`} />
                  )}
                </div>
              );
            })}
          </div>

          {savedMember ? (
            <section className="flex flex-1 animate-[nmStepIn_.4s_ease] flex-col items-center justify-center gap-[18px] rounded-[20px] border border-[#e8ecf1] bg-white px-6 py-12 text-center md:rounded-[28px] md:px-10 md:py-16 dark:border-slate-700 dark:bg-slate-800">
              <div className="grid h-24 w-24 place-items-center rounded-[30px] bg-[#dcfce7] text-[#15803d] dark:bg-[#052e16]/60 dark:text-[#86efac]">
                <Check className="h-12 w-12" strokeWidth={2.2} />
              </div>
              <h1 className="m-0 text-[26px] font-extrabold tracking-[-.02em] md:text-[32px]">Membro cadastrado!</h1>
              <p className="m-0 max-w-[440px] text-base text-slate-500 dark:text-slate-400">
                {savedMember.fullName} agora faz parte de {savedMember.churchName || 'sua igreja'}.{' '}
                {savedMember.membershipStatus === 'AGUARDANDO ATIVACAO'
                  ? 'O cadastro está aguardando ativação.'
                  : `Situação: ${STATUS_LABELS[savedMember.membershipStatus] || savedMember.membershipStatus}.`}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {savedMember.rol && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">ROL {savedMember.rol}</span>
                )}
                {savedMember.ecclesiasticalTitle && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">{savedMember.ecclesiasticalTitle}</span>
                )}
              </div>
              {error && (
                <p className="max-w-[480px] rounded-2xl border border-[#fde68a] bg-[#fffbeb] px-4 py-3 text-sm text-[#92400e] dark:border-[#78350f] dark:bg-[#451a03]/50 dark:text-[#fcd34d]">{error}</p>
              )}
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                <Permissao chave="members.member_registration.novo_cadastro" rotulo="Novo Cadastro — Member Registration" herda="members.view">
                  <button
                    type="button"
                    onClick={novoCadastro}
                    className="h-[52px] rounded-[14px] border border-slate-200 bg-white px-[22px] text-[15px] font-semibold hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
                  >
                    Cadastrar outro membro
                  </button>
                </Permissao>
                <button
                  type="button"
                  onClick={() => navigate(`/app-ui/members/${savedMember.id}`)}
                  className="flex h-[52px] items-center gap-2 rounded-[14px] bg-slate-900 px-[22px] text-[15px] font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                >
                  <UserCircle className="h-5 w-5" />
                  Ver ficha do membro
                </button>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <Permissao chave="members.member_registration.incluir_no_batismo" rotulo="Incluir no Batismo — Member Registration" herda="members.view">
                  <button
                    type="button"
                    onClick={() => navigate(`/app-ui/secretariat/pipeline?memberId=${savedMember.id}&service=BATISMO`)}
                    className="flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <Droplets className="h-4 w-4" />
                    Incluir no Batismo
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </Permissao>
                <Permissao chave="members.member_registration.incluir_na_consagracao" rotulo="Incluir na Consagração — Member Registration" herda="members.view">
                  <button
                    type="button"
                    onClick={() => navigate(`/app-ui/secretariat/pipeline?memberId=${savedMember.id}&service=CONSAGRACAO`)}
                    className="flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <Star className="h-4 w-4" />
                    Incluir na Consagração
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </Permissao>
              </div>
            </section>
          ) : (
            <section
              onKeyDown={onKeyDownCard}
              className="flex flex-1 flex-col gap-8 rounded-[20px] border border-[#e8ecf1] bg-white px-[18px] py-6 shadow-[0_1px_2px_rgba(15,23,42,.04)] md:rounded-[28px] md:p-10 dark:border-slate-700 dark:bg-slate-800"
            >
              <div key={cur.id} className="flex flex-1 animate-[nmStepIn_.35s_ease] flex-col gap-8">
                {/* Título da etapa */}
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-slate-900 text-white shadow-[0_10px_24px_-12px_rgba(15,23,42,.5)] md:h-[52px] md:w-[52px] md:rounded-2xl dark:bg-white dark:text-slate-900">
                    <CurIcon className="h-5 w-5 md:h-6 md:w-6" strokeWidth={1.8} />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-xs font-bold tracking-[.04em] text-slate-500 dark:text-slate-400">ETAPA {step + 1} DE {STEPS.length}</span>
                    <h1 className="m-0 text-lg font-extrabold leading-[1.2] tracking-[-.02em] md:text-2xl">{cur.title}</h1>
                  </div>
                  <Link
                    to="/app-ui/members"
                    title="Cancelar cadastro"
                    aria-label="Cancelar cadastro"
                    className="-mr-1 -mt-1 grid h-10 w-10 flex-none place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 md:hidden dark:hover:bg-slate-700 dark:hover:text-slate-200"
                  >
                    <X className="h-5 w-5" strokeWidth={2} />
                  </Link>
                </div>

                {cur.id === 'vinculo' && (
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-5">
                    {/* Campo: oculto. O membro herda o campo da igreja escolhida — só
                        aparece para quem destravou a visão de campo. */}
                    {campoVisible && (
                      <Field label={canChooseField ? 'Campo *' : 'Campo atual'}>
                        {canChooseField ? (
                          <SelectBox
                            value={selectedFieldId}
                            onChange={(event) => setSelectedFieldId(event.target.value)}
                            disabled={loadingChurches}
                            className={`${CAMPO_BASE} h-14 ${tentouSalvar && !selectedFieldId ? BORDA_FALTA : BORDA_OK}`}
                          >
                            <option value="">{loadingChurches ? 'Carregando...' : 'Selecione o campo'}</option>
                            {fields.map((field) => (
                              <option key={field.id} value={field.id}>
                                {field.code ? `${field.code} - ` : ''}{field.name}
                              </option>
                            ))}
                          </SelectBox>
                        ) : (
                          <div className={`${campo()} flex items-center bg-slate-50 font-medium text-slate-700 dark:bg-slate-900 dark:text-slate-200`}>
                            {activeFieldName || selectedChurch?.regional?.campo?.name || storedUser.campoName || 'Sem campo definido'}
                          </div>
                        )}
                      </Field>
                    )}
                    <Field label="Regional *">
                      <SelectBox
                        value={formData.regionalId}
                        onChange={(e) => setFormData((prev) => ({ ...prev, regionalId: e.target.value, churchId: '' }))}
                        disabled={!canChooseChurch || loadingChurches}
                        className={campo('regionalId')}
                      >
                        <option value="">{loadingChurches ? 'Carregando...' : 'Selecione'}</option>
                        {filteredRegionais.map((regional) => (
                          <option key={regional.id} value={regional.id}>
                            {regional.code ? `${regional.code} - ` : ''}{regional.name}
                          </option>
                        ))}
                      </SelectBox>
                    </Field>
                    <Field label="Igreja *">
                      <SelectBox
                        value={formData.churchId}
                        onChange={(e) => setFormData((prev) => ({ ...prev, churchId: e.target.value }))}
                        disabled={!canChooseChurch || loadingChurches}
                        className={campo('churchId')}
                      >
                        <option value="">{loadingChurches ? 'Carregando...' : 'Selecione'}</option>
                        {filteredChurches.map((church) => (
                          <option key={church.id} value={church.id}>
                            {church.code ? `${church.code} · ` : ''}{church.name}
                          </option>
                        ))}
                      </SelectBox>
                    </Field>
                  </div>
                )}

                {cur.id === 'identidade' && (
                  <div className="flex flex-col gap-7">
                    <div className="flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => photoInputRef.current?.click()}
                        aria-label="Escolher foto"
                        className="grid h-[104px] w-[104px] flex-none place-items-center overflow-hidden rounded-full border-2 border-dashed border-slate-300 bg-slate-50 bg-cover bg-center p-0 text-slate-500 transition-colors hover:border-slate-900 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:hover:border-white dark:hover:text-white"
                        style={photoPreview ? { backgroundImage: `url(${photoPreview})`, borderStyle: 'solid' } : undefined}
                      >
                        {!photoPreview && <Camera className="h-[30px] w-[30px]" strokeWidth={1.7} />}
                      </button>
                      <input ref={photoInputRef} type="file" accept={ACEITA_IMAGEM} className="hidden" onChange={handlePhotoPick} />
                      <div className="flex flex-col gap-1">
                        <span className="text-[15px] font-bold">Foto do membro</span>
                        <span className="text-[13px] text-slate-500 dark:text-slate-400">
                          {photoPreview ? 'Toque no círculo para trocar. A foto só é enviada ao salvar.' : 'Toque no círculo para adicionar. Opcional.'}
                        </span>
                        {photoPreview && (
                          <button
                            type="button"
                            onClick={removePhoto}
                            data-sem-permissao="tira a foto só da memória do formulário; nada é gravado até Salvar membro"
                            className="self-start text-[13px] font-semibold text-red-600 hover:underline"
                          >
                            Remover foto
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-5">
                      <Field label="Nome *">
                        <input
                          type="text"
                          value={formData.firstName}
                          onChange={(e) => updateFormValue('firstName', e.target.value)}
                          onBlur={handleCheckDuplicate}
                          className={campo('firstName')}
                          placeholder="Digite o nome"
                        />
                      </Field>
                      <Field label="Sobrenome *">
                        <input
                          type="text"
                          value={formData.lastName}
                          onChange={(e) => updateFormValue('lastName', e.target.value)}
                          onBlur={handleCheckDuplicate}
                          className={campo('lastName')}
                          placeholder="Digite o sobrenome"
                        />
                      </Field>
                      <Field label="Como gosta de ser chamado(a)">
                        <input
                          type="text"
                          value={formData.preferredName}
                          onChange={(e) => updateFormValue('preferredName', e.target.value)}
                          className={campo()}
                          placeholder="Nome preferido"
                        />
                      </Field>
                      <Field label="Data de nascimento *">
                        <input
                          type="date"
                          value={formData.birthDate}
                          onChange={(e) => updateFormValue('birthDate', e.target.value)}
                          className={campo('birthDate')}
                        />
                      </Field>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">Gênero *</span>
                      <Chips
                        options={GENDER_OPTIONS}
                        value={formData.gender}
                        onPick={(v) => updateFormValue('gender', formData.gender === v ? '' : v)}
                        falta={falta('gender')}
                      />
                    </div>
                    <div className="flex flex-col gap-2.5">
                      <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">Estado civil *</span>
                      <Chips
                        options={MARITAL_OPTIONS}
                        value={formData.maritalStatus}
                        onPick={(v) => updateFormValue('maritalStatus', formData.maritalStatus === v ? '' : v)}
                        falta={falta('maritalStatus')}
                      />
                    </div>
                  </div>
                )}

                {cur.id === 'documentos' && (
                  <div className="flex flex-col gap-7">
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-5">
                      <Field label="CPF *">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={formData.cpf}
                          onChange={(e) => updateFormValue('cpf', formatCpf(e.target.value))}
                          onBlur={handleCheckDuplicate}
                          className={campo('cpf')}
                          placeholder="000.000.000-00"
                        />
                      </Field>
                      <Field label="RG *">
                        <input
                          type="text"
                          value={formData.rg}
                          onChange={(e) => updateFormValue('rg', e.target.value)}
                          className={campo('rg')}
                          placeholder="Digite o RG"
                        />
                      </Field>
                      <Field
                        label="ROL"
                        hint={<span className="text-xs font-medium text-slate-500 dark:text-slate-400">Deixe em branco para gerar. Duplicatas não são permitidas.</span>}
                      >
                        <input
                          type="number"
                          min="1"
                          value={formData.rol}
                          onChange={(e) => updateFormValue('rol', e.target.value)}
                          onBlur={handleCheckDuplicate}
                          className={`${CAMPO_BASE} h-14 ${tentouSalvar && rolInvalido ? BORDA_FALTA : BORDA_OK}`}
                          placeholder="Gerado automaticamente"
                        />
                      </Field>
                    </div>
                    <Painel>
                      <span className="text-[15px] font-bold">
                        Título de eleitor <span className="font-medium text-slate-500 dark:text-slate-400">· opcional</span>
                      </span>
                      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
                        <Field label="Número">
                          <input
                            type="text"
                            value={formData.voterRegistration}
                            onChange={(e) => updateFormValue('voterRegistration', e.target.value)}
                            className={campo(undefined, 'h-[52px]')}
                            placeholder="Número do título"
                          />
                        </Field>
                        <Field label="Zona">
                          <input
                            type="text"
                            value={formData.voterZone}
                            onChange={(e) => updateFormValue('voterZone', e.target.value)}
                            className={campo(undefined, 'h-[52px]')}
                            placeholder="Zona eleitoral"
                          />
                        </Field>
                        <Field label="Seção">
                          <input
                            type="text"
                            value={formData.voterSection}
                            onChange={(e) => updateFormValue('voterSection', e.target.value)}
                            className={campo(undefined, 'h-[52px]')}
                            placeholder="Seção eleitoral"
                          />
                        </Field>
                      </div>
                    </Painel>
                  </div>
                )}

                {cur.id === 'contato' && (
                  <div className="flex flex-col gap-7">
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-5">
                      <Field label="Celular">
                        <input
                          type="tel"
                          inputMode="tel"
                          value={formData.mobile}
                          onChange={(e) => updateFormValue('mobile', formatPhone(e.target.value))}
                          className={campo()}
                          placeholder="(11) 98765-4321"
                        />
                      </Field>
                      <Field label="Telefone fixo">
                        <input
                          type="tel"
                          inputMode="tel"
                          value={formData.phone}
                          onChange={(e) => updateFormValue('phone', formatPhone(e.target.value))}
                          className={campo()}
                          placeholder="(11) 3456-7890"
                        />
                      </Field>
                      <Field label="E-mail" className="col-span-full">
                        <input
                          type="email"
                          value={formData.email}
                          onChange={(e) => updateFormValue('email', e.target.value)}
                          className={`${CAMPO_BASE} h-14 ${tentouSalvar && emailInvalido ? BORDA_FALTA : BORDA_OK}`}
                          placeholder="exemplo@email.com"
                        />
                      </Field>
                    </div>
                    <Painel className="!border-[#fde2e2] !bg-[#fef2f2] dark:!border-red-900/50 dark:!bg-red-950/20">
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400">
                          <Phone className="h-5 w-5" strokeWidth={1.8} />
                        </span>
                        <span className="text-[15px] font-bold">Contato de emergência</span>
                      </div>
                      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
                        <Field label="Nome completo">
                          <input
                            type="text"
                            value={formData.emergencyName}
                            onChange={(e) => updateFormValue('emergencyName', e.target.value)}
                            className={`${CAMPO_BASE} h-[52px] ${BORDA_EMERGENCIA}`}
                            placeholder="Nome do contato"
                          />
                        </Field>
                        <Field label="Telefone">
                          <input
                            type="tel"
                            inputMode="tel"
                            value={formData.emergencyPhone}
                            onChange={(e) => updateFormValue('emergencyPhone', formatPhone(e.target.value))}
                            className={`${CAMPO_BASE} h-[52px] ${BORDA_EMERGENCIA}`}
                            placeholder="(11) 98765-4321"
                          />
                        </Field>
                      </div>
                    </Painel>
                  </div>
                )}

                {cur.id === 'familia' && (
                  <div className="flex flex-col gap-7">
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5">
                      <Field label="Nome do pai *">
                        <input
                          type="text"
                          value={formData.fatherName}
                          onChange={(e) => updateFormValue('fatherName', e.target.value)}
                          className={campo('fatherName')}
                          placeholder="Nome completo do pai"
                        />
                      </Field>
                      <Field label="Nome da mãe *">
                        <input
                          type="text"
                          value={formData.motherName}
                          onChange={(e) => updateFormValue('motherName', e.target.value)}
                          className={campo('motherName')}
                          placeholder="Nome completo da mãe"
                        />
                      </Field>
                      {mostrarConjuge && (
                        <Field label="Cônjuge" className="col-span-full">
                          <input
                            type="text"
                            value={formData.spouseName}
                            onChange={(e) => updateFormValue('spouseName', e.target.value)}
                            className={campo()}
                            placeholder="Nome do cônjuge"
                          />
                        </Field>
                      )}
                    </div>
                    <Painel>
                      <span className="text-[15px] font-bold">Naturalidade</span>
                      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
                        <Field label="Cidade natal *">
                          <div className="relative">
                            <input
                              type="text"
                              value={formData.naturalityCity}
                              onChange={(e) => updateFormValue('naturalityCity', e.target.value)}
                              className={`${campo('naturalityCity', 'h-[52px]')} pr-24`}
                              placeholder="Cidade de nascimento"
                            />
                            {botaoBuscarUf('naturalityCity')}
                          </div>
                        </Field>
                        <Field label="UF *">
                          <SelectBox
                            value={formData.naturalityState}
                            onChange={(e) => updateFormValue('naturalityState', e.target.value)}
                            className={campo('naturalityState', 'h-[52px]')}
                          >
                            <option value="">—</option>
                            {BRAZIL_STATES.map((stateOption) => (
                              <option key={stateOption.value} value={stateOption.value}>
                                {stateOption.value}
                              </option>
                            ))}
                          </SelectBox>
                        </Field>
                        <Field label="Nacionalidade *">
                          <input
                            type="text"
                            value={formData.nationality}
                            onChange={(e) => updateFormValue('nationality', e.target.value)}
                            className={campo('nationality', 'h-[52px]')}
                            placeholder="Ex.: Brasileira"
                          />
                        </Field>
                      </div>
                    </Painel>
                  </div>
                )}

                {cur.id === 'endereco' && (
                  <div className="flex flex-col gap-6">
                    <Field
                      label="Comece pelo CEP"
                      className="max-w-[320px]"
                      hint={<span className={`text-xs font-medium ${cepMensagem.cor}`}>{cepMensagem.texto}</span>}
                    >
                      <input
                        type="text"
                        inputMode="numeric"
                        value={formData.zipCode}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, '').slice(0, 8);
                          updateFormValue('zipCode', v.length > 5 ? `${v.slice(0, 5)}-${v.slice(5)}` : v);
                          if (v.length === 8) void buscarCep(v);
                          else if (cepStatus !== 'idle') setCepStatus('idle');
                        }}
                        className={`${CAMPO_BASE} ${BORDA_OK} h-16 rounded-2xl px-5 text-[22px] font-bold tracking-[.04em]`}
                        placeholder="00000-000"
                        maxLength={9}
                      />
                    </Field>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-4">
                      <Field label="Rua">
                        <input
                          type="text"
                          value={formData.street}
                          onChange={(e) => updateFormValue('street', e.target.value)}
                          className={campo(undefined, 'h-[52px]')}
                          placeholder="Nome da rua"
                        />
                      </Field>
                      <Field label="Número">
                        <input
                          type="text"
                          value={formData.number}
                          onChange={(e) => updateFormValue('number', e.target.value)}
                          className={campo(undefined, 'h-[52px]')}
                          placeholder="Nº"
                        />
                      </Field>
                      <Field label="Complemento">
                        <input
                          type="text"
                          value={formData.complement}
                          onChange={(e) => updateFormValue('complement', e.target.value)}
                          className={campo(undefined, 'h-[52px]')}
                          placeholder="Apto, bloco, etc."
                        />
                      </Field>
                      <Field label="Bairro">
                        <input
                          type="text"
                          value={formData.neighborhood}
                          onChange={(e) => updateFormValue('neighborhood', e.target.value)}
                          className={campo(undefined, 'h-[52px]')}
                          placeholder="Bairro"
                        />
                      </Field>
                      <Field label="Cidade">
                        <div className="relative">
                          <input
                            type="text"
                            value={formData.city}
                            onChange={(e) => updateFormValue('city', e.target.value)}
                            className={`${campo(undefined, 'h-[52px]')} pr-24`}
                            placeholder="Cidade"
                          />
                          {botaoBuscarUf('city')}
                        </div>
                      </Field>
                      <Field label="Estado">
                        <SelectBox
                          value={formData.state}
                          onChange={(e) => updateFormValue('state', e.target.value)}
                          className={campo(undefined, 'h-[52px]')}
                        >
                          <option value="">—</option>
                          {BRAZIL_STATES.map((stateOption) => (
                            <option key={stateOption.value} value={stateOption.value}>
                              {stateOption.value}
                            </option>
                          ))}
                        </SelectBox>
                      </Field>
                    </div>
                    <LocationPicker
                      variante="cartao"
                      value={{ latitude: formData.latitude, longitude: formData.longitude }}
                      address={{
                        addressStreet: formData.street,
                        addressNumber: formData.number,
                        addressNeighborhood: formData.neighborhood,
                        addressCity: formData.city,
                        addressState: formData.state,
                        addressZipcode: formData.zipCode,
                      }}
                      onChange={(next) => {
                        setFormData((prev) => ({
                          ...prev,
                          latitude: next.latitude,
                          longitude: next.longitude,
                          street: next.address?.addressStreet ?? prev.street,
                          neighborhood: next.address?.addressNeighborhood ?? prev.neighborhood,
                          city: next.address?.addressCity ?? prev.city,
                          state: next.address?.addressState ?? prev.state,
                        }));
                      }}
                    />
                  </div>
                )}

                {cur.id === 'igreja' && (
                  <div className="flex flex-col gap-7">
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5">
                      <Field label="Situação do membro *">
                        <SelectBox
                          value={formData.membershipStatus}
                          onChange={(e) => updateFormValue('membershipStatus', e.target.value)}
                          className={campo('membershipStatus')}
                        >
                          <option value="AGUARDANDO ATIVACAO">Aguardando ativação</option>
                          <option value="ATIVO">Ativo</option>
                          <option value="DESLIGADO">Desligado</option>
                        </SelectBox>
                      </Field>
                      <Field label="Título eclesiástico *">
                        <SelectBox
                          value={formData.ecclesiasticalTitleId}
                          onChange={(e) => updateFormValue('ecclesiasticalTitleId', e.target.value)}
                          disabled={loadingChurches}
                          className={campo('ecclesiasticalTitleId')}
                        >
                          <option value="">{loadingChurches ? 'Carregando...' : 'Selecione o título'}</option>
                          {ecclesiasticalTitles.map((title) => (
                            <option key={title.id} value={title.id}>
                              {title.abbreviation ? `${title.abbreviation} · ` : ''}{title.name}
                            </option>
                          ))}
                        </SelectBox>
                      </Field>
                      <Field label="Ministério inicial">
                        <SelectBox
                          value={formData.ministryId}
                          onChange={(e) => {
                            updateFormValue('ministryId', e.target.value);
                            if (!e.target.value) {
                              updateFormValue('ministryRole', 'Participante');
                            }
                          }}
                          disabled={!formData.churchId || loadingMinistries}
                          className={campo()}
                        >
                          <option value="">{loadingMinistries ? 'Carregando...' : 'Sem ministério inicial'}</option>
                          {ministries.map((ministry) => (
                            <option key={ministry.id} value={ministry.id}>
                              {ministry.name}
                            </option>
                          ))}
                        </SelectBox>
                      </Field>
                      {formData.ministryId && (
                        <Field label="Função no ministério">
                          <input
                            type="text"
                            value={formData.ministryRole}
                            onChange={(e) => updateFormValue('ministryRole', e.target.value)}
                            className={campo()}
                            placeholder="Ex.: Participante, Líder de Setor, Auxiliar"
                          />
                        </Field>
                      )}
                      <Field label="Data de entrada na igreja">
                        <input
                          type="date"
                          value={formData.membershipDate}
                          onChange={(e) => updateFormValue('membershipDate', e.target.value)}
                          className={campo()}
                        />
                      </Field>
                    </div>
                    <div className="flex flex-wrap items-end gap-5">
                      <div className="flex flex-col gap-2.5">
                        <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">Já é batizado(a)?</span>
                        <Chips
                          options={[
                            { value: true, label: 'Sim' },
                            { value: false, label: 'Ainda não' },
                          ]}
                          value={formData.baptized}
                          onPick={(v) => updateFormValue('baptized', v)}
                        />
                      </div>
                      {formData.baptized && (
                        <Field label="Data do batismo" className="min-w-[220px] flex-1 sm:max-w-[280px]">
                          <input
                            type="date"
                            value={formData.baptismDate}
                            onChange={(e) => updateFormValue('baptismDate', e.target.value)}
                            className={campo(undefined, 'h-12')}
                          />
                        </Field>
                      )}
                    </div>
                    <Painel className="gap-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-col gap-[3px]">
                          <span className="text-[15px] font-bold">
                            Histórico em outras igrejas <span className="font-medium text-slate-500 dark:text-slate-400">· opcional</span>
                          </span>
                          <span className="text-[13px] text-slate-500 dark:text-slate-400">
                            Igrejas por onde o membro passou antes desta: título de lá, batismo, consagração, pastor e funções.
                          </span>
                        </div>
                        <Permissao chave="members.member_registration.adicionar_historico_em_outra_igreja" rotulo="Adicionar histórico em outra igreja — Member Registration" herda="members.view">
                          <button
                            type="button"
                            onClick={openPrevChurchCreate}
                            className="flex h-10 items-center gap-1.5 rounded-[10px] border border-slate-200 bg-white px-3.5 text-sm font-semibold hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700"
                          >
                            <Plus className="h-4 w-4" strokeWidth={2} />
                            Adicionar
                          </button>
                        </Permissao>
                      </div>
                      {previousChurches.length === 0 ? (
                        <p className="m-0 text-[13px] text-slate-400">Nenhuma igreja adicionada. Pode ser cadastrado depois na ficha do membro.</p>
                      ) : (
                        previousChurches.map((entry) => (
                          <div key={entry.id} className="flex items-start gap-3 rounded-xl border border-[#e8ecf1] bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">{entry.churchName}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                {entry.ecclesiasticalTitle || 'Sem título informado'}
                                {entry.pastorName ? ` · Pr. ${entry.pastorName}` : ''}
                              </p>
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {entry.conversionDate ? `Aceitou Jesus: ${entry.conversionDate.split('-').reverse().join('/')}` : ''}
                                {entry.baptismDate ? ` · Batismo: ${entry.baptismDate.split('-').reverse().join('/')}` : ''}
                                {entry.consecrationDate ? ` · Consagração: ${entry.consecrationDate.split('-').reverse().join('/')}` : ''}
                                {entry.consecrationTitle ? ` (${entry.consecrationTitle})` : ''}
                              </p>
                              {entry.functions && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Funções: {entry.functions}</p>}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openPrevChurchEdit(entry)}
                                className="grid h-9 w-9 place-items-center rounded-[10px] text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <Permissao chave="members.member_registration.remover_prev_church" rotulo="Remover (prev church) — Member Registration" herda="members.view">
                                <button
                                  type="button"
                                  onClick={() => removePrevChurch(entry.id)}
                                  className="grid h-9 w-9 place-items-center rounded-[10px] text-slate-400 hover:bg-red-100 hover:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </Permissao>
                            </div>
                          </div>
                        ))
                      )}
                    </Painel>
                  </div>
                )}

                {cur.id === 'revisao' && (
                  <div className="flex flex-col gap-5">
                    {!pronto && (
                      <div className="flex items-start gap-3.5 rounded-2xl border border-[#fde68a] bg-[#fffbeb] px-5 py-[18px] dark:border-[#78350f] dark:bg-[#451a03]/50">
                        <AlertTriangle className="mt-px h-[22px] w-[22px] flex-none text-[#b45309] dark:text-[#fbbf24]" strokeWidth={1.8} />
                        <div className="flex flex-col gap-1">
                          <span className="text-[15px] font-bold text-[#92400e] dark:text-[#fcd34d]">
                            {allMissing.length} {allMissing.length > 1 ? 'campos obrigatórios faltando' : 'campo obrigatório faltando'}
                          </span>
                          <span className="text-[13px] text-[#92400e] dark:text-[#fcd34d]">{allMissing.map((key) => REQUIRED_LABELS[key]).join(', ')}</span>
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
                      {STEPS.slice(0, -1).map((st, index) => {
                        const miss = missingOf(st).length > 0;
                        const Icon = miss ? st.icon : Check;
                        return (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => goTo(index)}
                            className="flex items-start gap-3.5 rounded-[18px] border border-[#e8ecf1] bg-white p-4 text-left transition-colors hover:border-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-300"
                          >
                            <span
                              className={`grid h-10 w-10 flex-none place-items-center rounded-xl ${
                                miss ? 'bg-[#fef3c7] text-[#b45309] dark:bg-[#451a03]/50 dark:text-[#fcd34d]' : 'bg-[#dcfce7] text-[#15803d] dark:bg-[#052e16]/60 dark:text-[#86efac]'
                              }`}
                            >
                              <Icon className="h-5 w-5" strokeWidth={1.8} />
                            </span>
                            <span className="flex min-w-0 flex-col gap-[3px]">
                              <span className="text-[13px] font-bold text-slate-500 dark:text-slate-400">{st.short}</span>
                              <span className="line-clamp-2 text-sm font-semibold">{resumo(st.id)}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <Field label="Observações">
                      <textarea
                        rows={4}
                        value={formData.notes}
                        onChange={(e) => updateFormValue('notes', e.target.value)}
                        className={`${CAMPO_BASE} ${BORDA_OK} resize-y py-3.5`}
                        placeholder="Informações complementares sobre o membro"
                      />
                    </Field>
                  </div>
                )}
              </div>

              {error ? (
                <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                  <span className="flex-1">{error}</span>
                  <button type="button" onClick={() => setError('')} aria-label="Fechar aviso" className="rounded p-0.5 hover:bg-red-100 dark:hover:bg-red-900/40">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}

              {/* Rodapé: voltar / avançar */}
              <div className="sticky bottom-0 z-[2] flex items-center justify-between gap-3 border-t border-[#eef2f6] bg-white pb-4 pt-3.5 md:static md:pb-0 md:pt-6 dark:border-slate-700 dark:bg-slate-800">
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={() => goTo(step - 1)}
                    className="flex h-12 items-center gap-2 rounded-xl pl-3 pr-[18px] text-[15px] font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <ArrowLeft className="h-5 w-5" strokeWidth={2} />
                    Voltar
                  </button>
                ) : (
                  // Primeira etapa: sem "Voltar", a saída é cancelar e voltar à lista.
                  <Link
                    to="/app-ui/members"
                    className="flex h-12 items-center gap-2 rounded-xl pl-3 pr-[18px] text-[15px] font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <X className="h-5 w-5" strokeWidth={2} />
                    Cancelar
                  </Link>
                )}
                <div className="flex items-center gap-3.5">
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="whitespace-nowrap text-[15px] font-bold md:text-base">{saving ? 'Salvando…' : proximoRotulo}</span>
                    <span className={`hidden text-xs md:block ${ultima && !pronto ? 'text-[#b45309] dark:text-[#fbbf24]' : 'text-slate-400'}`}>{proximoDica}</span>
                  </div>
                  {ultima && pronto ? (
                    <Permissao chave="members.member_registration.salvar_membro" rotulo="Salvar Membro — Member Registration" herda="members.view">
                      <BotaoAvancar onClick={avancar} disabled={saving || loadingChurches} icon={saving ? Loader2 : Check} verde girando={saving} />
                    </Permissao>
                  ) : (
                    <BotaoAvancar onClick={avancar} icon={ArrowRight} verde={false} />
                  )}
                </div>
              </div>
            </section>
          )}
        </main>
      </div>

      {/* Modal: histórico em outra igreja */}
      {prevChurchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white shadow-xl dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 dark:border-slate-700">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {prevChurchForm.id ? 'Editar histórico em outra igreja' : 'Adicionar histórico em outra igreja'}
              </h3>
              <button
                type="button"
                onClick={() => setPrevChurchModalOpen(false)}
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              {prevChurchError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {prevChurchError}
                </div>
              )}

              <PreviousChurchFields
                form={prevChurchForm}
                onChange={(patch) => setPrevChurchForm((p) => ({ ...p, ...patch }))}
                titleOptions={ecclesiasticalTitles.map((t) => t.name)}
                idPrefix="new-member-prev-church"
              />

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setPrevChurchModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <Permissao chave="members.member_registration.salvar_historico" rotulo="Salvar histórico — Member Registration" herda="members.view">
                  <button
                    type="button"
                    onClick={savePrevChurch}
                    className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                  >
                    Salvar histórico
                  </button>
                </Permissao>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Duplicidade */}
      {duplicateMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-800">
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fef3c7] text-[#b45309]">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Possível duplicidade</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {duplicateMember.type === 'cpf' && 'Este CPF já consta em nossa base.'}
                  {duplicateMember.type === 'rol' && 'Este ROL já consta em nossa base.'}
                  {duplicateMember.type === 'name' && 'Este nome já consta em nossa base.'}
                </p>
              </div>
            </div>

            {duplicateMember.sameCampo ? (
              <div className="mb-6 rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                <p className="font-semibold text-slate-900 dark:text-white">{duplicateMember.member.fullName}</p>
                {duplicateMember.member.cpf && (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">CPF: {duplicateMember.member.cpf}</p>
                )}
                {duplicateMember.member.rol && (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">ROL: {duplicateMember.member.rol}</p>
                )}
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Igreja: {duplicateMember.member.church?.code ? `${duplicateMember.member.church.code} - ` : ''}
                  {duplicateMember.member.church?.name}
                </p>
              </div>
            ) : (
              <div className="mb-6 rounded-2xl border border-rose-100 bg-rose-50 p-4">
                <p className="text-sm font-medium text-rose-800">
                  {duplicateMember.type === 'cpf'
                    ? 'Este CPF pertence a um membro de outro Campo. Por motivos de privacidade, os dados do membro não podem ser exibidos.'
                    : duplicateMember.type === 'rol'
                    ? 'Este ROL pertence a um membro de outro Campo. Por motivos de privacidade, os dados do membro não podem ser exibidos.'
                    : 'Este membro pertence a outro Campo.'}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDuplicateMember(null)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Voltar e corrigir
              </button>
              {duplicateMember.type === 'name' && (
                <button
                  type="button"
                  onClick={() => setDuplicateMember(null)}
                  className="flex-1 rounded-xl bg-amber-500 px-4 py-3 font-semibold text-white transition-colors hover:bg-amber-600"
                >
                  É homônimo (continuar)
                </button>
              )}
              {duplicateMember.sameCampo && (isMasterOrAdmin || (storedUser.profileType === 'igreja' && storedUser.churchId === duplicateMember.member.churchId)) && (
                <Permissao chave="members.member_registration.editar_membro" rotulo="Editar Membro — Member Registration" herda="members.view">
                  <button
                    type="button"
                    onClick={() => navigate(`/app-ui/members/${duplicateMember.member.id}/edit`)}
                    className="flex-1 rounded-xl bg-slate-900 px-4 py-3 font-semibold text-white transition-colors hover:bg-slate-800 dark:bg-white dark:text-slate-900"
                  >
                    Editar membro
                  </button>
                </Permissao>
              )}
            </div>
            {(duplicateMember.type === 'cpf' || duplicateMember.type === 'rol') && (
              <p className="mt-4 text-center text-xs font-medium text-rose-500">
                O cadastro não pode prosseguir com CPF ou ROL duplicados.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Modal Cidades */}
      {cityOptions && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/50" onClick={() => setCityOptions(null)} />
          <div className="fixed left-1/2 top-1/2 z-50 w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-slate-700">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">Selecione a cidade</h4>
              <button type="button" onClick={() => setCityOptions(null)} className="rounded p-1 hover:bg-slate-100 dark:hover:bg-slate-700">
                <X className="h-4 w-4 text-slate-600" />
              </button>
            </div>
            <p className="px-5 pt-3 text-xs text-slate-500 dark:text-slate-400">
              Encontramos {cityOptions.options.length} resultados para "{formData[cityOptions.field]}". Escolha a cidade correta:
            </p>
            <ul className="max-h-80 overflow-y-auto p-3">
              {cityOptions.options.map((option) => (
                <li key={`${option.city}-${option.state}`}>
                  <button
                    type="button"
                    onClick={() => applyCitySelection(cityOptions.field, option)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-transparent px-3 py-2.5 text-left text-sm text-slate-700 hover:border-slate-200 hover:bg-slate-50 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-700"
                  >
                    <span>{option.city}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">{option.state}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
