/**
 * Sistema → Meta Oficial: central do WhatsApp Oficial (Meta) com abas (?aba=).
 * Visão geral, Conexão, Modelos, Envio, Conversas, Leads e App (só master).
 */
import { useRef, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router';
import { BadgeCheck, LayoutDashboard, Smartphone, FileText, Send, MessagesSquare, Megaphone, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { definirPermissao } from '../../lib/permissoes/definir';
import { usePode } from '../../lib/permissoes/Permissao';
import WhatsAppOficial from './WhatsAppOficial';
import MetaAppConfig from './MetaAppConfig';
import VisaoGeral from './metaOficial/VisaoGeral';
import EmBreve from './metaOficial/EmBreve';
import Modelos from './metaOficial/Modelos';
import Envio from './metaOficial/Envio';

// Chaves que as rotas /api/meta/whatsapp/modelos* já exigem (exigirPermissao).
export const PERM_MODELOS_VER = definirPermissao({ chave: 'whatsapp_oficial.modelos.view', rotulo: 'Modelos de mensagem (WhatsApp Oficial)', herda: 'whatsapp_oficial.view' });
export const PERM_MODELOS_CRIAR = definirPermissao({ chave: 'whatsapp_oficial.modelos.criar', rotulo: 'Criar modelo de mensagem', herda: 'whatsapp_oficial.modelos.view' });
export const PERM_MODELOS_EXCLUIR = definirPermissao({ chave: 'whatsapp_oficial.modelos.excluir', rotulo: 'Excluir modelo de mensagem', herda: 'whatsapp_oficial.modelos.view' });

// Chaves que as rotas /api/meta/whatsapp/envio* exigem (exigirPermissao).
export const PERM_ENVIO_VER = definirPermissao({ chave: 'whatsapp_oficial.envio.view', rotulo: 'Envio em massa (WhatsApp Oficial)', herda: 'whatsapp_oficial.view' });
export const PERM_ENVIO_CRIAR = definirPermissao({ chave: 'whatsapp_oficial.envio.criar', rotulo: 'Criar disparo (WhatsApp Oficial)', herda: 'whatsapp_oficial.envio.view' });
export const PERM_ENVIO_CONTROLAR = definirPermissao({ chave: 'whatsapp_oficial.envio.controlar', rotulo: 'Pausar, retomar e cancelar disparo', herda: 'whatsapp_oficial.envio.view' });

type Aba = { id: string; rotulo: string; icone: LucideIcon };

const ABAS: Aba[] = [
  { id: 'visao-geral', rotulo: 'Visão geral', icone: LayoutDashboard },
  { id: 'conexao', rotulo: 'Conexão', icone: Smartphone },
  { id: 'modelos', rotulo: 'Modelos', icone: FileText },
  { id: 'envio', rotulo: 'Envio', icone: Send },
  { id: 'conversas', rotulo: 'Conversas', icone: MessagesSquare },
  { id: 'leads', rotulo: 'Leads', icone: Megaphone },
  { id: 'app', rotulo: 'App', icone: ShieldCheck },
];

function ehMaster(): boolean {
  try {
    return JSON.parse(localStorage.getItem('mrm_user') || '{}').profileType === 'master';
  } catch {
    return false;
  }
}

export default function MetaOficial() {
  const [params, setParams] = useSearchParams();
  const pode = usePode();
  const master = ehMaster();
  const lista = useRef<HTMLDivElement>(null);

  const visiveis = ABAS.filter((a) => {
    if (a.id === 'app') return master;
    if (a.id === 'modelos') return pode(PERM_MODELOS_VER);
    if (a.id === 'envio') return pode(PERM_ENVIO_VER);
    return true;
  });
  const pedida = params.get('aba') ?? 'visao-geral';
  const ativa = visiveis.some((a) => a.id === pedida) ? pedida : 'visao-geral';

  const abrir = (id: string) => {
    const p = new URLSearchParams(params);
    p.set('aba', id);
    setParams(p, { replace: true });
  };

  const teclas = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    let alvo = -1;
    if (e.key === 'ArrowRight') alvo = (i + 1) % visiveis.length;
    else if (e.key === 'ArrowLeft') alvo = (i - 1 + visiveis.length) % visiveis.length;
    else if (e.key === 'Home') alvo = 0;
    else if (e.key === 'End') alvo = visiveis.length - 1;
    if (alvo < 0) return;
    e.preventDefault();
    abrir(visiveis[alvo].id);
    lista.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[alvo]?.focus();
  };

  return (
    <div className="flex min-h-full flex-col bg-[#f4f6f8] text-slate-900 antialiased dark:bg-slate-900 dark:text-slate-100">
      <header className="flex items-center justify-between gap-3 border-b border-[#e8ecf1] bg-white px-4 py-3 md:px-7 md:py-3.5 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-slate-100 text-slate-700 md:h-10 md:w-10 dark:bg-slate-700 dark:text-slate-200">
            <BadgeCheck className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="hidden whitespace-nowrap text-xs text-slate-500 md:block dark:text-slate-400">Central do WhatsApp Oficial da igreja (WhatsApp Cloud API)</span>
            <span className="whitespace-nowrap text-[17px] font-bold">Meta Oficial</span>
          </div>
        </div>
      </header>

      <div className="box-border flex w-full flex-1 flex-col gap-3 px-3 pb-10 pt-3 md:px-7 md:pt-4">
      <div
        ref={lista}
        role="tablist"
        aria-label="Seções da Meta Oficial"
        className="flex w-full gap-1 overflow-x-auto rounded-2xl border border-[#e8ecf1] bg-white p-1 dark:border-slate-700 dark:bg-slate-800"
      >
        {visiveis.map((a, i) => {
          const sel = a.id === ativa;
          const Icone = a.icone;
          return (
            <button
              key={a.id}
              id={`aba-${a.id}`}
              role="tab"
              type="button"
              aria-selected={sel}
              aria-controls={`painel-${a.id}`}
              tabIndex={sel ? 0 : -1}
              onClick={() => abrir(a.id)}
              onKeyDown={(e) => teclas(e, i)}
              className={`inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition-colors ${
                sel
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white'
              }`}
            >
              <Icone className="size-4" /> {a.rotulo}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`painel-${ativa}`} aria-labelledby={`aba-${ativa}`} tabIndex={0}>
        {ativa === 'visao-geral' && <VisaoGeral irPara={abrir} podeModelos={pode(PERM_MODELOS_VER)} />}
        {ativa === 'conexao' && <WhatsAppOficial embutido />}
        {ativa === 'modelos' && <Modelos irPara={abrir} />}
        {ativa === 'envio' && <Envio irPara={abrir} />}
        {ativa === 'conversas' && (
          <EmBreve icone={MessagesSquare} titulo="Conversas" etapa="Etapa 4" descricao="Receba e responda as mensagens do número oficial numa caixa de entrada própria." />
        )}
        {ativa === 'leads' && (
          <EmBreve icone={Megaphone} titulo="Leads" etapa="Etapa 5" descricao="Capte contatos de anúncios e do site e leve cada um direto para a conversa." />
        )}
        {ativa === 'app' && master && <MetaAppConfig embutido />}
      </div>
      </div>
    </div>
  );
}
