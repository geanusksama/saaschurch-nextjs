/**
 * Pagamento da inscrição do Peniel pelo Asaas (Pix na tela ou cartão na página
 * segura do Asaas). Usado no fim da inscrição e na consulta. Quando o Asaas
 * confirma, a inscrição vira "pago" e o ingresso (QR) vai pelo WhatsApp — isso
 * acontece no servidor (aplicarNoApp), não aqui.
 */
import { useEffect, useState } from 'react';
import { Check, Copy, CreditCard, ExternalLink, Loader2, QrCode } from 'lucide-react';
import { apiBase } from '../../lib/apiBase';

interface Resultado { cobrancaId: string; status: string; valor: number; invoiceUrl?: string | null; pix?: { payload: string; imagem: string } | null }

const mascaraCpf = (v: string) => v.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** O campo do evento usa o Asaas? */
export function usePenielAsaas(eventId: string | null | undefined) {
  const [asaas, setAsaas] = useState<boolean | null>(null);
  useEffect(() => {
    if (!eventId) return;
    let vivo = true;
    fetch(`${apiBase}/public/pagamentos/peniel/${eventId}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => vivo && setAsaas(Boolean(d.asaas)))
      .catch(() => vivo && setAsaas(false));
    return () => { vivo = false; };
  }, [eventId]);
  return eventId ? asaas : null;
}

export function PenielPagamento({ inscricaoId, codigo, valor, onPago }: { inscricaoId: string; codigo: string; valor: number; onPago?: () => void }) {
  const [cpf, setCpf] = useState('');
  const [metodo, setMetodo] = useState<'PIX' | 'CARTAO'>('PIX');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [res, setRes] = useState<Resultado | null>(null);
  const [pago, setPago] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (!res || pago) return;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`${apiBase}/public/pagamentos/status/${res.cobrancaId}`, { cache: 'no-store' });
        const d = await r.json();
        if (d.status === 'PAGO') { setPago(true); onPago?.(); }
      } catch { /* tenta de novo */ }
    }, 4000);
    return () => clearInterval(t);
  }, [res, pago, onPago]);

  async function pagar() {
    setErro('');
    if (cpf.replace(/\D/g, '').length !== 11) return setErro('Informe o CPF de quem está pagando.');
    setOcupado(true);
    try {
      const r = await fetch(`${apiBase}/public/pagamentos/peniel/pagar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inscricaoId, codigo, cpf, metodo }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Não foi possível gerar o pagamento.');
      setRes(d);
      if (d.invoiceUrl && metodo === 'CARTAO') window.open(d.invoiceUrl, '_blank', 'noopener');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  if (pago) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center space-y-2">
        <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500 flex items-center justify-center"><Check className="w-6 h-6 text-white" /></div>
        <p className="font-extrabold text-emerald-700">Pagamento confirmado!</p>
        <p className="text-xs text-emerald-700/80">Sua vaga está garantida. O ingresso com QR Code foi enviado para o seu WhatsApp. Código: <b>{codigo}</b></p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 space-y-3 text-left">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-extrabold tracking-widest text-slate-600 uppercase">Pagamento da inscrição</p>
        <p className="text-sm font-extrabold text-slate-900">{brl(valor)}</p>
      </div>
      {res ? (
        <div className="space-y-3">
          {res.pix ? (
            <div className="flex flex-col items-center text-center">
              <img src={`data:image/png;base64,${res.pix.imagem}`} alt="QR Pix" className="w-48 h-48 rounded-xl bg-white p-2 border border-slate-200" />
              <p className="text-xs text-slate-600 mt-2">Escaneie no app do banco ou copie o código Pix</p>
              <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(res.pix!.payload); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sem permissão */ } }}
                className="mt-2 w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 bg-[#d4af37] text-slate-900 hover:brightness-95">
                {copiado ? <><Check size={16} />Código copiado</> : <><Copy size={16} />Copiar Pix copia e cola</>}
              </button>
            </div>
          ) : (
            <div className="text-center space-y-2">
              <p className="text-sm text-slate-700">Pague na página segura do Asaas (crédito, débito ou Pix).</p>
              {res.invoiceUrl && <a href={res.invoiceUrl} target="_blank" rel="noreferrer" className="w-full py-3 rounded-xl text-sm font-bold inline-flex items-center justify-center gap-2 bg-[#d4af37] text-slate-900"><ExternalLink size={16} />Abrir página de pagamento</a>}
            </div>
          )}
          <p className="flex items-center justify-center gap-2 text-xs text-slate-500"><Loader2 size={14} className="animate-spin" />Aguardando o pagamento — a confirmação aparece aqui sozinha.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <input value={cpf} onChange={(e) => setCpf(mascaraCpf(e.target.value))} inputMode="numeric" placeholder="CPF de quem paga"
            className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-[#d4af37] text-sm" />
          <div className="grid grid-cols-2 gap-2">
            {(['PIX', 'CARTAO'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMetodo(m)}
                className={`py-2.5 rounded-xl text-sm font-bold border flex items-center justify-center gap-2 ${metodo === m ? 'border-[#d4af37] bg-white text-slate-900 ring-2 ring-[#d4af37]/40' : 'border-slate-300 bg-white text-slate-500'}`}>
                {m === 'PIX' ? <><QrCode size={16} />Pix</> : <><CreditCard size={16} />Cartão</>}
              </button>
            ))}
          </div>
          {erro && <p className="text-xs text-rose-600 font-semibold">{erro}</p>}
          <button type="button" onClick={pagar} disabled={ocupado}
            className="w-full py-3 rounded-xl text-white font-bold bg-[#22c55e] hover:bg-emerald-600 flex items-center justify-center gap-2 disabled:opacity-60">
            {ocupado && <Loader2 size={16} className="animate-spin" />}{metodo === 'PIX' ? 'Gerar Pix' : 'Pagar no cartão'}
          </button>
          <p className="text-[11px] text-slate-400 text-center">Confirmação automática: sem comprovante. O CPF é exigido pelo banco.</p>
        </div>
      )}
    </div>
  );
}
