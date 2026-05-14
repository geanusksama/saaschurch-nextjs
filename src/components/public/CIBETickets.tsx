import { Link } from 'react-router';
import { Calendar, MapPin, Users, Ticket, Clock, Star, CheckCircle } from 'lucide-react';

const ticketTypes = [
  {
    name: 'Individual',
    price: 'R$ 150',
    features: [
      'Acesso a todas as palestras',
      'Kit de boas-vindas',
      'Certificado digital',
      'Coffee break'
    ],
    color: 'bg-blue-500',
    popular: false
  },
  {
    name: 'Casal',
    price: 'R$ 250',
    originalPrice: 'R$ 300',
    features: [
      'Acesso para 2 pessoas',
      '2 Kits de boas-vindas',
      'Certificados digitais',
      'Coffee break',
      'Desconto de 17%'
    ],
    color: 'bg-purple-500',
    popular: true
  },
  {
    name: 'Família',
    price: 'R$ 400',
    originalPrice: 'R$ 600',
    features: [
      'Acesso para até 4 pessoas',
      '4 Kits de boas-vindas',
      'Certificados digitais',
      'Coffee break',
      'Área kids inclusa',
      'Desconto de 33%'
    ],
    color: 'bg-green-500',
    popular: false
  }
];

const speakers = [
  {
    name: 'Pr. Roberto Silva',
    role: 'Pastor Principal',
    image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400'
  },
  {
    name: 'Pra. Fernanda Costa',
    role: 'Ministra de Louvor',
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400'
  },
  {
    name: 'Pr. Carlos Mendes',
    role: 'Teólogo e Escritor',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400'
  },
  {
    name: 'Pra. Ana Oliveira',
    role: 'Ministra de Família',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400'
  }
];

