import { Users, Shield, Settings, Zap, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

const users = [
  { id: '1', name: 'Pastor Silva', email: 'pastor@igreja.com', role: 'Administrador', status: 'ativo', lastLogin: '2024-03-14' },
  { id: '2', name: 'Maria Santos', email: 'maria@igreja.com', role: 'Secretária', status: 'ativo', lastLogin: '2024-03-14' },
  { id: '3', name: 'João Pedro', email: 'joao@igreja.com', role: 'Tesoureiro', status: 'ativo', lastLogin: '2024-03-13' },
  { id: '4', name: 'Ana Costa', email: 'ana@igreja.com', role: 'Líder de Ministério', status: 'ativo', lastLogin: '2024-03-12' },
];

const roles = [
  { id: '1', name: 'Administrador de Campo', level: 'Campo', users: 2, permissions: 'Acesso total' },
  { id: '2', name: 'Pastor Regional', level: 'Regional', users: 5, permissions: 'Gestão regional' },
  { id: '3', name: 'Pastor de Igreja', level: 'Igreja', users: 12, permissions: 'Gestão de igreja' },
  { id: '4', name: 'Secretário(a)', level: 'Igreja', users: 8, permissions: 'Secretaria e membros' },
  { id: '5', name: 'Tesoureiro(a)', level: 'Igreja', users: 6, permissions: 'Apenas financeiro' },
  { id: '6', name: 'Líder de Ministério', level: 'Igreja', users: 25, permissions: 'Ministérios e eventos' },
];

const permissions = [
  { module: 'Dashboard', view: true, create: true, edit: true, delete: true },
  { module: 'Secretaria', view: true, create: true, edit: true, delete: false },
  { module: 'CRM', view: true, create: true, edit: true, delete: false },
  { module: 'Financeiro', view: true, create: false, edit: false, delete: false },
  { module: 'Ministérios', view: true, create: true, edit: true, delete: false },
  { module: 'Comunicação', view: true, create: true, edit: false, delete: false },
  { module: 'Eventos', view: true, create: true, edit: true, delete: false },
  { module: 'Sistema', view: false, create: false, edit: false, delete: false },
];

export function System() {
  const [activeTab, setActiveTab] = useState<'users' | 'roles' | 'permissions' | 'automation'>('users');

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
            <Settings className="w-6 h-6 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Configurações do Sistema</h1>
            <p className="text-slate-600 dark:text-slate-400">Gerencie usuários, funções e permissões</p>
          </div>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium">
          <Plus className="w-5 h-5" />
          Novo Usuário
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Link to="/app-ui/system-settings" className="bg-white rounded-xl border border-slate-200 p-6 hover:border-purple-300 hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Total de Usuários</p>
              <p className="text-2xl font-bold text-slate-900">58</p>
            </div>
          </div>
        </Link>

        <Link to="/app-ui/configuration-center" className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-200 p-6 hover:border-purple-300 hover:shadow-md transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
              <Settings className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-purple-700 font-medium">Centro de Configuração</p>
              <p className="text-2xl font-bold text-purple-900">50+ módulos</p>
            </div>
          </div>
        </Link>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Funções Ativas</p>
              <p className="text-2xl font-bold text-slate-900">6</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Automações</p>
              <p className="text-2xl font-bold text-slate-900">12</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-6 py-2.5 rounded-lg font-medium ${
            activeTab === 'users' ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          Usuários
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-6 py-2.5 rounded-lg font-medium ${
            activeTab === 'roles' ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          Funções
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          className={`px-6 py-2.5 rounded-lg font-medium ${
            activeTab === 'permissions' ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          Permissões
        </button>
        <button
          onClick={() => setActiveTab('automation')}
          className={`px-6 py-2.5 rounded-lg font-medium ${
            activeTab === 'automation' ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          Automação
        </button>
      </div>

      {/* Users Table */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Usuário</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Email</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Função</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Status</th>
                  <th className="text-left px-6 py-4 text-sm font-semibold text-slate-700">Último Acesso</th>
                  <th className="text-right px-6 py-4 text-sm font-semibold text-slate-700">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-700 font-semibold">
                          {user.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span className="font-semibold text-slate-900">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-700">{user.email}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                        Ativo
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      {new Date(user.lastLogin).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="px-4 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded-lg">
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Roles */}
      {activeTab === 'roles' && (
        <div className="grid md:grid-cols-2 gap-6">
          {roles.map((role) => (
            <div key={role.id} className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">{role.name}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Nível: {role.level}</p>
                </div>
                <Shield className="w-6 h-6 text-purple-600" />
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Usuários</span>
                  <span className="font-semibold text-slate-900">{role.users}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Permissões</span>
                  <span className="font-semibold text-slate-900">{role.permissions}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="flex-1 py-2 border border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 font-medium">
                  Ver Detalhes
                </button>
                <button className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">
                  Editar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Permissions Matrix */}
      {activeTab === 'permissions' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-900">Matriz de Permissões - Pastor de Igreja</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-6 py-4 font-semibold text-slate-900">Módulo</th>
                  <th className="text-center px-6 py-4 font-semibold text-slate-700">Ver</th>
                  <th className="text-center px-6 py-4 font-semibold text-slate-700">Criar</th>
                  <th className="text-center px-6 py-4 font-semibold text-slate-700">Editar</th>
                  <th className="text-center px-6 py-4 font-semibold text-slate-700">Excluir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {permissions.map((perm, index) => (
                  <tr key={index} className="hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{perm.module}</td>
                    <td className="px-6 py-4 text-center">
                      <input type="checkbox" readOnly checked={perm.view} className="w-5 h-5 rounded text-purple-600" />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <input type="checkbox" readOnly checked={perm.create} className="w-5 h-5 rounded text-purple-600" />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <input type="checkbox" readOnly checked={perm.edit} className="w-5 h-5 rounded text-purple-600" />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <input type="checkbox" readOnly checked={perm.delete} className="w-5 h-5 rounded text-purple-600" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Automation */}
      {activeTab === 'automation' && (
        <div className="space-y-6">
          {['Bem-vindo a Novos Visitantes', 'Lembrete de Culto Semanal', 'Aniversário de Membros', 'Follow-up de Visitantes'].map((auto, index) => (
            <div key={index} className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                    <Zap className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{auto}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400">Automação ativa</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" readOnly checked className="sr-only peer" />
                    <div className="w-11 h-6 bg-purple-600 rounded-full peer peer-focus:ring-4 peer-focus:ring-purple-300"></div>
                    <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-5"></div>
                  </label>
                  <button className="px-4 py-2 text-sm font-medium text-purple-600 hover:bg-purple-50 rounded-lg">
                    Editar
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}