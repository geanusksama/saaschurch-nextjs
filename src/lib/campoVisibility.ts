'use client';

import { useEffect, useState } from 'react';

/**
 * Visibilidade de CAMPO na interface.
 *
 * Regra: campo é detalhe de infraestrutura, não filtro de trabalho. Nas telas o
 * usuário filtra por Regional e Igreja — o campo vem sozinho (da igreja/sede a
 * que ele pertence) e não aparece em lugar nenhum.
 *
 * IMPORTANTE: isto é só a camada visual. O isolamento multi-tenant continua
 * exatamente como está — quem decide escopo é o backend (users.campo_id +
 * assertChurchAccess). Esconder o seletor não dá nem tira acesso a ninguém.
 *
 * Quem pode destravar: só o perfil master, e mesmo ele começa com tudo oculto.
 * O destravamento é feito na tela de Configurações (7 cliques na área à direita
 * do cabeçalho) e exige a senha do campo. Fica guardado em sessionStorage, ou
 * seja: fechou o navegador, volta a ficar oculto.
 */

const UNLOCK_KEY = 'mrm_campo_unlocked';
const VISIBILITY_EVENT = 'mrm-campo-visibility';

function readStoredUser(): Record<string, unknown> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem('mrm_user') || '{}');
  } catch {
    return {};
  }
}

/** Só o master pode sequer tentar destravar a visão de campo. */
export function isMasterUser(): boolean {
  return readStoredUser().profileType === 'master';
}

export function isCampoUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
}

/** True quando os controles de campo devem ser renderizados. */
export function isCampoVisible(): boolean {
  return isMasterUser() && isCampoUnlocked();
}

export function unlockCampoVisibility() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(UNLOCK_KEY, '1');
  } catch {
    /* navegador sem sessionStorage: segue oculto */
  }
  window.dispatchEvent(new Event(VISIBILITY_EVENT));
}

export function lockCampoVisibility() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(UNLOCK_KEY);
  } catch {
    /* noop */
  }
  window.dispatchEvent(new Event(VISIBILITY_EVENT));
}

/** Hook reativo: as telas escondem/mostram sem precisar de reload. */
export function useCampoVisible(): boolean {
  const [visible, setVisible] = useState<boolean>(() => isCampoVisible());

  useEffect(() => {
    const sync = () => setVisible(isCampoVisible());
    sync();
    window.addEventListener(VISIBILITY_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(VISIBILITY_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return visible;
}