export function CIBETickets() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900 via-purple-700 to-blue-700 text-white py-20">
        <div className="max-w-7xl mx-auto px-4">
          <Link to="/public" className="text-white/80 hover:text-white mb-4 inline-block">
            ← Voltar
          </Link>
          <div className="text-center">
            <div className="inline-block px-4 py-2 bg-white/20 rounded-full text-sm font-semibold mb-4">
              Evento do Ano
            </div>
            <h1 className="text-6xl font-black mb-4">CIBE 2024</h1>
            <p className="text-2xl text-purple-100 mb-8">
              Congresso Internacional de Batalha Espiritual
            </p>
            
            <div className="flex flex-wrap justify-center gap-8 text-lg">
              <div className="flex items-center gap-2">
                <Calendar className="w-6 h-6" />
                15 a 17 de Julho, 2024
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-6 h-6" />
                Centro de Convenções MRM - SP
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-6 h-6" />
                Capacidade: 5.000 pessoas
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Event Highlights */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Star className="w-8 h-8 text-purple-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">3 Dias Intensos</h3>
            <p className="text-slate-600 dark:text-slate-400">
              Palestras, workshops e momentos de adoração transformadores
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Palestrantes Renomados</h3>
            <p className="text-slate-600 dark:text-slate-400">
              Ministros nacionais e internacionais de grande impacto
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Certificado Incluso</h3>
            <p className="text-slate-600 dark:text-slate-400">
              Certificado de participação reconhecido nacionalmente
            </p>
          </div>
        </div>

        {/* Ticket Types */}
        <div className="mb-16">
          <h2 className="text-4xl font-bold text-center text-slate-900 mb-4">
            Escolha Seu Ingresso
          </h2>
          <p className="text-center text-slate-600 mb-12 text-lg">
            Vagas limitadas! Garanta seu lugar agora
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {ticketTypes.map((ticket, index) => (
              <div
                key={index}
                className={`bg-white rounded-2xl shadow-xl overflow-hidden ${
                  ticket.popular ? 'ring-4 ring-purple-500 scale-105' : ''
                }`}
              >
                {ticket.popular && (
                  <div className="bg-purple-500 text-white text-center py-2 font-bold">
                    ⭐ MAIS POPULAR
                  </div>
                )}
                <div className="p-6">
                  <div className={`w-16 h-16 ${ticket.color} rounded-full flex items-center justify-center mx-auto mb-4`}>
                    <Ticket className="w-8 h-8 text-white" />
                  </div>
                  
                  <h3 className="text-2xl font-bold text-center text-slate-900 mb-2">
                    {ticket.name}
                  </h3>
                  
                  <div className="text-center mb-6">
                    {ticket.originalPrice && (
                      <div className="text-slate-400 line-through text-lg">
                        {ticket.originalPrice}
                      </div>
                    )}
                    <div className="text-4xl font-black text-slate-900">
                      {ticket.price}
                    </div>
                    <div className="text-slate-600 text-sm">por pessoa/família</div>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {ticket.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-slate-600">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button className={`w-full py-3 ${ticket.color} text-white rounded-lg font-bold hover:opacity-90 transition-opacity`}>
                    Comprar Agora
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Speakers */}
        <div className="mb-16">
          <h2 className="text-4xl font-bold text-center text-slate-900 mb-4">
            Palestrantes Confirmados
          </h2>
          <p className="text-center text-slate-600 mb-12 text-lg">
            Ministros que vão impactar sua vida
          </p>

          <div className="grid md:grid-cols-4 gap-8">
            {speakers.map((speaker, index) => (
              <div key={index} className="text-center group">
                <div className="w-48 h-48 mx-auto mb-4 rounded-full overflow-hidden ring-4 ring-purple-100 group-hover:ring-purple-300 transition-all">
                  <img
                    src={speaker.image}
                    alt={speaker.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                  />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-1">
                  {speaker.name}
                </h3>
                <p className="text-slate-600 dark:text-slate-400">{speaker.role}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Schedule Preview */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-12 text-white mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">Programação</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-2xl font-bold mb-2">Sexta-feira</div>
              <div className="flex items-center justify-center gap-2 mb-4">
                <Clock className="w-5 h-5" />
                19h às 22h
              </div>
              <div className="bg-white/20 rounded-lg p-4">
                <p className="font-semibold mb-2">Noite de Abertura</p>
                <p className="text-sm text-purple-100">Louvor e Palavra</p>
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold mb-2">Sábado</div>
              <div className="flex items-center justify-center gap-2 mb-4">
                <Clock className="w-5 h-5" />
                9h às 22h
              </div>
              <div className="bg-white/20 rounded-lg p-4">
                <p className="font-semibold mb-2">Dia Intensivo</p>
                <p className="text-sm text-purple-100">Workshops e Palestras</p>
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold mb-2">Domingo</div>
              <div className="flex items-center justify-center gap-2 mb-4">
                <Clock className="w-5 h-5" />
                10h às 18h
              </div>
              <div className="bg-white/20 rounded-lg p-4">
                <p className="font-semibold mb-2">Encerramento</p>
                <p className="text-sm text-purple-100">Culto de Envio</p>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-slate-900 mb-8">
            Perguntas Frequentes
          </h2>
          <div className="space-y-4">
            <details className="bg-white rounded-lg shadow-md p-6 group">
              <summary className="font-bold text-slate-900 cursor-pointer list-none">
                O que está incluso no ingresso?
              </summary>
              <p className="text-slate-600 mt-4">
                Todos os ingressos incluem acesso a todas as palestras, workshops, momentos de louvor, kit de boas-vindas, coffee break e certificado de participação digital.
              </p>
            </details>
            <details className="bg-white rounded-lg shadow-md p-6">
              <summary className="font-bold text-slate-900 cursor-pointer list-none">
                Crianças pagam ingresso?
              </summary>
              <p className="text-slate-600 mt-4">
                Crianças até 12 anos não pagam quando acompanhadas dos pais no ingresso Família. Temos área kids com recreação durante todo o evento.
              </p>
            </details>
            <details className="bg-white rounded-lg shadow-md p-6">
              <summary className="font-bold text-slate-900 cursor-pointer list-none">
                Como funciona o certificado?
              </summary>
              <p className="text-slate-600 mt-4">
                O certificado digital será enviado por email após o evento, comprovando sua participação nas 20 horas de programação.
              </p>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
