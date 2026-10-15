/**
 * Pagamentos › Cobrança rápida ("maquininha"): valor + quem paga → QR Pix na
 * tela (ou link da fatura para cartão). A tela vira PAGO sozinha consultando
 * o Asaas a cada 5 s.
 */
import { useEffect, useRef, useState } from 'react';
import { Banknote, Check, CreditCard, ExternalLink, MessageCircle, QrCode, Search, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, Botao, brl, Campo, Cartao, confirmar, CopiaECola, cx, inputCls, Qr } from './comum';

interface Pessoa { memberId: string; nome: string; cpfFinal: string | null; temCpf: boolean; igreja: string | null }
interface Resultado { cobrancaId: string; status: string; valor: number; invoiceUrl?: string | null; pix?: { payload: string; imagem: string; expira: string | null } | null }

const FORMAS = [
  { id: 'PIX', rotulo: 'Pix', icone: QrCode, sub: 'QR na tela, cai na hora' },
  { id: 'UNDEFINED', rotulo: 'Pessoa escolhe', icone: Banknote, sub: 'Pix, crédito, débito ou boleto na página do Asaas' },
  { id: 'CREDIT_CARD', rotulo: 'Cartão', icone: CreditCard, sub: 'Crédito (parcelado) ou débito na página do Asaas' },
];

