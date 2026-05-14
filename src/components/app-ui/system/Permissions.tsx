import { Shield, Save, Users, Lock, Eye, Edit, Trash2, Plus, Check, X } from 'lucide-react';
import { useState } from 'react';

const roles = [
  { id: 1, name: 'Administrador', color: 'purple' },
  { id: 2, name: 'Pastor', color: 'blue' },
  { id: 3, name: 'Líder', color: 'green' },
  { id: 4, name: 'Secretário', color: 'orange' },
  { id: 5, name: 'Tesoureiro', color: 'cyan' },
  { id: 6, name: 'Membro', color: 'slate' },
];

const permissions = [
  {
    module: 'Secretaria',
    items: [
      { id: 'members_view', name: 'Visualizar Membros', description: 'Ver lista e perfis de membros' },
      { id: 'members_create', name: 'Criar Membros', description: 'Adicionar novos membros' },
      { id: 'members_edit', name: 'Editar Membros', description: 'Modificar dados de membros' },
      { id: 'members_delete', name: 'Excluir Membros', description: 'Remover membros do sistema' },
    ]
  },
  {
    module: 'Financeiro',
    items: [
      { id: 'finance_view', name: 'Visualizar Finanças', description: 'Ver relatórios financeiros' },
      { id: 'finance_income', name: 'Lançar Receitas', description: 'Registrar entradas' },
      { id: 'finance_expense', name: 'Lançar Despesas', description: 'Registrar saídas' },
      { id: 'finance_reports', name: 'Relatórios Financeiros', description: 'Gerar relatórios' },
    ]
  },
  {
    module: 'CRM',
    items: [
      { id: 'crm_view', name: 'Visualizar Leads', description: 'Ver pipeline e leads' },
      { id: 'crm_create', name: 'Criar Leads', description: 'Adicionar novos leads' },
      { id: 'crm_edit', name: 'Editar Leads', description: 'Modificar leads' },
      { id: 'crm_assign', name: 'Atribuir Leads', description: 'Distribuir leads' },
    ]
  },
  {
    module: 'Eventos',
    items: [
      { id: 'events_view', name: 'Visualizar Eventos', description: 'Ver calendário e eventos' },
      { id: 'events_create', name: 'Criar Eventos', description: 'Adicionar eventos' },
      { id: 'events_edit', name: 'Editar Eventos', description: 'Modificar eventos' },
      { id: 'events_checkin', name: 'Check-in', description: 'Realizar check-in' },
    ]
  },
  {
    module: 'Comunicação',
    items: [
      { id: 'comm_whatsapp', name: 'WhatsApp', description: 'Enviar mensagens WhatsApp' },
      { id: 'comm_email', name: 'Email', description: 'Enviar campanhas de email' },
      { id: 'comm_sms', name: 'SMS', description: 'Enviar SMS' },
      { id: 'comm_broadcast', name: 'Broadcast', description: 'Mensagens em massa' },
    ]
  },
  {
    module: 'Sistema',
    items: [
      { id: 'system_users', name: 'Gerenciar Usuários', description: 'CRUD de usuários' },
      { id: 'system_roles', name: 'Gerenciar Funções', description: 'CRUD de funções' },
      { id: 'system_settings', name: 'Configurações', description: 'Alterar configurações' },
      { id: 'system_audit', name: 'Log de Auditoria', description: 'Ver logs do sistema' },
    ]
  },
];

