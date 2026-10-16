/**
 * Menu Pagamentos (Asaas) — uma página por tela, cada uma com a sua chave na
 * matriz "Funções e Permissões" (a API confere a mesma chave). A configuração
 * (chave, webhook, campos) fica em Sistema › Configurações › Pagamentos Asaas.
 * Backend: /api/asaas/admin. Doc: docs/architecture/ASAAS-PAGAMENTOS.md.
 */
import type { ElementType } from 'react';
import { Navigate, useParams } from 'react-router';
import { Banknote, CalendarPlus, LayoutDashboard, Link2, ListChecks, Lock, QrCode, Repeat, Settings, Wallet } from 'lucide-react';
import { usePermissions } from '../../lib/usePermissions';
import { perfilAtual } from './comum';
import Visao from './Visao';
import Cobrar from './Cobrar';
import Vendas from './Vendas';
import Recorrencias from './Recorrencias';
import Links from './Links';
import Financeiro from './Financeiro';
import Configuracoes from './Configuracoes';
import EventosLoja from './EventosLoja';

interface Tela { titulo: string; sub: string; icone: ElementType; perm: string; C: ElementType }

const TELAS: Record<string, Tela> = {
  '': { titulo: 'Pagamentos', sub: 'O que entrou, o que vai entrar e o que está em aberto.', icone: LayoutDashboard, perm: 'asaas_visao', C: Visao },
  cobrar: { titulo: 'Cobrança rápida', sub: 'Valor e quem paga: o QR aparece na tela e vira PAGO sozinho.', icone: QrCode, perm: 'asaas_cobrar', C: Cobrar },
  vendas: { titulo: 'Contribuições e vendas', sub: 'Tudo o que passou pelo Asaas no campo, com estorno e linha do tempo.', icone: ListChecks, perm: 'asaas_vendas', C: Vendas },
  recorrencias: { titulo: 'Recorrências', sub: 'Dízimos e ofertas mensais feitos pelo app.', icone: Repeat, perm: 'asaas_recorrencias', C: Recorrencias },
  eventos: { titulo: 'Eventos e loja', sub: 'Crie eventos com ingressos e produtos: aparecem no app e no site, pagos pelo Asaas.', icone: CalendarPlus, perm: 'mobile_eventos', C: EventosLoja },
  links: { titulo: 'Links e campanhas', sub: 'Links e QR para divulgar fora do app.', icone: Link2, perm: 'asaas_links', C: Links },
  financeiro: { titulo: 'Financeiro', sub: 'Saldo, a receber e extrato da conta Asaas.', icone: Wallet, perm: 'asaas_financeiro', C: Financeiro },
};

const CONFIG: Tela = { titulo: 'Pagamentos Asaas', sub: 'Chave de API, formas aceitas no app, webhook e campos que recebem.', icone: Settings, perm: 'asaas_config', C: Configuracoes };

function Pagina({ tela }: { tela: Tela }) {
  const { canView } = usePermissions(perfilAtual());
  const { C, icone: Icone } = tela;
  return (
    <div className="p-4 md:p-6 text-slate-900 dark:text-slate-100">
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center flex-shrink-0">
          <Icone className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-800 dark:text-white">{tela.titulo}</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">{tela.sub}</p>
        </div>
      </div>
      {canView(tela.perm) ? <C /> : (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm text-slate-600 dark:text-slate-300">
          <Lock className="w-4 h-4" /> Sem permissão para esta tela. Peça ao administrador em Funções e Permissões.
        </div>
      )}
    </div>
  );
}

export default function AsaasPagamentos() {
  const { tela = '' } = useParams();
  // Endereço antigo da aba de configuração.
  if (tela === 'configuracoes') return <Navigate to="/app-ui/system/pagamentos-asaas" replace />;
  const def = TELAS[tela];
  if (!def) return <div className="p-6 text-sm text-slate-500 flex items-center gap-2"><Banknote className="w-4 h-4" />Tela não encontrada.</div>;
  return <Pagina key={tela} tela={def} />;
}

/** Sistema › Configurações › Pagamentos Asaas. */
export function AsaasConfiguracao() {
  return <Pagina tela={CONFIG} />;
}
