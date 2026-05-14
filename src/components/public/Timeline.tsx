import { Calendar, MapPin, Users, Building2 } from 'lucide-react';
import { Link } from 'react-router';

const milestones = [
  {
    year: 1990,
    title: 'Fundação da Igreja',
    description: 'Primeira reunião com 12 pessoas na casa do Pr. João Silva',
    location: 'São Paulo, SP',
    icon: Building2,
    color: 'bg-purple-500'
  },
  {
    year: 1995,
    title: 'Primeiro Templo Próprio',
    description: 'Inauguração do primeiro templo com capacidade para 200 pessoas',
    location: 'São Paulo, SP',
    icon: Building2,
    color: 'bg-blue-500'
  },
  {
    year: 2000,
    title: 'Expansão Regional',
    description: 'Abertura de 5 congregações na região metropolitana',
    location: 'Grande São Paulo',
    icon: MapPin,
    color: 'bg-green-500'
  },
  {
    year: 2005,
    title: 'Primeira Igreja no Exterior',
    description: 'Inauguração da primeira igreja missionária em Portugal',
    location: 'Lisboa, Portugal',
    icon: MapPin,
    color: 'bg-orange-500'
  },
  {
    year: 2010,
    title: '10.000 Membros',
    description: 'Alcançamos a marca de 10 mil membros em toda a rede',
    location: 'Brasil e Exterior',
    icon: Users,
    color: 'bg-pink-500'
  },
  {
    year: 2015,
    title: 'Lançamento da TV Online',
    description: 'Início das transmissões ao vivo e programação 24h',
    location: 'Digital',
    icon: Calendar,
    color: 'bg-cyan-500'
  },
  {
    year: 2020,
    title: 'Rede Nacional',
    description: 'Presença em todos os estados brasileiros',
    location: 'Brasil',
    icon: Building2,
    color: 'bg-violet-500'
  },
  {
    year: 2024,
    title: 'Lançamento do MRM',
    description: 'Plataforma digital completa de gestão ministerial',
    location: 'Global',
    icon: Calendar,
    color: 'bg-indigo-500'
  }
];

export function Timeline() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-20">
        <div className="max-w-7xl mx-auto px-4">
          <Link to="/public" className="text-white/80 hover:text-white mb-4 inline-block">
            ← Voltar
          </Link>
          <h1 className="text-5xl font-bold mb-4">Nossa Linha do Tempo</h1>
          <p className="text-xl text-purple-100">
            Mais de 30 anos de história transformando vidas
          </p>
        </div>
      </div>

      {/* Timeline */}
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="relative">
          {/* Vertical Line */}
          <div className="absolute left-8 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-500 via-blue-500 to-green-500"></div>

          {/* Milestones */}
          <div className="space-y-12">
            {milestones.map((milestone, index) => {
              const Icon = milestone.icon;
              return (
                <div key={index} className="relative pl-24">
                  {/* Year Badge */}
                  <div className="absolute left-0 flex items-center">
                    <div className={`w-16 h-16 ${milestone.color} rounded-full flex items-center justify-center text-white shadow-lg ring-4 ring-white`}>
                      <Icon className="w-8 h-8" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-xl transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className={`inline-block px-3 py-1 ${milestone.color} text-white rounded-full text-sm font-bold mb-2`}>
                          {milestone.year}
                        </span>
                        <h3 className="text-2xl font-bold text-slate-900">
                          {milestone.title}
                        </h3>
                      </div>
                    </div>
                    <p className="text-slate-600 mb-3">
                      {milestone.description}
                    </p>
                    <div className="flex items-center text-sm text-slate-500">
                      <MapPin className="w-4 h-4 mr-1" />
                      {milestone.location}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-4 gap-6">
          <div className="bg-white rounded-xl p-6 text-center shadow-md">
            <div className="text-4xl font-bold text-purple-600 mb-2">34+</div>
            <div className="text-slate-600">Anos de História</div>
          </div>
          <div className="bg-white rounded-xl p-6 text-center shadow-md">
            <div className="text-4xl font-bold text-blue-600 mb-2">150+</div>
            <div className="text-slate-600">Igrejas</div>
          </div>
          <div className="bg-white rounded-xl p-6 text-center shadow-md">
            <div className="text-4xl font-bold text-green-600 mb-2">50K+</div>
            <div className="text-slate-600">Membros</div>
          </div>
          <div className="bg-white rounded-xl p-6 text-center shadow-md">
            <div className="text-4xl font-bold text-orange-600 mb-2">15+</div>
            <div className="text-slate-600">Países</div>
          </div>
        </div>
      </div>
    </div>
  );
}
