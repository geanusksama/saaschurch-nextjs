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

// Chaves que as rotas /api/meta/whatsapp/modelos* já exigem (exigirPermissao).
export const PERM_MODELOS_VER = definirPermissao({ chave: 'whatsapp_oficial.modelos.view', rotulo: 'Modelos de mensagem (WhatsApp Oficial)', herda: 'whatsapp_oficial.view' });
export const PERM_MODELOS_CRIAR = definirPermissao({ chave: 'whatsapp_oficial.modelos.criar', rotulo: 'Criar modelo de mensagem', herda: 'whatsapp_oficial.modelos.view' });
export const PERM_MODELOS_EXCLUIR = definirPermissao({ chave: 'whatsapp_oficial.modelos.excluir', rotulo: 'Excluir modelo de mensagem', herda: 'whatsapp_oficial.modelos.view' });

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
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <header className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700">
          <BadgeCheck className="size-5 text-slate-600 dark:text-slate-200" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">Meta Oficial</h1>
          <p className="text-sm text-slate-500">Central do WhatsApp Oficial da igreja (WhatsApp Cloud API).</p>
        </div>
      </header>

      <div
        ref={lista}
        role="tablist"
        aria-label="Seções da Meta Oficial"
        className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-700"
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
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${
                sel
                  ? 'border-slate-800 text-slate-900 dark:border-slate-100 dark:text-slate-100'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
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
        {ativa === 'modelos' && (
          <EmBreve icone={FileText} titulo="Modelos de mensagem" etapa="Etapa 2" descricao="Crie, acompanhe a aprovação e exclua os modelos de mensagem que a Meta exige para iniciar conversas." />
        )}
        {ativa === 'envio' && (
          <EmBreve icone={Send} titulo="Envio" etapa="Etapa 3" descricao="Dispare modelos aprovados para membros e listas, com as variáveis preenchidas automaticamente." />
        )}
        {ativa === 'conversas' && (
          <EmBreve icone={MessagesSquare} titulo="Conversas" etapa="Etapa 4" descricao="Receba e responda as mensagens do número oficial numa caixa de entrada própria." />
        )}
        {ativa === 'leads' && (
          <EmBreve icone={Megaphone} titulo="Leads" etapa="Etapa 5" descricao="Capte contatos de anúncios e do site e leve cada um direto para a conversa." />
        )}
        {ativa === 'app' && master && <MetaAppConfig embutido />}
      </div>
    </div>
  );
}
