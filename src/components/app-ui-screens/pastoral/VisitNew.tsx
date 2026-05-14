import { useMemo, useState } from 'react';
import { Calendar, User, MapPin, Heart, FileText, Clock, Phone, Home, Hospital, Book, ArrowLeft, Save, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { buildVisitPayload, useCreateVisit, useMemberOptions, useUserOptions } from '../../lib/pastoralHooks';

const visitTypes = [
  { id: 'pastoral', name: 'Visita Pastoral', icon: Heart },
  { id: 'domiciliar', name: 'Visita Domiciliar', icon: Home },
  { id: 'hospitalar', name: 'Visita Hospitalar', icon: Hospital },
  { id: 'acompanhamento', name: 'Acompanhamento', icon: Heart },
  { id: 'novo_convertido', name: 'Novo Convertido', icon: Book },
] as const;

export default function VisitNew() {
  const navigate = useNavigate();
  const createVisit = useCreateVisit();

  const [selectedMember, setSelectedMember] = useState('');
  const [selectedPastor, setSelectedPastor] = useState('');
  const [selectedType, setSelectedType] = useState<'pastoral' | 'domiciliar' | 'hospitalar' | 'familiar' | 'novo_convertido' | 'disciplina' | 'acompanhamento'>('domiciliar');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [address, setAddress] = useState('');
  const [searchMember, setSearchMember] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: members = [], isLoading: loadingMembers } = useMemberOptions(searchMember);
  const { data: users = [], isLoading: loadingUsers } = useUserOptions();

  const selectedMemberData = useMemo(
    () => members.find((m) => m.id === selectedMember),
    [members, selectedMember],
  );

  async function handleSubmit() {
    setErrorMessage(null);

    if (!selectedMember || !selectedPastor || !date || !reason.trim()) {
      setErrorMessage('Preencha membro, responsável, data e motivo.');
      return;
    }

    try {
      await createVisit.mutateAsync(
        buildVisitPayload({
          memberId: selectedMember,
          responsibleId: selectedPastor,
          title: reason.slice(0, 100),
          visitType: selectedType,
          date,
          time: time || '09:00',
          reason,
          address,
          notes,
          durationMinutes: 60,
        }),
      );
      navigate('/app-ui/pastoral');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Não foi possível salvar a visita.');
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-8">
        <Link to="/app-ui/pastoral" className="w-10 h-10 bg-white rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <Heart className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Nova Visita Pastoral</h1>
            <p className="text-slate-600 dark:text-slate-400">Agende uma nova visita ou aconselhamento</p>
          </div>
        </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tipo de Visita */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Tipo de Visita</h3>
            <div className="grid grid-cols-2 gap-3">
              {visitTypes.map(type => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => setSelectedType(type.id as any)}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedType === type.id
                        ? 'border-purple-600 bg-purple-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Icon className={`w-6 h-6 mb-2 ${selectedType === type.id ? 'text-purple-600' : 'text-slate-400'}`} />
                    <p className={`font-semibold ${selectedType === type.id ? 'text-purple-600' : 'text-slate-700'}`}>
                      {type.name}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Membro */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Membro</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Buscar Membro
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={searchMember}
                    onChange={(e) => setSearchMember(e.target.value)}
                    placeholder="Digite o nome do membro..."
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>
              </div>
              
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
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedMemberData && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-sm font-semibold text-blue-900 mb-2">{selectedMemberData.full_name}</p>
                  <div className="flex items-center gap-2 text-sm text-blue-700 mb-1">
                    <Phone className="w-4 h-4" />
                    {selectedMemberData.phone || 'Sem telefone'}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-blue-700">
                    <MapPin className="w-4 h-4" />
                    {[selectedMemberData.address_street, selectedMemberData.address_number, selectedMemberData.address_city].filter(Boolean).join(', ') || 'Sem endereço'}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Data e Horário */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Data e Horário</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Data
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
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
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Responsável */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Responsável pela Visita</h3>
            <select
              value={selectedPastor}
              onChange={(e) => setSelectedPastor(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            >
              <option value="">Selecione o responsável</option>
              {users.map((pastor) => (
                <option key={pastor.id} value={pastor.id}>
                  {pastor.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Detalhes */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Detalhes da Visita</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Motivo da Visita
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: Acompanhamento, Primeira visita, Necessidade específica..."
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Endereço da Visita
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Endereço completo..."
                    rows={2}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Observações
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Informações adicionais, pedidos especiais, etc..."
                    rows={4}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Ações</h3>
            <div className="space-y-3">
              {errorMessage && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={createVisit.isPending || loadingMembers || loadingUsers}
                className="w-full flex items-center gap-3 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-60"
              >
                <Save className="w-5 h-5" />
                {createVisit.isPending ? 'Salvando...' : 'Agendar Visita'}
              </button>
              <Link to="/app-ui/pastoral" className="w-full flex items-center gap-3 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors">
                <ArrowLeft className="w-5 h-5" />
                Cancelar
              </Link>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl border border-blue-200 p-6">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
              <Heart className="w-5 h-5 text-white" />
            </div>
            <h3 className="font-bold text-slate-900 mb-2">Dicas para Visita</h3>
            <ul className="text-sm text-slate-600 space-y-2">
              <li>• Confirme o horário com o membro</li>
              <li>• Leve materiais de apoio se necessário</li>
              <li>• Ore antes da visita</li>
              <li>• Registre o relatório logo após</li>
            </ul>
          </div>

          {/* Recent Visits */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-4">Próximas Visitas</h3>
            <div className="space-y-2 text-sm text-slate-600">
              <p>{loadingMembers ? 'Carregando membros...' : `${members.length} membros disponíveis`}</p>
              <p>{loadingUsers ? 'Carregando responsáveis...' : `${users.length} responsáveis disponíveis`}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