export function Permissions() {
  const [permissionMatrix, setPermissionMatrix] = useState<Record<string, Record<string, boolean>>>(() => {
    const initial: Record<string, Record<string, boolean>> = {};
    
    // Admin tem tudo
    initial['1'] = {};
    permissions.forEach(module => {
      module.items.forEach(item => {
        initial['1'][item.id] = true;
      });
    });

    // Pastor tem quase tudo
    initial['2'] = {};
    permissions.forEach(module => {
      module.items.forEach(item => {
        initial['2'][item.id] = !item.id.includes('delete') && !item.id.includes('system');
      });
    });

    // Líder tem acesso moderado
    initial['3'] = {};
    permissions.forEach(module => {
      module.items.forEach(item => {
        initial['3'][item.id] = item.id.includes('view') || item.id.includes('crm') || item.id.includes('events');
      });
    });

    // Secretário tem acesso a membros e eventos
    initial['4'] = {};
    permissions.forEach(module => {
      module.items.forEach(item => {
        initial['4'][item.id] = item.id.includes('members') || item.id.includes('events');
      });
    });

    // Tesoureiro só financeiro
    initial['5'] = {};
    permissions.forEach(module => {
      module.items.forEach(item => {
        initial['5'][item.id] = item.id.includes('finance');
      });
    });

    // Membro só visualização
    initial['6'] = {};
    permissions.forEach(module => {
      module.items.forEach(item => {
        initial['6'][item.id] = item.id.includes('view');
      });
    });

    return initial;
  });

  const togglePermission = (roleId: string, permissionId: string) => {
    setPermissionMatrix(prev => ({
      ...prev,
      [roleId]: {
        ...prev[roleId],
        [permissionId]: !prev[roleId]?.[permissionId]
      }
    }));
  };

  const toggleAllForRole = (roleId: string) => {
    const allPermissions = permissions.flatMap(m => m.items.map(i => i.id));
    const hasAll = allPermissions.every(p => permissionMatrix[roleId]?.[p]);
    
    setPermissionMatrix(prev => ({
      ...prev,
      [roleId]: Object.fromEntries(allPermissions.map(p => [p, !hasAll]))
    }));
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Matriz de Permissões</h1>
            <p className="text-slate-600 dark:text-slate-400">Configure o que cada função pode fazer no sistema</p>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <p className="font-semibold text-blue-900 mb-1">Como usar a Matriz de Permissões</p>
            <p className="text-sm text-blue-700">
              Clique nos checkboxes para habilitar ou desabilitar permissões específicas para cada função. 
              Use o switch no cabeçalho da coluna para habilitar/desabilitar todas as permissões de uma função.
            </p>
          </div>
        </div>
      </div>

      {/* Permission Matrix */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[300px_repeat(6,1fr)] border-b border-slate-200 bg-slate-50">
          <div className="p-4 font-bold text-slate-900 flex items-center gap-2">
            <Lock className="w-5 h-5 text-slate-600" />
            Permissão
          </div>
          {roles.map(role => (
            <div key={role.id} className="p-4 text-center border-l border-slate-200">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-${role.color}-100 text-${role.color}-700 mb-2`}>
                <Users className="w-4 h-4" />
                <span className="font-semibold text-sm">{role.name}</span>
              </div>
              <div className="flex justify-center">
                <button
                  onClick={() => toggleAllForRole(role.id.toString())}
                  className="text-xs text-purple-600 hover:text-purple-700 font-medium"
                >
                  Alternar Todos
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Permission Rows */}
        {permissions.map((module, moduleIndex) => (
          <div key={module.module}>
            {/* Module Header */}
            <div className="bg-slate-100 px-4 py-2 border-b border-slate-200">
              <p className="font-bold text-slate-900">{module.module}</p>
            </div>

            {/* Permission Items */}
            {module.items.map((item, itemIndex) => (
              <div
                key={item.id}
                className={`grid grid-cols-[300px_repeat(6,1fr)] border-b border-slate-200 hover:bg-slate-50 transition-colors ${
                  itemIndex === module.items.length - 1 && moduleIndex === permissions.length - 1 ? 'border-b-0' : ''
                }`}
              >
                <div className="p-4">
                  <p className="font-medium text-slate-900">{item.name}</p>
                  <p className="text-sm text-slate-500">{item.description}</p>
                </div>
                {roles.map(role => (
                  <div key={role.id} className="p-4 border-l border-slate-200 flex items-center justify-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permissionMatrix[role.id.toString()]?.[item.id] || false}
                        onChange={() => togglePermission(role.id.toString(), item.id)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-3 mt-6">
        <button className="px-6 py-2.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
          Cancelar
        </button>
        <button className="flex items-center gap-2 bg-purple-600 text-white px-6 py-2.5 rounded-lg hover:bg-purple-700 transition-colors">
          <Save className="w-5 h-5" />
          Salvar Permissões
        </button>
      </div>
    </div>
  );
}
