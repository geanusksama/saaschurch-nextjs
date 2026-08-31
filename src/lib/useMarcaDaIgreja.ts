/**
 * A marca da igreja (logo e nome) para as telas públicas fora da home.
 *
 * Peniel, Grupos Familiares e a linha do tempo pastoral tinham a logo e o nome
 * da AD Campinas escritos no JSX. Cada igreja roda o próprio banco: essas
 * páginas apareciam com a marca de outra congregação, e continuavam assim
 * mesmo depois de a igreja subir a logo dela.
 *
 * Enquanto a resposta não chega — e quando a igreja ainda não cadastrou nada —
 * devolve vazio de propósito: quem consome esconde a imagem em vez de mostrar
 * uma marca que não é daquela igreja.
 */
import { useEffect, useState } from 'react';
import { apiBase } from './apiBase';

export interface MarcaDaIgreja {
  logoUrl: string | null;
  nome: string;
}

const VAZIA: MarcaDaIgreja = { logoUrl: null, nome: '' };

export function useMarcaDaIgreja(): MarcaDaIgreja {
  const [marca, setMarca] = useState<MarcaDaIgreja>(VAZIA);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        // `no-store` pelo mesmo motivo da home: o cache do navegador devolvia a
        // configuração anterior depois de a igreja salvar a nova.
        const res = await fetch(`${apiBase}/public/home-config`, { cache: 'no-store' });
        if (!res.ok || !vivo) return;
        const payload = await res.json();
        const cfg = payload?.config ?? {};
        const sede = payload?.sede ?? {};
        setMarca({
          logoUrl: typeof cfg.logoUrl === 'string' && cfg.logoUrl ? cfg.logoUrl : null,
          nome: String(cfg.siteTitle || sede.churchName || ''),
        });
      } catch {
        /* sem configuração, a tela segue sem marca nenhuma */
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  return marca;
}
