import { Play, Users, MessageSquare, Heart, Share2, Volume2, Maximize } from 'lucide-react';
import { useState } from 'react';

const liveChats = [
  { id: 1, user: 'João Silva', message: 'Amém! Glória a Deus! 🙌', time: '10:45' },
  { id: 2, user: 'Maria Santos', message: 'Que palavra poderosa!', time: '10:46' },
  { id: 3, user: 'Pedro Costa', message: 'Aleluia! Jesus é o Senhor!', time: '10:47' },
  { id: 4, user: 'Ana Lima', message: 'Orando por todos vocês ❤️', time: '10:48' },
  { id: 5, user: 'Carlos Rocha', message: 'Deus está fazendo algo novo!', time: '10:49' },
];

export function LiveStreaming() {
  const [isLive] = useState(true);
  const [viewers] = useState(1248);
  const [message, setMessage] = useState('');

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Live Video */}
      <div className="bg-black">
        <div className="max-w-7xl mx-auto">
          <div className="aspect-video bg-gradient-to-br from-purple-900 via-purple-800 to-blue-900 relative">
            {/* Video Player Placeholder */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Play className="w-24 h-24 text-white/50 mx-auto mb-4" />
                <p className="text-white/70">Transmissão Ao Vivo</p>
              </div>
            </div>

            {/* Live Badge */}
            {isLive && (
              <div className="absolute top-6 left-6 flex items-center gap-3">
                <div className="flex items-center gap-2 bg-red-600 px-4 py-2 rounded-lg">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  <span className="text-white font-bold text-sm">AO VIVO</span>
                </div>
                <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-lg">
                  <Users className="w-4 h-4 text-white" />
                  <span className="text-white font-semibold text-sm">
                    {viewers.toLocaleString()} assistindo
                  </span>
                </div>
              </div>
            )}

            {/* Video Controls */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button className="w-12 h-12 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center text-white transition-colors">
                    <Play className="w-6 h-6" />
                  </button>
                  <button className="p-2 hover:bg-white/20 rounded-lg text-white transition-colors">
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-white/20 rounded-lg text-white transition-colors">
                    <Share2 className="w-5 h-5" />
                  </button>
                  <button className="p-2 hover:bg-white/20 rounded-lg text-white transition-colors">
                    <Maximize className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Below Video */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Stream Info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h1 className="text-2xl font-bold text-slate-900 mb-2">
                Culto ao Vivo - Domingo Noite
              </h1>
              <p className="text-slate-600 mb-4">
                Junte-se a nós para um momento especial de adoração e palavra
              </p>

              {/* Actions */}
              <div className="flex items-center gap-4">
                <button className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold">
                  <Heart className="w-5 h-5" />
                  Curtir
                </button>
                <button className="flex items-center gap-2 px-6 py-3 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors font-semibold">
                  <Share2 className="w-5 h-5" />
                  Compartilhar
                </button>
              </div>
            </div>

            {/* About */}
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Sobre o Culto</h2>
              <div className="space-y-3 text-slate-600">
                <p>
                  Neste domingo teremos uma palavra especial do Pastor João Silva sobre "A Fé que Move Montanhas".
                </p>
                <p>
                  Momento de adoração com o Ministério de Louvor e oração pelos pedidos da igreja.
                </p>
                <div className="pt-4 border-t border-slate-200">
                  <p className="text-sm font-semibold text-slate-900 mb-2">Programação:</p>
                  <ul className="space-y-2 text-sm">
                    <li>• 18h00 - Abertura e Louvor</li>
                    <li>• 18h30 - Avisos e Testemunhos</li>
                    <li>• 18h45 - Mensagem da Palavra</li>
                    <li>• 19h30 - Oração Final</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Live Chat */}
          <div className="bg-white rounded-xl border border-slate-200 flex flex-col h-[600px]">
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-purple-600" />
                <h2 className="font-bold text-slate-900">Chat ao Vivo</h2>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {liveChats.map((chat) => (
                <div key={chat.id} className="flex gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                    {chat.user.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-slate-900">{chat.user}</span>
                      <span className="text-xs text-slate-400">{chat.time}</span>
                    </div>
                    <p className="text-sm text-slate-600">{chat.message}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-slate-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold text-sm">
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
