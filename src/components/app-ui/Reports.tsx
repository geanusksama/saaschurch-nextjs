import { useEffect, useMemo, useState, type ComponentType } from 'react';
import ReactECharts from 'echarts-for-react';
import * as XLSX from 'xlsx';
import {
  ArrowRightLeft,
  Award,
  BarChart3,
  Building2,
  Cake,
  Calendar,
  Filter,
  ClipboardList,
  CreditCard,
  Copy,
  ChevronDown,
  CheckSquare,
  Droplets,
  Eye,
  FileSpreadsheet,
  Heart,
  LayoutDashboard,
  Loader2,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Shield,
  Settings2,
  ShieldAlert,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { apiBase } from '../../lib/apiBase';
import { usePermissions } from '../../lib/usePermissions';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

type ReportsTabKey = 'reports' | 'dashboards';
type ReportLauncherKey =
  | 'members'
  | 'baptism'
  | 'consecration'
  | 'transfers'
  | 'requirements'
  | 'churches'
  | 'roles'
  | 'birthdays'
  | 'attendance'
  | 'credentials'
  | 'users';
type ChartTypeKey =
  | 'bar'
  | 'bar-label'
  | 'geo-map'
  | 'bar-horizontal'
  | 'bar-multiple'
  | 'stacked-bar'
  | 'stacked-bar-vertical'
  | 'negative-bar'
  | 'line'
  | 'line-multiple'
  | 'line-points'
  | 'line-values'
  | 'area'
  | 'area-multiple'
  | 'pie'
  | 'pie-label'
  | 'doughnut'
  | 'radar'
  | 'funnel'
  | 'metric'
  | 'table';
type GridSizeKey = 'small' | 'medium' | 'large' | 'full';
type LegendPositionKey = 'top' | 'bottom' | 'left' | 'right';
type DatePresetKey = 'all' | '30d' | '90d' | '180d' | '365d' | 'custom';

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
  currentLeaderName?: string | null;
  currentLeaderRole?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  addressStreet?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  addressNeighborhood?: string | null;
  addressZipcode?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  addressCountry?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  regionalId?: string | null;
  regional?: {
    id?: string;
    name?: string;
    campoId?: string | null;
    campo?: { id?: string; name?: string; code?: string | null } | null;
  } | null;
};

type MemberReportItem = {
  id: string;
  fullName: string;
  preferredName?: string | null;
  cpf?: string | null;
  birthDate?: string | null;
  createdAt?: string | null;
  membershipDate?: string | null;
  baptismDate?: string | null;
  gender?: string | null;
  maritalStatus?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  nationality?: string | null;
  voterRegistration?: string | null;
  voterZone?: string | null;
  voterSection?: string | null;
  membershipStatus?: string | null;
  memberType?: string | null;
  baptismStatus?: string | null;
  ecclesiasticalTitle?: string | null;
  fatherName?: string | null;
  motherName?: string | null;
  spouseName?: string | null;
  ecclesiasticalTitleRef?: { id?: string; name?: string | null; abbreviation?: string | null; level?: number | null } | null;
  church?: {
    id?: string;
    name?: string | null;
    code?: string | null;
    currentLeaderName?: string | null;
    currentLeaderRole?: string | null;
    addressStreet?: string | null;
    addressNumber?: string | null;
    addressNeighborhood?: string | null;
    addressCity?: string | null;
    addressState?: string | null;
    addressCountry?: string | null;
    regional?: {
      id?: string;
      name?: string | null;
      code?: string | null;
      campoId?: string | null;
      campo?: { id?: string; name?: string | null; code?: string | null } | null;
    } | null;
  } | null;
  regional?: { id?: string; name?: string | null; code?: string | null } | null;
};

type DashboardApiPayload = {
  stats?: {
    totalMembers?: number;
    newMembersThisMonth?: number;
    membersChangePct?: number | null;
    newLeadsThisMonth?: number;
    leadsChangePct?: number | null;
    upcomingEventsCount?: number;
    openCards?: number;
  };
  attendanceChart?: Array<{
    name: string;
    referenceDate?: string;
    presenca: number;
    visitantes: number;
  }>;
  activities?: Array<{
    id: string;
    title: string;
    description?: string;
    time?: string;
  }>;
};

type BaptismDashboardPayload = {
  queue?: Array<{
    id: string;
    protocol: string;
    statusLabel: string;
    openedAt?: string | null;
    baptismDate?: string | null;
    member?: { fullName?: string | null; ecclesiasticalTitle?: string | null; membershipStatus?: string | null; memberType?: string | null } | null;
    church?: { name?: string | null; code?: string | null } | null;
    service?: { description?: string | null } | null;
    nextBaptism?: { scheduledDate?: string | null } | null;
    columnIndex?: number;
  }>;
  schedules?: Array<{
    id: string;
    churchName: string;
    churchCode?: string | null;
    scheduledDate: string;
  }>;
  stats?: {
    pendingCount?: number;
    approvedCount?: number;
    cancelledCount?: number;
  };
};

type ConsecrationDashboardPayload = {
  queue?: Array<{
    id: string;
    protocol: string;
    statusLabel: string;
    openedAt?: string | null;
    consecrationDate?: string | null;
    intendedTitle?: string | null;
    currentTitle?: string | null;
    member?: { fullName?: string | null; membershipStatus?: string | null; ecclesiasticalTitle?: string | null; memberType?: string | null } | null;
    church?: { name?: string | null; code?: string | null } | null;
    service?: { description?: string | null } | null;
    nextConsecration?: { scheduledDate?: string | null } | null;
    columnIndex?: number;
  }>;
  schedules?: Array<{
    id: string;
    churchName: string;
    churchCode?: string | null;
    scheduledDate: string;
  }>;
  stats?: {
    totalCount?: number;
    pendingCount?: number;
    completedCount?: number;
  };
};

type TransferDashboardPayload = {
  queue?: Array<{
    id: string;
    protocol: string;
    statusLabel: string;
    openedAt?: string | null;
    currentTitle?: string | null;
    member?: { fullName?: string | null; ecclesiasticalTitle?: string | null; membershipStatus?: string | null } | null;
    church?: { name?: string | null; code?: string | null } | null;
    destinationChurch?: { name?: string | null; code?: string | null } | null;
    service?: { description?: string | null } | null;
    columnIndex?: number;
  }>;
  history?: Array<{
    id: string;
    action?: string | null;
    statusLabel?: string | null;
    createdAt?: string | null;
  }>;
  statusOptions?: Array<{
    value: string;
    label: string;
  }>;
};

type SecretariatService = {
  id: number;
  sigla: string;
  description: string;
  serviceGroup?: string | null;
  usesMatrix?: boolean;
  isActive?: boolean;
  stageCount?: number;
  ruleCount?: number;
  pipelineCount?: number;
};

type SourceRecord = Record<string, string | number | null | undefined>;

type SourceDimension = {
  key: string;
  label: string;
};

type SourceMetric = {
  key: string;
  label: string;
};

type SourceDefinition = {
  key: string;
  label: string;
  description: string;
  records: SourceRecord[];
  dimensions: SourceDimension[];
  metrics: SourceMetric[];
  defaultDimensionKey: string;
  defaultMetricKeys: string[];
  joinHint: string;
  dateKey?: string;
  churchKeys?: string[];
  latitudeKey?: string;
  longitudeKey?: string;
};

type SavedChartConfig = {
  id: string;
  title: string;
  sourceKey: string;
  chartType: ChartTypeKey;
  dimensionKey: string;
  metricKeys: string[];
  gridSize: GridSizeKey;
  showTable: boolean;
  showLegend: boolean;
  legendPosition: LegendPositionKey;
  showTotals: boolean;
};

type SavedDashboard = {
  id: string;
  name: string;
  charts: SavedChartConfig[];
};

type ReportLauncherCard = {
  key: ReportLauncherKey;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  gradientClass: string;
  ringClass: string;
  modalDescription: string;
  modalHighlights: string[];
};

type PersistedReportsState = {
  activeDashboardId: string;
  dashboards: SavedDashboard[];
};

type MemberReportTypeKey = 'members_list' | 'grouped_church' | 'grouped_regional' | 'growth_report' | 'grouped_title';
type BaptismReportTypeKey = 'queue_list' | 'grouped_status' | 'grouped_church' | 'grouped_regional' | 'scheduled_report';
type ConsecrationReportTypeKey = 'queue_list' | 'grouped_status' | 'grouped_church' | 'grouped_regional' | 'title_progress';
type TransferReportTypeKey = 'queue_list' | 'grouped_status' | 'grouped_origin' | 'grouped_destination' | 'route_report';
type MemberReportGroupKey =
  | 'field'
  | 'regional'
  | 'church'
  | 'ecclesiastical_title'
  | 'gender'
  | 'status'
  | 'marital_status'
  | 'city'
  | 'state'
  | 'country'
  | 'age_range';
type BaptismReportGroupKey =
  | 'field'
  | 'regional'
  | 'church'
  | 'workflow_status'
  | 'service'
  | 'member_status'
  | 'ecclesiastical_title';
type ConsecrationReportGroupKey =
  | 'field'
  | 'regional'
  | 'church'
  | 'workflow_status'
  | 'service'
  | 'member_status'
  | 'current_title'
  | 'intended_title';
type TransferReportGroupKey =
  | 'origin_field'
  | 'origin_regional'
  | 'origin_church'
  | 'destination_field'
  | 'destination_regional'
  | 'destination_church'
  | 'workflow_status'
  | 'member_status'
  | 'current_title';
type MemberReportColumnKey =
  | 'name'
  | 'cpf'
  | 'father_name'
  | 'mother_name'
  | 'spouse_name'
  | 'birth_date'
  | 'age'
  | 'contact'
  | 'email'
  | 'voter_title'
  | 'church'
  | 'church_code'
  | 'regional'
  | 'field'
  | 'title'
  | 'status'
  | 'gender'
  | 'marital_status'
  | 'age_range'
  | 'membership_date'
  | 'baptism_date'
  | 'leader_name'
  | 'leader_role'
  | 'church_address'
  | 'church_city'
  | 'church_state'
  | 'church_country'
  | 'member_city'
  | 'member_state'
  | 'member_country';
type BaptismReportColumnKey =
  | 'protocol'
  | 'name'
  | 'church'
  | 'regional'
  | 'field'
  | 'title'
  | 'member_status'
  | 'workflow_status'
  | 'service'
  | 'opened_at'
  | 'baptism_date'
  | 'next_baptism_date';
type ConsecrationReportColumnKey =
  | 'protocol'
  | 'name'
  | 'church'
  | 'regional'
  | 'field'
  | 'member_status'
  | 'workflow_status'
  | 'service'
  | 'current_title'
  | 'intended_title'
  | 'opened_at'
  | 'consecration_date'
  | 'next_consecration_date';
type TransferReportColumnKey =
  | 'protocol'
  | 'name'
  | 'origin_church'
  | 'origin_regional'
  | 'origin_field'
  | 'destination_church'
  | 'destination_regional'
  | 'destination_field'
  | 'current_title'
  | 'member_status'
  | 'workflow_status'
  | 'service'
  | 'opened_at';
type MemberReportMetricKey = 'count' | 'active' | 'women' | 'men' | 'titled';
type BaptismReportMetricKey = 'count';
type ConsecrationReportMetricKey = 'count';
type TransferReportMetricKey = 'count';
type MemberReportSortDirection = 'asc' | 'desc';
type MemberReportOrientation = 'portrait' | 'landscape';

type MemberReportBuilderState = {
  reportType: MemberReportTypeKey;
  dateFrom: string;
  dateTo: string;
  fieldIds: string[];
  regionalIds: string[];
  churchIds: string[];
  statuses: string[];
  memberTypes: string[];
  groupBy: MemberReportGroupKey[];
  columns: MemberReportColumnKey[];
  metric: MemberReportMetricKey;
  sortBy: MemberReportColumnKey;
  sortDirection: MemberReportSortDirection;
  orientation: MemberReportOrientation;
  zebraEnabled: boolean;
  zebraColor: string;
};

type BaptismReportBuilderState = {
  reportType: BaptismReportTypeKey;
  dateFrom: string;
  dateTo: string;
  fieldIds: string[];
  regionalIds: string[];
  churchIds: string[];
  workflowStatuses: string[];
  memberStatuses: string[];
  memberTypes: string[];
  groupBy: BaptismReportGroupKey[];
  columns: BaptismReportColumnKey[];
  metric: BaptismReportMetricKey;
  sortBy: BaptismReportColumnKey;
  sortDirection: MemberReportSortDirection;
  orientation: MemberReportOrientation;
  zebraEnabled: boolean;
  zebraColor: string;
};

type ConsecrationReportBuilderState = {
  reportType: ConsecrationReportTypeKey;
  dateFrom: string;
  dateTo: string;
  fieldIds: string[];
  regionalIds: string[];
  churchIds: string[];
  workflowStatuses: string[];
  memberStatuses: string[];
  memberTypes: string[];
  groupBy: ConsecrationReportGroupKey[];
  columns: ConsecrationReportColumnKey[];
  metric: ConsecrationReportMetricKey;
  sortBy: ConsecrationReportColumnKey;
  sortDirection: MemberReportSortDirection;
  orientation: MemberReportOrientation;
  zebraEnabled: boolean;
  zebraColor: string;
};

type TransferReportBuilderState = {
  reportType: TransferReportTypeKey;
  dateFrom: string;
  dateTo: string;
  fieldIds: string[];
  regionalIds: string[];
  churchIds: string[];
  destinationChurchIds: string[];
  workflowStatuses: string[];
  memberStatuses: string[];
  groupBy: TransferReportGroupKey[];
  columns: TransferReportColumnKey[];
  metric: TransferReportMetricKey;
  sortBy: TransferReportColumnKey;
  sortDirection: MemberReportSortDirection;
  orientation: MemberReportOrientation;
  zebraEnabled: boolean;
  zebraColor: string;
};

type ChurchReportMode = 'single' | 'list';
type ChurchReportGroupKey = 'field' | 'regional' | 'church';
type ChurchReportSectionKey = 'leaders' | 'functions' | 'titles' | 'baptisms' | 'consecrations' | 'new_members' | 'stats';
type ChurchReportColumnKey = 'field' | 'regional' | 'church' | 'leaderName' | 'totalMembers' | 'pastors' | 'diaconos' | 'membros' | 'baptisms' | 'consecrations' | 'newMembers';

type ChurchReportBuilderState = {
  dateFrom: string;
  dateTo: string;
  fieldIds: string[];
  regionalIds: string[];
  churchIds: string[];
  mode: ChurchReportMode;
  groupBy: ChurchReportGroupKey[];
  sections: ChurchReportSectionKey[];
  columns: ChurchReportColumnKey[];
  sortBy: ChurchReportColumnKey;
  sortDirection: MemberReportSortDirection;
  orientation: MemberReportOrientation;
  zebraEnabled: boolean;
  zebraColor: string;
  showPhotos: boolean;
  showMap: boolean;
  memberTypes: string[];
};

type SavedChurchReportTemplate = {
  id: string;
  name: string;
  builder: ChurchReportBuilderState;
  createdAt: string;
  updatedAt: string;
};

// ─── Requirements Report types ─────────────────────────────────────────────
type RequirementsReportColumnKey =
  | 'protocol'
  | 'candidateName'
  | 'service'
  | 'church'
  | 'regional'
  | 'field'
  | 'stage'
  | 'status'
  | 'openedAt'
  | 'closedAt'
  | 'subject';

type RequirementsReportBuilderState = {
  dateFrom: string;
  dateTo: string;
  fieldIds: string[];
  regionalIds: string[];
  churchIds: string[];
  serviceIds: string[];
  statuses: string[];
  memberTypes: string[];
  columns: RequirementsReportColumnKey[];
  groupBy: 'none' | 'regional' | 'church';
  sortBy: RequirementsReportColumnKey;
  sortDirection: 'asc' | 'desc';
  orientation: 'portrait' | 'landscape';
  zebraEnabled: boolean;
  zebraColor: string;
  templateName: string;
};

type RequirementsPreviewRow = {
  cardId: string;
  protocol: string;
  candidateName: string;
  service: string;
  serviceId: number | null;
  church: string;
  churchId: string;
  regional: string;
  regionalId: string;
  field: string;
  fieldId: string;
  stage: string;
  status: string;
  statusLabel: string;
  openedAt: string;
  closedAt: string;
  subject: string;
  memberType: string;
  attachments: Array<{ type?: string; url?: string; name?: string; filename?: string }>;
  eventHistory: Array<{ id: string; action: string | null; notes: string | null; serviceName: string | null; createdAt: string; createdByUser?: { id: string; fullName: string } | null }>;
};

type SavedRequirementsReportTemplate = {
  id: string;
  name: string;
  builder: RequirementsReportBuilderState;
  createdAt: string;
  updatedAt: string;
};
// ────────────────────────────────────────────────────────────────────────────

type CredentialReportColumnKey =
  | 'nome' | 'tipo' | 'numero' | 'situacao' | 'etapa' | 'servico' | 'igrejasolicitante'
  | 'regional' | 'campo' | 'dataemissao' | 'datavalidade' | 'aprovadopor' | 'card_protocol';

type CredentialReportBuilderState = {
  dateFrom: string;
  dateTo: string;
  fieldIds: string[];
  regionalIds: string[];
  churchIds: string[];
  situacoes: string[];
  memberTypes: string[];
  columns: CredentialReportColumnKey[];
  groupBy: 'none' | 'regional' | 'church';
  sortBy: CredentialReportColumnKey;
  sortDirection: 'asc' | 'desc';
  orientation: 'portrait' | 'landscape';
  zebraEnabled: boolean;
  zebraColor: string;
  templateName: string;
  memberDetailFields: string[];
};

type CredentialMemberDetail = {
  id: string;
  fullName: string;
  preferredName: string;
  photoUrl: string;
  cpf: string;
  rg: string;
  birthDate: string;
  gender: string;
  maritalStatus: string;
  ecclesiasticalTitle: string;
  membershipStatus: string;
  membershipDate: string;
  baptismDate: string;
  fatherName: string;
  motherName: string;
  spouseName: string;
  naturalityCity: string;
  naturalityState: string;
  memberType: string;
  rol: string;
};

type CredentialPreviewRow = {
  id: number;
  nome: string;
  tipo: string;
  numero: string;
  situacao: string;
  obs: string;
  dataemissao: string;
  datavalidade: string;
  dataaprovacao: string;
  aprovadopor: string;
  igrejasolicitante: string;
  campo: string;
  modelo: string;
  card_protocol: string;
  church_id: string;
  churchName: string;
  regionalId: string;
  regional: string;
  fieldId: string;
  fieldName: string;
  created_at: string;
  modelLargura: number | null;
  modelAltura: number | null;
  modelLargurapg: number | null;
  modelAlturapg: number | null;
  modelLinhaporpg: number | null;
  modelColunaporpg: number | null;
  modelValidademeses: number | null;
  member: CredentialMemberDetail | null;
};

type SavedCredentialReportTemplate = {
  id: string;
  name: string;
  builder: CredentialReportBuilderState;
  createdAt: string;
  updatedAt: string;
};

type ChurchPreviewRow = {
  id: string;
  name: string;
  code: string;
  churchId: string;
  church: string;
  regional: string;
  field: string;
  city: string;
  state: string;
  country: string;
  leaderName: string;
  leaderRole: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  totalMembers: number;
  pastors: number;
  diaconos: number;
  membros: number;
  baptisms: number;
  consecrations: number;
  newMembers: number;
};

type SavedMemberReportTemplate = {
  id: string;
  name: string;
  builder: MemberReportBuilderState;
  createdAt: string;
  updatedAt: string;
};

type SavedBaptismReportTemplate = {
  id: string;
  name: string;
  builder: BaptismReportBuilderState;
  createdAt: string;
  updatedAt: string;
};

type SavedConsecrationReportTemplate = {
  id: string;
  name: string;
  builder: ConsecrationReportBuilderState;
  createdAt: string;
  updatedAt: string;
};

type SavedTransferReportTemplate = {
  id: string;
  name: string;
  builder: TransferReportBuilderState;
  createdAt: string;
  updatedAt: string;
};

type MemberPreviewRow = {
  id: string;
  name: string;
  cpf: string;
  father_name: string;
  mother_name: string;
  spouse_name: string;
  birth_date: string;
  age: string;
  contact: string;
  email: string;
  voter_title: string;
  church: string;
  church_code: string;
  regional: string;
  field: string;
  title: string;
  gender: string;
  marital_status: string;
  age_range: string;
  membership_date: string;
  baptism_date: string;
  status: string;
  memberType: string;
  leader_name: string;
  leader_role: string;
  church_address: string;
  church_city: string;
  church_state: string;
  church_country: string;
  member_city: string;
  member_state: string;
  member_country: string;
  fieldId: string;
  regionalId: string;
  churchId: string;
  membershipDateRaw: string;
  baptismDateRaw: string;
};

type MemberPreviewGroupNode = {
  id: string;
  field: MemberReportGroupKey;
  label: string;
  total: number;
  rowCount: number;
  rows: MemberPreviewRow[];
  children: MemberPreviewGroupNode[];
};

type BaptismPreviewRow = {
  id: string;
  protocol: string;
  name: string;
  church: string;
  regional: string;
  field: string;
  title: string;
  member_status: string;
  memberType: string;
  workflow_status: string;
  service: string;
  opened_at: string;
  baptism_date: string;
  next_baptism_date: string;
  fieldId: string;
  regionalId: string;
  churchId: string;
  openedAtRaw: string;
  baptismDateRaw: string;
  nextBaptismDateRaw: string;
  columnIndex: number;
};

type BaptismPreviewGroupNode = {
  id: string;
  field: BaptismReportGroupKey;
  label: string;
  total: number;
  rowCount: number;
  rows: BaptismPreviewRow[];
  children: BaptismPreviewGroupNode[];
};

type ConsecrationPreviewRow = {
  id: string;
  protocol: string;
  name: string;
  church: string;
  regional: string;
  field: string;
  member_status: string;
  memberType: string;
  workflow_status: string;
  service: string;
  current_title: string;
  intended_title: string;
  opened_at: string;
  consecration_date: string;
  next_consecration_date: string;
  fieldId: string;
  regionalId: string;
  churchId: string;
  openedAtRaw: string;
  consecrationDateRaw: string;
  nextConsecrationDateRaw: string;
  columnIndex: number;
};

type ConsecrationPreviewGroupNode = {
  id: string;
  field: ConsecrationReportGroupKey;
  label: string;
  total: number;
  rowCount: number;
  rows: ConsecrationPreviewRow[];
  children: ConsecrationPreviewGroupNode[];
};

type TransferPreviewRow = {
  id: string;
  protocol: string;
  name: string;
  origin_church: string;
  origin_regional: string;
  origin_field: string;
  destination_church: string;
  destination_regional: string;
  destination_field: string;
  current_title: string;
  member_status: string;
  workflow_status: string;
  service: string;
  opened_at: string;
  churchId: string;
  regionalId: string;
  fieldId: string;
  destinationChurchId: string;
  destinationRegionalId: string;
  destinationFieldId: string;
  openedAtRaw: string;
  columnIndex: number;
};

type TransferPreviewGroupNode = {
  id: string;
  field: TransferReportGroupKey;
  label: string;
  total: number;
  rowCount: number;
  rows: TransferPreviewRow[];
  children: TransferPreviewGroupNode[];
};

type MultiSelectDropdownOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type MemberColumnSummaryItem = {
  label: string;
  count: number;
};

type MemberColumnSummaryBlock = {
  column: MemberReportColumnKey;
  label: string;
  items: MemberColumnSummaryItem[];
};

type BaptismColumnSummaryBlock = {
  column: BaptismReportColumnKey;
  label: string;
  items: MemberColumnSummaryItem[];
};

type ConsecrationColumnSummaryBlock = {
  column: ConsecrationReportColumnKey;
  label: string;
  items: MemberColumnSummaryItem[];
};

type TransferColumnSummaryBlock = {
  column: TransferReportColumnKey;
  label: string;
  items: MemberColumnSummaryItem[];
};

type ReportSummaryMetricRow = {
  label: string;
  value: string;
};

type ReportSummaryDetailBlock = {
  id: string;
  label: string;
  items: MemberColumnSummaryItem[];
};

const STORAGE_KEY = 'mrm_secretariat_reports_v2';
const MEMBER_REPORT_TEMPLATES_STORAGE_KEY = 'mrm_member_report_templates_v1';
const BAPTISM_REPORT_TEMPLATES_STORAGE_KEY = 'mrm_baptism_report_templates_v1';
const CONSECRATION_REPORT_TEMPLATES_STORAGE_KEY = 'mrm_consecration_report_templates_v1';
const TRANSFER_REPORT_TEMPLATES_STORAGE_KEY = 'mrm_transfer_report_templates_v1';
const CHURCH_REPORT_TEMPLATES_STORAGE_KEY = 'mrm_church_report_templates_v1';
const REQUIREMENTS_REPORT_TEMPLATES_STORAGE_KEY = 'mrm_requirements_report_templates_v1';
const CREDENTIAL_REPORT_TEMPLATES_STORAGE_KEY = 'mrm_credential_report_templates_v1';
const CHART_COLORS = ['#0f8f67', '#2f6fed', '#f97316', '#7c3aed', '#dc2626', '#0891b2', '#16a34a', '#eab308'];

const CHART_TYPE_OPTIONS: Array<{ value: ChartTypeKey; label: string }> = [
  { value: 'bar', label: 'Barra' },
  { value: 'bar-label', label: 'Barra com Rótulo' },
  { value: 'geo-map', label: 'Mapa de Localidade' },
  { value: 'bar-horizontal', label: 'Barra Horizontal' },
  { value: 'bar-multiple', label: 'Barra Múltipla' },
  { value: 'stacked-bar', label: 'Barras Empilhadas' },
  { value: 'stacked-bar-vertical', label: 'Barras Empilhadas Vertical' },
  { value: 'negative-bar', label: 'Barra Negativa' },
  { value: 'line', label: 'Linha' },
  { value: 'line-multiple', label: 'Linha Múltipla' },
  { value: 'line-points', label: 'Linha com Pontos' },
  { value: 'line-values', label: 'Linha com Valores' },
  { value: 'area', label: 'Área' },
  { value: 'area-multiple', label: 'Área Múltipla' },
  { value: 'pie', label: 'Pizza' },
  { value: 'pie-label', label: 'Pizza com Texto' },
  { value: 'doughnut', label: 'Rosca' },
  { value: 'radar', label: 'Radar' },
  { value: 'table', label: 'Tabela' },
  { value: 'funnel', label: 'Funil' },
  { value: 'metric', label: 'Métrica' },
];

const LEGEND_POSITION_OPTIONS: Array<{ value: LegendPositionKey; label: string }> = [
  { value: 'top', label: 'Topo' },
  { value: 'bottom', label: 'Rodapé' },
  { value: 'left', label: 'Esquerda' },
  { value: 'right', label: 'Direita' },
];

const DATE_PRESET_OPTIONS: Array<{ value: DatePresetKey; label: string }> = [
  { value: 'all', label: 'Todo período' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
  { value: '180d', label: 'Últimos 6 meses' },
  { value: '365d', label: 'Últimos 12 meses' },
  { value: 'custom', label: 'Período customizado' },
];

const GRID_SIZE_OPTIONS: Array<{ value: GridSizeKey; label: string }> = [
  { value: 'small', label: 'Small (1 coluna)' },
  { value: 'medium', label: 'Medium (2 colunas)' },
  { value: 'large', label: 'Large (3 colunas)' },
  { value: 'full', label: 'Full (4 colunas)' },
];

const MEMBER_REPORT_TYPE_OPTIONS: Array<{ value: MemberReportTypeKey; label: string }> = [
  { value: 'members_list', label: 'Lista de membros' },
  { value: 'grouped_church', label: 'Agrupado por igreja' },
  { value: 'grouped_regional', label: 'Agrupado por regional' },
  { value: 'growth_report', label: 'Relatório de crescimento' },
  { value: 'grouped_title', label: 'Agrupado por título' },
];

const MEMBER_REPORT_GROUP_OPTIONS: Array<{ value: MemberReportGroupKey; label: string }> = [
  { value: 'field', label: 'Campo' },
  { value: 'regional', label: 'Regional' },
  { value: 'church', label: 'Igreja' },
  { value: 'ecclesiastical_title', label: 'Título eclesiástico' },
  { value: 'gender', label: 'Sexo' },
  { value: 'status', label: 'Situação' },
  { value: 'marital_status', label: 'Estado civil' },
  { value: 'city', label: 'Cidade' },
  { value: 'state', label: 'Estado' },
  { value: 'country', label: 'País' },
  { value: 'age_range', label: 'Faixa etária' },
];

const MEMBER_REPORT_COLUMN_OPTIONS: Array<{ value: MemberReportColumnKey; label: string }> = [
  { value: 'name', label: 'Nome' },
  { value: 'cpf', label: 'CPF' },
  { value: 'father_name', label: 'Nome do pai' },
  { value: 'mother_name', label: 'Nome da mae' },
  { value: 'spouse_name', label: 'Conjuge' },
  { value: 'birth_date', label: 'Data de nascimento' },
  { value: 'age', label: 'Idade' },
  { value: 'contact', label: 'Contato' },
  { value: 'email', label: 'Email' },
  { value: 'voter_title', label: 'Título eleitoral' },
  { value: 'church', label: 'Igreja' },
  { value: 'church_code', label: 'Código da igreja' },
  { value: 'regional', label: 'Regional' },
  { value: 'field', label: 'Campo' },
  { value: 'title', label: 'Título' },
  { value: 'status', label: 'Status' },
  { value: 'gender', label: 'Sexo' },
  { value: 'marital_status', label: 'Estado civil' },
  { value: 'age_range', label: 'Faixa etária' },
  { value: 'membership_date', label: 'Data de membresia' },
  { value: 'baptism_date', label: 'Data de batismo' },
  { value: 'church_address', label: 'Endereço da igreja' },
  { value: 'church_city', label: 'Cidade da igreja' },
  { value: 'church_state', label: 'Estado da igreja' },
  { value: 'church_country', label: 'País da igreja' },
  { value: 'member_city', label: 'Cidade do membro' },
  { value: 'member_state', label: 'Estado do membro' },
  { value: 'member_country', label: 'País do membro' },
];

const MEMBER_REPORT_PRESETS: Record<MemberReportTypeKey, Pick<MemberReportBuilderState, 'groupBy' | 'columns' | 'sortBy'>> = {
  members_list: {
    groupBy: [],
    columns: ['name', 'cpf', 'birth_date', 'age', 'contact', 'email', 'church', 'regional', 'field', 'title', 'status'],
    sortBy: 'name',
  },
  grouped_church: {
    groupBy: ['church'],
    columns: ['name', 'cpf', 'title', 'status', 'church_address'],
    sortBy: 'church',
  },
  grouped_regional: {
    groupBy: ['regional'],
    columns: ['name', 'regional', 'church', 'title', 'status', 'church_city'],
    sortBy: 'regional',
  },
  growth_report: {
    groupBy: ['field'],
    columns: ['name', 'regional', 'church', 'membership_date', 'status'],
    sortBy: 'membership_date',
  },
  grouped_title: {
    groupBy: ['ecclesiastical_title'],
    columns: ['name', 'church', 'regional', 'title', 'status'],
    sortBy: 'title',
  },
};

const MEMBER_REPORT_METRIC_OPTIONS: Array<{ value: MemberReportMetricKey; label: string; disabled?: boolean }> = [
  { value: 'count', label: 'Contagem' },
  { value: 'active', label: 'Membros ativos' },
  { value: 'women', label: 'Mulheres' },
  { value: 'men', label: 'Homens' },
  { value: 'titled', label: 'Com título' },
];

const BAPTISM_REPORT_TYPE_OPTIONS: Array<{ value: BaptismReportTypeKey; label: string }> = [
  { value: 'queue_list', label: 'Fila de batismo' },
  { value: 'grouped_status', label: 'Agrupado por etapa' },
  { value: 'grouped_church', label: 'Agrupado por igreja' },
  { value: 'grouped_regional', label: 'Agrupado por regional' },
  { value: 'scheduled_report', label: 'Agenda e aprovação' },
];

const BAPTISM_REPORT_GROUP_OPTIONS: Array<{ value: BaptismReportGroupKey; label: string }> = [
  { value: 'field', label: 'Campo' },
  { value: 'regional', label: 'Regional' },
  { value: 'church', label: 'Igreja' },
  { value: 'workflow_status', label: 'Etapa do fluxo' },
  { value: 'service', label: 'Serviço' },
  { value: 'member_status', label: 'Situação do membro' },
  { value: 'ecclesiastical_title', label: 'Título eclesiástico' },
];

const BAPTISM_REPORT_COLUMN_OPTIONS: Array<{ value: BaptismReportColumnKey; label: string }> = [
  { value: 'protocol', label: 'Protocolo' },
  { value: 'name', label: 'Nome' },
  { value: 'church', label: 'Igreja' },
  { value: 'regional', label: 'Regional' },
  { value: 'field', label: 'Campo' },
  { value: 'title', label: 'Título eclesiástico' },
  { value: 'member_status', label: 'Situação do membro' },
  { value: 'workflow_status', label: 'Etapa do fluxo' },
  { value: 'service', label: 'Serviço' },
  { value: 'opened_at', label: 'Data de abertura' },
  { value: 'baptism_date', label: 'Data do batismo' },
  { value: 'next_baptism_date', label: 'Próxima agenda' },
];

const BAPTISM_REPORT_PRESETS: Record<BaptismReportTypeKey, Pick<BaptismReportBuilderState, 'groupBy' | 'columns' | 'sortBy'>> = {
  queue_list: {
    groupBy: [],
    columns: ['protocol', 'name', 'church', 'regional', 'field', 'title', 'member_status', 'workflow_status', 'service', 'opened_at'],
    sortBy: 'opened_at',
  },
  grouped_status: {
    groupBy: ['workflow_status', 'church'],
    columns: ['protocol', 'name', 'church', 'title', 'member_status', 'workflow_status', 'service', 'opened_at'],
    sortBy: 'workflow_status',
  },
  grouped_church: {
    groupBy: ['church', 'workflow_status'],
    columns: ['protocol', 'name', 'church', 'title', 'member_status', 'workflow_status', 'next_baptism_date'],
    sortBy: 'church',
  },
  grouped_regional: {
    groupBy: ['regional', 'church', 'workflow_status'],
    columns: ['protocol', 'name', 'regional', 'church', 'title', 'member_status', 'workflow_status'],
    sortBy: 'regional',
  },
  scheduled_report: {
    groupBy: ['field', 'regional', 'church'],
    columns: ['name', 'church', 'regional', 'field', 'workflow_status', 'baptism_date', 'next_baptism_date'],
    sortBy: 'next_baptism_date',
  },
};

const BAPTISM_REPORT_METRIC_OPTIONS: Array<{ value: BaptismReportMetricKey; label: string }> = [
  { value: 'count', label: 'Contagem' },
];

const CONSECRATION_REPORT_TYPE_OPTIONS: Array<{ value: ConsecrationReportTypeKey; label: string }> = [
  { value: 'queue_list', label: 'Fila de consagração' },
  { value: 'grouped_status', label: 'Agrupado por etapa' },
  { value: 'grouped_church', label: 'Agrupado por igreja' },
  { value: 'grouped_regional', label: 'Agrupado por regional' },
  { value: 'title_progress', label: 'Evolução de títulos' },
];

const CONSECRATION_REPORT_GROUP_OPTIONS: Array<{ value: ConsecrationReportGroupKey; label: string }> = [
  { value: 'field', label: 'Campo' },
  { value: 'regional', label: 'Regional' },
  { value: 'church', label: 'Igreja' },
  { value: 'workflow_status', label: 'Etapa do fluxo' },
  { value: 'service', label: 'Serviço' },
  { value: 'member_status', label: 'Situação do membro' },
  { value: 'current_title', label: 'Título atual' },
  { value: 'intended_title', label: 'Título pretendido' },
];

const CONSECRATION_REPORT_COLUMN_OPTIONS: Array<{ value: ConsecrationReportColumnKey; label: string }> = [
  { value: 'protocol', label: 'Protocolo' },
  { value: 'name', label: 'Nome' },
  { value: 'church', label: 'Igreja' },
  { value: 'regional', label: 'Regional' },
  { value: 'field', label: 'Campo' },
  { value: 'member_status', label: 'Situação do membro' },
  { value: 'workflow_status', label: 'Etapa do fluxo' },
  { value: 'service', label: 'Serviço' },
  { value: 'current_title', label: 'Título atual' },
  { value: 'intended_title', label: 'Título pretendido' },
  { value: 'opened_at', label: 'Data de abertura' },
  { value: 'consecration_date', label: 'Data da consagração' },
  { value: 'next_consecration_date', label: 'Próxima agenda' },
];

const CONSECRATION_REPORT_PRESETS: Record<ConsecrationReportTypeKey, Pick<ConsecrationReportBuilderState, 'groupBy' | 'columns' | 'sortBy'>> = {
  queue_list: {
    groupBy: [],
    columns: ['protocol', 'name', 'church', 'regional', 'field', 'current_title', 'intended_title', 'member_status', 'workflow_status', 'service', 'opened_at'],
    sortBy: 'opened_at',
  },
  grouped_status: {
    groupBy: ['workflow_status', 'church'],
    columns: ['protocol', 'name', 'church', 'current_title', 'intended_title', 'member_status', 'workflow_status', 'service', 'opened_at'],
    sortBy: 'workflow_status',
  },
  grouped_church: {
    groupBy: ['church', 'workflow_status'],
    columns: ['protocol', 'name', 'church', 'regional', 'current_title', 'intended_title', 'workflow_status', 'next_consecration_date'],
    sortBy: 'church',
  },
  grouped_regional: {
    groupBy: ['regional', 'church', 'workflow_status'],
    columns: ['protocol', 'name', 'regional', 'church', 'current_title', 'intended_title', 'member_status', 'workflow_status'],
    sortBy: 'regional',
  },
  title_progress: {
    groupBy: ['intended_title', 'church'],
    columns: ['name', 'church', 'regional', 'field', 'current_title', 'intended_title', 'workflow_status', 'consecration_date', 'next_consecration_date'],
    sortBy: 'intended_title',
  },
};

const CONSECRATION_REPORT_METRIC_OPTIONS: Array<{ value: ConsecrationReportMetricKey; label: string }> = [
  { value: 'count', label: 'Contagem' },
];

const TRANSFER_REPORT_TYPE_OPTIONS: Array<{ value: TransferReportTypeKey; label: string }> = [
  { value: 'queue_list', label: 'Fila de transferência' },
  { value: 'grouped_status', label: 'Agrupado por etapa' },
  { value: 'grouped_origin', label: 'Agrupado por igreja de origem' },
  { value: 'grouped_destination', label: 'Agrupado por igreja de destino' },
  { value: 'route_report', label: 'Rotas e destino' },
];

const TRANSFER_REPORT_GROUP_OPTIONS: Array<{ value: TransferReportGroupKey; label: string }> = [
  { value: 'origin_field', label: 'Campo de origem' },
  { value: 'origin_regional', label: 'Regional de origem' },
  { value: 'origin_church', label: 'Igreja de origem' },
  { value: 'destination_field', label: 'Campo de destino' },
  { value: 'destination_regional', label: 'Regional de destino' },
  { value: 'destination_church', label: 'Igreja de destino' },
  { value: 'workflow_status', label: 'Etapa do fluxo' },
  { value: 'member_status', label: 'Situação do membro' },
  { value: 'current_title', label: 'Título atual' },
];

const TRANSFER_REPORT_COLUMN_OPTIONS: Array<{ value: TransferReportColumnKey; label: string }> = [
  { value: 'protocol', label: 'Protocolo' },
  { value: 'name', label: 'Nome' },
  { value: 'origin_church', label: 'Igreja de origem' },
  { value: 'origin_regional', label: 'Regional de origem' },
  { value: 'origin_field', label: 'Campo de origem' },
  { value: 'destination_church', label: 'Igreja de destino' },
  { value: 'destination_regional', label: 'Regional de destino' },
  { value: 'destination_field', label: 'Campo de destino' },
  { value: 'current_title', label: 'Título atual' },
  { value: 'member_status', label: 'Situação do membro' },
  { value: 'workflow_status', label: 'Etapa do fluxo' },
  { value: 'service', label: 'Serviço' },
  { value: 'opened_at', label: 'Data de abertura' },
];

const TRANSFER_REPORT_PRESETS: Record<TransferReportTypeKey, Pick<TransferReportBuilderState, 'groupBy' | 'columns' | 'sortBy'>> = {
  queue_list: {
    groupBy: [],
    columns: ['protocol', 'name', 'origin_church', 'origin_regional', 'destination_church', 'destination_regional', 'current_title', 'member_status', 'workflow_status', 'opened_at'],
    sortBy: 'opened_at',
  },
  grouped_status: {
    groupBy: ['workflow_status', 'destination_church'],
    columns: ['protocol', 'name', 'origin_church', 'destination_church', 'current_title', 'member_status', 'workflow_status', 'opened_at'],
    sortBy: 'workflow_status',
  },
  grouped_origin: {
    groupBy: ['origin_church', 'destination_church'],
    columns: ['protocol', 'name', 'origin_church', 'origin_regional', 'destination_church', 'current_title', 'workflow_status'],
    sortBy: 'origin_church',
  },
  grouped_destination: {
    groupBy: ['destination_church', 'workflow_status'],
    columns: ['protocol', 'name', 'destination_church', 'destination_regional', 'origin_church', 'current_title', 'workflow_status'],
    sortBy: 'destination_church',
  },
  route_report: {
    groupBy: ['destination_field', 'destination_regional', 'destination_church'],
    columns: ['name', 'origin_field', 'origin_regional', 'origin_church', 'destination_field', 'destination_regional', 'destination_church', 'current_title', 'workflow_status'],
    sortBy: 'destination_field',
  },
};

const TRANSFER_REPORT_METRIC_OPTIONS: Array<{ value: TransferReportMetricKey; label: string }> = [
  { value: 'count', label: 'Contagem' },
];

const CHURCH_REPORT_GROUP_OPTIONS: Array<{ value: ChurchReportGroupKey; label: string }> = [
  { value: 'field', label: 'Campo' },
  { value: 'regional', label: 'Regional' },
  { value: 'church', label: 'Igreja' },
];

const CHURCH_REPORT_SECTION_OPTIONS: Array<{ value: ChurchReportSectionKey; label: string }> = [
  { value: 'leaders', label: 'Historico de dirigentes' },
  { value: 'titles', label: 'Total de membros por categoria' },
  { value: 'baptisms', label: 'Batismos no periodo' },
  { value: 'consecrations', label: 'Consagracoes no periodo' },
  { value: 'new_members', label: 'Cadastros de novos membros' },
  { value: 'stats', label: 'Estatistica e evolucao' },
];

const CHURCH_REPORT_COLUMN_OPTIONS: Array<{ value: ChurchReportColumnKey; label: string }> = [
  { value: 'field', label: 'Campo' },
  { value: 'regional', label: 'Regional' },
  { value: 'church', label: 'Igreja' },
  { value: 'leaderName', label: 'Dirigente' },
  { value: 'totalMembers', label: 'Membros' },
  { value: 'pastors', label: 'Pastores' },
  { value: 'diaconos', label: 'Diaconos' },
  { value: 'membros', label: 'Membros base' },
  { value: 'baptisms', label: 'Batismos' },
  { value: 'consecrations', label: 'Consagracoes' },
  { value: 'newMembers', label: 'Novos membros' },
];

const CHURCH_REPORT_NUMERIC_COLUMNS: ChurchReportColumnKey[] = [
  'totalMembers',
  'pastors',
  'diaconos',
  'membros',
  'baptisms',
  'consecrations',
  'newMembers',
];

function compareLocaleValues(left: string, right: string) {
  return left.localeCompare(right, 'pt-BR', { numeric: true, sensitivity: 'base' });
}

function normalizeLookupValue(value: string | null | undefined) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function formatChurchAddress(church?: Partial<ChurchOption> | null) {
  const parts = [
    church?.addressStreet,
    church?.addressNumber,
    church?.addressComplement,
    church?.addressNeighborhood,
    church?.addressCity,
    church?.addressState,
    church?.addressCountry,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : 'Não informado';
}

function toggleSelection(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function moveOrderedItem<T>(items: T[], item: T, direction: 'up' | 'down') {
  const index = items.indexOf(item);
  if (index === -1) return items;
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= items.length) return items;
  const next = [...items];
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
}

function isChurchReportNumericColumn(column: ChurchReportColumnKey) {
  return CHURCH_REPORT_NUMERIC_COLUMNS.includes(column);
}

function summarizeMultiSelect(options: MultiSelectDropdownOption[], selectedValues: string[], emptyLabel: string) {
  if (!selectedValues.length) return emptyLabel;

  const selectedLabels = options
    .filter((option) => selectedValues.includes(option.value))
    .map((option) => option.label);

  if (!selectedLabels.length) return emptyLabel;
  if (selectedLabels.length <= 2) return selectedLabels.join(', ');
  return `${selectedLabels.slice(0, 2).join(', ')} +${selectedLabels.length - 2}`;
}

function MultiSelectDropdown({
  label,
  emptyLabel,
  selectedValues,
  options,
  onToggle,
  disabled = false,
}: {
  label: string;
  emptyLabel: string;
  selectedValues: string[];
  options: MultiSelectDropdownOption[];
  onToggle: (value: string, checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2 text-sm text-slate-700">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-900">{label}</span>
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{selectedValues.length} marcado(s)</span>
      </div>

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            <div className="min-w-0">
              <div className="truncate font-semibold text-slate-900">{summarizeMultiSelect(options, selectedValues, emptyLabel)}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-500">Selecione um ou mais</div>
            </div>
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-[280px] rounded-2xl border-slate-200 p-2">
          <DropdownMenuLabel className="px-2 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="max-h-72 overflow-y-auto py-1">
            {options.length ? options.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={selectedValues.includes(option.value)}
                disabled={option.disabled}
                onSelect={(event) => event.preventDefault()}
                onCheckedChange={(checked) => onToggle(option.value, checked === true)}
                className="rounded-xl py-2 pr-3 pl-8 text-sm text-slate-700"
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            )) : (
              <div className="px-3 py-6 text-center text-sm text-slate-500">Nenhuma opção disponível</div>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function getMemberPreviewGroupValue(row: MemberPreviewRow, field: MemberReportGroupKey) {
  if (field === 'field') return row.field;
  if (field === 'regional') return row.regional;
  if (field === 'church') return row.church;
  if (field === 'ecclesiastical_title') return row.title;
  if (field === 'gender') return row.gender;
  if (field === 'status') return row.status;
  if (field === 'marital_status') return row.marital_status;
  if (field === 'city') return row.member_city;
  if (field === 'state') return row.member_state;
  if (field === 'country') return row.member_country;
  return row.age_range;
}

function getMemberPreviewColumnValue(row: MemberPreviewRow, column: MemberReportColumnKey) {
  return row[column] || '-';
}

function abbreviateCompoundColumnLabel(label: string) {
  const normalized = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // Single-word abbreviations
  const singles: Record<string, string> = {
    'protocolo': 'Prot.',
    'regional': 'Reg.',
    'igreja': 'Igr.',
    'servico': 'Serv.',
    'titulo': 'Título',
  };
  if (singles[normalized]) return singles[normalized];

  if (!label.includes(' ') && !label.includes('.')) return label;

  const abbreviations: Record<string, string> = {
    'nome do pai': 'Pai',
    'nome da mae': 'Mae',
    'data de nascimento': 'Dt. nasc.',
    'titulo eleitoral': 'Tit. eleitor.',
    'codigo da igreja': 'Cod. igr.',
    'estado civil': 'Est. civil',
    'faixa etaria': 'Fx. etaria',
    'data de membresia': 'Dt. memb.',
    'data de batismo': 'Dt. bat.',
    'endereco da igreja': 'End. igr.',
    'cidade da igreja': 'Cid. igr.',
    'estado da igreja': 'Est. igr.',
    'pais da igreja': 'Pais igr.',
    'cidade do membro': 'Cid. memb.',
    'estado do membro': 'Est. memb.',
    'pais do membro': 'Pais memb.',
    'titulo eclesiastico': 'Tit. ecles.',
    'situacao do membro': 'Sit. memb.',
    'etapa do fluxo': 'Etapa',
    'data de abertura': 'Dt. abertura',
    'data do batismo': 'Dt. bat.',
    'proxima agenda': 'Prox. agenda',
    'titulo atual': 'Tit. atual',
    'titulo pretendido': 'Tit. pretend.',
    'data da sagracao': 'Dt. consagr.',
    'data da consagracao': 'Dt. consagr.',
    'igreja de origem': 'Igr. orig.',
    'regional de origem': 'Reg. orig.',
    'campo de origem': 'Orig.',
    'igreja de destino': 'Igr. dest.',
    'regional de destino': 'Reg. dest.',
    'campo de destino': 'Dest.',
  };

  return abbreviations[normalized] || label;
}

function getMemberReportColumnLabel(column: MemberReportColumnKey, abbreviated = false) {
  const label = MEMBER_REPORT_COLUMN_OPTIONS.find((option) => option.value === column)?.label || column;
  return abbreviated ? abbreviateCompoundColumnLabel(label) : label;
}

function getGroupedColumnKey(field: MemberReportGroupKey): MemberReportColumnKey | null {
  if (field === 'field') return 'field';
  if (field === 'regional') return 'regional';
  if (field === 'church') return 'church';
  if (field === 'ecclesiastical_title') return 'title';
  if (field === 'gender') return 'gender';
  if (field === 'status') return 'status';
  if (field === 'marital_status') return 'marital_status';
  if (field === 'city') return 'member_city';
  if (field === 'state') return 'member_state';
  if (field === 'country') return 'member_country';
  if (field === 'age_range') return 'age_range';
  return null;
}

function normalizeMemberSummaryValue(value: string) {
  const normalized = value.trim();
  return normalized && normalized !== '-' ? normalized : 'Não informado';
}

function isMemberSummaryColumn(column: MemberReportColumnKey) {
  return [
    'church',
    'regional',
    'field',
    'title',
    'status',
    'gender',
    'marital_status',
    'age_range',
    'church_city',
    'church_state',
    'church_country',
    'member_city',
    'member_state',
    'member_country',
  ].includes(column);
}

function buildMemberColumnSummaries(
  rows: MemberPreviewRow[],
  columns: MemberReportColumnKey[],
  excludedColumns: MemberReportColumnKey[] = [],
): MemberColumnSummaryBlock[] {
  return columns
    .filter((column) => isMemberSummaryColumn(column) && !excludedColumns.includes(column))
    .map((column) => {
      const counts = new Map<string, number>();

      rows.forEach((row) => {
        const value = normalizeMemberSummaryValue(getMemberPreviewColumnValue(row, column));
        counts.set(value, (counts.get(value) || 0) + 1);
      });

      const items = Array.from(counts.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((left, right) => {
          if (right.count !== left.count) return right.count - left.count;
          return compareLocaleValues(left.label, right.label);
        });

      return {
        column,
        label: getMemberReportColumnLabel(column),
        items,
      };
    })
    .filter((block) => block.items.length > 0);
}

function getMemberGroupLabel(field: MemberReportGroupKey) {
  return MEMBER_REPORT_GROUP_OPTIONS.find((option) => option.value === field)?.label || field;
}

function getMemberMetricValue(row: MemberPreviewRow, metric: MemberReportMetricKey) {
  if (metric === 'active') return row.status === 'Ativos' ? 1 : 0;
  if (metric === 'women') return row.gender === 'Mulheres' ? 1 : 0;
  if (metric === 'men') return row.gender === 'Homens' ? 1 : 0;
  if (metric === 'titled') return row.title !== 'Não informado' ? 1 : 0;
  return 1;
}

function buildMemberPreviewGroups(rows: MemberPreviewRow[], groupBy: MemberReportGroupKey[], metric: MemberReportMetricKey, depth = 0): MemberPreviewGroupNode[] {
  const field = groupBy[depth];
  if (!field) return [];

  const buckets = new Map<string, MemberPreviewRow[]>();
  for (const row of rows) {
    const key = getMemberPreviewGroupValue(row, field) || 'Não informado';
    const current = buckets.get(key) || [];
    current.push(row);
    buckets.set(key, current);
  }

  return Array.from(buckets.entries())
    .sort(([left], [right]) => compareLocaleValues(left, right))
    .map(([label, bucket]) => ({
      id: `${field}-${label}-${depth}`,
      field,
      label,
      total: bucket.reduce((sum, row) => sum + getMemberMetricValue(row, metric), 0),
      rowCount: bucket.length,
      rows: bucket,
      children: buildMemberPreviewGroups(bucket, groupBy, metric, depth + 1),
    }));
}

function getBaptismPreviewGroupValue(row: BaptismPreviewRow, field: BaptismReportGroupKey) {
  if (field === 'field') return row.field;
  if (field === 'regional') return row.regional;
  if (field === 'church') return row.church;
  if (field === 'workflow_status') return row.workflow_status;
  if (field === 'service') return row.service;
  if (field === 'member_status') return row.member_status;
  return row.title;
}

function getBaptismPreviewColumnValue(row: BaptismPreviewRow, column: BaptismReportColumnKey) {
  return row[column] || '-';
}

function getBaptismReportColumnLabel(column: BaptismReportColumnKey, abbreviated = false) {
  const label = BAPTISM_REPORT_COLUMN_OPTIONS.find((option) => option.value === column)?.label || column;
  return abbreviated ? abbreviateCompoundColumnLabel(label) : label;
}

function getBaptismGroupedColumnKey(field: BaptismReportGroupKey): BaptismReportColumnKey | null {
  if (field === 'field') return 'field';
  if (field === 'regional') return 'regional';
  if (field === 'church') return 'church';
  if (field === 'workflow_status') return 'workflow_status';
  if (field === 'service') return 'service';
  if (field === 'member_status') return 'member_status';
  if (field === 'ecclesiastical_title') return 'title';
  return null;
}

function isBaptismSummaryColumn(column: BaptismReportColumnKey) {
  return ['church', 'regional', 'field', 'title', 'member_status', 'workflow_status', 'service'].includes(column);
}

function buildBaptismColumnSummaries(
  rows: BaptismPreviewRow[],
  columns: BaptismReportColumnKey[],
  excludedColumns: BaptismReportColumnKey[] = [],
): BaptismColumnSummaryBlock[] {
  return columns
    .filter((column) => isBaptismSummaryColumn(column) && !excludedColumns.includes(column))
    .map((column) => {
      const counts = new Map<string, number>();

      rows.forEach((row) => {
        const value = normalizeMemberSummaryValue(getBaptismPreviewColumnValue(row, column));
        counts.set(value, (counts.get(value) || 0) + 1);
      });

      const items = Array.from(counts.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((left, right) => {
          if (right.count !== left.count) return right.count - left.count;
          return compareLocaleValues(left.label, right.label);
        });

      return {
        column,
        label: getBaptismReportColumnLabel(column),
        items,
      };
    })
    .filter((block) => block.items.length > 0);
}

function getBaptismGroupLabel(field: BaptismReportGroupKey) {
  return BAPTISM_REPORT_GROUP_OPTIONS.find((option) => option.value === field)?.label || field;
}

function getBaptismMetricValue(_row: BaptismPreviewRow, _metric: BaptismReportMetricKey) {
  return 1;
}

function buildBaptismPreviewGroups(rows: BaptismPreviewRow[], groupBy: BaptismReportGroupKey[], metric: BaptismReportMetricKey, depth = 0): BaptismPreviewGroupNode[] {
  const field = groupBy[depth];
  if (!field) return [];

  const buckets = new Map<string, BaptismPreviewRow[]>();
  for (const row of rows) {
    const key = getBaptismPreviewGroupValue(row, field) || 'Não informado';
    const current = buckets.get(key) || [];
    current.push(row);
    buckets.set(key, current);
  }

  return Array.from(buckets.entries())
    .sort(([left], [right]) => compareLocaleValues(left, right))
    .map(([label, bucket]) => ({
      id: `${field}-${label}-${depth}`,
      field,
      label,
      total: bucket.reduce((sum, row) => sum + getBaptismMetricValue(row, metric), 0),
      rowCount: bucket.length,
      rows: bucket,
      children: buildBaptismPreviewGroups(bucket, groupBy, metric, depth + 1),
    }));
}

function getConsecrationPreviewGroupValue(row: ConsecrationPreviewRow, field: ConsecrationReportGroupKey) {
  if (field === 'field') return row.field;
  if (field === 'regional') return row.regional;
  if (field === 'church') return row.church;
  if (field === 'workflow_status') return row.workflow_status;
  if (field === 'service') return row.service;
  if (field === 'member_status') return row.member_status;
  if (field === 'current_title') return row.current_title;
  return row.intended_title;
}

function getConsecrationPreviewColumnValue(row: ConsecrationPreviewRow, column: ConsecrationReportColumnKey) {
  return row[column] || '-';
}

function getConsecrationReportColumnLabel(column: ConsecrationReportColumnKey, abbreviated = false) {
  const label = CONSECRATION_REPORT_COLUMN_OPTIONS.find((option) => option.value === column)?.label || column;
  return abbreviated ? abbreviateCompoundColumnLabel(label) : label;
}

function getConsecrationGroupedColumnKey(field: ConsecrationReportGroupKey): ConsecrationReportColumnKey | null {
  if (field === 'field') return 'field';
  if (field === 'regional') return 'regional';
  if (field === 'church') return 'church';
  if (field === 'workflow_status') return 'workflow_status';
  if (field === 'service') return 'service';
  if (field === 'member_status') return 'member_status';
  if (field === 'current_title') return 'current_title';
  if (field === 'intended_title') return 'intended_title';
  return null;
}

function isConsecrationSummaryColumn(column: ConsecrationReportColumnKey) {
  return ['church', 'regional', 'field', 'member_status', 'workflow_status', 'service', 'current_title', 'intended_title'].includes(column);
}

function buildConsecrationColumnSummaries(
  rows: ConsecrationPreviewRow[],
  columns: ConsecrationReportColumnKey[],
  excludedColumns: ConsecrationReportColumnKey[] = [],
): ConsecrationColumnSummaryBlock[] {
  return columns
    .filter((column) => isConsecrationSummaryColumn(column) && !excludedColumns.includes(column))
    .map((column) => {
      const counts = new Map<string, number>();

      rows.forEach((row) => {
        const value = normalizeMemberSummaryValue(getConsecrationPreviewColumnValue(row, column));
        counts.set(value, (counts.get(value) || 0) + 1);
      });

      const items = Array.from(counts.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((left, right) => {
          if (right.count !== left.count) return right.count - left.count;
          return compareLocaleValues(left.label, right.label);
        });

      return {
        column,
        label: getConsecrationReportColumnLabel(column),
        items,
      };
    })
    .filter((block) => block.items.length > 0);
}

function getConsecrationGroupLabel(field: ConsecrationReportGroupKey) {
  return CONSECRATION_REPORT_GROUP_OPTIONS.find((option) => option.value === field)?.label || field;
}

function getConsecrationMetricValue(_row: ConsecrationPreviewRow, _metric: ConsecrationReportMetricKey) {
  return 1;
}

function buildConsecrationPreviewGroups(rows: ConsecrationPreviewRow[], groupBy: ConsecrationReportGroupKey[], metric: ConsecrationReportMetricKey, depth = 0): ConsecrationPreviewGroupNode[] {
  const field = groupBy[depth];
  if (!field) return [];

  const buckets = new Map<string, ConsecrationPreviewRow[]>();
  for (const row of rows) {
    const key = getConsecrationPreviewGroupValue(row, field) || 'Não informado';
    const current = buckets.get(key) || [];
    current.push(row);
    buckets.set(key, current);
  }

  return Array.from(buckets.entries())
    .sort(([left], [right]) => compareLocaleValues(left, right))
    .map(([label, bucket]) => ({
      id: `${field}-${label}-${depth}`,
      field,
      label,
      total: bucket.reduce((sum, row) => sum + getConsecrationMetricValue(row, metric), 0),
      rowCount: bucket.length,
      rows: bucket,
      children: buildConsecrationPreviewGroups(bucket, groupBy, metric, depth + 1),
    }));
}

function getTransferPreviewGroupValue(row: TransferPreviewRow, field: TransferReportGroupKey) {
  if (field === 'origin_field') return row.origin_field;
  if (field === 'origin_regional') return row.origin_regional;
  if (field === 'origin_church') return row.origin_church;
  if (field === 'destination_field') return row.destination_field;
  if (field === 'destination_regional') return row.destination_regional;
  if (field === 'destination_church') return row.destination_church;
  if (field === 'workflow_status') return row.workflow_status;
  if (field === 'member_status') return row.member_status;
  return row.current_title;
}

function getTransferPreviewColumnValue(row: TransferPreviewRow, column: TransferReportColumnKey) {
  return row[column] || '-';
}

function getTransferReportColumnLabel(column: TransferReportColumnKey, abbreviated = false) {
  const label = TRANSFER_REPORT_COLUMN_OPTIONS.find((option) => option.value === column)?.label || column;
  return abbreviated ? abbreviateCompoundColumnLabel(label) : label;
}

function getTransferGroupedColumnKey(field: TransferReportGroupKey): TransferReportColumnKey | null {
  if (field === 'origin_field') return 'origin_field';
  if (field === 'origin_regional') return 'origin_regional';
  if (field === 'origin_church') return 'origin_church';
  if (field === 'destination_field') return 'destination_field';
  if (field === 'destination_regional') return 'destination_regional';
  if (field === 'destination_church') return 'destination_church';
  if (field === 'workflow_status') return 'workflow_status';
  if (field === 'member_status') return 'member_status';
  if (field === 'current_title') return 'current_title';
  return null;
}

function isTransferSummaryColumn(column: TransferReportColumnKey) {
  return ['origin_field', 'origin_regional', 'origin_church', 'destination_field', 'destination_regional', 'destination_church', 'current_title', 'member_status', 'workflow_status', 'service'].includes(column);
}

function buildTransferColumnSummaries(
  rows: TransferPreviewRow[],
  columns: TransferReportColumnKey[],
  excludedColumns: TransferReportColumnKey[] = [],
): TransferColumnSummaryBlock[] {
  return columns
    .filter((column) => isTransferSummaryColumn(column) && !excludedColumns.includes(column))
    .map((column) => {
      const counts = new Map<string, number>();

      rows.forEach((row) => {
        const value = normalizeMemberSummaryValue(getTransferPreviewColumnValue(row, column));
        counts.set(value, (counts.get(value) || 0) + 1);
      });

      const items = Array.from(counts.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((left, right) => {
          if (right.count !== left.count) return right.count - left.count;
          return compareLocaleValues(left.label, right.label);
        });

      return {
        column,
        label: getTransferReportColumnLabel(column),
        items,
      };
    })
    .filter((block) => block.items.length > 0);
}

function getTransferGroupLabel(field: TransferReportGroupKey) {
  return TRANSFER_REPORT_GROUP_OPTIONS.find((option) => option.value === field)?.label || field;
}

function getTransferMetricValue(_row: TransferPreviewRow, _metric: TransferReportMetricKey) {
  return 1;
}

function buildTransferPreviewGroups(rows: TransferPreviewRow[], groupBy: TransferReportGroupKey[], metric: TransferReportMetricKey, depth = 0): TransferPreviewGroupNode[] {
  const field = groupBy[depth];
  if (!field) return [];

  const buckets = new Map<string, TransferPreviewRow[]>();
  for (const row of rows) {
    const key = getTransferPreviewGroupValue(row, field) || 'Não informado';
    const current = buckets.get(key) || [];
    current.push(row);
    buckets.set(key, current);
  }

  return Array.from(buckets.entries())
    .sort(([left], [right]) => compareLocaleValues(left, right))
    .map(([label, bucket]) => ({
      id: `${field}-${label}-${depth}`,
      field,
      label,
      total: bucket.reduce((sum, row) => sum + getTransferMetricValue(row, metric), 0),
      rowCount: bucket.length,
      rows: bucket,
      children: buildTransferPreviewGroups(bucket, groupBy, metric, depth + 1),
    }));
}

function cloneMemberReportBuilderState(builder: MemberReportBuilderState): MemberReportBuilderState {
  return {
    ...builder,
    fieldIds: [...builder.fieldIds],
    regionalIds: [...builder.regionalIds],
    churchIds: [...builder.churchIds],
    statuses: [...builder.statuses],
    memberTypes: [...builder.memberTypes],
    groupBy: [...builder.groupBy],
    columns: [...builder.columns],
  };
}

function cloneBaptismReportBuilderState(builder: BaptismReportBuilderState): BaptismReportBuilderState {
  return {
    ...builder,
    fieldIds: [...builder.fieldIds],
    regionalIds: [...builder.regionalIds],
    churchIds: [...builder.churchIds],
    workflowStatuses: [...builder.workflowStatuses],
    memberStatuses: [...builder.memberStatuses],
    memberTypes: [...(builder.memberTypes ?? [])],
    groupBy: [...builder.groupBy],
    columns: [...builder.columns],
  };
}

function normalizeMemberReportBuilderState(builder?: Partial<MemberReportBuilderState>): MemberReportBuilderState {
  const allowedReportTypes = new Set(MEMBER_REPORT_TYPE_OPTIONS.map((option) => option.value));
  const allowedGroupBy = new Set(MEMBER_REPORT_GROUP_OPTIONS.map((option) => option.value));
  const allowedColumns = new Set(MEMBER_REPORT_COLUMN_OPTIONS.map((option) => option.value));
  const allowedMetrics = new Set(MEMBER_REPORT_METRIC_OPTIONS.map((option) => option.value));
  const fallbackColumns: MemberReportColumnKey[] = ['name', 'cpf', 'church', 'regional', 'field', 'title', 'status'];
  const nextColumns = Array.isArray(builder?.columns)
    ? builder.columns.filter((column): column is MemberReportColumnKey => allowedColumns.has(column)).filter((column, index, values) => values.indexOf(column) === index)
    : [];
  const columns = nextColumns.length ? nextColumns : fallbackColumns;
  const sortBy = builder?.sortBy && columns.includes(builder.sortBy) ? builder.sortBy : columns[0];

  return {
    reportType: builder?.reportType && allowedReportTypes.has(builder.reportType) ? builder.reportType : 'members_list',
    dateFrom: typeof builder?.dateFrom === 'string' ? builder.dateFrom : '',
    dateTo: typeof builder?.dateTo === 'string' ? builder.dateTo : '',
    fieldIds: Array.isArray(builder?.fieldIds) ? builder.fieldIds.filter((value): value is string => typeof value === 'string') : [],
    regionalIds: Array.isArray(builder?.regionalIds) ? builder.regionalIds.filter((value): value is string => typeof value === 'string') : [],
    churchIds: Array.isArray(builder?.churchIds) ? builder.churchIds.filter((value): value is string => typeof value === 'string') : [],
    statuses: Array.isArray(builder?.statuses) ? builder.statuses.filter((value): value is string => typeof value === 'string') : [],
    memberTypes: Array.isArray(builder?.memberTypes) ? builder.memberTypes.filter((value): value is string => typeof value === 'string') : ['MEMBRO'],
    groupBy: Array.isArray(builder?.groupBy)
      ? builder.groupBy.filter((value): value is MemberReportGroupKey => allowedGroupBy.has(value)).filter((value, index, values) => values.indexOf(value) === index)
      : [],
    columns,
    metric: builder?.metric && allowedMetrics.has(builder.metric) ? builder.metric : 'count',
    sortBy,
    sortDirection: builder?.sortDirection === 'desc' ? 'desc' : 'asc',
    orientation: builder?.orientation === 'landscape' ? 'landscape' : 'portrait',
    zebraEnabled: builder?.zebraEnabled ?? true,
    zebraColor: typeof builder?.zebraColor === 'string' && builder.zebraColor ? builder.zebraColor : '#f6fbff',
  };
}

function normalizeBaptismReportBuilderState(builder?: Partial<BaptismReportBuilderState>): BaptismReportBuilderState {
  const allowedReportTypes = new Set(BAPTISM_REPORT_TYPE_OPTIONS.map((option) => option.value));
  const allowedGroupBy = new Set(BAPTISM_REPORT_GROUP_OPTIONS.map((option) => option.value));
  const allowedColumns = new Set(BAPTISM_REPORT_COLUMN_OPTIONS.map((option) => option.value));
  const allowedMetrics = new Set(BAPTISM_REPORT_METRIC_OPTIONS.map((option) => option.value));
  const fallbackColumns: BaptismReportColumnKey[] = ['protocol', 'name', 'church', 'regional', 'field', 'title', 'member_status', 'workflow_status'];
  const nextColumns = Array.isArray(builder?.columns)
    ? builder.columns.filter((column): column is BaptismReportColumnKey => allowedColumns.has(column)).filter((column, index, values) => values.indexOf(column) === index)
    : [];
  const columns = nextColumns.length ? nextColumns : fallbackColumns;
  const sortBy = builder?.sortBy && columns.includes(builder.sortBy) ? builder.sortBy : columns[0];

  return {
    reportType: builder?.reportType && allowedReportTypes.has(builder.reportType) ? builder.reportType : 'grouped_status',
    dateFrom: typeof builder?.dateFrom === 'string' ? builder.dateFrom : '',
    dateTo: typeof builder?.dateTo === 'string' ? builder.dateTo : '',
    fieldIds: Array.isArray(builder?.fieldIds) ? builder.fieldIds.filter((value): value is string => typeof value === 'string') : [],
    regionalIds: Array.isArray(builder?.regionalIds) ? builder.regionalIds.filter((value): value is string => typeof value === 'string') : [],
    churchIds: Array.isArray(builder?.churchIds) ? builder.churchIds.filter((value): value is string => typeof value === 'string') : [],
    workflowStatuses: Array.isArray(builder?.workflowStatuses) ? builder.workflowStatuses.filter((value): value is string => typeof value === 'string') : [],
    memberStatuses: Array.isArray(builder?.memberStatuses) ? builder.memberStatuses.filter((value): value is string => typeof value === 'string') : [],
    memberTypes: Array.isArray(builder?.memberTypes) ? builder.memberTypes.filter((value): value is string => typeof value === 'string') : ['MEMBRO'],
    groupBy: Array.isArray(builder?.groupBy)
      ? builder.groupBy.filter((value): value is BaptismReportGroupKey => allowedGroupBy.has(value)).filter((value, index, values) => values.indexOf(value) === index)
      : [],
    columns,
    metric: builder?.metric && allowedMetrics.has(builder.metric) ? builder.metric : 'count',
    sortBy,
    sortDirection: builder?.sortDirection === 'desc' ? 'desc' : 'asc',
    orientation: builder?.orientation === 'landscape' ? 'landscape' : 'portrait',
    zebraEnabled: builder?.zebraEnabled ?? true,
    zebraColor: typeof builder?.zebraColor === 'string' && builder.zebraColor ? builder.zebraColor : '#eef8ff',
  };
}

function cloneConsecrationReportBuilderState(builder: ConsecrationReportBuilderState): ConsecrationReportBuilderState {
  return {
    reportType: builder.reportType,
    dateFrom: builder.dateFrom,
    dateTo: builder.dateTo,
    fieldIds: [...builder.fieldIds],
    regionalIds: [...builder.regionalIds],
    churchIds: [...builder.churchIds],
    workflowStatuses: [...builder.workflowStatuses],
    memberStatuses: [...builder.memberStatuses],
    memberTypes: [...(builder.memberTypes ?? [])],
    groupBy: [...builder.groupBy],
    columns: [...builder.columns],
    metric: builder.metric,
    sortBy: builder.sortBy,
    sortDirection: builder.sortDirection,
    orientation: builder.orientation,
    zebraEnabled: builder.zebraEnabled,
    zebraColor: builder.zebraColor,
  };
}

function normalizeConsecrationReportBuilderState(builder?: Partial<ConsecrationReportBuilderState>): ConsecrationReportBuilderState {
  const allowedReportTypes = new Set(CONSECRATION_REPORT_TYPE_OPTIONS.map((option) => option.value));
  const allowedGroupBy = new Set(CONSECRATION_REPORT_GROUP_OPTIONS.map((option) => option.value));
  const allowedColumns = new Set(CONSECRATION_REPORT_COLUMN_OPTIONS.map((option) => option.value));
  const allowedMetrics = new Set(CONSECRATION_REPORT_METRIC_OPTIONS.map((option) => option.value));
  const fallbackColumns: ConsecrationReportColumnKey[] = ['protocol', 'name', 'church', 'regional', 'field', 'current_title', 'intended_title', 'workflow_status'];
  const nextColumns = Array.isArray(builder?.columns)
    ? builder.columns.filter((column): column is ConsecrationReportColumnKey => allowedColumns.has(column)).filter((column, index, values) => values.indexOf(column) === index)
    : [];
  const columns = nextColumns.length ? nextColumns : fallbackColumns;
  const sortBy = builder?.sortBy && columns.includes(builder.sortBy) ? builder.sortBy : columns[0];

  return {
    reportType: builder?.reportType && allowedReportTypes.has(builder.reportType) ? builder.reportType : 'grouped_status',
    dateFrom: typeof builder?.dateFrom === 'string' ? builder.dateFrom : '',
    dateTo: typeof builder?.dateTo === 'string' ? builder.dateTo : '',
    fieldIds: Array.isArray(builder?.fieldIds) ? builder.fieldIds.filter((value): value is string => typeof value === 'string') : [],
    regionalIds: Array.isArray(builder?.regionalIds) ? builder.regionalIds.filter((value): value is string => typeof value === 'string') : [],
    churchIds: Array.isArray(builder?.churchIds) ? builder.churchIds.filter((value): value is string => typeof value === 'string') : [],
    workflowStatuses: Array.isArray(builder?.workflowStatuses) ? builder.workflowStatuses.filter((value): value is string => typeof value === 'string') : [],
    memberStatuses: Array.isArray(builder?.memberStatuses) ? builder.memberStatuses.filter((value): value is string => typeof value === 'string') : [],
    memberTypes: Array.isArray(builder?.memberTypes) ? builder.memberTypes.filter((value): value is string => typeof value === 'string') : ['MEMBRO'],
    groupBy: Array.isArray(builder?.groupBy)
      ? builder.groupBy.filter((value): value is ConsecrationReportGroupKey => allowedGroupBy.has(value)).filter((value, index, values) => values.indexOf(value) === index)
      : [],
    columns,
    metric: builder?.metric && allowedMetrics.has(builder.metric) ? builder.metric : 'count',
    sortBy,
    sortDirection: builder?.sortDirection === 'desc' ? 'desc' : 'asc',
    orientation: builder?.orientation === 'landscape' ? 'landscape' : 'portrait',
    zebraEnabled: builder?.zebraEnabled ?? true,
    zebraColor: typeof builder?.zebraColor === 'string' && builder.zebraColor ? builder.zebraColor : '#eef8ff',
  };
}

function cloneTransferReportBuilderState(builder: TransferReportBuilderState): TransferReportBuilderState {
  return {
    reportType: builder.reportType,
    dateFrom: builder.dateFrom,
    dateTo: builder.dateTo,
    fieldIds: [...builder.fieldIds],
    regionalIds: [...builder.regionalIds],
    churchIds: [...builder.churchIds],
    destinationChurchIds: [...builder.destinationChurchIds],
    workflowStatuses: [...builder.workflowStatuses],
    memberStatuses: [...builder.memberStatuses],
    groupBy: [...builder.groupBy],
    columns: [...builder.columns],
    metric: builder.metric,
    sortBy: builder.sortBy,
    sortDirection: builder.sortDirection,
    orientation: builder.orientation,
    zebraEnabled: builder.zebraEnabled,
    zebraColor: builder.zebraColor,
  };
}

function normalizeTransferReportBuilderState(builder?: Partial<TransferReportBuilderState>): TransferReportBuilderState {
  const allowedReportTypes = new Set(TRANSFER_REPORT_TYPE_OPTIONS.map((option) => option.value));
  const allowedGroupBy = new Set(TRANSFER_REPORT_GROUP_OPTIONS.map((option) => option.value));
  const allowedColumns = new Set(TRANSFER_REPORT_COLUMN_OPTIONS.map((option) => option.value));
  const allowedMetrics = new Set(TRANSFER_REPORT_METRIC_OPTIONS.map((option) => option.value));
  const fallbackColumns: TransferReportColumnKey[] = ['protocol', 'name', 'origin_church', 'destination_church', 'current_title', 'workflow_status'];
  const nextColumns = Array.isArray(builder?.columns)
    ? builder.columns.filter((column): column is TransferReportColumnKey => allowedColumns.has(column)).filter((column, index, values) => values.indexOf(column) === index)
    : [];
  const columns = nextColumns.length ? nextColumns : fallbackColumns;
  const sortBy = builder?.sortBy && columns.includes(builder.sortBy) ? builder.sortBy : columns[0];

  return {
    reportType: builder?.reportType && allowedReportTypes.has(builder.reportType) ? builder.reportType : 'grouped_status',
    dateFrom: typeof builder?.dateFrom === 'string' ? builder.dateFrom : '',
    dateTo: typeof builder?.dateTo === 'string' ? builder.dateTo : '',
    fieldIds: Array.isArray(builder?.fieldIds) ? builder.fieldIds.filter((value): value is string => typeof value === 'string') : [],
    regionalIds: Array.isArray(builder?.regionalIds) ? builder.regionalIds.filter((value): value is string => typeof value === 'string') : [],
    churchIds: Array.isArray(builder?.churchIds) ? builder.churchIds.filter((value): value is string => typeof value === 'string') : [],
    destinationChurchIds: Array.isArray(builder?.destinationChurchIds) ? builder.destinationChurchIds.filter((value): value is string => typeof value === 'string') : [],
    workflowStatuses: Array.isArray(builder?.workflowStatuses) ? builder.workflowStatuses.filter((value): value is string => typeof value === 'string') : [],
    memberStatuses: Array.isArray(builder?.memberStatuses) ? builder.memberStatuses.filter((value): value is string => typeof value === 'string') : [],
    groupBy: Array.isArray(builder?.groupBy)
      ? builder.groupBy.filter((value): value is TransferReportGroupKey => allowedGroupBy.has(value)).filter((value, index, values) => values.indexOf(value) === index)
      : [],
    columns,
    metric: builder?.metric && allowedMetrics.has(builder.metric) ? builder.metric : 'count',
    sortBy,
    sortDirection: builder?.sortDirection === 'desc' ? 'desc' : 'asc',
    orientation: builder?.orientation === 'landscape' ? 'landscape' : 'portrait',
    zebraEnabled: builder?.zebraEnabled ?? true,
    zebraColor: typeof builder?.zebraColor === 'string' && builder.zebraColor ? builder.zebraColor : '#f4f9f7',
  };
}

function cloneChurchReportBuilderState(builder: ChurchReportBuilderState): ChurchReportBuilderState {
  return {
    dateFrom: builder.dateFrom,
    dateTo: builder.dateTo,
    fieldIds: [...builder.fieldIds],
    regionalIds: [...builder.regionalIds],
    churchIds: [...builder.churchIds],
    mode: builder.mode,
    groupBy: [...builder.groupBy],
    sections: [...builder.sections],
    columns: [...builder.columns],
    sortBy: builder.sortBy,
    sortDirection: builder.sortDirection,
    orientation: builder.orientation,
    zebraEnabled: builder.zebraEnabled,
    zebraColor: builder.zebraColor,
    showPhotos: builder.showPhotos,
    showMap: builder.showMap,
    memberTypes: [...(builder.memberTypes ?? [])],
  };
}

function normalizeChurchReportBuilderState(builder?: Partial<ChurchReportBuilderState>): ChurchReportBuilderState {
  const allowedGroups = new Set(CHURCH_REPORT_GROUP_OPTIONS.map((option) => option.value));
  const allowedSections = new Set(CHURCH_REPORT_SECTION_OPTIONS.map((option) => option.value));
  const allowedColumns = new Set(CHURCH_REPORT_COLUMN_OPTIONS.map((option) => option.value));
  const fallbackColumns = CHURCH_REPORT_COLUMN_OPTIONS.map((option) => option.value);
  const nextColumns = Array.isArray(builder?.columns)
    ? builder.columns.filter((column): column is ChurchReportColumnKey => allowedColumns.has(column)).filter((column, index, values) => values.indexOf(column) === index)
    : [];
  const columns = nextColumns.length ? nextColumns : fallbackColumns;
  const sortBy = builder?.sortBy && columns.includes(builder.sortBy) ? builder.sortBy : columns[0];

  return {
    dateFrom: typeof builder?.dateFrom === 'string' ? builder.dateFrom : '',
    dateTo: typeof builder?.dateTo === 'string' ? builder.dateTo : '',
    fieldIds: Array.isArray(builder?.fieldIds) ? builder.fieldIds.filter((value): value is string => typeof value === 'string') : [],
    regionalIds: Array.isArray(builder?.regionalIds) ? builder.regionalIds.filter((value): value is string => typeof value === 'string') : [],
    churchIds: Array.isArray(builder?.churchIds) ? builder.churchIds.filter((value): value is string => typeof value === 'string') : [],
    mode: builder?.mode === 'list' ? 'list' : 'single',
    groupBy: Array.isArray(builder?.groupBy)
      ? builder.groupBy.filter((value): value is ChurchReportGroupKey => allowedGroups.has(value)).filter((value, index, values) => values.indexOf(value) === index)
      : ['field', 'regional', 'church'],
    sections: Array.isArray(builder?.sections)
      ? builder.sections.filter((value): value is ChurchReportSectionKey => allowedSections.has(value)).filter((value, index, values) => values.indexOf(value) === index)
      : CHURCH_REPORT_SECTION_OPTIONS.map((option) => option.value),
    columns,
    sortBy,
    sortDirection: builder?.sortDirection === 'desc' ? 'desc' : 'asc',
    orientation: builder?.orientation === 'landscape' ? 'landscape' : 'portrait',
    zebraEnabled: builder?.zebraEnabled ?? true,
    zebraColor: typeof builder?.zebraColor === 'string' && builder.zebraColor ? builder.zebraColor : '#f6fbff',
    showPhotos: builder?.showPhotos ?? true,
    showMap: builder?.showMap ?? true,
    memberTypes: Array.isArray(builder?.memberTypes) ? builder.memberTypes.filter((value): value is string => typeof value === 'string') : ['MEMBRO'],
  };
}

function authFetch(url: string, init: RequestInit = {}) {
  const token = localStorage.getItem('mrm_token');
  return fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
}

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('mrm_user') || '{}');
  } catch {
    return {};
  }
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR');
}

function formatLongDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function getAgeValue(value?: string | null) {
  if (!value) return 'Não informado';
  const birthDate = new Date(value);
  if (Number.isNaN(birthDate.getTime())) return 'Não informado';
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const beforeBirthday = now.getMonth() < birthDate.getMonth() || (now.getMonth() === birthDate.getMonth() && now.getDate() < birthDate.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? String(age) : 'Não informado';
}

function normalizeDigits(value?: string | null) {
  return String(value || '').replace(/\D/g, '');
}

function formatMemberContact(member: Partial<MemberReportItem>) {
  const cpfDigits = normalizeDigits(member.cpf);
  const seen = new Set<string>();
  const parts = [member.phone, member.mobile]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value) => !value.includes('@'))
    .filter((value) => normalizeDigits(value) !== cpfDigits)
    .filter((value) => {
      const normalized = normalizeDigits(value) || value.toLowerCase();
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  return parts.length ? parts.join(' | ') : 'Não informado';
}

function formatMemberEmail(member: Partial<MemberReportItem>) {
  return member.email?.trim() || 'Não informado';
}

function formatVoterTitle(member: Partial<MemberReportItem> & { voterRegistration?: string | null; voterZone?: string | null; voterSection?: string | null }) {
  const registration = member.voterRegistration?.trim();
  const zone = member.voterZone?.trim();
  const section = member.voterSection?.trim();
  if (!registration && !zone && !section) return 'Não informado';
  const details = [registration, zone ? `Zona ${zone}` : '', section ? `Seção ${section}` : ''].filter(Boolean);
  return details.join(' | ');
}

function monthLabelFromDate(value?: string | null) {
  if (!value) return 'Sem data';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem data';
  return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

function formatMetric(value: number) {
  return new Intl.NumberFormat('pt-BR').format(value);
}

function normalizeGenderLabel(value?: string | null) {
  const normalized = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (!normalized) return 'Não informado';
  if (['m', 'masculino', 'homem', 'male'].includes(normalized)) return 'Homens';
  if (['f', 'feminino', 'mulher', 'female'].includes(normalized)) return 'Mulheres';
  return 'Não informado';
}

function normalizeMembershipStatusLabel(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return 'Não informado';
  const normalized = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (normalized.includes('inativ')) return 'Inativos';
  if (normalized.includes('aguard')) return 'Aguardando ativação';
  if (normalized.includes('ativo')) return 'Ativos';
  return raw;
}

function normalizeBaptismStatusLabel(value?: string | null, baptismDate?: string | null) {
  const raw = String(value || '').trim();
  if (raw) return raw;
  return baptismDate ? 'Batizado' : 'Não batizado';
}

function normalizeMaritalStatusLabel(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return 'Não informado';
  const normalized = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (normalized.includes('casad')) return 'Casados';
  if (normalized.includes('solteir')) return 'Solteiros';
  if (normalized.includes('viuv')) return 'Viúvos';
  if (normalized.includes('divorc')) return 'Divorciados';
  return raw;
}

function getAgeRangeLabel(value?: string | null) {
  if (!value) return 'Não informado';
  const birthDate = new Date(value);
  if (Number.isNaN(birthDate.getTime())) return 'Não informado';
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const beforeBirthday = now.getMonth() < birthDate.getMonth() || (now.getMonth() === birthDate.getMonth() && now.getDate() < birthDate.getDate());
  if (beforeBirthday) age -= 1;
  if (age < 0) return 'Não informado';
  if (age <= 12) return '0-12';
  if (age <= 17) return '13-17';
  if (age <= 25) return '18-25';
  if (age <= 40) return '26-40';
  if (age <= 60) return '41-60';
  return '60+';
}

function toSafeLabel(value?: string | null) {
  const text = String(value || '').trim();
  return text || 'Não informado';
}

function toNumberOrNull(value?: string | number | null) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDateInputValue(value?: Date | null) {
  if (!value) return '';
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toDateInputValue(start), to: toDateInputValue(end) };
}

function getPresetDateRange(preset: DatePresetKey) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === 'all') return { from: null, to: null };
  if (preset === 'custom') return { from: null, to: end };

  const daysMap: Record<Exclude<DatePresetKey, 'all' | 'custom'>, number> = {
    '30d': 30,
    '90d': 90,
    '180d': 180,
    '365d': 365,
  };
  const from = new Date(end);
  from.setDate(from.getDate() - daysMap[preset]);
  return { from, to: end };
}

function parseRecordDate(value: SourceRecord[string]) {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function getGridClass(gridSize: GridSizeKey) {
  if (gridSize === 'full') return 'xl:col-span-4 lg:col-span-2';
  if (gridSize === 'large') return 'xl:col-span-3 lg:col-span-2';
  if (gridSize === 'medium') return 'xl:col-span-2';
  return 'xl:col-span-1';
}

function getLegendConfig(showLegend: boolean, legendPosition: LegendPositionKey) {
  if (!showLegend) return { show: false };
  if (legendPosition === 'top') return { show: true, top: 0, left: 'center' };
  if (legendPosition === 'bottom') return { show: true, bottom: 0, left: 'center' };
  if (legendPosition === 'left') return { show: true, left: 0, top: 'middle', orient: 'vertical' as const };
  return { show: true, right: 0, top: 'middle', orient: 'vertical' as const };
}

function calculateMetricTotals(rows: Array<Record<string, string | number>>, metricKeys: string[]) {
  return metricKeys.map((metricKey) => ({
    key: metricKey,
    value: rows.reduce((total, row) => total + Number(row[metricKey] || 0), 0),
  }));
}

function aggregateRows(records: SourceRecord[], dimensionKey: string, metricKeys: string[]) {
  const rows = new Map<string, Record<string, string | number>>();

  for (const record of records) {
    const rawDimension = record[dimensionKey];
    const dimensionValue = rawDimension === null || rawDimension === undefined || rawDimension === ''
      ? 'Não informado'
      : String(rawDimension);

    if (!rows.has(dimensionValue)) {
      rows.set(dimensionValue, { dimension: dimensionValue });
      for (const metricKey of metricKeys) {
        rows.get(dimensionValue)![metricKey] = 0;
      }
    }

    const target = rows.get(dimensionValue)!;
    for (const metricKey of metricKeys) {
      if (metricKey === '__count') {
        target[metricKey] = Number(target[metricKey] || 0) + 1;
        continue;
      }
      const value = Number(record[metricKey] || 0);
      target[metricKey] = Number(target[metricKey] || 0) + (Number.isFinite(value) ? value : 0);
    }
  }

  return Array.from(rows.values()).sort((left, right) => {
    const leftDimension = String(left.dimension || '');
    const rightDimension = String(right.dimension || '');
    return leftDimension.localeCompare(rightDimension, 'pt-BR');
  });
}

function aggregateGeoRows(
  records: SourceRecord[],
  dimensionKey: string,
  metricKeys: string[],
  latitudeKey?: string,
  longitudeKey?: string,
) {
  const rows = new Map<string, Record<string, string | number>>();

  for (const record of records) {
    const latitude = latitudeKey ? toNumberOrNull(record[latitudeKey]) : null;
    const longitude = longitudeKey ? toNumberOrNull(record[longitudeKey]) : null;
    if (latitude === null || longitude === null) continue;

    const rawDimension = record[dimensionKey];
    const dimensionValue = rawDimension === null || rawDimension === undefined || rawDimension === ''
      ? 'Não informado'
      : String(rawDimension);

    if (!rows.has(dimensionValue)) {
      rows.set(dimensionValue, {
        dimension: dimensionValue,
        __latTotal: 0,
        __lonTotal: 0,
        __points: 0,
      });
      for (const metricKey of metricKeys) {
        rows.get(dimensionValue)![metricKey] = 0;
      }
    }

    const target = rows.get(dimensionValue)!;
    target.__latTotal = Number(target.__latTotal || 0) + latitude;
    target.__lonTotal = Number(target.__lonTotal || 0) + longitude;
    target.__points = Number(target.__points || 0) + 1;

    for (const metricKey of metricKeys) {
      if (metricKey === '__count') {
        target[metricKey] = Number(target[metricKey] || 0) + 1;
        continue;
      }
      const value = Number(record[metricKey] || 0);
      target[metricKey] = Number(target[metricKey] || 0) + (Number.isFinite(value) ? value : 0);
    }
  }

  return Array.from(rows.values())
    .map((row) => ({
      ...row,
      latitude: Number(row.__latTotal || 0) / Math.max(Number(row.__points || 0), 1),
      longitude: Number(row.__lonTotal || 0) / Math.max(Number(row.__points || 0), 1),
    }))
    .sort((left, right) => String(left.dimension || '').localeCompare(String(right.dimension || ''), 'pt-BR'));
}

function normalizeChartConfig(chart: Partial<SavedChartConfig>): SavedChartConfig {
  return {
    id: chart.id || makeId('chart'),
    title: chart.title || '',
    sourceKey: chart.sourceKey || 'members_evolution',
    chartType: chart.chartType || 'bar',
    dimensionKey: chart.dimensionKey || 'periodo',
    metricKeys: Array.isArray(chart.metricKeys) && chart.metricKeys.length ? chart.metricKeys : ['__count'],
    gridSize: chart.gridSize || 'large',
    showTable: Boolean(chart.showTable),
    showLegend: chart.showLegend ?? true,
    legendPosition: chart.legendPosition || 'bottom',
    showTotals: chart.showTotals ?? true,
  };
}

function loadPersistedDashboards(): PersistedReportsState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as PersistedReportsState;
      if (Array.isArray(parsed?.dashboards) && parsed.dashboards.length > 0) {
        return {
          activeDashboardId: parsed.activeDashboardId,
          dashboards: parsed.dashboards.map((dashboard, index) => ({
            id: dashboard.id || makeId('dashboard'),
            name: dashboard.name || `Dashboard ${index + 1}`,
            charts: Array.isArray(dashboard.charts) ? dashboard.charts.map((chart) => normalizeChartConfig(chart)) : [],
          })),
        };
      }
    }
  } catch {
    // ignore
  }

  const defaultDashboardId = makeId('dashboard');
  return {
    activeDashboardId: defaultDashboardId,
    dashboards: [
      {
        id: defaultDashboardId,
        name: 'Dashboard 1',
        charts: [
          {
            ...normalizeChartConfig({
              id: makeId('chart'),
              title: 'Evolução de membros e visitantes',
              sourceKey: 'members_evolution',
              chartType: 'line',
              dimensionKey: 'periodo',
              metricKeys: ['membros', 'visitantes'],
              gridSize: 'large',
              showTable: false,
            }),
          },
          {
            ...normalizeChartConfig({
              id: makeId('chart'),
              title: 'Batismos por status',
              sourceKey: 'baptism_queue',
              chartType: 'bar',
              dimensionKey: 'status',
              metricKeys: ['__count'],
              gridSize: 'medium',
              showTable: false,
            }),
          },
        ],
      },
    ],
  };
}

function savePersistedDashboards(state: PersistedReportsState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadPersistedMemberReportTemplates(): SavedMemberReportTemplate[] {
  try {
    const stored = localStorage.getItem(MEMBER_REPORT_TEMPLATES_STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored) as SavedMemberReportTemplate[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((template, index) => ({
        id: template.id || makeId(`member-report-template-${index + 1}`),
        name: template.name || `Modelo ${index + 1}`,
        builder: normalizeMemberReportBuilderState(template.builder),
        createdAt: template.createdAt || new Date().toISOString(),
        updatedAt: template.updatedAt || template.createdAt || new Date().toISOString(),
      }))
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  } catch {
    return [];
  }
}

function savePersistedMemberReportTemplates(templates: SavedMemberReportTemplate[]) {
  localStorage.setItem(MEMBER_REPORT_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
}

function loadPersistedBaptismReportTemplates(): SavedBaptismReportTemplate[] {
  try {
    const stored = localStorage.getItem(BAPTISM_REPORT_TEMPLATES_STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored) as SavedBaptismReportTemplate[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((template, index) => ({
        id: template.id || makeId(`baptism-report-template-${index + 1}`),
        name: template.name || `Modelo ${index + 1}`,
        builder: normalizeBaptismReportBuilderState(template.builder),
        createdAt: template.createdAt || new Date().toISOString(),
        updatedAt: template.updatedAt || template.createdAt || new Date().toISOString(),
      }))
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  } catch {
    return [];
  }
}

function savePersistedBaptismReportTemplates(templates: SavedBaptismReportTemplate[]) {
  localStorage.setItem(BAPTISM_REPORT_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
}

function loadPersistedConsecrationReportTemplates(): SavedConsecrationReportTemplate[] {
  try {
    const stored = localStorage.getItem(CONSECRATION_REPORT_TEMPLATES_STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored) as SavedConsecrationReportTemplate[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((template, index) => ({
        id: template.id || makeId(`consecration-report-template-${index + 1}`),
        name: template.name || `Modelo ${index + 1}`,
        builder: normalizeConsecrationReportBuilderState(template.builder),
        createdAt: template.createdAt || new Date().toISOString(),
        updatedAt: template.updatedAt || template.createdAt || new Date().toISOString(),
      }))
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  } catch {
    return [];
  }
}

function savePersistedConsecrationReportTemplates(templates: SavedConsecrationReportTemplate[]) {
  localStorage.setItem(CONSECRATION_REPORT_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
}

function loadPersistedTransferReportTemplates(): SavedTransferReportTemplate[] {
  try {
    const stored = localStorage.getItem(TRANSFER_REPORT_TEMPLATES_STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored) as SavedTransferReportTemplate[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((template, index) => ({
        id: template.id || makeId(`transfer-report-template-${index + 1}`),
        name: template.name || `Modelo ${index + 1}`,
        builder: normalizeTransferReportBuilderState(template.builder),
        createdAt: template.createdAt || new Date().toISOString(),
        updatedAt: template.updatedAt || template.createdAt || new Date().toISOString(),
      }))
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  } catch {
    return [];
  }
}

function savePersistedTransferReportTemplates(templates: SavedTransferReportTemplate[]) {
  localStorage.setItem(TRANSFER_REPORT_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
}

function loadPersistedChurchReportTemplates(): SavedChurchReportTemplate[] {
  try {
    const stored = localStorage.getItem(CHURCH_REPORT_TEMPLATES_STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored) as SavedChurchReportTemplate[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((template, index) => ({
        id: template.id || makeId(`church-report-template-${index + 1}`),
        name: template.name || `Modelo ${index + 1}`,
        builder: normalizeChurchReportBuilderState(template.builder),
        createdAt: template.createdAt || new Date().toISOString(),
        updatedAt: template.updatedAt || template.createdAt || new Date().toISOString(),
      }))
      .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  } catch {
    return [];
  }
}

function savePersistedChurchReportTemplates(templates: SavedChurchReportTemplate[]) {
  localStorage.setItem(CHURCH_REPORT_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
}

function normalizeRequirementsReportBuilderState(raw: Partial<RequirementsReportBuilderState>): RequirementsReportBuilderState {
  return {
    dateFrom: raw.dateFrom || '',
    dateTo: raw.dateTo || '',
    fieldIds: Array.isArray(raw.fieldIds) ? raw.fieldIds : [],
    regionalIds: Array.isArray(raw.regionalIds) ? raw.regionalIds : [],
    churchIds: Array.isArray(raw.churchIds) ? raw.churchIds : [],
    serviceIds: Array.isArray(raw.serviceIds) ? raw.serviceIds : [],
    statuses: Array.isArray(raw.statuses) ? raw.statuses : [],
    memberTypes: Array.isArray(raw.memberTypes) ? raw.memberTypes : [],
    columns: Array.isArray(raw.columns) && raw.columns.length > 0 ? raw.columns : ['protocol', 'candidateName', 'service', 'church', 'stage', 'status', 'openedAt'],
    groupBy: (['none', 'regional', 'church'] as const).includes(raw.groupBy as 'none' | 'regional' | 'church') ? (raw.groupBy as 'none' | 'regional' | 'church') : 'none',
    sortBy: raw.sortBy || 'openedAt',
    sortDirection: raw.sortDirection || 'desc',
    orientation: raw.orientation || 'portrait',
    zebraEnabled: raw.zebraEnabled !== undefined ? raw.zebraEnabled : true,
    zebraColor: raw.zebraColor || '#f8fafc',
    templateName: raw.templateName || '',
  };
}

function loadPersistedRequirementsReportTemplates(): SavedRequirementsReportTemplate[] {
  try {
    const stored = localStorage.getItem(REQUIREMENTS_REPORT_TEMPLATES_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as SavedRequirementsReportTemplate[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((t, i) => ({
      id: t.id || makeId(`req-tpl-${i + 1}`),
      name: t.name || `Modelo ${i + 1}`,
      builder: normalizeRequirementsReportBuilderState(t.builder),
      createdAt: t.createdAt || new Date().toISOString(),
      updatedAt: t.updatedAt || t.createdAt || new Date().toISOString(),
    })).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch { return []; }
}

function savePersistedRequirementsReportTemplates(templates: SavedRequirementsReportTemplate[]) {
  localStorage.setItem(REQUIREMENTS_REPORT_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
}

const ALL_CREDENTIAL_COLUMNS: CredentialReportColumnKey[] = [
  'nome', 'tipo', 'numero', 'situacao', 'etapa', 'servico', 'igrejasolicitante', 'regional', 'campo',
  'dataemissao', 'datavalidade', 'aprovadopor', 'card_protocol',
];

const credentialColumnLabel: Record<CredentialReportColumnKey, string> = {
  nome: 'Nome',
  tipo: 'Tipo',
  numero: 'Número',
  situacao: 'Situação',
  etapa: 'Etapa do fluxo',
  servico: 'Serviço',
  igrejasolicitante: 'Igreja',
  regional: 'Regional',
  campo: 'Campo',
  dataemissao: 'Emissão',
  datavalidade: 'Validade',
  aprovadopor: 'Aprovado por',
  card_protocol: 'Protocolo',
};

const CRED_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pendente: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700' },
  aprovado: { label: 'Aprovado', cls: 'bg-emerald-100 text-emerald-700' },
  entregue: { label: 'Entregue', cls: 'bg-blue-100 text-blue-700' },
  cancelado: { label: 'Cancelado', cls: 'bg-red-100 text-red-700' },
};

function normalizeCredentialReportBuilderState(raw: Partial<CredentialReportBuilderState>): CredentialReportBuilderState {
  return {
    dateFrom: raw.dateFrom || '',
    dateTo: raw.dateTo || '',
    fieldIds: Array.isArray(raw.fieldIds) ? raw.fieldIds : [],
    regionalIds: Array.isArray(raw.regionalIds) ? raw.regionalIds : [],
    churchIds: Array.isArray(raw.churchIds) ? raw.churchIds : [],
    situacoes: Array.isArray(raw.situacoes) ? raw.situacoes : [],
    memberTypes: Array.isArray(raw.memberTypes) ? raw.memberTypes : [],
    columns: Array.isArray(raw.columns) && raw.columns.length > 0 ? raw.columns : ['nome', 'tipo', 'numero', 'situacao', 'igrejasolicitante', 'dataemissao', 'datavalidade'],
    groupBy: (['none', 'regional', 'church'] as const).includes(raw.groupBy as 'none' | 'regional' | 'church') ? (raw.groupBy as 'none' | 'regional' | 'church') : 'none',
    sortBy: raw.sortBy || 'created_at' as CredentialReportColumnKey,
    sortDirection: raw.sortDirection || 'desc',
    orientation: raw.orientation || 'portrait',
    zebraEnabled: raw.zebraEnabled !== undefined ? raw.zebraEnabled : true,
    zebraColor: raw.zebraColor || '#f8fafc',
    templateName: raw.templateName || '',
    memberDetailFields: Array.isArray(raw.memberDetailFields) && raw.memberDetailFields.length > 0
      ? raw.memberDetailFields
      : ['cpf', 'rg', 'birthDate', 'naturalityCity', 'maritalStatus', 'fatherName', 'motherName', 'spouseName'],
  };
}

function loadPersistedCredentialReportTemplates(): SavedCredentialReportTemplate[] {
  try {
    const stored = localStorage.getItem(CREDENTIAL_REPORT_TEMPLATES_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as SavedCredentialReportTemplate[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((t, i) => ({
      id: t.id || makeId(`cred-tpl-${i + 1}`),
      name: t.name || `Modelo ${i + 1}`,
      builder: normalizeCredentialReportBuilderState(t.builder),
      createdAt: t.createdAt || new Date().toISOString(),
      updatedAt: t.updatedAt || t.createdAt || new Date().toISOString(),
    })).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch { return []; }
}

function savePersistedCredentialReportTemplates(templates: SavedCredentialReportTemplate[]) {
  localStorage.setItem(CREDENTIAL_REPORT_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
}

function buildInitialChurchReportTemplates(baseBuilder: ChurchReportBuilderState): SavedChurchReportTemplate[] {
  const now = new Date().toISOString();
  return [
    {
      id: makeId('church-report-template'),
      name: 'Igreja completa por periodo',
      builder: normalizeChurchReportBuilderState({
        ...cloneChurchReportBuilderState(baseBuilder),
        mode: 'single',
        groupBy: ['field', 'regional', 'church'],
      }),
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function buildInitialMemberReportTemplates(baseBuilder: MemberReportBuilderState): SavedMemberReportTemplate[] {
  const now = new Date().toISOString();

  const makeTemplate = (
    name: string,
    overrides: Partial<MemberReportBuilderState>,
  ): SavedMemberReportTemplate => ({
    id: makeId('member-report-template'),
    name,
    builder: normalizeMemberReportBuilderState({
      ...cloneMemberReportBuilderState(baseBuilder),
      ...overrides,
    }),
    createdAt: now,
    updatedAt: now,
  });

  return [
    makeTemplate('Membros por igreja', {
      reportType: 'grouped_church',
      groupBy: ['church'],
      columns: ['name', 'cpf', 'title', 'status', 'church_address'],
      sortBy: 'church',
      sortDirection: 'asc',
      orientation: 'portrait',
    }),
    makeTemplate('Membros por regional', {
      reportType: 'grouped_regional',
      groupBy: ['regional', 'church'],
      columns: ['name', 'church', 'regional', 'title', 'status', 'church_city'],
      sortBy: 'regional',
      sortDirection: 'asc',
      orientation: 'portrait',
    }),
    makeTemplate('Crescimento por período', {
      reportType: 'growth_report',
      groupBy: ['field'],
      columns: ['name', 'regional', 'church', 'membership_date', 'status'],
      sortBy: 'membership_date',
      sortDirection: 'desc',
      orientation: 'landscape',
    }),
  ];
}

function buildInitialBaptismReportTemplates(baseBuilder: BaptismReportBuilderState): SavedBaptismReportTemplate[] {
  const now = new Date().toISOString();

  const makeTemplate = (
    name: string,
    overrides: Partial<BaptismReportBuilderState>,
  ): SavedBaptismReportTemplate => ({
    id: makeId('baptism-report-template'),
    name,
    builder: normalizeBaptismReportBuilderState({
      ...cloneBaptismReportBuilderState(baseBuilder),
      ...overrides,
    }),
    createdAt: now,
    updatedAt: now,
  });

  return [
    makeTemplate('Batismos por etapa', {
      reportType: 'grouped_status',
      groupBy: ['workflow_status', 'church'],
      columns: ['protocol', 'name', 'church', 'title', 'member_status', 'workflow_status', 'service', 'opened_at'],
      sortBy: 'workflow_status',
      sortDirection: 'asc',
    }),
    makeTemplate('Batismos por igreja', {
      reportType: 'grouped_church',
      groupBy: ['church', 'workflow_status'],
      columns: ['protocol', 'name', 'church', 'regional', 'title', 'member_status', 'workflow_status', 'next_baptism_date'],
      sortBy: 'church',
      sortDirection: 'asc',
    }),
    makeTemplate('Agenda de batismos', {
      reportType: 'scheduled_report',
      groupBy: ['field', 'regional', 'church'],
      columns: ['name', 'church', 'regional', 'field', 'workflow_status', 'baptism_date', 'next_baptism_date'],
      sortBy: 'next_baptism_date',
      sortDirection: 'asc',
      orientation: 'landscape',
    }),
  ];
}

function buildInitialConsecrationReportTemplates(baseBuilder: ConsecrationReportBuilderState): SavedConsecrationReportTemplate[] {
  const now = new Date().toISOString();

  const makeTemplate = (
    name: string,
    overrides: Partial<ConsecrationReportBuilderState>,
  ): SavedConsecrationReportTemplate => ({
    id: makeId('consecration-report-template'),
    name,
    builder: normalizeConsecrationReportBuilderState({
      ...cloneConsecrationReportBuilderState(baseBuilder),
      ...overrides,
    }),
    createdAt: now,
    updatedAt: now,
  });

  return [
    makeTemplate('Consagrações por etapa', {
      reportType: 'grouped_status',
      groupBy: ['workflow_status', 'church'],
      columns: ['protocol', 'name', 'church', 'current_title', 'intended_title', 'member_status', 'workflow_status', 'opened_at'],
      sortBy: 'workflow_status',
      sortDirection: 'asc',
    }),
    makeTemplate('Consagrações por igreja', {
      reportType: 'grouped_church',
      groupBy: ['church', 'workflow_status'],
      columns: ['protocol', 'name', 'church', 'regional', 'current_title', 'intended_title', 'workflow_status', 'next_consecration_date'],
      sortBy: 'church',
      sortDirection: 'asc',
    }),
    makeTemplate('Progressão de títulos', {
      reportType: 'title_progress',
      groupBy: ['intended_title', 'church'],
      columns: ['name', 'church', 'regional', 'field', 'current_title', 'intended_title', 'workflow_status', 'consecration_date', 'next_consecration_date'],
      sortBy: 'intended_title',
      sortDirection: 'asc',
      orientation: 'landscape',
    }),
  ];
}

function buildInitialTransferReportTemplates(baseBuilder: TransferReportBuilderState): SavedTransferReportTemplate[] {
  const now = new Date().toISOString();

  const makeTemplate = (
    name: string,
    overrides: Partial<TransferReportBuilderState>,
  ): SavedTransferReportTemplate => ({
    id: makeId('transfer-report-template'),
    name,
    builder: normalizeTransferReportBuilderState({
      ...cloneTransferReportBuilderState(baseBuilder),
      ...overrides,
    }),
    createdAt: now,
    updatedAt: now,
  });

  return [
    makeTemplate('Transferências por etapa', {
      reportType: 'grouped_status',
      groupBy: ['workflow_status', 'destination_church'],
      columns: ['protocol', 'name', 'origin_church', 'destination_church', 'current_title', 'member_status', 'workflow_status', 'opened_at'],
      sortBy: 'workflow_status',
      sortDirection: 'asc',
    }),
    makeTemplate('Transferências por origem', {
      reportType: 'grouped_origin',
      groupBy: ['origin_church', 'destination_church'],
      columns: ['protocol', 'name', 'origin_church', 'origin_regional', 'destination_church', 'current_title', 'workflow_status'],
      sortBy: 'origin_church',
      sortDirection: 'asc',
    }),
    makeTemplate('Rotas de transferência', {
      reportType: 'route_report',
      groupBy: ['destination_field', 'destination_regional', 'destination_church'],
      columns: ['name', 'origin_field', 'origin_regional', 'origin_church', 'destination_field', 'destination_regional', 'destination_church', 'current_title', 'workflow_status'],
      sortBy: 'destination_field',
      sortDirection: 'asc',
      orientation: 'landscape',
    }),
  ];
}

function buildChartOption(
  chart: SavedChartConfig,
  source: SourceDefinition,
  aggregatedData: Array<Record<string, string | number>>,
  records: SourceRecord[],
) {
  const dimensionLabel = source.dimensions.find((item) => item.key === chart.dimensionKey)?.label || 'Dimensão';
  const metricLabels = chart.metricKeys.map((key) => source.metrics.find((metric) => metric.key === key)?.label || key);
  const categories = aggregatedData.map((item) => String(item.dimension || ''));
  const isLineFamily = ['line', 'line-multiple', 'line-points', 'line-values', 'area', 'area-multiple'].includes(chart.chartType);
  const isAreaFamily = ['area', 'area-multiple'].includes(chart.chartType);
  const showLabels = ['bar-label', 'line-values', 'pie-label'].includes(chart.chartType);
  const showSymbols = ['line-points', 'line-values'].includes(chart.chartType);
  const legend = getLegendConfig(chart.showLegend, chart.legendPosition);
  const seriesBase = chart.metricKeys.map((metricKey, index) => ({
    name: metricLabels[index],
    type: isLineFamily ? 'line' : 'bar',
    smooth: isLineFamily,
    symbol: showSymbols ? 'circle' : 'none',
    symbolSize: showSymbols ? 8 : 0,
    areaStyle: isAreaFamily ? { opacity: 0.22 } : undefined,
    stack: ['stacked-bar', 'stacked-bar-vertical'].includes(chart.chartType) ? 'total' : undefined,
    itemStyle: { color: CHART_COLORS[index % CHART_COLORS.length] },
    label: showLabels ? { show: true, position: isLineFamily ? 'top' : 'outside', formatter: '{c}' } : undefined,
    data: aggregatedData.map((item) => Number(item[metricKey] || 0)),
  }));

  if (chart.chartType === 'geo-map') {
    const geoRows = aggregateGeoRows(records, chart.dimensionKey, chart.metricKeys, source.latitudeKey, source.longitudeKey);
    const metricKey = chart.metricKeys[0];
    const values = geoRows.map((item) => Number(item[metricKey] || 0)).filter((value) => Number.isFinite(value));
    const maxValue = Math.max(...values, 1);

    if (!geoRows.length) {
      return {
        title: {
          text: 'Sem coordenadas para exibir no mapa',
          left: 'center',
          top: 'middle',
          textStyle: { fontSize: 14, color: '#64748b', fontWeight: 500 },
        },
      };
    }

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: { name?: string; value?: [number, number, number] }) => {
          const total = Array.isArray(params.value) ? Number(params.value[2] || 0) : 0;
          const longitude = Array.isArray(params.value) ? Number(params.value[0] || 0) : 0;
          const latitude = Array.isArray(params.value) ? Number(params.value[1] || 0) : 0;
          return `${params.name || 'Localidade'}<br/>${metricLabels[0] || 'Quantidade'}: ${formatMetric(total)}<br/>Lon: ${longitude.toFixed(2)} | Lat: ${latitude.toFixed(2)}`;
        },
      },
      visualMap: {
        min: 0,
        max: maxValue,
        left: 12,
        bottom: 20,
        calculable: true,
        text: ['Maior', 'Menor'],
        inRange: {
          color: ['#bfdbfe', '#60a5fa', '#0f8f67'],
        },
      },
      grid: {
        left: 56,
        right: 18,
        top: 24,
        bottom: 46,
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        name: 'Longitude',
        min: (value: { min: number }) => Math.floor(value.min - 2),
        max: (value: { max: number }) => Math.ceil(value.max + 2),
        splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
      },
      yAxis: {
        type: 'value',
        name: 'Latitude',
        min: (value: { min: number }) => Math.floor(value.min - 2),
        max: (value: { max: number }) => Math.ceil(value.max + 2),
        splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
      },
      series: [
        {
          name: metricLabels[0] || 'Quantidade',
          type: 'scatter',
          data: geoRows.map((item) => ({
            name: String(item.dimension || ''),
            value: [Number(item.longitude || 0), Number(item.latitude || 0), Number(item[metricKey] || 0)],
          })),
          symbolSize: (value: number[]) => Math.max(12, Math.min(36, Number(value?.[2] || 0) * 1.5)),
          label: {
            show: true,
            position: 'top',
            formatter: '{b}',
            fontSize: 10,
            color: '#334155',
          },
          itemStyle: {
            color: '#0f8f67',
            opacity: 0.88,
          },
        },
      ],
    };
  }

  if (chart.chartType === 'pie' || chart.chartType === 'doughnut') {
    const metricKey = chart.metricKeys[0];
    return {
      tooltip: { trigger: 'item' },
      legend,
      series: [
        {
          name: metricLabels[0] || 'Valor',
          type: 'pie',
          radius: chart.chartType === 'doughnut' ? ['48%', '72%'] : '70%',
          data: aggregatedData.map((item, index) => ({
            name: item.dimension,
            value: Number(item[metricKey] || 0),
            itemStyle: { color: CHART_COLORS[index % CHART_COLORS.length] },
          })),
          label: showLabels ? { show: true, formatter: '{b}: {c} ({d}%)' } : { formatter: '{b}: {d}%' },
        },
      ],
    };
  }

  if (chart.chartType === 'pie-label') {
    const metricKey = chart.metricKeys[0];
    return {
      tooltip: { trigger: 'item' },
      legend,
      series: [
        {
          name: metricLabels[0] || 'Valor',
          type: 'pie',
          radius: '70%',
          data: aggregatedData.map((item, index) => ({
            name: item.dimension,
            value: Number(item[metricKey] || 0),
            itemStyle: { color: CHART_COLORS[index % CHART_COLORS.length] },
          })),
          label: { show: true, formatter: '{b}: {c} ({d}%)' },
        },
      ],
    };
  }

  if (chart.chartType === 'radar') {
    const metricKey = chart.metricKeys[0];
    const maxValue = Math.max(...aggregatedData.map((item) => Number(item[metricKey] || 0)), 1);
    return {
      tooltip: {},
      legend,
      radar: {
        indicator: aggregatedData.map((item) => ({ name: String(item.dimension || ''), max: maxValue })),
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: aggregatedData.map((item) => Number(item[metricKey] || 0)),
              name: metricLabels[0] || 'Valor',
              areaStyle: { opacity: 0.25 },
            },
          ],
        },
      ],
    };
  }

  if (chart.chartType === 'funnel') {
    const metricKey = chart.metricKeys[0];
    return {
      tooltip: { trigger: 'item' },
      legend,
      series: [
        {
          type: 'funnel',
          left: '10%',
          top: 20,
          bottom: 20,
          width: '80%',
          data: aggregatedData
            .map((item, index) => ({
              name: String(item.dimension || ''),
              value: Number(item[metricKey] || 0),
              itemStyle: { color: CHART_COLORS[index % CHART_COLORS.length] },
            }))
            .sort((left, right) => Number(right.value) - Number(left.value)),
        },
      ],
    };
  }

  if (chart.chartType === 'bar-horizontal') {
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend,
      grid: { left: 90, right: 18, top: 24, bottom: 40 },
      xAxis: { type: 'value' },
      yAxis: { type: 'category', data: categories },
      series: seriesBase,
    };
  }

  if (chart.chartType === 'negative-bar') {
    return {
      tooltip: { trigger: 'axis' },
      legend,
      grid: { left: 36, right: 18, top: 24, bottom: 40 },
      xAxis: { type: 'category', name: dimensionLabel, data: categories },
      yAxis: { type: 'value', axisLine: { show: true } },
      series: seriesBase,
    };
  }

  return {
    tooltip: { trigger: 'axis' },
    legend,
    grid: { left: 36, right: 18, top: 24, bottom: 40 },
    xAxis: { type: 'category', name: dimensionLabel, data: categories },
    yAxis: { type: 'value' },
    series: seriesBase,
  };
}

function ReportsTabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${active ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
    >
      {icon}
      {label}
    </button>
  );
}

export function Reports() {
  const storedUser = useMemo(readStoredUser, []);
  const profileType = storedUser.profileType || 'church';
  const { canCreate, canEdit } = usePermissions(profileType);
  const canManageDashboards = ['master', 'admin', 'campo'].includes(profileType) && (canCreate('reports') || canEdit('reports'));
  const activeFieldId = localStorage.getItem('mrm_active_field_id') || storedUser.campoId || '';
  const normalizedRole = String(storedUser.roleName || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const isSecretaryOrTreasurer = normalizedRole.includes('secret') || normalizedRole.includes('tesour');
  const hasFixedChurchScope = profileType === 'church' || isSecretaryOrTreasurer;
  // Somente admin/master podem trocar o campo; todos os outros ficam travados no seu campo
  const isAdminOrMaster = ['master', 'admin'].includes(profileType);
  const hasFixedCampoScope = !isAdminOrMaster;

  const [activeTab, setActiveTab] = useState<ReportsTabKey>('reports');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<CampoOption[]>([]);
  const [regionais, setRegionais] = useState<RegionalOption[]>([]);
  const [churches, setChurches] = useState<ChurchOption[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState(activeFieldId);
  const [selectedRegionalId, setSelectedRegionalId] = useState(storedUser.regionalId || '');
  const [selectedChurchId, setSelectedChurchId] = useState(hasFixedChurchScope ? (storedUser.churchId || '') : '');
  const [selectedDatePreset, setSelectedDatePreset] = useState<DatePresetKey>('custom');
  const { from: _defaultFrom, to: _defaultTo } = getCurrentMonthRange();
  const [dateFrom, setDateFrom] = useState<string>(_defaultFrom);
  const [dateTo, setDateTo] = useState<string>(_defaultTo);
  const [dashboardData, setDashboardData] = useState<DashboardApiPayload | null>(null);
  const [members, setMembers] = useState<MemberReportItem[]>([]);
  const [baptismData, setBaptismData] = useState<BaptismDashboardPayload | null>(null);
  const [consecrationData, setConsecrationData] = useState<ConsecrationDashboardPayload | null>(null);
  const [transferData, setTransferData] = useState<TransferDashboardPayload | null>(null);
  const [services, setServices] = useState<SecretariatService[]>([]);
  const [dashboardsState, setDashboardsState] = useState<PersistedReportsState>(() => loadPersistedDashboards());
  const [chartEditorOpen, setChartEditorOpen] = useState(false);
  const [editingChartId, setEditingChartId] = useState<string | null>(null);
  const [activeReportModal, setActiveReportModal] = useState<ReportLauncherKey | null>(null);
  const [memberReportTemplates, setMemberReportTemplates] = useState<SavedMemberReportTemplate[]>(() => loadPersistedMemberReportTemplates());
  const [activeMemberReportTemplateId, setActiveMemberReportTemplateId] = useState<string | null>(null);
  const [memberReportTemplateName, setMemberReportTemplateName] = useState('');
  const [memberReportNameDialogOpen, setMemberReportNameDialogOpen] = useState(false);
  const [baptismReportTemplates, setBaptismReportTemplates] = useState<SavedBaptismReportTemplate[]>(() => loadPersistedBaptismReportTemplates());
  const [activeBaptismReportTemplateId, setActiveBaptismReportTemplateId] = useState<string | null>(null);
  const [baptismReportTemplateName, setBaptismReportTemplateName] = useState('');
  const [baptismReportNameDialogOpen, setBaptismReportNameDialogOpen] = useState(false);
  const [consecrationReportTemplates, setConsecrationReportTemplates] = useState<SavedConsecrationReportTemplate[]>(() => loadPersistedConsecrationReportTemplates());
  const [activeConsecrationReportTemplateId, setActiveConsecrationReportTemplateId] = useState<string | null>(null);
  const [consecrationReportTemplateName, setConsecrationReportTemplateName] = useState('');
  const [consecrationReportNameDialogOpen, setConsecrationReportNameDialogOpen] = useState(false);
  const [transferReportTemplates, setTransferReportTemplates] = useState<SavedTransferReportTemplate[]>(() => loadPersistedTransferReportTemplates());
  const [activeTransferReportTemplateId, setActiveTransferReportTemplateId] = useState<string | null>(null);
  const [transferReportTemplateName, setTransferReportTemplateName] = useState('');
  const [transferReportNameDialogOpen, setTransferReportNameDialogOpen] = useState(false);
  const [churchReportTemplates, setChurchReportTemplates] = useState<SavedChurchReportTemplate[]>(() => loadPersistedChurchReportTemplates());
  const [activeChurchReportTemplateId, setActiveChurchReportTemplateId] = useState<string | null>(null);
  const [churchReportTemplateName, setChurchReportTemplateName] = useState('');
  const [churchReportNameDialogOpen, setChurchReportNameDialogOpen] = useState(false);
  const [churchEvolutionChartImage, setChurchEvolutionChartImage] = useState('');
  const [showChurchMembersList, setShowChurchMembersList] = useState(false);
  const [churchPhotosMap, setChurchPhotosMap] = useState<Record<string, string[]>>({});
  const [listRowOpenMembersId, setListRowOpenMembersId] = useState<string | null>(null);

  // ─── Requirements Report state ──────────────────────────────────────────
  const [requirementsReportTemplates, setRequirementsReportTemplates] = useState<SavedRequirementsReportTemplate[]>(() => loadPersistedRequirementsReportTemplates());
  const [activeRequirementsReportTemplateId, setActiveRequirementsReportTemplateId] = useState<string | null>(null);
  const [requirementsReportNameDialogOpen, setRequirementsReportNameDialogOpen] = useState(false);
  const [requirementsRawData, setRequirementsRawData] = useState<RequirementsPreviewRow[]>([]);
  const [requirementsLoading, setRequirementsLoading] = useState(false);
  const [expandedRequirementsCardIds, setExpandedRequirementsCardIds] = useState<Set<string>>(new Set());
  const [requirementsReportBuilder, setRequirementsReportBuilder] = useState<RequirementsReportBuilderState>(() => {
    const { from: reqFrom, to: reqTo } = getCurrentMonthRange();
    return normalizeRequirementsReportBuilderState({
      dateFrom: reqFrom,
      dateTo: reqTo,
      fieldIds: activeFieldId ? [activeFieldId] : [],
      regionalIds: storedUser.regionalId ? [storedUser.regionalId] : [],
      churchIds: hasFixedChurchScope && storedUser.churchId ? [storedUser.churchId] : [],
      memberTypes: ['MEMBRO'],
    });
  });

  // Credential report state
  const [credentialReportTemplates, setCredentialReportTemplates] = useState<SavedCredentialReportTemplate[]>(() => loadPersistedCredentialReportTemplates());
  const [activeCredentialReportTemplateId, setActiveCredentialReportTemplateId] = useState<string | null>(null);
  const [credentialReportNameDialogOpen, setCredentialReportNameDialogOpen] = useState(false);
  const [credentialRawData, setCredentialRawData] = useState<CredentialPreviewRow[]>([]);
  const [credentialLoading, setCredentialLoading] = useState(false);
  const [credentialSearchTrigger, setCredentialSearchTrigger] = useState(0);
  const [expandedCredentialIds, setExpandedCredentialIds] = useState<Set<number>>(new Set());
  const [credentialReportBuilder, setCredentialReportBuilder] = useState<CredentialReportBuilderState>(() => {
    const { from: credFrom, to: credTo } = getCurrentMonthRange();
    return normalizeCredentialReportBuilderState({
      dateFrom: credFrom,
      dateTo: credTo,
      fieldIds: activeFieldId ? [activeFieldId] : [],
      regionalIds: storedUser.regionalId ? [storedUser.regionalId] : [],
      churchIds: hasFixedChurchScope && storedUser.churchId ? [storedUser.churchId] : [],
    });
  });
  const [memberReportBuilder, setMemberReportBuilder] = useState<MemberReportBuilderState>(() => {
    const { from: mFrom, to: mTo } = getCurrentMonthRange();
    return {
    reportType: 'members_list',
    dateFrom: mFrom,
    dateTo: mTo,
    fieldIds: activeFieldId ? [activeFieldId] : [],
    regionalIds: storedUser.regionalId ? [storedUser.regionalId] : [],
    churchIds: hasFixedChurchScope && storedUser.churchId ? [storedUser.churchId] : [],
    statuses: [],
    memberTypes: ['MEMBRO'],
    groupBy: [],
    columns: ['name', 'cpf', 'church', 'regional', 'field', 'title', 'status'],
    metric: 'count',
    sortBy: 'name',
    sortDirection: 'asc',
    orientation: 'portrait',
    zebraEnabled: true,
    zebraColor: '#f6fbff',
    };
  });
  const [baptismReportBuilder, setBaptismReportBuilder] = useState<BaptismReportBuilderState>(() => {
    const { from: bFrom, to: bTo } = getCurrentMonthRange();
    return {
    reportType: 'grouped_church',
    dateFrom: bFrom,
    dateTo: bTo,
    fieldIds: activeFieldId ? [activeFieldId] : [],
    regionalIds: storedUser.regionalId ? [storedUser.regionalId] : [],
    churchIds: hasFixedChurchScope && storedUser.churchId ? [storedUser.churchId] : [],
    workflowStatuses: [],
    memberStatuses: [],
    memberTypes: ['MEMBRO'],
    groupBy: ['church', 'workflow_status'],
    columns: ['protocol', 'name', 'church', 'regional', 'title', 'member_status', 'workflow_status', 'next_baptism_date'],
    metric: 'count',
    sortBy: 'church',
    sortDirection: 'asc',
    orientation: 'portrait',
    zebraEnabled: true,
    zebraColor: '#eef8ff',
    };
  });
  const [consecrationReportBuilder, setConsecrationReportBuilder] = useState<ConsecrationReportBuilderState>(() => {
    const { from: cFrom, to: cTo } = getCurrentMonthRange();
    return {
    reportType: 'grouped_church',
    dateFrom: cFrom,
    dateTo: cTo,
    fieldIds: activeFieldId ? [activeFieldId] : [],
    regionalIds: storedUser.regionalId ? [storedUser.regionalId] : [],
    churchIds: hasFixedChurchScope && storedUser.churchId ? [storedUser.churchId] : [],
    workflowStatuses: [],
    memberStatuses: [],
    memberTypes: ['MEMBRO'],
    groupBy: ['church', 'workflow_status'],
    columns: ['protocol', 'name', 'church', 'regional', 'current_title', 'intended_title', 'workflow_status', 'next_consecration_date'],
    metric: 'count',
    sortBy: 'church',
    sortDirection: 'asc',
    orientation: 'portrait',
    zebraEnabled: true,
    zebraColor: '#eef8ff',
    };
  });
  const [transferReportBuilder, setTransferReportBuilder] = useState<TransferReportBuilderState>(() => {
    const { from: tFrom, to: tTo } = getCurrentMonthRange();
    return {
    reportType: 'grouped_status',
    dateFrom: tFrom,
    dateTo: tTo,
    fieldIds: activeFieldId ? [activeFieldId] : [],
    regionalIds: storedUser.regionalId ? [storedUser.regionalId] : [],
    churchIds: hasFixedChurchScope && storedUser.churchId ? [storedUser.churchId] : [],
    destinationChurchIds: [],
    workflowStatuses: [],
    memberStatuses: [],
    groupBy: ['workflow_status', 'destination_church'],
    columns: ['protocol', 'name', 'origin_church', 'origin_regional', 'destination_church', 'destination_regional', 'current_title', 'member_status', 'workflow_status', 'opened_at'],
    metric: 'count',
    sortBy: 'workflow_status',
    sortDirection: 'asc',
    orientation: 'portrait',
    zebraEnabled: true,
    zebraColor: '#f4f9f7',
    };
  });
  const [churchReportBuilder, setChurchReportBuilder] = useState<ChurchReportBuilderState>(() => {
    const { from: chFrom, to: chTo } = getCurrentMonthRange();
    return {
    dateFrom: chFrom,
    dateTo: chTo,
    fieldIds: activeFieldId ? [activeFieldId] : [],
    regionalIds: storedUser.regionalId ? [storedUser.regionalId] : [],
    churchIds: hasFixedChurchScope && storedUser.churchId ? [storedUser.churchId] : [],
    mode: 'single',
    groupBy: ['field', 'regional', 'church'],
    sections: ['leaders', 'functions', 'titles', 'baptisms', 'consecrations', 'new_members', 'stats'],
    columns: ['field', 'regional', 'church', 'leaderName', 'totalMembers', 'pastors', 'diaconos', 'membros', 'baptisms', 'consecrations', 'newMembers'],
    sortBy: 'church',
    sortDirection: 'asc',
    orientation: 'portrait',
    zebraEnabled: true,
    zebraColor: '#f6fbff',
    showPhotos: true,
    showMap: true,
    memberTypes: ['MEMBRO'],
    };
  });
  const [chartDraft, setChartDraft] = useState<SavedChartConfig>({
    id: makeId('chart'),
    title: '',
    sourceKey: 'members_evolution',
    chartType: 'bar',
    dimensionKey: 'periodo',
    metricKeys: ['membros'],
    gridSize: 'large',
    showTable: false,
    showLegend: true,
    legendPosition: 'bottom',
    showTotals: true,
  });

  useEffect(() => {
    savePersistedDashboards(dashboardsState);
  }, [dashboardsState]);

  useEffect(() => {
    savePersistedMemberReportTemplates(memberReportTemplates);
  }, [memberReportTemplates]);

  useEffect(() => {
    savePersistedBaptismReportTemplates(baptismReportTemplates);
  }, [baptismReportTemplates]);

  useEffect(() => {
    savePersistedConsecrationReportTemplates(consecrationReportTemplates);
  }, [consecrationReportTemplates]);

  useEffect(() => {
    savePersistedTransferReportTemplates(transferReportTemplates);
  }, [transferReportTemplates]);

  useEffect(() => {
    savePersistedChurchReportTemplates(churchReportTemplates);
  }, [churchReportTemplates]);

  useEffect(() => {
    savePersistedRequirementsReportTemplates(requirementsReportTemplates);
  }, [requirementsReportTemplates]);

  // Load requirements data when modal opens
  useEffect(() => {
    if (activeReportModal !== 'requirements') { setRequirementsRawData([]); return; }
    setRequirementsLoading(true);
    const params = new URLSearchParams();
    if (requirementsReportBuilder.dateFrom) params.set('from', requirementsReportBuilder.dateFrom);
    if (requirementsReportBuilder.dateTo) params.set('to', requirementsReportBuilder.dateTo + 'T23:59:59');
    if (requirementsReportBuilder.fieldIds.length === 1) params.set('campoId', requirementsReportBuilder.fieldIds[0]);
    if (requirementsReportBuilder.regionalIds.length === 1) params.set('regionalId', requirementsReportBuilder.regionalIds[0]);
    if (requirementsReportBuilder.churchIds.length === 1) params.set('churchId', requirementsReportBuilder.churchIds[0]);
    if (requirementsReportBuilder.statuses.length === 1) params.set('status', requirementsReportBuilder.statuses[0]);
    if (requirementsReportBuilder.serviceIds.length === 1) params.set('serviceId', requirementsReportBuilder.serviceIds[0]);
    authFetch(`${apiBase}/kan/cards/report?${params}`)
      .then((r) => r.json())
      .then((data: unknown[]) => {
        if (!Array.isArray(data)) { setRequirementsRawData([]); return; }
        const rows: RequirementsPreviewRow[] = data.map((c: Record<string, unknown>) => ({
          cardId: String(c.id || ''),
          protocol: String(c.protocol || ''),
          candidateName: String((c.member as Record<string,unknown>)?.fullName || c.candidateName || ''),
          service: String((c.service as Record<string,unknown>)?.sigla || ''),
          serviceId: c.serviceId != null ? Number(c.serviceId) : null,
          church: String((c.church as Record<string,unknown>)?.name || ''),
          churchId: String((c.church as Record<string,unknown>)?.id || c.churchId || ''),
          regional: String(((c.church as Record<string,unknown>)?.regional as Record<string,unknown>)?.name || ''),
          regionalId: String(((c.church as Record<string,unknown>)?.regional as Record<string,unknown>)?.id || ''),
          field: String((((c.church as Record<string,unknown>)?.regional as Record<string,unknown>)?.campo as Record<string,unknown>)?.name || ''),
          fieldId: String((((c.church as Record<string,unknown>)?.regional as Record<string,unknown>)?.campo as Record<string,unknown>)?.id || ''),
          stage: String((c.column as Record<string,unknown>)?.name || ''),
          status: String(c.status || ''),
          statusLabel: String(c.statusLabel || c.status || ''),
          openedAt: c.openedAt ? String(c.openedAt).slice(0, 10) : '',
          closedAt: c.closedAt ? String(c.closedAt).slice(0, 10) : '',
          subject: String(c.subject || ''),
          memberType: String((c.member as Record<string,unknown>)?.memberType || 'MEMBRO'),
          attachments: Array.isArray(c.attachments) ? (c.attachments as RequirementsPreviewRow['attachments']) : [],
          eventHistory: Array.isArray(c.eventHistory) ? (c.eventHistory as RequirementsPreviewRow['eventHistory']) : [],
        }));
        setRequirementsRawData(rows);
      })
      .catch(() => setRequirementsRawData([]))
      .finally(() => setRequirementsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReportModal]);

  // Load credential report data when modal opens
  useEffect(() => {
    if (activeReportModal !== 'credentials') { setCredentialRawData([]); return; }
    setCredentialLoading(true);
    const params = new URLSearchParams();
    if (credentialReportBuilder.dateFrom) params.set('from', credentialReportBuilder.dateFrom);
    if (credentialReportBuilder.dateTo) params.set('to', credentialReportBuilder.dateTo);
    if (credentialReportBuilder.fieldIds.length === 1) params.set('campo_id', credentialReportBuilder.fieldIds[0]);
    if (credentialReportBuilder.regionalIds.length === 1) params.set('regional_id', credentialReportBuilder.regionalIds[0]);
    if (credentialReportBuilder.churchIds.length === 1) params.set('church_id', credentialReportBuilder.churchIds[0]);
    if (credentialReportBuilder.situacoes.length === 1) params.set('situacao', credentialReportBuilder.situacoes[0]);
    authFetch(`${apiBase}/credential-requests/report?${params}`)
      .then((r) => r.json())
      .then((data: unknown) => {
        if (!Array.isArray(data)) { setCredentialRawData([]); return; }
        setCredentialRawData(data as CredentialPreviewRow[]);
      })
      .catch(() => setCredentialRawData([]))
      .finally(() => setCredentialLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReportModal, credentialSearchTrigger]);

  useEffect(() => {
    const storedTemplates = localStorage.getItem(MEMBER_REPORT_TEMPLATES_STORAGE_KEY);
    if (storedTemplates !== null || memberReportTemplates.length > 0) return;
    setMemberReportTemplates(buildInitialMemberReportTemplates(memberReportBuilder));
  }, [memberReportTemplates.length, memberReportBuilder]);

  useEffect(() => {
    const storedTemplates = localStorage.getItem(BAPTISM_REPORT_TEMPLATES_STORAGE_KEY);
    if (storedTemplates !== null || baptismReportTemplates.length > 0) return;
    setBaptismReportTemplates(buildInitialBaptismReportTemplates(baptismReportBuilder));
  }, [baptismReportTemplates.length, baptismReportBuilder]);

  useEffect(() => {
    const storedTemplates = localStorage.getItem(CONSECRATION_REPORT_TEMPLATES_STORAGE_KEY);
    if (storedTemplates !== null || consecrationReportTemplates.length > 0) return;
    setConsecrationReportTemplates(buildInitialConsecrationReportTemplates(consecrationReportBuilder));
  }, [consecrationReportTemplates.length, consecrationReportBuilder]);

  useEffect(() => {
    const storedTemplates = localStorage.getItem(TRANSFER_REPORT_TEMPLATES_STORAGE_KEY);
    if (storedTemplates !== null || transferReportTemplates.length > 0) return;
    setTransferReportTemplates(buildInitialTransferReportTemplates(transferReportBuilder));
  }, [transferReportTemplates.length, transferReportBuilder]);

  useEffect(() => {
    const storedTemplates = localStorage.getItem(CHURCH_REPORT_TEMPLATES_STORAGE_KEY);
    if (storedTemplates !== null || churchReportTemplates.length > 0) return;
    setChurchReportTemplates(buildInitialChurchReportTemplates(churchReportBuilder));
  }, [churchReportTemplates.length, churchReportBuilder]);

  async function loadReportsData() {
    setLoading(true);
    setError('');
    try {
      const [dashboardResponse, membersResponse, baptismResponse, consecrationResponse, transferResponse, servicesResponse] = await Promise.all([
        authFetch(`${apiBase}/dashboard`),
        authFetch(`${apiBase}/members`),
        authFetch(`${apiBase}/baptism/dashboard`),
        authFetch(`${apiBase}/consecration/dashboard`),
        authFetch(`${apiBase}/transfer/dashboard`),
        authFetch(`${apiBase}/kan/services`),
      ]);

      if (!dashboardResponse.ok || !baptismResponse.ok || !consecrationResponse.ok || !transferResponse.ok || !servicesResponse.ok || !membersResponse.ok) {
        throw new Error('Não foi possível carregar os dados de secretaria para relatórios.');
      }

      const [dashboardPayload, membersPayload, baptismPayload, consecrationPayload, transferPayload, servicesPayload] = await Promise.all([
        dashboardResponse.json(),
        membersResponse.json(),
        baptismResponse.json(),
        consecrationResponse.json(),
        transferResponse.json(),
        servicesResponse.json(),
      ]);

      setDashboardData(dashboardPayload as DashboardApiPayload);
      setMembers(Array.isArray(membersPayload) ? (membersPayload as MemberReportItem[]) : []);
      setBaptismData(baptismPayload as BaptismDashboardPayload);
      setConsecrationData(consecrationPayload as ConsecrationDashboardPayload);
      setTransferData(transferPayload as TransferDashboardPayload);
      setServices(Array.isArray(servicesPayload) ? servicesPayload : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar relatórios.');
      setDashboardData(null);
      setMembers([]);
      setBaptismData(null);
      setConsecrationData(null);
      setTransferData(null);
      setServices([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadMembersPreviewData() {
    setLoading(true);
    setError('');
    try {
      const membersResponse = await authFetch(`${apiBase}/members`);
      if (!membersResponse.ok) {
        throw new Error('Não foi possível carregar os membros para o construtor de relatórios.');
      }
      const membersPayload = await membersResponse.json();
      setMembers(Array.isArray(membersPayload) ? (membersPayload as MemberReportItem[]) : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar os membros do construtor.');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab !== 'dashboards' || loading || dashboardData) return;
    void loadReportsData();
  }, [activeTab, loading, dashboardData]);

  useEffect(() => {
    if (activeReportModal !== 'members' || loading || members.length > 0) return;
    void loadMembersPreviewData();
  }, [activeReportModal, loading, members.length]);

  useEffect(() => {
    if (activeReportModal !== 'baptism' || loading || baptismData) return;
    void loadReportsData();
  }, [activeReportModal, baptismData, loading]);

  useEffect(() => {
    if (activeReportModal !== 'consecration' || loading || consecrationData) return;
    void loadReportsData();
  }, [activeReportModal, consecrationData, loading]);

  useEffect(() => {
    if (activeReportModal !== 'transfer' || loading || transferData) return;
    void loadReportsData();
  }, [activeReportModal, transferData, loading]);

  useEffect(() => {
    if (activeReportModal !== 'churches' || loading || dashboardData) return;
    void loadReportsData();
  }, [activeReportModal, dashboardData, loading]);

  useEffect(() => {
    async function loadFilterOptions() {
      try {
        const [fieldsResponse, regionaisResponse, churchesResponse] = await Promise.all([
          authFetch(`${apiBase}/campos`),
          authFetch(`${apiBase}/regionais`),
          authFetch(`${apiBase}/churches`),
        ]);

        if (!fieldsResponse.ok || !regionaisResponse.ok || !churchesResponse.ok) return;

        const [fieldsPayload, regionaisPayload, churchesPayload] = await Promise.all([
          fieldsResponse.json(),
          regionaisResponse.json(),
          churchesResponse.json(),
        ]);

        setFields(Array.isArray(fieldsPayload) ? fieldsPayload : []);
        setRegionais(Array.isArray(regionaisPayload) ? regionaisPayload : []);
        setChurches(Array.isArray(churchesPayload) ? churchesPayload : []);
      } catch {
        setFields([]);
        setRegionais([]);
        setChurches([]);
      }
    }

    loadFilterOptions();
  }, []);

  useEffect(() => {
    if (selectedDatePreset === 'custom') return;
    const range = getPresetDateRange(selectedDatePreset);
    setDateFrom(toDateInputValue(range.from));
    setDateTo(toDateInputValue(range.to));
  }, [selectedDatePreset]);

  const sources = useMemo<SourceDefinition[]>(() => {
    const memberRecords = members.map((member) => {
      const churchName = toSafeLabel(member.church?.name);
      const regionalName = toSafeLabel(member.church?.regional?.name || member.regional?.name);
      const campoName = toSafeLabel(member.church?.regional?.campo?.name);
      const gender = normalizeGenderLabel(member.gender);
      const membershipStatus = normalizeMembershipStatusLabel(member.membershipStatus);
      const baptismStatus = normalizeBaptismStatusLabel(member.baptismStatus, member.baptismDate);
      const titleName = toSafeLabel(member.ecclesiasticalTitleRef?.name || member.ecclesiasticalTitle);
      const maritalStatus = normalizeMaritalStatusLabel(member.maritalStatus);
      const city = toSafeLabel(member.addressCity);
      const state = toSafeLabel(member.addressState);
      const country = toSafeLabel(member.nationality);

      return {
        membro: member.fullName,
        igreja: churchName,
        regional: regionalName,
        campo: campoName,
        sexo: gender,
        statusMembro: membershipStatus,
        statusBatismo: baptismStatus,
        tituloEclesiastico: titleName,
        estadoCivil: maritalStatus,
        cidade: city,
        estado: state,
        pais: country,
        faixaEtaria: getAgeRangeLabel(member.birthDate),
        mesCadastro: monthLabelFromDate(member.createdAt),
        mesMembresia: monthLabelFromDate(member.membershipDate || member.createdAt),
        mesBatismo: monthLabelFromDate(member.baptismDate),
        dataBase: member.membershipDate || member.createdAt,
        ativos: membershipStatus === 'Ativos' ? 1 : 0,
        inativos: membershipStatus === 'Inativos' ? 1 : 0,
        aguardandoAtivacao: membershipStatus === 'Aguardando ativação' ? 1 : 0,
        homens: gender === 'Homens' ? 1 : 0,
        mulheres: gender === 'Mulheres' ? 1 : 0,
        batizados: baptismStatus.toLowerCase().includes('batiz') ? 1 : 0,
        naoBatizados: baptismStatus.toLowerCase().includes('batiz') ? 0 : 1,
        comTitulo: titleName !== 'Não informado' ? 1 : 0,
        semTitulo: titleName === 'Não informado' ? 1 : 0,
        casados: maritalStatus === 'Casados' ? 1 : 0,
        solteiros: maritalStatus === 'Solteiros' ? 1 : 0,
        comCpf: member.cpf ? 1 : 0,
      };
    });

    const membersByChurchId = new Map<string, {
      membros: number;
      ativos: number;
      inativos: number;
      homens: number;
      mulheres: number;
      batizados: number;
      semTitulo: number;
    }>();

    for (const member of members) {
      const churchId = member.church?.id;
      if (!churchId) continue;
      const current = membersByChurchId.get(churchId) || { membros: 0, ativos: 0, inativos: 0, homens: 0, mulheres: 0, batizados: 0, semTitulo: 0 };
      const gender = normalizeGenderLabel(member.gender);
      const membershipStatus = normalizeMembershipStatusLabel(member.membershipStatus);
      const baptismStatus = normalizeBaptismStatusLabel(member.baptismStatus, member.baptismDate);
      const titleName = toSafeLabel(member.ecclesiasticalTitleRef?.name || member.ecclesiasticalTitle);
      current.membros += 1;
      current.ativos += membershipStatus === 'Ativos' ? 1 : 0;
      current.inativos += membershipStatus === 'Inativos' ? 1 : 0;
      current.homens += gender === 'Homens' ? 1 : 0;
      current.mulheres += gender === 'Mulheres' ? 1 : 0;
      current.batizados += baptismStatus.toLowerCase().includes('batiz') ? 1 : 0;
      current.semTitulo += titleName === 'Não informado' ? 1 : 0;
      membersByChurchId.set(churchId, current);
    }

    const churchFootprintRecords = churches.map((church) => {
      const counters = membersByChurchId.get(church.id) || { membros: 0, ativos: 0, inativos: 0, homens: 0, mulheres: 0, batizados: 0, semTitulo: 0 };
      return {
        igreja: toSafeLabel(church.name),
        regional: toSafeLabel(church.regional?.name),
        campo: toSafeLabel(church.regional?.campo?.name),
        cidade: toSafeLabel(church.addressCity),
        estado: toSafeLabel(church.addressState),
        pais: toSafeLabel(church.addressCountry),
        latitude: toNumberOrNull(church.latitude),
        longitude: toNumberOrNull(church.longitude),
        membros: counters.membros,
        ativos: counters.ativos,
        inativos: counters.inativos,
        homens: counters.homens,
        mulheres: counters.mulheres,
        batizados: counters.batizados,
        semTitulo: counters.semTitulo,
      };
    });

    const membersEvolutionRecords = (dashboardData?.attendanceChart || []).map((item, index) => ({
      periodo: item.name,
      dataBase: item.referenceDate,
      ordem: index + 1,
      membros: item.presenca,
      visitantes: item.visitantes,
    }));

    const activityRecords = (dashboardData?.activities || []).map((item) => ({
      servico: item.title,
      descricao: item.description || 'Sem descrição',
      mes: monthLabelFromDate(item.time),
      quantidade: 1,
    }));

    const baptismQueueRecords = (baptismData?.queue || []).map((item) => ({
      status: item.statusLabel,
      igreja: item.church?.name || 'Sem igreja',
      servico: item.service?.description || 'Batismo',
      membro: item.member?.fullName || 'Sem membro',
      mesAbertura: monthLabelFromDate(item.openedAt),
      mesAgenda: monthLabelFromDate(item.baptismDate || item.nextBaptism?.scheduledDate),
      quantidade: 1,
    }));

    const baptismScheduleRecords = (baptismData?.schedules || []).map((item) => ({
      igreja: item.churchName,
      mesAgenda: monthLabelFromDate(item.scheduledDate),
      quantidade: 1,
    }));

    const consecrationQueueRecords = (consecrationData?.queue || []).map((item) => ({
      status: item.statusLabel,
      igreja: item.church?.name || 'Sem igreja',
      servico: item.service?.description || 'Consagração',
      tituloPretendido: item.intendedTitle || 'Não definido',
      tituloAtual: item.currentTitle || 'Não informado',
      membro: item.member?.fullName || 'Sem membro',
      mesAbertura: monthLabelFromDate(item.openedAt),
      mesAgenda: monthLabelFromDate(item.consecrationDate || item.nextConsecration?.scheduledDate),
      quantidade: 1,
    }));

    const transferQueueRecords = (transferData?.queue || []).map((item) => ({
      status: item.statusLabel,
      igrejaOrigem: item.church?.name || 'Sem origem',
      igrejaDestino: item.destinationChurch?.name || 'Sem destino',
      tituloAtual: item.currentTitle || item.member?.ecclesiasticalTitle || 'Não informado',
      membro: item.member?.fullName || 'Sem membro',
      mesAbertura: monthLabelFromDate(item.openedAt),
      quantidade: 1,
    }));

    const serviceCatalogRecords = services.map((item) => ({
      grupo: item.serviceGroup || 'Sem grupo',
      sigla: item.sigla,
      servico: item.description,
      ativo: item.isActive ? 'Ativo' : 'Inativo',
      usaMatriz: item.usesMatrix ? 'Sim' : 'Não',
      quantidade: 1,
      pipelines: item.pipelineCount || 0,
      regras: item.ruleCount || 0,
      estagios: item.stageCount || 0,
    }));

    return [
      {
        key: 'members_registry',
        label: 'Membros e cadastro',
        description: 'Base detalhada de membros para gráficos por igreja, regional, campo, sexo, status e títulos.',
        records: memberRecords,
        dimensions: [
          { key: 'igreja', label: 'Igreja' },
          { key: 'regional', label: 'Regional' },
          { key: 'campo', label: 'Campo' },
          { key: 'sexo', label: 'Sexo' },
          { key: 'statusMembro', label: 'Status do membro' },
          { key: 'tituloEclesiastico', label: 'Título eclesiástico' },
          { key: 'estadoCivil', label: 'Estado civil' },
          { key: 'faixaEtaria', label: 'Faixa etária' },
          { key: 'mesCadastro', label: 'Mês de cadastro' },
          { key: 'mesMembresia', label: 'Mês de membresia' },
          { key: 'mesBatismo', label: 'Mês de batismo' },
        ],
        metrics: [
          { key: '__count', label: 'Quantidade' },
          { key: 'ativos', label: 'Ativos' },
          { key: 'inativos', label: 'Inativos' },
          { key: 'aguardandoAtivacao', label: 'Aguardando ativação' },
          { key: 'homens', label: 'Homens' },
          { key: 'mulheres', label: 'Mulheres' },
          { key: 'batizados', label: 'Batizados' },
          { key: 'naoBatizados', label: 'Não batizados' },
          { key: 'comTitulo', label: 'Com título' },
          { key: 'semTitulo', label: 'Sem título' },
          { key: 'casados', label: 'Casados' },
          { key: 'solteiros', label: 'Solteiros' },
          { key: 'comCpf', label: 'Com CPF' },
        ],
        defaultDimensionKey: 'igreja',
        defaultMetricKeys: ['__count', 'ativos'],
        joinHint: 'Fonte principal de membros para montar gráficos de sexo, status, títulos, igreja, regional e campo.',
        dateKey: 'dataBase',
        churchKeys: ['igreja'],
      },
      {
        key: 'members_locality',
        label: 'Localidade dos membros',
        description: 'Base focada em cidade, estado, país, igreja, regional e campo dos membros.',
        records: memberRecords,
        dimensions: [
          { key: 'cidade', label: 'Cidade' },
          { key: 'estado', label: 'Estado' },
          { key: 'pais', label: 'País' },
          { key: 'igreja', label: 'Igreja' },
          { key: 'regional', label: 'Regional' },
          { key: 'campo', label: 'Campo' },
        ],
        metrics: [
          { key: '__count', label: 'Quantidade' },
          { key: 'ativos', label: 'Ativos' },
          { key: 'inativos', label: 'Inativos' },
          { key: 'homens', label: 'Homens' },
          { key: 'mulheres', label: 'Mulheres' },
          { key: 'batizados', label: 'Batizados' },
        ],
        defaultDimensionKey: 'cidade',
        defaultMetricKeys: ['__count'],
        joinHint: 'Use esta base para quantidade de membros por cidade, estado, país, igreja, regional e campo.',
        dateKey: 'dataBase',
        churchKeys: ['igreja'],
      },
      {
        key: 'members_titles',
        label: 'Títulos e situação eclesiástica',
        description: 'Distribuição de títulos eclesiásticos e situação de batismo/membresia.',
        records: memberRecords,
        dimensions: [
          { key: 'tituloEclesiastico', label: 'Título eclesiástico' },
          { key: 'statusMembro', label: 'Status do membro' },
          { key: 'statusBatismo', label: 'Situação do batismo' },
          { key: 'igreja', label: 'Igreja' },
          { key: 'regional', label: 'Regional' },
          { key: 'campo', label: 'Campo' },
        ],
        metrics: [
          { key: '__count', label: 'Quantidade' },
          { key: 'ativos', label: 'Ativos' },
          { key: 'batizados', label: 'Batizados' },
          { key: 'semTitulo', label: 'Sem título' },
        ],
        defaultDimensionKey: 'tituloEclesiastico',
        defaultMetricKeys: ['__count'],
        joinHint: 'Fonte específica para gráficos de títulos eclesiásticos, batismo e situação do membro.',
        dateKey: 'dataBase',
        churchKeys: ['igreja'],
      },
      {
        key: 'church_footprint',
        label: 'Igrejas e cobertura geográfica',
        description: 'Resumo por igreja com regional, campo, cidade, estado, país e coordenadas para mapa.',
        records: churchFootprintRecords,
        dimensions: [
          { key: 'igreja', label: 'Igreja' },
          { key: 'regional', label: 'Regional' },
          { key: 'campo', label: 'Campo' },
          { key: 'cidade', label: 'Cidade' },
          { key: 'estado', label: 'Estado' },
          { key: 'pais', label: 'País' },
        ],
        metrics: [
          { key: 'membros', label: 'Membros' },
          { key: 'ativos', label: 'Ativos' },
          { key: 'inativos', label: 'Inativos' },
          { key: 'homens', label: 'Homens' },
          { key: 'mulheres', label: 'Mulheres' },
          { key: 'batizados', label: 'Batizados' },
          { key: 'semTitulo', label: 'Sem título' },
        ],
        defaultDimensionKey: 'regional',
        defaultMetricKeys: ['membros'],
        joinHint: 'Fonte geográfica para mapa de quantidades por igreja, regional, campo, cidade e estado.',
        churchKeys: ['igreja'],
        latitudeKey: 'latitude',
        longitudeKey: 'longitude',
      },
      {
        key: 'members_evolution',
        label: 'Membros (evolução)',
        description: 'Série mensal de membros e visitantes da secretaria.',
        records: membersEvolutionRecords,
        dimensions: [{ key: 'periodo', label: 'Período' }],
        metrics: [
          { key: 'membros', label: 'Membros' },
          { key: 'visitantes', label: 'Visitantes' },
        ],
        defaultDimensionKey: 'periodo',
        defaultMetricKeys: ['membros', 'visitantes'],
        joinHint: 'Fonte agregada por período com dados já escopados pelo usuário logado.',
        dateKey: 'dataBase',
        churchKeys: [],
      },
      {
        key: 'secretariat_activity',
        label: 'Ocorrências da secretaria',
        description: 'Movimentações recentes dos serviços e processos da secretaria.',
        records: activityRecords,
        dimensions: [
          { key: 'servico', label: 'Serviço' },
          { key: 'mes', label: 'Mês' },
          { key: 'descricao', label: 'Descrição' },
        ],
        metrics: [{ key: '__count', label: 'Quantidade' }],
        defaultDimensionKey: 'servico',
        defaultMetricKeys: ['__count'],
        joinHint: 'Fonte pronta para impressão e cruzamento simples por serviço e mês.',
        churchKeys: [],
      },
      {
        key: 'baptism_queue',
        label: 'Batismos',
        description: 'Fila e agenda de batismo com igreja, serviço e status já vinculados.',
        records: baptismQueueRecords,
        dimensions: [
          { key: 'status', label: 'Status' },
          { key: 'igreja', label: 'Igreja' },
          { key: 'servico', label: 'Serviço' },
          { key: 'mesAbertura', label: 'Mês de abertura' },
          { key: 'mesAgenda', label: 'Mês agendado' },
        ],
        metrics: [{ key: '__count', label: 'Quantidade' }],
        defaultDimensionKey: 'status',
        defaultMetricKeys: ['__count'],
        joinHint: 'Registros já chegam associados a membro, igreja e serviço do processo.',
        dateKey: 'dataBase',
        churchKeys: ['igreja'],
      },
      {
        key: 'baptism_schedule',
        label: 'Agenda de batismos',
        description: 'Datas agendadas de batismo por igreja.',
        records: baptismScheduleRecords,
        dimensions: [
          { key: 'igreja', label: 'Igreja' },
          { key: 'mesAgenda', label: 'Mês agendado' },
        ],
        metrics: [{ key: '__count', label: 'Quantidade' }],
        defaultDimensionKey: 'mesAgenda',
        defaultMetricKeys: ['__count'],
        joinHint: 'Agenda consolidada por igreja, útil para relatórios impressos e painéis.',
        dateKey: 'dataBase',
        churchKeys: ['igreja'],
      },
      {
        key: 'consecration_queue',
        label: 'Consagrações',
        description: 'Processos de consagração com títulos atual e pretendido.',
        records: consecrationQueueRecords,
        dimensions: [
          { key: 'status', label: 'Status' },
          { key: 'igreja', label: 'Igreja' },
          { key: 'tituloPretendido', label: 'Título pretendido' },
          { key: 'tituloAtual', label: 'Título atual' },
          { key: 'mesAbertura', label: 'Mês de abertura' },
          { key: 'mesAgenda', label: 'Mês agendado' },
        ],
        metrics: [{ key: '__count', label: 'Quantidade' }],
        defaultDimensionKey: 'status',
        defaultMetricKeys: ['__count'],
        joinHint: 'Fonte já traz o relacionamento entre processo, igreja e evolução ministerial.',
        dateKey: 'dataBase',
        churchKeys: ['igreja'],
      },
      {
        key: 'transfer_queue',
        label: 'Transferências',
        description: 'Fluxo de transferências com origem, destino e status.',
        records: transferQueueRecords,
        dimensions: [
          { key: 'status', label: 'Status' },
          { key: 'igrejaOrigem', label: 'Igreja origem' },
          { key: 'igrejaDestino', label: 'Igreja destino' },
          { key: 'tituloAtual', label: 'Título atual' },
          { key: 'mesAbertura', label: 'Mês de abertura' },
        ],
        metrics: [{ key: '__count', label: 'Quantidade' }],
        defaultDimensionKey: 'status',
        defaultMetricKeys: ['__count'],
        joinHint: 'Cada linha já vem com os vínculos entre membro, igreja de origem e igreja de destino.',
        dateKey: 'dataBase',
        churchKeys: ['igrejaOrigem', 'igrejaDestino'],
      },
      {
        key: 'secretariat_services',
        label: 'Serviços da secretaria',
        description: 'Catálogo de serviços e ocorrências, sem dados de tesouraria ou financeiro.',
        records: serviceCatalogRecords,
        dimensions: [
          { key: 'grupo', label: 'Grupo' },
          { key: 'sigla', label: 'Sigla' },
          { key: 'servico', label: 'Serviço' },
          { key: 'ativo', label: 'Ativo' },
          { key: 'usaMatriz', label: 'Usa matriz' },
        ],
        metrics: [
          { key: '__count', label: 'Quantidade' },
          { key: 'pipelines', label: 'Pipelines' },
          { key: 'regras', label: 'Regras' },
          { key: 'estagios', label: 'Estágios' },
        ],
        defaultDimensionKey: 'grupo',
        defaultMetricKeys: ['__count'],
        joinHint: 'Fonte técnica da secretaria para painéis de configuração e governança dos serviços.',
        churchKeys: [],
      },
    ];
  }, [dashboardData, members, baptismData, consecrationData, transferData, services, churches]);

  const filteredRegionais = useMemo(() => {
    if (!selectedFieldId) return regionais;
    return regionais.filter((regional) => regional.campoId === selectedFieldId);
  }, [regionais, selectedFieldId]);

  const filteredChurchOptions = useMemo(() => {
    let result = churches;
    if (selectedFieldId) {
      result = result.filter((church) => church.regional?.campoId === selectedFieldId || church.regional?.campo?.id === selectedFieldId);
    }
    if (selectedRegionalId) {
      result = result.filter((church) => church.regional?.id === selectedRegionalId || church.regionalId === selectedRegionalId);
    }
    return result;
  }, [churches, selectedFieldId, selectedRegionalId]);

  const allowedChurchNames = useMemo(() => {
    if (selectedChurchId) {
      const church = churches.find((item) => item.id === selectedChurchId);
      return church ? new Set([church.name]) : null;
    }
    const pool = filteredChurchOptions;
    if (selectedFieldId || selectedRegionalId) {
      return new Set(pool.map((item) => item.name));
    }
    return null;
  }, [churches, filteredChurchOptions, selectedChurchId, selectedFieldId, selectedRegionalId]);

  const filteredSources = useMemo(() => {
    return sources.map((source) => {
      const records = source.records.filter((record) => {
        if (source.dateKey && (dateFrom || dateTo)) {
          const currentDate = parseRecordDate(record[source.dateKey]);
          if (currentDate) {
            if (dateFrom) {
              const start = new Date(`${dateFrom}T00:00:00`);
              if (currentDate < start) return false;
            }
            if (dateTo) {
              const end = new Date(`${dateTo}T23:59:59`);
              if (currentDate > end) return false;
            }
          }
        }

        if (allowedChurchNames && source.churchKeys?.length) {
          const hasChurchMatch = source.churchKeys.some((key) => {
            const value = record[key];
            return value ? allowedChurchNames.has(String(value)) : false;
          });
          if (!hasChurchMatch) return false;
        }

        return true;
      });

      return { ...source, records };
    });
  }, [sources, allowedChurchNames, dateFrom, dateTo]);

  const activeDashboard = useMemo(
    () => dashboardsState.dashboards.find((item) => item.id === dashboardsState.activeDashboardId) || dashboardsState.dashboards[0],
    [dashboardsState],
  );

  const editorSource = useMemo(
    () => filteredSources.find((source) => source.key === chartDraft.sourceKey) || filteredSources[0],
    [filteredSources, chartDraft.sourceKey],
  );

  const previewData = useMemo(() => {
    if (!editorSource) return [] as Array<Record<string, string | number>>;
    return aggregateRows(editorSource.records, chartDraft.dimensionKey, chartDraft.metricKeys);
  }, [editorSource, chartDraft.dimensionKey, chartDraft.metricKeys]);

  function openNewChartModal() {
    const defaultSource = sources[0];
    if (!defaultSource) return;
    setEditingChartId(null);
    setChartDraft(normalizeChartConfig({
      id: makeId('chart'),
      title: '',
      sourceKey: defaultSource.key,
      chartType: 'bar',
      dimensionKey: defaultSource.defaultDimensionKey,
      metricKeys: defaultSource.defaultMetricKeys,
      gridSize: 'large',
      showTable: false,
    }));
    setChartEditorOpen(true);
  }

  function openEditChartModal(chartId: string) {
    const chart = activeDashboard?.charts.find((item) => item.id === chartId);
    if (!chart) return;
    setEditingChartId(chart.id);
    setChartDraft(normalizeChartConfig(chart));
    setChartEditorOpen(true);
  }

  function handleSourceChange(sourceKey: string) {
    const nextSource = sources.find((source) => source.key === sourceKey);
    if (!nextSource) return;
    setChartDraft((current) => ({
      ...current,
      sourceKey,
      dimensionKey: nextSource.defaultDimensionKey,
      metricKeys: nextSource.defaultMetricKeys,
    }));
  }

  function toggleMetric(metricKey: string) {
    setChartDraft((current) => {
      const exists = current.metricKeys.includes(metricKey);
      if (exists && current.metricKeys.length === 1) {
        return current;
      }
      return {
        ...current,
        metricKeys: exists
          ? current.metricKeys.filter((item) => item !== metricKey)
          : [...current.metricKeys, metricKey],
      };
    });
  }

  function handleSaveChart() {
    if (!activeDashboard || !editorSource) return;
    const title = chartDraft.title.trim() || `${editorSource.label} - ${CHART_TYPE_OPTIONS.find((item) => item.value === chartDraft.chartType)?.label || 'Gráfico'}`;
    const nextChart = { ...chartDraft, title };

    setDashboardsState((current) => ({
      ...current,
      dashboards: current.dashboards.map((dashboard) => {
        if (dashboard.id !== activeDashboard.id) return dashboard;
        if (editingChartId) {
          return {
            ...dashboard,
            charts: dashboard.charts.map((chart) => (chart.id === editingChartId ? nextChart : chart)),
          };
        }
        return {
          ...dashboard,
          charts: [...dashboard.charts, nextChart],
        };
      }),
    }));

    setChartEditorOpen(false);
  }

  function handleDeleteChart(chartId: string) {
    if (!activeDashboard || !window.confirm('Remover este gráfico do dashboard?')) return;
    setDashboardsState((current) => ({
      ...current,
      dashboards: current.dashboards.map((dashboard) => (
        dashboard.id === activeDashboard.id
          ? { ...dashboard, charts: dashboard.charts.filter((chart) => chart.id !== chartId) }
          : dashboard
      )),
    }));
  }

  function handleAddDashboard() {
    const nextIndex = dashboardsState.dashboards.length + 1;
    const nextDashboard = {
      id: makeId('dashboard'),
      name: `Dashboard ${nextIndex}`,
      charts: [],
    };
    setDashboardsState((current) => ({
      activeDashboardId: nextDashboard.id,
      dashboards: [...current.dashboards, nextDashboard],
    }));
  }

  function handleDeleteDashboard(dashboardId: string) {
    if (dashboardsState.dashboards.length === 1) return;
    if (!window.confirm('Excluir este dashboard e todos os gráficos dele?')) return;
    const remaining = dashboardsState.dashboards.filter((item) => item.id !== dashboardId);
    setDashboardsState({
      activeDashboardId: remaining[0].id,
      dashboards: remaining,
    });
  }

  const scopeLabel = storedUser.profileType === 'church'
    ? `Visualização restrita à igreja logada${storedUser.churchName ? `: ${storedUser.churchName}` : ''}`
    : storedUser.profileType === 'campo'
      ? 'Visualização consolidada do campo ativo'
      : 'Visualização administrativa consolidada';

  const reportLauncherCards = useMemo<ReportLauncherCard[]>(() => [
    {
      key: 'members',
      title: 'Relatório de membros',
      description: 'Gera relatório com informações de membros.',
      icon: Users,
      gradientClass: 'from-sky-500 via-cyan-500 to-blue-600',
      ringClass: 'ring-sky-200/70',
      modalDescription: 'Configure um único relatório de membros com filtros inteligentes e agrupamentos dinâmicos, sem depender de vários modelos separados.',
      modalHighlights: [
        'Use combinações de filtros por escopo, situação, perfil e cadastro do membro.',
        'Escolha como o resultado será agrupado para montar o PDF sem criar outro tipo de relatório.',
        'Próxima etapa: ligar essa configuração à geração final do PDF.',
      ],
    },
    {
      key: 'baptism',
      title: 'Relatório de batismo',
      description: 'Gera relatório com informações de batismo.',
      icon: Droplets,
      gradientClass: 'from-cyan-500 via-sky-500 to-indigo-600',
      ringClass: 'ring-cyan-200/70',
      modalDescription: 'Esse ponto de entrada já está separado para o relatório de batismo. Quando você definir os filtros, eu completo a geração do PDF aqui.',
      modalHighlights: [
        'Usa a fila e a agenda atuais do módulo de batismo.',
        'Pode virar relatório de pendentes, aprovados, agendados ou por período.',
        'Próxima etapa: escolher os filtros e o formato final da impressão.',
      ],
    },
    {
      key: 'consecration',
      title: 'Relatório de consagração',
      description: 'Gera relatório com informações de consagração.',
      icon: Award,
      gradientClass: 'from-amber-500 via-orange-500 to-rose-500',
      ringClass: 'ring-amber-200/70',
      modalDescription: 'O modal de consagração fica reservado para a próxima etapa, quando você me disser quais filtros e campos precisam aparecer no PDF.',
      modalHighlights: [
        'Base ligada ao fluxo de consagração e evolução ministerial.',
        'Pode atender listas de pendentes, concluídos, agenda e títulos pretendidos.',
        'Próxima etapa: definir filtros, colunas e cabeçalho do PDF.',
      ],
    },
    {
      key: 'transfers',
      title: 'Relatório de transferências',
      description: 'Gera relatório com informações de transferências.',
      icon: ArrowRightLeft,
      gradientClass: 'from-violet-500 via-fuchsia-500 to-pink-500',
      ringClass: 'ring-fuchsia-200/70',
      modalDescription: 'Aqui entraremos depois com os filtros do relatório de transferências.',
      modalHighlights: [
        'Card separado para relatórios de saída, entrada e histórico de transferências.',
        'Pode receber filtros por igreja, período, status e destino.',
        'Você vai me dizer depois quais campos precisam entrar.',
      ],
    },
    {
      key: 'requirements',
      title: 'Relatório de requerimentos',
      description: 'Gera relatório com informações de requerimentos.',
      icon: ClipboardList,
      gradientClass: 'from-slate-500 via-slate-700 to-slate-900',
      ringClass: 'ring-slate-200/70',
      modalDescription: 'Esse card fica reservado para os filtros do relatório de requerimentos.',
      modalHighlights: [
        'Espaço para pedidos, protocolos e documentos emitidos pela secretaria.',
        'Pode virar relatório por tipo, status, solicitante ou período.',
        'Os filtros serão definidos por você na próxima etapa.',
      ],
    },
    {
      key: 'churches',
      title: 'Relatório de igrejas',
      description: 'Gera relatório com informações de igrejas.',
      icon: Building2,
      gradientClass: 'from-blue-500 via-indigo-500 to-violet-600',
      ringClass: 'ring-blue-200/70',
      modalDescription: 'Esse modal vai receber depois os filtros para listagem de igrejas e dados institucionais.',
      modalHighlights: [
        'Próprio para relatórios de igrejas, filiais, regionais e cadastros locais.',
        'Pode trazer contatos, localização e status cadastral.',
        'Você vai definir depois o que entra no PDF.',
      ],
    },
    {
      key: 'roles',
      title: 'Relatório de funções',
      description: 'Gera relatório com informações de funções.',
      icon: Shield,
      gradientClass: 'from-emerald-500 via-teal-500 to-cyan-600',
      ringClass: 'ring-emerald-200/70',
      modalDescription: 'Esse card guarda o ponto de entrada para os relatórios de funções e perfis.',
      modalHighlights: [
        'Pode servir para funções, cargos, perfis internos e distribuição por igreja.',
        'Estrutura pronta para receber filtros depois.',
        'Você definirá o conteúdo final do PDF.',
      ],
    },
    {
      key: 'attendance',
      title: 'Relatório de presença',
      description: 'Gera relatório com informações de presença.',
      icon: CheckSquare,
      gradientClass: 'from-teal-500 via-cyan-500 to-sky-600',
      ringClass: 'ring-teal-200/70',
      modalDescription: 'Esse card fica pronto para os filtros do relatório de presença e frequência.',
      modalHighlights: [
        'Pode atender cultos, eventos, check-in manual e presença consolidada.',
        'Estrutura pronta para filtros por data, evento ou membro.',
        'Os detalhes do PDF serão definidos depois com você.',
      ],
    },
    {
      key: 'credentials',
      title: 'Relatório de credenciais',
      description: 'Gera relatório com informações de credenciais.',
      icon: CreditCard,
      gradientClass: 'from-rose-500 via-pink-500 to-fuchsia-600',
      ringClass: 'ring-rose-200/70',
      modalDescription: 'Esse modal vai receber depois os filtros dos relatórios de credenciais.',
      modalHighlights: [
        'Pode listar modelos, emitidas, vencidas ou pendentes.',
        'Também pode separar por igreja, membro ou período.',
        'Você decide depois quais filtros usar.',
      ],
    },
    {
      key: 'users',
      title: 'Relatório de usuários',
      description: 'Gera relatório com informações de usuários.',
      icon: UserRound,
      gradientClass: 'from-zinc-500 via-slate-600 to-slate-800',
      ringClass: 'ring-zinc-200/70',
      modalDescription: 'Esse card será usado depois quando você definir os filtros dos relatórios de usuários.',
      modalHighlights: [
        'Pode gerar listas de usuários, acessos e vínculos administrativos.',
        'Útil para relatórios internos de operação e permissões.',
        'Os filtros específicos serão definidos por você depois.',
      ],
    },
  ], []);

  const activeReportCard = useMemo(
    () => reportLauncherCards.find((card) => card.key === activeReportModal) || null,
    [reportLauncherCards, activeReportModal],
  );
  const activeMemberReportTemplate = useMemo(
    () => memberReportTemplates.find((template) => template.id === activeMemberReportTemplateId) || null,
    [memberReportTemplates, activeMemberReportTemplateId],
  );
  const activeBaptismReportTemplate = useMemo(
    () => baptismReportTemplates.find((template) => template.id === activeBaptismReportTemplateId) || null,
    [baptismReportTemplates, activeBaptismReportTemplateId],
  );
  const activeConsecrationReportTemplate = useMemo(
    () => consecrationReportTemplates.find((template) => template.id === activeConsecrationReportTemplateId) || null,
    [consecrationReportTemplates, activeConsecrationReportTemplateId],
  );
  const activeTransferReportTemplate = useMemo(
    () => transferReportTemplates.find((template) => template.id === activeTransferReportTemplateId) || null,
    [transferReportTemplates, activeTransferReportTemplateId],
  );
  const activeChurchReportTemplate = useMemo(
    () => churchReportTemplates.find((template) => template.id === activeChurchReportTemplateId) || null,
    [churchReportTemplates, activeChurchReportTemplateId],
  );
  const isMembersReport = activeReportCard?.key === 'members';
  const isChurchesReport = activeReportCard?.key === 'churches';
  const isBaptismReport = activeReportCard?.key === 'baptism';
  const isConsecrationReport = activeReportCard?.key === 'consecration';
  const isTransferReport = activeReportCard?.key === 'transfers';
  const isRequirementsReport = activeReportCard?.key === 'requirements';
  const isCredentialsReport = activeReportCard?.key === 'credentials';
  const isAdvancedReport = isMembersReport || isChurchesReport || isBaptismReport || isConsecrationReport || isTransferReport || isRequirementsReport || isCredentialsReport;
  const churchLookup = useMemo(() => new Map(churches.map((church) => [church.id, church])), [churches]);
  const churchReportRegionais = useMemo(() => {
    if (!churchReportBuilder.fieldIds.length) return regionais;
    return regionais.filter((regional) => churchReportBuilder.fieldIds.includes(regional.campoId));
  }, [regionais, churchReportBuilder.fieldIds]);
  const churchReportChurches = useMemo(() => {
    let result = churches;
    if (churchReportBuilder.fieldIds.length) {
      result = result.filter((church) => {
        const campoId = church.regional?.campoId || church.regional?.campo?.id || '';
        return churchReportBuilder.fieldIds.includes(campoId);
      });
    }
    if (churchReportBuilder.regionalIds.length) {
      result = result.filter((church) => {
        const regionalId = church.regional?.id || church.regionalId || '';
        return churchReportBuilder.regionalIds.includes(regionalId);
      });
    }
    if (churchReportBuilder.churchIds.length) {
      result = result.filter((church) => churchReportBuilder.churchIds.includes(church.id));
    }
    return result;
  }, [churches, churchReportBuilder.fieldIds, churchReportBuilder.regionalIds, churchReportBuilder.churchIds]);
  const churchReportChurchIdSet = useMemo(() => new Set(churchReportChurches.map((church) => church.id)), [churchReportChurches]);
  const churchReportDateRange = useMemo(() => {
    const start = churchReportBuilder.dateFrom ? new Date(`${churchReportBuilder.dateFrom}T00:00:00`) : null;
    const end = churchReportBuilder.dateTo ? new Date(`${churchReportBuilder.dateTo}T23:59:59`) : null;
    return { start, end };
  }, [churchReportBuilder.dateFrom, churchReportBuilder.dateTo]);
  const churchReportMembers = useMemo(() => {
    return members.filter((member) => {
      const churchId = member.church?.id;
      if (!churchId || !churchReportChurchIdSet.has(churchId)) return false;
      if (churchReportBuilder.memberTypes.length && !churchReportBuilder.memberTypes.includes(member.memberType || 'MEMBRO')) return false;
      if (!churchReportDateRange.start && !churchReportDateRange.end) return true;
      const baseDate = member.membershipDate || member.createdAt;
      if (!baseDate) return true;
      const current = new Date(baseDate);
      if (churchReportDateRange.start && current < churchReportDateRange.start) return false;
      if (churchReportDateRange.end && current > churchReportDateRange.end) return false;
      return true;
    });
  }, [members, churchReportChurchIdSet, churchReportDateRange, churchReportBuilder.memberTypes]);
  const churchReportSummaryRows = useMemo<ChurchReportSummaryRow[]>(() => {
    const baptismByChurchName = new Map<string, number>();
    const consecrationByChurchName = new Map<string, number>();

    (baptismData?.queue || []).forEach((item) => {
      const name = normalizeLookupValue(item.church?.name);
      if (!name) return;
      baptismByChurchName.set(name, (baptismByChurchName.get(name) || 0) + 1);
    });

    (consecrationData?.queue || []).forEach((item) => {
      const name = normalizeLookupValue(item.church?.name);
      if (!name) return;
      consecrationByChurchName.set(name, (consecrationByChurchName.get(name) || 0) + 1);
    });

    return churchReportChurches.map((church) => {
      const scopedMembers = churchReportMembers.filter((member) => member.church?.id === church.id);
      const now = new Date();
      const newMembers = scopedMembers.filter((member) => {
        const baseDate = member.membershipDate || member.createdAt;
        if (!baseDate) return false;
        const current = new Date(baseDate);
        if (churchReportDateRange.start && current < churchReportDateRange.start) return false;
        if (churchReportDateRange.end && current > churchReportDateRange.end) return false;
        return true;
      }).length;

      const titleBuckets = scopedMembers.reduce((acc, member) => {
        const title = normalizeLookupValue(member.ecclesiasticalTitleRef?.name || member.ecclesiasticalTitle);
        if (title.includes('pastor')) acc.pastors += 1;
        else if (title.includes('diac')) acc.diaconos += 1;
        else acc.membros += 1;
        return acc;
      }, { pastors: 0, diaconos: 0, membros: 0 });

      const normalizedChurch = normalizeLookupValue(church.name);

      return {
        churchId: church.id,
        church: toSafeLabel(church.name),
        regional: toSafeLabel(church.regional?.name),
        field: toSafeLabel(church.regional?.campo?.name),
        city: toSafeLabel(church.addressCity),
        state: toSafeLabel(church.addressState),
        country: toSafeLabel(church.addressCountry),
        leaderName: toSafeLabel(church.currentLeaderName),
        leaderRole: toSafeLabel(church.currentLeaderRole),
        address: formatChurchAddress(church),
        latitude: toNumberOrNull(church.latitude),
        longitude: toNumberOrNull(church.longitude),
        totalMembers: scopedMembers.length,
        pastors: titleBuckets.pastors,
        diaconos: titleBuckets.diaconos,
        membros: titleBuckets.membros,
        baptisms: baptismByChurchName.get(normalizedChurch) || 0,
        consecrations: consecrationByChurchName.get(normalizedChurch) || 0,
        newMembers,
      };
    });
  }, [churchReportChurches, churchReportMembers, baptismData, consecrationData, churchReportDateRange]);
  const churchActiveRow = useMemo(() => {
    if (!churchReportSummaryRows.length) return null;
    if (churchReportBuilder.mode === 'single') {
      const preferred = churchReportBuilder.churchIds[0];
      if (preferred) {
        return churchReportSummaryRows.find((row) => row.churchId === preferred) || churchReportSummaryRows[0];
      }
      return churchReportSummaryRows[0];
    }
    return null;
  }, [churchReportSummaryRows, churchReportBuilder.mode, churchReportBuilder.churchIds]);
  const churchLeadersHistoryRows = useMemo(() => {
    if (!churchActiveRow) return [] as Array<{ name: string; title: string; start: string; end: string }>;
    const normalizedLeaderName = normalizeLookupValue(churchActiveRow.leaderName);
    const matchedLeader = members.find((member) => (
      member.church?.id === churchActiveRow.churchId
      && normalizeLookupValue(member.fullName) === normalizedLeaderName
    ));

    return [{
      name: churchActiveRow.leaderName,
      title: churchActiveRow.leaderRole,
      start: formatDate(matchedLeader?.membershipDate || matchedLeader?.createdAt),
      end: '-',
    }];
  }, [churchActiveRow, members]);
  const churchMembersEvolution = useMemo(() => {
    if (!churchActiveRow) return [] as Array<{ month: string; newMembers: number; totalMembers: number }>;
    const monthCounts = new Map<string, number>();
    members
      .filter((member) => member.church?.id === churchActiveRow.churchId)
      .forEach((member) => {
        const baseDate = member.membershipDate || member.createdAt;
        if (!baseDate) return;
        const month = monthLabelFromDate(baseDate);
        monthCounts.set(month, (monthCounts.get(month) || 0) + 1);
      });

    let runningTotal = 0;
    return Array.from(monthCounts.entries())
      .sort(([left], [right]) => compareLocaleValues(left, right))
      .map(([month, count]) => {
        runningTotal += count;
        return {
          month,
          newMembers: count,
          totalMembers: runningTotal,
        };
      });
  }, [churchActiveRow, members]);
  const churchMapImageUrl = useMemo(() => {
    if (!churchActiveRow) return '';
    if (typeof churchActiveRow.latitude === 'number' && typeof churchActiveRow.longitude === 'number') {
      const lat = churchActiveRow.latitude;
      const lon = churchActiveRow.longitude;
      return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=15&size=900x280&markers=${lat},${lon},red-pushpin`;
    }
    return '';
  }, [churchActiveRow]);
  const churchMembersListRows = useMemo(() => {
    if (!churchActiveRow) return [] as Array<{ name: string; title: string; status: string; membershipDate: string }>;
    return members
      .filter((member) => {
        if (member.church?.id !== churchActiveRow.churchId) return false;
        if (churchReportBuilder.memberTypes.length && !churchReportBuilder.memberTypes.includes(member.memberType || 'MEMBRO')) return false;
        return true;
      })
      .map((member) => ({
        name: toSafeLabel(member.preferredName || member.fullName),
        title: toSafeLabel(member.ecclesiasticalTitleRef?.name || member.ecclesiasticalTitle),
        status: normalizeMembershipStatusLabel(member.membershipStatus),
        membershipDate: formatDate(member.membershipDate || member.createdAt),
      }))
      .sort((a, b) => compareLocaleValues(a.name, b.name));
  }, [churchActiveRow, members, churchReportBuilder.memberTypes]);

  const churchActiveMemberBreakdown = useMemo(() => {
    if (!churchActiveRow) return { diaconisas: 0, presbyteros: 0, evangelistas: 0, membersAtStart: 0, growth: 0 };
    const scopedMembers = members.filter((m) => {
      if (m.church?.id !== churchActiveRow.churchId) return false;
      if (churchReportBuilder.memberTypes.length && !churchReportBuilder.memberTypes.includes(m.memberType || 'MEMBRO')) return false;
      return true;
    });
    const titleBreakdown = scopedMembers.reduce(
      (acc, member) => {
        const t = normalizeLookupValue(member.ecclesiasticalTitleRef?.name || member.ecclesiasticalTitle);
        if (t.includes('diaconisa')) acc.diaconisas += 1;
        if (t.includes('presbit') || t.includes('presb\u00edt')) acc.presbyteros += 1;
        if (t.includes('evange')) acc.evangelistas += 1;
        return acc;
      },
      { diaconisas: 0, presbyteros: 0, evangelistas: 0 },
    );
    const membersAtStart = Math.max(0, churchActiveRow.totalMembers - churchActiveRow.newMembers);
    const growth = membersAtStart > 0 ? Math.round(((churchActiveRow.totalMembers - membersAtStart) / membersAtStart) * 100) : 0;
    return { ...titleBreakdown, membersAtStart, growth };
  }, [churchActiveRow, members]);

  const churchPhotoUrls = useMemo(() => {
    if (!churchActiveRow) return [] as string[];
    return churchPhotosMap[churchActiveRow.churchId] || [];
  }, [churchActiveRow, churchPhotosMap]);

  useEffect(() => {
    if (!churchActiveRow) return;
    const id = churchActiveRow.churchId;
    if (churchPhotosMap[id]) return; // já carregado
    authFetch(`${apiBase}/churches/${id}/photos`)
      .then((res) => (res.ok ? res.json() : []))
      .then((photos: Array<{ photoUrl?: string }>) => {
        const urls = photos.map((p) => p.photoUrl).filter((u): u is string => typeof u === 'string' && u.length > 0);
        setChurchPhotosMap((prev) => ({ ...prev, [id]: urls }));
      })
      .catch(() => {
        setChurchPhotosMap((prev) => ({ ...prev, [id]: [] }));
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [churchActiveRow?.churchId]);
  const churchReportListRows = useMemo(() => {
    const getColumnValue = (row: ChurchReportSummaryRow, column: ChurchReportColumnKey) => row[column];
    const rows = [...churchReportSummaryRows];
    return rows.sort((left, right) => {
      const direction = churchReportBuilder.sortDirection === 'desc' ? -1 : 1;
      const leftPrimary = getColumnValue(left, churchReportBuilder.sortBy);
      const rightPrimary = getColumnValue(right, churchReportBuilder.sortBy);
      const bothNumbers = typeof leftPrimary === 'number' && typeof rightPrimary === 'number';
      if (bothNumbers && leftPrimary !== rightPrimary) {
        return (leftPrimary - rightPrimary) * direction;
      }
      const primaryCompare = compareLocaleValues(String(leftPrimary || ''), String(rightPrimary || ''));
      if (primaryCompare !== 0) return primaryCompare * direction;

      for (const group of churchReportBuilder.groupBy) {
        const leftValue = group === 'field' ? left.field : group === 'regional' ? left.regional : left.church;
        const rightValue = group === 'field' ? right.field : group === 'regional' ? right.regional : right.church;
        const result = compareLocaleValues(String(leftValue || ''), String(rightValue || ''));
        if (result !== 0) return result;
      }
      return compareLocaleValues(left.church, right.church);
    });
  }, [churchReportSummaryRows, churchReportBuilder.groupBy, churchReportBuilder.sortBy, churchReportBuilder.sortDirection]);
  const churchReportTotalMetricColumns = useMemo(() => {
    const visibleNumeric = churchReportBuilder.columns.filter((column) => isChurchReportNumericColumn(column));
    return visibleNumeric.length ? visibleNumeric : ['totalMembers', 'baptisms', 'consecrations', 'newMembers'];
  }, [churchReportBuilder.columns]);
  const churchReportGrandTotals = useMemo(() => {
    const totals = {} as Record<ChurchReportColumnKey, number>;
    churchReportTotalMetricColumns.forEach((column) => {
      totals[column] = churchReportListRows.reduce((sum, row) => {
        const value = getChurchReportColumnValue(row, column);
        return sum + (typeof value === 'number' ? value : 0);
      }, 0);
    });
    return totals;
  }, [churchReportListRows, churchReportTotalMetricColumns]);
  const churchReportGroupedTotals = useMemo(() => {
    if (!churchReportBuilder.groupBy.length) return [] as Array<{ key: string; label: string; totals: Record<ChurchReportColumnKey, number> }>;

    const groups = new Map<string, { label: string; totals: Record<ChurchReportColumnKey, number> }>();

    churchReportListRows.forEach((row) => {
      const label = churchReportBuilder.groupBy
        .map((group) => `${getChurchReportColumnLabel(group)}: ${String(getChurchReportColumnValue(row, group) || '-')}`)
        .join(' | ');

      if (!groups.has(label)) {
        const baseTotals = {} as Record<ChurchReportColumnKey, number>;
        churchReportTotalMetricColumns.forEach((column) => {
          baseTotals[column] = 0;
        });
        groups.set(label, { label, totals: baseTotals });
      }

      const current = groups.get(label);
      if (!current) return;

      churchReportTotalMetricColumns.forEach((column) => {
        const value = getChurchReportColumnValue(row, column);
        current.totals[column] += typeof value === 'number' ? value : 0;
      });
    });

    return Array.from(groups.entries()).map(([key, value]) => ({
      key,
      label: value.label,
      totals: value.totals,
    }));
  }, [churchReportListRows, churchReportBuilder.groupBy, churchReportTotalMetricColumns]);
  const memberReportRegionais = useMemo(() => {
    if (!memberReportBuilder.fieldIds.length) return regionais;
    return regionais.filter((regional) => memberReportBuilder.fieldIds.includes(regional.campoId));
  }, [regionais, memberReportBuilder.fieldIds]);
  const memberReportChurches = useMemo(() => {
    let result = churches;
    if (memberReportBuilder.fieldIds.length) {
      result = result.filter((church) => {
        const campoId = church.regional?.campoId || church.regional?.campo?.id || '';
        return memberReportBuilder.fieldIds.includes(campoId);
      });
    }
    if (memberReportBuilder.regionalIds.length) {
      result = result.filter((church) => {
        const regionalId = church.regional?.id || church.regionalId || '';
        return memberReportBuilder.regionalIds.includes(regionalId);
      });
    }
    return result;
  }, [churches, memberReportBuilder.fieldIds, memberReportBuilder.regionalIds]);
  const baptismReportRegionais = useMemo(() => {
    if (!baptismReportBuilder.fieldIds.length) return regionais;
    return regionais.filter((regional) => baptismReportBuilder.fieldIds.includes(regional.campoId));
  }, [regionais, baptismReportBuilder.fieldIds]);
  const baptismReportChurches = useMemo(() => {
    let result = churches;
    if (baptismReportBuilder.fieldIds.length) {
      result = result.filter((church) => {
        const campoId = church.regional?.campoId || church.regional?.campo?.id || '';
        return baptismReportBuilder.fieldIds.includes(campoId);
      });
    }
    if (baptismReportBuilder.regionalIds.length) {
      result = result.filter((church) => {
        const regionalId = church.regional?.id || church.regionalId || '';
        return baptismReportBuilder.regionalIds.includes(regionalId);
      });
    }
    return result;
  }, [churches, baptismReportBuilder.fieldIds, baptismReportBuilder.regionalIds]);
  const consecrationReportRegionais = useMemo(() => {
    if (!consecrationReportBuilder.fieldIds.length) return regionais;
    return regionais.filter((regional) => consecrationReportBuilder.fieldIds.includes(regional.campoId));
  }, [regionais, consecrationReportBuilder.fieldIds]);
  const consecrationReportChurches = useMemo(() => {
    let result = churches;
    if (consecrationReportBuilder.fieldIds.length) {
      result = result.filter((church) => {
        const campoId = church.regional?.campoId || church.regional?.campo?.id || '';
        return consecrationReportBuilder.fieldIds.includes(campoId);
      });
    }
    if (consecrationReportBuilder.regionalIds.length) {
      result = result.filter((church) => {
        const regionalId = church.regional?.id || church.regionalId || '';
        return consecrationReportBuilder.regionalIds.includes(regionalId);
      });
    }
    return result;
  }, [churches, consecrationReportBuilder.fieldIds, consecrationReportBuilder.regionalIds]);
  const transferReportRegionais = useMemo(() => {
    if (!transferReportBuilder.fieldIds.length) return regionais;
    return regionais.filter((regional) => transferReportBuilder.fieldIds.includes(regional.campoId));
  }, [regionais, transferReportBuilder.fieldIds]);
  const transferReportOriginChurches = useMemo(() => {
    let result = churches;
    if (transferReportBuilder.fieldIds.length) {
      result = result.filter((church) => {
        const campoId = church.regional?.campoId || church.regional?.campo?.id || '';
        return transferReportBuilder.fieldIds.includes(campoId);
      });
    }
    if (transferReportBuilder.regionalIds.length) {
      result = result.filter((church) => {
        const regionalId = church.regional?.id || church.regionalId || '';
        return transferReportBuilder.regionalIds.includes(regionalId);
      });
    }
    return result;
  }, [churches, transferReportBuilder.fieldIds, transferReportBuilder.regionalIds]);
  const transferReportDestinationChurches = useMemo(() => churches, [churches]);
  const memberStatusOptions = useMemo(() => {
    return Array.from(new Set(members.map((member) => normalizeMembershipStatusLabel(member.membershipStatus)).filter(Boolean)))
      .sort(compareLocaleValues);
  }, [members]);
  const memberPreviewRows = useMemo<MemberPreviewRow[]>(() => {
    return members.map((member) => ({
      id: member.id,
      name: member.preferredName || member.fullName,
      cpf: member.cpf || '-',
      father_name: toSafeLabel(member.fatherName),
      mother_name: toSafeLabel(member.motherName),
      spouse_name: toSafeLabel(member.spouseName),
      birth_date: formatDate(member.birthDate),
      age: getAgeValue(member.birthDate),
      contact: formatMemberContact(member),
      email: formatMemberEmail(member),
      voter_title: formatVoterTitle(member),
      church: toSafeLabel(member.church?.name),
      church_code: toSafeLabel(member.church?.code),
      regional: toSafeLabel(member.church?.regional?.name || member.regional?.name),
      field: toSafeLabel(member.church?.regional?.campo?.name),
      title: toSafeLabel(member.ecclesiasticalTitleRef?.name || member.ecclesiasticalTitle),
      gender: normalizeGenderLabel(member.gender),
      marital_status: normalizeMaritalStatusLabel(member.maritalStatus),
      age_range: getAgeRangeLabel(member.birthDate),
      membership_date: formatDate(member.membershipDate || member.createdAt),
      baptism_date: formatDate(member.baptismDate),
      status: normalizeMembershipStatusLabel(member.membershipStatus),
      memberType: member.memberType || 'MEMBRO',
      leader_name: toSafeLabel(churchLookup.get(member.church?.id || '')?.currentLeaderName || member.church?.currentLeaderName),
      leader_role: toSafeLabel(churchLookup.get(member.church?.id || '')?.currentLeaderRole || member.church?.currentLeaderRole),
      church_address: formatChurchAddress(churchLookup.get(member.church?.id || '') || member.church),
      church_city: toSafeLabel(churchLookup.get(member.church?.id || '')?.addressCity || member.church?.addressCity),
      church_state: toSafeLabel(churchLookup.get(member.church?.id || '')?.addressState || member.church?.addressState),
      church_country: toSafeLabel(churchLookup.get(member.church?.id || '')?.addressCountry || member.church?.addressCountry),
      member_city: toSafeLabel(member.addressCity),
      member_state: toSafeLabel(member.addressState),
      member_country: toSafeLabel(member.nationality),
      fieldId: member.church?.regional?.campo?.id || member.church?.regional?.campoId || '',
      regionalId: member.church?.regional?.id || member.regional?.id || '',
      churchId: member.church?.id || '',
      membershipDateRaw: member.membershipDate || member.createdAt || '',
      baptismDateRaw: member.baptismDate || '',
    }));
  }, [members, churchLookup]);
  const baptismPreviewRows = useMemo<BaptismPreviewRow[]>(() => {
    return (baptismData?.queue || []).map((item) => {
      const churchId = item.church?.id || '';
      const churchRecord = churchLookup.get(churchId);
      const regionalId = churchRecord?.regional?.id || churchRecord?.regionalId || '';
      const fieldId = churchRecord?.regional?.campo?.id || churchRecord?.regional?.campoId || '';
      return {
        id: item.id,
        protocol: toSafeLabel(item.protocol),
        name: toSafeLabel(item.member?.fullName),
        church: toSafeLabel(item.church?.name || churchRecord?.name),
        regional: toSafeLabel(churchRecord?.regional?.name),
        field: toSafeLabel(churchRecord?.regional?.campo?.name),
        title: toSafeLabel(item.member?.ecclesiasticalTitle),
        member_status: normalizeMembershipStatusLabel(item.member?.membershipStatus),
        memberType: item.member?.memberType || 'MEMBRO',
        workflow_status: toSafeLabel(item.statusLabel),
        service: toSafeLabel(item.service?.description),
        opened_at: formatDate(item.openedAt),
        baptism_date: formatDate(item.baptismDate),
        next_baptism_date: formatDate(item.nextBaptism?.scheduledDate),
        fieldId,
        regionalId,
        churchId,
        openedAtRaw: item.openedAt || '',
        baptismDateRaw: item.baptismDate || '',
        nextBaptismDateRaw: item.nextBaptism?.scheduledDate || '',
        columnIndex: Number(item.columnIndex || 0),
      };
    });
  }, [baptismData, churchLookup]);
  const consecrationPreviewRows = useMemo<ConsecrationPreviewRow[]>(() => {
    return (consecrationData?.queue || []).map((item) => {
      const churchId = item.church?.id || '';
      const churchRecord = churchLookup.get(churchId);
      const regionalId = churchRecord?.regional?.id || churchRecord?.regionalId || '';
      const fieldId = churchRecord?.regional?.campo?.id || churchRecord?.regional?.campoId || '';

      return {
        id: item.id,
        protocol: toSafeLabel(item.protocol),
        name: toSafeLabel(item.member?.fullName),
        church: toSafeLabel(item.church?.name || churchRecord?.name),
        regional: toSafeLabel(churchRecord?.regional?.name),
        field: toSafeLabel(churchRecord?.regional?.campo?.name),
        member_status: normalizeMembershipStatusLabel(item.member?.membershipStatus),
        memberType: item.member?.memberType || 'MEMBRO',
        workflow_status: toSafeLabel(item.statusLabel),
        service: toSafeLabel(item.service?.description),
        current_title: toSafeLabel(item.currentTitle || item.member?.ecclesiasticalTitle),
        intended_title: toSafeLabel(item.intendedTitle),
        opened_at: formatDate(item.openedAt),
        consecration_date: formatDate(item.consecrationDate),
        next_consecration_date: formatDate(item.nextConsecration?.scheduledDate),
        fieldId,
        regionalId,
        churchId,
        openedAtRaw: item.openedAt || '',
        consecrationDateRaw: item.consecrationDate || '',
        nextConsecrationDateRaw: item.nextConsecration?.scheduledDate || '',
        columnIndex: Number(item.columnIndex || 0),
      };
    });
  }, [consecrationData, churchLookup]);
  const transferPreviewRows = useMemo<TransferPreviewRow[]>(() => {
    return (transferData?.queue || []).map((item) => {
      const churchId = item.church?.id || '';
      const destinationChurchId = item.destinationChurch?.id || '';
      const churchRecord = churchLookup.get(churchId);
      const destinationChurchRecord = churchLookup.get(destinationChurchId);
      const regionalId = churchRecord?.regional?.id || churchRecord?.regionalId || '';
      const fieldId = churchRecord?.regional?.campo?.id || churchRecord?.regional?.campoId || '';
      const destinationRegionalId = destinationChurchRecord?.regional?.id || destinationChurchRecord?.regionalId || '';
      const destinationFieldId = destinationChurchRecord?.regional?.campo?.id || destinationChurchRecord?.regional?.campoId || '';

      return {
        id: item.id,
        protocol: toSafeLabel(item.protocol),
        name: toSafeLabel(item.member?.fullName),
        origin_church: toSafeLabel(item.church?.name || churchRecord?.name),
        origin_regional: toSafeLabel(churchRecord?.regional?.name),
        origin_field: toSafeLabel(churchRecord?.regional?.campo?.name),
        destination_church: toSafeLabel(item.destinationChurch?.name || destinationChurchRecord?.name),
        destination_regional: toSafeLabel(destinationChurchRecord?.regional?.name),
        destination_field: toSafeLabel(destinationChurchRecord?.regional?.campo?.name),
        current_title: toSafeLabel(item.currentTitle || item.member?.ecclesiasticalTitle),
        member_status: normalizeMembershipStatusLabel(item.member?.membershipStatus),
        workflow_status: toSafeLabel(item.statusLabel),
        service: toSafeLabel(item.service?.description),
        opened_at: formatDate(item.openedAt),
        churchId,
        regionalId,
        fieldId,
        destinationChurchId,
        destinationRegionalId,
        destinationFieldId,
        openedAtRaw: item.openedAt || '',
        columnIndex: Number(item.columnIndex || 0),
      };
    });
  }, [transferData, churchLookup]);
  const memberFilteredRows = useMemo(() => {
    const isDateInRange = (rawValue: string) => {
      if (!memberReportBuilder.dateFrom && !memberReportBuilder.dateTo) return true;
      if (!rawValue) return false;
      const current = new Date(rawValue);
      if (Number.isNaN(current.getTime())) return false;
      if (memberReportBuilder.dateFrom) {
        const start = new Date(`${memberReportBuilder.dateFrom}T00:00:00`);
        if (current < start) return false;
      }
      if (memberReportBuilder.dateTo) {
        const end = new Date(`${memberReportBuilder.dateTo}T23:59:59`);
        if (current > end) return false;
      }
      return true;
    };

    const rows = memberPreviewRows.filter((row) => {
      if (memberReportBuilder.fieldIds.length && !memberReportBuilder.fieldIds.includes(row.fieldId)) return false;
      if (memberReportBuilder.regionalIds.length && !memberReportBuilder.regionalIds.includes(row.regionalId)) return false;
      if (memberReportBuilder.churchIds.length && !memberReportBuilder.churchIds.includes(row.churchId)) return false;
      if (memberReportBuilder.statuses.length && !memberReportBuilder.statuses.includes(row.status)) return false;
      if (memberReportBuilder.memberTypes.length && !memberReportBuilder.memberTypes.includes(row.memberType)) return false;
      if (!isDateInRange(row.membershipDateRaw)) return false;
      return true;
    });

    return [...rows].sort((left, right) => {
      if (memberReportBuilder.sortBy === 'age') {
        const leftAge = Number.parseInt(left.age, 10);
        const rightAge = Number.parseInt(right.age, 10);
        const result = (Number.isNaN(leftAge) ? Number.MAX_SAFE_INTEGER : leftAge) - (Number.isNaN(rightAge) ? Number.MAX_SAFE_INTEGER : rightAge);
        return memberReportBuilder.sortDirection === 'asc' ? result : result * -1;
      }

      const leftValue = getMemberPreviewColumnValue(left, memberReportBuilder.sortBy);
      const rightValue = getMemberPreviewColumnValue(right, memberReportBuilder.sortBy);
      const result = compareLocaleValues(leftValue, rightValue);
      return memberReportBuilder.sortDirection === 'asc' ? result : result * -1;
    });
  }, [memberPreviewRows, memberReportBuilder]);
  const baptismFilteredRows = useMemo(() => {
    const isDateInRange = (row: BaptismPreviewRow) => {
      if (!baptismReportBuilder.dateFrom && !baptismReportBuilder.dateTo) return true;
      const rawValue = row.openedAtRaw || row.baptismDateRaw || row.nextBaptismDateRaw;
      if (!rawValue) return false;
      const current = new Date(rawValue);
      if (Number.isNaN(current.getTime())) return false;
      if (baptismReportBuilder.dateFrom) {
        const start = new Date(`${baptismReportBuilder.dateFrom}T00:00:00`);
        if (current < start) return false;
      }
      if (baptismReportBuilder.dateTo) {
        const end = new Date(`${baptismReportBuilder.dateTo}T23:59:59`);
        if (current > end) return false;
      }
      return true;
    };

    const rows = baptismPreviewRows.filter((row) => {
      if (baptismReportBuilder.fieldIds.length && !baptismReportBuilder.fieldIds.includes(row.fieldId)) return false;
      if (baptismReportBuilder.regionalIds.length && !baptismReportBuilder.regionalIds.includes(row.regionalId)) return false;
      if (baptismReportBuilder.churchIds.length && !baptismReportBuilder.churchIds.includes(row.churchId)) return false;
      if (baptismReportBuilder.workflowStatuses.length && !baptismReportBuilder.workflowStatuses.includes(row.workflow_status)) return false;
      if (baptismReportBuilder.memberStatuses.length && !baptismReportBuilder.memberStatuses.includes(row.member_status)) return false;
      if (baptismReportBuilder.memberTypes.length && !baptismReportBuilder.memberTypes.includes(row.memberType)) return false;
      if (!isDateInRange(row)) return false;
      return true;
    });

    return [...rows].sort((left, right) => {
      const leftValue = getBaptismPreviewColumnValue(left, baptismReportBuilder.sortBy);
      const rightValue = getBaptismPreviewColumnValue(right, baptismReportBuilder.sortBy);
      const result = compareLocaleValues(leftValue, rightValue);
      return baptismReportBuilder.sortDirection === 'asc' ? result : result * -1;
    });
  }, [baptismPreviewRows, baptismReportBuilder]);
  const consecrationFilteredRows = useMemo(() => {
    const isDateInRange = (row: ConsecrationPreviewRow) => {
      if (!consecrationReportBuilder.dateFrom && !consecrationReportBuilder.dateTo) return true;
      const rawValue = row.openedAtRaw || row.consecrationDateRaw || row.nextConsecrationDateRaw;
      if (!rawValue) return false;
      const current = new Date(rawValue);
      if (Number.isNaN(current.getTime())) return false;
      if (consecrationReportBuilder.dateFrom) {
        const start = new Date(`${consecrationReportBuilder.dateFrom}T00:00:00`);
        if (current < start) return false;
      }
      if (consecrationReportBuilder.dateTo) {
        const end = new Date(`${consecrationReportBuilder.dateTo}T23:59:59`);
        if (current > end) return false;
      }
      return true;
    };

    const rows = consecrationPreviewRows.filter((row) => {
      if (consecrationReportBuilder.fieldIds.length && !consecrationReportBuilder.fieldIds.includes(row.fieldId)) return false;
      if (consecrationReportBuilder.regionalIds.length && !consecrationReportBuilder.regionalIds.includes(row.regionalId)) return false;
      if (consecrationReportBuilder.churchIds.length && !consecrationReportBuilder.churchIds.includes(row.churchId)) return false;
      if (consecrationReportBuilder.workflowStatuses.length && !consecrationReportBuilder.workflowStatuses.includes(row.workflow_status)) return false;
      if (consecrationReportBuilder.memberStatuses.length && !consecrationReportBuilder.memberStatuses.includes(row.member_status)) return false;
      if (consecrationReportBuilder.memberTypes.length && !consecrationReportBuilder.memberTypes.includes(row.memberType)) return false;
      if (!isDateInRange(row)) return false;
      return true;
    });

    return [...rows].sort((left, right) => {
      const leftValue = getConsecrationPreviewColumnValue(left, consecrationReportBuilder.sortBy);
      const rightValue = getConsecrationPreviewColumnValue(right, consecrationReportBuilder.sortBy);
      const result = compareLocaleValues(leftValue, rightValue);
      return consecrationReportBuilder.sortDirection === 'asc' ? result : result * -1;
    });
  }, [consecrationPreviewRows, consecrationReportBuilder]);
  const transferFilteredRows = useMemo(() => {
    const isDateInRange = (row: TransferPreviewRow) => {
      if (!transferReportBuilder.dateFrom && !transferReportBuilder.dateTo) return true;
      if (!row.openedAtRaw) return false;
      const current = new Date(row.openedAtRaw);
      if (Number.isNaN(current.getTime())) return false;
      if (transferReportBuilder.dateFrom) {
        const start = new Date(`${transferReportBuilder.dateFrom}T00:00:00`);
        if (current < start) return false;
      }
      if (transferReportBuilder.dateTo) {
        const end = new Date(`${transferReportBuilder.dateTo}T23:59:59`);
        if (current > end) return false;
      }
      return true;
    };

    const rows = transferPreviewRows.filter((row) => {
      if (transferReportBuilder.fieldIds.length && !transferReportBuilder.fieldIds.includes(row.fieldId)) return false;
      if (transferReportBuilder.regionalIds.length && !transferReportBuilder.regionalIds.includes(row.regionalId)) return false;
      if (transferReportBuilder.churchIds.length && !transferReportBuilder.churchIds.includes(row.churchId)) return false;
      if (transferReportBuilder.destinationChurchIds.length && !transferReportBuilder.destinationChurchIds.includes(row.destinationChurchId)) return false;
      if (transferReportBuilder.workflowStatuses.length && !transferReportBuilder.workflowStatuses.includes(row.workflow_status)) return false;
      if (transferReportBuilder.memberStatuses.length && !transferReportBuilder.memberStatuses.includes(row.member_status)) return false;
      if (!isDateInRange(row)) return false;
      return true;
    });

    return [...rows].sort((left, right) => {
      const leftValue = getTransferPreviewColumnValue(left, transferReportBuilder.sortBy);
      const rightValue = getTransferPreviewColumnValue(right, transferReportBuilder.sortBy);
      const result = compareLocaleValues(leftValue, rightValue);
      return transferReportBuilder.sortDirection === 'asc' ? result : result * -1;
    });
  }, [transferPreviewRows, transferReportBuilder]);
  const memberPreviewGroups = useMemo(() => buildMemberPreviewGroups(memberFilteredRows, memberReportBuilder.groupBy, memberReportBuilder.metric), [memberFilteredRows, memberReportBuilder.groupBy, memberReportBuilder.metric]);
  const baptismPreviewGroups = useMemo(() => buildBaptismPreviewGroups(baptismFilteredRows, baptismReportBuilder.groupBy, baptismReportBuilder.metric), [baptismFilteredRows, baptismReportBuilder.groupBy, baptismReportBuilder.metric]);
  const consecrationPreviewGroups = useMemo(() => buildConsecrationPreviewGroups(consecrationFilteredRows, consecrationReportBuilder.groupBy, consecrationReportBuilder.metric), [consecrationFilteredRows, consecrationReportBuilder.groupBy, consecrationReportBuilder.metric]);
  const transferPreviewGroups = useMemo(() => buildTransferPreviewGroups(transferFilteredRows, transferReportBuilder.groupBy, transferReportBuilder.metric), [transferFilteredRows, transferReportBuilder.groupBy, transferReportBuilder.metric]);
  const memberFinalSummaryBlocks = useMemo(
    () => buildMemberColumnSummaries(memberFilteredRows, memberReportBuilder.columns),
    [memberFilteredRows, memberReportBuilder.columns],
  );
  const baptismFinalSummaryBlocks = useMemo(
    () => buildBaptismColumnSummaries(baptismFilteredRows, baptismReportBuilder.columns),
    [baptismFilteredRows, baptismReportBuilder.columns],
  );
  const consecrationFinalSummaryBlocks = useMemo(
    () => buildConsecrationColumnSummaries(consecrationFilteredRows, consecrationReportBuilder.columns),
    [consecrationFilteredRows, consecrationReportBuilder.columns],
  );
  const transferFinalSummaryBlocks = useMemo(
    () => buildTransferColumnSummaries(transferFilteredRows, transferReportBuilder.columns),
    [transferFilteredRows, transferReportBuilder.columns],
  );
  const memberReportSummary = useMemo(() => ({
    totalRows: memberFilteredRows.length,
    metricTotal: memberFilteredRows.reduce((total, row) => total + getMemberMetricValue(row, memberReportBuilder.metric), 0),
    totalGroups: memberPreviewGroups.reduce((total, group) => total + 1 + group.children.length, 0),
    activeColumns: memberReportBuilder.columns.length,
    activeFilters: memberReportBuilder.fieldIds.length + memberReportBuilder.regionalIds.length + memberReportBuilder.churchIds.length + memberReportBuilder.statuses.length,
    activeGrouping: memberReportBuilder.groupBy.map((group) => MEMBER_REPORT_GROUP_OPTIONS.find((option) => option.value === group)?.label || group).join(' > ') || 'Sem agrupamento',
  }), [memberFilteredRows, memberPreviewGroups, memberReportBuilder.columns.length, memberReportBuilder.groupBy, memberReportBuilder.metric, memberReportBuilder.fieldIds.length, memberReportBuilder.regionalIds.length, memberReportBuilder.churchIds.length, memberReportBuilder.statuses.length]);
  const selectedChurchNames = useMemo(
    () => (memberReportBuilder.churchIds.length
      ? memberReportBuilder.churchIds.map((churchId) => churchLookup.get(churchId)?.name).filter(Boolean).join(', ')
      : 'Todas as Igrejas'),
    [memberReportBuilder.churchIds, churchLookup],
  );
  const printResponsible = storedUser.fullName || storedUser.name || storedUser.churchName || 'ADMIN USER';
  const printPeriod = memberReportBuilder.dateFrom || memberReportBuilder.dateTo
    ? `${memberReportBuilder.dateFrom ? formatLongDate(memberReportBuilder.dateFrom) : 'Início em aberto'}${memberReportBuilder.dateTo ? ` até ${formatLongDate(memberReportBuilder.dateTo)}` : ''}`
    : 'Todo o período';
  const printDate = formatDate(new Date().toISOString());
  const baptismWorkflowStatusOptions = useMemo(
    () => Array.from(new Set(baptismPreviewRows.map((row) => row.workflow_status).filter(Boolean))).sort(compareLocaleValues),
    [baptismPreviewRows],
  );
  const baptismMemberStatusOptions = useMemo(
    () => Array.from(new Set(baptismPreviewRows.map((row) => row.member_status).filter(Boolean))).sort(compareLocaleValues),
    [baptismPreviewRows],
  );
  const baptismSelectedChurchNames = useMemo(
    () => (baptismReportBuilder.churchIds.length
      ? baptismReportBuilder.churchIds.map((churchId) => churchLookup.get(churchId)?.name).filter(Boolean).join(', ')
      : 'Todas as Igrejas'),
    [baptismReportBuilder.churchIds, churchLookup],
  );
  const baptismPrintPeriod = baptismReportBuilder.dateFrom || baptismReportBuilder.dateTo
    ? `${baptismReportBuilder.dateFrom ? formatLongDate(baptismReportBuilder.dateFrom) : 'Início em aberto'}${baptismReportBuilder.dateTo ? ` até ${formatLongDate(baptismReportBuilder.dateTo)}` : ''}`
    : 'Todo o período';
  const baptismReportSummary = useMemo(() => ({
    totalRows: baptismFilteredRows.length,
    metricTotal: baptismFilteredRows.reduce((total, row) => total + getBaptismMetricValue(row, baptismReportBuilder.metric), 0),
    pendingRows: baptismFilteredRows.filter((row) => row.columnIndex === 1).length,
    approvedRows: baptismFilteredRows.filter((row) => row.columnIndex === 2).length,
    cancelledRows: baptismFilteredRows.filter((row) => row.columnIndex === 3).length,
    activeColumns: baptismReportBuilder.columns.length,
    activeFilters: baptismReportBuilder.fieldIds.length + baptismReportBuilder.regionalIds.length + baptismReportBuilder.churchIds.length + baptismReportBuilder.workflowStatuses.length + baptismReportBuilder.memberStatuses.length,
    activeGrouping: baptismReportBuilder.groupBy.map((group) => BAPTISM_REPORT_GROUP_OPTIONS.find((option) => option.value === group)?.label || group).join(' > ') || 'Sem agrupamento',
  }), [baptismFilteredRows, baptismReportBuilder]);
  const consecrationWorkflowStatusOptions = useMemo(
    () => Array.from(new Set(consecrationPreviewRows.map((row) => row.workflow_status).filter(Boolean))).sort(compareLocaleValues),
    [consecrationPreviewRows],
  );
  const consecrationMemberStatusOptions = useMemo(
    () => Array.from(new Set(consecrationPreviewRows.map((row) => row.member_status).filter(Boolean))).sort(compareLocaleValues),
    [consecrationPreviewRows],
  );
  const consecrationSelectedChurchNames = useMemo(
    () => (consecrationReportBuilder.churchIds.length
      ? consecrationReportBuilder.churchIds.map((churchId) => churchLookup.get(churchId)?.name).filter(Boolean).join(', ')
      : 'Todas as Igrejas'),
    [consecrationReportBuilder.churchIds, churchLookup],
  );
  const consecrationPrintPeriod = consecrationReportBuilder.dateFrom || consecrationReportBuilder.dateTo
    ? `${consecrationReportBuilder.dateFrom ? formatLongDate(consecrationReportBuilder.dateFrom) : 'Início em aberto'}${consecrationReportBuilder.dateTo ? ` até ${formatLongDate(consecrationReportBuilder.dateTo)}` : ''}`
    : 'Todo o período';
  const consecrationReportSummary = useMemo(() => ({
    totalRows: consecrationFilteredRows.length,
    metricTotal: consecrationFilteredRows.reduce((total, row) => total + getConsecrationMetricValue(row, consecrationReportBuilder.metric), 0),
    pendingRows: consecrationFilteredRows.filter((row) => row.columnIndex === 1).length,
    approvedRows: consecrationFilteredRows.filter((row) => row.columnIndex === 2).length,
    completedRows: consecrationFilteredRows.filter((row) => row.columnIndex >= 4).length,
    activeColumns: consecrationReportBuilder.columns.length,
    activeFilters: consecrationReportBuilder.fieldIds.length + consecrationReportBuilder.regionalIds.length + consecrationReportBuilder.churchIds.length + consecrationReportBuilder.workflowStatuses.length + consecrationReportBuilder.memberStatuses.length,
    activeGrouping: consecrationReportBuilder.groupBy.map((group) => CONSECRATION_REPORT_GROUP_OPTIONS.find((option) => option.value === group)?.label || group).join(' > ') || 'Sem agrupamento',
  }), [consecrationFilteredRows, consecrationReportBuilder]);
  const transferWorkflowStatusOptions = useMemo(
    () => Array.from(new Set(transferPreviewRows.map((row) => row.workflow_status).filter(Boolean))).sort(compareLocaleValues),
    [transferPreviewRows],
  );
  const transferMemberStatusOptions = useMemo(
    () => Array.from(new Set(transferPreviewRows.map((row) => row.member_status).filter(Boolean))).sort(compareLocaleValues),
    [transferPreviewRows],
  );
  const transferSelectedOriginChurchNames = useMemo(
    () => (transferReportBuilder.churchIds.length
      ? transferReportBuilder.churchIds.map((churchId) => churchLookup.get(churchId)?.name).filter(Boolean).join(', ')
      : 'Todas as Igrejas'),
    [transferReportBuilder.churchIds, churchLookup],
  );
  const transferSelectedDestinationChurchNames = useMemo(
    () => (transferReportBuilder.destinationChurchIds.length
      ? transferReportBuilder.destinationChurchIds.map((churchId) => churchLookup.get(churchId)?.name).filter(Boolean).join(', ')
      : 'Todas as Igrejas'),
    [transferReportBuilder.destinationChurchIds, churchLookup],
  );
  const transferPrintPeriod = transferReportBuilder.dateFrom || transferReportBuilder.dateTo
    ? `${transferReportBuilder.dateFrom ? formatLongDate(transferReportBuilder.dateFrom) : 'Início em aberto'}${transferReportBuilder.dateTo ? ` até ${formatLongDate(transferReportBuilder.dateTo)}` : ''}`
    : 'Todo o período';
  const transferReportSummary = useMemo(() => ({
    totalRows: transferFilteredRows.length,
    metricTotal: transferFilteredRows.reduce((total, row) => total + getTransferMetricValue(row, transferReportBuilder.metric), 0),
    pendingRows: transferFilteredRows.filter((row) => row.columnIndex === 1).length,
    approvedRows: transferFilteredRows.filter((row) => row.columnIndex === 2).length,
    completedRows: transferFilteredRows.filter((row) => row.columnIndex >= 3).length,
    activeColumns: transferReportBuilder.columns.length,
    activeFilters: transferReportBuilder.fieldIds.length + transferReportBuilder.regionalIds.length + transferReportBuilder.churchIds.length + transferReportBuilder.destinationChurchIds.length + transferReportBuilder.workflowStatuses.length + transferReportBuilder.memberStatuses.length,
    activeGrouping: transferReportBuilder.groupBy.map((group) => TRANSFER_REPORT_GROUP_OPTIONS.find((option) => option.value === group)?.label || group).join(' > ') || 'Sem agrupamento',
  }), [transferFilteredRows, transferReportBuilder]);
  const isMemberReportTemplateDirty = useMemo(() => {
    if (!activeMemberReportTemplate) return false;
    return JSON.stringify(activeMemberReportTemplate.builder) !== JSON.stringify(memberReportBuilder)
      || activeMemberReportTemplate.name !== memberReportTemplateName.trim();
  }, [activeMemberReportTemplate, memberReportBuilder, memberReportTemplateName]);
  const isBaptismReportTemplateDirty = useMemo(() => {
    if (!activeBaptismReportTemplate) return false;
    return JSON.stringify(activeBaptismReportTemplate.builder) !== JSON.stringify(baptismReportBuilder)
      || activeBaptismReportTemplate.name !== baptismReportTemplateName.trim();
  }, [activeBaptismReportTemplate, baptismReportBuilder, baptismReportTemplateName]);
  const isConsecrationReportTemplateDirty = useMemo(() => {
    if (!activeConsecrationReportTemplate) return false;
    return JSON.stringify(activeConsecrationReportTemplate.builder) !== JSON.stringify(consecrationReportBuilder)
      || activeConsecrationReportTemplate.name !== consecrationReportTemplateName.trim();
  }, [activeConsecrationReportTemplate, consecrationReportBuilder, consecrationReportTemplateName]);
  const isTransferReportTemplateDirty = useMemo(() => {
    if (!activeTransferReportTemplate) return false;
    return JSON.stringify(activeTransferReportTemplate.builder) !== JSON.stringify(transferReportBuilder)
      || activeTransferReportTemplate.name !== transferReportTemplateName.trim();
  }, [activeTransferReportTemplate, transferReportBuilder, transferReportTemplateName]);

  // ─── Requirements filtered rows ──────────────────────────────────────────
  const requirementsFilteredRows = useMemo<RequirementsPreviewRow[]>(() => {
    let rows = requirementsRawData;
    const b = requirementsReportBuilder;
    if (b.fieldIds.length) rows = rows.filter((r) => b.fieldIds.includes(r.fieldId));
    if (b.regionalIds.length) rows = rows.filter((r) => b.regionalIds.includes(r.regionalId));
    if (b.churchIds.length) rows = rows.filter((r) => b.churchIds.includes(r.churchId));
    if (b.serviceIds.length) rows = rows.filter((r) => r.serviceId != null && b.serviceIds.includes(String(r.serviceId)));
    if (b.statuses.length) rows = rows.filter((r) => b.statuses.map((s) => s.toLowerCase()).includes(r.status.toLowerCase()));
    if (b.memberTypes.length) rows = rows.filter((r) => b.memberTypes.includes(r.memberType || 'MEMBRO'));
    if (b.dateFrom) rows = rows.filter((r) => !r.openedAt || r.openedAt >= b.dateFrom);
    if (b.dateTo) rows = rows.filter((r) => !r.openedAt || r.openedAt <= b.dateTo);
    // sort
    rows = [...rows].sort((a, b2) => {
      const av = String(a[b.sortBy as keyof RequirementsPreviewRow] ?? '');
      const bv = String(b2[b.sortBy as keyof RequirementsPreviewRow] ?? '');
      return b.sortDirection === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return rows;
  }, [requirementsRawData, requirementsReportBuilder]);

  const activeRequirementsReportTemplate = useMemo(
    () => requirementsReportTemplates.find((t) => t.id === activeRequirementsReportTemplateId) || null,
    [requirementsReportTemplates, activeRequirementsReportTemplateId],
  );

  const requirementsColumnLabel: Record<RequirementsReportColumnKey, string> = {
    protocol: 'Protocolo', candidateName: 'Membro/Candidato', service: 'Serviço',
    church: 'Igreja', regional: 'Regional', field: 'Campo', stage: 'Etapa',
    status: 'Situação', openedAt: 'Abertura', closedAt: 'Encerramento', subject: 'Assunto',
  };
  const ALL_REQUIREMENTS_COLUMNS: RequirementsReportColumnKey[] = ['protocol', 'candidateName', 'service', 'church', 'regional', 'field', 'stage', 'status', 'openedAt', 'closedAt', 'subject'];

  function handleSaveRequirementsReportTemplate() {
    const name = requirementsReportBuilder.templateName.trim();
    if (!name) { setRequirementsReportNameDialogOpen(true); return; }
    const now = new Date().toISOString();
    if (activeRequirementsReportTemplateId) {
      setRequirementsReportTemplates((prev) => prev.map((t) => t.id === activeRequirementsReportTemplateId ? { ...t, name, builder: { ...requirementsReportBuilder }, updatedAt: now } : t));
    } else {
      const newTemplate: SavedRequirementsReportTemplate = { id: makeId('req-tpl'), name, builder: { ...requirementsReportBuilder }, createdAt: now, updatedAt: now };
      setRequirementsReportTemplates((prev) => [newTemplate, ...prev]);
      setActiveRequirementsReportTemplateId(newTemplate.id);
    }
  }

  function handleLoadRequirementsReportTemplate(template: SavedRequirementsReportTemplate) {
    setRequirementsReportBuilder(normalizeRequirementsReportBuilderState(template.builder));
    setActiveRequirementsReportTemplateId(template.id);
  }

  function handleDeleteRequirementsReportTemplate(id: string) {
    setRequirementsReportTemplates((prev) => prev.filter((t) => t.id !== id));
    if (activeRequirementsReportTemplateId === id) setActiveRequirementsReportTemplateId(null);
  }

  function handleExportRequirementsReportExcel() {
    const cols = requirementsReportBuilder.columns;
    const headers = cols.map((c) => requirementsColumnLabel[c]);
    const dataRows = requirementsFilteredRows.map((row) => cols.map((c) => row[c as keyof RequirementsPreviewRow] ?? ''));
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Requerimentos');
    XLSX.writeFile(wb, 'relatorio_requerimentos.xlsx');
  }

  function handleExportRequirementsReportPdf() {
    const previewRoot = document.getElementById('requirements-report-preview-root');
    if (!previewRoot) return;
    const inheritedStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((node) => node.outerHTML)
      .join('');
    const printFrame = document.createElement('iframe');
    printFrame.setAttribute('aria-hidden', 'true');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);
    const frameWindow = printFrame.contentWindow;
    if (!frameWindow) { printFrame.remove(); return; }
    const orientationStyle = requirementsReportBuilder.orientation === 'landscape' ? 'landscape' : 'portrait';
    frameWindow.document.write(`
      <html>
        <head>
          <title>Relatório de requerimentos</title>
          ${inheritedStyles}
          <style>
            body { font-family: Arial, sans-serif; margin: 14px; color: #111; line-height: 1.2; font-size: 10px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            body * { color: #111 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .print-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 12px; border-bottom: 0.5px solid #cfd6df; padding-bottom: 8px; }
            .print-title { font-size: 12px; font-weight: 700; margin: 0 0 6px 0; text-transform: uppercase; }
            .print-brand { font-size: 10px; font-weight: 700; text-transform: uppercase; white-space: nowrap; }
            .print-meta { font-size: 10px; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; font-size: 9px; }
            th, td { border: 0.35px solid #e1e6ed !important; padding: 3px 5px !important; text-align: left; vertical-align: top; }
            th { background: #f1f3f5 !important; font-weight: 700; font-size: 9px; text-transform: uppercase; }
            tr:nth-child(even) td { background: ${requirementsReportBuilder.zebraEnabled ? requirementsReportBuilder.zebraColor : 'transparent'} !important; }
            .badge { display: inline-block; border-radius: 999px; padding: 1px 6px; font-size: 9px; font-weight: 600; }
            .expand-btn, .w-10 { display: none !important; }
            @page { size: A4 ${orientationStyle}; margin: 10mm; }
          </style>
        </head>
        <body>
          <div class="print-header">
            <div>
              <p class="print-title">Relatório de requerimentos</p>
              <p class="print-meta"><strong>Data de impressão:</strong> ${printDate}</p>
            </div>
            <div class="print-brand">SISTEMA MRM</div>
          </div>
          ${previewRoot.innerHTML}
        </body>
      </html>
    `);
    frameWindow.document.close();
    const cleanup = () => {
      window.removeEventListener('focus', cleanup);
      if (document.body.contains(printFrame)) printFrame.remove();
    };
    window.addEventListener('focus', cleanup, { once: true });
    frameWindow.focus();
    frameWindow.print();
  }

  const REQ_STATUS_LABELS: Record<string, { label: string; cls: string }> = {
    pendente: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700' },
    em_andamento: { label: 'Em andamento', cls: 'bg-blue-100 text-blue-700' },
    aprovado: { label: 'Aprovado', cls: 'bg-emerald-100 text-emerald-700' },
    rejeitado: { label: 'Rejeitado', cls: 'bg-rose-100 text-rose-700' },
    cancelado: { label: 'Cancelado', cls: 'bg-slate-100 text-slate-600' },
    arquivado: { label: 'Arquivado', cls: 'bg-slate-200 text-slate-500' },
  };

  // ── Credential report computed ─────────────────────────────────────────
  const credentialFilteredRows = useMemo<CredentialPreviewRow[]>(() => {
    let rows = credentialRawData;
    const b = credentialReportBuilder;
    if (b.fieldIds.length) rows = rows.filter((r) => b.fieldIds.includes(r.fieldId));
    if (b.regionalIds.length) rows = rows.filter((r) => b.regionalIds.includes(r.regionalId));
    if (b.churchIds.length) rows = rows.filter((r) => b.churchIds.includes(r.church_id));
    if (b.situacoes.length) rows = rows.filter((r) => b.situacoes.map((s) => s.toLowerCase()).includes((r.situacao || '').toLowerCase()));
    if (b.memberTypes.length) rows = rows.filter((r) => b.memberTypes.includes(r.member?.memberType || 'MEMBRO'));
    if (b.dateFrom) rows = rows.filter((r) => {
      let d = r.dataemissao ? String(r.dataemissao).slice(0, 10) : (r.created_at ? r.created_at.slice(0, 10) : '');
      if (d && d.includes('/')) {
        const parts = d.split('/');
        if (parts.length === 3) d = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return !d || d >= b.dateFrom;
    });
    if (b.dateTo) rows = rows.filter((r) => {
      let d = r.dataemissao ? String(r.dataemissao).slice(0, 10) : (r.created_at ? r.created_at.slice(0, 10) : '');
      if (d && d.includes('/')) {
        const parts = d.split('/');
        if (parts.length === 3) d = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      return !d || d <= b.dateTo;
    });
    rows = [...rows].sort((a, b2) => {
      const av = String((a as unknown as Record<string, unknown>)[b.sortBy] ?? '');
      const bv = String((b2 as unknown as Record<string, unknown>)[b.sortBy] ?? '');
      return b.sortDirection === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return rows;
  }, [credentialRawData, credentialReportBuilder]);

  const activeCredentialReportTemplate = useMemo(
    () => credentialReportTemplates.find((t) => t.id === activeCredentialReportTemplateId) || null,
    [credentialReportTemplates, activeCredentialReportTemplateId],
  );

  function handleSaveCredentialReportTemplate() {
    const name = credentialReportBuilder.templateName.trim();
    if (!name) { setCredentialReportNameDialogOpen(true); return; }
    const now = new Date().toISOString();
    if (activeCredentialReportTemplateId) {
      setCredentialReportTemplates((prev) => prev.map((t) => t.id === activeCredentialReportTemplateId ? { ...t, name, builder: { ...credentialReportBuilder }, updatedAt: now } : t));
    } else {
      const newT: SavedCredentialReportTemplate = { id: makeId('cred-tpl'), name, builder: { ...credentialReportBuilder }, createdAt: now, updatedAt: now };
      setCredentialReportTemplates((prev) => [newT, ...prev]);
      setActiveCredentialReportTemplateId(newT.id);
    }
    savePersistedCredentialReportTemplates(credentialReportTemplates);
  }

  function handleLoadCredentialReportTemplate(id: string) {
    const tpl = credentialReportTemplates.find((t) => t.id === id);
    if (!tpl) return;
    setCredentialReportBuilder(normalizeCredentialReportBuilderState(tpl.builder));
    setActiveCredentialReportTemplateId(id);
  }

  function handleDeleteCredentialReportTemplate(id: string) {
    setCredentialReportTemplates((prev) => {
      const updated = prev.filter((t) => t.id !== id);
      savePersistedCredentialReportTemplates(updated);
      return updated;
    });
    if (activeCredentialReportTemplateId === id) setActiveCredentialReportTemplateId(null);
  }

  function handleExportCredentialReportExcel() {
    const b = credentialReportBuilder;
    const cols = b.columns;
    const headers = [
      ...cols.map((c) => credentialColumnLabel[c]),
      // Dados da credencial extras
      'Modelo', 'Observação', 'Data aprovação', 'Aprovado por', 'Protocolo',
      // Dados pessoais
      'CPF', 'RG', 'Nascimento', 'Naturalidade', 'Estado civil',
      'Pai', 'Mãe', 'Cônjuge', 'Título eclesiástico', 'Tipo membro', 'Foto (link)',
      // Medidas do modelo
      'Largura (mm)', 'Altura (mm)', 'Larg. página (mm)', 'Alt. página (mm)',
      'Linhas/pág.', 'Colunas/pág.', 'Validade (meses)',
    ];
    const dataRows = credentialFilteredRows.map((row) => [
      ...cols.map((c) => {
        if (c === 'regional') return row.regionalName || '';
        if (c === 'campo') return row.fieldName || '';
        if (c === 'igrejasolicitante') return row.churchName || row.igrejasolicitante || '';
        return String((row as unknown as Record<string, unknown>)[c] ?? '');
      }),
      // Dados da credencial extras
      row.modelo || '',
      row.obs || '',
      row.dataaprovacao || '',
      row.aprovadopor || '',
      row.card_protocol || '',
      // Dados pessoais
      row.member?.cpf || '',
      row.member?.rg || '',
      row.member?.birthDate || '',
      [row.member?.naturalityCity, row.member?.naturalityState].filter(Boolean).join(' - '),
      row.member?.maritalStatus || '',
      row.member?.fatherName || '',
      row.member?.motherName || '',
      row.member?.spouseName || '',
      row.member?.ecclesiasticalTitle || '',
      row.member?.memberType || '',
      row.member?.photoUrl || '',
      // Medidas do modelo
      row.modelLargura ?? '',
      row.modelAltura ?? '',
      row.modelLargurapg ?? '',
      row.modelAlturapg ?? '',
      row.modelLinhaporpg ?? '',
      row.modelColunaporpg ?? '',
      row.modelValidademeses ?? '',
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Credenciais');
    XLSX.writeFile(wb, 'relatorio_credenciais.xlsx');
  }

  function handleExportCredentialReportPdf() {
    const previewRoot = document.getElementById('credential-report-preview-root');
    if (!previewRoot) return;
    const inheritedStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((node) => node.outerHTML).join('');
    const printFrame = document.createElement('iframe');
    printFrame.setAttribute('aria-hidden', 'true');
    printFrame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(printFrame);
    const fw = printFrame.contentWindow;
    if (!fw) { printFrame.remove(); return; }
    const orient = credentialReportBuilder.orientation === 'landscape' ? 'landscape' : 'portrait';
    const printDate = new Date().toLocaleDateString('pt-BR');
    fw.document.write(`<html><head><title>Relatório de credenciais</title>${inheritedStyles}<style>
      body{font-family:Arial,sans-serif;margin:14px;color:#111;font-size:10px;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
      .ph{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:12px;border-bottom:.5px solid #cfd6df;padding-bottom:8px;}
      .pt{font-size:12px;font-weight:700;margin:0 0 6px;text-transform:uppercase;}
      .pb{font-size:10px;font-weight:700;text-transform:uppercase;white-space:nowrap;}
      table{width:100%;border-collapse:collapse;font-size:9px;}
      th,td{border:.35px solid #e1e6ed!important;padding:3px 5px!important;text-align:left;vertical-align:top;}
      th{background:#f1f3f5!important;font-weight:700;font-size:9px;text-transform:uppercase;}
      tr:nth-child(even) td{background:${credentialReportBuilder.zebraEnabled ? credentialReportBuilder.zebraColor : 'transparent'}!important;}
      .badge{display:inline-block;border-radius:999px;padding:1px 6px;font-size:9px;font-weight:600;}
      .expand-btn,.w-10,.no-print{display:none!important;}
      .cred-expand{background:#f0fdf4;border-top:.5px solid #bbf7d0;}
      [class*='grid-cols-2']{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:16px!important;}
      .cred-photo{width:60px;height:auto;border-radius:4px;border:1px solid #e2e8f0;}
      @page{size:A4 ${orient};margin:10mm;}
    </style></head><body>
    <div class="ph"><div><p class="pt">Relatório de credenciais</p><p style="font-size:10px"><strong>Data de impressão:</strong> ${printDate}</p></div><div class="pb">SISTEMA MRM</div></div>
    ${previewRoot.innerHTML}
    </body></html>`);
    fw.document.close();
    const cleanup = () => { if (document.body.contains(printFrame)) printFrame.remove(); };
    window.addEventListener('focus', cleanup, { once: true });
    fw.focus();
    fw.print();
  }
  // ────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    setMemberReportBuilder((current) => {
      const nextColumns = current.columns.filter((column) => column !== 'leader_name' && column !== 'leader_role');
      const nextSortBy = current.sortBy === 'leader_name' || current.sortBy === 'leader_role'
        ? (nextColumns[0] || 'name')
        : current.sortBy;

      if (nextColumns.length === current.columns.length && nextSortBy === current.sortBy) {
        return current;
      }

      return {
        ...current,
        columns: nextColumns,
        sortBy: nextSortBy,
      };
    });
  }, []);

  function renderCompactSummaryTable(
    metricRows: ReportSummaryMetricRow[],
    blocks: ReportSummaryDetailBlock[],
    _accentClassName: string,
  ) {
    const compactColumns = [
      ...metricRows.map((row) => ({
        key: `metric-${row.label}`,
        label: abbreviateSummaryLabel(row.label),
        value: row.value,
      })),
      ...blocks.flatMap((block) => block.items.map((item) => ({
        key: `${block.id}-${item.label}`,
        label: /t[ií]tulo/i.test(block.label)
          ? item.label
          : /servi[cç]/i.test(block.label)
            ? `${abbreviateSummaryLabel(block.label)}: ${abbreviateServiceName(item.label)}`
            : `${abbreviateSummaryLabel(block.label)}: ${item.label}`,
        value: formatMetric(item.count),
      }))),
    ];

    if (!compactColumns.length) {
      return null;
    }

    return (
      <div className="overflow-hidden rounded-xl bg-slate-50/70">
        <div className="overflow-hidden">
          <table className="report-summary-table w-full table-fixed text-[11px] leading-tight">
            <thead>
              <tr>
                {compactColumns.map((column) => (
                  <th key={column.key} className="px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500 break-words">
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white">
                {compactColumns.map((column) => (
                  <td key={`${column.key}-value`} className="px-2 py-1.5 font-medium text-slate-800 break-words">
                    {column.value}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function renderGroupSummaryCard(
    summaryTitle: string,
    total: number,
    rowCount: number,
    blocks: ReportSummaryDetailBlock[],
    accentClassName: string,
  ) {
    return (
      <div className="rounded-xl bg-slate-50 px-2 py-2">
        <div className="mb-1 text-xs font-medium uppercase tracking-[0.06em] text-slate-600">Resumo do grupo: {summaryTitle}</div>
        {renderCompactSummaryTable([
          { label: 'Total', value: formatMetric(total) },
          { label: 'Registros', value: formatMetric(rowCount) },
        ], blocks, accentClassName)}
      </div>
    );
  }

  function renderFinalSummarySection(
    totalRows: number,
    metricTotal: number,
    blocks: ReportSummaryDetailBlock[],
    accentClassName: string,
  ) {
    // Build all rows as label → value pairs for a list layout
    const allItems: Array<{ label: string; value: string }> = [
      { label: 'Tot. reg.', value: formatMetric(totalRows) },
      { label: 'Tot. métrica', value: formatMetric(metricTotal) },
    ];

    blocks.forEach((block) => {
      const abbreviated = abbreviateSummaryLabel(block.label);
      block.items.forEach((item) => {
        const itemLabel = /t[ií]tulo/i.test(block.label)
          ? item.label
          : /servi[cç]/i.test(block.label)
            ? `${abbreviated}: ${abbreviateServiceName(item.label)}`
            : `${abbreviated}: ${item.label}`;
        allItems.push({ label: itemLabel, value: formatMetric(item.count) });
      });
    });

    if (!allItems.length) {
      return (
        <div className="px-2 py-2">
          <p className="mt-1 text-xs text-slate-500">Selecione colunas categóricas para exibir detalhamento.</p>
        </div>
      );
    }

    // Split into rows of up to 6 items so no column is too narrow
    const chunkSize = 6;
    const chunks: Array<typeof allItems> = [];
    for (let i = 0; i < allItems.length; i += chunkSize) {
      chunks.push(allItems.slice(i, i + chunkSize));
    }

    return (
      <div className="px-2 py-2 space-y-1">
        {chunks.map((chunk, ci) => (
          <table key={ci} className="w-full text-[11px] leading-tight border-collapse">
            <thead>
              <tr>
                {chunk.map((item) => (
                  <th key={item.label} className="px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500 bg-slate-50 border border-slate-200 whitespace-nowrap">
                    {item.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="bg-white">
                {chunk.map((item) => (
                  <td key={`${item.label}-val`} className="px-2 py-1.5 font-medium text-slate-800 border border-slate-200">
                    {item.value}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        ))}
        {!blocks.length ? (
          <p className="mt-1 text-xs text-slate-500">Selecione colunas categóricas para exibir detalhamento.</p>
        ) : null}
      </div>
    );
  }

  function abbreviateSummaryLabel(label: string) {
    const normalized = label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalized.includes('total de registros')) return 'Tot. reg.';
    if (normalized.includes('total da metrica')) return 'Tot. metr.';
    if (normalized.includes('registros')) return 'Regs.';
    if (normalized.includes('regional')) return 'Reg.';
    if (normalized.includes('igreja')) return 'Igr.';
    if (normalized.includes('servico') || normalized.includes('serv')) return 'Serv.';
    if (normalized.includes('campo')) return 'Campo';
    if (normalized.includes('situacao') || normalized.includes('situac')) return 'Sit.';
    if (normalized.includes('titulo') || normalized.includes('titul')) return 'Tít.';
    if (normalized.includes('total')) return 'Total';
    return label;
  }

  function abbreviateServiceName(name: string) {
    const n = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (n.includes('batismo em aguas') || n.includes('bat. aguas')) return 'Bat. Águas';
    if (n.includes('batismo em outro') || n.includes('bat. outro')) return 'Bat. Outro';
    if (n.includes('batismo')) return 'Bat.';
    if (n.includes('consagracao') || n.includes('consagr')) return 'Consagr.';
    if (n.includes('transferencia') || n.includes('transfer')) return 'Transfer.';
    if (n.includes('credential') || n.includes('credencial')) return 'Cred.';
    return name.length > 14 ? name.slice(0, 13) + '.' : name;
  }

  function buildExcelRowsFromGroups(nodes: MemberPreviewGroupNode[], rows: Array<Array<string | number>>, depth = 0) {
    nodes.forEach((node) => {
      const prefix = `${'  '.repeat(depth)}${getMemberGroupLabel(node.field)}: ${node.label}`;
      rows.push([prefix, `${node.rowCount} registro(s)`]);

      if (node.children.length > 0) {
        buildExcelRowsFromGroups(node.children, rows, depth + 1);
      } else {
        rows.push(memberReportBuilder.columns.map((column) => getMemberReportColumnLabel(column)));
        node.rows.forEach((row) => {
          rows.push(memberReportBuilder.columns.map((column) => getMemberPreviewColumnValue(row, column)));
        });
      }

      rows.push(['Resumo do grupo']);
      rows.push(['Total', node.total]);
      rows.push(['Registros', node.rowCount]);

      const hiddenSummaryColumns = memberReportBuilder.groupBy
        .map((group) => getGroupedColumnKey(group))
        .filter((column): column is MemberReportColumnKey => Boolean(column));
      const nodeSummaryBlocks = buildMemberColumnSummaries(node.rows, memberReportBuilder.columns, hiddenSummaryColumns);
      nodeSummaryBlocks.forEach((block) => {
        block.items.forEach((item) => {
          rows.push([block.label, item.label, item.count]);
        });
      });

      rows.push([]);
    });
  }

  function handleExportMemberReportExcel() {
    const rows: Array<Array<string | number>> = [];

    rows.push(['Relatório avançado de membros']);
    rows.push(['Igreja', selectedChurchNames]);
    rows.push(['Dirigente', `Impressão geral por - ${String(printResponsible).toUpperCase()}`]);
    rows.push(['Período', printPeriod]);
    rows.push(['Data de impressão', printDate]);
    rows.push([]);

    if (memberReportBuilder.groupBy.length > 0) {
      buildExcelRowsFromGroups(memberPreviewGroups, rows);
    } else {
      rows.push(memberReportBuilder.columns.map((column) => getMemberReportColumnLabel(column)));
      memberFilteredRows.forEach((row) => {
        rows.push(memberReportBuilder.columns.map((column) => getMemberPreviewColumnValue(row, column)));
      });
      rows.push([]);
    }

    rows.push(['Tabela final de totais']);
    rows.push(['Total de registros', memberReportSummary.totalRows]);
    rows.push(['Total da métrica', memberReportSummary.metricTotal]);
    memberFinalSummaryBlocks.forEach((block) => {
      block.items.forEach((item) => {
        rows.push([block.label, item.label, item.count]);
      });
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = Array.from({ length: Math.max(memberReportBuilder.columns.length, 6) }, () => ({ wch: 24 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório de membros');
    XLSX.writeFile(workbook, `relatorio-membros-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function handleMemberReportTypeChange(reportType: MemberReportTypeKey) {
    const preset = MEMBER_REPORT_PRESETS[reportType];
    setMemberReportBuilder((current) => ({
      ...current,
      reportType,
      groupBy: preset.groupBy.slice(0, 1),
      columns: preset.columns,
      sortBy: preset.sortBy,
    }));
  }

  function handleBaptismReportTypeChange(reportType: BaptismReportTypeKey) {
    const preset = BAPTISM_REPORT_PRESETS[reportType];
    setBaptismReportBuilder((current) => ({
      ...current,
      reportType,
      groupBy: [...preset.groupBy],
      columns: preset.columns,
      sortBy: preset.sortBy,
      sortDirection: reportType === 'scheduled_report' ? 'asc' : current.sortDirection,
    }));
  }

  function toggleBaptismGroupField(field: BaptismReportGroupKey) {
    setBaptismReportBuilder((current) => {
      const exists = current.groupBy.includes(field);
      return {
        ...current,
        groupBy: exists ? current.groupBy.filter((item) => item !== field) : [...current.groupBy, field],
      };
    });
  }

  function removeBaptismGroupField(field: BaptismReportGroupKey) {
    setBaptismReportBuilder((current) => ({
      ...current,
      groupBy: current.groupBy.filter((item) => item !== field),
    }));
  }

  function moveBaptismGroupField(field: BaptismReportGroupKey, direction: 'up' | 'down') {
    setBaptismReportBuilder((current) => ({
      ...current,
      groupBy: moveOrderedItem(current.groupBy, field, direction),
    }));
  }

  function toggleBaptismReportColumn(column: BaptismReportColumnKey) {
    setBaptismReportBuilder((current) => {
      const exists = current.columns.includes(column);
      if (exists && current.columns.length === 1) return current;
      const nextColumns = exists ? current.columns.filter((item) => item !== column) : [...current.columns, column];
      const nextSortBy = nextColumns.includes(current.sortBy) ? current.sortBy : nextColumns[0];
      return {
        ...current,
        columns: nextColumns,
        sortBy: nextSortBy,
      };
    });
  }

  function moveBaptismReportColumn(column: BaptismReportColumnKey, direction: 'up' | 'down') {
    setBaptismReportBuilder((current) => ({
      ...current,
      columns: moveOrderedItem(current.columns, column, direction),
    }));
  }

  function buildExcelRowsFromBaptismGroups(nodes: BaptismPreviewGroupNode[], rows: Array<Array<string | number>>, depth = 0) {
    nodes.forEach((node) => {
      const prefix = `${'  '.repeat(depth)}${getBaptismGroupLabel(node.field)}: ${node.label}`;
      rows.push([prefix, `${node.rowCount} registro(s)`]);

      if (node.children.length > 0) {
        buildExcelRowsFromBaptismGroups(node.children, rows, depth + 1);
      } else {
        rows.push(baptismReportBuilder.columns.map((column) => getBaptismReportColumnLabel(column)));
        node.rows.forEach((row) => {
          rows.push(baptismReportBuilder.columns.map((column) => getBaptismPreviewColumnValue(row, column)));
        });
      }

      rows.push(['Resumo do grupo']);
      rows.push(['Total', node.total]);
      rows.push(['Registros', node.rowCount]);

      const hiddenSummaryColumns = baptismReportBuilder.groupBy
        .map((group) => getBaptismGroupedColumnKey(group))
        .filter((column): column is BaptismReportColumnKey => Boolean(column));
      const nodeSummaryBlocks = buildBaptismColumnSummaries(node.rows, baptismReportBuilder.columns, hiddenSummaryColumns);
      nodeSummaryBlocks.forEach((block) => {
        block.items.forEach((item) => {
          rows.push([block.label, item.label, item.count]);
        });
      });

      rows.push([]);
    });
  }

  function handleExportBaptismReportExcel() {
    const rows: Array<Array<string | number>> = [];

    rows.push(['Relatório avançado de batismos']);
    rows.push(['Igreja', baptismSelectedChurchNames]);
    rows.push(['Dirigente', `Impressão geral por - ${String(printResponsible).toUpperCase()}`]);
    rows.push(['Período', baptismPrintPeriod]);
    rows.push(['Data de impressão', printDate]);
    rows.push([]);

    if (baptismReportBuilder.groupBy.length > 0) {
      buildExcelRowsFromBaptismGroups(baptismPreviewGroups, rows);
    } else {
      rows.push(baptismReportBuilder.columns.map((column) => getBaptismReportColumnLabel(column)));
      baptismFilteredRows.forEach((row) => {
        rows.push(baptismReportBuilder.columns.map((column) => getBaptismPreviewColumnValue(row, column)));
      });
      rows.push([]);
    }

    rows.push(['Tabela final de totais']);
    rows.push(['Total de registros', baptismReportSummary.totalRows]);
    rows.push(['Total da métrica', baptismReportSummary.metricTotal]);
    baptismFinalSummaryBlocks.forEach((block) => {
      block.items.forEach((item) => {
        rows.push([block.label, item.label, item.count]);
      });
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = Array.from({ length: Math.max(baptismReportBuilder.columns.length, 6) }, () => ({ wch: 24 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório de batismos');
    XLSX.writeFile(workbook, `relatorio-batismos-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function handleExportBaptismReportPdf() {
    const previewRoot = document.getElementById('baptism-report-preview-root');
    if (!previewRoot) return;
    const inheritedStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((node) => node.outerHTML)
      .join('');
    const printFrame = document.createElement('iframe');
    printFrame.setAttribute('aria-hidden', 'true');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const frameWindow = printFrame.contentWindow;
    if (!frameWindow) {
      printFrame.remove();
      return;
    }

    frameWindow.document.write(`
      <html>
        <head>
          <title>Relatório de batismos</title>
          ${inheritedStyles}
          <style>
            body { font-family: Arial, sans-serif; margin: 14px; color: #111111; line-height: 1.2; font-size: 10px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .print-shell { width: 100%; }
            body * { color: #111111 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .print-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 12px; border-bottom: 0.5px solid #cfd6df; padding-bottom: 8px; }
            .print-title { font-size: 12px; font-weight: 700; margin: 0 0 6px 0; text-transform: uppercase; }
            .print-brand { font-size: 10px; font-weight: 700; text-transform: uppercase; white-space: nowrap; }
            .print-meta { font-size: 10px; margin-top: 2px; }
            .report-group { margin-bottom: 8px; }
            .report-group-title { font-size: 10px; font-weight: 700; margin-bottom: 4px; padding: 5px 8px !important; border: 0.35px solid #dde3ea !important; background: #f3f4f6 !important; }
            .report-table { width: 100%; border-collapse: collapse; border-spacing: 0 !important; margin-top: 4px; }
            .report-table th, .report-table td { border: 0.35px solid #e1e6ed !important; padding: 2px 4px !important; font-size: 10px !important; text-align: left; vertical-align: top; }
            .report-table th { background: #f1f3f5 !important; font-weight: 700; }
            @page { size: A4 ${baptismReportBuilder.orientation === 'landscape' ? 'landscape' : 'portrait'}; margin: 10mm; }
          </style>
        </head>
        <body>
          <div class="print-shell ${baptismReportBuilder.orientation === 'landscape' ? 'landscape' : 'portrait'}">
            <div class="print-header">
              <div>
                <p class="print-title">Relatório avançado de batismos</p>
                <p class="print-meta"><strong>Igreja:</strong> ${baptismSelectedChurchNames}</p>
                <p class="print-meta"><strong>Dirigente:</strong> Impressão geral por - ${String(printResponsible).toUpperCase()}</p>
                <p class="print-meta"><strong>Período:</strong> ${baptismPrintPeriod}</p>
                <p class="print-meta"><strong>Data de impressão:</strong> ${printDate}</p>
              </div>
              <div class="print-brand">SISTEMA MRM</div>
            </div>
            ${previewRoot.innerHTML}
          </div>
        </body>
      </html>
    `);
    frameWindow.document.close();

    const cleanup = () => {
      window.removeEventListener('focus', cleanup);
      if (document.body.contains(printFrame)) {
        printFrame.remove();
      }
    };

    window.addEventListener('focus', cleanup, { once: true });
    frameWindow.focus();
    frameWindow.print();
  }

  function renderBaptismPreviewGroups(nodes: BaptismPreviewGroupNode[]) {
    return nodes.map((node) => {
      const fieldLabel = BAPTISM_REPORT_GROUP_OPTIONS.find((option) => option.value === node.field)?.label.toUpperCase() || 'GRUPO';
      const hiddenSummaryColumns = baptismReportBuilder.groupBy
        .map((group) => getBaptismGroupedColumnKey(group))
        .filter((column): column is BaptismReportColumnKey => Boolean(column));
      const nodeSummaryBlocks = buildBaptismColumnSummaries(node.rows, baptismReportBuilder.columns, hiddenSummaryColumns);

      return (
        <div key={node.id} className="report-group space-y-3">
          <div className="report-group-title rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-black tracking-[0.08em] text-slate-900">{fieldLabel}: {node.label}</span>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{formatMetric(node.rowCount)} registro(s)</span>
            </div>
          </div>

          {node.children.length > 0 ? (
            <div className="space-y-4">{renderBaptismPreviewGroups(node.children)}</div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="report-table min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {baptismReportBuilder.columns.map((column) => (
                        <th
                          key={column}
                          onClick={() => setBaptismReportBuilder((prev) => ({ ...prev, sortBy: column, sortDirection: prev.sortBy === column ? (prev.sortDirection === 'asc' ? 'desc' : 'asc') : 'asc' }))}
                          className="no-print-sort whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 cursor-pointer select-none hover:bg-slate-100 group"
                        >
                          <span className="inline-flex items-center gap-1">
                            {getBaptismReportColumnLabel(column, true)}
                            <span className="print:hidden text-slate-300 group-hover:text-slate-500 transition-colors">{baptismReportBuilder.sortBy === column ? (baptismReportBuilder.sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ⇅'}</span>
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {node.rows.map((row, index) => (
                      <tr key={row.id} style={baptismReportBuilder.zebraEnabled && index % 2 === 1 ? { backgroundColor: baptismReportBuilder.zebraColor } : undefined}>
                        {baptismReportBuilder.columns.map((column) => (
                          <td key={`${row.id}-${column}`} className="whitespace-nowrap px-4 py-3 text-slate-700">
                            {getBaptismPreviewColumnValue(row, column)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!node.children.length ? renderGroupSummaryCard(
            `${fieldLabel}: ${node.label}`,
            node.total,
            node.rowCount,
            nodeSummaryBlocks.map((block) => ({ id: `${node.id}-${block.column}`, label: block.label, items: block.items })),
            'text-sky-900 bg-sky-50',
          ) : null}
        </div>
      );
    });
  }

  function handleConsecrationReportTypeChange(reportType: ConsecrationReportTypeKey) {
    const preset = CONSECRATION_REPORT_PRESETS[reportType];
    setConsecrationReportBuilder((current) => ({
      ...current,
      reportType,
      groupBy: [...preset.groupBy],
      columns: preset.columns,
      sortBy: preset.sortBy,
      sortDirection: reportType === 'title_progress' ? 'asc' : current.sortDirection,
    }));
  }

  function toggleConsecrationGroupField(field: ConsecrationReportGroupKey) {
    setConsecrationReportBuilder((current) => {
      const exists = current.groupBy.includes(field);
      return {
        ...current,
        groupBy: exists ? current.groupBy.filter((item) => item !== field) : [...current.groupBy, field],
      };
    });
  }

  function removeConsecrationGroupField(field: ConsecrationReportGroupKey) {
    setConsecrationReportBuilder((current) => ({
      ...current,
      groupBy: current.groupBy.filter((item) => item !== field),
    }));
  }

  function moveConsecrationGroupField(field: ConsecrationReportGroupKey, direction: 'up' | 'down') {
    setConsecrationReportBuilder((current) => ({
      ...current,
      groupBy: moveOrderedItem(current.groupBy, field, direction),
    }));
  }

  function toggleConsecrationReportColumn(column: ConsecrationReportColumnKey) {
    setConsecrationReportBuilder((current) => {
      const exists = current.columns.includes(column);
      if (exists && current.columns.length === 1) return current;
      const nextColumns = exists ? current.columns.filter((item) => item !== column) : [...current.columns, column];
      const nextSortBy = nextColumns.includes(current.sortBy) ? current.sortBy : nextColumns[0];
      return {
        ...current,
        columns: nextColumns,
        sortBy: nextSortBy,
      };
    });
  }

  function moveConsecrationReportColumn(column: ConsecrationReportColumnKey, direction: 'up' | 'down') {
    setConsecrationReportBuilder((current) => ({
      ...current,
      columns: moveOrderedItem(current.columns, column, direction),
    }));
  }

  function buildExcelRowsFromConsecrationGroups(nodes: ConsecrationPreviewGroupNode[], rows: Array<Array<string | number>>, depth = 0) {
    nodes.forEach((node) => {
      const prefix = `${'  '.repeat(depth)}${getConsecrationGroupLabel(node.field)}: ${node.label}`;
      rows.push([prefix, `${node.rowCount} registro(s)`]);

      if (node.children.length > 0) {
        buildExcelRowsFromConsecrationGroups(node.children, rows, depth + 1);
      } else {
        rows.push(consecrationReportBuilder.columns.map((column) => getConsecrationReportColumnLabel(column)));
        node.rows.forEach((row) => {
          rows.push(consecrationReportBuilder.columns.map((column) => getConsecrationPreviewColumnValue(row, column)));
        });
      }

      rows.push(['Resumo do grupo']);
      rows.push(['Total', node.total]);
      rows.push(['Registros', node.rowCount]);

      const hiddenSummaryColumns = consecrationReportBuilder.groupBy
        .map((group) => getConsecrationGroupedColumnKey(group))
        .filter((column): column is ConsecrationReportColumnKey => Boolean(column));
      const nodeSummaryBlocks = buildConsecrationColumnSummaries(node.rows, consecrationReportBuilder.columns, hiddenSummaryColumns);
      nodeSummaryBlocks.forEach((block) => {
        block.items.forEach((item) => {
          rows.push([block.label, item.label, item.count]);
        });
      });

      rows.push([]);
    });
  }

  function handleExportConsecrationReportExcel() {
    const rows: Array<Array<string | number>> = [];

    rows.push(['Relatório avançado de consagrações']);
    rows.push(['Igreja', consecrationSelectedChurchNames]);
    rows.push(['Dirigente', `Impressão geral por - ${String(printResponsible).toUpperCase()}`]);
    rows.push(['Período', consecrationPrintPeriod]);
    rows.push(['Data de impressão', printDate]);
    rows.push([]);

    if (consecrationReportBuilder.groupBy.length > 0) {
      buildExcelRowsFromConsecrationGroups(consecrationPreviewGroups, rows);
    } else {
      rows.push(consecrationReportBuilder.columns.map((column) => getConsecrationReportColumnLabel(column)));
      consecrationFilteredRows.forEach((row) => {
        rows.push(consecrationReportBuilder.columns.map((column) => getConsecrationPreviewColumnValue(row, column)));
      });
      rows.push([]);
    }

    rows.push(['Tabela final de totais']);
    rows.push(['Total de registros', consecrationReportSummary.totalRows]);
    rows.push(['Total da métrica', consecrationReportSummary.metricTotal]);
    consecrationFinalSummaryBlocks.forEach((block) => {
      block.items.forEach((item) => {
        rows.push([block.label, item.label, item.count]);
      });
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = Array.from({ length: Math.max(consecrationReportBuilder.columns.length, 6) }, () => ({ wch: 24 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório de consagrações');
    XLSX.writeFile(workbook, `relatorio-consagracoes-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function handleExportConsecrationReportPdf() {
    const previewRoot = document.getElementById('consecration-report-preview-root');
    if (!previewRoot) return;
    const inheritedStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((node) => node.outerHTML)
      .join('');
    const printFrame = document.createElement('iframe');
    printFrame.setAttribute('aria-hidden', 'true');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const frameWindow = printFrame.contentWindow;
    if (!frameWindow) {
      printFrame.remove();
      return;
    }

    frameWindow.document.write(`
      <html>
        <head>
          <title>Relatório de consagrações</title>
          ${inheritedStyles}
          <style>
            body { font-family: Arial, sans-serif; margin: 14px; color: #111111; line-height: 1.2; font-size: 10px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .print-shell { width: 100%; }
            body * { color: #111111 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .print-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 12px; border-bottom: 0.5px solid #cfd6df; padding-bottom: 8px; }
            .print-title { font-size: 12px; font-weight: 700; margin: 0 0 6px 0; text-transform: uppercase; }
            .print-brand { font-size: 10px; font-weight: 700; text-transform: uppercase; white-space: nowrap; }
            .print-meta { font-size: 10px; margin-top: 2px; }
            .report-group { margin-bottom: 8px; }
            .report-group-title { font-size: 10px; font-weight: 700; margin-bottom: 4px; padding: 5px 8px !important; border: 0.35px solid #dde3ea !important; background: #f3f4f6 !important; }
            .report-table { width: 100%; border-collapse: collapse; border-spacing: 0 !important; margin-top: 4px; }
            .report-table th, .report-table td { border: 0.35px solid #e1e6ed !important; padding: 2px 4px !important; font-size: 10px !important; text-align: left; vertical-align: top; }
            .report-table th { background: #f1f3f5 !important; font-weight: 700; }
            @page { size: A4 ${consecrationReportBuilder.orientation === 'landscape' ? 'landscape' : 'portrait'}; margin: 10mm; }
          </style>
        </head>
        <body>
          <div class="print-shell ${consecrationReportBuilder.orientation === 'landscape' ? 'landscape' : 'portrait'}">
            <div class="print-header">
              <div>
                <p class="print-title">Relatório avançado de consagrações</p>
                <p class="print-meta"><strong>Igreja:</strong> ${consecrationSelectedChurchNames}</p>
                <p class="print-meta"><strong>Dirigente:</strong> Impressão geral por - ${String(printResponsible).toUpperCase()}</p>
                <p class="print-meta"><strong>Período:</strong> ${consecrationPrintPeriod}</p>
                <p class="print-meta"><strong>Data de impressão:</strong> ${printDate}</p>
              </div>
              <div class="print-brand">SISTEMA MRM</div>
            </div>
            ${previewRoot.innerHTML}
          </div>
        </body>
      </html>
    `);
    frameWindow.document.close();

    const cleanup = () => {
      window.removeEventListener('focus', cleanup);
      if (document.body.contains(printFrame)) {
        printFrame.remove();
      }
    };

    window.addEventListener('focus', cleanup, { once: true });
    frameWindow.focus();
    frameWindow.print();
  }

  function renderConsecrationPreviewGroups(nodes: ConsecrationPreviewGroupNode[]) {
    return nodes.map((node) => {
      const fieldLabel = CONSECRATION_REPORT_GROUP_OPTIONS.find((option) => option.value === node.field)?.label.toUpperCase() || 'GRUPO';
      const hiddenSummaryColumns = consecrationReportBuilder.groupBy
        .map((group) => getConsecrationGroupedColumnKey(group))
        .filter((column): column is ConsecrationReportColumnKey => Boolean(column));
      const nodeSummaryBlocks = buildConsecrationColumnSummaries(node.rows, consecrationReportBuilder.columns, hiddenSummaryColumns);

      return (
        <div key={node.id} className="report-group space-y-3">
          <div className="report-group-title rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-black tracking-[0.08em] text-slate-900">{fieldLabel}: {node.label}</span>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{formatMetric(node.rowCount)} registro(s)</span>
            </div>
          </div>

          {node.children.length > 0 ? (
            <div className="space-y-4">{renderConsecrationPreviewGroups(node.children)}</div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="report-table min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {consecrationReportBuilder.columns.map((column) => (
                        <th
                          key={column}
                          onClick={() => setConsecrationReportBuilder((prev) => ({ ...prev, sortBy: column, sortDirection: prev.sortBy === column ? (prev.sortDirection === 'asc' ? 'desc' : 'asc') : 'asc' }))}
                          className="no-print-sort whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 cursor-pointer select-none hover:bg-slate-100 group"
                        >
                          <span className="inline-flex items-center gap-1">
                            {getConsecrationReportColumnLabel(column, true)}
                            <span className="print:hidden text-slate-300 group-hover:text-slate-500 transition-colors">{consecrationReportBuilder.sortBy === column ? (consecrationReportBuilder.sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ⇅'}</span>
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {node.rows.map((row, index) => (
                      <tr key={row.id} style={consecrationReportBuilder.zebraEnabled && index % 2 === 1 ? { backgroundColor: consecrationReportBuilder.zebraColor } : undefined}>
                        {consecrationReportBuilder.columns.map((column) => (
                          <td key={`${row.id}-${column}`} className="whitespace-nowrap px-4 py-3 text-slate-700">
                            {getConsecrationPreviewColumnValue(row, column)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!node.children.length ? renderGroupSummaryCard(
            `${fieldLabel}: ${node.label}`,
            node.total,
            node.rowCount,
            nodeSummaryBlocks.map((block) => ({ id: `${node.id}-${block.column}`, label: block.label, items: block.items })),
            'text-sky-900 bg-sky-50',
          ) : null}
        </div>
      );
    });
  }

  function handleTransferReportTypeChange(reportType: TransferReportTypeKey) {
    const preset = TRANSFER_REPORT_PRESETS[reportType];
    setTransferReportBuilder((current) => ({
      ...current,
      reportType,
      groupBy: [...preset.groupBy],
      columns: preset.columns,
      sortBy: preset.sortBy,
      sortDirection: reportType === 'route_report' ? 'asc' : current.sortDirection,
    }));
  }

  function toggleTransferGroupField(field: TransferReportGroupKey) {
    setTransferReportBuilder((current) => {
      const exists = current.groupBy.includes(field);
      return {
        ...current,
        groupBy: exists ? current.groupBy.filter((item) => item !== field) : [...current.groupBy, field],
      };
    });
  }

  function removeTransferGroupField(field: TransferReportGroupKey) {
    setTransferReportBuilder((current) => ({
      ...current,
      groupBy: current.groupBy.filter((item) => item !== field),
    }));
  }

  function moveTransferGroupField(field: TransferReportGroupKey, direction: 'up' | 'down') {
    setTransferReportBuilder((current) => ({
      ...current,
      groupBy: moveOrderedItem(current.groupBy, field, direction),
    }));
  }

  function toggleTransferReportColumn(column: TransferReportColumnKey) {
    setTransferReportBuilder((current) => {
      const exists = current.columns.includes(column);
      if (exists && current.columns.length === 1) return current;
      const nextColumns = exists ? current.columns.filter((item) => item !== column) : [...current.columns, column];
      const nextSortBy = nextColumns.includes(current.sortBy) ? current.sortBy : nextColumns[0];
      return {
        ...current,
        columns: nextColumns,
        sortBy: nextSortBy,
      };
    });
  }

  function moveTransferReportColumn(column: TransferReportColumnKey, direction: 'up' | 'down') {
    setTransferReportBuilder((current) => ({
      ...current,
      columns: moveOrderedItem(current.columns, column, direction),
    }));
  }

  function buildExcelRowsFromTransferGroups(nodes: TransferPreviewGroupNode[], rows: Array<Array<string | number>>, depth = 0) {
    nodes.forEach((node) => {
      const prefix = `${'  '.repeat(depth)}${getTransferGroupLabel(node.field)}: ${node.label}`;
      rows.push([prefix, `${node.rowCount} registro(s)`]);

      if (node.children.length > 0) {
        buildExcelRowsFromTransferGroups(node.children, rows, depth + 1);
      } else {
        rows.push(transferReportBuilder.columns.map((column) => getTransferReportColumnLabel(column)));
        node.rows.forEach((row) => {
          rows.push(transferReportBuilder.columns.map((column) => getTransferPreviewColumnValue(row, column)));
        });
      }

      rows.push(['Resumo do grupo']);
      rows.push(['Total', node.total]);
      rows.push(['Registros', node.rowCount]);

      const hiddenSummaryColumns = transferReportBuilder.groupBy
        .map((group) => getTransferGroupedColumnKey(group))
        .filter((column): column is TransferReportColumnKey => Boolean(column));
      const nodeSummaryBlocks = buildTransferColumnSummaries(node.rows, transferReportBuilder.columns, hiddenSummaryColumns);
      nodeSummaryBlocks.forEach((block) => {
        block.items.forEach((item) => {
          rows.push([block.label, item.label, item.count]);
        });
      });

      rows.push([]);
    });
  }

  function handleExportTransferReportExcel() {
    const rows: Array<Array<string | number>> = [];

    rows.push(['Relatório avançado de transferências']);
    rows.push(['Origem', transferSelectedOriginChurchNames]);
    rows.push(['Destino', transferSelectedDestinationChurchNames]);
    rows.push(['Dirigente', `Impressão geral por - ${String(printResponsible).toUpperCase()}`]);
    rows.push(['Período', transferPrintPeriod]);
    rows.push(['Data de impressão', printDate]);
    rows.push([]);

    if (transferReportBuilder.groupBy.length > 0) {
      buildExcelRowsFromTransferGroups(transferPreviewGroups, rows);
    } else {
      rows.push(transferReportBuilder.columns.map((column) => getTransferReportColumnLabel(column)));
      transferFilteredRows.forEach((row) => {
        rows.push(transferReportBuilder.columns.map((column) => getTransferPreviewColumnValue(row, column)));
      });
      rows.push([]);
    }

    rows.push(['Tabela final de totais']);
    rows.push(['Total de registros', transferReportSummary.totalRows]);
    rows.push(['Total da métrica', transferReportSummary.metricTotal]);
    transferFinalSummaryBlocks.forEach((block) => {
      block.items.forEach((item) => {
        rows.push([block.label, item.label, item.count]);
      });
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = Array.from({ length: Math.max(transferReportBuilder.columns.length, 6) }, () => ({ wch: 24 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório de transferências');
    XLSX.writeFile(workbook, `relatorio-transferencias-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function handleExportTransferReportPdf() {
    const previewRoot = document.getElementById('transfer-report-preview-root');
    if (!previewRoot) return;
    const inheritedStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((node) => node.outerHTML)
      .join('');
    const printFrame = document.createElement('iframe');
    printFrame.setAttribute('aria-hidden', 'true');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const frameWindow = printFrame.contentWindow;
    if (!frameWindow) {
      printFrame.remove();
      return;
    }

    frameWindow.document.write(`
      <html>
        <head>
          <title>Relatório de transferências</title>
          ${inheritedStyles}
          <style>
            body { font-family: Arial, sans-serif; margin: 14px; color: #111111; line-height: 1.2; font-size: 10px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .print-shell { width: 100%; }
            body * { color: #111111 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .print-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 12px; border-bottom: 0.5px solid #cfd6df; padding-bottom: 8px; }
            .print-title { font-size: 12px; font-weight: 700; margin: 0 0 6px 0; text-transform: uppercase; }
            .print-brand { font-size: 10px; font-weight: 700; text-transform: uppercase; white-space: nowrap; }
            .print-meta { font-size: 10px; margin-top: 2px; }
            .report-group { margin-bottom: 8px; }
            .report-group-title { font-size: 10px; font-weight: 700; margin-bottom: 4px; padding: 5px 8px !important; border: 0.35px solid #dde3ea !important; background: #f3f4f6 !important; }
            .report-table { width: 100%; border-collapse: collapse; border-spacing: 0 !important; margin-top: 4px; }
            .report-table th, .report-table td { border: 0.35px solid #e1e6ed !important; padding: 2px 4px !important; font-size: 10px !important; text-align: left; vertical-align: top; }
            .report-table th { background: #f1f3f5 !important; font-weight: 700; }
            @page { size: A4 ${transferReportBuilder.orientation === 'landscape' ? 'landscape' : 'portrait'}; margin: 10mm; }
          </style>
        </head>
        <body>
          <div class="print-shell ${transferReportBuilder.orientation === 'landscape' ? 'landscape' : 'portrait'}">
            <div class="print-header">
              <div>
                <p class="print-title">Relatório avançado de transferências</p>
                <p class="print-meta"><strong>Origem:</strong> ${transferSelectedOriginChurchNames}</p>
                <p class="print-meta"><strong>Destino:</strong> ${transferSelectedDestinationChurchNames}</p>
                <p class="print-meta"><strong>Dirigente:</strong> Impressão geral por - ${String(printResponsible).toUpperCase()}</p>
                <p class="print-meta"><strong>Período:</strong> ${transferPrintPeriod}</p>
                <p class="print-meta"><strong>Data de impressão:</strong> ${printDate}</p>
              </div>
              <div class="print-brand">SISTEMA MRM</div>
            </div>
            ${previewRoot.innerHTML}
          </div>
        </body>
      </html>
    `);
    frameWindow.document.close();

    const cleanup = () => {
      window.removeEventListener('focus', cleanup);
      if (document.body.contains(printFrame)) {
        printFrame.remove();
      }
    };

    window.addEventListener('focus', cleanup, { once: true });
    frameWindow.focus();
    frameWindow.print();
  }

  function renderTransferPreviewGroups(nodes: TransferPreviewGroupNode[]) {
    return nodes.map((node) => {
      const fieldLabel = TRANSFER_REPORT_GROUP_OPTIONS.find((option) => option.value === node.field)?.label.toUpperCase() || 'GRUPO';
      const hiddenSummaryColumns = transferReportBuilder.groupBy
        .map((group) => getTransferGroupedColumnKey(group))
        .filter((column): column is TransferReportColumnKey => Boolean(column));
      const nodeSummaryBlocks = buildTransferColumnSummaries(node.rows, transferReportBuilder.columns, hiddenSummaryColumns);

      return (
        <div key={node.id} className="report-group space-y-3">
          <div className="report-group-title rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-black tracking-[0.08em] text-slate-900">{fieldLabel}: {node.label}</span>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{formatMetric(node.rowCount)} registro(s)</span>
            </div>
          </div>

          {node.children.length > 0 ? (
            <div className="space-y-4">{renderTransferPreviewGroups(node.children)}</div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="report-table min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {transferReportBuilder.columns.map((column) => (
                        <th
                          key={column}
                          onClick={() => setTransferReportBuilder((prev) => ({ ...prev, sortBy: column, sortDirection: prev.sortBy === column ? (prev.sortDirection === 'asc' ? 'desc' : 'asc') : 'asc' }))}
                          className="no-print-sort whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 cursor-pointer select-none hover:bg-slate-100 group"
                        >
                          <span className="inline-flex items-center gap-1">
                            {getTransferReportColumnLabel(column, true)}
                            <span className="print:hidden text-slate-300 group-hover:text-slate-500 transition-colors">{transferReportBuilder.sortBy === column ? (transferReportBuilder.sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ⇅'}</span>
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {node.rows.map((row, index) => (
                      <tr key={row.id} style={transferReportBuilder.zebraEnabled && index % 2 === 1 ? { backgroundColor: transferReportBuilder.zebraColor } : undefined}>
                        {transferReportBuilder.columns.map((column) => (
                          <td key={`${row.id}-${column}`} className="whitespace-nowrap px-4 py-3 text-slate-700">
                            {getTransferPreviewColumnValue(row, column)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!node.children.length ? renderGroupSummaryCard(
            `${fieldLabel}: ${node.label}`,
            node.total,
            node.rowCount,
            nodeSummaryBlocks.map((block) => ({ id: `${node.id}-${block.column}`, label: block.label, items: block.items })),
            'text-emerald-900 bg-emerald-50',
          ) : null}
        </div>
      );
    });
  }

  function toggleMemberGroupField(field: MemberReportGroupKey) {
    setMemberReportBuilder((current) => {
      const exists = current.groupBy.includes(field);
      return {
        ...current,
        groupBy: exists ? current.groupBy.filter((item) => item !== field) : [...current.groupBy, field],
      };
    });
  }

  function removeMemberGroupField(field: MemberReportGroupKey) {
    setMemberReportBuilder((current) => ({
      ...current,
      groupBy: current.groupBy.filter((item) => item !== field),
    }));
  }

  function moveMemberGroupField(field: MemberReportGroupKey, direction: 'up' | 'down') {
    setMemberReportBuilder((current) => {
      const currentIndex = current.groupBy.indexOf(field);
      if (currentIndex === -1) return current;
      const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (nextIndex < 0 || nextIndex >= current.groupBy.length) return current;
      const nextGroupBy = [...current.groupBy];
      [nextGroupBy[currentIndex], nextGroupBy[nextIndex]] = [nextGroupBy[nextIndex], nextGroupBy[currentIndex]];
      return { ...current, groupBy: nextGroupBy };
    });
  }

  function toggleMemberReportColumn(column: MemberReportColumnKey) {
    setMemberReportBuilder((current) => {
      const exists = current.columns.includes(column);
      if (exists && current.columns.length === 1) return current;
      const nextColumns = exists ? current.columns.filter((item) => item !== column) : [...current.columns, column];
      const nextSortBy = nextColumns.includes(current.sortBy) ? current.sortBy : nextColumns[0];
      return {
        ...current,
        columns: nextColumns,
        sortBy: nextSortBy,
      };
    });
  }

  function moveMemberReportColumn(column: MemberReportColumnKey, direction: 'up' | 'down') {
    setMemberReportBuilder((current) => ({
      ...current,
      columns: moveOrderedItem(current.columns, column, direction),
    }));
  }

  function handleStartNewMemberReportTemplate() {
    setActiveMemberReportTemplateId(null);
    setMemberReportTemplateName('');
  }

  function handleStartNewBaptismReportTemplate() {
    setActiveBaptismReportTemplateId(null);
    setBaptismReportTemplateName('');
  }

  function handleStartNewConsecrationReportTemplate() {
    setActiveConsecrationReportTemplateId(null);
    setConsecrationReportTemplateName('');
  }

  function handleStartNewTransferReportTemplate() {
    setActiveTransferReportTemplateId(null);
    setTransferReportTemplateName('');
  }

  function handleStartNewChurchReportTemplate() {
    setActiveChurchReportTemplateId(null);
    setChurchReportTemplateName('');
  }

  function handleLoadMemberReportTemplate(template: SavedMemberReportTemplate) {
    setActiveMemberReportTemplateId(template.id);
    setMemberReportTemplateName(template.name);
    setMemberReportBuilder(cloneMemberReportBuilderState(template.builder));
  }

  function handleLoadBaptismReportTemplate(template: SavedBaptismReportTemplate) {
    setActiveBaptismReportTemplateId(template.id);
    setBaptismReportTemplateName(template.name);
    setBaptismReportBuilder(cloneBaptismReportBuilderState(template.builder));
  }

  function handleLoadConsecrationReportTemplate(template: SavedConsecrationReportTemplate) {
    setActiveConsecrationReportTemplateId(template.id);
    setConsecrationReportTemplateName(template.name);
    setConsecrationReportBuilder(cloneConsecrationReportBuilderState(template.builder));
  }

  function handleLoadTransferReportTemplate(template: SavedTransferReportTemplate) {
    setActiveTransferReportTemplateId(template.id);
    setTransferReportTemplateName(template.name);
    setTransferReportBuilder(cloneTransferReportBuilderState(template.builder));
  }

  function handleLoadChurchReportTemplate(template: SavedChurchReportTemplate) {
    setActiveChurchReportTemplateId(template.id);
    setChurchReportTemplateName(template.name);
    setChurchReportBuilder(cloneChurchReportBuilderState(template.builder));
  }

  function handleSaveMemberReportTemplate() {
    const trimmedName = memberReportTemplateName.trim();
    if (!trimmedName) {
      setMemberReportNameDialogOpen(true);
      return;
    }

    const now = new Date().toISOString();

    if (activeMemberReportTemplateId) {
      setMemberReportTemplates((current) => current
        .map((template) => (
          template.id === activeMemberReportTemplateId
            ? {
                ...template,
                name: trimmedName,
                builder: cloneMemberReportBuilderState(memberReportBuilder),
                updatedAt: now,
              }
            : template
        ))
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()));
      return;
    }

    const nextTemplate: SavedMemberReportTemplate = {
      id: makeId('member-report-template'),
      name: trimmedName,
      builder: cloneMemberReportBuilderState(memberReportBuilder),
      createdAt: now,
      updatedAt: now,
    };

    setMemberReportTemplates((current) => [nextTemplate, ...current]);
    setActiveMemberReportTemplateId(nextTemplate.id);
  }

  function handleSaveBaptismReportTemplate() {
    const trimmedName = baptismReportTemplateName.trim();
    if (!trimmedName) {
      setBaptismReportNameDialogOpen(true);
      return;
    }

    const now = new Date().toISOString();

    if (activeBaptismReportTemplateId) {
      setBaptismReportTemplates((current) => current
        .map((template) => (
          template.id === activeBaptismReportTemplateId
            ? {
                ...template,
                name: trimmedName,
                builder: cloneBaptismReportBuilderState(baptismReportBuilder),
                updatedAt: now,
              }
            : template
        ))
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()));
      return;
    }

    const nextTemplate: SavedBaptismReportTemplate = {
      id: makeId('baptism-report-template'),
      name: trimmedName,
      builder: cloneBaptismReportBuilderState(baptismReportBuilder),
      createdAt: now,
      updatedAt: now,
    };

    setBaptismReportTemplates((current) => [nextTemplate, ...current]);
    setActiveBaptismReportTemplateId(nextTemplate.id);
  }

  function handleSaveConsecrationReportTemplate() {
    const trimmedName = consecrationReportTemplateName.trim();
    if (!trimmedName) {
      setConsecrationReportNameDialogOpen(true);
      return;
    }

    const now = new Date().toISOString();

    if (activeConsecrationReportTemplateId) {
      setConsecrationReportTemplates((current) => current
        .map((template) => (
          template.id === activeConsecrationReportTemplateId
            ? {
                ...template,
                name: trimmedName,
                builder: cloneConsecrationReportBuilderState(consecrationReportBuilder),
                updatedAt: now,
              }
            : template
        ))
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()));
      return;
    }

    const nextTemplate: SavedConsecrationReportTemplate = {
      id: makeId('consecration-report-template'),
      name: trimmedName,
      builder: cloneConsecrationReportBuilderState(consecrationReportBuilder),
      createdAt: now,
      updatedAt: now,
    };

    setConsecrationReportTemplates((current) => [nextTemplate, ...current]);
    setActiveConsecrationReportTemplateId(nextTemplate.id);
  }

  function handleSaveTransferReportTemplate() {
    const trimmedName = transferReportTemplateName.trim();
    if (!trimmedName) {
      setTransferReportNameDialogOpen(true);
      return;
    }

    const now = new Date().toISOString();

    if (activeTransferReportTemplateId) {
      setTransferReportTemplates((current) => current
        .map((template) => (
          template.id === activeTransferReportTemplateId
            ? {
                ...template,
                name: trimmedName,
                builder: cloneTransferReportBuilderState(transferReportBuilder),
                updatedAt: now,
              }
            : template
        ))
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()));
      return;
    }

    const nextTemplate: SavedTransferReportTemplate = {
      id: makeId('transfer-report-template'),
      name: trimmedName,
      builder: cloneTransferReportBuilderState(transferReportBuilder),
      createdAt: now,
      updatedAt: now,
    };

    setTransferReportTemplates((current) => [nextTemplate, ...current]);
    setActiveTransferReportTemplateId(nextTemplate.id);
  }

  function handleSaveChurchReportTemplate() {
    const trimmedName = churchReportTemplateName.trim();
    if (!trimmedName) {
      setChurchReportNameDialogOpen(true);
      return;
    }

    const now = new Date().toISOString();

    if (activeChurchReportTemplateId) {
      setChurchReportTemplates((current) => current
        .map((template) => (
          template.id === activeChurchReportTemplateId
            ? {
                ...template,
                name: trimmedName,
                builder: cloneChurchReportBuilderState(churchReportBuilder),
                updatedAt: now,
              }
            : template
        ))
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()));
      return;
    }

    const nextTemplate: SavedChurchReportTemplate = {
      id: makeId('church-report-template'),
      name: trimmedName,
      builder: cloneChurchReportBuilderState(churchReportBuilder),
      createdAt: now,
      updatedAt: now,
    };

    setChurchReportTemplates((current) => [nextTemplate, ...current]);
    setActiveChurchReportTemplateId(nextTemplate.id);
  }

  function handleDeleteMemberReportTemplate(templateId: string) {
    const template = memberReportTemplates.find((item) => item.id === templateId);
    if (!template) return;
    if (!window.confirm(`Excluir o modelo "${template.name}"?`)) return;

    setMemberReportTemplates((current) => current.filter((item) => item.id !== templateId));
    if (activeMemberReportTemplateId === templateId) {
      setActiveMemberReportTemplateId(null);
      setMemberReportTemplateName('');
    }
  }

  function handleDeleteBaptismReportTemplate(templateId: string) {
    const template = baptismReportTemplates.find((item) => item.id === templateId);
    if (!template) return;
    if (!window.confirm(`Excluir o modelo "${template.name}"?`)) return;

    setBaptismReportTemplates((current) => current.filter((item) => item.id !== templateId));
    if (activeBaptismReportTemplateId === templateId) {
      setActiveBaptismReportTemplateId(null);
      setBaptismReportTemplateName('');
    }
  }

  function handleDeleteConsecrationReportTemplate(templateId: string) {
    const template = consecrationReportTemplates.find((item) => item.id === templateId);
    if (!template) return;
    if (!window.confirm(`Excluir o modelo "${template.name}"?`)) return;

    setConsecrationReportTemplates((current) => current.filter((item) => item.id !== templateId));
    if (activeConsecrationReportTemplateId === templateId) {
      setActiveConsecrationReportTemplateId(null);
      setConsecrationReportTemplateName('');
    }
  }

  function handleDeleteTransferReportTemplate(templateId: string) {
    const template = transferReportTemplates.find((item) => item.id === templateId);
    if (!template) return;
    if (!window.confirm(`Excluir o modelo "${template.name}"?`)) return;

    setTransferReportTemplates((current) => current.filter((item) => item.id !== templateId));
    if (activeTransferReportTemplateId === templateId) {
      setActiveTransferReportTemplateId(null);
      setTransferReportTemplateName('');
    }
  }

  function handleDeleteChurchReportTemplate(templateId: string) {
    const template = churchReportTemplates.find((item) => item.id === templateId);
    if (!template) return;
    if (!window.confirm(`Excluir o modelo "${template.name}"?`)) return;

    setChurchReportTemplates((current) => current.filter((item) => item.id !== templateId));
    if (activeChurchReportTemplateId === templateId) {
      setActiveChurchReportTemplateId(null);
      setChurchReportTemplateName('');
    }
  }

  function handleDuplicateMemberReportTemplate(template?: SavedMemberReportTemplate) {
    const sourceName = template?.name || memberReportTemplateName.trim() || activeMemberReportTemplate?.name || 'Modelo sem nome';
    const sourceBuilder = template?.builder || memberReportBuilder;
    const now = new Date().toISOString();
    const nextTemplate: SavedMemberReportTemplate = {
      id: makeId('member-report-template'),
      name: `${sourceName} - cópia`,
      builder: cloneMemberReportBuilderState(sourceBuilder),
      createdAt: now,
      updatedAt: now,
    };

    setMemberReportTemplates((current) => [nextTemplate, ...current]);
    setActiveMemberReportTemplateId(nextTemplate.id);
    setMemberReportTemplateName(nextTemplate.name);
    setMemberReportBuilder(cloneMemberReportBuilderState(nextTemplate.builder));
  }

  function handleDuplicateBaptismReportTemplate(template?: SavedBaptismReportTemplate) {
    const sourceName = template?.name || baptismReportTemplateName.trim() || activeBaptismReportTemplate?.name || 'Modelo sem nome';
    const sourceBuilder = template?.builder || baptismReportBuilder;
    const now = new Date().toISOString();
    const nextTemplate: SavedBaptismReportTemplate = {
      id: makeId('baptism-report-template'),
      name: `${sourceName} - cópia`,
      builder: cloneBaptismReportBuilderState(sourceBuilder),
      createdAt: now,
      updatedAt: now,
    };

    setBaptismReportTemplates((current) => [nextTemplate, ...current]);
    setActiveBaptismReportTemplateId(nextTemplate.id);
    setBaptismReportTemplateName(nextTemplate.name);
    setBaptismReportBuilder(cloneBaptismReportBuilderState(nextTemplate.builder));
  }

  function handleDuplicateConsecrationReportTemplate(template?: SavedConsecrationReportTemplate) {
    const sourceName = template?.name || consecrationReportTemplateName.trim() || activeConsecrationReportTemplate?.name || 'Modelo sem nome';
    const sourceBuilder = template?.builder || consecrationReportBuilder;
    const now = new Date().toISOString();
    const nextTemplate: SavedConsecrationReportTemplate = {
      id: makeId('consecration-report-template'),
      name: `${sourceName} - cópia`,
      builder: cloneConsecrationReportBuilderState(sourceBuilder),
      createdAt: now,
      updatedAt: now,
    };

    setConsecrationReportTemplates((current) => [nextTemplate, ...current]);
    setActiveConsecrationReportTemplateId(nextTemplate.id);
    setConsecrationReportTemplateName(nextTemplate.name);
    setConsecrationReportBuilder(cloneConsecrationReportBuilderState(nextTemplate.builder));
  }

  function handleDuplicateTransferReportTemplate(template?: SavedTransferReportTemplate) {
    const sourceName = template?.name || transferReportTemplateName.trim() || activeTransferReportTemplate?.name || 'Modelo sem nome';
    const sourceBuilder = template?.builder || transferReportBuilder;
    const now = new Date().toISOString();
    const nextTemplate: SavedTransferReportTemplate = {
      id: makeId('transfer-report-template'),
      name: `${sourceName} - cópia`,
      builder: cloneTransferReportBuilderState(sourceBuilder),
      createdAt: now,
      updatedAt: now,
    };

    setTransferReportTemplates((current) => [nextTemplate, ...current]);
    setActiveTransferReportTemplateId(nextTemplate.id);
    setTransferReportTemplateName(nextTemplate.name);
    setTransferReportBuilder(cloneTransferReportBuilderState(nextTemplate.builder));
  }

  function handleDuplicateChurchReportTemplate(template?: SavedChurchReportTemplate) {
    const sourceName = template?.name || churchReportTemplateName.trim() || activeChurchReportTemplate?.name || 'Modelo sem nome';
    const sourceBuilder = template?.builder || churchReportBuilder;
    const now = new Date().toISOString();
    const nextTemplate: SavedChurchReportTemplate = {
      id: makeId('church-report-template'),
      name: `${sourceName} - copia`,
      builder: cloneChurchReportBuilderState(sourceBuilder),
      createdAt: now,
      updatedAt: now,
    };

    setChurchReportTemplates((current) => [nextTemplate, ...current]);
    setActiveChurchReportTemplateId(nextTemplate.id);
    setChurchReportTemplateName(nextTemplate.name);
    setChurchReportBuilder(cloneChurchReportBuilderState(nextTemplate.builder));
  }

  function handleExportMemberReportPdf() {
    const previewRoot = document.getElementById('member-report-preview-root');
    if (!previewRoot) return;
    const inheritedStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((node) => node.outerHTML)
      .join('');
    const printFrame = document.createElement('iframe');
    printFrame.setAttribute('aria-hidden', 'true');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const frameWindow = printFrame.contentWindow;
    if (!frameWindow) {
      printFrame.remove();
      return;
    }

    frameWindow.document.write(`
      <html>
        <head>
          <title>Relatório de membros</title>
          ${inheritedStyles}
          <style>
            body { font-family: Arial, sans-serif; margin: 14px; color: #111111; line-height: 1.2; font-size: 10px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .print-shell { width: 100%; }
            body * { color: #111111 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            p, h1, h2, h3, h4 { margin: 0; }
            .print-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 12px; border-bottom: 0.5px solid #cfd6df; padding-bottom: 8px; }
            .print-title { font-size: 12px; font-weight: 700; margin: 0 0 6px 0; text-transform: uppercase; }
            .print-brand { font-size: 10px; font-weight: 700; text-transform: uppercase; white-space: nowrap; }
            .print-meta { font-size: 10px; margin-top: 2px; }
            .print-meta strong { font-weight: 700; }
            .report-group { margin-bottom: 8px; break-inside: auto !important; page-break-inside: auto !important; }
            .report-group-title { font-size: 10px; font-weight: 700; letter-spacing: 0; margin-bottom: 4px; padding: 5px 8px !important; border: 0.35px solid #dde3ea !important; background: #f3f4f6 !important; }
            .report-table { width: 100%; border-collapse: collapse; border-spacing: 0 !important; margin-top: 4px; }
            .report-table th, .report-table td { border: 0.35px solid #e1e6ed !important; padding: 2px 4px !important; font-size: 10px !important; text-align: left; vertical-align: top; }
            .report-table th { background: #f1f3f5 !important; font-weight: 700; }
            .report-group-title, .report-table th { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .report-total { margin-top: 6px; font-size: 10px; font-weight: 700; }
            .report-grand-total { margin-top: 10px; border-top: 0.5px solid #cfd6df; padding-top: 6px; font-size: 10px; font-weight: 700; }
            .rounded-2xl, .rounded-3xl { border-radius: 0 !important; }
            .shadow-sm, .shadow-lg, .shadow-[0_18px_40px_rgba(14,116,144,0.08)] { box-shadow: none !important; }
            .bg-sky-50, .bg-white { background: #ffffff !important; }
            .bg-slate-100 { background: #f8fafc !important; }
            .border, .border-slate-200, .border-sky-200 { border-color: #e1e6ed !important; }
            .text-sky-900, .text-slate-900, .text-slate-700, .text-slate-600, .text-slate-500 { color: #111111 !important; }
            .text-xs { font-size: 10px !important; }
            .text-sm { font-size: 10px !important; }
            .text-2xl, .text-lg { font-size: 12px !important; }
            .px-4 { padding-left: 0 !important; padding-right: 0 !important; }
            .py-3, .py-2, .py-1 { padding-top: 0 !important; padding-bottom: 0 !important; }
            .report-group-title.bg-slate-50 { background: #f3f4f6 !important; }
            .report-group-title.px-4 { padding-left: 8px !important; padding-right: 8px !important; }
            .report-group-title.py-3 { padding-top: 5px !important; padding-bottom: 5px !important; }
            .mt-2, .mt-3, .mt-4, .mt-5 { margin-top: 4px !important; }
            .space-y-2 > * + *, .space-y-3 > * + *, .space-y-4 > * + * { margin-top: 4px !important; }
            .flex, .inline-flex, .grid { display: block !important; }
            .flex-1 { flex: none !important; }
            .min-h-0 { min-height: auto !important; }
            .overflow-auto, .overflow-hidden, .overflow-x-auto, .overflow-y-auto { overflow: visible !important; }
            .sticky, .top-0 { position: static !important; top: auto !important; }
            .divide-y > * + * { border-top: 0 !important; }
            .divide-slate-100, .divide-slate-200 { border-color: transparent !important; }
            .border-b { border-bottom: 0 !important; }
            .rounded-2xl.bg-sky-50, .rounded-2xl.bg-slate-100 { border: 0.35px solid #e1e6ed !important; }
            .report-group > .space-y-4 { margin-top: 4px !important; }
            .report-group > .space-y-4:empty, .space-y-2:empty, .space-y-3:empty, .space-y-4:empty { display: none !important; }
            @page { size: A4 ${memberReportBuilder.orientation === 'landscape' ? 'landscape' : 'portrait'}; margin: 10mm; }
          </style>
        </head>
        <body>
          <div class="print-shell ${memberReportBuilder.orientation === 'landscape' ? 'landscape' : 'portrait'}">
            <div class="print-header">
              <div>
                <p class="print-title">Relatório de relatório avançado de membros</p>
                <p class="print-meta"><strong>Igreja:</strong> ${selectedChurchNames}</p>
                <p class="print-meta"><strong>Dirigente:</strong> Impressão geral por - ${String(printResponsible).toUpperCase()}</p>
                <p class="print-meta"><strong>Período:</strong> ${printPeriod}</p>
                <p class="print-meta"><strong>Data de impressão:</strong> ${printDate}</p>
              </div>
              <div class="print-brand">SISTEMA MRM</div>
            </div>
            ${previewRoot.innerHTML}
          </div>
        </body>
      </html>
    `);
    frameWindow.document.close();

    const cleanup = () => {
      window.removeEventListener('focus', cleanup);
      if (document.body.contains(printFrame)) {
        printFrame.remove();
      }
    };

    window.addEventListener('focus', cleanup, { once: true });
    frameWindow.focus();
    frameWindow.print();
  }

  function renderMemberPreviewGroups(nodes: MemberPreviewGroupNode[], depth = 0) {
    return nodes.map((node) => {
      const fieldLabel = MEMBER_REPORT_GROUP_OPTIONS.find((option) => option.value === node.field)?.label.toUpperCase() || 'GRUPO';
      const firstRow = node.rows[0];
      const hiddenSummaryColumns = memberReportBuilder.groupBy
        .map((group) => getGroupedColumnKey(group))
        .filter((column): column is MemberReportColumnKey => Boolean(column));
      const nodeSummaryBlocks = buildMemberColumnSummaries(node.rows, memberReportBuilder.columns, hiddenSummaryColumns);

      return (
        <div key={node.id} className="report-group space-y-3">
          <div className="report-group-title rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-black tracking-[0.08em] text-slate-900">{fieldLabel}: {node.label}</span>
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{formatMetric(node.rowCount)} registro(s)</span>
            </div>
            {node.field === 'church' && firstRow ? (
              <div className="mt-2 text-xs text-slate-600">Endereço: {firstRow.church_address}</div>
            ) : null}
          </div>

          {node.children.length > 0 ? (
            <div className="space-y-4">{renderMemberPreviewGroups(node.children, depth + 1)}</div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="report-table min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {memberReportBuilder.columns.map((column) => (
                        <th
                          key={column}
                          onClick={() => setMemberReportBuilder((prev) => ({ ...prev, sortBy: column, sortDirection: prev.sortBy === column ? (prev.sortDirection === 'asc' ? 'desc' : 'asc') : 'asc' }))}
                          className="no-print-sort whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 cursor-pointer select-none hover:bg-slate-100 group"
                        >
                          <span className="inline-flex items-center gap-1">
                            {getMemberReportColumnLabel(column, true)}
                            <span className="print:hidden text-slate-300 group-hover:text-slate-500 transition-colors">{memberReportBuilder.sortBy === column ? (memberReportBuilder.sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ⇅'}</span>
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {node.rows.map((row, index) => (
                      <tr key={row.id} style={memberReportBuilder.zebraEnabled && index % 2 === 1 ? { backgroundColor: memberReportBuilder.zebraColor } : undefined}>
                        {memberReportBuilder.columns.map((column) => (
                          <td key={`${row.id}-${column}`} className="whitespace-nowrap px-4 py-3 text-slate-700">
                            {getMemberPreviewColumnValue(row, column)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!node.children.length ? renderGroupSummaryCard(
            `${fieldLabel}: ${node.label}`,
            node.total,
            node.rowCount,
            nodeSummaryBlocks.map((block) => ({ id: `${node.id}-${block.column}`, label: block.label, items: block.items })),
            'text-orange-900 bg-orange-50',
          ) : null}
        </div>
      );
    });
  }

  function toggleChurchReportGroup(group: ChurchReportGroupKey) {
    setChurchReportBuilder((current) => ({
      ...current,
      groupBy: current.groupBy.includes(group)
        ? current.groupBy.filter((item) => item !== group)
        : [...current.groupBy, group],
    }));
  }

  function toggleChurchReportSection(section: ChurchReportSectionKey) {
    setChurchReportBuilder((current) => ({
      ...current,
      sections: current.sections.includes(section)
        ? current.sections.filter((item) => item !== section)
        : [...current.sections, section],
    }));
  }

  function moveChurchReportColumn(column: ChurchReportColumnKey, direction: 'up' | 'down') {
    setChurchReportBuilder((current) => ({
      ...current,
      columns: moveOrderedItem(current.columns, column, direction),
    }));
  }

  function toggleChurchReportColumn(column: ChurchReportColumnKey) {
    setChurchReportBuilder((current) => {
      const exists = current.columns.includes(column);
      if (exists && current.columns.length === 1) return current;
      const nextColumns = exists ? current.columns.filter((item) => item !== column) : [...current.columns, column];
      const nextSortBy = nextColumns.includes(current.sortBy) ? current.sortBy : nextColumns[0];
      return {
        ...current,
        columns: nextColumns,
        sortBy: nextSortBy,
      };
    });
  }

  function getChurchReportColumnLabel(column: ChurchReportColumnKey) {
    return CHURCH_REPORT_COLUMN_OPTIONS.find((option) => option.value === column)?.label || column;
  }

  function getChurchReportColumnValue(row: ChurchReportSummaryRow, column: ChurchReportColumnKey) {
    return row[column];
  }

  function buildChurchEvolutionOption() {
    const categories = churchMembersEvolution.map((item) => item.month);
    return {
      tooltip: { trigger: 'axis' },
      legend: { top: 0, data: ['Novos membros', 'Base acumulada'] },
      grid: { left: 36, right: 18, top: 40, bottom: 28 },
      xAxis: { type: 'category', data: categories },
      yAxis: { type: 'value' },
      series: [
        {
          name: 'Novos membros',
          type: 'line',
          smooth: true,
          data: churchMembersEvolution.map((item) => item.newMembers),
        },
        {
          name: 'Base acumulada',
          type: 'line',
          smooth: true,
          data: churchMembersEvolution.map((item) => item.totalMembers),
          areaStyle: { opacity: 0.12 },
        },
      ],
    };
  }

  function handleExportChurchReportExcel() {
    const rows: Array<Array<string | number>> = [];
    rows.push(['Relatório de igrejas']);
    rows.push(['Período', `${churchReportBuilder.dateFrom || '-'} até ${churchReportBuilder.dateTo || '-'}`]);
    rows.push([]);

    if (churchReportBuilder.mode === 'single' && churchActiveRow) {
      rows.push(['Igreja', churchActiveRow.church]);
      rows.push(['Regional', churchActiveRow.regional]);
      rows.push(['Campo', churchActiveRow.field]);
      rows.push(['Membros', churchActiveRow.totalMembers]);
      rows.push(['Pastores', churchActiveRow.pastors]);
      rows.push(['Diáconos', churchActiveRow.diaconos]);
      rows.push(['Membros sem título específico', churchActiveRow.membros]);
      rows.push(['Batismos no período', churchActiveRow.baptisms]);
      rows.push(['Consagrações no período', churchActiveRow.consecrations]);
      rows.push(['Novos membros no período', churchActiveRow.newMembers]);
    } else {
      rows.push(churchReportBuilder.columns.map((column) => getChurchReportColumnLabel(column)));
      churchReportListRows.forEach((row) => {
        rows.push(churchReportBuilder.columns.map((column) => String(getChurchReportColumnValue(row, column) ?? '-')));
      });

      rows.push([]);
      rows.push(['Totais gerais']);
      churchReportTotalMetricColumns.forEach((column) => {
        rows.push([getChurchReportColumnLabel(column), churchReportGrandTotals[column] || 0]);
      });

      if (churchReportGroupedTotals.length) {
        rows.push([]);
        rows.push(['Totais por agrupamento']);
        churchReportGroupedTotals.forEach((group) => {
          rows.push([group.label]);
          churchReportTotalMetricColumns.forEach((column) => {
            rows.push([`  ${getChurchReportColumnLabel(column)}`, group.totals[column] || 0]);
          });
        });
      }
    }

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    worksheet['!cols'] = Array.from({ length: Math.max(churchReportBuilder.columns.length, 8) }, () => ({ wch: 24 }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatório de igrejas');
    XLSX.writeFile(workbook, `relatorio-igrejas-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function handleExportChurchReportPdf() {
    const previewRoot = document.getElementById('church-report-preview-root');
    if (!previewRoot) return;

    const inheritedStyles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((node) => node.outerHTML)
      .join('');
    const printFrame = document.createElement('iframe');
    printFrame.setAttribute('aria-hidden', 'true');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const frameWindow = printFrame.contentWindow;
    if (!frameWindow) {
      printFrame.remove();
      return;
    }

    frameWindow.document.write(`
      <html>
        <head>
          <title>Relatório de igrejas</title>
          ${inheritedStyles}
          <style>
            body { font-family: Arial, sans-serif; margin: 14px; color: #111111; font-size: 11px; }
            .print-header { margin-bottom: 10px; border-bottom: 0.5px solid #d2d8e0; padding-bottom: 8px; }
            .print-title { font-size: 13px; font-weight: 700; text-transform: uppercase; margin: 0 0 4px 0; }
            .print-meta { margin: 2px 0; font-size: 10px; }
            .rounded-2xl, .rounded-3xl { border-radius: 0 !important; }
            .shadow-sm, .shadow-lg { box-shadow: none !important; }
            .church-evolution-screen { display: none !important; }
            .church-evolution-print-img { display: block !important; margin-top: 8px; width: 100%; }
            @page { size: A4 ${churchReportBuilder.orientation === 'landscape' ? 'landscape' : 'portrait'}; margin: 10mm; }
          </style>
        </head>
        <body>
          <div class="print-header">
            <p class="print-title">Relatório de igrejas</p>
            <p class="print-meta"><strong>Período:</strong> ${churchReportBuilder.dateFrom || '-'} até ${churchReportBuilder.dateTo || '-'}</p>
            <p class="print-meta"><strong>Data de impressão:</strong> ${printDate}</p>
          </div>
          ${previewRoot.innerHTML}
        </body>
      </html>
    `);
    frameWindow.document.close();

    const cleanup = () => {
      window.removeEventListener('focus', cleanup);
      if (document.body.contains(printFrame)) {
        printFrame.remove();
      }
    };

    window.addEventListener('focus', cleanup, { once: true });
    frameWindow.focus();
    frameWindow.print();
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-950/40">
            <BarChart3 className="h-6 w-6 text-indigo-600 dark:text-indigo-300" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Relatórios de Secretaria</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">Central exclusiva para membros, serviços e processos da secretaria.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {activeTab === 'dashboards' ? (
            <button
              type="button"
              onClick={() => void loadReportsData()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </button>
          ) : null}
          {activeTab === 'dashboards' && canManageDashboards ? (
            <button
              type="button"
              onClick={openNewChartModal}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" />
              Adicionar gráfico
            </button>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <ReportsTabButton
              active={activeTab === 'reports'}
              icon={<Printer className="h-4 w-4" />}
              label="Relatórios"
              onClick={() => setActiveTab('reports')}
            />
            <ReportsTabButton
              active={activeTab === 'dashboards'}
              icon={<BarChart3 className="h-4 w-4" />}
              label="Dashboards"
              onClick={() => setActiveTab('dashboards')}
            />
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200">
            <Eye className="h-3.5 w-3.5" />
            {scopeLabel}
          </div>
        </div>
      </div>

      {!canManageDashboards && activeTab === 'dashboards' ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Seu perfil pode visualizar os painéis, mas criar e editar dashboards é permitido apenas para campo, administrador e master.</span>
          </div>
        </div>
      ) : null}

      {loading && activeTab === 'dashboards' ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando dados da secretaria...
          </span>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      {activeTab === 'reports' ? (
        <div className="space-y-6">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {reportLauncherCards.map((card) => {
              const Icon = card.icon;

              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => setActiveReportModal(card.key)}
                  className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 text-left shadow-sm transition duration-200 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 ${card.ringClass}`}
                >
                  <div className={`h-full bg-gradient-to-br ${card.gradientClass} p-[1px]`}>
                    <div className="flex h-full min-h-[170px] flex-col rounded-[15px] bg-white p-5 dark:bg-slate-950">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{card.title}</h3>
                          <p className="mt-3 max-w-[24ch] text-sm leading-6 text-slate-600 dark:text-slate-300">{card.description}</p>
                        </div>
                        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${card.gradientClass} text-white shadow-lg shadow-slate-200/60`}>
                          <Icon className="h-7 w-7" />
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <Dialog open={Boolean(activeReportCard)} onOpenChange={(open) => { if (!open) setActiveReportModal(null); }}>
        {activeReportCard ? (
          <DialogContent className={isAdvancedReport ? 'flex h-[100dvh] w-screen max-w-none flex-col overflow-hidden border-0 bg-white p-0 sm:h-[96vh] sm:w-[calc(100vw-1.5rem)] sm:max-w-[calc(100vw-1.5rem)] sm:rounded-2xl sm:border sm:border-slate-200 2xl:w-[98vw] 2xl:max-w-[1900px]' : 'w-[calc(100%-1.5rem)] max-w-[680px] border border-slate-200 bg-white p-0 sm:max-w-[680px]'}>
            <div className={isAdvancedReport ? 'shrink-0 border-b border-slate-200 bg-white px-5 py-3' : `shrink-0 bg-gradient-to-br ${activeReportCard.gradientClass} px-6 py-5 text-white`}>
              <DialogHeader className="space-y-2 text-left">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${isAdvancedReport ? 'bg-sky-100 text-sky-700' : 'bg-white/15 text-white'}`}>
                      <activeReportCard.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <DialogTitle className={isAdvancedReport ? 'text-lg font-semibold tracking-tight text-slate-900' : 'text-2xl font-semibold tracking-tight text-white'}>
                        {isMembersReport ? 'Relatório de membros' : isChurchesReport ? 'Relatório de igrejas' : isBaptismReport ? 'Relatório de batismo' : isConsecrationReport ? 'Relatório de consagração' : isTransferReport ? 'Relatório de transferência' : isRequirementsReport ? 'Relatório de requerimentos' : isCredentialsReport ? 'Relatório de credenciais' : activeReportCard.title}
                      </DialogTitle>
                      <DialogDescription className={isAdvancedReport ? 'mt-1 text-sm text-slate-500' : 'max-w-3xl text-sm leading-6 text-white/85'}>
                        {isMembersReport ? 'Filtros inteligentes, agrupamentos múltiplos, impressão e exportação em Excel.' : isChurchesReport ? 'Builder de igrejas com histórico institucional, agrupamentos e evolução de membros.' : isBaptismReport ? 'Builder de batismo focado em cards, etapas do pipeline e campos básicos do membro.' : isConsecrationReport ? 'Builder de consagração com foco no pipeline e na progressão entre título atual e pretendido.' : isTransferReport ? 'Builder de transferência com origem, destino e etapa atual do fluxo.' : isRequirementsReport ? 'Lista de protocolos com filtros, seletor de colunas, modelos salvos e expansão de anexos/histórico.' : isCredentialsReport ? 'Lista de credenciais com dados do membro, foto, medidas da carteirinha e expansão por linha.' : activeReportCard.modalDescription}
                      </DialogDescription>
                    </div>
                  </div>
                  {isMembersReport ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExportMemberReportExcel}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        Exportar Excel
                      </button>
                      <button
                        type="button"
                        onClick={handleExportMemberReportPdf}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        <Printer className="h-4 w-4" />
                        Imprimir
                      </button>
                    </div>
                  ) : isChurchesReport ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExportChurchReportExcel}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        Exportar Excel
                      </button>
                      <button
                        type="button"
                        onClick={handleExportChurchReportPdf}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        <Printer className="h-4 w-4" />
                        Imprimir
                      </button>
                    </div>
                  ) : isBaptismReport ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExportBaptismReportExcel}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        Exportar Excel
                      </button>
                      <button
                        type="button"
                        onClick={handleExportBaptismReportPdf}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        <Printer className="h-4 w-4" />
                        Imprimir
                      </button>
                    </div>
                  ) : isConsecrationReport ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExportConsecrationReportExcel}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        Exportar Excel
                      </button>
                      <button
                        type="button"
                        onClick={handleExportConsecrationReportPdf}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        <Printer className="h-4 w-4" />
                        Imprimir
                      </button>
                    </div>
                  ) : isTransferReport ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExportTransferReportExcel}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        Exportar Excel
                      </button>
                      <button
                        type="button"
                        onClick={handleExportTransferReportPdf}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        <Printer className="h-4 w-4" />
                        Imprimir
                      </button>
                    </div>
                  ) : isRequirementsReport ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExportRequirementsReportExcel}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        Exportar Excel
                      </button>
                      <button
                        type="button"
                        onClick={handleExportRequirementsReportPdf}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        <Printer className="h-4 w-4" />
                        Imprimir
                      </button>
                    </div>
                  ) : isCredentialsReport ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleExportCredentialReportExcel}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                      >
                        <FileSpreadsheet className="h-4 w-4" />
                        Exportar Excel
                      </button>
                      <button
                        type="button"
                        onClick={handleExportCredentialReportPdf}
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                      >
                        <Printer className="h-4 w-4" />
                        Imprimir
                      </button>
                    </div>
                  ) : null}
                </div>
              </DialogHeader>
            </div>

            {isMembersReport ? (
              <div className="grid min-h-0 flex-1 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)_300px] 2xl:grid-cols-[400px_minmax(0,1fr)_340px]">
                <div className="min-h-0 overflow-y-auto border-r border-sky-200 bg-[linear-gradient(180deg,#eff6ff_0%,#f8fafc_22%,#ffffff_100%)]">
                  <div className="space-y-5 p-5">
                    <div className="rounded-3xl border border-sky-200 bg-white p-5 shadow-[0_18px_40px_rgba(14,116,144,0.08)]">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                          <ClipboardList className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tipo de relatório</p>
                          <p className="text-sm text-slate-600">Escolha a estrutura base e adapte o restante da configuração.</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2">
                        {MEMBER_REPORT_TYPE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleMemberReportTypeChange(option.value)}
                            className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${memberReportBuilder.reportType === option.value ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-sky-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                          <Filter className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Filtros</p>
                          <p className="text-sm text-slate-600">Marque um ou vários campos, regionais, igrejas e status.</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Período</span>
                            {(memberReportBuilder.dateFrom || memberReportBuilder.dateTo) ? (
                              <button
                                type="button"
                                onClick={() => setMemberReportBuilder((current) => ({ ...current, dateFrom: '', dateTo: '' }))}
                                className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700 transition hover:bg-sky-100"
                              >
                                Todos os períodos
                              </button>
                            ) : (
                              <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                                Todos os períodos ✓
                              </span>
                            )}
                          </div>
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
                            <label className="space-y-1.5 text-sm text-slate-700">
                              <span className="font-semibold text-slate-900">Data inicial</span>
                              <input type="date" value={memberReportBuilder.dateFrom} onChange={(event) => setMemberReportBuilder((current) => ({ ...current, dateFrom: event.target.value }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-sky-400" />
                            </label>
                            <label className="space-y-1.5 text-sm text-slate-700">
                              <span className="font-semibold text-slate-900">Data final</span>
                              <input type="date" value={memberReportBuilder.dateTo} onChange={(event) => setMemberReportBuilder((current) => ({ ...current, dateTo: event.target.value }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-sky-400" />
                            </label>
                          </div>
                        </div>
                        <MultiSelectDropdown
                          label="Campos"
                          emptyLabel="Todos os campos"
                          selectedValues={memberReportBuilder.fieldIds}
                          options={fields.map((field) => ({ value: field.id, label: field.name, disabled: hasFixedCampoScope }))}
                          disabled={hasFixedCampoScope}
                          onToggle={(fieldId, checked) => setMemberReportBuilder((current) => {
                            const nextFieldIds = checked ? Array.from(new Set([...current.fieldIds, fieldId])) : current.fieldIds.filter((item) => item !== fieldId);
                            return {
                              ...current,
                              fieldIds: nextFieldIds,
                              regionalIds: current.regionalIds.filter((regionalId) => {
                                const regional = regionais.find((item) => item.id === regionalId);
                                return regional ? nextFieldIds.includes(regional.campoId) : true;
                              }),
                              churchIds: [],
                            };
                          })}
                        />
                        <MultiSelectDropdown
                          label="Regionais"
                          emptyLabel="Todas as regionais"
                          selectedValues={memberReportBuilder.regionalIds}
                          options={memberReportRegionais.map((regional) => ({
                            value: regional.id,
                            label: regional.name,
                            disabled: hasFixedChurchScope && Boolean(storedUser.regionalId),
                          }))}
                          disabled={hasFixedChurchScope && Boolean(storedUser.regionalId)}
                          onToggle={(regionalId, checked) => setMemberReportBuilder((current) => ({
                            ...current,
                            regionalIds: checked ? Array.from(new Set([...current.regionalIds, regionalId])) : current.regionalIds.filter((item) => item !== regionalId),
                            churchIds: [],
                          }))}
                        />
                        <MultiSelectDropdown
                          label="Igrejas"
                          emptyLabel="Todas as igrejas"
                          selectedValues={memberReportBuilder.churchIds}
                          options={memberReportChurches.map((church) => ({
                            value: church.id,
                            label: church.name,
                            disabled: hasFixedChurchScope && Boolean(storedUser.churchId),
                          }))}
                          disabled={hasFixedChurchScope && Boolean(storedUser.churchId)}
                          onToggle={(churchId, checked) => setMemberReportBuilder((current) => ({
                            ...current,
                            churchIds: checked ? Array.from(new Set([...current.churchIds, churchId])) : current.churchIds.filter((item) => item !== churchId),
                          }))}
                        />
                        <MultiSelectDropdown
                          label="Status"
                          emptyLabel="Todos os status"
                          selectedValues={memberReportBuilder.statuses}
                          options={memberStatusOptions.map((status) => ({ value: status, label: status }))}
                          onToggle={(status, checked) => setMemberReportBuilder((current) => ({
                            ...current,
                            statuses: checked ? Array.from(new Set([...current.statuses, status])) : current.statuses.filter((item) => item !== status),
                          }))}
                        />
                        <MultiSelectDropdown
                          label="Tipo de membro"
                          emptyLabel="Todos os tipos"
                          selectedValues={memberReportBuilder.memberTypes}
                          options={[
                            { value: 'MEMBRO', label: 'Membro' },
                            { value: 'PF', label: 'PF – Pessoa Física' },
                            { value: 'PJ', label: 'PJ – Pessoa Jurídica' },
                          ]}
                          onToggle={(tipo, checked) => setMemberReportBuilder((current) => ({
                            ...current,
                            memberTypes: checked ? Array.from(new Set([...current.memberTypes, tipo])) : current.memberTypes.filter((item) => item !== tipo),
                          }))}
                        />
                      </div>
                    </div>

                    <div className="rounded-3xl border border-sky-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Agrupar por</p>
                          <p className="mt-1 text-sm text-slate-600">Combine quantos níveis quiser e reordene a hierarquia.</p>
                        </div>
                        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">{memberReportBuilder.groupBy.length} níveis</span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {MEMBER_REPORT_GROUP_OPTIONS.map((option) => {
                          const active = memberReportBuilder.groupBy.includes(option.value);
                          const currentIndex = memberReportBuilder.groupBy.indexOf(option.value);
                          return (
                            <div key={option.value} className={`rounded-2xl border px-3 py-3 ${active ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white'}`}>
                              <button type="button" onClick={() => toggleMemberGroupField(option.value)} className={`text-sm font-semibold ${active ? 'text-sky-700' : 'text-slate-700'}`}>
                                {active ? `${currentIndex + 1}. ${option.label}` : option.label}
                              </button>
                              {active ? (
                                <div className="mt-3 flex gap-2">
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      moveMemberGroupField(option.value, 'up');
                                    }}
                                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40"
                                    disabled={currentIndex === 0}
                                  >
                                    Subir
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      moveMemberGroupField(option.value, 'down');
                                    }}
                                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40"
                                    disabled={currentIndex === memberReportBuilder.groupBy.length - 1}
                                  >
                                    Descer
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      removeMemberGroupField(option.value);
                                    }}
                                    className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                                  >
                                    Remover
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-sky-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Colunas visíveis</p>
                          <p className="mt-1 text-sm text-slate-600">Escolha, ative ou mova as colunas para esquerda e direita.</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">{memberReportBuilder.columns.length} colunas</span>
                      </div>
                      <div className="mt-4 grid gap-2">
                        {MEMBER_REPORT_COLUMN_OPTIONS.map((option) => {
                          const active = memberReportBuilder.columns.includes(option.value);
                          const columnIndex = memberReportBuilder.columns.indexOf(option.value);
                          return (
                            <div key={option.value} className={`rounded-2xl border px-4 py-3 text-sm ${active ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-700'}`}>
                              <div className="flex items-center justify-between gap-3">
                                <label className="flex items-center gap-3 font-semibold">
                                  <input type="checkbox" checked={active} onChange={() => toggleMemberReportColumn(option.value)} className="h-4 w-4 rounded border-slate-300" />
                                  <span>{option.label}</span>
                                </label>
                                {active ? (
                                  <div className="flex gap-2">
                                    <button type="button" onClick={() => moveMemberReportColumn(option.value, 'up')} disabled={columnIndex === 0} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40">Subir</button>
                                    <button type="button" onClick={() => moveMemberReportColumn(option.value, 'down')} disabled={columnIndex === memberReportBuilder.columns.length - 1} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40">Descer</button>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-sky-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Métricas, ordenação e saída</p>
                      <div className="mt-4 grid gap-4">
                        <label className="space-y-2 text-sm text-slate-700">
                          <span className="font-semibold text-slate-900">Métrica</span>
                          <select value={memberReportBuilder.metric} onChange={(event) => setMemberReportBuilder((current) => ({ ...current, metric: event.target.value as MemberReportMetricKey }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-sky-400">
                            {MEMBER_REPORT_METRIC_OPTIONS.map((option) => <option key={option.value} value={option.value} disabled={option.disabled}>{option.disabled ? `${option.label} (em breve)` : option.label}</option>)}
                          </select>
                        </label>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                          <label className="space-y-2 text-sm text-slate-700">
                            <span className="font-semibold text-slate-900">Ordenar por</span>
                            <select value={memberReportBuilder.sortBy} onChange={(event) => setMemberReportBuilder((current) => ({ ...current, sortBy: event.target.value as MemberReportColumnKey }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-sky-400">
                              {memberReportBuilder.columns.map((column) => <option key={column} value={column}>{MEMBER_REPORT_COLUMN_OPTIONS.find((option) => option.value === column)?.label || column}</option>)}
                            </select>
                          </label>
                          <label className="space-y-2 text-sm text-slate-700">
                            <span className="font-semibold text-slate-900">Direção</span>
                            <select value={memberReportBuilder.sortDirection} onChange={(event) => setMemberReportBuilder((current) => ({ ...current, sortDirection: event.target.value as MemberReportSortDirection }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-sky-400">
                              <option value="asc">Ascendente</option>
                              <option value="desc">Descendente</option>
                            </select>
                          </label>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Orientação da impressão</p>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setMemberReportBuilder((current) => ({ ...current, orientation: 'portrait' }))} className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${memberReportBuilder.orientation === 'portrait' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>Retrato</button>
                            <button type="button" onClick={() => setMemberReportBuilder((current) => ({ ...current, orientation: 'landscape' }))} className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${memberReportBuilder.orientation === 'landscape' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>Paisagem</button>
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-[1fr_auto] xl:grid-cols-1">
                          <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
                            <span>Zebrado</span>
                            <input type="checkbox" checked={memberReportBuilder.zebraEnabled} onChange={(event) => setMemberReportBuilder((current) => ({ ...current, zebraEnabled: event.target.checked }))} className="h-4 w-4 rounded border-slate-300" />
                          </label>
                          <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
                            <span>Cor do zebrado</span>
                            <input type="color" value={memberReportBuilder.zebraColor} onChange={(event) => setMemberReportBuilder((current) => ({ ...current, zebraColor: event.target.value }))} className="h-10 w-16 rounded-lg border border-slate-200 bg-white" />
                          </label>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                <div className="flex min-h-0 flex-col overflow-hidden bg-white">
                  <div className="shrink-0 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Preview em tempo real</p>
                      <p className="mt-1 text-sm text-slate-600">Visualização rolável com agrupamentos à esquerda e totais detalhados no final.</p>
                    </div>
                    {activeMemberReportTemplate ? (
                      <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">Modelo ativo</p>
                        <p className="mt-1 text-sm font-semibold text-sky-900">{activeMemberReportTemplate.name}</p>
                      </div>
                    ) : null}
                  </div>

                  <div id="member-report-preview-root" className="min-h-0 flex-1 space-y-5 overflow-auto px-6 py-5">
                    {loading ? (
                      <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                        <span className="ml-3 text-sm text-slate-500">Carregando membros...</span>
                      </div>
                    ) : memberReportBuilder.groupBy.length > 0 ? (
                      <div className="space-y-5">{renderMemberPreviewGroups(memberPreviewGroups)}</div>
                    ) : (
                      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                        <div className="overflow-x-auto">
                          <table className="report-table min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-50">
                              <tr>
                                {memberReportBuilder.columns.map((column) => (
                                  <th
                                    key={column}
                                    onClick={() => setMemberReportBuilder((prev) => ({ ...prev, sortBy: column, sortDirection: prev.sortBy === column ? (prev.sortDirection === 'asc' ? 'desc' : 'asc') : 'asc' }))}
                                    className="no-print-sort whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 cursor-pointer select-none hover:bg-slate-100 group"
                                  >
                                    <span className="inline-flex items-center gap-1">
                                      {getMemberReportColumnLabel(column, true)}
                                      <span className="print:hidden text-slate-300 group-hover:text-slate-500 transition-colors">{memberReportBuilder.sortBy === column ? (memberReportBuilder.sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ⇅'}</span>
                                    </span>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {memberFilteredRows.map((row, index) => (
                                <tr key={row.id} style={memberReportBuilder.zebraEnabled && index % 2 === 1 ? { backgroundColor: memberReportBuilder.zebraColor } : undefined}>
                                  {memberReportBuilder.columns.map((column) => (
                                    <td key={`${row.id}-${column}`} className="whitespace-nowrap px-4 py-3 text-slate-700">
                                      {getMemberPreviewColumnValue(row, column)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    <div className="overflow-hidden rounded-xl bg-slate-50/60">
                      <div className="px-2 py-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tabela final de totais</p>
                      </div>
                      {renderFinalSummarySection(
                        memberReportSummary.totalRows,
                        memberReportSummary.metricTotal,
                        memberFinalSummaryBlocks.map((block) => ({ id: block.column, label: block.label, items: block.items })),
                        'text-sky-900 bg-sky-50',
                      )}
                    </div>
                    <div className="px-1 text-xs font-medium text-slate-600">
                      Total geral: {formatMetric(memberReportSummary.metricTotal)} | Registros: {formatMetric(memberFilteredRows.length)}
                    </div>
                  </div>
                </div>

                <div className="min-h-0 overflow-y-auto border-t border-slate-200 bg-slate-50/70 xl:border-t-0 xl:border-l xl:border-slate-200">
                  <div className="space-y-5 p-5">
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                          <Save className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Modelos salvos</p>
                          <p className="text-sm text-slate-600">Dê um nome ao relatório atual para abrir e imprimir depois sem montar tudo de novo.</p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        <label className="space-y-2 text-sm text-slate-700">
                          <span className="font-semibold text-slate-900">Nome do modelo</span>
                          <input
                            type="text"
                            value={memberReportTemplateName}
                            onChange={(event) => setMemberReportTemplateName(event.target.value)}
                            placeholder="Ex.: Membros por igreja ativa"
                            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                          />
                        </label>

                        <div className="grid gap-2">
                          <button
                            type="button"
                            onClick={handleSaveMemberReportTemplate}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                          >
                            <Save className="h-4 w-4" />
                            {activeMemberReportTemplateId ? 'Atualizar modelo' : 'Salvar modelo'}
                          </button>
                          <button
                            type="button"
                            onClick={handleStartNewMemberReportTemplate}
                            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Novo modelo
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateMemberReportTemplate()}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            <Copy className="h-4 w-4" />
                            Duplicar modelo atual
                          </button>
                        </div>

                        {activeMemberReportTemplate ? (
                          <div className={`rounded-2xl px-4 py-3 text-sm ${isMemberReportTemplateDirty ? 'border border-amber-200 bg-amber-50 text-amber-800' : 'border border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                            {isMemberReportTemplateDirty ? 'Existem alterações não salvas neste modelo.' : 'O preview já está sincronizado com o modelo salvo.'}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                            Salve a configuração atual para reaproveitar esse relatório depois.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Lista de relatórios salvos</p>
                          <p className="mt-1 text-sm text-slate-600">Clique em um modelo para carregar o esquema pronto e imprimir.</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">{memberReportTemplates.length} salvo(s)</span>
                      </div>

                      <div className="mt-4 space-y-3">
                        {memberReportTemplates.length ? memberReportTemplates.map((template) => {
                          const isActive = template.id === activeMemberReportTemplateId;
                          return (
                            <div key={template.id} className={`rounded-2xl border p-4 transition ${isActive ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                              <button type="button" onClick={() => handleLoadMemberReportTemplate(template)} className="w-full text-left">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className={`truncate text-sm font-semibold ${isActive ? 'text-sky-900' : 'text-slate-900'}`}>{template.name}</p>
                                    <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-500">
                                      {MEMBER_REPORT_TYPE_OPTIONS.find((option) => option.value === template.builder.reportType)?.label || 'Relatório'}
                                    </p>
                                  </div>
                                  {isActive ? <span className="rounded-full bg-sky-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">Ativo</span> : null}
                                </div>
                                <div className="mt-3 space-y-2 text-xs text-slate-600">
                                  <div>Agrupamento: {template.builder.groupBy.length ? template.builder.groupBy.map((group) => MEMBER_REPORT_GROUP_OPTIONS.find((option) => option.value === group)?.label || group).join(' > ') : 'Sem agrupamento'}</div>
                                  <div>Colunas: {template.builder.columns.length}</div>
                                  <div>Atualizado em: {formatDate(template.updatedAt)}</div>
                                </div>
                              </button>
                              <div className="mt-3 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleLoadMemberReportTemplate(template)}
                                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white"
                                >
                                  Carregar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDuplicateMemberReportTemplate(template)}
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMemberReportTemplate(template.id)}
                                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          );
                        }) : (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                            Nenhum modelo salvo ainda. Monte o relatório atual, dê um nome e clique em salvar.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : isChurchesReport ? (
              <div className="grid min-h-0 flex-1 lg:grid-cols-[330px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)_320px]">
                <div className="min-h-0 overflow-y-auto border-r border-sky-200 bg-[linear-gradient(180deg,#eff6ff_0%,#f8fafc_22%,#ffffff_100%)]">
                  <div className="space-y-5 p-5">
                    <div className="rounded-3xl border border-sky-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Modo do relatório</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => setChurchReportBuilder((current) => ({ ...current, mode: 'single' }))} className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition ${churchReportBuilder.mode === 'single' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>Igreja única</button>
                        <button type="button" onClick={() => setChurchReportBuilder((current) => ({ ...current, mode: 'list' }))} className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition ${churchReportBuilder.mode === 'list' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>Lista agrupada</button>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-sky-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Filtros</p>
                      <div className="mt-4 grid gap-4">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                          <label className="space-y-2 text-sm text-slate-700">
                            <span className="font-semibold text-slate-900">Data inicial</span>
                            <input type="date" value={churchReportBuilder.dateFrom} onChange={(event) => setChurchReportBuilder((current) => ({ ...current, dateFrom: event.target.value }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-sky-400" />
                          </label>
                          <label className="space-y-2 text-sm text-slate-700">
                            <span className="font-semibold text-slate-900">Data final</span>
                            <input type="date" value={churchReportBuilder.dateTo} onChange={(event) => setChurchReportBuilder((current) => ({ ...current, dateTo: event.target.value }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-sky-400" />
                          </label>
                        </div>
                        <MultiSelectDropdown
                          label="Campos"
                          emptyLabel="Todos os campos"
                          selectedValues={churchReportBuilder.fieldIds}
                          options={fields.map((field) => ({ value: field.id, label: field.name, disabled: hasFixedCampoScope }))}
                          disabled={hasFixedCampoScope}
                          onToggle={(fieldId, checked) => setChurchReportBuilder((current) => {
                            const nextFieldIds = checked ? Array.from(new Set([...current.fieldIds, fieldId])) : current.fieldIds.filter((item) => item !== fieldId);
                            return {
                              ...current,
                              fieldIds: nextFieldIds,
                              regionalIds: current.regionalIds.filter((regionalId) => {
                                const regional = regionais.find((item) => item.id === regionalId);
                                return regional ? nextFieldIds.includes(regional.campoId) : true;
                              }),
                              churchIds: [],
                            };
                          })}
                        />
                        <MultiSelectDropdown
                          label="Regionais"
                          emptyLabel="Todas as regionais"
                          selectedValues={churchReportBuilder.regionalIds}
                          options={churchReportRegionais.map((regional) => ({ value: regional.id, label: regional.name, disabled: hasFixedChurchScope && Boolean(storedUser.regionalId) }))}
                          disabled={hasFixedChurchScope && Boolean(storedUser.regionalId)}
                          onToggle={(regionalId, checked) => setChurchReportBuilder((current) => ({
                            ...current,
                            regionalIds: checked ? Array.from(new Set([...current.regionalIds, regionalId])) : current.regionalIds.filter((item) => item !== regionalId),
                            churchIds: [],
                          }))}
                        />
                        <MultiSelectDropdown
                          label="Igrejas"
                          emptyLabel="Todas as igrejas"
                          selectedValues={churchReportBuilder.churchIds}
                          options={churchReportChurches.map((church) => ({ value: church.id, label: church.name, disabled: hasFixedChurchScope && Boolean(storedUser.churchId) }))}
                          disabled={hasFixedChurchScope && Boolean(storedUser.churchId)}
                          onToggle={(churchId, checked) => setChurchReportBuilder((current) => ({
                            ...current,
                            churchIds: checked ? Array.from(new Set([...current.churchIds, churchId])) : current.churchIds.filter((item) => item !== churchId),
                          }))}
                        />
                        <MultiSelectDropdown
                          label="Tipo de membro"
                          emptyLabel="Todos os tipos"
                          selectedValues={churchReportBuilder.memberTypes}
                          options={[
                            { value: 'MEMBRO', label: 'Membro' },
                            { value: 'PF', label: 'PF – Pessoa Física' },
                            { value: 'PJ', label: 'PJ – Pessoa Jurídica' },
                          ]}
                          onToggle={(tipo, checked) => setChurchReportBuilder((current) => ({
                            ...current,
                            memberTypes: checked ? Array.from(new Set([...current.memberTypes, tipo])) : current.memberTypes.filter((item) => item !== tipo),
                          }))}
                        />
                      </div>
                    </div>

                    <div className="rounded-3xl border border-sky-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Agrupamentos permitidos</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {[
                          { key: 'field', label: 'Campo' },
                          { key: 'regional', label: 'Regional' },
                          { key: 'church', label: 'Igreja' },
                        ].map((group) => {
                          const active = churchReportBuilder.groupBy.includes(group.key as ChurchReportGroupKey);
                          return (
                            <button key={group.key} type="button" onClick={() => toggleChurchReportGroup(group.key as ChurchReportGroupKey)} className={`rounded-2xl border px-3 py-2 text-sm font-semibold transition ${active ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                              {group.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-sky-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Seções do histórico</p>
                      <div className="mt-3 grid gap-2">
                        {CHURCH_REPORT_SECTION_OPTIONS.map((section) => (
                          <label key={section.value} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                            <input type="checkbox" checked={churchReportBuilder.sections.includes(section.value)} onChange={() => toggleChurchReportSection(section.value)} className="h-4 w-4 rounded border-slate-300" />
                            <span>{section.label}</span>
                          </label>
                        ))}
                        <label className="mt-1 flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                          <span>Mostrar fotos da igreja</span>
                          <input type="checkbox" checked={churchReportBuilder.showPhotos} onChange={(event) => setChurchReportBuilder((current) => ({ ...current, showPhotos: event.target.checked }))} className="h-4 w-4 rounded border-slate-300" />
                        </label>
                        <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700">
                          <span>Incluir mapa/localidade</span>
                          <input type="checkbox" checked={churchReportBuilder.showMap} onChange={(event) => setChurchReportBuilder((current) => ({ ...current, showMap: event.target.checked }))} className="h-4 w-4 rounded border-slate-300" />
                        </label>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-sky-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Colunas da lista</p>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">{churchReportBuilder.columns.length} colunas</span>
                      </div>
                      <div className="mt-3 grid gap-2">
                        {CHURCH_REPORT_COLUMN_OPTIONS.map((option) => {
                          const active = churchReportBuilder.columns.includes(option.value);
                          const index = churchReportBuilder.columns.indexOf(option.value);
                          return (
                            <div key={option.value} className={`rounded-xl border px-3 py-2 text-sm ${active ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-700'}`}>
                              <div className="flex items-center justify-between gap-2">
                                <label className="flex items-center gap-2 font-semibold">
                                  <input type="checkbox" checked={active} onChange={() => toggleChurchReportColumn(option.value)} className="h-4 w-4 rounded border-slate-300" />
                                  <span>{option.label}</span>
                                </label>
                                {active ? (
                                  <div className="flex gap-1">
                                    <button type="button" onClick={() => moveChurchReportColumn(option.value, 'up')} disabled={index === 0} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40">Subir</button>
                                    <button type="button" onClick={() => moveChurchReportColumn(option.value, 'down')} disabled={index === churchReportBuilder.columns.length - 1} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40">Descer</button>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-sky-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ordenação e saída</p>
                      <div className="mt-3 grid gap-3">
                        <label className="space-y-2 text-sm text-slate-700">
                          <span className="font-semibold text-slate-900">Ordenar por</span>
                          <select value={churchReportBuilder.sortBy} onChange={(event) => setChurchReportBuilder((current) => ({ ...current, sortBy: event.target.value as ChurchReportColumnKey }))} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-400">
                            {churchReportBuilder.columns.map((column) => <option key={column} value={column}>{getChurchReportColumnLabel(column)}</option>)}
                          </select>
                        </label>
                        <label className="space-y-2 text-sm text-slate-700">
                          <span className="font-semibold text-slate-900">Direção</span>
                          <select value={churchReportBuilder.sortDirection} onChange={(event) => setChurchReportBuilder((current) => ({ ...current, sortDirection: event.target.value as MemberReportSortDirection }))} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-400">
                            <option value="asc">Ascendente</option>
                            <option value="desc">Descendente</option>
                          </select>
                        </label>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Orientação da impressão</p>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setChurchReportBuilder((current) => ({ ...current, orientation: 'portrait' }))} className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${churchReportBuilder.orientation === 'portrait' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>Retrato</button>
                            <button type="button" onClick={() => setChurchReportBuilder((current) => ({ ...current, orientation: 'landscape' }))} className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${churchReportBuilder.orientation === 'landscape' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>Paisagem</button>
                          </div>
                        </div>
                        <label className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                          <span>Tabela zebrada</span>
                          <input type="checkbox" checked={churchReportBuilder.zebraEnabled} onChange={(event) => setChurchReportBuilder((current) => ({ ...current, zebraEnabled: event.target.checked }))} className="h-4 w-4 rounded border-slate-300" />
                        </label>
                        <label className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                          <span>Cor do zebrado</span>
                          <input type="color" value={churchReportBuilder.zebraColor} onChange={(event) => setChurchReportBuilder((current) => ({ ...current, zebraColor: event.target.value }))} className="h-9 w-14 rounded-lg border border-slate-200 bg-white" />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div id="church-report-preview-root" className="min-h-0 space-y-4 overflow-y-auto bg-white px-6 py-5">
                  {churchReportBuilder.mode === 'single' ? (
                    churchActiveRow ? (
                      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                        {/* CABEÇALHO */}
                        <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
                          <h2 className="text-xl font-bold uppercase tracking-wide text-slate-900">{churchActiveRow.church}</h2>
                          <p className="mt-1 text-xs text-slate-500">{churchActiveRow.field} · {churchActiveRow.regional} · {churchActiveRow.city}/{churchActiveRow.state}</p>
                          <p className="text-xs text-slate-500">{churchActiveRow.address}</p>
                        </div>
                        {/* DIRIGENTE */}
                        <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200">
                          <div className="px-6 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Dirigente</p>
                            <p className="mt-0.5 text-sm font-semibold text-slate-800">{churchActiveRow.leaderName}</p>
                          </div>
                          <div className="px-6 py-3">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Função</p>
                            <p className="mt-0.5 text-sm font-semibold text-slate-800">{churchActiveRow.leaderRole}</p>
                          </div>
                        </div>
                        {/* QUADRO POR CATEGORIA */}
                        <div className="grid grid-cols-6 divide-x divide-slate-200 border-b border-slate-200">
                          {([
                            { label: 'Total', value: churchActiveRow.totalMembers },
                            { label: 'Pastores', value: churchActiveRow.pastors },
                            { label: 'Presbíteros', value: churchActiveMemberBreakdown.presbyteros },
                            { label: 'Evangelistas', value: churchActiveMemberBreakdown.evangelistas },
                            { label: 'Diáconos', value: churchActiveRow.diaconos },
                            { label: 'Diaconisas', value: churchActiveMemberBreakdown.diaconisas },
                          ] as const).map(({ label, value }) => (
                            <div key={label} className="px-3 py-3 text-center">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                              <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
                            </div>
                          ))}
                        </div>
                        {/* EVOLUÇÃO */}
                        <div className="grid grid-cols-3 divide-x divide-slate-200 border-b border-slate-200">
                          <div className="px-6 py-4">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Membros ao iniciar o período</p>
                            <p className="mt-1 text-3xl font-bold text-slate-800">{churchActiveMemberBreakdown.membersAtStart}</p>
                          </div>
                          <div className="px-6 py-4">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Membros atual</p>
                            <p className="mt-1 text-3xl font-bold text-slate-800">{churchActiveRow.totalMembers}</p>
                          </div>
                          <div className="px-6 py-4">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Crescimento no período</p>
                            <p className={`mt-1 text-3xl font-bold ${churchActiveMemberBreakdown.growth >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {churchActiveMemberBreakdown.growth >= 0 ? '+' : ''}{churchActiveMemberBreakdown.growth}%
                            </p>
                          </div>
                        </div>
                        {/* MOVIMENTAÇÃO */}
                        <div className="grid grid-cols-3 divide-x divide-slate-200 border-b border-slate-200">
                          <div className="px-6 py-4">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Batizados</p>
                            <p className="mt-1 text-3xl font-bold text-slate-800">{churchActiveRow.baptisms}</p>
                          </div>
                          <div className="px-6 py-4">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Consagrados</p>
                            <p className="mt-1 text-3xl font-bold text-slate-800">{churchActiveRow.consecrations}</p>
                          </div>
                          <div className="px-6 py-4">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Novos membros</p>
                            <p className="mt-1 text-3xl font-bold text-slate-800">{churchActiveRow.newMembers}</p>
                          </div>
                        </div>
                        {/* DIRIGENTES */}
                        {churchReportBuilder.sections.includes('leaders') ? (
                          <div className="border-b border-slate-200">
                            <div className="bg-slate-50 px-6 py-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Histórico de dirigentes</p>
                            </div>
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-slate-200 bg-slate-50">
                                  <th className="px-6 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Nome</th>
                                  <th className="px-6 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Função</th>
                                  <th className="px-6 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Entrada</th>
                                  <th className="px-6 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Saída</th>
                                </tr>
                              </thead>
                              <tbody>
                                {churchLeadersHistoryRows.slice(0, 12).map((row, index) => (
                                  <tr key={`${row.name}-${index}`} className="border-b border-slate-100">
                                    <td className="px-6 py-2 text-slate-700">{row.name}</td>
                                    <td className="px-6 py-2 text-slate-700">{row.title}</td>
                                    <td className="px-6 py-2 text-slate-700">{row.start}</td>
                                    <td className="px-6 py-2 text-slate-700">{row.end}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : null}
                        {/* MEMBROS */}
                        <div className="border-b border-slate-200">
                          <div className="flex items-center justify-between bg-slate-50 px-6 py-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Membros ({churchMembersListRows.length})</p>
                            <button
                              type="button"
                              onClick={() => setShowChurchMembersList((prev) => !prev)}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600 transition hover:bg-slate-50"
                            >
                              {showChurchMembersList ? 'Ocultar' : 'Ver lista'}
                            </button>
                          </div>
                          {showChurchMembersList ? (
                            churchMembersListRows.length ? (
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50">
                                      <th className="px-6 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">#</th>
                                      <th className="px-6 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Nome</th>
                                      <th className="px-6 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Título</th>
                                      <th className="px-6 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Situação</th>
                                      <th className="px-6 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400">Membro desde</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {churchMembersListRows.map((row, index) => (
                                      <tr key={`member-${index}`} className="border-b border-slate-100">
                                        <td className="px-6 py-2 text-xs text-slate-400">{index + 1}</td>
                                        <td className="px-6 py-2 font-medium text-slate-800">{row.name}</td>
                                        <td className="px-6 py-2 text-slate-600">{row.title}</td>
                                        <td className="px-6 py-2 text-slate-600">{row.status}</td>
                                        <td className="px-6 py-2 text-slate-600">{row.membershipDate}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="px-6 py-4 text-sm text-slate-500">Nenhum membro encontrado.</div>
                            )
                          ) : null}
                        </div>
                        {/* GRÁFICO */}
                        {churchReportBuilder.sections.includes('stats') ? (
                          <div className="border-b border-slate-200">
                            <div className="bg-slate-50 px-6 py-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Gráfico de evolução de membros</p>
                            </div>
                            {churchMembersEvolution.length ? (
                              <>
                                <div className="church-evolution-screen px-4 py-3">
                                  <ReactECharts
                                    option={buildChurchEvolutionOption()}
                                    style={{ height: 240 }}
                                    notMerge
                                    lazyUpdate
                                    onChartReady={(chart) => {
                                      try {
                                        setChurchEvolutionChartImage(chart.getDataURL({ pixelRatio: 2, backgroundColor: '#ffffff' }));
                                      } catch {
                                        setChurchEvolutionChartImage('');
                                      }
                                    }}
                                  />
                                </div>
                                {churchEvolutionChartImage ? (
                                  <img src={churchEvolutionChartImage} alt="Gráfico de evolução de membros" className="church-evolution-print-img" style={{ display: 'none' }} />
                                ) : null}
                              </>
                            ) : (
                              <div className="px-6 py-4 text-sm text-slate-500">Sem dados históricos suficientes para o gráfico.</div>
                            )}
                          </div>
                        ) : null}
                        {/* FOTOS */}
                        {churchReportBuilder.showPhotos ? (
                          <div className="border-b border-slate-200">
                            <div className="bg-slate-50 px-6 py-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Fotos da igreja</p>
                            </div>
                            {churchPhotoUrls.length ? (
                              <div className="grid grid-cols-3 gap-4 p-4">
                                {churchPhotoUrls.map((url, index) => (
                                  <div key={`${url}-${index}`} className="overflow-hidden rounded-xl border border-slate-200">
                                    <img src={url} alt={`Foto ${index + 1}`} className="h-40 w-full object-cover" />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="px-6 py-4 text-sm text-slate-500">Sem fotos cadastradas.</div>
                            )}
                          </div>
                        ) : null}
                        {/* MAPA */}
                        {churchReportBuilder.showMap ? (
                          <div>
                            <div className="bg-slate-50 px-6 py-2">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Mapa de localidade</p>
                            </div>
                            {churchMapImageUrl ? (
                              <div className="overflow-hidden">
                                <img src={churchMapImageUrl} alt={`Mapa ${churchActiveRow.church}`} className="h-[240px] w-full object-cover" crossOrigin="anonymous" />
                              </div>
                            ) : (
                              <div className="px-6 py-4 text-sm text-slate-500">Mapa indisponível — sem coordenadas cadastradas.</div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">Nenhuma igreja encontrada para os filtros selecionados.</div>
                    )
                  ) : (
                    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                      <div className="px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Lista agrupada de igrejas</p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                          <thead className="bg-slate-50">
                            <tr>
                              {churchReportBuilder.columns.map((column) => (
                                <th key={column} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{getChurchReportColumnLabel(column)}</th>
                              ))}
                              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500" />
                            </tr>
                          </thead>
                          <tbody>
                            {churchReportListRows.map((row, index) => {
                              const isOpen = listRowOpenMembersId === row.churchId;
                              const rowMembers = members.filter((m) => {
                                if (m.church?.id !== row.churchId) return false;
                                if (churchReportBuilder.memberTypes.length && !churchReportBuilder.memberTypes.includes(m.memberType || 'MEMBRO')) return false;
                                return true;
                              }).sort((a, b) => compareLocaleValues(a.fullName, b.fullName));
                              return (
                                <>
                                  <tr key={row.churchId} className="border-t border-slate-100" style={churchReportBuilder.zebraEnabled && index % 2 === 1 ? { backgroundColor: churchReportBuilder.zebraColor } : undefined}>
                                    {churchReportBuilder.columns.map((column) => (
                                      <td key={`${row.churchId}-${column}`} className={`px-3 py-2 ${typeof getChurchReportColumnValue(row, column) === 'number' ? 'font-semibold text-slate-800' : 'text-slate-700'}`}>
                                        {String(getChurchReportColumnValue(row, column) ?? '-')}
                                      </td>
                                    ))}
                                    <td className="px-3 py-2">
                                      <button
                                        type="button"
                                        onClick={() => setListRowOpenMembersId(isOpen ? null : row.churchId)}
                                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600 transition hover:bg-slate-50"
                                      >
                                        {isOpen ? 'Fechar' : `Membros (${rowMembers.length})`}
                                      </button>
                                    </td>
                                  </tr>
                                  {isOpen ? (
                                    <tr key={`${row.churchId}-members`}>
                                      <td colSpan={churchReportBuilder.columns.length + 1} className="bg-slate-50 px-4 py-3">
                                        <table className="w-full text-xs">
                                          <thead>
                                            <tr className="border-b border-slate-200">
                                              <th className="py-1 text-left font-semibold uppercase tracking-wider text-slate-400">#</th>
                                              <th className="py-1 text-left font-semibold uppercase tracking-wider text-slate-400">Nome</th>
                                              <th className="py-1 text-left font-semibold uppercase tracking-wider text-slate-400">Título</th>
                                              <th className="py-1 text-left font-semibold uppercase tracking-wider text-slate-400">Situação</th>
                                              <th className="py-1 text-left font-semibold uppercase tracking-wider text-slate-400">Membro desde</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {rowMembers.map((m, mi) => (
                                              <tr key={m.id} className="border-b border-slate-100">
                                                <td className="py-1 text-slate-400">{mi + 1}</td>
                                                <td className="py-1 font-medium text-slate-800">{toSafeLabel(m.preferredName || m.fullName)}</td>
                                                <td className="py-1 text-slate-600">{toSafeLabel(m.ecclesiasticalTitleRef?.name || m.ecclesiasticalTitle)}</td>
                                                <td className="py-1 text-slate-600">{normalizeMembershipStatusLabel(m.membershipStatus)}</td>
                                                <td className="py-1 text-slate-600">{formatDate(m.membershipDate || m.createdAt)}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </td>
                                    </tr>
                                  ) : null}
                                </>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="space-y-3 border-t border-slate-200 bg-slate-50/70 px-4 py-4">
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Totais gerais</p>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {churchReportTotalMetricColumns.map((column) => (
                              <div key={`grand-total-${column}`} className="rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-700">
                                <span className="font-semibold text-slate-600">{getChurchReportColumnLabel(column)}:</span> {formatMetric(churchReportGrandTotals[column] || 0)}
                              </div>
                            ))}
                          </div>
                        </div>

                        {churchReportGroupedTotals.length ? (
                          <div className="rounded-2xl border border-slate-200 bg-white p-3">
                            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Totais por agrupamento</p>
                            <div className="mt-2 space-y-2">
                              {churchReportGroupedTotals.map((group) => (
                                <div key={group.key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                  <p className="text-sm font-semibold text-slate-800">{group.label}</p>
                                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                    {churchReportTotalMetricColumns.map((column) => (
                                      <div key={`${group.key}-${column}`} className="rounded-lg bg-white px-2 py-1 text-xs text-slate-700">
                                        <span className="font-semibold text-slate-600">{getChurchReportColumnLabel(column)}:</span> {formatMetric(group.totals[column] || 0)}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>

                <div className="min-h-0 overflow-y-auto border-t border-slate-200 bg-slate-50/70 xl:border-l xl:border-t-0">
                  <div className="space-y-4 p-5">
                    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Modelos salvos</p>
                      <div className="mt-3 space-y-2">
                        <input
                          type="text"
                          value={churchReportTemplateName}
                          onChange={(event) => setChurchReportTemplateName(event.target.value)}
                          placeholder="Ex.: Historico igreja sede"
                          className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                        />
                        <div className="grid gap-2">
                          <button type="button" onClick={handleSaveChurchReportTemplate} className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">{activeChurchReportTemplateId ? 'Atualizar modelo' : 'Salvar modelo'}</button>
                          <button type="button" onClick={handleStartNewChurchReportTemplate} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Novo modelo</button>
                          <button type="button" onClick={() => handleDuplicateChurchReportTemplate()} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Duplicar modelo atual</button>
                        </div>
                      </div>
                      <div className="mt-3 space-y-2">
                        {churchReportTemplates.length ? churchReportTemplates.map((template) => {
                          const isActive = template.id === activeChurchReportTemplateId;
                          return (
                            <div key={template.id} className={`rounded-xl border px-3 py-2 ${isActive ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white'}`}>
                              <button type="button" onClick={() => handleLoadChurchReportTemplate(template)} className="w-full text-left">
                                <p className={`truncate text-sm font-semibold ${isActive ? 'text-sky-900' : 'text-slate-900'}`}>{template.name}</p>
                                <p className="mt-1 text-xs text-slate-500">Atualizado em: {formatDate(template.updatedAt)}</p>
                              </button>
                              <div className="mt-2 flex gap-2">
                                <button type="button" onClick={() => handleLoadChurchReportTemplate(template)} className="flex-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">Carregar</button>
                                <button type="button" onClick={() => handleDeleteChurchReportTemplate(template.id)} className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700">Excluir</button>
                              </div>
                            </div>
                          );
                        }) : (
                          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">Nenhum modelo salvo ainda.</div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Resumo operacional</p>
                      <div className="mt-3 space-y-2 text-sm text-slate-700">
                        <div className="rounded-xl bg-slate-100 px-3 py-2 font-semibold">Igrejas no relatório: {formatMetric(churchReportSummaryRows.length)}</div>
                        <div className="rounded-xl bg-slate-100 px-3 py-2 font-semibold">Membros consolidados: {formatMetric(churchReportSummaryRows.reduce((total, row) => total + row.totalMembers, 0))}</div>
                        <div className="rounded-xl bg-slate-100 px-3 py-2 font-semibold">Batismos: {formatMetric(churchReportSummaryRows.reduce((total, row) => total + row.baptisms, 0))}</div>
                        <div className="rounded-xl bg-slate-100 px-3 py-2 font-semibold">Consagrações: {formatMetric(churchReportSummaryRows.reduce((total, row) => total + row.consecrations, 0))}</div>
                      </div>
                    </div>
                    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Indicador financeiro</p>
                      <p className="mt-2 text-sm text-slate-600">A evolução de dízimos e ofertas ficará disponível quando a fonte financeira estiver integrada ao construtor da secretaria.</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : isBaptismReport ? (
              <div className="grid min-h-0 flex-1 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)_300px] 2xl:grid-cols-[400px_minmax(0,1fr)_340px]">
                <div className="min-h-0 overflow-y-auto border-r border-sky-200 bg-[linear-gradient(180deg,#ecfeff_0%,#f8fafc_22%,#ffffff_100%)]">
                  <div className="space-y-5 p-5">
                    <div className="rounded-3xl border border-sky-200 bg-white p-5 shadow-[0_18px_40px_rgba(14,116,144,0.08)]">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                          <Droplets className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tipo de relatório</p>
                          <p className="text-sm text-slate-600">Base central em pipeline stage, cards e colunas do fluxo de batismo.</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2">
                        {BAPTISM_REPORT_TYPE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleBaptismReportTypeChange(option.value)}
                            className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${baptismReportBuilder.reportType === option.value ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-sky-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                          <Filter className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Filtros</p>
                          <p className="text-sm text-slate-600">Agrupe pendentes, aprovados e demais etapas por campo, regional e igreja.</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-4">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                          <label className="space-y-2 text-sm text-slate-700">
                            <span className="font-semibold text-slate-900">Data inicial</span>
                            <input type="date" value={baptismReportBuilder.dateFrom} onChange={(event) => setBaptismReportBuilder((current) => ({ ...current, dateFrom: event.target.value }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-sky-400" />
                          </label>
                          <label className="space-y-2 text-sm text-slate-700">
                            <span className="font-semibold text-slate-900">Data final</span>
                            <input type="date" value={baptismReportBuilder.dateTo} onChange={(event) => setBaptismReportBuilder((current) => ({ ...current, dateTo: event.target.value }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-sky-400" />
                          </label>
                        </div>
                        <MultiSelectDropdown
                          label="Campos"
                          emptyLabel="Todos os campos"
                          selectedValues={baptismReportBuilder.fieldIds}
                          options={fields.map((field) => ({ value: field.id, label: field.name, disabled: hasFixedCampoScope }))}
                          disabled={hasFixedCampoScope}
                          onToggle={(fieldId, checked) => setBaptismReportBuilder((current) => {
                            const nextFieldIds = checked ? Array.from(new Set([...current.fieldIds, fieldId])) : current.fieldIds.filter((item) => item !== fieldId);
                            return {
                              ...current,
                              fieldIds: nextFieldIds,
                              regionalIds: current.regionalIds.filter((regionalId) => {
                                const regional = regionais.find((item) => item.id === regionalId);
                                return regional ? nextFieldIds.includes(regional.campoId) : true;
                              }),
                              churchIds: [],
                            };
                          })}
                        />
                        <MultiSelectDropdown
                          label="Regionais"
                          emptyLabel="Todas as regionais"
                          selectedValues={baptismReportBuilder.regionalIds}
                          options={baptismReportRegionais.map((regional) => ({ value: regional.id, label: regional.name, disabled: hasFixedChurchScope && Boolean(storedUser.regionalId) }))}
                          disabled={hasFixedChurchScope && Boolean(storedUser.regionalId)}
                          onToggle={(regionalId, checked) => setBaptismReportBuilder((current) => ({
                            ...current,
                            regionalIds: checked ? Array.from(new Set([...current.regionalIds, regionalId])) : current.regionalIds.filter((item) => item !== regionalId),
                            churchIds: [],
                          }))}
                        />
                        <MultiSelectDropdown
                          label="Igrejas"
                          emptyLabel="Todas as igrejas"
                          selectedValues={baptismReportBuilder.churchIds}
                          options={baptismReportChurches.map((church) => ({ value: church.id, label: church.name, disabled: hasFixedChurchScope && Boolean(storedUser.churchId) }))}
                          disabled={hasFixedChurchScope && Boolean(storedUser.churchId)}
                          onToggle={(churchId, checked) => setBaptismReportBuilder((current) => ({
                            ...current,
                            churchIds: checked ? Array.from(new Set([...current.churchIds, churchId])) : current.churchIds.filter((item) => item !== churchId),
                          }))}
                        />
                        <MultiSelectDropdown
                          label="Etapas do fluxo"
                          emptyLabel="Todas as etapas"
                          selectedValues={baptismReportBuilder.workflowStatuses}
                          options={baptismWorkflowStatusOptions.map((status) => ({ value: status, label: status }))}
                          onToggle={(status, checked) => setBaptismReportBuilder((current) => ({
                            ...current,
                            workflowStatuses: checked ? Array.from(new Set([...current.workflowStatuses, status])) : current.workflowStatuses.filter((item) => item !== status),
                          }))}
                        />
                        <MultiSelectDropdown
                          label="Situação do membro"
                          emptyLabel="Todas as situações"
                          selectedValues={baptismReportBuilder.memberStatuses}
                          options={baptismMemberStatusOptions.map((status) => ({ value: status, label: status }))}
                          onToggle={(status, checked) => setBaptismReportBuilder((current) => ({
                            ...current,
                            memberStatuses: checked ? Array.from(new Set([...current.memberStatuses, status])) : current.memberStatuses.filter((item) => item !== status),
                          }))}
                        />
                        <MultiSelectDropdown
                          label="Tipo de membro"
                          emptyLabel="Todos os tipos"
                          selectedValues={baptismReportBuilder.memberTypes}
                          options={[
                            { value: 'MEMBRO', label: 'Membro' },
                            { value: 'PF', label: 'PF – Pessoa Física' },
                            { value: 'PJ', label: 'PJ – Pessoa Jurídica' },
                          ]}
                          onToggle={(tipo, checked) => setBaptismReportBuilder((current) => ({
                            ...current,
                            memberTypes: checked ? Array.from(new Set([...current.memberTypes, tipo])) : current.memberTypes.filter((item) => item !== tipo),
                          }))}
                        />
                      </div>
                    </div>

                    <div className="rounded-3xl border border-sky-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Agrupar por</p>
                          <p className="mt-1 text-sm text-slate-600">Monte a hierarquia do relatório a partir do fluxo e da estrutura igreja-regional-campo.</p>
                        </div>
                        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">{baptismReportBuilder.groupBy.length} níveis</span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {BAPTISM_REPORT_GROUP_OPTIONS.map((option) => {
                          const active = baptismReportBuilder.groupBy.includes(option.value);
                          const currentIndex = baptismReportBuilder.groupBy.indexOf(option.value);
                          return (
                            <div key={option.value} className={`rounded-2xl border px-3 py-3 ${active ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white'}`}>
                              <button type="button" onClick={() => toggleBaptismGroupField(option.value)} className={`text-sm font-semibold ${active ? 'text-sky-700' : 'text-slate-700'}`}>
                                {active ? `${currentIndex + 1}. ${option.label}` : option.label}
                              </button>
                              {active ? (
                                <div className="mt-3 flex gap-2">
                                  <button type="button" onClick={(event) => { event.stopPropagation(); moveBaptismGroupField(option.value, 'up'); }} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40" disabled={currentIndex === 0}>Subir</button>
                                  <button type="button" onClick={(event) => { event.stopPropagation(); moveBaptismGroupField(option.value, 'down'); }} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40" disabled={currentIndex === baptismReportBuilder.groupBy.length - 1}>Descer</button>
                                  <button type="button" onClick={(event) => { event.stopPropagation(); removeBaptismGroupField(option.value); }} className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100">Remover</button>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-sky-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Colunas visíveis</p>
                          <p className="mt-1 text-sm text-slate-600">Somente os campos básicos do membro e os dados centrais do workflow.</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">{baptismReportBuilder.columns.length} colunas</span>
                      </div>
                      <div className="mt-4 grid gap-2">
                        {BAPTISM_REPORT_COLUMN_OPTIONS.map((option) => {
                          const active = baptismReportBuilder.columns.includes(option.value);
                          const columnIndex = baptismReportBuilder.columns.indexOf(option.value);
                          return (
                            <div key={option.value} className={`rounded-2xl border px-4 py-3 text-sm ${active ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-700'}`}>
                              <div className="flex items-center justify-between gap-3">
                                <label className="flex items-center gap-3 font-semibold">
                                  <input type="checkbox" checked={active} onChange={() => toggleBaptismReportColumn(option.value)} className="h-4 w-4 rounded border-slate-300" />
                                  <span>{option.label}</span>
                                </label>
                                {active ? (
                                  <div className="flex gap-2">
                                    <button type="button" onClick={() => moveBaptismReportColumn(option.value, 'up')} disabled={columnIndex === 0} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40">Subir</button>
                                    <button type="button" onClick={() => moveBaptismReportColumn(option.value, 'down')} disabled={columnIndex === baptismReportBuilder.columns.length - 1} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40">Descer</button>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-sky-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ordenação e saída</p>
                      <div className="mt-4 grid gap-4">
                        <label className="space-y-2 text-sm text-slate-700">
                          <span className="font-semibold text-slate-900">Métrica</span>
                          <select value={baptismReportBuilder.metric} onChange={(event) => setBaptismReportBuilder((current) => ({ ...current, metric: event.target.value as BaptismReportMetricKey }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-sky-400">
                            {BAPTISM_REPORT_METRIC_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </label>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                          <label className="space-y-2 text-sm text-slate-700">
                            <span className="font-semibold text-slate-900">Ordenar por</span>
                            <select value={baptismReportBuilder.sortBy} onChange={(event) => setBaptismReportBuilder((current) => ({ ...current, sortBy: event.target.value as BaptismReportColumnKey }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-sky-400">
                              {baptismReportBuilder.columns.map((column) => <option key={column} value={column}>{getBaptismReportColumnLabel(column)}</option>)}
                            </select>
                          </label>
                          <label className="space-y-2 text-sm text-slate-700">
                            <span className="font-semibold text-slate-900">Direção</span>
                            <select value={baptismReportBuilder.sortDirection} onChange={(event) => setBaptismReportBuilder((current) => ({ ...current, sortDirection: event.target.value as MemberReportSortDirection }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-sky-400">
                              <option value="asc">Ascendente</option>
                              <option value="desc">Descendente</option>
                            </select>
                          </label>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Orientação da impressão</p>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setBaptismReportBuilder((current) => ({ ...current, orientation: 'portrait' }))} className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${baptismReportBuilder.orientation === 'portrait' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>Retrato</button>
                            <button type="button" onClick={() => setBaptismReportBuilder((current) => ({ ...current, orientation: 'landscape' }))} className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${baptismReportBuilder.orientation === 'landscape' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>Paisagem</button>
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-[1fr_auto] xl:grid-cols-1">
                          <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
                            <span>Zebrado</span>
                            <input type="checkbox" checked={baptismReportBuilder.zebraEnabled} onChange={(event) => setBaptismReportBuilder((current) => ({ ...current, zebraEnabled: event.target.checked }))} className="h-4 w-4 rounded border-slate-300" />
                          </label>
                          <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
                            <span>Cor do zebrado</span>
                            <input type="color" value={baptismReportBuilder.zebraColor} onChange={(event) => setBaptismReportBuilder((current) => ({ ...current, zebraColor: event.target.value }))} className="h-10 w-16 rounded-lg border border-slate-200 bg-white" />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 flex-col overflow-hidden bg-white">
                  <div className="shrink-0 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Preview em tempo real</p>
                      <p className="mt-1 text-sm text-slate-600">Lista consolidada por etapa, igreja, regional e campo com base no pipeline de batismo.</p>
                    </div>
                    {activeBaptismReportTemplate ? (
                      <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">Modelo ativo</p>
                        <p className="mt-1 text-sm font-semibold text-sky-900">{activeBaptismReportTemplate.name}</p>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-sky-200 bg-sky-50 px-3 py-2 text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">Base ativa</p>
                        <p className="mt-1 text-sm font-semibold text-sky-900">Cards e columns de batismo</p>
                      </div>
                    )}
                  </div>

                  <div id="baptism-report-preview-root" className="min-h-0 flex-1 space-y-5 overflow-auto px-6 py-5">
                    {loading ? (
                      <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-sky-400" />
                        <span className="ml-3 text-sm text-slate-500">Carregando batismos...</span>
                      </div>
                    ) : baptismReportBuilder.groupBy.length > 0 ? (
                      <div className="space-y-5">{renderBaptismPreviewGroups(baptismPreviewGroups)}</div>
                    ) : (
                      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                        <div className="overflow-x-auto">
                          <table className="report-table min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-50">
                              <tr>
                                {baptismReportBuilder.columns.map((column) => (
                                  <th
                                    key={column}
                                    onClick={() => setBaptismReportBuilder((prev) => ({ ...prev, sortBy: column, sortDirection: prev.sortBy === column ? (prev.sortDirection === 'asc' ? 'desc' : 'asc') : 'asc' }))}
                                    className="no-print-sort whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 cursor-pointer select-none hover:bg-slate-100 group"
                                  >
                                    <span className="inline-flex items-center gap-1">
                                      {getBaptismReportColumnLabel(column, true)}
                                      <span className="print:hidden text-slate-300 group-hover:text-slate-500 transition-colors">{baptismReportBuilder.sortBy === column ? (baptismReportBuilder.sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ⇅'}</span>
                                    </span>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {baptismFilteredRows.map((row, index) => (
                                <tr key={row.id} style={baptismReportBuilder.zebraEnabled && index % 2 === 1 ? { backgroundColor: baptismReportBuilder.zebraColor } : undefined}>
                                  {baptismReportBuilder.columns.map((column) => (
                                    <td key={`${row.id}-${column}`} className="whitespace-nowrap px-4 py-3 text-slate-700">
                                      {getBaptismPreviewColumnValue(row, column)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    <div className="overflow-hidden rounded-xl bg-slate-50/60">
                      <div className="px-2 py-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tabela final de totais</p>
                      </div>
                      {renderFinalSummarySection(
                        baptismReportSummary.totalRows,
                        baptismReportSummary.metricTotal,
                        baptismFinalSummaryBlocks.map((block) => ({ id: block.column, label: block.label, items: block.items })),
                        'text-sky-900 bg-sky-50',
                      )}
                    </div>
                    <div className="px-1 text-xs font-medium text-slate-600">
                      Total geral: {formatMetric(baptismReportSummary.metricTotal)} | Registros: {formatMetric(baptismFilteredRows.length)}
                    </div>
                  </div>
                </div>

                <div className="min-h-0 overflow-y-auto border-t border-slate-200 bg-slate-50/70 xl:border-t-0 xl:border-l xl:border-slate-200">
                  <div className="space-y-5 p-5">
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                          <Save className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Modelos salvos</p>
                          <p className="text-sm text-slate-600">Dê um nome ao relatório atual para abrir, editar, duplicar e imprimir depois sem montar tudo de novo.</p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        <label className="space-y-2 text-sm text-slate-700">
                          <span className="font-semibold text-slate-900">Nome do modelo</span>
                          <input
                            type="text"
                            value={baptismReportTemplateName}
                            onChange={(event) => setBaptismReportTemplateName(event.target.value)}
                            placeholder="Ex.: Batismos pendentes por igreja"
                            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-sky-400"
                          />
                        </label>

                        <div className="grid gap-2">
                          <button
                            type="button"
                            onClick={handleSaveBaptismReportTemplate}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                          >
                            <Save className="h-4 w-4" />
                            {activeBaptismReportTemplateId ? 'Atualizar modelo' : 'Salvar modelo'}
                          </button>
                          <button
                            type="button"
                            onClick={handleStartNewBaptismReportTemplate}
                            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Novo modelo
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateBaptismReportTemplate()}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            <Copy className="h-4 w-4" />
                            Duplicar modelo atual
                          </button>
                        </div>

                        {activeBaptismReportTemplate ? (
                          <div className={`rounded-2xl px-4 py-3 text-sm ${isBaptismReportTemplateDirty ? 'border border-amber-200 bg-amber-50 text-amber-800' : 'border border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                            {isBaptismReportTemplateDirty ? 'Existem alterações não salvas neste modelo.' : 'O preview já está sincronizado com o modelo salvo.'}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                            Salve a configuração atual para reaproveitar esse relatório depois.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Lista de relatórios salvos</p>
                          <p className="mt-1 text-sm text-slate-600">Clique em um modelo para carregar o esquema pronto e imprimir.</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">{baptismReportTemplates.length} salvo(s)</span>
                      </div>

                      <div className="mt-4 space-y-3">
                        {baptismReportTemplates.length ? baptismReportTemplates.map((template) => {
                          const isActive = template.id === activeBaptismReportTemplateId;
                          return (
                            <div key={template.id} className={`rounded-2xl border p-4 transition ${isActive ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                              <button type="button" onClick={() => handleLoadBaptismReportTemplate(template)} className="w-full text-left">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className={`truncate text-sm font-semibold ${isActive ? 'text-sky-900' : 'text-slate-900'}`}>{template.name}</p>
                                    <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-500">
                                      {BAPTISM_REPORT_TYPE_OPTIONS.find((option) => option.value === template.builder.reportType)?.label || 'Relatório'}
                                    </p>
                                  </div>
                                  {isActive ? <span className="rounded-full bg-sky-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-sky-700">Ativo</span> : null}
                                </div>
                                <div className="mt-3 space-y-2 text-xs text-slate-600">
                                  <div>Agrupamento: {template.builder.groupBy.length ? template.builder.groupBy.map((group) => BAPTISM_REPORT_GROUP_OPTIONS.find((option) => option.value === group)?.label || group).join(' > ') : 'Sem agrupamento'}</div>
                                  <div>Colunas: {template.builder.columns.length}</div>
                                  <div>Atualizado em: {formatDate(template.updatedAt)}</div>
                                </div>
                              </button>
                              <div className="mt-3 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleLoadBaptismReportTemplate(template)}
                                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white"
                                >
                                  Carregar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDuplicateBaptismReportTemplate(template)}
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBaptismReportTemplate(template.id)}
                                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          );
                        }) : (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                            Nenhum modelo salvo ainda. Monte o relatório atual, dê um nome e clique em salvar.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                          <LayoutDashboard className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Resumo operacional</p>
                          <p className="text-sm text-slate-600">O relatório lê a fila central de cards e separa os grupos do jeito que a secretaria precisa.</p>
                        </div>
                      </div>
                      <div className="mt-4 space-y-3 text-sm text-slate-700">
                        <div className="rounded-2xl bg-slate-100 px-4 py-3 font-semibold">Registros filtrados: {formatMetric(baptismReportSummary.totalRows)}</div>
                        <div className="rounded-2xl bg-amber-50 px-4 py-3 font-semibold text-amber-800">Pendentes: {formatMetric(baptismReportSummary.pendingRows)}</div>
                        <div className="rounded-2xl bg-emerald-50 px-4 py-3 font-semibold text-emerald-800">Aprovados: {formatMetric(baptismReportSummary.approvedRows)}</div>
                        <div className="rounded-2xl bg-rose-50 px-4 py-3 font-semibold text-rose-800">Cancelados: {formatMetric(baptismReportSummary.cancelledRows)}</div>
                        <div className="rounded-2xl border border-slate-200 px-4 py-3">Agrupamento: {baptismReportSummary.activeGrouping}</div>
                        <div className="rounded-2xl border border-slate-200 px-4 py-3">Colunas ativas: {formatMetric(baptismReportSummary.activeColumns)}</div>
                        <div className="rounded-2xl border border-slate-200 px-4 py-3">Filtros ativos: {formatMetric(baptismReportSummary.activeFilters)}</div>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Escopo de impressão</p>
                      <div className="mt-4 space-y-3 text-sm text-slate-700">
                        <div className="rounded-2xl border border-slate-200 px-4 py-3"><strong>Igrejas:</strong> {baptismSelectedChurchNames}</div>
                        <div className="rounded-2xl border border-slate-200 px-4 py-3"><strong>Período:</strong> {baptismPrintPeriod}</div>
                        <div className="rounded-2xl border border-slate-200 px-4 py-3"><strong>Responsável:</strong> {String(printResponsible).toUpperCase()}</div>
                        <div className="rounded-2xl border border-slate-200 px-4 py-3"><strong>Data:</strong> {printDate}</div>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fonte central</p>
                      <div className="mt-4 space-y-3 text-sm text-slate-700">
                        <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                          <div className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-900" />
                          <p>Usa cards do fluxo de batismo e a coluna atual do pipeline como centro do relatório.</p>
                        </div>
                        <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                          <div className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-900" />
                          <p>Preserva apenas os campos básicos do membro: nome, igreja, título e situação.</p>
                        </div>
                        <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                          <div className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-900" />
                          <p>Permite listas de pendentes, aprovados e demais etapas por campo, regional e igreja.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : isConsecrationReport ? (
              <div className="grid min-h-0 flex-1 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)_300px] 2xl:grid-cols-[400px_minmax(0,1fr)_340px]">
                <div className="min-h-0 overflow-y-auto border-r border-sky-200 bg-[linear-gradient(180deg,#ecfdf5_0%,#f8fafc_22%,#ffffff_100%)]">
                  <div className="space-y-5 p-5">
                    <div className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                          <ClipboardList className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tipo de relatório</p>
                          <p className="text-sm text-slate-600">Mesma camada de personalização externa do batismo aplicada ao fluxo de consagração.</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2">
                        {CONSECRATION_REPORT_TYPE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleConsecrationReportTypeChange(option.value)}
                            className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${consecrationReportBuilder.reportType === option.value ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                          <Filter className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Filtros</p>
                          <p className="text-sm text-slate-600">Território, etapa, situação do membro e período operacional.</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-4">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                          <label className="space-y-2 text-sm text-slate-700">
                            <span className="font-semibold text-slate-900">Data inicial</span>
                            <input type="date" value={consecrationReportBuilder.dateFrom} onChange={(event) => setConsecrationReportBuilder((current) => ({ ...current, dateFrom: event.target.value }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-400" />
                          </label>
                          <label className="space-y-2 text-sm text-slate-700">
                            <span className="font-semibold text-slate-900">Data final</span>
                            <input type="date" value={consecrationReportBuilder.dateTo} onChange={(event) => setConsecrationReportBuilder((current) => ({ ...current, dateTo: event.target.value }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-400" />
                          </label>
                        </div>
                        <MultiSelectDropdown label="Campos" emptyLabel="Todos os campos" selectedValues={consecrationReportBuilder.fieldIds} options={fields.map((field) => ({ value: field.id, label: field.name, disabled: hasFixedCampoScope }))} disabled={hasFixedCampoScope} onToggle={(fieldId, checked) => setConsecrationReportBuilder((current) => {
                          const nextFieldIds = checked ? Array.from(new Set([...current.fieldIds, fieldId])) : current.fieldIds.filter((item) => item !== fieldId);
                          return {
                            ...current,
                            fieldIds: nextFieldIds,
                            regionalIds: current.regionalIds.filter((regionalId) => {
                              const regional = regionais.find((item) => item.id === regionalId);
                              return regional ? nextFieldIds.includes(regional.campoId) : true;
                            }),
                            churchIds: [],
                          };
                        })} />
                        <MultiSelectDropdown label="Regionais" emptyLabel="Todas as regionais" selectedValues={consecrationReportBuilder.regionalIds} options={consecrationReportRegionais.map((regional) => ({ value: regional.id, label: regional.name, disabled: hasFixedChurchScope && Boolean(storedUser.regionalId) }))} disabled={hasFixedChurchScope && Boolean(storedUser.regionalId)} onToggle={(regionalId, checked) => setConsecrationReportBuilder((current) => ({ ...current, regionalIds: checked ? Array.from(new Set([...current.regionalIds, regionalId])) : current.regionalIds.filter((item) => item !== regionalId), churchIds: [] }))} />
                        <MultiSelectDropdown label="Igrejas" emptyLabel="Todas as igrejas" selectedValues={consecrationReportBuilder.churchIds} options={consecrationReportChurches.map((church) => ({ value: church.id, label: church.name, disabled: hasFixedChurchScope && Boolean(storedUser.churchId) }))} disabled={hasFixedChurchScope && Boolean(storedUser.churchId)} onToggle={(churchId, checked) => setConsecrationReportBuilder((current) => ({ ...current, churchIds: checked ? Array.from(new Set([...current.churchIds, churchId])) : current.churchIds.filter((item) => item !== churchId) }))} />
                        <MultiSelectDropdown label="Etapas do fluxo" emptyLabel="Todas as etapas" selectedValues={consecrationReportBuilder.workflowStatuses} options={consecrationWorkflowStatusOptions.map((status) => ({ value: status, label: status }))} onToggle={(status, checked) => setConsecrationReportBuilder((current) => ({ ...current, workflowStatuses: checked ? Array.from(new Set([...current.workflowStatuses, status])) : current.workflowStatuses.filter((item) => item !== status) }))} />
                        <MultiSelectDropdown label="Situação do membro" emptyLabel="Todas as situações" selectedValues={consecrationReportBuilder.memberStatuses} options={consecrationMemberStatusOptions.map((status) => ({ value: status, label: status }))} onToggle={(status, checked) => setConsecrationReportBuilder((current) => ({ ...current, memberStatuses: checked ? Array.from(new Set([...current.memberStatuses, status])) : current.memberStatuses.filter((item) => item !== status) }))} />
                        <MultiSelectDropdown
                          label="Tipo de membro"
                          emptyLabel="Todos os tipos"
                          selectedValues={consecrationReportBuilder.memberTypes}
                          options={[
                            { value: 'MEMBRO', label: 'Membro' },
                            { value: 'PF', label: 'PF – Pessoa Física' },
                            { value: 'PJ', label: 'PJ – Pessoa Jurídica' },
                          ]}
                          onToggle={(tipo, checked) => setConsecrationReportBuilder((current) => ({
                            ...current,
                            memberTypes: checked ? Array.from(new Set([...current.memberTypes, tipo])) : current.memberTypes.filter((item) => item !== tipo),
                          }))}
                        />
                      </div>
                    </div>

                    <div className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Agrupar por</p>
                          <p className="mt-1 text-sm text-slate-600">Monte a hierarquia por etapa, território e progressão de títulos.</p>
                        </div>
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">{consecrationReportBuilder.groupBy.length} níveis</span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {CONSECRATION_REPORT_GROUP_OPTIONS.map((option) => {
                          const active = consecrationReportBuilder.groupBy.includes(option.value);
                          const currentIndex = consecrationReportBuilder.groupBy.indexOf(option.value);
                          return (
                            <div key={option.value} className={`rounded-2xl border px-3 py-3 ${active ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                              <button type="button" onClick={() => toggleConsecrationGroupField(option.value)} className={`text-sm font-semibold ${active ? 'text-emerald-700' : 'text-slate-700'}`}>
                                {active ? `${currentIndex + 1}. ${option.label}` : option.label}
                              </button>
                              {active ? (
                                <div className="mt-3 flex gap-2">
                                  <button type="button" onClick={(event) => { event.stopPropagation(); moveConsecrationGroupField(option.value, 'up'); }} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40" disabled={currentIndex === 0}>Subir</button>
                                  <button type="button" onClick={(event) => { event.stopPropagation(); moveConsecrationGroupField(option.value, 'down'); }} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40" disabled={currentIndex === consecrationReportBuilder.groupBy.length - 1}>Descer</button>
                                  <button type="button" onClick={(event) => { event.stopPropagation(); removeConsecrationGroupField(option.value); }} className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100">Remover</button>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Colunas visíveis</p>
                          <p className="mt-1 text-sm text-slate-600">Escolha, ordene e refine exatamente o que sai no relatório.</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">{consecrationReportBuilder.columns.length} colunas</span>
                      </div>
                      <div className="mt-4 grid gap-2">
                        {CONSECRATION_REPORT_COLUMN_OPTIONS.map((option) => {
                          const active = consecrationReportBuilder.columns.includes(option.value);
                          const columnIndex = consecrationReportBuilder.columns.indexOf(option.value);
                          return (
                            <div key={option.value} className={`rounded-2xl border px-4 py-3 text-sm ${active ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700'}`}>
                              <div className="flex items-center justify-between gap-3">
                                <label className="flex items-center gap-3 font-semibold">
                                  <input type="checkbox" checked={active} onChange={() => toggleConsecrationReportColumn(option.value)} className="h-4 w-4 rounded border-slate-300" />
                                  <span>{option.label}</span>
                                </label>
                                {active ? (
                                  <div className="flex gap-2">
                                    <button type="button" onClick={() => moveConsecrationReportColumn(option.value, 'up')} disabled={columnIndex === 0} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40">Subir</button>
                                    <button type="button" onClick={() => moveConsecrationReportColumn(option.value, 'down')} disabled={columnIndex === consecrationReportBuilder.columns.length - 1} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40">Descer</button>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ordenação e saída</p>
                      <div className="mt-4 grid gap-4">
                        <label className="space-y-2 text-sm text-slate-700">
                          <span className="font-semibold text-slate-900">Métrica</span>
                          <select value={consecrationReportBuilder.metric} onChange={(event) => setConsecrationReportBuilder((current) => ({ ...current, metric: event.target.value as ConsecrationReportMetricKey }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-400">
                            {CONSECRATION_REPORT_METRIC_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </label>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                          <label className="space-y-2 text-sm text-slate-700">
                            <span className="font-semibold text-slate-900">Ordenar por</span>
                            <select value={consecrationReportBuilder.sortBy} onChange={(event) => setConsecrationReportBuilder((current) => ({ ...current, sortBy: event.target.value as ConsecrationReportColumnKey }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-400">
                              {consecrationReportBuilder.columns.map((column) => <option key={column} value={column}>{getConsecrationReportColumnLabel(column)}</option>)}
                            </select>
                          </label>
                          <label className="space-y-2 text-sm text-slate-700">
                            <span className="font-semibold text-slate-900">Direção</span>
                            <select value={consecrationReportBuilder.sortDirection} onChange={(event) => setConsecrationReportBuilder((current) => ({ ...current, sortDirection: event.target.value as MemberReportSortDirection }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-400">
                              <option value="asc">Ascendente</option>
                              <option value="desc">Descendente</option>
                            </select>
                          </label>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Orientação da impressão</p>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setConsecrationReportBuilder((current) => ({ ...current, orientation: 'portrait' }))} className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${consecrationReportBuilder.orientation === 'portrait' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>Retrato</button>
                            <button type="button" onClick={() => setConsecrationReportBuilder((current) => ({ ...current, orientation: 'landscape' }))} className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${consecrationReportBuilder.orientation === 'landscape' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>Paisagem</button>
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-[1fr_auto] xl:grid-cols-1">
                          <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
                            <span>Zebrado</span>
                            <input type="checkbox" checked={consecrationReportBuilder.zebraEnabled} onChange={(event) => setConsecrationReportBuilder((current) => ({ ...current, zebraEnabled: event.target.checked }))} className="h-4 w-4 rounded border-slate-300" />
                          </label>
                          <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
                            <span>Cor do zebrado</span>
                            <input type="color" value={consecrationReportBuilder.zebraColor} onChange={(event) => setConsecrationReportBuilder((current) => ({ ...current, zebraColor: event.target.value }))} className="h-10 w-16 rounded-lg border border-slate-200 bg-white" />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 flex-col overflow-hidden bg-white">
                  <div className="shrink-0 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Preview em tempo real</p>
                      <p className="mt-1 text-sm text-slate-600">Fila de consagração pronta para impressão, Excel e reaproveitamento em modelo.</p>
                    </div>
                    {activeConsecrationReportTemplate ? (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Modelo ativo</p>
                        <p className="mt-1 text-sm font-semibold text-emerald-900">{activeConsecrationReportTemplate.name}</p>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Base ativa</p>
                        <p className="mt-1 text-sm font-semibold text-emerald-900">Cards e columns de consagração</p>
                      </div>
                    )}
                  </div>

                  <div id="consecration-report-preview-root" className="min-h-0 flex-1 space-y-5 overflow-auto px-6 py-5">
                    {loading ? (
                      <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
                        <span className="ml-3 text-sm text-slate-500">Carregando consagrações...</span>
                      </div>
                    ) : consecrationReportBuilder.groupBy.length > 0 ? (
                      <div className="space-y-5">{renderConsecrationPreviewGroups(consecrationPreviewGroups)}</div>
                    ) : (
                      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                        <div className="overflow-x-auto">
                          <table className="report-table min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-50">
                              <tr>
                                {consecrationReportBuilder.columns.map((column) => (
                                  <th
                                    key={column}
                                    onClick={() => setConsecrationReportBuilder((prev) => ({ ...prev, sortBy: column, sortDirection: prev.sortBy === column ? (prev.sortDirection === 'asc' ? 'desc' : 'asc') : 'asc' }))}
                                    className="no-print-sort whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 cursor-pointer select-none hover:bg-slate-100 group"
                                  >
                                    <span className="inline-flex items-center gap-1">
                                      {getConsecrationReportColumnLabel(column, true)}
                                      <span className="print:hidden text-slate-300 group-hover:text-slate-500 transition-colors">{consecrationReportBuilder.sortBy === column ? (consecrationReportBuilder.sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ⇅'}</span>
                                    </span>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {consecrationFilteredRows.map((row, index) => (
                                <tr key={row.id} style={consecrationReportBuilder.zebraEnabled && index % 2 === 1 ? { backgroundColor: consecrationReportBuilder.zebraColor } : undefined}>
                                  {consecrationReportBuilder.columns.map((column) => (
                                    <td key={`${row.id}-${column}`} className="whitespace-nowrap px-4 py-3 text-slate-700">
                                      {getConsecrationPreviewColumnValue(row, column)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {!consecrationFilteredRows.length ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">Nenhum card encontrado com os filtros atuais.</div> : null}

                    <div className="overflow-hidden rounded-xl bg-slate-50/60">
                      <div className="px-2 py-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tabela final de totais</p>
                      </div>
                      {renderFinalSummarySection(
                        consecrationReportSummary.totalRows,
                        consecrationReportSummary.metricTotal,
                        consecrationFinalSummaryBlocks.map((block) => ({ id: block.column, label: block.label, items: block.items })),
                        'text-emerald-900 bg-emerald-50',
                      )}
                    </div>

                    <div className="px-1 text-xs font-medium text-slate-600">
                      Total geral: {formatMetric(consecrationReportSummary.metricTotal)} | Registros: {formatMetric(consecrationFilteredRows.length)}
                    </div>
                  </div>
                </div>

                <div className="min-h-0 overflow-y-auto border-t border-slate-200 bg-slate-50/70 xl:border-t-0 xl:border-l xl:border-slate-200">
                  <div className="space-y-5 p-5">
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                          <Save className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Modelos salvos</p>
                          <p className="text-sm text-slate-600">Salve, carregue, duplique e refine relatórios de consagração prontos.</p>
                        </div>
                      </div>
                      <div className="mt-4 space-y-3">
                        <label className="space-y-2 text-sm text-slate-700">
                          <span className="font-semibold text-slate-900">Nome do modelo</span>
                          <input type="text" value={consecrationReportTemplateName} onChange={(event) => setConsecrationReportTemplateName(event.target.value)} placeholder="Ex.: Consagração por título" className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-400" />
                        </label>
                        <div className="grid gap-2">
                          <button type="button" onClick={handleSaveConsecrationReportTemplate} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"><Save className="h-4 w-4" />{activeConsecrationReportTemplateId ? 'Atualizar modelo' : 'Salvar modelo'}</button>
                          <button type="button" onClick={handleStartNewConsecrationReportTemplate} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Novo modelo</button>
                          <button type="button" onClick={() => handleDuplicateConsecrationReportTemplate()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"><Copy className="h-4 w-4" />Duplicar modelo atual</button>
                        </div>
                        {activeConsecrationReportTemplate ? (
                          <div className={`rounded-2xl px-4 py-3 text-sm ${isConsecrationReportTemplateDirty ? 'border border-amber-200 bg-amber-50 text-amber-800' : 'border border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                            {isConsecrationReportTemplateDirty ? 'Existem alterações não salvas neste modelo.' : 'O preview já está sincronizado com o modelo salvo.'}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Salve a configuração atual para reaproveitar esse relatório depois.</div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Lista de relatórios salvos</p>
                          <p className="mt-1 text-sm text-slate-600">Abra um modelo pronto e continue ajustando sem perder a base.</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">{consecrationReportTemplates.length} salvo(s)</span>
                      </div>
                      <div className="mt-4 space-y-3">
                        {consecrationReportTemplates.length ? consecrationReportTemplates.map((template) => {
                          const isActive = template.id === activeConsecrationReportTemplateId;
                          return (
                            <div key={template.id} className={`rounded-2xl border p-4 transition ${isActive ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                              <button type="button" onClick={() => handleLoadConsecrationReportTemplate(template)} className="w-full text-left">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className={`truncate text-sm font-semibold ${isActive ? 'text-emerald-900' : 'text-slate-900'}`}>{template.name}</p>
                                    <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-500">{CONSECRATION_REPORT_TYPE_OPTIONS.find((option) => option.value === template.builder.reportType)?.label || 'Relatório'}</p>
                                  </div>
                                  {isActive ? <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-700">Ativo</span> : null}
                                </div>
                                <div className="mt-3 space-y-2 text-xs text-slate-600">
                                  <div>Agrupamento: {template.builder.groupBy.length ? template.builder.groupBy.map((group) => CONSECRATION_REPORT_GROUP_OPTIONS.find((option) => option.value === group)?.label || group).join(' > ') : 'Sem agrupamento'}</div>
                                  <div>Colunas: {template.builder.columns.length}</div>
                                  <div>Atualizado em: {formatDate(template.updatedAt)}</div>
                                </div>
                              </button>
                              <div className="mt-3 flex gap-2">
                                <button type="button" onClick={() => handleLoadConsecrationReportTemplate(template)} className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white">Carregar</button>
                                <button type="button" onClick={() => handleDuplicateConsecrationReportTemplate(template)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"><Copy className="h-4 w-4" /></button>
                                <button type="button" onClick={() => handleDeleteConsecrationReportTemplate(template.id)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"><Trash2 className="h-4 w-4" /></button>
                              </div>
                            </div>
                          );
                        }) : (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Nenhum modelo salvo ainda. Monte o relatório atual, dê um nome e clique em salvar.</div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                          <LayoutDashboard className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Resumo operacional</p>
                          <p className="text-sm text-slate-600">Acompanhe volumes por etapa e a configuração ativa do relatório.</p>
                        </div>
                      </div>
                      <div className="mt-4 space-y-3 text-sm text-slate-700">
                        <div className="rounded-2xl bg-slate-100 px-4 py-3 font-semibold">Registros filtrados: {formatMetric(consecrationReportSummary.totalRows)}</div>
                        <div className="rounded-2xl bg-amber-50 px-4 py-3 font-semibold text-amber-800">Pendentes: {formatMetric(consecrationReportSummary.pendingRows)}</div>
                        <div className="rounded-2xl bg-sky-50 px-4 py-3 font-semibold text-sky-800">Aprovados: {formatMetric(consecrationReportSummary.approvedRows)}</div>
                        <div className="rounded-2xl bg-emerald-50 px-4 py-3 font-semibold text-emerald-800">Concluídos: {formatMetric(consecrationReportSummary.completedRows)}</div>
                        <div className="rounded-2xl border border-slate-200 px-4 py-3">Agrupamento: {consecrationReportSummary.activeGrouping}</div>
                        <div className="rounded-2xl border border-slate-200 px-4 py-3">Colunas ativas: {formatMetric(consecrationReportSummary.activeColumns)}</div>
                        <div className="rounded-2xl border border-slate-200 px-4 py-3">Filtros ativos: {formatMetric(consecrationReportSummary.activeFilters)}</div>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Escopo de impressão</p>
                      <div className="mt-4 space-y-3 text-sm text-slate-700">
                        <div className="rounded-2xl border border-slate-200 px-4 py-3"><strong>Igrejas:</strong> {consecrationSelectedChurchNames}</div>
                        <div className="rounded-2xl border border-slate-200 px-4 py-3"><strong>Período:</strong> {consecrationPrintPeriod}</div>
                        <div className="rounded-2xl border border-slate-200 px-4 py-3"><strong>Responsável:</strong> {String(printResponsible).toUpperCase()}</div>
                        <div className="rounded-2xl border border-slate-200 px-4 py-3"><strong>Data:</strong> {printDate}</div>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fonte central</p>
                      <div className="mt-4 space-y-3 text-sm text-slate-700">
                        <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"><div className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-900" /><p>Usa cards do fluxo de consagração e a coluna atual do pipeline como base principal.</p></div>
                        <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"><div className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-900" /><p>Permite cruzar título atual, título pretendido, situação do membro e etapa do fluxo.</p></div>
                        <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"><div className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-900" /><p>Preserva a mesma personalização externa já disponível no builder de batismo.</p></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : isTransferReport ? (
              <div className="grid min-h-0 flex-1 lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)_300px] 2xl:grid-cols-[400px_minmax(0,1fr)_340px]">
                <div className="min-h-0 overflow-y-auto border-r border-sky-200 bg-[linear-gradient(180deg,#fff7ed_0%,#f8fafc_22%,#ffffff_100%)]">
                  <div className="space-y-5 p-5">
                    <div className="rounded-3xl border border-orange-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
                          <ClipboardList className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tipo de relatório</p>
                          <p className="text-sm text-slate-600">Mesma personalização externa do batismo aplicada ao fluxo de transferência.</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-2">
                        {TRANSFER_REPORT_TYPE_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => handleTransferReportTypeChange(option.value)}
                            className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${transferReportBuilder.reportType === option.value ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-orange-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                          <Filter className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Filtros</p>
                          <p className="text-sm text-slate-600">Origem, destino, etapa, situação do membro e período operacional.</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-4">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                          <label className="space-y-2 text-sm text-slate-700">
                            <span className="font-semibold text-slate-900">Data inicial</span>
                            <input type="date" value={transferReportBuilder.dateFrom} onChange={(event) => setTransferReportBuilder((current) => ({ ...current, dateFrom: event.target.value }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-orange-400" />
                          </label>
                          <label className="space-y-2 text-sm text-slate-700">
                            <span className="font-semibold text-slate-900">Data final</span>
                            <input type="date" value={transferReportBuilder.dateTo} onChange={(event) => setTransferReportBuilder((current) => ({ ...current, dateTo: event.target.value }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-orange-400" />
                          </label>
                        </div>
                        <MultiSelectDropdown label="Campos de origem" emptyLabel="Todos os campos" selectedValues={transferReportBuilder.fieldIds} options={fields.map((field) => ({ value: field.id, label: field.name, disabled: hasFixedCampoScope }))} disabled={hasFixedCampoScope} onToggle={(fieldId, checked) => setTransferReportBuilder((current) => {
                          const nextFieldIds = checked ? Array.from(new Set([...current.fieldIds, fieldId])) : current.fieldIds.filter((item) => item !== fieldId);
                          return {
                            ...current,
                            fieldIds: nextFieldIds,
                            regionalIds: current.regionalIds.filter((regionalId) => {
                              const regional = regionais.find((item) => item.id === regionalId);
                              return regional ? nextFieldIds.includes(regional.campoId) : true;
                            }),
                            churchIds: [],
                          };
                        })} />
                        <MultiSelectDropdown label="Regionais de origem" emptyLabel="Todas as regionais" selectedValues={transferReportBuilder.regionalIds} options={transferReportRegionais.map((regional) => ({ value: regional.id, label: regional.name, disabled: hasFixedChurchScope && Boolean(storedUser.regionalId) }))} disabled={hasFixedChurchScope && Boolean(storedUser.regionalId)} onToggle={(regionalId, checked) => setTransferReportBuilder((current) => ({ ...current, regionalIds: checked ? Array.from(new Set([...current.regionalIds, regionalId])) : current.regionalIds.filter((item) => item !== regionalId), churchIds: [] }))} />
                        <MultiSelectDropdown label="Igrejas de origem" emptyLabel="Todas as igrejas" selectedValues={transferReportBuilder.churchIds} options={transferReportOriginChurches.map((church) => ({ value: church.id, label: church.name, disabled: hasFixedChurchScope && Boolean(storedUser.churchId) }))} disabled={hasFixedChurchScope && Boolean(storedUser.churchId)} onToggle={(churchId, checked) => setTransferReportBuilder((current) => ({ ...current, churchIds: checked ? Array.from(new Set([...current.churchIds, churchId])) : current.churchIds.filter((item) => item !== churchId) }))} />
                        <MultiSelectDropdown label="Igrejas de destino" emptyLabel="Todos os destinos" selectedValues={transferReportBuilder.destinationChurchIds} options={transferReportDestinationChurches.map((church) => ({ value: church.id, label: church.name }))} onToggle={(churchId, checked) => setTransferReportBuilder((current) => ({ ...current, destinationChurchIds: checked ? Array.from(new Set([...current.destinationChurchIds, churchId])) : current.destinationChurchIds.filter((item) => item !== churchId) }))} />
                        <MultiSelectDropdown label="Etapas do fluxo" emptyLabel="Todas as etapas" selectedValues={transferReportBuilder.workflowStatuses} options={transferWorkflowStatusOptions.map((status) => ({ value: status, label: status }))} onToggle={(status, checked) => setTransferReportBuilder((current) => ({ ...current, workflowStatuses: checked ? Array.from(new Set([...current.workflowStatuses, status])) : current.workflowStatuses.filter((item) => item !== status) }))} />
                        <MultiSelectDropdown label="Situação do membro" emptyLabel="Todas as situações" selectedValues={transferReportBuilder.memberStatuses} options={transferMemberStatusOptions.map((status) => ({ value: status, label: status }))} onToggle={(status, checked) => setTransferReportBuilder((current) => ({ ...current, memberStatuses: checked ? Array.from(new Set([...current.memberStatuses, status])) : current.memberStatuses.filter((item) => item !== status) }))} />
                      </div>
                    </div>

                    <div className="rounded-3xl border border-orange-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Agrupar por</p>
                          <p className="mt-1 text-sm text-slate-600">Estruture a saída por origem, destino, etapa e situação do membro.</p>
                        </div>
                        <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-orange-700">{transferReportBuilder.groupBy.length} níveis</span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {TRANSFER_REPORT_GROUP_OPTIONS.map((option) => {
                          const active = transferReportBuilder.groupBy.includes(option.value);
                          const currentIndex = transferReportBuilder.groupBy.indexOf(option.value);
                          return (
                            <div key={option.value} className={`rounded-2xl border px-3 py-3 ${active ? 'border-orange-500 bg-orange-50' : 'border-slate-200 bg-white'}`}>
                              <button type="button" onClick={() => toggleTransferGroupField(option.value)} className={`text-sm font-semibold ${active ? 'text-orange-700' : 'text-slate-700'}`}>
                                {active ? `${currentIndex + 1}. ${option.label}` : option.label}
                              </button>
                              {active ? (
                                <div className="mt-3 flex gap-2">
                                  <button type="button" onClick={(event) => { event.stopPropagation(); moveTransferGroupField(option.value, 'up'); }} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40" disabled={currentIndex === 0}>Subir</button>
                                  <button type="button" onClick={(event) => { event.stopPropagation(); moveTransferGroupField(option.value, 'down'); }} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40" disabled={currentIndex === transferReportBuilder.groupBy.length - 1}>Descer</button>
                                  <button type="button" onClick={(event) => { event.stopPropagation(); removeTransferGroupField(option.value); }} className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100">Remover</button>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-orange-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Colunas visíveis</p>
                          <p className="mt-1 text-sm text-slate-600">Escolha e ordene os dados de origem, destino e status que entram na saída.</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">{transferReportBuilder.columns.length} colunas</span>
                      </div>
                      <div className="mt-4 grid gap-2">
                        {TRANSFER_REPORT_COLUMN_OPTIONS.map((option) => {
                          const active = transferReportBuilder.columns.includes(option.value);
                          const columnIndex = transferReportBuilder.columns.indexOf(option.value);
                          return (
                            <div key={option.value} className={`rounded-2xl border px-4 py-3 text-sm ${active ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-700'}`}>
                              <div className="flex items-center justify-between gap-3">
                                <label className="flex items-center gap-3 font-semibold">
                                  <input type="checkbox" checked={active} onChange={() => toggleTransferReportColumn(option.value)} className="h-4 w-4 rounded border-slate-300" />
                                  <span>{option.label}</span>
                                </label>
                                {active ? (
                                  <div className="flex gap-2">
                                    <button type="button" onClick={() => moveTransferReportColumn(option.value, 'up')} disabled={columnIndex === 0} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40">Subir</button>
                                    <button type="button" onClick={() => moveTransferReportColumn(option.value, 'down')} disabled={columnIndex === transferReportBuilder.columns.length - 1} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 disabled:opacity-40">Descer</button>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-orange-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ordenação e saída</p>
                      <div className="mt-4 grid gap-4">
                        <label className="space-y-2 text-sm text-slate-700">
                          <span className="font-semibold text-slate-900">Métrica</span>
                          <select value={transferReportBuilder.metric} onChange={(event) => setTransferReportBuilder((current) => ({ ...current, metric: event.target.value as TransferReportMetricKey }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-orange-400">
                            {TRANSFER_REPORT_METRIC_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                          </select>
                        </label>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
                          <label className="space-y-2 text-sm text-slate-700">
                            <span className="font-semibold text-slate-900">Ordenar por</span>
                            <select value={transferReportBuilder.sortBy} onChange={(event) => setTransferReportBuilder((current) => ({ ...current, sortBy: event.target.value as TransferReportColumnKey }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-orange-400">
                              {transferReportBuilder.columns.map((column) => <option key={column} value={column}>{getTransferReportColumnLabel(column)}</option>)}
                            </select>
                          </label>
                          <label className="space-y-2 text-sm text-slate-700">
                            <span className="font-semibold text-slate-900">Direção</span>
                            <select value={transferReportBuilder.sortDirection} onChange={(event) => setTransferReportBuilder((current) => ({ ...current, sortDirection: event.target.value as MemberReportSortDirection }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-orange-400">
                              <option value="asc">Ascendente</option>
                              <option value="desc">Descendente</option>
                            </select>
                          </label>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Orientação da impressão</p>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <button type="button" onClick={() => setTransferReportBuilder((current) => ({ ...current, orientation: 'portrait' }))} className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${transferReportBuilder.orientation === 'portrait' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>Retrato</button>
                            <button type="button" onClick={() => setTransferReportBuilder((current) => ({ ...current, orientation: 'landscape' }))} className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${transferReportBuilder.orientation === 'landscape' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>Paisagem</button>
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-[1fr_auto] xl:grid-cols-1">
                          <label className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
                            <span>Zebrado</span>
                            <input type="checkbox" checked={transferReportBuilder.zebraEnabled} onChange={(event) => setTransferReportBuilder((current) => ({ ...current, zebraEnabled: event.target.checked }))} className="h-4 w-4 rounded border-slate-300" />
                          </label>
                          <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
                            <span>Cor do zebrado</span>
                            <input type="color" value={transferReportBuilder.zebraColor} onChange={(event) => setTransferReportBuilder((current) => ({ ...current, zebraColor: event.target.value }))} className="h-10 w-16 rounded-lg border border-slate-200 bg-white" />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 flex-col overflow-hidden bg-white">
                  <div className="shrink-0 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Preview em tempo real</p>
                      <p className="mt-1 text-sm text-slate-600">Transferências prontas para exportação, agrupamento e impressão.</p>
                    </div>
                    {activeTransferReportTemplate ? (
                      <div className="rounded-2xl border border-orange-200 bg-orange-50 px-3 py-2 text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-700">Modelo ativo</p>
                        <p className="mt-1 text-sm font-semibold text-orange-900">{activeTransferReportTemplate.name}</p>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-orange-200 bg-orange-50 px-3 py-2 text-right">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-700">Base ativa</p>
                        <p className="mt-1 text-sm font-semibold text-orange-900">Cards e columns de transferência</p>
                      </div>
                    )}
                  </div>

                  <div id="transfer-report-preview-root" className="min-h-0 flex-1 space-y-5 overflow-auto px-6 py-5">
                    {loading ? (
                      <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
                        <span className="ml-3 text-sm text-slate-500">Carregando transferências...</span>
                      </div>
                    ) : transferReportBuilder.groupBy.length > 0 ? (
                      <div className="space-y-5">{renderTransferPreviewGroups(transferPreviewGroups)}</div>
                    ) : (
                      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
                        <div className="overflow-x-auto">
                          <table className="report-table min-w-full divide-y divide-slate-200 text-sm">
                            <thead className="bg-slate-50">
                              <tr>
                                {transferReportBuilder.columns.map((column) => (
                                  <th
                                    key={column}
                                    onClick={() => setTransferReportBuilder((prev) => ({ ...prev, sortBy: column, sortDirection: prev.sortBy === column ? (prev.sortDirection === 'asc' ? 'desc' : 'asc') : 'asc' }))}
                                    className="no-print-sort whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 cursor-pointer select-none hover:bg-slate-100 group"
                                  >
                                    <span className="inline-flex items-center gap-1">
                                      {getTransferReportColumnLabel(column, true)}
                                      <span className="print:hidden text-slate-300 group-hover:text-slate-500 transition-colors">{transferReportBuilder.sortBy === column ? (transferReportBuilder.sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ⇅'}</span>
                                    </span>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {transferFilteredRows.map((row, index) => (
                                <tr key={row.id} style={transferReportBuilder.zebraEnabled && index % 2 === 1 ? { backgroundColor: transferReportBuilder.zebraColor } : undefined}>
                                  {transferReportBuilder.columns.map((column) => (
                                    <td key={`${row.id}-${column}`} className="whitespace-nowrap px-4 py-3 text-slate-700">
                                      {getTransferPreviewColumnValue(row, column)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {!transferFilteredRows.length ? <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">Nenhum card encontrado com os filtros atuais.</div> : null}

                    <div className="overflow-hidden rounded-xl bg-slate-50/60">
                      <div className="px-2 py-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Tabela final de totais</p>
                      </div>
                      {renderFinalSummarySection(
                        transferReportSummary.totalRows,
                        transferReportSummary.metricTotal,
                        transferFinalSummaryBlocks.map((block) => ({ id: block.column, label: block.label, items: block.items })),
                        'text-orange-900 bg-orange-50',
                      )}
                    </div>

                    <div className="px-1 text-xs font-medium text-slate-600">
                      Total geral: {formatMetric(transferReportSummary.metricTotal)} | Registros: {formatMetric(transferFilteredRows.length)}
                    </div>
                  </div>
                </div>

                <div className="min-h-0 overflow-y-auto border-t border-slate-200 bg-slate-50/70 xl:border-t-0 xl:border-l xl:border-slate-200">
                  <div className="space-y-5 p-5">
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                          <Save className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Modelos salvos</p>
                          <p className="text-sm text-slate-600">Salve e recarregue layouts de transferência com origem, destino e status.</p>
                        </div>
                      </div>
                      <div className="mt-4 space-y-3">
                        <label className="space-y-2 text-sm text-slate-700">
                          <span className="font-semibold text-slate-900">Nome do modelo</span>
                          <input type="text" value={transferReportTemplateName} onChange={(event) => setTransferReportTemplateName(event.target.value)} placeholder="Ex.: Transferências por destino" className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-orange-400" />
                        </label>
                        <div className="grid gap-2">
                          <button type="button" onClick={handleSaveTransferReportTemplate} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"><Save className="h-4 w-4" />{activeTransferReportTemplateId ? 'Atualizar modelo' : 'Salvar modelo'}</button>
                          <button type="button" onClick={handleStartNewTransferReportTemplate} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Novo modelo</button>
                          <button type="button" onClick={() => handleDuplicateTransferReportTemplate()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"><Copy className="h-4 w-4" />Duplicar modelo atual</button>
                        </div>
                        {activeTransferReportTemplate ? (
                          <div className={`rounded-2xl px-4 py-3 text-sm ${isTransferReportTemplateDirty ? 'border border-amber-200 bg-amber-50 text-amber-800' : 'border border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                            {isTransferReportTemplateDirty ? 'Existem alterações não salvas neste modelo.' : 'O preview já está sincronizado com o modelo salvo.'}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Salve a configuração atual para reaproveitar esse relatório depois.</div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Lista de relatórios salvos</p>
                          <p className="mt-1 text-sm text-slate-600">Carregue um modelo pronto e siga editando a partir dele.</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">{transferReportTemplates.length} salvo(s)</span>
                      </div>
                      <div className="mt-4 space-y-3">
                        {transferReportTemplates.length ? transferReportTemplates.map((template) => {
                          const isActive = template.id === activeTransferReportTemplateId;
                          return (
                            <div key={template.id} className={`rounded-2xl border p-4 transition ${isActive ? 'border-orange-500 bg-orange-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                              <button type="button" onClick={() => handleLoadTransferReportTemplate(template)} className="w-full text-left">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className={`truncate text-sm font-semibold ${isActive ? 'text-orange-900' : 'text-slate-900'}`}>{template.name}</p>
                                    <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-500">{TRANSFER_REPORT_TYPE_OPTIONS.find((option) => option.value === template.builder.reportType)?.label || 'Relatório'}</p>
                                  </div>
                                  {isActive ? <span className="rounded-full bg-orange-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-orange-700">Ativo</span> : null}
                                </div>
                                <div className="mt-3 space-y-2 text-xs text-slate-600">
                                  <div>Agrupamento: {template.builder.groupBy.length ? template.builder.groupBy.map((group) => TRANSFER_REPORT_GROUP_OPTIONS.find((option) => option.value === group)?.label || group).join(' > ') : 'Sem agrupamento'}</div>
                                  <div>Colunas: {template.builder.columns.length}</div>
                                  <div>Atualizado em: {formatDate(template.updatedAt)}</div>
                                </div>
                              </button>
                              <div className="mt-3 flex gap-2">
                                <button type="button" onClick={() => handleLoadTransferReportTemplate(template)} className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-white">Carregar</button>
                                <button type="button" onClick={() => handleDuplicateTransferReportTemplate(template)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"><Copy className="h-4 w-4" /></button>
                                <button type="button" onClick={() => handleDeleteTransferReportTemplate(template.id)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"><Trash2 className="h-4 w-4" /></button>
                              </div>
                            </div>
                          );
                        }) : (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">Nenhum modelo salvo ainda. Monte o relatório atual, dê um nome e clique em salvar.</div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                          <LayoutDashboard className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Resumo operacional</p>
                          <p className="text-sm text-slate-600">Acompanhe a movimentação do fluxo e a configuração atual do relatório.</p>
                        </div>
                      </div>
                      <div className="mt-4 space-y-3 text-sm text-slate-700">
                        <div className="rounded-2xl bg-slate-100 px-4 py-3 font-semibold">Registros filtrados: {formatMetric(transferReportSummary.totalRows)}</div>
                        <div className="rounded-2xl bg-amber-50 px-4 py-3 font-semibold text-amber-800">Pendentes: {formatMetric(transferReportSummary.pendingRows)}</div>
                        <div className="rounded-2xl bg-sky-50 px-4 py-3 font-semibold text-sky-800">Aprovados: {formatMetric(transferReportSummary.approvedRows)}</div>
                        <div className="rounded-2xl bg-emerald-50 px-4 py-3 font-semibold text-emerald-800">Concluídos: {formatMetric(transferReportSummary.completedRows)}</div>
                        <div className="rounded-2xl border border-slate-200 px-4 py-3">Agrupamento: {transferReportSummary.activeGrouping}</div>
                        <div className="rounded-2xl border border-slate-200 px-4 py-3">Colunas ativas: {formatMetric(transferReportSummary.activeColumns)}</div>
                        <div className="rounded-2xl border border-slate-200 px-4 py-3">Filtros ativos: {formatMetric(transferReportSummary.activeFilters)}</div>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Escopo de impressão</p>
                      <div className="mt-4 space-y-3 text-sm text-slate-700">
                        <div className="rounded-2xl border border-slate-200 px-4 py-3"><strong>Origem:</strong> {transferSelectedOriginChurchNames}</div>
                        <div className="rounded-2xl border border-slate-200 px-4 py-3"><strong>Destino:</strong> {transferSelectedDestinationChurchNames}</div>
                        <div className="rounded-2xl border border-slate-200 px-4 py-3"><strong>Período:</strong> {transferPrintPeriod}</div>
                        <div className="rounded-2xl border border-slate-200 px-4 py-3"><strong>Responsável:</strong> {String(printResponsible).toUpperCase()}</div>
                        <div className="rounded-2xl border border-slate-200 px-4 py-3"><strong>Data:</strong> {printDate}</div>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Fonte central</p>
                      <div className="mt-4 space-y-3 text-sm text-slate-700">
                        <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"><div className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-900" /><p>Usa os cards do fluxo de transferência e a coluna atual do pipeline como fonte principal.</p></div>
                        <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"><div className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-900" /><p>Permite combinar origem, destino, serviço, situação do membro e etapa operacional.</p></div>
                        <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"><div className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-900" /><p>Mantém a mesma camada externa de personalização já usada no batismo.</p></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : isRequirementsReport ? (
              <div className="grid min-h-0 flex-1 lg:grid-cols-[300px_minmax(0,1fr)_280px] xl:grid-cols-[320px_minmax(0,1fr)_300px] 2xl:grid-cols-[340px_minmax(0,1fr)_320px]">
                {/* ── Left panel: filters ── */}
                <div className="min-h-0 overflow-y-auto border-r border-slate-200 bg-[linear-gradient(180deg,#f0fdf4_0%,#f8fafc_22%,#ffffff_100%)]">
                  <div className="space-y-5 p-5">

                    {/* Date range */}
                    <div className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                          <Calendar className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Período</p>
                          <p className="text-sm text-slate-600">Data de abertura do requerimento.</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3">
                        <label className="space-y-1.5 text-sm text-slate-700">
                          <span className="font-semibold text-slate-900">Data inicial</span>
                          <input type="date" value={requirementsReportBuilder.dateFrom} onChange={(e) => setRequirementsReportBuilder((p) => ({ ...p, dateFrom: e.target.value }))} className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-400" />
                        </label>
                        <label className="space-y-1.5 text-sm text-slate-700">
                          <span className="font-semibold text-slate-900">Data final</span>
                          <input type="date" value={requirementsReportBuilder.dateTo} onChange={(e) => setRequirementsReportBuilder((p) => ({ ...p, dateTo: e.target.value }))} className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-400" />
                        </label>
                      </div>
                    </div>

                    {/* Scope filters */}
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                          <Filter className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Filtros</p>
                          <p className="text-sm text-slate-600">Campo, regional, igreja, situação.</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3">
                        <div>
                          <p className="mb-1.5 text-xs font-semibold text-slate-700">Campo</p>
                          <MultiSelectDropdown
                            label="Campo"
                            emptyLabel="Todos os campos"
                            options={fields.map((f) => ({ value: f.id, label: f.name, disabled: hasFixedCampoScope }))}
                            disabled={hasFixedCampoScope}
                            selectedValues={requirementsReportBuilder.fieldIds}
                            onToggle={(v, checked) => setRequirementsReportBuilder((p) => ({
                              ...p,
                              fieldIds: checked ? Array.from(new Set([...p.fieldIds, v])) : p.fieldIds.filter((x) => x !== v),
                              regionalIds: [],
                              churchIds: [],
                            }))}
                          />
                        </div>
                        <div>
                          <p className="mb-1.5 text-xs font-semibold text-slate-700">Regional</p>
                          <MultiSelectDropdown
                            label="Regional"
                            emptyLabel="Todas as regionais"
                            options={regionais.filter((r) => !requirementsReportBuilder.fieldIds.length || requirementsReportBuilder.fieldIds.includes(r.campoId)).map((r) => ({ value: r.id, label: r.name }))}
                            selectedValues={requirementsReportBuilder.regionalIds}
                            onToggle={(v, checked) => setRequirementsReportBuilder((p) => ({
                              ...p,
                              regionalIds: checked ? Array.from(new Set([...p.regionalIds, v])) : p.regionalIds.filter((x) => x !== v),
                              churchIds: [],
                            }))}
                          />
                        </div>
                        <div>
                          <p className="mb-1.5 text-xs font-semibold text-slate-700">Igreja</p>
                          <MultiSelectDropdown
                            label="Igreja"
                            emptyLabel="Todas as igrejas"
                            options={churches.filter((c) => {
                              if (requirementsReportBuilder.regionalIds.length && !requirementsReportBuilder.regionalIds.includes(c.regional?.id || c.regionalId || '')) return false;
                              if (requirementsReportBuilder.fieldIds.length) {
                                const campoId = c.regional?.campoId || c.regional?.campo?.id || '';
                                if (!requirementsReportBuilder.fieldIds.includes(campoId)) return false;
                              }
                              return true;
                            }).map((c) => ({ value: c.id, label: c.name }))}
                            selectedValues={requirementsReportBuilder.churchIds}
                            onToggle={(v, checked) => setRequirementsReportBuilder((p) => ({
                              ...p,
                              churchIds: checked ? Array.from(new Set([...p.churchIds, v])) : p.churchIds.filter((x) => x !== v),
                            }))}
                          />
                        </div>
                        <div>
                          <p className="mb-1.5 text-xs font-semibold text-slate-700">Situação</p>
                          <MultiSelectDropdown
                            label="Situação"
                            emptyLabel="Todas as situações"
                            options={[
                              { value: 'pendente', label: 'Pendente' },
                              { value: 'em_andamento', label: 'Em andamento' },
                              { value: 'aprovado', label: 'Aprovado' },
                              { value: 'rejeitado', label: 'Rejeitado' },
                              { value: 'cancelado', label: 'Cancelado' },
                              { value: 'arquivado', label: 'Arquivado' },
                            ]}
                            selectedValues={requirementsReportBuilder.statuses}
                            onToggle={(v, checked) => setRequirementsReportBuilder((p) => ({
                              ...p,
                              statuses: checked ? Array.from(new Set([...p.statuses, v])) : p.statuses.filter((x) => x !== v),
                            }))}
                          />
                        </div>
                        <div>
                          <p className="mb-1.5 text-xs font-semibold text-slate-700">Tipo de membro</p>
                          <MultiSelectDropdown
                            label="Tipo de membro"
                            emptyLabel="Todos os tipos"
                            options={[
                              { value: 'MEMBRO', label: 'Membro' },
                              { value: 'PF', label: 'Pessoa Física (PF)' },
                              { value: 'PJ', label: 'Pessoa Jurídica (PJ)' },
                            ]}
                            selectedValues={requirementsReportBuilder.memberTypes}
                            onToggle={(v, checked) => setRequirementsReportBuilder((p) => ({
                              ...p,
                              memberTypes: checked ? Array.from(new Set([...p.memberTypes, v])) : p.memberTypes.filter((x) => x !== v),
                            }))}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Templates */}
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                          <Save className="h-5 w-5" />
                        </div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Salvar modelo</p>
                      </div>
                      <div className="mt-4 grid gap-3">
                        <input
                          type="text"
                          placeholder="Nome do modelo..."
                          value={requirementsReportBuilder.templateName}
                          onChange={(e) => setRequirementsReportBuilder((p) => ({ ...p, templateName: e.target.value }))}
                          className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-emerald-400"
                        />
                        <button
                          type="button"
                          onClick={handleSaveRequirementsReportTemplate}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                        >
                          <Save className="h-4 w-4" />
                          Salvar
                        </button>
                      </div>
                      {requirementsReportTemplates.length > 0 && (
                        <div className="mt-4 space-y-2">
                          {requirementsReportTemplates.map((tpl) => {
                            const isActive = tpl.id === activeRequirementsReportTemplateId;
                            return (
                              <div key={tpl.id} className={`rounded-2xl border p-3 transition ${isActive ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                                <div className="flex items-center justify-between gap-2">
                                  <button type="button" onClick={() => handleLoadRequirementsReportTemplate(tpl)} className="min-w-0 flex-1 text-left">
                                    <p className={`truncate text-sm font-semibold ${isActive ? 'text-emerald-900' : 'text-slate-900'}`}>{tpl.name}</p>
                                    <p className="text-xs text-slate-500">{tpl.builder.columns.length} colunas</p>
                                  </button>
                                  <button type="button" onClick={() => handleDeleteRequirementsReportTemplate(tpl.id)} className="rounded-xl border border-rose-200 bg-rose-50 p-1.5 text-rose-700 transition hover:bg-rose-100"><Trash2 className="h-3.5 w-3.5" /></button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Center: table ── */}
                <div className="min-h-0 overflow-y-auto bg-white">
                  <div className="p-5">
                    {requirementsLoading ? (
                      <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                        <span className="ml-3 text-sm text-slate-500">Carregando requerimentos...</span>
                      </div>
                    ) : requirementsFilteredRows.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400">
                        <ClipboardList className="mb-3 h-12 w-12 opacity-30" />
                        <p className="text-sm font-semibold">Nenhum requerimento encontrado</p>
                        <p className="mt-1 text-xs">Ajuste os filtros ou o período para ver resultados.</p>
                      </div>
                    ) : (
                      <>
                      <div id="requirements-report-preview-root" className="overflow-x-auto rounded-2xl border border-slate-200">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50">
                              {requirementsReportBuilder.columns.map((col) => (
                                <th
                                  key={col}
                                  onClick={() => setRequirementsReportBuilder((prev) => ({ ...prev, sortBy: col as typeof prev.sortBy, sortDirection: prev.sortBy === col ? (prev.sortDirection === 'asc' ? 'desc' : 'asc') : 'asc' }))}
                                  className="no-print-sort px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 group"
                                >
                                  <span className="inline-flex items-center gap-1">
                                    {requirementsColumnLabel[col]}
                                    <span className="print:hidden text-slate-300 group-hover:text-slate-500 transition-colors">{requirementsReportBuilder.sortBy === col ? (requirementsReportBuilder.sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ⇅'}</span>
                                  </span>
                                </th>
                              ))}
                              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 w-10" />
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const groupBy = requirementsReportBuilder.groupBy;
                              const rows = requirementsFilteredRows;
                              type GroupEntry = { key: string; label: string; rows: typeof rows };
                              let groups: GroupEntry[];
                              if (groupBy === 'none') {
                                groups = [{ key: '__all__', label: '', rows }];
                              } else {
                                const map = new Map<string, { label: string; rows: typeof rows }>();
                                for (const r of rows) {
                                  const k = groupBy === 'regional' ? (r.regionalId || '__sem__') : (r.churchId || '__sem__');
                                  const lbl = groupBy === 'regional' ? (r.regional || 'Sem regional') : (r.church || 'Sem igreja');
                                  if (!map.has(k)) map.set(k, { label: lbl, rows: [] });
                                  map.get(k)!.rows.push(r);
                                }
                                groups = Array.from(map.entries()).sort((a, b) => a[1].label.localeCompare(b[1].label)).map(([key, v]) => ({ key, label: v.label, rows: v.rows }));
                              }
                              let globalIdx = 0;
                              return groups.flatMap((group) => {
                                const groupRows = group.rows.flatMap((row, _localIdx) => {
                                  const idx = globalIdx++;
                                  const isExpanded = expandedRequirementsCardIds.has(row.cardId);
                                  const rowBg = requirementsReportBuilder.zebraEnabled && idx % 2 === 1
                                    ? { backgroundColor: requirementsReportBuilder.zebraColor }
                                    : {};
                                  const statusMeta = REQ_STATUS_LABELS[row.status?.toLowerCase()] || { label: row.statusLabel || row.status, cls: 'bg-slate-100 text-slate-600' };
                                  return [
                                    <tr key={row.cardId} style={rowBg} className="border-b border-slate-100 transition hover:bg-slate-50">
                                    {requirementsReportBuilder.columns.map((col) => (
                                      <td key={col} className="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                                        {col === 'status' ? (
                                          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusMeta.cls}`}>{statusMeta.label}</span>
                                        ) : col === 'protocol' ? (
                                          <span className="font-mono text-xs font-semibold text-slate-900">{row.protocol}</span>
                                        ) : col === 'openedAt' || col === 'closedAt' ? (
                                          <span>{row[col] || '—'}</span>
                                        ) : (
                                          <span className="max-w-[200px] truncate block">{String(row[col as keyof RequirementsPreviewRow] ?? '') || '—'}</span>
                                        )}
                                      </td>
                                    ))}
                                    <td className="px-2 py-2.5">
                                      <button
                                        type="button"
                                        onClick={() => setExpandedRequirementsCardIds((prev) => { const next = new Set(prev); isExpanded ? next.delete(row.cardId) : next.add(row.cardId); return next; })}
                                        className="flex h-7 w-7 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100"
                                        title={isExpanded ? 'Recolher' : 'Expandir'}
                                      >
                                        <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                      </button>
                                    </td>
                                  </tr>,
                                  isExpanded ? (
                                    <tr key={`${row.cardId}-expanded`} className="border-b border-emerald-100 bg-emerald-50">
                                      <td colSpan={requirementsReportBuilder.columns.length + 1} className="px-6 py-4">
                                        <div className="grid gap-6 md:grid-cols-2">
                                          {/* Attachments */}
                                          <div>
                                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Documentos em anexo ({row.attachments?.length ?? 0})</p>
                                            {row.attachments?.length ? (
                                              <div className="space-y-1.5">
                                                {row.attachments.map((att, ai) => (
                                                  <div key={ai} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                                                    <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                                    <span className="truncate font-medium">{att.type || att.name || att.filename || 'Documento'}</span>
                                                    {att.url && (
                                                      <a href={att.url} target="_blank" rel="noopener noreferrer" className="ml-auto shrink-0 rounded-lg bg-emerald-50 px-2 py-1 text-emerald-700 transition hover:bg-emerald-100">Abrir</a>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            ) : (
                                              <p className="text-xs text-slate-400">Nenhum documento em anexo.</p>
                                            )}
                                          </div>
                                          {/* Event history */}
                                          <div>
                                            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">Histórico / Conversas ({row.eventHistory?.length ?? 0})</p>
                                            {row.eventHistory?.length ? (
                                              <div className="max-h-60 space-y-1.5 overflow-y-auto">
                                                {row.eventHistory.map((ev) => (
                                                  <div key={ev.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                                                    <div className="flex items-center justify-between gap-2">
                                                      <span className="font-semibold text-slate-900">{ev.createdByUser?.fullName || 'Sistema'}</span>
                                                      <span className="text-slate-400">{ev.createdAt ? new Date(ev.createdAt).toLocaleDateString('pt-BR') : ''}</span>
                                                    </div>
                                                    {ev.action && <p className="mt-0.5 text-slate-500">Ação: {ev.action}</p>}
                                                    {ev.notes && <p className="mt-0.5 text-slate-700">{ev.notes}</p>}
                                                  </div>
                                                ))}
                                              </div>
                                            ) : (
                                              <p className="text-xs text-slate-400">Nenhum registro de histórico.</p>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  ) : null,
                                ].filter(Boolean);
                                });
                                const header: React.ReactNode[] = groupBy !== 'none' ? [
                                  <tr key={`group-hdr-${group.key}`} className="border-b border-slate-300 bg-slate-100">
                                    <td colSpan={requirementsReportBuilder.columns.length + 1} className="px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-700">
                                      {group.label} <span className="ml-2 font-normal text-slate-400">({group.rows.length} registro(s))</span>
                                    </td>
                                  </tr>
                                ] : [];
                                return [...header, ...groupRows];
                              })
                            })()}
                          </tbody>
                        </table>
                        <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500 flex items-center justify-between gap-2">
                          <span>{requirementsFilteredRows.length} registro(s)</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (expandedRequirementsCardIds.size === requirementsFilteredRows.length) {
                                setExpandedRequirementsCardIds(new Set());
                              } else {
                                setExpandedRequirementsCardIds(new Set(requirementsFilteredRows.map((r) => r.cardId)));
                              }
                            }}
                            className="rounded-xl border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                          >
                            {expandedRequirementsCardIds.size === requirementsFilteredRows.length ? 'Recolher todos' : 'Expandir todos'}
                          </button>
                        </div>
                      </div>
                      {/* Totals summary */}
                      {requirementsFilteredRows.length > 0 && (() => {
                        const byService: Record<string, number> = {};
                        const byStatus: Record<string, number> = {};
                        const byChurch: Record<string, number> = {};
                        for (const r of requirementsFilteredRows) {
                          byService[r.service || 'N/A'] = (byService[r.service || 'N/A'] || 0) + 1;
                          const statusLbl = (REQ_STATUS_LABELS[r.status?.toLowerCase()] || { label: r.statusLabel || r.status }).label;
                          byStatus[statusLbl] = (byStatus[statusLbl] || 0) + 1;
                          byChurch[r.church || 'N/A'] = (byChurch[r.church || 'N/A'] || 0) + 1;
                        }
                        return (
                          <div className="mt-4 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                            <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
                              <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Totais do relatório</span>
                              <span className="ml-auto rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-700">{requirementsFilteredRows.length} requerimento(s)</span>
                            </div>
                            <div className="grid divide-x divide-slate-200 md:grid-cols-3">
                              <div className="p-4">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Por serviço</p>
                                <div className="space-y-1">
                                  {Object.entries(byService).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                                    <div key={k} className="flex items-center justify-between gap-2 text-sm">
                                      <span className="truncate text-slate-700">{k}</span>
                                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{v}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="p-4">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Por situação</p>
                                <div className="space-y-1">
                                  {Object.entries(byStatus).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                                    <div key={k} className="flex items-center justify-between gap-2 text-sm">
                                      <span className="truncate text-slate-700">{k}</span>
                                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{v}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div className="p-4">
                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Por igreja</p>
                                <div className="space-y-1">
                                  {Object.entries(byChurch).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                                    <div key={k} className="flex items-center justify-between gap-2 text-sm">
                                      <span className="truncate text-slate-700">{k}</span>
                                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{v}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      </>
                    )}
                  </div>
                </div>

                {/* ── Right panel: column chooser + options ── */}
                <div className="min-h-0 overflow-y-auto border-l border-slate-200 bg-slate-50">
                  <div className="space-y-5 p-5">
                    {/* Orientation */}
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Orientação</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {(['portrait', 'landscape'] as const).map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setRequirementsReportBuilder((p) => ({ ...p, orientation: opt }))}
                            className={`rounded-2xl border px-3 py-2.5 text-sm font-semibold transition ${requirementsReportBuilder.orientation === opt ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                          >
                            {opt === 'portrait' ? 'Retrato' : 'Paisagem'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Zebra */}
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Zebrado</p>
                        <button
                          type="button"
                          onClick={() => setRequirementsReportBuilder((p) => ({ ...p, zebraEnabled: !p.zebraEnabled }))}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${requirementsReportBuilder.zebraEnabled ? 'bg-emerald-600' : 'bg-slate-300'}`}
                        >
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${requirementsReportBuilder.zebraEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                      {requirementsReportBuilder.zebraEnabled && (
                        <div className="mt-3 flex items-center gap-3">
                          <span className="text-xs text-slate-600">Cor:</span>
                          <input
                            type="color"
                            value={requirementsReportBuilder.zebraColor}
                            onChange={(e) => setRequirementsReportBuilder((p) => ({ ...p, zebraColor: e.target.value }))}
                            className="h-8 w-8 cursor-pointer rounded-lg border border-slate-200 p-0.5"
                          />
                          <span className="font-mono text-xs text-slate-500">{requirementsReportBuilder.zebraColor}</span>
                        </div>
                      )}
                    </div>

                    {/* Group by */}
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Agrupar por</p>
                      <div className="mt-3 grid gap-2">
                        {([['none', 'Sem agrupamento'], ['regional', 'Regional'], ['church', 'Igreja']] as const).map(([val, lbl]) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setRequirementsReportBuilder((p) => ({ ...p, groupBy: val }))}
                            className={`rounded-2xl border px-3 py-2 text-xs font-semibold transition ${requirementsReportBuilder.groupBy === val ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Sort */}
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ordenação</p>
                      <div className="mt-3 grid gap-2">
                        <select
                          value={requirementsReportBuilder.sortBy}
                          onChange={(e) => setRequirementsReportBuilder((p) => ({ ...p, sortBy: e.target.value as RequirementsReportColumnKey }))}
                          className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none"
                        >
                          {requirementsReportBuilder.columns.map((col) => (
                            <option key={col} value={col}>{requirementsColumnLabel[col]}</option>
                          ))}
                        </select>
                        <div className="grid grid-cols-2 gap-2">
                          {(['asc', 'desc'] as const).map((dir) => (
                            <button
                              key={dir}
                              type="button"
                              onClick={() => setRequirementsReportBuilder((p) => ({ ...p, sortDirection: dir }))}
                              className={`rounded-2xl border px-3 py-2 text-xs font-semibold transition ${requirementsReportBuilder.sortDirection === dir ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                            >
                              {dir === 'asc' ? 'A → Z' : 'Z → A'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Column chooser */}
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Colunas</p>
                      <p className="mt-1 text-xs text-slate-500">Marque as colunas que devem aparecer.</p>
                      <div className="mt-4 space-y-2">
                        {ALL_REQUIREMENTS_COLUMNS.map((col) => {
                          const isChecked = requirementsReportBuilder.columns.includes(col);
                          return (
                            <label key={col} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5 transition hover:bg-slate-100">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  setRequirementsReportBuilder((p) => {
                                    const next = isChecked
                                      ? p.columns.filter((c) => c !== col)
                                      : [...p.columns, col];
                                    return { ...p, columns: next.length ? next : p.columns };
                                  });
                                }}
                                className="h-4 w-4 accent-emerald-600"
                              />
                              <span className="text-sm text-slate-700">{requirementsColumnLabel[col]}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Summary */}
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Resumo</p>
                      <div className="mt-3 space-y-2 text-sm text-slate-700">
                        <div className="rounded-2xl bg-slate-100 px-4 py-2.5 font-semibold">Total: {requirementsFilteredRows.length} registro(s)</div>
                        <div className="rounded-2xl border border-slate-200 px-4 py-2.5">Colunas ativas: {requirementsReportBuilder.columns.length}</div>
                        <div className="rounded-2xl border border-slate-200 px-4 py-2.5">
                          Filtros: {[
                            requirementsReportBuilder.fieldIds.length && `${requirementsReportBuilder.fieldIds.length} campo(s)`,
                            requirementsReportBuilder.regionalIds.length && `${requirementsReportBuilder.regionalIds.length} regional(is)`,
                            requirementsReportBuilder.churchIds.length && `${requirementsReportBuilder.churchIds.length} igreja(s)`,
                            requirementsReportBuilder.statuses.length && `${requirementsReportBuilder.statuses.length} situação(ões)`,
                          ].filter(Boolean).join(', ') || 'Nenhum'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : isCredentialsReport ? (
              <div className="grid min-h-0 flex-1 lg:grid-cols-[300px_minmax(0,1fr)_280px] xl:grid-cols-[320px_minmax(0,1fr)_300px] 2xl:grid-cols-[340px_minmax(0,1fr)_320px]">
                {/* ── Left panel: filters ── */}
                <div className="min-h-0 overflow-y-auto border-r border-slate-200 bg-[linear-gradient(180deg,#f5f3ff_0%,#f8fafc_22%,#ffffff_100%)]">
                  <div className="space-y-5 p-5">
                    {/* Date range */}
                    <div className="rounded-3xl border border-violet-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                          <Calendar className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Período</p>
                          <p className="text-sm text-slate-600">Data de emissão da credencial.</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3">
                        <label className="space-y-1.5 text-sm text-slate-700">
                          <span className="font-semibold text-slate-900">Data inicial</span>
                          <input type="date" value={credentialReportBuilder.dateFrom} onChange={(e) => setCredentialReportBuilder((p) => ({ ...p, dateFrom: e.target.value }))} className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-violet-400" />
                        </label>
                        <label className="space-y-1.5 text-sm text-slate-700">
                          <span className="font-semibold text-slate-900">Data final</span>
                          <input type="date" value={credentialReportBuilder.dateTo} onChange={(e) => setCredentialReportBuilder((p) => ({ ...p, dateTo: e.target.value }))} className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-violet-400" />
                        </label>
                      </div>
                    </div>
                    {/* Scope filters */}
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                          <Filter className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Filtros</p>
                          <p className="text-sm text-slate-600">Campo, regional, igreja, situação.</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3">
                        <div>
                          <p className="mb-1.5 text-xs font-semibold text-slate-700">Campo</p>
                          <MultiSelectDropdown
                            label="Campo" emptyLabel="Todos os campos"
                            options={fields.map((f) => ({ value: f.id, label: f.name, disabled: hasFixedCampoScope }))}
                            disabled={hasFixedCampoScope}
                            selectedValues={credentialReportBuilder.fieldIds}
                            onToggle={(v, checked) => setCredentialReportBuilder((p) => ({
                              ...p,
                              fieldIds: checked ? Array.from(new Set([...p.fieldIds, v])) : p.fieldIds.filter((x) => x !== v),
                              regionalIds: [], churchIds: [],
                            }))}
                          />
                        </div>
                        <div>
                          <p className="mb-1.5 text-xs font-semibold text-slate-700">Regional</p>
                          <MultiSelectDropdown
                            label="Regional" emptyLabel="Todas as regionais"
                            options={regionais.filter((r) => !credentialReportBuilder.fieldIds.length || credentialReportBuilder.fieldIds.includes(r.campoId)).map((r) => ({ value: r.id, label: r.name }))}
                            selectedValues={credentialReportBuilder.regionalIds}
                            onToggle={(v, checked) => setCredentialReportBuilder((p) => ({
                              ...p,
                              regionalIds: checked ? Array.from(new Set([...p.regionalIds, v])) : p.regionalIds.filter((x) => x !== v),
                              churchIds: [],
                            }))}
                          />
                        </div>
                        <div>
                          <p className="mb-1.5 text-xs font-semibold text-slate-700">Igreja</p>
                          <MultiSelectDropdown
                            label="Igreja" emptyLabel="Todas as igrejas"
                            options={churches.filter((c) => {
                              if (credentialReportBuilder.regionalIds.length && !credentialReportBuilder.regionalIds.includes(c.regional?.id || c.regionalId || '')) return false;
                              if (credentialReportBuilder.fieldIds.length) {
                                const campoId = c.regional?.campoId || c.regional?.campo?.id || '';
                                if (!credentialReportBuilder.fieldIds.includes(campoId)) return false;
                              }
                              return true;
                            }).map((c) => ({ value: c.id, label: c.name }))}
                            selectedValues={credentialReportBuilder.churchIds}
                            onToggle={(v, checked) => setCredentialReportBuilder((p) => ({
                              ...p,
                              churchIds: checked ? Array.from(new Set([...p.churchIds, v])) : p.churchIds.filter((x) => x !== v),
                            }))}
                          />
                        </div>
                        <div>
                          <p className="mb-1.5 text-xs font-semibold text-slate-700">Situação</p>
                          <MultiSelectDropdown
                            label="Situação" emptyLabel="Todas as situações"
                            options={[
                              { value: 'pendente', label: 'Pendente' },
                              { value: 'emitida', label: 'Emitida' },
                              { value: 'vencida', label: 'Vencida' },
                              { value: 'cancelada', label: 'Cancelada' },
                              { value: 'aprovada', label: 'Aprovada' },
                              { value: 'entregue', label: 'Entregue' },
                            ]}
                            selectedValues={credentialReportBuilder.situacoes}
                            onToggle={(v, checked) => setCredentialReportBuilder((p) => ({
                              ...p,
                              situacoes: checked ? Array.from(new Set([...p.situacoes, v])) : p.situacoes.filter((x) => x !== v),
                            }))}
                          />
                        </div>
                        <div>
                          <p className="mb-1.5 text-xs font-semibold text-slate-700">Tipo de membro</p>
                          <MultiSelectDropdown
                            label="Tipo de membro" emptyLabel="Todos os tipos"
                            options={[
                              { value: 'MEMBRO', label: 'Membro' },
                              { value: 'PF', label: 'Pessoa Física (PF)' },
                              { value: 'PJ', label: 'Pessoa Jurídica (PJ)' },
                            ]}
                            selectedValues={credentialReportBuilder.memberTypes}
                            onToggle={(v, checked) => setCredentialReportBuilder((p) => ({
                              ...p,
                              memberTypes: checked ? Array.from(new Set([...p.memberTypes, v])) : p.memberTypes.filter((x) => x !== v),
                            }))}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setCredentialSearchTrigger((n) => n + 1)}
                          disabled={credentialLoading}
                          className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
                        >
                          {credentialLoading ? (
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                          )}
                          {credentialLoading ? 'Buscando...' : 'Buscar'}
                        </button>
                      </div>
                    </div>
                    {/* Templates */}
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                          <Save className="h-5 w-5" />
                        </div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Salvar modelo</p>
                      </div>
                      <div className="mt-4 grid gap-3">
                        <input
                          type="text"
                          placeholder="Nome do modelo..."
                          value={credentialReportBuilder.templateName}
                          onChange={(e) => setCredentialReportBuilder((p) => ({ ...p, templateName: e.target.value }))}
                          className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-violet-400"
                        />
                        <button type="button" onClick={handleSaveCredentialReportTemplate} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700">
                          <Save className="h-4 w-4" />Salvar
                        </button>
                      </div>
                      {credentialReportTemplates.length > 0 && (
                        <div className="mt-4 space-y-2">
                          {credentialReportTemplates.map((tpl) => {
                            const isActive = tpl.id === activeCredentialReportTemplateId;
                            return (
                              <div key={tpl.id} className={`rounded-2xl border p-3 transition ${isActive ? 'border-violet-500 bg-violet-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                                <div className="flex items-center justify-between gap-2">
                                  <button type="button" onClick={() => handleLoadCredentialReportTemplate(tpl)} className="min-w-0 flex-1 text-left">
                                    <p className={`truncate text-sm font-semibold ${isActive ? 'text-violet-900' : 'text-slate-900'}`}>{tpl.name}</p>
                                    <p className="text-xs text-slate-500">{tpl.builder.columns.length} colunas</p>
                                  </button>
                                  <button type="button" onClick={() => handleDeleteCredentialReportTemplate(tpl.id)} className="rounded-xl border border-rose-200 bg-rose-50 p-1.5 text-rose-700 transition hover:bg-rose-100"><Trash2 className="h-3.5 w-3.5" /></button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Center: table ── */}
                <div className="min-h-0 overflow-y-auto bg-white">
                  <div className="p-5">
                    {credentialLoading ? (
                      <div className="flex items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                        <span className="ml-3 text-sm text-slate-500">Carregando credenciais...</span>
                      </div>
                    ) : credentialFilteredRows.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400">
                        <CreditCard className="mb-3 h-12 w-12 opacity-30" />
                        <p className="text-sm font-semibold">Nenhuma credencial encontrada</p>
                        <p className="mt-1 text-xs">Ajuste os filtros ou o período para ver resultados.</p>
                      </div>
                    ) : (
                      <>
                        <div id="credential-report-preview-root" className="overflow-x-auto rounded-2xl border border-slate-200">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 bg-slate-50">
                                {credentialReportBuilder.columns.map((col) => (
                                  <th
                                    key={col}
                                    onClick={() => setCredentialReportBuilder((prev) => ({ ...prev, sortBy: col as typeof prev.sortBy, sortDirection: prev.sortBy === col ? (prev.sortDirection === 'asc' ? 'desc' : 'asc') : 'asc' }))}
                                    className="no-print-sort px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 whitespace-nowrap cursor-pointer select-none hover:bg-slate-100 group"
                                  >
                                    <span className="inline-flex items-center gap-1">
                                      {credentialColumnLabel[col]}
                                      <span className="print:hidden text-slate-300 group-hover:text-slate-500 transition-colors">{credentialReportBuilder.sortBy === col ? (credentialReportBuilder.sortDirection === 'asc' ? ' ↑' : ' ↓') : ' ⇅'}</span>
                                    </span>
                                  </th>
                                ))}
                                <th className="w-10 px-4 py-3" />
                              </tr>
                            </thead>
                            <tbody>
                              {(() => {
                                const groupBy = credentialReportBuilder.groupBy;
                                const rows = credentialFilteredRows;
                                type CGroup = { key: string; label: string; rows: typeof rows };
                                let groups: CGroup[];
                                if (groupBy === 'none') {
                                  groups = [{ key: '__all__', label: '', rows }];
                                } else {
                                  const map = new Map<string, { label: string; rows: typeof rows }>();
                                  for (const r of rows) {
                                    const k = groupBy === 'regional' ? (r.regionalId || '__sem__') : (r.church_id || '__sem__');
                                    const lbl = groupBy === 'regional' ? (r.regional || 'Sem regional') : (r.igrejasolicitante || 'Sem igreja');
                                    if (!map.has(k)) map.set(k, { label: lbl, rows: [] });
                                    map.get(k)!.rows.push(r);
                                  }
                                  groups = Array.from(map.entries()).sort((a, b) => a[1].label.localeCompare(b[1].label)).map(([key, v]) => ({ key, label: v.label, rows: v.rows }));
                                }
                                let globalIdx = 0;
                                return groups.flatMap((group) => {
                                  const groupRows = group.rows.flatMap((row) => {
                                    const idx = globalIdx++;
                                    const isExpanded = expandedCredentialIds.has(row.id);
                                    const rowBg = credentialReportBuilder.zebraEnabled && idx % 2 === 1
                                      ? { backgroundColor: credentialReportBuilder.zebraColor }
                                      : {};
                                    const statusMeta = CRED_STATUS_LABELS[row.situacao?.toLowerCase()] || { label: row.situacao || '—', cls: 'bg-slate-100 text-slate-600' };
                                    return [
                                      <tr key={row.id} style={rowBg} className="border-b border-slate-100 transition hover:bg-slate-50">
                                        {credentialReportBuilder.columns.map((col) => (
                                          <td key={col} className="px-4 py-2.5 text-slate-700 whitespace-nowrap">
                                            {col === 'situacao' ? (
                                              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusMeta.cls}`}>{statusMeta.label}</span>
                                            ) : col === 'numero' || col === 'card_protocol' ? (
                                              <span className="font-mono text-xs font-semibold text-slate-900">{String(row[col as keyof CredentialPreviewRow] ?? '') || '—'}</span>
                                            ) : (
                                              <span className="block max-w-[200px] truncate">{String(row[col as keyof CredentialPreviewRow] ?? '') || '—'}</span>
                                            )}
                                          </td>
                                        ))}
                                        <td className="no-print px-2 py-2.5">
                                          <button
                                            type="button"
                                            onClick={() => setExpandedCredentialIds((prev) => { const next = new Set(prev); isExpanded ? next.delete(row.id) : next.add(row.id); return next; })}
                                            className="flex h-7 w-7 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100"
                                            title={isExpanded ? 'Recolher' : 'Expandir'}
                                          >
                                            <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                          </button>
                                        </td>
                                      </tr>,
                                      isExpanded ? (
                                        <tr key={`${row.id}-exp`} className="border-b border-violet-100 bg-violet-50">
                                          <td colSpan={credentialReportBuilder.columns.length + 1} className="px-6 py-4">
                                            <div className="grid gap-6 md:grid-cols-2">
                                              {/* Personal data */}
                                              <div className="space-y-1.5 text-xs text-slate-700">
                                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-violet-700">Dados pessoais</p>
                                                {credentialReportBuilder.memberDetailFields.includes('cpf') && row.member?.cpf && <div className="flex gap-2"><span className="w-24 shrink-0 font-semibold text-slate-500">CPF:</span><span>{row.member.cpf}</span></div>}
                                                {credentialReportBuilder.memberDetailFields.includes('rg') && row.member?.rg && <div className="flex gap-2"><span className="w-24 shrink-0 font-semibold text-slate-500">RG:</span><span>{row.member.rg}</span></div>}
                                                {credentialReportBuilder.memberDetailFields.includes('birthDate') && row.member?.birthDate && <div className="flex gap-2"><span className="w-24 shrink-0 font-semibold text-slate-500">Nascimento:</span><span>{new Date(row.member.birthDate).toLocaleDateString('pt-BR')}</span></div>}
                                                {credentialReportBuilder.memberDetailFields.includes('naturalityCity') && row.member?.naturalityCity && <div className="flex gap-2"><span className="w-24 shrink-0 font-semibold text-slate-500">Naturalidade:</span><span>{row.member.naturalityCity}{row.member.naturalityState ? ` / ${row.member.naturalityState}` : ''}</span></div>}
                                                {credentialReportBuilder.memberDetailFields.includes('maritalStatus') && row.member?.maritalStatus && <div className="flex gap-2"><span className="w-24 shrink-0 font-semibold text-slate-500">Estado civil:</span><span>{row.member.maritalStatus}</span></div>}
                                                {credentialReportBuilder.memberDetailFields.includes('fatherName') && row.member?.fatherName && <div className="flex gap-2"><span className="w-24 shrink-0 font-semibold text-slate-500">Pai:</span><span>{row.member.fatherName}</span></div>}
                                                {credentialReportBuilder.memberDetailFields.includes('motherName') && row.member?.motherName && <div className="flex gap-2"><span className="w-24 shrink-0 font-semibold text-slate-500">Mãe:</span><span>{row.member.motherName}</span></div>}
                                                {credentialReportBuilder.memberDetailFields.includes('spouseName') && row.member?.spouseName && <div className="flex gap-2"><span className="w-24 shrink-0 font-semibold text-slate-500">Cônjuge:</span><span>{row.member.spouseName}</span></div>}
                                              </div>
                                              {/* Credential data */}
                                              <div className="space-y-1.5 text-xs text-slate-700">
                                                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-violet-700">Dados da credencial</p>
                                                <div className="flex gap-2"><span className="w-24 shrink-0 font-semibold text-slate-500">Número:</span><span className="font-mono">{row.numero || '—'}</span></div>
                                                <div className="flex gap-2"><span className="w-24 shrink-0 font-semibold text-slate-500">Tipo:</span><span>{row.tipo || '—'}</span></div>
                                                {row.modelo && <div className="flex gap-2"><span className="w-24 shrink-0 font-semibold text-slate-500">Modelo:</span><span>{row.modelo}</span></div>}
                                                {row.dataemissao && <div className="flex gap-2"><span className="w-24 shrink-0 font-semibold text-slate-500">Emissão:</span><span>{row.dataemissao}</span></div>}
                                                {row.datavalidade && <div className="flex gap-2"><span className="w-24 shrink-0 font-semibold text-slate-500">Validade:</span><span>{row.datavalidade}</span></div>}
                                                {row.dataaprovacao && <div className="flex gap-2"><span className="w-24 shrink-0 font-semibold text-slate-500">Aprovação:</span><span>{row.dataaprovacao}</span></div>}
                                                {row.aprovadopor && <div className="flex gap-2"><span className="w-24 shrink-0 font-semibold text-slate-500">Aprovado por:</span><span>{row.aprovadopor}</span></div>}
                                                {row.obs && <div className="flex gap-2"><span className="w-24 shrink-0 font-semibold text-slate-500">Obs:</span><span>{row.obs}</span></div>}
                                                <div className="flex gap-2"><span className="w-24 shrink-0 font-semibold text-slate-500">Igreja:</span><span>{row.igrejasolicitante || '—'}</span></div>
                                                <div className="flex gap-2"><span className="w-24 shrink-0 font-semibold text-slate-500">Regional:</span><span>{row.regional || '—'}</span></div>
                                                <div className="flex gap-2"><span className="w-24 shrink-0 font-semibold text-slate-500">Campo:</span><span>{row.campo || '—'}</span></div>
                                                {(row.modelLargura || row.modelAltura) && (
                                                  <div className="mt-2 rounded-xl border border-violet-100 bg-violet-50 px-3 py-2">
                                                    <p className="mb-1 text-xs font-semibold uppercase tracking-[0.1em] text-violet-600">Medidas do modelo</p>
                                                    {row.modelLargura && <div className="flex gap-2"><span className="w-24 shrink-0 font-semibold text-slate-500">Largura:</span><span>{row.modelLargura} mm</span></div>}
                                                    {row.modelAltura && <div className="flex gap-2"><span className="w-24 shrink-0 font-semibold text-slate-500">Altura:</span><span>{row.modelAltura} mm</span></div>}
                                                    {row.modelLargurapg && <div className="flex gap-2"><span className="w-24 shrink-0 font-semibold text-slate-500">Larg. página:</span><span>{row.modelLargurapg} mm</span></div>}
                                                    {row.modelAlturapg && <div className="flex gap-2"><span className="w-24 shrink-0 font-semibold text-slate-500">Alt. página:</span><span>{row.modelAlturapg} mm</span></div>}
                                                    {row.modelLinhaporpg && <div className="flex gap-2"><span className="w-24 shrink-0 font-semibold text-slate-500">Linhas/pág.:</span><span>{row.modelLinhaporpg}</span></div>}
                                                    {row.modelColunaporpg && <div className="flex gap-2"><span className="w-24 shrink-0 font-semibold text-slate-500">Colunas/pág.:</span><span>{row.modelColunaporpg}</span></div>}
                                                    {row.modelValidademeses && <div className="flex gap-2"><span className="w-24 shrink-0 font-semibold text-slate-500">Validade:</span><span>{row.modelValidademeses} meses</span></div>}
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </td>
                                        </tr>
                                      ) : null,
                                    ].filter(Boolean);
                                  });
                                  const header: React.ReactNode[] = groupBy !== 'none' ? [
                                    <tr key={`cred-grp-${group.key}`} className="border-b border-slate-300 bg-slate-100">
                                      <td colSpan={credentialReportBuilder.columns.length + 1} className="px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-700">
                                        {group.label} <span className="ml-2 font-normal text-slate-400">({group.rows.length} registro(s))</span>
                                      </td>
                                    </tr>
                                  ] : [];
                                  return [...header, ...groupRows];
                                });
                              })()}
                            </tbody>
                          </table>
                          <div className="no-print flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
                            <span>{credentialFilteredRows.length} registro(s)</span>
                            <button
                              type="button"
                              onClick={() => {
                                if (expandedCredentialIds.size === credentialFilteredRows.length) {
                                  setExpandedCredentialIds(new Set());
                                } else {
                                  setExpandedCredentialIds(new Set(credentialFilteredRows.map((r) => r.id)));
                                }
                              }}
                              className="rounded-xl border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                            >
                              {expandedCredentialIds.size === credentialFilteredRows.length ? 'Recolher todos' : 'Expandir todos'}
                            </button>
                          </div>
                        </div>
                        {/* Totals summary */}
                        {credentialFilteredRows.length > 0 && (() => {
                          const byTipo: Record<string, number> = {};
                          const bySituacao: Record<string, number> = {};
                          // group members by church → regional
                          const byChurchRegional: Record<string, { regional: string; members: string[] }> = {};
                          for (const r of credentialFilteredRows) {
                            byTipo[r.tipo || 'N/A'] = (byTipo[r.tipo || 'N/A'] || 0) + 1;
                            const sitLbl = (CRED_STATUS_LABELS[r.situacao?.toLowerCase()] || { label: r.situacao || 'N/A' }).label;
                            bySituacao[sitLbl] = (bySituacao[sitLbl] || 0) + 1;
                            const churchKey = r.igrejasolicitante || 'Sem igreja';
                            if (!byChurchRegional[churchKey]) byChurchRegional[churchKey] = { regional: r.regional || '—', members: [] };
                            const memberName = r.member?.fullName || r.nome || '';
                            if (memberName && !byChurchRegional[churchKey].members.includes(memberName)) {
                              byChurchRegional[churchKey].members.push(memberName);
                            }
                          }
                          return (
                            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                              <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
                                <span className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Totais do relatório</span>
                                <span className="ml-auto rounded-full bg-violet-100 px-3 py-0.5 text-xs font-bold text-violet-700">{credentialFilteredRows.length} credencial(is)</span>
                              </div>
                              <div className="grid divide-x divide-slate-200 md:grid-cols-3">
                                <div className="p-4">
                                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Por tipo</p>
                                  <div className="space-y-1">
                                    {Object.entries(byTipo).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                                      <div key={k} className="flex items-center justify-between gap-2 text-sm">
                                        <span className="truncate text-slate-700">{k}</span>
                                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{v}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="p-4">
                                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Por situação</p>
                                  <div className="space-y-1">
                                    {Object.entries(bySituacao).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
                                      <div key={k} className="flex items-center justify-between gap-2 text-sm">
                                        <span className="truncate text-slate-700">{k}</span>
                                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{v}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="p-4">
                                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Por igreja / regional</p>
                                  <div className="space-y-3">
                                    {Object.entries(byChurchRegional).sort((a, b) => a[0].localeCompare(b[0])).map(([church, info]) => (
                                      <div key={church}>
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="truncate text-xs font-semibold text-slate-800">{church}</span>
                                          <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-bold text-violet-700">{info.members.length}</span>
                                        </div>
                                        {info.regional && info.regional !== '—' && (
                                          <p className="text-xs text-slate-400">{info.regional}</p>
                                        )}
                                        <ul className="mt-1 space-y-0.5 pl-2">
                                          {info.members.map((name) => (
                                            <li key={name} className="truncate text-xs text-slate-600">• {name}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </>
                    )}
                  </div>
                </div>

                {/* ── Right panel ── */}
                <div className="min-h-0 overflow-y-auto border-l border-slate-200 bg-slate-50">
                  <div className="space-y-5 p-5">
                    {/* Orientation */}
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Orientação</p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {(['portrait', 'landscape'] as const).map((opt) => (
                          <button key={opt} type="button" onClick={() => setCredentialReportBuilder((p) => ({ ...p, orientation: opt }))}
                            className={`rounded-2xl border px-3 py-2.5 text-sm font-semibold transition ${credentialReportBuilder.orientation === opt ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                            {opt === 'portrait' ? 'Retrato' : 'Paisagem'}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Zebra */}
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Zebrado</p>
                        <button type="button" onClick={() => setCredentialReportBuilder((p) => ({ ...p, zebraEnabled: !p.zebraEnabled }))}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${credentialReportBuilder.zebraEnabled ? 'bg-violet-600' : 'bg-slate-300'}`}>
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${credentialReportBuilder.zebraEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                      </div>
                      {credentialReportBuilder.zebraEnabled && (
                        <div className="mt-3 flex items-center gap-3">
                          <span className="text-xs text-slate-600">Cor:</span>
                          <input type="color" value={credentialReportBuilder.zebraColor} onChange={(e) => setCredentialReportBuilder((p) => ({ ...p, zebraColor: e.target.value }))} className="h-8 w-8 cursor-pointer rounded-lg border border-slate-200 p-0.5" />
                          <span className="font-mono text-xs text-slate-500">{credentialReportBuilder.zebraColor}</span>
                        </div>
                      )}
                    </div>
                    {/* Group by */}
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Agrupar por</p>
                      <div className="mt-3 grid gap-2">
                        {([['none', 'Sem agrupamento'], ['regional', 'Regional'], ['church', 'Igreja']] as const).map(([val, lbl]) => (
                          <button key={val} type="button" onClick={() => setCredentialReportBuilder((p) => ({ ...p, groupBy: val }))}
                            className={`rounded-2xl border px-3 py-2 text-xs font-semibold transition ${credentialReportBuilder.groupBy === val ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                            {lbl}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* Sort */}
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Ordenação</p>
                      <div className="mt-3 grid gap-2">
                        <select value={credentialReportBuilder.sortBy} onChange={(e) => setCredentialReportBuilder((p) => ({ ...p, sortBy: e.target.value as CredentialReportColumnKey }))}
                          className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none">
                          {credentialReportBuilder.columns.map((col) => (
                            <option key={col} value={col}>{credentialColumnLabel[col]}</option>
                          ))}
                        </select>
                        <div className="grid grid-cols-2 gap-2">
                          {(['asc', 'desc'] as const).map((dir) => (
                            <button key={dir} type="button" onClick={() => setCredentialReportBuilder((p) => ({ ...p, sortDirection: dir }))}
                              className={`rounded-2xl border px-3 py-2 text-xs font-semibold transition ${credentialReportBuilder.sortDirection === dir ? 'border-violet-500 bg-violet-50 text-violet-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                              {dir === 'asc' ? 'A → Z' : 'Z → A'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    {/* Column chooser */}
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Colunas</p>
                      <p className="mt-1 text-xs text-slate-500">Marque as colunas que devem aparecer.</p>
                      <div className="mt-4 space-y-2">
                        {ALL_CREDENTIAL_COLUMNS.map((col) => {
                          const isChecked = credentialReportBuilder.columns.includes(col);
                          return (
                            <label key={col} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5 transition hover:bg-slate-100">
                              <input type="checkbox" checked={isChecked} onChange={() => {
                                setCredentialReportBuilder((p) => {
                                  const next = isChecked ? p.columns.filter((c) => c !== col) : [...p.columns, col];
                                  return { ...p, columns: next.length ? next : p.columns };
                                });
                              }} className="h-4 w-4 accent-violet-600" />
                              <span className="text-sm text-slate-700">{credentialColumnLabel[col]}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                    {/* Summary */}
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Resumo</p>
                      <div className="mt-3 space-y-2 text-sm text-slate-700">
                        <div className="rounded-2xl bg-slate-100 px-4 py-2.5 font-semibold">Total: {credentialFilteredRows.length} registro(s)</div>
                        <div className="rounded-2xl border border-slate-200 px-4 py-2.5">Colunas ativas: {credentialReportBuilder.columns.length}</div>
                        <div className="rounded-2xl border border-slate-200 px-4 py-2.5">
                          Filtros: {[
                            credentialReportBuilder.fieldIds.length && `${credentialReportBuilder.fieldIds.length} campo(s)`,
                            credentialReportBuilder.regionalIds.length && `${credentialReportBuilder.regionalIds.length} regional(is)`,
                            credentialReportBuilder.churchIds.length && `${credentialReportBuilder.churchIds.length} igreja(s)`,
                            credentialReportBuilder.situacoes.length && `${credentialReportBuilder.situacoes.length} situação(ões)`,
                          ].filter(Boolean).join(', ') || 'Nenhum'}
                        </div>
                      </div>
                    </div>

                    {/* Member detail field chooser */}
                    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Dados do membro (expansão)</p>
                      <p className="mt-1 text-xs text-slate-500">Escolha quais campos aparecem ao expandir uma linha.</p>
                      <div className="mt-4 space-y-2">
                        {([
                          ['cpf', 'CPF'],
                          ['rg', 'RG'],
                          ['birthDate', 'Nascimento'],
                          ['naturalityCity', 'Naturalidade'],
                          ['maritalStatus', 'Estado civil'],
                          ['fatherName', 'Pai'],
                          ['motherName', 'Mãe'],
                          ['spouseName', 'Cônjuge'],
                        ] as const).map(([key, label]) => {
                          const isChecked = credentialReportBuilder.memberDetailFields.includes(key);
                          return (
                            <label key={key} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5 transition hover:bg-slate-100">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => setCredentialReportBuilder((p) => ({
                                  ...p,
                                  memberDetailFields: isChecked
                                    ? p.memberDetailFields.filter((f) => f !== key)
                                    : [...p.memberDetailFields, key],
                                }))}
                                className="h-4 w-4 accent-violet-600"
                              />
                              <span className="text-sm text-slate-700">{label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-5 px-6 py-6">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Escopo aplicado</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">{scopeLabel}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status desta etapa</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">Entrada pronta</p>
                      <p className="mt-1 text-sm text-slate-600">Faltam apenas os filtros que você vai definir.</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Próximo passo</p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">Definir filtros</p>
                      <p className="mt-1 text-sm text-slate-600">Assim que você passar os filtros, eu ajusto este relatório.</p>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">O que já está preparado</p>
                    <div className="mt-4 space-y-3">
                      {activeReportCard.modalHighlights.map((highlight) => (
                        <div key={highlight} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                          <div className="mt-1 h-2.5 w-2.5 rounded-full bg-slate-900" />
                          <p className="text-sm leading-6 text-slate-700">{highlight}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <DialogFooter className="border-t border-slate-200 px-6 py-4">
                  <button type="button" onClick={() => setActiveReportModal(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Fechar</button>
                  <button type="button" onClick={() => setActiveReportModal(null)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">Definir filtros depois</button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        ) : null}
      </Dialog>

      <AlertDialog open={memberReportNameDialogOpen} onOpenChange={setMemberReportNameDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nome do modelo obrigatório</AlertDialogTitle>
            <AlertDialogDescription>
              Informe um nome para salvar o modelo e reutilizar esse relatório depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setMemberReportNameDialogOpen(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={baptismReportNameDialogOpen} onOpenChange={setBaptismReportNameDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nome do modelo obrigatório</AlertDialogTitle>
            <AlertDialogDescription>
              Informe um nome para salvar o modelo e reutilizar esse relatório depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setBaptismReportNameDialogOpen(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={consecrationReportNameDialogOpen} onOpenChange={setConsecrationReportNameDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nome do modelo obrigatório</AlertDialogTitle>
            <AlertDialogDescription>
              Informe um nome para salvar o modelo e reutilizar esse relatório depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setConsecrationReportNameDialogOpen(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={transferReportNameDialogOpen} onOpenChange={setTransferReportNameDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nome do modelo obrigatório</AlertDialogTitle>
            <AlertDialogDescription>
              Informe um nome para salvar o modelo e reutilizar esse relatório depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setTransferReportNameDialogOpen(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={churchReportNameDialogOpen} onOpenChange={setChurchReportNameDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nome do modelo obrigatório</AlertDialogTitle>
            <AlertDialogDescription>
              Informe um nome para salvar o modelo e reutilizar esse relatório depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setChurchReportNameDialogOpen(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={requirementsReportNameDialogOpen} onOpenChange={setRequirementsReportNameDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nome do modelo obrigatório</AlertDialogTitle>
            <AlertDialogDescription>
              Informe um nome para salvar o modelo de requerimentos e reutilizá-lo depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setRequirementsReportNameDialogOpen(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={credentialReportNameDialogOpen} onOpenChange={setCredentialReportNameDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nome do modelo obrigatório</AlertDialogTitle>
            <AlertDialogDescription>
              Informe um nome para salvar o modelo de credenciais e reutilizá-lo depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setCredentialReportNameDialogOpen(false)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {!loading && !error && activeTab === 'dashboards' ? (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">Construtor visual</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">Dashboards de gráficos customizados</h2>
              </div>
            </div>

            <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_minmax(150px,0.9fr)_minmax(150px,0.9fr)_minmax(180px,1fr)_minmax(150px,0.9fr)_minmax(150px,0.9fr)] dark:border-slate-800">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Intervalo</label>
                <select
                  value={selectedDatePreset}
                  onChange={(event) => setSelectedDatePreset(event.target.value as DatePresetKey)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900"
                >
                  {DATE_PRESET_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Data inicial</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => {
                    setSelectedDatePreset('custom');
                    setDateFrom(event.target.value);
                  }}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Data final</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => {
                    setSelectedDatePreset('custom');
                    setDateTo(event.target.value);
                  }}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Campo</label>
                <select
                  value={selectedFieldId}
                  onChange={(event) => {
                    setSelectedFieldId(event.target.value);
                    setSelectedRegionalId('');
                    setSelectedChurchId('');
                  }}
                  disabled={hasFixedCampoScope}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:disabled:bg-slate-800"
                >
                  <option value="">Todos os campos</option>
                  {fields.map((field) => (
                    <option key={field.id} value={field.id}>{field.code ? `${field.code} - ` : ''}{field.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Regional</label>
                <select
                  value={selectedRegionalId}
                  onChange={(event) => {
                    setSelectedRegionalId(event.target.value);
                    setSelectedChurchId('');
                  }}
                  disabled={hasFixedChurchScope}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:disabled:bg-slate-800"
                >
                  <option value="">Todas as regionais</option>
                  {filteredRegionais.map((regional) => (
                    <option key={regional.id} value={regional.id}>{regional.code ? `${regional.code} - ` : ''}{regional.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Igreja</label>
                <select
                  value={selectedChurchId}
                  onChange={(event) => setSelectedChurchId(event.target.value)}
                  disabled={hasFixedChurchScope}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:disabled:bg-slate-800"
                >
                  <option value="">Todas as igrejas</option>
                  {filteredChurchOptions.map((church) => (
                    <option key={church.id} value={church.id}>{church.code ? `${church.code} - ` : ''}{church.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {dashboardsState.dashboards.map((dashboard) => (
                <div key={dashboard.id} className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDashboardsState((current) => ({ ...current, activeDashboardId: dashboard.id }))}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${dashboard.id === dashboardsState.activeDashboardId ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                  >
                    {dashboard.name}
                  </button>
                  {canManageDashboards && dashboardsState.dashboards.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteDashboard(dashboard.id)}
                      className="rounded-full p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      title="Excluir dashboard"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              ))}

              {canManageDashboards ? (
                <button
                  type="button"
                  onClick={handleAddDashboard}
                  className="inline-flex items-center gap-2 rounded-full border border-dashed border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-emerald-400 hover:text-emerald-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-emerald-600 dark:hover:text-emerald-300"
                >
                  <Plus className="h-4 w-4" />
                  Novo dashboard
                </button>
              ) : null}
            </div>
          </div>

          {activeDashboard?.charts.length ? (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-4">
              {activeDashboard.charts.map((chart) => {
                const source = filteredSources.find((item) => item.key === chart.sourceKey);
                if (!source) return null;

                const aggregated = aggregateRows(source.records, chart.dimensionKey, chart.metricKeys);
                const metricLabel = source.metrics.find((metric) => metric.key === chart.metricKeys[0])?.label || 'Valor';
                const metricTotal = aggregated.reduce((total, row) => total + Number(row[chart.metricKeys[0]] || 0), 0);
                const metricTotals = calculateMetricTotals(aggregated, chart.metricKeys);

                return (
                  <div key={chart.id} className={`${getGridClass(chart.gridSize)} rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900`}>
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">{chart.title}</h3>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{source.label} • {source.dimensions.find((item) => item.key === chart.dimensionKey)?.label}</p>
                      </div>
                      {canManageDashboards ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditChartModal(chart.id)}
                            className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                            title="Editar gráfico"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteChart(chart.id)}
                            className="rounded-xl p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                            title="Excluir gráfico"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ) : null}
                    </div>

                    {chart.showTotals ? (
                      <div className="mb-4 flex flex-wrap gap-2">
                        {metricTotals.map((item) => (
                          <div key={item.key} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-800">
                            <p className="font-semibold text-slate-500">{source.metrics.find((metric) => metric.key === item.key)?.label}</p>
                            <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{formatMetric(item.value)}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {chart.chartType === 'metric' ? (
                      <div className="flex min-h-[280px] flex-col justify-between rounded-3xl bg-slate-950 px-5 py-6 text-white">
                        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                          <BarChart3 className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-slate-300">{metricLabel}</p>
                          <p className="mt-2 text-5xl font-black">{formatMetric(metricTotal)}</p>
                          <p className="mt-3 text-sm text-slate-300">Fonte: {source.label}</p>
                        </div>
                      </div>
                    ) : chart.chartType === 'table' ? (
                      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-800">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Dimensão</th>
                              {chart.metricKeys.map((metricKey) => (
                                <th key={metricKey} className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-300">
                                  {source.metrics.find((metric) => metric.key === metricKey)?.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {aggregated.slice(0, 8).map((row) => (
                              <tr key={String(row.dimension)} className="border-t border-slate-200 dark:border-slate-800">
                                <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{String(row.dimension || '')}</td>
                                {chart.metricKeys.map((metricKey) => (
                                  <td key={metricKey} className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">{formatMetric(Number(row[metricKey] || 0))}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <ReactECharts option={buildChartOption(chart, source, aggregated, source.records)} style={{ height: 320 }} notMerge lazyUpdate />
                    )}

                    {chart.showTable && chart.chartType !== 'table' ? (
                      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-800">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Dimensão</th>
                              {chart.metricKeys.map((metricKey) => (
                                <th key={metricKey} className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-300">
                                  {source.metrics.find((metric) => metric.key === metricKey)?.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {aggregated.slice(0, 6).map((row) => (
                              <tr key={String(row.dimension)} className="border-t border-slate-200 dark:border-slate-800">
                                <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{String(row.dimension || '')}</td>
                                {chart.metricKeys.map((metricKey) => (
                                  <td key={metricKey} className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">{formatMetric(Number(row[metricKey] || 0))}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center dark:border-slate-700 dark:bg-slate-900">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                <LayoutDashboard className="h-6 w-6 text-slate-500 dark:text-slate-300" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">Este dashboard ainda não tem gráficos</h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Crie painéis quantos quiser e agrupe os gráficos por tema, processo ou perfil de acompanhamento.</p>
              {canManageDashboards ? (
                <button
                  type="button"
                  onClick={openNewChartModal}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  <Plus className="h-4 w-4" />
                  Criar primeiro gráfico
                </button>
              ) : null}
            </div>
          )}
        </div>
      ) : null}

      {chartEditorOpen && editorSource ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6">
          <div className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{editingChartId ? 'Editar gráfico' : 'Novo gráfico'}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Construtor de gráficos customizados da secretaria.</p>
              </div>
              <button
                type="button"
                onClick={() => setChartEditorOpen(false)}
                className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-[1.2fr_1fr]">
              <div className="min-h-0 space-y-5 border-r border-slate-200 overflow-y-auto p-6 dark:border-slate-800">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Título</label>
                    <input
                      type="text"
                      value={chartDraft.title}
                      onChange={(event) => setChartDraft((current) => ({ ...current, title: event.target.value }))}
                      placeholder="Ex.: Batismos por igreja"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Tipo de gráfico</label>
                    <select
                      value={chartDraft.chartType}
                      onChange={(event) => setChartDraft((current) => ({ ...current, chartType: event.target.value as ChartTypeKey }))}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900"
                    >
                      {CHART_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200">
                  <p className="font-semibold">Fonte escolhida: {editorSource.label}</p>
                  <p className="mt-1">{editorSource.description}</p>
                  <p className="mt-2 text-xs">{editorSource.joinHint}</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Fonte de dados</label>
                    <select
                      value={chartDraft.sourceKey}
                      onChange={(event) => handleSourceChange(event.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900"
                    >
                      {sources.map((source) => (
                        <option key={source.key} value={source.key}>{source.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Tamanho no grid</label>
                    <select
                      value={chartDraft.gridSize}
                      onChange={(event) => setChartDraft((current) => ({ ...current, gridSize: event.target.value as GridSizeKey }))}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900"
                    >
                      {GRID_SIZE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Dimensão</label>
                    <select
                      value={chartDraft.dimensionKey}
                      onChange={(event) => setChartDraft((current) => ({ ...current, dimensionKey: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900"
                    >
                      {editorSource.dimensions.map((dimension) => (
                        <option key={dimension.key} value={dimension.key}>{dimension.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Resumo</label>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      {formatMetric(editorSource.records.length)} linhas nesta fonte
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">Métricas</label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {editorSource.metrics.map((metric) => {
                      const checked = chartDraft.metricKeys.includes(metric.key);
                      return (
                        <label key={metric.key} className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition ${checked ? 'border-emerald-400 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleMetric(metric.key)}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>{metric.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Legenda</label>
                    <select
                      value={chartDraft.legendPosition}
                      onChange={(event) => setChartDraft((current) => ({ ...current, legendPosition: event.target.value as LegendPositionKey }))}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900"
                    >
                      {LEGEND_POSITION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-slate-500">Exibição</label>
                    <label className="inline-flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={chartDraft.showLegend}
                        onChange={(event) => setChartDraft((current) => ({ ...current, showLegend: event.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      Mostrar legenda
                    </label>
                    <label className="inline-flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={chartDraft.showTotals}
                        onChange={(event) => setChartDraft((current) => ({ ...current, showTotals: event.target.checked }))}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      Mostrar totais/indicadores
                    </label>
                  </div>
                </div>

                <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={chartDraft.showTable}
                    onChange={(event) => setChartDraft((current) => ({ ...current, showTable: event.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  Mostrar tabela de dados abaixo do gráfico
                </label>
              </div>

              <div className="min-h-0 overflow-y-auto bg-slate-50/70 p-6 dark:bg-slate-900/70">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Pré-visualização</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Atualização em tempo real com os dados atuais da secretaria.</p>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                    {editorSource.records.length} registros
                  </div>
                </div>

                <div className="flex-1 rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
                  {chartDraft.chartType === 'metric' ? (
                    <div className="flex h-full min-h-[340px] flex-col justify-between rounded-3xl bg-slate-950 px-5 py-6 text-white">
                      <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                        <Save className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-300">{editorSource.metrics.find((metric) => metric.key === chartDraft.metricKeys[0])?.label || 'Valor'}</p>
                        <p className="mt-2 text-5xl font-black">{formatMetric(previewData.reduce((total, item) => total + Number(item[chartDraft.metricKeys[0]] || 0), 0))}</p>
                      </div>
                    </div>
                  ) : chartDraft.chartType === 'table' ? (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-900">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-300">Dimensão</th>
                            {chartDraft.metricKeys.map((metricKey) => (
                              <th key={metricKey} className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-300">
                                {editorSource.metrics.find((metric) => metric.key === metricKey)?.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.slice(0, 8).map((row) => (
                            <tr key={String(row.dimension)} className="border-t border-slate-200 dark:border-slate-800">
                              <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{String(row.dimension || '')}</td>
                              {chartDraft.metricKeys.map((metricKey) => (
                                <td key={metricKey} className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">{formatMetric(Number(row[metricKey] || 0))}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {chartDraft.showTotals ? (
                        <div className="flex flex-wrap gap-2">
                          {calculateMetricTotals(previewData, chartDraft.metricKeys).map((item) => (
                            <div key={item.key} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
                              <p className="font-semibold text-slate-500">{editorSource.metrics.find((metric) => metric.key === item.key)?.label}</p>
                              <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{formatMetric(item.value)}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <ReactECharts option={buildChartOption(chartDraft, editorSource, previewData, editorSource.records)} style={{ height: 360 }} notMerge lazyUpdate />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setChartEditorOpen(false)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveChart}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                <Save className="h-4 w-4" />
                Salvar gráfico
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
