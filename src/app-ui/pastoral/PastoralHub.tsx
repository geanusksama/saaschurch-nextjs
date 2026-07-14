/**
 * Gestão Pastoral — hub com abas:
 *  - Pipeline: quadro Kanban de atendimento (PastoralKanban, inalterado)
 *  - Envio em Massa: campanhas de WhatsApp (PastoralMassSend)
 *  - Envios: histórico de envios + conversas + agente de IA (PastoralSendHistory)
 *
 * As duas últimas abas são gated pela permissão 'whatsapp_campaigns' (grupo
 * Comunicação no permissionCatalog) — perfis sem view nessa chave só veem Pipeline.
 *
 * Spec da aba de envio: docs/modules/whatsapp-mass-send/SPEC.md
 */

import { useState, useEffect } from 'react';
import { LayoutGrid, Send, MessagesSquare, FileSpreadsheet } from 'lucide-react';
import PastoralKanban from './PastoralKanban';
import PastoralMassSend from './PastoralMassSend';
import PastoralSendHistory from './PastoralSendHistory';
import PastoralImports from './PastoralImports';
import { usePermissions } from '../../lib/usePermissions';

type HubTab = 'pipeline' | 'mass-send' | 'sends' | 'imports';

function currentProfileType(): string {
  try {
    return JSON.parse(localStorage.getItem('mrm_user') || '{}').profileType || 'church';
  } catch {
    return 'church';
  }
}

export default function PastoralHub() {
  const [tab, setTab] = useState<HubTab>('pipeline');
  const { canView } = usePermissions(currentProfileType());
  const canMassSend = canView('whatsapp_campaigns');

  // se o usuário perder acesso (ou nunca teve) enquanto está numa aba restrita, volta ao Pipeline
  useEffect(() => {
    if (!canMassSend && tab !== 'pipeline') setTab('pipeline');
  }, [canMassSend, tab]);

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab('pipeline')}
          className={`h-9 px-4 rounded-lg text-sm font-semibold inline-flex items-center gap-2 transition-colors
            ${tab === 'pipeline' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <LayoutGrid className="w-4 h-4" />
          Pipeline
        </button>
        {canMassSend && (
          <>
            <button
              onClick={() => setTab('mass-send')}
              className={`h-9 px-4 rounded-lg text-sm font-semibold inline-flex items-center gap-2 transition-colors
                ${tab === 'mass-send' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Send className="w-4 h-4" />
              Envio em Massa
            </button>
            <button
              onClick={() => setTab('sends')}
              className={`h-9 px-4 rounded-lg text-sm font-semibold inline-flex items-center gap-2 transition-colors
                ${tab === 'sends' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <MessagesSquare className="w-4 h-4" />
              Envios
            </button>
            <button
              onClick={() => setTab('imports')}
              className={`h-9 px-4 rounded-lg text-sm font-semibold inline-flex items-center gap-2 transition-colors
                ${tab === 'imports' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              Importações
            </button>
          </>
        )}
      </div>

      {/* mantém o kanban montado ao alternar (preserva filtros); a aba de envio
          também permanece montada para não interromper o loop de orquestração */}
      <div className={tab === 'pipeline' ? 'flex-1 min-h-0' : 'hidden'}>
        <PastoralKanban />
      </div>
      {canMassSend && (
        <>
          <div className={tab === 'mass-send' ? 'flex-1 min-h-0' : 'hidden'}>
            <PastoralMassSend />
          </div>
          <div className={tab === 'sends' ? 'flex-1 min-h-0' : 'hidden'}>
            <PastoralSendHistory />
          </div>
          {/* Importações é montada só quando aberta — a consulta é sob demanda */}
          {tab === 'imports' && (
            <div className="flex-1 min-h-0">
              <PastoralImports />
            </div>
          )}
        </>
      )}
    </div>
  );
}
