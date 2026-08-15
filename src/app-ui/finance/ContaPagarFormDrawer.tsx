/**
 * Lançamento de conta a pagar (à vista ou parcelada).
 *
 * A prévia das parcelas é editável: nem toda despesa parcelada tem parcelas
 * iguais (um contrato pode ter entrada maior, o pagamento do pastor pode variar
 * por mês). O que a tela envia é exatamente o que vira parcela no banco.
 *
 * Nenhum dropdown daqui tem opção fixa — credores, tipos de despesa,
 * departamentos, bancos e formas de pagamento vêm dos cadastros.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { X, Loader2, CalendarClock, UserPlus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiBase } from '../../lib/apiBase';
import {
  formatarBRL, paraCentavos, paraReais, somarMeses,
  STATUS_PARCELA_CORES, STATUS_PARCELA_LABELS,
} from '../../lib/contasPagarRules';
import { ConfirmDialog } from '../../components/app-ui/shared/ConfirmDialog';
import { CredorFormModal } from './CredorFormModal';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

type Props = {
  contaId: string | null;
  credores: Row[];
  planosDespesa: Row[];
  departamentos: Row[];
  bancos: Row[];
  igrejas: Row[];
  onFechar: () => void;
  onSalvo: () => void;
  /** Avisa a tela para recarregar a lista de credores após um cadastro novo. */
  onCredorCriado?: () => void;
  /** Mudou algo sem fechar o drawer (exclusão de parcela, por exemplo). */
  onMudou?: () => void;
};

function hoje() { return new Date().toISOString().slice(0, 10); }

/**
 * Rótulo dos cadastros com código de busca: "01 - Bradesco".
 * O código é digitável, então o operador acha pelo teclado em vez de rolar a lista.
 */
export function rotuloComCodigo(item: { codigo?: string | null; nome: string }) {
  return item.codigo ? `${item.codigo} - ${item.nome}` : item.nome;
}

