/**
 * Checkout do site (Eventos e Compras): dados do comprador → Pix (QR na tela)
 * ou Cartão (página segura do Asaas, crédito/débito/parcelas) → acompanha a
 * cobrança até o Asaas confirmar → ingressos com QR.
 */
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, CreditCard, ExternalLink, Loader2, QrCode, Ticket, X } from 'lucide-react';
import { brl, cx, get, post, type ItemCarrinho } from './comum';

interface Resultado { pedidoNumero: number; cobrancaId?: string; status: string; valor: number; invoiceUrl?: string | null; pix?: { payload: string; imagem: string } | null; ingressos?: Ingresso[] }
interface Ingresso { codigo: string; rotulo: string | null; status: string }
interface Status { status: string; pedidoNumero: number | null; ingressos: Ingresso[] }

const mascaraCpf = (v: string) => v.replace(/\D/g, '').slice(0, 11).replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
const mascaraCel = (v: string) => v.replace(/\D/g, '').slice(0, 11).replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');

export function QrDe({ texto, tamanho = 180 }: { texto: string; tamanho?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { QRCode.toDataURL(texto, { margin: 1, width: tamanho * 2 }).then(setUrl).catch(() => setUrl(null)); }, [texto, tamanho]);
  return url ? <img src={url} alt="QR" width={tamanho} height={tamanho} className="rounded-xl bg-white p-2" /> : <div style={{ width: tamanho, height: tamanho }} className="rounded-xl bg-white/10 animate-pulse" />;
}

