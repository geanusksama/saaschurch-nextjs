import { Link } from 'react-router';
import { MapPin, Phone, Clock, Navigation, Users, Building2 } from 'lucide-react';

const locations = [
  {
    name: 'Igreja Central - São Paulo',
    address: 'Av. Paulista, 1000 - Bela Vista, São Paulo - SP',
    phone: '(11) 3000-0000',
    schedule: 'Dom: 10h, 18h | Qua: 19h30',
    capacity: 2000,
    pastor: 'Pr. João Silva',
    type: 'Sede',
    color: 'bg-purple-500'
  },
  {
    name: 'Regional Zona Leste',
    address: 'Rua das Flores, 500 - Tatuapé, São Paulo - SP',
    phone: '(11) 3000-1111',
    schedule: 'Dom: 9h, 19h | Ter: 20h',
    capacity: 800,
    pastor: 'Pr. Carlos Mendes',
    type: 'Regional',
    color: 'bg-blue-500'
  },
  {
    name: 'Regional Zona Sul',
    address: 'Av. Santo Amaro, 2000 - Brooklin, São Paulo - SP',
    phone: '(11) 3000-2222',
    schedule: 'Dom: 10h, 18h | Qui: 19h30',
    capacity: 600,
    pastor: 'Pra. Ana Costa',
    type: 'Regional',
    color: 'bg-blue-500'
  },
  {
    name: 'Regional Zona Norte',
    address: 'Rua Voluntários da Pátria, 800 - Santana, São Paulo - SP',
    phone: '(11) 3000-3333',
    schedule: 'Dom: 9h, 18h | Qua: 20h',
    capacity: 500,
    pastor: 'Pr. Pedro Santos',
    type: 'Regional',
    color: 'bg-blue-500'
  },
  {
    name: 'Igreja Alphaville',
    address: 'Al. Rio Negro, 100 - Alphaville, Barueri - SP',
    phone: '(11) 3000-4444',
    schedule: 'Dom: 10h, 19h | Qua: 19h30',
    capacity: 400,
    pastor: 'Pr. Marcos Lima',
    type: 'Congregação',
    color: 'bg-green-500'
  },
  {
    name: 'Igreja Guarulhos',
    address: 'Rua João Gonçalves, 300 - Centro, Guarulhos - SP',
    phone: '(11) 3000-5555',
    schedule: 'Dom: 10h, 18h | Ter: 19h30',
    capacity: 350,
    pastor: 'Pra. Júlia Ferreira',
    type: 'Congregação',
    color: 'bg-green-500'
  }
];

export function Locations() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-20">
        <div className="max-w-7xl mx-auto px-4">
          <Link to="/public" className="text-white/80 hover:text-white mb-4 inline-block">
            ← Voltar
          </Link>
          <h1 className="text-5xl font-bold mb-4">Nossas Localizações</h1>
          <p className="text-xl text-purple-100">
            Encontre a igreja mais próxima de você
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-4 -mt-8">
        <div className="grid grid-cols-4 gap-6 mb-16">
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-4xl font-bold text-purple-600 mb-2">150+</div>
            <div className="text-slate-600">Igrejas</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-4xl font-bold text-blue-600 mb-2">26</div>
            <div className="text-slate-600">Estados</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-4xl font-bold text-green-600 mb-2">15+</div>
            <div className="text-slate-600">Países</div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="text-4xl font-bold text-orange-600 mb-2">50K+</div>
            <div className="text-slate-600">Membros</div>
          </div>
        </div>
      </div>

      {/* Map Placeholder */}
      <div className="max-w-7xl mx-auto px-4 mb-16">
        <div className="bg-slate-200 rounded-2xl h-96 flex items-center justify-center">
          <div className="text-center">
            <MapPin className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 text-lg">Mapa Interativo das Igrejas</p>
            <p className="text-slate-500 text-sm">Em breve com Google Maps integrado</p>
          </div>
        </div>
      </div>

      {/* Locations List */}
      <div className="max-w-7xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-bold text-slate-900 mb-8">Principais Igrejas em São Paulo</h2>
        
        <div className="grid lg:grid-cols-2 gap-6">
          {locations.map((location, index) => (
            <div key={index} className="bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="w-5 h-5 text-purple-600" />
                    <h3 className="text-xl font-bold text-slate-900">
                      {location.name}
                    </h3>
                  </div>
                  <span className={`inline-block px-3 py-1 ${location.color} text-white rounded-full text-xs font-semibold`}>
                    {location.type}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="space-y-3">
                <div className="flex items-start gap-3 text-slate-600">
                  <MapPin className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                  <span>{location.address}</span>
                </div>
                
                <div className="flex items-center gap-3 text-slate-600">
                  <Phone className="w-5 h-5 text-slate-400" />
                  <span>{location.phone}</span>
                </div>
                
                <div className="flex items-center gap-3 text-slate-600">
                  <Clock className="w-5 h-5 text-slate-400" />
                  <span>{location.schedule}</span>
                </div>

                <div className="flex items-center gap-3 text-slate-600">
                  <Users className="w-5 h-5 text-slate-400" />
                  <span>Capacidade: {location.capacity} pessoas</span>
                </div>
              </div>

              {/* Footer */}
              <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
                <span className="text-sm text-slate-600">
                  Pastor: <strong>{location.pastor}</strong>
                </span>
                <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                  <Navigation className="w-4 h-4" />
                  Rotas
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-12 text-center text-white">
          <h2 className="text-2xl font-bold mb-4">Não encontrou uma igreja perto de você?</h2>
          <p className="text-xl mb-8 text-purple-100">
            Entre em contato conosco para saber mais sobre nossas outras localizações
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              to="/public/contact"
              className="px-8 py-3 bg-white text-purple-600 rounded-lg font-semibold hover:shadow-lg transition-shadow"
            >
              Entrar em Contato
            </Link>
            <button className="px-8 py-3 bg-purple-700 text-white rounded-lg font-semibold hover:bg-purple-800 transition-colors">
              Ver Todas as Igrejas
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
