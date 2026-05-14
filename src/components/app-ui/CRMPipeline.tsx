import { useState } from 'react';
import { Plus, Search, Filter, MoreVertical, User, Phone, Mail, Calendar, Tag, TrendingUp, Printer } from 'lucide-react';
import { Link } from 'react-router';
import { PrintModal } from './shared/PrintModal';
import { printReport } from '../../lib/printReport';

const stages = [
  { 
    id: 'visitor', 
    name: 'Visitante', 
    count: 24, 
    color: 'bg-blue-500',
    leads: [
      { id: 1, name: 'João Silva', phone: '(11) 98765-4321', email: 'joao@email.com', source: 'Site', value: null, lastContact: '2024-03-14' },
      { id: 2, name: 'Maria Santos', phone: '(11) 97654-3210', email: 'maria@email.com', source: 'Indicação', value: null, lastContact: '2024-03-13' },
      { id: 3, name: 'Pedro Costa', phone: '(11) 96543-2109', email: 'pedro@email.com', source: 'Evento', value: null, lastContact: '2024-03-12' },
    ]
  },
  { 
    id: 'first-contact', 
    name: 'Primeiro Contato', 
    count: 18, 
    color: 'bg-purple-500',
    leads: [
      { id: 4, name: 'Ana Lima', phone: '(11) 95432-1098', email: 'ana@email.com', source: 'Instagram', value: null, lastContact: '2024-03-11' },
      { id: 5, name: 'Carlos Rocha', phone: '(11) 94321-0987', email: 'carlos@email.com', source: 'WhatsApp', value: null, lastContact: '2024-03-10' },
    ]
  },
  { 
    id: 'discipleship', 
    name: 'Discipulado', 
    count: 32, 
    color: 'bg-green-500',
    leads: [
      { id: 6, name: 'Juliana Souza', phone: '(11) 93210-9876', email: 'juliana@email.com', source: 'Site', value: null, lastContact: '2024-03-09' },
      { id: 7, name: 'Roberto Alves', phone: '(11) 92109-8765', email: 'roberto@email.com', source: 'Indicação', value: null, lastContact: '2024-03-08' },
      { id: 8, name: 'Patricia Dias', phone: '(11) 91098-7654', email: 'patricia@email.com', source: 'Evento', value: null, lastContact: '2024-03-07' },
    ]
  },
  { 
    id: 'baptism', 
    name: 'Candidato Batismo', 
    count: 12, 
    color: 'bg-orange-500',
    leads: [
      { id: 9, name: 'Lucas Martins', phone: '(11) 90987-6543', email: 'lucas@email.com', source: 'Instagram', value: null, lastContact: '2024-03-06' },
      { id: 10, name: 'Fernanda Ribeiro', phone: '(11) 89876-5432', email: 'fernanda@email.com', source: 'Site', value: null, lastContact: '2024-03-05' },
    ]
  },
  { 
    id: 'member', 
    name: 'Membro', 
    count: 842, 
    color: 'bg-teal-500',
    leads: [
      { id: 11, name: 'Ricardo Santos', phone: '(11) 88765-4321', email: 'ricardo@email.com', source: 'Indicação', value: null, lastContact: '2024-03-04' },
      { id: 12, name: 'Camila Silva', phone: '(11) 87654-3210', email: 'camila@email.com', source: 'WhatsApp', value: null, lastContact: '2024-03-03' },
    ]
  },
];

