/**
 * Ícone do Pix no traço dos ícones lucide (stroke, currentColor), para usar
 * onde o lucide entra: menu, botões, cards. O lucide não tem a marca Pix.
 */
import type { SVGProps } from 'react';

export function PixIcon({ className, strokeWidth = 2, ...props }: SVGProps<SVGSVGElement> & { strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...props}>
      <path d="M6.2 8.4 10.6 4a2 2 0 0 1 2.8 0l4.4 4.4" />
      <path d="M6.2 15.6 10.6 20a2 2 0 0 0 2.8 0l4.4-4.4" />
      <path d="M2.8 12 6 8.8h1.2l3.4 3.4a2 2 0 0 0 2.8 0l3.4-3.4H18l3.2 3.2-3.2 3.2h-1.2l-3.4-3.4a2 2 0 0 0-2.8 0l-3.4 3.4H6Z" />
    </svg>
  );
}

export default PixIcon;
