"use client";

import { Clock, Phone, Info, Link2, Church } from 'lucide-react';
import { MembroShell } from '../MembroShell';
import { MEMBRO } from '../theme';
import { useConteudo } from './useConteudo';
import { Carregando, SemCampo, Erro, Lista, Vazio } from './Primitivos';

// Colunas reais de app_location_* (ver membroConteudoService.getIgreja).
interface Perfil { hero_badge?: string; hero_title?: string; hero_subtitle?: string; year_badge?: string }
interface Horario { id: string; title?: string; weekday_label?: string; time_label?: string }
interface Contato { id: string; title?: string; subtitle?: string; action_url?: string }
interface Acesso { id: string; text?: string }
interface Rede { id: string; label?: string; url?: string }

interface DadosIgreja {
  perfil: Perfil | null;
  horarios: Horario[];
  contatos: Contato[];
  acesso: Acesso[];
  redes: Rede[];
}

function Secao({
  Icon, titulo, children,
}: { Icon: React.ElementType; titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 flex-shrink-0">
      <div className="flex items-center gap-1.5 px-1">
        <Icon className="w-3.5 h-3.5" style={{ color: MEMBRO.ACCENT }} />
        <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: MEMBRO.TEXT3 }}>
          {titulo}
        </span>
      </div>
      <div className="rounded-2xl overflow-hidden"
        style={{ background: MEMBRO.CARD, border: `1px solid ${MEMBRO.BORDER}`, boxShadow: MEMBRO.SHADOW }}>
        {children}
      </div>
    </div>
  );
}

function Linha({
  principal, secundario, href, primeira,
}: { principal: string; secundario?: string; href?: string; primeira: boolean }) {
  const conteudo = (
    <div className="px-4 py-3 flex items-center justify-between gap-3"
      style={{ borderTop: primeira ? undefined : `1px solid ${MEMBRO.BORDER}` }}>
      <span className="text-sm font-medium" style={{ color: MEMBRO.TEXT1 }}>{principal}</span>
      {secundario && (
        <span className="text-sm text-right flex-shrink-0" style={{ color: MEMBRO.TEXT2 }}>{secundario}</span>
      )}
    </div>
  );
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" className="block active:opacity-70">{conteudo}</a>
    : conteudo;
}

export default function MembroIgreja() {
  const { dados, carregando, erro, semCampo } = useConteudo<DadosIgreja>('igreja', 'igreja');

  const vazio = dados
    && !dados.perfil
    && !dados.horarios.length && !dados.contatos.length
    && !dados.acesso.length && !dados.redes.length;

  return (
    <MembroShell title="Igreja" showBack>
      {carregando ? <Carregando />
        : erro ? <Erro mensagem={erro} />
        : semCampo ? <SemCampo />
        : vazio || !dados ? <Vazio oQue="dado da igreja" />
        : (
          <Lista>
            {dados.perfil && (
              <div className="rounded-2xl p-5 flex flex-col gap-1"
                style={{ background: MEMBRO.ACCENT, boxShadow: MEMBRO.SHADOW }}>
                {dados.perfil.hero_badge && (
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/80">
                    {dados.perfil.hero_badge}
                  </span>
                )}
                <div className="text-xl font-bold text-white leading-snug">
                  {dados.perfil.hero_title ?? 'Nossa igreja'}
                </div>
                {dados.perfil.hero_subtitle && (
                  <p className="text-sm text-white/85 leading-relaxed">{dados.perfil.hero_subtitle}</p>
                )}
                {dados.perfil.year_badge && (
                  <span className="text-xs text-white/70 mt-1">{dados.perfil.year_badge}</span>
                )}
              </div>
            )}

            {dados.horarios.length > 0 && (
              <Secao Icon={Clock} titulo="Horários">
                {dados.horarios.map((h, i) => (
                  <Linha key={h.id} primeira={i === 0}
                    principal={h.title || h.weekday_label || 'Culto'}
                    secundario={[h.weekday_label && h.title ? h.weekday_label : null, h.time_label]
                      .filter(Boolean).join(' · ')} />
                ))}
              </Secao>
            )}

            {dados.contatos.length > 0 && (
              <Secao Icon={Phone} titulo="Contatos">
                {dados.contatos.map((c, i) => (
                  <Linha key={c.id} primeira={i === 0}
                    principal={c.title || 'Contato'} secundario={c.subtitle} href={c.action_url} />
                ))}
              </Secao>
            )}

            {dados.acesso.length > 0 && (
              <Secao Icon={Info} titulo="Como chegar">
                {dados.acesso.map((a, i) => (
                  <div key={a.id} className="px-4 py-3 text-sm leading-relaxed"
                    style={{ color: MEMBRO.TEXT2, borderTop: i ? `1px solid ${MEMBRO.BORDER}` : undefined }}>
                    {a.text}
                  </div>
                ))}
              </Secao>
            )}

            {dados.redes.length > 0 && (
              <Secao Icon={Link2} titulo="Redes">
                {dados.redes.map((r, i) => (
                  <Linha key={r.id} primeira={i === 0} principal={r.label || 'Link'} href={r.url} />
                ))}
              </Secao>
            )}

            <div className="flex items-center justify-center gap-1.5 py-4">
              <Church className="w-3.5 h-3.5" style={{ color: MEMBRO.TEXT3 }} />
              <span className="text-xs" style={{ color: MEMBRO.TEXT3 }}>Informações do seu campo</span>
            </div>
          </Lista>
        )}
    </MembroShell>
  );
}
