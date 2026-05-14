import { useState } from 'react';
import { ArrowRight, Database } from 'lucide-react';

interface Module {
  id: string;
  name: string;
  color: string;
  position: { x: number; y: number };
}

interface Relationship {
  from: string;
  to: string;
  type: 'data' | 'trigger' | 'reference';
  description: string;
}

const modules: Module[] = [
  { id: 'crm', name: 'CRM', color: 'bg-blue-500', position: { x: 50, y: 100 } },
  { id: 'secretariat', name: 'Secretaria', color: 'bg-purple-500', position: { x: 250, y: 50 } },
  { id: 'finance', name: 'Financeiro', color: 'bg-green-500', position: { x: 450, y: 100 } },
  { id: 'events', name: 'Eventos', color: 'bg-orange-500', position: { x: 250, y: 200 } },
  { id: 'communication', name: 'Comunicação', color: 'bg-pink-500', position: { x: 50, y: 300 } },
  { id: 'ministries', name: 'Ministérios', color: 'bg-indigo-500', position: { x: 450, y: 300 } },
];

const relationships: Relationship[] = [
  { from: 'crm', to: 'secretariat', type: 'data', description: 'Visitante converte em membro' },
  { from: 'crm', to: 'communication', type: 'trigger', description: 'Envio automático de mensagens de acompanhamento' },
  { from: 'secretariat', to: 'finance', type: 'reference', description: 'Registros de doações de membros' },
  { from: 'events', to: 'finance', type: 'data', description: 'Receita de venda de ingressos' },
  { from: 'events', to: 'communication', type: 'trigger', description: 'Confirmações e lembretes de eventos' },
  { from: 'secretariat', to: 'ministries', type: 'reference', description: 'Atribuições ministeriais de membros' },
  { from: 'finance', to: 'communication', type: 'trigger', description: 'Recibos de doações' },
  { from: 'ministries', to: 'secretariat', type: 'reference', description: 'Lista de membros do ministério' },
];

const dataFlowExamples = [
  {
    title: 'Conversão de Visitante a Membro',
    flow: [
      { module: 'CRM', action: 'Visitante registrado' },
      { module: 'Comunicação', action: 'Email de boas-vindas enviado' },
      { module: 'CRM', action: 'Movido para estágio "Interessado"' },
      { module: 'Secretaria', action: 'Criado como membro' },
      { module: 'Ministérios', action: 'Atribuído a pequeno grupo' },
    ],
  },
  {
    title: 'Inscrição e Pagamento de Evento',
    flow: [
      { module: 'Eventos', action: 'Usuário se inscreve no evento' },
      { module: 'Financeiro', action: 'Pagamento processado' },
      { module: 'Eventos', action: 'Ingresso QR gerado' },
      { module: 'Comunicação', action: 'Email de confirmação com QR code' },
      { module: 'Eventos', action: 'Check-in no dia do evento' },
    ],
  },
  {
    title: 'Processo de Batismo',
    flow: [
      { module: 'Secretaria', action: 'Solicitação de batismo enviada' },
      { module: 'Secretaria', action: 'Matriculado em classes' },
      { module: 'Comunicação', action: 'Notificações de cronograma de aulas' },
      { module: 'Secretaria', action: 'Cerimônia agendada' },
      { module: 'Comunicação', action: 'Convite enviado à família' },
      { module: 'Secretaria', action: 'Certificado gerado' },
    ],
  },
  {
    title: 'Doação Mensal e Relatórios',
    flow: [
      { module: 'Financeiro', action: 'Membro faz oferta' },
      { module: 'Financeiro', action: 'Recibo auto-gerado' },
      { module: 'Comunicação', action: 'Recibo enviado por email' },
      { module: 'Secretaria', action: 'Histórico de doações atualizado' },
      { module: 'Financeiro', action: 'Relatório mensal compilado' },
    ],
  },
];

const sharedData = [
  {
    name: 'Perfil de Membro',
    usedBy: ['CRM', 'Secretaria', 'Financeiro', 'Comunicação', 'Ministérios', 'Eventos'],
    fields: ['Nome', 'Contato', 'Status de Batismo', 'Atribuição Ministerial', 'Histórico de Doações'],
  },
  {
    name: 'Hierarquia da Igreja',
    usedBy: ['Todos os Módulos'],
    fields: ['Campo', 'Regional', 'Igreja Local', 'Departamento'],
  },
  {
    name: 'Transações Financeiras',
    usedBy: ['Financeiro', 'Eventos', 'Secretaria'],
    fields: ['Valor', 'Categoria', 'Data', 'Método de Pagamento', 'Referência do Membro'],
  },
  {
    name: 'Logs de Comunicação',
    usedBy: ['Comunicação', 'CRM', 'Eventos'],
    fields: ['Destinatário', 'Canal', 'Template', 'Status', 'Data/Hora'],
  },
];

