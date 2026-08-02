"use client";

import { useNavigate } from 'react-router';
import { createContext, useContext, useState, useEffect } from 'react';

// ── Theme context ────────────────────────────────────────────────
export const MembroThemeCtx = createContext<{ isDark: boolean; toggle: () => void }>({
  isDark: true,
  toggle: () => {},
});

export function useMembroTheme() {
  return useContext(MembroThemeCtx);
}

const LS_THEME = 'membro_theme';

export function MembroThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(LS_THEME);
    if (stored !== null) {
      setIsDark(stored === 'dark');
    } else {
      setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  }, []);

  const toggle = () => {
    setIsDark(d => {
      const next = !d;
      localStorage.setItem(LS_THEME, next ? 'dark' : 'light');
      return next;
    });
  };

  return (
    <MembroThemeCtx.Provider value={{ isDark, toggle }}>
      {children}
    </MembroThemeCtx.Provider>
  );
}

// ── Theme tokens ─────────────────────────────────────────────────
export function useMembroColors() {
  const { isDark } = useMembroTheme();
  return {
    bg:       isDark ? '#0d0f17' : '#f0f4f8',
    surface:  isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.85)',
    border:   isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
    text:     isDark ? '#f1f5f9' : '#0f172a',
    textSub:  isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.40)',
    navBg:    isDark ? 'rgba(13,15,23,0.96)' : 'rgba(240,244,248,0.96)',
    navBorder:isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)',
  };
}

/**
 * Casca das telas que ainda nao viraram parte do perfil — hoje so o Atendimento
 * Pastoral usa. A barra inferior FOI REMOVIDA: as paginas que ela apontava
 * (menu, feed, historia, pregacoes, agenda, pao diario, testemunhos, lideranca)
 * eram telas vazias e deixaram de existir; o portal e o perfil, e a unica saida
 * daqui e voltar para ele.
 *
 * O MembroThemeProvider acima continua exportado porque as rotas do portal o
 * envolvem — mas estas telas seguem o tema claro fixo do resto.
 */
import { MEMBRO } from './theme';

interface MembroShellProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
}

export function MembroShell({ children, title, showBack }: MembroShellProps) {
  const navigate = useNavigate();

  // Tela clara sempre, igual ao perfil (ver theme.ts).
  useEffect(() => {
    const root = document.documentElement;
    const eraEscuro = root.classList.contains('dark');
    if (eraEscuro) root.classList.remove('dark');
    return () => { if (eraEscuro) root.classList.add('dark'); };
  }, []);

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: MEMBRO.BG, maxWidth: 430, margin: '0 auto', colorScheme: 'light' }}
    >
      <div style={{ height: 'env(safe-area-inset-top, 44px)', minHeight: 44 }} />

      <div className="flex-shrink-0 flex items-center gap-3 px-5 pb-3" style={{ minHeight: 48 }}>
        <button
          onClick={() => (showBack ? navigate(-1) : navigate('/membro/perfil'))}
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: MEMBRO.CARD, border: `1px solid ${MEMBRO.BORDER}` }}
          aria-label="Voltar"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" style={{ color: MEMBRO.TEXT2 }}>
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-sm font-bold" style={{ color: MEMBRO.TEXT1 }}>
          {title || 'Portal Membro'}
        </span>
      </div>

      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
