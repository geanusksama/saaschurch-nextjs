import { useState } from 'react';
import { Users, Plus, Search, MapPin, Calendar, TrendingUp, User, X, Save } from 'lucide-react';
import { Link } from 'react-router';
const cells = [
  {
    id: 1,
    name: 'Célula Jardim Paulista',
    leader: 'Carlos Silva',
    members: 12,
    address: 'Rua Augusta, 123',
    day: 'Terça-feira',
    time: '19:30',
    growth: 15.5,
    status: 'active'
  },
  {
    id: 2,
    name: 'Célula Vila Mariana',
    leader: 'Ana Paula Santos',
    members: 18,
    address: 'Av. Domingos de Morais, 456',
    day: 'Quarta-feira',
    time: '20:00',
    growth: 25.3,
    status: 'active'
  },
  {
    id: 3,
    name: 'Célula Moema',
    leader: 'Roberto Oliveira',
    members: 10,
    address: 'Rua Ibirapuera, 789',
    day: 'Quinta-feira',
    time: '19:00',
    growth: -5.2,
    status: 'active'
  },
  {
    id: 4,
    name: 'Célula Pinheiros',
    leader: 'Juliana Mendes',
    members: 15,
    address: 'Rua dos Pinheiros, 234',
    day: 'Sexta-feira',
    time: '20:00',
    growth: 18.7,
    status: 'active'
  },
];

export default function CellsList() {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: '', rede: 'Rede 1', leader: '', phone: '',
    address: '', neighborhood: '', church: 'Sede Principal',
    day: 'Terça', time: ''
  });

  const filteredCells = cells.filter(cell =>
    cell.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cell.leader.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalMembers = cells.reduce((sum, cell) => sum + cell.members, 0);
  const avgGrowth = cells.reduce((sum, cell) => sum + cell.growth, 0) / cells.length;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Células</h1>
            <p className="text-slate-600 dark:text-slate-400">Gerencie as células da igreja</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">Total de Células</p>
            <Users className="w-5 h-5 text-lime-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{cells.length}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">Total de Membros</p>
            <User className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">{totalMembers}</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">Média por Célula</p>
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {Math.round(totalMembers / cells.length)}
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-slate-600 dark:text-slate-400">Crescimento Médio</p>
            <TrendingUp className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-green-600">
            +{avgGrowth.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar células..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium"
          >
            <Plus className="w-5 h-5" />
            Nova Célula
          </button>
        </div>
      </div>

      {/* Cells Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredCells.map((cell) => (
          <Link
            key={cell.id}
            to={`/app-ui/cells/${cell.id}`}
            className="bg-white rounded-xl border border-slate-200 p-6 hover:border-lime-300 hover:shadow-lg transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-xl mb-2">{cell.name}</h3>
                <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
                  <User className="w-4 h-4" />
                  <span>Líder: {cell.leader}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <MapPin className="w-4 h-4" />
                  <span>{cell.address}</span>
                </div>
              </div>

              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                cell.growth >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {cell.growth >= 0 ? '+' : ''}{cell.growth}%
              </span>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <div className="flex items-center gap-4 text-sm text-slate-600">
                <div className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  <span className="font-semibold text-slate-900">{cell.members}</span>
                  <span>membros</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>{cell.day} às {cell.time}</span>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Nova Célula Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Nova Célula</h2>
                  <p className="text-sm text-slate-500">Cadastre uma nova célula</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); setShowModal(false); }}>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">Nome da Célula *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="Ex: Célula Alfa"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">Rede</label>
                    <select
                      value={form.rede}
                      onChange={(e) => setForm(f => ({ ...f, rede: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option>Rede 1</option>
                      <option>Rede 2</option>
                      <option>Rede 3</option>
                      <option>Rede 4</option>
                    </select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">Líder *</label>
                    <input
                      type="text"
                      value={form.leader}
                      onChange={(e) => setForm(f => ({ ...f, leader: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="Nome do líder"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">Telefone do Líder *</label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="(11) 98765-4321"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-1.5">Endereço *</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    placeholder="Rua, número"
                    required
                  />
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">Localização (Bairro)</label>
                    <input
                      type="text"
                      value={form.neighborhood}
                      onChange={(e) => setForm(f => ({ ...f, neighborhood: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                      placeholder="Ex: Jardim Paulista"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">Igreja</label>
                    <select
                      value={form.church}
                      onChange={(e) => setForm(f => ({ ...f, church: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option>Sede Principal</option>
                      <option>Campus Norte</option>
                      <option>Campus Sul</option>
                      <option>Campus Oeste</option>
                      <option>Sede Campinas</option>
                    </select>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">Dia da Semana *</label>
                    <select
                      value={form.day}
                      onChange={(e) => setForm(f => ({ ...f, day: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      <option>Segunda</option>
                      <option>Terça</option>
                      <option>Quarta</option>
                      <option>Quinta</option>
                      <option>Sexta</option>
                      <option>Sábado</option>
                      <option>Domingo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-900 mb-1.5">Horário *</label>
                    <input
                      type="time"
                      value={form.time}
                      onChange={(e) => setForm(f => ({ ...f, time: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg hover:bg-slate-50 font-medium text-slate-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium transition-colors"
                  >
                    <Save className="w-4 h-4" />
                    Salvar Célula
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
