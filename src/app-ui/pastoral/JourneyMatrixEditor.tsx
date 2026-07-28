/**
 * Matriz do Cronograma de Acompanhamento.
 *
 * É a tabela do documento virada em tela editável: cada linha é uma etapa
 * (momento · canal · programação · quando disparar) e cada etapa guarda três
 * mensagens, uma por grupo de chegada. É daqui que o cron tira o que enviar.
 *
 * Também é aqui que se escolhem as instâncias de WhatsApp orquestradas no
 * disparo, o ritmo entre mensagens e a janela de horário — o que permite
 * distribuir milhares de envios sem concentrar tudo em um número só.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  CalendarClock,
  Plus,
  Loader2,
  Save,
  Trash2,
  ChevronDown,
  ChevronRight,
  Smartphone,
  Settings2,
  Clock,
  AlertTriangle,
  RefreshCw,
  CheckSquare,
  Square,
  Radar,
  Sparkles,
  MonitorPlay,
  Camera,
  Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  JOURNEY_PROFILES,
  JOURNEY_PROFILE_LABELS,
  JOURNEY_PROFILE_COLORS,
  WEEKDAY_LABELS,
  type JourneyProfile,
} from '../../lib/pastoralJourneyDefault';
import { getCurrentChurchId } from '../../lib/pastoralKanbanService';
import { useWhatsAppInstances } from '../../hooks/useWhatsAppInstances';
import { ConfirmDialog } from '../../components/app-ui/shared/ConfirmDialog';

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('mrm_token') ?? '' : '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

interface JourneySummary {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  interval_seconds: number;
  window_start: string;
  window_end: string;
  daily_limit_per_instance: number;
  auto_enroll: boolean;
  auto_enroll_column_key: string;
  stop_on_done: boolean;
  max_per_person_per_day: number;
  ai_polish: boolean;
  ai_agent_id: string | null;
  stepCount: number;
  activeEnrollments: number;
  pendingSends: number;
  sentSends: number;
}

interface StepMessage {
  id: string;
  step_id: string;
  profile: JourneyProfile;
  message: string;
  image_url: string | null;
  link_url: string | null;
  youtube_url: string | null;
  instagram_url: string | null;
  is_active: boolean;
}

interface Step {
  id: string;
  position: number;
  code: string | null;
  moment_label: string;
  channel: string;
  program_label: string | null;
  week_number: number;
  weekday: number | null;
  min_offset_days: number;
  send_time: string;
  is_active: boolean;
  messages: StepMessage[];
}

/** Descreve em português quando a etapa dispara, para conferência rápida. */
function scheduleSummary(step: Step): string {
  const base =
    step.weekday === null
      ? `${step.min_offset_days} dia(s) após o acolhimento`
      : `${WEEKDAY_LABELS[step.weekday]} da semana ${step.week_number}` +
        (step.min_offset_days ? ` (mín. +${step.min_offset_days}d)` : '');
  return `${base} · ${String(step.send_time).slice(0, 5)}`;
}

