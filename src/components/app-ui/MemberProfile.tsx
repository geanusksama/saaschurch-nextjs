import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Camera, Check, CheckCircle2, Edit, FileText, Info, Pencil, Plus, Search, Star, Trash2, UserPlus, X, Zap, ZoomIn, ZoomOut } from "lucide-react";
import { normalizarSituacaoMembro } from '@/lib/situacaoMembro';
import { Link, useParams } from "react-router";
import { MemberEditDrawer } from "./MemberEditDrawer";
import { ConfirmDialog } from "./shared/ConfirmDialog";
import {
  PreviousChurchFields,
  emptyPreviousChurchForm,
  previousChurchPayload,
  previousChurchRowToForm,
  type PreviousChurchForm,
  type PreviousChurchRow,
} from "./shared/PreviousChurchFields";

import { apiBase } from '../../lib/apiBase';
import { ConfirmarTituloReadmissao } from '../ecclesiastical/ConfirmarTituloReadmissao';
import { ehServicoDeReadmissao } from '../../lib/readmissaoTitulo';
import { supabase } from '../../lib/supabaseClient';
import { Permissao } from '../../lib/permissoes/Permissao';

function authFetch(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem("mrm_token");
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json",
    },
  });
}

async function uploadFile(file: File): Promise<string> {
  const token = localStorage.getItem("mrm_token");
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${apiBase}/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) throw new Error("Falha no upload");
  const data = await res.json();
  return data.url as string;
}

function initials(name: string | null | undefined) {
  if (!name) return "--";
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0].toUpperCase())
    .slice(0, 2)
    .join("");
}

function fmtDate(v: string | null | undefined) {
  if (!v) return "-";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR");
}

function statusLabel(status: string | null | undefined) {
  if (!status) return { label: "—", cls: "bg-gray-100 text-gray-600" };
  // Comparação exata: "INATIVO".includes("ATIVO") é verdadeiro e fazia desligado aparecer como Ativo.
  const s = normalizarSituacaoMembro(status);
  if (s === "ATIVO") return { label: "Ativo", cls: "bg-green-100 text-green-700" };
  if (s === "AGUARDANDO ATIVACAO") return { label: "Aguardando ativação", cls: "bg-amber-100 text-amber-700" };
  if (s === "DESLIGADO") return { label: "Desligado", cls: "bg-red-100 text-red-700" };
  if (s === "EXCLUIDO") return { label: "Excluído", cls: "bg-red-100 text-red-700" };
  return { label: status, cls: "bg-gray-100 text-gray-700" };
}

type Member = {
  id: string;
  fullName: string;
  rol?: number | null;
  membershipStatus?: string | null;
  ecclesiasticalTitle?: string | null;
  gender?: string | null;
  maritalStatus?: string | null;
  spouseName?: string | null;
  addressCity?: string | null;
  addressState?: string | null;
  nationality?: string | null;
  cpf?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  photoUrl?: string | null;
  coverPhotoUrl?: string | null;
  baptismDate?: string | null;
  membershipDate?: string | null;
  church?: { id: string; name: string; code?: string | null; regional?: { id: string; name: string; code?: string | null; campo?: { name: string; code?: string | null } | null } | null } | null;
  regional?: { id: string; name: string; code?: string | null } | null;
  ecclesiasticalTitleRef?: { id: string; name: string; abbreviation?: string | null } | null;
  ministryMemberships?: Array<{ ministry: { id: string; name: string } }>;
  memberTagAssignments?: Array<{ tag: { id: string; name: string; color?: string | null } }>;
};

type HistoryRow = {
  id: string;
  action?: string | null;
  notes?: string | null;
  serviceName?: string | null;
  serviceGroup?: string | null;
  columnIndex?: number | null;
  memberCity?: string | null;
  memberCountry?: string | null;
  createdAt?: string | null;
  card?: { id: string; protocol?: string | null; church?: { name: string } | null; createdAt?: string | null } | null;
  createdByUser?: { id: string; fullName: string } | null;
  church?: { id: string; name: string } | null; // igreja de origem do evento (fallback quando não há card)
  destinationChurch?: { id: string; name: string } | null; // igreja de destino (transferência)
};

type Tab = "historico" | "titulos" | "funcoes" | "familia" | "igrejas";

/**
 * As duas abas do topo do perfil.
 *
 * "Perfil" são os dados cadastrais e a presença; "Históricos" é a linha do
 * tempo (ocorrências, títulos, funções, família, outras igrejas), que antes
 * ficava embaixo dos painéis e exigia rolar a tela para ser notada.
 */
type AbaPrincipal = "perfil" | "historicos";

const ABAS_PRINCIPAIS: { key: AbaPrincipal; label: string }[] = [
  { key: "perfil", label: "Perfil" },
  { key: "historicos", label: "Históricos" },
];

type KanService = { id: number; sigla: string; description: string; serviceGroup?: string | null };

type MatrixRule = {
  id: number;
  serviceId: number;
  columnIndex: number;
  description?: string | null;
  columnName?: string | null;
  changeStatus: boolean; newStatus?: string | null;
  changeTitle: boolean; newTitle?: string | null;
  restorePreviousTitle?: boolean;
  doesTransfer: boolean;
  insertOccurrence: boolean;
};

type ChurchOption = { id: string; name: string; code?: string | null };

type OccurrenceForm = {
  serviceId: string;
  columnIndex: string;
  occurrenceType: string;
  date: string;
  description: string;
  internalNotes: string;
};