export function CRMPipeline() {
  const [printModalOpen, setPrintModalOpen] = useState(false);
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pipeline CRM</h1>
            <p className="text-slate-600 dark:text-slate-400">Gerencie o funil de visitantes até membros</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPrintModalOpen(true)}
            className="flex items-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 rounded-lg text-sm transition-colors"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
          <Link 
            to="/app-ui/crm/leads/new"
            className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Novo Lead
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        {stages.map((stage) => (
          <div key={stage.id} className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-3 h-3 rounded-full ${stage.color}`}></div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-400">{stage.name}</p>
                <p className="text-2xl font-bold text-slate-900">{stage.count}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar leads..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">
            <Filter className="w-5 h-5" />
            Filtros
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <div key={stage.id} className="flex-shrink-0 w-80">
            <div className="bg-white rounded-xl border border-slate-200">
              {/* Stage Header */}
              <div className="p-4 border-b border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${stage.color}`}></div>
                    <h3 className="font-bold text-slate-900">{stage.name}</h3>
                  </div>
                  <span className="text-sm font-semibold text-slate-600">{stage.count}</span>
                </div>
              </div>

              {/* Lead Cards */}
              <div className="p-3 space-y-3 max-h-[600px] overflow-y-auto">
                {stage.leads.map((lead) => (
                  <Link
                    key={lead.id}
                    to={`/app-ui/crm/leads/${lead.id}`}
                    className="block bg-white border border-slate-200 rounded-lg p-4 hover:border-purple-300 hover:shadow-md transition-all cursor-move"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                          {lead.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{lead.name}</p>
                          <span className="text-xs text-slate-500">{lead.source}</span>
                        </div>
                      </div>
                      <button className="p-1 hover:bg-slate-100 rounded">
                        <MoreVertical className="w-4 h-4 text-slate-600" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Phone className="w-3 h-3" />
                        <span>{lead.phone}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Mail className="w-3 h-3" />
                        <span>{lead.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Calendar className="w-3 h-3" />
                        <span>Último contato: {new Date(lead.lastContact).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                  </Link>
                ))}

                {/* Add Card Button */}
                <button className="w-full py-3 border-2 border-dashed border-slate-200 rounded-lg text-slate-500 hover:border-purple-300 hover:text-purple-600 transition-colors flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" />
                  <span className="text-sm font-medium">Adicionar Lead</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

    <PrintModal
      open={printModalOpen}
      onClose={() => setPrintModalOpen(false)}
      sortOptions={[
        { value: 'name', label: 'Nome' },
        { value: 'phone', label: 'Telefone' },
        { value: 'source', label: 'Fonte' },
        { value: 'lastContact', label: 'Último Contato' },
        { value: 'stage', label: 'Etapa' },
      ]}
      columnOptions={[
        { value: 'name', label: 'Nome' },
        { value: 'phone', label: 'Telefone' },
        { value: 'email', label: 'E-mail' },
        { value: 'source', label: 'Fonte' },
        { value: 'lastContact', label: 'Último Contato' },
        { value: 'stage', label: 'Etapa' },
      ]}
      defaultSort="stage"
      onPrint={(orientation, sortBy, selectedColumns) => {
        const allLeads = stages.flatMap((s) => s.leads.map((l) => ({ ...l, stage: s.name })));
        const sorted = allLeads.sort((a, b) =>
          String(a[sortBy as keyof typeof a] ?? '').localeCompare(String(b[sortBy as keyof typeof b] ?? ''), 'pt-BR')
        );
        const allCols = [
          { label: 'Nome', key: 'name' },
          { label: 'Telefone', key: 'phone', width: '110px' },
          { label: 'E-mail', key: 'email' },
          { label: 'Fonte', key: 'source', width: '90px' },
          { label: 'Último Contato', key: 'lastContact', width: '100px' },
          { label: 'Etapa', key: 'stage', width: '120px' },
        ];
        printReport({
          title: 'Pipeline CRM - Leads',
          orientation,
          columns: allCols.filter((c) => selectedColumns.includes(c.key)),
          rows: sorted.map((l) => ({
            name: l.name,
            phone: l.phone,
            email: l.email,
            source: l.source,
            lastContact: l.lastContact ? new Date(l.lastContact).toLocaleDateString('pt-BR') : '—',
            stage: l.stage,
          })),
        });
      }}
    />
    </>
  );
}
