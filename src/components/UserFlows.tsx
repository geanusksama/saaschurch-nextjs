import { useState } from 'react';
import { motion } from 'motion/react';
import { UserPlus, Heart, Ticket, DollarSign, Calendar, ArrowRight, Circle, CheckCircle2 } from 'lucide-react';

interface FlowStep {
  id: string;
  name: string;
  description: string;
  type: 'start' | 'process' | 'decision' | 'end';
  status?: 'active' | 'complete' | 'pending';
}

interface UserFlow {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  steps: FlowStep[];
}

const userFlows: UserFlow[] = [
  {
    id: 'visitor-to-member',
    name: 'Jornada de Visitante a Membro',
    description: 'Jornada completa desde primeira visita até membro ativo',
    icon: UserPlus,
    color: 'from-blue-500 to-cyan-500',
    steps: [
      { id: '1', name: 'Primeira Visita', description: 'Pessoa participa do culto pela primeira vez', type: 'start' },
      { id: '2', name: 'Ficha de Visitante', description: 'Preenche ficha com informações', type: 'process' },
      { id: '3', name: 'Entrada no CRM', description: 'Adicionado ao CRM como novo lead', type: 'process' },
      { id: '4', name: 'Ligação de Acompanhamento', description: 'Equipe contata em até 48 horas', type: 'process' },
      { id: '5', name: 'Interessado?', description: 'Visitante demonstra interesse contínuo', type: 'decision' },
      { id: '6', name: 'Classe de Boas-Vindas', description: 'Participa da orientação para novos membros', type: 'process' },
      { id: '7', name: 'Classe de Batismo', description: 'Completa preparação para batismo', type: 'process' },
      { id: '8', name: 'Cerimônia de Batismo', description: 'É batizado', type: 'process' },
      { id: '9', name: 'Membro Oficial', description: 'Torna-se membro oficial da igreja', type: 'end' },
    ],
  },
  {
    id: 'discipleship',
    name: 'Pipeline de Discipulado',
    description: 'Acompanhamento de crescimento espiritual e mentoria',
    icon: Heart,
    color: 'from-purple-500 to-pink-500',
    steps: [
      { id: '1', name: 'Novo Convertido', description: 'Toma decisão de seguir a Cristo', type: 'start' },
      { id: '2', name: 'Classe Fundamentos', description: 'Básicos da fé cristã', type: 'process' },
      { id: '3', name: 'Atribuição de Mentor', description: 'Pareado com membro experiente', type: 'process' },
      { id: '4', name: 'Estudo Bíblico', description: 'Participa de pequeno grupo', type: 'process' },
      { id: '5', name: 'Batismo nas Águas', description: 'Declaração pública de fé', type: 'process' },
      { id: '6', name: 'Trilha de Crescimento', description: 'Completa programa de discipulado', type: 'process' },
      { id: '7', name: 'Serviço Ministerial', description: 'Começa a servir no ministério', type: 'process' },
      { id: '8', name: 'Desenvolvimento de Liderança', description: 'Entra no pipeline de liderança', type: 'end' },
    ],
  },
  {
    id: 'event-registration',
    name: 'Inscrição e Check-in em Eventos',
    description: 'Da descoberta do evento até a presença',
    icon: Ticket,
    color: 'from-green-500 to-emerald-500',
    steps: [
      { id: '1', name: 'Navegar Eventos', description: 'Visualiza calendário de eventos no site', type: 'start' },
      { id: '2', name: 'Detalhes do Evento', description: 'Lê informações do evento', type: 'process' },
      { id: '3', name: 'Inscrição', description: 'Preenche formulário de inscrição', type: 'process' },
      { id: '4', name: 'Pagamento', description: 'Paga taxa do ingresso (se aplicável)', type: 'process' },
      { id: '5', name: 'Email de Confirmação', description: 'Recebe email com QR code', type: 'process' },
      { id: '6', name: 'Dia do Evento', description: 'Chega ao local do evento', type: 'process' },
      { id: '7', name: 'Leitura QR', description: 'Equipe escaneia QR code para check-in', type: 'process' },
      { id: '8', name: 'Presença Registrada', description: 'Marcado como presente no sistema', type: 'end' },
    ],
  },
  {
    id: 'giving',
    name: 'Fluxo de Doação e Ofertas',
    description: 'Contribuição financeira de membros',
    icon: DollarSign,
    color: 'from-orange-500 to-red-500',
    steps: [
      { id: '1', name: 'Decisão de Doar', description: 'Membro decide fazer oferta', type: 'start' },
      { id: '2', name: 'Seleção de Canal', description: 'Escolhe: Online, Presencial ou Recorrente', type: 'decision' },
      { id: '3', name: 'Valor e Categoria', description: 'Seleciona valor e tipo de oferta', type: 'process' },
      { id: '4', name: 'Método de Pagamento', description: 'Transferência, cartão ou dinheiro', type: 'process' },
      { id: '5', name: 'Transação', description: 'Pagamento processado', type: 'process' },
      { id: '6', name: 'Recibo Gerado', description: 'Auto-gera recibo com ID', type: 'process' },
      { id: '7', name: 'Recibo por Email', description: 'Enviado para email do membro', type: 'process' },
      { id: '8', name: 'Registro Financeiro', description: 'Lançado no sistema de tesouraria', type: 'end' },
    ],
  },
  {
    id: 'baptism-process',
    name: 'Processo de Batismo',
    description: 'Fluxo completo do batismo desde solicitação até cerimônia',
    icon: Calendar,
    color: 'from-indigo-500 to-purple-500',
    steps: [
      { id: '1', name: 'Solicitação de Batismo', description: 'Membro solicita ser batizado', type: 'start' },
      { id: '2', name: 'Verificação de Elegibilidade', description: 'Admin verifica requisitos', type: 'decision' },
      { id: '3', name: 'Matrícula em Classes', description: 'Matriculado nas classes de batismo', type: 'process' },
      { id: '4', name: 'Participação em Classes', description: 'Curso de preparação de 4 semanas', type: 'process' },
      { id: '5', name: 'Entrevista', description: 'Reunião com pastor', type: 'process' },
      { id: '6', name: 'Agendamento de Cerimônia', description: 'Data e local confirmados', type: 'process' },
      { id: '7', name: 'Dia do Batismo', description: 'Cerimônia pública de batismo', type: 'process' },
      { id: '8', name: 'Certificado', description: 'Recebe certificado de batismo', type: 'end' },
    ],
  },
];

