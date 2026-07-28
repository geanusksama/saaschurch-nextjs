import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Seta animada de "tem mais conteúdo abaixo", só no mobile.
 *
 * A home esconde as barras de rolagem (`*::-webkit-scrollbar{display:none}`),
 * então no celular não sobra nenhuma pista de que a página continua — este é o
 * único indicador. Some sozinha quando a pessoa chega perto do fim.
 */
export function ScrollHint({ hidden = false }: { hidden?: boolean }) {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const avaliar = () => {
      const restante = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
      setVisivel(restante > 80);
    };

    avaliar();
    window.addEventListener('scroll', avaliar, { passive: true });
    window.addEventListener('resize', avaliar);
    // o conteúdo da home cresce depois da montagem (símbolos, imagens, modais)
    const obs = new ResizeObserver(avaliar);
    obs.observe(document.body);

    return () => {
      window.removeEventListener('scroll', avaliar);
      window.removeEventListener('resize', avaliar);
      obs.disconnect();
    };
  }, []);

  if (hidden || !visivel) return null;

  return (
    <button
      type="button"
      aria-label="Ver mais conteúdo abaixo"
      onClick={() => window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' })}
      className="md:hidden fixed bottom-7 left-1/2 -translate-x-1/2 z-30"
    >
      {/* pílula verde opaca: a home rola por baixo dela, e sem fundo próprio o
          texto se misturava com os cards. O verde é o mesmo do FAB. */}
      <span
        className="flex items-center gap-1.5 rounded-full py-1.5 pl-3.5 pr-3 text-white"
        style={{
          background: 'linear-gradient(135deg,#059669,#10b981)',
          boxShadow: '0 4px 16px rgba(16,185,129,0.4)',
        }}
      >
        <span className="text-[10px] font-semibold tracking-wide">role para ver mais</span>
        <ChevronDown
          className="w-3.5 h-3.5"
          style={{ animation: 'scroll-hint-bounce 1.8s ease-in-out infinite' }}
        />
      </span>
    </button>
  );
}
