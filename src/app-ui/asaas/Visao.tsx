/** Pagamentos › Visão geral: o que entrou no período, o que vai entrar e o que está em aberto. */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, CalendarClock, CircleDollarSign, Clock, CreditCard, Link2, QrCode, Receipt, Repeat, Wallet } from 'lucide-react';
import { brl, Botao, Cartao, Carregando, dataBr, Erro, Metrica, ORIGENS, Selo, useDados, Vazio } from './comum';
import { FiltroPeriodo, periodoPadrao, rotuloPeriodo, Tabela, type Periodo } from './tabela';

interface Linha { id: string; estado: string; status: string; valor: number; valorLiquido: number | null; formaRotulo: string; origem: string; pagadorNome: string | null; descricao: string | null; criadoEm: string }
interface Resumo {
  configurado: boolean; ativo: boolean; ambiente: string | null; de: string; ate: string;
  recebidoHoje: number; recebidoMes: number; liquidoMes: number; qtdMes: number; ticketMedio: number;
  aReceber: number; qtdAReceber: number; pendentes: number; qtdPendentes: number;
  saldo: number | null; erroSaldo: string | null; recorrenteMensal: number; assinaturas: Record<string, number>;
  porDia: { dia: string; valor: number }[]; porForma: { forma: string; rotulo: string; valor: number; qtd: number }[]; ultimas: Linha[];
}

