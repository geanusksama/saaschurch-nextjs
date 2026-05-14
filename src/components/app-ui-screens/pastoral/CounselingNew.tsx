import { useState } from 'react';
import { Heart, User, Calendar, Clock, FileText, ArrowLeft, Save, Users, BookOpen } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useCreateCounseling, useMemberOptions, useUserOptions } from '../../lib/pastoralHooks';
import { getCurrentChurchId } from '../../lib/pastoralService';

const counselingTypes = [
  { id: 'conjugal', name: 'Aconselhamento Conjugal', description: 'Para casais enfrentando dificuldades' },
  { id: 'spiritual', name: 'Orientação Espiritual', description: 'Crescimento e maturidade espiritual' },
  { id: 'liberation', name: 'Libertação', description: 'Ministração de cura e libertação' },
  { id: 'family', name: 'Aconselhamento Familiar', description: 'Questões familiares e relacionamentos' },
  { id: 'crisis', name: 'Crise Espiritual', description: 'Momentos de crise e dificuldade' },
  { id: 'career', name: 'Aconselhamento de Carreira', description: 'Orientação profissional' },
];

const frequencies = [
  { id: 'weekly', name: 'Semanal', description: 'Uma vez por semana' },
  { id: 'biweekly', name: 'Quinzenal', description: 'A cada 15 dias' },
  { id: 'monthly', name: 'Mensal', description: 'Uma vez por mês' },
  { id: 'flexible', name: 'Flexível', description: 'Conforme necessidade' },
];

