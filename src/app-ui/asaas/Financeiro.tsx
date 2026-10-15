/**
 * Pagamentos › Financeiro: saldo, a receber e extrato da CONTA Asaas (vale
 * para a conta inteira, inclusive outros campos que usem a mesma chave).
 * Saque fica no app/site do Asaas: a chave do sistema não tem permissão de
 * transferência, por segurança.
 */
import { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, CalendarClock, Info, Percent, Wallet } from 'lucide-react';
import { brl, Botao, Campo, Cartao, Carregando, cx, dataBr, Erro, hojeIso, inputCls, Metrica, useDados } from './comum';

interface Fin {
  ambiente: string; contaNome: string | null; compartilhada: boolean; saldo: number;
  aReceber: { qtd: number; valor: number; liquido: number } | null; recebidoPeriodo: { qtd: number; valor: number; liquido: number } | null;
  aReceberPorData: { data: string; valor: number }[]; de: string; ate: string; offset: number;
  totais: { entradas: number; saidas: number; taxas: number };
  extrato: { hasMore: boolean; totalCount: number; linhas: { id: string; value: number; balance: number; type: string; rotulo: string; date: string; description: string }[] };
}

export default function Financeiro() {
  const [periodo, setPeriodo] = useState({ de: `${hojeIso().slice(0, 8)}01`, ate: hojeIso() });
  const [offset, setOffset] = useState(0);
  const qs = useMemo(() => `financeiro?de=${periodo.de}&ate=${periodo.ate}&offset=${offset}`, [periodo, offset]);
  const { dados: f, erro, carregando, recarregar } = useDados<Fin>(qs);

  return (
    <div className="space-y-4">
      {f?.compartilhada && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-50 text-sky-800 text-sm dark:bg-sky-900/20 dark:text-sky-300">
          <Info className="w-4 h-4" /> Esta conta Asaas também recebe por outros campos: saldo e extrato são da conta inteira.
        </div>
      )}
      {erro && <Erro msg={erro} onTentar={recarregar} />}
      {carregando && !f ? <Carregando /> : f && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metrica icone={Wallet} tom="emerald" rotulo="Saldo disponível" valor={brl(f.saldo)} sub={f.contaNome ?? undefined} />
            <Metrica icone={CalendarClock} tom="sky" rotulo="A receber (confirmado)" valor={brl(f.aReceber?.liquido ?? f.aReceber?.valor)} sub={`${f.aReceber?.qtd ?? 0} cobranças · cartão cai em D+30 por parcela`} />
            <Metrica icone={ArrowDownLeft} tom="purple" rotulo="Recebido no período" valor={brl(f.recebidoPeriodo?.valor)} sub={`líquido ${brl(f.recebidoPeriodo?.liquido)} · ${f.recebidoPeriodo?.qtd ?? 0} pagamentos`} />
            <Metrica icone={Percent} tom="rose" rotulo="Taxas no extrato" valor={brl(Math.abs(f.totais.taxas))} sub="Página atual do extrato" />
          </div>

          {f.aReceberPorData.length > 0 && (
            <Cartao className="p-4">
              <p className="text-sm font-bold mb-2">A receber por data prevista (cobranças deste campo)</p>
              <div className="flex flex-wrap gap-2">
                {f.aReceberPorData.map((d) => (
                  <div key={d.data} className="px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-900/40 text-sm"><p className="text-xs text-slate-500">{d.data === 'sem data' ? 'Sem data' : dataBr(d.data)}</p><p className="font-bold">{brl(d.valor)}</p></div>
                ))}
              </div>
            </Cartao>
          )}

          <Cartao className="overflow-hidden">
            <div className="flex flex-wrap items-end gap-2 p-3 border-b border-slate-100 dark:border-slate-700">
              <p className="text-sm font-bold flex-1">Extrato da conta</p>
              <Campo rotulo="De"><input type="date" className={inputCls} value={periodo.de} onChange={(e) => { setOffset(0); setPeriodo({ ...periodo, de: e.target.value }); }} /></Campo>
              <Campo rotulo="Até"><input type="date" className={inputCls} value={periodo.ate} onChange={(e) => { setOffset(0); setPeriodo({ ...periodo, ate: e.target.value }); }} /></Campo>
            </div>
            <div className="flex gap-4 px-4 py-2 text-xs text-slate-500 border-b border-slate-100 dark:border-slate-700">
              <span>Entradas <b className="text-emerald-600">{brl(f.totais.entradas)}</b></span><span>Saídas <b className="text-rose-600">{brl(f.totais.saidas)}</b></span>
              <span>{f.extrato.totalCount} lançamentos</span>
            </div>
            {f.extrato.linhas.length === 0 ? <p className="p-6 text-center text-sm text-slate-400">Nenhum lançamento no período.</p> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs text-slate-500">
                    <tr><th className="text-left font-semibold px-4 py-2">Data</th><th className="text-left font-semibold px-4 py-2">Lançamento</th><th className="text-right font-semibold px-4 py-2">Valor</th><th className="text-right font-semibold px-4 py-2">Saldo</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {f.extrato.linhas.map((t) => (
                      <tr key={t.id}>
                        <td className="px-4 py-2 whitespace-nowrap text-slate-500">{dataBr(t.date)}</td>
                        <td className="px-4 py-2"><p className="font-semibold flex items-center gap-1.5">{t.value >= 0 ? <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />}{t.rotulo}</p><p className="text-xs text-slate-500">{t.description}</p></td>
                        <td className={cx('px-4 py-2 text-right font-semibold whitespace-nowrap', t.value >= 0 ? 'text-emerald-600' : 'text-rose-600')}>{brl(t.value)}</td>
                        <td className="px-4 py-2 text-right text-slate-500 whitespace-nowrap">{brl(t.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {(offset > 0 || f.extrato.hasMore) && (
              <div className="flex justify-end gap-2 p-3 border-t border-slate-100 dark:border-slate-700">
                <Botao tipo="secundario" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>Anterior</Botao>
                <Botao tipo="secundario" disabled={!f.extrato.hasMore} onClick={() => setOffset(offset + 50)}>Próxima</Botao>
              </div>
            )}
          </Cartao>
          <p className="text-xs text-slate-400">Saques: pelo app ou site do Asaas. A chave usada pelo sistema não tem permissão de transferência, o que evita que alguém com acesso ao painel tire dinheiro da conta.</p>
        </>
      )}
    </div>
  );
}
