"use client";

import { useState } from 'react';
import { Sunrise, ChevronDown } from 'lucide-react';
import { MembroShell } from '../MembroShell';
import { MEMBRO } from '../theme';
import { useConteudo } from './useConteudo';
import { Carregando, Vazio, SemCampo, Erro, Lista, Cartao, dataBR } from './Primitivos';

// Espelha PaoDiario de lib/membroConteudoService — declarado aqui de propósito:
// importar do service arrastaria o supabaseAdmin para o bundle do cliente.
interface Pao {
  id: string;
  titulo: string;
  versiculo: string | null;
  referencia: string | null;
  texto: string | null;
  audio_url: string | null;
  imagem_url: string | null;
  data: string | null;
  autor: string | null;
}

export default function MembroPaoDiario() {
  const { dados, carregando, erro, semCampo } = useConteudo<Pao[]>('pao');
  const [aberto, setAberto] = useState<string | null>(null);

  return (
    <MembroShell title="Pão diário" showBack>
      {carregando ? <Carregando />
        : erro ? <Erro mensagem={erro} />
        : semCampo ? <SemCampo />
        : !dados?.length ? <Vazio oQue="devocional" />
        : (
          <Lista>
            {dados.map(p => {
              const expandido = aberto === p.id;
              return (
                <Cartao key={p.id} onClick={() => setAberto(expandido ? null : p.id)}>
                  {p.imagem_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.imagem_url} alt="" className="w-full h-36 object-cover" />
                  )}
                  <div className="p-4 flex flex-col gap-2">
                    <div className="flex items-start gap-2">
                      <Sunrise className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: MEMBRO.ACCENT }} />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold leading-snug" style={{ color: MEMBRO.TEXT1 }}>
                          {p.titulo}
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: MEMBRO.TEXT3 }}>
                          {[dataBR(p.data), p.autor].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      <ChevronDown
                        className="w-4 h-4 flex-shrink-0 transition-transform"
                        style={{ color: MEMBRO.TEXT3, transform: expandido ? 'rotate(180deg)' : undefined }}
                      />
                    </div>

                    {p.versiculo && (
                      <blockquote
                        className="text-sm italic leading-relaxed pl-3"
                        style={{ color: MEMBRO.TEXT2, borderLeft: `3px solid ${MEMBRO.ACCENT_SOFT}` }}
                      >
                        “{p.versiculo}”
                        {p.referencia && (
                          <span className="not-italic font-medium block mt-1 text-xs" style={{ color: MEMBRO.ACCENT }}>
                            {p.referencia}
                          </span>
                        )}
                      </blockquote>
                    )}

                    {expandido && p.texto && (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: MEMBRO.TEXT2 }}>
                        {p.texto}
                      </p>
                    )}

                    {expandido && p.audio_url && (
                      <audio controls src={p.audio_url} className="w-full mt-1" onClick={e => e.stopPropagation()} />
                    )}
                  </div>
                </Cartao>
              );
            })}
          </Lista>
        )}
    </MembroShell>
  );
}
