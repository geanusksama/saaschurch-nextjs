import { Smartphone, Ticket, ShoppingCart, QrCode, Sun, UserPlus, LayoutGrid, RefreshCcw, TrendingUp, Heart } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';

function getStoredUser() {
  try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; }
}

function getHQContext() {
  const token = localStorage.getItem('mrm_token') ?? '';
  const user = getStoredUser();
  const activeFieldId = localStorage.getItem('mrm_active_field_id') || user.campoId || '';
  return { token, activeFieldId };
}

export default function AppDashboard() {
  const navigate = useNavigate();
  const user = getStoredUser();
  const churchId: string | undefined = user.churchId;
  const campoId: string | undefined = user.campoId;

  const { data: statsData } = useQuery({
    queryKey: ['app-dashboard-stats', churchId, campoId],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);

      // Buscar HQ para filtros que usam headquarters_id
      let hqId: string | null = null;
      try {
        const { token, activeFieldId } = getHQContext();
        if (activeFieldId) {
          const headers = token ? { Authorization: `Bearer ${token}` } : {};
          const res = await fetch(`/api/headquarters?fieldId=${activeFieldId}`, { headers });
          if (res.ok) {
            const list = await res.json();
            if (list.length) hqId = list[0].id;
          }
        }
      } catch { /* sem HQ */ }

      const [eventsRes, ordersRes, checkinRes, refundsRes, breadRes, registrationsRes, ministriesRes] = await Promise.all([
        // Eventos ativos (PUBLICADO)
        (() => {
          let q = supabase.from('app_events').select('id', { count: 'exact', head: true }).eq('status', 'PUBLICADO').is('deleted_at', null);
          if (churchId) q = q.eq('church_id', churchId);
          return q;
        })(),
        // Pedidos de hoje
        (() => {
          let q = supabase.from('event_orders').select('id', { count: 'exact', head: true }).gte('created_at', today);
          // Sem filtro direto de church_id em event_orders, filtramos via join
          return q;
        })(),
        // Check-ins de hoje
        supabase.from('event_qrcodes').select('id', { count: 'exact', head: true })
          .eq('is_used', true)
          .gte('used_at', today),
        // Reembolsos pendentes
        (() => {
          let q = supabase.from('event_refunds').select('id', { count: 'exact', head: true }).eq('status', 'SOLICITADO');
          return q;
        })(),
        // Pão diário (publicados)
        (() => {
          let q = supabase.from('app_daily_bread_entries').select('id', { count: 'exact', head: true }).eq('active', true);
          if (campoId) q = q.eq('campo_id', campoId);
          return q;
        })(),
        // Cadastros pendentes
        (() => {
          let q = supabase.from('app_cadastros').select('id', { count: 'exact', head: true }).eq('status', 'PENDENTE');
          if (hqId) q = q.eq('headquarters_id', hqId);
          return q;
        })(),
        // Ministérios ativos
        (() => {
          let q = supabase.from('ministries').select('id', { count: 'exact', head: true }).eq('is_active', true).is('deleted_at', null);
          if (churchId) q = q.eq('church_id', churchId);
          return q;
        })(),
      ]);

      return {
        eventos: eventsRes.count ?? 0,
        pedidos: ordersRes.count ?? 0,
        checkins: checkinRes.count ?? 0,
        reembolsos: refundsRes.count ?? 0,
        paoDiario: breadRes.count ?? 0,
        cadastros: registrationsRes.count ?? 0,
        ministerios: ministriesRes.count ?? 0,
      };
    },
    staleTime: 30_000,
  });

  const stats = [
    { label: 'Eventos Ativos',   value: statsData?.eventos ?? '—',      icon: Ticket,       color: 'bg-purple-100 text-purple-600',  path: '/app-ui/app/events' },
    { label: 'Pedidos Hoje',     value: statsData?.pedidos ?? '—',      icon: ShoppingCart, color: 'bg-blue-100 text-blue-600',      path: '/app-ui/app/orders' },
    { label: 'Check-ins Hoje',   value: statsData?.checkins ?? '—',     icon: QrCode,       color: 'bg-green-100 text-green-600',    path: '/app-ui/app/checkin' },
    { label: 'Reembolsos',       value: statsData?.reembolsos ?? '—',   icon: RefreshCcw,   color: 'bg-orange-100 text-orange-600',  path: '/app-ui/app/refunds' },
    { label: 'Pão Diário',       value: statsData?.paoDiario ?? '—',    icon: Sun,          color: 'bg-yellow-100 text-yellow-600',  path: '/app-ui/app/daily-bread' },
    { label: 'Ministérios',      value: statsData?.ministerios ?? '—',  icon: Heart,        color: 'bg-rose-100 text-rose-600',      path: '/app-ui/app/ministries' },
    { label: 'Cadastros Pend.',  value: statsData?.cadastros ?? '—',    icon: UserPlus,     color: 'bg-pink-100 text-pink-600',      path: '/app-ui/app/registrations' },
  ];

  const quickLinks = [
    { label: 'Novo Evento',             path: '/app-ui/app/events/new',      icon: Ticket },
    { label: 'Departamentos',           path: '/app-ui/app/departments',      icon: LayoutGrid },
    { label: 'Ministérios',             path: '/app-ui/app/ministries',       icon: Heart },
    { label: 'Nova Entrada Pão Diário', path: '/app-ui/app/daily-bread',      icon: Sun },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
          <Smartphone className="w-6 h-6 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard App Móvel</h1>
          <p className="text-slate-500 dark:text-slate-400">Visão geral do módulo de gerenciamento do app</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.label}
              onClick={() => navigate(s.path)}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 text-left hover:shadow-md transition-shadow"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{s.label}</p>
            </button>
          );
        })}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Ações Rápidas
        </h2>
        <div className="flex flex-wrap gap-3">
          {quickLinks.map((l) => {
            const Icon = l.icon;
            return (
              <button
                key={l.label}
                onClick={() => navigate(l.path)}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300 transition text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                <Icon className="w-4 h-4" />
                {l.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
