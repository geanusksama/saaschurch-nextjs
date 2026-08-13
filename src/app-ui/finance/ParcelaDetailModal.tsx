/**
 * Detalhe da parcela: o devido, o que já foi pago, o saldo, e a coleção de
 * pagamentos que ela recebeu.
 *
 * O registro de pagamento tem valor LIVRE — pagar menos que o saldo é caso de
 * uso normal (o mês em que só deu para pagar parte do pastor). O que sobra
 * continua nesta mesma parcela; não vira parcela nova.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Loader2, Undo2, Receipt, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { apiBase } from '../../lib/apiBase';
import {
  STATUS_PARCELA_CORES, STATUS_PARCELA_LABELS, STATUS_APROVACAO_LABELS,
  formatarBRL, paraCentavos, paraReais, NAO_INFORMADO,
} from '../../lib/contasPagarRules';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

function dataBR(v: string | null | undefined) {
  if (!v) return '—';
  return new Date(`${String(v).slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR');
}

export function ParcelaDetailModal({
  parcelaId, bancos, onFechar, onMudou,
}: { parcelaId: string; bancos: Row[]; onFechar: () => void; onMudou: () => void }) {
  const token = localStorage.getItem('mrm_token');
  const headers = useMemo<Record<string, string>>(
    () => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }),
    [token]
  );

  const [parcela, setParcela] = useState<Row | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [formas, setFormas] = useState<Row[]>([]);
  const [erro, setErro] = useState('');

  const [valorPago, setValorPago] = useState('');
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().slice(0, 10));
  const [formaPagamento, setFormaPagamento] = useState('');
  const [bancoId, setBancoId] = useState('');
  const [comprovanteUrl, setComprovanteUrl] = useState('');
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await fetch(`${apiBase}/contas-pagar/parcelas/${parcelaId}`, { headers });
      if (!r.ok) throw new Error('Não foi possível carregar a parcela.');
      const p = await r.json();
      setParcela(p);
      setValorPago(String(Number(p.valorSaldo ?? 0).toFixed(2)));
      setBancoId((a) => a || p.contaPagar?.bancoId || bancos.find((b) => b.is_default)?.id || '');
      setFormaPagamento((a) => a || p.contaPagar?.formaPagamentoPrevista || '');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [parcelaId, headers, bancos]);

  useEffect(() => { carregar(); }, [carregar]);

  // Formas de pagamento saem do cadastro, não do código.
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${apiBase}/lookups/payment-methods`, { headers });
        if (!r.ok) return;
        const j = await r.json();
        setFormas((Array.isArray(j) ? j : []).filter((f: Row) => f.mostrar !== false));
      } catch { /* dropdown vazio; o cadastro resolve */ }
    })();
  }, [headers]);

  const saldoCentavos = paraCentavos(parcela?.valorSaldo);
  const valorCentavos = paraCentavos(valorPago);
  const restante = saldoCentavos - valorCentavos;
  const bloqueadoPorAprovacao = parcela?.contaPagar?.statusAprovacao === 'AGUARDANDO'
    || parcela?.contaPagar?.statusAprovacao === 'REPROVADO';

  async function registrarPagamento() {
    setErro('');
    if (valorCentavos <= 0) return setErro('Informe um valor maior que zero.');
    if (valorCentavos > saldoCentavos) {
      return setErro(`O valor excede o saldo de ${formatarBRL(paraReais(saldoCentavos))} desta parcela.`);
    }
    setSalvando(true);
    try {
      const res = await fetch(`${apiBase}/contas-pagar/parcelas/${parcelaId}/pagamentos`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          valorPago: paraReais(valorCentavos),
          dataPagamento, formaPagamento, bancoId,
          comprovanteUrl: comprovanteUrl || null,
          observacao: observacao || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Falha ao registrar o pagamento.');
      toast.success(
        restante > 0
          ? `Pagamento registrado. Restam ${formatarBRL(paraReais(restante))} em aberto nesta parcela.`
          : 'Parcela quitada.'
      );
      setObservacao('');
      setComprovanteUrl('');
      await carregar();
      onMudou();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  async function estornar(pagamentoId: string) {
    const motivo = window.prompt('Motivo do estorno:') || '';
    if (!motivo.trim()) return;
    const res = await fetch(`${apiBase}/contas-pagar/pagamentos/${pagamentoId}/estorno`, {
      method: 'POST', headers, body: JSON.stringify({ motivo }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { toast.error(json.error || 'Falha ao estornar.'); return; }
    toast.success('Pagamento estornado. O lançamento no livro caixa também foi estornado.');
    await carregar();
    onMudou();
  }

  const campo = 'w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white';
  const rotulo = 'block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onFechar}>
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 shadow-xl" onClick={(e) => e.stopPropagation()}>
        {carregando ? (
          <div className="flex items-center justify-center py-24 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : !parcela ? (
          <div className="p-8 text-center text-slate-500">{erro || 'Parcela não encontrada.'}</div>
        ) : (
          <>
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Parcela {parcela.numeroParcela}/{parcela.totalParcelas}
                  </h2>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${STATUS_PARCELA_CORES[parcela.status]}`}>
                    {STATUS_PARCELA_LABELS[parcela.status] ?? parcela.status}
                  </span>
                </div>
                <p className="text-sm text-slate-500">
                  {parcela.contaPagar?.numero} · {parcela.contaPagar?.descricao}
                </p>
                <p className="text-xs text-slate-400">
                  {parcela.contaPagar?.credor?.nome ?? 'Sem credor'} · vence {dataBR(parcela.dataVencimento)} ·
                  {' '}{parcela.contaPagar?.departamento?.nome ?? NAO_INFORMADO}
                </p>
              </div>
              <button onClick={onFechar} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Devido / pago / saldo */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { rot: 'Valor da parcela', val: parcela.valorParcela, cor: 'text-slate-900 dark:text-white' },
                  { rot: 'Já pago', val: parcela.valorPago, cor: 'text-emerald-600' },
                  { rot: 'Saldo em aberto', val: parcela.valorSaldo, cor: 'text-amber-600' },
                ].map((k) => (
                  <div key={k.rot} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                    <div className="text-xs font-semibold uppercase text-slate-500">{k.rot}</div>
                    <div className={`text-lg font-bold ${k.cor}`}>{formatarBRL(k.val)}</div>
                  </div>
                ))}
              </div>

              {bloqueadoPorAprovacao && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  Esta conta está como &quot;{STATUS_APROVACAO_LABELS[parcela.contaPagar?.statusAprovacao]}&quot; e não pode receber pagamento.
                </div>
              )}

              {/* Histórico de pagamentos */}
              <div>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  <Receipt className="h-4 w-4" /> Pagamentos desta parcela ({parcela.pagamentos?.length ?? 0})
                </h3>
                {!parcela.pagamentos?.length ? (
                  <p className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 px-4 py-6 text-center text-sm text-slate-400">
                    Nenhum pagamento registrado ainda.
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    {parcela.pagamentos.map((p: Row) => (
                      <div key={p.id} className={`flex items-start justify-between gap-3 px-4 py-3 ${p.estornadoEm ? 'opacity-60' : ''}`}>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-bold ${p.estornadoEm ? 'line-through text-slate-500' : 'text-emerald-600'}`}>
                              {formatarBRL(p.valorPago)}
                            </span>
                            <span className="text-xs text-slate-500">{dataBR(p.dataPagamento)}</span>
                            {p.formaPagamento && <span className="text-xs text-slate-400">· {p.formaPagamento}</span>}
                            {p.banco?.nome && <span className="text-xs text-slate-400">· {p.banco.nome}</span>}
                          </div>
                          {p.observacao && <p className="text-xs text-slate-500 mt-0.5">{p.observacao}</p>}
                          {p.estornadoEm && (
                            <p className="text-xs text-red-600 mt-0.5">
                              Estornado em {dataBR(p.estornadoEm)} — {p.motivoEstorno}
                            </p>
                          )}
                        </div>
                        {!p.estornadoEm && (
                          <button
                            onClick={() => estornar(p.id)}
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          >
                            <Undo2 className="h-3.5 w-3.5" /> Estornar
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Registrar pagamento */}
              {parcela.status !== 'PAGO' && parcela.status !== 'CANCELADA' && !bloqueadoPorAprovacao && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                  <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">Registrar pagamento</h3>

                  {erro && (
                    <div className="mb-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">{erro}</div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={rotulo}>Valor a pagar *</label>
                      <input inputMode="decimal" value={valorPago} onChange={(e) => setValorPago(e.target.value.replace(',', '.'))} className={campo} />
                      {restante > 0 && valorCentavos > 0 && (
                        <p className="mt-1 text-xs font-medium text-amber-600">
                          Pagamento parcial: ficarão {formatarBRL(paraReais(restante))} em aberto nesta mesma parcela.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className={rotulo}>Data do pagamento *</label>
                      <input type="date" value={dataPagamento} onChange={(e) => setDataPagamento(e.target.value)} className={campo} />
                    </div>
                    <div>
                      <label className={rotulo}>Forma de pagamento</label>
                      <select value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)} className={campo}>
                        <option value="">Selecione...</option>
                        {formas.map((f) => <option key={f.id} value={f.nome}>{f.nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={rotulo}>Banco / caixa</label>
                      <select value={bancoId} onChange={(e) => setBancoId(e.target.value)} className={campo}>
                        <option value="">Não informado</option>
                        {bancos.map((b) => <option key={b.id} value={b.id}>{b.codigo ? `${b.codigo} - ${b.nome}` : b.nome}</option>)}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className={rotulo}>Link do comprovante</label>
                      <input value={comprovanteUrl} onChange={(e) => setComprovanteUrl(e.target.value)} className={campo} placeholder="https://..." />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={rotulo}>Observação</label>
                      <input
                        value={observacao}
                        onChange={(e) => setObservacao(e.target.value)}
                        className={campo}
                        placeholder="Ex.: pago 60% por falta de caixa, restante fica em aberto"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      O pagamento gera automaticamente uma despesa no Livro Caixa.
                    </p>
                    <button
                      onClick={registrarPagamento}
                      disabled={salvando}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {salvando ? 'Registrando...' : 'Registrar pagamento'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
