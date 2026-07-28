/**
 * Análise do Cronograma — o "como está indo" da campanha.
 *
 * Apura os números reais (enviadas, responderam, erro, fila) por grupo e por
 * etapa, desenha isso em barras, e pede à IA um parecer EM CIMA desses números
 * — a IA recebe os totais prontos, nunca calcula estatística por conta.
 *
 * Fecha com a lista de quem recebeu e nunca respondeu: é a fila de resgate.
 */

import { useEffect, useState } from 'react';
import { Sparkles, Loader2, X, TrendingUp, AlertTriangle, PhoneOff, Printer } from 'lucide-react';
import { JOURNEY_PROFILE_COLORS, type JourneyProfile } from '../../lib/pastoralJourneyDefault';

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('mrm_token') ?? '' : '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

interface Bucket {
  enviadas: number;
  responderam: number;
  erros: number;
  fila: number;
  taxaResposta: number;
}

interface Stats {
  totalEnviadas: number;
  totalResponderam: number;
  taxaResposta: number;
  totalErros: number;
  totalFila: number;
  pessoas: number;
  porGrupo: Array<Bucket & { profile: string; label: string }>;
  porEtapa: Array<Bucket & { stepId: string; label: string; semana: number }>;
  semResposta: Array<{ name: string | null; phone: string; profile: string }>;
}

/** Barra horizontal simples — sem lib de gráfico, sem peso extra no bundle. */
function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex-1 min-w-[60px]">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export function JourneyAnalysisModal({
  filters,
  onClose,
}: {
  filters: { journeyId?: string; dateFrom?: string; dateTo?: string; churchId?: string | null };
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [parecer, setParecer] = useState('');
  const [erro, setErro] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/pastoral/journeys/analyze', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify(filters),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Falha ao analisar');
        setStats(data.stats);
        setParecer(data.parecer ?? '');
      } catch (e) {
        setErro(e instanceof Error ? e.message : 'Falha ao analisar');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxEtapa = Math.max(1, ...(stats?.porEtapa ?? []).map(e => e.enviadas));

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-200">
          <TrendingUp className="w-5 h-5 text-violet-600" />
          <h2 className="text-lg font-bold text-slate-900 flex-1">Análise do Cronograma</h2>
          <button
            onClick={() => window.print()}
            title="Imprimir a análise"
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex flex-col gap-5">
          {loading && (
            <div className="py-12 flex flex-col items-center gap-2 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-sm">Apurando os números e consultando a IA...</span>
            </div>
          )}

          {!loading && erro && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              {erro}
            </div>
          )}

          {!loading && stats && (
            <>
              {/* números-chave */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { label: 'Pessoas', value: stats.pessoas, color: 'text-slate-800' },
                  { label: 'Enviadas', value: stats.totalEnviadas, color: 'text-slate-800' },
                  { label: 'Responderam', value: stats.totalResponderam, color: 'text-emerald-600' },
                  { label: 'Taxa de resposta', value: `${stats.taxaResposta}%`, color: 'text-violet-600' },
                  { label: 'Erros', value: stats.totalErros, color: 'text-red-600' },
                ].map(c => (
                  <div key={c.label} className="rounded-xl border border-slate-200 px-3 py-2">
                    <div className={`text-xl font-bold ${c.color}`}>{c.value}</div>
                    <div className="text-[11px] text-slate-400">{c.label}</div>
                  </div>
                ))}
              </div>

              {/* por grupo */}
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-2">Desempenho por grupo</h3>
                <div className="flex flex-col gap-2">
                  {stats.porGrupo.map(g => (
                    <div key={g.profile} className="flex items-center gap-2 text-xs">
                      <span className="w-36 truncate font-medium" style={{ color: JOURNEY_PROFILE_COLORS[g.profile as JourneyProfile] }}>
                        {g.label}
                      </span>
                      <Bar value={g.responderam} max={Math.max(1, g.enviadas)}
                        color={JOURNEY_PROFILE_COLORS[g.profile as JourneyProfile] ?? '#8b5cf6'} />
                      <span className="w-40 text-right text-slate-500 tabular-nums">
                        {g.responderam}/{g.enviadas} · <b className="text-slate-700">{g.taxaResposta}%</b>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* por etapa */}
              <div>
                <h3 className="text-sm font-bold text-slate-700 mb-2">
                  Desempenho por etapa <span className="font-normal text-slate-400">— onde a campanha esfria</span>
                </h3>
                <div className="flex flex-col gap-1.5">
                  {stats.porEtapa.map(e => (
                    <div key={e.stepId} className="flex items-center gap-2 text-xs">
                      <span className="w-8 text-[10px] font-bold text-slate-400">S{e.semana}</span>
                      <span className="w-56 truncate text-slate-600" title={e.label}>{e.label}</span>
                      <Bar value={e.enviadas} max={maxEtapa} color="#cbd5e1" />
                      <span className="w-32 text-right text-slate-500 tabular-nums">
                        {e.enviadas} env · <b className={e.taxaResposta >= 20 ? 'text-emerald-600' : 'text-amber-600'}>
                          {e.taxaResposta}%
                        </b>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* parecer da IA */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <div className="flex items-center gap-1.5 font-bold text-amber-700 text-sm mb-2">
                  <Sparkles className="w-4 h-4" /> Parecer da IA
                </div>
                {parecer ? (
                  <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{parecer}</div>
                ) : (
                  <div className="text-sm text-slate-500">
                    IA indisponível no momento — os números acima continuam válidos.
                    Verifique a chave em Configurações → IA.
                  </div>
                )}
              </div>

              {/* fila de resgate */}
              {stats.semResposta.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                    <PhoneOff className="w-4 h-4 text-amber-500" />
                    Receberam e nunca responderam ({stats.semResposta.length})
                    <span className="font-normal text-slate-400">— prioridade de contato pessoal</span>
                  </h3>
                  <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-52 overflow-y-auto">
                    {stats.semResposta.map(p => (
                      <div key={p.phone} className="px-3 py-1.5 flex items-center gap-2 text-xs">
                        <span className="flex-1 truncate text-slate-700">{p.name ?? p.phone}</span>
                        <span className="text-slate-400">{p.phone}</span>
                        <a
                          href={`https://wa.me/${p.phone.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-600 font-semibold hover:underline"
                        >
                          abrir
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default JourneyAnalysisModal;
