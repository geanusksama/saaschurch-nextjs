import { useState } from 'react';
import { Search, UserCheck, X, Check } from 'lucide-react';

const members = [
  { id: 1, name: 'Ana Carolina Silva', phone: '(11) 98765-4321', photo: null, checkedIn: false },
  { id: 2, name: 'Bruno Oliveira Santos', phone: '(11) 98765-4322', photo: null, checkedIn: true },
  { id: 3, name: 'Carlos Eduardo Lima', phone: '(11) 98765-4323', photo: null, checkedIn: false },
  { id: 4, name: 'Daniela Costa Mendes', phone: '(11) 98765-4324', photo: null, checkedIn: false },
  { id: 5, name: 'Eduardo Rodrigues', phone: '(11) 98765-4325', photo: null, checkedIn: true },
  { id: 6, name: 'Fernanda Alves', phone: '(11) 98765-4326', photo: null, checkedIn: false },
  { id: 7, name: 'Gabriel Martins', phone: '(11) 98765-4327', photo: null, checkedIn: false },
  { id: 8, name: 'Helena Souza', phone: '(11) 98765-4328', photo: null, checkedIn: true },
];

export default function MemberCheckin() {
  const [searchTerm, setSearchTerm] = useState('');
  const [localMembers, setLocalMembers] = useState(members);

  const filteredMembers = localMembers.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.phone.includes(searchTerm)
  );

  const handleCheckin = (id: number) => {
    setLocalMembers(prev => prev.map(m =>
      m.id === id ? { ...m, checkedIn: !m.checkedIn } : m
    ));
  };

  const checkedInCount = localMembers.filter(m => m.checkedIn).length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
            <UserCheck className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Check-in de Membros</h1>
            <p className="text-slate-600 dark:text-slate-400">Culto Domingo Manhã - 09:00</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-sm text-slate-600 mb-1">Total de Membros</p>
            <p className="text-2xl font-bold text-slate-900">{localMembers.length}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-sm text-slate-600 mb-1">Presentes</p>
            <p className="text-2xl font-bold text-green-600">{checkedInCount}</p>
          </div>
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <p className="text-sm text-slate-600 mb-1">Taxa de Presença</p>
            <p className="text-2xl font-bold text-blue-600">
              {Math.round((checkedInCount / localMembers.length) * 100)}%
            </p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-14 pr-4 py-4 text-lg border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {/* Members Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMembers.map((member) => (
          <div
            key={member.id}
            onClick={() => handleCheckin(member.id)}
            className={`bg-white rounded-xl border-2 p-6 cursor-pointer transition-all ${
              member.checkedIn
                ? 'border-green-500 bg-green-50'
                : 'border-slate-200 hover:border-teal-300 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold text-slate-600">
                  {member.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                </span>
              </div>

              {member.checkedIn ? (
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                  <Check className="w-6 h-6 text-white" />
                </div>
              ) : (
                <div className="w-12 h-12 border-2 border-slate-300 rounded-full flex items-center justify-center">
                  <UserCheck className="w-6 h-6 text-slate-400" />
                </div>
              )}
            </div>

            <h3 className="font-bold text-slate-900 text-lg mb-1">{member.name}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">{member.phone}</p>

            {member.checkedIn && (
              <div className="mt-3 pt-3 border-t border-green-200">
                <p className="text-xs text-green-700 font-semibold">✓ Check-in realizado</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredMembers.length === 0 && (
        <div className="text-center py-12">
          <p className="text-slate-500 text-lg">Nenhum membro encontrado</p>
        </div>
      )}
    </div>
  );
}