function FlowVisualization({ flow }: { flow: UserFlow }) {
  const Icon = flow.icon;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className={`w-12 h-12 bg-gradient-to-br ${flow.color} rounded-lg flex items-center justify-center`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900">{flow.name}</h3>
          <p className="text-sm text-slate-600">{flow.description}</p>
        </div>
      </div>

      <div className="space-y-4">
        {flow.steps.map((step, index) => (
          <div key={step.id} className="relative">
            {index < flow.steps.length - 1 && (
              <div className="absolute left-6 top-12 w-0.5 h-8 bg-slate-200" />
            )}
            <div className="flex items-start gap-4">
              <div className="relative">
                {step.type === 'start' && (
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Circle className="w-6 h-6 text-green-600 fill-green-600" />
                  </div>
                )}
                {step.type === 'process' && (
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <div className="w-6 h-6 bg-blue-600 rounded" />
                  </div>
                )}
                {step.type === 'decision' && (
                  <div className="w-12 h-12 bg-orange-100 flex items-center justify-center rotate-45">
                    <div className="w-6 h-6 bg-orange-600 -rotate-45" />
                  </div>
                )}
                {step.type === 'end' && (
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-purple-600" />
                  </div>
                )}
              </div>
              <div className="flex-1 pt-2">
                <h4 className="font-semibold text-slate-900">{step.name}</h4>
                <p className="text-sm text-slate-600">{step.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function UserFlows() {
  const [selectedFlow, setSelectedFlow] = useState<string>(userFlows[0].id);
  const currentFlow = userFlows.find(f => f.id === selectedFlow) || userFlows[0];

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Fluxos de Usuário</h1>
        <p className="text-slate-600 dark:text-slate-400">Principais jornadas e processos dos usuários na plataforma</p>
      </div>

      {/* Flow Selector */}
      <div className="mb-8 flex flex-wrap gap-3">
        {userFlows.map((flow) => {
          const Icon = flow.icon;
          return (
            <button
              key={flow.id}
              onClick={() => setSelectedFlow(flow.id)}
              className={`
                flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all
                ${selectedFlow === flow.id
                  ? 'border-purple-600 bg-purple-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
                }
              `}
            >
              <div className={`w-8 h-8 bg-gradient-to-br ${flow.color} rounded-lg flex items-center justify-center`}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <span className={`font-medium ${selectedFlow === flow.id ? 'text-purple-900' : 'text-slate-700'}`}>
                {flow.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Flow Visualization */}
      <motion.div
        key={selectedFlow}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <FlowVisualization flow={currentFlow} />
      </motion.div>

      {/* Legend */}
      <div className="mt-8 bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-bold text-slate-900 mb-4">Legenda de Elementos do Fluxo</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <Circle className="w-5 h-5 text-green-600 fill-green-600" />
            </div>
            <div>
              <p className="font-medium text-slate-900">Ponto de Início</p>
              <p className="text-xs text-slate-500">Jornada começa</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <div className="w-5 h-5 bg-blue-600 rounded" />
            </div>
            <div>
              <p className="font-medium text-slate-900">Etapa de Processo</p>
              <p className="text-xs text-slate-500">Ação ou tarefa</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 flex items-center justify-center rotate-45">
              <div className="w-5 h-5 bg-orange-600 -rotate-45" />
            </div>
            <div>
              <p className="font-medium text-slate-900">Ponto de Decisão</p>
              <p className="text-xs text-slate-500">Escolha ou condição</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="font-medium text-slate-900">Ponto Final</p>
              <p className="text-xs text-slate-500">Objetivo alcançado</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
