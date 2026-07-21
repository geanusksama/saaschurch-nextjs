"use client";

import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { useMembroSession } from '../MembroProvider';
import { MembroShell } from '../MembroShell';

const TEAL = '#2dd4bf';

interface Module {
  key: string;
  label: string;
  path: string;
  icon: () => React.ReactElement;
}

const MODULES: Module[] = [
  {
    key: 'biblia', label: 'Bíblia', path: '/membro/biblia',
    icon: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
  },
  {
    key: 'igreja', label: 'Igreja', path: '/membro/igreja',
    icon: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M18 22H6a2 2 0 0 1-2-2v-8l8-6 8 6v8a2 2 0 0 1-2 2z"/><path d="M12 2v4M10 4h4"/><path d="M9 22V12h6v10"/></svg>,
  },
  {
    key: 'pregacoes', label: 'Pregações', path: '/membro/pregacoes',
    icon: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>,
  },
  {
    key: 'ministerio', label: 'Ministério', path: '/membro/ministerios',
    icon: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>,
  },
  {
    key: 'site', label: 'Site', path: '/',
    icon: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  },
  {
    key: 'radio', label: 'Rádio', path: '/radio',
    icon: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>,
  },
  {
    key: 'agenda', label: 'Agenda anual', path: '/membro/agenda',
    icon: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  },
  {
    key: 'eventos', label: 'Eventos', path: '/membro/eventos',
    icon: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/></svg>,
  },
  {
    key: 'compras', label: 'Compras', path: '/membro/compras',
    icon: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>,
  },
  {
    key: 'pao', label: 'Pão diário', path: '/membro/pao-diario',
    icon: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  },
  {
    key: 'testemunhos', label: 'Testemunhos', path: '/membro/testemunhos',
    icon: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  },
  {
    key: 'pastoral', label: 'Atend. Past.', path: '/membro/pastoral',
    icon: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="10" y1="10" x2="14" y2="10"/></svg>,
  },
  {
    key: 'faceid', label: 'Face ID', path: '/membro/faceid',
    icon: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M9 10h.01"/><path d="M15 10h.01"/><path d="M9.5 15a3.5 3.5 0 0 0 5 0"/></svg>,
  },
  {
    key: 'lideranca', label: 'Liderança', path: '/membro/lideranca',
    icon: () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  },
];

export default function MembroMenu() {
  const { session, isLoading } = useMembroSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !session) navigate('/membro', { replace: true });
  }, [session, isLoading, navigate]);

  if (isLoading || !session || !session.member) return null;

  const firstName = (session.member.preferredName || session.member.fullName).split(' ')[0];

  return (
    <MembroShell>
      <div className="h-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        <div className="max-w-lg mx-auto px-5 py-4 pb-8">

          {/* Greeting */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-center gap-3"
          >
            {session.member.photoUrl ? (
              <img src={session.member.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" style={{ border: `2px solid ${TEAL}44` }} />
            ) : (
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: `${TEAL}22`, color: TEAL }}>
                {firstName.charAt(0)}
              </div>
            )}
            <div>
              <p className="text-[10px] text-white/35 font-medium">Bom dia</p>
              <p className="text-sm font-bold text-white">{firstName}</p>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="w-4 h-4 text-white/40"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              </div>
            </div>
          </motion.div>

          {/* Modules grid */}
          <div className="grid grid-cols-3 gap-x-3 gap-y-5">
            {MODULES.map((mod, i) => {
              const Icon = mod.icon;
              const isExternal = mod.path === '/' || mod.path === '/radio';
              return (
                <motion.button
                  key={mod.key}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, delay: i * 0.03 }}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => isExternal ? window.open(mod.path, '_blank') : navigate(mod.path)}
                  className="flex flex-col items-center gap-2 group"
                >
                  <div
                    className="w-[62px] h-[62px] rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-105 group-active:scale-95"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    <span className="text-slate-200 group-hover:text-white transition-colors">
                      <Icon />
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 group-hover:text-slate-200 transition-colors text-center leading-tight font-medium">
                    {mod.label}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>
    </MembroShell>
  );
}
