"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Flame, Calendar, MapPin, Clock, Plus, Search, Pencil, Trash2,
  Settings, Users, CheckCircle2, X, Download, User, FileText, Smartphone,
  Sparkles, Save, Loader2, AlertTriangle, AlertCircle, Phone, Heart, Upload, QrCode, Eye, EyeOff, Paperclip
} from "lucide-react";

function Dove(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      style={props.style}
      width={props.width || "24"}
      height={props.height || "24"}
      {...props}
    >
      <path d="M22 3s-3 1-5.5 3c-3 2.5-5.5 6-6.5 8.5-.75.25-1.5.25-2.25 0-.5-.5-1-1.5-1.25-2.75C5.75 9 4.25 8.75 3 9c1.5 1.5 3 2.5 3.5 4.5.5 2 2 3.5 3.5 4.5.5.25.75.75.5 1.25-.25.75-1 1.75-2.5 2.25 1.25-.25 2.25-.75 2.5-1.5.25-.75.75-.75 1.25-.5 1 1 2.5 2.5 4.5 3.5-.25-1.25-.5-2.75-1.25-3.75C16 18.5 19.5 16 22 13.5c2-2 1.5-5.5 0-7.5-1-1-2-1-2.5-1.5.5-1 1-1.5.5-1.5z" />
    </svg>
  );
}
import { authFetch } from "../../lib/secretariaHooks";
import { apiBase } from "../../lib/apiBase";

// Formatting function for currency
function fmt(v: number) {
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function useCampoId() {
  try {
    return JSON.parse(localStorage.getItem("mrm_user") || "{}").campoId as string;
  } catch {
    return "";
  }
}

// Styling Constants
const inputCls = "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder-slate-400 dark:bg-slate-800 dark:border-slate-700 dark:text-white";
const selectCls = inputCls;
const labelCls = "block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1";

interface PenielEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  value: number;
  limit: number;
  status: string;
  isFeatured?: boolean;
  paymentLink?: string | null;
  description: string;
  totalInscritos: number;
  vagasDisponiveis: number;
  filaEspera: number;
  valorArrecadado: number;
  dateLabel?: string | null;
  departureLocation?: string | null;
  eventLocation?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  extraFieldsConfig?: any | null;
}

interface PenielConfig {
  campoId: string;
  title: string;
  subtitle: string;
  description: string;
  heroBgImage: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  buttonsConfig: {
    primaryLabel: string;
    primaryLink: string;
    secondaryLabel: string;
    secondaryLink: string;
  };
  heroCards: Array<{
    title: string;
    subtitle?: string;
    description?: string;
    image?: string;
    videoUrl?: string;
    buttonText?: string;
    buttonLink?: string;
    active?: boolean;
  }>;
  testimonyVideos: Array<{
    name: string;
    quote: string;
    videoUrl?: string;
    imageUrl?: string;
    active?: boolean;
  }>;
  whatsappInstanceId: string | null;
}

interface ImportantContact {
  nome: string;
  parentesco: string;
  whatsapp: string;
  relacao: string;
}

interface PenielRegistration {
  id: string;
  eventId: string;
  tipoParticipante: string;
  nome: string;
  endereco: string;
  dataNascimento: string;
  estadoCivil: string;
  idade: number;
  celular: string;
  igrejaBase: string;
  batizadoAguas: boolean;
  participaGrupoFamiliar: boolean;
  grupoFamiliarQual?: string | null;
  nomeLider?: string | null;
  quemMotivou: string;
  porqueDecidiu: string;
  expectativas: string;
  peso: number;
  altura: number;
  medicamentos?: string | null;
  alergiasRestricoes?: string | null;
  importantContacts: ImportantContact[];
  additionalFields?: any | null;
  status: string; // inscrito | fila_espera | cancelado
  checkInCode?: string | null;
  qrCodeUrl?: string | null;
  checkedIn?: boolean;
  checkedInAt?: string | null;
  paymentStatus?: string;
  paymentPromiseDate?: string | null;
  paymentProofUrl?: string | null;
  createdAt: string;
  event?: {
    title: string;
    date: string;
    time: string;
    location: string;
    value: number;
  };
}

interface WhatsappInstance {
  id: string;
  name: string;
  instance_id: string;
  status: string;
  phone_number: string;
  is_active: boolean;
}

