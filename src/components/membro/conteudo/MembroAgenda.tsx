"use client";

import { MapPin, CalendarDays } from 'lucide-react';
import { MembroShell } from '../MembroShell';
import { MEMBRO } from '../theme';
import { useConteudo } from './useConteudo';
import { Carregando, Vazio, SemCampo, Erro, Lista, Cartao, dataBR } from './Primitivos';

interface Evento {
  id: string;
  titulo: string;
  descricao: string | null;
  banner: string | null;
  inicio: string | null;
  fim: string | null;
  local: string | null;
  gratuito: boolean;
  preco: number;
}

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function MembroAgenda() {
  const { dados, carregando, erro, semCampo } = useConteudo<Evento[]>('agenda');

  return (
    <MembroShell title="Agenda" showBack>
      {carregando ? <Carregando />
        : erro ? <Erro mensagem={erro} />
        : semCampo ? <SemCampo />
        : !dados?.length ? <Vazio oQue="evento" />
        : (
          <Lista>
            {dados.map(e => (
              <Cartao key={e.id}>
                {e.banner && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.banner} alt="" className="w-full h-36 object-cover" />
                )}
                <div className="p-4 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold leading-snug flex-1" style={{ color: MEMBRO.TEXT1 }}>
                      {e.titulo}
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{
                        background: e.gratuito ? '#dcfce7' : MEMBRO.ACCENT_SOFT,
                        color: e.gratuito ? MEMBRO.OK : MEMBRO.ACCENT,
                      }}>
                      {e.gratuito ? 'Gratuito' : brl(e.preco)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs" style={{ color: MEMBRO.TEXT2 }}>
                    <CalendarDays className="w-3.5 h-3.5 flex-shrink-0" style={{ color: MEMBRO.ACCENT }} />
                    {dataBR(e.inicio, true)}
                    {e.fim && ` até ${dataBR(e.fim, true)}`}
                  </div>

                  {e.local && (
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: MEMBRO.TEXT2 }}>
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: MEMBRO.ACCENT }} />
                      {e.local}
                    </div>
                  )}

                  {e.descricao && (
                    <p className="text-sm leading-relaxed" style={{ color: MEMBRO.TEXT2 }}>{e.descricao}</p>
                  )}
                </div>
              </Cartao>
            ))}
          </Lista>
        )}
    </MembroShell>
  );
}
