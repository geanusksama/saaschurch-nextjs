import React from 'react';
import { Link } from 'react-router';
import { 
  Palette, 
  Type, 
  Layout, 
  Square, 
  Circle,
  Plus,
  Mail,
  Phone,
  Search,
  Calendar,
  Users,
  DollarSign,
  TrendingUp,
  User,
  Settings,
  Bell,
  ChevronRight
} from 'lucide-react';

// Design System Components
import { Button, IconButton } from '../design-system/components/Button';
import { Input, EmailInput, PhoneInput, PasswordInput, SearchInput } from '../design-system/components/Input';
import { Select } from '../design-system/components/Select';
import { Table } from '../design-system/components/Table';
import { 
  Card, 
  DashboardCard, 
  MemberCard, 
  LeadCard, 
  EventCard, 
  FinancialSummaryCard 
} from '../design-system/components/Card';
import { Modal, FormModal, ConfirmationModal } from '../design-system/components/Modal';
import { Badge, StatusBadge } from '../design-system/components/Badge';
import { colors, spacing, borderRadius, typography, themes } from '../design-system/tokens';

export function DesignSystem() {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [formModalOpen, setFormModalOpen] = React.useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = React.useState(false);
  const [selectedValue, setSelectedValue] = React.useState('');
  const [multipleValue, setMultipleValue] = React.useState<string[]>([]);

  const selectOptions = [
    { value: '1', label: 'Opção 1' },
    { value: '2', label: 'Opção 2' },
    { value: '3', label: 'Opção 3' },
    { value: '4', label: 'Opção 4' },
  ];

  const tableData = [
    { id: 1, name: 'João Silva', email: 'joao@email.com', status: 'Ativo', value: 1500 },
    { id: 2, name: 'Maria Santos', email: 'maria@email.com', status: 'Ativo', value: 2300 },
    { id: 3, name: 'Pedro Oliveira', email: 'pedro@email.com', status: 'Inativo', value: 800 },
  ];

  const tableColumns = [
    { key: 'name', header: 'Nome', sortable: true },
    { key: 'email', header: 'Email', sortable: true },
    { 
      key: 'status', 
      header: 'Status',
      render: (value: string) => (
        <Badge variant={value === 'Ativo' ? 'active' : 'inactive'}>
          {value}
        </Badge>
      )
    },
    { 
      key: 'value', 
      header: 'Valor',
      sortable: true,
      render: (value: number) => `R$ ${value.toFixed(2)}`
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-2">MRM Design System</h1>
              <p className="text-slate-600 dark:text-slate-400">Sistema de design completo para a plataforma MRM SaaS</p>
            </div>
            <Link 
              to="/app-ui/system-settings"
              className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Voltar para Configurações
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-8 space-y-12">
        {/* Navigation */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Navegação Rápida</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <a href="#tokens" className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <Palette className="w-5 h-5 text-purple-600" />
              <span className="font-medium">Design Tokens</span>
            </a>
            <a href="#buttons" className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <Square className="w-5 h-5 text-purple-600" />
              <span className="font-medium">Buttons</span>
            </a>
            <a href="#inputs" className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <Type className="w-5 h-5 text-purple-600" />
              <span className="font-medium">Inputs</span>
            </a>
            <a href="#selects" className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <Layout className="w-5 h-5 text-purple-600" />
              <span className="font-medium">Selects</span>
            </a>
            <a href="#tables" className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <Layout className="w-5 h-5 text-purple-600" />
              <span className="font-medium">Tables</span>
            </a>
            <a href="#cards" className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <Square className="w-5 h-5 text-purple-600" />
              <span className="font-medium">Cards</span>
            </a>
            <a href="#modals" className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <Square className="w-5 h-5 text-purple-600" />
              <span className="font-medium">Modals</span>
            </a>
            <a href="#badges" className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <Circle className="w-5 h-5 text-purple-600" />
              <span className="font-medium">Badges</span>
            </a>
          </div>
        </div>

        {/* Design Tokens */}
        <section id="tokens" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Design Tokens</h2>
            <p className="text-slate-600 dark:text-slate-400">Tokens fundamentais do sistema de design</p>
          </div>

          {/* Colors */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Cores</h3>
            
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold text-slate-900 mb-3">Primary (Purple)</h4>
                <div className="grid grid-cols-10 gap-2">
                  {Object.entries(colors.primary).map(([key, value]) => (
                    <div key={key} className="space-y-1">
                      <div className="h-12 rounded-lg border border-slate-200" style={{ backgroundColor: value }} />
                      <p className="text-xs text-slate-600 text-center">{key}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 mb-3">Secondary (Blue)</h4>
                <div className="grid grid-cols-10 gap-2">
                  {Object.entries(colors.secondary).map(([key, value]) => (
                    <div key={key} className="space-y-1">
                      <div className="h-12 rounded-lg border border-slate-200" style={{ backgroundColor: value }} />
                      <p className="text-xs text-slate-600 text-center">{key}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 mb-3">Semantic Colors</h4>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-2">Success</p>
                    <div className="flex gap-2">
                      <div className="h-12 flex-1 rounded-lg" style={{ backgroundColor: colors.success[500] }} />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-2">Warning</p>
                    <div className="flex gap-2">
                      <div className="h-12 flex-1 rounded-lg" style={{ backgroundColor: colors.warning[500] }} />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 mb-2">Error</p>
                    <div className="flex gap-2">
                      <div className="h-12 flex-1 rounded-lg" style={{ backgroundColor: colors.error[500] }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Spacing */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Espaçamento</h3>
            <div className="space-y-3">
              {Object.entries(spacing).map(([key, value]) => (
                <div key={key} className="flex items-center gap-4">
                  <span className="w-16 text-sm font-mono text-slate-600">{key}</span>
                  <div className="h-8 bg-purple-500 rounded" style={{ width: value }} />
                  <span className="text-sm text-slate-500">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Border Radius */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Border Radius</h3>
            <div className="grid md:grid-cols-4 gap-4">
              {Object.entries(borderRadius).map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <div className="h-20 bg-purple-500" style={{ borderRadius: value }} />
                  <p className="text-sm font-medium text-slate-700">{key}</p>
                  <p className="text-xs text-slate-500">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Typography */}
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">Tipografia</h3>
            <div className="space-y-4">
              {Object.entries(typography).map(([key, value]) => (
                <div key={key} className="border-b border-slate-200 pb-4 last:border-0">
                  <p className="text-sm font-medium text-slate-500 mb-2">{key}</p>
                  <p style={value}>Exemplo de texto {key}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Size: {value.fontSize} | Weight: {value.fontWeight} | Line Height: {value.lineHeight}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Buttons */}
        <section id="buttons" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Buttons</h2>
            <p className="text-slate-600 dark:text-slate-400">Componentes de botão com diferentes variantes e tamanhos</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
            <div>
              <h3 className="font-semibold text-slate-900 mb-4">Variantes</h3>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary">Primary Button</Button>
                <Button variant="secondary">Secondary Button</Button>
                <Button variant="outline">Outline Button</Button>
                <Button variant="danger">Danger Button</Button>
                <Button variant="ghost">Ghost Button</Button>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-4">Tamanhos</h3>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="small">Small</Button>
                <Button size="medium">Medium</Button>
                <Button size="large">Large</Button>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-4">Com Ícones</h3>
              <div className="flex flex-wrap items-center gap-3">
                <Button icon={<Plus className="w-4 h-4" />}>Adicionar</Button>
                <Button variant="secondary" icon={<Mail className="w-4 h-4" />}>Enviar Email</Button>
                <Button variant="outline" icon={<Calendar className="w-4 h-4" />}>Agendar</Button>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-4">Estados</h3>
              <div className="flex flex-wrap items-center gap-3">
                <Button loading>Loading</Button>
                <Button disabled>Disabled</Button>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-4">Icon Buttons</h3>
              <div className="flex flex-wrap items-center gap-3">
                <IconButton icon={<Settings className="w-5 h-5" />} />
                <IconButton icon={<Bell className="w-5 h-5" />} variant="primary" />
                <IconButton icon={<User className="w-5 h-5" />} variant="outline" />
              </div>
            </div>
          </div>
        </section>

        {/* Inputs */}
        <section id="inputs" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Inputs</h2>
            <p className="text-slate-600 dark:text-slate-400">Componentes de formulário padronizados</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Input 
                label="Text Input" 
                placeholder="Digite algo..."
                helperText="Texto de ajuda"
              />
              <Input 
                label="Input com Erro" 
                placeholder="Digite algo..."
                error="Este campo é obrigatório"
              />
              <EmailInput 
                label="Email Input" 
                placeholder="seu@email.com"
              />
              <PhoneInput 
                label="Phone Input" 
                placeholder="(11) 99999-9999"
              />
              <PasswordInput 
                label="Password Input" 
                placeholder="••••••••"
              />
              <SearchInput 
                label="Search Input" 
                placeholder="Buscar..."
              />
              <Input 
                label="Input Desabilitado" 
                placeholder="Desabilitado"
                disabled
              />
              <Input 
                label="Input com Ícone" 
                placeholder="Digite algo..."
                icon={<User className="w-5 h-5" />}
              />
            </div>
          </div>
        </section>

        {/* Selects */}
        <section id="selects" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Selects</h2>
            <p className="text-slate-600 dark:text-slate-400">Componentes de seleção com diferentes modos</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="grid md:grid-cols-2 gap-6">
              <Select
                label="Select Simples"
                options={selectOptions}
                value={selectedValue}
                onChange={(val) => setSelectedValue(val as string)}
                placeholder="Selecione uma opção"
              />
              <Select
                label="Select com Busca"
                options={selectOptions}
                value={selectedValue}
                onChange={(val) => setSelectedValue(val as string)}
                searchable
                placeholder="Buscar e selecionar"
              />
              <Select
                label="Multi Select"
                options={selectOptions}
                value={multipleValue}
                onChange={(val) => setMultipleValue(val as string[])}
                multiple
                placeholder="Selecione múltiplas opções"
              />
              <Select
                label="Select Desabilitado"
                options={selectOptions}
                disabled
                placeholder="Desabilitado"
              />
            </div>
          </div>
        </section>

        {/* Tables */}
        <section id="tables" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Tables</h2>
            <p className="text-slate-600 dark:text-slate-400">Tabelas de dados com ordenação e paginação</p>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-slate-900 mb-4">Tabela Padrão</h3>
              <Table
                columns={tableColumns}
                data={tableData}
                variant="default"
              />
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-4">Tabela Compacta</h3>
              <Table
                columns={tableColumns}
                data={tableData}
                variant="compact"
              />
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-4">Tabela Financeira</h3>
              <Table
                columns={tableColumns}
                data={tableData}
                variant="financial"
              />
            </div>
          </div>
        </section>

        {/* Cards */}
        <section id="cards" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Cards</h2>
            <p className="text-slate-600 dark:text-slate-400">Componentes de card para diferentes contextos</p>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-slate-900 mb-4">Dashboard Cards</h3>
              <div className="grid md:grid-cols-4 gap-4">
                <DashboardCard
                  title="Total de Membros"
                  value="1,234"
                  icon={<Users className="w-6 h-6" />}
                  change={{ value: 12, isPositive: true }}
                />
                <DashboardCard
                  title="Receita Mensal"
                  value="R$ 45.8K"
                  icon={<DollarSign className="w-6 h-6" />}
                  iconColor="bg-green-100 text-green-600"
                  change={{ value: 8, isPositive: true }}
                />
                <DashboardCard
                  title="Eventos"
                  value="23"
                  icon={<Calendar className="w-6 h-6" />}
                  iconColor="bg-blue-100 text-blue-600"
                  change={{ value: 5, isPositive: false }}
                />
                <DashboardCard
                  title="Taxa de Conversão"
                  value="68%"
                  icon={<TrendingUp className="w-6 h-6" />}
                  iconColor="bg-orange-100 text-orange-600"
                  change={{ value: 3, isPositive: true }}
                />
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-4">Member Cards</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <MemberCard
                  name="João Silva"
                  role="Pastor Principal"
                  email="joao@igreja.com"
                  phone="(11) 99999-9999"
                  status="active"
                />
                <MemberCard
                  name="Maria Santos"
                  role="Líder de Célula"
                  email="maria@igreja.com"
                  phone="(11) 98888-8888"
                  status="inactive"
                />
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-4">Lead Cards</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <LeadCard
                  name="Pedro Oliveira"
                  stage="Novo Lead"
                  responsible="João Silva"
                  lastActivity="2 horas atrás"
                  score={85}
                />
                <LeadCard
                  name="Ana Costa"
                  stage="Em Contato"
                  responsible="Maria Santos"
                  lastActivity="1 dia atrás"
                  score={65}
                />
                <LeadCard
                  name="Carlos Mendes"
                  stage="Convertido"
                  responsible="João Silva"
                  lastActivity="3 dias atrás"
                  score={95}
                />
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-4">Financial Summary Cards</h3>
              <div className="grid md:grid-cols-4 gap-4">
                <FinancialSummaryCard
                  title="Receita Total"
                  amount={45800}
                  color="purple"
                  change={{ value: 12, isPositive: true }}
                />
                <FinancialSummaryCard
                  title="Dízimos"
                  amount={32400}
                  color="blue"
                  change={{ value: 8, isPositive: true }}
                />
                <FinancialSummaryCard
                  title="Ofertas"
                  amount={13400}
                  color="green"
                  change={{ value: 15, isPositive: true }}
                />
                <FinancialSummaryCard
                  title="Despesas"
                  amount={18200}
                  color="red"
                  change={{ value: 5, isPositive: false }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Modals */}
        <section id="modals" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Modals</h2>
            <p className="text-slate-600 dark:text-slate-400">Componentes de modal para diferentes interações</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setModalOpen(true)}>
                Abrir Modal Padrão
              </Button>
              <Button variant="secondary" onClick={() => setFormModalOpen(true)}>
                Abrir Form Modal
              </Button>
              <Button variant="danger" onClick={() => setConfirmModalOpen(true)}>
                Abrir Confirmation Modal
              </Button>
            </div>

            <Modal
              isOpen={modalOpen}
              onClose={() => setModalOpen(false)}
              title="Modal Padrão"
            >
              <p className="text-slate-600 dark:text-slate-400">
                Este é um modal padrão com conteúdo personalizado.
                Você pode adicionar qualquer conteúdo aqui.
              </p>
            </Modal>

            <FormModal
              isOpen={formModalOpen}
              onClose={() => setFormModalOpen(false)}
              title="Formulário de Exemplo"
              onSubmit={() => {
                console.log('Form submitted');
                setFormModalOpen(false);
              }}
              onCancel={() => setFormModalOpen(false)}
            >
              <Input label="Nome" placeholder="Digite seu nome" />
              <EmailInput label="Email" placeholder="seu@email.com" />
            </FormModal>

            <ConfirmationModal
              isOpen={confirmModalOpen}
              onClose={() => setConfirmModalOpen(false)}
              onConfirm={() => {
                console.log('Confirmed');
                setConfirmModalOpen(false);
              }}
              title="Confirmar Ação"
              message="Tem certeza que deseja realizar esta ação? Esta operação não pode ser desfeita."
              variant="danger"
              confirmLabel="Sim, confirmar"
              cancelLabel="Cancelar"
            />
          </div>
        </section>

        {/* Badges */}
        <section id="badges" className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Badges</h2>
            <p className="text-slate-600 dark:text-slate-400">Indicadores de status e categorias</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
            <div>
              <h3 className="font-semibold text-slate-900 mb-4">Status Badges</h3>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status="active" />
                <StatusBadge status="pending" />
                <StatusBadge status="inactive" />
                <StatusBadge status="completed" />
                <StatusBadge status="cancelled" />
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-4">Tamanhos</h3>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="active" size="small">Small</Badge>
                <Badge variant="active" size="medium">Medium</Badge>
                <Badge variant="active" size="large">Large</Badge>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-4">Variantes</h3>
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="success">Success</Badge>
                <Badge variant="error">Error</Badge>
                <Badge variant="warning">Warning</Badge>
                <Badge variant="info">Info</Badge>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 text-center">
          <p className="text-slate-600 dark:text-slate-400">
            MRM Design System • Versão 1.0 • 
            <Link to="/documentation" className="text-purple-600 hover:text-purple-700 ml-1">
              Voltar para Documentação
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}