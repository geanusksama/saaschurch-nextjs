import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Save, Play, Plus, Trash2, Zap, Mail, MessageSquare, Clock, Filter, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { toast } from 'sonner';

interface AutomationStep {
  id: string;
  type: 'trigger' | 'condition' | 'action' | 'delay';
  config: {
    trigger?: string;
    condition?: string;
    action?: string;
    delay?: string;
    value?: string;
  };
}

export function AutomationBuilder() {
  const navigate = useNavigate();
  const [automationName, setAutomationName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [steps, setSteps] = useState<AutomationStep[]>([
    {
      id: '1',
      type: 'trigger',
      config: { trigger: '' }
    }
  ]);

  const addStep = (type: AutomationStep['type']) => {
    const newStep: AutomationStep = {
      id: Date.now().toString(),
      type,
      config: {}
    };
    setSteps([...steps, newStep]);
  };

  const removeStep = (id: string) => {
    if (steps.length > 1) {
      setSteps(steps.filter(step => step.id !== id));
    }
  };

  const updateStep = (id: string, field: string, value: string) => {
    setSteps(steps.map(step => 
      step.id === id 
        ? { ...step, config: { ...step.config, [field]: value } }
        : step
    ));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Automação criada com sucesso!');
    setTimeout(() => navigate('/app-ui/automation'), 1500);
  };

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'trigger': return <Zap className="w-5 h-5" />;
      case 'condition': return <Filter className="w-5 h-5" />;
      case 'action': return <Play className="w-5 h-5" />;
      case 'delay': return <Clock className="w-5 h-5" />;
      default: return <Zap className="w-5 h-5" />;
    }
  };

  const getStepColor = (type: string) => {
    switch (type) {
      case 'trigger': return 'bg-purple-100 text-purple-700 border-purple-300';
      case 'condition': return 'bg-blue-100 text-blue-700 border-blue-300';
      case 'action': return 'bg-green-100 text-green-700 border-green-300';
      case 'delay': return 'bg-orange-100 text-orange-700 border-orange-300';
      default: return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const getStepLabel = (type: string) => {
    switch (type) {
      case 'trigger': return 'Gatilho';
      case 'condition': return 'Condição';
      case 'action': return 'Ação';
      case 'delay': return 'Aguardar';
      default: return type;
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center">
            <Zap className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Construtor de Automação</h1>
            <p className="text-slate-600 dark:text-slate-400">Crie workflows automatizados para sua igreja</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Área do Canvas */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Workflow de Automação</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-600">Ativa</span>
                    <Switch
                      checked={isActive}
                      onCheckedChange={setIsActive}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="mb-6">
                  <Label htmlFor="automationName">Nome da Automação *</Label>
                  <Input
                    id="automationName"
                    required
                    value={automationName}
                    onChange={(e) => setAutomationName(e.target.value)}
                    placeholder="Ex: Boas-vindas para novos membros"
                  />
                </div>

                {/* Steps */}
                <div className="space-y-3">
                  {steps.map((step, index) => (
                    <div key={step.id}>
                      <Card className={`border-2 ${getStepColor(step.type)}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getStepColor(step.type)}`}>
                              {getStepIcon(step.type)}
                            </div>
                            <div className="flex-1 space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="font-semibold">{getStepLabel(step.type)}</h4>
                                {index > 0 && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeStep(step.id)}
                                  >
                                    <Trash2 className="w-4 h-4 text-red-600" />
                                  </Button>
                                )}
                              </div>

                              {/* Trigger Configuration */}
                              {step.type === 'trigger' && (
                                <div>
                                  <Label>Quando</Label>
                                  <Select
                                    value={step.config.trigger}
                                    onValueChange={(value) => updateStep(step.id, 'trigger', value)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione o gatilho" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="new-member">Novo membro cadastrado</SelectItem>
                                      <SelectItem value="new-visitor">Novo visitante</SelectItem>
                                      <SelectItem value="baptism-request">Pedido de batismo</SelectItem>
                                      <SelectItem value="birthday">Aniversário de membro</SelectItem>
                                      <SelectItem value="event-registration">Inscrição em evento</SelectItem>
                                      <SelectItem value="donation">Nova doação</SelectItem>
                                      <SelectItem value="absence">Ausência em cultos</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              {/* Condition Configuration */}
                              {step.type === 'condition' && (
                                <div className="space-y-3">
                                  <div>
                                    <Label>Se</Label>
                                    <Select
                                      value={step.config.condition}
                                      onValueChange={(value) => updateStep(step.id, 'condition', value)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Selecione a condição" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="age">Idade</SelectItem>
                                        <SelectItem value="ministry">Ministério</SelectItem>
                                        <SelectItem value="membership-status">Status de membro</SelectItem>
                                        <SelectItem value="attendance">Frequência</SelectItem>
                                        <SelectItem value="tag">Tag</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <Input
                                    placeholder="Valor da condição"
                                    value={step.config.value || ''}
                                    onChange={(e) => updateStep(step.id, 'value', e.target.value)}
                                  />
                                </div>
                              )}

                              {/* Action Configuration */}
                              {step.type === 'action' && (
                                <div>
                                  <Label>Executar</Label>
                                  <Select
                                    value={step.config.action}
                                    onValueChange={(value) => updateStep(step.id, 'action', value)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione a ação" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="send-email">Enviar Email</SelectItem>
                                      <SelectItem value="send-whatsapp">Enviar WhatsApp</SelectItem>
                                      <SelectItem value="send-sms">Enviar SMS</SelectItem>
                                      <SelectItem value="add-tag">Adicionar Tag</SelectItem>
                                      <SelectItem value="assign-ministry">Atribuir ao Ministério</SelectItem>
                                      <SelectItem value="create-task">Criar Tarefa</SelectItem>
                                      <SelectItem value="notify-leader">Notificar Líder</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              {/* Delay Configuration */}
                              {step.type === 'delay' && (
                                <div>
                                  <Label>Aguardar</Label>
                                  <Select
                                    value={step.config.delay}
                                    onValueChange={(value) => updateStep(step.id, 'delay', value)}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione o tempo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="1-hour">1 hora</SelectItem>
                                      <SelectItem value="3-hours">3 horas</SelectItem>
                                      <SelectItem value="1-day">1 dia</SelectItem>
                                      <SelectItem value="3-days">3 dias</SelectItem>
                                      <SelectItem value="1-week">1 semana</SelectItem>
                                      <SelectItem value="1-month">1 mês</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Connector */}
                      {index < steps.length - 1 && (
                        <div className="flex justify-center py-2">
                          <div className="w-0.5 h-6 bg-slate-300"></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add Step Buttons */}
                <div className="flex gap-2 justify-center pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addStep('condition')}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Condição
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addStep('action')}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Ação
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addStep('delay')}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Aguardar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Templates */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Templates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => toast.info('Template carregado')}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Boas-vindas
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => toast.info('Template carregado')}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Seguimento Visitante
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => toast.info('Template carregado')}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Lembrete Evento
                </Button>
              </CardContent>
            </Card>

            {/* Estatísticas */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Estatísticas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Etapas</span>
                  <span className="font-semibold">{steps.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Gatilhos</span>
                  <span className="font-semibold">{steps.filter(s => s.type === 'trigger').length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600">Ações</span>
                  <span className="font-semibold">{steps.filter(s => s.type === 'action').length}</span>
                </div>
              </CardContent>
            </Card>

            {/* Ações */}
            <div className="space-y-3">
              <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700">
                <Save className="w-4 h-4 mr-2" />
                Salvar Automação
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => navigate('/app-ui/automation')}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

// Export with alternative name for backwards compatibility
export const AutomationBuilderComponent = AutomationBuilder;