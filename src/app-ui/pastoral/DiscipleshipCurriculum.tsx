import { useMemo, useState } from 'react';
import { BookOpen, CheckCircle, Lock, Clock, ChevronDown, ChevronRight, Plus, Save } from 'lucide-react';
import {
  useCreateDiscipleshipProgram,
  useCreateDiscipleshipProgramLesson,
  useDiscipleshipProgramLessons,
  useDiscipleshipPrograms,
  useDiscipleships,
} from '../../lib/pastoralHooks';
import { getCurrentChurchId } from '../../lib/pastoralService';

export default function DiscipleshipCurriculum() {
  const churchId = getCurrentChurchId();
  const [expandedStage, setExpandedStage] = useState<string | null>(null);
  const [showProgramForm, setShowProgramForm] = useState(false);
  const [programName, setProgramName] = useState('');
  const [programDescription, setProgramDescription] = useState('');
  const [programStage, setProgramStage] = useState<'fundamentos' | 'crescimento' | 'multiplicacao'>('fundamentos');
  const [programLessonsCount, setProgramLessonsCount] = useState('7');

  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonSummary, setLessonSummary] = useState('');
  const [lessonDuration, setLessonDuration] = useState('45');
  const [lessonMaterials, setLessonMaterials] = useState('PDF, Vídeo');

  const { data: programs = [], isLoading: loadingPrograms } = useDiscipleshipPrograms();
  const { data: discipleships = [], isLoading: loadingProgress } = useDiscipleships({ status: 'all' });
  const { data: activeProgramLessons = [] } = useDiscipleshipProgramLessons(expandedStage);
  const createProgram = useCreateDiscipleshipProgram();
  const createLesson = useCreateDiscipleshipProgramLesson();

  const summary = useMemo(() => {
    const totalLessons = programs.reduce((acc: number, p: any) => acc + Number(p.lessons_count || 0), 0);

    const completedLessons = discipleships.reduce((acc: number, d: any) => {
      const total = Number(d.total_lessons || d.discipleship_programs?.lessons_count || 0);
      const progress = Number(d.progress_percent || 0);
      return acc + Math.round((total * progress) / 100);
    }, 0);

    const progressPercentage = totalLessons > 0 ? Math.min(100, Math.round((completedLessons / totalLessons) * 100)) : 0;

    return { totalLessons, completedLessons, progressPercentage };
  }, [discipleships, programs]);

  if (loadingPrograms || loadingProgress) {
    return <div className="p-6 text-sm text-slate-500">Carregando curriculo de discipulado...</div>;
  }

  return (
    <div className="p-6 text-slate-900 dark:text-slate-100">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Curriculo de Discipulado</h1>
            <p className="text-slate-600">Jornada completa de formacao espiritual</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowProgramForm((value) => !value)}
            className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700"
          >
            <Plus className="w-4 h-4" />
            Novo Programa
          </button>
        </div>
      </div>

      {showProgramForm && (
        <div className="mb-6 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <h3 className="mb-3 font-semibold text-slate-900">Criar programa de discipulado</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <input
              value={programName}
              onChange={(event) => setProgramName(event.target.value)}
              placeholder="Nome do programa"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              value={programDescription}
              onChange={(event) => setProgramDescription(event.target.value)}
              placeholder="Descrição"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <select
              value={programStage}
              onChange={(event) => setProgramStage(event.target.value as any)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="fundamentos">Fundamentos</option>
              <option value="crescimento">Crescimento</option>
              <option value="multiplicacao">Multiplicação</option>
            </select>
            <input
              value={programLessonsCount}
              onChange={(event) => setProgramLessonsCount(event.target.value)}
              placeholder="Qtde de lições"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-3">
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-60"
              disabled={createProgram.isPending || !churchId || !programName.trim()}
              onClick={() => {
                void createProgram.mutateAsync({
                  churchId: churchId!,
                  name: programName.trim(),
                  description: programDescription.trim() || undefined,
                  stage: programStage,
                  lessonsCount: Number(programLessonsCount || 0),
                });
                setProgramName('');
                setProgramDescription('');
              }}
            >
              <Save className="w-4 h-4" />
              Salvar Programa
            </button>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-xl text-white p-8 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div><p className="text-sm opacity-90 mb-1">Progresso total</p><p className="text-4xl font-bold">{summary.progressPercentage}%</p></div>
          <div><p className="text-sm opacity-90 mb-1">Licoes concluidas</p><p className="text-4xl font-bold">{summary.completedLessons}</p></div>
          <div><p className="text-sm opacity-90 mb-1">Total de licoes</p><p className="text-4xl font-bold">{summary.totalLessons}</p></div>
          <div><p className="text-sm opacity-90 mb-1">Estagios</p><p className="text-4xl font-bold">{programs.length}</p></div>
        </div>
        <div className="mt-6 w-full bg-white/20 rounded-full h-3">
          <div className="bg-white h-3 rounded-full transition-all" style={{ width: `${summary.progressPercentage}%` }} />
        </div>
      </div>

      <div className="space-y-4">
        {programs.map((program: any) => {
          const isExpanded = expandedStage === program.id;
          const linked = discipleships.filter((d: any) => d.program_id === program.id);
          const stageTotal = Number(program.lessons_count || 0);
          const stageDone = linked.reduce((acc: number, d: any) => {
            const total = Number(d.total_lessons || stageTotal || 0);
            const progress = Number(d.progress_percent || 0);
            return acc + Math.round((total * progress) / 100);
          }, 0);
          const stageProgress = stageTotal > 0 && linked.length > 0
            ? Math.min(100, Math.round((stageDone / (stageTotal * linked.length)) * 100))
            : 0;

          return (
            <div key={program.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button
                onClick={() => setExpandedStage(isExpanded ? null : program.id)}
                className="w-full p-6 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="text-left">
                  <h3 className="font-bold text-slate-900 mb-1">{program.name}</h3>
                  <p className="text-sm text-slate-600">{program.description || 'Programa de discipulado'} • {stageTotal} licoes • {linked.length} pessoas</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="px-3 py-1 rounded-full text-sm font-semibold bg-purple-100 text-purple-700">{stageProgress}%</span>
                  {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                </div>
              </button>

              {isExpanded && (
                <div className="px-6 pb-6 space-y-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-2 text-sm font-semibold text-slate-900">Adicionar matéria/lição</p>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                      <input
                        value={lessonTitle}
                        onChange={(event) => setLessonTitle(event.target.value)}
                        placeholder="Título da lição"
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      <input
                        value={lessonSummary}
                        onChange={(event) => setLessonSummary(event.target.value)}
                        placeholder="Resumo"
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      <input
                        value={lessonDuration}
                        onChange={(event) => setLessonDuration(event.target.value)}
                        placeholder="Duração (min)"
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                      <input
                        value={lessonMaterials}
                        onChange={(event) => setLessonMaterials(event.target.value)}
                        placeholder="Materiais (vírgula)"
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="mt-2">
                      <button
                        className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                        disabled={createLesson.isPending || !churchId || !lessonTitle.trim()}
                        onClick={() => {
                          const maxExistingLesson = activeProgramLessons.reduce(
                            (acc, lesson) => Math.max(acc, Number(lesson.lesson_number || 0)),
                            0,
                          );
                          const nextLessonNumber = maxExistingLesson + 1;
                          void createLesson.mutateAsync({
                            churchId: churchId!,
                            programId: program.id,
                            lessonNumber: nextLessonNumber,
                            title: lessonTitle.trim(),
                            contentSummary: lessonSummary.trim() || undefined,
                            durationMinutes: Number(lessonDuration || 0),
                            materials: lessonMaterials
                              .split(',')
                              .map((item) => item.trim())
                              .filter(Boolean),
                          });
                          setLessonTitle('');
                          setLessonSummary('');
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Adicionar matéria
                      </button>
                    </div>
                  </div>

                  {(activeProgramLessons.length ? activeProgramLessons : Array.from({ length: stageTotal || 0 }, (_, i) => ({
                    id: String(i + 1),
                    lesson_number: i + 1,
                    title: `Lição ${i + 1}`,
                    content_summary: `Conteúdo do programa ${program.name}`,
                    duration_minutes: 45,
                    materials: [],
                  } as any))).map((lesson: any) => {
                    const lessonNumber = Number(lesson.lesson_number || 0);
                    const hasStarted = linked.some((d: any) => Number(d.current_lesson || 0) >= lessonNumber);
                    const isCompleted = linked.some((d: any) => Number(d.progress_percent || 0) === 100);

                    return (
                      <div key={lesson.id || lessonNumber} className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
                        <div>
                          <p className="font-semibold text-slate-900">Lição {lessonNumber}: {lesson.title || `Lição ${lessonNumber}`}</p>
                          <p className="text-sm text-slate-600">{lesson.content_summary || `Conteúdo do programa ${program.name}`}</p>
                          {Array.isArray(lesson.materials) && lesson.materials.length > 0 && (
                            <p className="mt-1 text-xs text-slate-500">Materiais: {lesson.materials.join(', ')}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-600">{lesson.duration_minutes || 45} min</span>
                          {isCompleted ? <CheckCircle className="w-4 h-4 text-green-600" /> : hasStarted ? <BookOpen className="w-4 h-4 text-blue-600" /> : <Lock className="w-4 h-4 text-slate-400" />}
                        </div>
                      </div>
                    );
                  })}
                  {stageTotal === 0 && <p className="text-sm text-slate-500">Programa sem licoes cadastradas.</p>}
                </div>
              )}
            </div>
          );
        })}

        {programs.length === 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center text-slate-500 dark:text-slate-400">Nenhum programa de discipulado cadastrado.</div>
        )}
      </div>
    </div>
  );
}
