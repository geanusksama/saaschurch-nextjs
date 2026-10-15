/**
 * Pagamentos › Contribuições e vendas: tudo o que passou pelo Asaas no campo,
 * com filtros, exportação CSV e o detalhe com linha do tempo, taxa e ações
 * (estornar, cancelar, atualizar do Asaas).
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Download, ExternalLink, Receipt, RefreshCcw, RotateCcw, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '../../lib/usePermissions';
import {
  api, brl, Botao, Campo, Cartao, Carregando, confirmar, copiar, cx, dataBr, Erro, Gaveta, hojeIso, inputCls, ORIGENS, perfilAtual, Selo, useDados, Vazio,
} from './comum';

interface Linha {
  id: string; asaasPaymentId: string; origem: string; forma: string; formaRotulo: string; status: string; estado: string;
  valor: number; valorLiquido: number | null; taxa: number | null; valorEstornado: number; parcelas: number; descricao: string | null;
  pagadorNome: string | null; invoiceUrl: string | null; cartao: string | null; vencimento: string | null; pagoEm: string | null; criadoEm: string;
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
  const [filtro, setFiltro] = useState({ de: hojeIso(-30), ate: hojeIso(), estado: '', forma: '', origem: '', q: '' });
  const [pagina, setPagina] = useState(1);
  const qs = useMemo(() => {
    const p = new URLSearchParams({ pagina: String(pagina), tamanho: '30' });
    Object.entries(filtro).forEach(([k, v]) => v && p.set(k, v));
    return p.toString();
  }, [filtro, pagina]);
  const { dados, erro, carregando, recarregar } = useDados<Pagina>(`cobrancas?${qs}`);
  const aberto = sp.get('id');

  const muda = (k: keyof typeof filtro, v: string) => {
    setPagina(1);
    setFiltro((f) => ({ ...f, [k]: v }));
  };

  async function exportar() {
    const p = new URLSearchParams(qs);
    p.set('tamanho', '200');
    const todas: Linha[] = [];
    for (let i = 1; i <= 25; i++) {
      p.set('pagina', String(i));
      const pg = await api<Pagina>(`cobrancas?${p}`);
      todas.push(...pg.linhas);
      if (todas.length >= pg.total) break;
    }
    const cab = ['Data', 'Pagador', 'Origem', 'Descrição', 'Forma', 'Parcelas', 'Status', 'Valor', 'Taxa', 'Líquido', 'Pago em', 'Id Asaas'];
    const linhas = todas.map((l) => [dataBr(l.criadoEm, true), l.pagadorNome ?? '', ORIGENS[l.origem] ?? l.origem, l.descricao ?? '', l.formaRotulo, l.parcelas, l.status,
      l.valor.toFixed(2).replace('.', ','), l.taxa?.toFixed(2).replace('.', ',') ?? '', l.valorLiquido?.toFixed(2).replace('.', ',') ?? '', dataBr(l.pagoEm, true), l.asaasPaymentId]);
    const csv = [cab, ...linhas].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
    a.download = `pagamentos-${filtro.de}-a-${filtro.ate}.csv`;
    a.click();
  }

  return (
    <div className="space-y-4">
      <Cartao className="p-3 flex flex-wrap items-end gap-2">
        <Campo rotulo="De"><input type="date" className={inputCls} value={filtro.de} onChange={(e) => muda('de', e.target.value)} /></Campo>
        <Campo rotulo="Até"><input type="date" className={inputCls} value={filtro.ate} onChange={(e) => muda('ate', e.target.value)} /></Campo>
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
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input className={cx(inputCls, 'pl-9')} placeholder="Pagador, descrição ou id" value={filtro.q} onChange={(e) => muda('q', e.target.value)} />
        </div>
        <Botao tipo="secundario" onClick={() => exportar().catch((e) => toast.error((e as Error).message))}><Download className="w-4 h-4" />CSV</Botao>
      </Cartao>

      {erro && <Erro msg={erro} onTentar={recarregar} />}
      {carregando && !dados ? <Carregando /> : dados && (
        <Cartao className="overflow-hidden">
          <div className="flex flex-wrap gap-4 px-4 py-2.5 text-xs text-slate-500 border-b border-slate-100 dark:border-slate-700">
            <span><b className="text-slate-700 dark:text-slate-200">{dados.total}</b> registros</span>
            <span>Total <b className="text-slate-700 dark:text-slate-200">{brl(dados.somaValor)}</b></span>
            <span>Líquido conhecido <b className="text-slate-700 dark:text-slate-200">{brl(dados.somaLiquido)}</b></span>
          </div>
          {dados.linhas.length === 0 ? (
            <Vazio icone={Receipt} titulo="Nada neste filtro" sub="Contribuições do app, cobranças rápidas e pagamentos por link aparecem aqui." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-500">
                  <tr>
                    <th className="text-left font-semibold px-4 py-2">Data</th><th className="text-left font-semibold px-4 py-2">Pagador</th>
                    <th className="text-left font-semibold px-4 py-2">Origem</th><th className="text-left font-semibold px-4 py-2">Forma</th>
                    <th className="text-left font-semibold px-4 py-2">Status</th><th className="text-right font-semibold px-4 py-2">Valor</th><th className="text-right font-semibold px-4 py-2">Líquido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {dados.linhas.map((l) => (
                    <tr key={l.id} onClick={() => setSp({ id: l.id })} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40">
                      <td className="px-4 py-2 whitespace-nowrap text-slate-500">{dataBr(l.criadoEm, true)}</td>
                      <td className="px-4 py-2"><p className="font-semibold">{l.pagadorNome || '—'}</p><p className="text-xs text-slate-500 truncate max-w-xs">{l.descricao}</p></td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{ORIGENS[l.origem] ?? l.origem}</td>
                      <td className="px-4 py-2 whitespace-nowrap">{l.formaRotulo}{l.parcelas > 1 ? ` ${l.parcelas}x` : ''}</td>
                      <td className="px-4 py-2"><Selo estado={l.estado} status={l.status} /></td>
                      <td className="px-4 py-2 text-right font-semibold whitespace-nowrap">{brl(l.valor)}</td>
                      <td className="px-4 py-2 text-right text-slate-500 whitespace-nowrap">{brl(l.valorLiquido)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {dados.total > dados.tamanho && (
            <div className="flex items-center justify-end gap-2 px-4 py-2 border-t border-slate-100 dark:border-slate-700 text-sm">
              <Botao tipo="secundario" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Botao>
              <span className="text-slate-500">Página {pagina} de {Math.ceil(dados.total / dados.tamanho)}</span>
              <Botao tipo="secundario" disabled={pagina * dados.tamanho >= dados.total} onClick={() => setPagina((p) => p + 1)}>Próxima</Botao>
            </div>
          )}
        </Cartao>
      )}
      <DetalheCobranca id={aberto} onFechar={() => setSp({})} onMudou={recarregar} />
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
            {canDelete('asaas_pagamentos') && ['PENDENTE', 'VENCIDO'].includes(d.estado) && (
              <Botao tipo="secundario" carregando={ocupado === 'cancelar'} onClick={() => acao('cancelar', 'Cancelar esta cobrança em aberto?')}><X className="w-4 h-4" />Cancelar cobrança</Botao>
            )}
          </div>

          {canDelete('asaas_pagamentos') && d.estado === 'PAGO' && (
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
