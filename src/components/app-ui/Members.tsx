import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { AlertTriangle, Building2, CheckCircle2, ChevronDown, Church, Download, FilterX, Mail, MapPin, MoreHorizontal, PauseCircle, Pencil, Phone, Plus, Printer, SlidersHorizontal, Trash2, UserPlus, UserRound, Users, Search, Loader2, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MemberEditDrawer } from './MemberEditDrawer';
import { MemberQuickCreateModal } from './MemberQuickCreateModal';
import { PrintModal } from './shared/PrintModal';
import { printReport } from '../../lib/printReport';
import { TableSkeleton, StatsSkeleton } from './shared/Skeleton';
import { useDebounce } from '../../lib/secretariaHooks';
import { qk } from '../../lib/queryClient';

import { apiBase } from '../../lib/apiBase';
import { useCampoVisible } from '../../lib/campoVisibility';
import { logClientAudit } from '../../lib/auditClient';
import { Permissao, usePode } from '../../lib/permissoes/Permissao';
import { FONTE_MODELO_FAMILIA, useFonteModelo } from '../../lib/fonteModelo';
import { fotoDisponivel } from '../../lib/fotoMembro';

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
      code?: string | null;
    };
  };
};

type EcclesiasticalTitleOption = {
  id: string;
  name: string;
  abbreviation?: string | null;
  level: number;
};

type MemberRecord = {
  id: string;
  fullName: string;
  memberType?: string | null;
  maritalStatus?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  membershipStatus?: string | null;
  membershipDate?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  churchId: string;
  ecclesiasticalTitle?: string | null;
  ecclesiasticalTitleId?: string | null;
  ecclesiasticalTitleRef?: {
    id: string;
    name: string;
    abbreviation?: string | null;
    level?: number;
  } | null;
  regional?: {
    id?: string;
    name?: string;
    code?: string | null;
  } | null;
  /** Funções ativas do membro (church_function_history). */
  churchFunctions?: Array<{
    id: string;
    isCampoWide?: boolean;
    function?: { id: string; name: string | null } | null;
  }> | null;
  church?: {
    id?: string;
    name?: string;
    code?: string | null;
    regional?: {
      id?: string;
      name?: string;
      code?: string | null;
      campoId?: string | null;
      campo?: { id?: string; name?: string } | null;
    } | null;
  } | null;
  churchName?: string;
  churchCode?: string | null;
  regionalName?: string;
  fieldName?: string;
  photoUrl?: string | null;
  rol?: number | null;
  fatherName?: string | null;
  motherName?: string | null;
  spouseName?: string | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressNeighborhood?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressZipcode?: string | null;
  birthDate?: string | null;
  baptismDate?: string | null;
  naturalityCity?: string | null;
};

type SortKey = 'fullName' | 'memberType' | 'contact' | 'churchName' | 'membershipStatus' | 'membershipDate' | 'ecclesiasticalTitle';
type MemberTypeFilter = 'ALL' | 'MEMBRO' | 'PF' | 'PJ';
type MembershipStatusFilter = 'ALL' | 'ativo' | 'inativo' | 'aguardando' | 'visitante';

const EMPTY_TITLE_FILTER = '__NONE__';
const EMPTY_MARITAL_STATUS_FILTER = '__NONE__';

const pageSizeOptions = [20, 50, 100, 250, 500, 1000, 5000];

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('mrm_user') || '{}');
  } catch {
    return {};
  }
}

