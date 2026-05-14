import { Contact, Plus, Phone, Mail, MapPin, Building, Search, Filter, Download, Eye, Edit, Trash2 } from 'lucide-react';
import { Badge } from '../../design-system/components/Badge';

const contacts = [
  {
    id: 1,
    name: 'João Silva',
    role: 'Pastor',
    church: 'Sede Principal',
    phone: '(11) 99999-9999',
    email: 'joao.silva@igreja.com',
    city: 'São Paulo',
    state: 'SP',
    type: 'pastor',
    status: 'active'
  },
  {
    id: 2,
    name: 'Maria Santos',
    role: 'Coordenadora de Células',
    church: 'Campus Norte',
    phone: '(11) 98888-8888',
    email: 'maria.santos@igreja.com',
    city: 'São Paulo',
    state: 'SP',
    type: 'lider',
    status: 'active'
  },
  {
    id: 3,
    name: 'Pedro Oliveira',
    role: 'Tesoureiro',
    church: 'Sede Principal',
    phone: '(11) 97777-7777',
    email: 'pedro@igreja.com',
    city: 'São Paulo',
    state: 'SP',
    type: 'administrativo',
    status: 'active'
  },
  {
    id: 4,
    name: 'Ana Costa',
    role: 'Líder de Louvor',
    church: 'Campus Sul',
    phone: '(11) 96666-6666',
    email: 'ana.costa@igreja.com',
    city: 'São Paulo',
    state: 'SP',
    type: 'ministerio',
    status: 'active'
  },
  {
    id: 5,
    name: 'Carlos Mendes',
    role: 'Pastor Regional',
    church: 'Regional Norte',
    phone: '(11) 95555-5555',
    email: 'carlos.mendes@igreja.com',
    city: 'Guarulhos',
    state: 'SP',
    type: 'pastor',
    status: 'active'
  },
];

const stats = [
  { label: 'Total de Contatos', value: '156', color: 'purple' },
  { label: 'Pastores', value: '12', color: 'blue' },
  { label: 'Líderes', value: '48', color: 'green' },
  { label: 'Administrativo', value: '18', color: 'orange' },
];

export function ContactsModule() {
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <Contact className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Contatos</h1>
            <p className="text-slate-600 dark:text-slate-400">Gerencie contatos de pastores e líderes</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors">
            <Download className="w-5 h-5" />
            Exportar
          </button>
          <button className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors">
            <Plus className="w-5 h-5" />
            Novo Contato
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl border border-slate-200 p-6">
            <p className="text-sm text-slate-600 mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="grid md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar contato..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <select className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
            <option>Todos os Tipos</option>
            <option>Pastor</option>
            <option>Líder</option>
            <option>Administrativo</option>
            <option>Ministério</option>
          </select>
          <select className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
            <option>Todas as Igrejas</option>
            <option>Sede Principal</option>
            <option>Campus Norte</option>
            <option>Campus Sul</option>
          </select>
          <select className="px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
            <option>Todas as Cidades</option>
            <option>São Paulo</option>
            <option>Guarulhos</option>
            <option>Osasco</option>
          </select>
        </div>
      </div>

      {/* Contacts Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Nome</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Função</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Igreja</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Contato</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Localização</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Tipo</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-700">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 font-semibold">
                        {contact.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{contact.name}</p>
                        <p className="text-xs text-slate-500">{contact.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-700">{contact.role}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-sm text-slate-700">
                      <Building className="w-4 h-4 text-slate-400" />
                      {contact.church}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-sm text-slate-700">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {contact.phone}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-500">
                        <Mail className="w-3 h-3 text-slate-400" />
                        Email
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-sm text-slate-700">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      {contact.city}/{contact.state}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="active">{contact.type}</Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button className="p-1.5 hover:bg-blue-50 rounded transition-colors">
                        <Eye className="w-4 h-4 text-blue-600" />
                      </button>
                      <button className="p-1.5 hover:bg-purple-50 rounded transition-colors">
                        <Edit className="w-4 h-4 text-purple-600" />
                      </button>
                      <button className="p-1.5 hover:bg-red-50 rounded transition-colors">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-slate-600 dark:text-slate-400">Mostrando 1-5 de 156 contatos</p>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">
            Anterior
          </button>
          <button className="px-3 py-1.5 bg-purple-600 text-white rounded-lg text-sm">1</button>
          <button className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">2</button>
          <button className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">3</button>
          <button className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm hover:bg-slate-50">
            Próximo
          </button>
        </div>
      </div>
    </div>
  );
}
