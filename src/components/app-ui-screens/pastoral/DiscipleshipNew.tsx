import { useState } from 'react';
import { ArrowLeft, BookOpen, Calendar, Save, User } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { getCurrentChurchId } from '../../lib/pastoralService';
import { useCreateDiscipleship, useDiscipleshipPrograms, useMemberOptions, useUserOptions } from '../../lib/pastoralHooks';

export default function DiscipleshipNew() {
  const navigate = useNavigate();
  const churchId = getCurrentChurchId();
  const createDiscipleship = useCreateDiscipleship();

  const [memberId, setMemberId] = useState('');
  const [disciplerId, setDisciplerId] = useState('');
  const [programId, setProgramId] = useState('');
  const [startedAt, setStartedAt] = useState('');
  const [nextMeetingAt, setNextMeetingAt] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: members = [] } = useMemberOptions();
  const { data: users = [] } = useUserOptions();
  const { data: programs = [] } = useDiscipleshipPrograms();

  async function handleSubmit() {
    setErrorMessage(null);

    if (!churchId) {
      setErrorMessage('Igreja ativa não encontrada.');
      return;
    }

    if (!memberId || !disciplerId || !programId || !startedAt) {
      setErrorMessage('Preencha membro, discipulador, programa e data de início.');
      return;
    }

    try {
      await createDiscipleship.mutateAsync({
        churchId,
        memberId,
        disciplerId,
        programId,
        startedAt: `${startedAt}T09:00:00`,
        nextMeetingAt: nextMeetingAt ? `${nextMeetingAt}T09:00:00` : undefined,
        notes: notes.trim() || undefined,
      });
      navigate('/app-ui/discipleship-tracking');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Não foi possível criar o discipulado.');
    }
  }

  return (
    <div className="p-6">
      <div className="mb-8 flex items-center gap-4">
        <Link to="/app-ui/discipleship-tracking" className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
            <BookOpen className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Novo Discipulado</h1>
            <p className="text-slate-600">Cadastre um novo discípulo e inicie o acompanhamento.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="mb-4 font-bold text-slate-900">Dados principais</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Membro</label>
                <select value={memberId} onChange={(event) => setMemberId(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Selecione</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Discipulador</label>
                <select value={disciplerId} onChange={(event) => setDisciplerId(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Selecione</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Programa</label>
                <select value={programId} onChange={(event) => setProgramId(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Selecione</option>
                  {programs.map((program: any) => (
                    <option key={program.id} value={program.id}>
                      {program.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Data de início</label>
                <input type="date" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">Próximo encontro</label>
                <input type="date" value={nextMeetingAt} onChange={(event) => setNextMeetingAt(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-semibold text-slate-700">Observações</label>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Contexto inicial do discipulado..." />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="mb-4 font-bold text-slate-900">Ações</h3>

            {errorMessage && (
              <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {errorMessage}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={createDiscipleship.isPending}
              className="mb-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-3 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {createDiscipleship.isPending ? 'Salvando...' : 'Salvar discipulado'}
            </button>

            <Link to="/app-ui/discipleship-curriculum" className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700 hover:bg-blue-100">
              <BookOpen className="h-4 w-4" />
              Gerenciar currículo
            </Link>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
            <div className="mb-2 flex items-center gap-2 font-semibold text-slate-800">
              <User className="h-4 w-4" />
              Dica
            </div>
            Defina o próximo encontro para facilitar o acompanhamento automático no dashboard.
            <div className="mt-3 flex items-center gap-2 text-slate-500">
              <Calendar className="h-4 w-4" />
              O progresso começa em 0% e evolui ao registrar encontros.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