function normalizeText(value: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeMembershipStatus(status?: string | null) {
  const normalized = normalizeText(status || '');

  if (!normalized) {
    return 'visitante';
  }

  if (normalized.includes('aguard')) {
    return 'aguardando';
  }

  if (normalized.includes('inativ') || normalized.includes('deslig')) {
    return 'inativo';
  }

  if (normalized.includes('visit')) {
    return 'visitante';
  }

  return 'ativo';
}

function normalizeMemberType(memberType?: string | null) {
  const normalized = normalizeText(memberType || 'MEMBRO');
  if (normalized === 'pj') return 'PJ';
  if (normalized === 'pf') return 'PF';
  return 'MEMBRO';
}

function normalizeMaritalStatus(status?: string | null) {
  const normalized = normalizeText(status || '');

  if (!normalized) {
    return EMPTY_MARITAL_STATUS_FILTER;
  }

  if (normalized.includes('cas')) {
    return 'casado';
  }

  if (normalized.includes('solt')) {
    return 'solteiro';
  }

  if (normalized.includes('viuv')) {
    return 'viuvo';
  }

  if (normalized.includes('divorc')) {
    return 'divorciado';
  }

  return normalized;
}

function getMembershipStatusLabel(status: Exclude<MembershipStatusFilter, 'ALL'>) {
  if (status === 'ativo') return 'Ativo';
  if (status === 'inativo') return 'Desligado';
  if (status === 'aguardando') return 'Aguardando ativação';
  return 'Visitante';
}

function getMaritalStatusLabel(status: string) {
  if (status === EMPTY_MARITAL_STATUS_FILTER) return 'Não informado';
  if (status === 'casado') return 'Casado';
  if (status === 'solteiro') return 'Solteiro';
  if (status === 'viuvo') return 'Viúvo';
  if (status === 'divorciado') return 'Divorciado';

  return status
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getMemberTypeLabel(memberType?: string | null) {
  const normalized = normalizeMemberType(memberType);
  if (normalized === 'PJ') return 'PJ';
  if (normalized === 'PF') return 'PF';
  return 'Membro';
}

function buildAuthHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}

function formatCpf(value?: string | null) {
  const digits = digitsOnly(value || '').slice(0, 11);

  if (!digits) {
    return '';
  }

  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function formatCnpj(value?: string | null) {
  const digits = digitsOnly(value || '').slice(0, 14);

  if (!digits) {
    return '';
  }

  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function formatPhone(value?: string | null) {
  const digits = digitsOnly(value || '').slice(0, 11);

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

function sortTitles(titles: EcclesiasticalTitleOption[]) {
  return [...titles].sort((left, right) => {
    const levelDiff = (left.level || 0) - (right.level || 0);
    if (levelDiff !== 0) {
      return levelDiff;
    }

    return left.name.localeCompare(right.name, 'pt-BR');
  });
}

// Tons do modelo em hex: as classes green/amber/sky/violet... são repintadas
// pelo tema global (globals.css) e sairiam cinza.
const STATUS_TOM: Record<string, string> = {
  ativo: 'bg-[#dcfce7] text-[#15803d]',
  inativo: 'bg-[#fee2e2] text-[#b91c1c]',
  aguardando: 'bg-[#fef3c7] text-[#b45309]',
  visitante: 'bg-[#f1f5f9] text-[#334155]',
};

const TIPO_TOM: Record<string, string> = {
  MEMBRO: 'bg-[#f1f5f9] text-[#334155]',
  PF: 'bg-[#e0f2fe] text-[#075985]',
  PJ: 'bg-[#ede9fe] text-[#5b21b6]',
};

const AVATAR_TONS: Array<[string, string]> = [
  ['#e0e7ff', '#3730a3'],
  ['#dcfce7', '#166534'],
  ['#fef3c7', '#92400e'],
  ['#fce7f3', '#9d174d'],
  ['#e0f2fe', '#075985'],
  ['#f1f5f9', '#334155'],
];

/** Cor do avatar fixa por membro (não muda ao reordenar a lista). */
function corDoAvatar(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % AVATAR_TONS.length;
}

/**
 * Avatar do membro: foto quando carrega, iniciais quando não há foto ou ela
 * falha (ex.: URL ainda apontando para o projeto antigo do Supabase, que não
 * existe mais) — em vez do ícone de imagem quebrada com o texto alternativo.
 */
function AvatarMembro({ id, nome, foto, className }: { id: string; nome: string; foto?: string | null; className: string }) {
  const [falhou, setFalhou] = useState(false);
  const tom = AVATAR_TONS[corDoAvatar(id)];
  // Foto do projeto antigo do Supabase nem é pedida: o domínio não existe mais.
  const url = fotoDisponivel(foto);
  return (
    <span className={`grid flex-none place-items-center overflow-hidden rounded-full font-bold ${className}`} style={{ background: tom[0], color: tom[1] }}>
      {url && !falhou ? (
        <img src={url} alt={nome} className="h-full w-full object-cover" onError={() => setFalhou(true)} />
      ) : (
        getInitials(nome)
      )}
    </span>
  );
}

/** Situação como está gravada, só com a caixa ajustada ("ATIVO" → "Ativo"). */
function rotuloStatus(status?: string | null) {
  const texto = (status || 'VISITANTE').toLowerCase();
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function getTitleLabel(member: MemberRecord) {
  if (normalizeMemberType(member.memberType) !== 'MEMBRO') {
    return '-';
  }

  if (member.ecclesiasticalTitle) {
    return member.ecclesiasticalTitle;
  }

  return member.ecclesiasticalTitleRef?.name || '-';
}

function getMemberTitleFilterValue(member: MemberRecord) {
  if (normalizeMemberType(member.memberType) !== 'MEMBRO') {
    return EMPTY_TITLE_FILTER;
  }

  return member.ecclesiasticalTitleRef?.id || member.ecclesiasticalTitleId || EMPTY_TITLE_FILTER;
}

function getInitials(fullName: string) {
  return fullName
    .split(' ')
    .map((item) => item[0])
    .slice(0, 2)
    .join('');
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/80 dark:bg-slate-700/70 ${className}`} />;
}

// null  = todos selecionados (sem filtro)
// string[] = seleção explícita (vazio = nenhum marcado, aguardando seleção)
function MultiSelectDropdown({
  options,
  value,
  onChange,
  allLabel,
  disabled,
  searchable,
}: {
  options: { value: string; label: string }[];
  value: string[] | null;
  onChange: (v: string[] | null) => void;
  allLabel: string;
  disabled?: boolean;
  /** Campo de filtro no topo. Ligado nas listas longas (igrejas, regionais). */
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  useEffect(() => {
    if (!open) setSearch('');
  }, [open]);

  const visibleOptions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter((o) => o.label.toLowerCase().includes(term));
  }, [options, search]);

  // null = modo "todos"; [] = nenhum marcado; [ids] = seleção parcial
  const isAll = value === null;
  const selected = value ?? [];

  const displayLabel = isAll
    ? allLabel
    : selected.length === 0
    ? 'Nenhum selecionado'
    : selected.length === 1
    ? (options.find((o) => o.value === selected[0])?.label ?? '1 selecionado')
    : `${selected.length} selecionados`;

  const handleTodos = () => {
    if (isAll) {
      onChange([]); // desmarcar todos → entra no modo seleção vazia
      return;
    }
    // Com um filtro digitado, "marcar todos" marca o que está à vista somado ao
    // que já estava escolhido — marcar a lista inteira aqui apagaria o filtro
    // que o usuário acabou de aplicar.
    if (search.trim()) {
      const next = Array.from(new Set([...selected, ...visibleOptions.map((o) => o.value)]));
      onChange(next.length === options.length ? null : next);
      return;
    }
    onChange(null); // marcar todos → volta ao modo "todos"
  };

  const toggle = (val: string) => {
    if (isAll) {
      // clicar em item individual quando "todos" está ativo = desmarcar só esse
      onChange(options.filter((o) => o.value !== val).map((o) => o.value));
      return;
    }
    const next = selected.includes(val)
      ? selected.filter((v) => v !== val)
      : [...selected, val];
    // se todos foram marcados individualmente → volta para modo "todos"
    onChange(next.length === options.length ? null : next);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((p) => !p)}
        className="flex h-[50px] w-full items-center justify-between gap-1 rounded-[14px] border-[1.5px] border-slate-200 bg-white px-3.5 text-left text-[15px] font-medium text-slate-900 outline-none focus:border-slate-900 disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:disabled:bg-slate-800"
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[240px] overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {searchable && (
            <div className="border-b border-slate-100 dark:border-slate-700 p-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filtrar..."
                  className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1.5 pl-8 pr-2 text-sm focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>
          )}
          <div className="max-h-64 overflow-y-auto py-1">
            <label className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-sm font-semibold border-b border-slate-100 dark:border-slate-700">
              <input
                type="checkbox"
                checked={isAll}
                onChange={handleTodos}
                className="h-4 w-4 rounded border-slate-300 accent-slate-900"
              />
              {search.trim() ? 'Marcar filtrados' : allLabel}
            </label>
            {visibleOptions.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-slate-400">Nada encontrado</p>
            ) : visibleOptions.map((option) => (
              <label key={option.value} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={isAll || selected.includes(option.value)}
                  onChange={() => toggle(option.value)}
                  className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type MembersQueryData = {
  members: MemberRecord[];
  total: number;
  activeCount: number;
  inactiveCount: number;
  churchCount: number;
};

export function Members() {
  const navigate = useNavigate();
  const token = localStorage.getItem('mrm_token');
  const storedUser = readStoredUser();
  const activeFieldId = localStorage.getItem('mrm_active_field_id') || storedUser.campoId || '';
  // Campo não aparece na interface (só master, e só depois de destravar).
  const campoVisible = useCampoVisible();
  const normalizedRole = normalizeText(storedUser.roleName);
  const isSecretaryOrTreasurer = normalizedRole.includes('secret') || normalizedRole.includes('tesour');
  const isChurchScopedUser = storedUser.profileType === 'church';
  const isAdminOrMaster = ['master', 'admin'].includes(storedUser.profileType || '');
  const hasFixedChurchScope = isChurchScopedUser || isSecretaryOrTreasurer;
  // Somente admin/master trocam o campo; regional/igreja ficam livres exceto perfil church
  const canChooseField = isAdminOrMaster;
  const canChooseRegional = !hasFixedChurchScope;
  const canChooseChurch = !hasFixedChurchScope;

  const [fields, setFields] = useState<CampoOption[]>([]);
  const [regionais, setRegionais] = useState<RegionalOption[]>([]);
  const [churches, setChurches] = useState<ChurchOption[]>([]);
  const [titles, setTitles] = useState<EcclesiasticalTitleOption[]>([]);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState(activeFieldId);
  // null = "todas", igual aos demais MultiSelectDropdown desta tela. Comecam na
  // regional e na igreja do usuario logado.
  const [selectedRegionalIds, setSelectedRegionalIds] = useState<string[] | null>(
    storedUser.regionalId ? [storedUser.regionalId] : null,
  );
  const [selectedChurchIds, setSelectedChurchIds] = useState<string[] | null>(
    storedUser.churchId ? [storedUser.churchId] : null,
  );
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<MemberTypeFilter>('MEMBRO');
  const [selectedTitleFilters, setSelectedTitleFilters] = useState<string[] | null>(null);
  // Ativos por padrao: e o recorte que a secretaria usa no dia a dia, e evita
  // que a primeira consulta traga inativos, desligados e visitantes junto.
  const [selectedStatusFilters, setSelectedStatusFilters] = useState<string[] | null>(['ativo']);
  const [selectedMaritalStatusFilters, setSelectedMaritalStatusFilters] = useState<string[] | null>(null);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [editorMemberId, setEditorMemberId] = useState<string | null>(null);
  const [quickCreateType, setQuickCreateType] = useState<'PF' | 'PJ' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MemberRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('fullName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  // 100 por pagina e o padrao das listas. Nas telas de fluxo a fila ja chega
  // recortada por data, entao paginar e so exibicao — trocar o limite nao
  // refaz o fetch. Em Membros a paginacao e do servidor: trocar o limite
  // busca a pagina nova, sem nunca esconder o resto (o total vem do banco).
  const [pageSize, setPageSize] = useState(100);
  const [serverTotal, setServerTotal] = useState(0);
  const [serverActiveCount, setServerActiveCount] = useState(0);
  const [serverInactiveCount, setServerInactiveCount] = useState(0);
  const [serverChurchCount, setServerChurchCount] = useState(0);
  const [error, setError] = useState('');
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [preparingPrint, setPreparingPrint] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [isNavigatingNew, setIsNavigatingNew] = useState(false);
  // Interface: menu "Novo cadastro", painel de filtros e fonte do modelo.
  const [novoMenuAberto, setNovoMenuAberto] = useState(false);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  // Celular: o ⋯ da linha abre a situação e as ações do membro.
  const [menuLinha, setMenuLinha] = useState<MemberRecord | null>(null);
  const pode = usePode();
  useFonteModelo();
  type AppliedFilters = {
    churchIds?: string;
    regionalIds?: string;
    campoId?: string;
    q?: string;
    memberType?: string;
    status?: string;
    maritalStatus?: string;
    titleId?: string;
  };
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters | null>(null);

  // Sem busca feita a tela nao esta carregando — esta esperando o usuario.
  const hasSearched = appliedFilters !== null;
  // Duas esperas diferentes, que estavam sob a mesma flag: as opcoes dos
  // filtros (campos, regionais, igrejas, titulos) e a lista de membros. Antes
  // as duas mostravam "Carregando dados dos membros...", entao a tela dizia
  // estar buscando membros enquanto pedia para o usuario clicar em Buscar.
  const isLoadingMembersList = hasSearched && loadingMembers;
  const isLoadingScreen = isLoadingMembersList;
  const isAnyActionActive = printModalOpen || preparingPrint || exportingExcel || (quickCreateType !== null) || isNavigatingNew;

  const filteredRegionais = useMemo(() => {
    if (hasFixedChurchScope && storedUser.regionalId) {
      return regionais.filter((regional) => regional.id === storedUser.regionalId);
    }

    if (!selectedFieldId) {
      return regionais;
    }

    return regionais.filter((regional) => regional.campoId === selectedFieldId);
  }, [regionais, selectedFieldId]);

  const filteredChurches = useMemo(() => {
    if (hasFixedChurchScope && storedUser.churchId) {
      return churches.filter((church) => church.id === storedUser.churchId);
    }

    const churchesInField = churches.filter((church) => {
      if (!selectedFieldId) {
        return true;
      }

      return church.regional?.campoId === selectedFieldId || church.regional?.campo?.id === selectedFieldId;
    });

    if (!selectedRegionalIds || selectedRegionalIds.length === 0) {
      return churchesInField;
    }

    return churchesInField.filter((church) => (
      selectedRegionalIds.includes(church.regional?.id || '') || selectedRegionalIds.includes(church.regionalId || '')
    ));
  }, [churches, hasFixedChurchScope, selectedFieldId, selectedRegionalIds, storedUser.churchId]);

  const titleFilterOptions = useMemo(() => {
    const options = titles.map((title) => ({
      value: title.id,
      label: title.name,
    }));

    return [
      { value: 'ALL', label: 'Todos os títulos' },
      { value: EMPTY_TITLE_FILTER, label: 'Sem título' },
      ...options,
    ];
  }, [titles]);

  const maritalStatusFilterOptions = useMemo(() => [
    { value: 'ALL', label: 'Todos os estados civis' },
    { value: 'casado', label: 'Casado' },
    { value: 'solteiro', label: 'Solteiro' },
    { value: 'viuvo', label: 'Viúvo' },
    { value: 'divorciado', label: 'Divorciado' },
    { value: EMPTY_MARITAL_STATUS_FILTER, label: 'Não informado' },
  ], []);

  const visibleMembers = useMemo(() => {
    // All filtering is handled server-side; client only sorts the current page
    return [...members].sort((left, right) => {
      const leftValue = (() => {
        if (sortKey === 'memberType') {
          return normalizeMemberType(left.memberType);
        }
        if (sortKey === 'contact') {
          return left.mobile || left.phone || left.email || '';
        }
        if (sortKey === 'churchName') {
          return left.churchName || '';
        }
        if (sortKey === 'membershipStatus') {
          return left.membershipStatus || '';
        }
        if (sortKey === 'membershipDate') {
          return left.membershipDate || '';
        }
        if (sortKey === 'ecclesiasticalTitle') {
          return left.ecclesiasticalTitleRef?.name || left.ecclesiasticalTitle || '';
        }
        return left.fullName || '';
      })();

      const rightValue = (() => {
        if (sortKey === 'memberType') {
          return normalizeMemberType(right.memberType);
        }
        if (sortKey === 'contact') {
          return right.mobile || right.phone || right.email || '';
        }
        if (sortKey === 'churchName') {
          return right.churchName || '';
        }
        if (sortKey === 'membershipStatus') {
          return right.membershipStatus || '';
        }
        if (sortKey === 'membershipDate') {
          return right.membershipDate || '';
        }
        if (sortKey === 'ecclesiasticalTitle') {
          return right.ecclesiasticalTitleRef?.name || right.ecclesiasticalTitle || '';
        }
        return right.fullName || '';
      })();

      const comparison = String(leftValue).localeCompare(String(rightValue), 'pt-BR');
      return sortDirection === 'asc' ? comparison : comparison * -1;
    });
  }, [members, sortDirection, sortKey]);

  // API already paginates; visibleMembers is the sorted current page
  const paginatedMembers = visibleMembers;

  const totalPages = useMemo(() => Math.max(1, Math.ceil(serverTotal / pageSize)), [pageSize, serverTotal]);

  const stats = useMemo(() => ({
    activeMembers: serverActiveCount,
    inactiveMembers: serverInactiveCount,
    uniqueChurches: serverChurchCount,
  }), [serverActiveCount, serverInactiveCount, serverChurchCount]);

  // Mexer num filtro nao mexe mais na pagina: os resultados na tela ainda sao
  // os da busca anterior. Quem zera a pagina e handleSearchMembers.
  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

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
        const [fieldsResponse, regionaisResponse, churchesResponse, titlesResponse] = await Promise.all([
          fetch(`${apiBase}/campos`, { headers: buildAuthHeaders(token) }),
          fetch(`${apiBase}/regionais${fieldQuery}`, { headers: buildAuthHeaders(token) }),
          fetch(`${apiBase}/churches${fieldQuery}`, { headers: buildAuthHeaders(token) }),
          fetch(`${apiBase}/ecclesiastical-titles`, { headers: buildAuthHeaders(token) }),
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
            throw new Error('Sessao expirada. Faca login novamente.');
          }

          throw new Error('Falha ao carregar campos, regionais, igrejas e títulos.');
        }

        const [fieldsData, regionaisData, churchesData, titlesData] = await Promise.all([
          fieldsResponse.json(),
          regionaisResponse.json(),
          churchesResponse.json(),
          titlesResponse.json(),
        ]);

        const nextFields = Array.isArray(fieldsData) ? fieldsData : [];
        const nextRegionais = Array.isArray(regionaisData) ? regionaisData : [];
        const nextChurches = Array.isArray(churchesData) ? churchesData : [];
        const nextTitles = sortTitles(Array.isArray(titlesData) ? titlesData : []);

        setFields(hasFixedChurchScope && activeFieldId ? nextFields.filter((field) => field.id === activeFieldId) : nextFields);
        setRegionais(hasFixedChurchScope && storedUser.regionalId ? nextRegionais.filter((regional) => regional.id === storedUser.regionalId) : nextRegionais);
        setChurches(hasFixedChurchScope && storedUser.churchId ? nextChurches.filter((church) => church.id === storedUser.churchId) : nextChurches);
        setTitles(nextTitles);

        if (hasFixedChurchScope && activeFieldId && activeFieldId !== selectedFieldId) {
          setSelectedFieldId(activeFieldId);
        }

        if (hasFixedChurchScope && storedUser.regionalId) {
          setSelectedRegionalIds([storedUser.regionalId]);
        }

        if (hasFixedChurchScope && storedUser.churchId) {
          setSelectedChurchIds([storedUser.churchId]);
        }
      } catch (loadError) {
        setFields([]);
        setRegionais([]);
        setChurches([]);
        setTitles([]);
        setMembers([]);
        setError(loadError instanceof Error ? loadError.message : 'Nao foi possivel carregar os filtros.');
      } finally {
        setLoadingFilters(false);
      }
    };

    loadFilters();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, selectedFieldId, hasFixedChurchScope, activeFieldId]);

  // A tela abre limpa: a consulta so acontece quando o usuario clica em Buscar.
  // Antes ela carregava a base ao montar e refazia a busca a cada filtro
  // mexido — com 26 mil membros isso era uma espera que ninguem pediu.
  // Este snapshot e o que a query enxerga; mexer num <select> nao o altera.
  const buildFiltersFromForm = useCallback((): AppliedFilters => ({
    churchIds: selectedChurchIds?.length ? selectedChurchIds.join(',') : undefined,
    regionalIds: !selectedChurchIds?.length && selectedRegionalIds?.length
      ? selectedRegionalIds.join(',')
      : undefined,
    campoId: (!selectedChurchIds?.length && !selectedRegionalIds?.length)
      ? (selectedFieldId || undefined)
      : undefined,
    q: searchTerm.trim() || undefined,
    memberType: selectedTypeFilter !== 'ALL' ? selectedTypeFilter : undefined,
    status: selectedStatusFilters && selectedStatusFilters.length > 0 ? selectedStatusFilters.join(',') : undefined,
    maritalStatus: selectedMaritalStatusFilters && selectedMaritalStatusFilters.length > 0 ? selectedMaritalStatusFilters.join(',') : undefined,
    titleId: selectedTitleFilters && selectedTitleFilters.length > 0 ? selectedTitleFilters.join(',') : undefined,
  }), [selectedChurchIds, selectedRegionalIds, selectedFieldId, searchTerm, selectedTypeFilter, selectedStatusFilters, selectedMaritalStatusFilters, selectedTitleFilters]);

  const handleSearchMembers = useCallback(() => {
    setPage(1);
    setAppliedFilters(buildFiltersFromForm());
  }, [buildFiltersFromForm]);

  // ── TanStack Query — members ─────────────────────────────────────────────
  // page/pageSize ficam de fora do snapshot: paginar e navegar no resultado ja
  // buscado, entao muda a consulta na hora, sem passar pelo botao.
  const memberQueryFilters = useMemo(() => ({
    ...(appliedFilters ?? {}),
    page,
    pageSize,
  }), [appliedFilters, page, pageSize]);

  const membersQuery = useQuery<MembersQueryData>({
    queryKey: qk.members(memberQueryFilters),
    queryFn: async () => {
      if (!token) throw new Error('Sessão expirada.');
      const params = new URLSearchParams();
      Object.entries(memberQueryFilters).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') params.set(k, String(v));
      });
      const res = await fetch(`${apiBase}/members?${params.toString()}`, { headers: buildAuthHeaders(token) });
      if (!res.ok) throw new Error('Falha ao carregar membros.');
      const data = await res.json();
      const rows: MemberRecord[] = (Array.isArray(data) ? data : (data.data ?? [])).map((member: MemberRecord) => ({
        ...member,
        ecclesiasticalTitleId: member.ecclesiasticalTitleRef?.id || member.ecclesiasticalTitleId || '',
        churchName: member.church?.name || '',
        churchCode: member.church?.code || '',
        regionalName: member.church?.regional?.name || member.regional?.name || '',
        fieldName: member.church?.regional?.campo?.name || '',
      }));
      return {
        members: rows,
        total: data.total ?? rows.length,
        activeCount: data.activeCount ?? 0,
        inactiveCount: data.inactiveCount ?? 0,
        churchCount: data.churchCount ?? 0,
      };
    },
    enabled: !!token && !loadingFilters && appliedFilters !== null,
    placeholderData: (prev) => prev,
    staleTime: 5 * 60 * 1000,
  });

  // Refetch em background (trocou regional/igreja/filtro) — dados antigos ainda
  // na tela: mostra uma caixa de "Atualizando..." sem sumir com a lista.
  const isRefetching = membersQuery.isFetching && !loadingFilters && !loadingMembers;

  // Sync query result back to local state
  useEffect(() => {
    if (membersQuery.data) {
      setMembers(membersQuery.data.members);
      setServerTotal(membersQuery.data.total);
      setServerActiveCount(membersQuery.data.activeCount);
      setServerInactiveCount(membersQuery.data.inactiveCount);
      setServerChurchCount(membersQuery.data.churchCount);
      setLoadingMembers(false);
    } else if (membersQuery.isLoading) {
      setLoadingMembers(true);
    }
    if (membersQuery.error) {
      setError(membersQuery.error instanceof Error ? membersQuery.error.message : 'Erro ao carregar membros.');
      setLoadingMembers(false);
    }
  }, [membersQuery.data, membersQuery.isLoading, membersQuery.error]);

  // Log search actions
  useEffect(() => {
    if (debouncedSearch) {
      logClientAudit('read', `Pesquisou membros na secretaria por: "${debouncedSearch}"`, 'Lista de Membros');
    }
  }, [debouncedSearch]);

  // ── Legacy loadMembers useEffect (removed — replaced by TanStack Query above) ─

  // Busca TODOS os membros que batem com os filtros atuais (ignora a paginação
  // da tela), paginando a API. Usado por Exportar Excel e Imprimir — que devem
  // sempre trazer o total retornado pela query, não só a página exibida.
  const fetchAllMembers = useCallback(async (): Promise<MemberRecord[]> => {
    if (!token) throw new Error('Sessão expirada.');
    const FETCH_PAGE_SIZE = 5000;
    const baseParams = new URLSearchParams();
    Object.entries(memberQueryFilters).forEach(([k, v]) => {
      if (k === 'page' || k === 'pageSize') return;
      if (v !== undefined && v !== null && v !== '') baseParams.set(k, String(v));
    });
    baseParams.set('pageSize', String(FETCH_PAGE_SIZE));
    const all: MemberRecord[] = [];
    let pageNum = 1;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const params = new URLSearchParams(baseParams);
      params.set('page', String(pageNum));
      const res = await fetch(`${apiBase}/members?${params.toString()}`, { headers: buildAuthHeaders(token) });
      if (!res.ok) throw new Error('Falha ao carregar membros.');
      const data = await res.json();
      const pageRows: MemberRecord[] = (Array.isArray(data) ? data : (data.data ?? [])).map((member: MemberRecord) => ({
        ...member,
        ecclesiasticalTitleId: member.ecclesiasticalTitleRef?.id || member.ecclesiasticalTitleId || '',
        churchName: member.church?.name || '',
        churchCode: member.church?.code || '',
        regionalName: member.church?.regional?.name || member.regional?.name || '',
        fieldName: member.church?.regional?.campo?.name || '',
      }));
      all.push(...pageRows);
      const total = typeof data.total === 'number' ? data.total : all.length;
      if (pageRows.length < FETCH_PAGE_SIZE || all.length >= total) break;
      pageNum++;
    }
    return all;
  }, [token, memberQueryFilters]);

  const handleExportExcel = useCallback(async () => {
    try {
      setExportingExcel(true);
      setError('');
      logClientAudit('read', 'Exportou lista de membros para planilha Excel', 'Lista de Membros');
      const allMembers = await fetchAllMembers();
      const XLSX = await import('xlsx');
      const rows = allMembers.map((m) => ({
        'Nome': m.fullName,
        'ROL': m.rol ?? '',
        'Tipo': getMemberTypeLabel(m.memberType),
        'Título Eclesiástico': getTitleLabel(m),
        'Funções': (m.churchFunctions ?? []).map((f) => f.function?.name).filter(Boolean).join(', '),
        'Igreja': m.churchName || '',
        'Regional': m.regionalName || '',
        'Campo': m.fieldName || '',
        'Situação': m.membershipStatus || '',
        'Membro desde': m.membershipDate ? new Date(m.membershipDate).toLocaleDateString('pt-BR') : '',
        'Telefone': formatPhone(m.mobile || m.phone) || '',
        'Email': m.email || '',
        'CPF': formatCpf(m.cpf) || '',
        'Estado Civil': m.maritalStatus || '',
        'Cônjuge': m.spouseName || '',
        'Nascimento': m.birthDate ? new Date(m.birthDate).toLocaleDateString('pt-BR') : '',
        'Endereço': [m.addressStreet, m.addressNumber, m.addressNeighborhood].filter(Boolean).join(', '),
        'Cidade': m.addressCity || '',
        'UF': m.addressState || '',
        'CEP': m.addressZipcode || '',
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Membros');
      XLSX.writeFile(wb, `membros_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error(err);
      setError('Erro ao exportar planilha Excel.');
    } finally {
      setExportingExcel(false);
    }
  }, [fetchAllMembers]);

  const qc = useQueryClient();

  // Helper: update the current members cache key optimistically
  const patchMembersCache = useCallback((updater: (rows: MemberRecord[]) => MemberRecord[]) => {
    qc.setQueryData<MembersQueryData>(qk.members(memberQueryFilters), (old) =>
      old ? { ...old, members: updater(old.members) } : old
    );
  }, [qc, memberQueryFilters]);

  // After any mutation: silently refetch so cache matches DB
  const invalidateMembers = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['secretaria', 'members'] });
  }, [qc]);

  const handleSort = (nextSortKey: SortKey) => {
    if (sortKey === nextSortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection('asc');
  };

  const openEditor = (memberId: string) => {
    setEditorMemberId(memberId);
  };

  const closeEditor = () => {
    setEditorMemberId(null);
  };

  const closeQuickCreate = () => {
    setQuickCreateType(null);
  };

  const handleEditorSaved = (updated: any) => {
    if (!updated || !updated.id) return;
    const resolvedTitle = titles.find((title) => title.id === updated.ecclesiasticalTitleId);
    // 1. Optimistic cache update — screen refreshes instantly
    patchMembersCache((rows) =>
      rows.map((item) => {
        if (item.id !== updated.id) return item;
        return {
          ...item,
          ...updated,
          ecclesiasticalTitleRef: resolvedTitle
            ? { id: resolvedTitle.id, name: resolvedTitle.name, abbreviation: resolvedTitle.abbreviation, level: resolvedTitle.level }
            : item.ecclesiasticalTitleRef,
          churchName: item.churchName,
          churchCode: item.churchCode,
          regionalName: item.regionalName,
          fieldName: item.fieldName,
        };
      })
    );
    // 2. Silently refetch in background so IndexedDB + cache stay in sync with DB
    invalidateMembers();
  };

  const handleQuickCreated = (created: any) => {
    if (!created?.id) return;
    const newRow: MemberRecord = {
      ...created,
      ecclesiasticalTitleId: created.ecclesiasticalTitleRef?.id || created.ecclesiasticalTitleId || '',
      churchName: created.church?.name || filteredChurches.find((church) => church.id === created.churchId)?.name || '',
      churchCode: created.church?.code || filteredChurches.find((church) => church.id === created.churchId)?.code || '',
      regionalName: created.church?.regional?.name || '',
      fieldName: created.church?.regional?.campo?.name || '',
    };
    // 1. Optimistic: prepend to cache — tela atualiza na hora
    patchMembersCache((rows) => [newRow, ...rows]);
    // 2. Background refetch para sincronizar com banco
    invalidateMembers();
  };

  const requestDelete = (member: MemberRecord) => {
    setDeleteTarget(member);
  };

  const cancelDelete = () => {
    if (deleting) return;
    setDeleteTarget(null);
  };

  const confirmDelete = async (permanent: boolean) => {
    if (!token || !deleteTarget) return;

    // 1. Snapshot para rollback se o request falhar
    const snapshot = qc.getQueryData<MembersQueryData>(qk.members(memberQueryFilters));

    // 2. Remove da tela ANTES da resposta do servidor (optimistic)
    patchMembersCache((rows) => rows.filter((member) => member.id !== deleteTarget.id));
    setDeleteTarget(null);

    try {
      setDeleting(true);
      setError('');

      const url = permanent
        ? `${apiBase}/members/${deleteTarget.id}?permanent=true`
        : `${apiBase}/members/${deleteTarget.id}`;

      const response = await fetch(url, {
        method: 'DELETE',
        headers: buildAuthHeaders(token),
      });

      if (!response.ok) {
        const message = await response.json().catch(() => ({}));
        throw new Error(message.error || 'Falha ao excluir membro.');
      }

      // 3. Confirma exclusão: sincroniza cache com banco em background
      invalidateMembers();
    } catch (deleteError) {
      // 4. Rollback: restaura o membro na tela se o servidor recusou
      if (snapshot) qc.setQueryData(qk.members(memberQueryFilters), snapshot);
      setError(deleteError instanceof Error ? deleteError.message : 'Nao foi possivel excluir o membro.');
    } finally {
      setDeleting(false);
    }
  };

  // ── Interface (modelo "Lista de Membros v2") ─────────────────────────────
  // Só apresentação: os filtros continuam sendo o formulário de antes e a
  // consulta acontece só no Buscar (ou Enter na busca) — tirar um chip,
  // limpar ou clicar nos números só mexe no filtro.
  const statusAtual = selectedStatusFilters && selectedStatusFilters.length === 1 ? selectedStatusFilters[0] : null;
  const regionalNome = (id: string) => {
    const regional = regionais.find((item) => item.id === id);
    return regional ? `${regional.code ? `${regional.code} - ` : ''}${regional.name}` : id;
  };
  const igrejaNome = (id: string) => {
    const church = churches.find((item) => item.id === id);
    return church ? `${church.code ? `${church.code} - ` : ''}${church.name}` : id;
  };
  const tituloNome = (id: string) => titleFilterOptions.find((option) => option.value === id)?.label || id;
  const estadoCivilNome = (id: string) => maritalStatusFilterOptions.find((option) => option.value === id)?.label || id;
  const resumoLista = (ids: string[], nome: (id: string) => string, plural: string) =>
    ids.length === 1 ? nome(ids[0]) : `${ids.length} ${plural}`;

  const filtrosAtivos: Array<{ key: string; label: string; limpar?: () => void }> = [];
  if (selectedTypeFilter !== 'MEMBRO') {
    filtrosAtivos.push({
      key: 'Tipo',
      label: selectedTypeFilter === 'ALL' ? 'Todos os tipos' : selectedTypeFilter === 'PF' ? 'Pessoa física' : 'Pessoa jurídica',
      limpar: () => setSelectedTypeFilter('MEMBRO'),
    });
  }
  if (selectedRegionalIds?.length) {
    filtrosAtivos.push({
      key: 'Regional',
      label: resumoLista(selectedRegionalIds, regionalNome, 'regionais'),
      // Trocar a regional invalida a igreja escolhida (mesma regra do seletor).
      limpar: canChooseRegional ? () => { setSelectedRegionalIds(null); setSelectedChurchIds(null); } : undefined,
    });
  }
  if (selectedChurchIds?.length) {
    filtrosAtivos.push({
      key: 'Igreja',
      label: resumoLista(selectedChurchIds, igrejaNome, 'igrejas'),
      limpar: canChooseChurch ? () => setSelectedChurchIds(null) : undefined,
    });
  }
  if (selectedTitleFilters?.length) {
    filtrosAtivos.push({ key: 'Título', label: resumoLista(selectedTitleFilters, tituloNome, 'títulos'), limpar: () => setSelectedTitleFilters(null) });
  }
  if (selectedStatusFilters?.length) {
    filtrosAtivos.push({
      key: 'Situação',
      label: resumoLista(selectedStatusFilters, (id) => getMembershipStatusLabel(id as Exclude<MembershipStatusFilter, 'ALL'>), 'situações'),
      limpar: () => setSelectedStatusFilters(null),
    });
  }
  if (selectedMaritalStatusFilters?.length) {
    filtrosAtivos.push({ key: 'Estado civil', label: resumoLista(selectedMaritalStatusFilters, estadoCivilNome, 'estados civis'), limpar: () => setSelectedMaritalStatusFilters(null) });
  }

  const limparFiltros = () => {
    setSelectedTypeFilter('MEMBRO');
    if (canChooseRegional) setSelectedRegionalIds(null);
    if (canChooseChurch) setSelectedChurchIds(null);
    setSelectedTitleFilters(null);
    setSelectedStatusFilters(null);
    setSelectedMaritalStatusFilters(null);
  };

  // Perfil de igreja não pode tirar a própria regional/igreja: só aparece o
  // botão de limpar quando há algo que ele limpa de fato.
  const temFiltroLimpavel = filtrosAtivos.some((filtro) => filtro.limpar);

  // Chip de vários valores: "Todos" = null (sem filtro), como no seletor de antes.
  const alternarFiltro = (atual: string[] | null, valor: string) => {
    const base = atual ?? [];
    const proximo = base.includes(valor) ? base.filter((item) => item !== valor) : [...base, valor];
    return proximo.length ? proximo : null;
  };

  const podeNovo = pode('members.members.novo_membro') || pode('members.members.novo_pf') || pode('members.members.novo_pj');

  const statCards = [
    { label: 'Total', value: serverTotal, icon: Users, bg: 'bg-[#f1f5f9]', fg: 'text-[#334155]', status: '' },
    { label: 'Ativos', value: stats.activeMembers, icon: CheckCircle2, bg: 'bg-[#dcfce7]', fg: 'text-[#15803d]', status: 'ativo' },
    { label: 'Desligados', value: stats.inactiveMembers, icon: PauseCircle, bg: 'bg-[#fee2e2]', fg: 'text-[#b91c1c]', status: 'inativo' },
  ];

  const cabecalhos: Array<{ label: string; key?: SortKey; esconderMeio?: boolean; direita?: boolean }> = [
    { label: selectedTypeFilter === 'MEMBRO' ? 'Membro' : 'Nome', key: 'fullName' },
    { label: 'Contato', key: 'contact' },
    { label: 'Tipo', key: 'memberType', esconderMeio: true },
    { label: 'Título', key: 'ecclesiasticalTitle', esconderMeio: true },
    { label: 'Igreja', key: 'churchName' },
    { label: 'Status', key: 'membershipStatus' },
    { label: 'Desde', key: 'membershipDate', esconderMeio: true },
    { label: 'Ações', direita: true },
  ];

  const chipClasse = (ligado: boolean) =>
    `h-10 rounded-full border-[1.5px] px-4 text-sm font-semibold transition-all ${
      ligado
        ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
        : 'border-slate-200 bg-white text-slate-900 hover:border-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-white'
    }`;

  return (
    <div
      className="flex min-h-full flex-col bg-[#f4f6f8] text-slate-900 antialiased dark:bg-slate-900 dark:text-slate-100"
      style={{ fontFamily: FONTE_MODELO_FAMILIA }}
    >
      <style>{'@keyframes nmRowIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}@keyframes nmDrawerIn{from{transform:translateX(40px);opacity:0}to{transform:none;opacity:1}}@keyframes nmPopIn{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}'}</style>

      {/* Cabeçalho */}
      <header className="flex items-center justify-between gap-3 border-b border-[#e8ecf1] bg-white px-4 py-3 md:px-7 md:py-3.5 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-slate-100 text-slate-700 md:h-10 md:w-10 dark:bg-slate-700 dark:text-slate-200">
            <Users className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="hidden whitespace-nowrap text-xs text-slate-500 md:block dark:text-slate-400">Secretaria</span>
            <span className="whitespace-nowrap text-[17px] font-bold">Membros</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Permissao chave="members.members.imprimir" rotulo="Imprimir — Members" herda="members.view">
            <button
              type="button"
              onClick={() => setPrintModalOpen(true)}
              disabled={isAnyActionActive}
              title="Imprimir"
              className="flex h-10 items-center gap-2 whitespace-nowrap rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50 md:px-3.5 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {(printModalOpen || preparingPrint) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" strokeWidth={2} />}
              <span className="hidden md:inline">{preparingPrint ? 'Gerando...' : printModalOpen ? 'Carregando...' : 'Imprimir'}</span>
            </button>
          </Permissao>
          <Permissao chave="members.members.exportar_excel" rotulo="Exportar Excel — Members" herda="members.view">
            <button
              type="button"
              onClick={handleExportExcel}
              disabled={!visibleMembers.length || isAnyActionActive}
              title="Exportar Excel"
              className="flex h-10 items-center gap-2 whitespace-nowrap rounded-[10px] border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50 md:px-3.5 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {exportingExcel ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" strokeWidth={2} />}
              <span className="hidden md:inline">{exportingExcel ? 'Exportando...' : 'Exportar Excel'}</span>
            </button>
          </Permissao>
          {podeNovo && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setNovoMenuAberto((aberto) => !aberto)}
                disabled={isAnyActionActive}
                data-sem-permissao="só abre o menu; cada opção (membro, PF, PJ) tem a própria permissão"
                className="flex h-10 items-center gap-2 whitespace-nowrap rounded-[10px] bg-slate-900 pl-3 pr-3.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                {(isNavigatingNew || quickCreateType) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" strokeWidth={2.2} />}
                <span className="md:hidden">Novo</span>
                <span className="hidden md:inline">Novo cadastro</span>
                <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.2} />
              </button>
              {novoMenuAberto && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setNovoMenuAberto(false)} />
                  <div className="absolute right-0 top-12 z-40 flex w-[290px] animate-[nmPopIn_.18s_ease] flex-col gap-0.5 rounded-[18px] border border-[#e8ecf1] bg-white p-2 shadow-[0_20px_40px_-16px_rgba(15,23,42,.25)] dark:border-slate-700 dark:bg-slate-800">
                    <Permissao chave="members.members.novo_membro" rotulo="Novo Membro — Members" herda="members.view">
                      <button
                        type="button"
                        onClick={() => {
                          setNovoMenuAberto(false);
                          setIsNavigatingNew(true);
                          navigate('/app-ui/members/new');
                        }}
                        className="flex items-center gap-3 rounded-xl p-2.5 text-left hover:bg-[#f4f6f8] dark:hover:bg-slate-700"
                      >
                        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                          <UserPlus className="h-5 w-5" strokeWidth={1.8} />
                        </span>
                        <span className="flex flex-col gap-0.5">
                          <span className="text-sm font-bold">Novo membro</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">Cadastro completo, passo a passo</span>
                        </span>
                      </button>
                    </Permissao>
                    <Permissao chave="members.members.novo_pf" rotulo="Novo PF — Members" herda="members.view">
                      <button
                        type="button"
                        onClick={() => { setNovoMenuAberto(false); setQuickCreateType('PF'); }}
                        className="flex items-center gap-3 rounded-xl p-2.5 text-left hover:bg-[#f4f6f8] dark:hover:bg-slate-700"
                      >
                        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[#e0f2fe] text-[#075985]">
                          <UserRound className="h-5 w-5" strokeWidth={1.8} />
                        </span>
                        <span className="flex flex-col gap-0.5">
                          <span className="text-sm font-bold">Novo cadastro PF</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">Pessoa física sem vínculo de membro</span>
                        </span>
                      </button>
                    </Permissao>
                    <Permissao chave="members.members.novo_pj" rotulo="Novo PJ — Members" herda="members.view">
                      <button
                        type="button"
                        onClick={() => { setNovoMenuAberto(false); setQuickCreateType('PJ'); }}
                        className="flex items-center gap-3 rounded-xl p-2.5 text-left hover:bg-[#f4f6f8] dark:hover:bg-slate-700"
                      >
                        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[#ede9fe] text-[#5b21b6]">
                          <Building2 className="h-5 w-5" strokeWidth={1.8} />
                        </span>
                        <span className="flex flex-col gap-0.5">
                          <span className="text-sm font-bold">Novo cadastro PJ</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">Empresas, fornecedores e parceiros</span>
                        </span>
                      </button>
                    </Permissao>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="box-border flex w-full flex-1 flex-col gap-3 px-3 pb-10 pt-3 md:px-7 md:pt-4">
        {/* Busca + números */}
        <div className="flex flex-wrap items-stretch gap-3">
          <div className="flex min-w-0 flex-[1_1_380px] gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" strokeWidth={2} />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') handleSearchMembers(); }}
                placeholder="Nome, email, telefone, CPF, título ou igreja"
                className="h-full min-h-[52px] w-full rounded-2xl border-[1.5px] border-slate-200 bg-white pl-12 pr-3.5 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-900 focus:shadow-[0_0_0_4px_rgba(15,23,42,.08)] dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:focus:border-slate-300"
              />
            </div>
            <button
              type="button"
              onClick={() => setFiltrosAbertos(true)}
              title="Filtros"
              className={`flex min-h-[52px] flex-none items-center gap-2 rounded-2xl border-[1.5px] bg-white px-[15px] text-sm font-semibold text-slate-900 hover:border-slate-900 md:px-[18px] dark:bg-slate-800 dark:text-white ${
                filtrosAtivos.length ? 'border-slate-900 dark:border-slate-300' : 'border-slate-200 dark:border-slate-600'
              }`}
            >
              <SlidersHorizontal className="h-[19px] w-[19px]" strokeWidth={2} />
              <span className="hidden md:inline">Filtros</span>
              {filtrosAtivos.length > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-slate-900 px-1.5 text-[11px] font-bold text-white dark:bg-white dark:text-slate-900">
                  {filtrosAtivos.length}
                </span>
              )}
            </button>
            {temFiltroLimpavel && (
              <button
                type="button"
                onClick={limparFiltros}
                title="Limpar filtros (aplica no Buscar)"
                aria-label="Limpar filtros"
                className="grid min-h-[52px] w-[52px] flex-none place-items-center rounded-2xl border-[1.5px] border-slate-200 bg-white text-slate-600 hover:border-slate-900 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white"
              >
                <FilterX className="h-[19px] w-[19px]" strokeWidth={2} />
              </button>
            )}
            {/* Consulta explícita: nada é buscado até clicar aqui (ou Enter na busca). */}
            <button
              type="button"
              onClick={handleSearchMembers}
              disabled={membersQuery.isFetching}
              title="Buscar"
              className="flex min-h-[52px] flex-none items-center gap-2 rounded-2xl bg-slate-900 px-[15px] text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 md:px-[18px] dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {membersQuery.isFetching ? <Loader2 className="h-[19px] w-[19px] animate-spin" /> : <Search className="h-[19px] w-[19px]" strokeWidth={2.2} />}
              <span className="hidden md:inline">{membersQuery.isFetching ? 'Buscando...' : 'Buscar'}</span>
            </button>
          </div>
          <div className="flex min-w-0 flex-[1_1_auto] gap-2 overflow-x-auto">
            {statCards.map((card) => {
              const Icon = card.icon;
              const ligado = card.status ? statusAtual === card.status : !selectedStatusFilters?.length;
              return (
                <button
                  key={card.label}
                  type="button"
                  title={card.status ? `Filtrar só ${card.label.toLowerCase()} (aplica no Buscar)` : 'Todas as situações (aplica no Buscar)'}
                  onClick={() => {
                    // Só troca a situação no filtro — a consulta continua sendo só no Buscar.
                    setSelectedStatusFilters(card.status ? [card.status] : null);
                  }}
                  className={`flex flex-[1_0_auto] items-center gap-2.5 rounded-2xl border-[1.5px] bg-white py-2 pl-2 pr-3.5 text-left transition-colors hover:border-slate-900 dark:bg-slate-800 ${
                    ligado && hasSearched ? 'border-slate-900 dark:border-slate-300' : 'border-[#e8ecf1] dark:border-slate-700'
                  }`}
                >
                  <span className={`grid h-[38px] w-[38px] flex-none place-items-center rounded-xl ${card.bg} ${card.fg}`}>
                    <Icon className="h-[19px] w-[19px]" strokeWidth={1.8} />
                  </span>
                  <span className="flex flex-col">
                    {isLoadingScreen ? (
                      <SkeletonBlock className="my-0.5 h-5 w-10" />
                    ) : (
                      <span className="text-[19px] font-extrabold leading-[1.15] tracking-[-.02em]">{hasSearched ? card.value : '—'}</span>
                    )}
                    <span className="whitespace-nowrap text-xs font-semibold text-slate-500 dark:text-slate-400">{card.label}</span>
                  </span>
                </button>
              );
            })}
            <div className="flex flex-[1_0_auto] items-center gap-2.5 rounded-2xl border-[1.5px] border-[#e8ecf1] bg-white py-2 pl-2 pr-3.5 dark:border-slate-700 dark:bg-slate-800">
              <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-xl bg-[#e0e7ff] text-[#3730a3]">
                <Church className="h-[19px] w-[19px]" strokeWidth={1.8} />
              </span>
              <span className="flex flex-col">
                {isLoadingScreen ? (
                  <SkeletonBlock className="my-0.5 h-5 w-10" />
                ) : (
                  <span className="text-[19px] font-extrabold leading-[1.15] tracking-[-.02em]">{hasSearched ? stats.uniqueChurches : '—'}</span>
                )}
                <span className="whitespace-nowrap text-xs font-semibold text-slate-500 dark:text-slate-400">Igrejas</span>
              </span>
            </div>
          </div>
        </div>

        {loadingFilters ? (
          <p className="px-1 text-sm text-slate-500 dark:text-slate-400">Carregando opções dos filtros...</p>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        ) : null}

        {!hasSearched ? (
          <section className="flex flex-col items-center gap-1.5 rounded-[18px] border border-[#e8ecf1] bg-white px-6 py-14 text-center md:rounded-[22px] dark:border-slate-700 dark:bg-slate-800">
            <span className="mb-2 grid h-12 w-12 place-items-center rounded-2xl bg-[#f1f5f9] text-slate-500 dark:bg-slate-700 dark:text-slate-300">
              <Search className="h-6 w-6" strokeWidth={1.8} />
            </span>
            <span className="text-base font-bold">Ajuste os filtros e clique em Buscar</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">A lista carrega apenas os membros que você escolher.</span>
          </section>
        ) : (
          <section className="@container relative overflow-hidden rounded-[18px] border border-[#e8ecf1] bg-white md:rounded-[22px] dark:border-slate-700 dark:bg-slate-800">
            {isRefetching && (
              <div className="absolute inset-0 z-20 flex items-start justify-center bg-white/60 pt-24 backdrop-blur-[1px] dark:bg-slate-900/60">
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 shadow-md dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Atualizando lista...
                </div>
              </div>
            )}

            {/* Cabeçalho da tabela (some no celular, onde cada linha vira um cartão) */}
            <div className="hidden items-center gap-4 border-b border-[#eef2f6] bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-[.04em] text-slate-500 @3xl:grid @3xl:grid-cols-[minmax(200px,2fr)_minmax(170px,1.5fr)_minmax(150px,1.3fr)_150px_84px] @6xl:grid-cols-[minmax(220px,2.2fr)_minmax(180px,1.6fr)_80px_minmax(100px,.9fr)_minmax(160px,1.4fr)_150px_96px_84px] dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
              {cabecalhos.map((cab) => (
                <button
                  key={cab.label}
                  type="button"
                  onClick={() => cab.key && handleSort(cab.key)}
                  className={`items-center gap-1 text-left uppercase tracking-[.04em] ${cab.esconderMeio ? 'hidden @6xl:flex' : 'flex'} ${cab.direita ? 'justify-end' : ''} ${
                    cab.key ? 'cursor-pointer' : 'cursor-default'
                  } ${cab.key && cab.key === sortKey ? 'text-slate-900 dark:text-white' : ''}`}
                >
                  {cab.label}
                  {cab.key && cab.key === sortKey ? <span className="text-[11px]">{sortDirection === 'asc' ? '↑' : '↓'}</span> : null}
                </button>
              ))}
            </div>

            {isLoadingScreen ? (
              <div className="divide-y divide-[#f1f5f9] dark:divide-slate-700">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-3 px-5 py-3.5">
                    <SkeletonBlock className="h-[42px] w-[42px] rounded-full" />
                    <div className="flex-1 space-y-2">
                      <SkeletonBlock className="h-4 w-48" />
                      <SkeletonBlock className="h-3 w-32" />
                    </div>
                    <SkeletonBlock className="hidden h-6 w-20 rounded-full @3xl:block" />
                  </div>
                ))}
              </div>
            ) : paginatedMembers.length === 0 ? (
              <div className="flex flex-col items-center gap-1.5 px-6 py-14 text-center">
                <span className="text-base font-bold">Ninguém encontrado</span>
                <span className="text-sm text-slate-500 dark:text-slate-400">Tente outro nome ou remova algum filtro.</span>
              </div>
            ) : (
              paginatedMembers.map((member, index) => {
                const normalizedStatus = normalizeMembershipStatus(member.membershipStatus);
                const normalizedType = normalizeMemberType(member.memberType);
                const statusTom = STATUS_TOM[normalizedStatus] ?? STATUS_TOM.visitante;
                const tipoTom = TIPO_TOM[normalizedType];
                const documento = normalizedType === 'PJ' ? formatCnpj(member.cnpj) : formatCpf(member.cpf);
                const telefone = formatPhone(member.mobile || member.phone);
                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 border-t border-[#f1f5f9] px-3.5 py-3 transition-colors first:border-t-0 hover:bg-slate-50 @3xl:grid @3xl:grid-cols-[minmax(200px,2fr)_minmax(170px,1.5fr)_minmax(150px,1.3fr)_150px_84px] @3xl:gap-4 @3xl:px-5 @6xl:grid-cols-[minmax(220px,2.2fr)_minmax(180px,1.6fr)_80px_minmax(100px,.9fr)_minmax(160px,1.4fr)_150px_96px_84px] dark:border-slate-700 dark:hover:bg-slate-700/40"
                    style={{ animation: `nmRowIn .3s ease ${Math.min(index, 12) * 18}ms both` }}
                  >
                    <Link
                      to={`/app-ui/members/${member.id}`}
                      title="Abrir perfil do membro"
                      className="group flex min-w-0 flex-1 items-center gap-3"
                    >
                      <AvatarMembro key={member.photoUrl || 'sem-foto'} id={member.id} nome={member.fullName} foto={member.photoUrl} className="h-[42px] w-[42px] text-sm" />
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-[15px] font-bold group-hover:underline">{member.fullName}</span>
                        <span className="truncate text-xs text-slate-500 @3xl:hidden dark:text-slate-400">
                          {[normalizedType === 'MEMBRO' ? getTitleLabel(member) : getMemberTypeLabel(member.memberType), member.churchName].filter((v) => v && v !== '-').join(' · ')}
                        </span>
                        <span className="hidden truncate text-xs text-slate-500 @3xl:block dark:text-slate-400">
                          {[member.rol != null ? `ROL #${member.rol}` : '', documento].filter(Boolean).join(' · ') || '—'}
                        </span>
                      </span>
                    </Link>

                    <span className="hidden min-w-0 flex-col gap-1 text-[13px] text-slate-700 @3xl:flex dark:text-slate-300">
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <Phone className="h-3.5 w-3.5 flex-none text-slate-400" strokeWidth={2} />
                        {telefone || '—'}
                      </span>
                      <span className={`flex min-w-0 items-center gap-2 ${member.email ? '' : 'text-slate-400'}`}>
                        <Mail className="h-3.5 w-3.5 flex-none text-slate-400" strokeWidth={2} />
                        <span className="truncate">{member.email || '—'}</span>
                      </span>
                    </span>

                    <span className="hidden @6xl:flex">
                      <span className={`flex h-6 items-center rounded-lg px-[9px] text-xs font-bold ${tipoTom}`}>{getMemberTypeLabel(member.memberType)}</span>
                    </span>

                    <span className="hidden min-w-0 flex-col gap-1 @6xl:flex">
                      <span className="truncate text-[13px] text-slate-700 dark:text-slate-300">{getTitleLabel(member)}</span>
                      {member.churchFunctions && member.churchFunctions.length > 0 && (
                        <span className="flex flex-wrap gap-1">
                          {member.churchFunctions.map((f) => (
                            <span
                              key={f.id}
                              title={f.isCampoWide ? 'Função com alcance de campo' : 'Função na igreja'}
                              className="rounded-full border border-[#bbf7d0] bg-[#f0fdf4] px-1.5 py-0.5 text-[11px] font-medium text-[#15803d]"
                            >
                              {f.function?.name}{f.isCampoWide ? ' · Campo' : ''}
                            </span>
                          ))}
                        </span>
                      )}
                    </span>

                    <span className="hidden min-w-0 flex-col gap-0.5 @3xl:flex">
                      <span className="flex items-center gap-1.5 truncate text-[13px] font-semibold">
                        <MapPin className="h-3.5 w-3.5 flex-none text-slate-400" strokeWidth={2} />
                        <span className="truncate">{member.churchName || '—'}</span>
                      </span>
                      <span className="truncate pl-5 text-xs text-slate-500 dark:text-slate-400">
                        {[member.regionalName, member.fieldName].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </span>

                    <span className="hidden flex-none @3xl:flex">
                      <span className={`flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-bold ${statusTom}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {rotuloStatus(member.membershipStatus)}
                      </span>
                    </span>

                    {/* Celular: situação e ações ficam no ⋯ (a linha ganha espaço). */}
                    <button
                      type="button"
                      onClick={() => setMenuLinha(member)}
                      aria-label={`Opções de ${member.fullName}`}
                      className="grid h-9 w-9 flex-none place-items-center rounded-[10px] text-slate-500 hover:bg-slate-100 hover:text-slate-900 @3xl:hidden dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      <MoreHorizontal className="h-5 w-5" strokeWidth={2} />
                    </button>

                    <span className="hidden text-[13px] text-slate-700 @6xl:block dark:text-slate-300">
                      {member.membershipDate ? new Date(member.membershipDate).toLocaleDateString('pt-BR') : '—'}
                    </span>

                    <span className="hidden justify-end gap-1 @3xl:flex">
                      <Permissao chave="members.members.editar" rotulo="Editar — Members" herda="members.view">
                        <button
                          type="button"
                          onClick={() => openEditor(member.id)}
                          title="Editar"
                          className="grid h-9 w-9 place-items-center rounded-[10px] text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                        >
                          <Pencil className="h-[17px] w-[17px]" strokeWidth={2} />
                        </button>
                      </Permissao>
                      <Permissao chave="members.members.excluir" rotulo="Excluir — Members" herda="members.view">
                        <button
                          type="button"
                          onClick={() => requestDelete(member)}
                          title="Excluir"
                          className="grid h-9 w-9 place-items-center rounded-[10px] text-slate-400 hover:bg-red-100 hover:text-red-600"
                        >
                          <Trash2 className="h-[17px] w-[17px]" strokeWidth={2} />
                        </button>
                      </Permissao>
                    </span>
                  </div>
                );
              })
            )}

            {/* Rodapé: contagem, linhas por página e páginas */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eef2f6] px-5 py-3.5 text-[13px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <span>
                Exibindo {paginatedMembers.length ? (page - 1) * pageSize + 1 : 0} a {(page - 1) * pageSize + paginatedMembers.length} de {serverTotal} membros
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2">
                  <span className="hidden sm:inline">Linhas por página</span>
                  <span className="relative">
                    <select
                      value={pageSize}
                      onChange={(event) => setPageSize(Number(event.target.value))}
                      className="h-[34px] appearance-none rounded-[10px] border border-slate-200 bg-white pl-3 pr-8 text-[13px] font-semibold text-slate-700 outline-none focus:border-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {pageSizeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="h-[34px] rounded-[10px] border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 hover:border-slate-900 disabled:pointer-events-none disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  Anterior
                </button>
                <span className="flex h-[34px] min-w-[34px] items-center justify-center rounded-[10px] bg-slate-900 px-2.5 text-[13px] font-bold text-white dark:bg-white dark:text-slate-900">
                  {page}
                </span>
                <span className="text-[13px]">de {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page === totalPages}
                  className="h-[34px] rounded-[10px] border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 hover:border-slate-900 disabled:pointer-events-none disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                >
                  Próxima
                </button>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Painel de filtros — edita o mesmo formulário de antes; "Buscar" aplica. */}
      {filtrosAbertos && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setFiltrosAbertos(false)} />
          <aside className="relative flex h-full w-[min(440px,100%)] animate-[nmDrawerIn_.25s_ease] flex-col bg-white shadow-[-20px_0_50px_-20px_rgba(15,23,42,.35)] dark:bg-slate-800">
            <div className="flex items-center gap-3.5 border-b border-[#eef2f6] px-[22px] py-5 dark:border-slate-700">
              <span className="grid h-11 w-11 flex-none place-items-center rounded-[14px] bg-slate-900 text-white dark:bg-white dark:text-slate-900">
                <SlidersHorizontal className="h-[22px] w-[22px]" strokeWidth={2} />
              </span>
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="text-lg font-extrabold">Filtros</span>
                <span className="text-[13px] text-slate-500 dark:text-slate-400">Refine quem aparece na lista</span>
              </div>
              <button
                type="button"
                onClick={() => setFiltrosAbertos(false)}
                aria-label="Fechar"
                className="grid h-10 w-10 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden p-[22px]">
              <div className="flex flex-col gap-2.5">
                <span className="text-xs font-bold tracking-[.06em] text-slate-500 dark:text-slate-400">TIPO DE CADASTRO</span>
                <div className="flex flex-wrap gap-2">
                  {([['ALL', 'Todos'], ['MEMBRO', 'Membros'], ['PF', 'Pessoa física'], ['PJ', 'Pessoa jurídica']] as Array<[MemberTypeFilter, string]>).map(([valor, rotulo]) => (
                    <button key={valor} type="button" onClick={() => setSelectedTypeFilter(valor)} className={chipClasse(selectedTypeFilter === valor)}>
                      {rotulo}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <span className="text-xs font-bold tracking-[.06em] text-slate-500 dark:text-slate-400">SITUAÇÃO</span>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setSelectedStatusFilters(null)} className={chipClasse(!selectedStatusFilters?.length)}>
                    Todas
                  </button>
                  {(['ativo', 'inativo', 'aguardando', 'visitante'] as const).map((valor) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => setSelectedStatusFilters((atual) => alternarFiltro(atual, valor))}
                      className={chipClasse(!!selectedStatusFilters?.includes(valor))}
                    >
                      {getMembershipStatusLabel(valor)}
                    </button>
                  ))}
                </div>
              </div>

              {campoVisible && (
                <label className="flex flex-col gap-2.5 text-xs font-bold tracking-[.06em] text-slate-500 dark:text-slate-400">
                  CAMPO
                  <span className="relative min-w-0">
                    <select
                      value={selectedFieldId}
                      onChange={(event) => {
                        setSelectedFieldId(event.target.value);
                        // Trocar de campo invalida regional e igreja escolhidas.
                        setSelectedRegionalIds(null);
                        setSelectedChurchIds(null);
                      }}
                      disabled={!canChooseField || loadingFilters}
                      className="h-[50px] w-full appearance-none rounded-[14px] border-[1.5px] border-slate-200 bg-white pl-3.5 pr-10 text-[15px] font-medium tracking-normal text-slate-900 outline-none focus:border-slate-900 disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                    >
                      {!hasFixedChurchScope && <option value="">Todos os campos</option>}
                      {fields.map((field) => (
                        <option key={field.id} value={field.id}>
                          {field.code ? `${field.code} - ` : ''}
                          {field.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  </span>
                </label>
              )}

              <div className="flex flex-col gap-2.5">
                <span className="text-xs font-bold tracking-[.06em] text-slate-500 dark:text-slate-400">REGIONAL</span>
                <MultiSelectDropdown
                  searchable
                  options={filteredRegionais.map((regional) => ({
                    value: regional.id,
                    label: `${regional.code ? `${regional.code} - ` : ''}${regional.name}`,
                  }))}
                  value={selectedRegionalIds}
                  onChange={(next) => {
                    setSelectedRegionalIds(next);
                    // Trocar a regional invalida a igreja escolhida: ela pode nem
                    // pertencer mais as regionais selecionadas.
                    setSelectedChurchIds(null);
                  }}
                  allLabel="Todas as regionais"
                  disabled={!canChooseRegional || loadingFilters}
                />
              </div>

              <div className="flex flex-col gap-2.5">
                <span className="text-xs font-bold tracking-[.06em] text-slate-500 dark:text-slate-400">IGREJA</span>
                <MultiSelectDropdown
                  searchable
                  options={filteredChurches.map((church) => ({
                    value: church.id,
                    label: `${church.code ? `${church.code} - ` : ''}${church.name}`,
                  }))}
                  value={selectedChurchIds}
                  onChange={setSelectedChurchIds}
                  allLabel="Todas as igrejas"
                  disabled={!canChooseChurch || loadingFilters}
                />
              </div>

              <div className="flex flex-col gap-2.5">
                <span className="text-xs font-bold tracking-[.06em] text-slate-500 dark:text-slate-400">TÍTULO ECLESIÁSTICO</span>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setSelectedTitleFilters(null)} className={chipClasse(!selectedTitleFilters?.length)}>
                    Todos
                  </button>
                  {titleFilterOptions.filter((option) => option.value !== 'ALL').map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSelectedTitleFilters((atual) => alternarFiltro(atual, option.value))}
                      className={chipClasse(!!selectedTitleFilters?.includes(option.value))}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <span className="text-xs font-bold tracking-[.06em] text-slate-500 dark:text-slate-400">ESTADO CIVIL</span>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setSelectedMaritalStatusFilters(null)} className={chipClasse(!selectedMaritalStatusFilters?.length)}>
                    Todos
                  </button>
                  {maritalStatusFilterOptions.filter((option) => option.value !== 'ALL').map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSelectedMaritalStatusFilters((atual) => alternarFiltro(atual, option.value))}
                      className={chipClasse(!!selectedMaritalStatusFilters?.includes(option.value))}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 border-t border-[#eef2f6] px-[22px] py-4 dark:border-slate-700">
              <button
                type="button"
                onClick={limparFiltros}
                className="h-[52px] rounded-[14px] border border-slate-200 bg-white px-[18px] text-[15px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={() => { setFiltrosAbertos(false); handleSearchMembers(); }}
                className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[14px] bg-slate-900 text-[15px] font-bold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                <Search className="h-[18px] w-[18px]" strokeWidth={2.2} />
                Buscar
              </button>
            </div>
          </aside>
        </div>
      )}

      {menuLinha && (() => {
        const statusLinha = normalizeMembershipStatus(menuLinha.membershipStatus);
        const tipoLinha = normalizeMemberType(menuLinha.memberType);
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" style={{ fontFamily: FONTE_MODELO_FAMILIA }}>
            <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMenuLinha(null)} />
            <div className="relative w-full max-w-sm animate-[nmPopIn_.2s_ease] rounded-t-3xl bg-white p-4 pb-6 shadow-2xl sm:rounded-3xl sm:pb-4 dark:bg-slate-800 dark:text-slate-100">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 sm:hidden dark:bg-slate-600" />
              <div className="flex items-center gap-3 px-1">
                <AvatarMembro key={menuLinha.photoUrl || 'sem-foto'} id={menuLinha.id} nome={menuLinha.fullName} foto={menuLinha.photoUrl} className="h-11 w-11 text-sm" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="line-clamp-2 text-[15px] font-bold leading-tight">{menuLinha.fullName}</span>
                  <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {[menuLinha.rol != null ? `ROL #${menuLinha.rol}` : '', tipoLinha === 'PJ' ? formatCnpj(menuLinha.cnpj) : formatCpf(menuLinha.cpf)].filter(Boolean).join(' · ') || getMemberTypeLabel(menuLinha.memberType)}
                  </span>
                </span>
                <span className={`flex h-[26px] flex-none items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-bold ${STATUS_TOM[statusLinha] ?? STATUS_TOM.visitante}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {rotuloStatus(menuLinha.membershipStatus)}
                </span>
              </div>
              <div className="my-3 h-px bg-[#eef2f6] dark:bg-slate-700" />
              <div className="flex flex-col gap-0.5">
                <Link
                  to={`/app-ui/members/${menuLinha.id}`}
                  onClick={() => setMenuLinha(null)}
                  className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    <UserRound className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </span>
                  Ver ficha do membro
                </Link>
                <Permissao chave="members.members.editar" rotulo="Editar — Members" herda="members.view">
                  <button
                    type="button"
                    onClick={() => { const id = menuLinha.id; setMenuLinha(null); openEditor(id); }}
                    className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                      <Pencil className="h-[18px] w-[18px]" strokeWidth={1.8} />
                    </span>
                    Editar
                  </button>
                </Permissao>
                <Permissao chave="members.members.excluir" rotulo="Excluir — Members" herda="members.view">
                  <button
                    type="button"
                    onClick={() => { const alvo = menuLinha; setMenuLinha(null); requestDelete(alvo); }}
                    className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950/50">
                      <Trash2 className="h-[18px] w-[18px]" strokeWidth={1.8} />
                    </span>
                    Excluir
                  </button>
                </Permissao>
              </div>
            </div>
          </div>
        );
      })()}

      <MemberEditDrawer
        memberId={editorMemberId}
        open={!!editorMemberId}
        onClose={closeEditor}
        onSaved={handleEditorSaved}
        titles={titles}
      />

      <MemberQuickCreateModal
        open={!!quickCreateType}
        type={quickCreateType}
        initialChurchId={selectedChurchIds?.[0] || storedUser.churchId || filteredChurches[0]?.id || ''}
        availableChurches={filteredChurches.map((church) => ({ id: church.id, name: church.name, code: church.code || '' }))}
        lockChurchSelection={hasFixedChurchScope && Boolean(selectedChurchIds?.[0] || storedUser.churchId)}
        onClose={closeQuickCreate}
        onCreated={handleQuickCreated}
      />

      {deleteTarget ? (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/50" onClick={cancelDelete} />
          <div className="fixed left-1/2 top-1/2 z-50 w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-[#e8ecf1] bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900" style={{ fontFamily: FONTE_MODELO_FAMILIA }}>
            <div className="p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-red-100">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">Excluir membro</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    O que deseja fazer com <span className="font-semibold uppercase">{deleteTarget.fullName}</span>?
                  </p>
                  <div className="mt-4 space-y-2">
                    <div className="rounded-2xl border border-[#fde68a] bg-[#fffbeb] p-3">
                      <p className="text-sm font-semibold text-[#92400e]">Arquivar (soft delete)</p>
                      <p className="text-xs text-[#b45309] mt-0.5">O membro é desativado e ocultado das listas, mas todo o histórico de eventos e cards do pipeline é preservado.</p>
                    </div>
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-3">
                      <p className="text-sm font-semibold text-red-900">Excluir permanentemente</p>
                      <p className="text-xs text-red-700 mt-0.5">Remove o membro e apaga todo o histórico de eventos vinculado. Esta ação <strong>não pode ser desfeita</strong>.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-[#eef2f6] bg-white px-6 py-4 dark:border-slate-700 dark:bg-slate-900">
              <button
                type="button"
                onClick={cancelDelete}
                disabled={deleting}
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => confirmDelete(false)}
                disabled={deleting}
                className="h-11 rounded-xl border border-[#fbbf24] bg-[#fffbeb] px-4 text-sm font-semibold text-[#92400e] hover:bg-[#fef3c7] disabled:opacity-60"
              >
                {deleting ? 'Arquivando...' : 'Arquivar'}
              </button>
              <Permissao chave="members.members.excluir_tudo" rotulo="Excluir tudo — Members" herda="members.view">
                <button
                  type="button"
                  onClick={() => confirmDelete(true)}
                  disabled={deleting}
                  className="h-11 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {deleting ? 'Excluindo...' : 'Excluir tudo'}
                </button>
              </Permissao>
            </div>
          </div>
        </>
      ) : null}

      <PrintModal
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        showGroupBy
        sortOptions={[
          { value: 'fullName', label: 'Nome' },
          { value: 'memberType', label: 'Tipo' },
          { value: 'ecclesiasticalTitle', label: 'Título Eclesiástico' },
          { value: 'churchName', label: 'Igreja' },
          { value: 'membershipStatus', label: 'Situação' },
          { value: 'membershipDate', label: 'Membro desde' },
        ]}
        columnOptions={[
          { value: 'fullName', label: 'Nome' },
          { value: 'rol', label: 'Rol' },
          { value: 'memberType', label: 'Tipo' },
          { value: 'title', label: 'Título Eclesiástico' },
          { value: 'churchName', label: 'Igreja' },
          { value: 'regionalName', label: 'Regional' },
          { value: 'membershipStatus', label: 'Situação' },
          { value: 'membershipDate', label: 'Membro desde' },
          { value: 'phone', label: 'Telefone', defaultChecked: false },
          { value: 'email', label: 'E-mail', defaultChecked: false },
          { value: 'cpf', label: 'CPF', defaultChecked: false },
          { value: 'maritalStatus', label: 'Est. Civil', defaultChecked: false },
          { value: 'spouseName', label: 'Cônjuge', defaultChecked: false },
          { value: 'fatherName', label: 'Pai', defaultChecked: false },
          { value: 'motherName', label: 'Mãe', defaultChecked: false },
          { value: 'birthDate', label: 'Nascimento', defaultChecked: false },
          { value: 'addressStreet', label: 'Endereço', defaultChecked: false },
          { value: 'addressCity', label: 'Cidade', defaultChecked: false },
          { value: 'addressState', label: 'UF', defaultChecked: false },
          { value: 'addressZipcode', label: 'CEP', defaultChecked: false },
        ]}
        defaultSort="fullName"
        onPrint={async (orientation, sortBy, selectedColumns, groupByChurch) => {
          logClientAudit('read', 'Imprimiu relatório ou ficha de membros', 'Lista de Membros');
          // Imprime TODOS os membros do filtro atual (não só a página exibida).
          let allMembers: MemberRecord[];
          setPreparingPrint(true);
          try {
            allMembers = await fetchAllMembers();
          } catch (err) {
            console.error(err);
            setError('Erro ao preparar a impressão de todos os membros.');
            return;
          } finally {
            setPreparingPrint(false);
          }
          const sorted = [...allMembers].sort((a, b) =>
            String(a[sortBy as keyof typeof a] ?? '').localeCompare(String(b[sortBy as keyof typeof b] ?? ''), 'pt-BR')
          );
          const allCols = [
            { label: 'Nome', key: 'fullName' },
            { label: 'Rol', key: 'rol', width: '45px' },
            { label: 'Tipo', key: 'memberType', width: '55px' },
            { label: 'Título Eclesiástico', key: 'title', width: '110px' },
            { label: 'Igreja', key: 'churchName' },
            { label: 'Regional', key: 'regionalName', width: '100px' },
            { label: 'Situação', key: 'membershipStatus', width: '70px' },
            { label: 'Membro desde', key: 'membershipDate', width: '75px' },
            { label: 'Telefone', key: 'phone', width: '100px' },
            { label: 'E-mail', key: 'email' },
            { label: 'CPF', key: 'cpf', width: '90px' },
            { label: 'Est. Civil', key: 'maritalStatus', width: '70px' },
            { label: 'Cônjuge', key: 'spouseName' },
            { label: 'Pai', key: 'fatherName' },
            { label: 'Mãe', key: 'motherName' },
            { label: 'Nascimento', key: 'birthDate', width: '75px' },
            { label: 'Endereço', key: 'addressStreet' },
            { label: 'Cidade', key: 'addressCity', width: '90px' },
            { label: 'UF', key: 'addressState', width: '30px' },
            { label: 'CEP', key: 'addressZipcode', width: '65px' },
          ];
          const rows = sorted.map((m) => ({
            fullName: m.fullName,
            rol: m.rol != null ? String(m.rol) : '—',
            memberType: m.memberType || '—',
            title: m.ecclesiasticalTitleRef?.name || m.ecclesiasticalTitle || '—',
            churchName: m.churchName || '—',
            regionalName: m.regionalName || m.regional?.name || m.church?.regional?.name || '—',
            membershipStatus: m.membershipStatus || '—',
            membershipDate: m.membershipDate ? new Date(m.membershipDate).toLocaleDateString('pt-BR') : '—',
            phone: m.mobile || m.phone || '—',
            email: m.email || '—',
            cpf: m.cpf ? formatCpf(m.cpf) : '—',
            maritalStatus: m.maritalStatus || '—',
            spouseName: m.spouseName || '—',
            fatherName: m.fatherName || '—',
            motherName: m.motherName || '—',
            birthDate: m.birthDate ? new Date(m.birthDate).toLocaleDateString('pt-BR') : '—',
            addressStreet: [m.addressStreet, m.addressNumber, m.addressNeighborhood].filter(Boolean).join(', ') || '—',
            addressCity: m.addressCity || '—',
            addressState: m.addressState || '—',
            addressZipcode: m.addressZipcode || '—',
          }));
          printReport({
            title: 'Lista de Membros',
            orientation,
            columns: allCols.filter((c) => selectedColumns.includes(c.key)),
            rows,
            ...(groupByChurch ? { groupByKey: 'churchName', groupByLabel: 'Igreja' } : {}),
          });
        }}
      />
    </div>
  );
}