import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { quickSendWhatsApp } from '@/lib/whatsappSendService';

// MAP OF STATUS/COLUMN KEY TO READABLE PORTUGUESE LABEL
const STATUS_LABELS: Record<string, string> = {
  todo: 'Aguardando Fila',
  open: 'Aguardando Fila',
  doing: 'Em Atendimento',
  done: 'Concluído',
  cancelled: 'Cancelado',
};

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
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

export async function POST(req: NextRequest) {
  return withAuth(req, async (user) => {
    try {
      const body = await req.json().catch(() => ({}));
      const { eventType, attendanceId, targetUserId, activityId, newStatus } = body;

      if (!eventType || !attendanceId) {
        return NextResponse.json({ error: 'eventType e attendanceId são obrigatórios' }, { status: 400 });
      }

      // 1. Fetch attendance details
      const { data: attendance, error: attError } = await supabaseAdmin
        .from('pastoral_attendances')
        .select('id, visitor_name, attendance_type, church_id, status')
        .eq('id', attendanceId)
        .single();

      if (attError || !attendance) {
        return NextResponse.json({ error: 'Atendimento não encontrado' }, { status: 404 });
      }

      const visitorName = attendance.visitor_name || 'Visitante';
      const attType = attendance.attendance_type || 'Geral';

      // Helper to get responsibles from participants list (church members with pastor/lider role)
      const getResponsibles = async () => {
        const { data: parts } = await supabaseAdmin
          .from('pastoral_attendance_participants')
          .select('member_id, members(full_name, phone)')
          .eq('attendance_id', attendanceId)
          .in('role', ['pastor', 'lider']);

        return (parts || [])
          .filter((p) => p.member_id && p.members)
          .map((p: any) => ({
            id: p.member_id,
            name: p.members.full_name,
            phone: p.members.phone,
          }));
      };

      const results: any[] = [];

      // 2. Perform actions according to eventType
      if (eventType === 'responsible_assigned') {
        const targetMemberId = body.targetMemberId || targetUserId;
        if (!targetMemberId) {
          return NextResponse.json({ error: 'targetMemberId é obrigatório para responsible_assigned' }, { status: 400 });
        }

        // Fetch assigned member details
        const { data: assignedMember } = await supabaseAdmin
          .from('members')
          .select('id, full_name, phone')
          .eq('id', targetMemberId)
          .single();

        if (assignedMember) {
          const baseOrigin = body.origin || req.headers.get('origin') || 'https://adcampinas.org';
          const timelineLink = `${baseOrigin}/pastoral/timeline/${attendanceId}`;

          const { data: upcomingActivities } = await supabaseAdmin
            .from('pastoral_attendance_activities')
            .select('activity_type, title, scheduled_date')
            .eq('attendance_id', attendanceId)
            .eq('church_id', attendance.church_id)
            .eq('completed', false)
            .order('scheduled_date', { ascending: true })
            .limit(5);

          const { count: notesCount } = await supabaseAdmin
            .from('pastoral_attendance_notes')
            .select('id', { count: 'exact', head: true })
            .eq('attendance_id', attendanceId)
            .eq('church_id', attendance.church_id);

          const activityLines = (upcomingActivities || []).map((activity: any) => {
            const typeLabel = ACTIVITY_TYPE_LABELS[activity.activity_type] || activity.activity_type || 'Atividade';
            const dateLabel = activity.scheduled_date
              ? ` em ${new Date(activity.scheduled_date).toLocaleString('pt-BR')}`
              : '';
            const titleLabel = activity.title ? ` - ${activity.title}` : '';
            return `- ${typeLabel}${titleLabel}${dateLabel}`;
          });

          const activitiesText = activityLines.length > 0
            ? `\n\nPróximas atividades agendadas:\n${activityLines.join('\n')}`
            : '\n\nNenhuma atividade agendada no momento.';

          const notesText = notesCount && notesCount > 0
            ? `\n\nHá ${notesCount} anotação${notesCount === 1 ? '' : 'ões'} anexada${notesCount === 1 ? '' : 's'} a este atendimento. Leia-as no histórico para entender o contexto.`
            : '\n\nAinda não há anotações anexadas a este atendimento.';

          const msg = `Você foi designado para acompanhar um novo atendimento.\n\nPessoa: ${visitorName}\nTipo: ${attType}\n\n${notesText}\n\nAcesse o histórico do atendimento e acompanhe as próximas atividades pelo link abaixo:\n${timelineLink}${activitiesText}\n\nConte com a equipe e prossiga com confiança. Deus abençoe esse cuidado.`;
          
          let waResult = null;
          if (assignedMember.phone) {
            waResult = await quickSendWhatsApp({
              ownerUserId: user.id,
              profileType: user.profileType,
              phone: assignedMember.phone,
              message: msg,
              contactName: assignedMember.full_name || undefined,
            }).catch((err) => ({ error: err.message }));
          }

          // Register in timeline
          await supabaseAdmin.from('pastoral_attendance_timeline').insert({
            attendance_id: attendanceId,
            church_id: attendance.church_id,
            event_type: 'moved',
            description: `Responsável ${assignedMember.full_name} designado para o atendimento.`,
            created_by: user.id,
            metadata: {
              target_member_id: targetMemberId,
              whatsapp_sent: !!waResult?.messageId,
            },
          });

          results.push({ member: assignedMember.full_name, waResult });
        }
      } else if (eventType === 'activity_created') {
        const responsibles = await getResponsibles();
        const msg = `Nova atividade cadastrada no atendimento de ${visitorName}.`;

        for (const resp of responsibles) {
          // Do not send to the creator of the activity if they are a responsible
          if (resp.id === user.id) continue;

          let waResult = null;
          if (resp.phone) {
            waResult = await quickSendWhatsApp({
              ownerUserId: user.id,
              profileType: user.profileType,
              phone: resp.phone,
              message: msg,
              contactName: resp.name || undefined,
            }).catch((err) => ({ error: err.message }));
          }
          results.push({ user: resp.name, waResult });
        }

        // Register in timeline
        await supabaseAdmin.from('pastoral_attendance_timeline').insert({
          attendance_id: attendanceId,
          church_id: attendance.church_id,
          event_type: 'activity',
          description: `Nova atividade criada.`,
          created_by: user.id,
        });
      } else if (eventType === 'activity_completed') {
        const responsibles = await getResponsibles();
        const msg = `Atividade concluída no atendimento de ${visitorName}.`;

        for (const resp of responsibles) {
          if (resp.id === user.id) continue; // Skip the completion agent

          let waResult = null;
          if (resp.phone) {
            waResult = await quickSendWhatsApp({
              ownerUserId: user.id,
              profileType: user.profileType,
              phone: resp.phone,
              message: msg,
              contactName: resp.name || undefined,
            }).catch((err) => ({ error: err.message }));
          }
          results.push({ user: resp.name, waResult });
        }

        // Register in timeline
        await supabaseAdmin.from('pastoral_attendance_timeline').insert({
          attendance_id: attendanceId,
          church_id: attendance.church_id,
          event_type: 'completed',
          description: `Atividade concluída.`,
          created_by: user.id,
        });
      } else if (eventType === 'status_changed') {
        const readableStatus = STATUS_LABELS[newStatus] || newStatus || 'Novo Status';
        const responsibles = await getResponsibles();
        const msg = `O status do atendimento de ${visitorName} foi alterado para ${readableStatus}.`;

        for (const resp of responsibles) {
          let waResult = null;
          if (resp.phone) {
            waResult = await quickSendWhatsApp({
              ownerUserId: user.id,
              profileType: user.profileType,
              phone: resp.phone,
              message: msg,
              contactName: resp.name || undefined,
            }).catch((err) => ({ error: err.message }));
          }
          results.push({ user: resp.name, waResult });
        }

        // Register in timeline
        await supabaseAdmin.from('pastoral_attendance_timeline').insert({
          attendance_id: attendanceId,
          church_id: attendance.church_id,
          event_type: 'moved',
          description: `Status alterado para "${readableStatus}".`,
          created_by: user.id,
          metadata: {
            new_status: newStatus,
          },
        });
      }

      return NextResponse.json({ success: true, results });
    } catch (error: any) {
      console.error('[POST /api/pastoral/notify] error:', error);
      return NextResponse.json({ error: 'Erro interno no servidor', details: error.message }, { status: 500 });
    }
  });
}
