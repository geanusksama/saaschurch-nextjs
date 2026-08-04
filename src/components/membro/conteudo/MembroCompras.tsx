"use client";

import { Ticket, CheckCircle2, XCircle } from 'lucide-react';
import { MembroShell } from '../MembroShell';
import { MEMBRO } from '../theme';
import { useConteudo } from './useConteudo';
import { Carregando, SemCampo, Erro, Lista, Cartao, Aviso, dataBR } from './Primitivos';

interface Ingresso {
  id: string;
  codigo: string;
  evento: string | null;
  assento: string | null;
  data_evento: string | null;
  emitido_em: string | null;
  usado: boolean;
  cancelado: boolean;
}

export default function MembroCompras() {
  const { dados, carregando, erro, semCampo } = useConteudo<Ingresso[]>('compras');

  return (
    <MembroShell title="Compras" showBack>
      {carregando ? <Carregando />
        : erro ? <Erro mensagem={erro} />
        : semCampo ? <SemCampo />
        : !dados?.length ? (
          // Lista vazia aqui tem duas causas — nunca comprou, ou o cadastro
          // ainda não está ligado ao login do aplicativo. Dizer as duas evita
          // o suporte achar que o ingresso sumiu.
          <Aviso
            Icon={Ticket}
            titulo="Nenhum ingresso por aqui"
            texto="Você ainda não tem ingressos, ou seu cadastro não está ligado ao login do aplicativo. Se você comprou pelo app, entre nele uma vez para vincular."
          />
        )
        : (
          <Lista>
            {dados.map(i => {
              const inativo = i.cancelado || i.usado;
              return (
                <Cartao key={i.id}>
                  <div className="p-4 flex flex-col gap-2" style={{ opacity: i.cancelado ? 0.6 : 1 }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold leading-snug flex-1" style={{ color: MEMBRO.TEXT1 }}>
                        {i.evento ?? 'Ingresso'}
                      </div>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 inline-flex items-center gap-1"
                        style={{
                          background: i.cancelado ? '#fee2e2' : i.usado ? '#f1f5f9' : '#dcfce7',
                          color: i.cancelado ? MEMBRO.DANGER : i.usado ? MEMBRO.TEXT2 : MEMBRO.OK,
                        }}>
                        {i.cancelado ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                        {i.cancelado ? 'Cancelado' : i.usado ? 'Utilizado' : 'Válido'}
                      </span>
                    </div>

                    {i.data_evento && (
                      <div className="text-xs" style={{ color: MEMBRO.TEXT2 }}>{dataBR(i.data_evento, true)}</div>
                    )}

                    <div className="flex items-center justify-between gap-2 mt-1 rounded-xl px-3 py-2"
                      style={{ background: inativo ? MEMBRO.BG : MEMBRO.ACCENT_SOFT }}>
                      <span className="font-mono text-sm font-semibold tracking-wider"
                        style={{ color: inativo ? MEMBRO.TEXT2 : MEMBRO.ACCENT }}>
                        {i.codigo}
                      </span>
                      {i.assento && (
                        <span className="text-xs font-medium" style={{ color: MEMBRO.TEXT2 }}>
                          Assento {i.assento}
                        </span>
                      )}
                    </div>

                    {i.emitido_em && (
                      <div className="text-[11px]" style={{ color: MEMBRO.TEXT3 }}>
                        Emitido em {dataBR(i.emitido_em)}
                      </div>
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
