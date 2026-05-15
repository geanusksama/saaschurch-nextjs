import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  ArrowUpDown,
  Building2,
  CalendarDays,
  Camera,
  ChevronLeft,
  Columns3,
  Download,
  Eye,
  ExternalLink,
  Filter,
  Image as ImageIcon,
  MapPinned,
  Pencil,
  Plus,
  Printer,
  RotateCw,
  Search,
  Trash2,
  Upload,
  UserRound,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from '../ui/pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ConfirmDialog } from './shared/ConfirmDialog';
import { PrintModal } from './shared/PrintModal';
import { printReport } from '../../lib/printReport';

import { apiBase } from '../../lib/apiBase';

const initialFilters = {
  search: '',
  campoId: '',
  regionalId: '',
  state: '',
};

const initialChurchForm = {
  id: '',
  campoId: '',
  regionalId: '',
  currentLeaderName: '',
  leaderRoll: '',
  hash: '',
  parentChurchId: '',
  headquartersId: '',
  entryDate: '',
  exitDate: '',
  code: '',
  name: '',
  plateName: '',
  documentType: 'CNPJ',
  documentNumber: '',
  foundedAt: '',
  addressZipcode: '',
  addressCity: '',
  addressState: '',
  addressNeighborhood: '',
  addressStreet: '',
  addressComplement: '',
  latitude: '',
  longitude: '',
  hasOwnTemple: false,
  notes: '',
  status: 'active',
};

const initialContactForm = {
  id: '',
  type: 'Telefone',
  name: '',
  value: '',
  notes: '',
  isPrimary: false,
};

const initialFunctionForm = {
  id: '',
  memberId: '',
  functionId: '',
  department: '',
  startDate: '',
  endDate: '',
  isActive: true,
  notes: '',
};

const initialLeaderChangeForm = {
  id: '',
  functionId: '',
  memberId: '',
  indicatedBy: '',
  changeReason: '',
  entryDate: '',
  currentCash: '',
  averageIncome: '',
  averageExpense: '',
  maxIncome: '',
  totalMembers: '',
  totalWorkers: '',
  notes: '',
};

const initialRentForm = {
  id: '',
  city: '',
  address: '',
  amount: '',
  ownerName: '',
  ownerDocumentType: 'CPF',
  ownerDocumentNumber: '',
  paidAt: '',
  receiptUrl: '',
  notes: '',
  isActive: true,
};

const defaultVisibleColumns = {
  code: true,
  name: true,
  campo: true,
  regional: true,
  leader: true,
  city: true,
  state: true,
  status: true,
  actions: true,
};

const pageSizeOptions = [10, 25, 50, 100];
const detailPageSizeOptions = [5, 10, 20, 50];
const departmentSuggestions = ['Dirigência', 'Pastoral', 'Jovens', 'Adolescentes', 'CIBE', 'Infantil', 'Louvor', 'Intercessão'];

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function sortRows(rows, sortConfig) {
  const sorted = [...rows];
  sorted.sort((left, right) => {
    const leftValue = left[sortConfig.key] ?? '';
    const rightValue = right[sortConfig.key] ?? '';
    const comparison = String(leftValue).localeCompare(String(rightValue), 'pt-BR', {
      numeric: true,
      sensitivity: 'base',
    });

    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

function sortCollection(rows, sortConfig, accessorMap = {}) {
  const sorted = [...rows];
  sorted.sort((left, right) => {
    const accessor = accessorMap[sortConfig.key];
    const leftValue = accessor ? accessor(left) : left?.[sortConfig.key];
    const rightValue = accessor ? accessor(right) : right?.[sortConfig.key];

    if (leftValue === rightValue) return 0;
    if (leftValue == null || leftValue === '') return sortConfig.direction === 'asc' ? 1 : -1;
    if (rightValue == null || rightValue === '') return sortConfig.direction === 'asc' ? -1 : 1;

    const leftNumber = Number(leftValue);
    const rightNumber = Number(rightValue);
    const bothNumeric = Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && String(leftValue).trim() !== '' && String(rightValue).trim() !== '';

    const comparison = bothNumeric
      ? leftNumber - rightNumber
      : String(leftValue).localeCompare(String(rightValue), 'pt-BR', { numeric: true, sensitivity: 'base' });

    return sortConfig.direction === 'asc' ? comparison : -comparison;
  });

  return sorted;
}

function isDateWithinRange(value, from, to) {
  const current = toDateInputValue(value);
  if (!current) return !from && !to;
  if (from && current < from) return false;
  if (to && current > to) return false;
  return true;
}

function paginateRows(rows, page, pageSize) {
  const start = (page - 1) * pageSize;
  return rows.slice(start, start + pageSize);
}

function formatDateLabel(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR');
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '-';
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '-';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parsed);
}

function parseCurrencyInput(value) {
  if (value === null || value === undefined) return null;
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return null;
  return Number(digits) / 100;
}

function formatCurrencyInput(value) {
  const parsed = parseCurrencyInput(value);
  if (parsed === null) return '';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parsed);
}

function memberMatchesQuery(member, query) {
  const normalizedQuery = normalizeText(query).trim();
  if (!normalizedQuery) return true;
  if (/^\d+$/.test(normalizedQuery)) return String(member.rol || '') === normalizedQuery;
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  const parts = normalizeText(member.fullName || '').split(/\s+/).filter(Boolean);
  return terms.every((term) => parts.some((part) => part.startsWith(term)));
}

function buildGoogleMapsEmbedUrl(form) {
  const hasCoordinates = form.latitude && form.longitude;
  if (hasCoordinates) {
    return `https://www.google.com/maps?q=${encodeURIComponent(`${form.latitude},${form.longitude}`)}&z=16&output=embed`;
  }

  const address = [form.addressStreet, form.addressNeighborhood, form.addressCity, form.addressState, form.addressZipcode, 'Brasil']
    .filter(Boolean)
    .join(', ')
    .trim();

  return address ? `https://www.google.com/maps?q=${encodeURIComponent(address)}&z=15&output=embed` : '';
}

function buildGoogleMapsLink(form) {
  const hasCoordinates = form.latitude && form.longitude;
  if (hasCoordinates) {
    return `https://www.google.com/maps?q=${encodeURIComponent(`${form.latitude},${form.longitude}`)}`;
  }

  const address = [form.addressStreet, form.addressNeighborhood, form.addressCity, form.addressState, form.addressZipcode, 'Brasil']
    .filter(Boolean)
    .join(', ')
    .trim();

  return address ? `https://www.google.com/maps?q=${encodeURIComponent(address)}` : '';
}

function normalizeZipcode(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 8);
}

