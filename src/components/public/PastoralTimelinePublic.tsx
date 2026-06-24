import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router';
import { motion } from 'motion/react';
import { Calendar, Clock, CheckCircle2, User, Church, ArrowLeft, RefreshCw, AlertCircle, HeartHandshake } from 'lucide-react';
import { apiBase } from '../../lib/apiBase';

export default function PastoralTimelinePublic() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTimeline = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}/public/pastoral/timeline/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Atendimento não encontrado.');
        }
        throw new Error('Erro ao carregar a timeline.');
      }
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar a timeline.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeline();
  }, [id]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
      case 'todo':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">Aguardando Fila</span>;
      case 'doing':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">Em Atendimento</span>;
      case 'done':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20">Concluído</span>;
      case 'cancelled':
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">Cancelado</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-bold bg-slate-500/10 text-slate-400 border border-slate-500/20">{status}</span>;
    }
  };

  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case 'created':
        return <HeartHandshake className="w-5 h-5 text-emerald-400" />;
      case 'moved':
        return <RefreshCw className="w-5 h-5 text-amber-400" />;
      case 'completed':
      case 'done':
        return <CheckCircle2 className="w-5 h-5 text-green-400" />;
      default:
        return <Clock className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col font-sans relative overflow-hidden select-none">
      {/* Background decorations */}
      <div className="absolute top-[-10vh] left-[-10vw] w-[50vw] h-[50vh] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10vh] right-[-10vw] w-[50vw] h-[50vh] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="flex items-center justify-between p-6 max-w-4xl w-full mx-auto relative z-10 border-b border-white/5">
        <Link to="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-semibold">
          <ArrowLeft size={16} /> Home
        </Link>
        <img src="/adcampinas.png" alt="AD Campinas" className="w-10 h-10 rounded-full object-cover" />
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-12 relative z-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-3">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-slate-400 text-sm">Carregando timeline do atendimento...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center text-red-500">
              <AlertCircle size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Ops! Ocorreu um erro</h2>
              <p className="text-sm text-slate-400">{error}</p>
            </div>
            <button
              onClick={fetchTimeline}
              className="px-4 py-2 bg-slate-800 border border-white/10 hover:bg-slate-700 rounded-xl text-xs font-semibold transition-all"
            >
              Tentar Novamente
            </button>
          </div>
        ) : data ? (
          <div className="space-y-8">
            {/* Summary card */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 backdrop-blur-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold mb-1">{data.attendance.name}</h2>
                  <p className="text-slate-400 text-xs flex items-center gap-1">
                    <Church size={13} className="text-slate-500" /> {data.attendance.churchName}
                  </p>
                </div>
                <div>
                  {getStatusBadge(data.attendance.status)}
                </div>
              </div>

              {data.attendance.status === 'open' && (
                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="text-slate-400 text-xs">Sua posição atual na fila:</span>
                  <span className="text-emerald-400 font-extrabold text-base bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                    #{data.position}
                  </span>
                </div>
              )}
            </motion.div>

            {/* Timeline */}
            <div className="space-y-6">
              <h3 className="text-sm font-bold tracking-wider text-slate-400 uppercase">Evolução do Atendimento</h3>

              {data.timeline.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-white/5 rounded-2xl text-slate-500 text-sm">
                  Nenhuma movimentação registrada até o momento.
                </div>
              ) : (
                <div className="relative pl-6 border-l-2 border-white/5 space-y-8 ml-3">
                  {data.timeline.map((event: any, idx: number) => (
                    <motion.div
                      key={event.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.08 }}
                      className="relative"
                    >
                      {/* Timeline dot */}
                      <span className="absolute left-[-35px] top-1.5 w-6 h-6 rounded-full bg-[#0a0a0a] border border-white/10 flex items-center justify-center z-10 shadow-lg">
                        {getEventTypeIcon(event.event_type)}
                      </span>

                      <div className="bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors p-4 rounded-xl">
                        <p className="text-sm font-semibold text-slate-200">{event.description}</p>
                        <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1">
                          <Calendar size={11} /> {new Date(event.created_at).toLocaleDateString('pt-BR')} às{' '}
                          {new Date(event.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </main>

      <footer className="py-8 text-center text-[10px] text-slate-600 relative z-10 border-t border-white/5">
        AD Campinas &copy; {new Date().getFullYear()} &middot; Todos os direitos reservados.
      </footer>
    </div>
  );
}

// Inline Loader2 duplicate since it's used inside
function Loader2(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
