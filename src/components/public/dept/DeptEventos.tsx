"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Calendar, MapPin, X, CheckCircle2, Ticket, Users, History } from "lucide-react";
import { tokens as T, Secao, TituloSecao } from "./DeptSiteRenderer";
import type { DeptEvento } from "./DeptSiteRenderer";

type Props = Record<string, unknown>;
const txt = (p: Props, k: string, d = "") => String(p[k] ?? d);
const num = (p: Props, k: string, d = 0) => Number(p[k] ?? d);
const bool = (p: Props, k: string, d = false) => Boolean(p[k] ?? d);

function moeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataCurta(iso: string | null) {
  if (!iso) return { dia: "--", mes: "", completa: "" };
  const d = new Date(iso);
  return {
    dia: String(d.getDate()).padStart(2, "0"),
    mes: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase(),
    completa: d.toLocaleString("pt-BR", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" }),
  };
}

/**
 * Bloco de eventos do departamento.
 *
 * Regra central: o botão de inscrição só existe enquanto `inscricoesAbertas`
 * for verdadeiro (prazo válido e vaga disponível — calculado no servidor).
 * Depois disso o evento migra para o histórico, que apenas registra que
 * aconteceu.
 */
export default function DeptEventos({
  p, variante, slug, abertos, historico,
}: {
  p: Props; variante: string; slug: string;
  abertos: DeptEvento[]; historico: DeptEvento[];
}) {
  const [inscrevendo, setInscrevendo] = useState<DeptEvento | null>(null);

  const limite = num(p, "limite", 6);
  const mostrarPassados = bool(p, "mostrarPassados", true);
  const lista = abertos.slice(0, limite);
  const passados = mostrarPassados ? historico.slice(0, limite) : [];

  if (!lista.length && !passados.length) return null;

  const destaque = variante === "destaque" ? lista[0] : null;
  const restantes = destaque ? lista.slice(1) : lista;

  return (
    <Secao>
      <TituloSecao>{txt(p, "titulo", "Próximos eventos")}</TituloSecao>

      {destaque && (
        <CardDestaque evento={destaque} p={p} onInscrever={() => setInscrevendo(destaque)} />
      )}

      {restantes.length > 0 && (
        <div className={variante === "lista" || variante === "agenda"
          ? "flex flex-col gap-3"
          : "grid gap-5"}
          style={variante === "lista" || variante === "agenda"
            ? undefined
            : { gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}
        >
          {restantes.map((ev) => (
            <CardEvento
              key={ev.id} evento={ev} p={p}
              compacto={variante === "lista" || variante === "agenda"}
              onInscrever={() => setInscrevendo(ev)}
            />
          ))}
        </div>
      )}

      {passados.length > 0 && (
        <div className="mt-14">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest" style={{ color: T.muted }}>
            <History size={15} /> Já aconteceram
          </h3>
          <div className="flex flex-col gap-2">
            {passados.map((ev) => {
              const d = dataCurta(ev.data_inicio);
              return (
                <div
                  key={ev.id}
                  className="flex items-center gap-4 px-4 py-3 opacity-60"
                  style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius }}
                >
                  <span className="text-xs font-semibold" style={{ color: T.muted }}>{d.dia}/{d.mes}</span>
                  <span className="flex-1 text-sm">{ev.nome}</span>
                  <span className="text-xs uppercase tracking-wide" style={{ color: T.muted }}>Encerrado</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <AnimatePresence>
        {inscrevendo && (
          <ModalInscricao
            evento={inscrevendo} slug={slug}
            onFechar={() => setInscrevendo(null)}
          />
        )}
      </AnimatePresence>
    </Secao>
  );
}

// ── Cards ────────────────────────────────────────────────────────────────────

function BotaoInscricao({ evento, p, onInscrever }: { evento: DeptEvento; p: Props; onInscrever: () => void }) {
  if (evento.inscricoesAbertas) {
    return (
      <button
        onClick={onInscrever}
        className="mt-4 w-full px-5 py-3 text-sm font-semibold transition-transform hover:scale-[1.02]"
        style={{ background: T.primary, color: "#fff", borderRadius: T.radius }}
      >
        {txt(p, "textoBotao", "Inscrever-se")}
        {!evento.gratuito && evento.valor > 0 && ` · ${moeda(evento.valor)}`}
      </button>
    );
  }

  // Sem inscrição possível: só o motivo, sem botão morto.
  const motivo = evento.lotado ? "Vagas esgotadas" : txt(p, "textoEncerrado", "Inscrições encerradas");
  return (
    <p className="mt-4 w-full py-3 text-center text-sm" style={{ color: T.muted, border: `1px dashed ${T.border}`, borderRadius: T.radius }}>
      {motivo}
    </p>
  );
}

function CardEvento({ evento, p, compacto, onInscrever }: {
  evento: DeptEvento; p: Props; compacto: boolean; onInscrever: () => void;
}) {
  const d = dataCurta(evento.data_inicio);

  if (compacto) {
    return (
      <div
        className="flex flex-wrap items-center gap-4 p-4"
        style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius }}
      >
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center" style={{ background: T.surfaceAlt, borderRadius: T.radius }}>
          <span className="text-lg font-bold leading-none">{d.dia}</span>
          <span className="text-[10px] tracking-wide" style={{ color: T.muted }}>{d.mes}</span>
        </div>
        <div className="min-w-[180px] flex-1">
          <p className="font-semibold">{evento.nome}</p>
          {evento.local && (
            <p className="flex items-center gap-1 text-sm" style={{ color: T.muted }}>
              <MapPin size={13} />{evento.local}
            </p>
          )}
        </div>
        <div className="w-full sm:w-48">
          <BotaoInscricao evento={evento} p={p} onInscrever={onInscrever} />
        </div>
      </div>
    );
  }

  return (
    <article
      className="flex flex-col overflow-hidden"
      style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: T.shadow }}
    >
      <div className="relative h-44 bg-cover bg-center" style={{ backgroundImage: evento.banner ? `url(${evento.banner})` : undefined, background: !evento.banner ? T.surfaceAlt : undefined }}>
        <div className="absolute left-3 top-3 flex h-14 w-14 flex-col items-center justify-center backdrop-blur" style={{ background: "rgba(0,0,0,.6)", borderRadius: T.radius, color: "#fff" }}>
          <span className="text-lg font-bold leading-none">{d.dia}</span>
          <span className="text-[10px]">{d.mes}</span>
        </div>
        {evento.vagasRestantes != null && evento.vagasRestantes <= 10 && evento.inscricoesAbertas && (
          <span className="absolute right-3 top-3 px-2 py-1 text-[11px] font-semibold" style={{ background: T.accent, color: T.bg, borderRadius: 999 }}>
            Últimas {evento.vagasRestantes} vagas
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-semibold leading-snug">{evento.nome}</h3>
        {evento.descricao && (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed" style={{ color: T.muted }}>{evento.descricao}</p>
        )}
        <div className="mt-3 flex flex-col gap-1 text-sm" style={{ color: T.muted }}>
          {d.completa && <span className="flex items-center gap-2"><Calendar size={14} />{d.completa}</span>}
          {evento.local && <span className="flex items-center gap-2"><MapPin size={14} />{evento.local}</span>}
        </div>
        <div className="mt-auto">
          <BotaoInscricao evento={evento} p={p} onInscrever={onInscrever} />
        </div>
      </div>
    </article>
  );
}

function CardDestaque({ evento, p, onInscrever }: { evento: DeptEvento; p: Props; onInscrever: () => void }) {
  const d = dataCurta(evento.data_inicio);
  return (
    <div
      className="mb-8 grid gap-0 overflow-hidden md:grid-cols-2"
      style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: T.radius, boxShadow: T.shadow }}
    >
      <div className="min-h-[240px] bg-cover bg-center" style={{ backgroundImage: evento.banner ? `url(${evento.banner})` : undefined, background: !evento.banner ? T.heroOverlay : undefined }} />
      <div className="flex flex-col justify-center p-8">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: T.accent }}>Próximo evento</span>
        <h3 className="mt-2 text-3xl font-bold leading-tight" style={{ fontFamily: T.fontTitle }}>{evento.nome}</h3>
        {evento.descricao && <p className="mt-3 leading-relaxed" style={{ color: T.muted }}>{evento.descricao}</p>}
        <div className="mt-4 flex flex-col gap-1 text-sm" style={{ color: T.muted }}>
          {d.completa && <span className="flex items-center gap-2"><Calendar size={15} />{d.completa}</span>}
          {evento.local && <span className="flex items-center gap-2"><MapPin size={15} />{evento.local}</span>}
          {evento.vagasRestantes != null && <span className="flex items-center gap-2"><Users size={15} />{evento.vagasRestantes} vagas restantes</span>}
        </div>
        <BotaoInscricao evento={evento} p={p} onInscrever={onInscrever} />
      </div>
    </div>
  );
}

