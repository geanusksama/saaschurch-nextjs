import { useEffect, useState } from "react";
import { Users, TrendingUp, DollarSign, Calendar, ArrowUp, ArrowDown, LayoutDashboard, GitBranch } from "lucide-react";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

import { apiBase } from '../../lib/apiBase';

function authFetch(url: string, opts: RequestInit = {}) {
  const token = localStorage.getItem("mrm_token");
  return fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...((opts.headers as Record<string, string>) || {}) },
  });
}

type DashData = {
  stats: {
    totalMembers: number;
    newMembersThisMonth: number;
    membersChangePct: number | null;
    newLeadsThisMonth: number;
    leadsChangePct: number | null;
    upcomingEventsCount: number;
    openCards: number;
  };
  attendanceChart: { name: string; presenca: number; visitantes: number }[];
  financeChart: { name: string; receita: number; despesa: number }[];
  ministryPie: { name: string; value: number; color: string }[];
  activities: { id: string; title: string; description: string; time: string }[];
  upcomingEvents: { id: string; name: string; startDate: string }[];
};

function fmtPct(v: number | null) {
  if (v === null) return null;
  return `${v > 0 ? "+" : ""}${v}%`;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Agora";
  if (m < 60) return `${m} min atrÃ¡s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrÃ¡s`;
  return `${Math.floor(h / 24)}d atrÃ¡s`;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded ${className}`} />;
}

export function Dashboard() {
  const [data, setData] = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    authFetch(`${apiBase}/dashboard`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const s = data?.stats;

  const statCards = [
    {
      name: "Total de Membros",
      value: loading ? null : s?.totalMembers?.toLocaleString("pt-BR") ?? "â€”",
      change: fmtPct(s?.membersChangePct ?? null),
      trend: (s?.membersChangePct ?? 0) >= 0 ? "up" : "down",
      icon: Users,
      color: "bg-blue-100",
      iconColor: "text-blue-600",
    },
    {
      name: "Novos Visitantes",
      value: loading ? null : String(s?.newLeadsThisMonth ?? "â€”"),
      change: fmtPct(s?.leadsChangePct ?? null),
      trend: (s?.leadsChangePct ?? 0) >= 0 ? "up" : "down",
      icon: TrendingUp,
      color: "bg-green-100",
      iconColor: "text-green-600",
    },
    {
      name: "Cards em Aberto",
      value: loading ? null : String(s?.openCards ?? "â€”"),
      change: null,
      trend: "up",
      icon: GitBranch,
      color: "bg-purple-100",
      iconColor: "text-purple-600",
    },
    {
      name: "Eventos PrÃ³ximos",
      value: loading ? null : String(s?.upcomingEventsCount ?? "â€”"),
      change: null,
      trend: "up",
      icon: Calendar,
      color: "bg-orange-100",
      iconColor: "text-orange-600",
    },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <LayoutDashboard className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
            <p className="text-slate-600 dark:text-slate-400">Bem-vindo de volta! Resumo da sua igreja.</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`${stat.color} w-12 h-12 rounded-lg flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${stat.iconColor}`} />
                </div>
                {stat.change !== null ? (
                  <div className={`flex items-center gap-1 text-sm font-semibold ${stat.trend === "up" ? "text-green-600" : "text-red-600"}`}>
                    {stat.trend === "up" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                    {stat.change}
                  </div>
                ) : null}
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-1">{stat.name}</p>
                {stat.value === null
                  ? <Skeleton className="h-8 w-24 mt-1" />
                  : <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                }
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* Attendance Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Membros e Visitantes (Ãºltimos 6 meses)</h3>
          {loading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data?.attendanceChart ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip />
                <Legend />
                <Bar dataKey="presenca" fill="#8b5cf6" name="Membros" radius={[8, 8, 0, 0]} />
                <Bar dataKey="visitantes" fill="#3b82f6" name="Visitantes" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Ministry Distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-6">DistribuiÃ§Ã£o por MinistÃ©rio</h3>
          {loading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (data?.ministryPie?.length ?? 0) === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-sm text-slate-400">Nenhum ministÃ©rio com membros</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data?.ministryPie}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  dataKey="value"
                >
                  {data?.ministryPie.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Finance Chart */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <h3 className="text-lg font-bold text-slate-900 mb-6">VisÃ£o Geral Financeira (Ãºltimos 6 meses)</h3>
        {loading ? (
          <Skeleton className="h-[300px] w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data?.financeChart ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip formatter={(value) => `R$ ${Number(value).toLocaleString("pt-BR")}`} />
              <Legend />
              <Line type="monotone" dataKey="receita" stroke="#10b981" strokeWidth={3} name="Receita" dot={false} />
              <Line type="monotone" dataKey="despesa" stroke="#ef4444" strokeWidth={3} name="Despesa" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Activities */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Atividades Recentes</h3>
          {loading ? (
            <div className="space-y-4">{[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : (data?.activities?.length ?? 0) === 0 ? (
            <div className="text-sm text-slate-400 py-8 text-center">Nenhuma atividade recente</div>
          ) : (
            <div className="space-y-4">
              {data?.activities.map((activity) => (
                <div key={activity.id} className="flex gap-4 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <div className="w-2 h-2 bg-purple-600 rounded-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-slate-900 text-sm truncate">{activity.title}</h4>
                    <p className="text-sm text-slate-600 truncate">{activity.description}</p>
                    <p className="text-xs text-slate-400 mt-1">{timeAgo(activity.time)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Events */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-bold text-slate-900 mb-6">PrÃ³ximos Eventos</h3>
          {loading ? (
            <div className="space-y-4">{[1,2,3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : (data?.upcomingEvents?.length ?? 0) === 0 ? (
            <div className="text-sm text-slate-400 py-8 text-center">Nenhum evento nos prÃ³ximos 30 dias</div>
          ) : (
            <div className="space-y-4">
              {data?.upcomingEvents.map((event) => {
                const d = new Date(event.startDate);
                return (
                  <div key={event.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                    <div className="text-center min-w-[40px]">
                      <div className="text-2xl font-bold text-purple-600">{d.getDate()}</div>
                      <div className="text-xs text-slate-600 uppercase">{d.toLocaleDateString("pt-BR", { month: "short" })}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-slate-900 text-sm truncate">{event.name}</h4>
                      <p className="text-xs text-slate-600">{d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
