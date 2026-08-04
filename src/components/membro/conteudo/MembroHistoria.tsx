"use client";

import { useState } from 'react';
import { ChevronDown, Landmark } from 'lucide-react';
import { MembroShell } from '../MembroShell';
import { MEMBRO } from '../theme';
import { HISTORIA } from './historiaConteudo';

export default function MembroHistoria() {
  // Primeira seção aberta: a tela abre mostrando conteúdo, não uma lista de
  // títulos fechados que parece vazia.
  const [aberta, setAberta] = useState<number | null>(0);

  return (
    <MembroShell title="História" showBack>
      <div className="h-full overflow-y-auto px-4 py-4" style={{ background: MEMBRO.BG }}>
        <div className="flex flex-col">
          {HISTORIA.map((s, i) => {
            const aberto = aberta === i;
            const ultima = i === HISTORIA.length - 1;
            return (
              <div key={s.ano + s.titulo} className="flex gap-3">
                {/* trilho da linha do tempo */}
                <div className="flex flex-col items-center flex-shrink-0 w-6">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center mt-1"
                    style={{ background: aberto ? MEMBRO.ACCENT : MEMBRO.ACCENT_SOFT }}>
                    <Landmark className="w-3 h-3" style={{ color: aberto ? '#fff' : MEMBRO.ACCENT }} />
                  </div>
                  {!ultima && <div className="w-px flex-1 my-1" style={{ background: MEMBRO.BORDER }} />}
                </div>

                <div className="flex-1 min-w-0 pb-4">
                  <button
                    onClick={() => setAberta(aberto ? null : i)}
                    className="w-full text-left rounded-2xl px-4 py-3 flex items-start gap-2"
                    style={{ background: MEMBRO.CARD, border: `1px solid ${MEMBRO.BORDER}`, boxShadow: MEMBRO.SHADOW }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-bold tracking-wider" style={{ color: MEMBRO.ACCENT }}>
                        {s.ano}
                      </div>
                      <div className="font-semibold leading-snug" style={{ color: MEMBRO.TEXT1 }}>
                        {s.titulo}
                      </div>
                    </div>
                    <ChevronDown className="w-4 h-4 mt-1 flex-shrink-0 transition-transform"
                      style={{ color: MEMBRO.TEXT3, transform: aberto ? 'rotate(180deg)' : undefined }} />
                  </button>

                  {aberto && (
                    <div className="px-4 pt-3 flex flex-col gap-3">
                      {s.paragrafos.map((p, j) => (
                        <p key={j} className="text-sm leading-relaxed text-justify" style={{ color: MEMBRO.TEXT2 }}>
                          {p}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </MembroShell>
  );
}
