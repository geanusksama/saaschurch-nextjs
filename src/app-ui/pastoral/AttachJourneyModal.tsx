/**
 * Anexar Cronograma de Acompanhamento a um ou vários atendimentos.
 *
 * Aberto pelo menu ⋯ do card (uma pessoa) ou da coluna (todos os cards dela).
 * Aqui se define o grupo de chegada — Novo Convertido, Reconciliado ou Vindo de
 * Outra Igreja — que é o que decide qual coluna de mensagens da matriz a pessoa
 * vai receber. Ao confirmar, a agenda inteira do 1º mês é calculada a partir do
 * dia do acolhimento e o cron passa a disparar sozinho.
 */

import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Loader2, X, AlertTriangle, Check, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  JOURNEY_PROFILES,
  JOURNEY_PROFILE_LABELS,
  JOURNEY_PROFILE_COLORS,
  type JourneyProfile,
} from '../../lib/pastoralJourneyDefault';
import { getCurrentChurchId, type PastoralAttendance } from '../../lib/pastoralKanbanService';

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('mrm_token') ?? '' : '';
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

interface JourneyOption {
  id: string;
  name: string;
  stepCount: number;
  is_active: boolean;
}

export function AttachJourneyModal({
  cards,
  title,
  onClose,
  onDone,
}: {
  cards: PastoralAttendance[];
  title?: string;
  onClose: () => void;
  onDone?: () => void;
}) {
  const churchId = getCurrentChurchId();
  const [journeys, setJourneys] = useState<JourneyOption[]>([]);
  const [journeyId, setJourneyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sendFirstNow, setSendFirstNow] = useState(true);

  // perfil por pessoa; começa no que o card já tiver gravado
  const [profiles, setProfiles] = useState<Record<string, JourneyProfile>>(() =>
    Object.fromEntries(
      cards.map(c => [c.id, (c.person_profile as JourneyProfile) ?? 'novo_convertido'])
    )
  );

  const withPhone = useMemo(
    () => cards.filter(c => String(c.phone ?? '').replace(/\D/g, '').length >= 10),
    [cards]
  );
  const withoutPhone = cards.length - withPhone.length;

  useEffect(() => {
    (async () => {
      try {
        const params = churchId ? `?churchId=${churchId}` : '';
        const res = await fetch(`/api/pastoral/journeys${params}`, { headers: authHeaders() });
        const data = await res.json();
        const list: JourneyOption[] = (data.journeys ?? []).filter((j: JourneyOption) => j.is_active);
        setJourneys(list);
        if (list.length) setJourneyId(list[0].id);
      } catch {
        setJourneys([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [churchId]);

  const setAllProfiles = (profile: JourneyProfile) => {
    setProfiles(Object.fromEntries(cards.map(c => [c.id, profile])));
  };

  const personName = (card: PastoralAttendance) =>
    card.members?.full_name || card.visitor_name || card.title || 'Sem identificação';

  const submit = async () => {
    if (!journeyId || saving || !withPhone.length) return;
    setSaving(true);
    try {
      const res = await fetch('/api/pastoral/journeys/enroll', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          journeyId,
          sendFirstNow,
          items: withPhone.map(c => ({
            attendanceId: c.id,
            profile: profiles[c.id] ?? 'novo_convertido',
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Falha ao anexar o cronograma');

      const total = (data.enrolled ?? []).reduce(
        (acc: number, e: { scheduled: number }) => acc + e.scheduled,
        0
      );
      toast.success(
        `${data.enrolled?.length ?? 0} pessoa(s) no cronograma · ${total} mensagem(ns) agendada(s)`
      );
      if (data.skipped?.length) {
        toast.warning(`${data.skipped.length} não entraram (sem telefone ou já encerradas)`);
      }
      onDone?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao anexar o cronograma');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-200">
          <CalendarClock className="w-5 h-5 text-violet-600" />
          <h2 className="text-lg font-bold text-slate-900 flex-1">
            {title ?? 'Anexar cronograma de acompanhamento'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
            </div>
          ) : !journeys.length ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                Nenhum cronograma cadastrado ainda. Abra a aba <b>Cronograma → Matriz</b> e crie o
                cronograma padrão (ele já vem com as 13 etapas do 1º mês preenchidas).
              </div>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">Cronograma</label>
                <select
                  value={journeyId}
                  onChange={e => setJourneyId(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 bg-white"
                >
                  {journeys.map(j => (
                    <option key={j.id} value={j.id}>
                      {j.name} ({j.stepCount} etapas)
                    </option>
                  ))}
                </select>
              </div>

              {/* atalho de classificação em lote */}
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Aplicar o mesmo grupo a todos
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {JOURNEY_PROFILES.map(p => (
                    <button
                      key={p}
                      onClick={() => setAllProfiles(p)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors hover:bg-slate-50"
                      style={{ borderColor: `${JOURNEY_PROFILE_COLORS[p]}55`, color: JOURNEY_PROFILE_COLORS[p] }}
                    >
                      {JOURNEY_PROFILE_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>

              {/* lista de pessoas com o grupo de cada uma */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
                  <Users className="w-3.5 h-3.5" />
                  {withPhone.length} pessoa(s) entrarão no cronograma
                  {withoutPhone > 0 && (
                    <span className="text-amber-600 font-medium">
                      · {withoutPhone} sem telefone (não entram)
                    </span>
                  )}
                </div>
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {cards.map(card => {
                    const phone = String(card.phone ?? '').replace(/\D/g, '');
                    const valid = phone.length >= 10;
                    return (
                      <div key={card.id} className="flex items-center gap-2 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <div className={`text-sm truncate ${valid ? 'text-slate-700' : 'text-slate-400 line-through'}`}>
                            {personName(card)}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {valid ? phone : 'sem telefone válido'}
                          </div>
                        </div>
                        <select
                          value={profiles[card.id] ?? 'novo_convertido'}
                          disabled={!valid}
                          onChange={e =>
                            setProfiles(prev => ({ ...prev, [card.id]: e.target.value as JourneyProfile }))
                          }
                          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white disabled:opacity-40"
                        >
                          {JOURNEY_PROFILES.map(p => (
                            <option key={p} value={p}>
                              {JOURNEY_PROFILE_LABELS[p]}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-start gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendFirstNow}
                  onChange={e => setSendFirstNow(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 mt-0.5"
                />
                <span>
                  Disparar a mensagem de boas-vindas agora
                  <span className="block text-xs text-slate-400">
                    Desmarcado, a primeira mensagem sai na data calculada pela matriz (D+1).
                  </span>
                </span>
              </label>

              <p className="text-xs text-slate-400">
                As datas são contadas a partir do dia do acolhimento de cada pessoa, nunca pelo
                calendário do mês. O envio respeita a janela de horário e o ritmo configurados na
                matriz, alternando entre as instâncias escolhidas.
              </p>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50">
          <button onClick={onClose} className="px-5 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving || !journeyId || !withPhone.length}
            className="flex items-center gap-1.5 px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Anexar cronograma
          </button>
        </div>
      </div>
    </div>
  );
}

export default AttachJourneyModal;
