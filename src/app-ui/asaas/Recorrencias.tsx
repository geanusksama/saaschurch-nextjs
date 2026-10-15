/**
 * Pagamentos › Recorrências: dízimo/oferta mensal feito pelo app (assinatura
 * Asaas no cartão ou em Pix). Igreja não bloqueia ninguém por atraso: "em
 * aberto" é só para a tesouraria acompanhar.
 */
import { useState } from 'react';
import { Pause, Play, Repeat, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { usePermissions } from '../../lib/usePermissions';
import { api, brl, Botao, Cartao, Carregando, confirmar, dataBr, Erro, Metrica, perfilAtual, Selo, useDados, Vazio, inputCls, Campo } from './comum';
import { DetalheCobranca } from './Vendas';

interface Ass {
  id: string; tipo: string; valor: number; ciclo: string; forma: string; formaRotulo: string; status: string; proximo: string | null;
  descricao: string | null; cartao: string | null; pessoa: string; igreja: string | null; totalPago: number; qtdPagas: number; criadaEm: string;
}
interface Linha { id: string; estado: string; status: string; valor: number; vencimento: string | null; pagoEm: string | null; formaRotulo: string }

export default function Recorrencias() {
  const { canEdit, canDelete } = usePermissions(perfilAtual());
  const [status, setStatus] = useState('');
  const { dados, erro, carregando, recarregar } = useDados<Ass[]>(`assinaturas${status ? `?status=${status}` : ''}`);
  const [aberta, setAberta] = useState<Ass | null>(null);
  const [cobranca, setCobranca] = useState<string | null>(null);

  async function acao(a: Ass, nome: string, msg: string, corpo?: unknown) {
    if (msg && !confirmar(msg)) return;
    try {
      await api(`assinatura/${a.id}/${nome}`, { method: 'POST', body: corpo });
      toast.success('Feito');
      recarregar();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const lista = dados ?? [];
  const ativas = lista.filter((a) => a.status === 'ATIVA');
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metrica icone={Repeat} rotulo="Recorrente por mês (ativas)" valor={brl(ativas.reduce((s, a) => s + a.valor, 0))} sub={`${ativas.length} contribuições ativas`} />
        <Metrica icone={Repeat} tom="amber" rotulo="Em aberto" valor={lista.filter((a) => a.status === 'INADIMPLENTE').length} sub="Mensalidade vencida sem pagamento" />
        <Metrica icone={Repeat} tom="emerald" rotulo="Total já recebido" valor={brl(lista.reduce((s, a) => s + a.totalPago, 0))} />
      </div>
      <Cartao className="p-3 flex flex-wrap gap-2 items-end">
        <Campo rotulo="Status">
          <select className={inputCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todas</option><option value="ATIVA">Ativas</option><option value="INADIMPLENTE">Em aberto</option><option value="PAUSADA">Pausadas</option><option value="CANCELADA">Canceladas</option>
          </select>
        </Campo>
      </Cartao>
      {erro && <Erro msg={erro} onTentar={recarregar} />}
      {carregando && !dados ? <Carregando /> : (
        <Cartao className="overflow-hidden">
          {lista.length === 0 ? (
            <Vazio icone={Repeat} titulo="Nenhuma contribuição recorrente" sub="No app, a pessoa liga Repetir todo mês ao dizimar ou ofertar, no cartão ou no Pix." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-500">
                  <tr>
                    <th className="text-left font-semibold px-4 py-2">Pessoa</th><th className="text-left font-semibold px-4 py-2">Tipo</th><th className="text-left font-semibold px-4 py-2">Forma</th>
                    <th className="text-left font-semibold px-4 py-2">Próxima</th><th className="text-left font-semibold px-4 py-2">Status</th><th className="text-right font-semibold px-4 py-2">Valor</th>
                    <th className="text-right font-semibold px-4 py-2">Recebido</th><th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {lista.map((a) => (
                    <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                      <td className="px-4 py-2 cursor-pointer" onClick={() => setAberta(a)}><p className="font-semibold">{a.pessoa}</p><p className="text-xs text-slate-500">{a.igreja}</p></td>
                      <td className="px-4 py-2">{a.tipo === 'DIZIMO' ? 'Dízimo' : 'Oferta'} mensal</td>
                      <td className="px-4 py-2">{a.formaRotulo}{a.cartao ? <span className="block text-xs text-slate-500">{a.cartao}</span> : null}</td>
                      <td className="px-4 py-2">{a.status === 'CANCELADA' ? '—' : dataBr(a.proximo)}</td>
                      <td className="px-4 py-2"><Selo estado={a.status} /></td>
                      <td className="px-4 py-2 text-right font-semibold">{brl(a.valor)}</td>
                      <td className="px-4 py-2 text-right text-slate-500">{brl(a.totalPago)} <span className="text-xs">({a.qtdPagas})</span></td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        {canEdit('asaas_pagamentos') && a.status !== 'CANCELADA' && (a.status === 'PAUSADA'
                          ? <button title="Retomar" onClick={() => acao(a, 'retomar', `Retomar a contribuição de ${a.pessoa}?`)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"><Play className="w-4 h-4" /></button>
                          : <button title="Pausar" onClick={() => acao(a, 'pausar', `Pausar a contribuição de ${a.pessoa}? Novas cobranças deixam de ser geradas.`)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700"><Pause className="w-4 h-4" /></button>)}
                        {canDelete('asaas_pagamentos') && a.status !== 'CANCELADA' && (
                          <button title="Cancelar" onClick={() => acao(a, 'cancelar', `Cancelar de vez a contribuição de ${a.pessoa}?`)} className="p-1.5 rounded hover:bg-rose-50 text-rose-600"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Cartao>
      )}
      {aberta && <Historico a={aberta} onFechar={() => setAberta(null)} onCobranca={setCobranca} onValor={(v) => acao(aberta, 'valor', `Mudar o valor para ${brl(v)}? Vale também para a cobrança em aberto.`, { valor: v })} podeEditar={canEdit('asaas_pagamentos')} />}
      <DetalheCobranca id={cobranca} onFechar={() => setCobranca(null)} onMudou={recarregar} />
    </div>
  );
}

function Historico({ a, onFechar, onCobranca, onValor, podeEditar }: { a: Ass; onFechar: () => void; onCobranca: (id: string) => void; onValor: (v: number) => void; podeEditar: boolean }) {
  const { dados } = useDados<{ linhas: Linha[] }>(`cobrancas?assinaturaId=${a.id}&tamanho=100`);
  const [valor, setValor] = useState('');
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onFechar} />
      <Cartao className="relative w-full max-w-lg p-5 max-h-[85vh] overflow-y-auto">
        <p className="font-bold text-lg">{a.pessoa}</p>
        <p className="text-sm text-slate-500 mb-4">{a.tipo === 'DIZIMO' ? 'Dízimo' : 'Oferta'} mensal · {a.formaRotulo} · desde {dataBr(a.criadaEm)}</p>
        {podeEditar && a.status !== 'CANCELADA' && (
          <div className="flex gap-2 mb-4">
            <input className={inputCls} placeholder={`Novo valor (hoje ${brl(a.valor)})`} value={valor} onChange={(e) => setValor(e.target.value)} />
            <Botao onClick={() => { const v = Number(valor.replace(/\./g, '').replace(',', '.')); if (v >= 5) onValor(v); else toast.error('Valor mínimo de R$ 5,00.'); }}>Alterar valor</Botao>
          </div>
        )}
        <p className="text-sm font-bold mb-2">Cobranças</p>
        {!dados ? <Carregando /> : dados.linhas.length === 0 ? <p className="text-sm text-slate-400">Nenhuma cobrança gerada ainda.</p> : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {dados.linhas.map((l) => (
              <button key={l.id} onClick={() => onCobranca(l.id)} className="w-full flex items-center gap-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700/40">
                <span className="flex-1 text-sm">{dataBr(l.vencimento)} <span className="text-xs text-slate-500">{l.pagoEm ? `pago ${dataBr(l.pagoEm)}` : ''}</span></span>
                <Selo estado={l.estado} status={l.status} /><span className="w-24 text-right font-semibold text-sm">{brl(l.valor)}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-end mt-4"><Botao tipo="secundario" onClick={onFechar}>Fechar</Botao></div>
      </Cartao>
    </div>
  );
}
