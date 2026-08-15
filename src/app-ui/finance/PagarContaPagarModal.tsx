/**
 * Busca de conta a pagar a partir da tela de lançamento de despesa.
 *
 * Este modal NÃO paga nada. Ele só descobre a conta pelo documento e devolve as
 * parcelas escolhidas para a tela de despesa, que preenche o formulário com o
 * que o Contas a Pagar já sabe (plano de contas, credor, banco, departamento,
 * forma prevista, documento e valor em aberto).
 *
 * O pagamento acontece no "Lançar Despesa", com os dados que o operador
 * confirmou na tela — inclusive um valor menor, que vira pagamento parcial.
 * Quitar direto, sem passar pelo lançamento, é função da tela de Contas a Pagar.
 *
 * A seleção é limitada a UMA conta: o lançamento carrega um plano de contas e um
 * favorecido só. Várias parcelas da mesma conta podem ir juntas — o valor soma,
 * e por baixo cada parcela é baixada individualmente.
 */
import { useState } from 'react';
import { X, Search, Loader2, FileText, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { apiBase } from '../../lib/apiBase';
import {
  STATUS_PARCELA_CORES, STATUS_PARCELA_LABELS, formatarBRL, NAO_INFORMADO,
} from '../../lib/contasPagarRules';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

type Props = {
  /** Igreja do caixa aberto na tela de despesa. */
  churchId: string;
  /** O que já estiver digitado no campo Nº do Documento entra na busca. */
  termoInicial?: string;
  onFechar: () => void;
  /** Devolve a conta e as parcelas escolhidas para preencher o formulário. */
  onUsarNoLancamento: (dados: { conta: Row; parcelas: Row[] }) => void;
};

const EM_ABERTO = ['PENDENTE', 'PARCIAL', 'ATRASADO'];

function dataBR(v: string | null | undefined) {
  if (!v) return '—';
  return new Date(`${String(v).slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR');
}
const num = (v: unknown) => Number(v ?? 0);

export function PagarContaPagarModal({ churchId, termoInicial, onFechar, onUsarNoLancamento }: Props) {
  const token = localStorage.getItem('mrm_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const [termo, setTermo] = useState(termoInicial ?? '');
  const [buscando, setBuscando] = useState(false);
  const [buscou, setBuscou] = useState(false);
  const [contas, setContas] = useState<Row[]>([]);
  /** Conta e parcelas marcadas — sempre da mesma conta. */
  const [contaSelecionada, setContaSelecionada] = useState<string>('');
  const [selecionadas, setSelecionadas] = useState<string[]>([]);

  const emAberto = (p: Row) => EM_ABERTO.includes(p.status) && num(p.valorSaldo) > 0;

  const porId = new Map<string, { conta: Row; parcela: Row }>();
  for (const c of contas) for (const p of c.parcelas ?? []) porId.set(p.id, { conta: c, parcela: p });

  const total = selecionadas.reduce((s, id) => s + num(porId.get(id)?.parcela.valorSaldo), 0);

  async function buscar() {
    if (!termo.trim()) { toast.error('Informe o número do documento, da conta ou o credor.'); return; }
    setBuscando(true);
    setBuscou(true);
    setSelecionadas([]);
    setContaSelecionada('');
    try {
      const qs = new URLSearchParams({
        q: termo.trim(),
        churchId,
        status: EM_ABERTO.join(','),
        pageSize: '20',
        sortBy: 'dataEmissao',
        sortDir: 'desc',
      });
      const res = await fetch(`${apiBase}/contas-pagar?${qs}`, { headers });
      if (!res.ok) throw new Error('Falha na busca.');
      const json = await res.json();
      setContas(json.data ?? []);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
      toast.error(e.message || 'Não foi possível buscar as contas a pagar.');
      setContas([]);
    } finally {
      setBuscando(false);
    }
  }

  /** Marcar parcela de outra conta troca a seleção: o lançamento é de uma conta só. */
  function alternar(contaId: string, parcelaId: string) {
    if (contaId !== contaSelecionada) {
      setContaSelecionada(contaId);
      setSelecionadas([parcelaId]);
      return;
    }
    setSelecionadas((a) => {
      const nova = a.includes(parcelaId) ? a.filter((x) => x !== parcelaId) : [...a, parcelaId];
      if (!nova.length) setContaSelecionada('');
      return nova;
    });
  }

  function alternarConta(conta: Row) {
    const ids = (conta.parcelas ?? []).filter(emAberto).map((p: Row) => p.id);
    const todasMarcadas = conta.id === contaSelecionada
      && ids.length > 0 && ids.every((id: string) => selecionadas.includes(id));
    if (todasMarcadas) {
      setSelecionadas([]);
      setContaSelecionada('');
    } else {
      setContaSelecionada(conta.id);
      setSelecionadas(ids);
    }
  }

  function confirmar() {
    if (!selecionadas.length) return;
    const escolhidas = selecionadas
      .map((id) => porId.get(id))
      .filter(Boolean) as { conta: Row; parcela: Row }[];
    if (!escolhidas.length) return;
    // Ordem de vencimento: é nela que o valor é distribuído no pagamento.
    const parcelas = escolhidas
      .map((e) => e.parcela)
      .sort((a, b) => String(a.dataVencimento).localeCompare(String(b.dataVencimento)));
    onUsarNoLancamento({ conta: escolhidas[0].conta, parcelas });
  }

  const campo = 'w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={onFechar}>
      <div
        className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-5 py-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-rose-600" />
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">Buscar conta a pagar</h2>
              <p className="text-xs text-slate-500">
                Escolha a parcela e o lançamento é preenchido com os dados da conta
              </p>
            </div>
          </div>
          <button onClick={onFechar} className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex gap-2">
            <input
              autoFocus
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); buscar(); } }}
              placeholder="Nº do documento, nº da conta, credor ou descrição..."
              className={campo}
            />
            <button
              type="button"
              onClick={buscar}
              disabled={buscando}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-60"
            >
              {buscando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Buscar
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {!buscou ? (
            <p className="py-10 text-center text-sm text-slate-400">
              Digite o número do documento da conta que você está pagando.
            </p>
          ) : buscando ? (
            <p className="py-10 text-center text-sm text-slate-500">Buscando...</p>
          ) : !contas.length ? (
            <p className="py-10 text-center text-sm text-slate-400">
              Nenhuma conta em aberto encontrada com esse termo.
            </p>
          ) : contas.map((c) => {
            const parcelas = (c.parcelas ?? []) as Row[];
            const abertas = parcelas.filter(emAberto);
            const todasMarcadas = c.id === contaSelecionada
              && abertas.length > 0 && abertas.every((p) => selecionadas.includes(p.id));
            return (
              <div key={c.id} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="flex items-start justify-between gap-3 bg-slate-50 dark:bg-slate-800 px-4 py-2.5">
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-slate-900 dark:text-white">
                      {c.numero} · {c.descricao}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {c.credor?.nome ?? 'Sem credor'} · {c.planoDeConta?.nome ?? NAO_INFORMADO}
                      {c.numeroDocumento ? ` · doc ${c.numeroDocumento}` : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold">{formatarBRL(c.valorTotal)}</div>
                    {abertas.length > 1 && (
                      <button
                        type="button"
                        onClick={() => alternarConta(c)}
                        className="text-[11px] font-semibold text-rose-600 hover:underline"
                      >
                        {todasMarcadas ? 'Desmarcar todas' : `Selecionar as ${abertas.length} em aberto`}
                      </button>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {parcelas.map((p) => {
                    const podeSelecionar = emAberto(p);
                    return (
                      <label
                        key={p.id}
                        className={`flex items-center gap-3 px-4 py-2 text-sm ${
                          podeSelecionar ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60' : 'opacity-60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={!podeSelecionar}
                          checked={selecionadas.includes(p.id)}
                          onChange={() => alternar(c.id, p.id)}
                          className="accent-rose-600"
                        />
                        <span className="w-12 text-xs font-semibold text-slate-500">
                          {p.numeroParcela}/{p.totalParcelas}
                        </span>
                        <span className="w-24 text-slate-600 dark:text-slate-300">{dataBR(p.dataVencimento)}</span>
                        <span className="flex-1 text-right font-semibold text-slate-900 dark:text-white">
                          {formatarBRL(p.valorParcela)}
                        </span>
                        <span className="w-32 text-right text-xs text-slate-500">
                          saldo {formatarBRL(p.valorSaldo)}
                        </span>
                        <span className={`px-2 py-1 rounded text-[11px] font-semibold ${STATUS_PARCELA_CORES[p.status] ?? ''}`}>
                          {STATUS_PARCELA_LABELS[p.status] ?? p.status}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-700 px-5 py-3">
          <span className="text-sm text-slate-500">
            {selecionadas.length
              ? <>{selecionadas.length} parcela(s) · a pagar <strong className="text-slate-900 dark:text-white">{formatarBRL(total)}</strong></>
              : 'Selecione uma ou mais parcelas da mesma conta'}
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={onFechar} className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium">
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmar}
              disabled={!selecionadas.length}
              className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-40"
            >
              Usar no lançamento <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