export function MemberProfile() {
  const { id } = useParams<{ id: string }>();
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [histSearch, setHistSearch] = useState("");

  const [abaPrincipal, setAbaPrincipal] = useState<AbaPrincipal>("perfil");
  // Só visual: "hoje" fixo na abertura da tela, para contar os dias como membro.
  const [agora] = useState(() => Date.now());
  const [activeTab, setActiveTab] = useState<Tab>("historico");
  const [showOccModal, setShowOccModal] = useState(false);
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<{ file: File; url: string } | null>(null);
  const [photoSizeError, setPhotoSizeError] = useState(false);
  const [deleteHistId, setDeleteHistId] = useState<string | null>(null);
  const [editHistRow, setEditHistRow] = useState<HistoryRow | null>(null);
  const [editHistNotes, setEditHistNotes] = useState("");
  const [savingHist, setSavingHist] = useState(false);
  const [titleRefreshKey, setTitleRefreshKey] = useState(0);
  const [memberRefreshKey, setMemberRefreshKey] = useState(0);
  // Funções ativas — exibidas no cabeçalho ao lado do título eclesiástico.
  const [activeFunctions, setActiveFunctions] = useState<{ id: string; name: string; isCampoWide: boolean }[]>([]);
  const [functionsRefreshKey, setFunctionsRefreshKey] = useState(0);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const [ecclesiasticalTitles, setEcclesiasticalTitles] = useState<{ id: string; name: string; abbreviation?: string | null; level: number }[]>([]);

  useEffect(() => {
    authFetch(`${apiBase}/ecclesiastical-titles`)
      .then((r) => r.json())
      .then((data) => setEcclesiasticalTitles(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);
  const cropDragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement>(null);
  const cropImgRef = useRef<HTMLImageElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    authFetch(`${apiBase}/members/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Membro não encontrado.");
        return r.json();
      })
      .then((data) => setMember(data))
      .catch((err) => setError(err.message || "Falha ao carregar membro."))
      .finally(() => setLoading(false));
  }, [id, memberRefreshKey]);

  // Load history immediately (not only on historico tab) so we can derive attendance stats
  useEffect(() => {
    if (!id) return;
    setHistoryLoading(true);
    authFetch(`${apiBase}/members/${id}/event-history`)
      .then((r) => r.json())
      .then((data) => setHistory(Array.isArray(data) ? data : []))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }, [id]);

  // Funções ativas do membro (para o cabeçalho)
  useEffect(() => {
    if (!id) return;
    authFetch(`${apiBase}/members/${id}/functions`)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setActiveFunctions(
          list
            .filter((f: { isActive?: boolean }) => f.isActive)
            .map((f: { id: string; isCampoWide?: boolean; function?: { name?: string | null } | null }) => ({
              id: f.id,
              name: f.function?.name || '',
              isCampoWide: !!f.isCampoWide,
            }))
            .filter((f: { name: string }) => f.name)
        );
      })
      .catch(() => setActiveFunctions([]));
  }, [id, functionsRefreshKey]);

  // ── Presença REAL (face_presencas) ────────────────────────────────────────
  // Antes isso era derivado de `history` (event-history), que é a auditoria do
  // CRM — mostrava quando alguém editou o cadastro, não quando o membro veio.
  const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const [attendance, setAttendance] = useState<{
    byDay: number[];
    byPeriod: { manha: number; noite: number };
    total: number;
    distinctDays: number;
    lastPresence: { horario: string; igrejaRegional: string | null } | null;
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    authFetch(`${apiBase}/members/${id}/attendance-stats`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setAttendance(data && Array.isArray(data.byDay) ? data : null))
      .catch(() => setAttendance(null));
  }, [id]);

  const attendanceByDay = attendance?.byDay ?? [0, 0, 0, 0, 0, 0, 0];
  // Manhã/Noite com corte às 13h — mesma regra do módulo de Presença Facial.
  const attendanceByPeriod = attendance?.byPeriod ?? { manha: 0, noite: 0 };

  // Último evento do CRM (ocorrência/serviço) — usado nos indicadores do topo.
  // Não confundir com presença: isso é a trilha de auditoria, não check-in.
  const lastService = useMemo(() => history[0] ?? null, [history]);

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="animate-pulse">
            <div className="flex items-center gap-4">
              <div className="h-24 w-24 rounded-full bg-slate-200" />
              <div className="flex-1 space-y-3">
                <div className="h-7 w-64 rounded bg-slate-200" />
                <div className="h-4 w-32 rounded bg-slate-200" />
                <div className="h-4 w-48 rounded bg-slate-200" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="animate-pulse space-y-3">
                <div className="h-4 w-24 rounded bg-slate-200" />
                <div className="h-5 w-40 rounded bg-slate-200" />
                <div className="h-4 w-full rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      </div>
    );
  }

  const { label: sLabel, cls: sCls } = statusLabel(member?.membershipStatus);
  const ini = initials(member?.fullName);
  const titleName = member?.ecclesiasticalTitleRef?.name || member?.ecclesiasticalTitle || "—";
  const memberTags = (member?.memberTagAssignments ?? []).map((a) => a.tag);
  const regionalCode = member?.regional?.code || member?.regional?.name || "—";
  const churchName = member?.church?.name || "—";
  const campoName = member?.church?.regional?.campo?.name || "—";
  const genderLabel =
    member?.gender === "M" || member?.gender?.toUpperCase() === "MASCULINO"
      ? "Masculino"
      : member?.gender === "F" || member?.gender?.toUpperCase() === "FEMININO"
      ? "Feminino"
      : member?.gender || "—";
  const maritalLabel = (() => {
    const m = (member?.maritalStatus || "").toUpperCase();
    if (m === "CASADO" || m === "MARRIED") return "Casado(a)";
    if (m === "SOLTEIRO" || m === "SINGLE") return "Solteiro(a)";
    if (m === "DIVORCIADO" || m === "DIVORCED") return "Divorciado(a)";
    if (m === "VIUVO" || m === "WIDOWED") return "Viúvo(a)";
    return member?.maritalStatus || "—";
  })();

  function reloadHistory() {
    if (!id) return;
    setHistoryLoading(true);
    authFetch(`${apiBase}/members/${id}/event-history`)
      .then((r) => r.json())
      .then((data) => setHistory(Array.isArray(data) ? data : []))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setPhotoSizeError(true);
      e.target.value = "";
      return;
    }
    const url = URL.createObjectURL(file);
    setCropZoom(1);
    setCropOffset({ x: 0, y: 0 });
    cropImgRef.current = null;
    setPhotoPreview({ file, url });
    e.target.value = "";
  }

  async function confirmPhotoUpload() {
    if (!photoPreview || !member) return;
    setUploadingPhoto(true);
    try {
      // Draw cropped circle to canvas and export as blob
      const SIZE = 400;
      const canvas = document.createElement("canvas");
      canvas.width = SIZE; canvas.height = SIZE;
      const ctx = canvas.getContext("2d")!;
      const img = cropImgRef.current;
      if (img) {
        const scale = Math.min(img.naturalWidth, img.naturalHeight) / SIZE;
        const drawSize = SIZE * cropZoom;
        const sx = (img.naturalWidth / 2) - (drawSize * scale / 2) + cropOffset.x * scale;
        const sy = (img.naturalHeight / 2) - (drawSize * scale / 2) + cropOffset.y * scale;
        ctx.beginPath();
        ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, sx, sy, drawSize * scale, drawSize * scale, 0, 0, SIZE, SIZE);
      }
      const blob = await new Promise<Blob>((res) => canvas.toBlob((b) => res(b!), "image/jpeg", 0.9));
      const croppedFile = new File([blob], "photo.jpg", { type: "image/jpeg" });
        
      const fileName = `${Date.now()}.jpg`;
      const path = `fotos_membros/${member.id}/${fileName}`;
      
      const { error } = await supabase.storage.from('dados').upload(path, croppedFile, { upsert: true, contentType: "image/jpeg" });
      if (error) throw new Error("Falha no upload: " + error.message);
      
      const { data: urlData } = supabase.storage.from('dados').getPublicUrl(path);
      const uploaded = urlData.publicUrl;
      
      await authFetch(`${apiBase}/members/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify({ photoUrl: uploaded }),
      });
      setMember((prev) => prev ? { ...prev, photoUrl: uploaded } : prev);
    } catch (err) {
      console.error(err);
      alert("Erro ao enviar foto: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploadingPhoto(false);
      URL.revokeObjectURL(photoPreview.url);
      setPhotoPreview(null);
    }
  }

  const storedUser = (() => { try { return JSON.parse(localStorage.getItem("mrm_user") || "{}"); } catch { return {}; } })();
  const canManageHistory = storedUser.profileType === "master" || storedUser.profileType === "admin" || storedUser.profileType === "campo";

  const maxDay = Math.max(...attendanceByDay, 1);
  const memberSince = member?.membershipDate || member?.baptismDate;

  const filteredHistory = history.filter((h) => {
    // Pipeline events are now shown per user request
    // if (h.card?.protocol) return false;
    if (!histSearch.trim()) return true;
    const q = histSearch.toLowerCase();
    return (
      (h.action || "").toLowerCase().includes(q) ||
      (h.serviceName || "").toLowerCase().includes(q) ||
      (h.card?.protocol || "").toLowerCase().includes(q) ||
      (h.card?.church?.name || "").toLowerCase().includes(q) ||
      (h.notes || "").toLowerCase().includes(q)
    );
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: "historico", label: "Histórico" },
    { key: "titulos", label: "Títulos" },
    { key: "funcoes", label: "Funções" },
    { key: "familia", label: "Família" },
    { key: "igrejas", label: "Outras Igrejas" },
  ];

  // Só apresentação: cartão branco e cartão escuro do guia Silas.
  const cartao = "rounded-[22px] border border-[#e8ecf1] bg-white dark:border-slate-700 dark:bg-slate-800";
  const totalPresencasDia = attendanceByDay.reduce((s, n) => s + n, 0);
  const periodoMaior = attendanceByPeriod.manha === attendanceByPeriod.noite ? null : attendanceByPeriod.manha > attendanceByPeriod.noite ? "manha" : "noite";
  // Métricas só de exibição, contadas a partir dos mesmos campos do bloco
  // Informações (nada novo é buscado nem gravado).
  const preenchido = (v: string | null | undefined) => !!v && v !== "—";
  const gruposCadastro = [
    { rotulo: "Vínculo", campos: [regionalCode, campoName, churchName, member?.membershipDate] },
    { rotulo: "Contato", campos: [member?.mobile || member?.phone, member?.email] },
    { rotulo: "Dados pessoais", campos: [genderLabel, maritalLabel, member?.cpf, member?.spouseName] },
    { rotulo: "Vida cristã", campos: [member?.baptismDate, member?.ministryMemberships?.length ? "sim" : null] },
  ].map((g) => ({ rotulo: g.rotulo, feitos: g.campos.filter(preenchido).length, total: g.campos.length }));
  const camposFeitos = gruposCadastro.reduce((s, g) => s + g.feitos, 0);
  const camposTotal = gruposCadastro.reduce((s, g) => s + g.total, 0);
  const diasComoMembro = memberSince && !Number.isNaN(new Date(memberSince).getTime())
    ? Math.max(0, Math.floor((agora - new Date(memberSince).getTime()) / 86400000))
    : null;
  const tituloRol = [titleName !== "—" ? titleName : null, member?.rol != null ? `ROL ${member.rol}` : null].filter(Boolean).join(" · ");

  return (
    <div className="w-full space-y-4 p-4 sm:p-6">
      {/* Voltar + troca Perfil / Históricos (mesmo estado de antes) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/app-ui/members"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para membros
        </Link>
        <div className="flex gap-1 rounded-full border border-[#e8ecf1] bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
          {ABAS_PRINCIPAIS.map((aba) => (
            <button
              key={aba.key}
              onClick={() => setAbaPrincipal(aba.key)}
              className={`rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors ${
                abaPrincipal === aba.key
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {aba.label}
            </button>
          ))}
        </div>
      </div>

      {/* Aba "Perfil": dados cadastrais e presença. */}
      {abaPrincipal === "perfil" && (
      <>
      {/* ── Cabeçalho: nome, situação, chips e ações ─────────────────────── */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-slate-900 sm:text-[36px] dark:text-white">{member?.fullName || "—"}</h1>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${sCls}`}>{sLabel}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {tituloRol && (
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white dark:bg-white dark:text-slate-900">{tituloRol}</span>
            )}
            {member?.church?.name && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#e8ecf1] bg-white px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <Info className="h-3 w-3 flex-shrink-0" />
                {member.church.name}
              </span>
            )}
            {member?.church?.regional?.campo?.name && (
              <span className="rounded-full border border-[#e8ecf1] bg-white px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                Campo: {member.church.regional.campo.name}
              </span>
            )}
            {member?.addressCity && (
              <span className="rounded-full border border-[#e8ecf1] bg-white px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {member.addressCity}{member.addressState ? `, ${member.addressState}` : ""}
              </span>
            )}
            {memberSince && (
              <span className="rounded-full border border-[#e8ecf1] bg-white px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                Desde {fmtDate(memberSince)}
              </span>
            )}
          </div>
          {activeFunctions.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {activeFunctions.map((f) => (
                <span
                  key={f.id}
                  title={f.isCampoWide ? 'Função com alcance de campo' : 'Função na igreja do membro'}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
                >
                  {f.name}{f.isCampoWide ? ' · Campo' : ''}
                </span>
              ))}
            </div>
          )}
          {memberTags.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {memberTags.map((t) => (
                <span
                  key={t.id}
                  className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: t.color || '#8b5cf6' }}
                >
                  {t.name}
                </span>
              ))}
            </div>
          )}
          <div className="mt-4 max-w-xl">
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-medium text-slate-600 dark:text-slate-300">Cadastro completo</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {camposFeitos} de {camposTotal} campos · {Math.round((camposFeitos / camposTotal) * 100)}%
              </span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {gruposCadastro.map((g) => (
                <div key={g.rotulo} className="min-w-0">
                  <p className="mb-1 truncate text-[10.5px] text-slate-500 dark:text-slate-400">{g.rotulo}</p>
                  <div className={`flex h-7 items-center rounded-full px-3 text-[11px] font-bold ${
                    g.feitos === g.total
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : g.feitos === 0
                        ? "border border-[#e8ecf1] bg-white text-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        : "bg-slate-300 text-slate-800 dark:bg-slate-600 dark:text-slate-100"
                  }`}>
                    {g.feitos}/{g.total}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <button className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[#e8ecf1] bg-white px-4 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
              <Star className="h-4 w-4" />
              Favoritar
            </button>
            <Permissao chave="members.member_profile.editar" rotulo="Editar — Member Profile" herda="members.view">
              <button
                onClick={() => setShowEditDrawer(true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[#e8ecf1] bg-white px-4 text-[13px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <Edit className="h-4 w-4" />
                Editar
              </button>
            </Permissao>
            {canManageHistory && (
              <Permissao chave="members.member_profile.nova_ocorrencia" rotulo="Nova Ocorrência — Member Profile" herda="members.view">
                <button
                  onClick={() => setShowOccModal(true)}
                  // `bg-green-600` é só a rede de segurança: o tema o repinta com a
                  // cor da igreja, e `.btn-acao-verde` (em globals.css) vence os dois
                  // e deixa verde. Sem ela o botão continua visível, só não verde —
                  // em vez de virar texto branco sobre fundo transparente.
                  className="btn-acao-verde inline-flex h-10 items-center gap-1.5 rounded-full bg-green-600 px-4 text-[13px] font-semibold text-white transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Nova Ocorrência
                </button>
              </Permissao>
            )}
          </div>
          <div className="flex items-end gap-8">
            <div className="text-right">
              <p className="text-[34px] font-light leading-none tracking-[-0.03em] text-slate-900 dark:text-white">{history.length}</p>
              <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">Ocorrências</p>
            </div>
            <div className="text-right">
              <p className="text-[34px] font-light leading-none tracking-[-0.03em] text-slate-900 dark:text-white">{member?.ministryMemberships?.length ?? 0}</p>
              <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">Ministérios</p>
            </div>
            {diasComoMembro !== null && (
              <div className="text-right">
                <p className="text-[34px] font-light leading-none tracking-[-0.03em] text-slate-900 dark:text-white">{diasComoMembro}</p>
                <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">Dias como membro</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Painéis ───────────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* Cartão do membro (foto) */}
        <div className="relative flex min-h-[250px] flex-col overflow-hidden rounded-[22px] bg-slate-900 p-5 text-white dark:bg-slate-950">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[1.4px] text-white/60">Membro</span>
            <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={uploadingPhoto}
              className="grid h-9 w-9 place-items-center rounded-full border border-white/20 text-white/80 transition-colors hover:bg-white/10"
              title="Alterar foto"
            >
              <Camera className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center py-3">
            {member?.photoUrl ? (
              <img src={member.photoUrl} alt={member?.fullName ?? ""} className="h-28 w-28 rounded-full border-4 border-white/15 object-cover" />
            ) : (
              <span className="text-[64px] font-extralight leading-none tracking-[-0.02em] text-white/90">{ini}</span>
            )}
          </div>
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold">{member?.fullName || "—"}</p>
              <p className="truncate text-xs text-white/60">{genderLabel} · {maritalLabel}</p>
            </div>
            {member?.rol != null && (
              <span className="shrink-0 rounded-full border border-white/25 px-2.5 py-1 font-mono text-xs">#{member.rol}</span>
            )}
          </div>
        </div>

        {/* Presença por dia (face_presencas) */}
        <div className={`${cartao} flex flex-col p-5`}>
          <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Presença por dia</h2>
          <div className="mt-3 flex items-end gap-2">
            <span className="text-[34px] font-light leading-none text-slate-900 dark:text-white">{totalPresencasDia}</span>
            <span className="pb-1 text-[11px] leading-tight text-slate-500 dark:text-slate-400">registros de<br />presença</span>
          </div>
          <div className="mt-auto flex items-end justify-between gap-1 pt-4">
            {DAY_NAMES.map((d, i) => (
              <div key={d} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="relative h-20 w-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-full bg-[var(--sl-primary)] transition-all"
                    style={{ height: `${Math.round((attendanceByDay[i] / maxDay) * 100)}%` }}
                  />
                </div>
                <span className={`h-1.5 w-1.5 rounded-full ${attendanceByDay[i] > 0 ? "bg-[var(--sl-primary)]" : "bg-slate-300 dark:bg-slate-600"}`} title={`${attendanceByDay[i]} em ${d}`} />
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{d.charAt(0)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Período de maior presença (corte às 13h) */}
        <div className={`${cartao} flex flex-col p-5`}>
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-slate-900 dark:text-white">Maior presença</h2>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Período</span>
          </div>
          <div className="flex flex-1 items-center justify-center py-3">
            <div className="grid h-28 w-28 place-items-center rounded-full border-[10px] border-slate-100 dark:border-slate-700">
              <div className="text-center">
                <p className="text-[28px] font-light leading-none text-slate-900 dark:text-white">{attendance?.total ?? 0}</p>
                <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">registros</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: 'manha', label: 'Manhã' },
              { key: 'noite', label: 'Noite' },
            ] as const).map((p) => (
              <div
                key={p.key}
                className={`flex items-center justify-between rounded-full px-3.5 py-2 text-xs font-semibold ${
                  periodoMaior === p.key
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                }`}
              >
                <span>{p.label}</span>
                <span>{attendanceByPeriod[p.key]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Histórico (resumo) + última presença */}
        <div className="flex flex-col rounded-[22px] bg-slate-900 p-5 text-white md:row-span-2 dark:bg-slate-950">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[17px] font-bold">Histórico</h2>
            <span className="text-[30px] font-light leading-none">
              {Math.min(history.length, 3)}<span className="text-white/40">/{history.length}</span>
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-white/60">
            Último serviço: <strong className="font-semibold text-white">{lastService?.serviceName || lastService?.serviceGroup || lastService?.action || "—"}</strong>
            {" · "}Última atividade {lastService?.createdAt ? fmtDate(lastService.createdAt) : "—"}
          </p>
          <div className="mt-4 flex flex-col">
            {history.slice(0, 3).map((h, i) => {
              const { Icone } = iconeDoProcesso(h.action || h.serviceName);
              return (
                <div key={h.id} className="flex items-center gap-3 border-b border-white/10 py-3 last:border-b-0">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${i === 0 ? "bg-white text-slate-900" : "bg-white/10 text-white"}`}>
                    <Icone className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold">{h.action || h.serviceName || "—"}</p>
                    <p className="truncate text-[11px] text-white/50">
                      {h.createdAt ? new Date(h.createdAt).toLocaleDateString("pt-BR") : "—"}{h.serviceName ? ` · ${h.serviceName}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-white/50">{(h.card?.protocol || h.id).slice(-6).toUpperCase()}</span>
                </div>
              );
            })}
            {history.length === 0 && (
              <p className="py-4 text-sm text-white/50">{historyLoading ? "Carregando histórico..." : "Nenhum registro encontrado."}</p>
            )}
          </div>
          <div className="mt-auto pt-4">
            <div className="rounded-2xl bg-white/5 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-[1.2px] text-white/50">Última presença</p>
              {attendance?.lastPresence ? (
                <>
                  <p className="mt-1 text-sm font-semibold">{fmtDate(attendance.lastPresence.horario)}</p>
                  {attendance.lastPresence.igrejaRegional && (
                    <p className="text-xs text-white/70">{attendance.lastPresence.igrejaRegional}</p>
                  )}
                  <p className="mt-1 text-[11px] text-white/50">
                    {attendance.distinctDays} dia(s) com presença · {attendance.total} detecção(ões)
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-white/70">Nenhum registro de presença facial.</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => { setActiveTab("historico"); setAbaPrincipal("historicos"); }}
              className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-white text-[13px] font-bold text-slate-900"
            >
              Ver históricos completos
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Informações (os mesmos campos de antes, em grupos) */}
        <div className={`${cartao} p-5 md:col-span-2 xl:col-span-3`}>
          <h2 className="text-[17px] font-bold text-slate-900 dark:text-white">Informações</h2>
          <div className="mt-4 grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="mb-3 border-b border-[#eef2f6] pb-2 text-[13px] font-bold text-slate-800 dark:border-slate-700 dark:text-slate-100">Vínculo</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <InfoCell label="Regional" value={regionalCode} />
                <InfoCell label="Campo" value={campoName} />
                <InfoCell label="Igreja" value={churchName} />
                <InfoCell label="Membro desde" value={fmtDate(member?.membershipDate)} />
              </div>
            </div>
            <div>
              <p className="mb-3 border-b border-[#eef2f6] pb-2 text-[13px] font-bold text-slate-800 dark:border-slate-700 dark:text-slate-100">Dados pessoais</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <InfoCell label="Sexo" value={genderLabel} />
                <InfoCell label="Estado Civil" value={maritalLabel} />
                <InfoCell label="CPF" value={member?.cpf || "—"} />
                <InfoCell label="Cônjuge" value={member?.spouseName || "—"} />
              </div>
            </div>
            <div>
              <p className="mb-3 border-b border-[#eef2f6] pb-2 text-[13px] font-bold text-slate-800 dark:border-slate-700 dark:text-slate-100">Contato</p>
              <div className="grid grid-cols-1 gap-y-3 text-sm">
                <InfoCell label="Contato" value={member?.mobile || member?.phone || "—"} />
                <InfoCell label="E-mail" value={member?.email || "—"} />
              </div>
            </div>
            <div>
              <p className="mb-3 border-b border-[#eef2f6] pb-2 text-[13px] font-bold text-slate-800 dark:border-slate-700 dark:text-slate-100">Vida cristã</p>
              <div className="grid grid-cols-1 gap-y-3 text-sm">
                <InfoCell label="Batismo" value={fmtDate(member?.baptismDate)} />
                <InfoCell label="Ministérios" value={
                  member?.ministryMemberships?.length
                    ? member.ministryMemberships.map((m) => m.ministry.name).join(", ")
                    : "—"
                } />
              </div>
            </div>
          </div>
        </div>
      </div>
      </>
      )}

      {member && (
        <MemberEditDrawer
          memberId={member.id}
          open={showEditDrawer}
          onClose={() => setShowEditDrawer(false)}
          onSaved={() => {
            setShowEditDrawer(false);
            // Reload member data
            authFetch(`${apiBase}/members/${member.id}`)
              .then((r) => r.json())
              .then((data) => setMember(data))
              .catch(() => {});
          }}
          titles={ecclesiasticalTitles}
        />
      )}

      {showOccModal && member && canManageHistory && (
        <OccurrenceModal
          memberId={member.id}
          onClose={() => setShowOccModal(false)}
          onSaved={() => { setShowOccModal(false); reloadHistory(); setTitleRefreshKey((k) => k + 1); setMemberRefreshKey((k) => k + 1); }}
        />
      )}

      {/* Photo cropper modal */}
      {photoPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-base font-semibold text-slate-800 mb-3">Enquadrar foto</h2>
            <p className="text-xs text-slate-400 mb-4">Arraste para reposicionar. Use o zoom para ajustar.</p>

            {/* Crop area */}
            <div className="flex justify-center mb-4">
              <div
                className="relative overflow-hidden rounded-full border-4 border-slate-300 cursor-grab active:cursor-grabbing"
                style={{ width: 220, height: 220 }}
                onMouseDown={(e) => {
                  cropDragRef.current = { startX: e.clientX, startY: e.clientY, ox: cropOffset.x, oy: cropOffset.y };
                }}
                onMouseMove={(e) => {
                  if (!cropDragRef.current) return;
                  const dx = e.clientX - cropDragRef.current.startX;
                  const dy = e.clientY - cropDragRef.current.startY;
                  setCropOffset({ x: cropDragRef.current.ox + dx, y: cropDragRef.current.oy + dy });
                }}
                onMouseUp={() => { cropDragRef.current = null; }}
                onMouseLeave={() => { cropDragRef.current = null; }}
                onTouchStart={(e) => {
                  const t = e.touches[0];
                  cropDragRef.current = { startX: t.clientX, startY: t.clientY, ox: cropOffset.x, oy: cropOffset.y };
                }}
                onTouchMove={(e) => {
                  if (!cropDragRef.current) return;
                  const t = e.touches[0];
                  const dx = t.clientX - cropDragRef.current.startX;
                  const dy = t.clientY - cropDragRef.current.startY;
                  setCropOffset({ x: cropDragRef.current.ox + dx, y: cropDragRef.current.oy + dy });
                }}
                onTouchEnd={() => { cropDragRef.current = null; }}
              >
                <img
                  ref={(el) => { if (el) cropImgRef.current = el; }}
                  src={photoPreview.url}
                  alt="crop"
                  draggable={false}
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: `translate(calc(-50% + ${cropOffset.x}px), calc(-50% + ${cropOffset.y}px)) scale(${cropZoom})`,
                    transformOrigin: "center",
                    maxWidth: "none",
                    width: 220,
                    height: 220,
                    objectFit: "cover",
                    userSelect: "none",
                    pointerEvents: "none",
                  }}
                />
              </div>
            </div>

            {/* Zoom */}
            <div className="flex items-center gap-2 mb-5">
              <button onClick={() => setCropZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(1)))} className="p-1 rounded hover:bg-slate-100"><ZoomOut className="w-4 h-4 text-slate-500" /></button>
              <input
                type="range" min="0.5" max="3" step="0.05"
                value={cropZoom}
                onChange={(e) => setCropZoom(Number(e.target.value))}
                className="flex-1"
              />
              <button onClick={() => setCropZoom((z) => Math.min(3, +(z + 0.1).toFixed(1)))} className="p-1 rounded hover:bg-slate-100"><ZoomIn className="w-4 h-4 text-slate-500" /></button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { URL.revokeObjectURL(photoPreview.url); setPhotoPreview(null); }}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmPhotoUpload}
                disabled={uploadingPhoto}
                className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
              >
                {uploadingPhoto ? "Salvando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Aba "Históricos": tudo o que é linha do tempo do membro. */}
      {abaPrincipal === "historicos" && (
      <div className="space-y-4">
        {/* Resumo do membro */}
        <div className={`${cartao} flex flex-wrap items-center gap-x-8 gap-y-4 p-5`}>
          <div className="flex min-w-0 items-center gap-4">
            {member?.photoUrl ? (
              <span role="img" aria-label={member?.fullName ?? ""} className="h-16 w-16 shrink-0 rounded-2xl bg-cover bg-center" style={{ backgroundImage: `url("${member.photoUrl}")` }} />
            ) : (
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-slate-900 text-2xl font-light text-white dark:bg-slate-950">{ini}</span>
            )}
            <div className="min-w-0">
              <p className="truncate text-[22px] font-extrabold leading-tight tracking-[-0.02em] text-slate-900 dark:text-white">{member?.fullName || "—"}</p>
              <p className="truncate text-[13px] text-slate-500 dark:text-slate-400">
                {[tituloRol || null, member?.church?.name || null].filter(Boolean).join(" · ") || "—"}
              </p>
            </div>
          </div>
          <div className="flex items-end gap-8">
            <div>
              <p className="text-[30px] font-light leading-none text-slate-900 dark:text-white">{history.length}</p>
              <p className="mt-1 text-[12px] font-medium text-slate-500 dark:text-slate-400">Registros</p>
            </div>
            <div>
              <p className="text-[30px] font-light leading-none text-slate-900 dark:text-white">
                {lastService?.createdAt ? new Date(lastService.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : "—"}
              </p>
              <p className="mt-1 text-[12px] font-medium text-slate-500 dark:text-slate-400">Última atividade</p>
            </div>
          </div>
          {canManageHistory && (
            <div className="sm:ml-auto">
              <Permissao chave="members.member_profile.nova_ocorrencia" rotulo="Nova Ocorrência — Member Profile" herda="members.view">
                <button
                  onClick={() => setShowOccModal(true)}
                  className="btn-acao-verde inline-flex h-11 items-center gap-1.5 rounded-full bg-green-600 px-5 text-sm font-semibold text-white transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Nova Ocorrência
                </button>
              </Permissao>
            </div>
          )}
        </div>

        <div className={`${cartao} p-4 sm:p-5`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${
                    activeTab === t.key
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                  }`}
                >
                  {t.label}
                  {t.key === "historico" && (
                    <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold ${
                      activeTab === t.key ? "bg-white/20" : "bg-slate-200 dark:bg-slate-600"
                    }`}>{history.length}</span>
                  )}
                </button>
              ))}
            </div>
            {activeTab === "historico" && (
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por processo, origem..."
                  value={histSearch}
                  onChange={(e) => setHistSearch(e.target.value)}
                  className="h-10 w-full rounded-full border border-[#e8ecf1] bg-white pl-10 pr-4 text-sm text-slate-800 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            )}
          </div>

          {activeTab === "historico" && (
            <HistoricoTab
              history={filteredHistory}
              total={history.length}
              loading={historyLoading}
              canManage={canManageHistory}
              onDelete={(hid) => setDeleteHistId(hid)}
              onEdit={(h) => { setEditHistRow(h); setEditHistNotes(h.notes || ""); }}
            />
          )}
          {activeTab === "titulos" && member && (
            <TitulosTab memberId={member.id} refreshKey={titleRefreshKey} />
          )}
          {activeTab === "funcoes" && member && (
            <FuncoesTab
              memberId={member.id}
              churchName={member.church?.name}
              canManage={canManageHistory}
              onChanged={() => setFunctionsRefreshKey((k) => k + 1)}
            />
          )}
          {activeTab === "familia" && member && (
            <FamiliaTab memberId={member.id} canManage={canManageHistory} />
          )}
          {activeTab === "igrejas" && member && (
            <OutrasIgrejasTab
              memberId={member.id}
              canManage={canManageHistory}
              titleOptions={ecclesiasticalTitles.map((t) => t.name)}
            />
          )}
        </div>
      </div>
      )}

      {/* Modal: foto muito grande */}
      {photoSizeError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-slate-900 mb-2">Imagem muito grande</h3>
            <p className="text-sm text-slate-600 mb-5">A imagem selecionada ultrapassa o limite de <strong>5 MB</strong>. Escolha um arquivo menor.</p>
            <div className="flex justify-end">
              <button onClick={() => setPhotoSizeError(false)} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition-colors">Ok</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: confirmar exclusão de histórico */}
      {deleteHistId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-slate-900 mb-2">Excluir registro</h3>
            <p className="text-sm text-slate-600 mb-5">Tem certeza que deseja excluir este registro do histórico? Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteHistId(null)} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">Cancelar</button>
              <Permissao chave="members.member_profile.excluir" rotulo="Excluir — Member Profile" herda="members.view">
                <button onClick={() => {
                  authFetch(`${apiBase}/members/${id}/event-history/${deleteHistId}`, { method: "DELETE" })
                    .then(() => { reloadHistory(); setDeleteHistId(null); })
                    .catch(() => setDeleteHistId(null));
                }} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors">Excluir</button>
              </Permissao>
            </div>
          </div>
        </div>
      )}

      {/* Modal: editar observações do histórico */}
      {editHistRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-slate-900 mb-4">Editar observações</h3>
            <textarea
              autoFocus
              rows={4}
              value={editHistNotes}
              onChange={(e) => setEditHistNotes(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Observações..."
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => { setEditHistRow(null); setEditHistNotes(""); }} disabled={savingHist} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">Cancelar</button>
              <Permissao chave="members.member_profile.salvar" rotulo="Salvar — Member Profile" herda="members.view">
                <button disabled={savingHist} onClick={() => {
                  setSavingHist(true);
                  authFetch(`${apiBase}/members/${id}/event-history/${editHistRow.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ notes: editHistNotes }),
                  }).then(() => { reloadHistory(); setEditHistRow(null); setEditHistNotes(""); })
                    .catch(() => {})
                    .finally(() => setSavingHist(false));
                }} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition-colors disabled:opacity-60">{savingHist ? "Salvando..." : "Salvar"}</button>
              </Permissao>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">{label}</div>
      <div className="text-slate-800 font-medium truncate" title={value}>
        {value}
      </div>
    </div>
  );
}

function TitulosTab({ memberId, refreshKey }: { memberId: string; refreshKey: number }) {
  const [rows, setRows] = useState<{
    id: string; previousTitle: string | null; newTitle: string; source: string | null;
    serviceGroup: string | null; serviceName: string | null; memberCity: string | null;
    memberCountry: string | null; notes: string | null; createdAt: string;
    createdByUser: { fullName: string } | null;
  }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    authFetch(`${apiBase}/members/${memberId}/title-history`)
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [memberId, refreshKey]);

  if (loading) return (
    <div className="space-y-3">
      {[1,2,3].map((i) => <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />)}
    </div>
  );

  if (rows.length === 0) return (
    <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
      Nenhum histórico de título eclesiástico registrado.
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
            <th className="text-left pb-3 pr-4">Data</th>
            <th className="text-left pb-3 pr-4">Título Anterior</th>
            <th className="text-left pb-3 pr-4">Novo Título</th>
            <th className="text-left pb-3 pr-4">Origem</th>
            <th className="text-left pb-3 pr-4">Serviço</th>
            <th className="text-left pb-3 pr-4">Cidade</th>
            <th className="text-left pb-3">Registrado por</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-slate-50 transition-colors">
              <td className="py-3 pr-4 whitespace-nowrap text-slate-500 text-xs">
                {new Date(r.createdAt).toLocaleDateString("pt-BR")}
              </td>
              <td className="py-3 pr-4 text-slate-500 italic">{r.previousTitle || "—"}</td>
              <td className="py-3 pr-4 font-semibold text-slate-800">{r.newTitle}</td>
              <td className="py-3 pr-4">
                <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${
                  r.source === "OCORRENCIA_RAPIDA" ? "bg-blue-100 text-blue-700" :
                  r.source === "MATRIZ" ? "bg-purple-100 text-purple-700" :
                  "bg-slate-100 text-slate-600"
                }`}>
                  {r.source === "OCORRENCIA_RAPIDA" ? "Ocorrência Rápida" : r.source || "Manual"}
                </span>
              </td>
              <td className="py-3 pr-4 text-slate-600 text-xs">{r.serviceName || r.serviceGroup || "—"}</td>
              <td className="py-3 pr-4 text-slate-500 text-xs">{r.memberCity ? `${r.memberCity}${r.memberCountry ? ` / ${r.memberCountry}` : ""}` : "—"}</td>
              <td className="py-3 text-slate-500 text-xs">{r.createdByUser?.fullName || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlaceholderTab({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
      {label} — em breve
    </div>
  );
}

// ─── Núcleo familiar ──────────────────────────────────────────────────────────
// O familiar pode ser um membro cadastrado OU uma pessoa avulsa (nome +
// nascimento + sexo) — caso comum de filhos pequenos sem cadastro.

type FamilyRow = {
  id: string;
  relationshipType: string;
  relatedName: string | null;
  relatedBirthDate: string | null;
  relatedGender: string | null;
  notes: string | null;
  relatedMember?: { id: string; fullName: string; rol: number | null; birthDate: string | null; gender: string | null } | null;
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  FILHO: 'Filho(a)',
  CONJUGE: 'Cônjuge',
  PAI_MAE: 'Pai/Mãe',
  IRMAO: 'Irmão/Irmã',
};

function calcAge(birth: string | null | undefined): string {
  if (!birth) return '—';
  const d = new Date(birth);
  if (isNaN(d.getTime())) return '—';
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 ? `${age} ano${age === 1 ? '' : 's'}` : '—';
}

const emptyFamilyForm = {
  id: '',
  relationshipType: 'FILHO',
  relatedName: '',
  relatedBirthDate: '',
  relatedGender: '',
  relatedMemberId: '',
  notes: '',
};

function FamiliaTab({ memberId, canManage }: { memberId: string; canManage: boolean }) {
  const [rows, setRows] = useState<FamilyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyFamilyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<FamilyRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Busca opcional para vincular um membro já cadastrado
  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState<{ id: string; fullName: string; rol: number | null }[]>([]);
  const [linkedLabel, setLinkedLabel] = useState('');

  const load = () => {
    setLoading(true);
    authFetch(`${apiBase}/members/${memberId}/family`)
      .then((r) => r.json())
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [memberId]);

  // Busca de membros para vínculo (debounce simples)
  useEffect(() => {
    if (!memberSearch.trim()) { setMemberResults([]); return; }
    const t = setTimeout(() => {
      authFetch(`${apiBase}/members?q=${encodeURIComponent(memberSearch.trim())}&pageSize=8`)
        .then((r) => r.json())
        .then((d) => setMemberResults(Array.isArray(d) ? d : (d?.data ?? [])))
        .catch(() => setMemberResults([]));
    }, 350);
    return () => clearTimeout(t);
  }, [memberSearch]);

  const openCreate = () => {
    setForm(emptyFamilyForm);
    setLinkedLabel('');
    setMemberSearch('');
    setMemberResults([]);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (row: FamilyRow) => {
    setForm({
      id: row.id,
      relationshipType: row.relationshipType,
      relatedName: row.relatedName || '',
      relatedBirthDate: row.relatedBirthDate ? String(row.relatedBirthDate).slice(0, 10) : '',
      relatedGender: row.relatedGender || '',
      relatedMemberId: row.relatedMember?.id || '',
      notes: row.notes || '',
    });
    setLinkedLabel(row.relatedMember?.fullName || '');
    setMemberSearch('');
    setMemberResults([]);
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.relatedMemberId && !form.relatedName.trim()) {
      setFormError('Informe o nome do familiar ou vincule um membro existente.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        relationshipType: form.relationshipType,
        relatedMemberId: form.relatedMemberId || null,
        relatedName: form.relatedName || null,
        relatedBirthDate: form.relatedBirthDate || null,
        relatedGender: form.relatedGender || null,
        notes: form.notes || null,
      };
      const res = form.id
        ? await authFetch(`${apiBase}/members/${memberId}/family/${form.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await authFetch(`${apiBase}/members/${memberId}/family`, { method: 'POST', body: JSON.stringify(payload) });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || 'Falha ao salvar.');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Falha ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await authFetch(`${apiBase}/members/${memberId}/family/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error();
      setDeleteTarget(null);
      load();
    } catch { /* mantém aberto */ } finally { setDeleting(false); }
  };

  const grouped = ['FILHO', 'CONJUGE', 'PAI_MAE', 'IRMAO'].map((type) => ({
    type,
    items: rows.filter((r) => r.relationshipType === type),
  })).filter((g) => g.items.length > 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-slate-400">
          Filhos, cônjuge e demais familiares. O familiar não precisa ter cadastro de membro.
        </p>
        <Permissao chave="members.member_profile.adicionar_familiar" rotulo="Adicionar familiar — Member Profile" herda="members.view">
          <button
            onClick={openCreate}
            disabled={!canManage}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
          >
            <Plus className="w-4 h-4" /> Adicionar familiar
          </button>
        </Permissao>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />)}</div>
      ) : rows.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
          Nenhum familiar cadastrado.
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map((g) => (
            <div key={g.type}>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {RELATIONSHIP_LABELS[g.type] ?? g.type} ({g.items.length})
              </h4>
              <div className="space-y-2">
                {g.items.map((r) => {
                  const name = r.relatedMember?.fullName || r.relatedName || '—';
                  const birth = r.relatedMember?.birthDate || r.relatedBirthDate;
                  return (
                    <div key={r.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 hover:bg-slate-50">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-500">
                        {initials(name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">{name}</p>
                        <p className="text-xs text-slate-500">
                          {birth ? `${fmtDate(birth)} · ${calcAge(birth)}` : 'Sem data de nascimento'}
                          {r.relatedMember ? ' · Membro cadastrado' : ''}
                        </p>
                      </div>
                      {r.relatedMember && (
                        <Link
                          to={`/app-ui/members/${r.relatedMember.id}`}
                          className="text-xs font-medium text-indigo-600 hover:underline"
                        >
                          Ver perfil
                        </Link>
                      )}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => canManage && openEdit(r)}
                          disabled={!canManage}
                          className={`p-1 rounded ${canManage ? 'hover:bg-slate-200 text-slate-500' : 'text-slate-300 cursor-not-allowed'}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => canManage && setDeleteTarget(r)}
                          disabled={!canManage}
                          className={`p-1 rounded ${canManage ? 'hover:bg-red-100 text-slate-500 hover:text-red-600' : 'text-slate-300 cursor-not-allowed'}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                {form.id ? 'Editar familiar' : 'Adicionar familiar'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1 hover:bg-slate-100">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Vínculo *</label>
                <select
                  value={form.relationshipType}
                  onChange={(e) => setForm((p) => ({ ...p, relationshipType: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {Object.entries(RELATIONSHIP_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>

              {/* Vínculo opcional com membro já cadastrado */}
              <div className="rounded-lg border border-slate-200 p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                  Vincular a um membro (opcional)
                </p>
                {form.relatedMemberId ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-700">{linkedLabel || 'Membro vinculado'}</span>
                    <Permissao chave="members.member_profile.remover_vinculo" rotulo="Remover vínculo — Member Profile" herda="members.view">
                      <button
                        type="button"
                        onClick={() => { setForm((p) => ({ ...p, relatedMemberId: '' })); setLinkedLabel(''); }}
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Remover vínculo
                      </button>
                    </Permissao>
                  </div>
                ) : (
                  <>
                    <input
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Buscar membro por nome..."
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    {memberResults.length > 0 && (
                      <div className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-slate-100">
                        {memberResults.map((m) => (
                          <button
                            type="button"
                            key={m.id}
                            onClick={() => {
                              setForm((p) => ({ ...p, relatedMemberId: m.id, relatedName: '' }));
                              setLinkedLabel(m.fullName);
                              setMemberResults([]);
                              setMemberSearch('');
                            }}
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                          >
                            {m.fullName}{m.rol ? ` · ROL ${m.rol}` : ''}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Dados avulsos — só quando não há membro vinculado */}
              {!form.relatedMemberId && (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Nome *</label>
                    <input
                      value={form.relatedName}
                      onChange={(e) => setForm((p) => ({ ...p, relatedName: e.target.value }))}
                      placeholder="Nome completo do familiar"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Nascimento</label>
                      <input
                        type="date"
                        value={form.relatedBirthDate}
                        onChange={(e) => setForm((p) => ({ ...p, relatedBirthDate: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Sexo</label>
                      <select
                        value={form.relatedGender}
                        onChange={(e) => setForm((p) => ({ ...p, relatedGender: e.target.value }))}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="">Selecione</option>
                        <option value="MASCULINO">Masculino</option>
                        <option value="FEMININO">Feminino</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Observações</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Cancelar
                </button>
                <Permissao chave="members.member_profile.salvar" rotulo="Salvar — Member Profile" herda="members.view">
                  <button type="submit" disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                </Permissao>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remover familiar?"
        message="O vínculo familiar será removido do cadastro deste membro."
        confirmLabel="Remover"
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ─── Histórico em outras igrejas ──────────────────────────────────────────────
// Vida eclesiástica do membro ANTES de entrar nesta igreja: uma linha por igreja
// onde ele passou (título de lá, batismo, consagração, pastor, funções).

function OutrasIgrejasTab({
  memberId,
  canManage,
  titleOptions,
}: {
  memberId: string;
  canManage: boolean;
  titleOptions: string[];
}) {
  const [rows, setRows] = useState<PreviousChurchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<PreviousChurchForm>(emptyPreviousChurchForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<PreviousChurchRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    authFetch(`${apiBase}/members/${memberId}/previous-churches`)
      .then((r) => r.json())
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [memberId]);

  const openCreate = () => {
    setForm(emptyPreviousChurchForm);
    setFormError("");
    setModalOpen(true);
  };

  const openEdit = (row: PreviousChurchRow) => {
    setForm(previousChurchRowToForm(row));
    setFormError("");
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.churchName.trim()) {
      setFormError("Informe o nome da igreja.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const payload = previousChurchPayload(form);
      const res = form.id
        ? await authFetch(`${apiBase}/members/${memberId}/previous-churches/${form.id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await authFetch(`${apiBase}/members/${memberId}/previous-churches`, {
            method: "POST",
            body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Falha ao salvar.");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await authFetch(`${apiBase}/members/${memberId}/previous-churches/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) throw new Error();
      setDeleteTarget(null);
      load();
    } catch { /* mantém aberto */ } finally { setDeleting(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-slate-400">
          Igrejas onde o membro passou antes de entrar nesta: título de lá, batismo, consagração, pastor e funções.
        </p>
        <Permissao chave="members.member_profile.adicionar_historico_em_outra_igreja" rotulo="Adicionar histórico em outra igreja — Member Profile" herda="members.view">
          <button
            onClick={openCreate}
            disabled={!canManage}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40"
          >
            <Plus className="w-4 h-4" /> Adicionar histórico em outra igreja
          </button>
        </Permissao>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-20 bg-slate-100 rounded-lg animate-pulse" />)}</div>
      ) : rows.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
          Nenhum histórico em outra igreja cadastrado.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-100 px-4 py-3 hover:bg-slate-50">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{r.churchName}</p>
                  <p className="text-xs text-slate-500">
                    {r.ecclesiasticalTitle || "Sem título informado"}
                    {r.pastorName ? ` · Pr. ${r.pastorName}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => canManage && openEdit(r)}
                    disabled={!canManage}
                    className={`p-1 rounded ${canManage ? "hover:bg-slate-200 text-slate-500" : "text-slate-300 cursor-not-allowed"}`}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => canManage && setDeleteTarget(r)}
                    disabled={!canManage}
                    className={`p-1 rounded ${canManage ? "hover:bg-red-100 text-slate-500 hover:text-red-600" : "text-slate-300 cursor-not-allowed"}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
                <div>
                  <span className="block text-[11px] uppercase tracking-wide text-slate-400">Aceitou Jesus</span>
                  {fmtDate(r.conversionDate)}
                </div>
                <div>
                  <span className="block text-[11px] uppercase tracking-wide text-slate-400">Batismo</span>
                  {fmtDate(r.baptismDate)}
                </div>
                <div>
                  <span className="block text-[11px] uppercase tracking-wide text-slate-400">Consagração</span>
                  {fmtDate(r.consecrationDate)}
                  {r.consecrationTitle ? ` · ${r.consecrationTitle}` : ""}
                </div>
              </div>

              {r.functions && (
                <p className="mt-2 text-xs text-slate-600">
                  <span className="text-[11px] uppercase tracking-wide text-slate-400">Funções: </span>
                  {r.functions}
                </p>
              )}
              {r.notes && <p className="mt-1 text-xs text-slate-500">{r.notes}</p>}
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-base font-semibold text-slate-900">
                {form.id ? "Editar histórico em outra igreja" : "Adicionar histórico em outra igreja"}
              </h3>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1 hover:bg-slate-100">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
              )}

              <PreviousChurchFields
                form={form}
                onChange={(patch) => setForm((p) => ({ ...p, ...patch }))}
                titleOptions={titleOptions}
                idPrefix="profile-prev-church"
              />

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Cancelar
                </button>
                <Permissao chave="members.member_profile.salvar" rotulo="Salvar — Member Profile" herda="members.view">
                  <button type="submit" disabled={saving} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50">
                    {saving ? "Salvando..." : "Salvar"}
                  </button>
                </Permissao>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remover histórico?"
        message="O histórico nesta outra igreja será removido do cadastro do membro."
        confirmLabel="Remover"
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ─── Funções do membro ────────────────────────────────────────────────────────
// Grava na mesma tabela da aba "Funcoes" de Editar Igreja (church_function_history),
// então o que é criado aqui aparece lá e vice-versa.

type MemberFunctionRow = {
  id: string;
  department: string | null;
  startDate: string;
  endDate: string | null;
  notes: string | null;
  isActive: boolean;
  isCampoWide: boolean;
  church?: { id: string; name: string } | null;
  function?: { id: string; name: string | null; isLeaderRole: boolean | null } | null;
};

type FunctionCatalogItem = { id: string; name: string | null; isLeaderRole?: boolean | null };

const emptyFunctionForm = {
  id: '',
  functionId: '',
  department: '',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: '',
  notes: '',
  isActive: true,
  isCampoWide: false,
};

function FuncoesTab({
  memberId,
  churchName,
  canManage,
  onChanged,
}: {
  memberId: string;
  churchName?: string | null;
  canManage: boolean;
  onChanged?: () => void;
}) {
  const [rows, setRows] = useState<MemberFunctionRow[]>([]);
  const [catalog, setCatalog] = useState<FunctionCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyFunctionForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<MemberFunctionRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    authFetch(`${apiBase}/members/${memberId}/functions`)
      .then((r) => r.json())
      .then((data) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    authFetch(`${apiBase}/church-functions/catalog`)
      .then((r) => r.json())
      .then((data) => setCatalog(Array.isArray(data) ? data : []))
      .catch(() => setCatalog([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId]);

  const openCreate = () => {
    setForm(emptyFunctionForm);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (row: MemberFunctionRow) => {
    setForm({
      id: row.id,
      functionId: row.function?.id || '',
      department: row.department || '',
      startDate: row.startDate ? String(row.startDate).slice(0, 10) : '',
      endDate: row.endDate ? String(row.endDate).slice(0, 10) : '',
      notes: row.notes || '',
      isActive: row.isActive,
      isCampoWide: row.isCampoWide,
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.functionId || !form.startDate) {
      setFormError('Informe a função e a data de início.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const payload = {
        functionId: form.functionId,
        department: form.department || undefined,
        startDate: form.startDate,
        endDate: form.endDate || null,
        notes: form.notes || undefined,
        isActive: form.isActive,
        isCampoWide: form.isCampoWide,
      };
      const res = form.id
        ? await authFetch(`${apiBase}/church-function-history/${form.id}`, {
            method: 'PATCH', body: JSON.stringify(payload),
          })
        : await authFetch(`${apiBase}/members/${memberId}/functions`, {
            method: 'POST', body: JSON.stringify(payload),
          });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Falha ao salvar a função.');
      }
      setModalOpen(false);
      load();
      onChanged?.();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Falha ao salvar a função.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await authFetch(`${apiBase}/church-function-history/${deleteTarget.id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('Falha ao excluir a função.');
      setDeleteTarget(null);
      load();
      onChanged?.();
    } catch {
      /* mantém o diálogo aberto em caso de erro */
    } finally {
      setDeleting(false);
    }
  };

  const active = rows.filter((r) => r.isActive);
  const history = rows.filter((r) => !r.isActive);

  const renderRow = (r: MemberFunctionRow) => (
    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
      <td className="py-3 pr-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">{r.function?.name || '—'}</span>
          {r.isActive && (
            <span className="text-xs rounded-full px-2 py-0.5 font-medium bg-green-100 text-green-700">Ativa</span>
          )}
          {r.isCampoWide && (
            <span className="text-xs rounded-full px-2 py-0.5 font-medium bg-indigo-100 text-indigo-700">Campo</span>
          )}
        </div>
      </td>
      <td className="py-3 pr-4 text-slate-600 text-xs">{r.department || '—'}</td>
      <td className="py-3 pr-4 text-slate-600 text-xs">{r.church?.name || '—'}</td>
      <td className="py-3 pr-4 text-slate-500 text-xs whitespace-nowrap">{fmtDate(r.startDate)}</td>
      <td className="py-3 pr-4 text-slate-500 text-xs whitespace-nowrap">{r.endDate ? fmtDate(r.endDate) : '—'}</td>
      <td className="py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => canManage && openEdit(r)}
            disabled={!canManage}
            title={canManage ? 'Editar' : 'Sem permissão'}
            className={`p-1 rounded transition-colors ${canManage ? 'hover:bg-slate-200 text-slate-500 hover:text-slate-700' : 'text-slate-300 cursor-not-allowed'}`}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => canManage && setDeleteTarget(r)}
            disabled={!canManage}
            title={canManage ? 'Excluir' : 'Sem permissão'}
            className={`p-1 rounded transition-colors ${canManage ? 'hover:bg-red-100 text-slate-500 hover:text-red-600' : 'text-slate-300 cursor-not-allowed'}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-slate-400">
          Funções exercidas pelo membro. Também aparecem na aba Funções da igreja.
        </p>
        <Permissao chave="members.member_profile.nova_funcao" rotulo="Nova função — Member Profile" herda="members.view">
          <button
            onClick={openCreate}
            disabled={!canManage}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" /> Nova função
          </button>
        </Permissao>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
          Nenhuma função registrada para este membro.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
                <th className="text-left pb-3 pr-4">Função</th>
                <th className="text-left pb-3 pr-4">Departamento</th>
                <th className="text-left pb-3 pr-4">Igreja</th>
                <th className="text-left pb-3 pr-4">Início</th>
                <th className="text-left pb-3 pr-4">Término</th>
                <th className="text-right pb-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {active.map(renderRow)}
              {history.length > 0 && (
                <tr>
                  <td colSpan={6} className="pt-5 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Histórico
                  </td>
                </tr>
              )}
              {history.map(renderRow)}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal nova/editar função */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {form.id ? 'Editar função' : 'Nova função'}
                </h3>
                <p className="text-xs text-slate-500">
                  Igreja: {churchName || 'igreja do membro'}
                </p>
              </div>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1 hover:bg-slate-100">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {formError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Função *</label>
                <select
                  value={form.functionId}
                  onChange={(e) => setForm((p) => ({ ...p, functionId: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Selecione a função...</option>
                  {catalog.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Departamento</label>
                <input
                  value={form.department}
                  onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))}
                  placeholder="Opcional"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Início *</label>
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Término</label>
                  <input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="h-4 w-4 accent-green-600"
                />
                <span className="text-sm text-slate-700">
                  Função ativa
                  <span className="block text-xs text-slate-400">Só as ativas aparecem no perfil e na listagem.</span>
                </span>
              </label>

              <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={form.isCampoWide}
                  onChange={(e) => setForm((p) => ({ ...p, isCampoWide: e.target.checked }))}
                  className="h-4 w-4 accent-indigo-600"
                />
                <span className="text-sm text-slate-700">
                  Abrange todo o campo
                  <span className="block text-xs text-slate-400">
                    Por padrão a função vale só para a igreja do membro.
                  </span>
                </span>
              </label>

              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Observações</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <Permissao chave="members.member_profile.salvar" rotulo="Salvar — Member Profile" herda="members.view">
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                  >
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                </Permissao>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Excluir função?"
        message={`A função "${deleteTarget?.function?.name ?? ''}" será removida do histórico do membro. Não é possível desfazer.`}
        confirmLabel="Excluir"
        variant="danger"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

/**
 * O que a matriz vai executar nesta posição.
 *
 * Numa readmissão, `rule.newTitle` é só o valor de reserva da regra
 * (em geral CONGREGADO) — mostrá-lo dava a entender que era ele que seria
 * aplicado. Quando a secretaria já confirmou o título de retorno, é esse que
 * aparece; enquanto não confirmou, o rótulo diz que o título sai do histórico,
 * não do valor fixo. Ver src/lib/readmissaoTitulo.ts.
 */
function ruleActionBadges(rule: MatrixRule, tituloConfirmado?: string) {
  const badges: { label: string; color: string }[] = [];
  if (rule.changeStatus && rule.newStatus) badges.push({ label: `Status → ${rule.newStatus}`, color: "bg-blue-100 text-blue-700" });
  if (rule.changeTitle) {
    if (tituloConfirmado) {
      badges.push({ label: `Título → ${tituloConfirmado} (escolhido agora)`, color: "bg-violet-100 text-violet-700 ring-1 ring-violet-300" });
    } else if (rule.restorePreviousTitle) {
      badges.push({ label: "Título → a confirmar no histórico", color: "bg-amber-100 text-amber-700" });
    } else if (rule.newTitle) {
      badges.push({ label: `Título → ${rule.newTitle}`, color: "bg-purple-100 text-purple-700" });
    }
  }
  if (rule.doesTransfer) badges.push({ label: "Transferência", color: "bg-orange-100 text-orange-700" });
  if (rule.insertOccurrence) badges.push({ label: "Gera Ocorrência", color: "bg-emerald-100 text-emerald-700" });
  return badges;
}

function OccurrenceModal({
  memberId,
  onClose,
  onSaved,
}: {
  memberId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [services, setServices] = useState<{ id: number; sigla: string; description: string; usesMatrix: boolean }[]>([]);
  const [serviceId, setServiceId] = useState("");
  const [loadingRules, setLoadingRules] = useState(false);
  const [matrixRules, setMatrixRules] = useState<MatrixRule[]>([]);
  const [pipelineName, setPipelineName] = useState<string | null>(null);
  const [stageName, setStageName] = useState<string | null>(null);
  const [selectedColIdx, setSelectedColIdx] = useState<number | null>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [savedActions, setSavedActions] = useState<string[] | null>(null);
  const [targetChurchId, setTargetChurchId] = useState("");
  const [churchSearch, setChurchSearch] = useState("");
  const [churches, setChurches] = useState<ChurchOption[]>([]);
  const [churchDropOpen, setChurchDropOpen] = useState(false);
  // Readmissão: o título de retorno é confirmado pela secretaria, olhando o
  // histórico do membro, antes de a ocorrência ser aplicada.
  // Ver src/lib/readmissaoTitulo.ts.
  const [confirmedTitle, setConfirmedTitle] = useState<string>("");
  const [titlePickerOpen, setTitlePickerOpen] = useState(false);

  useEffect(() => {
    authFetch(`${apiBase}/kan/services`)
      .then((r) => r.json())
      .then((data) => setServices(Array.isArray(data) ? data : []))
      .catch(() => {});
    authFetch(`${apiBase}/churches`)
      .then((r) => r.json())
      .then((data) => setChurches(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!serviceId) { setMatrixRules([]); setPipelineName(null); setStageName(null); setSelectedColIdx(null); setTargetChurchId(""); setChurchSearch(""); return; }
    setLoadingRules(true);
    authFetch(`${apiBase}/kan/services/${serviceId}/rules`)
      .then((r) => r.json())
      .then((data) => {
        // API returns array directly (not {rules:[...]})
        const rules: MatrixRule[] = Array.isArray(data) ? data : [];
        setMatrixRules(rules);
        if (rules.length > 0) {
          // stage.pipeline.name and stage.name come from the rules endpoint include
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const first = rules[0] as any;
          setPipelineName(first?.stage?.pipeline?.name || first?.pipelineName || null);
          setStageName(first?.stage?.name || first?.stageName || null);
        } else {
          setPipelineName(null);
          setStageName(null);
        }
        setSelectedColIdx(null);
      })
      .catch(() => { setMatrixRules([]); })
      .finally(() => setLoadingRules(false));
  }, [serviceId]);


  const selectedRule = matrixRules.find((r) => r.columnIndex === selectedColIdx) || null;
  const selectedService = services.find((s) => String(s.id) === String(serviceId)) || null;
  const ehReadmissao = ehServicoDeReadmissao(selectedService);
  // A confirmação só é exigida quando o serviço realmente troca o título.
  const exigeTitulo = ehReadmissao && matrixRules.some((r) => r.changeTitle && r.restorePreviousTitle);
  // Readmissão cuja matriz não troca título: o que a secretaria confirmar não
  // tem onde ser aplicado. Em vez de engolir a escolha em silêncio, a tela diz
  // que falta configurar a regra.
  const readmissaoSemRegraDeTitulo =
    ehReadmissao && !loadingRules && !matrixRules.some((r) => r.changeTitle && r.restorePreviousTitle);

  async function handleSave() {
    if (!serviceId) { setErr("Selecione um serviço."); return; }
    if (matrixRules.length > 0 && selectedColIdx === null) { setErr("Selecione uma posição da matriz."); return; }
    if (exigeTitulo && !confirmedTitle) {
      setErr("Confirme o título de retorno da readmissão.");
      setTitlePickerOpen(true);
      return;
    }
    if (selectedRule?.doesTransfer && !targetChurchId) { setErr("Selecione a igreja de destino para realizar a transferência."); return; }
    setSaving(true); setErr("");
    try {
      const body: Record<string, unknown> = { serviceId: Number(serviceId), date, notes };
      if (selectedColIdx !== null) body.columnIndex = selectedColIdx;
      if (targetChurchId) body.targetChurchId = targetChurchId;
      if (confirmedTitle) body.confirmedTitle = confirmedTitle;
      const res = await authFetch(`${apiBase}/members/${memberId}/occurrences`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error((b as { error?: string }).error || "Erro ao salvar.");
      }
      const result = await res.json();
      setSavedActions(result.appliedActions || []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao salvar.");
      setSaving(false);
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (savedActions !== null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
          <div className="flex flex-col items-center gap-3 py-2">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            <h2 className="text-base font-semibold text-slate-800">Ocorrência Rápida Registrada</h2>
            {savedActions.length > 0 && (
              <div className="w-full mt-2 space-y-1">
                <p className="text-xs text-slate-500 text-center mb-2">Ações executadas:</p>
                {savedActions.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm bg-slate-50 rounded-lg px-3 py-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                    <span className="text-slate-700">{a}</span>
                  </div>
                ))}
              </div>
            )}
            {savedActions.length === 0 && (
              <p className="text-sm text-slate-500">Ocorrência registrada sem ações adicionais.</p>
            )}
          </div>
          <button
            onClick={() => { onSaved(); }}
            className="mt-5 w-full px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
          >
            Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Nova Ocorrência Rápida</h2>
            <p className="text-xs text-slate-400 mt-0.5">Aplica ações da matriz sem criar card no kanban</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100"><X className="w-4 h-4 text-slate-500" /></button>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-4 text-xs text-blue-700">
          <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>Nenhum card será criado. Esta ação registra uma ocorrência direta e executa as configurações da matriz para a posição escolhida.</span>
        </div>

        {err && <div className="mb-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{err}</div>}

        <div className="space-y-4">
          {/* Service select */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Serviço *</label>
            <select
              value={serviceId}
              onChange={(e) => {
                const novoId = e.target.value;
                setServiceId(novoId);
                setErr("");
                setConfirmedTitle("");
                // Escolheu uma readmissão: o histórico de títulos abre na hora,
                // que é onde a secretaria decide para qual título a pessoa volta.
                const svc = services.find((s) => String(s.id) === novoId) || null;
                setTitlePickerOpen(ehServicoDeReadmissao(svc));
              }}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecione...</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>{s.sigla} — {s.description}</option>
              ))}
            </select>
          </div>

          {/* Matrix columns */}
          {serviceId && (
            <div>
              {loadingRules ? (
                <div className="text-xs text-slate-400 py-2">Carregando matriz...</div>
              ) : matrixRules.length === 0 ? (
                <div className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
                  Este serviço não possui regras de matriz configuradas. A ocorrência será registrada sem ações automáticas.
                </div>
              ) : (
                <div>
                  {/* Pipeline + stage info */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-slate-500">Posição da Matriz</span>
                    {pipelineName && (
                      <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                        Pipeline: {pipelineName}
                      </span>
                    )}
                    {stageName && (
                      <span className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                        Etapa: {stageName}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {matrixRules.map((rule) => {
                      const badges = ruleActionBadges(rule, confirmedTitle || undefined);
                      const isSelected = selectedColIdx === rule.columnIndex;
                      return (
                        <button
                          key={rule.id}
                          type="button"
                          onClick={() => { setSelectedColIdx(isSelected ? null : rule.columnIndex); setErr(""); setTargetChurchId(""); setChurchSearch(""); setChurchDropOpen(false); }}
                          className={`text-left w-full rounded-xl border-2 px-4 py-3 transition-all ${
                            isSelected
                              ? "border-blue-500 bg-blue-50"
                              : "border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center ${isSelected ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-600"}`}>
                                {rule.columnIndex}
                              </span>
                              <span className="text-sm font-semibold text-slate-800">
                                {rule.columnName || `Posição ${rule.columnIndex}`}
                              </span>
                            </div>
                            {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                          </div>
                          {rule.description && (
                            <p className="text-xs text-slate-500 mb-2 ml-8">{rule.description}</p>
                          )}
                          {badges.length > 0 ? (
                            <div className="flex flex-wrap gap-1 ml-8">
                              {badges.map((b, i) => (
                                <span key={i} className={`text-xs rounded-full px-2 py-0.5 font-medium ${b.color}`}>{b.label}</span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 ml-8">Sem ações automáticas configuradas</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected summary */}
                  {selectedRule && ruleActionBadges(selectedRule, confirmedTitle || undefined).length > 0 && (
                    <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      <p className="text-xs font-semibold text-emerald-700 mb-1">Ações que serão executadas:</p>
                      <ul className="space-y-0.5">
                        {ruleActionBadges(selectedRule, confirmedTitle || undefined).map((b, i) => (
                          <li key={i} className="text-xs text-emerald-700 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3" /> {b.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {readmissaoSemRegraDeTitulo && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>
                {matrixRules.length === 0
                  ? "Este serviço de readmissão não tem nenhuma regra na matriz. Nada será aplicado ao membro — nem título, nem situação, nem transferência; só fica o registro da ocorrência."
                  : "Nenhuma posição da matriz deste serviço restaura o título anterior do membro."}{" "}
                {confirmedTitle
                  ? `O título confirmado (${confirmedTitle}) NÃO será aplicado.`
                  : "O título confirmado não seria aplicado."}{" "}
                Configure em Secretaria › Serviços e Ocorrências › Matriz de Decisão: na coluna de aprovação, ligue &quot;Troca Título&quot; e &quot;Restaurar último título do membro&quot;.
              </span>
            </div>
          )}

          {/* Readmissão: título de retorno confirmado pela secretaria */}
          {exigeTitulo && (
            <div className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5">
              <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-1">
                Título de retorno
              </p>
              {confirmedTitle ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-violet-900">{confirmedTitle}</span>
                  <button
                    type="button"
                    onClick={() => setTitlePickerOpen(true)}
                    className="text-xs font-medium text-violet-700 underline hover:text-violet-900"
                  >
                    Trocar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setTitlePickerOpen(true)}
                  className="text-sm font-medium text-violet-700 underline hover:text-violet-900"
                >
                  Escolher no histórico do membro
                </button>
              )}
              <p className="text-[11px] text-violet-600 mt-1">
                O título aplicado na readmissão é este — escolhido no histórico da pessoa, não deduzido pelo sistema.
              </p>
            </div>
          )}

          {/* Destination church — only when selected rule requires transfer */}
          {selectedRule?.doesTransfer && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Igreja de Destino <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar pelo nome da igreja..."
                  value={churchSearch}
                  onChange={(e) => {
                    setChurchSearch(e.target.value);
                    setTargetChurchId("");
                    setChurchDropOpen(true);
                  }}
                  onFocus={() => setChurchDropOpen(true)}
                  className="w-full border border-orange-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                {targetChurchId && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-500 text-xs font-semibold">✓</span>
                )}
                {churchDropOpen && churchSearch.length >= 2 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {churches
                      .filter((c) =>
                        c.name.toLowerCase().includes(churchSearch.toLowerCase()) ||
                        (c.code || "").toLowerCase().includes(churchSearch.toLowerCase())
                      )
                      .slice(0, 20)
                      .map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50 border-b border-slate-100 last:border-0"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setTargetChurchId(c.id);
                            setChurchSearch(c.code ? `${c.code} — ${c.name}` : c.name);
                            setChurchDropOpen(false);
                          }}
                        >
                          {c.code ? <span className="font-medium text-slate-700">{c.code} — </span> : null}
                          {c.name}
                        </button>
                      ))}
                    {churches.filter((c) =>
                      c.name.toLowerCase().includes(churchSearch.toLowerCase()) ||
                      (c.code || "").toLowerCase().includes(churchSearch.toLowerCase())
                    ).length === 0 && (
                      <div className="px-3 py-2 text-xs text-slate-400">Nenhuma igreja encontrada.</div>
                    )}
                  </div>
                )}
              </div>
              {targetChurchId && (
                <p className="text-xs text-orange-600 mt-1">✓ Igreja de destino selecionada. O membro será transferido ao executar.</p>
              )}
            </div>
          )}

          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Data</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Observações</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
          <Permissao chave="members.member_profile.executar_ocorrencia_rapida" rotulo="Executar Ocorrência Rápida — Member Profile" herda="members.view">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? "Executando..." : "Executar Ocorrência Rápida"}
            </button>
          </Permissao>
        </div>
      </div>

      {titlePickerOpen && serviceId && (
        <ConfirmarTituloReadmissao
          memberId={memberId}
          serviceId={serviceId}
          onCancel={() => setTitlePickerOpen(false)}
          onConfirm={(titulo) => {
            setConfirmedTitle(titulo);
            setTitlePickerOpen(false);
            setErr("");
          }}
        />
      )}
    </div>
  );
}

/**
 * Ícone do processo na lista de histórico. Só apresentação: escolhe pelo texto
 * que já vem do registro; não muda nada no dado.
 */
function iconeDoProcesso(texto: string | null | undefined): { Icone: typeof FileText } {
  const t = (texto || "").toLowerCase();
  if (t.includes("conclu")) return { Icone: Check };
  if (t.includes("ativad")) return { Icone: Zap };
  if (t.includes("cadastr")) return { Icone: UserPlus };
  return { Icone: FileText };
}

function HistoricoTab({
  history,
  total,
  loading,
  canManage,
  onDelete,
  onEdit,
}: {
  history: HistoryRow[];
  total: number;
  loading: boolean;
  canManage?: boolean;
  onDelete?: (id: string) => void;
  onEdit?: (h: HistoryRow) => void;
}) {
  // A busca fica na faixa das abas (MemberProfile); aqui chega a lista já filtrada.
  return (
    <div>
      {loading ? (
        <div className="py-8 text-center text-sm text-slate-400">Carregando histórico...</div>
      ) : history.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">Nenhum registro encontrado.</div>
      ) : (
        <div className="overflow-x-auto rounded-[18px] border border-[#e8ecf1] dark:border-slate-700">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-[11px] uppercase tracking-[0.08em] text-slate-500 dark:bg-slate-900/40 dark:text-slate-400">
                <th className="px-5 py-3.5 text-left font-semibold">Ref.</th>
                <th className="px-5 py-3.5 text-left font-semibold">Processo</th>
                <th className="px-5 py-3.5 text-left font-semibold">Data</th>
                <th className="px-5 py-3.5 text-left font-semibold">Origem</th>
                <th className="px-5 py-3.5 text-left font-semibold">Cidade / País</th>
                <th className="px-5 py-3.5 text-left font-semibold">Situação Gerada</th>
                <th className="px-5 py-3.5 text-right font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => {
                const { Icone } = iconeDoProcesso(h.action || h.serviceName);
                return (
                <tr
                  key={h.id}
                  className="border-t border-[#eef2f6] transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/40"
                >
                  <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {h.card?.protocol || h.id.slice(-6).toUpperCase()}
                  </td>
                  <td className="px-5 py-4">
                    <span className="flex items-center gap-3">
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${i === 0 ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200"}`}>
                        <Icone className="h-4 w-4" />
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{h.action || h.serviceName || "—"}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600 dark:text-slate-300">
                    {h.createdAt ? new Date(h.createdAt).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{h.card?.church?.name || h.church?.name || "—"}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-600 dark:text-slate-300">
                    {[h.memberCity, h.memberCountry].filter(Boolean).join(" / ") || "—"}
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex flex-wrap items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                      {h.serviceName || h.notes || h.action || "—"}
                      {h.destinationChurch?.name && (
                        <span className="font-normal text-slate-500 dark:text-slate-400"> → {h.destinationChurch.name}</span>
                      )}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => canManage && onEdit?.(h)}
                        disabled={!canManage}
                        className={`grid h-9 w-9 place-items-center rounded-full border transition-colors ${canManage ? "cursor-pointer border-[#e8ecf1] text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700" : "cursor-not-allowed border-slate-100 text-slate-300 dark:border-slate-700 dark:text-slate-600"}`}
                        title={canManage ? "Editar" : "Sem permissão"}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => canManage && onDelete?.(h.id)}
                        disabled={!canManage}
                        className={`grid h-9 w-9 place-items-center rounded-full border transition-colors ${canManage ? "cursor-pointer border-[#e8ecf1] text-slate-600 hover:bg-red-50 hover:text-red-600 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-red-900/30" : "cursor-not-allowed border-slate-100 text-slate-300 dark:border-slate-700 dark:text-slate-600"}`}
                        title={canManage ? "Excluir" : "Sem permissão"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
      {!loading && history.length > 0 && (
        <p className="mt-3 text-[13px] text-slate-500 dark:text-slate-400">Mostrando {history.length} de {total} registros</p>
      )}
    </div>
  );
}
