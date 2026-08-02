"use client";

/**
 * Tela de rota inexistente dentro do Portal Membro.
 *
 * A grade "Meus dados" do perfil oferece atalhos para areas que ainda nao
 * foram construidas (Biblia, Igreja, Ministerios, Compras). Sem esta rota
 * curinga o membro clicava e caia numa tela em branco, parecendo que o app
 * quebrou.
 *
 * TEMA CLARO FIXO e sem MembroShell, igual ao perfil e ao Face ID: a pagina de
 * menu deixou de existir e o portal e uma tela so, entao a unica saida daqui e
 * voltar para o perfil.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import { MEMBRO } from './theme';

const { ACCENT, BG, CARD, BORDER, TEXT1, TEXT2 } = MEMBRO;

export default function MembroEmConstrucao() {
  const navigate = useNavigate();

  useEffect(() => {
    const root = document.documentElement;
    const eraEscuro = root.classList.contains('dark');
    if (eraEscuro) root.classList.remove('dark');
    return () => { if (eraEscuro) root.classList.add('dark'); };
  }, []);

  return (
    <div
      className="fixed inset-0 overflow-y-auto"
      style={{ maxWidth: 430, margin: '0 auto', background: BG, colorScheme: 'light', scrollbarWidth: 'none' }}
    >
      <div style={{ paddingTop: 'env(safe-area-inset-top, 44px)' }}>
        <div className="max-w-lg mx-auto px-5 py-5 pb-10">

          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigate('/membro/perfil')}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: CARD, border: `1px solid ${BORDER}` }}
              aria-label="Voltar"
            >
              <ArrowLeft size={16} color={TEXT2} />
            </button>
            <div>
              <h1 className="text-base font-bold" style={{ color: TEXT1 }}>Em construção</h1>
              <p className="text-[11px]" style={{ color: TEXT2 }}>Esta área ainda está sendo preparada</p>
            </div>
          </div>

          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: CARD, border: `1px solid ${BORDER}`, boxShadow: MEMBRO.SHADOW }}
          >
            <div
              className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ background: MEMBRO.ACCENT_SOFT }}
            >
              <AlertTriangle size={30} color={ACCENT} />
            </div>

            <p className="text-[15px] font-bold mb-2" style={{ color: TEXT1 }}>Estamos preparando esta área</p>
            <p className="text-[12px] leading-relaxed mb-6" style={{ color: TEXT2 }}>
              Ela ainda não está disponível no portal. Assim que ficar pronta, aparece
              aqui para você.
            </p>

            <button
              onClick={() => navigate('/membro/perfil')}
              className="w-full py-3.5 rounded-xl font-bold text-[14px] text-white transition-transform active:scale-[0.98]"
              style={{ background: ACCENT }}
            >
              Voltar ao perfil
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