// ── Modal de inscrição (fluxo Peniel) ────────────────────────────────────────

interface CampoExtra { key: string; label: string; type: string; options?: string[]; required?: boolean }

function mascaraCpf(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function mascaraTelefone(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

function ModalInscricao({ evento, slug, onFechar }: {
  evento: DeptEvento; slug: string; onFechar: () => void;
}) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [email, setEmail] = useState("");
  const [extras, setExtras] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<{
    codigo: string; qrUrl: string | null; pagamentoPendente: boolean;
    paymentLink?: string | null; valorTotal: number; mensagem?: string | null;
  } | null>(null);

  const camposExtras: CampoExtra[] = Array.isArray(evento.form?.campos_extras)
    ? (evento.form!.campos_extras as CampoExtra[])
    : [];

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/public/dept/${slug}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: evento.id,
          nome, telefone, cpf, email: email || undefined,
          camposExtras: extras,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "Não foi possível concluir a inscrição.");
      setSucesso(json.inscricao);
    } catch (err) {
      setErro((err as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  const inputStyle = {
    background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.radius, color: T.text,
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-0 sm:items-center sm:p-6"
      style={{ background: "rgba(0,0,0,.7)" }}
      onClick={onFechar}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", damping: 26, stiffness: 260 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden"
        style={{ background: T.surface, borderRadius: T.radius, border: `1px solid ${T.border}`, color: T.text }}
      >
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: `1px solid ${T.border}` }}>
          <h3 className="font-semibold">{sucesso ? "Inscrição confirmada" : "Inscrição"}</h3>
          <button onClick={onFechar} aria-label="Fechar"><X size={18} style={{ color: T.muted }} /></button>
        </div>

        {sucesso ? (
          <div className="flex flex-col items-center gap-4 p-8 text-center">
            <CheckCircle2 size={48} style={{ color: T.accent }} />
            <div>
              <p className="text-lg font-semibold">{evento.nome}</p>
              <p className="text-sm" style={{ color: T.muted }}>
                {sucesso.pagamentoPendente
                  ? "Inscrição registrada — falta o pagamento."
                  : "Sua vaga está garantida."}
              </p>
            </div>

            {sucesso.qrUrl && !sucesso.pagamentoPendente && (
              <img src={sucesso.qrUrl} alt="QR code do ingresso" className="h-44 w-44 rounded-lg bg-white p-2" />
            )}

            <div className="w-full px-4 py-3" style={{ background: T.bg, borderRadius: T.radius }}>
              <p className="text-xs uppercase tracking-widest" style={{ color: T.muted }}>Seu código</p>
              <p className="font-mono text-2xl font-bold tracking-[0.2em]">{sucesso.codigo}</p>
            </div>

            {sucesso.pagamentoPendente && sucesso.paymentLink && (
              <a
                href={sucesso.paymentLink} target="_blank" rel="noreferrer"
                className="w-full px-5 py-3 text-sm font-semibold"
                style={{ background: T.primary, color: "#fff", borderRadius: T.radius }}
              >
                Pagar {moeda(sucesso.valorTotal)}
              </a>
            )}

            <p className="text-xs" style={{ color: T.muted }}>
              Enviamos os detalhes no seu WhatsApp. Guarde o código para o check-in.
            </p>
          </div>
        ) : (
          <form onSubmit={enviar} className="flex flex-col gap-3 p-6">
            <p className="text-sm" style={{ color: T.muted }}>
              <Ticket size={14} className="mr-1 inline" />
              {evento.gratuito || evento.valor <= 0 ? "Evento gratuito" : `Valor: ${moeda(evento.valor)}`}
            </p>

            <input
              required placeholder="Nome completo" value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="px-4 py-3 text-sm outline-none" style={inputStyle}
            />
            <input
              required placeholder="Telefone com DDD" value={telefone} inputMode="numeric"
              onChange={(e) => setTelefone(mascaraTelefone(e.target.value))}
              className="px-4 py-3 text-sm outline-none" style={inputStyle}
            />
            <input
              required placeholder="CPF" value={cpf} inputMode="numeric"
              onChange={(e) => setCpf(mascaraCpf(e.target.value))}
              className="px-4 py-3 text-sm outline-none" style={inputStyle}
            />
            <input
              type="email" placeholder="E-mail (opcional)" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="px-4 py-3 text-sm outline-none" style={inputStyle}
            />

            {camposExtras.map((c) => (
              c.type === "select" ? (
                <select
                  key={c.key} required={c.required} value={extras[c.key] ?? ""}
                  onChange={(e) => setExtras({ ...extras, [c.key]: e.target.value })}
                  className="px-4 py-3 text-sm outline-none" style={inputStyle}
                >
                  <option value="">{c.label}</option>
                  {(c.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  key={c.key} required={c.required} placeholder={c.label} type={c.type || "text"}
                  value={extras[c.key] ?? ""}
                  onChange={(e) => setExtras({ ...extras, [c.key]: e.target.value })}
                  className="px-4 py-3 text-sm outline-none" style={inputStyle}
                />
              )
            ))}

            {erro && <p className="text-sm" style={{ color: "#ef4444" }}>{erro}</p>}

            <button
              type="submit" disabled={enviando}
              className="mt-1 px-6 py-3 text-sm font-semibold disabled:opacity-60"
              style={{ background: T.primary, color: "#fff", borderRadius: T.radius }}
            >
              {enviando ? "Enviando…" : "Confirmar inscrição"}
            </button>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
}
