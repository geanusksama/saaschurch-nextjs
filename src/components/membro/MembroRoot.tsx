"use client";

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { AnimatePresence } from 'motion/react';
import { useMembroSession } from './MembroProvider';
import { MembroLogin } from './MembroLogin';

export function MembroRoot() {
  const { session, isLoading } = useMembroSession();
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (session) {
      navigate('/membro/perfil', { replace: true });
    } else {
      setShowLogin(true);
    }
  }, [session, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: '#0d0f17' }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#2dd4bf', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0" style={{ background: '#0d0f17' }}>
      <AnimatePresence>
        {showLogin && (
          <MembroLogin
            onClose={() => navigate('/')}
            onSuccess={() => navigate('/membro/perfil', { replace: true })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