export default function Visao() {
  const ir = useNavigate();
  const [periodo, setPeriodo] = useState<Periodo>(periodoPadrao());
  const { dados: r, erro, carregando, recarregar } = useDados<Resumo>(`resumo?de=${periodo.de}&ate=${periodo.ate}`);
  if (carregando && !r) return <Carregando />;
  if (erro && !r) return <Erro msg={erro} onTentar={recarregar} />;
  if (!r) return null;

  if (!r.configurado || !r.ativo) {
    return (
      <Cartao>
        <Vazio icone={Wallet} titulo={r.configurado ? 'Pagamento online desligado neste campo' : 'Asaas ainda não configurado neste campo'}
          sub="Cole a chave de API do Asaas em Sistema › Configurações › Pagamentos Asaas e ative. O app passa a aceitar Pix com baixa automática, cartão e dízimo recorrente."
          acao={<Link to="/app-ui/system/pagamentos-asaas"><Botao>Ir para Configurações</Botao></Link>} />
      </Cartao>
    );
  }

  const totalForma = r.porForma.reduce((s, f) => s + f.valor, 0) || 1;
  const rotulo = rotuloPeriodo(periodo);
  return (
    <div className="space-y-5">
      <Cartao className="p-3 flex flex-wrap items-end gap-3">
        <FiltroPeriodo valor={periodo} onChange={setPeriodo} />
        {carregando && <span className="text-xs text-slate-400 pb-2">Atualizando…</span>}
        <div className="flex-1" />
        <Link to="/app-ui/pagamentos/cobrar"><Botao><QrCode className="w-4 h-4" />Nova cobrança</Botao></Link>
        <Link to="/app-ui/pagamentos/links"><Botao tipo="secundario"><Link2 className="w-4 h-4" />Novo link</Botao></Link>
      </Cartao>
      {r.ambiente === 'sandbox' && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 text-amber-800 text-sm dark:bg-amber-900/20 dark:text-amber-300">
          <AlertTriangle className="w-4 h-4" /> Ambiente de testes (Sandbox): nada aqui é dinheiro de verdade.
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Metrica icone={CircleDollarSign} tom="emerald" rotulo="Recebido hoje" valor={brl(r.recebidoHoje)} />
        <Metrica icone={Receipt} tom="purple" rotulo={`Recebido · ${rotulo}`} valor={brl(r.recebidoMes)} sub={`${r.qtdMes} pagamentos · líquido ${brl(r.liquidoMes)} · ticket ${brl(r.ticketMedio)}`} />
        <Metrica icone={CalendarClock} tom="sky" rotulo="A receber (cartão confirmado)" valor={brl(r.aReceber)} sub={`${r.qtdAReceber} aguardando liquidação`} />
        <Metrica icone={Wallet} tom="slate" rotulo="Saldo na conta Asaas" valor={r.saldo === null ? '—' : brl(r.saldo)} sub={r.erroSaldo ?? 'Conta inteira'} />
        <Metrica icone={Clock} tom="amber" rotulo="Em aberto" valor={brl(r.pendentes)} sub={`${r.qtdPendentes} Pix/boletos não pagos`} />
        <Metrica icone={Repeat} tom="purple" rotulo="Recorrente por mês" valor={brl(r.recorrenteMensal)}
          sub={`${r.assinaturas.ATIVA ?? 0} ativas · ${r.assinaturas.INADIMPLENTE ?? 0} em aberto · ${r.assinaturas.PAUSADA ?? 0} pausadas`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Cartao className="p-4 lg:col-span-2">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">Recebimentos por dia · {rotulo}</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={r.porDia} margin={{ left: 0, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="gAsaas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9333ea" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#9333ea" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="dia" tickFormatter={(d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`} tick={{ fontSize: 11, fill: '#94a3b8' }} minTickGap={16} />
                <YAxis tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} tick={{ fontSize: 11, fill: '#94a3b8' }} width={40} />
                <Tooltip formatter={(v) => brl(v)} labelFormatter={(d) => dataBr(String(d))} />
                <Area type="monotone" dataKey="valor" stroke="#9333ea" strokeWidth={2} fill="url(#gAsaas)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Cartao>
        <Cartao className="p-4">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">Por forma de pagamento</p>
          {r.porForma.length === 0 ? <p className="text-sm text-slate-400">Nada recebido no período.</p> : (
            <div className="space-y-3">
              {r.porForma.map((f) => (
                <div key={f.forma}>
                  <div className="flex justify-between text-sm"><span className="flex items-center gap-1.5">{f.forma === 'PIX' ? <QrCode className="w-3.5 h-3.5" /> : <CreditCard className="w-3.5 h-3.5" />}{f.rotulo} <span className="text-slate-400">({f.qtd})</span></span><span className="font-semibold">{brl(f.valor)}</span></div>
                  <div className="h-2 mt-1 rounded-full bg-slate-100 dark:bg-slate-700"><div className="h-2 rounded-full bg-purple-500" style={{ width: `${(f.valor / totalForma) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </Cartao>
      </div>

      <Tabela<Linha>
        titulo="Movimentações"
        subtitulo={rotulo}
        linhas={r.ultimas}
        chave={(l) => l.id}
        aoClicar={(l) => ir(`/app-ui/pagamentos/vendas?id=${l.id}`)}
        ordemInicial={{ chave: 'data', desc: true }}
        porPagina={10}
        vazio={<Vazio icone={Receipt} titulo="Nenhum pagamento no período" sub="Quando alguém contribuir pelo app ou você gerar uma cobrança, aparece aqui." />}
        colunas={[
          { chave: 'data', rotulo: 'Data', valor: (l) => l.criadoEm, texto: (l) => dataBr(l.criadoEm, true), classe: 'whitespace-nowrap text-slate-500' },
          { chave: 'pagador', rotulo: 'Pagador', valor: (l) => l.pagadorNome ?? '', render: (l) => <span className="font-semibold">{l.pagadorNome || 'Sem identificação'}</span> },
          { chave: 'origem', rotulo: 'Origem', valor: (l) => ORIGENS[l.origem] ?? l.origem },
          { chave: 'forma', rotulo: 'Forma', valor: (l) => l.formaRotulo },
          { chave: 'status', rotulo: 'Status', valor: (l) => l.estado, render: (l) => <Selo estado={l.estado} status={l.status} /> },
          { chave: 'valor', rotulo: 'Valor', alinhar: 'direita', valor: (l) => l.valor, texto: (l) => brl(l.valor), render: (l) => <b>{brl(l.valor)}</b> },
        ]}
      />
    </div>
  );
}
