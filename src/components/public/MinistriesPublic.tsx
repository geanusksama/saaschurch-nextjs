import { Link } from 'react-router';
import { Users, Heart, Music, Baby, Sparkles, Book, HandHeart, Globe } from 'lucide-react';

const ministries = [
  {
    name: 'Louvor e Adoração',
    icon: Music,
    color: 'bg-purple-500',
    description: 'Ministério dedicado à música e adoração',
    members: 45,
    image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800'
  },
  {
    name: 'Crianças',
    icon: Baby,
    color: 'bg-pink-500',
    description: 'Cuidado e ensino para nossas crianças',
    members: 120,
    image: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=800'
  },
  {
    name: 'Jovens',
    icon: Sparkles,
    color: 'bg-blue-500',
    description: 'Discipulado e eventos para jovens',
    members: 200,
    image: 'https://images.unsplash.com/photo-1529070538774-1843cb3265df?w=800'
  },
  {
    name: 'Intercessão',
    icon: Heart,
    color: 'bg-red-500',
    description: 'Oração e clamor pela igreja e nações',
    members: 80,
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800'
  },
  {
    name: 'Ensino',
    icon: Book,
    color: 'bg-green-500',
    description: 'Escola bíblica e treinamentos',
    members: 60,
    image: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=800'
  },
  {
    name: 'Ação Social',
    icon: HandHeart,
    color: 'bg-orange-500',
    description: 'Projetos sociais e ajuda humanitária',
    members: 95,
    image: 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=800'
  },
  {
    name: 'Missões',
    icon: Globe,
    color: 'bg-cyan-500',
    description: 'Envio de missionários pelo mundo',
    members: 40,
    image: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800'
  },
  {
    name: 'Recepção',
    icon: Users,
    color: 'bg-violet-500',
    description: 'Acolhimento de visitantes e membros',
    members: 70,
    image: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=800'
  }
];

export function MinistriesPublic() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-20">
        <div className="max-w-7xl mx-auto px-4">
          <Link to="/public" className="text-white/80 hover:text-white mb-4 inline-block">
            ← Voltar
          </Link>
          <h1 className="text-5xl font-bold mb-4">Nossos Ministérios</h1>
          <p className="text-xl text-purple-100">
            Encontre seu lugar para servir e fazer a diferença
          </p>
        </div>
      </div>

      {/* Ministries Grid */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {ministries.map((ministry, index) => {
            const Icon = ministry.icon;
            return (
              <div key={index} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow">
                <div className="h-48 bg-cover bg-center" style={{ backgroundImage: `url(${ministry.image})` }}>
                  <div className="h-full bg-gradient-to-t from-black/60 to-transparent flex items-end p-6">
                    <div className={`w-12 h-12 ${ministry.color} rounded-full flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-2">
                    {ministry.name}
                  </h3>
                  <p className="text-slate-600 mb-4">
                    {ministry.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">
                      {ministry.members} membros ativos
                    </span>
                    <button className={`px-4 py-2 ${ministry.color} text-white rounded-lg hover:opacity-90 transition-opacity`}>
                      Participar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-12 text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Quer servir em um ministério?</h2>
          <p className="text-xl mb-8 text-purple-100">
            Entre em contato conosco e descubra como você pode fazer parte!
          </p>
          <Link
            to="/public/contact"
            className="inline-block px-8 py-3 bg-white text-purple-600 rounded-lg font-semibold hover:shadow-lg transition-shadow"
          >
            Entrar em Contato
          </Link>
        </div>
      </div>
    </div>
  );
}
