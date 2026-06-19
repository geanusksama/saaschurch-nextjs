"use client";

import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import {
  X, Calendar, MapPin, Clock, ArrowRight, ArrowLeft, Loader2, Sparkles, Check, CheckCircle2,
  Download, Paperclip, CreditCard, ShieldAlert, User, Phone, Users, FileText
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

interface PenielRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSelectedEvent?: PenielEvent | null;
}

export function PenielRegistrationModal({ isOpen, onClose, initialSelectedEvent = null }: PenielRegistrationModalProps) {
  const navigate = useNavigate();
  const [events, setEvents] = useState<PenielEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<PenielEvent | null>(null);

  // Form States
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

  // Extra/Conditional fields
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

  // Form submission / step states
  const [formStep, setFormStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [paymentPromiseDate, setPaymentPromiseDate] = useState("");
  const [proofUrl, setProofUrl] = useState("");
  const [proofFileName, setProofFileName] = useState("");
  const [proofUploading, setProofUploading] = useState(false);
  const proofInputRef = useRef<HTMLInputElement>(null);

  // Dialog states
  const [waitlistPromptOpen, setWaitlistPromptOpen] = useState(false);
  const [successData, setSuccessData] = useState<any | null>(null);

  const slideContainerRef = useRef<HTMLDivElement>(null);

  // Load events
  useEffect(() => {
    if (!isOpen) return;
    
    async function fetchEvents() {
      setLoadingEvents(true);
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const campoId = urlParams.get("campoId") || "";
        const campo = urlParams.get("campo") || "";
        const q = campoId ? `campoId=${encodeURIComponent(campoId)}` : campo ? `campo=${encodeURIComponent(campo)}` : "";
        const eventsUrl = q ? `/api/peniel/events?futureOnly=true&${q}` : "/api/peniel/events?futureOnly=true";
        
        const res = await fetch(eventsUrl);
        if (res.ok) {
          const data = await res.json();
          setEvents(data);
        }
      } catch (err) {
        console.error("Erro ao carregar eventos:", err);
      } finally {
        setLoadingEvents(false);
      }
    }
    
    fetchEvents();
  }, [isOpen]);

  // Set initial selected event if passed
  useEffect(() => {
    if (initialSelectedEvent) {
      setSelectedEvent(initialSelectedEvent);
    }
  }, [initialSelectedEvent]);

  // Reset form when modal closes or opens
  useEffect(() => {
    if (!isOpen) {
      setSelectedEvent(null);
      resetForm();
    }
  }, [isOpen]);

  const handleSelectEvent = (event: PenielEvent) => {
    setSelectedEvent(event);
    setErrorMsg("");
    setFormStep(1);
    setPaymentPromiseDate("");
    setProofUrl("");
    setProofFileName("");
  };

  const handleGoBackToEvents = () => {
    if (initialSelectedEvent) {
      onClose();
    } else {
      setSelectedEvent(null);
      resetForm();
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
    setErrorMsg("");
  };

  // Mask function for Brazilian phone
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

  const handleProofUpload = async (file: File) => {
    if (!file) return;
    setProofUploading(true);
    setErrorMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/peniel/upload-proof", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Falha no upload");
      setProofUrl(json.url);
      setProofFileName(file.name);
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao enviar o comprovante.");
    } finally {
      setProofUploading(false);
    }
  };

  const handleFormStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;
    
    // Validations
    if (contacts.filter(c => c.nome.trim() !== "").length < 3) {
      setErrorMsg("Por favor, preencha pelo menos os 3 primeiros contatos obrigatórios.");
      return;
    }

    if (Number(selectedEvent.value) === 0) {
      submitRegistration(false);
    } else {
      setFormStep(2);
      setErrorMsg("");
    }
  };

  const submitRegistration = async (isWaitlistOverride = false) => {
    if (!selectedEvent) return;

    setErrorMsg("");
    setSubmitting(true);

    const payload = {
      eventId: selectedEvent.id,
      tipoParticipante: "encontrista",
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
        setSuccessData(data);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Erro de conexão ao enviar a inscrição.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPDF = async () => {
    const data = successData;
    if (!data) return;

    const doc = new jsPDF();
    doc.setFillColor(11, 40, 25);
    doc.rect(0, 0, 210, 35, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("PENIEL", 105, 18, { align: "center" });
    doc.setFontSize(10);
    doc.text("Sede AD Campinas", 105, 26, { align: "center" });

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("COMPROVANTE DE INSCRIÇÃO", 105, 55, { align: "center" });

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

    doc.setFont("helvetica", "bold");
    doc.text("DADOS DO INSCRITO", 15, 120);
    doc.line(15, 122, 195, 122);

    doc.setFont("helvetica", "normal");
    doc.text(`Protocolo: ${data.id.slice(0, 8).toUpperCase()}`, 15, 130);
    doc.text(`Nome: ${data.nome}`, 15, 137);
    doc.text(`Tipo: Encontrista (Vai participar)`, 15, 144);
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
      } catch (e) { }
    }

    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("Este comprovante foi gerado automaticamente pelo sistema SaasChurch.", 105, 285, { align: "center" });

    doc.save(`comprovante-peniel-${data.nome.toLowerCase().replace(/\s+/g, "-")}.pdf`);
  };

  const handleCloseSuccess = () => {
    setSuccessData(null);
    onClose();
  };

  if (!isOpen) return null;

  // Extra config evaluation
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

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-300 font-sans">
      <div className="bg-[#f8fafc] text-slate-800 w-full max-w-2xl md:max-w-3xl h-[90vh] max-h-[750px] rounded-3xl shadow-2xl flex flex-col relative overflow-hidden animate-in fade-in zoom-in-95 duration-250 border border-slate-200">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-white flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-3">
            {selectedEvent ? (
              <button 
                onClick={handleGoBackToEvents}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-colors"
                title="Voltar"
              >
                <ArrowLeft size={18} />
              </button>
            ) : (
              <img src="/logo-peniel.jpeg" alt="Peniel Logo" className="w-8 h-8 rounded-lg object-cover" />
            )}
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                {selectedEvent ? "Ficha de Inscrição" : "Inscrições Disponíveis — Peniel"}
              </h3>
              <span className="text-[10px] font-semibold text-slate-400 block mt-0.5 uppercase tracking-wider">
                {selectedEvent 
                  ? `Evento: ${selectedEvent.title} ${Number(selectedEvent.value) > 0 ? `• Etapa ${formStep} de 2` : ""}`
                  : "Selecione um dos encontros agendados"
                }
              </span>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Sliding View Area */}
        <div className="flex-1 relative overflow-hidden">
          <div 
            ref={slideContainerRef}
            className="flex w-[200%] h-full transition-transform duration-500 ease-out"
            style={{ transform: selectedEvent ? "translateX(-50%)" : "translateX(0%)" }}
          >
            {/* VIEW 1: Event List (Left Panel) */}
            <div className="w-1/2 h-full flex flex-col justify-between overflow-y-auto px-6 py-6 space-y-6">
              
              <div className="flex-1 space-y-6">
                {loadingEvents ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 size={32} className="animate-spin text-slate-400" />
                    <span className="text-slate-400 text-xs font-semibold uppercase tracking-widest animate-pulse">Buscando Encontros...</span>
                  </div>
                ) : events.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {events.map((event) => {
                      const isFree = Number(event.value) === 0;
                      return (
                        <div 
                          key={event.id}
                          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between gap-4 h-full group"
                        >
                          <div>
                            <div className="flex items-start justify-between">
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-600 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                {event.status === "publicado" ? "Confirmado" : event.status}
                              </span>
                              <Sparkles size={16} className="text-[#d4af37] opacity-60" />
                            </div>

                            <h4 className="text-base font-extrabold text-slate-900 tracking-tight mt-2 leading-tight group-hover:text-emerald-800 transition-colors">
                              {event.title}
                            </h4>
                            
                            {event.description && (
                              <p className="text-xs text-slate-500 font-light mt-1 line-clamp-2 leading-relaxed">
                                {event.description}
                              </p>
                            )}

                            {/* Details list */}
                            <div className="space-y-2 mt-4 text-xs text-slate-600">
                              <div className="flex items-center gap-2">
                                <Calendar size={13} className="text-slate-400" />
                                <span className="font-semibold text-slate-700">
                                  {event.dateLabel || new Date(event.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock size={13} className="text-slate-400" />
                                <span>{event.time}</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <MapPin size={13} className="text-slate-400 mt-0.5" />
                                <div className="flex flex-col min-w-0">
                                  <span className="truncate">{event.location}</span>
                                  {event.departureLocation && (
                                    <span className="text-[9px] text-slate-400 font-light">Saída: {event.departureLocation}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="pt-4 border-t border-slate-100 flex items-center justify-between mt-auto">
                            <div>
                              <span className="text-[9px] text-slate-400 uppercase tracking-widest font-semibold block">Valor</span>
                              <span className="text-sm font-black text-slate-800">
                                {isFree ? "Gratuito" : event.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              </span>
                            </div>

                            <button
                              onClick={() => handleSelectEvent(event)}
                              className="px-4 py-2 rounded-xl text-xs font-black tracking-wider uppercase bg-[#22c55e] text-white hover:bg-emerald-600 shadow-sm transition-all flex items-center gap-1 hover:scale-105 active:scale-95"
                            >
                              Fazer minha inscrição
                              <ArrowRight size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-200 max-w-md mx-auto">
                    <p className="text-sm text-slate-500 font-light">Nenhum encontro com inscrições abertas no momento.</p>
                  </div>
                )}
              </div>

              {/* Bottom navigation link inside Event List */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-center shrink-0">
                <button
                  onClick={() => { onClose(); navigate("/peniel"); }}
                  className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors py-1.5 px-3 rounded-full hover:bg-slate-100"
                >
                  <FileText size={14} className="text-[#d4af37]" />
                  Visitar página do Peniel e Testemunhos
                </button>
              </div>

            </div>

            {/* VIEW 2: Registration Form (Right Panel) */}
            <div className="w-1/2 h-full flex flex-col overflow-hidden bg-white">
              
              {/* Form container scroll area */}
              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                
                {errorMsg && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-2.5 text-xs">
                    <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                    <p className="font-semibold">{errorMsg}</p>
                  </div>
                )}

                {selectedEvent && (
                  <form onSubmit={handleFormStep1Submit} className="space-y-6 text-xs text-slate-700">
                    
                    {/* ETAPA 1: Cadastro dos dados */}
                    {formStep === 1 && (
                      <>
                        {/* CATEGORY 1: Dados Pessoais */}
                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-2">
                            <User size={15} className="text-emerald-600" />
                            <h4 className="text-[10px] font-extrabold tracking-widest text-slate-600 uppercase">1. Dados Pessoais</h4>
                          </div>

                          <div className="space-y-1">
                            <label className="text-slate-500 font-semibold block">Nome Completo *</label>
                            <input
                              type="text"
                              required
                              value={nome}
                              onChange={e => setNome(e.target.value)}
                              placeholder="Digite seu nome completo"
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] text-xs"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-slate-500 font-semibold block">Endereço Completo *</label>
                            <input
                              type="text"
                              required
                              value={endereco}
                              onChange={e => setEndereco(e.target.value)}
                              placeholder="Rua, número, complemento, bairro, cidade - UF"
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] text-xs"
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <label className="text-slate-500 font-semibold block">Nascimento *</label>
                              <input
                                type="date"
                                required
                                value={dataNascimento}
                                onChange={e => setDataNascimento(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#d4af37] text-[11px]"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-slate-500 font-semibold block">Estado Civil</label>
                              <select
                                value={estadoCivil}
                                onChange={e => setEstadoCivil(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#d4af37] text-xs"
                              >
                                <option value="Solteiro">Solteiro</option>
                                <option value="Casado">Casado</option>
                                <option value="Divorciado">Divorciado</option>
                                <option value="Viúvo">Viúvo</option>
                                <option value="Outro">Outro</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <label className="text-slate-500 font-semibold block">Idade *</label>
                              <input
                                type="number"
                                required
                                value={idade}
                                onChange={e => setIdade(e.target.value)}
                                placeholder="Ex: 25"
                                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#d4af37] text-xs"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-slate-500 font-semibold block">WhatsApp *</label>
                              <input
                                type="tel"
                                required
                                value={celular}
                                onChange={e => setCelular(maskPhone(e.target.value))}
                                placeholder="(19) 99999-9999"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] text-xs"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-slate-500 font-semibold block">Igreja que frequenta *</label>
                              <input
                                type="text"
                                required
                                value={igrejaBase}
                                onChange={e => setIgrejaBase(e.target.value)}
                                placeholder="Ex: AD Campinas Sede"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37] text-xs"
                              />
                            </div>
                          </div>

                          <label className="flex items-center gap-3 p-2 rounded-xl border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition-colors">
                            <input
                              type="checkbox"
                              checked={batizadoAguas}
                              onChange={e => setBatizadoAguas(e.target.checked)}
                              className="w-4 h-4 accent-[#22c55e] cursor-pointer"
                            />
                            <span className="font-semibold text-slate-700">É batizado nas águas?</span>
                          </label>
                        </div>

                        {/* CATEGORY 2: Grupo Familiar */}
                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-2">
                            <Users size={15} className="text-emerald-600" />
                            <h4 className="text-[10px] font-extrabold tracking-widest text-slate-600 uppercase">2. Célula / Grupo Familiar</h4>
                          </div>

                          <label className="flex items-center gap-3 p-2 rounded-xl border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition-colors">
                            <input
                              type="checkbox"
                              checked={participaGrupoFamiliar}
                              onChange={e => setParticipaGrupoFamiliar(e.target.checked)}
                              className="w-4 h-4 accent-[#22c55e] cursor-pointer"
                            />
                            <span className="font-semibold text-slate-700">Participa de Célula ou Grupo Familiar?</span>
                          </label>

                          {participaGrupoFamiliar && (
                            <div className="grid grid-cols-2 gap-3 pt-2">
                              <div className="space-y-1">
                                <label className="text-slate-500 font-semibold block">Qual Célula? *</label>
                                <input
                                  type="text"
                                  required
                                  value={grupoFamiliarQual}
                                  onChange={e => setGrupoFamiliarQual(e.target.value)}
                                  placeholder="Nome/Número"
                                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#d4af37] text-xs"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-slate-500 font-semibold block">Nome do Líder *</label>
                                <input
                                  type="text"
                                  required
                                  value={nomeLider}
                                  onChange={e => setNomeLider(e.target.value)}
                                  placeholder="Líder da Célula"
                                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#d4af37] text-xs"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* CATEGORY 3: Informações Condicionais */}
                        {(showSpouse || showChildren || showEcc) && (
                          <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                            <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-2">
                              <FileText size={15} className="text-emerald-600" />
                              <h4 className="text-[10px] font-extrabold tracking-widest text-slate-600 uppercase">3. Informações Especiais</h4>
                            </div>

                            {showSpouse && (
                              <div className="space-y-1">
                                <label className="text-slate-500 font-semibold block">Nome Completo do Cônjuge *</label>
                                <input
                                  type="text"
                                  required
                                  value={spouseName}
                                  onChange={e => setSpouseName(e.target.value)}
                                  placeholder="Nome completo do cônjuge"
                                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#d4af37] text-xs"
                                />
                              </div>
                            )}

                            {showChildren && (
                              <div className="space-y-3">
                                <label className="flex items-center gap-3 p-2 rounded-xl border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition-colors">
                                  <input
                                    type="checkbox"
                                    checked={hasChildren}
                                    onChange={e => setHasChildren(e.target.checked)}
                                    className="w-4 h-4 accent-[#22c55e] cursor-pointer"
                                  />
                                  <span className="font-semibold text-slate-700">Você possui filhos?</span>
                                </label>
                                
                                {hasChildren && (
                                  <div className="space-y-1">
                                    <label className="text-slate-500 font-semibold block">Nomes e Idades dos Filhos *</label>
                                    <textarea
                                      rows={2}
                                      required
                                      value={childrenDetails}
                                      onChange={e => setChildrenDetails(e.target.value)}
                                      placeholder="Ex: Clara (6 anos), Arthur (1 ano)"
                                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#d4af37] text-xs resize-none"
                                    />
                                  </div>
                                )}
                              </div>
                            )}

                            {showEcc && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-slate-500 font-semibold block">Congregação *</label>
                                  <input
                                    type="text"
                                    required
                                    value={ecclesiasticalCongregation}
                                    onChange={e => setEcclesiasticalCongregation(e.target.value)}
                                    placeholder="Igreja local"
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#d4af37] text-xs"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-slate-500 font-semibold block">Cargo Eclesiástico *</label>
                                  <input
                                    type="text"
                                    required
                                    value={ecclesiasticalCargo}
                                    onChange={e => setEcclesiasticalCargo(e.target.value)}
                                    placeholder="Ex: Cooperador, Diácono, Membro"
                                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#d4af37] text-xs"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* CATEGORY 4: Contatos de Emergência */}
                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                          <div className="border-b border-slate-200 pb-2 mb-2">
                            <div className="flex items-center gap-2">
                              <Phone size={15} className="text-emerald-600" />
                              <h4 className="text-[10px] font-extrabold tracking-widest text-slate-600 uppercase">4. Contatos de Emergência</h4>
                            </div>
                            <p className="text-[9px] text-slate-400 font-light mt-0.5">Cite as 5 pessoas mais importantes da sua vida. As 3 primeiras são obrigatórias.</p>
                          </div>

                          <div className="space-y-3">
                            {contacts.map((contact, i) => (
                              <div key={i} className="p-3 rounded-xl border border-slate-200 bg-white space-y-2">
                                <span className="text-[9px] font-bold text-slate-400 block uppercase">
                                  Pessoa #{i + 1} {i < 3 ? <span className="text-rose-500">*</span> : <span className="opacity-60 text-[8px]">(opcional)</span>}
                                </span>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    required={i < 3}
                                    placeholder="Nome Completo"
                                    value={contact.nome}
                                    onChange={e => handleContactChange(i, "nome", e.target.value)}
                                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-[11px] focus:outline-none focus:border-[#d4af37]"
                                  />
                                  <input
                                    type="text"
                                    required={i < 3}
                                    placeholder="WhatsApp (ex: 19 99999-9999)"
                                    value={contact.whatsapp}
                                    onChange={e => handleContactChange(i, "whatsapp", maskPhone(e.target.value))}
                                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-[11px] focus:outline-none focus:border-[#d4af37]"
                                  />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    required={i < 3}
                                    placeholder="Parentesco (Mãe, Cônjuge)"
                                    value={contact.parentesco}
                                    onChange={e => handleContactChange(i, "parentesco", e.target.value)}
                                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-[11px] focus:outline-none focus:border-[#d4af37]"
                                  />
                                  <input
                                    type="text"
                                    required={i < 3}
                                    placeholder="Qual sua relação com ela?"
                                    value={contact.relacao}
                                    onChange={e => handleContactChange(i, "relacao", e.target.value)}
                                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-[11px] focus:outline-none focus:border-[#d4af37]"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* CATEGORY 5: Motivação */}
                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-2">
                            <Sparkles size={15} className="text-emerald-600" />
                            <h4 className="text-[10px] font-extrabold tracking-widest text-slate-600 uppercase">5. Motivação e Expectativas</h4>
                          </div>

                          <div className="space-y-1">
                            <label className="text-slate-500 font-semibold block">Quem te motivou a fazer o Peniel? *</label>
                            <input
                              type="text"
                              required
                              value={quemMotivou}
                              onChange={e => setQuemMotivou(e.target.value)}
                              placeholder="Nome de quem te indicou/motivou"
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#d4af37] text-xs"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-slate-500 font-semibold block">Por que você decidiu fazer este Encontro? *</label>
                            <textarea
                              required
                              rows={3}
                              value={porqueDecidiu}
                              onChange={e => setPorqueDecidiu(e.target.value)}
                              placeholder="Fale brevemente do seu motivo"
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#d4af37] text-xs resize-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-slate-500 font-semibold block">Quais suas expectativas para este Encontro? *</label>
                            <textarea
                              required
                              rows={3}
                              value={expectativas}
                              onChange={e => setExpectativas(e.target.value)}
                              placeholder="O que você espera viver lá?"
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#d4af37] text-xs resize-none"
                            />
                          </div>
                        </div>

                        {/* CATEGORY 6: Dados Físicos e Saúde */}
                        <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
                          <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-2">
                            <ShieldAlert size={15} className="text-emerald-600" />
                            <h4 className="text-[10px] font-extrabold tracking-widest text-slate-600 uppercase">6. Dados Físicos & Saúde</h4>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-slate-500 font-semibold block">Peso (kg) *</label>
                              <input
                                type="number"
                                step="0.1"
                                required
                                value={peso}
                                onChange={e => setPeso(e.target.value)}
                                placeholder="Ex: 75.5"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#d4af37] text-xs"
                              />
                            </div>

                            <div className="space-y-1">
                              <label className="text-slate-500 font-semibold block">Altura (m) *</label>
                              <input
                                type="number"
                                step="0.01"
                                min="0.5"
                                max="2.6"
                                required
                                value={altura}
                                onChange={e => setAltura(e.target.value)}
                                placeholder="Ex: 1.75"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#d4af37] text-xs"
                              />
                              <p className="text-[9px] text-slate-400">Insira com ponto. Ex: 1.75</p>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-slate-500 font-semibold block">Usa algum medicamento de uso contínuo? Quais?</label>
                            <textarea
                              rows={2}
                              value={medicamentos}
                              onChange={e => setMedicamentos(e.target.value)}
                              placeholder="Nome dos medicamentos (se usar)"
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#d4af37] text-xs resize-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-slate-500 font-semibold block">Tem alergia a medicamentos ou restrição alimentar?</label>
                            <textarea
                              rows={2}
                              value={alergiasRestricoes}
                              onChange={e => setAlergiasRestricoes(e.target.value)}
                              placeholder="Descreva se possuir alergias ou restrições"
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#d4af37] text-xs resize-none"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-slate-500 font-semibold block">Possui apneia do sono (ronca)? *</label>
                            <div className="grid grid-cols-2 gap-3">
                              {(["sim", "nao"] as const).map(opt => (
                                <label
                                  key={opt}
                                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                                    apneia === opt
                                      ? "border-[#d4af37] bg-amber-500/10 font-bold"
                                      : "border-slate-200 bg-white hover:bg-slate-50"
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name="apneia"
                                    required
                                    checked={apneia === opt}
                                    onChange={() => setApneia(opt)}
                                    className="accent-[#d4af37] cursor-pointer"
                                  />
                                  <span className="text-slate-800">{opt === "sim" ? "Sim" : "Não"}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>

                      </>
                    )}

                    {/* ETAPA 2: Pagamento do ingresso */}
                    {formStep === 2 && (
                      <div className="space-y-5">
                        <button
                          type="button"
                          onClick={() => { setFormStep(1); setErrorMsg(""); }}
                          className="text-xs font-semibold inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors"
                        >
                          <ArrowLeft size={14} /> Voltar para a ficha de inscrição
                        </button>

                        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 space-y-3">
                          <div className="flex items-center gap-2">
                            <CreditCard size={16} className="text-[#d4af37]" />
                            <h4 className="text-[11px] font-extrabold tracking-widest text-slate-600 uppercase">Pagamento da Ficha</h4>
                          </div>
                          <p className="text-sm text-slate-700">
                            Valor do Encontro: <span className="font-extrabold text-slate-900">{selectedEvent.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                          </p>
                          
                          {selectedEvent.paymentLink ? (
                            <a
                              href={selectedEvent.paymentLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-[#22c55e] text-white hover:bg-emerald-600 shadow-sm transition-all"
                            >
                              <CreditCard size={16} /> Ir para o pagamento
                            </a>
                          ) : (
                            <p className="text-xs text-slate-500 font-light">O link de pagamento será disponibilizado pela equipe. Por favor, defina uma previsão abaixo.</p>
                          )}
                          <p className="text-[11px] text-slate-400">Não feche este modal — após pagar no link acima, faça o upload do seu comprovante aqui.</p>
                        </div>

                        {/* Previsão de pagamento */}
                        <div className="space-y-1">
                          <label className="text-slate-500 font-semibold block">Data prevista para o pagamento</label>
                          <input
                            type="date"
                            value={paymentPromiseDate}
                            onChange={e => setPaymentPromiseDate(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#d4af37] text-xs"
                          />
                        </div>

                        {/* Upload de Comprovante */}
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-3">
                          <label className="text-xs font-semibold text-slate-700 block">Comprovante de pagamento</label>
                          <input
                            ref={proofInputRef}
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) handleProofUpload(file);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => proofInputRef.current?.click()}
                            disabled={proofUploading}
                            className="w-full py-2.5 rounded-xl text-xs font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                          >
                            {proofUploading ? (
                              <><Loader2 size={14} className="animate-spin text-slate-500" /> Enviando...</>
                            ) : (
                              <><Paperclip size={14} /> {proofUrl ? "Trocar comprovante" : "Anexar comprovante"}</>
                            )}
                          </button>
                          {proofUrl && (
                            <div className="flex items-center gap-2 text-xs text-emerald-600 font-semibold">
                              <CheckCircle2 size={14} /> {proofFileName || "Comprovante anexado"}
                            </div>
                          )}
                        </div>

                        {/* Submit Actions */}
                        <div className="space-y-2.5 pt-2">
                          <button
                            type="button"
                            disabled={!proofUrl || submitting}
                            onClick={() => submitRegistration(false)}
                            className="w-full py-3 rounded-xl text-white font-bold bg-[#22c55e] hover:bg-emerald-600 shadow-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                          >
                            <Check size={16} /> {submitting ? "Enviando..." : "Enviar com comprovante"}
                          </button>
                          
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => submitRegistration(false)}
                            className="w-full py-3 rounded-xl text-slate-700 border border-slate-300 bg-white hover:bg-slate-50 font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                          >
                            Enviar sem comprovante (pagar depois)
                          </button>

                          <p className="text-[11px] text-center text-slate-400 font-light">
                            Caso opte por enviar sem comprovante, sua vaga ficará como <b>pagamento pendente</b> até que a equipe verifique.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Bottom buttons for Step 1 */}
                    {formStep === 1 && (
                      <div className="pt-4 flex gap-3 border-t border-slate-100 shrink-0 bg-white">
                        <button
                          type="button"
                          onClick={handleGoBackToEvents}
                          className="flex-1 py-3 border border-slate-300 rounded-xl hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-all"
                        >
                          Voltar
                        </button>
                        <button
                          type="submit"
                          disabled={submitting}
                          className="flex-1 py-3 rounded-xl text-white font-bold bg-[#22c55e] hover:bg-emerald-600 shadow-md transition-all flex items-center justify-center gap-1.5 hover:scale-102 active:scale-98"
                        >
                          {Number(selectedEvent.value) === 0 ? (
                            submitting ? "Processando..." : "Concluir"
                          ) : (
                            <>Avançar <ArrowRight size={14} /></>
                          )}
                        </button>
                      </div>
                    )}

                  </form>
                )}

              </div>

            </div>

          </div>
        </div>

      </div>

      {/* WAITLIST DIALOG */}
      {waitlistPromptOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1b12] border border-white/10 max-w-md w-full rounded-2xl p-6 text-center space-y-5 animate-in zoom-in-95 duration-200">
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
                className="flex-1 py-2.5 rounded-xl text-black text-xs font-semibold flex items-center justify-center gap-1.5 bg-[#d4af37]"
              >
                {submitting ? "Processando..." : "Entrar na Fila de Espera"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS DIALOG */}
      {successData && (
        <div className="fixed inset-0 z-55 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0b1b12] border border-white/10 max-w-md w-full rounded-2xl p-6 text-center space-y-6 animate-in zoom-in-95 duration-200">
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

            <div className="p-4 rounded-xl bg-black/40 text-left space-y-2 border border-white/5 text-xs">
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

            {successData.checkInCode && (
              <div className="p-4 rounded-xl text-center border border-amber-500/30 bg-amber-500/5">
                <p className="text-[10px] uppercase tracking-widest font-bold text-amber-500">Seu código de ingresso</p>
                <p className="text-2xl font-black font-mono tracking-[0.3em] text-white mt-1">{successData.checkInCode}</p>
                <p className="text-[10px] text-white/40 mt-1">O QR Code foi enviado ao seu WhatsApp e serve para o check-in no local.</p>
              </div>
            )}

            <div className="space-y-2.5">
              <button
                onClick={handleDownloadPDF}
                className="w-full py-3 rounded-xl text-black text-xs font-bold flex items-center justify-center gap-2 shadow-lg bg-[#d4af37]"
              >
                <Download size={14} />
                Baixar Comprovante PDF
              </button>
              <button
                onClick={handleCloseSuccess}
                className="w-full py-3 border border-white/10 hover:bg-white/5 rounded-xl text-white/70 text-xs font-semibold"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