export function ModuleRelationships() {
  const [selectedFlow, setSelectedFlow] = useState(0);

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Relacionamento de Módulos</h1>
        <p className="text-slate-600 dark:text-slate-400">Como os diferentes módulos interagem e compartilham dados na plataforma</p>
      </div>

      {/* Relationship Diagram */}
      <section className="mb-12">
        <h2 className="text-xl font-bold text-slate-900 mb-6">Mapa de Conexões entre Módulos</h2>
        <div className="bg-white rounded-xl border border-slate-200 p-8 overflow-x-auto">
          <div className="relative min-w-[600px] h-[400px]">
            {/* Connection Lines */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
              {relationships.map((rel, index) => {
                const fromModule = modules.find(m => m.id === rel.from);
                const toModule = modules.find(m => m.id === rel.to);
                if (!fromModule || !toModule) return null;

                const fromX = fromModule.position.x + 60;
                const fromY = fromModule.position.y + 20;
                const toX = toModule.position.x + 60;
                const toY = toModule.position.y + 20;

                const strokeColor = 
                  rel.type === 'data' ? '#3b82f6' :
                  rel.type === 'trigger' ? '#8b5cf6' :
                  '#10b981';

                return (
                  <g key={index}>
                    <line
                      x1={fromX}
                      y1={fromY}
                      x2={toX}
                      y2={toY}
                      stroke={strokeColor}
                      strokeWidth="2"
                      strokeDasharray={rel.type === 'reference' ? '5,5' : '0'}
                      opacity="0.3"
                    />
                  </g>
                );
              })}
            </svg>

            {/* Module Nodes */}
            {modules.map((module) => (
              <div
                key={module.id}
                className="absolute"
                style={{ left: module.position.x, top: module.position.y, zIndex: 1 }}
              >
                <div className={`${module.color} text-white px-6 py-4 rounded-lg shadow-lg font-semibold text-center min-w-[120px]`}>
                  {module.name}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-blue-500" />
            <span className="text-slate-600">Fluxo de Dados</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-purple-500" />
            <span className="text-slate-600">Gatilho/Evento</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-green-500" style={{ backgroundImage: 'linear-gradient(to right, #10b981 50%, transparent 50%)', backgroundSize: '8px 2px' }} />
            <span className="text-slate-600">Referência</span>
          </div>
        </div>
      </section>

      {/* Detailed Relationships */}
      <section className="mb-12">
        <h2 className="text-xl font-bold text-slate-900 mb-6">Pontos de Integração</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {relationships.map((rel, index) => {
            const fromModule = modules.find(m => m.id === rel.from);
            const toModule = modules.find(m => m.id === rel.to);
            const typeColor = 
              rel.type === 'data' ? 'bg-blue-100 text-blue-700' :
              rel.type === 'trigger' ? 'bg-purple-100 text-purple-700' :
              'bg-green-100 text-green-700';

            return (
              <div key={index} className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`${fromModule?.color} text-white text-xs font-semibold px-3 py-1 rounded`}>
                    {fromModule?.name}
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                  <span className={`${toModule?.color} text-white text-xs font-semibold px-3 py-1 rounded`}>
                    {toModule?.name}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mb-2">{rel.description}</p>
                <span className={`text-xs font-medium px-2 py-1 rounded ${typeColor}`}>
                  {rel.type === 'data' ? 'DADOS' : rel.type === 'trigger' ? 'GATILHO' : 'REFERÊNCIA'}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Data Flow Examples */}
      <section className="mb-12">
        <h2 className="text-xl font-bold text-slate-900 mb-6">Fluxos de Dados Completos</h2>
        
        {/* Flow Selector */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {dataFlowExamples.map((example, index) => (
            <button
              key={index}
              onClick={() => setSelectedFlow(index)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedFlow === index
                  ? 'bg-purple-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:border-purple-300'
              }`}
            >
              {example.title}
            </button>
          ))}
        </div>

        {/* Flow Visualization */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-6">{dataFlowExamples[selectedFlow].title}</h3>
          <div className="space-y-4">
            {dataFlowExamples[selectedFlow].flow.map((step, index) => {
              const module = modules.find(m => m.name === step.module);
              return (
                <div key={index} className="flex items-center gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-sm font-semibold text-slate-600">
                      {index + 1}
                    </div>
                    <div className={`${module?.color} text-white px-4 py-2 rounded-lg font-medium min-w-[140px] text-center`}>
                      {step.module}
                    </div>
                    <div className="flex-1">
                      <p className="text-slate-700">{step.action}</p>
                    </div>
                  </div>
                  {index < dataFlowExamples[selectedFlow].flow.length - 1 && (
                    <ArrowRight className="w-5 h-5 text-slate-300" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Shared Data */}
      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-6">Modelos de Dados Compartilhados</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {sharedData.map((data, index) => (
            <div key={index} className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Database className="w-5 h-5 text-slate-600" />
                </div>
                <h3 className="font-bold text-slate-900">{data.name}</h3>
              </div>
              <div className="mb-4">
                <p className="text-xs font-semibold text-slate-500 mb-2">USADO POR</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.usedBy.map((module) => (
                    <span key={module} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                      {module}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">CAMPOS PRINCIPAIS</p>
                <div className="flex flex-wrap gap-1.5">
                  {data.fields.map((field) => (
                    <span key={field} className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded">
                      {field}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
