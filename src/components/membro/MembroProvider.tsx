"use client";

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface MembroSession {
  member_token: string;
  member: {
    id: string;
    fullName: string;
    preferredName?: string | null;
    photoUrl?: string | null;
    coverPhotoUrl?: string | null;
    ecclesiasticalTitle?: string | null;
    membershipStatus?: string | null;
    membershipDate?: string | null;
    baptismDate?: string | null;
    rol?: number | null;
    phone?: string | null;
    mobile?: string | null;
    email?: string | null;
    birthDate?: string | null;
    gender?: string | null;
    churchId: string;
    regionalId?: string | null;
    campoId?: string | null;
    church?: {
      id: string;
      name: string;
      regional?: {
        id: string;
        name: string;
        campo?: { id: string; name: string } | null;
      } | null;
    } | null;
  };
}

interface MembroContextValue {
  session: MembroSession | null;
  isLoading: boolean;
  login: (session: MembroSession) => void;
  logout: () => void;
  updateMember: (patch: Partial<MembroSession['member']>) => void;
}

const MembroContext = createContext<MembroContextValue>({
  session: null,
  isLoading: true,
  login: () => {},
  logout: () => {},
  updateMember: () => {},
});

const LS_KEY = 'membro_session';

export function MembroProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<MembroSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setSession(JSON.parse(raw));
    } catch { /* ignore */ }
    setIsLoading(false);
  }, []);

  const login = useCallback((s: MembroSession) => {
    setSession(s);
    try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
  }, []);

  // Atualiza campos do membro em memoria e no localStorage sem exigir novo
  // login — usado quando o cadastro facial troca a foto de perfil, para a
  // tela refletir a mudanca na hora em vez de so no proximo acesso.
  const updateMember = useCallback((patch: Partial<MembroSession['member']>) => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = { ...prev, member: { ...prev.member, ...patch } };
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  return (
    <MembroContext.Provider value={{ session, isLoading, login, logout, updateMember }}>
      {children}
    </MembroContext.Provider>
  );
}

export function useMembroSession() {
  return useContext(MembroContext);
}
