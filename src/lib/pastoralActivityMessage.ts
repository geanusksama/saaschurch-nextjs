/**
 * Mensagem de WhatsApp avisando a pessoa que uma atividade foi registrada no
 * atendimento pastoral dela.
 *
 * Vive fora do route handler porque a tela precisa do MESMO texto para exibir
 * como rascunho editável antes de salvar — o que o atendente enviar é o que a
 * pessoa recebe; este builder só entrega o ponto de partida.
 */

export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  agendamento: 'Agendamento',
  ligacao: 'Ligação',
  videochamada: 'Videochamada',
  reuniao: 'Reunião',
  visita: 'Visita',
  retorno: 'Retorno',
  oracao: 'Oração',
  followup: 'Follow-up',
  task: 'Tarefa',
  pendencia: 'Pendência',
};

export interface ActivityMessageInput {
  /** nome de quem vai receber */
  name?: string | null;
  activityType: string;
  title: string;
  description?: string | null;
  /** ISO ou 'YYYY-MM-DDTHH:mm' */
  scheduledDate?: string | null;
  churchName?: string | null;
  /** link da timeline pública (já montado) */
  timelineUrl?: string | null;
}

function formatWhen(scheduledDate?: string | null): string {
  if (!scheduledDate) return '';
  const d = new Date(scheduledDate);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/** Só o miolo do endereço da igreja, sem o sufixo " - SEDE" e afins. */
function churchLabel(churchName?: string | null): string {
  const name = (churchName || '').trim();
  return name || 'nossa igreja';
}

export function buildActivityMessage(input: ActivityMessageInput): string {
  const name = (input.name || '').trim() || 'Prezado(a)';
  const typeLabel = ACTIVITY_TYPE_LABELS[String(input.activityType || '').toLowerCase()]
    || input.activityType
    || 'Atividade';
  const when = formatWhen(input.scheduledDate);
  const description = (input.description || '').trim();

  const detalhes = [
    `*Tipo:* ${typeLabel}`,
    `*Título:* ${input.title}`,
    when ? `*Quando:* ${when}` : '',
    description ? `*Detalhes:* ${description}` : '',
  ].filter(Boolean).join('\n');

  const blocos = [
    `A Paz do Senhor Jesus, *${name}*! ✨`,
    `Que Deus abençoe a sua vida! Passando para informar que a sua solicitação de atendimento pastoral na ${churchLabel(input.churchName)} está em andamento. Uma nova atividade foi registrada:`,
    detalhes,
    'Estamos acompanhando e cuidando com carinho do seu caso. Acompanhe a evolução do seu atendimento em tempo real pelo link abaixo:',
    // linha própria: colado no texto o WhatsApp não transforma em link
    input.timelineUrl || '',
  ].filter(Boolean);

  return blocos.join('\n\n');
}

/**
 * Endereço público da timeline. `localhost` não vira link clicável no WhatsApp
 * e não abre no celular de ninguém, então cai para o domínio público.
 */
export function resolveTimelineUrl(attendanceId: string, origin?: string | null): string {
  // Em produção quem manda é a origem da requisição (o domínio pelo qual o
  // sistema está sendo acessado). O fallback só entra em ambiente local.
  const publicBase = (process.env.NEXT_PUBLIC_APP_URL || 'https://adcampinas.org').replace(/\/+$/, '');
  const raw = (origin || '').trim().replace(/\/+$/, '');
  const isLocal = !raw || /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/i.test(raw);
  const base = isLocal ? publicBase : raw;
  return `${base}/pastoral/timeline/${attendanceId}`;
}
