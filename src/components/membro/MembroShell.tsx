"use client";

import { useNavigate, useLocation } from 'react-router';
import { motion } from 'motion/react';
import { Sun, Moon } from 'lucide-react';
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

const TEAL = '#2dd4bf';

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
}

const HeartIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
);

const GridIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
    <rect x="3" y="3" width="7" height="7" rx="1.5"/>
    <rect x="14" y="3" width="7" height="7" rx="1.5"/>
    <rect x="3" y="14" width="7" height="7" rx="1.5"/>
    <rect x="14" y="14" width="7" height="7" rx="1.5"/>
  </svg>
);

const FeedIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
    <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z"/>
  </svg>
);

const HistoryIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const UserIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const NAV_LEFT: NavItem[] = [
  { id: 'menu', label: 'Menu', path: '/membro/menu', icon: <GridIcon /> },
  { id: 'feed', label: 'Feed', path: '/membro/feed', icon: <FeedIcon /> },
];

const NAV_RIGHT: NavItem[] = [
  { id: 'historia', label: 'História', path: '/membro/historia', icon: <HistoryIcon /> },
  { id: 'perfil', label: 'Perfil', path: '/membro/perfil', icon: <UserIcon /> },
];

interface MembroShellProps {
  children: React.ReactNode;
  title?: string;
  showBack?: boolean;
}

export function MembroShell({ children, title, showBack }: MembroShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggle } = useMembroTheme();
  const colors = useMembroColors();
  const active = location.pathname.split('/')[2] || 'perfil';

  return (
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ background: colors.bg, maxWidth: '480px', margin: '0 auto' }}
    >
      {/* Status bar area */}
      <div style={{ height: 'env(safe-area-inset-top, 44px)', minHeight: 44, background: colors.bg }} />

      {/* Top bar */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-5 pb-3"
        style={{ minHeight: 48 }}
      >
        {showBack ? (
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm transition-colors -ml-1"
            style={{ color: colors.textSub }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {title && <span className="text-xs">{title}</span>}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center text-[9px] font-black text-white"
              style={{ background: TEAL }}
            >A</div>
            <span className="text-xs font-semibold tracking-widest uppercase" style={{ color: colors.textSub }}>
              {title || 'Portal Membro'}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2.5">
          {/* Theme toggle */}
          <button
            onClick={toggle}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90"
            style={{ background: colors.surface, border: `1px solid ${colors.border}` }}
            title={isDark ? 'Tema claro' : 'Tema escuro'}
          >
            {isDark
              ? <Sun size={14} style={{ color: '#fbbf24' }} />
              : <Moon size={14} style={{ color: '#64748b' }} />
            }
          </button>
          {/* Live dot */}
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: TEAL }} />
            <span className="text-[10px] font-medium" style={{ color: colors.textSub }}>ao vivo</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>

      {/* Bottom navigation */}
      <div
        className="flex-shrink-0"
        style={{
          background: colors.navBg,
          borderTop: `1px solid ${colors.navBorder}`,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div className="flex items-center justify-around px-2" style={{ height: 64 }}>
          {NAV_LEFT.map(item => (
            <NavBtn key={item.id} item={item} active={active === item.id} onClick={() => navigate(item.path)} colors={colors} />
          ))}

          {/* Center heart button */}
          <button
            onClick={() => navigate('/membro/menu')}
            className="relative flex-shrink-0 transition-transform active:scale-90"
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${TEAL}, #0891b2)`,
                boxShadow: `0 0 24px ${TEAL}55`,
              }}
            >
              <HeartIcon />
            </div>
          </button>

          {NAV_RIGHT.map(item => (
            <NavBtn key={item.id} item={item} active={active === item.id} onClick={() => navigate(item.path)} colors={colors} />
          ))}
        </div>
      </div>
    </div>
  );
}

function NavBtn({ item, active, onClick, colors }: { item: NavItem; active: boolean; onClick: () => void; colors: ReturnType<typeof useMembroColors> }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 px-3 py-1 relative"
    >
      <span style={{ color: active ? TEAL : colors.textSub }}>
        {item.icon}
      </span>
      <span
        className="text-[9px] font-medium tracking-wide"
        style={{ color: active ? TEAL : colors.textSub }}
      >
        {item.label}
      </span>
      {active && (
        <motion.div
          layoutId="nav-indicator"
          className="absolute -top-px left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full"
          style={{ background: TEAL }}
        />
      )}
    </button>
  );
}
