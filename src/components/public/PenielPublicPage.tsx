"use client";

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  Flame, Calendar, MapPin, Clock, ArrowRight, X, Sparkles, Check, CheckCircle2,
  FileText, Download, Users, Phone, ShieldAlert, Heart, Activity, User, BookOpen, Volume2, Bird,
  ArrowLeft, Paperclip, CreditCard, Search, Loader2, Ticket, QrCode
} from "lucide-react";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";

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
  description: string;
  totalInscritos: number;
  vagasDisponiveis: number;
  filaEspera: number;
  dateLabel?: string | null;
  departureLocation?: string | null;
  eventLocation?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  extraFieldsConfig?: any | null;
  paymentLink?: string | null;
}

interface PenielConfig {
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
  testimonyVideos: Array<{ name: string; quote: string; videoUrl?: string; imageUrl?: string }>;
}

export function PenielPublicPage() {
  const navigate = useNavigate();

  // State
  const [config, setConfig] = useState<PenielConfig | null>(null);
  const [events, setEvents] = useState<PenielEvent[]>([]);
  const [loading, setLoading] = useState(true);
  // Tema seguido da home (mrm_public_theme): true = escuro (padrão)
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("mrm_public_theme") : null;
    if (saved) setDark(saved !== "light");
  }, []);
  const [selectedEvent, setSelectedEvent] = useState<PenielEvent | null>(null);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [activeTestimony, setActiveTestimony] = useState<{ name: string; quote: string } | null>(null);

  // Form States
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  // Multi-step + pagamento
  const [formStep, setFormStep] = useState<1 | 2>(1);
  const [paymentPromiseDate, setPaymentPromiseDate] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [proofFileName, setProofFileName] = useState("");
  const [proofUploading, setProofUploading] = useState(false);
  const proofInputRef = useRef<HTMLInputElement>(null);
  const lookupProofRef = useRef<HTMLInputElement>(null);

  // Consultar inscrição (hero)
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupCode, setLookupCode] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [lookupData, setLookupData] = useState<any | null>(null);
  const [lookupProofUploading, setLookupProofUploading] = useState(false);
  const [lookupResending, setLookupResending] = useState(false);
  const [lookupInfo, setLookupInfo] = useState("");

  // Waitlist confirmation modal
  const [waitlistPromptOpen, setWaitlistPromptOpen] = useState(false);

  // Success Modal
  const [successData, setSuccessData] = useState<any | null>(null);

  // Fields
  // Drawer é exclusivo para Encontristas — tipo fixo.
  const [tipoParticipante] = useState<"encontrista" | "encontreiro">("encontrista");
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [estadoCivil, setEstadoCivil] = useState("Solteiro");
  const [idade, setIdade] = useState("");
  const [celular, setCelular] = useState("");
  const [igrejaBase, setIgrejaBase] = useState("");
  const [batizadoAguas, setBatizadoAguas] = useState(false);
  const [participaGrupoFamiliar, setParticipaGrupoFamiliar] = useState(false);
  const [grupoFamiliarQual, setGrupoFamiliarQual] = useState("");
  const [nomeLider, setNomeLider] = useState("");
  const [quemMotivou, setQuemMotivou] = useState("");
  const [porqueDecidiu, setPorqueDecidiu] = useState("");
  const [expectativas, setExpectativas] = useState("");
  const [peso, setPeso] = useState("");
  const [altura, setAltura] = useState("");
  const [medicamentos, setMedicamentos] = useState("");
  const [alergiasRestricoes, setAlergiasRestricoes] = useState("");
  const [apneia, setApneia] = useState<"" | "sim" | "nao">("");

  // Extra/Conditional config fields states
  const [spouseName, setSpouseName] = useState("");
  const [hasChildren, setHasChildren] = useState(false);
  const [childrenDetails, setChildrenDetails] = useState("");
  const [ecclesiasticalCongregation, setEcclesiasticalCongregation] = useState("");
  const [ecclesiasticalCargo, setEcclesiasticalCargo] = useState("");

  // 5 Important contacts
  const [contacts, setContacts] = useState<Array<{ nome: string; parentesco: string; whatsapp: string; relacao: string }>>([
    { nome: "", parentesco: "", whatsapp: "", relacao: "" },
    { nome: "", parentesco: "", whatsapp: "", relacao: "" },
    { nome: "", parentesco: "", whatsapp: "", relacao: "" },
    { nome: "", parentesco: "", whatsapp: "", relacao: "" },
    { nome: "", parentesco: "", whatsapp: "", relacao: "" }
  ]);

  // Load configuration and active events
  useEffect(() => {
    async function loadData() {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const campoId = urlParams.get("campoId") || "";
        const configUrl = campoId ? `/api/peniel/config?campoId=${campoId}` : "/api/peniel/config";
        const eventsUrl = campoId ? `/api/peniel/events?futureOnly=true&campoId=${campoId}` : "/api/peniel/events?futureOnly=true";

        const [configRes, eventsRes] = await Promise.all([
          fetch(configUrl),
          fetch(eventsUrl)
        ]);

        if (configRes.ok) {
          const configData = await configRes.json();
          setConfig(configData);
        }
        if (eventsRes.ok) {
          const eventsData = await eventsRes.json();
          setEvents(eventsData);
        }
      } catch (err) {
        console.error("Erro ao carregar dados do Peniel:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (!config?.heroCards?.length) return;
    const interval = setInterval(() => {
      setActiveCardIndex(prev => (prev + 1) % config.heroCards.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [config?.heroCards]);

  const getEmbedUrl = (url: string) => {
    if (!url) return "";
    if (url.includes("youtube.com/watch")) {
      try {
        const videoId = new URL(url).searchParams.get("v");
        return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
      } catch (e) {
        return url;
      }
    }
    if (url.includes("youtu.be/")) {
      const parts = url.split("youtu.be/");
      const videoId = parts[1]?.split("?")[0];
      return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
    }
    if (url.includes("vimeo.com/")) {
      const parts = url.split("vimeo.com/");
      const videoId = parts[1]?.split("?")[0];
      return `https://player.vimeo.com/video/${videoId}?autoplay=1`;
    }
    return url;
  };

  const handleOpenForm = (event: PenielEvent) => {
    setSelectedEvent(event);
    setErrorMsg("");
    setFormStep(1);
    setPaymentPromiseDate("");
    setProofUrl("");
    setProofFileName("");
    setFormOpen(true);
  };

  // Upload do comprovante (etapa de pagamento do drawer)
  const handleProofUpload = async (file: File, onDone: (url: string, name: string) => void, setBusy: (b: boolean) => void) => {
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/peniel/upload-proof", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha no upload");
      onDone(json.url, file.name);
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao enviar o comprovante.");
    } finally {
      setBusy(false);
    }
  };

  // Consultar inscrição pelo código (hero)
  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const code = lookupCode.trim().toUpperCase();
    if (!code) return;
    setLookupLoading(true);
    setLookupError("");
    setLookupInfo("");
    setLookupData(null);
    try {
      const res = await fetch(`/api/peniel/registrations/lookup?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok) { setLookupError(data.error || "Inscrição não encontrada."); }
      else setLookupData(data);
    } catch {
      setLookupError("Erro de conexão. Tente novamente.");
    } finally {
      setLookupLoading(false);
    }
  };

  const handleLookupProofUpload = async (file: File) => {
    if (!file || !lookupData) return;
    await handleProofUpload(file, async (url) => {
      const res = await fetch("/api/peniel/registrations/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: lookupData.code, proofUrl: url })
      });
      if (res.ok) setLookupData({ ...lookupData, hasProof: true, paymentProofUrl: url, paymentStatus: "comprovante_enviado" });
    }, setLookupProofUploading);
  };

  const handleLookupResend = async () => {
    if (!lookupData) return;
    setLookupResending(true);
    setLookupInfo("");
    setLookupError("");
    try {
      const res = await fetch("/api/peniel/registrations/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: lookupData.code, action: "resend" })
      });
      if (res.ok) setLookupInfo("QR Code reenviado para o seu WhatsApp!");
      else { const d = await res.json().catch(() => ({})); setLookupError(d.error || "Não foi possível reenviar agora."); }
    } catch {
      setLookupError("Erro de conexão ao reenviar.");
    } finally {
      setLookupResending(false);
    }
  };

  // Máscara de celular brasileiro: (99) 99999-9999
  const maskPhone = (v: string) => {
    const d = (v || "").replace(/\D/g, "").slice(0, 11);
    if (d.length === 0) return "";
    if (d.length <= 2) return `(${d}`;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  const handleContactChange = (index: number, field: string, value: string) => {
    const next = [...contacts];
    next[index] = { ...next[index], [field]: value };
    setContacts(next);
  };

  // Etapa 1 -> 2 (validação HTML5 já rodou por ser submit). Eventos gratuitos
  // pulam a etapa de pagamento e enviam direto.
  const handleFormSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedEvent) return;
    if (formStep === 1) {
      if (Number(selectedEvent.value) === 0) {
        submitRegistration();
      } else {
        setFormStep(2);
        setErrorMsg("");
      }
    }
  };

  const submitRegistration = async (isWaitlistOverride = false) => {
    if (!selectedEvent) return;

    setErrorMsg("");
    setSubmitting(true);

    const payload = {
      eventId: selectedEvent.id,
      tipoParticipante,
      nome,
      endereco,
      dataNascimento,
      estadoCivil,
      idade: Number(idade),
      celular,
      igrejaBase,
      batizadoAguas,
      participaGrupoFamiliar,
      grupoFamiliarQual: participaGrupoFamiliar ? grupoFamiliarQual : "",
      nomeLider: participaGrupoFamiliar ? nomeLider : "",
      quemMotivou,
      porqueDecidiu,
      expectativas,
      peso: Number(peso),
      // Altura em metros. Se digitarem em cm (ex.: 180), converte para 1.80.
      altura: (() => { const a = Number(altura); return a >= 10 ? Math.round(a) / 100 : a; })(),
      medicamentos,
      alergiasRestricoes,
      importantContacts: contacts.filter(c => c.nome.trim() !== ""),
      forceWaitlist: isWaitlistOverride,
      paymentPromiseDate: paymentPromiseDate || null,
      paymentProofUrl: proofUrl || null,
      additionalFields: {
        spouseName,
        hasChildren,
        childrenDetails,
        ecclesiasticalCongregation,
        ecclesiasticalCargo,
        apneia
      }
    };

    try {
      const res = await fetch("/api/peniel/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.status === 409 && data.error === "no_vacancies") {
        setWaitlistPromptOpen(true);
      } else if (!res.ok) {
        setErrorMsg(data.error || "Ocorreu um erro ao enviar sua inscrição.");
      } else {
        // Success
        setSuccessData(data);
        setFormOpen(false);
        setWaitlistPromptOpen(false);
        resetForm();
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Erro de conexão ao enviar a inscrição.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormStep(1);
    setPaymentPromiseDate("");
    setProofUrl("");
    setProofFileName("");
    setNome("");
    setEndereco("");
    setDataNascimento("");
    setEstadoCivil("Solteiro");
    setIdade("");
    setCelular("");
    setIgrejaBase("");
    setBatizadoAguas(false);
    setParticipaGrupoFamiliar(false);
    setGrupoFamiliarQual("");
    setNomeLider("");
    setQuemMotivou("");
    setPorqueDecidiu("");
    setExpectativas("");
    setPeso("");
    setAltura("");
    setMedicamentos("");
    setAlergiasRestricoes("");
    setApneia("");
    setSpouseName("");
    setHasChildren(false);
    setChildrenDetails("");
    setEcclesiasticalCongregation("");
    setEcclesiasticalCargo("");
    setContacts([
      { nome: "", parentesco: "", whatsapp: "", relacao: "" },
      { nome: "", parentesco: "", whatsapp: "", relacao: "" },
      { nome: "", parentesco: "", whatsapp: "", relacao: "" },
      { nome: "", parentesco: "", whatsapp: "", relacao: "" },
      { nome: "", parentesco: "", whatsapp: "", relacao: "" }
    ]);
  };

  const handleDownloadPDF = async (arg?: any) => {
    const data = arg && !arg.nativeEvent ? arg : successData;
    if (!data) return;

    const doc = new jsPDF();

    // Background decoration
    doc.setFillColor(11, 40, 25); // #0b2819
    doc.rect(0, 0, 210, 35, "F");

    // Title AD Campinas / Peniel
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("PENIEL", 105, 18, { align: "center" });
    doc.setFontSize(10);
    doc.text("Sede AD Campinas", 105, 26, { align: "center" });

    // Document Body
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("COMPROVANTE DE INSCRIÇÃO", 105, 55, { align: "center" });

    // Event Info Card
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(15, 65, 180, 40, 3, 3, "F");
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(15, 65, 180, 40, 3, 3, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Encontro: ${data.event?.title || "Peniel"}`, 22, 75);
    doc.setFont("helvetica", "normal");
    const dateStr = new Date(data.event?.date || "").toLocaleDateString("pt-BR", { timeZone: "UTC" });
    doc.text(`Data: ${dateStr}`, 22, 82);
    doc.text(`Horário: ${data.event?.time || ""}`, 22, 89);
    doc.text(`Local: ${data.event?.location || ""}`, 22, 96);

    // Participant Box
    doc.setFont("helvetica", "bold");
    doc.text("DADOS DO INSCRITO", 15, 120);
    doc.line(15, 122, 195, 122);

    doc.setFont("helvetica", "normal");
    doc.text(`Protocolo: ${data.id.slice(0, 8).toUpperCase()}`, 15, 130);
    doc.text(`Nome: ${data.nome}`, 15, 137);
    doc.text(`Tipo: ${data.tipoParticipante === "encontrista" ? "Encontrista (Vai participar)" : "Encontreiro (Equipe de apoio)"}`, 15, 144);
    doc.text(`Celular: ${data.celular}`, 15, 151);
    doc.text(`Igreja Base: ${data.igrejaBase}`, 15, 158);

    let y = 158;
    if (data.additionalFields) {
      let extra: any = {};
      try {
        extra = typeof data.additionalFields === "string"
          ? JSON.parse(data.additionalFields)
          : data.additionalFields;
      } catch (e) {}

      if (extra.spouseName) {
        y += 7;
        doc.text(`Cônjuge: ${extra.spouseName}`, 15, y);
      }
      if (extra.hasChildren && extra.childrenDetails) {
        y += 7;
        doc.text(`Filhos: ${extra.childrenDetails}`, 15, y);
      }
      if (extra.ecclesiasticalCongregation) {
        y += 7;
        doc.text(`Congregação: ${extra.ecclesiasticalCongregation}`, 15, y);
      }
      if (extra.ecclesiasticalCargo) {
        y += 7;
        doc.text(`Cargo Eclesiástico: ${extra.ecclesiasticalCargo}`, 15, y);
      }
    }

    // Waitlist alert or Confirm message
    const alertY = y + 12;
    if (data.status === "fila_espera") {
      doc.setFillColor(254, 242, 242);
      doc.roundedRect(15, alertY, 180, 20, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setTextColor(220, 38, 38);
      doc.text("STATUS: FILA DE ESPERA", 105, alertY + 10, { align: "center" });
      doc.setFontSize(9);
      doc.text("As vagas principais esgotaram. Entraremos em contato caso ocorra alguma desistência.", 105, alertY + 15, { align: "center" });
    } else {
      doc.setFillColor(240, 253, 250);
      doc.roundedRect(15, alertY, 180, 20, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.setTextColor(13, 148, 136);
      doc.text("STATUS: INSCRIÇÃO CONFIRMADA", 105, alertY + 12, { align: "center" });
    }

    // QR Code do ingresso (somente confirmados)
    const code = data.checkInCode || data.code;
    if (data.status !== "fila_espera" && code) {
      try {
        const qrDataUrl = await QRCode.toDataURL(String(code), {
          width: 300, margin: 1, errorCorrectionLevel: "M",
          color: { dark: "#0b2819", light: "#ffffff" }
        });
        const qrY = alertY + 28;
        doc.addImage(qrDataUrl, "PNG", 80, qrY, 50, 50);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59);
        doc.text(`Código: ${code}`, 105, qrY + 58, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text("Apresente este QR Code (ou o código) no check-in do encontro.", 105, qrY + 64, { align: "center" });
      } catch (e) { /* ignora falha do QR */ }
    }

    // Footnote
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("Este comprovante foi gerado automaticamente pelo sistema SaasChurch.", 105, 285, { align: "center" });

    // Download PDF file
    doc.save(`comprovante-peniel-${data.nome.toLowerCase().replace(/\s+/g, "-")}.pdf`);
  };

  const primaryColor = config?.primaryColor || "#0b2819";
  const secondaryColor = config?.secondaryColor || "#d4af37";
  const accentColor = config?.accentColor || "#c5a880";

  // Paleta de tema (segue a home). Acentos (verde/dourado) são independentes do tema.
  const T = dark
    ? {
        pageBg: "#06100b",
        notch: "#06100b",
        text: "text-white",
        textSoft: "text-white/60",
        textFaint: "text-white/45",
        textMuted: "text-white/30",
        cardBg: "rgba(255,255,255,0.02)",
        cardBorder: "border-white/5",
        hairline: "border-white/10",
        divider: "bg-white/5",
        navText: "text-white/50",
        navHover: "hover:text-white",
        inputBg: "bg-white/[0.02]",
        inputBorder: "border-white/10",
        featuredGrad: "linear-gradient(135deg, rgba(11,40,25,0.4) 0%, rgba(6,16,11,0.8) 100%)",
        statBg: "rgba(255,255,255,0.03)"
      }
    : {
        pageBg: "#f3f5f3",
        notch: "#f3f5f3",
        text: "text-slate-900",
        textSoft: "text-slate-600",
        textFaint: "text-slate-500",
        textMuted: "text-slate-400",
        cardBg: "rgba(255,255,255,0.9)",
        cardBorder: "border-black/10",
        hairline: "border-black/10",
        divider: "bg-black/10",
        navText: "text-slate-500",
        navHover: "hover:text-slate-900",
        inputBg: "bg-black/[0.03]",
        inputBorder: "border-black/10",
        // Card de destaque permanece escuro (ponto focal) também no tema claro
        featuredGrad: "linear-gradient(135deg, rgba(11,40,25,0.95) 0%, rgba(6,16,11,0.98) 100%)",
        statBg: "rgba(0,0,0,0.03)"
      };

  // Classes de campo do drawer (tema) — fundo sólido no escuro para contraste
  // claro do contorno, texto digitado, placeholder e controles nativos (date/select).
  const fieldBase = dark
    ? "border-white/20 bg-[#101d16] text-white placeholder:text-white/50"
    : "border-black/15 bg-white text-slate-900 placeholder:text-slate-400";
  const fld = `w-full px-4 py-2.5 rounded-xl border focus:outline-none focus:border-[#d4af37] ${fieldBase}`;
  const fldArea = `${fld} resize-none`;
  const fldSm = `w-full px-3 py-2.5 rounded-xl border focus:outline-none focus:border-[#d4af37] ${fieldBase}`;
  const fldDate = `${fldSm} text-[11px]`;
  const fldContact = `w-full px-3 py-2 rounded-lg border text-[11px] focus:outline-none focus:border-[#d4af37] ${fieldBase}`;
  const lblD = dark ? "text-white/40 block" : "text-slate-500 block";
  const divD = dark ? "w-full h-px bg-white/5" : "w-full h-px bg-black/10";
  const chkRow = `flex items-center gap-3.5 p-2 rounded-xl border cursor-pointer ${dark ? "bg-white/[0.02] border-white/5" : "bg-black/[0.03] border-black/10"}`;

  // The featured event is the one manually marked (isFeatured); otherwise the
  // soonest upcoming event acts as the default highlight.
  const featuredEvent = events.find(e => e.isFeatured) || events[0] || null;
  const otherEvents = featuredEvent ? events.filter(e => e.id !== featuredEvent.id) : events;
  const nextFeaturedEvent = featuredEvent;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#07130e]">
        <div className="flex flex-col items-center gap-3">
          <img src="/logo-peniel.jpeg" className="w-14 h-14 rounded-xl border border-[#d4af37]/20 object-cover animate-pulse" alt="Logo Peniel" />
          <span className="text-white/40 text-xs tracking-widest uppercase animate-pulse">Carregando Peniel...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen overflow-x-hidden font-sans relative transition-colors duration-500 ${dark ? "text-slate-200" : "text-slate-800"}`}
      style={{ background: T.pageBg }}
    >
      {/* Background radial spotlight */}
      <div
        className="absolute top-0 inset-x-0 h-[100vh] pointer-events-none z-0"
        style={{
          background: `radial-gradient(ellipse 65% 55% at 50% 0%, ${primaryColor}${dark ? "70" : "1f"} 0%, transparent 100%)`
        }}
      />

      {/* Background Watermark */}
      <img
        src="/logo-peniel.jpeg"
        alt=""
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none w-[80vw] md:w-[50vw] lg:max-w-2xl object-cover rounded-full z-0"
        style={{ opacity: dark ? 0.02 : 0.04, filter: "grayscale(100%) blur(1px)" }}
      />

      {/* Navbar */}
      <header className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between relative z-10 font-sans">
        <div className="flex items-center gap-3.5 cursor-pointer" onClick={() => navigate("/")}>
          <img src="/logo-peniel.jpeg" alt="Peniel Logo" className={`w-9 h-9 rounded-lg border object-cover ${dark ? "border-white/10" : "border-black/10"}`} />
          <div>
            <h1 className={`text-lg font-black tracking-widest uppercase leading-none ${T.text}`}>
              {config?.title || "Peniel"}
            </h1>
            <span className={`text-[9px] font-bold tracking-widest uppercase ${T.textMuted}`}>
              AD Campinas
            </span>
          </div>
        </div>

        <nav className={`hidden md:flex items-center gap-8 text-xs font-semibold uppercase tracking-wider ${T.navText}`}>
          <a href="#" className={`${T.navHover} transition-colors`}>Início</a>
          <a href="#testemunhos" className={`${T.navHover} transition-colors`}>Testemunhos</a>
          <a href="#agenda" className={`${T.navHover} transition-colors`}>Agenda</a>
        </nav>

        <button
          onClick={() => navigate("/")}
          className={`text-xs font-bold px-4 py-2 rounded-full border transition-all ${dark ? "text-white/60 hover:text-white border-white/10 hover:bg-white/5" : "text-slate-600 hover:text-slate-900 border-black/10 hover:bg-black/5"}`}
        >
          Voltar
        </button>
      </header>

      {/* HERO SECTION */}
      <section className="max-w-7xl mx-auto px-6 py-16 md:py-24 grid grid-cols-1 lg:grid-cols-12 gap-16 items-center relative z-10">
        {/* Dove symbol watermark behind the hero (Holy Spirit) */}
        <Bird
          className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/4 md:translate-x-0 w-[70vw] md:w-[55vw] lg:w-[640px] h-auto pointer-events-none select-none z-0"
          strokeWidth={0.4}
          style={{ color: secondaryColor, opacity: 0.06 }}
        />
        {/* Left Column */}
        <div className="relative z-10 lg:col-span-7 space-y-8 w-full max-w-none lg:max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border"
            style={{ borderColor: `${secondaryColor}25`, background: `${secondaryColor}08`, color: accentColor }}
          >
            <Sparkles size={11} />
            Encontro com Deus
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className={`text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] text-balance font-sans ${T.text}`}
          >
            {config?.subtitle || "Um lugar de encontro, fé e transformação"}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className={`text-sm md:text-base font-light leading-relaxed text-balance max-w-xl ${dark ? "text-white/55" : "text-slate-600"}`}
          >
            {config?.description || "Testemunhos, eventos e experiências que fortalecem a caminhada com Deus."}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap gap-4 pt-2"
          >
            <a
              href="#agenda"
              className="px-6 py-3 rounded-full text-xs font-bold flex items-center gap-2 hover:opacity-90 shadow-xl transition-all"
              style={{ background: secondaryColor, color: primaryColor }}
            >
              <Calendar size={14} />
              {config?.buttonsConfig?.secondaryLabel || "Participar do Próximo Evento"}
            </a>
            <a
              href="#testemunhos"
              className={`px-6 py-3 rounded-full text-xs font-bold border transition-all ${dark ? "text-white/70 hover:bg-white/5" : "text-slate-700 hover:bg-black/5"}`}
              style={{ borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.12)" }}
            >
              {config?.buttonsConfig?.primaryLabel || "Ver Testemunhos"}
            </a>
            <button
              type="button"
              onClick={() => { setLookupOpen(true); setLookupCode(""); setLookupData(null); setLookupError(""); }}
              className={`px-6 py-3 rounded-full text-xs font-bold border transition-all inline-flex items-center gap-2 ${dark ? "text-white/70 hover:bg-white/5 border-white/10" : "text-slate-700 hover:bg-black/5 border-black/15"}`}
            >
              <Search size={14} /> Consultar Inscrição
            </button>
          </motion.div>
        </div>

        {/* Right Column: 3 Cards stacked stacked-like */}
        <div className="lg:col-span-5 relative z-10 h-[460px] hidden sm:block">
          {config?.heroCards?.map((card, i) => {
            const total = config.heroCards.length;
            const relativeIndex = (i - activeCardIndex + total) % total;

            const stackStyles = [
              { top: "top-0", left: "left-12", z: "z-10", rotate: "-rotate-3", opacity: 0.4, scale: 0.9 },
              { top: "top-14", left: "left-24", z: "z-20", rotate: "rotate-2", opacity: 0.75, scale: 0.95 },
              { top: "top-28", left: "left-8", z: "z-30", rotate: "-rotate-1", opacity: 1, scale: 1 }
            ];

            let styleIndex = relativeIndex;
            if (total > 3) {
              if (relativeIndex < total - 3) {
                return null;
              }
              styleIndex = relativeIndex - (total - 3);
            }

            const pos = stackStyles[styleIndex] || { top: "top-0", left: "left-0", z: "z-0", rotate: "", opacity: 0, scale: 0.9 };

            return (
              <motion.div
                key={i}
                layout
                initial={{ opacity: 0 }}
                animate={{
                  opacity: pos.opacity,
                  scale: pos.scale,
                  y: 0
                }}
                transition={{ duration: 0.5 }}
                className={`absolute w-96 h-60 rounded-2xl overflow-hidden shadow-2xl p-6 border border-white/10 ${pos.top} ${pos.left} ${pos.z} ${pos.rotate} flex flex-col justify-end backdrop-blur-md`}
                style={{
                  background: `linear-gradient(to top, rgba(6,16,11,0.95) 0%, rgba(11,40,25,0.3) 100%)`
                }}
              >
                {card.image && (
                  <div
                    className="absolute inset-0 bg-cover bg-center opacity-30 z-0"
                    style={{ backgroundImage: `url(${card.image})` }}
                  />
                )}
                {!card.image && (
                  <div className="absolute inset-0 bg-cover bg-center opacity-30 z-0 bg-slate-900" />
                )}
                <div className="relative z-10 space-y-2 flex flex-col justify-end h-full">
                  <div className="flex-1" />
                  <div>
                    <div className="w-6 h-1 rounded-full mb-2" style={{ background: secondaryColor }} />
                    <p className="text-xs font-semibold text-white/40 tracking-wider uppercase">
                      {card.subtitle || `Experiência ${i + 1}`}
                    </p>
                    <h4 className="text-base font-bold text-white font-sans leading-snug">{card.title}</h4>
                  </div>
                  {card.buttonText && card.buttonLink && (
                    <a
                      href={card.buttonLink}
                      className="mt-2 inline-flex items-center justify-center px-4 py-2 rounded-full text-xs font-bold transition-all hover:opacity-90 self-start shadow-md hover:scale-105"
                      style={{ background: secondaryColor, color: primaryColor }}
                    >
                      {card.buttonText}
                    </a>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* AGENDA SECTION */}
      <section id="agenda" className={`max-w-7xl mx-auto px-6 py-20 relative z-10 border-t ${T.hairline}`}>
        <div className="text-center max-w-xl mx-auto mb-16 space-y-2">
          <p className="text-[10px] font-bold tracking-widest text-[#d4af37] uppercase">Agenda</p>
          <h3 className={`text-3xl md:text-4xl font-bold tracking-tight ${T.text}`}>Próximos encontros</h3>
          <p className={`text-xs ${T.textFaint}`}>Escolha uma data e reserve sua vaga para viver essa experiência marcante.</p>
        </div>

        {events.length > 0 ? (
          <div className="space-y-12">
            {/* FEATURED EVENT (LARGE CARD) */}
            {featuredEvent && (() => {
              return (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5 }}
                  className="max-w-4xl mx-auto rounded-3xl border p-6 md:p-8 flex flex-col md:flex-row justify-between gap-6 relative overflow-hidden shadow-2xl"
                  style={{
                    background: T.featuredGrad,
                    borderColor: `${secondaryColor}${dark ? "20" : "33"}`
                  }}
                >
                  {/* Decorative spotlight effect */}
                  <div
                    className="absolute top-0 right-0 w-80 h-80 pointer-events-none z-0 opacity-10"
                    style={{
                      background: `radial-gradient(circle, ${secondaryColor} 0%, transparent 70%)`
                    }}
                  />

                  <div className="flex-1 space-y-5 relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border"
                      style={{ borderColor: `${secondaryColor}30`, background: `${secondaryColor}08`, color: accentColor }}
                    >
                      <Sparkles size={11} />
                      Encontro em Destaque
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">{featuredEvent.title}</h4>
                      {featuredEvent.description && (
                        <p className="text-xs md:text-sm text-white/60 font-light leading-relaxed max-w-xl font-sans">
                          {featuredEvent.description}
                        </p>
                      )}
                    </div>

                    {/* Grid of details */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                      <div className="flex items-center gap-3 bg-white/2 border border-white/5 p-3 rounded-2xl">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 text-[#d4af37]">
                          <Calendar size={16} />
                        </div>
                        <div>
                          <span className="text-[9px] text-white/30 uppercase block font-semibold">Data</span>
                          <span className="text-xs font-bold text-white">
                            {featuredEvent.dateLabel || new Date(featuredEvent.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 bg-white/2 border border-white/5 p-3 rounded-2xl">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 text-[#d4af37]">
                          <Clock size={16} />
                        </div>
                        <div>
                          <span className="text-[9px] text-white/30 uppercase block font-semibold">Horário</span>
                          <span className="text-xs font-bold text-white">{featuredEvent.time}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 bg-white/2 border border-white/5 p-3 rounded-2xl">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 text-[#d4af37]">
                          <MapPin size={16} />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[9px] text-white/30 uppercase block font-semibold">Local</span>
                          <span className="text-xs font-bold text-white block truncate" title={featuredEvent.location}>{featuredEvent.location}</span>
                        </div>
                      </div>
                    </div>

                    {featuredEvent.departureLocation && (
                      <div className="relative mt-1 inline-flex items-stretch rounded-2xl shadow-lg max-w-full"
                        style={{ background: `${secondaryColor}10`, border: `1px solid ${secondaryColor}33` }}
                      >
                        {/* Ticket stub (ícone) */}
                        <div className="flex items-center justify-center px-4 rounded-l-2xl shrink-0" style={{ background: `${secondaryColor}1f` }}>
                          <MapPin size={18} style={{ color: secondaryColor }} />
                        </div>
                        {/* Perfuração serrilhada com furos (estilo ingresso) */}
                        <div className="relative flex items-center shrink-0">
                          <span className="absolute -top-[7px] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full" style={{ background: "#06100b", border: `1px solid ${secondaryColor}33` }} />
                          <span className="absolute -bottom-[7px] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full" style={{ background: "#06100b", border: `1px solid ${secondaryColor}33` }} />
                          <div className="h-full mx-1.5" style={{ borderLeft: `2px dotted ${secondaryColor}88` }} />
                        </div>
                        {/* Corpo */}
                        <div className="px-4 py-3 min-w-0">
                          <span className="block text-[9px] uppercase tracking-widest font-bold" style={{ color: accentColor }}>Local de Saída</span>
                          <span className="block text-sm font-bold text-white truncate" title={featuredEvent.departureLocation}>{featuredEvent.departureLocation}</span>
                        </div>
                      </div>
                    )}
                    
                    {featuredEvent.latitude && featuredEvent.longitude && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${featuredEvent.latitude},${featuredEvent.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[#d4af37] hover:underline inline-flex items-center gap-1.5 font-semibold"
                      >
                        <MapPin size={11} /> Ver localização no Google Maps &rarr;
                      </a>
                    )}
                  </div>

                  {/* Perfuração de ingresso (picotado grosso + furos que desvanecem como buracos) */}
                  <div className="relative self-stretch z-10" aria-hidden>
                    {/* Desktop: corte vertical */}
                    <div className="hidden md:block relative h-full w-7">
                      <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full" style={{ background: "radial-gradient(circle, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 50%, transparent 72%)" }} />
                      <span className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full" style={{ background: "radial-gradient(circle, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 50%, transparent 72%)" }} />
                      <div className="absolute inset-y-4 left-1/2 -translate-x-1/2 border-l-[6px] border-dotted border-white/40" />
                    </div>
                    {/* Mobile: corte horizontal */}
                    <div className="md:hidden relative w-full h-7">
                      <span className="absolute -left-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full" style={{ background: "radial-gradient(circle, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 50%, transparent 72%)" }} />
                      <span className="absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full" style={{ background: "radial-gradient(circle, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 50%, transparent 72%)" }} />
                      <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 border-t-[6px] border-dotted border-white/40" />
                    </div>
                  </div>

                  {/* Right side stats/actions */}
                  <div className="flex flex-col justify-between items-stretch md:w-60 pt-5 md:pt-0 md:pl-2 relative z-10 gap-5">
                    <div className="grid grid-cols-2 md:grid-cols-1 gap-4">
                      <div className="bg-white/2 border border-white/5 p-3 rounded-2xl">
                        <span className="text-[9px] text-white/30 uppercase block font-semibold font-sans">Valor da Ficha</span>
                        <span className="text-base font-black text-white">
                          {Number(featuredEvent.value) === 0 ? "Gratuito" : Number(featuredEvent.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      </div>
                      <div className="bg-white/2 border border-white/5 p-3 rounded-2xl font-sans">
                        <span className="text-[9px] text-white/30 uppercase block font-semibold">Vagas Disponíveis</span>
                        <span className="text-base font-black text-white">
                          {featuredEvent.vagasDisponiveis} / {featuredEvent.limit}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenForm(featuredEvent)}
                      className="w-full py-3 rounded-2xl text-xs font-black tracking-widest uppercase transition-all shadow-xl hover:opacity-90 flex items-center justify-center gap-2"
                      style={{ background: secondaryColor, color: primaryColor }}
                    >
                      Garantir Minha Vaga
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </motion.div>
              );
            })()}

            {/* OTHER EVENTS GRID */}
            {otherEvents.length > 0 && (
              <div className="space-y-6 pt-4">
                <h4 className={`text-xs font-extrabold uppercase tracking-widest text-center mb-6 ${T.textMuted}`}>Outros Encontros Agendados</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {otherEvents.map((event, i) => {
                    const dateObj = new Date(event.date);
                    const day = dateObj.getUTCDate();
                    const month = dateObj.toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" }).toUpperCase().replace(".", "");

                    return (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, y: 15 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: i * 0.1 }}
                        className="rounded-2xl p-6 flex flex-col justify-between relative group hover:border-[#d4af37]/30 transition-all shadow-xl"
                        style={{ background: dark ? "rgba(11,40,25,0.15)" : "rgba(255,255,255,0.85)", border: dark ? "1px solid rgba(255,255,255,0.03)" : "1px solid rgba(0,0,0,0.08)" }}
                      >
                        <div>
                          {/* Top: Date and Icon */}
                          <div className="flex items-start justify-between mb-6">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl flex flex-col items-center justify-center border border-white/10" style={{ background: `${secondaryColor}10` }}>
                                <span className="text-[9px] font-extrabold" style={{ color: secondaryColor }}>{month}</span>
                                <span className={`text-lg font-black leading-none ${T.text}`}>{day}</span>
                              </div>
                              <div>
                                <span className={`text-[10px] font-semibold uppercase tracking-wider block ${T.textMuted}`}>Encontro</span>
                                <h4 className={`text-sm font-bold leading-tight ${T.text}`}>{event.title}</h4>
                              </div>
                            </div>
                            <Flame className="w-5 h-5 text-[#d4af37]/60 group-hover:scale-110 transition-transform" />
                          </div>

                          {/* Body details */}
                          <div className={`space-y-2.5 text-xs mb-6 font-light ${T.textSoft}`}>
                            <div className="flex items-center gap-2">
                              <Calendar size={13} className="text-[#d4af37] flex-shrink-0" />
                              <span className={`font-semibold ${T.text}`}>
                                {event.dateLabel || new Date(event.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock size={13} className="text-[#d4af37] flex-shrink-0" />
                              <span>{event.time}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <MapPin size={13} className="text-[#d4af37] flex-shrink-0 mt-0.5" />
                              <div className="flex flex-col">
                                <span>{event.location}</span>
                                {event.departureLocation && (
                                  <span className={`text-[10px] block mt-0.5 font-light font-sans ${T.textFaint}`}>Saída/Encontro: {event.departureLocation}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Card footer / Actions */}
                        <div className={`flex items-center justify-between pt-4 border-t mt-auto font-sans ${T.hairline}`}>
                          <div>
                            <span className={`text-[9px] block uppercase font-sans ${T.textMuted}`}>Inscrição</span>
                            <span className={`text-sm font-bold font-sans ${T.text}`}>
                              {Number(event.value) === 0 ? "Gratuito" : Number(event.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </span>
                          </div>
                          <button
                            onClick={() => handleOpenForm(event)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold tracking-wider uppercase transition-all shadow-md cursor-pointer font-sans"
                            style={{ background: secondaryColor, color: primaryColor }}
                          >
                            Fazer Inscrição
                            <ArrowRight size={12} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className={`text-center py-12 rounded-2xl border border-dashed max-w-xl mx-auto ${dark ? "border-white/10 bg-white/5" : "border-black/10 bg-black/[0.02]"}`}>
            <p className={`text-sm font-light font-sans ${T.textFaint}`}>Nenhum evento agendado no momento. Volte em breve!</p>
          </div>
        )}
      </section>

      {/* TESTIMONY SECTION (após a agenda) */}
      <section id="testemunhos" className={`max-w-7xl mx-auto px-6 py-20 relative z-10 border-t ${T.hairline}`}>
        <div className="text-center max-w-xl mx-auto mb-16 space-y-2">
          <p className="text-[10px] font-bold tracking-widest text-[#d4af37] uppercase">Testemunhos</p>
          <h3 className={`text-3xl md:text-4xl font-bold tracking-tight ${T.text}`}>Testemunhos que edificam</h3>
          <p className={`text-xs ${T.textFaint}`}>Histórias reais de pessoas que tiveram suas vidas marcadas no Peniel.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {config?.testimonyVideos?.map((test, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className={`rounded-2xl border overflow-hidden flex flex-col h-72 relative group ${dark ? "border-white/5" : "border-black/10"}`}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              style={{ background: dark ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.9)" }}
            >
              {/* Image/Video representation */}
              <div className="h-40 relative overflow-hidden bg-[#0a1b12] flex items-center justify-center">
                {test.imageUrl ? (
                  <img
                    src={test.imageUrl}
                    alt={test.name}
                    className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="absolute inset-0 bg-[#0a1b12] opacity-75" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#06100b] to-transparent z-10" />
                {/* Simulated video play overlay */}
                {test.videoUrl && (
                  <button
                    onClick={() => setActiveVideoUrl(test.videoUrl || null)}
                    className="w-10 h-10 rounded-full bg-white/10 group-hover:bg-[#d4af37]/35 flex items-center justify-center transition-all z-20 cursor-pointer border border-white/20 shadow-lg"
                  >
                    <div className="w-0 h-0 border-y-[5px] border-y-transparent border-l-[8px] border-l-white ml-0.5" />
                  </button>
                )}
              </div>

              {/* Quotes */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <p className={`text-xs italic font-light line-clamp-3 ${T.textSoft}`}>"{test.quote}"</p>
                <div className="flex items-center justify-between pt-2">
                  <span className={`text-xs font-bold font-sans ${T.text}`}>{test.name}</span>
                  {test.videoUrl ? (
                    <div className={`w-8 h-px ${dark ? "bg-white/20" : "bg-black/20"}`} />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActiveTestimony({ name: test.name, quote: test.quote })}
                      className="text-[10px] font-bold uppercase tracking-wider hover:opacity-80 transition-all inline-flex items-center gap-1"
                      style={{ color: secondaryColor }}
                    >
                      Ler mais <ArrowRight size={11} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA SECTION */}
      {nextFeaturedEvent && (
        <section className="max-w-7xl mx-auto px-6 py-10 relative z-10">
          <div
            className="rounded-3xl border p-8 md:p-12 grid grid-cols-1 md:grid-cols-12 gap-8 items-center overflow-hidden relative shadow-xl"
            style={{ background: T.featuredGrad, borderColor: dark ? "rgba(255,255,255,0.05)" : `${secondaryColor}33` }}
          >
            {/* Background design */}
            <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-5 pointer-events-none hidden md:block">
              <Flame className="w-full h-full text-white" />
            </div>

            <div className="md:col-span-8 space-y-4">
              <h3 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Viva essa experiência no Peniel</h3>
              <p className="text-xs md:text-sm text-white/50 font-light leading-relaxed max-w-xl">
                Mais que eventos, o Peniel é um lugar de encontro com Deus e com pessoas que caminham na mesma fé que você.
              </p>
              <button
                onClick={() => handleOpenForm(nextFeaturedEvent)}
                className="px-6 py-2.5 rounded-full text-xs font-bold inline-flex items-center gap-2 hover:opacity-90 shadow-lg transition-all"
                style={{ background: secondaryColor, color: primaryColor }}
              >
                <Users size={14} />
                Quero Participar
              </button>
            </div>
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className="bg-[#030906] border-t border-white/5 relative z-10 mt-20 font-sans">
        <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <img src="/adcampinas.png" alt="AD Campinas Logo" className="h-6 object-contain opacity-90" style={{ mixBlendMode: 'screen' }} />
              <span className="text-base font-black tracking-widest text-white uppercase">Sede AD Campinas</span>
            </div>
            <p className="text-[11px] text-white/30 font-light leading-relaxed">
              Restaurando vidas através do ensino da Palavra, investindo em pessoas e estabelecendo o Reino dos Céus.
            </p>
          </div>
          <div>
            <h5 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Navegação</h5>
            <ul className="space-y-2 text-[11px] text-white/40">
              <li><a href="#" className="hover:text-white transition-colors">Início</a></li>
              <li><a href="#testemunhos" className="hover:text-white transition-colors">Testemunhos</a></li>
              <li><a href="#agenda" className="hover:text-white transition-colors">Próximos Encontros</a></li>
            </ul>
          </div>
          <div>
            <h5 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Cultos AD Campinas</h5>
            <ul className="space-y-1.5 text-[11px] text-white/40">
              <li>Domingo: 9h30 e 18h30</li>
              <li>Quarta: 19h15 Culto de Ensino</li>
              <li>Sexta: 23h00 Vigília Peniel</li>
              <li>Sábado: Culto de Jovens 19h</li>
            </ul>
          </div>
          <div>
            <h5 className="text-xs font-bold text-white uppercase tracking-wider mb-4">Contato Sede</h5>
            <ul className="space-y-2 text-[11px] text-white/40 font-light">
              <li className="flex items-center gap-2">
                <MapPin size={11} className="text-[#d4af37]" />
                <span>Rua Barão de Parnaíba, 149 - Campinas</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone size={11} className="text-[#d4af37]" />
                <span>(19) 98928-1188</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 py-4 border-t border-white/5 flex items-center justify-between text-[10px] text-white/20">
          <span>&copy; {new Date().getFullYear()} Sede AD Campinas. Todos os direitos reservados.</span>
        </div>
      </footer>

      {/* VIDEO MODAL FOR TESTIMONIALS */}
      {activeVideoUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <div className="relative w-full max-w-4xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-white/10">
            <button
              onClick={() => setActiveVideoUrl(null)}
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white/70 hover:text-white transition-all border border-white/10"
            >
              <X size={20} />
            </button>
            {activeVideoUrl.includes("youtube.com") || activeVideoUrl.includes("youtu.be") || activeVideoUrl.includes("vimeo.com") ? (
              <iframe
                src={getEmbedUrl(activeVideoUrl)}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video
                src={activeVideoUrl}
                controls
                autoPlay
                className="w-full h-full"
              />
            )}
          </div>
        </div>
      )}

      {/* TEXT MODAL FOR TESTIMONIALS (sem vídeo) */}
      {activeTestimony && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setActiveTestimony(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-lg bg-[#06100b] border border-white/10 rounded-2xl shadow-2xl p-8"
          >
            <button
              onClick={() => setActiveTestimony(null)}
              className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all border border-white/10"
            >
              <X size={16} />
            </button>
            <div className="w-8 h-1 rounded-full mb-5" style={{ background: secondaryColor }} />
            <p className="text-sm md:text-base italic text-white/80 font-light leading-relaxed whitespace-pre-line">
              "{activeTestimony.quote}"
            </p>
            <p className="mt-6 text-sm font-bold text-white font-sans">{activeTestimony.name}</p>
          </motion.div>
        </div>
      )}

      {/* CONSULTAR INSCRIÇÃO (por código) */}
      {lookupOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setLookupOpen(false)}>
          <div
            className={`relative w-full max-w-md rounded-2xl shadow-2xl p-6 border ${dark ? "border-white/10" : "border-black/10"}`}
            style={{ background: dark ? "#06100b" : "#ffffff" }}
            onClick={e => e.stopPropagation()}
          >
            <button onClick={() => setLookupOpen(false)} className={`absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center ${dark ? "text-white/40 hover:text-white hover:bg-white/5" : "text-slate-400 hover:text-slate-900 hover:bg-black/5"}`}>
              <X size={16} />
            </button>
            <div className="flex items-center gap-2 mb-1">
              <Ticket size={18} style={{ color: secondaryColor }} />
              <h3 className={`text-base font-bold ${T.text}`}>Consultar Inscrição</h3>
            </div>
            <p className={`text-xs ${T.textFaint}`}>Digite o código que você recebeu na confirmação da inscrição.</p>

            <form onSubmit={handleLookup} className="flex gap-2 mt-4">
              <input
                value={lookupCode}
                onChange={e => setLookupCode(e.target.value.toUpperCase())}
                placeholder="Ex: A1B2C3D4"
                maxLength={20}
                className={`${fldSm} font-mono tracking-widest`}
              />
              <button type="submit" disabled={lookupLoading || !lookupCode.trim()} className="px-4 rounded-xl font-bold disabled:opacity-50 flex items-center justify-center" style={{ background: secondaryColor, color: primaryColor }}>
                {lookupLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              </button>
            </form>

            {lookupError && <p className="mt-3 text-xs text-red-500">{lookupError}</p>}

            {lookupData && (
              <div className={`mt-4 rounded-xl border p-4 space-y-3 ${dark ? "border-white/10 bg-white/[0.02]" : "border-black/10 bg-black/[0.02]"}`}>
                <div>
                  <p className={`text-sm font-bold ${T.text}`}>{lookupData.nome}</p>
                  <p className={`text-xs ${T.textFaint}`}>{lookupData.event?.title}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${lookupData.status === "inscrito" ? "bg-emerald-500/15 text-emerald-500" : lookupData.status === "fila_espera" ? "bg-amber-500/15 text-amber-500" : "bg-slate-500/15 text-slate-400"}`}>
                    {lookupData.status === "inscrito" ? "Confirmado" : lookupData.status === "fila_espera" ? "Fila de espera" : "Cancelado"}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${lookupData.paymentStatus === "pago" ? "bg-emerald-500/15 text-emerald-500" : lookupData.paymentStatus === "gratuito" ? "bg-sky-500/15 text-sky-400" : lookupData.paymentStatus === "comprovante_enviado" ? "bg-indigo-500/15 text-indigo-400" : "bg-rose-500/15 text-rose-400"}`}>
                    {lookupData.paymentStatus === "pago" ? "Pago" : lookupData.paymentStatus === "gratuito" ? "Gratuito" : lookupData.paymentStatus === "comprovante_enviado" ? "Comprovante enviado" : "Pagamento pendente"}
                  </span>
                </div>

                {/* Link de pagamento se pendente */}
                {lookupData.paymentStatus !== "pago" && lookupData.paymentStatus !== "gratuito" && lookupData.event?.paymentLink && (
                  <a href={lookupData.event.paymentLink} target="_blank" rel="noopener noreferrer" className="w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:opacity-90" style={{ background: secondaryColor, color: primaryColor }}>
                    <CreditCard size={14} /> Ir para o pagamento
                  </a>
                )}

                {/* Anexar comprovante */}
                {lookupData.paymentStatus !== "gratuito" && (
                  <div className="space-y-2">
                    <input ref={lookupProofRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleLookupProofUpload(f); }} />
                    {lookupData.hasProof ? (
                      <div className="flex items-center gap-2 text-xs text-emerald-500 font-semibold"><CheckCircle2 size={14} /> Comprovante recebido</div>
                    ) : (
                      <button type="button" onClick={() => lookupProofRef.current?.click()} disabled={lookupProofUploading} className={`w-full py-2.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 ${dark ? "border-white/10 text-white/80 hover:bg-white/5" : "border-black/15 text-slate-700 hover:bg-black/5"}`}>
                        {lookupProofUploading ? <><Loader2 size={14} className="animate-spin" /> Enviando...</> : <><Paperclip size={14} /> Anexar comprovante</>}
                      </button>
                    )}
                  </div>
                )}

                {/* Baixar PDF + Reenviar QR */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button type="button" onClick={() => handleDownloadPDF(lookupData)} className={`py-2.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 ${dark ? "border-white/10 text-white/80 hover:bg-white/5" : "border-black/15 text-slate-700 hover:bg-black/5"}`}>
                    <Download size={14} /> Baixar PDF
                  </button>
                  <button type="button" onClick={handleLookupResend} disabled={lookupResending} className={`py-2.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 disabled:opacity-50 ${dark ? "border-white/10 text-white/80 hover:bg-white/5" : "border-black/15 text-slate-700 hover:bg-black/5"}`}>
                    {lookupResending ? <><Loader2 size={14} className="animate-spin" /> ...</> : <><QrCode size={14} /> Reenviar QR</>}
                  </button>
                </div>

                {lookupInfo && <p className="text-xs text-emerald-500 font-semibold text-center">{lookupInfo}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* REGISTRATION FORM DRAWER/MODAL */}
      <AnimatePresence>
        {formOpen && selectedEvent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end"
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              className={`w-full max-w-xl border-l h-full flex flex-col shadow-2xl overflow-hidden ${dark ? "border-white/10" : "border-black/10"}`}
              style={{ background: dark ? "#06100b" : "#ffffff" }}
            >
              {/* Header */}
              <div className={`p-5 border-b flex items-center justify-between ${dark ? "border-white/10 bg-black/40" : "border-black/10 bg-black/[0.02]"}`}>
                <div>
                  <h3 className={`text-base font-bold leading-tight ${T.text}`}>Ficha de Inscrição</h3>
                  <span className={`text-[10px] font-medium block mt-0.5 ${T.textFaint}`}>
                    Evento: {selectedEvent.title} {Number(selectedEvent.value) > 0 && `• Etapa ${formStep} de 2`}
                  </span>
                </div>
                <button
                  onClick={() => setFormOpen(false)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${dark ? "text-white/40 hover:text-white hover:bg-white/5" : "text-slate-400 hover:text-slate-900 hover:bg-black/5"}`}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Form Scroll Area */}
              <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs" style={{ colorScheme: dark ? "dark" : "light" }}>
                {errorMsg && (
                  <div className="p-3.5 rounded-xl bg-red-900/20 border border-red-500/20 text-red-400 flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p>{errorMsg}</p>
                  </div>
                )}

                {/* ETAPA 1 — Ficha */}
                {formStep === 1 && (<>
                {/* 1. Inscrição de Encontrista */}
                <div className="flex items-center gap-3 p-3 rounded-xl border border-[#d4af37]/30 bg-[#d4af37]/5">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-[#d4af37]/10 text-[#d4af37] shrink-0">
                    <User size={16} />
                  </div>
                  <div>
                    <span className={`font-semibold block ${dark ? "text-white" : "text-slate-900"}`}>Inscrição de Encontrista</span>
                    <span className={`text-[10px] ${T.textFaint}`}>Esta ficha é para quem vai participar do encontro.</span>
                  </div>
                </div>

                <div className={divD} />

                {/* 2. Dados Pessoais */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold tracking-widest text-[#d4af37] uppercase">Dados Pessoais</h4>

                  <div className="space-y-1">
                    <label className={lblD}>Nome Completo</label>
                    <input
                      type="text"
                      required
                      value={nome}
                      onChange={e => setNome(e.target.value)}
                      placeholder="Seu nome completo"
                      className={fld}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={lblD}>Endereço Completo</label>
                    <input
                      type="text"
                      required
                      value={endereco}
                      onChange={e => setEndereco(e.target.value)}
                      placeholder="Rua, número, complemento, bairro, cidade"
                      className={fld}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className={lblD}>Data Nascimento</label>
                      <input
                        type="date"
                        required
                        value={dataNascimento}
                        onChange={e => setDataNascimento(e.target.value)}
                        className={fldDate}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className={lblD}>Estado Civil</label>
                      <select
                        value={estadoCivil}
                        onChange={e => setEstadoCivil(e.target.value)}
                        className={fldSm}
                      >
                        <option value="Solteiro">Solteiro</option>
                        <option value="Casado">Casado</option>
                        <option value="Divorciado">Divorciado</option>
                        <option value="Viúvo">Viúvo</option>
                        <option value="Outro">Outro</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className={lblD}>Idade</label>
                      <input
                        type="number"
                        required
                        value={idade}
                        onChange={e => setIdade(e.target.value)}
                        placeholder="Ex: 40"
                        className={fldSm}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className={lblD}>Celular / WhatsApp</label>
                      <input
                        type="tel"
                        required
                        value={celular}
                        onChange={e => setCelular(maskPhone(e.target.value))}
                        placeholder="(19) 99999-9999"
                        className={fld}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className={lblD}>Igreja Base / Membro de onde?</label>
                      <input
                        type="text"
                        required
                        value={igrejaBase}
                        onChange={e => setIgrejaBase(e.target.value)}
                        placeholder="Ex: AD Campinas"
                        className={fld}
                      />
                    </div>
                  </div>

                  <label className={chkRow}>
                    <input
                      type="checkbox"
                      checked={batizadoAguas}
                      onChange={e => setBatizadoAguas(e.target.checked)}
                      className="w-4 h-4 accent-[#d4af37]"
                    />
                    <div>
                      <span className={`font-semibold block ${dark ? "text-white" : "text-slate-900"}`}>É batizado nas águas?</span>
                    </div>
                  </label>
                </div>

                <div className={divD} />

                {/* 3. Grupo Familiar */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold tracking-widest text-[#d4af37] uppercase">Grupo Familiar / Célula</h4>

                  <label className={chkRow}>
                    <input
                      type="checkbox"
                      checked={participaGrupoFamiliar}
                      onChange={e => setParticipaGrupoFamiliar(e.target.checked)}
                      className="w-4 h-4 accent-[#d4af37]"
                    />
                    <div>
                      <span className={`font-semibold block ${dark ? "text-white" : "text-slate-900"}`}>Participa de Grupo Familiar?</span>
                    </div>
                  </label>

                  {participaGrupoFamiliar && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="grid grid-cols-2 gap-3 pt-2"
                    >
                      <div className="space-y-1">
                        <label className={lblD}>Qual Grupo / Célula?</label>
                        <input
                          type="text"
                          required
                          value={grupoFamiliarQual}
                          onChange={e => setGrupoFamiliarQual(e.target.value)}
                          placeholder="Ex: Setor 5"
                          className={fld}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className={lblD}>Nome do Líder</label>
                        <input
                          type="text"
                          required
                          value={nomeLider}
                          onChange={e => setNomeLider(e.target.value)}
                          placeholder="Nome do seu líder"
                          className={fld}
                        />
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* 3.1. Informações Adicionais (Extra) */}
                {(() => {
                  let extraCfg = { spouse: false, children: false, ecclesiastical: false };
                  if (selectedEvent && selectedEvent.extraFieldsConfig) {
                    try {
                      extraCfg = typeof selectedEvent.extraFieldsConfig === "string"
                        ? JSON.parse(selectedEvent.extraFieldsConfig)
                        : selectedEvent.extraFieldsConfig;
                    } catch (e) {
                      console.error("Erro ao ler extraFieldsConfig", e);
                    }
                  }

                  const showSpouse = !!extraCfg.spouse;
                  const showChildren = !!extraCfg.children;
                  const showEcc = !!extraCfg.ecclesiastical;

                  if (!showSpouse && !showChildren && !showEcc) return null;

                  return (
                    <>
                      <div className={divD} />
                      <div className="space-y-4">
                        <h4 className="text-[10px] font-bold tracking-widest text-[#d4af37] uppercase">Informações Adicionais</h4>
                        
                        {showSpouse && (
                          <div className="space-y-1">
                            <label className={lblD}>Nome Completo do Cônjuge</label>
                            <input
                              type="text"
                              required
                              value={spouseName}
                              onChange={e => setSpouseName(e.target.value)}
                              placeholder="Nome completo do marido/esposa"
                              className={fld}
                            />
                          </div>
                        )}

                        {showChildren && (
                          <div className="space-y-3">
                            <label className={chkRow}>
                              <input
                                type="checkbox"
                                checked={hasChildren}
                                onChange={e => setHasChildren(e.target.checked)}
                                className="w-4 h-4 accent-[#d4af37]"
                              />
                              <div>
                                <span className={`font-semibold block ${dark ? "text-white" : "text-slate-900"}`}>Você possui filhos?</span>
                              </div>
                            </label>

                            {hasChildren && (
                              <div className="space-y-1">
                                <label className={lblD}>Nomes e Idades dos Filhos</label>
                                <textarea
                                  rows={2}
                                  required
                                  value={childrenDetails}
                                  onChange={e => setChildrenDetails(e.target.value)}
                                  placeholder="Ex: Pedro (5 anos), Maria (2 anos)"
                                  className={fldArea}
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {showEcc && (
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className={lblD}>Congregação / Igreja</label>
                              <input
                                type="text"
                                required
                                value={ecclesiasticalCongregation}
                                onChange={e => setEcclesiasticalCongregation(e.target.value)}
                                placeholder="Ex: Congregação Setor 2"
                                className={fld}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className={lblD}>Cargo Eclesiástico</label>
                              <input
                                type="text"
                                required
                                value={ecclesiasticalCargo}
                                onChange={e => setEcclesiasticalCargo(e.target.value)}
                                placeholder="Ex: Membro / Diácono / Líder"
                                className={fld}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  );
                })()}

                <div className={divD} />

                {/* 4. Perguntas de Motivação */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold tracking-widest text-[#d4af37] uppercase">Motivação</h4>

                  <div className="space-y-1">
                    <label className={lblD}>Quem te motivou a participar do Peniel?</label>
                    <input
                      type="text"
                      required
                      value={quemMotivou}
                      onChange={e => setQuemMotivou(e.target.value)}
                      placeholder="Nome de quem te motivou/convidou"
                      className={fld}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={lblD}>Por que você decidiu participar do Peniel?</label>
                    <textarea
                      required
                      rows={3}
                      value={porqueDecidiu}
                      onChange={e => setPorqueDecidiu(e.target.value)}
                      placeholder="Explique o motivo da sua decisão"
                      className={fldArea}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={lblD}>Quais são suas expectativas para este Peniel?</label>
                    <textarea
                      required
                      rows={3}
                      value={expectativas}
                      onChange={e => setExpectativas(e.target.value)}
                      placeholder="O que você espera viver nesse encontro?"
                      className={fldArea}
                    />
                  </div>
                </div>

                <div className={divD} />

                {/* 5. Contatos Importantes (Cite 5 pessoas) */}
                <div className="space-y-4">
                  <div>
                    <h4 className="text-[10px] font-bold tracking-widest text-[#d4af37] uppercase">5 Pessoas Importantes</h4>
                    <p className={`text-[10px] font-light mt-0.5 ${T.textMuted}`}>Cite as 5 pessoas mais importantes da sua vida (nome, parentesco, relação e whatsapp).</p>
                  </div>

                  <div className="space-y-4">
                    {contacts.map((contact, i) => (
                      <div key={i} className={`p-3.5 rounded-2xl border space-y-3 ${dark ? "bg-white/[0.02] border-white/5" : "bg-black/[0.02] border-black/10"}`}>
                        <span className={`text-[10px] font-bold block ${T.textFaint}`}>
                          Pessoa #{i + 1} {i < 3 ? <span className="text-[#d4af37]">*</span> : <span className="opacity-60">(opcional)</span>}
                        </span>

                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            required={i < 3}
                            placeholder="Nome Completo"
                            value={contact.nome}
                            onChange={e => handleContactChange(i, "nome", e.target.value)}
                            className={fldContact}
                          />
                          <input
                            type="text"
                            required={i < 3}
                            placeholder="WhatsApp (ex: 19 99999-9999)"
                            value={contact.whatsapp}
                            onChange={e => handleContactChange(i, "whatsapp", maskPhone(e.target.value))}
                            className={fldContact}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            required={i < 3}
                            placeholder="Parentesco (Mãe, Irmão, Amigo)"
                            value={contact.parentesco}
                            onChange={e => handleContactChange(i, "parentesco", e.target.value)}
                            className={fldContact}
                          />
                          <input
                            type="text"
                            required={i < 3}
                            placeholder="Qual sua relação com esta pessoa?"
                            value={contact.relacao}
                            onChange={e => handleContactChange(i, "relacao", e.target.value)}
                            className={fldContact}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className={divD} />

                {/* 6. Dados Físicos e Saúde */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold tracking-widest text-[#d4af37] uppercase">Dados Físicos & Saúde</h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className={lblD}>Peso (kg)</label>
                      <input
                        type="number"
                        step="0.1"
                        required
                        value={peso}
                        onChange={e => setPeso(e.target.value)}
                        placeholder="Ex: 74.5"
                        className={fld}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className={lblD}>Altura (m)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.5"
                        max="2.6"
                        required
                        value={altura}
                        onChange={e => setAltura(e.target.value)}
                        placeholder="Ex: 1.68"
                        className={fld}
                      />
                      <p className={`text-[10px] ${T.textMuted}`}>Em metros (ex.: 1.68)</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className={lblD}>Faz uso de algum medicamento? Quais?</label>
                    <textarea
                      rows={2}
                      value={medicamentos}
                      onChange={e => setMedicamentos(e.target.value)}
                      placeholder="Descreva se fizer uso, ou deixe vazio se não"
                      className={fldArea}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className={lblD}>Possui alguma alergia ou restrição alimentar? Quais?</label>
                    <textarea
                      rows={2}
                      value={alergiasRestricoes}
                      onChange={e => setAlergiasRestricoes(e.target.value)}
                      placeholder="Descreva se possuir, ou deixe vazio se não"
                      className={fldArea}
                    />
                  </div>

                  {/* Apnéia (ronco) */}
                  <div className="space-y-2">
                    <label className={lblD}>Tem Apnéia (ronca)?</label>
                    <div className="grid grid-cols-2 gap-3">
                      {(["sim", "nao"] as const).map(opt => (
                        <label
                          key={opt}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                            apneia === opt
                              ? "border-[#d4af37] bg-[#d4af37]/10"
                              : dark ? "border-white/10 bg-white/[0.02] hover:bg-white/5" : "border-black/10 bg-black/[0.02] hover:bg-black/5"
                          }`}
                        >
                          <input
                            type="radio"
                            name="apneia"
                            required
                            checked={apneia === opt}
                            onChange={() => setApneia(opt)}
                            className="accent-[#d4af37]"
                          />
                          <span className={`font-semibold ${T.text}`}>{opt === "sim" ? "Sim" : "Não"}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                </>)}

                {/* ETAPA 2 — Pagamento */}
                {formStep === 2 && selectedEvent && (
                  <div className="space-y-5">
                    <button
                      type="button"
                      onClick={() => { setFormStep(1); setErrorMsg(""); }}
                      className={`text-xs font-semibold inline-flex items-center gap-1.5 ${dark ? "text-white/60 hover:text-white" : "text-slate-500 hover:text-slate-900"}`}
                    >
                      <ArrowLeft size={14} /> Voltar e revisar dados
                    </button>

                    {/* Resumo do pagamento + link */}
                    <div className="rounded-2xl border p-5 space-y-3" style={{ borderColor: `${secondaryColor}33`, background: `${secondaryColor}0d` }}>
                      <div className="flex items-center gap-2">
                        <CreditCard size={16} style={{ color: secondaryColor }} />
                        <h4 className="text-[11px] font-bold tracking-widest uppercase" style={{ color: accentColor }}>Pagamento da Ficha</h4>
                      </div>
                      <p className={`text-sm ${T.text}`}>
                        Valor: <span className="font-black">{Number(selectedEvent.value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                      </p>
                      {selectedEvent.paymentLink ? (
                        <a
                          href={selectedEvent.paymentLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg hover:opacity-90 transition-all"
                          style={{ background: secondaryColor, color: primaryColor }}
                        >
                          <CreditCard size={16} /> Ir para o pagamento
                        </a>
                      ) : (
                        <p className={`text-xs ${T.textFaint}`}>O link de pagamento será informado pela equipe. Você pode definir uma data prevista abaixo.</p>
                      )}
                      <p className={`text-[11px] ${T.textFaint}`}>Não feche esta tela — após pagar, anexe o comprovante aqui mesmo.</p>
                    </div>

                    {/* Data prevista (promessa de pagamento) */}
                    <div className="space-y-1">
                      <label className={lblD}>Data prevista para o pagamento</label>
                      <input
                        type="date"
                        value={paymentPromiseDate}
                        onChange={e => setPaymentPromiseDate(e.target.value)}
                        className={fldSm}
                      />
                    </div>

                    {/* Anexar comprovante */}
                    <div className="rounded-2xl border p-4 space-y-3" style={{ borderColor: dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)" }}>
                      <label className={`text-xs font-semibold ${T.text}`}>Comprovante de pagamento</label>
                      <input
                        ref={proofInputRef}
                        type="file"
                        accept="image/*,application/pdf"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleProofUpload(file, (url, name) => { setProofUrl(url); setProofFileName(name); }, setProofUploading);
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => proofInputRef.current?.click()}
                        disabled={proofUploading}
                        className={`w-full py-2.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 transition-all ${dark ? "border-white/10 text-white/80 hover:bg-white/5" : "border-black/15 text-slate-700 hover:bg-black/5"}`}
                      >
                        {proofUploading ? <><Loader2 size={14} className="animate-spin" /> Enviando...</> : <><Paperclip size={14} /> {proofUrl ? "Trocar comprovante" : "Anexar comprovante"}</>}
                      </button>
                      {proofUrl && (
                        <div className="flex items-center gap-2 text-xs text-emerald-500 font-semibold">
                          <CheckCircle2 size={14} /> {proofFileName || "Comprovante anexado"}
                        </div>
                      )}
                    </div>

                    {/* Envio */}
                    <div className="space-y-2 pt-1">
                      <button
                        type="button"
                        disabled={!proofUrl || submitting}
                        onClick={() => submitRegistration()}
                        className="w-full py-3 font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-40"
                        style={{ background: secondaryColor, color: primaryColor }}
                      >
                        <Check size={16} /> {submitting ? "Enviando..." : "Enviar com comprovante"}
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => submitRegistration()}
                        className={`w-full py-3 font-semibold rounded-xl border transition-all disabled:opacity-50 ${dark ? "border-white/10 text-white/70 hover:bg-white/5" : "border-black/15 text-slate-600 hover:bg-black/5"}`}
                      >
                        Enviar sem comprovante (pagar depois)
                      </button>
                      <p className={`text-[11px] text-center ${T.textFaint}`}>
                        Sem comprovante, sua inscrição fica com <b>pagamento pendente</b> até a confirmação da equipe.
                      </p>
                    </div>
                  </div>
                )}

                {/* Rodapé — etapa 1 */}
                {formStep === 1 && (
                  <div className="pt-4 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setFormOpen(false)}
                      className={`flex-1 py-3 border font-semibold rounded-xl transition-all ${dark ? "border-white/10 hover:bg-white/5 text-white/70" : "border-black/15 hover:bg-black/5 text-slate-600"}`}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 py-3 font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all"
                      style={{ background: secondaryColor, color: primaryColor }}
                    >
                      {Number(selectedEvent.value) === 0
                        ? (submitting ? "Processando..." : "Finalizar Inscrição")
                        : <>Avançar <ArrowRight size={15} /></>}
                    </button>
                  </div>
                )}
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* NO VACANCIES / WAITLIST DIALOG */}
      <AnimatePresence>
        {waitlistPromptOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0b1b12] border border-white/10 max-w-md w-full rounded-2xl p-6 text-center space-y-5"
            >
              <div className="w-12 h-12 rounded-full bg-yellow-500/10 text-yellow-500 flex items-center justify-center mx-auto">
                <ShieldAlert size={24} />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-white leading-tight font-sans">Vagas Esgotadas</h3>
                <p className="text-xs text-white/55 leading-relaxed font-light">
                  Infelizmente as vagas principais para esta data já acabaram. Você gostaria de entrar na Fila de Espera? Caso haja alguma desistência, entraremos em contato.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setWaitlistPromptOpen(false)}
                  className="flex-1 py-2.5 border border-white/5 rounded-xl hover:bg-white/5 text-white/70 text-xs font-semibold"
                >
                  Voltar
                </button>
                <button
                  onClick={() => submitRegistration(true)}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl text-black text-xs font-semibold flex items-center justify-center gap-1.5"
                  style={{ background: secondaryColor }}
                >
                  {submitting ? "Processando..." : "Entrar na Fila de Espera"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REGISTRATION SUCCESS DIALOG */}
      <AnimatePresence>
        {successData && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0b1b12] border border-white/10 max-w-md w-full rounded-2xl p-6 text-center space-y-6"
            >
              <div className="w-16 h-16 mx-auto">
                <img src="/logo-peniel.jpeg" alt="Peniel" className="w-full h-full object-contain rounded-xl" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-bold text-white leading-tight font-sans">
                  {successData.status === "fila_espera"
                    ? "Fila de Espera Confirmada!"
                    : "Inscrição Realizada!"}
                </h3>
                <p className="text-xs text-white/50 leading-relaxed font-light">
                  {successData.status === "fila_espera"
                    ? "Você foi colocado na fila de espera com sucesso. Se uma vaga for liberada, enviaremos uma mensagem automática."
                    : `Sua inscrição para o encontro "${successData.event?.title || "Peniel"}" foi confirmada. Uma mensagem automática de confirmação foi enviada para o seu WhatsApp.`}
                </p>
              </div>

              {/* Info Card */}
              <div className="p-4 rounded-xl bg-black/40 text-left space-y-2 border border-white/5">
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Detalhes do Evento</p>
                <p className="text-xs font-bold text-white">{successData.event?.title}</p>
                <div className="flex items-center gap-2 text-[11px] text-white/60">
                  <Calendar size={12} className="text-[#d4af37]" />
                  <span>{new Date(successData.event?.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })} às {successData.event?.time}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-white/60">
                  <MapPin size={12} className="text-[#d4af37]" />
                  <span className="truncate">{successData.event?.location}</span>
                </div>
              </div>

              {/* Código do ingresso */}
              {successData.checkInCode && (
                <div className="p-4 rounded-xl text-center border" style={{ borderColor: `${secondaryColor}40`, background: `${secondaryColor}0d` }}>
                  <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: accentColor }}>Seu código de ingresso</p>
                  <p className="text-2xl font-black font-mono tracking-[0.3em] text-white mt-1">{successData.checkInCode}</p>
                  <p className="text-[10px] text-white/40 mt-1">Guarde este código. O QR Code foi enviado ao seu WhatsApp e serve para o check-in no local.</p>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2.5">
                <button
                  onClick={handleDownloadPDF}
                  className="w-full py-3 rounded-xl text-black text-xs font-bold flex items-center justify-center gap-2 shadow-lg"
                  style={{ background: secondaryColor }}
                >
                  <Download size={14} />
                  Baixar Comprovante PDF
                </button>
                <button
                  onClick={() => setSuccessData(null)}
                  className="w-full py-3 border border-white/10 hover:bg-white/5 rounded-xl text-white/70 text-xs font-semibold"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
