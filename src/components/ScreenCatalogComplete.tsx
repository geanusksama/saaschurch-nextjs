import { Link } from 'react-router';
import { 
  Layout, Users, DollarSign, Calendar, MessageSquare, Heart, Settings, 
  Zap, BarChart3, FileText, Globe, Shield, CheckSquare, UserPlus,
  Mail, Phone, Building2, Gift, BookOpen, Target, TrendingUp, Clock
} from 'lucide-react';

const screenCategories = [
  {
    id: 'public-website',
    name: 'Site Público',
    icon: Globe,
    color: 'bg-blue-500',
    totalScreens: 15,
    done: 15
  },
  {
    id: 'auth',
    name: 'Autenticação',
    icon: Shield,
    color: 'bg-purple-500',
    totalScreens: 8,
    done: 8
  },
  {
    id: 'dashboard',
    name: 'Dashboards',
    icon: Layout,
    color: 'bg-green-500',
    totalScreens: 6,
    done: 6
  },
  {
    id: 'members',
    name: 'Gestão de Membros',
    icon: Users,
    color: 'bg-blue-600',
    totalScreens: 15,
    done: 15
  },
  {
    id: 'pastoral',
    name: 'Gestão Pastoral',
    icon: Heart,
    color: 'bg-pink-500',
    totalScreens: 13,
    done: 13
  },
  {
    id: 'ecclesiastical',
    name: 'Processos Eclesiásticos',
    icon: CheckSquare,
    color: 'bg-indigo-500',
    totalScreens: 13,
    done: 13
  },
  {
    id: 'crm',
    name: 'CRM',
    icon: Target,
    color: 'bg-orange-500',
    totalScreens: 16,
    done: 16
  },
  {
    id: 'automation',
    name: 'Automações',
    icon: Zap,
    color: 'bg-yellow-500',
    totalScreens: 9,
    done: 9
  },
  {
    id: 'finance',
    name: 'Tesouraria',
    icon: DollarSign,
    color: 'bg-green-600',
    totalScreens: 15,
    done: 15
  },
  {
    id: 'events',
    name: 'Gestão de Eventos',
    icon: Calendar,
    color: 'bg-red-500',
    totalScreens: 14,
    done: 14
  },
  {
    id: 'checkin',
    name: 'Sistema de Check-in',
    icon: CheckSquare,
    color: 'bg-teal-500',
    totalScreens: 8,
    done: 8
  },
  {
    id: 'communication',
    name: 'Comunicação',
    icon: MessageSquare,
    color: 'bg-cyan-500',
    totalScreens: 14,
    done: 14
  },
  {
    id: 'ministries',
    name: 'Ministérios',
    icon: Building2,
    color: 'bg-violet-500',
    totalScreens: 9,
    done: 9
  },
  {
    id: 'cells',
    name: 'Células',
    icon: Users,
    color: 'bg-lime-500',
    totalScreens: 9,
    done: 9
  },
  {
    id: 'reports',
    name: 'Relatórios e Analytics',
    icon: BarChart3,
    color: 'bg-emerald-500',
    totalScreens: 10,
    done: 10
  },
  {
    id: 'system',
    name: 'Configurações',
    icon: Settings,
    color: 'bg-gray-600',
    totalScreens: 17,
    done: 17
  },
  {
    id: 'multi-church',
    name: 'Multi-Igreja',
    icon: Building2,
    color: 'bg-slate-600',
    totalScreens: 5,
    done: 5
  }
];

export function ScreenCatalogComplete() {
  const totalScreens = screenCategories.reduce((acc, cat) => acc + cat.totalScreens, 0);
  const doneScreens = screenCategories.reduce((acc, cat) => acc + cat.done, 0);

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">✅ Catálogo Completo - MRM (100% CONCLUÍDO)</h1>
        <p className="text-lg text-slate-600 mb-6">
          Sistema completo de gestão de igreja com TODAS as {totalScreens} telas implementadas! 🎉
        </p>
        
        {/* Progress */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border-2 border-green-500 p-8 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-sm text-slate-600 mb-1">Total de Telas</p>
              <p className="text-5xl font-bold text-slate-900">{totalScreens}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-1">Implementadas</p>
              <p className="text-5xl font-bold text-green-600">{doneScreens}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-1">Planejadas</p>
              <p className="text-5xl font-bold text-slate-400">0</p>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-1">Progresso</p>
              <p className="text-6xl font-bold text-green-600">
                100%
              </p>
            </div>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-6">
            <div 
              className="bg-gradient-to-r from-green-500 to-emerald-500 h-6 rounded-full transition-all flex items-center justify-center text-white font-bold"
              style={{ width: '100%' }}
            >
              🎉 PROJETO COMPLETO! 🎉
            </div>
          </div>
          
          <div className="mt-6 text-center">
            <p className="text-lg font-semibold text-green-700">
              🏆 Todas as {totalScreens} telas foram implementadas com sucesso! 🏆
            </p>
          </div>
        </div>
      </div>

      {/* Categories Summary */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        {screenCategories.map((category) => {
          const Icon = category.icon;
          const progress = (category.done / category.totalScreens) * 100;
          
          return (
            <div key={category.id} className="bg-white rounded-xl border-2 border-green-400 overflow-hidden shadow-lg hover:shadow-xl transition-all">
              <div className={`p-6 ${category.color} bg-opacity-10 border-b-2 border-green-300`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 ${category.color} rounded-xl flex items-center justify-center text-white`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900">{category.name}</h3>
                      <p className="text-sm text-slate-600">{category.totalScreens} telas</p>
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-green-600">✓</div>
                </div>
              </div>
              
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-slate-700">Progresso</span>
                  <span className="text-2xl font-bold text-green-600">{progress.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-3">
                  <div 
                    className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-green-600 font-semibold">
                    ✓ {category.done}/{category.totalScreens} telas
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Feature Highlights */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-500 rounded-xl p-8 text-white mb-8">
        <h2 className="text-2xl font-bold mb-6 text-center">🚀 Recursos Implementados</h2>
        <div className="grid md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-4xl mb-2">🏢</div>
            <div className="text-2xl font-bold mb-1">{screenCategories.length}</div>
            <div className="text-purple-100">Módulos Principais</div>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-2">📱</div>
            <div className="text-2xl font-bold mb-1">{totalScreens}+</div>
            <div className="text-purple-100">Telas Funcionais</div>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-2">⚡</div>
            <div className="text-2xl font-bold mb-1">100%</div>
            <div className="text-purple-100">Navegável</div>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-2">✨</div>
            <div className="text-2xl font-bold mb-1">React</div>
            <div className="text-purple-100">+ Tailwind CSS</div>
          </div>
        </div>
      </div>

      {/* Modules List */}
      <div className="bg-white rounded-xl border border-slate-200 p-8">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Módulos Completos</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {screenCategories.map((cat) => {
            const Icon = cat.icon;
            return (
              <div key={cat.id} className="flex items-center gap-3 p-4 bg-green-50 border border-green-300 rounded-lg">
                <div className={`w-10 h-10 ${cat.color} rounded-lg flex items-center justify-center text-white flex-shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-slate-900">{cat.name}</div>
                  <div className="text-sm text-slate-600">{cat.totalScreens} telas implementadas</div>
                </div>
                <div className="text-2xl text-green-600">✓</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