export default function Cobrar() {
  const [centavos, setCentavos] = useState(0);
  const [descricao, setDescricao] = useState('');
  const [forma, setForma] = useState('PIX');
  const [parcelas, setParcelas] = useState(1);
  const [busca, setBusca] = useState('');
  const [achados, setAchados] = useState<Pessoa[]>([]);
  const [pessoa, setPessoa] = useState<Pessoa | null>(null);
  const [avulso, setAvulso] = useState({ nome: '', cpf: '' });
  const [cpfMembro, setCpfMembro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [res, setRes] = useState<Resultado | null>(null);
  const [estado, setEstado] = useState('PENDENTE');
  const valor = centavos / 100;

  useEffect(() => {
    if (busca.trim().length < 2 || pessoa) return;
    const t = setTimeout(() => api<Pessoa[]>(`pessoas?q=${encodeURIComponent(busca)}`).then(setAchados).catch(() => setAchados([])), 300);
    return () => clearTimeout(t);
  }, [busca, pessoa]);
  const sugestoes = busca.trim().length >= 2 && !pessoa ? achados : [];

  // Acompanha a cobrança até ser paga.
  const vivo = useRef(true);
  useEffect(() => {
    vivo.current = true;
    if (!res || estado === 'PAGO') return;
    const t = setInterval(async () => {
      try {
        const r = await api<{ estado: string }>(`cobranca/${res.cobrancaId}/sincronizar`, { method: 'POST' });
        if (!vivo.current) return;
        setEstado(r.estado);
        if (r.estado === 'PAGO') toast.success(`Pagamento de ${brl(res.valor)} confirmado`);
      } catch { /* tenta de novo no próximo ciclo */ }
    }, 5000);
    return () => {
      vivo.current = false;
      clearInterval(t);
    };
  }, [res, estado]);

  function tecla(k: string) {
    if (k === '⌫') return setCentavos((c) => Math.floor(c / 10));
    if (k === 'C') return setCentavos(0);
    setCentavos((c) => Math.min(c * 10 + Number(k), 99_999_999));
  }

  async function cobrar() {
    if (valor < 5) return toast.error('Valor mínimo de R$ 5,00.');
    if (!pessoa && (!avulso.nome.trim() || avulso.cpf.replace(/\D/g, '').length < 11)) return toast.error('Escolha um membro ou informe nome e CPF de quem paga.');
    if (pessoa && !pessoa.temCpf && cpfMembro.replace(/\D/g, '').length < 11) return toast.error('Este membro não tem CPF no cadastro. Informe o CPF.');
    setOcupado(true);
    try {
      const r = await api<Resultado>('cobranca', {
        method: 'POST',
        body: {
          valor, descricao: descricao || 'Cobrança', forma, parcelas,
          ...(pessoa ? { memberId: pessoa.memberId, cpf: cpfMembro || undefined } : { nome: avulso.nome, cpf: avulso.cpf }),
        },
      });
      setRes(r);
      setEstado(r.status);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOcupado(false);
    }
  }

  async function cancelarCobranca() {
    if (!res || !confirmar('Cancelar esta cobrança? O QR deixa de funcionar.')) return;
    try {
      await api(`cobranca/${res.cobrancaId}/cancelar`, { method: 'POST' });
      toast.success('Cobrança cancelada');
      nova();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function dinheiro() {
    if (!res || !confirmar(`Registrar ${brl(res.valor)} como recebido em dinheiro?`)) return;
    try {
      await api(`cobranca/${res.cobrancaId}/dinheiro`, { method: 'POST' });
      setEstado('PAGO');
      toast.success('Registrado como recebido em dinheiro');
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function nova() {
    setRes(null);
    setEstado('PENDENTE');
    setCentavos(0);
    setDescricao('');
    setPessoa(null);
    setBusca('');
    setAvulso({ nome: '', cpf: '' });
    setCpfMembro('');
  }

  if (res) {
    const link = res.invoiceUrl ?? null;
    const pago = estado === 'PAGO';
    const whats = `https://wa.me/?text=${encodeURIComponent(`Olá! Segue o pagamento de ${brl(res.valor)}${descricao ? ` (${descricao})` : ''}: ${link ?? res.pix?.payload ?? ''}`)}`;
    return (
      <div className="max-w-lg mx-auto">
        <Cartao className={cx('p-6 text-center transition-colors', pago && '!bg-emerald-50 dark:!bg-emerald-900/20 !border-emerald-300')}>
          {pago ? (
            <div className="py-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500 flex items-center justify-center mb-4"><Check className="w-10 h-10 text-white" /></div>
              <p className="text-3xl font-black text-emerald-700 dark:text-emerald-300">PAGO</p>
              <p className="text-lg font-semibold mt-1">{brl(res.valor)}</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500">{forma === 'PIX' ? 'Peça para escanear o QR no app do banco' : 'Peça para escanear e pagar na página do Asaas'}</p>
              <p className="text-3xl font-black my-2">{brl(res.valor)}</p>
              <div className="flex justify-center my-4">
                {res.pix && forma === 'PIX' ? <Qr imagem={res.pix.imagem} tamanho={240} /> : link ? <Qr texto={link} tamanho={240} /> : null}
              </div>
              {res.pix && forma === 'PIX' && <CopiaECola texto={res.pix.payload} rotulo="Copiar Pix" />}
              {link && forma !== 'PIX' && <CopiaECola texto={link} rotulo="Copiar link" />}
              <p className="flex items-center justify-center gap-2 text-xs text-slate-500 mt-4"><span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Aguardando o pagamento… a tela muda sozinha.</p>
            </>
          )}
          <div className="flex flex-wrap justify-center gap-2 mt-5">
            <Botao onClick={nova}>Nova cobrança</Botao>
            {!pago && <a href={whats} target="_blank" rel="noreferrer"><Botao tipo="secundario"><MessageCircle className="w-4 h-4" />WhatsApp</Botao></a>}
            {!pago && link && <a href={link} target="_blank" rel="noreferrer"><Botao tipo="secundario"><ExternalLink className="w-4 h-4" />Abrir fatura</Botao></a>}
            {!pago && <Botao tipo="secundario" onClick={dinheiro}><Banknote className="w-4 h-4" />Recebi em dinheiro</Botao>}
            {!pago && <Botao tipo="fantasma" onClick={cancelarCobranca}><X className="w-4 h-4" />Cancelar</Botao>}
          </div>
        </Cartao>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Cartao className="p-5">
        <p className="text-xs font-semibold text-slate-500">Valor</p>
        <p className="text-4xl font-black text-slate-800 dark:text-white my-2 tabular-nums">{brl(valor)}</p>
        <div className="grid grid-cols-3 gap-2 mt-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => (
            <button key={k} onClick={() => tecla(k)}
              className="h-14 rounded-xl text-xl font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 active:scale-95 transition">
              {k}
            </button>
          ))}
        </div>
      </Cartao>

      <Cartao className="p-5 space-y-4">
        <Campo rotulo="Descrição (aparece para quem paga)">
          <input className={inputCls} value={descricao} maxLength={120} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Oferta do culto, Livro, Inscrição do retiro" />
        </Campo>

        <div>
          <span className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Quem paga</span>
          {pessoa ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20">
              <UserRound className="w-5 h-5 text-purple-600" />
              <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{pessoa.nome}</p><p className="text-xs text-slate-500">{pessoa.igreja ?? ''}{pessoa.cpfFinal ? ` · CPF •••${pessoa.cpfFinal}` : ' · sem CPF'}</p></div>
              <button onClick={() => setPessoa(null)} className="p-1 rounded hover:bg-purple-100"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input className={cx(inputCls, 'pl-9')} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar membro por nome ou CPF" />
              {sugestoes.length > 0 && (
                <div className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg">
                  {sugestoes.map((a) => (
                    <button key={a.memberId} onClick={() => { setPessoa(a); setAchados([]); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700">
                      <p className="text-sm font-semibold">{a.nome}</p><p className="text-xs text-slate-500">{a.igreja}{a.cpfFinal ? ` · CPF •••${a.cpfFinal}` : ' · sem CPF'}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {pessoa && !pessoa.temCpf && (
            <input className={cx(inputCls, 'mt-2')} value={cpfMembro} onChange={(e) => setCpfMembro(e.target.value)} placeholder="CPF (obrigatório no Asaas)" inputMode="numeric" />
          )}
          {!pessoa && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              <input className={inputCls} value={avulso.nome} onChange={(e) => setAvulso({ ...avulso, nome: e.target.value })} placeholder="Ou nome de quem paga" />
              <input className={inputCls} value={avulso.cpf} onChange={(e) => setAvulso({ ...avulso, cpf: e.target.value })} placeholder="CPF" inputMode="numeric" />
            </div>
          )}
        </div>

        <div>
          <span className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Forma</span>
          <div className="grid gap-2 sm:grid-cols-3">
            {FORMAS.map((f) => (
              <button key={f.id} onClick={() => setForma(f.id)}
                className={cx('p-3 rounded-lg border text-left transition', forma === f.id ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-slate-200 dark:border-slate-600 hover:border-purple-300')}>
                <f.icone className="w-4 h-4 text-purple-600 mb-1" /><p className="text-sm font-semibold">{f.rotulo}</p><p className="text-[11px] text-slate-500 leading-tight">{f.sub}</p>
              </button>
            ))}
          </div>
        </div>

        {forma === 'CREDIT_CARD' && (
          <Campo rotulo="Parcelas no crédito">
            <select className={inputCls} value={parcelas} onChange={(e) => setParcelas(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}x {valor ? `de ${brl(valor / n)}` : ''}</option>)}
            </select>
          </Campo>
        )}

        <Botao className="w-full !py-3 text-base" onClick={cobrar} carregando={ocupado} disabled={valor < 5}>
          <QrCode className="w-5 h-5" /> Cobrar {valor ? brl(valor) : ''}
        </Botao>
      </Cartao>
    </div>
  );
}
