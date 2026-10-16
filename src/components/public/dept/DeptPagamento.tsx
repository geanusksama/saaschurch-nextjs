"use client";

/**
 * Pagamento pelo Asaas nos sites de departamento (loja e inscrição em evento).
 * Pix na tela ou cartão na página segura do Asaas; a confirmação vem do
 * servidor (webhook / consulta ao Asaas). Sem link colado nem comprovante.
 */
import { useEffect, useState } from "react";
import { Check, Copy, CreditCard, ExternalLink, Loader2, QrCode } from "lucide-react";
import { tokens as T } from "./DeptSiteRenderer";

interface Resultado { cobrancaId: string; status: string; valor: number; invoiceUrl?: string | null; pix?: { payload: string; imagem: string } | null }
const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function DeptPagamento({ tipo, id, token, valor, onPago }: { tipo: "pedido" | "inscricao"; id: string; token: string; valor: number; onPago?: () => void }) {
  const [metodo, setMetodo] = useState<"PIX" | "CARTAO">("PIX");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [res, setRes] = useState<Resultado | null>(null);
  const [pago, setPago] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!res || pago) return;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/public/pagamentos/status/${res.cobrancaId}`, { cache: "no-store" });
        const d = await r.json();
        if (d.status === "PAGO") { setPago(true); onPago?.(); }
      } catch { /* tenta de novo */ }
    }, 4000);
    return () => clearInterval(t);
  }, [res, pago, onPago]);

  async function pagar() {
    setErro(null);
    setOcupado(true);
    try {
      const r = await fetch("/api/public/pagamentos/dept/pagar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, id, token, metodo }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Não foi possível gerar o pagamento.");
      setRes(d);
      if (metodo === "CARTAO" && d.invoiceUrl) window.open(d.invoiceUrl, "_blank", "noopener");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  const caixa = { background: T.bg, border: `1px solid ${T.border}`, borderRadius: T.radius };
  const botao = { background: T.primary, color: "#fff", borderRadius: T.radius };

  if (pago) {
    return (
      <div className="w-full p-4 text-center" style={caixa}>
        <Check size={28} className="mx-auto mb-1" style={{ color: T.accent }} />
        <p className="font-semibold">Pagamento confirmado</p>
        <p className="text-xs" style={{ color: T.muted }}>{tipo === "inscricao" ? "Sua vaga está garantida. O ingresso foi para o seu WhatsApp." : "Seu pedido foi confirmado. Retire com o código acima."}</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-3 text-left">
      {res ? (
        <div className="space-y-3 p-4" style={caixa}>
          {res.pix ? (
            <div className="flex flex-col items-center text-center">
              <img src={`data:image/png;base64,${res.pix.imagem}`} alt="QR Pix" className="h-48 w-48 rounded-lg bg-white p-2" />
              <p className="mt-2 text-sm font-semibold">{moeda(res.valor)}</p>
              <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(res.pix!.payload); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sem permissão */ } }}
                className="mt-2 flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-bold" style={botao}>
                {copiado ? <><Check size={16} />Código copiado</> : <><Copy size={16} />Copiar Pix copia e cola</>}
              </button>
            </div>
          ) : (
            <div className="space-y-2 text-center">
              <p className="text-sm">Pague na página segura do Asaas (crédito, débito ou Pix).</p>
              {res.invoiceUrl && <a href={res.invoiceUrl} target="_blank" rel="noreferrer" className="flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-bold" style={botao}><ExternalLink size={16} />Abrir página de pagamento</a>}
            </div>
          )}
          <p className="flex items-center justify-center gap-2 text-xs" style={{ color: T.muted }}><Loader2 size={14} className="animate-spin" />Aguardando o pagamento — confirma sozinho.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {(["PIX", "CARTAO"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMetodo(m)} className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold"
                style={{ ...caixa, border: `1px solid ${metodo === m ? T.accent : T.border}`, color: metodo === m ? T.text : T.muted }}>
                {m === "PIX" ? <><QrCode size={16} />Pix</> : <><CreditCard size={16} />Cartão</>}
              </button>
            ))}
          </div>
          {erro && <p className="text-xs" style={{ color: "#f87171" }}>{erro}</p>}
          <button type="button" onClick={pagar} disabled={ocupado} className="flex w-full items-center justify-center gap-2 px-5 py-3 text-sm font-bold disabled:opacity-60" style={botao}>
            {ocupado && <Loader2 size={16} className="animate-spin" />}Pagar {moeda(valor)}
          </button>
        </>
      )}
    </div>
  );
}
