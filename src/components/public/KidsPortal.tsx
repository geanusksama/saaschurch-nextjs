import { Link } from 'react-router';
import { Star, Heart, Sparkles, Book, Music, Video, Gift, Calendar } from 'lucide-react';

const activities = [
  {
    title: 'Histórias Bíblicas',
    icon: Book,
    color: 'bg-blue-500',
    description: 'Aprenda histórias incríveis da Bíblia'
  },
  {
    title: 'Louvor Kids',
    icon: Music,
    color: 'bg-pink-500',
    description: 'Cante e dance para Jesus'
  },
  {
    title: 'Vídeos Divertidos',
    icon: Video,
    color: 'bg-purple-500',
    description: 'Assista desenhos e animações'
  },
  {
    title: 'Jogos Educativos',
    icon: Sparkles,
    color: 'bg-orange-500',
    description: 'Aprenda brincando'
  }
];

const events = [
  {
    title: 'Culto Kids',
    date: 'Todo Domingo às 10h',
    color: 'bg-blue-500'
  },
  {
    title: 'Escola Bíblica',
    date: 'Sábados às 15h',
    color: 'bg-green-500'
  },
  {
    title: 'Acampamento Kids',
    date: '15-17 de Julho',
    color: 'bg-purple-500'
  }
];

export function KidsPortal() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 to-purple-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <Link to="/public" className="text-white/80 hover:text-white mb-4 inline-block">
            ← Voltar
          </Link>
          <div className="flex justify-center gap-3 mb-4">
            <Star className="w-12 h-12 fill-yellow-300 text-yellow-300 animate-pulse" />
            <Heart className="w-12 h-12 fill-pink-300 text-pink-300 animate-bounce" />
            <Sparkles className="w-12 h-12 fill-blue-300 text-blue-300 animate-pulse" />
          </div>
          <h1 className="text-6xl font-black mb-4">Portal Kids! 🎨</h1>
          <p className="text-2xl text-purple-100">
            Um lugar super especial para você! ✨
          </p>
        </div>
      </div>

      {/* Activities */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-4xl font-black text-center text-purple-600 mb-12">
          O que você vai encontrar aqui? 🚀
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {activities.map((activity, index) => {
            const Icon = activity.icon;
            return (
              <div
                key={index}
                className="bg-white rounded-3xl shadow-lg p-8 text-center hover:scale-105 transition-transform cursor-pointer"
              >
                <div className={`w-20 h-20 ${activity.color} rounded-full flex items-center justify-center mx-auto mb-4`}>
                  <Icon className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  {activity.title}
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  {activity.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Upcoming Events */}
        <div className="bg-white rounded-3xl shadow-xl p-8 mb-16">
          <h2 className="text-3xl font-black text-purple-600 mb-6 flex items-center gap-2">
            <Calendar className="w-8 h-8" />
            Próximos Eventos
          </h2>
          <div className="space-y-4">
            {events.map((event, index) => (
              <div key={index} className="flex items-center gap-4 p-4 bg-purple-50 rounded-2xl">
                <div className={`w-3 h-3 ${event.color} rounded-full`}></div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900">{event.title}</h3>
                  <p className="text-sm text-slate-600">{event.date}</p>
                </div>
                <Gift className="w-6 h-6 text-purple-500" />
              </div>
            ))}
          </div>
        </div>

        {/* Featured Video */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-3xl shadow-xl p-8 text-center text-white">
          <h2 className="text-3xl font-black mb-4">Vídeo da Semana! 📺</h2>
          <div className="bg-white/20 rounded-2xl p-8 mb-6">
            <div className="w-32 h-32 bg-white/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <Video className="w-16 h-16 text-white" />
            </div>
            <p className="text-xl font-semibold">A História de Davi e Golias</p>
          </div>
          <button className="px-8 py-3 bg-white text-purple-600 rounded-full font-bold hover:shadow-lg transition-shadow">
            Assistir Agora! ▶️
          </button>
        </div>

        {/* Fun Facts */}
        <div className="mt-16 grid grid-cols-3 gap-6">
          <div className="bg-blue-500 rounded-3xl p-6 text-center text-white">
            <div className="text-5xl font-black mb-2">500+</div>
            <div className="text-lg">Kids na Igreja</div>
          </div>
          <div className="bg-pink-500 rounded-3xl p-6 text-center text-white">
            <div className="text-5xl font-black mb-2">50+</div>
            <div className="text-lg">Vídeos</div>
          </div>
          <div className="bg-purple-500 rounded-3xl p-6 text-center text-white">
            <div className="text-5xl font-black mb-2">20+</div>
            <div className="text-lg">Atividades</div>
          </div>
        </div>
      </div>
    </div>
  );
}