export function ContaPagarFormDrawer({
  contaId, credores, planosDespesa, departamentos, bancos, igrejas, onFechar, onSalvo, onCredorCriado, onMudou,
}: Props) {
  const token = localStorage.getItem('mrm_token');
  const headers = useMemo<Record<string, string>>(
    () => ({ 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }),
    [token]
  );
  const usuario = (() => { try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; } })();

  /**
   * Perfil igreja (e secretaria/tesouraria) lança sempre na própria igreja —
   * mesma regra do resto do sistema, conferida de novo no servidor. Aqui o
   * campo só fica travado para não oferecer o que seria recusado.
   */
  const papel = String(usuario.roleName || '').toLowerCase();
  const soIgrejaPropria = usuario.profileType === 'church'
    || papel.includes('secret') || papel.includes('tesour');

  const [churchId, setChurchId] = useState<string>(usuario.churchId || '');
  const [descricao, setDescricao] = useState('');
  const [credorId, setCredorId] = useState('');
  const [planoDeContaId, setPlanoDeContaId] = useState('');
  const [departamentoId, setDepartamentoId] = useState('');
  const [bancoId, setBancoId] = useState('');
  const [formaPagamentoPrevista, setFormaPagamentoPrevista] = useState('');
  const [numeroDocumento, setNumeroDocumento] = useState('');
  const [valorTotal, setValorTotal] = useState('');
  const [dataEmissao, setDataEmissao] = useState(hoje());
  const [primeiroVencimento, setPrimeiroVencimento] = useState(hoje());
  const [parcelado, setParcelado] = useState(false);
  const [numeroParcelas, setNumeroParcelas] = useState(1);
  const [recorrente, setRecorrente] = useState(false);
  const [observacoes, setObservacoes] = useState('');

  const [formas, setFormas] = useState<Row[]>([]);
  /** Parcelas já gravadas (só na edição). A prévia do lançamento é outra coisa. */
  const [parcelas, setParcelas] = useState<Row[]>([]);
  const [parcelaExcluir, setParcelaExcluir] = useState<Row | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [parcelasEditadas, setParcelasEditadas] = useState<{ valor: string; vencimento: string }[] | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(Boolean(contaId));
  const [erro, setErro] = useState('');
  // Cadastro de credor sai daqui mesmo: é lançando a conta que se percebe que
  // falta um, e o recém-criado já entra selecionado.
  const [credorModalAberto, setCredorModalAberto] = useState(false);
  const [credoresLocais, setCredoresLocais] = useState<Row[]>([]);

  /**
   * Lista do dropdown, unificada por id.
   *
   * O credor recém-criado entra em `credoresLocais` para aparecer selecionado
   * na hora — o recarregamento da lista do servidor é assíncrono e chegaria
   * tarde demais. Quando ele chega, o mesmo credor está nas duas listas; sem
   * unificar por id, o React reclama de chave duplicada e pode duplicar a opção.
   */
  const credoresDisponiveis = useMemo(() => {
    const porId = new Map<string, Row>();
    for (const c of [...credores, ...credoresLocais]) porId.set(c.id, c);
    return [...porId.values()];
  }, [credores, credoresLocais]);

  // Formas de pagamento saem do cadastro (Configurações › Formas de Pagamento).
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${apiBase}/lookups/payment-methods`, { headers });
        if (!r.ok) return;
        const j = await r.json();
        setFormas((Array.isArray(j) ? j : []).filter((f: Row) => f.mostrar !== false));
      } catch { /* dropdown fica vazio; o cadastro resolve */ }
    })();
  }, [headers]);

  /** Recarrega o título — inclusive as parcelas, que a edição lista e permite excluir. */
  const carregarConta = useCallback(async () => {
    if (!contaId) return;
    {
      try {
        const r = await fetch(`${apiBase}/contas-pagar/${contaId}`, { headers });
        if (!r.ok) throw new Error('Não foi possível carregar a conta.');
        const c = await r.json();
        setParcelas(c.parcelas ?? []);
        setChurchId(c.churchId);
        setDescricao(c.descricao ?? '');
        setCredorId(c.credorId ?? '');
        setPlanoDeContaId(c.planoDeContaId ?? '');
        setDepartamentoId(c.departamentoId ?? '');
        setBancoId(c.bancoId ?? '');
        setFormaPagamentoPrevista(c.formaPagamentoPrevista ?? '');
        setNumeroDocumento(c.numeroDocumento ?? '');
        setValorTotal(String(c.valorTotal ?? ''));
        setDataEmissao(String(c.dataEmissao ?? '').slice(0, 10));
        setParcelado(!!c.parcelado);
        setNumeroParcelas(c.numeroParcelas ?? 1);
        setRecorrente(!!c.recorrente);
        setObservacoes(c.observacoes ?? '');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        setErro(e.message);
      } finally {
        setCarregando(false);
      }
    }
  }, [contaId, headers]);

  useEffect(() => { (async () => { await carregarConta(); })(); }, [carregarConta]);

  // Pré-seleciona os cadastros marcados como padrão.
  useEffect(() => {
    if (contaId) return;
    setBancoId((a) => a || bancos.find((b) => b.is_default)?.id || '');
    setDepartamentoId((a) => a || departamentos.find((d) => d.is_default)?.id || '');
  }, [bancos, departamentos, contaId]);

  const qtd = parcelado ? Math.max(1, Number(numeroParcelas) || 1) : 1;

  /** Prévia: divisão igual com o resíduo dos centavos na última parcela. */
  const previa = useMemo(() => {
    if (parcelasEditadas) return parcelasEditadas;
    const totalCentavos = paraCentavos(valorTotal);
    if (!totalCentavos || !primeiroVencimento) return [];
    const base = Math.floor(totalCentavos / qtd);
    return Array.from({ length: qtd }, (_, i) => ({
      valor: String(paraReais(i === qtd - 1 ? base + (totalCentavos - base * qtd) : base).toFixed(2)),
      vencimento: somarMeses(primeiroVencimento, i),
    }));
  }, [valorTotal, qtd, primeiroVencimento, parcelasEditadas]);

  // Mexer nos parâmetros descarta a edição manual — senão a prévia mentiria.
  useEffect(() => { setParcelasEditadas(null); }, [valorTotal, numeroParcelas, primeiroVencimento, parcelado]);

  const somaPrevia = previa.reduce((s, p) => s + paraCentavos(p.valor), 0);
  const diferenca = paraCentavos(valorTotal) - somaPrevia;

  function editarParcela(indice: number, campo: 'valor' | 'vencimento', valor: string) {
    setParcelasEditadas((atual) => {
      const base = atual ?? previa.map((p) => ({ ...p }));
      const copia = base.map((p) => ({ ...p }));
      copia[indice] = { ...copia[indice], [campo]: valor };
      return copia;
    });
  }

  /** Pagamento não estornado trava a exclusão — o servidor repete a checagem. */
  function temPagamento(p: Row) {
    return (p.pagamentos ?? []).some((pg: Row) => !pg.estornadoEm);
  }

  async function excluirParcela() {
    if (!parcelaExcluir) return;
    setExcluindo(true);
    try {
      const res = await fetch(`${apiBase}/contas-pagar/parcelas/${parcelaExcluir.id}`, {
        method: 'DELETE', headers,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Falha ao excluir a parcela.');
      toast.success(
        json.totalAjustado
          ? `Parcela excluída. Restaram ${json.parcelasRestantes} parcela(s) e o total da conta passou a ${formatarBRL(json.valorTotal)}.`
          : `Parcela excluída. O valor foi redistribuído entre as ${json.parcelasRestantes} parcelas restantes.`
      );
      setParcelaExcluir(null);
      await carregarConta();
      onMudou?.();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setExcluindo(false);
    }
  }

  async function salvar() {
    setErro('');
    if (!descricao.trim()) return setErro('Informe a descrição da despesa.');
    if (!paraCentavos(valorTotal)) return setErro('Informe o valor total.');
    if (!churchId) return setErro('Selecione a igreja.');
    if (!contaId && Math.abs(diferenca) > 1) {
      return setErro(`A soma das parcelas está ${formatarBRL(paraReais(Math.abs(diferenca)))} ${diferenca > 0 ? 'abaixo' : 'acima'} do valor total.`);
    }

    setSalvando(true);
    try {
      const corpo = contaId
        ? { descricao, credorId, planoDeContaId, departamentoId, bancoId, formaPagamentoPrevista, numeroDocumento, observacoes, recorrente, dataEmissao }
        : {
            churchId, descricao, credorId, planoDeContaId, departamentoId, bancoId,
            formaPagamentoPrevista, numeroDocumento, observacoes, recorrente,
            valorTotal: paraReais(paraCentavos(valorTotal)),
            dataEmissao, primeiroVencimento, parcelado, numeroParcelas: qtd,
            valoresManuais: previa.map((p) => p.valor),
            vencimentosManuais: previa.map((p) => p.vencimento),
          };

      const res = await fetch(contaId ? `${apiBase}/contas-pagar/${contaId}` : `${apiBase}/contas-pagar`, {
        method: contaId ? 'PATCH' : 'POST',
        headers,
        body: JSON.stringify(corpo),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Falha ao salvar a conta.');
      toast.success(contaId ? 'Conta atualizada.' : `Conta ${json.numero ?? ''} lançada com ${qtd} parcela(s).`);
      onSalvo();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  const campo = 'w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500';
  const rotulo = 'block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onFechar}>
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-white dark:bg-slate-900 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {contaId ? 'Editar conta a pagar' : 'Nova conta a pagar'}
            </h2>
            {contaId && (
              <p className="text-xs text-slate-500">
                O valor total não é editável aqui. Dá para excluir parcelas na lista abaixo — o valor é redistribuído nas restantes.
              </p>
            )}
          </div>
          <button onClick={onFechar} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {carregando ? (
          <div className="flex items-center justify-center py-24 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
          </div>
        ) : (
          <div className="space-y-4 px-6 py-5">
            {erro && (
              <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">{erro}</div>
            )}

            <div>
              <label className={rotulo}>Descrição *</label>
              <input value={descricao} onChange={(e) => setDescricao(e.target.value)} className={campo} placeholder="Ex.: Ajuda de custo pastoral 2026" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={rotulo}>Igreja *</label>
                <select
                  value={churchId}
                  onChange={(e) => setChurchId(e.target.value)}
                  className={`${campo} disabled:opacity-70`}
                  disabled={!!contaId || soIgrejaPropria}
                  title={soIgrejaPropria ? 'Seu perfil lança contas apenas na própria igreja' : undefined}
                >
                  <option value="">Selecione...</option>
                  {(soIgrejaPropria ? igrejas.filter((c) => c.id === usuario.churchId) : igrejas)
                    .map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className={rotulo}>Credor</label>
                <div className="flex items-center gap-2">
                  <select value={credorId} onChange={(e) => setCredorId(e.target.value)} className={campo}>
                    <option value="">Selecione...</option>
                    {credoresDisponiveis.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => setCredorModalAberto(true)}
                    title="Cadastrar novo credor"
                    className="flex-shrink-0 rounded-lg border border-slate-200 dark:border-slate-600 p-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <UserPlus className="h-4 w-4 text-rose-600" />
                  </button>
                </div>
              </div>
              <div>
                <label className={rotulo}>Plano de contas (despesa)</label>
                <select value={planoDeContaId} onChange={(e) => setPlanoDeContaId(e.target.value)} className={campo}>
                  <option value="">Selecione...</option>
                  {planosDespesa.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>
              <div>
                <label className={rotulo}>Departamento</label>
                <select value={departamentoId} onChange={(e) => setDepartamentoId(e.target.value)} className={campo}>
                  <option value="">Não informado</option>
                  {departamentos.map((d) => <option key={d.id} value={d.id}>{rotuloComCodigo(d)}</option>)}
                </select>
              </div>
              <div>
                <label className={rotulo}>Banco / caixa previsto</label>
                <select value={bancoId} onChange={(e) => setBancoId(e.target.value)} className={campo}>
                  <option value="">Não informado</option>
                  {bancos.map((b) => <option key={b.id} value={b.id}>{rotuloComCodigo(b)}</option>)}
                </select>
              </div>
              <div>
                <label className={rotulo}>Forma de pagamento prevista</label>
                <select value={formaPagamentoPrevista} onChange={(e) => setFormaPagamentoPrevista(e.target.value)} className={campo}>
                  <option value="">Selecione...</option>
                  {formas.map((f) => <option key={f.id} value={f.nome}>{f.nome}</option>)}
                </select>
              </div>
              <div>
                <label className={rotulo}>Nº do documento</label>
                <input value={numeroDocumento} onChange={(e) => setNumeroDocumento(e.target.value)} className={campo} placeholder="NF, recibo, contrato" />
              </div>
              <div>
                <label className={rotulo}>Data de emissão *</label>
                <input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} className={campo} />
              </div>
            </div>

            {!contaId && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={rotulo}>Valor total *</label>
                    <input inputMode="decimal" value={valorTotal} onChange={(e) => setValorTotal(e.target.value.replace(',', '.'))} className={campo} placeholder="0,00" />
                  </div>
                  <div>
                    <label className={rotulo}>1º vencimento *</label>
                    <input type="date" value={primeiroVencimento} onChange={(e) => setPrimeiroVencimento(e.target.value)} className={campo} />
                  </div>
                  <div>
                    <label className={rotulo}>Parcelas</label>
                    <input
                      type="number" min={1} max={360}
                      value={numeroParcelas}
                      disabled={!parcelado}
                      onChange={(e) => setNumeroParcelas(Number(e.target.value))}
                      className={`${campo} disabled:opacity-50`}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input type="checkbox" checked={parcelado} onChange={(e) => { setParcelado(e.target.checked); if (!e.target.checked) setNumeroParcelas(1); }} />
                    Parcelada
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <input type="checkbox" checked={recorrente} onChange={(e) => setRecorrente(e.target.checked)} />
                    Despesa recorrente
                  </label>
                </div>

                {previa.length > 0 && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 px-4 py-2">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                        <CalendarClock className="h-4 w-4" /> Parcelas ({previa.length})
                      </div>
                      <span className={`text-xs font-semibold ${Math.abs(diferenca) > 1 ? 'text-red-600' : 'text-emerald-600'}`}>
                        Soma {formatarBRL(paraReais(somaPrevia))}
                        {Math.abs(diferenca) > 1 && ` · falta ${formatarBRL(paraReais(diferenca))}`}
                      </span>
                    </div>
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                      {previa.map((p, i) => (
                        <div key={i} className="flex items-center gap-2 px-4 py-2">
                          <span className="w-14 text-xs font-semibold text-slate-500">{i + 1}/{previa.length}</span>
                          <input
                            type="date"
                            value={p.vencimento}
                            onChange={(e) => editarParcela(i, 'vencimento', e.target.value)}
                            className="flex-1 px-2 py-1 border border-slate-200 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-700"
                          />
                          <input
                            inputMode="decimal"
                            value={p.valor}
                            onChange={(e) => editarParcela(i, 'valor', e.target.value.replace(',', '.'))}
                            className="w-28 px-2 py-1 border border-slate-200 dark:border-slate-600 rounded text-sm text-right bg-white dark:bg-slate-700"
                          />
                        </div>
                      ))}
                    </div>
                    <p className="px-4 py-2 text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800">
                      Datas e valores são editáveis — parcelas desiguais são permitidas, desde que a soma feche com o total.
                    </p>
                  </div>
                )}
              </>
            )}

            {contaId && parcelas.length > 0 && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 px-4 py-2">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <CalendarClock className="h-4 w-4" /> Parcelas ({parcelas.length})
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    Total {formatarBRL(paraReais(parcelas.reduce((s: number, p: Row) => s + paraCentavos(p.valorParcela), 0)))}
                  </span>
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {parcelas.map((p) => {
                    const bloqueada = temPagamento(p);
                    return (
                      <div key={p.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                        <span className="w-12 shrink-0 text-xs font-semibold text-slate-500">
                          {p.numeroParcela}/{p.totalParcelas}
                        </span>
                        <span className="w-24 shrink-0 text-slate-600 dark:text-slate-300">
                          {new Date(`${String(p.dataVencimento).slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR')}
                        </span>
                        <span className="flex-1 text-right font-semibold text-slate-900 dark:text-white">
                          {formatarBRL(p.valorParcela)}
                        </span>
                        <span className="w-28 text-right text-xs text-slate-500">
                          pago {formatarBRL(p.valorPago)}
                        </span>
                        <span className={`px-2 py-1 rounded text-[11px] font-semibold ${STATUS_PARCELA_CORES[p.status] ?? ''}`}>
                          {STATUS_PARCELA_LABELS[p.status] ?? p.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => setParcelaExcluir(p)}
                          disabled={bloqueada || parcelas.length <= 1}
                          title={
                            bloqueada
                              ? 'Estorne os pagamentos desta parcela antes de excluí-la'
                              : parcelas.length <= 1
                                ? 'Última parcela — cancele a conta inteira'
                                : 'Excluir parcela e redistribuir o valor'
                          }
                          className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-30 disabled:hover:bg-transparent"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
                <p className="px-4 py-2 text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-800">
                  Excluir uma parcela redistribui o valor dela entre as que sobram — o total da conta
                  não muda. Parcelas com pagamento registrado ficam travadas: estorne o pagamento antes.
                </p>
              </div>
            )}

            <div>
              <label className={rotulo}>Observações</label>
              <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} className={campo} />
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
              <button onClick={onFechar} className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                Cancelar
              </button>
              <button onClick={salvar} disabled={salvando} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
                {salvando ? 'Salvando...' : contaId ? 'Salvar alterações' : 'Lançar conta'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* O overlay do drawer fecha no clique; o diálogo precisa segurar o evento. */}
      <div onClick={(e) => e.stopPropagation()}>
        <ConfirmDialog
          open={Boolean(parcelaExcluir)}
          title="Excluir parcela"
          message={
            parcelaExcluir
              ? `Excluir a parcela ${parcelaExcluir.numeroParcela}/${parcelaExcluir.totalParcelas} (${formatarBRL(parcelaExcluir.valorParcela)})? O valor será redistribuído entre as ${parcelas.length - 1} parcelas restantes.`
              : ''
          }
          confirmLabel="Excluir parcela"
          variant="danger"
          loading={excluindo}
          onConfirm={excluirParcela}
          onCancel={() => (excluindo ? null : setParcelaExcluir(null))}
        />
      </div>

      {credorModalAberto && (
        <CredorFormModal
          igrejas={igrejas}
          bancos={bancos}
          churchIdSugerida={churchId}
          onFechar={() => setCredorModalAberto(false)}
          onSalvo={(novo) => {
            // Entra na lista local e já sai selecionado — quem estava lançando
            // não perde o que digitou nem precisa reabrir o formulário.
            setCredoresLocais((atual) => [...atual, novo]);
            setCredorId(novo.id);
            setCredorModalAberto(false);
            onCredorCriado?.();
          }}
        />
      )}
    </div>
  );
}
