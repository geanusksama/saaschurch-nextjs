import { useEffect } from 'react';

/**
 * Fonte das telas redesenhadas a partir dos modelos do Claude Design
 * (novastelas/): Plus Jakarta Sans. Carregada uma vez, só quando uma dessas
 * telas abre — o resto do sistema continua com a fonte padrão.
 */
export const FONTE_MODELO_HREF =
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';

export const FONTE_MODELO_FAMILIA = "'Plus Jakarta Sans', system-ui, sans-serif";

export function useFonteModelo() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONTE_MODELO_HREF}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONTE_MODELO_HREF;
    document.head.appendChild(link);
  }, []);
}