export default function PenielDashboard() {
  const campoId = useCampoId();
  const [activeTab, setActiveTab] = useState<"dashboard" | "registrations" | "events" | "checkin" | "cms">("dashboard");
  // Ocultar/mostrar o Valor Arrecadado (preferência persistida; oculto por padrão)
  const [showRevenue, setShowRevenue] = useState<boolean>(() => {
    if (typeof window !== "undefined") return localStorage.getItem("peniel_show_revenue") === "true";
    return false;
  });
  const toggleRevenue = () => {
    setShowRevenue(prev => {
      const next = !prev;
      try { localStorage.setItem("peniel_show_revenue", String(next)); } catch { /* ignore */ }
      return next;
    });
  };

  // State Lists
  const [events, setEvents] = useState<PenielEvent[]>([]);
  const [registrations, setRegistrations] = useState<PenielRegistration[]>([]);
  const [instances, setInstances] = useState<WhatsappInstance[]>([]);
  const [config, setConfig] = useState<PenielConfig | null>(null);

  // Filter States
  const [selectedEventFilter, setSelectedEventFilter] = useState<string>("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("inscrito");
  const [searchTerm, setSearchTerm] = useState<string>("");
  // Intervalo de datas (inicia no 1º e último dia do mês atual)
  const monthStart = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString("en-CA"); })();
  const monthEnd = (() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toLocaleDateString("en-CA"); })();
  const [dateStart, setDateStart] = useState<string>(monthStart);
  const [dateEnd, setDateEnd] = useState<string>(monthEnd);
  const [checkinFilter, setCheckinFilter] = useState<string>("all"); // all | sim | nao

  // UI Loaders & Errors
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // CRUD Modals
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PenielEvent | null>(null);

  // CMS Card/Slide States
  const [showCardModal, setShowCardModal] = useState(false);
  const [editingCardIndex, setEditingCardIndex] = useState<number | null>(null);
  const [cardForm, setCardForm] = useState({
    title: "",
    subtitle: "",
    image: "",
    videoUrl: "",
    buttonText: "",
    buttonLink: "",
    active: true
  });

  // CMS Testimonial States
  const [showTestimonialModal, setShowTestimonialModal] = useState(false);
  const [editingTestimonialIndex, setEditingTestimonialIndex] = useState<number | null>(null);
  const [testimonialForm, setTestimonialForm] = useState({
    name: "",
    quote: "",
    imageUrl: "",
    videoUrl: "",
    active: true
  });

  const [uploading, setUploading] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const openConfirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    isDanger = true,
    confirmText?: string,
    cancelText?: string
  ) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      },
      isDanger,
      confirmText,
      cancelText
    });
  };

  const cardFileRef = React.useRef<HTMLInputElement>(null);
  const testimonialFileRef = React.useRef<HTMLInputElement>(null);

  const handleUploadImage = async (file: File, onSuccess: (url: string) => void) => {
    if (!file) return;
    setUploading(true);
    try {
      const token = localStorage.getItem("mrm_token");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "peniel");
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Erro ${res.status}`);
      onSuccess(json.url);
      flashSuccess("Imagem enviada com sucesso!");
    } catch (err: any) {
      flashError("Erro no envio da imagem: " + (err.message || "Erro desconhecido"));
    } finally {
      setUploading(false);
    }
  };
  const [eventForm, setEventForm] = useState({
    title: "",
    date: "",
    time: "",
    location: "",
    value: 0,
    limit: 100,
    status: "active",
    isFeatured: false,
    paymentLink: "",
    description: "",
    dateLabel: "",
    departureLocation: "",
    eventLocation: "",
    latitude: "",
    longitude: "",
    extraFieldsConfig: {
      spouse: false,
      children: false,
      ecclesiastical: false
    } as any
  });

  const [selectedRegistration, setSelectedRegistration] = useState<PenielRegistration | null>(null);

  // CMS configuration States (local editing copy)
  const [cmsConfig, setCmsConfig] = useState<PenielConfig | null>(null);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    if (!campoId) return;
    setLoading(true);
    setError(null);
    try {
      const user = JSON.parse(localStorage.getItem("mrm_user") || "{}");
      const isMaster = user.profileType === "master";
      const eventsUrl = isMaster
        ? `${apiBase}/peniel/events?all=true`
        : `${apiBase}/peniel/events?campoId=${campoId}`;

      const [eventsRes, configRes, instancesRes] = await Promise.all([
        authFetch<PenielEvent[]>(eventsUrl),
        authFetch<PenielConfig>(`${apiBase}/peniel/config?campoId=${campoId}`),
        authFetch<WhatsappInstance[]>(`${apiBase}/whatsapp/instances`).catch(() => [])
      ]);

      setEvents(Array.isArray(eventsRes) ? eventsRes : []);
      setConfig(configRes);
      setCmsConfig(configRes);
      setInstances(Array.isArray(instancesRes) ? instancesRes : []);

      // Pre-select first event in list for registrations tab filter if empty
      if (eventsRes.length > 0 && !selectedEventFilter) {
        setSelectedEventFilter("all");
      }
    } catch (e) {
      setError("Erro ao carregar dados do painel: " + String(e));
    } finally {
      setLoading(false);
    }
  }, [campoId]);

  // Load registrations based on filters
  const fetchRegistrations = useCallback(async () => {
    if (!campoId) return;
    try {
      let url = `${apiBase}/peniel/registrations?campoId=${campoId}`;
      if (selectedEventFilter && selectedEventFilter !== "all") {
        url += `&eventId=${selectedEventFilter}`;
      }
      if (selectedStatusFilter && selectedStatusFilter !== "all") {
        url += `&status=${selectedStatusFilter}`;
      }
      if (searchTerm) {
        url += `&search=${encodeURIComponent(searchTerm)}`;
      }
      if (dateStart) url += `&startDate=${dateStart}`;
      if (dateEnd) url += `&endDate=${dateEnd}`;
      if (checkinFilter && checkinFilter !== "all") url += `&checkin=${checkinFilter}`;

      const res = await authFetch<PenielRegistration[]>(url);
      setRegistrations(Array.isArray(res) ? res : []);
    } catch (e) {
      console.error("Erro ao buscar inscrições:", e);
    }
  }, [campoId, selectedEventFilter, selectedStatusFilter, searchTerm, dateStart, dateEnd, checkinFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === "registrations" || activeTab === "dashboard") {
      fetchRegistrations();
    }
  }, [activeTab, selectedEventFilter, selectedStatusFilter, searchTerm, fetchRegistrations]);

  // Flash messages helper
  const flashSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 4000);
  };
  const flashError = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 5000);
  };

  // ── Event Operations ──
  const openNewEvent = () => {
    setEditingEvent(null);
    setEventForm({
      title: "",
      date: "",
      time: "",
      location: "",
      value: 0,
      limit: 100,
      status: "active",
      isFeatured: false,
      paymentLink: "",
      description: "",
      dateLabel: "",
      departureLocation: "",
      eventLocation: "",
      latitude: "",
      longitude: "",
      extraFieldsConfig: {
        spouse: false,
        children: false,
        ecclesiastical: false
      }
    });
    setShowEventModal(true);
  };

  const openEditEvent = (evt: PenielEvent) => {
    setEditingEvent(evt);
    let extraCfg = { spouse: false, children: false, ecclesiastical: false };
    if (evt.extraFieldsConfig) {
      try {
        extraCfg = typeof evt.extraFieldsConfig === "string"
          ? JSON.parse(evt.extraFieldsConfig)
          : evt.extraFieldsConfig;
      } catch (e) {
        console.error("Erro ao fazer parse de extraFieldsConfig", e);
      }
    }
    setEventForm({
      title: evt.title,
      date: new Date(evt.date).toISOString().slice(0, 10),
      time: evt.time,
      location: evt.location,
      value: Number(evt.value),
      limit: evt.limit,
      status: evt.status,
      isFeatured: !!evt.isFeatured,
      paymentLink: evt.paymentLink || "",
      description: evt.description || "",
      dateLabel: evt.dateLabel || "",
      departureLocation: evt.departureLocation || "",
      eventLocation: evt.eventLocation || "",
      latitude: evt.latitude || "",
      longitude: evt.longitude || "",
      extraFieldsConfig: {
        spouse: !!extraCfg.spouse,
        children: !!extraCfg.children,
        ecclesiastical: !!extraCfg.ecclesiastical
      }
    });
    setShowEventModal(true);
  };

  const saveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm.title || !eventForm.date || !eventForm.time || !eventForm.location) {
      flashError("Preencha todos os campos obrigatórios.");
      return;
    }
    setActionLoading(true);
    try {
      if (editingEvent) {
        // Edit
        await authFetch(`${apiBase}/peniel/events/${editingEvent.id}`, {
          method: "PATCH",
          body: JSON.stringify(eventForm)
        });
        flashSuccess("Encontro atualizado com sucesso!");
      } else {
        // Create
        await authFetch(`${apiBase}/peniel/events`, {
          method: "POST",
          body: JSON.stringify({ ...eventForm, campoId })
        });
        flashSuccess("Novo encontro agendado com sucesso!");
      }
      setShowEventModal(false);
      fetchData();
    } catch (err) {
      flashError("Erro ao salvar encontro: " + String(err));
    } finally {
      setActionLoading(false);
    }
  };

  const deleteEvent = (id: string) => {
    openConfirm(
      "Excluir Encontro?",
      "Todas as inscrições associadas serão excluídas do painel (exclusão lógica).",
      async () => {
        try {
          await authFetch(`${apiBase}/peniel/events/${id}`, { method: "DELETE" });
          flashSuccess("Encontro excluído com sucesso.");
          fetchData();
        } catch (err) {
          flashError("Erro ao excluir encontro: " + String(err));
        }
      },
      true,
      "Excluir",
      "Cancelar"
    );
  };

  // ── Registration Operations ──
  const changeRegistrationStatus = async (id: string, newStatus: string) => {
    try {
      await authFetch(`${apiBase}/peniel/registrations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus })
      });
      flashSuccess(`Status da inscrição alterado para ${newStatus === "inscrito" ? "inscrito" : newStatus === "fila_espera" ? "fila de espera" : "cancelado"}.`);
      fetchRegistrations();
      fetchData();
      if (selectedRegistration && selectedRegistration.id === id) {
        setSelectedRegistration(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err) {
      flashError("Erro ao atualizar status: " + String(err));
    }
  };

  const [resendingId, setResendingId] = useState<string | null>(null);
  const resendQrCode = async (id: string) => {
    setResendingId(id);
    try {
      await authFetch(`${apiBase}/peniel/registrations/${id}/resend-qr`, { method: "POST" });
      flashSuccess("Ingresso (QR Code) reenviado por WhatsApp com sucesso!");
    } catch (err) {
      flashError("Erro ao reenviar QR Code: " + String(err));
    } finally {
      setResendingId(null);
    }
  };

  // Máscara de celular: (99) 99999-9999
  const maskPhone = (v: string) => {
    const d = (v || "").replace(/\D/g, "").slice(0, 11);
    if (d.length === 0) return "";
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  // Edição da ficha
  const [editingReg, setEditingReg] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const openEditReg = () => {
    if (!selectedRegistration) return;
    const r = selectedRegistration;
    setEditForm({
      nome: r.nome,
      celular: r.celular,
      igrejaBase: r.igrejaBase,
      endereco: r.endereco,
      idade: r.idade,
      estadoCivil: r.estadoCivil,
      dataNascimento: r.dataNascimento ? new Date(r.dataNascimento).toISOString().slice(0, 10) : ""
    });
    setEditingReg(true);
  };
  const saveEditReg = async () => {
    if (!selectedRegistration) return;
    try {
      await authFetch(`${apiBase}/peniel/registrations/${selectedRegistration.id}`, {
        method: "PATCH",
        body: JSON.stringify(editForm)
      });
      flashSuccess("Ficha atualizada com sucesso!");
      setSelectedRegistration(prev => prev ? { ...prev, ...editForm } : null);
      setEditingReg(false);
      fetchRegistrations();
    } catch (err) {
      flashError("Erro ao salvar ficha: " + String(err));
    }
  };

  const printFicha = () => {
    const r = selectedRegistration;
    if (!r) return;
    const esc = (v: any) => String(v ?? "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));
    const dt = (d: any) => d ? new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" }) : "—";
    let extra: any = {};
    try { extra = typeof r.additionalFields === "string" ? JSON.parse(r.additionalFields) : (r.additionalFields || {}); } catch {}
    const contacts = Array.isArray(r.importantContacts) ? r.importantContacts : [];
    // Campo no estilo formulário (rótulo + caixa com contorno)
    const field = (label: string, value: any, span = 1) =>
      `<div class="field" style="grid-column:span ${span}"><div class="lbl">${esc(label)}</div><div class="box">${esc(value ?? "—") || "—"}</div></div>`;

    const w = window.open("", "_blank", "width=860,height=1040");
    if (!w) { flashError("Permita pop-ups para imprimir."); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Ficha - ${esc(r.nome)}</title>
      <style>
        *{box-sizing:border-box}
        body{font-family:Arial,Helvetica,sans-serif;color:#1e293b;margin:0;padding:28px;font-size:12px}
        .head{background:#0b2819;color:#fff;padding:14px 18px;border-radius:10px;display:flex;justify-content:space-between;align-items:center}
        .head h1{font-size:18px;margin:0}
        .head .code{font-family:monospace;font-size:16px;letter-spacing:3px;background:#d4af37;color:#0b2819;padding:6px 12px;border-radius:8px;font-weight:bold}
        .sub{color:#64748b;margin:6px 2px 16px}
        h2{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#0b7a4b;margin:18px 0 8px}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .field .lbl{color:#64748b;font-size:9px;text-transform:uppercase;margin-bottom:3px;font-weight:bold}
        .field .box{border:1px solid #cbd5e1;border-radius:6px;padding:7px 10px;min-height:32px;font-weight:bold;background:#fff}
        .contact{border:1px solid #cbd5e1;border-radius:6px;padding:8px 10px;margin-bottom:6px}
        .contact b{display:block}
        .foot{margin-top:24px;text-align:center;color:#94a3b8;font-size:9px;border-top:1px solid #e2e8f0;padding-top:10px}
        @media print{body{padding:12px}}
      </style></head><body onload="window.focus();window.print();">
      <div class="head">
        <div><h1>PENIEL — Ficha de Inscrição</h1><div style="font-size:11px;opacity:.85">${esc(r.event?.title || "")} · Protocolo ${esc(r.id.slice(0,8).toUpperCase())}</div></div>
        <div class="code">${esc(r.checkInCode || "—")}</div>
      </div>

      <h2>1. Dados Pessoais</h2>
      <div class="grid">
        ${field("Nome Completo", r.nome, 2)}
        ${field("Tipo de Ficha", r.tipoParticipante)}
        ${field("Data de Nascimento", `${dt(r.dataNascimento)} (${r.idade} anos)`)}
        ${field("Estado Civil", r.estadoCivil)}
        ${field("Celular / WhatsApp", r.celular)}
        ${field("Endereço", r.endereco, 2)}
      </div>

      <h2>2. Informações Eclesiásticas</h2>
      <div class="grid">
        ${field("Igreja Base", r.igrejaBase)}
        ${field("Batizado nas Águas?", r.batizadoAguas ? "Sim" : "Não")}
        ${field("Participa de Grupo Familiar?", r.participaGrupoFamiliar ? "Sim" : "Não")}
        ${field("Qual grupo / célula", r.grupoFamiliarQual)}
        ${field("Nome do Líder", r.nomeLider)}
        ${extra.spouseName ? field("Cônjuge", extra.spouseName) : ""}
        ${extra.ecclesiasticalCongregation ? field("Congregação", extra.ecclesiasticalCongregation) : ""}
        ${extra.ecclesiasticalCargo ? field("Cargo Eclesiástico", extra.ecclesiasticalCargo) : ""}
        ${extra.hasChildren ? field("Filhos", extra.childrenDetails, 2) : ""}
      </div>

      <h2>3. Motivação</h2>
      <div class="grid">
        ${field("Quem motivou", r.quemMotivou, 2)}
        ${field("Por que decidiu participar", r.porqueDecidiu, 2)}
        ${field("Expectativas", r.expectativas, 2)}
      </div>

      <h2>4. Saúde e Dados Físicos</h2>
      <div class="grid">
        ${field("Peso (kg)", r.peso)}
        ${field("Altura (m)", r.altura)}
        ${field("Tem Apnéia (ronca)?", extra.apneia ? (extra.apneia === "sim" ? "Sim" : "Não") : "—")}
        ${field("Medicamentos", r.medicamentos || "Nenhum")}
        ${field("Alergias / Restrições", r.alergiasRestricoes || "Nenhuma", 2)}
      </div>

      <h2>5. Contatos Importantes</h2>
      ${contacts.length ? contacts.map((c: any, i: number) => `<div class="contact"><b>${i + 1}. ${esc(c.nome)} — ${esc(c.whatsapp)}</b>Parentesco: ${esc(c.parentesco)} · Relação: ${esc(c.relacao)}</div>`).join("") : '<div class="contact">Nenhum contato informado.</div>'}

      <h2>6. Pagamento</h2>
      <div class="grid">
        ${field("Status do Pagamento", r.paymentStatus)}
        ${field("Promessa de Pagamento", dt(r.paymentPromiseDate))}
        ${field("Comprovante", r.paymentProofUrl ? "Anexado" : "Não anexado")}
        ${field("Valor da Ficha", "R$ " + fmt(Number(r.event?.value || 0)))}
      </div>

      <div class="foot">Documento gerado pelo sistema · ${new Date().toLocaleString("pt-BR")}</div>
      <script>window.onafterprint=function(){window.close()};</script>
      </body></html>`);
    w.document.close();
  };

  // Confirmar pagamento (mesmo sem comprovante) e aprovação em massa
  const confirmPayment = async (id: string) => {
    try {
      await authFetch(`${apiBase}/peniel/registrations/${id}`, { method: "PATCH", body: JSON.stringify({ paymentStatus: "pago" }) });
      flashSuccess("Pagamento confirmado.");
      fetchRegistrations();
      fetchData();
      if (selectedRegistration?.id === id) setSelectedRegistration(prev => prev ? { ...prev, paymentStatus: "pago" } : null);
    } catch (err) {
      flashError("Erro ao confirmar pagamento: " + String(err));
    }
  };

  const [selectedRegIds, setSelectedRegIds] = useState<string[]>([]);
  const toggleRegSelect = (id: string) => {
    setSelectedRegIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const toggleSelectAll = () => {
    setSelectedRegIds(prev => prev.length === registrations.length ? [] : registrations.map(r => r.id));
  };
  const [approvingAll, setApprovingAll] = useState(false);
  const approveAllSelected = async () => {
    if (selectedRegIds.length === 0) return;
    openConfirm(
      "Confirmar pagamento das selecionadas?",
      `Marcar ${selectedRegIds.length} inscrição(ões) como PAGAS (entram no valor arrecadado). Deseja continuar?`,
      async () => {
        setApprovingAll(true);
        try {
          for (const id of selectedRegIds) {
            await authFetch(`${apiBase}/peniel/registrations/${id}`, { method: "PATCH", body: JSON.stringify({ paymentStatus: "pago" }) });
          }
          flashSuccess("Pagamentos confirmados.");
          setSelectedRegIds([]);
          fetchRegistrations();
          fetchData();
        } catch (err) {
          flashError("Erro ao aprovar em massa: " + String(err));
        } finally {
          setApprovingAll(false);
        }
      },
      false,
      "Confirmar",
      "Cancelar"
    );
  };

  // Totais da lista filtrada
  const isPaidReg = (r: PenielRegistration) => r.status === "inscrito" && ["pago", "comprovante_enviado", "gratuito"].includes(r.paymentStatus || "");
  const totalArrecadadoLista = registrations.filter(isPaidReg).reduce((a, r) => a + Number(r.event?.value || 0), 0);
  const totalPendenteLista = registrations.filter(r => r.status === "inscrito" && (r.paymentStatus || "pendente") === "pendente").reduce((a, r) => a + Number(r.event?.value || 0), 0);

  const [remindingId, setRemindingId] = useState<string | null>(null);
  const remindPayment = async (id: string) => {
    setRemindingId(id);
    try {
      await authFetch(`${apiBase}/peniel/registrations/${id}/remind`, { method: "POST" });
      flashSuccess("Lembrete de pagamento enviado por WhatsApp.");
    } catch (err) {
      flashError("Erro ao enviar lembrete: " + String(err));
    } finally {
      setRemindingId(null);
    }
  };

  const liberarVaga = (reg: PenielRegistration) => {
    openConfirm(
      "Liberar a vaga?",
      `A inscrição de ${reg.nome} será cancelada (pagamento não confirmado), liberando a vaga para outra pessoa. Deseja continuar?`,
      () => changeRegistrationStatus(reg.id, "cancelado"),
      true,
      "Liberar vaga",
      "Cancelar"
    );
  };

  // Atrasada: confirmada, evento pago, sem comprovante/pagamento e promessa vencida (ou inexistente)
  const isPaymentOverdue = (reg: PenielRegistration) => {
    if (reg.status !== "inscrito") return false;
    if (Number(reg.event?.value || 0) <= 0) return false;
    if (reg.paymentStatus === "pago" || reg.paymentStatus === "comprovante_enviado" || reg.paymentStatus === "gratuito") return false;
    if (!reg.paymentPromiseDate) return true;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return new Date(reg.paymentPromiseDate) < today;
  };

  const deleteRegistration = (id: string) => {
    openConfirm(
      "Excluir Inscrição?",
      "Tem certeza que deseja excluir esta inscrição?",
      async () => {
        try {
          await authFetch(`${apiBase}/peniel/registrations/${id}`, { method: "DELETE" });
          flashSuccess("Inscrição removida.");
          setSelectedRegistration(null);
          fetchRegistrations();
          fetchData();
        } catch (err) {
          flashError("Erro ao excluir inscrição: " + String(err));
        }
      },
      true,
      "Excluir",
      "Cancelar"
    );
  };

  // ── CMS Slide/Card Operations ──
  const openNewCard = () => {
    setEditingCardIndex(null);
    setCardForm({
      title: "",
      subtitle: "",
      image: "",
      videoUrl: "",
      buttonText: "",
      buttonLink: "",
      active: true
    });
    setShowCardModal(true);
  };

  const openEditCard = (index: number) => {
    if (!cmsConfig) return;
    const card = ((cmsConfig.heroCards || [])[index] || {}) as any;
    setEditingCardIndex(index);
    setCardForm({
      title: card.title || "",
      subtitle: card.subtitle || card.description || "",
      image: card.image || "",
      videoUrl: card.videoUrl || "",
      buttonText: card.buttonText || "",
      buttonLink: card.buttonLink || "",
      active: card.active !== false
    });
    setShowCardModal(true);
  };

  const saveCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cmsConfig) return;
    const cards = [...(cmsConfig.heroCards || [])];
    const newCard = { ...cardForm };
    if (editingCardIndex !== null) {
      cards[editingCardIndex] = newCard;
    } else {
      cards.push(newCard);
    }
    setCmsConfig({ ...cmsConfig, heroCards: cards });
    setShowCardModal(false);
  };

  const deleteCard = (index: number) => {
    if (!cmsConfig) return;
    openConfirm(
      "Excluir card?",
      "Deseja realmente excluir este card de apresentação?",
      () => {
        const cards = (cmsConfig.heroCards || []).filter((_, i) => i !== index);
        setCmsConfig({ ...cmsConfig, heroCards: cards });
      },
      true
    );
  };

  // ── CMS Testimonial Operations ──
  const openNewTestimonial = () => {
    setEditingTestimonialIndex(null);
    setTestimonialForm({
      name: "",
      quote: "",
      imageUrl: "",
      videoUrl: "",
      active: true
    });
    setShowTestimonialModal(true);
  };

  const openEditTestimonial = (index: number) => {
    if (!cmsConfig) return;
    const test = ((cmsConfig.testimonyVideos || [])[index] || {}) as any;
    setEditingTestimonialIndex(index);
    setTestimonialForm({
      name: test.name || "",
      quote: test.quote || "",
      imageUrl: test.imageUrl || "",
      videoUrl: test.videoUrl || "",
      active: test.active !== false
    });
    setShowTestimonialModal(true);
  };

  const saveTestimonial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cmsConfig) return;
    const testimonies = [...(cmsConfig.testimonyVideos || [])];
    const newTest = { ...testimonialForm };
    if (editingTestimonialIndex !== null) {
      testimonies[editingTestimonialIndex] = newTest;
    } else {
      testimonies.push(newTest);
    }
    setCmsConfig({ ...cmsConfig, testimonyVideos: testimonies });
    setShowTestimonialModal(false);
  };

  const deleteTestimonial = (index: number) => {
    if (!cmsConfig) return;
    openConfirm(
      "Excluir testemunho?",
      "Deseja realmente excluir este depoimento/testemunho?",
      () => {
        const testimonies = (cmsConfig.testimonyVideos || []).filter((_, i) => i !== index);
        setCmsConfig({ ...cmsConfig, testimonyVideos: testimonies });
      },
      true
    );
  };

  // ── CMS Operations ──
  const confirmSaveCmsConfig = (e: React.FormEvent) => {
    e.preventDefault();
    openConfirm(
      "Publicar Alterações?",
      "Deseja realmente publicar estas alterações no site público da Peniel?",
      async () => {
        if (!cmsConfig) return;
        setActionLoading(true);
        try {
          const updated = await authFetch(`${apiBase}/peniel/config`, {
            method: "POST",
            body: JSON.stringify({ ...cmsConfig, campoId })
          });
          setConfig(updated as PenielConfig);
          flashSuccess("Página pública Peniel atualizada com sucesso!");
        } catch (err) {
          flashError("Erro ao salvar configurações do site: " + String(err));
        } finally {
          setActionLoading(false);
        }
      },
      false
    );
  };

  const updateCmsField = (field: keyof PenielConfig, value: any) => {
    if (!cmsConfig) return;
    setCmsConfig({ ...cmsConfig, [field]: value });
  };

  const updateNestedCmsField = (parent: "buttonsConfig", field: string, value: any) => {
    if (!cmsConfig) return;
    setCmsConfig({
      ...cmsConfig,
      [parent]: {
        ...cmsConfig[parent],
        [field]: value
      }
    });
  };

  const handleWhatsAppSelect = async (instanceId: string | null) => {
    if (!cmsConfig) return;
    const nextConfig = { ...cmsConfig, whatsappInstanceId: instanceId || null };
    setCmsConfig(nextConfig);
    try {
      const updated = await authFetch<PenielConfig>(`${apiBase}/peniel/config`, {
        method: "POST",
        body: JSON.stringify({ ...nextConfig, campoId })
      });
      setConfig(updated);
      flashSuccess("Instância de WhatsApp configurada com sucesso.");
    } catch (err) {
      flashError("Erro ao salvar instância WhatsApp: " + String(err));
    }
  };

  // ── Export Registrations as CSV ──
  const exportToCSV = () => {
    if (registrations.length === 0) {
      flashError("Nenhuma inscrição disponível para exportação.");
      return;
    }

    const headers = [
      "ID Inscrição", "Tipo", "Status", "Nome Completo", "Celular", "Igreja Base",
      "Data Nascimento", "Idade", "Estado Civil", "Endereço", "Batizado Águas",
      "Grupo Familiar", "Líder GF", "Expectativas", "Motivo", "Quem Motivou",
      "Medicamentos", "Alergias/Restrições", "Peso (kg)", "Altura (m)", "Data Registro"
    ];

    const rows = registrations.map(reg => [
      reg.id,
      reg.tipoParticipante,
      reg.status,
      reg.nome,
      reg.celular,
      reg.igrejaBase,
      new Date(reg.dataNascimento).toLocaleDateString("pt-BR"),
      reg.idade,
      reg.estadoCivil,
      reg.endereco,
      reg.batizadoAguas ? "Sim" : "Não",
      reg.participaGrupoFamiliar ? `Sim (${reg.grupoFamiliarQual || ""})` : "Não",
      reg.nomeLider || "",
      reg.expectativas.replace(/[\r\n]+/g, " "),
      reg.porqueDecidiu.replace(/[\r\n]+/g, " "),
      reg.quemMotivou,
      reg.medicamentos || "",
      reg.alergiasRestricoes || "",
      Number(reg.peso).toFixed(2),
      Number(reg.altura).toFixed(2),
      new Date(reg.createdAt).toLocaleDateString("pt-BR")
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(";"),
      ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(";"))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `peniel-inscritos-${selectedEventFilter === "all" ? "geral" : selectedEventFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Statistics summaries
  const nextEvent = events.find(e => e.status === "active" && new Date(e.date) >= new Date()) || events[0] || null;
  const totalInscritosGlobal = events.reduce((acc, curr) => acc + curr.totalInscritos, 0);
  const totalWaitlistGlobal = events.reduce((acc, curr) => acc + curr.filaEspera, 0);
  const totalRevenueGlobal = events.reduce((acc, curr) => acc + Number(curr.valorArrecadado || 0), 0);

  const activeWhatsApp = instances.find(inst => inst.id === config?.whatsappInstanceId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Carregando painel Peniel...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto text-slate-800 dark:text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/60 rounded-xl flex items-center justify-center border border-emerald-200 dark:border-emerald-900 shadow-sm">
            <Dove className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Gestão Peniel</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Controle de edições, inscrições, fila de espera e site do encontro</p>
          </div>
        </div>

        {/* Global actions & Messages */}
        <div className="flex items-center gap-3">
          <a
            href={`/peniel?campoId=${campoId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-sm transition-colors font-medium"
          >
            Ver Página Pública
          </a>
          <button
            onClick={openNewEvent}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm transition-colors font-semibold shadow-sm"
          >
            <Plus className="w-4 h-4" /> Novo Evento
          </button>
        </div>
      </div>

      {/* Flashed Notifications */}
      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm rounded-lg px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-emerald-400 hover:text-emerald-600">✕</button>
        </div>
      )}
      {error && (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-sm rounded-lg px-4 py-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-600">✕</button>
        </div>
      )}

      {/* KPI Cards Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Confirmados Geral</p>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2">{totalInscritosGlobal}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Fila de Espera Geral</p>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <HourglassIcon className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2">{totalWaitlistGlobal}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Vagas no Próximo Evento</p>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2">
            {nextEvent ? Math.max(0, nextEvent.limit - nextEvent.totalInscritos) : 0}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
          <div className="flex justify-between items-start">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Valor Arrecadado</p>
            <button
              type="button"
              onClick={toggleRevenue}
              title={showRevenue ? "Ocultar valor" : "Mostrar valor"}
              aria-label={showRevenue ? "Ocultar valor arrecadado" : "Mostrar valor arrecadado"}
              className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/40 flex items-center justify-center text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/40 transition-colors"
            >
              {showRevenue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2 select-none">
            {showRevenue ? `R$ ${fmt(totalRevenueGlobal)}` : "R$ ••••••"}
          </p>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        {[
          { key: "dashboard", label: "Visão Geral" },
          { key: "registrations", label: "Inscrições & Fila de Espera" },
          { key: "events", label: "Agenda de Eventos (CRUD)" },
          { key: "cms", label: "CMS Página Pública" }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-emerald-600 text-emerald-700 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: VISÃO GERAL / DASHBOARD ── */}
      {activeTab === "dashboard" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Next Featured Event (Left side - 7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {nextEvent ? (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">
                  <Sparkles className="w-3.5 h-3.5" /> Encontro Destaque
                </div>
                <h3 className="text-xl font-bold mb-4">{nextEvent.title}</h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 mb-6">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase leading-none">Data</p>
                      <p className="text-sm font-medium mt-0.5">{new Date(nextEvent.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase leading-none">Horário</p>
                      <p className="text-sm font-medium mt-0.5">{nextEvent.time}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-slate-400" />
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase leading-none">Local</p>
                      <p className="text-sm font-medium mt-0.5">{nextEvent.location}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-700/60 pt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-900/40 rounded-lg p-3">
                    <p className="text-[10px] text-slate-400 uppercase leading-none">Confirmados</p>
                    <p className="text-lg font-bold text-slate-800 dark:text-white mt-1">{nextEvent.totalInscritos} / {nextEvent.limit}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/40 rounded-lg p-3">
                    <p className="text-[10px] text-slate-400 uppercase leading-none">Disponíveis</p>
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-1">{nextEvent.vagasDisponiveis}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/40 rounded-lg p-3">
                    <p className="text-[10px] text-slate-400 uppercase leading-none">Fila de Espera</p>
                    <p className="text-lg font-bold text-amber-600 dark:text-amber-500 mt-1">{nextEvent.filaEspera}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/40 rounded-lg p-3">
                    <p className="text-[10px] text-slate-400 uppercase leading-none">Valor da Ficha</p>
                    <p className="text-lg font-bold text-slate-800 dark:text-white mt-1">R$ {fmt(Number(nextEvent.value))}</p>
                  </div>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setSelectedEventFilter(nextEvent.id);
                      setSelectedStatusFilter("all");
                      setActiveTab("registrations");
                    }}
                    className="px-4 py-2 bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold rounded-lg shadow-sm transition-colors"
                  >
                    Ver Inscrições
                  </button>
                  <button
                    onClick={() => openEditEvent(nextEvent)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold rounded-lg transition-colors"
                  >
                    Configurar Encontro
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center text-slate-400 dark:text-slate-500 shadow-sm flex flex-col items-center justify-center h-[300px]">
                <Calendar className="w-10 h-10 mb-3 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-medium">Nenhum evento futuro ou ativo agendado.</p>
                <button
                  onClick={openNewEvent}
                  className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Criar Primeiro Encontro
                </button>
              </div>
            )}

            {/* Quick overview table with registrations */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
              <h4 className="font-bold mb-4 text-sm">Últimos Inscritos</h4>
              {registrations.length === 0 ? (
                <p className="text-slate-400 text-xs text-center py-6">Nenhum inscrito registrado.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-700 text-slate-400 font-semibold uppercase">
                        <th className="py-2.5">Nome</th>
                        <th className="py-2.5">Celular</th>
                        <th className="py-2.5">Igreja Base</th>
                        <th className="py-2.5">Encontro</th>
                        <th className="py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {registrations.slice(0, 5).map(reg => (
                        <tr key={reg.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-2.5 font-medium text-slate-900 dark:text-white">{reg.nome}</td>
                          <td className="py-2.5 text-slate-500 dark:text-slate-400">{reg.celular}</td>
                          <td className="py-2.5 text-slate-500 dark:text-slate-400">{reg.igrejaBase}</td>
                          <td className="py-2.5 text-slate-500 dark:text-slate-400">{reg.event?.title || "Encontro"}</td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              reg.status === "inscrito" ? "bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400" :
                              reg.status === "fila_espera" ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400" :
                              "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                            }`}>
                              {reg.status === "inscrito" ? "Confirmado" : reg.status === "fila_espera" ? "Fila" : "Cancelado"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right side: WhatsApp instance & list of events (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* WhatsApp settings card */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <Smartphone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h4 className="font-bold text-sm">Disparo de WhatsApp (Z-API)</h4>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                Selecione qual instância WhatsApp configurada no sistema será utilizada para enviar as mensagens automáticas de confirmação de inscrição e atualizações da fila de espera.
              </p>

              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Selecione a Instância Ativa</label>
                  <select
                    value={config?.whatsappInstanceId || ""}
                    onChange={(e) => handleWhatsAppSelect(e.target.value || null)}
                    className={selectCls}
                  >
                    <option value="">Sem envio de WhatsApp automático</option>
                    {instances.map(inst => (
                      <option key={inst.id} value={inst.id}>
                        {inst.name} ({inst.phone_number || "Sem número"}) - {inst.status === "connected" ? "Conectada" : "Desconectada"}
                      </option>
                    ))}
                  </select>
                </div>

                {activeWhatsApp && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/60 text-xs">
                    <div>
                      <p className="font-bold text-emerald-800 dark:text-emerald-400">{activeWhatsApp.name}</p>
                      <p className="text-emerald-600/80 dark:text-emerald-500/80 text-[10px] mt-0.5">Instance ID: {activeWhatsApp.instance_id}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      activeWhatsApp.status === "connected" ? "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                    }`}>
                      {activeWhatsApp.status === "connected" ? "Ativa" : "Pendente"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* List of upcoming events */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm">Cronograma de Encontros</h4>
                <button
                  onClick={() => setActiveTab("events")}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  Ver Todos
                </button>
              </div>

              <div className="space-y-3">
                {events.slice(0, 4).map(evt => {
                  const isFuture = new Date(evt.date) >= new Date();
                  return (
                    <div
                      key={evt.id}
                      className="p-3 border border-slate-100 dark:border-slate-700/60 rounded-lg flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div className="space-y-1">
                        <p className="font-semibold text-xs leading-none text-slate-800 dark:text-slate-200">{evt.title}</p>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1.5 pt-0.5">
                          <Calendar className="w-3 h-3" />
                          {new Date(evt.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                          <span>·</span>
                          <Users className="w-3 h-3" />
                          {evt.totalInscritos} confirmados
                        </p>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        evt.status === "active" && isFuture
                          ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                      }`}>
                        {evt.status === "active" && isFuture ? "Ativo" : "Concluído"}
                      </span>
                    </div>
                  );
                })}

                {events.length === 0 && (
                  <p className="text-slate-400 text-xs text-center py-6">Nenhum evento registrado.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: INSCRIÇÕES & FILA DE ESPERA ── */}
      {activeTab === "registrations" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Filtrar por Encontro</label>
                <select
                  value={selectedEventFilter}
                  onChange={(e) => setSelectedEventFilter(e.target.value)}
                  className={selectCls}
                >
                  <option value="all">Todos os Encontros</option>
                  {events.map(evt => (
                    <option key={evt.id} value={evt.id}>
                      {evt.title} ({new Date(evt.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Filtrar por Status</label>
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className={selectCls}
                >
                  <option value="all">Todos os Status</option>
                  <option value="inscrito">Confirmados</option>
                  <option value="fila_espera">Fila de Espera</option>
                  <option value="cancelado">Cancelados</option>
                </select>
              </div>

              <div className="relative">
                <label className={labelCls}>Buscar</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Nome, celular ou igreja..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Intervalo de datas + presença */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className={labelCls}>Data início (inscrição)</label>
                <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Data fim (inscrição)</label>
                <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Presença (check-in)</label>
                <select value={checkinFilter} onChange={e => setCheckinFilter(e.target.value)} className={selectCls}>
                  <option value="all">Todos</option>
                  <option value="sim">Presentes (fizeram check-in)</option>
                  <option value="nao">Ausentes (sem check-in)</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  onClick={() => { setDateStart(monthStart); setDateEnd(monthEnd); }}
                  className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  Mês atual
                </button>
                <button
                  type="button"
                  onClick={() => { setDateStart(""); setDateEnd(""); }}
                  className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  Limpar datas
                </button>
              </div>
            </div>

            {/* Totais de valor */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20 px-4 py-3">
                <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 tracking-wide">Arrecadado (confirmado)</span>
                <p className="text-lg font-black text-emerald-700 dark:text-emerald-300">R$ {fmt(totalArrecadadoLista)}</p>
              </div>
              <div className="rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 px-4 py-3">
                <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-400 tracking-wide">Pendente (a receber)</span>
                <p className="text-lg font-black text-rose-700 dark:text-rose-300">R$ {fmt(totalPendenteLista)}</p>
              </div>
            </div>

            {/* Sub-actions */}
            <div className="flex justify-between items-center flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Total localizado: <strong className="text-slate-900 dark:text-white">{registrations.length}</strong> inscrições
                · <strong className="text-teal-600 dark:text-teal-400">{registrations.filter(r => r.checkedIn).length} presente(s)</strong>
                {selectedRegIds.length > 0 && <> · <strong className="text-emerald-600">{selectedRegIds.length} selecionada(s)</strong></>}
              </span>

              <div className="flex items-center gap-2">
                {selectedRegIds.length > 0 && (
                  <button
                    onClick={approveAllSelected}
                    disabled={approvingAll}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> {approvingAll ? "Confirmando..." : `Confirmar pagamento (${selectedRegIds.length})`}
                  </button>
                )}
                <button
                  onClick={exportToCSV}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 bg-white dark:bg-slate-800 rounded-lg text-xs font-semibold transition-colors shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" /> Exportar CSV
                </button>
              </div>
            </div>
          </div>

          {/* Registrations Table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold uppercase">
                  <tr>
                    <th className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-emerald-600"
                        checked={registrations.length > 0 && selectedRegIds.length === registrations.length}
                        onChange={toggleSelectAll}
                        title="Selecionar todas"
                      />
                    </th>
                    <th className="px-5 py-3.5">Participante</th>
                    <th className="px-5 py-3.5">Tipo</th>
                    <th className="px-5 py-3.5">Contato</th>
                    <th className="px-5 py-3.5">Igreja Base</th>
                    <th className="px-5 py-3.5">Encontro</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {registrations.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-center text-slate-400 dark:text-slate-500">
                        Nenhuma inscrição cadastrada para os filtros ativos.
                      </td>
                    </tr>
                  ) : (
                    registrations.map(reg => (
                      <tr key={reg.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3.5">
                          <input
                            type="checkbox"
                            className="w-4 h-4 accent-emerald-600"
                            checked={selectedRegIds.includes(reg.id)}
                            onChange={() => toggleRegSelect(reg.id)}
                          />
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-slate-900 dark:text-white">{reg.nome}</div>
                          <div className="text-[10px] text-slate-400 font-light mt-0.5">
                            {reg.idade} anos · {reg.estadoCivil}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            reg.tipoParticipante === "encontrista" ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400" : "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400"
                          }`}>
                            {reg.tipoParticipante === "encontrista" ? "Encontrista" : "Encontreiro"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 font-medium">
                          {reg.celular}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400">
                          {reg.igrejaBase}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 font-medium">
                          {reg.event?.title || "Peniel"}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            reg.status === "inscrito" ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" :
                            reg.status === "fila_espera" ? "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400" :
                            "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                          }`}>
                            {reg.status === "inscrito" ? "Confirmado" : reg.status === "fila_espera" ? "Fila de Espera" : "Cancelado"}
                          </span>
                          {reg.checkedIn && (
                            <span className="mt-1 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400 w-fit">
                              <CheckCircle2 className="w-3 h-3" /> Presente
                            </span>
                          )}
                          {/* Pagamento */}
                          {reg.paymentStatus && reg.paymentStatus !== "gratuito" && (
                            <span className={`mt-1 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold w-fit ${
                              reg.paymentStatus === "pago" ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" :
                              reg.paymentStatus === "comprovante_enviado" ? "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400" :
                              "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400"
                            }`}>
                              {reg.paymentProofUrl ? <Paperclip className="w-3 h-3" /> : <span className="text-[9px]">R$</span>}
                              {reg.paymentStatus === "pago" ? "Pago" : reg.paymentStatus === "comprovante_enviado" ? "Comprovante" : "Pendente"}
                            </span>
                          )}
                          {reg.paymentPromiseDate && reg.paymentStatus !== "pago" && (
                            <span className="mt-1 block text-[9px] text-slate-400">Promessa: {new Date(reg.paymentPromiseDate).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</span>
                          )}
                          {isPaymentOverdue(reg) && (
                            <span className="mt-1 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white w-fit">
                              <AlertTriangle className="w-3 h-3" /> Atrasada
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex justify-center items-center gap-1.5 flex-wrap">
                            {isPaymentOverdue(reg) && (
                              <>
                                <button
                                  onClick={() => remindPayment(reg.id)}
                                  disabled={remindingId === reg.id}
                                  className="px-2 py-1 bg-amber-100 dark:bg-amber-950/40 hover:bg-amber-200 text-amber-700 dark:text-amber-400 rounded text-[10px] font-bold uppercase transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                                  title="Enviar lembrete de pagamento por WhatsApp"
                                >
                                  <Phone className="w-3 h-3" /> {remindingId === reg.id ? "..." : "Lembrete"}
                                </button>
                                <button
                                  onClick={() => liberarVaga(reg)}
                                  className="px-2 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold uppercase transition-colors inline-flex items-center gap-1"
                                  title="Cancelar e liberar a vaga"
                                >
                                  Liberar Vaga
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => setSelectedRegistration(reg)}
                              className="px-2 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-[10px] font-bold uppercase transition-colors"
                            >
                              Ver Ficha
                            </button>

                            {reg.status === "inscrito" && reg.paymentStatus !== "pago" && reg.paymentStatus !== "gratuito" && (
                              <button
                                onClick={() => confirmPayment(reg.id)}
                                className="px-2 py-1 bg-emerald-100 dark:bg-emerald-950/40 hover:bg-emerald-200 text-emerald-700 dark:text-emerald-400 rounded text-[10px] font-bold uppercase transition-colors inline-flex items-center gap-1"
                                title="Confirmar pagamento (entra no arrecadado)"
                              >
                                <CheckCircle2 className="w-3 h-3" /> Confirmar Pgto
                              </button>
                            )}

                            {reg.status === "inscrito" && (
                              <button
                                onClick={() => resendQrCode(reg.id)}
                                disabled={resendingId === reg.id}
                                className="px-2 py-1 bg-sky-100 dark:bg-sky-950/40 hover:bg-sky-200 text-sky-700 dark:text-sky-400 rounded text-[10px] font-bold uppercase transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                                title="Reenviar QR Code por WhatsApp"
                              >
                                <QrCode className="w-3 h-3" /> {resendingId === reg.id ? "Enviando..." : "Reenviar QR"}
                              </button>
                            )}

                            {reg.status === "fila_espera" && (
                              <button
                                onClick={() => changeRegistrationStatus(reg.id, "inscrito")}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold uppercase transition-colors"
                              >
                                Confirmar
                              </button>
                            )}

                            {reg.status === "inscrito" && (
                              <button
                                onClick={() => changeRegistrationStatus(reg.id, "cancelado")}
                                className="px-2 py-1 bg-rose-100 dark:bg-rose-950/40 hover:bg-rose-200 text-rose-700 dark:text-rose-400 rounded text-[10px] font-bold uppercase transition-colors"
                              >
                                Cancelar
                              </button>
                            )}

                            {reg.status === "cancelado" && (
                              <button
                                onClick={() => changeRegistrationStatus(reg.id, "inscrito")}
                                className="px-2 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 rounded text-[10px] font-bold uppercase transition-colors"
                              >
                                Reativar
                              </button>
                            )}

                            <button
                              onClick={() => deleteRegistration(reg.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                              title="Excluir Permanentemente"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: AGENDA DE EVENTOS (CRUD) ── */}
      {activeTab === "events" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center pb-2">
            <h3 className="text-base font-bold">Histórico e Agenda de Eventos</h3>
            <button
              onClick={openNewEvent}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Novo Evento
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold uppercase">
                  <tr>
                    <th className="px-5 py-3">Evento / Título</th>
                    <th className="px-5 py-3">Data & Horário</th>
                    <th className="px-5 py-3">Local</th>
                    <th className="px-5 py-3">Inscritos / Limite</th>
                    <th className="px-5 py-3">Fila Espera</th>
                    <th className="px-5 py-3">Valor Ficha</th>
                    <th className="px-5 py-3">Faturamento</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {events.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-8 text-center text-slate-400 dark:text-slate-500">
                        Nenhum evento registrado no sistema.
                      </td>
                    </tr>
                  ) : (
                    events.map(evt => (
                      <tr key={evt.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900 dark:text-white">{evt.title}</span>
                            {evt.isFeatured && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                                ★ Destaque
                              </span>
                            )}
                          </div>
                          {(evt as any).campo?.nome && (
                            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5 uppercase tracking-wider">
                              {(evt as any).campo.nome}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <div className="font-medium">{new Date(evt.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</div>
                          <div className="text-[10px] text-slate-400 font-light mt-0.5">{evt.time}</div>
                        </td>
                        <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                          {evt.location}
                        </td>
                        <td className="px-5 py-3">
                          <div className="font-semibold">{evt.totalInscritos} / {evt.limit}</div>
                          <div className="w-24 bg-slate-100 dark:bg-slate-900 h-1.5 rounded-full overflow-hidden mt-1">
                            <div
                              className="bg-emerald-500 h-full rounded-full"
                              style={{ width: `${Math.min(100, (evt.totalInscritos / evt.limit) * 100)}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-5 py-3 text-amber-600 dark:text-amber-500 font-bold">
                          {evt.filaEspera}
                        </td>
                        <td className="px-5 py-3 text-slate-900 dark:text-white font-medium">
                          R$ {fmt(Number(evt.value))}
                        </td>
                        <td className="px-5 py-3 text-teal-600 dark:text-teal-400 font-bold">
                          R$ {fmt(evt.valorArrecadado)}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            evt.status === "active" ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                          }`}>
                            {evt.status === "active" ? "Ativo" : "Inativo"}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex justify-center items-center gap-1">
                            <button
                              onClick={() => openEditEvent(evt)}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded transition-colors"
                              title="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteEvent(evt.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: CMS PÁGINA PÚBLICA ── */}
      {activeTab === "cms" && cmsConfig && (
        <form onSubmit={confirmSaveCmsConfig} className="space-y-6">
          {JSON.stringify(cmsConfig) !== JSON.stringify(config) && (
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-400 text-xs rounded-xl px-4 py-3 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4.5 h-4.5 text-amber-500 animate-bounce" />
                <span>
                  Você possui <strong>alterações pendentes</strong> no site! Lembre-se de clicar em <strong>"Salvar Alterações CMS"</strong> para publicá-las no site público da Peniel.
                </span>
              </div>
            </div>
          )}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="font-bold text-base">Identidade Visual & Textos da Página</h3>
              <button
                type="submit"
                disabled={actionLoading}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Salvar Alterações CMS
              </button>
            </div>

            {/* Configurações básicas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className={labelCls}>Título do Módulo / Página</label>
                <input
                  type="text"
                  required
                  value={cmsConfig.title}
                  onChange={e => updateCmsField("title", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>Subtítulo do Hero</label>
                <input
                  type="text"
                  required
                  value={cmsConfig.subtitle}
                  onChange={e => updateCmsField("subtitle", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="md:col-span-3">
                <label className={labelCls}>Descrição / Apresentação</label>
                <textarea
                  rows={3}
                  value={cmsConfig.description || ""}
                  onChange={e => updateCmsField("description", e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>
            </div>

            {/* Imagem de Fundo e Paleta de Cores */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-4 border-t border-slate-100 dark:border-slate-700/60">
              <div className="md:col-span-2">
                <label className={labelCls}>URL da Imagem de Fundo (Hero)</label>
                <input
                  type="text"
                  value={cmsConfig.heroBgImage || ""}
                  onChange={e => updateCmsField("heroBgImage", e.target.value)}
                  placeholder="Deixe em branco para o fundo padrão degradê verde"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Cor Principal (Fundo)</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={cmsConfig.primaryColor}
                    onChange={e => updateCmsField("primaryColor", e.target.value)}
                    className="w-9 h-9 border border-slate-200 rounded-md cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={cmsConfig.primaryColor}
                    onChange={e => updateCmsField("primaryColor", e.target.value)}
                    className="font-mono text-xs border border-slate-200 rounded-md px-2 py-1.5 w-24 bg-transparent"
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Cor Secundária (Destaques/Ouro)</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="color"
                    value={cmsConfig.secondaryColor}
                    onChange={e => updateCmsField("secondaryColor", e.target.value)}
                    className="w-9 h-9 border border-slate-200 rounded-md cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={cmsConfig.secondaryColor}
                    onChange={e => updateCmsField("secondaryColor", e.target.value)}
                    className="font-mono text-xs border border-slate-200 rounded-md px-2 py-1.5 w-24 bg-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Botões do Hero */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-3">Botões de Ação do Hero</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 border border-slate-100 dark:border-slate-700/60 rounded-xl space-y-3">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 block uppercase">Botão Principal (CTA)</span>
                  <div className="space-y-2">
                    <div>
                      <label className={labelCls}>Texto</label>
                      <input
                        type="text"
                        value={cmsConfig.buttonsConfig?.secondaryLabel || ""}
                        onChange={e => updateNestedCmsField("buttonsConfig", "secondaryLabel", e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Link (Âncora/URL)</label>
                      <input
                        type="text"
                        value={cmsConfig.buttonsConfig?.secondaryLink || ""}
                        onChange={e => updateNestedCmsField("buttonsConfig", "secondaryLink", e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 border border-slate-100 dark:border-slate-700/60 rounded-xl space-y-3">
                  <span className="text-[10px] font-bold text-slate-500 block uppercase">Botão Secundário</span>
                  <div className="space-y-2">
                    <div>
                      <label className={labelCls}>Texto</label>
                      <input
                        type="text"
                        value={cmsConfig.buttonsConfig?.primaryLabel || ""}
                        onChange={e => updateNestedCmsField("buttonsConfig", "primaryLabel", e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Link (Âncora/URL)</label>
                      <input
                        type="text"
                        value={cmsConfig.buttonsConfig?.primaryLink || ""}
                        onChange={e => updateNestedCmsField("buttonsConfig", "primaryLink", e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Hero Cards (Carrossel de Apresentação) */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">Carrossel de Apresentação (Cards de Destaque)</h4>
                <button
                  type="button"
                  onClick={openNewCard}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Card
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(cmsConfig.heroCards || []).map((card, i) => (
                  <div key={i} className="p-4 border border-slate-100 dark:border-slate-700/60 rounded-xl bg-slate-50 dark:bg-slate-900/30 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Card {i + 1}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditCard(i)}
                            className="p-1 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                            title="Editar Card"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCard(i)}
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                            title="Excluir Card"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <h5 className="font-bold text-sm text-slate-900 dark:text-white mt-1">{card.title}</h5>
                      {card.subtitle && <p className="text-xs text-slate-400 font-light mt-0.5">{card.subtitle}</p>}
                    </div>
                    {card.image && (
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 bg-slate-100 dark:bg-slate-900/50 p-1.5 rounded truncate">
                        <span>Imagem: {card.image}</span>
                      </div>
                    )}
                  </div>
                ))}
                {(cmsConfig.heroCards || []).length === 0 && (
                  <div className="md:col-span-3 text-center py-6 text-slate-400 dark:text-slate-500 text-xs italic bg-slate-50/50 dark:bg-slate-900/10 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    Nenhum card de apresentação cadastrado.
                  </div>
                )}
              </div>
            </div>

            {/* Testemunhos (Carrossel de Testemunhos) */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-700/60">
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">Carrossel de Testemunhos</h4>
                <button
                  type="button"
                  onClick={openNewTestimonial}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Testemunho
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {(cmsConfig.testimonyVideos || []).map((test, i) => (
                  <div key={i} className="p-4 border border-slate-100 dark:border-slate-700/60 rounded-xl bg-slate-50/50 dark:bg-slate-900/20 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Testemunho {i + 1}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditTestimonial(i)}
                            className="p-1 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                            title="Editar Testemunho"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteTestimonial(i)}
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                            title="Excluir Testemunho"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <h5 className="font-bold text-sm text-slate-900 dark:text-white mt-1">{test.name}</h5>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-light mt-1 italic line-clamp-3">"{test.quote}"</p>
                    </div>
                    <div className="flex flex-col gap-1">
                      {test.imageUrl && (
                        <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate bg-slate-100 dark:bg-slate-900/50 px-1.5 py-0.5 rounded">
                          Capa: {test.imageUrl}
                        </div>
                      )}
                      {test.videoUrl && (
                        <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate bg-slate-100 dark:bg-slate-900/50 px-1.5 py-0.5 rounded">
                          Vídeo: {test.videoUrl}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {(cmsConfig.testimonyVideos || []).length === 0 && (
                  <div className="sm:col-span-2 lg:col-span-4 text-center py-6 text-slate-400 dark:text-slate-500 text-xs italic bg-slate-50/50 dark:bg-slate-900/10 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    Nenhum testemunho cadastrado.
                  </div>
                )}
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ── MODAL CRUD: EVENTO ── */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-full max-w-lg rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/40">
              <h3 className="font-bold text-base text-slate-950 dark:text-white">
                {editingEvent ? "Editar Encontro" : "Agendar Novo Encontro"}
              </h3>
              <button
                onClick={() => setShowEventModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={saveEvent} className="p-6 overflow-y-auto space-y-4 text-xs font-sans">
              <div className="space-y-1">
                <label className={labelCls}>Título do Evento *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Peniel Campinas 2026"
                  value={eventForm.title}
                  onChange={e => setEventForm({ ...eventForm, title: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={labelCls}>Data de Início *</label>
                  <input
                    type="date"
                    required
                    value={eventForm.date}
                    onChange={e => setEventForm({ ...eventForm, date: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Horário de Início *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: 19h00"
                    value={eventForm.time}
                    onChange={e => setEventForm({ ...eventForm, time: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className={labelCls}>Período / Rótulo de Data (Ex: 12, 13 e 14 de Junho)</label>
                <input
                  type="text"
                  placeholder="Ex: 12, 13 e 14 de Junho (deixe em branco para usar a data acima)"
                  value={eventForm.dateLabel}
                  onChange={e => setEventForm({ ...eventForm, dateLabel: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={labelCls}>Valor da Inscrição (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={eventForm.value}
                    onChange={e => setEventForm({ ...eventForm, value: Number(e.target.value) })}
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Limite de Participantes *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={eventForm.limit}
                    onChange={e => setEventForm({ ...eventForm, limit: Number(e.target.value) })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={labelCls}>Local de Saída / Encontro</label>
                  <input
                    type="text"
                    placeholder="Ex: Catedral AD Campinas"
                    value={eventForm.departureLocation}
                    onChange={e => setEventForm({ ...eventForm, departureLocation: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Endereço do Local do Evento *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Chácara AD Campinas, Valinhos - SP"
                    value={eventForm.location}
                    onChange={e => setEventForm({ ...eventForm, location: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={labelCls}>Coordenada Latitude (Google Maps)</label>
                  <input
                    type="text"
                    placeholder="Ex: -22.9068"
                    value={eventForm.latitude}
                    onChange={e => setEventForm({ ...eventForm, latitude: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Coordenada Longitude (Google Maps)</label>
                  <input
                    type="text"
                    placeholder="Ex: -47.0616"
                    value={eventForm.longitude}
                    onChange={e => setEventForm({ ...eventForm, longitude: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className={labelCls}>Status</label>
                <select
                  value={eventForm.status}
                  onChange={e => setEventForm({ ...eventForm, status: e.target.value })}
                  className={selectCls}
                >
                  <option value="active">Ativo (visível no site)</option>
                  <option value="inactive">Inativo (arquivado)</option>
                </select>
              </div>

              <label className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-lg p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={eventForm.isFeatured || false}
                  onChange={e => setEventForm({ ...eventForm, isFeatured: e.target.checked })}
                  className="w-4 h-4 mt-0.5 accent-amber-500"
                />
                <div>
                  <span className="block text-sm font-semibold text-slate-800 dark:text-amber-200">Marcar como Encontro em Destaque</span>
                  <span className="block text-xs text-slate-500 dark:text-amber-300/60 mt-0.5">
                    Aparece como o card grande no topo da agenda do site. Apenas um evento fica em destaque por vez.
                  </span>
                </div>
              </label>

              <div className="space-y-1">
                <label className={labelCls}>Link de Pagamento (TON / outro)</label>
                <input
                  type="url"
                  placeholder="https://... (link de cobrança do evento)"
                  value={eventForm.paymentLink}
                  onChange={e => setEventForm({ ...eventForm, paymentLink: e.target.value })}
                  className={inputCls}
                />
                <p className="text-[11px] text-slate-400">Exibido ao inscrito após preencher a ficha, para efetuar o pagamento.</p>
              </div>

              <div className="space-y-1">
                <label className={labelCls}>Descrição Curta (Opcional)</label>
                <textarea
                  rows={2}
                  value={eventForm.description}
                  onChange={e => setEventForm({ ...eventForm, description: e.target.value })}
                  placeholder="Instruções e avisos sobre o encontro..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>

              <div className="space-y-2 border-t border-slate-100 dark:border-slate-700/60 pt-3">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Habilitar Campos Extra no Formulário</label>
                <div className="space-y-2 bg-slate-50 dark:bg-slate-900/30 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-350 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={eventForm.extraFieldsConfig?.spouse || false}
                      onChange={e => setEventForm({
                        ...eventForm,
                        extraFieldsConfig: { ...eventForm.extraFieldsConfig, spouse: e.target.checked }
                      })}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Pedir informações do Cônjuge (Nome do Cônjuge)</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-350 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={eventForm.extraFieldsConfig?.children || false}
                      onChange={e => setEventForm({
                        ...eventForm,
                        extraFieldsConfig: { ...eventForm.extraFieldsConfig, children: e.target.checked }
                      })}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Pedir informações dos Filhos (Nome, Idade e Quantidade)</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-350 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={eventForm.extraFieldsConfig?.ecclesiastical || false}
                      onChange={e => setEventForm({
                        ...eventForm,
                        extraFieldsConfig: { ...eventForm.extraFieldsConfig, ecclesiastical: e.target.checked }
                      })}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Pedir Congregação e Cargo Eclesiástico</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar Encontro
                </button>
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL CRUD: CARD CMS ── */}
      {showCardModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-full max-w-lg rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/40">
              <h3 className="font-bold text-base text-slate-950 dark:text-white">
                {editingCardIndex !== null ? "Editar Card de Apresentação" : "Adicionar Card de Apresentação"}
              </h3>
              <button
                onClick={() => setShowCardModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={saveCard} className="p-6 overflow-y-auto space-y-4 text-xs font-sans">
              <div className="space-y-1">
                <label className={labelCls}>Título do Card *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Encontros que transformam vidas"
                  value={cardForm.title}
                  onChange={e => setCardForm({ ...cardForm, title: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div className="space-y-1">
                <label className={labelCls}>Subtítulo / Rótulo Curto (Ex: Experiência 1)</label>
                <input
                  type="text"
                  placeholder="Ex: Experiência 1"
                  value={cardForm.subtitle || ""}
                  onChange={e => setCardForm({ ...cardForm, subtitle: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div className="space-y-1">
                <label className={labelCls}>Imagem de Fundo (Foto/Capa)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ex: https://link-da-imagem.jpg"
                    value={cardForm.image || ""}
                    onChange={e => setCardForm({ ...cardForm, image: e.target.value })}
                    className={inputCls}
                  />
                  <input
                    ref={cardFileRef}
                    type="file"
                    accept="image/*"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        await handleUploadImage(file, url => setCardForm(prev => ({ ...prev, image: url })));
                      }
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => cardFileRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-650 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Upload
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className={labelCls}>URL do Vídeo (Opcional - YouTube, Vimeo ou direto)</label>
                <input
                  type="text"
                  placeholder="Ex: https://www.youtube.com/watch?v=..."
                  value={cardForm.videoUrl || ""}
                  onChange={e => setCardForm({ ...cardForm, videoUrl: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className={labelCls}>Texto do Botão (Ex: Ler Mais)</label>
                  <input
                    type="text"
                    placeholder="Ex: Ler Mais"
                    value={cardForm.buttonText || ""}
                    onChange={e => setCardForm({ ...cardForm, buttonText: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Link do Botão (Ex: #testemunhos)</label>
                  <input
                    type="text"
                    placeholder="Ex: #testemunhos"
                    value={cardForm.buttonLink || ""}
                    onChange={e => setCardForm({ ...cardForm, buttonLink: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Salvar Card
                </button>
                <button
                  type="button"
                  onClick={() => setShowCardModal(false)}
                  className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL CRUD: TESTEMUNHO CMS ── */}
      {showTestimonialModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-full max-w-lg rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/40">
              <h3 className="font-bold text-base text-slate-950 dark:text-white">
                {editingTestimonialIndex !== null ? "Editar Depoimento / Testemunho" : "Adicionar Depoimento / Testemunho"}
              </h3>
              <button
                onClick={() => setShowTestimonialModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={saveTestimonial} className="p-6 overflow-y-auto space-y-4 text-xs font-sans">
              <div className="space-y-1">
                <label className={labelCls}>Nome da Pessoa *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Juliana R."
                  value={testimonialForm.name}
                  onChange={e => setTestimonialForm({ ...testimonialForm, name: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div className="space-y-1">
                <label className={labelCls}>Citação / Depoimento *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Ex: O Peniel mudou a minha história..."
                  value={testimonialForm.quote}
                  onChange={e => setTestimonialForm({ ...testimonialForm, quote: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>

              <div className="space-y-1">
                <label className={labelCls}>Imagem de Fundo (Foto/Capa)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Ex: https://link-da-imagem.jpg"
                    value={testimonialForm.imageUrl || ""}
                    onChange={e => setTestimonialForm({ ...testimonialForm, imageUrl: e.target.value })}
                    className={inputCls}
                  />
                  <input
                    ref={testimonialFileRef}
                    type="file"
                    accept="image/*"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        await handleUploadImage(file, url => setTestimonialForm(prev => ({ ...prev, imageUrl: url })));
                      }
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => testimonialFileRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-105 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-650 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors disabled:opacity-50"
                  >
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    Upload
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className={labelCls}>URL do Vídeo (YouTube, Vimeo ou direto)</label>
                <input
                  type="text"
                  placeholder="Ex: https://www.youtube.com/watch?v=..."
                  value={testimonialForm.videoUrl || ""}
                  onChange={e => setTestimonialForm({ ...testimonialForm, videoUrl: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div className="flex gap-2 pt-4 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors"
                >
                  <Save className="w-4 h-4" />
                  Salvar Testemunho
                </button>
                <button
                  type="button"
                  onClick={() => setShowTestimonialModal(false)}
                  className="px-5 py-2.5 border border-slate-200 dark:border-slate-700 rounded-lg font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DRAWER: DETALHES DA FICHA DE INSCRIÇÃO ── */}
      {selectedRegistration && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full flex flex-col shadow-2xl overflow-hidden">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/40">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Ficha de Inscrição Completa</h3>
                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 block mt-0.5 uppercase tracking-wide">
                  Protocolo: {selectedRegistration.id.slice(0, 8).toUpperCase()}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={printFicha}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" /> Imprimir
                </button>
                <button
                  onClick={() => (editingReg ? setEditingReg(false) : openEditReg())}
                  className="px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase bg-emerald-600 hover:bg-emerald-700 text-white inline-flex items-center gap-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" /> {editingReg ? "Cancelar edição" : "Editar"}
                </button>
                <button
                  onClick={() => { setSelectedRegistration(null); setEditingReg(false); }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs text-slate-700 dark:text-slate-300">
              {/* Status Banner */}
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                selectedRegistration.status === "inscrito" ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300" :
                selectedRegistration.status === "fila_espera" ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300" :
                "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
              }`}>
                <div>
                  <p className="font-bold text-xs uppercase leading-none">Status da Inscrição</p>
                  <p className="text-sm font-black mt-1">
                    {selectedRegistration.status === "inscrito" ? "Confirmado no Encontro" : selectedRegistration.status === "fila_espera" ? "Fila de Espera" : "Cancelada"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {selectedRegistration.status === "fila_espera" && (
                    <button
                      onClick={() => changeRegistrationStatus(selectedRegistration.id, "inscrito")}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg uppercase text-[10px]"
                    >
                      Aprovar Vaga
                    </button>
                  )}
                  {selectedRegistration.status === "inscrito" && (
                    <button
                      onClick={() => changeRegistrationStatus(selectedRegistration.id, "cancelado")}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg uppercase text-[10px]"
                    >
                      Cancelar Ficha
                    </button>
                  )}
                  {selectedRegistration.status === "cancelado" && (
                    <button
                      onClick={() => changeRegistrationStatus(selectedRegistration.id, "inscrito")}
                      className="px-3 py-1.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 text-white font-bold rounded-lg uppercase text-[10px]"
                    >
                      Reativar Ficha
                    </button>
                  )}
                </div>
              </div>

              {/* Painel de edição da ficha */}
              {editingReg && (
                <div className="p-4 rounded-xl border-2 border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-3">
                  <p className="font-bold text-xs uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Editar dados do inscrito</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className={labelCls}>Nome Completo</label>
                      <input className={inputCls} value={editForm.nome || ""} onChange={e => setEditForm({ ...editForm, nome: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Celular / WhatsApp</label>
                      <input className={inputCls} value={editForm.celular || ""} onChange={e => setEditForm({ ...editForm, celular: maskPhone(e.target.value) })} placeholder="(19) 99999-9999" />
                    </div>
                    <div>
                      <label className={labelCls}>Igreja Base</label>
                      <input className={inputCls} value={editForm.igrejaBase || ""} onChange={e => setEditForm({ ...editForm, igrejaBase: e.target.value })} />
                    </div>
                    <div className="col-span-2">
                      <label className={labelCls}>Endereço</label>
                      <input className={inputCls} value={editForm.endereco || ""} onChange={e => setEditForm({ ...editForm, endereco: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Data Nascimento</label>
                      <input type="date" className={inputCls} value={editForm.dataNascimento || ""} onChange={e => setEditForm({ ...editForm, dataNascimento: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Idade</label>
                      <input type="number" className={inputCls} value={editForm.idade || ""} onChange={e => setEditForm({ ...editForm, idade: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Estado Civil</label>
                      <select className={selectCls} value={editForm.estadoCivil || "Solteiro"} onChange={e => setEditForm({ ...editForm, estadoCivil: e.target.value })}>
                        <option>Solteiro</option><option>Casado</option><option>Divorciado</option><option>Viúvo</option><option>Outro</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={saveEditReg} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs inline-flex items-center justify-center gap-1.5">
                      <Save className="w-3.5 h-3.5" /> Salvar alterações
                    </button>
                    <button onClick={() => setEditingReg(false)} className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold">Cancelar</button>
                  </div>
                </div>
              )}

              {/* Ingresso / Check-in */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-bold text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Código do Ingresso (Check-in)</p>
                  <p className="text-lg font-black font-mono tracking-widest text-slate-900 dark:text-white mt-0.5">
                    {selectedRegistration.checkInCode || "—"}
                  </p>
                  <p className="text-[11px] mt-1">
                    {selectedRegistration.checkedIn
                      ? <span className="text-teal-600 dark:text-teal-400 font-semibold inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Presente · check-in em {selectedRegistration.checkedInAt ? new Date(selectedRegistration.checkedInAt).toLocaleString("pt-BR") : ""}</span>
                      : <span className="text-slate-400">Ainda não fez check-in</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {selectedRegistration.qrCodeUrl && (
                    <img src={selectedRegistration.qrCodeUrl} alt="QR Code" className="w-20 h-20 rounded-lg border border-slate-200 dark:border-slate-700 bg-white" />
                  )}
                  {selectedRegistration.status === "inscrito" && (
                    <button
                      onClick={() => resendQrCode(selectedRegistration.id)}
                      disabled={resendingId === selectedRegistration.id}
                      className="px-3 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-bold rounded-lg uppercase text-[10px] inline-flex items-center gap-1.5"
                    >
                      <QrCode className="w-3.5 h-3.5" /> {resendingId === selectedRegistration.id ? "Enviando..." : "Reenviar QR"}
                    </button>
                  )}
                </div>
              </div>

              {/* Pagamento */}
              {selectedRegistration.paymentStatus !== "gratuito" && (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Pagamento</p>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      selectedRegistration.paymentStatus === "pago" ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400" :
                      selectedRegistration.paymentStatus === "comprovante_enviado" ? "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400" :
                      "bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400"
                    }`}>
                      {selectedRegistration.paymentStatus === "pago" ? "Pago" : selectedRegistration.paymentStatus === "comprovante_enviado" ? "Comprovante enviado" : "Pendente"}
                    </span>
                  </div>
                  {selectedRegistration.paymentPromiseDate && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Promessa de pagamento: <b>{new Date(selectedRegistration.paymentPromiseDate).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</b></p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    {selectedRegistration.paymentProofUrl ? (
                      <a href={selectedRegistration.paymentProofUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg text-[10px] font-bold uppercase inline-flex items-center gap-1.5">
                        <Paperclip className="w-3.5 h-3.5" /> Ver comprovante
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-400">Sem comprovante anexado.</span>
                    )}
                    {selectedRegistration.paymentStatus !== "pago" && (
                      <>
                        <button
                          onClick={() => confirmPayment(selectedRegistration.id)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold uppercase inline-flex items-center gap-1.5"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Confirmar pagamento
                        </button>
                        <button
                          onClick={() => remindPayment(selectedRegistration.id)}
                          disabled={remindingId === selectedRegistration.id}
                          className="px-3 py-1.5 bg-amber-100 dark:bg-amber-950/40 hover:bg-amber-200 text-amber-700 dark:text-amber-400 rounded-lg text-[10px] font-bold uppercase inline-flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <Phone className="w-3.5 h-3.5" /> {remindingId === selectedRegistration.id ? "..." : "Lembrar pagamento"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* 1. Dados Pessoais */}
              <div className="space-y-3 border-b border-slate-100 dark:border-slate-800 pb-5">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400">1. Dados Pessoais</h4>
                <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Nome Completo:</span>
                    <span className="font-semibold text-slate-900 dark:text-white text-sm">{selectedRegistration.nome}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Tipo de Ficha:</span>
                    <span className="font-semibold text-slate-900 dark:text-white capitalize">{selectedRegistration.tipoParticipante}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Data de Nascimento:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {new Date(selectedRegistration.dataNascimento).toLocaleDateString("pt-BR", { timeZone: "UTC" })} ({selectedRegistration.idade} anos)
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Estado Civil:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{selectedRegistration.estadoCivil}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Celular / WhatsApp:</span>
                    <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {selectedRegistration.celular}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Endereço:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">{selectedRegistration.endereco}</span>
                  </div>
                </div>
              </div>

              {/* 2. Eclesiástico */}
              <div className="space-y-3 border-b border-slate-100 dark:border-slate-800 pb-5">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400">2. Informações Eclesiásticas</h4>
                <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Igreja Base / Denominação:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedRegistration.igrejaBase}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Batizado nas Águas?</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedRegistration.batizadoAguas ? "Sim" : "Não"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Participa de Grupo Familiar (Célula)?</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedRegistration.participaGrupoFamiliar ? `Sim (${selectedRegistration.grupoFamiliarQual || ""})` : "Não"}
                    </span>
                  </div>
                  {selectedRegistration.participaGrupoFamiliar && (
                    <div>
                      <span className="text-slate-400 block text-[10px]">Nome do Líder do GF:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedRegistration.nomeLider || ""}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Motivação e Expectativas */}
              <div className="space-y-3 border-b border-slate-100 dark:border-slate-800 pb-5">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400">3. Perguntas Motivacionais</h4>
                <div className="space-y-3">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Quem o motivou a participar do Encontro Peniel?</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 block mt-0.5">{selectedRegistration.quemMotivou}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Por que você tomou a decisão de ir ao Encontro?</span>
                    <p className="text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-100 dark:border-slate-850 mt-1 leading-relaxed whitespace-pre-line">
                      {selectedRegistration.porqueDecidiu}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Quais são suas reais expectativas para o encontro?</span>
                    <p className="text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-100 dark:border-slate-850 mt-1 leading-relaxed whitespace-pre-line">
                      {selectedRegistration.expectativas}
                    </p>
                  </div>
                </div>
              </div>

              {/* 4. Saúde e Dados Físicos */}
              <div className="space-y-3 border-b border-slate-100 dark:border-slate-800 pb-5">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400">4. Informações de Saúde e Físicas</h4>
                <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Peso corporal (kg):</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{Number(selectedRegistration.peso).toFixed(1)} kg</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Altura (m):</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{Number(selectedRegistration.altura).toFixed(2)} m</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[10px]">Faz uso contínuo de algum medicamento?</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 block mt-0.5">
                      {selectedRegistration.medicamentos || "Não, nenhum medicamento em uso"}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-400 block text-[10px]">Restrições alimentares ou alergias médicas?</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 block mt-0.5 text-rose-600 dark:text-rose-400">
                      {selectedRegistration.alergiasRestricoes || "Não, sem alergias ou restrições alimentares declaradas"}
                    </span>
                  </div>
                  {(() => {
                    let extra: any = {};
                    try { extra = typeof selectedRegistration.additionalFields === "string" ? JSON.parse(selectedRegistration.additionalFields) : (selectedRegistration.additionalFields || {}); } catch {}
                    if (!extra.apneia) return null;
                    return (
                      <div>
                        <span className="text-slate-400 block text-[10px]">Tem Apnéia (ronca)?</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200 capitalize">{extra.apneia === "sim" ? "Sim" : "Não"}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* 5. Contatos de Emergência */}
              <div className="space-y-3 border-b border-slate-100 dark:border-slate-800 pb-5">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400">5. Contatos Mais Importantes (Emergência)</h4>
                <div className="space-y-2.5">
                  {Array.isArray(selectedRegistration.importantContacts) && selectedRegistration.importantContacts.length > 0 ? (
                    selectedRegistration.importantContacts.map((contact, i) => (
                      <div key={i} className="p-3 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-950/20 flex justify-between items-center text-xs">
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-200">{contact.nome}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">Parentesco: {contact.parentesco} · Relação: {contact.relacao}</div>
                        </div>
                        <div className="font-medium text-slate-700 dark:text-slate-350">{contact.whatsapp}</div>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400 text-xs italic">Nenhum contato cadastrado.</p>
                  )}
                </div>
              </div>

              {/* 6. Campos Extra (Se preenchidos) */}
              {selectedRegistration.additionalFields && (
                (() => {
                  let extra: any = {};
                  try {
                    extra = typeof selectedRegistration.additionalFields === "string" 
                      ? JSON.parse(selectedRegistration.additionalFields) 
                      : selectedRegistration.additionalFields;
                  } catch (e) {
                    console.error(e);
                  }
                  
                  const hasSpouse = extra.spouseName;
                  const hasChildren = extra.hasChildren !== undefined || extra.childrenDetails;
                  const hasEcc = extra.ecclesiasticalCongregation || extra.ecclesiasticalCargo;

                  if (!hasSpouse && !hasChildren && !hasEcc) return null;

                  return (
                    <div className="space-y-3">
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400">6. Informações Adicionais (Extra)</h4>
                      <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                        {extra.spouseName && (
                          <div className="col-span-2">
                            <span className="text-slate-400 block text-[10px]">Nome do Cônjuge:</span>
                            <span className="font-semibold text-slate-900 dark:text-white">{extra.spouseName}</span>
                          </div>
                        )}
                        {hasChildren && (
                          <div className="col-span-2">
                            <span className="text-slate-400 block text-[10px]">Tem filhos? Nomes/Idades:</span>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {extra.hasChildren ? `Sim - ${extra.childrenDetails || "Nenhum detalhe informado"}` : "Não possui filhos"}
                            </span>
                          </div>
                        )}
                        {extra.ecclesiasticalCongregation && (
                          <div>
                            <span className="text-slate-400 block text-[10px]">Congregação:</span>
                            <span className="font-semibold text-slate-900 dark:text-white">{extra.ecclesiasticalCongregation}</span>
                          </div>
                        )}
                        {extra.ecclesiasticalCargo && (
                          <div>
                            <span className="text-slate-400 block text-[10px]">Cargo Eclesiástico:</span>
                            <span className="font-semibold text-slate-900 dark:text-white">{extra.ecclesiasticalCargo}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex gap-3">
              <button
                onClick={() => deleteRegistration(selectedRegistration.id)}
                className="flex items-center gap-1.5 px-4 py-2 border border-rose-200 text-rose-700 dark:border-rose-900/60 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg text-xs font-semibold transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Excluir Inscrição
              </button>
              <button
                onClick={() => setSelectedRegistration(null)}
                className="ml-auto px-4 py-2 bg-slate-900 text-white dark:bg-slate-700 hover:bg-slate-800 rounded-lg text-xs font-bold transition-colors"
              >
                Fechar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CUSTOM CONFIRMATION MODAL ── */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-full max-w-sm rounded-xl overflow-hidden shadow-2xl p-6 text-center space-y-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${confirmModal.isDanger ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400'}`}>
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-950 dark:text-white">
              {confirmModal.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-sans">
              {confirmModal.message}
            </p>
            <div className="flex gap-2 pt-2 justify-center">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
              >
                {confirmModal.cancelText || "Cancelar"}
              </button>
              <button
                type="button"
                onClick={confirmModal.onConfirm}
                className={`px-4 py-2 rounded-lg text-xs font-semibold text-white transition-colors ${confirmModal.isDanger ? 'bg-red-600 hover:bg-red-750' : 'bg-emerald-600 hover:bg-emerald-700'}`}
              >
                {confirmModal.confirmText || "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Inline fallback for Hourglass since it is named differently in some older Lucide packs
function HourglassIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M5 2h14" />
      <path d="M5 22h14" />
      <path d="M19 2v4c0 1.38-1.13 2.5-2.5 3L12 12l4.5 3c1.37.5 2.5 1.62 2.5 3v4" />
      <path d="M12 12 7.5 9C6.13 8.5 5 7.38 5 6V2" />
      <path d="M5 22v-4c0-1.38 1.13-2.5 2.5-3L12 12" />
    </svg>
  );
}