export function Checkout({ itens, isDark, accent, pagamento, onFechar, onPago }: {
  itens: ItemCarrinho[]; isDark: boolean; accent: string; pagamento: { pix: boolean; cartao: boolean } | null; onFechar: () => void; onPago?: () => void;
}) {
  const total = itens.reduce((s, i) => s + i.preco * i.quantidade, 0);
  const [form, setForm] = useState({ nome: '', cpf: '', celular: '', email: '' });
  const [metodo, setMetodo] = useState<'PIX' | 'CARTAO'>(pagamento?.pix === false ? 'CARTAO' : 'PIX');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [res, setRes] = useState<Resultado | null>(null);
  const [pago, setPago] = useState<{ numero: number | null; ingressos: Ingresso[] } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const avisou = useRef(false);

  const gratis = total === 0;
  const card = isDark ? 'bg-white/5 ring-1 ring-white/10' : 'bg-white ring-1 ring-black/5';
  // Cor do texto e do cursor explícita: o CSS global do sistema pinta input de escuro e sumia no tema escuro.
  const input = cx('w-full rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2', isDark ? '!bg-white/5 ring-1 ring-white/10 !text-white caret-white placeholder:text-slate-500' : '!bg-white ring-1 ring-black/10 !text-slate-900 caret-slate-900 placeholder:text-slate-400');

  // Acompanha o pagamento (consulta o servidor, que pergunta ao Asaas).
  useEffect(() => {
    if (!res?.cobrancaId || pago) return;
    const t = setInterval(async () => {
      try {
        const s = await get<Status>(`status/${res.cobrancaId}`);
        if (s.status === 'PAGO') {
          setPago({ numero: s.pedidoNumero, ingressos: s.ingressos });
          if (!avisou.current) { avisou.current = true; onPago?.(); }
        }
      } catch { /* tenta de novo */ }
    }, 4000);
    return () => clearInterval(t);
  }, [res, pago, onPago]);

  async function pagar() {
    setErro(null);
    if (form.nome.trim().length < 3) return setErro('Informe seu nome completo.');
    if (form.cpf.replace(/\D/g, '').length !== 11) return setErro('Informe um CPF válido.');
    if (form.celular.replace(/\D/g, '').length < 10) return setErro('Informe o celular com DDD.');
    setOcupado(true);
    try {
      const r = await post<Resultado>('checkout', {
        itens: itens.map((i) => ({ tipo: i.tipo, produtoId: i.produtoId, opcaoId: i.opcaoId, quantidade: i.quantidade, tamanho: i.tamanho, corId: i.corId })),
        comprador: form, metodo,
      });
      setRes(r);
      if (r.status === 'PAGO') { setPago({ numero: r.pedidoNumero, ingressos: r.ingressos ?? [] }); onPago?.(); avisou.current = true; }
      else if (r.invoiceUrl) window.open(r.invoiceUrl, '_blank', 'noopener');
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  async function copiar(t: string) {
    try { await navigator.clipboard.writeText(t); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sem permissão */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={pago ? onFechar : undefined} />
      <div className={cx('relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-5 sm:p-6', isDark ? 'vitrine-escuro bg-[#121212] text-white' : 'bg-slate-50 text-slate-900')}>
        {/* Preenchimento automático do navegador pinta o campo de branco com texto escuro: no tema escuro, mantém o visual. */}
        <style>{'.vitrine-escuro input:-webkit-autofill,.vitrine-escuro input:-webkit-autofill:hover,.vitrine-escuro input:-webkit-autofill:focus{-webkit-text-fill-color:#fff!important;caret-color:#fff;box-shadow:0 0 0 1000px #1f1f1f inset!important}'}</style>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-xl font-bold">{pago ? 'Pagamento confirmado' : res ? 'Pagamento' : 'Finalizar'}</p>
            <p className="text-sm opacity-60">{itens.length} {itens.length === 1 ? 'item' : 'itens'} · {brl(total)}</p>
          </div>
          <button onClick={onFechar} className={cx('w-9 h-9 rounded-full flex items-center justify-center', isDark ? 'bg-white/10' : 'bg-black/5')}><X className="w-4 h-4" /></button>
        </div>

        {pago ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center py-2">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3" style={{ background: accent }}><Check className="w-8 h-8 text-black" /></div>
              <p className="font-bold text-lg">Tudo certo!</p>
              <p className="text-sm opacity-70">Pedido #{pago.numero}</p>
            </div>
            {pago.ingressos.map((g) => (
              <div key={g.codigo} className={cx('rounded-2xl p-4 flex items-center gap-4', card)}>
                <QrDe texto={g.codigo} tamanho={110} />
                <div className="min-w-0">
                  <p className="text-xs opacity-60 flex items-center gap-1"><Ticket className="w-3.5 h-3.5" />Ingresso</p>
                  <p className="font-mono font-bold text-lg">{g.codigo}</p>
                  <p className="text-sm opacity-70">{g.rotulo}</p>
                  <p className="text-[11px] opacity-50 mt-1">Apresente este QR na entrada (tire um print).</p>
                </div>
              </div>
            ))}
            {!pago.ingressos.length && <p className={cx('rounded-2xl p-4 text-sm', card)}>Retire seus produtos na secretaria informando o pedido #{pago.numero}.</p>}
            <button onClick={onFechar} className="w-full rounded-full py-3.5 font-semibold text-black" style={{ background: accent }}>Concluir</button>
          </div>
        ) : res ? (
          <div className="space-y-4">
            {res.pix ? (
              <div className={cx('rounded-3xl p-5 flex flex-col items-center text-center', card)}>
                <img src={`data:image/png;base64,${res.pix.imagem}`} alt="QR Pix" className="w-52 h-52 rounded-xl bg-white p-2" />
                <p className="text-2xl font-black mt-3">{brl(res.valor)}</p>
                <p className="text-sm opacity-70">Escaneie no app do seu banco ou copie o código</p>
                <button onClick={() => copiar(res.pix!.payload)} className="mt-3 w-full rounded-full py-3 font-semibold flex items-center justify-center gap-2 text-black" style={{ background: accent }}>
                  {copiado ? <><Check className="w-4 h-4" />Código copiado</> : <><Copy className="w-4 h-4" />Copiar Pix copia e cola</>}
                </button>
              </div>
            ) : (
              <div className={cx('rounded-3xl p-5 text-center', card)}>
                <CreditCard className="w-8 h-8 mx-auto mb-2" style={{ color: accent }} />
                <p className="font-semibold">Pague na página segura do Asaas</p>
                <p className="text-sm opacity-70">Crédito (parcelado), débito ou Pix. Ela abriu em outra aba.</p>
                {res.invoiceUrl && <a href={res.invoiceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 rounded-full px-5 py-3 font-semibold text-black" style={{ background: accent }}><ExternalLink className="w-4 h-4" />Abrir página de pagamento</a>}
              </div>
            )}
            <p className="flex items-center justify-center gap-2 text-sm opacity-70"><Loader2 className="w-4 h-4 animate-spin" />Aguardando o pagamento — a confirmação aparece aqui sozinha.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={cx('rounded-2xl p-4 space-y-2 text-sm', card)}>
              {itens.map((i) => (
                <div key={i.chave} className="flex justify-between gap-3"><span className="opacity-80">{i.quantidade}x {i.nome}{i.detalhe ? ` · ${i.detalhe}` : ''}</span><span className="font-semibold whitespace-nowrap">{brl(i.preco * i.quantidade)}</span></div>
              ))}
              <div className={cx('flex justify-between pt-2 border-t font-bold', isDark ? 'border-white/10' : 'border-black/5')}><span>Total</span><span>{brl(total)}</span></div>
            </div>
            <div className="grid gap-2">
              <input className={input} placeholder="Nome completo" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              <div className="grid grid-cols-2 gap-2">
                <input className={input} placeholder="CPF" inputMode="numeric" value={form.cpf} onChange={(e) => setForm({ ...form, cpf: mascaraCpf(e.target.value) })} />
                <input className={input} placeholder="Celular (WhatsApp)" inputMode="tel" value={form.celular} onChange={(e) => setForm({ ...form, celular: mascaraCel(e.target.value) })} />
              </div>
              <input className={input} placeholder="E-mail (opcional)" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <p className="text-[11px] opacity-50">O CPF é exigido pelo banco para emitir a cobrança.</p>
            </div>
            {!gratis && (
              <div className="grid grid-cols-2 gap-2">
                {pagamento?.pix !== false && (
                  <button onClick={() => setMetodo('PIX')} className={cx('rounded-2xl p-3 text-left ring-2 transition', metodo === 'PIX' ? '' : 'ring-transparent', card)} style={metodo === 'PIX' ? { boxShadow: `0 0 0 2px ${accent}` } : undefined}>
                    <QrCode className="w-5 h-5 mb-1" style={{ color: accent }} /><p className="font-semibold text-sm">Pix</p><p className="text-[11px] opacity-60">QR na tela, cai na hora</p>
                  </button>
                )}
                {pagamento?.cartao !== false && (
                  <button onClick={() => setMetodo('CARTAO')} className={cx('rounded-2xl p-3 text-left ring-2 transition', metodo === 'CARTAO' ? '' : 'ring-transparent', card)} style={metodo === 'CARTAO' ? { boxShadow: `0 0 0 2px ${accent}` } : undefined}>
                    <CreditCard className="w-5 h-5 mb-1" style={{ color: accent }} /><p className="font-semibold text-sm">Cartão</p><p className="text-[11px] opacity-60">Crédito, débito ou parcelado</p>
                  </button>
                )}
              </div>
            )}
            {erro && <p className="rounded-2xl px-4 py-3 text-sm bg-rose-500/15 text-rose-400">{erro}</p>}
            <button onClick={pagar} disabled={ocupado} className="w-full rounded-full py-3.5 font-semibold text-black flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: accent }}>
              {ocupado && <Loader2 className="w-4 h-4 animate-spin" />}
              {gratis ? 'Confirmar reserva' : metodo === 'PIX' ? `Gerar Pix de ${brl(total)}` : 'Avançar para o cartão'}
            </button>
            {!gratis && metodo === 'CARTAO' && (
              <p className="text-[11px] text-center opacity-60">Você digita os dados do cartão na página segura do Asaas, que abre em seguida. O número do cartão não passa pelo site.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
