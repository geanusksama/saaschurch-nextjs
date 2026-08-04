"use client";

/**
 * Peças visuais comuns às telas de conteúdo do portal do membro.
 *
 * Ficam num arquivo só porque as seis telas repetem exatamente os mesmos três
 * estados (carregando, vazio, erro) — sem isto cada tela reinventava o seu, e
 * era assim que apareciam textos claros sobre fundo claro.
 */

import { Loader2, AlertCircle, Inbox, MapPinOff } from 'lucide-react';
import { MEMBRO } from '../theme';

export function Carregando() {
  return (
    <div className="flex-1 flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: MEMBRO.ACCENT }} />
    </div>
  );
}

export function Aviso({
  Icon, titulo, texto,
}: { Icon: React.ElementType; titulo: string; texto: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-8 py-16 gap-3">
      <div className="w-14 h-14 rounded-full flex items-center justify-center"
        style={{ background: MEMBRO.ACCENT_SOFT }}>
        <Icon className="w-6 h-6" style={{ color: MEMBRO.ACCENT }} />
      </div>
      <div className="font-semibold" style={{ color: MEMBRO.TEXT1 }}>{titulo}</div>
      <div className="text-sm leading-relaxed max-w-xs" style={{ color: MEMBRO.TEXT2 }}>{texto}</div>
    </div>
  );
}

export function Vazio({ oQue }: { oQue: string }) {
  return (
    <Aviso
      Icon={Inbox}
      titulo={`Nenhum ${oQue} por aqui`}
      texto={`Assim que a sua igreja publicar, ${oQue} aparece nesta tela.`}
    />
  );
}

export function SemCampo() {
  return (
    <Aviso
      Icon={MapPinOff}
      titulo="Cadastro sem campo definido"
      texto="Seu cadastro ainda não está ligado a um campo, e por isso não dá para mostrar o conteúdo certo. Fale com a secretaria da sua igreja."
    />
  );
}

export function Erro({ mensagem }: { mensagem: string }) {
  return <Aviso Icon={AlertCircle} titulo="Não foi possível carregar" texto={mensagem} />;
}

/** Casca de rolagem usada por todas as telas de lista. */
export function Lista({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full overflow-y-auto px-4 py-4 flex flex-col gap-3"
      style={{ background: MEMBRO.BG }}>
      {children}
    </div>
  );
}

export function Cartao({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      // flex-shrink-0: dentro do flex-column da Lista o cartão encolhe por
      // padrão e corta o texto no meio da linha. Foi o que aconteceu na lista
      // de Ministérios — descrição cortada em todos os cards.
      className={`rounded-2xl overflow-hidden flex-shrink-0 ${onClick ? 'cursor-pointer active:scale-[0.99] transition-transform' : ''}`}
      style={{ background: MEMBRO.CARD, border: `1px solid ${MEMBRO.BORDER}`, boxShadow: MEMBRO.SHADOW }}
    >
      {children}
    </div>
  );
}

/** Data no formato curto brasileiro; devolve '' se vier nula ou inválida. */
export function dataBR(iso: string | null | undefined, comHora = false): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return comHora
    ? d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}
