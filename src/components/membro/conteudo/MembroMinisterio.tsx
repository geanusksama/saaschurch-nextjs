"use client";

import { Flame, Mail, Phone } from 'lucide-react';
import { MembroShell } from '../MembroShell';
import { MEMBRO } from '../theme';
import { useConteudo } from './useConteudo';
import { Carregando, Vazio, SemCampo, Erro, Lista, Cartao } from './Primitivos';

interface Ministerio {
  id: string;
  nome: string;
  descricao: string | null;
  cor: string | null;
  icone: string | null;
  email: string | null;
  telefone: string | null;
}

/** Aceita '#rrggbb' ou 'rrggbb'; qualquer outra coisa cai no azul do portal. */
function corValida(cor: string | null): string {
  if (!cor) return MEMBRO.ACCENT;
  const c = cor.startsWith('#') ? cor : `#${cor}`;
  return /^#[0-9a-f]{6}$/i.test(c) ? c : MEMBRO.ACCENT;
}

export default function MembroMinisterio() {
  const { dados, carregando, erro, semCampo } = useConteudo<Ministerio[]>('ministerios');

  return (
    <MembroShell title="Ministérios" showBack>
      {carregando ? <Carregando />
        : erro ? <Erro mensagem={erro} />
        : semCampo ? <SemCampo />
        : !dados?.length ? <Vazio oQue="ministério" />
        : (
          <Lista>
            {dados.map(m => {
              const cor = corValida(m.cor);
              return (
                <Cartao key={m.id}>
                  <div className="p-4 flex gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${cor}1a` }}>
                      <Flame className="w-5 h-5" style={{ color: cor }} />
                    </div>
                    <div className="min-w-0 flex-1 flex flex-col gap-1">
                      <div className="font-semibold leading-snug" style={{ color: MEMBRO.TEXT1 }}>
                        {m.nome}
                      </div>
                      {m.descricao && (
                        <p className="text-sm leading-relaxed" style={{ color: MEMBRO.TEXT2 }}>
                          {m.descricao}
                        </p>
                      )}
                      {(m.email || m.telefone) && (
                        <div className="flex flex-wrap gap-3 mt-1">
                          {m.email && (
                            <a href={`mailto:${m.email}`}
                              className="inline-flex items-center gap-1 text-xs font-medium"
                              style={{ color: cor }}>
                              <Mail className="w-3.5 h-3.5" /> {m.email}
                            </a>
                          )}
                          {m.telefone && (
                            <a href={`tel:${m.telefone.replace(/\D/g, '')}`}
                              className="inline-flex items-center gap-1 text-xs font-medium"
                              style={{ color: cor }}>
                              <Phone className="w-3.5 h-3.5" /> {m.telefone}
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Cartao>
              );
            })}
          </Lista>
        )}
    </MembroShell>
  );
}
