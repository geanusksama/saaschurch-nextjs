import { Search, Phone, MoreVertical, Send, Paperclip, Smile, Check, CheckCheck, MessageSquare } from 'lucide-react';
import { useState } from 'react';

const conversations = [
  { 
    id: 1, 
    name: 'João Silva', 
    lastMessage: 'Muito obrigado pelo retorno!', 
    time: '10:30', 
    unread: 0,
    status: 'read',
    avatar: 'JS'
  },
  { 
    id: 2, 
    name: 'Maria Santos', 
    lastMessage: 'Qual o horário do culto de domingo?', 
    time: '09:15', 
    unread: 2,
    status: 'delivered',
    avatar: 'MS'
  },
  { 
    id: 3, 
    name: 'Pedro Costa', 
    lastMessage: 'Posso participar da célula?', 
    time: 'Ontem', 
    unread: 1,
    status: 'sent',
    avatar: 'PC'
  },
  { 
    id: 4, 
    name: 'Ana Lima', 
    lastMessage: 'Obrigada pela oração 🙏', 
    time: 'Ontem', 
    unread: 0,
    status: 'read',
    avatar: 'AL'
  },
  { 
    id: 5, 
    name: 'Carlos Rocha', 
    lastMessage: 'Vou participar do evento!', 
    time: '15/03', 
    unread: 0,
    status: 'read',
    avatar: 'CR'
  },
];

const messages = [
  { id: 1, text: 'Olá! Gostaria de saber mais sobre a igreja', sent: false, time: '09:10', status: 'read' },
  { id: 2, text: 'Olá Maria! Seja bem-vinda 😊', sent: true, time: '09:12', status: 'read' },
  { id: 3, text: 'Nossos cultos são aos domingos às 9h e 18h', sent: true, time: '09:12', status: 'read' },
  { id: 4, text: 'Qual o horário do culto de domingo?', sent: false, time: '09:15', status: 'delivered' },
];

export function WhatsApp() {
  const [selectedConversation, setSelectedConversation] = useState(conversations[1]);
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (message.trim()) {
      setMessage('');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">WhatsApp</h1>
            <p className="text-slate-600 dark:text-slate-400">Gerencie conversas e campanhas</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 h-[700px] flex overflow-hidden">
        {/* Conversations List */}
        <div className="w-96 border-r border-slate-200 flex flex-col">
          {/* Search */}
          <div className="p-4 border-b border-slate-200">
            <div className="relative">
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar conversa..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className={`w-full p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors border-b border-slate-100 ${
                  selectedConversation.id === conv.id ? 'bg-purple-50' : ''
                }`}
              >
                <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                  {conv.avatar}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-slate-900 truncate">{conv.name}</p>
                    <span className="text-xs text-slate-500">{conv.time}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-600 truncate">{conv.lastMessage}</p>
                    {conv.unread > 0 && (
                      <span className="ml-2 bg-green-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                        {conv.unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                {selectedConversation.avatar}
              </div>
              <div>
                <p className="font-semibold text-slate-900">{selectedConversation.name}</p>
                <p className="text-xs text-green-600">Online</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-slate-100 rounded-lg">
                <Phone className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
              <button className="p-2 hover:bg-slate-100 rounded-lg">
                <MoreVertical className="w-5 h-5 text-slate-600" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h100v100H0z\' fill=\'%23f1f5f9\'/%3E%3C/svg%3E")' }}>
            <div className="space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sent ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-md px-4 py-2 rounded-lg ${
                    msg.sent 
                      ? 'bg-green-500 text-white' 
                      : 'bg-white text-slate-900 border border-slate-200'
                  }`}>
                    <p className="text-sm">{msg.text}</p>
                    <div className={`flex items-center justify-end gap-1 mt-1 ${
                      msg.sent ? 'text-green-100' : 'text-slate-400'
                    }`}>
                      <span className="text-xs">{msg.time}</span>
                      {msg.sent && (
                        msg.status === 'read' ? (
                          <CheckCheck className="w-4 h-4" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Message Input */}
          <div className="p-4 border-t border-slate-200 bg-white">
            <div className="flex items-center gap-3">
              <button className="p-2 hover:bg-slate-100 rounded-lg">
                <Smile className="w-5 h-5 text-slate-600" />
              </button>
              <button className="p-2 hover:bg-slate-100 rounded-lg">
                <Paperclip className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Digite uma mensagem..."
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={handleSend}
                className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