function formatZipcode(value) {
  const digits = normalizeZipcode(value);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function buildAddressSearchLabel(source) {
  return [
    source?.addressStreet,
    source?.addressNeighborhood,
    source?.addressCity,
    source?.addressState,
    source?.addressZipcode,
    'Brasil',
  ]
    .filter(Boolean)
    .join(', ')
    .trim();
}

function buildLocationPreviewUrl(locationSearch, preview, form) {
  if (preview?.lat && preview?.lon) {
    return `https://www.google.com/maps?q=${encodeURIComponent(`${preview.lat},${preview.lon}`)}&z=16&output=embed`;
  }

  if (locationSearch?.trim()) {
    return `https://www.google.com/maps?q=${encodeURIComponent(locationSearch.trim())}&z=15&output=embed`;
  }

  return buildGoogleMapsEmbedUrl(form);
}

function toDateInputValue(value) {
  if (!value) {
    return '';
  }

  return String(value).slice(0, 10);
}

function getStoredFieldContext() {
  try {
    const raw = localStorage.getItem('mrm_selected_context');
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (parsed?.level === 'field' && parsed?.id) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

function SwitchField({ checked, onChange, label, alignEnd = false }) {
  return (
    <label className={`flex items-center gap-3 ${alignEnd ? 'justify-end' : ''}`}>
      <button
        type="button"
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 items-center rounded-full transition ${checked ? 'bg-slate-900 dark:bg-slate-100' : 'bg-slate-300 dark:bg-slate-700'}`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white transition dark:bg-slate-950 ${checked ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
    </label>
  );
}

function SectionCard({ title, description, actions, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800">
        <div>
          <h3 className="text-[28px] font-semibold tracking-tight text-slate-950 dark:text-slate-50">{title}</h3>
          {description ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
        </div>
        {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

const labelClass = 'flex flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200';
const fieldClass = 'rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-slate-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-slate-500';
const mutedPanelClass = 'rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60';
const secondaryButtonClass = 'rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900';
const dialogContentClass = 'border border-slate-200 bg-white p-0 dark:border-slate-800 dark:bg-slate-950';

export function Churches() {
  const token = localStorage.getItem('mrm_token');
  const selectedFieldContext = getStoredFieldContext();
  const selectedFieldId = selectedFieldContext?.id || localStorage.getItem('mrm_active_field_id') || '';
  const selectedFieldName = selectedFieldContext?.name || localStorage.getItem('mrm_active_field_name') || '';

  const [churches, setChurches] = useState([]);
  const [campos, setCampos] = useState([]);
  const [regionais, setRegionais] = useState([]);
  const [headquarters, setHeadquarters] = useState([]);
  const [functionCatalog, setFunctionCatalog] = useState([]);
  const [churchMembers, setChurchMembers] = useState([]);
  const [churchContacts, setChurchContacts] = useState([]);
  const [churchFunctions, setChurchFunctions] = useState([]);
  const [leaderHistory, setLeaderHistory] = useState([]);
  const [churchPhotos, setChurchPhotos] = useState([]);
  const [rentRecords, setRentRecords] = useState([]);
  const [filters, setFilters] = useState(() => ({ ...initialFilters, campoId: selectedFieldId }));
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [visibleColumns, setVisibleColumns] = useState(defaultVisibleColumns);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [viewMode, setViewMode] = useState('list');
  const [activeTab, setActiveTab] = useState('dados');
  const [form, setForm] = useState(initialChurchForm);
  const [contactForm, setContactForm] = useState(initialContactForm);
  const [functionForm, setFunctionForm] = useState(initialFunctionForm);
  const [leaderChangeForm, setLeaderChangeForm] = useState(initialLeaderChangeForm);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingChurch, setSavingChurch] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [savingFunction, setSavingFunction] = useState(false);
  const [savingLeaderChange, setSavingLeaderChange] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [functionModalOpen, setFunctionModalOpen] = useState(false);
  const [leaderModalOpen, setLeaderModalOpen] = useState(false);
  const [rentModalOpen, setRentModalOpen] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<null | { title: string; message: string; onConfirm: () => Promise<void> | void; loading?: boolean }>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [contactSearch, setContactSearch] = useState('');
  const [contactSortConfig, setContactSortConfig] = useState({ key: 'type', direction: 'asc' });
  const [contactPage, setContactPage] = useState(1);
  const [contactPageSize, setContactPageSize] = useState(5);
  const [leaderSearch, setLeaderSearch] = useState('');
  const [leaderDateFrom, setLeaderDateFrom] = useState('');
  const [leaderDateTo, setLeaderDateTo] = useState('');
  const [leaderSortConfig, setLeaderSortConfig] = useState({ key: 'entryDate', direction: 'desc' });
  const [leaderPage, setLeaderPage] = useState(1);
  const [leaderPageSize, setLeaderPageSize] = useState(5);
  const [leaderHistoryDetails, setLeaderHistoryDetails] = useState(null);
  const [functionSearch, setFunctionSearch] = useState('');
  const [functionDateFrom, setFunctionDateFrom] = useState('');
  const [functionDateTo, setFunctionDateTo] = useState('');
  const [functionStatusFilter, setFunctionStatusFilter] = useState('all');
  const [functionSortConfig, setFunctionSortConfig] = useState({ key: 'startDate', direction: 'desc' });
  const [functionPage, setFunctionPage] = useState(1);
  const [functionPageSize, setFunctionPageSize] = useState(5);
  const [rentSearch, setRentSearch] = useState('');
  const [rentDateFrom, setRentDateFrom] = useState('');
  const [rentDateTo, setRentDateTo] = useState('');
  const [rentSortConfig, setRentSortConfig] = useState({ key: 'paidAt', direction: 'desc' });
  const [rentPage, setRentPage] = useState(1);
  const [rentPageSize, setRentPageSize] = useState(5);
  const [rentForm, setRentForm] = useState(initialRentForm);
  const [savingRent, setSavingRent] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoZoom, setPhotoZoom] = useState(1);
  const [photoRotation, setPhotoRotation] = useState(0);
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [memberPickerTarget, setMemberPickerTarget] = useState('leader');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearchPerformed, setMemberSearchPerformed] = useState(false);
  const [memberSearchLoading, setMemberSearchLoading] = useState(false);
  const [memberSearchResults, setMemberSearchResults] = useState([]);
  const [activeMemberIndex, setActiveMemberIndex] = useState(0);
  const [selectedLeaderMemberState, setSelectedLeaderMemberState] = useState(null);
  const [selectedFunctionMemberState, setSelectedFunctionMemberState] = useState(null);
  const [zipcodeLookupLoading, setZipcodeLookupLoading] = useState(false);
  const [locationHelperOpen, setLocationHelperOpen] = useState(false);
  const [locationSearch, setLocationSearch] = useState('');
  const [locationSearchResults, setLocationSearchResults] = useState([]);
  const [locationSearchLoading, setLocationSearchLoading] = useState(false);
  const [selectedLocationPreview, setSelectedLocationPreview] = useState(null);
  const memberOptionRefs = useRef([]);

  const createInitialChurchForm = () => ({
    ...initialChurchForm,
    campoId: selectedFieldId || '',
    headquartersId: headquarters[0]?.id || '',
  });

  const fetchJson = async (path, options = {}, config = {}) => {
    const { requiresAuth = false, allowUnauthorized = false } = config;
    const headers = {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
      ...(requiresAuth && token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const message = await response.json().catch(() => ({}));
      if (allowUnauthorized && (response.status === 401 || response.status === 403)) {
        return null;
      }
      if (requiresAuth && (response.status === 401 || response.status === 403)) {
        throw new Error('Sessao expirada. Faca login novamente.');
      }
      throw new Error(message.error || 'Falha na requisicao.');
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  };

  const loadBaseData = async () => {
    try {
      setLoading(true);
      setError('');

      const queryString = selectedFieldId ? `?fieldId=${encodeURIComponent(selectedFieldId)}` : '';

      const requests = [
        fetchJson(`/churches${queryString}`, {}, { requiresAuth: true }),
        fetchJson('/campos'),
        fetchJson(`/regionais${queryString}`, {}, { requiresAuth: true }),
      ];

      if (token) {
        requests.push(fetchJson(`/headquarters${queryString}`, {}, { requiresAuth: true }));
      } else {
        requests.push(Promise.resolve([]));
      }

      if (token) {
        requests.push(fetchJson('/church-functions/catalog', {}, { requiresAuth: true, allowUnauthorized: true }));
      } else {
        requests.push(Promise.resolve([]));
      }

      const [churchesData, camposData, regionaisData, headquartersData, functionCatalogData] = await Promise.all(requests);
      setChurches(churchesData);
      setCampos(camposData);
      setRegionais(regionaisData);
      setHeadquarters(headquartersData || []);
      setFunctionCatalog(functionCatalogData || []);
    } catch (loadError) {
      setError(loadError.message || 'Falha ao carregar a base de igrejas.');
    } finally {
      setLoading(false);
    }
  };

  const loadChurchWorkspace = async (churchId) => {
    if (!churchId) {
      setChurchMembers([]);
      setChurchContacts([]);
      setChurchFunctions([]);
      setLeaderHistory([]);
      setChurchPhotos([]);
      setRentRecords([]);
      return;
    }

    try {
      setDetailLoading(true);
      setDetailError('');

      const [churchDetail, contactsData, functionsData, leaderHistoryData, membersData, photosData, rentData] = await Promise.all([
        fetchJson(`/churches/${churchId}/detail`, {}, { requiresAuth: true }),
        fetchJson(`/churches/${churchId}/contacts`, {}, { requiresAuth: true }),
        fetchJson(`/churches/${churchId}/functions`, {}, { requiresAuth: true }),
        fetchJson(`/churches/${churchId}/leader-history`, {}, { requiresAuth: true }),
        fetchJson(`/churches/${churchId}/members`, {}, { requiresAuth: true }),
        fetchJson(`/churches/${churchId}/photos`, {}, { requiresAuth: true, allowUnauthorized: true }),
        fetchJson(`/churches/${churchId}/rent-records`, {}, { requiresAuth: true, allowUnauthorized: true }),
      ]);

      setForm({
        id: churchDetail.id,
        campoId: churchDetail.regional?.campo?.id || '',
        regionalId: churchDetail.regionalId || '',
        currentLeaderName: churchDetail.currentLeaderName || '',
        leaderRoll: churchDetail.leaderRoll || '',
        hash: churchDetail.hash || '',
        parentChurchId: churchDetail.parentChurchId || '',
        headquartersId: churchDetail.headquartersId || '',
        entryDate: toDateInputValue(churchDetail.entryDate),
        exitDate: toDateInputValue(churchDetail.exitDate),
        code: churchDetail.code || '',
        name: churchDetail.name || '',
        plateName: churchDetail.plateName || '',
        documentType: churchDetail.documentType || 'CNPJ',
        documentNumber: churchDetail.documentNumber || '',
        foundedAt: toDateInputValue(churchDetail.foundedAt),
        addressZipcode: churchDetail.addressZipcode || '',
        addressCity: churchDetail.addressCity || '',
        addressState: churchDetail.addressState || '',
        addressNeighborhood: churchDetail.addressNeighborhood || '',
        addressStreet: churchDetail.addressStreet || '',
        addressComplement: churchDetail.addressComplement || '',
        latitude: churchDetail.latitude ? String(churchDetail.latitude) : '',
        longitude: churchDetail.longitude ? String(churchDetail.longitude) : '',
        hasOwnTemple: Boolean(churchDetail.hasOwnTemple),
        notes: churchDetail.notes || '',
        status: churchDetail.status || 'active',
      });
      setChurchContacts(contactsData);
      setChurchFunctions(functionsData);
      setLeaderHistory(leaderHistoryData);
      setChurchMembers(membersData);
      setChurchPhotos(photosData || []);
      setRentRecords(rentData || []);
    } catch (workspaceError) {
      setDetailError(workspaceError.message || 'Falha ao carregar os dados da igreja.');
    } finally {
      setDetailLoading(false);
    }
  };

  const applyLocationCandidate = (candidate) => {
    if (!candidate) return;

    setSelectedLocationPreview(candidate);
    setForm((current) => ({
      ...current,
      latitude: String(candidate.lat ?? ''),
      longitude: String(candidate.lon ?? ''),
      addressStreet: current.addressStreet || candidate.street || '',
      addressNeighborhood: current.addressNeighborhood || candidate.neighborhood || '',
      addressCity: current.addressCity || candidate.city || '',
      addressState: current.addressState || candidate.state || '',
      addressZipcode: current.addressZipcode || formatZipcode(candidate.zipcode || ''),
    }));
    setLocationHelperOpen(false);
  };

  const lookupZipcode = async () => {
    const zipcode = normalizeZipcode(form.addressZipcode);
    if (zipcode.length !== 8) {
      setDetailError('Informe um CEP válido com 8 dígitos para pesquisar.');
      return;
    }

    try {
      setZipcodeLookupLoading(true);
      setDetailError('');

      const response = await fetch(`https://viacep.com.br/ws/${zipcode}/json/`);
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload?.erro) {
        throw new Error('CEP não encontrado.');
      }

      setForm((current) => ({
        ...current,
        addressZipcode: formatZipcode(zipcode),
        addressStreet: payload.logradouro || current.addressStreet,
        addressNeighborhood: payload.bairro || current.addressNeighborhood,
        addressCity: payload.localidade || current.addressCity,
        addressState: String(payload.uf || current.addressState || '').toUpperCase(),
        addressComplement: current.addressComplement || payload.complemento || '',
      }));

      const nextSearch = [payload.logradouro, payload.bairro, payload.localidade, payload.uf, formatZipcode(zipcode), 'Brasil']
        .filter(Boolean)
        .join(', ');
      setLocationSearch(nextSearch);
    } catch (zipcodeError) {
      setDetailError(zipcodeError.message || 'Falha ao consultar CEP.');
    } finally {
      setZipcodeLookupLoading(false);
    }
  };

  const searchLocationCandidates = async (customQuery) => {
    const query = String(customQuery || locationSearch || buildAddressSearchLabel(form)).trim();
    if (!query) {
      setDetailError('Informe um endereço ou CEP para localizar no mapa.');
      return;
    }

    try {
      setLocationSearchLoading(true);
      setDetailError('');
      setLocationSearch(query);

      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&countrycodes=br&q=${encodeURIComponent(query)}`);
      const payload = await response.json().catch(() => []);

      if (!response.ok) {
        throw new Error('Falha ao pesquisar endereço.');
      }

      const results = Array.isArray(payload)
        ? payload.map((item) => ({
            id: item.place_id,
            label: item.display_name,
            lat: item.lat,
            lon: item.lon,
            street: [item.address?.road, item.address?.house_number].filter(Boolean).join(', '),
            neighborhood: item.address?.suburb || item.address?.neighbourhood || item.address?.quarter || '',
            city: item.address?.city || item.address?.town || item.address?.village || item.address?.municipality || '',
            state: item.address?.state_code || item.address?.state || '',
            zipcode: item.address?.postcode || '',
          }))
        : [];

      setLocationSearchResults(results);
      setSelectedLocationPreview(results[0] || null);

      if (!results.length) {
        setDetailError('Nenhum endereço encontrado para essa busca.');
      }
    } catch (locationError) {
      setLocationSearchResults([]);
      setSelectedLocationPreview(null);
      setDetailError(locationError.message || 'Falha ao localizar endereço.');
    } finally {
      setLocationSearchLoading(false);
    }
  };

  const openLocationHelper = async () => {
    const initialQuery = buildAddressSearchLabel(form);
    setLocationHelperOpen(true);
    setLocationSearch(initialQuery);
    setLocationSearchResults([]);
    setSelectedLocationPreview(form.latitude && form.longitude ? { lat: form.latitude, lon: form.longitude, label: initialQuery } : null);

    if (initialQuery) {
      await searchLocationCandidates(initialQuery);
    }
  };

  useEffect(() => {
    loadBaseData();
  }, [selectedFieldId, token]);

  useEffect(() => {
    if (!selectedFieldId) {
      return;
    }

    setFilters((current) => {
      if (current.campoId === selectedFieldId) {
        return current;
      }

      return {
        ...current,
        campoId: selectedFieldId,
        regionalId: '',
      };
    });
  }, [selectedFieldId]);

  useEffect(() => {
    if (viewMode !== 'detail' || form.id) {
      return;
    }

    setForm((current) => {
      const nextCampoId = current.campoId || selectedFieldId || '';
      const nextHeadquartersId = current.headquartersId || headquarters[0]?.id || '';

      if (nextCampoId === current.campoId && nextHeadquartersId === current.headquartersId) {
        return current;
      }

      return {
        ...current,
        campoId: nextCampoId,
        headquartersId: nextHeadquartersId,
      };
    });
  }, [form.id, headquarters, selectedFieldId, viewMode]);

  const campoById = useMemo(() => new Map(campos.map((campo) => [campo.id, campo])), [campos]);
  const regionalById = useMemo(() => new Map(regionais.map((regional) => [regional.id, regional])), [regionais]);

  const filteredRegionais = useMemo(() => {
    if (!filters.campoId) {
      return regionais;
    }

    return regionais.filter((regional) => regional.campoId === filters.campoId);
  }, [filters.campoId, regionais]);

  const formRegionais = useMemo(() => {
    if (!form.campoId) {
      return [];
    }

    return regionais.filter((regional) => regional.campoId === form.campoId);
  }, [form.campoId, regionais]);

  const availableHeadquarters = useMemo(() => {
    if (!form.campoId) {
      return headquarters;
    }

    return headquarters.filter((item) => item.fieldId === form.campoId);
  }, [form.campoId, headquarters]);

  const enrichedChurches = useMemo(() => {
    return churches.map((church) => {
      const regional = regionalById.get(church.regionalId);
      const campo = regional ? campoById.get(regional.campoId) : null;

      return {
        ...church,
        campoName: campo?.name || '-',
        campoId: campo?.id || '',
        regionalName: regional?.name || '-',
        headquartersName: church.headquarters?.churchName || '-',
        city: church.addressCity || '-',
        state: church.addressState || '-',
        leader: church.currentLeaderName || '-',
        statusLabel: church.status === 'inactive' ? 'Inativa' : 'Ativa',
      };
    });
  }, [campoById, churches, regionalById]);

  const filteredChurches = useMemo(() => {
    const query = normalizeText(filters.search);

    return enrichedChurches.filter((church) => {
      if (filters.campoId && church.campoId !== filters.campoId) {
        return false;
      }
      if (filters.regionalId && church.regionalId !== filters.regionalId) {
        return false;
      }
      if (filters.state && normalizeText(church.state) !== normalizeText(filters.state)) {
        return false;
      }
      if (!query) {
        return true;
      }

      return [church.code, church.name, church.campoName, church.regionalName, church.leader, church.city, church.state]
        .map(normalizeText)
        .join(' ')
        .includes(query);
    });
  }, [enrichedChurches, filters]);

  const sortedChurches = useMemo(() => sortRows(filteredChurches, sortConfig), [filteredChurches, sortConfig]);
  const totalPages = Math.max(1, Math.ceil(sortedChurches.length / pageSize));
  const paginatedChurches = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedChurches.slice(start, start + pageSize);
  }, [page, pageSize, sortedChurches]);

  useEffect(() => {
    setPage(1);
  }, [filters, pageSize, sortConfig]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const openNewChurch = () => {
    setViewMode('detail');
    setActiveTab('dados');
    setDetailError('');
    setChurchMembers([]);
    setChurchContacts([]);
    setChurchFunctions([]);
    setLeaderHistory([]);
    setForm(createInitialChurchForm());
  };

  const openChurchDetail = async (churchId) => {
    setViewMode('detail');
    setActiveTab('dados');
    await loadChurchWorkspace(churchId);
  };

  const backToList = async () => {
    setViewMode('list');
    setActiveTab('dados');
    setForm(createInitialChurchForm());
    setDetailError('');
    await loadBaseData();
  };

  const saveChurch = async () => {
    try {
      setSavingChurch(true);
      setDetailError('');

      if (!form.campoId || !form.regionalId || !form.code || !form.name) {
        throw new Error('Campo, regional, codigo e nome completo sao obrigatorios.');
      }

      const payload = {
        regionalId: form.regionalId,
        currentLeaderName: form.currentLeaderName || undefined,
        leaderRoll: form.leaderRoll || undefined,
        hash: form.hash || undefined,
        parentChurchId: form.parentChurchId || undefined,
        headquartersId: form.headquartersId || undefined,
        entryDate: form.entryDate || undefined,
        exitDate: form.exitDate || undefined,
        code: form.code.trim(),
        name: form.name.trim(),
        legalName: form.name.trim(),
        plateName: form.plateName || undefined,
        documentType: form.documentType || undefined,
        documentNumber: form.documentNumber || undefined,
        foundedAt: form.foundedAt || undefined,
        addressZipcode: form.addressZipcode || undefined,
        addressCity: form.addressCity || undefined,
        addressState: form.addressState || undefined,
        addressNeighborhood: form.addressNeighborhood || undefined,
        addressStreet: form.addressStreet || undefined,
        addressComplement: form.addressComplement || undefined,
        latitude: form.latitude ? Number(form.latitude) : undefined,
        longitude: form.longitude ? Number(form.longitude) : undefined,
        hasOwnTemple: form.hasOwnTemple,
        notes: form.notes || undefined,
        status: form.status,
      };

      const result = await fetchJson(
        form.id ? `/churches/${form.id}` : '/churches',
        {
          method: form.id ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        },
        { requiresAuth: true }
      );

      await loadBaseData();
      await loadChurchWorkspace(result.id);
      setActiveTab('dados');
      toast.success(form.id ? 'Igreja atualizada com sucesso.' : 'Igreja criada com sucesso.');
    } catch (saveError) {
      setDetailError(saveError.message || 'Falha ao salvar igreja.');
      toast.error(saveError.message || 'Falha ao salvar igreja.');
    } finally {
      setSavingChurch(false);
    }
  };

  const deleteChurch = async (church) => {
    setPendingConfirm({
      title: 'Excluir igreja',
      message: `Deseja realmente excluir a igreja "${church.name}"? Esta ação não pode ser desfeita.`,
      onConfirm: async () => {
        try {
          setError('');
          await fetchJson(`/churches/${church.id}`, { method: 'DELETE' }, { requiresAuth: true });
          await loadBaseData();
        } catch (deleteError) {
          setError(deleteError.message || 'Falha ao excluir igreja.');
        }
      },
    });
  };

  const openContactModal = (contact = null) => {
    setContactForm(
      contact
        ? {
            id: contact.id,
            type: contact.type || 'Telefone',
            name: contact.name || '',
            value: contact.value || '',
            notes: contact.notes || '',
            isPrimary: Boolean(contact.isPrimary),
          }
        : { ...initialContactForm }
    );
    setContactModalOpen(true);
  };

  const saveContact = async () => {
    try {
      setSavingContact(true);
      setDetailError('');
      if (!form.id) {
        throw new Error('Salve a igreja antes de cadastrar contatos.');
      }

      if (!contactForm.type || !contactForm.value) {
        throw new Error('Tipo e valor do contato sao obrigatorios.');
      }

      await fetchJson(
        contactForm.id ? `/church-contacts/${contactForm.id}` : `/churches/${form.id}/contacts`,
        {
          method: contactForm.id ? 'PATCH' : 'POST',
          body: JSON.stringify(contactForm),
        },
        { requiresAuth: true }
      );

      setContactModalOpen(false);
      setContactForm({ ...initialContactForm });
      await loadChurchWorkspace(form.id);
    } catch (contactError) {
      setDetailError(contactError.message || 'Falha ao salvar contato.');
    } finally {
      setSavingContact(false);
    }
  };

  const removeContact = async (contact) => {
    setPendingConfirm({
      title: 'Excluir contato',
      message: `Excluir o contato "${contact.type} — ${contact.value}"?`,
      onConfirm: async () => {
        try {
          await fetchJson(`/church-contacts/${contact.id}`, { method: 'DELETE' }, { requiresAuth: true });
          await loadChurchWorkspace(form.id);
        } catch (contactError) {
          setDetailError(contactError.message || 'Falha ao excluir contato.');
        }
      },
    });
  };

  const openFunctionModal = (item = null) => {
    setSelectedFunctionMemberState(item?.member || null);
    setFunctionForm(
      item
        ? {
            id: item.id,
            memberId: item.memberId || item.member?.id || '',
            functionId: item.functionId ? String(item.functionId) : String(item.function?.id || ''),
            department: item.department || '',
            startDate: toDateInputValue(item.startDate),
            endDate: toDateInputValue(item.endDate),
            isActive: Boolean(item.isActive),
            notes: item.notes || '',
          }
        : {
            ...initialFunctionForm,
            startDate: new Date().toISOString().slice(0, 10),
          }
    );
    setFunctionModalOpen(true);
  };

  const saveFunctionAssignment = async () => {
    try {
      setSavingFunction(true);
      setDetailError('');
      if (!form.id) {
        throw new Error('Salve a igreja antes de registrar funcoes.');
      }

      if (!functionForm.memberId || !functionForm.functionId || !functionForm.startDate) {
        throw new Error('Membro, funcao e data de inicio sao obrigatorios.');
      }

      await fetchJson(
        functionForm.id ? `/church-function-history/${functionForm.id}` : `/churches/${form.id}/functions`,
        {
          method: functionForm.id ? 'PATCH' : 'POST',
          body: JSON.stringify({
            ...functionForm,
            department: functionForm.department || undefined,
          }),
        },
        { requiresAuth: true }
      );

      setFunctionModalOpen(false);
      setFunctionForm({ ...initialFunctionForm });
      await loadChurchWorkspace(form.id);
    } catch (functionError) {
      setDetailError(functionError.message || 'Falha ao salvar a funcao.');
    } finally {
      setSavingFunction(false);
    }
  };

  const removeFunctionAssignment = async (item) => {
    setPendingConfirm({
      title: 'Excluir histórico de função',
      message: `Excluir o histórico da função "${item.function?.name || ''}"?`,
      onConfirm: async () => {
        try {
          await fetchJson(`/church-function-history/${item.id}`, { method: 'DELETE' }, { requiresAuth: true });
          await loadChurchWorkspace(form.id);
        } catch (functionError) {
          setDetailError(functionError.message || 'Falha ao excluir função.');
        }
      },
    });
  };

  const openRentModal = (item = null) => {
    setRentForm(
      item
        ? {
            id: item.id,
            city: item.city || '',
            address: item.address || '',
            amount: item.amount != null ? formatCurrencyInput(item.amount) : '',
            ownerName: item.ownerName || '',
            ownerDocumentType: item.ownerDocumentType || 'CPF',
            ownerDocumentNumber: item.ownerDocumentNumber || '',
            paidAt: toDateInputValue(item.paidAt),
            receiptUrl: item.receiptUrl || '',
            notes: item.notes || '',
            isActive: item.isActive !== false,
          }
        : {
            ...initialRentForm,
            city: form.addressCity || '',
            address: [form.addressStreet, form.addressNeighborhood].filter(Boolean).join(' - '),
            paidAt: new Date().toISOString().slice(0, 10),
          },
    );
    setRentModalOpen(true);
  };

  const saveRentRecord = async () => {
    try {
      setSavingRent(true);
      setDetailError('');

      if (!form.id) {
        throw new Error('Salve a igreja antes de lançar aluguel.');
      }

      if (!rentForm.city || !rentForm.address || !rentForm.amount || !rentForm.paidAt) {
        throw new Error('Cidade, endereço, valor e data de pagamento são obrigatórios.');
      }

      await fetchJson(
        rentForm.id ? `/church-rent-records/${rentForm.id}` : `/churches/${form.id}/rent-records`,
        {
          method: rentForm.id ? 'PATCH' : 'POST',
          body: JSON.stringify({
            ...rentForm,
            amount: parseCurrencyInput(rentForm.amount),
            ownerDocumentNumber: rentForm.ownerDocumentNumber || undefined,
            receiptUrl: rentForm.receiptUrl || undefined,
          }),
        },
        { requiresAuth: true },
      );

      setRentModalOpen(false);
      setRentForm(initialRentForm);
      await loadChurchWorkspace(form.id);
    } catch (rentError) {
      setDetailError(rentError.message || 'Falha ao salvar aluguel.');
    } finally {
      setSavingRent(false);
    }
  };

  const removeRentRecord = (item) => {
    setPendingConfirm({
      title: 'Excluir lançamento de aluguel',
      message: `Excluir o lançamento de ${formatCurrency(item.amount)} em ${formatDateLabel(item.paidAt)}?`,
      onConfirm: async () => {
        try {
          await fetchJson(`/church-rent-records/${item.id}`, { method: 'DELETE' }, { requiresAuth: true });
          await loadChurchWorkspace(form.id);
        } catch (rentError) {
          setDetailError(rentError.message || 'Falha ao excluir aluguel.');
        }
      },
    });
  };

  const uploadReceipt = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${apiBase}/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      const message = await response.json().catch(() => ({}));
      throw new Error(message.error || 'Falha ao enviar arquivo.');
    }

    return response.json();
  };

  const handlePhotoFilesSelected = async (files) => {
    if (!form.id || !files?.length) return;

    try {
      setUploadingPhotos(true);
      setDetailError('');

      const uploadedPhotos = [];
      for (const file of Array.from(files)) {
        const uploaded = await uploadReceipt(file);
        uploadedPhotos.push({ url: uploaded.url, name: file.name });
      }

      await fetchJson(
        `/churches/${form.id}/photos`,
        {
          method: 'POST',
          body: JSON.stringify({ photos: uploadedPhotos }),
        },
        { requiresAuth: true },
      );

      await loadChurchWorkspace(form.id);
    } catch (photoError) {
      setDetailError(photoError.message || 'Falha ao enviar imagens.');
    } finally {
      setUploadingPhotos(false);
    }
  };

  const removePhoto = (photo) => {
    setPendingConfirm({
      title: 'Excluir imagem',
      message: 'Deseja remover esta imagem da igreja?',
      onConfirm: async () => {
        try {
          await fetchJson(`/church-photos/${photo.id}`, { method: 'DELETE' }, { requiresAuth: true });
          await loadChurchWorkspace(form.id);
        } catch (photoError) {
          setDetailError(photoError.message || 'Falha ao excluir imagem.');
        }
      },
    });
  };

  const openMemberPicker = (target) => {
    setMemberPickerTarget(target);
    setMemberSearch('');
    setMemberSearchPerformed(false);
    setMemberSearchLoading(false);
    setMemberSearchResults([]);
    setActiveMemberIndex(0);
    memberOptionRefs.current = [];
    setMemberPickerOpen(true);
  };

  const runMemberSearch = async () => {
    const query = memberSearch.trim();
    if (!query) {
      setMemberSearchPerformed(false);
      setMemberSearchResults([]);
      return;
    }

    try {
      setMemberSearchLoading(true);
      setMemberSearchPerformed(true);
      setActiveMemberIndex(0);

      const params = new URLSearchParams({
        query,
        limit: '30',
      });

      if (selectedFieldId) {
        params.set('campoId', selectedFieldId);
      }

      const results = await fetchJson(`/members?${params.toString()}`, {}, { requiresAuth: true });
      setMemberSearchResults(Array.isArray(results) ? results : []);
    } catch (memberError) {
      setMemberSearchResults([]);
      setDetailError(memberError.message || 'Falha ao buscar membros.');
    } finally {
      setMemberSearchLoading(false);
    }
  };

  const filteredMemberResults = useMemo(() => {
    if (!memberSearchPerformed) return [];
    return memberSearchResults.filter((member) => memberMatchesQuery(member, memberSearch)).slice(0, 30);
  }, [memberSearch, memberSearchPerformed, memberSearchResults]);

  useEffect(() => {
    const activeOption = memberOptionRefs.current[activeMemberIndex];
    if (activeOption?.scrollIntoView) {
      activeOption.scrollIntoView({ block: 'nearest' });
    }
  }, [activeMemberIndex, filteredMemberResults]);

  const handleMemberSelected = (member) => {
    if (memberPickerTarget === 'leader') {
      setSelectedLeaderMemberState(member);
      setLeaderChangeForm((current) => ({ ...current, memberId: member.id }));
    } else {
      setSelectedFunctionMemberState(member);
      setFunctionForm((current) => ({ ...current, memberId: member.id }));
    }
    setMemberPickerOpen(false);
  };

  const selectedLeaderMember = useMemo(
    () => selectedLeaderMemberState || churchMembers.find((member) => member.id === leaderChangeForm.memberId) || memberSearchResults.find((member) => member.id === leaderChangeForm.memberId) || null,
    [churchMembers, leaderChangeForm.memberId, memberSearchResults, selectedLeaderMemberState],
  );

  const selectedFunctionMember = useMemo(
    () => selectedFunctionMemberState || churchMembers.find((member) => member.id === functionForm.memberId) || memberSearchResults.find((member) => member.id === functionForm.memberId) || null,
    [churchMembers, functionForm.memberId, memberSearchResults, selectedFunctionMemberState],
  );

  const leaderRoleOptions = useMemo(
    () => functionCatalog.filter((item) => item.isLeaderRole || /dirig|pastor/i.test(item.name || '')),
    [functionCatalog],
  );

  const departmentOptions = useMemo(
    () => Array.from(new Set([...departmentSuggestions, ...churchFunctions.map((item) => item.department).filter(Boolean)])).sort((left, right) => left.localeCompare(right, 'pt-BR')),
    [churchFunctions],
  );

  const filteredContacts = useMemo(() => {
    const query = normalizeText(contactSearch).trim();
    const rows = churchContacts.filter((item) => {
      if (!query) return true;
      return [item.type, item.name, item.value, item.notes].some((value) => normalizeText(value || '').includes(query));
    });
    return sortCollection(rows, contactSortConfig);
  }, [churchContacts, contactSearch, contactSortConfig]);

  const filteredLeaderHistory = useMemo(() => {
    const query = normalizeText(leaderSearch).trim();
    const rows = leaderHistory.filter((item) => {
      const matchesQuery = !query || [
        item.previousLeaderMember?.fullName,
        item.newLeaderMember?.fullName,
        item.function?.name,
        item.indicatedBy,
        item.changeReason,
        item.notes,
      ].some((value) => normalizeText(value || '').includes(query));

      return matchesQuery && isDateWithinRange(item.entryDate, leaderDateFrom, leaderDateTo);
    });

    return sortCollection(rows, leaderSortConfig, {
      previousLeader: (item) => item.previousLeaderMember?.fullName || '',
      newLeader: (item) => item.newLeaderMember?.fullName || '',
      functionName: (item) => item.function?.name || '',
    });
  }, [leaderHistory, leaderSearch, leaderDateFrom, leaderDateTo, leaderSortConfig]);

  const filteredFunctions = useMemo(() => {
    const query = normalizeText(functionSearch).trim();
    const rows = churchFunctions.filter((item) => {
      const matchesQuery = !query || [item.member?.fullName, item.function?.name, item.department, item.notes].some((value) => normalizeText(value || '').includes(query));
      const matchesDate = isDateWithinRange(item.startDate, functionDateFrom, functionDateTo) || isDateWithinRange(item.endDate, functionDateFrom, functionDateTo);
      const matchesStatus = functionStatusFilter === 'all' || (functionStatusFilter === 'active' ? item.isActive : !item.isActive);
      return matchesQuery && matchesDate && matchesStatus;
    });

    return sortCollection(rows, functionSortConfig, {
      memberName: (item) => item.member?.fullName || '',
      functionName: (item) => item.function?.name || '',
    });
  }, [churchFunctions, functionSearch, functionDateFrom, functionDateTo, functionStatusFilter, functionSortConfig]);

  const filteredRentRecords = useMemo(() => {
    const query = normalizeText(rentSearch).trim();
    const rows = rentRecords.filter((item) => {
      const matchesQuery = !query || [item.city, item.address, item.ownerName, item.ownerDocumentNumber, item.notes].some((value) => normalizeText(value || '').includes(query));
      return matchesQuery && isDateWithinRange(item.paidAt, rentDateFrom, rentDateTo);
    });

    return sortCollection(rows, rentSortConfig);
  }, [rentRecords, rentSearch, rentDateFrom, rentDateTo, rentSortConfig]);

  const contactTotalPages = Math.max(1, Math.ceil(filteredContacts.length / contactPageSize));
  const leaderTotalPages = Math.max(1, Math.ceil(filteredLeaderHistory.length / leaderPageSize));
  const functionTotalPages = Math.max(1, Math.ceil(filteredFunctions.length / functionPageSize));
  const rentTotalPages = Math.max(1, Math.ceil(filteredRentRecords.length / rentPageSize));

  const paginatedContacts = paginateRows(filteredContacts, Math.min(contactPage, contactTotalPages), contactPageSize);
  const paginatedLeaderHistory = paginateRows(filteredLeaderHistory, Math.min(leaderPage, leaderTotalPages), leaderPageSize);
  const paginatedFunctions = paginateRows(filteredFunctions, Math.min(functionPage, functionTotalPages), functionPageSize);
  const paginatedRentRecords = paginateRows(filteredRentRecords, Math.min(rentPage, rentTotalPages), rentPageSize);

  const mapEmbedUrl = useMemo(() => buildGoogleMapsEmbedUrl(form), [form]);
  const mapLinkUrl = useMemo(() => buildGoogleMapsLink(form), [form]);

  useEffect(() => setContactPage(1), [contactSearch, contactPageSize, churchContacts.length]);
  useEffect(() => setLeaderPage(1), [leaderSearch, leaderDateFrom, leaderDateTo, leaderPageSize, leaderHistory.length]);
  useEffect(() => setFunctionPage(1), [functionSearch, functionDateFrom, functionDateTo, functionStatusFilter, functionPageSize, churchFunctions.length]);
  useEffect(() => setRentPage(1), [rentSearch, rentDateFrom, rentDateTo, rentPageSize, rentRecords.length]);

  const saveLeaderChange = async () => {
    try {
      setSavingLeaderChange(true);
      setDetailError('');
      if (!form.id) {
        throw new Error('Salve a igreja antes de trocar o dirigente.');
      }

      if (
        !leaderChangeForm.functionId ||
        !leaderChangeForm.memberId ||
        !leaderChangeForm.indicatedBy ||
        !leaderChangeForm.changeReason ||
        !leaderChangeForm.entryDate
      ) {
        throw new Error('Funcao, novo dirigente, quem indicou, motivo e data de entrada sao obrigatorios.');
      }

      await fetchJson(
        leaderChangeForm.id ? `/church-leader-history/${leaderChangeForm.id}` : `/churches/${form.id}/leader-change`,
        {
          method: leaderChangeForm.id ? 'PATCH' : 'POST',
          body: JSON.stringify(leaderChangeForm),
        },
        { requiresAuth: true }
      );

      setLeaderModalOpen(false);
      setLeaderChangeForm({ ...initialLeaderChangeForm });
      setSelectedLeaderMemberState(null);
      await loadChurchWorkspace(form.id);
      toast.success('Dirigente atualizado com sucesso.');
    } catch (leaderError) {
      setDetailError(leaderError.message || 'Falha ao trocar dirigente.');
      toast.error(leaderError.message || 'Falha ao trocar dirigente.');
    } finally {
      setSavingLeaderChange(false);
    }
  };

  const openLeaderChangeModal = (item = null) => {
    setSelectedLeaderMemberState(item?.newLeaderMember || null);
    setLeaderChangeForm(
      item
        ? {
            id: item.id,
            functionId: item.functionId ? String(item.functionId) : String(item.function?.id || ''),
            memberId: item.newLeaderMemberId || item.newLeaderMember?.id || '',
            indicatedBy: item.indicatedBy || '',
            changeReason: item.changeReason || '',
            entryDate: toDateInputValue(item.entryDate),
            currentCash: item.currentCash == null ? '' : String(item.currentCash),
            averageIncome: item.averageIncome == null ? '' : String(item.averageIncome),
            averageExpense: item.averageExpense == null ? '' : String(item.averageExpense),
            maxIncome: item.maxIncome == null ? '' : String(item.maxIncome),
            totalMembers: item.totalMembers == null ? '' : String(item.totalMembers),
            totalWorkers: item.totalWorkers == null ? '' : String(item.totalWorkers),
            notes: item.notes || '',
          }
        : {
            ...initialLeaderChangeForm,
            entryDate: new Date().toISOString().slice(0, 10),
          }
    );
    setLeaderModalOpen(true);
  };

  const removeLeaderHistoryItem = (item) => {
    setPendingConfirm({
      title: 'Excluir histórico de dirigente',
      message: `Excluir a movimentação de dirigente para "${item.newLeaderMember?.fullName || '-'}"?`,
      onConfirm: async () => {
        try {
          await fetchJson(`/church-leader-history/${item.id}`, { method: 'DELETE' }, { requiresAuth: true });
          await loadChurchWorkspace(form.id);
        } catch (leaderError) {
          setDetailError(leaderError.message || 'Falha ao excluir histórico de dirigente.');
        }
      },
    });
  };

  const columnDefinitions = [
    { key: 'code', label: 'Codigo' },
    { key: 'name', label: 'Igreja' },
    { key: 'campo', label: 'Campo' },
    { key: 'regional', label: 'Regional' },
    { key: 'leader', label: 'Dirigente' },
    { key: 'city', label: 'Cidade' },
    { key: 'state', label: 'UF' },
    { key: 'status', label: 'Status' },
  ];

  const visibleColumnsList = columnDefinitions.filter((column) => visibleColumns[column.key]);
  const uniqueStates = Array.from(new Set(enrichedChurches.map((item) => item.state).filter((item) => item && item !== '-')));
  const listFrom = sortedChurches.length ? (page - 1) * pageSize + 1 : 0;
  const listTo = sortedChurches.length ? Math.min(page * pageSize, sortedChurches.length) : 0;
  const resetFilters = () => setFilters({ ...initialFilters, campoId: selectedFieldId });

  const renderListView = () => (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
              <Building2 className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Gestão de Igrejas</h1>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => setPrintModalOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              <Printer className="h-4 w-4" />
              Imprimir
            </button>
            <button
              type="button"
              onClick={openNewChurch}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-purple-700"
            >
              <Plus className="h-5 w-5" />
              Nova Igreja
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950">
            <span className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              <Search className="h-3.5 w-3.5" />
              Busca Geral
            </span>
            <input
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder="Nome, codigo, dirigente..."
              className="w-full border-none bg-transparent p-0 text-sm text-slate-900 outline-none dark:text-slate-100"
            />
          </label>

          <label className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950">
            <span className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              <Filter className="h-3.5 w-3.5" />
              Campo
            </span>
            <select
              value={filters.campoId}
              onChange={(event) => setFilters((current) => ({ ...current, campoId: event.target.value, regionalId: '' }))}
              disabled={Boolean(selectedFieldId)}
              className="w-full border-none bg-transparent p-0 text-sm text-slate-900 outline-none dark:text-slate-100"
            >
              <option value="">Todos os campos</option>
              {campos.map((campo) => (
                <option key={campo.id} value={campo.id}>
                  {campo.name}
                </option>
              ))}
            </select>
          </label>

          <label className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950">
            <span className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              <Filter className="h-3.5 w-3.5" />
              Regional
            </span>
            <select
              value={filters.regionalId}
              onChange={(event) => setFilters((current) => ({ ...current, regionalId: event.target.value }))}
              className="w-full border-none bg-transparent p-0 text-sm text-slate-900 outline-none dark:text-slate-100"
            >
              <option value="">Todas as regionais</option>
              {filteredRegionais.map((regional) => (
                <option key={regional.id} value={regional.id}>
                  {regional.name}
                </option>
              ))}
            </select>
          </label>

          <label className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950">
            <span className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
              <Filter className="h-3.5 w-3.5" />
              UF
            </span>
            <select
              value={filters.state}
              onChange={(event) => setFilters((current) => ({ ...current, state: event.target.value }))}
              className="w-full border-none bg-transparent p-0 text-sm text-slate-900 outline-none dark:text-slate-100"
            >
              <option value="">Todas as UFs</option>
              {uniqueStates.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-end gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  <Columns3 className="h-4 w-4" />
                  Colunas
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Colunas da tabela</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columnDefinitions.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.key}
                    checked={visibleColumns[column.key]}
                    onCheckedChange={(checked) => setVisibleColumns((current) => ({ ...current, [column.key]: Boolean(checked) }))}
                  >
                    {column.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              Limpar
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800">
          <div>
            <h2 className="text-[28px] font-semibold tracking-tight text-slate-950 dark:text-slate-50">Tabela de igrejas</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{sortedChurches.length} registros filtrados de {churches.length} igrejas.</p>
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Exibindo {listFrom} a {listTo}
          </div>
        </div>

        {loading ? <div className="px-5 py-8 text-sm text-slate-500">Carregando igrejas...</div> : null}
        {error ? <div className="mx-5 mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        {!loading ? (
          <>
            <div className="px-5 py-4">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200">
                    {visibleColumnsList.map((column) => {
                      const sortKey = column.key === 'campo' ? 'campoName' : column.key === 'regional' ? 'regionalName' : column.key === 'status' ? 'statusLabel' : column.key;
                      return (
                        <TableHead key={column.key} className="px-3 py-3">
                          <button
                            type="button"
                            onClick={() => setSortConfig((current) => ({ key: sortKey, direction: current.key === sortKey && current.direction === 'asc' ? 'desc' : 'asc' }))}
                            className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                          >
                            {column.label}
                            <ArrowUpDown className="h-3.5 w-3.5" />
                          </button>
                        </TableHead>
                      );
                    })}
                    {visibleColumns.actions ? <TableHead className="px-3 py-3 text-right">Acoes</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedChurches.map((church) => (
                    <TableRow key={church.id} className="border-slate-200">
                      {visibleColumns.code ? <TableCell className="px-3 py-3 font-medium text-slate-900 dark:text-slate-100">{church.code}</TableCell> : null}
                      {visibleColumns.name ? (
                        <TableCell className="px-3 py-3">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">{church.name}</div>
                          <div className="text-xs text-slate-400">{church.documentNumber || 'Sem documento'}</div>
                        </TableCell>
                      ) : null}
                      {visibleColumns.campo ? <TableCell className="px-3 py-3 text-slate-700 dark:text-slate-300">{church.campoName}</TableCell> : null}
                      {visibleColumns.regional ? <TableCell className="px-3 py-3 text-slate-700 dark:text-slate-300">{church.regionalName}</TableCell> : null}
                      {visibleColumns.leader ? <TableCell className="px-3 py-3 text-slate-700 dark:text-slate-300">{church.leader}</TableCell> : null}
                      {visibleColumns.city ? <TableCell className="px-3 py-3 text-slate-700 dark:text-slate-300">{church.city}</TableCell> : null}
                      {visibleColumns.state ? <TableCell className="px-3 py-3 text-slate-700 dark:text-slate-300">{church.state}</TableCell> : null}
                      {visibleColumns.status ? (
                        <TableCell className="px-3 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${church.status === 'inactive' ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {church.statusLabel}
                          </span>
                        </TableCell>
                      ) : null}
                      {visibleColumns.actions ? (
                        <TableCell className="px-3 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openChurchDetail(church.id)}
                              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteChurch(church)}
                              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Excluir
                            </button>
                          </div>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-4 border-t border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <span>Linhas por pagina</span>
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  {pageSizeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <Pagination className="mx-0 w-auto justify-start lg:justify-end">
                <PaginationContent>
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
                    <PaginationItem key={pageNumber}>
                      <PaginationLink
                        href="#"
                        isActive={pageNumber === page}
                        onClick={(event) => {
                          event.preventDefault();
                          setPage(pageNumber);
                        }}
                      >
                        {pageNumber}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                </PaginationContent>
              </Pagination>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );

  const renderSaveGate = () => (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
      Salve a igreja na aba Dados para liberar esta etapa.
    </div>
  );

  const renderChurchDataSection = () => (
    <SectionCard
      title={form.id ? 'Dados Principais' : 'Nova Igreja'}
      description={form.id ? 'Informacoes cadastrais da igreja' : 'Cadastro inicial simplificado para abrir a igreja dentro do campo atual.'}
      actions={
        <button
          type="button"
          onClick={saveChurch}
          disabled={savingChurch}
          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {savingChurch ? 'Salvando...' : form.id ? 'Salvar dados' : 'Criar igreja'}
        </button>
      }
    >
      <div className="grid gap-4 xl:grid-cols-4">
        <label className={labelClass}>
          Dirigente Atual
          <input value={form.currentLeaderName} onChange={(event) => setForm((current) => ({ ...current, currentLeaderName: event.target.value }))} className={fieldClass} />
        </label>
        <label className={labelClass}>
          Rol do Dirigente
          <input value={form.leaderRoll} onChange={(event) => setForm((current) => ({ ...current, leaderRoll: event.target.value }))} className={fieldClass} />
        </label>
        <label className={labelClass}>
          Campo
          <select value={form.campoId} onChange={(event) => setForm((current) => ({ ...current, campoId: event.target.value, regionalId: '', headquartersId: '' }))} disabled={Boolean(selectedFieldId)} className={fieldClass}>
            <option value="">Selecione o campo</option>
            {campos.map((campo) => (
              <option key={campo.id} value={campo.id}>{campo.name}</option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Regional
          <select value={form.regionalId} onChange={(event) => setForm((current) => ({ ...current, regionalId: event.target.value }))} className={fieldClass}>
            <option value="">Selecione a regional</option>
            {formRegionais.map((regional) => (
              <option key={regional.id} value={regional.id}>{regional.name}</option>
            ))}
          </select>
        </label>

        <label className={labelClass}>
          Igreja Sede
          <select value={form.headquartersId} onChange={(event) => setForm((current) => ({ ...current, headquartersId: event.target.value }))} className={fieldClass}>
            <option value="">Selecione a igreja sede</option>
            {availableHeadquarters.map((item) => (
              <option key={item.id} value={item.id}>{item.churchName}{item.regionalName ? ` · ${item.regionalName}` : ''}</option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Hash
          <input value={form.hash} onChange={(event) => setForm((current) => ({ ...current, hash: event.target.value }))} className={fieldClass} />
        </label>
        <label className={labelClass}>
          Data Entrada
          <input type="date" value={form.entryDate} onChange={(event) => setForm((current) => ({ ...current, entryDate: event.target.value }))} className={fieldClass} />
        </label>
        <label className={labelClass}>
          Data Saida
          <input type="date" value={form.exitDate} onChange={(event) => setForm((current) => ({ ...current, exitDate: event.target.value }))} className={fieldClass} />
        </label>
        <label className={labelClass}>
          Codigo
          <input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} className={fieldClass} />
        </label>

        <label className={`${labelClass} xl:col-span-2`}>
          Nome Completo
          <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className={fieldClass} />
        </label>
        <label className={`${labelClass} xl:col-span-2`}>
          Nome Placa
          <input value={form.plateName} onChange={(event) => setForm((current) => ({ ...current, plateName: event.target.value }))} className={fieldClass} />
        </label>

        <label className={labelClass}>
          Tipo Documento
          <select value={form.documentType} onChange={(event) => setForm((current) => ({ ...current, documentType: event.target.value }))} className={fieldClass}>
            <option value="CNPJ">CNPJ</option>
            <option value="OUTRO">Outro</option>
          </select>
        </label>
        <label className={`${labelClass} xl:col-span-2`}>
          Documento (CNPJ/Outro)
          <input value={form.documentNumber} onChange={(event) => setForm((current) => ({ ...current, documentNumber: event.target.value }))} className={fieldClass} />
        </label>
        <label className={labelClass}>
          Data Fundacao
          <input type="date" value={form.foundedAt} onChange={(event) => setForm((current) => ({ ...current, foundedAt: event.target.value }))} className={fieldClass} />
        </label>

        <label className={labelClass}>
          CEP
          <div className="flex gap-2">
            <input
              value={form.addressZipcode}
              onChange={(event) => setForm((current) => ({ ...current, addressZipcode: formatZipcode(event.target.value) }))}
              onBlur={() => {
                if (normalizeZipcode(form.addressZipcode).length === 8) {
                  lookupZipcode();
                }
              }}
              placeholder="00000-000"
              className={`${fieldClass} flex-1`}
            />
            <button
              type="button"
              onClick={lookupZipcode}
              disabled={zipcodeLookupLoading}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              {zipcodeLookupLoading ? 'Buscando...' : 'Buscar CEP'}
            </button>
          </div>
        </label>
        <label className={labelClass}>
          Cidade
          <input value={form.addressCity} onChange={(event) => setForm((current) => ({ ...current, addressCity: event.target.value }))} className={fieldClass} />
        </label>
        <label className={labelClass}>
          UF
          <input value={form.addressState} onChange={(event) => setForm((current) => ({ ...current, addressState: event.target.value.toUpperCase() }))} maxLength={2} className={fieldClass} />
        </label>
        <label className={labelClass}>
          Bairro
          <input value={form.addressNeighborhood} onChange={(event) => setForm((current) => ({ ...current, addressNeighborhood: event.target.value }))} className={fieldClass} />
        </label>

        <label className={`${labelClass} xl:col-span-2`}>
          Logradouro
          <input value={form.addressStreet} onChange={(event) => setForm((current) => ({ ...current, addressStreet: event.target.value }))} className={fieldClass} />
        </label>
        <label className={`${labelClass} xl:col-span-2`}>
          Posicao Geografica
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="grid gap-3 md:grid-cols-2">
              <input placeholder="Latitude" value={form.latitude} onChange={(event) => setForm((current) => ({ ...current, latitude: event.target.value }))} className={fieldClass} />
              <input placeholder="Longitude" value={form.longitude} onChange={(event) => setForm((current) => ({ ...current, longitude: event.target.value }))} className={fieldClass} />
            </div>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Use o CEP ou abra o localizador para escolher o endereço e preencher as coordenadas automaticamente.
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => searchLocationCandidates()} disabled={locationSearchLoading} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                  {locationSearchLoading ? 'Localizando...' : 'Buscar coordenadas'}
                </button>
                <button type="button" onClick={openLocationHelper} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                  Abrir localizador
                </button>
              </div>
            </div>
          </div>
        </label>

        <div className={`xl:col-span-4 ${mutedPanelClass}`}>
          <SwitchField checked={form.hasOwnTemple} onChange={(checked) => setForm((current) => ({ ...current, hasOwnTemple: checked }))} label="Possui um templo proprio" />
        </div>

        <label className={`${labelClass} xl:col-span-4`}>
          Observacoes
          <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={5} className={fieldClass} />
        </label>
      </div>
    </SectionCard>
  );

  const renderDetailView = () => (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={backToList}
            className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h1 className="text-[34px] font-semibold tracking-tight text-slate-950 dark:text-slate-50">{form.id ? 'Editar Igreja' : 'Nova Igreja'}</h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {form.code || 'Sem codigo'} {form.name ? `· ${form.name}` : ''} {form.currentLeaderName ? `· Dirigente: ${form.currentLeaderName}` : ''}
                </p>
              </div>
              <SwitchField
                checked={form.status !== 'inactive'}
                onChange={(checked) => setForm((current) => ({ ...current, status: checked ? 'active' : 'inactive' }))}
                label={form.status === 'inactive' ? 'Inativa' : 'Ativa'}
                alignEnd
              />
            </div>
          </div>
        </div>
      </div>

      {detailError ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{detailError}</div> : null}
      {detailLoading ? <div className="rounded-lg border border-slate-200 bg-white px-5 py-8 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">Carregando dados da igreja...</div> : null}

      {!form.id ? renderChurchDataSection() : <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-4">
        <TabsList className="flex h-auto w-full flex-wrap items-end justify-between gap-x-6 gap-y-0 rounded-none border-b border-slate-200 bg-transparent px-0 py-0 dark:border-slate-800 dark:bg-transparent">
          <TabsTrigger value="dados" className="rounded-none border-b-2 border-transparent px-2 py-4 data-[state=active]:border-purple-600 data-[state=active]:bg-transparent data-[state=active]:text-slate-950 data-[state=active]:shadow-none dark:data-[state=active]:text-slate-50">Dados</TabsTrigger>
          <TabsTrigger value="contatos" className="rounded-none border-b-2 border-transparent px-2 py-4 data-[state=active]:border-purple-600 data-[state=active]:bg-transparent data-[state=active]:text-slate-950 data-[state=active]:shadow-none dark:data-[state=active]:text-slate-50">Contatos</TabsTrigger>
          <TabsTrigger value="trocar-dirigente" className="rounded-none border-b-2 border-transparent px-2 py-4 data-[state=active]:border-purple-600 data-[state=active]:bg-transparent data-[state=active]:text-slate-950 data-[state=active]:shadow-none dark:data-[state=active]:text-slate-50">Trocar Dirigente</TabsTrigger>
          <TabsTrigger value="funcoes" className="rounded-none border-b-2 border-transparent px-2 py-4 data-[state=active]:border-purple-600 data-[state=active]:bg-transparent data-[state=active]:text-slate-950 data-[state=active]:shadow-none dark:data-[state=active]:text-slate-50">Funcoes</TabsTrigger>
          <TabsTrigger value="imagens" className="rounded-none border-b-2 border-transparent px-2 py-4 data-[state=active]:border-purple-600 data-[state=active]:bg-transparent data-[state=active]:text-slate-950 data-[state=active]:shadow-none dark:data-[state=active]:text-slate-50">Imagens</TabsTrigger>
          <TabsTrigger value="aluguel" className="rounded-none border-b-2 border-transparent px-2 py-4 data-[state=active]:border-purple-600 data-[state=active]:bg-transparent data-[state=active]:text-slate-950 data-[state=active]:shadow-none dark:data-[state=active]:text-slate-50">Aluguel</TabsTrigger>
          <TabsTrigger value="mapa" className="rounded-none border-b-2 border-transparent px-2 py-4 data-[state=active]:border-purple-600 data-[state=active]:bg-transparent data-[state=active]:text-slate-950 data-[state=active]:shadow-none dark:data-[state=active]:text-slate-50">Mapa</TabsTrigger>
        </TabsList>

        <TabsContent value="dados">
          {renderChurchDataSection()}
        </TabsContent>

        <TabsContent value="contatos">
          {form.id ? (
            <SectionCard
              title="Contatos"
              description="Gerencie os contatos da igreja com ordenação, busca e navegação por páginas."
              actions={<button type="button" onClick={() => openContactModal()} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"><Plus className="h-4 w-4" />Novo Contato</button>}
            >
              <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_160px]">
                <label className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                  <span className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400"><Search className="h-3.5 w-3.5" />Buscar contato</span>
                  <input value={contactSearch} onChange={(event) => setContactSearch(event.target.value)} placeholder="Tipo, nome, valor, observação" className="w-full border-none bg-transparent p-0 text-sm text-slate-900 outline-none dark:text-slate-100" />
                </label>
                <label className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Exibir</span>
                  <select value={contactPageSize} onChange={(event) => setContactPageSize(Number(event.target.value))} className="w-full border-none bg-transparent p-0 text-sm text-slate-900 outline-none dark:text-slate-100">
                    {detailPageSizeOptions.map((option) => <option key={option} value={option}>{option} linhas</option>)}
                  </select>
                </label>
              </div>

              <div className="mb-4 grid gap-3 md:grid-cols-3">
                <div className={`rounded-xl ${mutedPanelClass}`}>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Total</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-50">{churchContacts.length}</div>
                </div>
                <div className={`rounded-xl ${mutedPanelClass}`}>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Principais</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-50">{churchContacts.filter((item) => item.isPrimary).length}</div>
                </div>
                <div className={`rounded-xl ${mutedPanelClass}`}>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Filtrados</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-50">{filteredContacts.length}</div>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200">
                    <TableHead><button type="button" onClick={() => setContactSortConfig((current) => ({ key: 'type', direction: current.key === 'type' && current.direction === 'asc' ? 'desc' : 'asc' }))} className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Tipo <ArrowUpDown className="h-3.5 w-3.5" /></button></TableHead>
                    <TableHead><button type="button" onClick={() => setContactSortConfig((current) => ({ key: 'name', direction: current.key === 'name' && current.direction === 'asc' ? 'desc' : 'asc' }))} className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Nome <ArrowUpDown className="h-3.5 w-3.5" /></button></TableHead>
                    <TableHead><button type="button" onClick={() => setContactSortConfig((current) => ({ key: 'value', direction: current.key === 'value' && current.direction === 'asc' ? 'desc' : 'asc' }))} className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Valor <ArrowUpDown className="h-3.5 w-3.5" /></button></TableHead>
                    <TableHead>Observacao</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedContacts.length ? paginatedContacts.map((contact) => (
                    <TableRow key={contact.id} className="border-slate-200">
                      <TableCell>{contact.type}</TableCell>
                      <TableCell>{contact.name || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{contact.value}</span>
                          {contact.isPrimary ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-100">Principal</span> : null}
                        </div>
                      </TableCell>
                      <TableCell>{contact.notes || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => openContactModal(contact)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-900">Editar</button>
                          <button type="button" onClick={() => removeContact(contact)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100">Excluir</button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={5} className="py-10 text-center text-sm text-slate-500">Nenhum contato encontrado.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="mt-4 flex flex-col gap-4 border-t border-slate-200 pt-4 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
                <div className="text-sm text-slate-500 dark:text-slate-400">Página {Math.min(contactPage, contactTotalPages)} de {contactTotalPages}</div>
                <Pagination className="mx-0 w-auto justify-start lg:justify-end">
                  <PaginationContent>
                    {Array.from({ length: contactTotalPages }, (_, index) => index + 1).map((pageNumber) => (
                      <PaginationItem key={pageNumber}>
                        <PaginationLink href="#" isActive={pageNumber === Math.min(contactPage, contactTotalPages)} onClick={(event) => { event.preventDefault(); setContactPage(pageNumber); }}>{pageNumber}</PaginationLink>
                      </PaginationItem>
                    ))}
                  </PaginationContent>
                </Pagination>
              </div>
            </SectionCard>
          ) : renderSaveGate()}
        </TabsContent>

        <TabsContent value="trocar-dirigente">
          {form.id ? (
            <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-5 grid gap-3 xl:grid-cols-[minmax(280px,1.35fr)_minmax(320px,1.8fr)_180px_180px_auto]">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Dirigente Atual</div>
                  <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{form.currentLeaderName || 'Sem dados'}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Rol {form.leaderRoll || 'Sem dados'} · {leaderHistory.length} movimentações</div>
                </div>
                <label className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                  <span className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400"><Search className="h-3.5 w-3.5" />Buscar dirigente</span>
                  <input value={leaderSearch} onChange={(event) => setLeaderSearch(event.target.value)} placeholder="Nome, indicação, função, motivo" className="w-full border-none bg-transparent p-0 text-sm text-slate-900 outline-none dark:text-slate-100" />
                </label>
                <label className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                  <span className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400"><CalendarDays className="h-3.5 w-3.5" />De</span>
                  <input type="date" value={leaderDateFrom} onChange={(event) => setLeaderDateFrom(event.target.value)} className="w-full border-none bg-transparent p-0 text-sm text-slate-900 outline-none dark:text-slate-100" />
                </label>
                <label className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                  <span className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400"><CalendarDays className="h-3.5 w-3.5" />Até</span>
                  <input type="date" value={leaderDateTo} onChange={(event) => setLeaderDateTo(event.target.value)} className="w-full border-none bg-transparent p-0 text-sm text-slate-900 outline-none dark:text-slate-100" />
                </label>
                <button type="button" onClick={() => openLeaderChangeModal()} className="inline-flex h-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"><Plus className="h-4 w-4" />Trocar Dirigente</button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200">
                    <TableHead><button type="button" onClick={() => setLeaderSortConfig((current) => ({ key: 'previousLeader', direction: current.key === 'previousLeader' && current.direction === 'asc' ? 'desc' : 'asc' }))} className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Anterior <ArrowUpDown className="h-3.5 w-3.5" /></button></TableHead>
                    <TableHead><button type="button" onClick={() => setLeaderSortConfig((current) => ({ key: 'newLeader', direction: current.key === 'newLeader' && current.direction === 'asc' ? 'desc' : 'asc' }))} className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Novo Dirigente <ArrowUpDown className="h-3.5 w-3.5" /></button></TableHead>
                    <TableHead><button type="button" onClick={() => setLeaderSortConfig((current) => ({ key: 'functionName', direction: current.key === 'functionName' && current.direction === 'asc' ? 'desc' : 'asc' }))} className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Funcao <ArrowUpDown className="h-3.5 w-3.5" /></button></TableHead>
                    <TableHead><button type="button" onClick={() => setLeaderSortConfig((current) => ({ key: 'entryDate', direction: current.key === 'entryDate' && current.direction === 'asc' ? 'desc' : 'asc' }))} className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Entrada <ArrowUpDown className="h-3.5 w-3.5" /></button></TableHead>
                    <TableHead>Indicacao</TableHead>
                    <TableHead>Membros</TableHead>
                    <TableHead>Obreiros</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedLeaderHistory.length ? paginatedLeaderHistory.map((item) => (
                    <TableRow key={item.id} className="border-slate-200">
                      <TableCell>{item.previousLeaderMember?.fullName || '-'}</TableCell>
                      <TableCell>{item.newLeaderMember?.fullName || '-'}</TableCell>
                      <TableCell>{item.function?.name || '-'}</TableCell>
                      <TableCell>{formatDateLabel(item.entryDate)}</TableCell>
                      <TableCell>{item.indicatedBy || '-'}</TableCell>
                      <TableCell>{item.totalMembers ?? '-'}</TableCell>
                      <TableCell>{item.totalWorkers ?? '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openLeaderChangeModal(item)}
                            className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-900"
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setLeaderHistoryDetails(item)}
                            className="rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-900"
                            title="Detalhes"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeLeaderHistoryItem(item)}
                            className="rounded-lg border border-red-200 bg-red-50 p-2 text-red-700 hover:bg-red-100"
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-sm text-slate-500">Nenhuma troca de dirigente encontrada.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="mt-4 flex flex-col gap-4 border-t border-slate-200 pt-4 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <span>Linhas por página</span>
                  <select value={leaderPageSize} onChange={(event) => setLeaderPageSize(Number(event.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                    {detailPageSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <Pagination className="mx-0 w-auto justify-start lg:justify-end">
                  <PaginationContent>
                    {Array.from({ length: leaderTotalPages }, (_, index) => index + 1).map((pageNumber) => (
                      <PaginationItem key={pageNumber}>
                        <PaginationLink href="#" isActive={pageNumber === Math.min(leaderPage, leaderTotalPages)} onClick={(event) => { event.preventDefault(); setLeaderPage(pageNumber); }}>{pageNumber}</PaginationLink>
                      </PaginationItem>
                    ))}
                  </PaginationContent>
                </Pagination>
              </div>
            </div>
          ) : renderSaveGate()}
        </TabsContent>

        <TabsContent value="funcoes">
          {form.id ? (
            <SectionCard
              title="Historico de Funcoes"
              description="Membros com funções atribuídas nesta igreja, com filtro por ativos, departamento e período."
              actions={<button type="button" onClick={() => openFunctionModal()} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"><Plus className="h-4 w-4" />Nova Funcao</button>}
            >
              <div className="mb-5 grid gap-4 xl:grid-cols-5">
                <label className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60 xl:col-span-2">
                  <span className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400"><Search className="h-3.5 w-3.5" />Buscar função</span>
                  <input value={functionSearch} onChange={(event) => setFunctionSearch(event.target.value)} placeholder="Membro, função, departamento" className="w-full border-none bg-transparent p-0 text-sm text-slate-900 outline-none dark:text-slate-100" />
                </label>
                <label className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                  <span className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400"><CalendarDays className="h-3.5 w-3.5" />De</span>
                  <input type="date" value={functionDateFrom} onChange={(event) => setFunctionDateFrom(event.target.value)} className="w-full border-none bg-transparent p-0 text-sm text-slate-900 outline-none dark:text-slate-100" />
                </label>
                <label className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                  <span className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400"><CalendarDays className="h-3.5 w-3.5" />Até</span>
                  <input type="date" value={functionDateTo} onChange={(event) => setFunctionDateTo(event.target.value)} className="w-full border-none bg-transparent p-0 text-sm text-slate-900 outline-none dark:text-slate-100" />
                </label>
                <label className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Status</span>
                  <select value={functionStatusFilter} onChange={(event) => setFunctionStatusFilter(event.target.value)} className="w-full border-none bg-transparent p-0 text-sm text-slate-900 outline-none dark:text-slate-100">
                    <option value="all">Todas</option>
                    <option value="active">Somente ativas</option>
                    <option value="inactive">Somente encerradas</option>
                  </select>
                </label>
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200">
                    <TableHead><button type="button" onClick={() => setFunctionSortConfig((current) => ({ key: 'memberName', direction: current.key === 'memberName' && current.direction === 'asc' ? 'desc' : 'asc' }))} className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Membro <ArrowUpDown className="h-3.5 w-3.5" /></button></TableHead>
                    <TableHead><button type="button" onClick={() => setFunctionSortConfig((current) => ({ key: 'functionName', direction: current.key === 'functionName' && current.direction === 'asc' ? 'desc' : 'asc' }))} className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Funcao <ArrowUpDown className="h-3.5 w-3.5" /></button></TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead><button type="button" onClick={() => setFunctionSortConfig((current) => ({ key: 'startDate', direction: current.key === 'startDate' && current.direction === 'asc' ? 'desc' : 'asc' }))} className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Inicio <ArrowUpDown className="h-3.5 w-3.5" /></button></TableHead>
                    <TableHead><button type="button" onClick={() => setFunctionSortConfig((current) => ({ key: 'endDate', direction: current.key === 'endDate' && current.direction === 'asc' ? 'desc' : 'asc' }))} className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Termino <ArrowUpDown className="h-3.5 w-3.5" /></button></TableHead>
                    <TableHead>Observacao</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedFunctions.length ? paginatedFunctions.map((item) => (
                    <TableRow key={item.id} className="border-slate-200">
                      <TableCell>{item.member?.fullName || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{item.function?.name || '-'}</span>
                          {item.isActive ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Ativa</span> : null}
                        </div>
                      </TableCell>
                      <TableCell>{item.department || '-'}</TableCell>
                      <TableCell>{formatDateLabel(item.startDate)}</TableCell>
                      <TableCell>{formatDateLabel(item.endDate)}</TableCell>
                      <TableCell>{item.notes || '-'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => openFunctionModal(item)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-900">Editar</button>
                          <button type="button" onClick={() => removeFunctionAssignment(item)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100">Excluir</button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-slate-500">Nenhuma função encontrada.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="mt-4 flex flex-col gap-4 border-t border-slate-200 pt-4 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <span>Linhas por página</span>
                  <select value={functionPageSize} onChange={(event) => setFunctionPageSize(Number(event.target.value))} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                    {detailPageSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <Pagination className="mx-0 w-auto justify-start lg:justify-end">
                  <PaginationContent>
                    {Array.from({ length: functionTotalPages }, (_, index) => index + 1).map((pageNumber) => (
                      <PaginationItem key={pageNumber}>
                        <PaginationLink href="#" isActive={pageNumber === Math.min(functionPage, functionTotalPages)} onClick={(event) => { event.preventDefault(); setFunctionPage(pageNumber); }}>{pageNumber}</PaginationLink>
                      </PaginationItem>
                    ))}
                  </PaginationContent>
                </Pagination>
              </div>
            </SectionCard>
          ) : renderSaveGate()}
        </TabsContent>

        <TabsContent value="imagens">
          {form.id ? (
            <SectionCard
              title="Imagens da Igreja"
              description="Envie uma ou várias imagens, visualize em grade e abra um visualizador com zoom, rotação e download."
              actions={<label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"><Upload className="h-4 w-4" />{uploadingPhotos ? 'Enviando...' : 'Enviar imagens'}<input type="file" accept="image/*" multiple className="hidden" onChange={(event) => handlePhotoFilesSelected(event.target.files)} disabled={uploadingPhotos} /></label>}
            >
              <div className="mb-5 grid gap-4 md:grid-cols-3">
                <div className={`rounded-xl ${mutedPanelClass}`}><div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Total</div><div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-50">{churchPhotos.length}</div></div>
                <div className={`rounded-xl ${mutedPanelClass}`}><div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Último envio</div><div className="mt-2 text-sm font-semibold text-slate-950 dark:text-slate-50">{churchPhotos[0] ? formatDateLabel(churchPhotos[0].createdAt) : 'Sem imagens'}</div></div>
                <div className={`rounded-xl ${mutedPanelClass}`}><div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Ação rápida</div><div className="mt-2 text-sm font-semibold text-slate-950 dark:text-slate-50">Clique para ampliar</div></div>
              </div>

              {churchPhotos.length ? (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {churchPhotos.map((photo) => (
                    <div key={photo.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
                      <button type="button" onClick={() => { setPhotoPreview(photo); setPhotoZoom(1); setPhotoRotation(0); }} className="block w-full text-left">
                        <div className="aspect-[4/3] overflow-hidden bg-slate-200 dark:bg-slate-800">
                          <img src={photo.photoUrl} alt={photo.fieldName || form.name || 'Imagem da igreja'} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                        </div>
                      </button>
                      <div className="space-y-3 px-4 py-3">
                        <div>
                          <div className="line-clamp-1 text-sm font-semibold text-slate-950 dark:text-slate-50">{photo.fieldName || form.name || 'Imagem da igreja'}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">{formatDateLabel(photo.createdAt)}</div>
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => { setPhotoPreview(photo); setPhotoZoom(1); setPhotoRotation(0); }} className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-white dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-950">Visualizar</button>
                          <button type="button" onClick={() => removePhoto(photo)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100">Excluir</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-16 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
                  Nenhuma imagem cadastrada. Use o botão acima para enviar uma ou várias fotos da igreja.
                </div>
              )}
            </SectionCard>
          ) : renderSaveGate()}
        </TabsContent>

        <TabsContent value="aluguel">
          {form.id ? (
            <SectionCard
              title="Controle de Aluguel"
              description="Registre pagamentos, endereço, proprietário, documento e recibo do imóvel alugado."
              actions={<button type="button" onClick={() => openRentModal()} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"><Plus className="h-4 w-4" />Novo Lançamento</button>}
            >
              <div className="mb-5 grid gap-4 xl:grid-cols-5">
                <label className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60 xl:col-span-2">
                  <span className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400"><Search className="h-3.5 w-3.5" />Buscar lançamento</span>
                  <input value={rentSearch} onChange={(event) => setRentSearch(event.target.value)} placeholder="Cidade, endereço, proprietário, CPF/CNPJ" className="w-full border-none bg-transparent p-0 text-sm text-slate-900 outline-none dark:text-slate-100" />
                </label>
                <label className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Pago de</span>
                  <input type="date" value={rentDateFrom} onChange={(event) => setRentDateFrom(event.target.value)} className="w-full border-none bg-transparent p-0 text-sm text-slate-900 outline-none dark:text-slate-100" />
                </label>
                <label className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Pago até</span>
                  <input type="date" value={rentDateTo} onChange={(event) => setRentDateTo(event.target.value)} className="w-full border-none bg-transparent p-0 text-sm text-slate-900 outline-none dark:text-slate-100" />
                </label>
                <label className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                  <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Exibir</span>
                  <select value={rentPageSize} onChange={(event) => setRentPageSize(Number(event.target.value))} className="w-full border-none bg-transparent p-0 text-sm text-slate-900 outline-none dark:text-slate-100">
                    {detailPageSizeOptions.map((option) => <option key={option} value={option}>{option} linhas</option>)}
                  </select>
                </label>
              </div>

              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200">
                    <TableHead><button type="button" onClick={() => setRentSortConfig((current) => ({ key: 'paidAt', direction: current.key === 'paidAt' && current.direction === 'asc' ? 'desc' : 'asc' }))} className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Pagamento <ArrowUpDown className="h-3.5 w-3.5" /></button></TableHead>
                    <TableHead><button type="button" onClick={() => setRentSortConfig((current) => ({ key: 'city', direction: current.key === 'city' && current.direction === 'asc' ? 'desc' : 'asc' }))} className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Cidade <ArrowUpDown className="h-3.5 w-3.5" /></button></TableHead>
                    <TableHead>Endereço</TableHead>
                    <TableHead><button type="button" onClick={() => setRentSortConfig((current) => ({ key: 'amount', direction: current.key === 'amount' && current.direction === 'asc' ? 'desc' : 'asc' }))} className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Valor <ArrowUpDown className="h-3.5 w-3.5" /></button></TableHead>
                    <TableHead>Proprietário</TableHead>
                    <TableHead>Recibo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRentRecords.length ? paginatedRentRecords.map((item) => (
                    <TableRow key={item.id} className="border-slate-200">
                      <TableCell>{formatDateLabel(item.paidAt)}</TableCell>
                      <TableCell>{item.city || '-'}</TableCell>
                      <TableCell>{item.address || '-'}</TableCell>
                      <TableCell>{formatCurrency(item.amount)}</TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-900 dark:text-slate-100">{item.ownerName || '-'}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{item.ownerDocumentType || '-'} {item.ownerDocumentNumber || ''}</div>
                      </TableCell>
                      <TableCell>
                        {item.receiptUrl ? <a href={item.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 underline-offset-4 hover:underline dark:text-slate-200"><ExternalLink className="h-3.5 w-3.5" />Abrir</a> : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => openRentModal(item)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-900">Editar</button>
                          <button type="button" onClick={() => removeRentRecord(item)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100">Excluir</button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-slate-500">Nenhum lançamento de aluguel encontrado.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              <div className="mt-4 flex flex-col gap-4 border-t border-slate-200 pt-4 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
                <div className="text-sm text-slate-500 dark:text-slate-400">Página {Math.min(rentPage, rentTotalPages)} de {rentTotalPages}</div>
                <Pagination className="mx-0 w-auto justify-start lg:justify-end">
                  <PaginationContent>
                    {Array.from({ length: rentTotalPages }, (_, index) => index + 1).map((pageNumber) => (
                      <PaginationItem key={pageNumber}>
                        <PaginationLink href="#" isActive={pageNumber === Math.min(rentPage, rentTotalPages)} onClick={(event) => { event.preventDefault(); setRentPage(pageNumber); }}>{pageNumber}</PaginationLink>
                      </PaginationItem>
                    ))}
                  </PaginationContent>
                </Pagination>
              </div>
            </SectionCard>
          ) : renderSaveGate()}
        </TabsContent>

        <TabsContent value="mapa">
          {form.id ? (
            <SectionCard
              title="Mapa da Igreja"
              description="Visualize a localização no Google Maps usando coordenadas quando existirem ou o endereço cadastrado como fallback."
              actions={mapLinkUrl ? <a href={mapLinkUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"><ExternalLink className="h-4 w-4" />Abrir no Google Maps</a> : null}
            >
              <div className="mb-5 grid gap-4 lg:grid-cols-3">
                <div className={`rounded-xl ${mutedPanelClass}`}>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Coordenadas</div>
                  <div className="mt-2 text-sm font-semibold text-slate-950 dark:text-slate-50">{form.latitude && form.longitude ? `${form.latitude}, ${form.longitude}` : 'Não informadas'}</div>
                </div>
                <div className={`rounded-xl ${mutedPanelClass}`}>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Endereço usado</div>
                  <div className="mt-2 text-sm font-semibold text-slate-950 dark:text-slate-50">{[form.addressStreet, form.addressNeighborhood, form.addressCity, form.addressState].filter(Boolean).join(' · ') || 'Sem endereço suficiente'}</div>
                </div>
                <div className={`rounded-xl ${mutedPanelClass}`}>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Origem</div>
                  <div className="mt-2 text-sm font-semibold text-slate-950 dark:text-slate-50">{form.latitude && form.longitude ? 'Coordenadas cadastradas' : 'Endereço da igreja'}</div>
                </div>
              </div>

              {mapEmbedUrl ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200"><MapPinned className="h-4 w-4" />Mapa embutido</div>
                  <iframe title="Mapa da igreja" src={mapEmbedUrl} className="h-[420px] w-full bg-slate-100" loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-16 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
                  Informe latitude/longitude ou complete o endereço da igreja na aba Dados para habilitar o mapa.
                </div>
              )}
            </SectionCard>
          ) : renderSaveGate()}
        </TabsContent>
      </Tabs>}
    </div>
  );

  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-900">
      <div>{viewMode === 'list' ? renderListView() : renderDetailView()}</div>

      <Dialog open={contactModalOpen} onOpenChange={setContactModalOpen}>
        <DialogContent className={`max-w-xl ${dialogContentClass}`}>
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <DialogHeader>
              <DialogTitle>{contactForm.id ? 'Editar Contato' : 'Novo Contato'}</DialogTitle>
              <DialogDescription>CRUD completo de contatos vinculados a igreja.</DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-4 px-5 py-5">
            <label className={labelClass}>
              Tipo
              <select value={contactForm.type} onChange={(event) => setContactForm((current) => ({ ...current, type: event.target.value }))} className={fieldClass}>
                <option>Telefone</option>
                <option>WhatsApp</option>
                <option>Email</option>
                <option>Site</option>
                <option>Outro</option>
              </select>
            </label>
            <label className={labelClass}>
              Nome
              <input value={contactForm.name} onChange={(event) => setContactForm((current) => ({ ...current, name: event.target.value }))} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Valor
              <input value={contactForm.value} onChange={(event) => setContactForm((current) => ({ ...current, value: event.target.value }))} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Observacao
              <textarea value={contactForm.notes} onChange={(event) => setContactForm((current) => ({ ...current, notes: event.target.value }))} rows={4} className={fieldClass} />
            </label>
            <SwitchField checked={contactForm.isPrimary} onChange={(checked) => setContactForm((current) => ({ ...current, isPrimary: checked }))} label="Contato principal" />
          </div>
          <DialogFooter className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
            <button type="button" onClick={() => setContactModalOpen(false)} className={secondaryButtonClass}>Cancelar</button>
            <button type="button" onClick={saveContact} disabled={savingContact} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">{savingContact ? 'Salvando...' : 'Salvar contato'}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={functionModalOpen} onOpenChange={setFunctionModalOpen}>
        <DialogContent className={`max-w-2xl ${dialogContentClass}`}>
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <DialogHeader>
              <DialogTitle>{functionForm.id ? 'Editar Funcao' : 'Nova Funcao'}</DialogTitle>
              <DialogDescription>Associa um membro a uma funcao com periodo historico.</DialogDescription>
            </DialogHeader>
          </div>
          <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
            <div className={`${labelClass} md:col-span-2`}>
              Membro
              <button type="button" onClick={() => openMemberPicker('function')} className="mt-2 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                <span>{selectedFunctionMember ? selectedFunctionMember.fullName : 'Buscar e selecionar membro'}</span>
                <UserRound className="h-4 w-4" />
              </button>
            </div>
            <label className={`${labelClass} md:col-span-2`}>
              Funcao
              <select value={functionForm.functionId} onChange={(event) => setFunctionForm((current) => ({ ...current, functionId: event.target.value }))} className={fieldClass}>
                <option value="">Selecione a funcao</option>
                {functionCatalog.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Departamento
              <>
                <input list="church-department-options" value={functionForm.department} onChange={(event) => setFunctionForm((current) => ({ ...current, department: event.target.value }))} className={fieldClass} placeholder="Ex.: Jovens, CIBE, Louvor" />
                <datalist id="church-department-options">
                  {departmentOptions.map((item) => <option key={item} value={item} />)}
                </datalist>
              </>
            </label>
            <label className={labelClass}>
              Data de inicio
              <input type="date" value={functionForm.startDate} onChange={(event) => setFunctionForm((current) => ({ ...current, startDate: event.target.value }))} className={fieldClass} />
            </label>
            <label className={labelClass}>
              Data de termino
              <input type="date" value={functionForm.endDate} onChange={(event) => setFunctionForm((current) => ({ ...current, endDate: event.target.value }))} className={fieldClass} />
            </label>
            <div className={labelClass}>
              Status
              <div className={`mt-2 ${mutedPanelClass}`}>
                <SwitchField checked={functionForm.isActive} onChange={(checked) => setFunctionForm((current) => ({ ...current, isActive: checked }))} label={functionForm.isActive ? 'Função ativa' : 'Função encerrada'} />
              </div>
            </div>
            <label className={`${labelClass} md:col-span-2`}>
              Observacoes
              <textarea value={functionForm.notes} onChange={(event) => setFunctionForm((current) => ({ ...current, notes: event.target.value }))} rows={4} className={fieldClass} />
            </label>
          </div>
          <DialogFooter className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
            <button type="button" onClick={() => setFunctionModalOpen(false)} className={secondaryButtonClass}>Cancelar</button>
            <button type="button" onClick={saveFunctionAssignment} disabled={savingFunction} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">{savingFunction ? 'Salvando...' : 'Salvar funcao'}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={leaderModalOpen} onOpenChange={setLeaderModalOpen}>
        <DialogContent className={`flex max-h-[90vh] w-[min(96vw,1180px)] max-w-[1180px] flex-col overflow-hidden ${dialogContentClass}`}>
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <DialogHeader>
              <DialogTitle>{leaderChangeForm.id ? 'Editar Troca de Dirigente' : 'Novo Dirigente'}</DialogTitle>
              <DialogDescription>{leaderChangeForm.id ? 'Atualize os dados da movimentação selecionada.' : 'Encerra o dirigente atual e cria um novo registro historico.'}</DialogDescription>
            </DialogHeader>
          </div>
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className={`${mutedPanelClass} text-sm text-slate-700 dark:text-slate-300`}>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Dirigente atual</div>
                <div className="mt-2 font-semibold text-slate-900 dark:text-slate-100">{form.currentLeaderName || 'Sem dados'}</div>
              </div>
              <div className={`${mutedPanelClass} text-sm text-slate-700 dark:text-slate-300`}>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Novo dirigente</div>
                <div className="mt-2 font-semibold text-slate-900 dark:text-slate-100">{selectedLeaderMember?.fullName || 'Selecione um membro'}</div>
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">A saída do dirigente anterior será atualizada automaticamente quando a troca for salva.</div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className={labelClass}>
                Funcao
                <select value={leaderChangeForm.functionId} onChange={(event) => setLeaderChangeForm((current) => ({ ...current, functionId: event.target.value }))} className={fieldClass}>
                  <option value="">Selecione a funcao</option>
                  {(leaderRoleOptions.length ? leaderRoleOptions : functionCatalog).map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
              <div className={labelClass}>
                Novo dirigente (membro)
                <button type="button" onClick={() => openMemberPicker('leader')} className="mt-2 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800">
                  <span>{selectedLeaderMember ? selectedLeaderMember.fullName : 'Buscar e selecionar membro'}</span>
                  <UserRound className="h-4 w-4" />
                </button>
              </div>
              <label className={labelClass}>
                Data de entrada
                <input type="date" value={leaderChangeForm.entryDate} onChange={(event) => setLeaderChangeForm((current) => ({ ...current, entryDate: event.target.value }))} className={fieldClass} />
              </label>
              <label className={labelClass}>
                Quem indicou o dirigente
                <input value={leaderChangeForm.indicatedBy} onChange={(event) => setLeaderChangeForm((current) => ({ ...current, indicatedBy: event.target.value }))} className={fieldClass} />
              </label>
              <label className={`${labelClass} md:col-span-2`}>
                Motivo da troca
                <textarea value={leaderChangeForm.changeReason} onChange={(event) => setLeaderChangeForm((current) => ({ ...current, changeReason: event.target.value }))} rows={3} className={fieldClass} />
              </label>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="mb-4 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Resumo da transição</div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className={labelClass}>
                  Caixa atual
                  <input value={leaderChangeForm.currentCash} onChange={(event) => setLeaderChangeForm((current) => ({ ...current, currentCash: event.target.value }))} className={fieldClass} />
                </label>
                <label className={labelClass}>
                  Maior valor de entrada
                  <input value={leaderChangeForm.maxIncome} onChange={(event) => setLeaderChangeForm((current) => ({ ...current, maxIncome: event.target.value }))} className={fieldClass} />
                </label>
                <label className={labelClass}>
                  Media de entrada
                  <input value={leaderChangeForm.averageIncome} onChange={(event) => setLeaderChangeForm((current) => ({ ...current, averageIncome: event.target.value }))} className={fieldClass} />
                </label>
                <label className={labelClass}>
                  Media de saida
                  <input value={leaderChangeForm.averageExpense} onChange={(event) => setLeaderChangeForm((current) => ({ ...current, averageExpense: event.target.value }))} className={fieldClass} />
                </label>
                <label className={labelClass}>
                  Total de membros
                  <input value={leaderChangeForm.totalMembers} onChange={(event) => setLeaderChangeForm((current) => ({ ...current, totalMembers: event.target.value }))} className={fieldClass} />
                </label>
                <label className={labelClass}>
                  Total de obreiros
                  <input value={leaderChangeForm.totalWorkers} onChange={(event) => setLeaderChangeForm((current) => ({ ...current, totalWorkers: event.target.value }))} className={fieldClass} />
                </label>
                <label className={`${labelClass} md:col-span-2`}>
                  Observacoes
                  <textarea value={leaderChangeForm.notes} onChange={(event) => setLeaderChangeForm((current) => ({ ...current, notes: event.target.value }))} rows={4} className={fieldClass} />
                </label>
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
            <button type="button" onClick={() => setLeaderModalOpen(false)} className={secondaryButtonClass}>Cancelar</button>
            <button type="button" onClick={saveLeaderChange} disabled={savingLeaderChange} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">{savingLeaderChange ? 'Salvando...' : leaderChangeForm.id ? 'Salvar alterações' : 'Trocar dirigente'}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(leaderHistoryDetails)} onOpenChange={(open) => { if (!open) setLeaderHistoryDetails(null); }}>
        <DialogContent className={`max-w-3xl ${dialogContentClass}`}>
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <DialogHeader>
              <DialogTitle>Detalhes da Troca de Dirigente</DialogTitle>
              <DialogDescription>Resumo completo da movimentação selecionada.</DialogDescription>
            </DialogHeader>
          </div>
          {leaderHistoryDetails ? (
            <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
              <div className={mutedPanelClass}>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Anterior</div>
                <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{leaderHistoryDetails.previousLeaderMember?.fullName || '-'}</div>
              </div>
              <div className={mutedPanelClass}>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Novo dirigente</div>
                <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{leaderHistoryDetails.newLeaderMember?.fullName || '-'}</div>
              </div>
              <div className={mutedPanelClass}>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Função</div>
                <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{leaderHistoryDetails.function?.name || '-'}</div>
              </div>
              <div className={mutedPanelClass}>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Entrada</div>
                <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{formatDateLabel(leaderHistoryDetails.entryDate)}</div>
              </div>
              <div className={mutedPanelClass}>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Quem indicou</div>
                <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{leaderHistoryDetails.indicatedBy || '-'}</div>
              </div>
              <div className={mutedPanelClass}>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Saída anterior</div>
                <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{formatDateLabel(leaderHistoryDetails.previousExitDate)}</div>
              </div>
              <div className={`${mutedPanelClass} md:col-span-2`}>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Motivo</div>
                <div className="mt-2 text-sm text-slate-700 dark:text-slate-300">{leaderHistoryDetails.changeReason || '-'}</div>
              </div>
              <div className={mutedPanelClass}>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Caixa atual</div>
                <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(leaderHistoryDetails.currentCash)}</div>
              </div>
              <div className={mutedPanelClass}>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Maior entrada</div>
                <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(leaderHistoryDetails.maxIncome)}</div>
              </div>
              <div className={mutedPanelClass}>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Média de entrada</div>
                <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(leaderHistoryDetails.averageIncome)}</div>
              </div>
              <div className={mutedPanelClass}>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Média de saída</div>
                <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(leaderHistoryDetails.averageExpense)}</div>
              </div>
              <div className={mutedPanelClass}>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Total de membros</div>
                <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{leaderHistoryDetails.totalMembers ?? '-'}</div>
              </div>
              <div className={mutedPanelClass}>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Total de obreiros</div>
                <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{leaderHistoryDetails.totalWorkers ?? '-'}</div>
              </div>
              <div className={`${mutedPanelClass} md:col-span-2`}>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Observações</div>
                <div className="mt-2 text-sm text-slate-700 dark:text-slate-300">{leaderHistoryDetails.notes || '-'}</div>
              </div>
            </div>
          ) : null}
          <DialogFooter className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
            <button type="button" onClick={() => setLeaderHistoryDetails(null)} className={secondaryButtonClass}>Fechar</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={locationHelperOpen} onOpenChange={setLocationHelperOpen}>
        <DialogContent className={`flex h-[100dvh] max-h-[100dvh] w-screen max-w-none flex-col overflow-hidden rounded-none sm:h-auto sm:max-h-[92vh] sm:w-[70vw] sm:max-w-[70vw] sm:rounded-lg ${dialogContentClass}`}>
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <DialogHeader>
              <DialogTitle>Localizar endereço no mapa</DialogTitle>
              <DialogDescription>Pesquise o endereço da igreja, visualize no Google Maps e aplique as coordenadas com um clique.</DialogDescription>
            </DialogHeader>
          </div>
          <div className="grid flex-1 gap-5 overflow-hidden px-5 py-5 lg:grid-cols-[420px_minmax(0,1fr)]">
            <div className="space-y-4">
              <div className="grid gap-3">
                <input
                  value={locationSearch}
                  onChange={(event) => setLocationSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      searchLocationCandidates(locationSearch);
                    }
                  }}
                  placeholder="Rua, bairro, cidade ou CEP"
                  className={fieldClass}
                />
                <div className="flex gap-2">
                  <button type="button" onClick={() => searchLocationCandidates(locationSearch)} disabled={locationSearchLoading} className="flex-1 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
                    {locationSearchLoading ? 'Buscando...' : 'Buscar endereço'}
                  </button>
                  <button type="button" onClick={lookupZipcode} disabled={zipcodeLookupLoading} className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900">
                    CEP
                  </button>
                </div>
              </div>

              <div className="flex min-h-0 flex-col rounded-2xl border border-slate-200 dark:border-slate-800">
                <div className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:border-slate-800 dark:text-slate-400">Endereços encontrados</div>
                <div className="max-h-[420px] overflow-y-auto lg:flex-1">
                  {locationSearchResults.length ? locationSearchResults.map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => applyLocationCandidate(candidate)}
                      onMouseEnter={() => setSelectedLocationPreview(candidate)}
                      className="flex w-full flex-col items-start gap-2 border-b border-slate-200 px-4 py-3 text-left text-sm last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900"
                    >
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{candidate.city || candidate.street || 'Endereço localizado'}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{candidate.label}</span>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Usar coordenadas</span>
                    </button>
                  )) : (
                    <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">Pesquise por CEP ou endereço para ver opções de localização.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/60">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">Preview no mapa</div>
                  <div className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{selectedLocationPreview?.label || buildAddressSearchLabel(form) || 'Sem endereço definido'}</div>
                </div>
                {buildGoogleMapsLink({
                  latitude: selectedLocationPreview?.lat || form.latitude,
                  longitude: selectedLocationPreview?.lon || form.longitude,
                  addressStreet: form.addressStreet,
                  addressNeighborhood: form.addressNeighborhood,
                  addressCity: form.addressCity,
                  addressState: form.addressState,
                  addressZipcode: form.addressZipcode,
                }) ? (
                  <a
                    href={buildGoogleMapsLink({
                      latitude: selectedLocationPreview?.lat || form.latitude,
                      longitude: selectedLocationPreview?.lon || form.longitude,
                      addressStreet: form.addressStreet,
                      addressNeighborhood: form.addressNeighborhood,
                      addressCity: form.addressCity,
                      addressState: form.addressState,
                      addressZipcode: form.addressZipcode,
                    })}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 underline-offset-4 hover:underline dark:text-slate-200"
                  >
                    <ExternalLink className="h-4 w-4" />Abrir Google
                  </a>
                ) : null}
              </div>
              <iframe
                title="Pré-visualização do endereço"
                src={buildLocationPreviewUrl(locationSearch, selectedLocationPreview, form)}
                className="min-h-[520px] flex-1 w-full bg-slate-100"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
          <DialogFooter className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
            <button type="button" onClick={() => setLocationHelperOpen(false)} className={secondaryButtonClass}>Fechar</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rentModalOpen} onOpenChange={setRentModalOpen}>
        <DialogContent className={`max-w-3xl ${dialogContentClass}`}>
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <DialogHeader>
              <DialogTitle>{rentForm.id ? 'Editar lançamento de aluguel' : 'Novo lançamento de aluguel'}</DialogTitle>
              <DialogDescription>Registre endereço, valor, proprietário e recibo do aluguel desta igreja.</DialogDescription>
            </DialogHeader>
          </div>
          <div className="grid gap-4 px-5 py-5 md:grid-cols-2">
            <label className={labelClass}>Cidade<input value={rentForm.city} onChange={(event) => setRentForm((current) => ({ ...current, city: event.target.value }))} className={fieldClass} /></label>
            <label className={labelClass}>Data de pagamento<input type="date" value={rentForm.paidAt} onChange={(event) => setRentForm((current) => ({ ...current, paidAt: event.target.value }))} className={fieldClass} /></label>
            <label className={`${labelClass} md:col-span-2`}>Endereço<input value={rentForm.address} onChange={(event) => setRentForm((current) => ({ ...current, address: event.target.value }))} className={fieldClass} /></label>
            <label className={labelClass}>Valor<input inputMode="numeric" value={rentForm.amount} onChange={(event) => setRentForm((current) => ({ ...current, amount: formatCurrencyInput(event.target.value) }))} placeholder="R$ 0,00" className={fieldClass} /></label>
            <label className={labelClass}>Proprietário<input value={rentForm.ownerName} onChange={(event) => setRentForm((current) => ({ ...current, ownerName: event.target.value }))} className={fieldClass} /></label>
            <label className={labelClass}>Tipo de documento<select value={rentForm.ownerDocumentType} onChange={(event) => setRentForm((current) => ({ ...current, ownerDocumentType: event.target.value }))} className={fieldClass}><option value="CPF">CPF</option><option value="CNPJ">CNPJ</option></select></label>
            <label className={labelClass}>CPF/CNPJ<input value={rentForm.ownerDocumentNumber} onChange={(event) => setRentForm((current) => ({ ...current, ownerDocumentNumber: event.target.value }))} className={fieldClass} /></label>
            <div className={`${labelClass} md:col-span-2`}>
              Recibo
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-900">
                  <Upload className="h-4 w-4" />Enviar recibo
                  <input type="file" className="hidden" accept="image/*,.pdf" onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    try {
                      const uploaded = await uploadReceipt(file);
                      setRentForm((current) => ({ ...current, receiptUrl: uploaded.url }));
                    } catch (uploadError) {
                      setDetailError(uploadError.message || 'Falha ao enviar recibo.');
                    }
                  }} />
                </label>
                {rentForm.receiptUrl ? <a href={rentForm.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 underline-offset-4 hover:underline dark:text-slate-200"><ExternalLink className="h-4 w-4" />Abrir recibo atual</a> : <span className="text-sm text-slate-500 dark:text-slate-400">Nenhum recibo enviado.</span>}
              </div>
            </div>
            <div className={labelClass}>
              Status
              <div className={`mt-2 ${mutedPanelClass}`}>
                <SwitchField checked={rentForm.isActive} onChange={(checked) => setRentForm((current) => ({ ...current, isActive: checked }))} label={rentForm.isActive ? 'Lançamento ativo' : 'Lançamento encerrado'} />
              </div>
            </div>
            <label className={`${labelClass} md:col-span-2`}>Observações<textarea value={rentForm.notes} onChange={(event) => setRentForm((current) => ({ ...current, notes: event.target.value }))} rows={4} className={fieldClass} /></label>
          </div>
          <DialogFooter className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
            <button type="button" onClick={() => setRentModalOpen(false)} className={secondaryButtonClass}>Cancelar</button>
            <button type="button" onClick={saveRentRecord} disabled={savingRent} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">{savingRent ? 'Salvando...' : 'Salvar lançamento'}</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={memberPickerOpen} onOpenChange={setMemberPickerOpen}>
        <DialogContent className={`max-w-3xl ${dialogContentClass}`}>
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <DialogHeader>
              <DialogTitle>Buscar membro</DialogTitle>
              <DialogDescription>Use o mesmo padrão de busca de membros para dirigente e funções desta igreja.</DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-4 px-5 py-5">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px]">
              <input
                value={memberSearch}
                onChange={(event) => setMemberSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    runMemberSearch();
                  }
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setActiveMemberIndex((current) => Math.min(current + 1, Math.max(filteredMemberResults.length - 1, 0)));
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setActiveMemberIndex((current) => Math.max(current - 1, 0));
                  }
                }}
                placeholder="Digite nome ou rol do membro"
                className={fieldClass}
              />
              <button type="button" onClick={runMemberSearch} className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">{memberSearchLoading ? 'Buscando...' : 'Buscar'}</button>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="border-b border-slate-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:border-slate-800 dark:text-slate-400">Resultados</div>
              <div className="max-h-[360px] overflow-y-auto">
                {!memberSearchPerformed ? (
                  <div className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">Digite um nome ou rol e clique em buscar.</div>
                ) : filteredMemberResults.length ? filteredMemberResults.map((member, index) => (
                  <button
                    key={member.id}
                    type="button"
                    ref={(element) => { memberOptionRefs.current[index] = element; }}
                    onClick={() => handleMemberSelected(member)}
                    onMouseEnter={() => setActiveMemberIndex(index)}
                    className={`flex w-full items-center justify-between border-b border-slate-200 px-4 py-3 text-left text-sm last:border-b-0 dark:border-slate-800 ${index === activeMemberIndex ? 'bg-slate-100 dark:bg-slate-800' : 'bg-white dark:bg-slate-950'}`}
                  >
                    <div>
                      <div className="font-semibold text-slate-950 dark:text-slate-50">{member.fullName}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Rol {member.rol || 'N/I'}</div>
                    </div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Selecionar</div>
                  </button>
                )) : (
                  <div className="px-4 py-12 text-center text-sm text-slate-500 dark:text-slate-400">Nenhum membro encontrado para esse filtro.</div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
            <button type="button" onClick={() => setMemberPickerOpen(false)} className={secondaryButtonClass}>Fechar</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(photoPreview)} onOpenChange={(open) => { if (!open) setPhotoPreview(null); }}>
        <DialogContent className={`max-w-5xl ${dialogContentClass}`}>
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <DialogHeader>
              <DialogTitle>Visualizar imagem</DialogTitle>
              <DialogDescription>{photoPreview?.fieldName || form.name || 'Imagem da igreja'}</DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-4 px-5 py-5">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setPhotoZoom((current) => Math.max(0.5, Number((current - 0.25).toFixed(2))))} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-900"><ZoomOut className="h-4 w-4" />Menos zoom</button>
              <button type="button" onClick={() => setPhotoZoom((current) => Math.min(3, Number((current + 0.25).toFixed(2))))} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-900"><ZoomIn className="h-4 w-4" />Mais zoom</button>
              <button type="button" onClick={() => setPhotoRotation((current) => current + 90)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-900"><RotateCw className="h-4 w-4" />Girar</button>
              {photoPreview?.photoUrl ? <a href={photoPreview.photoUrl} download target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-900"><Download className="h-4 w-4" />Baixar</a> : null}
            </div>
            <div className="flex min-h-[480px] items-center justify-center overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900/50">
              {photoPreview?.photoUrl ? <img src={photoPreview.photoUrl} alt={photoPreview.fieldName || form.name || 'Imagem da igreja'} style={{ transform: `scale(${photoZoom}) rotate(${photoRotation}deg)` }} className="max-h-[70vh] max-w-full rounded-xl object-contain transition-transform duration-200" /> : <div className="text-sm text-slate-500">Imagem indisponível.</div>}
            </div>
          </div>
          <DialogFooter className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
            <button type="button" onClick={() => setPhotoPreview(null)} className={secondaryButtonClass}>Fechar</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingConfirm)}
        title={pendingConfirm?.title || ''}
        message={pendingConfirm?.message || ''}
        confirmLabel="Excluir"
        variant="danger"
        loading={confirmLoading}
        onConfirm={async () => {
          if (!pendingConfirm) return;
          try {
            setConfirmLoading(true);
            await pendingConfirm.onConfirm();
            setPendingConfirm(null);
          } finally {
            setConfirmLoading(false);
          }
        }}
        onCancel={() => (confirmLoading ? null : setPendingConfirm(null))}
      />

      <PrintModal
        open={printModalOpen}
        onClose={() => setPrintModalOpen(false)}
        sortOptions={[
          { value: 'code', label: 'Código' },
          { value: 'name', label: 'Igreja' },
          { value: 'campoName', label: 'Campo' },
          { value: 'regionalName', label: 'Regional' },
          { value: 'leader', label: 'Dirigente' },
          { value: 'city', label: 'Cidade' },
          { value: 'state', label: 'UF' },
          { value: 'statusLabel', label: 'Status' },
        ]}
        columnOptions={[
          { value: 'code', label: 'Código' },
          { value: 'name', label: 'Igreja' },
          { value: 'campoName', label: 'Campo' },
          { value: 'regionalName', label: 'Regional' },
          { value: 'leader', label: 'Dirigente' },
          { value: 'city', label: 'Cidade' },
          { value: 'state', label: 'UF' },
          { value: 'statusLabel', label: 'Status' },
        ]}
        defaultSort="name"
        onPrint={(orientation, sortBy, selectedColumns) => {
          const sorted = [...sortedChurches].sort((a, b) =>
            String(a[sortBy as keyof typeof a] ?? '').localeCompare(String(b[sortBy as keyof typeof b] ?? ''), 'pt-BR')
          );
          const allCols = [
            { label: 'Código', key: 'code', width: '80px' },
            { label: 'Igreja', key: 'name' },
            { label: 'Campo', key: 'campoName', width: '100px' },
            { label: 'Regional', key: 'regionalName', width: '100px' },
            { label: 'Dirigente', key: 'leader' },
            { label: 'Cidade', key: 'city', width: '90px' },
            { label: 'UF', key: 'state', width: '40px' },
            { label: 'Status', key: 'statusLabel', width: '60px' },
          ];
          printReport({
            title: 'Tabela de Igrejas',
            subtitle: filters.campoId ? `Campo: ${sorted[0]?.campoName || ''}` : undefined,
            orientation,
            columns: allCols.filter((c) => selectedColumns.includes(c.key)),
            rows: sorted.map((c) => ({
              code: c.code || '—',
              name: c.name,
              campoName: c.campoName,
              regionalName: c.regionalName,
              leader: c.leader,
              city: c.city,
              state: c.state,
              statusLabel: c.statusLabel,
            })),
          });
        }}
      />
    </div>
  );
}
