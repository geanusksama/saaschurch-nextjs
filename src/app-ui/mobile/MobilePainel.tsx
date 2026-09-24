/**
 * Menu Mobile › Painel: o que está esperando alguém (solicitações, Pix para
 * conferir, pedidos, reembolsos) e atalhos para cada tela. Contagens de
 * /api/mobile/resumo.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, Calendar, FileText, Loader2, RefreshCcw, ShoppingCart, Users, Wallet } from 'lucide-react';
import { usePermissions } from '../../lib/usePermissions';
import { TELAS } from '../../lib/mobile/definicoes';
import { api, perfilAtual } from './api';
import { CabecalhoMobile } from './MobileTela';

interface Resumo { solicitacoes: number; contribuicoes: number; pedidos: number; reembolsos: number; contas: number; eventos: number }

export default function MobilePainel() {
  const { canView } = usePermissions(perfilAtual());
  const [r, setR] = useState<Resumo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api<Resumo>('resumo').then(setR).catch((e) => setErro((e as Error).message));
  }, []);

  const cartoes = [
    { n: r?.solicitacoes, rotulo: 'Solicitações em aberto', to: 'secretaria', icon: FileText, perm: 'mobile_secretaria' },
    { n: r?.contribuicoes, rotulo: 'Pix de dízimo/oferta para conferir', to: 'tesouraria', icon: Wallet, perm: 'mobile_tesouraria' },
    { n: r?.pedidos, rotulo: 'Pedidos para conferir ou entregar', to: 'pedidos', icon: ShoppingCart, perm: 'mobile_pedidos' },
    { n: r?.reembolsos, rotulo: 'Reembolsos pedidos', to: 'pedidos', icon: RefreshCcw, perm: 'mobile_pedidos' },
    { n: r?.eventos, rotulo: 'Eventos futuros publicados', to: 'eventos', icon: Calendar, perm: 'mobile_eventos' },
    { n: r?.contas, rotulo: 'Contas no app', to: 'contas', icon: Users, perm: 'mobile_membros' },
  ].filter((c) => canView(c.perm));

  return (
    <div className="p-6 text-slate-900 dark:text-slate-100">
      <CabecalhoMobile titulo="Mobile" sub="App Igreja do campo: o que chegou pelo app e o conteúdo que ele mostra." />
      {erro && (
        <div className="flex items-center gap-2 px-4 py-3 mb-4 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 text-sm">
          <AlertTriangle className="w-4 h-4" /> {erro}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {cartoes.map((c) => (
          <Link key={c.rotulo} to={`/app-ui/mobile/${c.to}`}
            className="flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-purple-300">
            <div className="w-11 h-11 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
              <c.icon className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{r ? c.n : <Loader2 className="w-5 h-5 animate-spin" />}</p>
              <p className="text-xs text-slate-500">{c.rotulo}</p>
            </div>
          </Link>
        ))}
      </div>
      <h2 className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-3">Conteúdo do app</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {Object.values(TELAS).map((t) => (
          <Link key={t.chave} to={`/app-ui/mobile/${t.chave}`}
            className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-purple-300">
            <p className="text-sm font-semibold">{t.titulo}</p>
            <p className="text-xs text-slate-500 mt-0.5">{t.sub}</p>
          </Link>
        ))}
        <Link to="/app-ui/mobile/configuracoes" className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-purple-300">
          <p className="text-sm font-semibold">Configurações</p>
          <p className="text-xs text-slate-500 mt-0.5">Sede do campo, Igreja Mundial e chaves Pix.</p>
        </Link>
      </div>
    </div>
  );
}
