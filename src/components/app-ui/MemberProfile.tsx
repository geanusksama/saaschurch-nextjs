import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Camera, CheckCircle2, Edit, Info, Pencil, Plus, Search, Star, Trash2, X, ZoomIn, ZoomOut } from "lucide-react";
import { Link, useParams } from "react-router";
import { MemberEditDrawer } from "./MemberEdit";

import { apiBase } from '../../lib/apiBase';

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
  const s = status.toUpperCase();
  if (s.includes("ATIVO") || s === "ACTIVE") return { label: "Ativo", cls: "bg-green-100 text-green-700" };
  if (s.includes("INATIVO") || s === "INACTIVE") return { label: "Inativo", cls: "bg-red-100 text-red-700" };
  if (s.includes("TRANSFER")) return { label: "Transferido", cls: "bg-blue-100 text-blue-700" };
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
};

type Tab = "historico" | "titulos" | "funcoes" | "familia";

type KanService = { id: number; sigla: string; description: string; serviceGroup?: string | null };

type MatrixRule = {
  id: number;
  serviceId: number;
  columnIndex: number;
  description?: string | null;
  columnName?: string | null;
  changeStatus: boolean; newStatus?: string | null;
  changeTitle: boolean; newTitle?: string | null;
};

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
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
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

  // ── Attendance analytics (hooks must be before any early return) ─────────
  const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const attendanceByDay = useMemo(() => {
    const counts = Array(7).fill(0);
    history.forEach((h) => { if (h.createdAt) counts[new Date(h.createdAt).getDay()]++; });
    return counts;
  }, [history]);

  const attendanceByPeriod = useMemo(() => {
    const periods = { manhã: 0, tarde: 0, noite: 0 };
    history.forEach((h) => {
      if (!h.createdAt) return;
      const hour = new Date(h.createdAt).getHours();
      if (hour < 12) periods.manhã++;
      else if (hour < 18) periods.tarde++;
      else periods.noite++;
    });
    return periods;
  }, [history]);

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
      const token = localStorage.getItem("mrm_token");
      const form = new FormData();
      form.append("file", croppedFile);
      const res = await fetch(`${apiBase}/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) throw new Error("Falha no upload");
      const data = await res.json();
      const uploaded = data.url as string;
      await authFetch(`${apiBase}/members/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify({ photoUrl: uploaded }),
      });
      setMember((prev) => prev ? { ...prev, photoUrl: uploaded } : prev);
    } catch {
      // silently ignore
    } finally {
      setUploadingPhoto(false);
      URL.revokeObjectURL(photoPreview.url);
      setPhotoPreview(null);
    }
  }

  const storedUser = (() => { try { return JSON.parse(localStorage.getItem("mrm_user") || "{}"); } catch { return {}; } })();
  const canManageHistory = storedUser.profileType === "master" || storedUser.profileType === "admin";

  const maxDay = Math.max(...attendanceByDay, 1);
  const maxPeriod = Math.max(...Object.values(attendanceByPeriod), 1);
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
  ];

  return (
    <div className="p-6 w-full space-y-4">
      {/* Back */}
      <div>
        <Link
          to="/app-ui/members"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para membros
        </Link>
      </div>

      {/* ── Hero card ──────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm">
        {/* decorative blob */}
        <div className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full bg-slate-100/60 blur-3xl" />

        <div className="flex flex-col lg:flex-row">
          {/* Photo column */}
          <div className="relative flex-shrink-0 flex items-end justify-center lg:justify-start lg:items-stretch px-6 pt-6 pb-4 lg:pb-6 lg:w-56">
            <div className="relative group">
              <div className="h-36 w-36 lg:h-44 lg:w-44 rounded-2xl border-4 border-slate-200 shadow-lg overflow-hidden bg-slate-100 flex items-center justify-center text-slate-400 text-4xl font-bold">
                {member?.photoUrl ? (
                  <img src={member.photoUrl} alt={member?.fullName ?? ""} className="h-full w-full object-cover" />
                ) : (
                  <span>{ini}</span>
                )}
              </div>
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute inset-0 rounded-2xl flex items-center justify-center bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                title="Alterar foto"
              >
                <Camera className="w-6 h-6" />
              </button>
              {/* status dot */}
              <span className={`absolute bottom-2 right-2 h-4 w-4 rounded-full border-2 border-white ${
                (member?.membershipStatus || "").toUpperCase().includes("ATIVO") || (member?.membershipStatus || "").toUpperCase() === "ACTIVE"
                  ? "bg-emerald-400" : "bg-slate-400"
              }`} />
            </div>
          </div>

          {/* Info column */}
          <div className="flex-1 px-6 pb-6 pt-2 lg:pt-6 flex flex-col justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 leading-tight">{member?.fullName || "—"}</h1>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {member?.ecclesiasticalTitleRef?.name || member?.ecclesiasticalTitle ? (
                      <span className="text-sm text-indigo-600 font-medium">
                        {member.ecclesiasticalTitleRef?.name || member.ecclesiasticalTitle}
                      </span>
                    ) : null}
                    {member?.rol != null && (
                      <span className="text-xs text-slate-400 font-mono">ROL {member.rol}</span>
                    )}
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${sCls}`}>{sLabel}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm transition-colors">
                    <Star className="w-4 h-4" />
                    Favoritar
                  </button>
                  <button
                    onClick={() => setShowEditDrawer(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    Editar
                  </button>
                  {canManageHistory && (
                    <button
                      onClick={() => setShowOccModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-medium transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Nova Ocorrência
                    </button>
                  )}
                </div>
              </div>

              {/* Quick info chips */}
              <div className="mt-3 flex flex-wrap gap-2">
                {member?.church?.name && (
                  <span className="inline-flex items-center gap-1.5 text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                    <Info className="w-3 h-3 flex-shrink-0" />
                    {member.church.name}
                  </span>
                )}
                {member?.church?.regional?.campo?.name && (
                  <span className="inline-flex items-center gap-1.5 text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                    Campo: {member.church.regional.campo.name}
                  </span>
                )}
                {member?.addressCity && (
                  <span className="inline-flex items-center gap-1.5 text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                    {member.addressCity}{member.addressState ? `, ${member.addressState}` : ""}
                  </span>
                )}
                {memberSince && (
                  <span className="inline-flex items-center gap-1.5 text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
                    Desde {fmtDate(memberSince)}
                  </span>
                )}
              </div>
            </div>

            {/* Bottom stats row inside hero */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-200">
              <HeroStat label="Ocorrências" value={String(history.length)} />
              <HeroStat label="Último serviço" value={lastService?.serviceName || lastService?.serviceGroup || lastService?.action || "—"} />
              <HeroStat label="Última atividade" value={lastService?.createdAt ? fmtDate(lastService.createdAt) : "—"} />
              <HeroStat label="Ministérios" value={String(member?.ministryMemberships?.length ?? 0)} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Two-column: details + attendance ───────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Details card */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">Informações</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
            <InfoCell label="Regional" value={regionalCode} />
            <InfoCell label="Campo" value={campoName} />
            <InfoCell label="Igreja" value={churchName} />
            <InfoCell label="Sexo" value={genderLabel} />
            <InfoCell label="Estado Civil" value={maritalLabel} />
            <InfoCell label="Cônjuge" value={member?.spouseName || "—"} />
            <InfoCell label="CPF" value={member?.cpf || "—"} />
            <InfoCell label="E-mail" value={member?.email || "—"} />
            <InfoCell label="Contato" value={member?.mobile || member?.phone || "—"} />
            <InfoCell label="Ministérios" value={
              member?.ministryMemberships?.length
                ? member.ministryMemberships.map((m) => m.ministry.name).join(", ")
                : "—"
            } />
            <InfoCell label="Batismo" value={fmtDate(member?.baptismDate)} />
            <InfoCell label="Membro desde" value={fmtDate(member?.membershipDate)} />
          </div>
        </div>

        {/* Attendance card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-5">
          <div>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Presença por dia</h2>
            <div className="flex items-end gap-1.5 h-16">
              {DAY_NAMES.map((d, i) => (
                <div key={d} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-sm transition-all"
                    style={{
                      height: `${Math.round((attendanceByDay[i] / maxDay) * 52) + 4}px`,
                      background: attendanceByDay[i] > 0
                        ? `hsl(${220 + i * 10}, 80%, ${55 - Math.round((attendanceByDay[i] / maxDay) * 20)}%)`
                        : "#e2e8f0",
                    }}
                  />
                  <span className="text-[10px] text-slate-400 font-medium">{d}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Período de maior presença</h2>
            <div className="space-y-2">
              {(["manhã", "tarde", "noite"] as const).map((p) => (
                <div key={p} className="flex items-center gap-2">
                  <span className="w-10 text-xs text-slate-500 capitalize">{p}</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.round((attendanceByPeriod[p] / maxPeriod) * 100)}%`,
                        background: p === "manhã" ? "#f59e0b" : p === "tarde" ? "#3b82f6" : "#6366f1",
                      }}
                    />
                  </div>
                  <span className="w-5 text-right text-xs font-medium text-slate-600">{attendanceByPeriod[p]}</span>
                </div>
              ))}
            </div>
          </div>

          {lastService && (
            <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Último ciclo</p>
              <p className="text-sm font-semibold text-slate-800 leading-tight">
                {lastService.serviceName || lastService.serviceGroup || lastService.action || "—"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{lastService.createdAt ? fmtDate(lastService.createdAt) : ""}</p>
              {lastService.card?.church?.name && (
                <p className="text-xs text-indigo-600 mt-0.5">{lastService.card.church.name}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {showEditDrawer && member && (
        <MemberEditDrawer
          memberId={member.id}
          onClose={() => setShowEditDrawer(false)}
          onSaved={() => {
            setShowEditDrawer(false);
            // Reload member data
            authFetch(`${apiBase}/members/${member.id}`)
              .then((r) => r.json())
              .then((data) => setMember(data))
              .catch(() => {});
          }}
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

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.key
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === "historico" && (
            <HistoricoTab
              history={filteredHistory}
              loading={historyLoading}
              search={histSearch}
              onSearch={setHistSearch}
              canManage={canManageHistory}
              onDelete={(hid) => setDeleteHistId(hid)}
              onEdit={(h) => { setEditHistRow(h); setEditHistNotes(h.notes || ""); }}
            />
          )}
          {activeTab === "titulos" && member && (
            <TitulosTab memberId={member.id} refreshKey={titleRefreshKey} />
          )}
          {activeTab === "funcoes" && <PlaceholderTab label="Funções e ministérios" />}
          {activeTab === "familia" && <PlaceholderTab label="Núcleo familiar" />}
        </div>
      </div>

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
              <button onClick={() => {
                authFetch(`${apiBase}/members/${id}/event-history/${deleteHistId}`, { method: "DELETE" })
                  .then(() => { reloadHistory(); setDeleteHistId(null); })
                  .catch(() => setDeleteHistId(null));
              }} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors">Excluir</button>
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
              <button disabled={savingHist} onClick={() => {
                setSavingHist(true);
                authFetch(`${apiBase}/members/${id}/event-history/${editHistRow.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ notes: editHistNotes }),
                }).then(() => { reloadHistory(); setEditHistRow(null); setEditHistNotes(""); })
                  .catch(() => {})
                  .finally(() => setSavingHist(false));
              }} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-700 transition-colors disabled:opacity-60">{savingHist ? "Salvando..." : "Salvar"}</button>
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

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-slate-900 truncate" title={value}>{value}</p>
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

function ruleActionBadges(rule: MatrixRule) {
  const badges: { label: string; color: string }[] = [];
  if (rule.changeStatus && rule.newStatus) badges.push({ label: `Status → ${rule.newStatus}`, color: "bg-blue-100 text-blue-700" });
  if (rule.changeTitle && rule.newTitle) badges.push({ label: `Título → ${rule.newTitle}`, color: "bg-purple-100 text-purple-700" });
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

  useEffect(() => {
    authFetch(`${apiBase}/kan/services`)
      .then((r) => r.json())
      .then((data) => setServices(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!serviceId) { setMatrixRules([]); setPipelineName(null); setStageName(null); setSelectedColIdx(null); return; }
    setLoadingRules(true);
    authFetch(`${apiBase}/kan/services/${serviceId}/rules`)
      .then((r) => r.json())
      .then((data) => {
        const rules: MatrixRule[] = Array.isArray(data.rules) ? data.rules : [];
        setMatrixRules(rules);
        if (rules.length > 0) {
          setPipelineName(rules[0].pipelineName || null);
          setStageName(rules[0].stageName || null);
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

  async function handleSave() {
    if (!serviceId) { setErr("Selecione um serviço."); return; }
    if (matrixRules.length > 0 && selectedColIdx === null) { setErr("Selecione uma posição da matriz."); return; }
    setSaving(true); setErr("");
    try {
      const body: Record<string, unknown> = { serviceId: Number(serviceId), date, notes };
      if (selectedColIdx !== null) body.columnIndex = selectedColIdx;
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
              onChange={(e) => { setServiceId(e.target.value); setErr(""); }}
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
                      const badges = ruleActionBadges(rule);
                      const isSelected = selectedColIdx === rule.columnIndex;
                      return (
                        <button
                          key={rule.id}
                          type="button"
                          onClick={() => { setSelectedColIdx(isSelected ? null : rule.columnIndex); setErr(""); }}
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
                  {selectedRule && ruleActionBadges(selectedRule).length > 0 && (
                    <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      <p className="text-xs font-semibold text-emerald-700 mb-1">Ações que serão executadas:</p>
                      <ul className="space-y-0.5">
                        {ruleActionBadges(selectedRule).map((b, i) => (
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
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
          >
            {saving ? "Executando..." : "Executar Ocorrência Rápida"}
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoricoTab({
  history,
  loading,
  search,
  onSearch,
  canManage,
  onDelete,
  onEdit,
}: {
  history: HistoryRow[];
  loading: boolean;
  search: string;
  onSearch: (v: string) => void;
  canManage?: boolean;
  onDelete?: (id: string) => void;
  onEdit?: (h: HistoryRow) => void;
}) {
  return (
    <div>
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por processo, origem..."
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <div className="text-sm text-slate-400 py-8 text-center">Carregando histórico...</div>
      ) : history.length === 0 ? (
        <div className="text-sm text-slate-400 py-8 text-center">Nenhum registro encontrado.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 text-left font-medium">Ref.</th>
                <th className="px-4 py-3 text-left font-medium">Processo</th>
                <th className="px-4 py-3 text-left font-medium">Data</th>
                <th className="px-4 py-3 text-left font-medium">Origem</th>
                <th className="px-4 py-3 text-left font-medium">Cidade</th>
                <th className="px-4 py-3 text-left font-medium">País</th>
                <th className="px-4 py-3 text-left font-medium">Situação Gerada</th>
                <th className="px-4 py-3 text-left font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr
                  key={h.id}
                  className={`border-t border-slate-100 hover:bg-slate-50 transition-colors ${
                    i % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-slate-500 text-xs">
                    {h.card?.protocol || h.id.slice(-6).toUpperCase()}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{h.action || h.serviceName || "—"}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                    {h.createdAt ? new Date(h.createdAt).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{h.card?.church?.name || "—"}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{h.memberCity || "—"}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{h.memberCountry || "—"}</td>
                  <td className="px-4 py-3 text-slate-700">{h.serviceName || h.notes || h.action || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => canManage && onEdit?.(h)}
                        disabled={!canManage}
                        className={`p-1 rounded transition-colors ${canManage ? "hover:bg-slate-200 text-slate-500 hover:text-slate-700 cursor-pointer" : "text-slate-300 cursor-not-allowed"}`}
                        title={canManage ? "Editar" : "Sem permissão"}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => canManage && onDelete?.(h.id)}
                        disabled={!canManage}
                        className={`p-1 rounded transition-colors ${canManage ? "hover:bg-red-100 text-slate-500 hover:text-red-600 cursor-pointer" : "text-slate-300 cursor-not-allowed"}`}
                        title={canManage ? "Excluir" : "Sem permissão"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
