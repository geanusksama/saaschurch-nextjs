import { useNavigate, useParams } from 'react-router';
import {
  ArrowLeft, Ticket, Pencil, Calendar, MapPin, Users, DollarSign,
  Clock, CheckCircle, XCircle, Tag, Eye, Mic2, Music2, BookOpen,
  Sparkles, Heart, Flame, Star, Globe, Sunrise, BarChart2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';

const EVENT_ICONS: Record<string, LucideIcon> = {
  mic: Mic2, music: Music2, book: BookOpen, users: Users,
  sparkles: Sparkles, heart: Heart, flame: Flame, star: Star,
  globe: Globe, sunrise: Sunrise, ticket: Ticket,
};

const STATUS_CFG: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  RASCUNHO:   { label: 'Rascunho',  color: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',         icon: Eye },
  PUBLICADO:  { label: 'Publicado', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',       icon: CheckCircle },
  ENCERRADO:  { label: 'Encerrado', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',   icon: Clock },
  CANCELADO:  { label: 'Cancelado', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',               icon: XCircle },
};

const STATUS_NEXT: Record<string, { next: string; label: string }> = {
  RASCUNHO:  { next: 'PUBLICADO', label: 'Publicar evento' },
  PUBLICADO: { next: 'ENCERRADO', label: 'Encerrar evento' },
  ENCERRADO: { next: 'CANCELADO', label: 'Cancelar evento' },
};

function fmt(dt: string) {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function AppEventView() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: event, isLoading, error } = useQuery({
    queryKey: ['app-event', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_events')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: sectors = [] } = useQuery({
    queryKey: ['event-sectors', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from('event_sectors')
        .select('*')
        .eq('event_id', id!)
        .order('ordem');
      return data ?? [];
    },
  });

  const { data: participants = [] } = useQuery({
    queryKey: ['event-participants', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from('event_participants')
        .select('*')
        .eq('event_id', id!)
        .order('ordem');
      return data ?? [];
    },
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['event-orders-count', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from('event_orders')
        .select('id, status')
        .eq('event_id', id!);
      return data ?? [];
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const { error } = await supabase
        .from('app_events')
        .update({ status: newStatus })
        .eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-event', id] });
      queryClient.invalidateQueries({ queryKey: ['app-events'] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        Carregando evento...
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="p-6">
        <button onClick={() => navigate('/app-ui/app/events')}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <p className="text-red-500">Evento não encontrado.</p>
      </div>
    );
  }

  const EvIcon = EVENT_ICONS[event.icon] ?? Ticket;
  const statusCfg = STATUS_CFG[event.status] ?? { label: event.status, color: 'bg-slate-100 text-slate-600', icon: Tag };
  const StatusIcon = statusCfg.icon;
  const nextStatus = STATUS_NEXT[event.status];
  const confirmedOrders = orders.filter((o: { status: string }) => ['CONFIRMADO', 'PAGO'].includes(o.status)).length;

  return (
    <div className="h-full flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/app-ui/app/events')}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
            <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <div className="w-8 h-8 bg-purple-100 rounded-xl flex items-center justify-center">
            <EvIcon className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{event.nome}</h1>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.color}`}>
              <StatusIcon className="w-3 h-3" />
              {statusCfg.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {nextStatus && (
            <button
              onClick={() => statusMutation.mutate(nextStatus.next)}
              disabled={statusMutation.isPending}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
            >
              {nextStatus.label}
            </button>
          )}
          <button
            onClick={() => navigate(`/app-ui/app/events/${id}/edit`)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
          >
            <Pencil className="w-4 h-4" />
            Editar
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: Users,      label: 'Pedidos',       value: orders.length },
            { icon: CheckCircle, label: 'Confirmados',   value: confirmedOrders },
            { icon: BarChart2,  label: 'Capacidade',    value: event.capacidade_total ?? '∞' },
            { icon: DollarSign, label: 'Preço',         value: event.gratuito ? 'Gratuito' : `R$ ${Number(event.preco).toFixed(2)}` },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-purple-50 dark:bg-purple-900/30 rounded-lg flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-5">

          {/* Coluna principal */}
          <div className="lg:col-span-2 space-y-5">

            {/* Imagem */}
            {event.imagem_url && (
              <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                <img src={event.imagem_url} alt={event.nome} className="w-full h-52 object-cover" />
              </div>
            )}

            {/* Info básica */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">Informações Básicas</h2>

              {event.descricao && (
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{event.descricao}</p>
              )}

              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                  <Calendar className="w-4 h-4 mt-0.5 text-purple-500 shrink-0" />
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-300">Início</p>
                    <p>{fmt(event.data_inicio)}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                  <Clock className="w-4 h-4 mt-0.5 text-purple-500 shrink-0" />
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-300">Fim</p>
                    <p>{fmt(event.data_fim)}</p>
                  </div>
                </div>
                {event.local && (
                  <div className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                    <MapPin className="w-4 h-4 mt-0.5 text-purple-500 shrink-0" />
                    <div>
                      <p className="font-medium text-slate-700 dark:text-slate-300">Local</p>
                      <p>{event.local}</p>
                      {event.local_endereco && <p className="text-xs text-slate-400">{event.local_endereco}</p>}
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                  <Tag className="w-4 h-4 mt-0.5 text-purple-500 shrink-0" />
                  <div>
                    <p className="font-medium text-slate-700 dark:text-slate-300">Tipo</p>
                    <p>{event.tipo_evento === 'COM_ASSENTO' ? 'Com assentos' : 'Ingresso livre'}</p>
                  </div>
                </div>
              </div>

              {/* Políticas */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                {[
                  { label: 'Transferência', val: event.permite_transferencia },
                  { label: 'Cancelamento',  val: event.permite_cancelamento },
                  { label: 'Reembolso',     val: event.permite_reembolso },
                ].map(({ label, val }) => (
                  <span key={label}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                      val
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                        : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500 line-through'
                    }`}>
                    {val ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {label}
                  </span>
                ))}
              </div>
            </div>

            {/* Salas */}
            {sectors.length > 0 && (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-3">
                <h2 className="font-semibold text-slate-800 dark:text-slate-200">
                  Salas / Ambientes
                  <span className="ml-2 text-xs font-normal text-slate-400">{sectors.length} sala(s)</span>
                </h2>
                <div className="space-y-2">
                  {sectors.map((s: {
                    id: string; nome: string; andar: number;
                    rows_count: number; seats_per_row: number; quantidade: number;
                    preco: number; cor_hex: string;
                  }) => (
                    <div key={s.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-slate-700">
                      <div className="w-3 h-10 rounded-full shrink-0" style={{ backgroundColor: s.cor_hex }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{s.nome}</p>
                        <p className="text-xs text-slate-400">
                          Andar {s.andar} · {s.rows_count} fileiras × {s.seats_per_row} assentos = {s.quantidade} lugares
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          {s.preco > 0 ? `R$ ${Number(s.preco).toFixed(2)}` : 'Grátis'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-5">

            {/* Participantes */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-3">
              <h2 className="font-semibold text-slate-800 dark:text-slate-200">
                Participantes
                {participants.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-slate-400">{participants.length}</span>
                )}
              </h2>
              {participants.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum participante.</p>
              ) : (
                <div className="space-y-2">
                  {participants.map((p: { id: string; nome: string; papel: string; foto_url: string }) => (
                    <div key={p.id} className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full shrink-0 overflow-hidden bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                        {p.foto_url ? (
                          <img src={p.foto_url} alt={p.nome} className="w-full h-full object-cover" />
                        ) : (
                          <Users className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{p.nome}</p>
                        {p.papel && <p className="text-xs text-slate-400">{p.papel}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Ações rápidas */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-2">
              <h2 className="font-semibold text-slate-800 dark:text-slate-200 mb-3">Ações rápidas</h2>
              <button
                onClick={() => navigate(`/app-ui/app/orders?event_id=${id}`)}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-sm text-slate-700 dark:text-slate-300 text-left"
              >
                <Ticket className="w-4 h-4 text-purple-500" />
                Ver pedidos / ingressos
              </button>
              <button
                onClick={() => navigate(`/app-ui/app/checkin?event_id=${id}`)}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-sm text-slate-700 dark:text-slate-300 text-left"
              >
                <CheckCircle className="w-4 h-4 text-green-500" />
                Check-in
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
