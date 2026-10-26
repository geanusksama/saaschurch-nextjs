/**
 * Ícone do Instagram no traço dos ícones lucide (stroke, currentColor). O
 * lucide 1.x tirou os ícones de marca.
 */
import type { SVGProps } from 'react';

export function InstagramIcon({ className, strokeWidth = 2, ...props }: SVGProps<SVGSVGElement> & { strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true" {...props}>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <path d="M17.4 6.6h.01" />
    </svg>
  );
}

export default InstagramIcon;
