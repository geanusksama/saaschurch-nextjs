"use client";

/**
 * Tela de rota inexistente dentro do Portal Membro.
 *
 * O menu ja oferece atalhos para areas que ainda nao foram construidas
 * (Biblia, Igreja, Ministerios, Eventos, Compras). Sem esta rota curinga o
 * membro clicava e caia numa tela em branco, parecendo que o app quebrou.
 */

import { useNavigate } from 'react-router';
import { MembroShell } from './MembroShell';

const TEAL = '#2dd4bf';

export default function MembroEmConstrucao() {
  const navigate = useNavigate();

  return (
    <MembroShell>
      <div className="h-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="max-w-lg mx-auto px-5 py-5 pb-10">

          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigate('/membro/menu')}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
              aria-label="Voltar"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 text-white/60">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <div>
              <h1 className="text-base font-bold text-white">Em construção</h1>
              <p className="text-[11px] text-white/40">Esta área ainda está sendo preparada</p>
            </div>
          </div>

          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div
              className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ background: `${TEAL}18` }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke={TEAL} strokeWidth="1.8" className="w-8 h-8">
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
            </div>

            <p className="text-[15px] font-bold text-white mb-2">Estamos preparando esta área</p>
            <p className="text-[12px] text-slate-400 leading-relaxed mb-6">
              Ela ainda não está disponível no portal. Assim que ficar pronta, aparece
              aqui para você. Enquanto isso, use as outras áreas do menu.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => navigate('/membro/menu')}
                className="flex-1 py-3.5 rounded-xl font-semibold text-[13px] text-white/70"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Ver o menu
              </button>
              <button
                onClick={() => navigate('/membro/perfil')}
                className="flex-1 py-3.5 rounded-xl font-bold text-[14px] text-slate-900 transition-transform active:scale-[0.98]"
                style={{ background: TEAL }}
              >
                Voltar ao perfil
              </button>
            </div>
          </div>

        </div>
      </div>
    </MembroShell>
  );
}
