"use client";

import { useMemo } from 'react';
import { User } from 'lucide-react';
import { MembroShell } from '../MembroShell';
import { MEMBRO } from '../theme';
import { useConteudo } from './useConteudo';
import { Carregando, Vazio, SemCampo, Erro, Lista } from './Primitivos';

interface Lider {
  id: string;
  nome: string;
  cargo: string | null;
  foto: string | null;
  grupo: string | null;
  ordem: number;
}

export default function MembroLideranca() {
  const { dados, carregando, erro, semCampo } = useConteudo<Lider[]>('lideranca');

  // Agrupa por `grupo` preservando a ordem em que os grupos aparecem — a
  // ordenação dentro de cada um já vem do servidor pelo campo `ordem`.
  const grupos = useMemo(() => {
    const mapa = new Map<string, Lider[]>();
    for (const l of dados ?? []) {
      const chave = l.grupo?.trim() || 'Liderança';
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave)!.push(l);
    }
    return [...mapa.entries()];
  }, [dados]);

  return (
    <MembroShell title="Liderança" showBack>
      {carregando ? <Carregando />
        : erro ? <Erro mensagem={erro} />
        : semCampo ? <SemCampo />
        : !dados?.length ? <Vazio oQue="líder cadastrado" />
        : (
          <Lista>
            {grupos.map(([grupo, lideres]) => (
              <div key={grupo} className="flex flex-col gap-2 flex-shrink-0">
                <div className="text-[11px] font-bold uppercase tracking-wider px-1"
                  style={{ color: MEMBRO.TEXT3 }}>
                  {grupo}
                </div>
                <div className="rounded-2xl overflow-hidden"
                  style={{ background: MEMBRO.CARD, border: `1px solid ${MEMBRO.BORDER}`, boxShadow: MEMBRO.SHADOW }}>
                  {lideres.map((l, i) => (
                    <div key={l.id} className="flex items-center gap-3 px-4 py-3"
                      style={{ borderTop: i ? `1px solid ${MEMBRO.BORDER}` : undefined }}>
                      {l.foto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.foto} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: MEMBRO.ACCENT_SOFT }}>
                          <User className="w-5 h-5" style={{ color: MEMBRO.ACCENT }} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate" style={{ color: MEMBRO.TEXT1 }}>{l.nome}</div>
                        {l.cargo && (
                          <div className="text-xs truncate" style={{ color: MEMBRO.TEXT2 }}>{l.cargo}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </Lista>
        )}
    </MembroShell>
  );
}
