import { Calendar, MapPin, Clock, Users, Tag, ArrowRight, Filter, Search } from 'lucide-react';
import { Link } from 'react-router';
import { useState } from 'react';

const events = [
  {
    id: 1,
    title: 'Congresso CIBE 2024',
    description: 'Congresso Internacional de Batalha Espiritual com pregadores nacionais e internacionais',
    date: '15-17 Jun 2024',
    time: '19h',
    location: 'Sede Principal',
    category: 'Congresso',
    price: 'R$ 150,00',
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=600&fit=crop',
    available: 450
  },
  {
    id: 2,
    title: 'Retiro de Jovens',
    description: 'Fim de semana especial de renovação espiritual para jovens',
    date: '22-24 Jun 2024',
    time: 'Dia todo',
    location: 'Sítio da Igreja',
    category: 'Retiro',
    price: 'R$ 280,00',
    image: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=800&h=600&fit=crop',
    available: 120
  },
  {
    id: 3,
    title: 'Encontro de Casais',
    description: 'Workshop sobre relacionamentos e vida conjugal',
    date: '29 Jun 2024',
    time: '14h',
    location: 'Campus Norte',
    category: 'Workshop',
    price: 'R$ 80,00',
    image: 'https://images.unsplash.com/photo-1529634806980-85c3dd6d0efc?w=800&h=600&fit=crop',
    available: 80
  },
  {
    id: 4,
    title: 'Acampamento Kids',
    description: 'Acampamento cheio de diversão e aprendizado para crianças',
    date: '06-08 Jul 2024',
    time: 'Dia todo',
    location: 'Camping Águas Claras',
    category: 'Kids',
    price: 'R$ 320,00',
    image: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?w=800&h=600&fit=crop',
    available: 200
  },
  {
    id: 5,
    title: 'Conferência de Líderes',
    description: 'Capacitação e treinamento para líderes de células e ministérios',
    date: '13 Jul 2024',
    time: '9h - 17h',
    location: 'Sede Principal',
    category: 'Conferência',
    price: 'Gratuito',
    image: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=800&h=600&fit=crop',
    available: 300
  },
  {
    id: 6,
    title: 'Show Gospel',
    description: 'Noite especial de louvor com artistas renomados',
    date: '20 Jul 2024',
    time: '20h',
    location: 'Arena Gospel',
    category: 'Show',
    price: 'R$ 60,00',
    image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&h=600&fit=crop',
    available: 1500
  },
];

const categories = ['Todos', 'Congresso', 'Retiro', 'Workshop', 'Kids', 'Conferência', 'Show'];

export function PublicEvents() {
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  const filteredEvents = selectedCategory === 'Todos' 
    ? events 
    : events.filter(e => e.category === selectedCategory);

  return (
    <div className="py-12">
      {/* Hero */}
      <div className="bg-gradient-to-br from-purple-900 via-purple-800 to-blue-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Eventos</h1>
          <p className="text-xl text-purple-100 max-w-2xl">
            Participe dos nossos eventos e experiências transformadoras
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-8">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar eventos..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    selectedCategory === category
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Events Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => (
            <div
              key={event.id}
              className="bg-white rounded-xl overflow-hidden border border-slate-200 hover:shadow-lg transition-all"
            >
              {/* Image */}
              <div className="aspect-video bg-gradient-to-br from-purple-400 to-blue-500 relative overflow-hidden">
                <img
                  src={event.image}
                  alt={event.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-4 left-4">
                  <span className="px-3 py-1 bg-white rounded-full text-sm font-semibold text-purple-600">
                    {event.category}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <h3 className="font-bold text-xl text-slate-900 mb-2">{event.title}</h3>
                <p className="text-sm text-slate-600 mb-4 line-clamp-2">{event.description}</p>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Calendar className="w-4 h-4" />
                    <span>{event.date}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Clock className="w-4 h-4" />
                    <span>{event.time}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <MapPin className="w-4 h-4" />
                    <span>{event.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Users className="w-4 h-4" />
                    <span>{event.available} vagas disponíveis</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                  <div>
                    <p className="text-xs text-slate-500">A partir de</p>
                    <p className="text-lg font-bold text-purple-600">{event.price}</p>
                  </div>
                  <Link
                    to={`/public/events/${event.id}`}
                    className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
                  >
                    Inscrever-se
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl p-8 text-white text-center">
          <h2 className="text-2xl font-bold mb-4">Não encontrou o que procurava?</h2>
          <p className="mb-6 text-purple-100">
            Entre em contato conosco para mais informações sobre eventos futuros
          </p>
          <Link
            to="/public/contact"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-purple-600 rounded-lg hover:bg-purple-50 transition-colors font-semibold"
          >
            Entrar em Contato
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
