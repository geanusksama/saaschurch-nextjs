/**
 * Pagamentos › Contribuições e vendas: tudo o que passou pelo Asaas no campo
 * no período, em tabela (ordenar, paginar, exportar, imprimir) e o detalhe
 * com linha do tempo, taxa e ações (estornar, cancelar, atualizar do Asaas).
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ExternalLink, Receipt, RefreshCcw, RotateCcw, X } from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '../../lib/usePermissions';
import {
  api, brl, Botao, Campo, Cartao, Carregando, confirmar, copiar, cx, dataBr, Erro, Gaveta, inputCls, ORIGENS, perfilAtual, Selo, useDados, Vazio,
} from './comum';
import { FiltroPeriodo, periodoPadrao, rotuloPeriodo, Tabela, type Periodo } from './tabela';

interface Linha {
  id: string; asaasPaymentId: string; origem: string; forma: string; formaRotulo: string; status: string; estado: string;
  valor: number; valorLiquido: number | null; taxa: number | null; valorEstornado: number; parcelas: number; descricao: string | null;
  pagadorNome: string | null; invoiceUrl: string | null; cartao: string | null; vencimento: string | null; pagoEm: string | null; criadoEm: string;
  finalidade?: string;
}
interface Pagina { total: number; pagina: number; tamanho: number; somaValor: number; somaLiquido: number; linhas: Linha[] }
interface Detalhe extends Linha {
  eventos: { id: string; evento: string; recebido_em: string; erro: string | null; status: string | null }[];
  contribuicao: { tipo: string; status: string; autenticacao: string; descricao: string | null } | null;
  pedido: { numero: number; status: string; itens: { nome: string; quantidade: number; total: number }[] } | null;
  perfil: { nome: string; email: string | null; celular: string | null } | null;
}

const EVENTOS: Record<string, string> = {
  PAYMENT_CREATED: 'Cobrança criada', PAYMENT_UPDATED: 'Cobrança alterada', PAYMENT_CONFIRMED: 'Pagamento confirmado', PAYMENT_RECEIVED: 'Pagamento recebido',
  PAYMENT_OVERDUE: 'Venceu sem pagamento', PAYMENT_DELETED: 'Cobrança cancelada', PAYMENT_REFUNDED: 'Estornado', PAYMENT_PARTIALLY_REFUNDED: 'Estorno parcial',
  PAYMENT_REFUND_IN_PROGRESS: 'Estorno em andamento', PAYMENT_CHARGEBACK_REQUESTED: 'Chargeback pedido', PAYMENT_REPROVED_BY_RISK_ANALYSIS: 'Reprovado na análise',
  PAYMENT_RESTORED: 'Cobrança restaurada',
};

export default function Vendas() {
  const [sp, setSp] = useSearchParams();
  const [periodo, setPeriodo] = useState<Periodo>(periodoPadrao());
  // Vindo de Dízimos e ofertas: /app-ui/pagamentos/vendas?finalidade=DIZIMO
  const [filtro, setFiltro] = useState({ estado: '', forma: '', origem: '', finalidade: sp.get('finalidade') ?? '' });
  const qs = useMemo(() => {
    const p = new URLSearchParams({ tudo: '1', de: periodo.de, ate: periodo.ate });
    Object.entries(filtro).forEach(([k, v]) => v && p.set(k, v));
    return p.toString();
  }, [filtro, periodo]);
  const { dados, erro, carregando, recarregar } = useDados<Pagina>(`cobrancas?${qs}`);
  const aberto = sp.get('id');
  const muda = (k: keyof typeof filtro, v: string) => setFiltro((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      {erro && <Erro msg={erro} onTentar={recarregar} />}
      <Tabela<Linha>
        titulo="Contribuições e vendas"
        subtitulo={rotuloPeriodo(periodo)}
        linhas={dados?.linhas ?? []}
        carregando={carregando}
        chave={(l) => l.id}
        aoClicar={(l) => setSp({ id: l.id, ...(filtro.finalidade ? { finalidade: filtro.finalidade } : {}) })}
        ordemInicial={{ chave: 'data', desc: true }}
        barra={
          <>
            <FiltroPeriodo valor={periodo} onChange={setPeriodo} />
            <Campo rotulo="Finalidade">
              <select className={inputCls} value={filtro.finalidade} onChange={(e) => muda('finalidade', e.target.value)}>
                <option value="">Todas</option><option value="DIZIMO">Dízimos</option><option value="OFERTA">Ofertas</option>
                <option value="LOJA">Loja e ingressos</option><option value="OUTRA">Outras</option>
              </select>
            </Campo>
            <Campo rotulo="Status">
              <select className={inputCls} value={filtro.estado} onChange={(e) => muda('estado', e.target.value)}>
                <option value="">Todos</option><option value="PAGO">Pago</option><option value="PENDENTE">Aguardando</option><option value="VENCIDO">Vencido</option>
                <option value="ESTORNADO">Estornado</option><option value="CANCELADO">Cancelado</option>
              </select>
            </Campo>
            <Campo rotulo="Forma">
              <select className={inputCls} value={filtro.forma} onChange={(e) => muda('forma', e.target.value)}>
                <option value="">Todas</option><option value="PIX">Pix</option><option value="CREDIT_CARD">Crédito</option><option value="DEBIT_CARD">Débito</option><option value="BOLETO">Boleto</option>
              </select>
            </Campo>
            <Campo rotulo="Origem">
              <select className={inputCls} value={filtro.origem} onChange={(e) => muda('origem', e.target.value)}>
                <option value="">Todas</option>{Object.entries(ORIGENS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Campo>
          </>
        }
        resumo={dados && (
          <>
            <span><b className="text-slate-700 dark:text-slate-200">{dados.total}</b> registros no período</span>
            <span>Total <b className="text-slate-700 dark:text-slate-200">{brl(dados.somaValor)}</b></span>
            <span>Líquido conhecido <b className="text-slate-700 dark:text-slate-200">{brl(dados.somaLiquido)}</b></span>
          </>
        )}
        vazio={<Vazio icone={Receipt} titulo="Nada neste filtro" sub="Contribuições do app, cobranças rápidas e pagamentos por link aparecem aqui." />}
        colunas={[
          { chave: 'data', rotulo: 'Data', valor: (l) => l.criadoEm, texto: (l) => dataBr(l.criadoEm, true), classe: 'whitespace-nowrap text-slate-500' },
          { chave: 'pagador', rotulo: 'Pagador', valor: (l) => l.pagadorNome ?? '', render: (l) => <><p className="font-semibold">{l.pagadorNome || '—'}</p><p className="text-xs text-slate-500 truncate max-w-xs">{l.descricao}</p></> },
          { chave: 'finalidade', rotulo: 'Finalidade', valor: (l) => l.finalidade ?? '' },
          { chave: 'origem', rotulo: 'Origem', valor: (l) => ORIGENS[l.origem] ?? l.origem },
          { chave: 'forma', rotulo: 'Forma', valor: (l) => `${l.formaRotulo}${l.parcelas > 1 ? ` ${l.parcelas}x` : ''}`, classe: 'whitespace-nowrap' },
          { chave: 'status', rotulo: 'Status', valor: (l) => l.estado, texto: (l) => `${l.estado} (${l.status})`, render: (l) => <Selo estado={l.estado} status={l.status} /> },
          { chave: 'pago', rotulo: 'Pago em', valor: (l) => l.pagoEm ?? '', texto: (l) => dataBr(l.pagoEm, true), classe: 'whitespace-nowrap text-slate-500' },
          { chave: 'valor', rotulo: 'Valor', alinhar: 'direita', valor: (l) => l.valor, texto: (l) => brl(l.valor), render: (l) => <b>{brl(l.valor)}</b> },
          { chave: 'taxa', rotulo: 'Taxa', alinhar: 'direita', valor: (l) => l.taxa, texto: (l) => brl(l.taxa), classe: 'text-slate-500 whitespace-nowrap' },
          { chave: 'liquido', rotulo: 'Líquido', alinhar: 'direita', valor: (l) => l.valorLiquido, texto: (l) => brl(l.valorLiquido), classe: 'text-slate-500 whitespace-nowrap' },
        ]}
      />
      <DetalheCobranca id={aberto} onFechar={() => setSp(filtro.finalidade ? { finalidade: filtro.finalidade } : {})} onMudou={recarregar} />
    </div>
  );
}

export function DetalheCobranca({ id, onFechar, onMudou }: { id: string | null; onFechar: () => void; onMudou: () => void }) {
  const { canDelete } = usePermissions(perfilAtual());
  const [carga, setCarga] = useState<{ id: string; d: Detalhe | null; erro: string | null } | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [parcial, setParcial] = useState('');
  const d = carga?.id === id ? carga.d : null;
  const erro = carga?.id === id ? carga.erro : null;
  const setD = (det: Detalhe) => id && setCarga({ id, d: det, erro: null });

  useEffect(() => {
    if (!id) return;
    api<Detalhe>(`cobranca/${id}`)
      .then((det) => setCarga({ id, d: det, erro: null }))
      .catch((e) => setCarga({ id, d: null, erro: (e as Error).message }));
  }, [id]);

  async function acao(nome: string, msg: string, corpo?: unknown) {
    if (!id) return;
    if (nome !== 'sincronizar' && !confirmar(msg)) return;
    setOcupado(nome);
    try {
      await api(`cobranca/${id}/${nome}`, { method: 'POST', body: corpo });
      setD(await api<Detalhe>(`cobranca/${id}`));
      onMudou();
      toast.success(nome === 'sincronizar' ? 'Atualizado com o Asaas' : 'Feito');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  return (
    <Gaveta aberta={Boolean(id)} onFechar={onFechar} titulo={d ? `${brl(d.valor)} · ${d.pagadorNome ?? 'Sem identificação'}` : 'Cobrança'}>
      {erro && <Erro msg={erro} />}
      {!d && !erro && <Carregando />}
      {d && (
        <div className="space-y-4">
          <Cartao className="p-4 grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-slate-500">Status</p><Selo estado={d.estado} status={d.status} /><p className="text-[11px] text-slate-400 mt-1">{d.status}</p></div>
            <div><p className="text-xs text-slate-500">Origem</p><p className="font-semibold">{ORIGENS[d.origem] ?? d.origem}</p></div>
            <div><p className="text-xs text-slate-500">Forma</p><p className="font-semibold">{d.formaRotulo}{d.parcelas > 1 ? ` em ${d.parcelas}x` : ''}</p>{d.cartao && <p className="text-xs text-slate-500">{d.cartao}</p>}</div>
            <div><p className="text-xs text-slate-500">Criada / paga</p><p>{dataBr(d.criadoEm, true)}</p><p className="text-xs text-slate-500">{d.pagoEm ? `Paga em ${dataBr(d.pagoEm, true)}` : `Vence ${dataBr(d.vencimento)}`}</p></div>
            <div><p className="text-xs text-slate-500">Valor bruto</p><p className="font-bold">{brl(d.valor)}</p></div>
            <div><p className="text-xs text-slate-500">Taxa Asaas → líquido</p><p>{d.taxa === null ? 'após o pagamento' : `${brl(d.taxa)} → ${brl(d.valorLiquido)}`}</p></div>
            {d.valorEstornado > 0 && <div className="col-span-2"><p className="text-xs text-slate-500">Estornado</p><p className="font-semibold text-sky-700">{brl(d.valorEstornado)}</p></div>}
            <div className="col-span-2"><p className="text-xs text-slate-500">Descrição</p><p>{d.descricao ?? '—'}</p><p className="text-[11px] text-slate-400 mt-1">Asaas: {d.asaasPaymentId}</p></div>
          </Cartao>

          {(d.perfil || d.contribuicao || d.pedido) && (
            <Cartao className="p-4 text-sm space-y-2">
              {d.perfil && <p><span className="text-slate-500">Conta no app:</span> <b>{d.perfil.nome}</b> {d.perfil.email ? `· ${d.perfil.email}` : ''}</p>}
              {d.contribuicao && <p><span className="text-slate-500">{d.contribuicao.tipo === 'DIZIMO' ? 'Dízimo' : 'Oferta'}:</span> {d.contribuicao.descricao} · <b>{d.contribuicao.autenticacao}</b> · {d.contribuicao.status}</p>}
              {d.pedido && (
                <div><p><span className="text-slate-500">Pedido</span> <b>#{d.pedido.numero}</b> · {d.pedido.status}</p>
                  <ul className="text-xs text-slate-500 mt-1">{d.pedido.itens.map((i, k) => <li key={k}>{i.quantidade}x {i.nome} — {brl(i.total)}</li>)}</ul></div>
              )}
            </Cartao>
          )}

          <Cartao className="p-4">
            <p className="text-sm font-bold mb-2">Linha do tempo (webhook)</p>
            {d.eventos.length === 0 ? <p className="text-xs text-slate-400">Nenhum evento recebido ainda. Confira o webhook em Configurações.</p> : (
              <ol className="space-y-2">
                {d.eventos.map((ev) => (
                  <li key={ev.id} className="flex gap-3 text-sm">
                    <span className={cx('mt-1.5 w-2 h-2 rounded-full flex-shrink-0', ev.erro ? 'bg-rose-500' : 'bg-purple-500')} />
                    <div><p className="font-semibold">{EVENTOS[ev.evento] ?? ev.evento}</p><p className="text-xs text-slate-500">{dataBr(ev.recebido_em, true)}{ev.erro ? ` · erro: ${ev.erro}` : ''}</p></div>
                  </li>
                ))}
              </ol>
            )}
          </Cartao>

          <div className="flex flex-wrap gap-2">
            <Botao tipo="secundario" carregando={ocupado === 'sincronizar'} onClick={() => acao('sincronizar', '')}><RefreshCcw className="w-4 h-4" />Atualizar do Asaas</Botao>
            {d.invoiceUrl && <a href={d.invoiceUrl} target="_blank" rel="noreferrer"><Botao tipo="secundario"><ExternalLink className="w-4 h-4" />Fatura / comprovante</Botao></a>}
            {d.invoiceUrl && d.estado === 'PENDENTE' && <Botao tipo="secundario" onClick={() => copiar(d.invoiceUrl!, 'Link copiado')}>Copiar link</Botao>}
            {canDelete('asaas_vendas') && ['PENDENTE', 'VENCIDO'].includes(d.estado) && (
              <Botao tipo="secundario" carregando={ocupado === 'cancelar'} onClick={() => acao('cancelar', 'Cancelar esta cobrança em aberto?')}><X className="w-4 h-4" />Cancelar cobrança</Botao>
            )}
          </div>

          {canDelete('asaas_vendas') && d.estado === 'PAGO' && (
            <Cartao className="p-4 space-y-2 border-rose-200">
              <p className="text-sm font-bold text-rose-700 flex items-center gap-2"><RotateCcw className="w-4 h-4" />Estornar</p>
              <p className="text-xs text-slate-500">Devolve o dinheiro para quem pagou (Pix volta para a conta; cartão, para a fatura). O pedido/contribuição no app é atualizado.</p>
              <div className="flex flex-wrap gap-2 items-center">
                <input className={cx(inputCls, 'w-40')} placeholder={`Parcial (até ${brl(d.valor)})`} value={parcial} onChange={(e) => setParcial(e.target.value)} disabled={d.parcelas > 1} />
                <Botao tipo="perigo" carregando={ocupado === 'estornar'}
                  onClick={() => {
                    const v = Number(parcial.replace(/\./g, '').replace(',', '.')) || undefined;
                    acao('estornar', v ? `Estornar ${brl(v)} de ${brl(d.valor)}?` : `Estornar o valor total de ${brl(d.valor)}?`, { valor: v });
                  }}>
                  {parcial ? 'Estornar parcial' : 'Estornar total'}
                </Botao>
              </div>
            </Cartao>
          )}
        </div>
      )}
    </Gaveta>
  );
}
