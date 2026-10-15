/** Pagamentos › Visão geral: o que entrou, o que vai entrar e o que está em aberto. */
import { Link } from 'react-router';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, CalendarClock, CircleDollarSign, Clock, CreditCard, Link2, QrCode, Receipt, Repeat, Wallet } from 'lucide-react';
import { brl, Botao, Cartao, Carregando, dataBr, Erro, Metrica, ORIGENS, Selo, useDados, Vazio } from './comum';

interface Linha { id: string; estado: string; status: string; valor: number; formaRotulo: string; origem: string; pagadorNome: string | null; descricao: string | null; criadoEm: string }
interface Resumo {
  configurado: boolean; ativo: boolean; ambiente: string | null;
  recebidoHoje: number; recebidoMes: number; liquidoMes: number; qtdMes: number; ticketMedio: number;
  aReceber: number; qtdAReceber: number; pendentes: number; qtdPendentes: number;
  saldo: number | null; erroSaldo: string | null; recorrenteMensal: number; assinaturas: Record<string, number>;
  porDia: { dia: string; valor: number }[]; porForma: { forma: string; rotulo: string; valor: number; qtd: number }[]; ultimas: Linha[];
}

export default function Visao() {
  const { dados: r, erro, carregando, recarregar } = useDados<Resumo>('resumo');
  if (carregando && !r) return <Carregando />;
  if (erro) return <Erro msg={erro} onTentar={recarregar} />;
  if (!r) return null;

  if (!r.configurado || !r.ativo) {
    return (
      <Cartao>
        <Vazio icone={Wallet} titulo={r.configurado ? 'Pagamento online desligado neste campo' : 'Asaas ainda não configurado neste campo'}
          sub="Cole a chave de API do Asaas em Configurações e ative. O app passa a aceitar Pix com baixa automática, cartão e dízimo recorrente."
          acao={<Link to="/app-ui/pagamentos/configuracoes"><Botao>Ir para Configurações</Botao></Link>} />
      </Cartao>
    );
  }

  const totalForma = r.porForma.reduce((s, f) => s + f.valor, 0) || 1;
  return (
    <div className="space-y-5">
      {r.ambiente === 'sandbox' && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 text-amber-800 text-sm dark:bg-amber-900/20 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4" /> Ambiente de testes (Sandbox): nada aqui é dinheiro de verdade.
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Metrica icone={CircleDollarSign} tom="emerald" rotulo="Recebido hoje" valor={brl(r.recebidoHoje)} />
        <Metrica icone={Receipt} tom="purple" rotulo="Recebido no mês" valor={brl(r.recebidoMes)} sub={`${r.qtdMes} pagamentos · líquido ${brl(r.liquidoMes)} · ticket médio ${brl(r.ticketMedio)}`} />
        <Metrica icone={CalendarClock} tom="sky" rotulo="A receber (cartão confirmado)" valor={brl(r.aReceber)} sub={`${r.qtdAReceber} cobranças aguardando liquidação`} />
        <Metrica icone={Wallet} tom="slate" rotulo="Saldo disponível na conta Asaas" valor={r.saldo === null ? '—' : brl(r.saldo)} sub={r.erroSaldo ?? 'Conta inteira (pode atender outros campos)'} />
        <Metrica icone={Clock} tom="amber" rotulo="Em aberto (Pix/boleto não pagos)" valor={brl(r.pendentes)} sub={`${r.qtdPendentes} cobranças`} />
        <Metrica icone={Repeat} tom="purple" rotulo="Recorrente por mês (ativas)" valor={brl(r.recorrenteMensal)}
          sub={`${r.assinaturas.ATIVA ?? 0} ativas · ${r.assinaturas.INADIMPLENTE ?? 0} em aberto · ${r.assinaturas.PAUSADA ?? 0} pausadas`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Cartao className="p-4 lg:col-span-2">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">Recebimentos dos últimos 30 dias</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={r.porDia} margin={{ left: 0, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="gAsaas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9333ea" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#9333ea" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="dia" tickFormatter={(d: string) => d.slice(8, 10)} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} tick={{ fontSize: 11, fill: '#94a3b8' }} width={40} />
                <Tooltip formatter={(v) => brl(v)} labelFormatter={(d) => dataBr(String(d))} />
                <Area type="monotone" dataKey="valor" stroke="#9333ea" strokeWidth={2} fill="url(#gAsaas)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Cartao>
        <Cartao className="p-4">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">Por forma de pagamento (mês)</p>
          {r.porForma.length === 0 ? <p className="text-sm text-slate-400">Nada recebido no mês ainda.</p> : (
            <div className="space-y-3">
              {r.porForma.map((f) => (
                <div key={f.forma}>
                  <div className="flex justify-between text-sm"><span className="flex items-center gap-1.5">{f.forma === 'PIX' ? <QrCode className="w-3.5 h-3.5" /> : <CreditCard className="w-3.5 h-3.5" />}{f.rotulo} <span className="text-slate-400">({f.qtd})</span></span><span className="font-semibold">{brl(f.valor)}</span></div>
                  <div className="h-2 mt-1 rounded-full bg-slate-100 dark:bg-slate-700"><div className="h-2 rounded-full bg-purple-500" style={{ width: `${(f.valor / totalForma) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-5">
            <Link to="/app-ui/pagamentos/cobrar"><Botao><QrCode className="w-4 h-4" />Nova cobrança</Botao></Link>
            <Link to="/app-ui/pagamentos/links"><Botao tipo="secundario"><Link2 className="w-4 h-4" />Novo link</Botao></Link>
          </div>
        </Cartao>
      </div>

      <Cartao>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Últimas movimentações</p>
          <Link to="/app-ui/pagamentos/vendas" className="text-xs font-semibold text-purple-600 hover:underline">Ver todas</Link>
        </div>
        {r.ultimas.length === 0 ? (
          <Vazio icone={Receipt} titulo="Nenhum pagamento ainda" sub="Quando alguém contribuir pelo app ou você gerar uma cobrança, aparece aqui." />
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {r.ultimas.map((l) => (
              <Link key={l.id} to={`/app-ui/pagamentos/vendas?id=${l.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/40">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{l.pagadorNome || 'Sem identificação'}</p>
                  <p className="text-xs text-slate-500 truncate">{ORIGENS[l.origem] ?? l.origem} · {l.formaRotulo} · {dataBr(l.criadoEm, true)}</p>
                </div>
                <Selo estado={l.estado} status={l.status} />
                <span className="w-28 text-right text-sm font-bold">{brl(l.valor)}</span>
              </Link>
            ))}
          </div>
        )}
      </Cartao>
    </div>
  );
}
