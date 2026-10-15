/**
 * Menu Pagamentos (Asaas) — gestão do que entra pelo App Igreja v3 e pelo
 * balcão: visão geral, cobrança rápida, contribuições/vendas, recorrências,
 * links, financeiro da conta e configuração. Backend: /api/asaas/admin.
 * Doc: docs/architecture/ASAAS-PAGAMENTOS.md.
 */
import { useLocation, useNavigate } from 'react-router';
import { Banknote, LayoutDashboard, Link2, ListChecks, QrCode, Repeat, Settings, Wallet } from 'lucide-react';
import { usePermissions } from '../../lib/usePermissions';
import { perfilAtual } from './comum';
import Visao from './Visao';
import Cobrar from './Cobrar';
import Vendas from './Vendas';
import Recorrencias from './Recorrencias';
import Links from './Links';
import Financeiro from './Financeiro';
import Configuracoes from './Configuracoes';

const ABAS = [
  { id: '', rotulo: 'Visão geral', icone: LayoutDashboard, perm: 'asaas_pagamentos', C: Visao },
  { id: 'cobrar', rotulo: 'Cobrança rápida', icone: QrCode, perm: 'asaas_pagamentos', C: Cobrar },
  { id: 'vendas', rotulo: 'Contribuições e vendas', icone: ListChecks, perm: 'asaas_pagamentos', C: Vendas },
  { id: 'recorrencias', rotulo: 'Recorrências', icone: Repeat, perm: 'asaas_pagamentos', C: Recorrencias },
  { id: 'links', rotulo: 'Links e campanhas', icone: Link2, perm: 'asaas_pagamentos', C: Links },
  { id: 'financeiro', rotulo: 'Financeiro', icone: Wallet, perm: 'asaas_pagamentos', C: Financeiro },
  { id: 'configuracoes', rotulo: 'Configurações', icone: Settings, perm: 'asaas_config', C: Configuracoes },
];

export default function AsaasPagamentos() {
  const { pathname } = useLocation();
  const ir = useNavigate();
  const { canView } = usePermissions(perfilAtual());
  const atual = pathname.replace(/^\/app-ui\/pagamentos\/?/, '').split('/')[0];
  const abas = ABAS.filter((a) => canView(a.perm));
  const aba = abas.find((a) => a.id === atual) ?? abas[0];

  return (
    <div className="p-4 md:p-6 text-slate-900 dark:text-slate-100">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center flex-shrink-0">
          <Banknote className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">Pagamentos</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">Dízimos, ofertas, loja e ingressos pelo Asaas — Pix, cartão e contribuição recorrente.</p>
        </div>
      </div>
      <div className="flex gap-1 mb-5 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
        {abas.map((a) => (
          <button key={a.id} onClick={() => ir(`/app-ui/pagamentos${a.id ? `/${a.id}` : ''}`)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors ${
              aba?.id === a.id ? 'border-purple-600 text-purple-700 dark:text-purple-400' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}>
            <a.icone className="w-4 h-4" /> {a.rotulo}
          </button>
        ))}
      </div>
      {aba ? <aba.C key={aba.id} /> : <p className="text-sm text-slate-500">Sem permissão para ver pagamentos.</p>}
    </div>
  );
}