export default function CounselingNew() {
  const navigate = useNavigate();
  const createCounseling = useCreateCounseling();
  const churchId = getCurrentChurchId();

  const [selectedMember, setSelectedMember] = useState('');
  const [selectedCounselor, setSelectedCounselor] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedFrequency, setSelectedFrequency] = useState('weekly');
  const [startDate, setStartDate] = useState('');
  const [firstSessionDate, setFirstSessionDate] = useState('');
  const [firstSessionTime, setFirstSessionTime] = useState('');
  const [reason, setReason] = useState('');
  const [goals, setGoals] = useState('');
  const [isConfidential, setIsConfidential] = useState(true);
  const [estimatedSessions, setEstimatedSessions] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: members = [] } = useMemberOptions();
  const { data: counselors = [] } = useUserOptions();

  const selectedMemberData = members.find(m => m.id === selectedMember);
  const selectedCounselorData = counselors.find(c => c.id === selectedCounselor);
  const selectedTypeData = counselingTypes.find(t => t.id === selectedType);

  async function handleSubmit() {
    setErrorMessage(null);
    if (!churchId) {
      setErrorMessage('Igreja ativa não encontrada.');
      return;
    }
    if (!selectedMember || !selectedCounselor || !selectedType || !reason.trim() || !firstSessionDate) {
      setErrorMessage('Preencha membro, conselheiro, tipo, motivo e data de início.');
      return;
    }

    const dbTypeMap: Record<string, string> = {
      conjugal: 'conjugal',
      spiritual: 'espiritual',
      liberation: 'libertacao',
      family: 'familiar',
      crisis: 'emocional',
      career: 'ministerial',
    };

    try {
      await createCounseling.mutateAsync({
        churchId,
        memberId: selectedMember,
        counselorId: selectedCounselor,
        title: `${selectedTypeData?.name || 'Aconselhamento'} - ${members.find((m) => m.id === selectedMember)?.full_name || ''}`.trim(),
        counselingType: dbTypeMap[selectedType] || 'outro',
        description: reason,
        startedAt: `${firstSessionDate}T${firstSessionTime || '09:00'}:00`,
        nextSessionAt: firstSessionDate ? `${firstSessionDate}T${firstSessionTime || '09:00'}:00` : undefined,
        priority: selectedType === 'liberation' || selectedType === 'crisis' ? 'high' : 'normal',
      });
      navigate('/app-ui/counseling-list');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Não foi possível iniciar o aconselhamento.');
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-8">
        <Link to="/app-ui/counseling-list" className="w-10 h-10 bg-white rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <Heart className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Novo Aconselhamento</h1>
            <p className="text-slate-600 dark:text-slate-400">Inicie um novo processo de aconselhamento</p>
          </div>
        </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tipo de Aconselhamento */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Tipo de Aconselhamento</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {counselingTypes.map(type => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    selectedType === type.id
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className={`font-semibold mb-1 ${
                    selectedType === type.id ? 'text-purple-600' : 'text-slate-900'
                  }`}>
                    {type.name}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{type.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Pessoa */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Pessoa a ser Aconselhada</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Selecionar Membro
                </label>
                <select
                  value={selectedMember}
                  onChange={(e) => setSelectedMember(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                >
                  <option value="">Selecione um membro</option>
                  {members.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedMemberData && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-sm font-semibold text-blue-900 mb-2">{selectedMemberData.full_name}</p>
                  <div className="flex items-center gap-4 text-sm text-blue-700">
                    <span>{selectedMemberData.phone || 'Sem telefone'}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
                <Users className="w-5 h-5 text-purple-600" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-purple-900">Aconselhamento em Casal?</p>
                  <p className="text-xs text-purple-700">Marque se for aconselhamento conjugal</p>
                </div>
                <input
                  type="checkbox"
                  className="w-5 h-5 text-purple-600 rounded focus:ring-purple-600"
                />
              </div>
            </div>
          </div>

          {/* Conselheiro */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Conselheiro Responsável</h3>
            <div className="space-y-4">
              <select
                value={selectedCounselor}
                onChange={(e) => setSelectedCounselor(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              >
                <option value="">Selecione um conselheiro</option>
                {counselors.map(counselor => (
                  <option key={counselor.id} value={counselor.id}>
                    {counselor.full_name}
                  </option>
                ))}
              </select>

              {selectedCounselorData && (
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <p className="text-sm font-semibold text-green-900">{selectedCounselorData.full_name}</p>
                </div>
              )}
            </div>
          </div>

          {/* Frequência */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Frequência das Sessões</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {frequencies.map(freq => (
                <button
                  key={freq.id}
                  onClick={() => setSelectedFrequency(freq.id)}
                  className={`p-3 rounded-lg border-2 text-center transition-all ${
                    selectedFrequency === freq.id
                      ? 'border-purple-600 bg-purple-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className={`font-semibold text-sm mb-1 ${
                    selectedFrequency === freq.id ? 'text-purple-600' : 'text-slate-900'
                  }`}>
                    {freq.name}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{freq.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Primeira Sessão */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Primeira Sessão</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Data de Início
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="date"
                    value={firstSessionDate}
                    onChange={(e) => setFirstSessionDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Horário
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="time"
                    value={firstSessionTime}
                    onChange={(e) => setFirstSessionTime(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Sessões Estimadas
              </label>
              <input
                type="number"
                value={estimatedSessions}
                onChange={(e) => setEstimatedSessions(e.target.value)}
                placeholder="Ex: 6 sessões"
                min="1"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              />
            </div>
          </div>

          {/* Detalhes */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Detalhes do Aconselhamento</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Motivo / Situação Atual
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Descreva brevemente a situação que levou à necessidade de aconselhamento..."
                  rows={4}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Objetivos e Metas
                </label>
                <textarea
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  placeholder="Quais são os objetivos deste aconselhamento? O que se espera alcançar?"
                  rows={4}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Ações</h3>
            <div className="space-y-3">
              {errorMessage && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                  {errorMessage}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={createCounseling.isPending}
                className="w-full flex items-center gap-3 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-60"
              >
                <Save className="w-5 h-5" />
                {createCounseling.isPending ? 'Salvando...' : 'Iniciar Aconselhamento'}
              </button>
              <Link to="/app-ui/counseling-list" className="w-full flex items-center gap-3 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
                <ArrowLeft className="w-5 h-5" />
                Cancelar
              </Link>
            </div>
          </div>

          {/* Privacy */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Privacidade</h3>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isConfidential}
                onChange={(e) => setIsConfidential(e.target.checked)}
                className="mt-1 w-5 h-5 text-purple-600 rounded focus:ring-purple-600"
              />
              <div>
                <p className="font-semibold text-slate-900">Confidencial</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Apenas você e líderes autorizados terão acesso</p>
              </div>
            </label>
          </div>

          {/* Summary */}
          {selectedTypeData && selectedMemberData && selectedCounselorData && (
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200 p-6">
              <h3 className="font-bold text-slate-900 mb-4">Resumo</h3>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-slate-600 dark:text-slate-400">Tipo</p>
                  <p className="font-semibold text-slate-900">{selectedTypeData.name}</p>
                </div>
                <div>
                  <p className="text-slate-600 dark:text-slate-400">Pessoa</p>
                  <p className="font-semibold text-slate-900">{selectedMemberData.name}</p>
                </div>
                <div>
                  <p className="text-slate-600 dark:text-slate-400">Conselheiro</p>
                  <p className="font-semibold text-slate-900">{selectedCounselorData.name}</p>
                </div>
                <div>
                  <p className="text-slate-600 dark:text-slate-400">Frequência</p>
                  <p className="font-semibold text-slate-900">
                    {frequencies.find(f => f.id === selectedFrequency)?.name}
                  </p>
                </div>
                {firstSessionDate && (
                  <div>
                    <p className="text-slate-600 dark:text-slate-400">Primeira Sessão</p>
                    <p className="font-semibold text-slate-900">
                      {new Date(firstSessionDate).toLocaleDateString('pt-BR')}
                      {firstSessionTime && ` às ${firstSessionTime}`}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tips */}
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-200 p-6">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-bold text-slate-900 mb-2">Dicas</h3>
            <ul className="text-sm text-slate-600 space-y-2">
              <li>• Defina objetivos claros</li>
              <li>• Mantenha confidencialidade</li>
              <li>• Registre cada sessão</li>
              <li>• Reavalie periodicamente</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
