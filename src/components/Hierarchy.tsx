import { useState } from 'react';
import { Building2, ChevronDown, ChevronRight, Users, Shield, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChurchNode {
  id: string;
  name: string;
  type: 'field' | 'regional' | 'church';
  members: number;
  children?: ChurchNode[];
}

interface Role {
  id: string;
  name: string;
  level: 'field' | 'regional' | 'church' | 'all';
  permissions: {
    module: string;
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
  }[];
}

const churchHierarchy: ChurchNode = {
  id: 'field-1',
  name: 'Campo Nacional',
  type: 'field',
  members: 15420,
  children: [
    {
      id: 'regional-1',
      name: 'Regional Norte',
      type: 'regional',
      members: 8200,
      children: [
        { id: 'church-1', name: 'Sede Principal', type: 'church', members: 3500 },
        { id: 'church-2', name: 'Campus Norte', type: 'church', members: 2100 },
        { id: 'church-3', name: 'Campus Leste', type: 'church', members: 1800 },
        { id: 'church-4', name: 'Campus Oeste', type: 'church', members: 800 },
      ],
    },
    {
      id: 'regional-2',
      name: 'Regional Sul',
      type: 'regional',
      members: 5120,
      children: [
        { id: 'church-5', name: 'Igreja Centro', type: 'church', members: 2400 },
        { id: 'church-6', name: 'Igreja Subúrbio', type: 'church', members: 1900 },
        { id: 'church-7', name: 'Igreja Comunidade', type: 'church', members: 820 },
      ],
    },
    {
      id: 'regional-3',
      name: 'Regional Central',
      type: 'regional',
      members: 2100,
      children: [
        { id: 'church-8', name: 'Capela Central', type: 'church', members: 1200 },
        { id: 'church-9', name: 'Igreja Cidade', type: 'church', members: 900 },
      ],
    },
  ],
};

const roles: Role[] = [
  {
    id: 'field-admin',
    name: 'Administrador de Campo',
    level: 'field',
    permissions: [
      { module: 'Dashboard', view: true, create: true, edit: true, delete: true },
      { module: 'Secretaria', view: true, create: true, edit: true, delete: true },
      { module: 'CRM', view: true, create: true, edit: true, delete: true },
      { module: 'Financeiro', view: true, create: true, edit: true, delete: true },
      { module: 'Ministérios', view: true, create: true, edit: true, delete: true },
      { module: 'Comunicação', view: true, create: true, edit: true, delete: true },
      { module: 'Eventos', view: true, create: true, edit: true, delete: true },
      { module: 'Sistema', view: true, create: true, edit: true, delete: true },
    ],
  },
  {
    id: 'regional-pastor',
    name: 'Pastor Regional',
    level: 'regional',
    permissions: [
      { module: 'Dashboard', view: true, create: true, edit: true, delete: false },
      { module: 'Secretaria', view: true, create: true, edit: true, delete: false },
      { module: 'CRM', view: true, create: true, edit: true, delete: false },
      { module: 'Financeiro', view: true, create: false, edit: false, delete: false },
      { module: 'Ministérios', view: true, create: true, edit: true, delete: false },
      { module: 'Comunicação', view: true, create: true, edit: true, delete: false },
      { module: 'Eventos', view: true, create: true, edit: true, delete: false },
      { module: 'Sistema', view: true, create: false, edit: false, delete: false },
    ],
  },
  {
    id: 'church-pastor',
    name: 'Pastor de Igreja',
    level: 'church',
    permissions: [
      { module: 'Dashboard', view: true, create: true, edit: true, delete: false },
      { module: 'Secretaria', view: true, create: true, edit: true, delete: false },
      { module: 'CRM', view: true, create: true, edit: true, delete: false },
      { module: 'Financeiro', view: true, create: true, edit: false, delete: false },
      { module: 'Ministérios', view: true, create: true, edit: true, delete: false },
      { module: 'Comunicação', view: true, create: true, edit: false, delete: false },
      { module: 'Eventos', view: true, create: true, edit: true, delete: false },
      { module: 'Sistema', view: false, create: false, edit: false, delete: false },
    ],
  },
  {
    id: 'secretary',
    name: 'Secretário(a) da Igreja',
    level: 'church',
    permissions: [
      { module: 'Dashboard', view: true, create: false, edit: false, delete: false },
      { module: 'Secretaria', view: true, create: true, edit: true, delete: false },
      { module: 'CRM', view: true, create: true, edit: true, delete: false },
      { module: 'Financeiro', view: true, create: true, edit: false, delete: false },
      { module: 'Ministérios', view: true, create: false, edit: false, delete: false },
      { module: 'Comunicação', view: true, create: true, edit: false, delete: false },
      { module: 'Eventos', view: true, create: true, edit: true, delete: false },
      { module: 'Sistema', view: false, create: false, edit: false, delete: false },
    ],
  },
  {
    id: 'treasurer',
    name: 'Tesoureiro(a)',
    level: 'church',
    permissions: [
      { module: 'Dashboard', view: true, create: false, edit: false, delete: false },
      { module: 'Secretaria', view: true, create: false, edit: false, delete: false },
      { module: 'CRM', view: false, create: false, edit: false, delete: false },
      { module: 'Financeiro', view: true, create: true, edit: true, delete: false },
      { module: 'Ministérios', view: true, create: false, edit: false, delete: false },
      { module: 'Comunicação', view: false, create: false, edit: false, delete: false },
      { module: 'Eventos', view: true, create: false, edit: false, delete: false },
      { module: 'Sistema', view: false, create: false, edit: false, delete: false },
    ],
  },
  {
    id: 'ministry-leader',
    name: 'Líder de Ministério',
    level: 'church',
    permissions: [
      { module: 'Dashboard', view: true, create: false, edit: false, delete: false },
      { module: 'Secretaria', view: true, create: false, edit: false, delete: false },
      { module: 'CRM', view: true, create: true, edit: false, delete: false },
      { module: 'Financeiro', view: false, create: false, edit: false, delete: false },
      { module: 'Ministérios', view: true, create: true, edit: true, delete: false },
      { module: 'Comunicação', view: true, create: true, edit: false, delete: false },
      { module: 'Eventos', view: true, create: true, edit: true, delete: false },
      { module: 'Sistema', view: false, create: false, edit: false, delete: false },
    ],
  },
];

function ChurchTreeNode({ node, level = 0 }: { node: ChurchNode; level?: number }) {
  const [isExpanded, setIsExpanded] = useState(level < 2);

  const colorMap = {
    field: 'from-purple-500 to-indigo-600',
    regional: 'from-blue-500 to-cyan-600',
    church: 'from-green-500 to-emerald-600',
  };

  const bgColorMap = {
    field: 'bg-purple-50',
    regional: 'bg-blue-50',
    church: 'bg-green-50',
  };

  const labelMap = {
    field: 'CAMPO',
    regional: 'REGIONAL',
    church: 'IGREJA',
  };

  return (
    <div className={level > 0 ? 'ml-6' : ''}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center gap-3 p-4 rounded-lg ${bgColorMap[node.type]} border-2 border-transparent hover:border-slate-300 transition-all mb-2`}
      >
        {node.children && (
          <div>
            {isExpanded ? (
              <ChevronDown className="w-5 h-5 text-slate-600" />
            ) : (
              <ChevronRight className="w-5 h-5 text-slate-600" />
            )}
          </div>
        )}
        <div className={`w-12 h-12 bg-gradient-to-br ${colorMap[node.type]} rounded-lg flex items-center justify-center`}>
          <Building2 className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900">{node.name}</h3>
            <span className="text-xs bg-white px-2 py-1 rounded text-slate-600 font-medium uppercase">
              {labelMap[node.type]}
            </span>
          </div>
          <p className="text-sm text-slate-600">{node.members.toLocaleString()} membros</p>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && node.children && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {node.children.map((child) => (
              <ChurchTreeNode key={child.id} node={child} level={level + 1} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PermissionIcon({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <Check className="w-4 h-4 text-green-600" />
  ) : (
    <X className="w-4 h-4 text-slate-300" />
  );
}

export function Hierarchy() {
  const [selectedRole, setSelectedRole] = useState<string>(roles[0].id);
  const currentRole = roles.find(r => r.id === selectedRole) || roles[0];

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Hierarquia do Sistema</h1>
        <p className="text-slate-600 dark:text-slate-400">Estrutura organizacional multi-igreja e permissões baseadas em funções</p>
      </div>

      {/* Church Hierarchy */}
      <section className="mb-12">
        <h2 className="text-xl font-bold text-slate-900 mb-6">Estrutura Multi-Igreja</h2>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-100 to-blue-100 px-4 py-2 rounded-lg">
              <Building2 className="w-5 h-5 text-purple-600" />
              <span className="font-semibold text-purple-900">Campo → Regional → Igreja</span>
            </div>
          </div>
          <ChurchTreeNode node={churchHierarchy} />
        </div>

        {/* Hierarchy Stats */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-lg p-4">
            <p className="text-sm text-slate-600 mb-1">Nível de Campo</p>
            <p className="text-2xl font-bold text-slate-900">1</p>
            <p className="text-xs text-slate-500">Coordenação nacional</p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg p-4">
            <p className="text-sm text-slate-600 mb-1">Escritórios Regionais</p>
            <p className="text-2xl font-bold text-slate-900">3</p>
            <p className="text-xs text-slate-500">Regiões geográficas</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4">
            <p className="text-sm text-slate-600 mb-1">Igrejas Locais</p>
            <p className="text-2xl font-bold text-slate-900">9</p>
            <p className="text-xs text-slate-500">Congregações individuais</p>
          </div>
        </div>
      </section>

      {/* Church Switcher Feature */}
      <section className="mb-12">
        <h2 className="text-xl font-bold text-slate-900 mb-6">Modal de Seleção de Igreja</h2>
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="max-w-md">
            <p className="text-sm text-slate-600 mb-4">
              Usuários podem alternar rapidamente seu contexto entre diferentes níveis de igreja usando um seletor modal:
            </p>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-5 h-5 text-purple-600" />
                <h3 className="font-bold text-slate-900">Alternar Contexto da Igreja</h3>
              </div>
              <div className="space-y-2">
                <button className="w-full text-left px-3 py-2 bg-white hover:bg-purple-50 rounded-lg border border-slate-200 hover:border-purple-300 transition-colors">
                  <div className="font-medium text-slate-900">Campo Nacional</div>
                  <div className="text-xs text-slate-500">Ver todas as regionais e igrejas</div>
                </button>
                <button className="w-full text-left px-3 py-2 bg-purple-50 rounded-lg border-2 border-purple-600">
                  <div className="font-medium text-purple-900">Regional Norte</div>
                  <div className="text-xs text-purple-600">Seleção atual • 4 igrejas</div>
                </button>
                <button className="w-full text-left px-3 py-2 bg-white hover:bg-purple-50 rounded-lg border border-slate-200 hover:border-purple-300 transition-colors">
                  <div className="font-medium text-slate-900">Sede Principal</div>
                  <div className="text-xs text-slate-500">Visão de igreja individual</div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Role-Based Permissions */}
      <section>
        <h2 className="text-xl font-bold text-slate-900 mb-6">Controle de Acesso Baseado em Funções</h2>
        
        {/* Role Selector */}
        <div className="mb-6 flex flex-wrap gap-2">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelectedRole(role.id)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedRole === role.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:border-purple-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                {role.name}
              </div>
            </button>
          ))}
        </div>

        {/* Permissions Matrix */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-6 py-4 font-bold text-slate-900">
                    {currentRole.name}
                    <span className="ml-2 text-xs font-normal bg-purple-100 text-purple-700 px-2 py-1 rounded uppercase">
                      {currentRole.level === 'field' ? 'CAMPO' : currentRole.level === 'regional' ? 'REGIONAL' : 'IGREJA'}
                    </span>
                  </th>
                  <th className="px-6 py-4 text-center font-semibold text-slate-700">Ver</th>
                  <th className="px-6 py-4 text-center font-semibold text-slate-700">Criar</th>
                  <th className="px-6 py-4 text-center font-semibold text-slate-700">Editar</th>
                  <th className="px-6 py-4 text-center font-semibold text-slate-700">Excluir</th>
                </tr>
              </thead>
              <tbody>
                {currentRole.permissions.map((perm, index) => (
                  <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-6 py-4 font-medium text-slate-900">{perm.module}</td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center">
                        <PermissionIcon allowed={perm.view} />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center">
                        <PermissionIcon allowed={perm.create} />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center">
                        <PermissionIcon allowed={perm.edit} />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center">
                        <PermissionIcon allowed={perm.delete} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Data Scope Info */}
      <div className="mt-12 grid md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl p-6">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6 text-purple-600" />
          </div>
          <h3 className="font-bold text-slate-900 mb-2">Acesso Nível de Campo</h3>
          <p className="text-sm text-slate-600">
            Administradores de campo veem todos os dados de todos os escritórios regionais e igrejas
          </p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="font-bold text-slate-900 mb-2">Acesso Nível Regional</h3>
          <p className="text-sm text-slate-600">
            Pastores regionais veem dados de todas as igrejas dentro de sua região atribuída
          </p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="font-bold text-slate-900 mb-2">Acesso Nível de Igreja</h3>
          <p className="text-sm text-slate-600">
            Equipe da igreja vê apenas dados de sua igreja local específica
          </p>
        </div>
      </div>
    </div>
  );
}
