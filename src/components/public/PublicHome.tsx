import { Link } from 'react-router';
import { Calendar, Users, Heart, BookOpen, ArrowRight, Play, MapPin, Clock } from 'lucide-react';

const upcomingEvents = [
  { id: 1, name: 'Congresso CIBE 2024', date: '15-17 Jun', image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=600&fit=crop' },
  { id: 2, name: 'Retiro de Jovens', date: '22 Jun', image: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&h=600&fit=crop' },
  { id: 3, name: 'Encontro de Casais', date: '29 Jun', image: 'https://images.unsplash.com/photo-1529634806980-85c3dd6d0efc?w=800&h=600&fit=crop' },
];

const ministries = [
  { name: 'Louvor e Adoração', icon: '🎵', description: 'Exaltando o nome do Senhor', members: 45 },
  { name: 'Infantil', icon: '👶', description: 'Ensinando as crianças', members: 120 },
  { name: 'Jovens', icon: '🌟', description: 'Impactando a juventude', members: 180 },
  { name: 'Intercessão', icon: '🙏', description: 'Guerreiros em oração', members: 65 },
];

export function PublicHome() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-purple-900 via-purple-800 to-blue-900 text-white">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1438232992991-995b7058bbb3?w=1920&h=1080&fit=crop')] bg-cover bg-center opacity-20"></div>
        <div className="relative px-4 sm:px-6 lg:px-8 py-24 md:py-32">
          <div className="max-w-3xl">
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              Bem-vindo à Igreja MRM
            </h1>
            <p className="text-xl md:text-2xl text-purple-100 mb-8">
              Uma comunidade de fé comprometida em transformar vidas através do amor de Cristo
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/public/events"
                className="px-8 py-4 bg-white text-purple-900 rounded-lg hover:bg-purple-50 transition-colors font-semibold flex items-center gap-2"
              >
                Ver Próximos Eventos
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                to="/public/live"
                className="px-8 py-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold flex items-center gap-2"
              >
                <Play className="w-5 h-5" />
                Assistir Ao Vivo
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white py-12 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-600 mb-2">3,500+</div>
              <div className="text-slate-600">Membros</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-600 mb-2">45</div>
              <div className="text-slate-600">Ministérios</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-600 mb-2">120</div>
              <div className="text-slate-600">Células</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-600 mb-2">25</div>
              <div className="text-slate-600">Anos</div>
            </div>
          </div>
        </div>
      </section>

      {/* Upcoming Events */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Próximos Eventos</h2>
            <p className="text-lg text-slate-600">Participe dos nossos eventos e experiências transformadoras</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {upcomingEvents.map((event) => (
              <Link
                key={event.id}
                to={`/public/events/${event.id}`}
                className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all border border-slate-200"
              >
                <div className="aspect-video bg-gradient-to-br from-purple-400 to-blue-500 relative overflow-hidden">
                  <img
                    src={event.image}
                    alt={event.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-4 right-4 bg-white px-3 py-1 rounded-full text-sm font-semibold text-purple-600">
                    {event.date}
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="font-bold text-xl text-slate-900 mb-2">{event.name}</h3>
                  <div className="flex items-center gap-4 text-sm text-slate-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{event.date}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>19h</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link
              to="/public/events"
              className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-semibold"
            >
              Ver Todos os Eventos
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Ministries */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Nossos Ministérios</h2>
            <p className="text-lg text-slate-600">Encontre seu lugar e faça a diferença</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {ministries.map((ministry) => (
              <div
                key={ministry.name}
                className="bg-white border border-slate-200 rounded-xl p-6 hover:border-purple-300 hover:shadow-md transition-all"
              >
                <div className="text-4xl mb-4">{ministry.icon}</div>
                <h3 className="font-bold text-lg text-slate-900 mb-2">{ministry.name}</h3>
                <p className="text-sm text-slate-600 mb-4">{ministry.description}</p>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Users className="w-4 h-4" />
                  <span>{ministry.members} membros</span>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link
              to="/public/ministries"
              className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 font-semibold"
            >
              Conheça Todos os Ministérios
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Service Times */}
      <section className="py-16 bg-gradient-to-br from-purple-900 to-blue-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Horários de Cultos</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-4 bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <Calendar className="w-6 h-6 flex-shrink-0 mt-1" />
                  <div>
                    <div className="font-semibold text-lg">Domingo</div>
                    <div className="text-purple-100">Culto da Manhã: 9h</div>
                    <div className="text-purple-100">Culto da Noite: 18h</div>
                  </div>
                </div>
                <div className="flex items-start gap-4 bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <Calendar className="w-6 h-6 flex-shrink-0 mt-1" />
                  <div>
                    <div className="font-semibold text-lg">Quarta-feira</div>
                    <div className="text-purple-100">Reunião de Oração: 20h</div>
                  </div>
                </div>
                <div className="flex items-start gap-4 bg-white/10 backdrop-blur-sm rounded-lg p-4">
                  <Calendar className="w-6 h-6 flex-shrink-0 mt-1" />
                  <div>
                    <div className="font-semibold text-lg">Sexta-feira</div>
                    <div className="text-purple-100">Culto de Jovens: 20h</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8">
              <h3 className="text-2xl font-bold mb-6">Nossa Localização</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 flex-shrink-0 mt-1" />
                  <div>
                    <div className="font-semibold">Sede Principal</div>
                    <div className="text-purple-100">Av. Paulista, 1000 - São Paulo, SP</div>
                  </div>
                </div>
                <Link
                  to="/public/contact"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white text-purple-900 rounded-lg hover:bg-purple-50 transition-colors font-semibold"
                >
                  Como Chegar
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">
            Faça Parte da Nossa Família
          </h2>
          <p className="text-lg text-slate-600 mb-8">
            Venha conhecer nossa igreja e descubra como você pode crescer espiritualmente e fazer a diferença
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/public/contact"
              className="px-8 py-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
            >
              Entre em Contato
            </Link>
            <Link
              to="/public/live"
              className="px-8 py-4 border-2 border-purple-600 text-purple-600 rounded-lg hover:bg-purple-50 transition-colors font-semibold"
            >
              Assistir Online
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-bold text-lg mb-4">Sobre Nós</h3>
              <ul className="space-y-2 text-slate-300">
                <li>
                  <Link to="/public/about" className="hover:text-purple-400">
                    Nossa História
                  </Link>
                </li>
                <li>
                  <Link to="/public/vision" className="hover:text-purple-400">
                    Visão e Valores
                  </Link>
                </li>
                <li>
                  <Link to="/public/history" className="hover:text-purple-400">
                    História da Igreja
                  </Link>
                </li>
                <li>
                  <Link to="/public/timeline" className="hover:text-purple-400">
                    Linha do Tempo
                  </Link>
                </li>
                <li>
                  <Link to="/public/leadership" className="hover:text-purple-400">
                    Liderança
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4">Ministérios</h3>
              <ul className="space-y-2 text-slate-300">
                <li>
                  <Link to="/public/ministries-public" className="hover:text-purple-400">
                    Nossos Ministérios
                  </Link>
                </li>
                <li>
                  <Link to="/public/kids-portal" className="hover:text-purple-400">
                    Portal Kids
                  </Link>
                </li>
                <li>
                  <Link to="/public/live-streaming" className="hover:text-purple-400">
                    Transmissão Ao Vivo
                  </Link>
                </li>
                <li>
                  <Link to="/public/radio" className="hover:text-purple-400">
                    Rádio Online 24h
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4">Recursos</h3>
              <ul className="space-y-2 text-slate-300">
                <li>
                  <Link to="/public/events" className="hover:text-purple-400">
                    Eventos
                  </Link>
                </li>
                <li>
                  <Link to="/public/cibe-tickets" className="hover:text-purple-400">
                    CIBE 2024 - Ingressos
                  </Link>
                </li>
                <li>
                  <Link to="/public/blog" className="hover:text-purple-400">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link to="/public/locations" className="hover:text-purple-400">
                    Localizações
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4">Contato</h3>
              <ul className="space-y-2 text-slate-300">
                <li>
                  <Link to="/public/contact" className="hover:text-purple-400">
                    Entre em Contato
                  </Link>
                </li>
                <li>(11) 3000-0000</li>
                <li>contato@mrm.com.br</li>
                <li>
                  <Link to="/auth/login" className="hover:text-purple-400">
                    Portal de Membros
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}