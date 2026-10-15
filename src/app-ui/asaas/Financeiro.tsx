/**
 * Pagamentos › Financeiro: saldo, a receber e extrato da CONTA Asaas (vale
 * para a conta inteira, inclusive outros campos que usem a mesma chave).
 * Saque fica no app/site do Asaas: a chave do sistema não tem permissão de
 * transferência, por segurança.
 */
import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, CalendarClock, Info, Percent, Wallet } from 'lucide-react';
import { brl, Cartao, Carregando, cx, dataBr, Erro, Metrica, useDados } from './comum';
import { FiltroPeriodo, periodoPadrao, rotuloPeriodo, Tabela, type Periodo } from './tabela';

interface Lancamento { id: string; value: number; balance: number; type: string; rotulo: string; date: string; description: string }
interface Fin {
  ambiente: string; contaNome: string | null; compartilhada: boolean; saldo: number;
  aReceber: { qtd: number; valor: number; liquido: number } | null; recebidoPeriodo: { qtd: number; valor: number; liquido: number } | null;
  aReceberPorData: { data: string; valor: number }[]; de: string; ate: string;
  totais: { entradas: number; saidas: number; taxas: number };
  extrato: { hasMore: boolean; totalCount: number; linhas: Lancamento[] };
}

export default function Financeiro() {
  const [periodo, setPeriodo] = useState<Periodo>(periodoPadrao());
  const { dados: f, erro, carregando, recarregar } = useDados<Fin>(`financeiro?de=${periodo.de}&ate=${periodo.ate}`);
  const rotulo = rotuloPeriodo(periodo);

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
            <Metrica icone={ArrowDownLeft} tom="purple" rotulo={`Recebido · ${rotulo}`} valor={brl(f.recebidoPeriodo?.valor)} sub={`líquido ${brl(f.recebidoPeriodo?.liquido)} · ${f.recebidoPeriodo?.qtd ?? 0} pagamentos`} />
            <Metrica icone={Percent} tom="rose" rotulo={`Taxas · ${rotulo}`} valor={brl(Math.abs(f.totais.taxas))} sub={`Entradas ${brl(f.totais.entradas)} · saídas ${brl(f.totais.saidas)}`} />
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
        </>
      )}

      <Tabela<Lancamento>
        titulo="Extrato da conta Asaas"
        subtitulo={rotulo}
        linhas={f?.extrato.linhas ?? []}
        carregando={carregando}
        chave={(t) => t.id}
        ordemInicial={{ chave: 'data', desc: true }}
        barra={<FiltroPeriodo valor={periodo} onChange={setPeriodo} />}
        resumo={f && (
          <>
            <span>{f.extrato.totalCount} lançamentos{f.extrato.hasMore ? ' (mostrando os 2.000 primeiros)' : ''}</span>
            <span>Entradas <b className="text-emerald-600">{brl(f.totais.entradas)}</b></span>
            <span>Saídas <b className="text-rose-600">{brl(f.totais.saidas)}</b></span>
            <span>Taxas <b className="text-rose-600">{brl(f.totais.taxas)}</b></span>
          </>
        )}
        vazio={<p className="py-6 text-center text-sm text-slate-400">Nenhum lançamento no período.</p>}
        colunas={[
          { chave: 'data', rotulo: 'Data', valor: (t) => t.date, texto: (t) => dataBr(t.date), classe: 'whitespace-nowrap text-slate-500' },
          {
            chave: 'lancamento', rotulo: 'Lançamento', valor: (t) => t.rotulo,
            render: (t) => <p className="font-semibold flex items-center gap-1.5">{t.value >= 0 ? <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" /> : <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />}{t.rotulo}</p>,
          },
          { chave: 'descricao', rotulo: 'Descrição', valor: (t) => t.description, classe: 'text-xs text-slate-500' },
          { chave: 'valor', rotulo: 'Valor', alinhar: 'direita', valor: (t) => t.value, texto: (t) => brl(t.value), render: (t) => <span className={cx('font-semibold whitespace-nowrap', t.value >= 0 ? 'text-emerald-600' : 'text-rose-600')}>{brl(t.value)}</span> },
          { chave: 'saldo', rotulo: 'Saldo após', alinhar: 'direita', valor: (t) => t.balance, texto: (t) => brl(t.balance), classe: 'text-slate-500 whitespace-nowrap' },
        ]}
      />
      <p className="text-xs text-slate-400">Saques: pelo app ou site do Asaas. A chave usada pelo sistema não tem permissão de transferência, o que evita que alguém com acesso ao painel tire dinheiro da conta.</p>
    </div>
  );
}