export default function JourneyMatrixEditor() {
  const churchId = getCurrentChurchId();
  const { instances } = useWhatsAppInstances();

  const [journeys, setJourneys] = useState<JourneySummary[]>([]);
  const [journeyId, setJourneyId] = useState('');
  const [steps, setSteps] = useState<Step[]>([]);
  const [instanceIds, setInstanceIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSteps, setLoadingSteps] = useState(false);
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [savingStep, setSavingStep] = useState<string | null>(null);
  const [confirmDeleteStep, setConfirmDeleteStep] = useState<Step | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  // personas disponíveis para o polimento por IA
  const [agents, setAgents] = useState<Array<{ id: string; name: string }>>([]);

  const journey = journeys.find(j => j.id === journeyId) ?? null;

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/ai/agents', { headers: authHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        setAgents(
          (Array.isArray(data) ? data : [])
            .filter((a: { isActive: boolean }) => a.isActive)
            .map((a: { id: string; name: string }) => ({ id: a.id, name: a.name }))
        );
      } catch { /* sem agentes cadastrados */ }
    })();
  }, []);

  const loadJourneys = useCallback(async () => {
    setLoading(true);
    try {
      const params = churchId ? `?churchId=${churchId}` : '';
      const res = await fetch(`/api/pastoral/journeys${params}`, { headers: authHeaders() });
      const data = await res.json();
      const list: JourneySummary[] = data.journeys ?? [];
      setJourneys(list);
      setJourneyId(prev => (prev && list.some(j => j.id === prev) ? prev : list[0]?.id ?? ''));
    } catch {
      setJourneys([]);
    } finally {
      setLoading(false);
    }
  }, [churchId]);

  useEffect(() => {
    loadJourneys();
  }, [loadJourneys]);

  const loadSteps = useCallback(async () => {
    if (!journeyId) {
      setSteps([]);
      return;
    }
    setLoadingSteps(true);
    try {
      const res = await fetch(`/api/pastoral/journeys/${journeyId}`, { headers: authHeaders() });
      const data = await res.json();
      setSteps(data.steps ?? []);
      setInstanceIds(data.instanceIds ?? []);
    } catch {
      setSteps([]);
    } finally {
      setLoadingSteps(false);
    }
  }, [journeyId]);

  useEffect(() => {
    loadSteps();
  }, [loadSteps]);

  // ── cronograma ──────────────────────────────────────────────────────────────

  const createJourney = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch('/api/pastoral/journeys', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ churchId, seed: true }),
      });
      const data = await res.json();
      if (!res.ok && res.status !== 207) throw new Error(data.error ?? 'Falha ao criar cronograma');
      toast.success('Cronograma criado com a matriz padrão do 1º mês');
      await loadJourneys();
      if (data.journey?.id) setJourneyId(data.journey.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao criar cronograma');
    } finally {
      setCreating(false);
    }
  };

  const patchJourney = async (patch: Record<string, unknown>) => {
    if (!journeyId) return;
    try {
      const res = await fetch(`/api/pastoral/journeys/${journeyId}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Falha ao salvar');
      toast.success('Configuração salva');
      await loadJourneys();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar');
    }
  };

  const toggleInstance = (id: string) => {
    setInstanceIds(prev => (prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]));
  };

  // ── etapas ──────────────────────────────────────────────────────────────────

  const patchLocalStep = (stepId: string, patch: Partial<Step>) => {
    setSteps(prev => prev.map(s => (s.id === stepId ? { ...s, ...patch } : s)));
  };

  const patchLocalMessage = (
    stepId: string,
    profile: JourneyProfile,
    patch: Partial<StepMessage>
  ) => {
    setSteps(prev =>
      prev.map(s =>
        s.id !== stepId
          ? s
          : {
              ...s,
              messages: JOURNEY_PROFILES.map(p => {
                const existing = s.messages.find(m => m.profile === p);
                const base: StepMessage = existing ?? {
                  id: `new_${p}`,
                  step_id: s.id,
                  profile: p,
                  message: '',
                  image_url: null,
                  link_url: null,
                  youtube_url: null,
                  instagram_url: null,
                  is_active: true,
                };
                return p === profile ? { ...base, ...patch } : base;
              }),
            }
      )
    );
  };

  const saveStep = async (step: Step) => {
    setSavingStep(step.id);
    try {
      const res = await fetch(`/api/pastoral/journeys/${journeyId}/steps`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: JSON.stringify({
          stepId: step.id,
          momentLabel: step.moment_label,
          channel: step.channel,
          programLabel: step.program_label,
          weekNumber: step.week_number,
          weekday: step.weekday,
          minOffsetDays: step.min_offset_days,
          sendTime: step.send_time,
          isActive: step.is_active,
          messages: Object.fromEntries(
            JOURNEY_PROFILES.map(p => {
              const m = step.messages.find(x => x.profile === p);
              return [p, {
                message: m?.message ?? '',
                imageUrl: m?.image_url ?? null,
                youtubeUrl: m?.youtube_url ?? null,
                instagramUrl: m?.instagram_url ?? null,
                linkUrl: m?.link_url ?? null,
              }];
            })
          ),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Falha ao salvar etapa');
      toast.success(
        data.updatedPending
          ? `Etapa salva · ${data.updatedPending} envio(s) pendente(s) reagendado(s)`
          : 'Etapa salva'
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao salvar etapa');
    } finally {
      setSavingStep(null);
    }
  };

  const addStep = async () => {
    try {
      const res = await fetch(`/api/pastoral/journeys/${journeyId}/steps`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ momentLabel: 'Nova etapa', channel: 'WhatsApp', weekNumber: 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Falha ao criar etapa');
      await loadSteps();
      setExpanded(data.step?.id ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao criar etapa');
    }
  };

  const deleteStep = async () => {
    if (!confirmDeleteStep) return;
    try {
      const res = await fetch(
        `/api/pastoral/journeys/${journeyId}/steps?stepId=${confirmDeleteStep.id}`,
        { method: 'DELETE', headers: authHeaders() }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Falha ao excluir etapa');
      setConfirmDeleteStep(null);
      await loadSteps();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao excluir etapa');
    }
  };

  // ── render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!journeys.length) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <CalendarClock className="w-10 h-10 text-violet-400 mx-auto mb-3" />
        <h3 className="font-bold text-slate-800 mb-1">Nenhum cronograma cadastrado</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">
          Crie o Cronograma de Acompanhamento do 1º mês. Ele já vem com as 13 etapas do documento
          preenchidas para os três grupos — Novo Convertido, Reconciliado e Vindo de Outra Igreja —
          e pode ser editado etapa por etapa depois.
        </p>
        <button
          onClick={createJourney}
          disabled={creating}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Criar cronograma padrão
        </button>
      </div>
    );
  }

  const connected = instances.filter(i => i.status === 'connected');

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* barra do cronograma */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
          <label className="text-xs font-medium text-slate-500">Cronograma</label>
          <select
            value={journeyId}
            onChange={e => setJourneyId(e.target.value)}
            className="h-9 px-2 rounded-lg border border-slate-200 text-sm bg-white"
          >
            {journeys.map(j => (
              <option key={j.id} value={j.id}>
                {j.name}
              </option>
            ))}
          </select>
        </div>
        {journey && (
          <div className="flex items-center gap-3 text-xs text-slate-500 pb-2">
            <span>
              <b className="text-slate-700">{journey.stepCount}</b> etapas
            </span>
            <span>
              <b className="text-emerald-600">{journey.activeEnrollments}</b> em acompanhamento
            </span>
            <span>
              <b className="text-amber-600">{journey.pendingSends}</b> na fila
            </span>
            <span>
              <b className="text-slate-700">{journey.sentSends}</b> enviadas
            </span>
          </div>
        )}
        <button
          onClick={() => setShowSettings(v => !v)}
          className="h-9 px-3 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium inline-flex items-center gap-2 hover:bg-slate-50"
        >
          <Settings2 className="w-4 h-4" />
          Instâncias e ritmo
        </button>
        <button
          onClick={loadSteps}
          className="h-9 w-9 rounded-lg border border-slate-200 hover:bg-slate-50 inline-flex items-center justify-center"
        >
          <RefreshCw className="w-4 h-4 text-slate-400" />
        </button>
        <button
          onClick={createJourney}
          disabled={creating}
          className="h-9 px-3 rounded-lg bg-slate-800 text-white text-sm font-medium inline-flex items-center gap-2 hover:bg-slate-700 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Novo cronograma
        </button>
      </div>

      {/* instâncias orquestradas + ritmo — tudo numa faixa só, para não
          empurrar a lista de etapas para fora da tela */}
      {showSettings && journey && (
        <div className="bg-white rounded-xl border border-slate-200 px-3 py-2.5 flex flex-col gap-2">
          <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
            {/* instâncias: marcar/desmarcar uma, algumas ou todas */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                <Smartphone className="w-3 h-3" />
                Instâncias no disparo
                {connected.length > 0 && (
                  <>
                    <button
                      onClick={() => setInstanceIds(connected.map(i => i.id))}
                      className="text-[10px] font-semibold text-violet-600 hover:underline ml-1"
                    >
                      todas
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      onClick={() => setInstanceIds([])}
                      className="text-[10px] font-semibold text-slate-400 hover:underline"
                    >
                      nenhuma
                    </button>
                  </>
                )}
              </label>
              <div className="flex flex-wrap items-center gap-1.5 min-h-[36px]">
                {!connected.length && (
                  <span className="text-xs text-amber-600 inline-flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Nenhuma instância conectada
                  </span>
                )}
                {connected.map(i => {
                  const on = instanceIds.includes(i.id);
                  return (
                    <button
                      key={i.id}
                      onClick={() => toggleInstance(i.id)}
                      title={on ? 'Marcada — clique para desmarcar' : 'Clique para marcar'}
                      className={`h-9 px-2.5 rounded-lg text-xs font-semibold border inline-flex items-center gap-1.5 transition-colors ${
                        on
                          ? 'bg-violet-600 border-violet-600 text-white hover:bg-violet-700'
                          : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {on ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                      {i.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Intervalo (s)</label>
              <input
                type="number"
                min={5}
                defaultValue={journey.interval_seconds}
                title="Mínimo 5 s — é o que protege o número de banimento"
                onChange={e =>
                  setJourneys(prev =>
                    prev.map(j =>
                      j.id === journeyId ? { ...j, interval_seconds: Number(e.target.value) } : j
                    )
                  )
                }
                className="w-[90px] h-9 px-2 rounded-lg border border-slate-200 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Janela</label>
              <div className="flex items-center gap-1">
                <input
                  type="time"
                  defaultValue={String(journey.window_start).slice(0, 5)}
                  onChange={e =>
                    setJourneys(prev =>
                      prev.map(j => (j.id === journeyId ? { ...j, window_start: e.target.value } : j))
                    )
                  }
                  className="w-[110px] h-9 px-2 rounded-lg border border-slate-200 text-sm"
                />
                <span className="text-xs text-slate-400">às</span>
                <input
                  type="time"
                  defaultValue={String(journey.window_end).slice(0, 5)}
                  onChange={e =>
                    setJourneys(prev =>
                      prev.map(j => (j.id === journeyId ? { ...j, window_end: e.target.value } : j))
                    )
                  }
                  className="w-[110px] h-9 px-2 rounded-lg border border-slate-200 text-sm"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Teto diário</label>
              <input
                type="number"
                min={0}
                defaultValue={journey.daily_limit_per_instance}
                title="Máximo de mensagens por instância por dia. 0 = sem teto"
                onChange={e =>
                  setJourneys(prev =>
                    prev.map(j =>
                      j.id === journeyId
                        ? { ...j, daily_limit_per_instance: Number(e.target.value) }
                        : j
                    )
                  )
                }
                className="w-[90px] h-9 px-2 rounded-lg border border-slate-200 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500" title="Máximo de mensagens que UMA pessoa recebe por dia. 1 evita rajada quando duas etapas vencem juntas.">
                Máx./pessoa/dia
              </label>
              <input
                type="number"
                min={0}
                defaultValue={journey.max_per_person_per_day}
                onChange={e =>
                  setJourneys(prev =>
                    prev.map(j =>
                      j.id === journeyId
                        ? { ...j, max_per_person_per_day: Number(e.target.value) }
                        : j
                    )
                  )
                }
                className="w-[90px] h-9 px-2 rounded-lg border border-slate-200 text-sm"
              />
            </div>

            <button
              onClick={() =>
                patchJourney({
                  instanceIds,
                  intervalSeconds: journey.interval_seconds,
                  windowStart: journey.window_start,
                  windowEnd: journey.window_end,
                  dailyLimitPerInstance: journey.daily_limit_per_instance,
                  maxPerPersonPerDay: journey.max_per_person_per_day,
                  autoEnroll: journey.auto_enroll,
                  autoEnrollColumnKey: journey.auto_enroll_column_key,
                  stopOnDone: journey.stop_on_done,
                  aiPolish: journey.ai_polish,
                  aiAgentId: journey.ai_agent_id,
                })
              }
              className="h-9 px-4 rounded-lg bg-violet-600 text-white text-sm font-semibold inline-flex items-center gap-2 hover:bg-violet-700 ml-auto"
            >
              <Save className="w-4 h-4" />
              Salvar
            </button>
          </div>

          {/* automação: varredura da coluna, encerramento e IA */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 border-t border-slate-100">
            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={journey.auto_enroll}
                onChange={e =>
                  setJourneys(prev =>
                    prev.map(j => (j.id === journeyId ? { ...j, auto_enroll: e.target.checked } : j))
                  )
                }
                className="w-4 h-4 rounded border-slate-300"
              />
              <Radar className="w-3.5 h-3.5 text-violet-500" />
              Adotar sozinho quem entrar na coluna
            </label>
            <select
              value={journey.auto_enroll_column_key}
              disabled={!journey.auto_enroll}
              onChange={e =>
                setJourneys(prev =>
                  prev.map(j =>
                    j.id === journeyId ? { ...j, auto_enroll_column_key: e.target.value } : j
                  )
                )
              }
              className="h-8 px-2 rounded-lg border border-slate-200 text-xs bg-white disabled:opacity-40"
            >
              <option value="todo">POR FAZER</option>
              <option value="doing">FAZENDO</option>
            </select>

            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={journey.stop_on_done}
                onChange={e =>
                  setJourneys(prev =>
                    prev.map(j => (j.id === journeyId ? { ...j, stop_on_done: e.target.checked } : j))
                  )
                }
                className="w-4 h-4 rounded border-slate-300"
              />
              Encerrar ao concluir/cancelar o card
            </label>

            <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={journey.ai_polish}
                onChange={e =>
                  setJourneys(prev =>
                    prev.map(j => (j.id === journeyId ? { ...j, ai_polish: e.target.checked } : j))
                  )
                }
                className="w-4 h-4 rounded border-slate-300"
              />
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Polir a mensagem com IA antes de enviar
            </label>
            <select
              value={journey.ai_agent_id ?? ''}
              disabled={!journey.ai_polish}
              onChange={e =>
                setJourneys(prev =>
                  prev.map(j => (j.id === journeyId ? { ...j, ai_agent_id: e.target.value || null } : j))
                )
              }
              className="h-8 px-2 rounded-lg border border-slate-200 text-xs bg-white disabled:opacity-40 max-w-[190px]"
            >
              <option value="">Sem persona (tom padrão)</option>
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <p className="text-[11px] text-slate-400">
            O envio alterna entre as instâncias marcadas, respeitando o cooldown de cada número —
            marcar mais é o que permite dar conta de milhares de pessoas sem passar o dia enviando
            por um número só. Sem nenhuma marcada, o cron usa todas as conectadas. A varredura só
            adota cards com <b>grupo classificado</b> e telefone válido, contando a jornada a partir
            da data de criação do card (quem chegou domingo continua na semana certa, mesmo movido
            na terça). A IA reescreve mais curto mantendo sentido e versículo; se falhar, vai o texto
            da matriz.
          </p>
        </div>
      )}

      {/* etapas */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col min-h-[300px] overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2 text-sm">
          <CalendarClock className="w-4 h-4 text-slate-400" />
          <span className="font-semibold text-slate-700">
            {steps.length} etapa{steps.length === 1 ? '' : 's'} · 3 grupos por etapa
          </span>
          <button
            onClick={addStep}
            className="ml-auto h-8 px-3 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-50"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova etapa
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {loadingSteps && (
            <div className="p-6 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          )}

          {!loadingSteps &&
            steps.map((step, index) => {
              const open = expanded === step.id;
              return (
                <div key={step.id} className={step.is_active ? '' : 'opacity-60'}>
                  <button
                    onClick={() => setExpanded(open ? null : step.id)}
                    className="w-full px-3 py-2.5 flex items-center gap-2 text-left hover:bg-slate-50"
                  >
                    {open ? (
                      <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                    <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-500 text-xs font-bold inline-flex items-center justify-center flex-shrink-0">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-700 truncate">
                        {step.moment_label}
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        {step.channel}
                        {step.program_label ? ` · ${step.program_label}` : ''}
                      </div>
                    </div>
                    <span className="text-[11px] text-slate-400 inline-flex items-center gap-1 flex-shrink-0">
                      <Clock className="w-3 h-3" />
                      {scheduleSummary(step)}
                    </span>
                  </button>

                  {open && (
                    <div className="px-4 pb-4 pt-1 bg-slate-50/60 flex flex-col gap-3">
                      {/* metadados + agendamento + ações numa faixa só: sobra
                          espaço vertical para as três mensagens, que é o que
                          realmente se edita aqui */}
                      <div className="flex flex-wrap items-end gap-x-2 gap-y-2">
                        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                          <label className="text-xs font-medium text-slate-500">Momento</label>
                          <input
                            value={step.moment_label}
                            onChange={e => patchLocalStep(step.id, { moment_label: e.target.value })}
                            className="w-full h-9 px-2 rounded-lg border border-slate-200 text-sm bg-white"
                          />
                        </div>
                        <div className="flex flex-col gap-1 w-[150px]">
                          <label className="text-xs font-medium text-slate-500">Canal</label>
                          <input
                            value={step.channel}
                            onChange={e => patchLocalStep(step.id, { channel: e.target.value })}
                            className="w-full h-9 px-2 rounded-lg border border-slate-200 text-sm bg-white"
                          />
                        </div>
                        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                          <label className="text-xs font-medium text-slate-500">Programação</label>
                          <input
                            value={step.program_label ?? ''}
                            onChange={e => patchLocalStep(step.id, { program_label: e.target.value })}
                            className="w-full h-9 px-2 rounded-lg border border-slate-200 text-sm bg-white"
                          />
                        </div>
                        <div className="flex flex-col gap-1 w-[95px]">
                          <label className="text-xs font-medium text-slate-500">Semana</label>
                          <select
                            value={step.week_number}
                            onChange={e => patchLocalStep(step.id, { week_number: Number(e.target.value) })}
                            className="w-full h-9 px-1.5 rounded-lg border border-slate-200 text-sm bg-white"
                          >
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(w => (
                              <option key={w} value={w}>{w}ª</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1 w-[140px]">
                          <label className="text-xs font-medium text-slate-500">Dia</label>
                          <select
                            value={step.weekday === null ? '' : String(step.weekday)}
                            onChange={e =>
                              patchLocalStep(step.id, {
                                weekday: e.target.value === '' ? null : Number(e.target.value),
                              })
                            }
                            className="w-full h-9 px-1.5 rounded-lg border border-slate-200 text-sm bg-white"
                          >
                            <option value="">Dias corridos</option>
                            {WEEKDAY_LABELS.map((label, i) => (
                              <option key={i} value={i}>{label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1 w-[70px]">
                          <label className="text-xs font-medium text-slate-500" title="Piso de dias após o acolhimento antes de procurar o dia da semana">
                            Mín. dias
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={step.min_offset_days}
                            onChange={e => patchLocalStep(step.id, { min_offset_days: Number(e.target.value) })}
                            className="w-full h-9 px-2 rounded-lg border border-slate-200 text-sm bg-white"
                          />
                        </div>
                        <div className="flex flex-col gap-1 w-[105px]">
                          <label className="text-xs font-medium text-slate-500">Horário</label>
                          <input
                            type="time"
                            value={String(step.send_time).slice(0, 5)}
                            onChange={e => patchLocalStep(step.id, { send_time: e.target.value })}
                            className="w-full h-9 px-2 rounded-lg border border-slate-200 text-sm bg-white"
                          />
                        </div>

                        <label className="h-9 flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer px-1">
                          <input
                            type="checkbox"
                            checked={step.is_active}
                            onChange={e => patchLocalStep(step.id, { is_active: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-300"
                          />
                          Ativa
                        </label>
                        <button
                          onClick={() => setConfirmDeleteStep(step)}
                          title="Excluir etapa"
                          className="h-9 w-9 rounded-lg border border-red-200 text-red-600 inline-flex items-center justify-center hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => saveStep(step)}
                          disabled={savingStep === step.id}
                          className="h-9 px-4 rounded-lg bg-violet-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-violet-700 disabled:opacity-50"
                        >
                          {savingStep === step.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Save className="w-3.5 h-3.5" />
                          )}
                          Salvar
                        </button>
                      </div>

                      <p className="text-[11px] text-slate-400 -mt-1">
                        Dispara em <b>{scheduleSummary(step)}</b> — sempre contado a partir do dia do
                        acolhimento de cada pessoa.
                      </p>

                      {/* as 3 mensagens */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                        {JOURNEY_PROFILES.map(profile => {
                          const msg = step.messages.find(m => m.profile === profile);
                          return (
                            <div key={profile} className="flex flex-col gap-1">
                              <label
                                className="text-xs font-bold uppercase tracking-wide"
                                style={{ color: JOURNEY_PROFILE_COLORS[profile] }}
                              >
                                {JOURNEY_PROFILE_LABELS[profile]}
                              </label>
                              <textarea
                                value={msg?.message ?? ''}
                                onChange={e => patchLocalMessage(step.id, profile, { message: e.target.value })}
                                rows={7}
                                placeholder="Mensagem enviada a este grupo nesta etapa. Deixe vazio para não enviar."
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white resize-y"
                              />
                              {/* anexos opcionais: a imagem vai como anexo com
                                  o texto de legenda; os links entram no rodapé */}
                              <div className="flex flex-col gap-1">
                                <div className="relative">
                                  <MonitorPlay className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-red-500" />
                                  <input
                                    value={msg?.youtube_url ?? ''}
                                    onChange={e => patchLocalMessage(step.id, profile, { youtube_url: e.target.value })}
                                    placeholder="Link do vídeo no YouTube (opcional)"
                                    className="w-full h-8 pl-7 pr-2 text-xs border border-slate-200 rounded-lg bg-white"
                                  />
                                </div>
                                <div className="relative">
                                  <Camera className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-pink-500" />
                                  <input
                                    value={msg?.instagram_url ?? ''}
                                    onChange={e => patchLocalMessage(step.id, profile, { instagram_url: e.target.value })}
                                    placeholder="Link do vídeo/post no Instagram (opcional)"
                                    className="w-full h-8 pl-7 pr-2 text-xs border border-slate-200 rounded-lg bg-white"
                                  />
                                </div>
                                <div className="relative">
                                  <ImageIcon className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-sky-500" />
                                  <input
                                    value={msg?.image_url ?? ''}
                                    onChange={e => patchLocalMessage(step.id, profile, { image_url: e.target.value })}
                                    placeholder="Link da imagem — vai como anexo (opcional)"
                                    className="w-full h-8 pl-7 pr-2 text-xs border border-slate-200 rounded-lg bg-white"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

          {!loadingSteps && !steps.length && (
            <div className="p-8 text-center text-sm text-slate-400">
              Este cronograma está sem etapas. Use &quot;Nova etapa&quot; para montar a matriz.
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmDeleteStep}
        title="Excluir esta etapa?"
        message={`"${confirmDeleteStep?.moment_label ?? ''}" será removida da matriz, junto com as mensagens dos 3 grupos e os envios dela que ainda não saíram. O que já foi enviado permanece no histórico.`}
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={deleteStep}
        onCancel={() => setConfirmDeleteStep(null)}
      />
    </div>
  );
}
