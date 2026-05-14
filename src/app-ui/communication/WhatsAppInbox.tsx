import { useState } from 'react';
import { MessageSquare, Search, Send, Paperclip, MoreVertical, Phone, Video, User } from 'lucide-react';

const conversations = [
  { id: 1, name: 'Maria Silva', lastMessage: 'Obrigada pela oração!', time: '10:32', unread: 2, online: true },
  { id: 2, name: 'João Santos', lastMessage: 'Qual o horário do culto de hoje?', time: '10:15', unread: 0, online: false },
  { id: 3, name: 'Ana Paula', lastMessage: 'Amém! Deus abençoe', time: '09:45', unread: 1, online: true },
  { id: 4, name: 'Carlos Eduardo', lastMessage: 'Preciso de uma oração', time: 'Ontem', unread: 0, online: false },
  { id: 5, name: 'Juliana Mendes', lastMessage: 'Confirmo presença no evento', time: 'Ontem', unread: 0, online: true },
];

const messages = [
  { id: 1, sender: 'them', text: 'Boa tarde! Tudo bem?', time: '10:30' },
  { id: 2, sender: 'me', text: 'Boa tarde! Tudo sim, e você?', time: '10:31' },
  { id: 3, sender: 'them', text: 'Obrigada pela oração!', time: '10:32' },
  { id: 4, sender: 'them', text: 'Estou me sentindo muito melhor', time: '10:32' },
];

export default function WhatsAppInbox() {
  const [selectedConversation, setSelectedConversation] = useState(conversations[0]);
  const [messageText, setMessageText] = useState('');

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageText.trim()) {
      // Aqui enviaria a mensagem
      setMessageText('');
    }
  };

  return (
    <div className="h-[calc(100vh-2rem)] m-4 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">WhatsApp Inbox</h1>
            <p className="text-slate-600 dark:text-slate-400">Gerencie todas as conversas em um só lugar</p>
          </div>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden flex h-[calc(100%-5rem)]">
        {/* Conversations List */}
        <div className="w-96 border-r border-slate-200 dark:border-slate-700 flex flex-col">
          {/* Search */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar conversas..."
                className="w-full pl-11 pr-4 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Conversation List */}
          <div className="flex-1 overflow-y-auto">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className={`p-4 border-b border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${
                  selectedConversation.id === conv.id ? 'bg-purple-50 dark:bg-purple-950/20' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <div className="w-12 h-12 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-slate-600 dark:text-slate-300" />
                    </div>
                    {conv.online && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">{conv.name}</p>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{conv.time}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-slate-600 dark:text-slate-400 truncate">{conv.lastMessage}</p>
                      {conv.unread > 0 && (
                        <span className="ml-2 w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                          {conv.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                </div>
                {selectedConversation.online && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                )}
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{selectedConversation.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedConversation.online ? 'Online' : 'Offline'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <Phone className="w-5 h-5" />
              </button>
              <button className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <Video className="w-5 h-5" />
              </button>
              <button className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950" style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width="100" height="100" xmlns="http://www.w3.org/2000/svg"%3E%3Cpath d="M10 10h80v80H10z" fill="none" stroke="%23e2e8f0" stroke-width="0.5"/%3E%3C/svg%3E")'
          }}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.sender === 'me' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-md ${
                    message.sender === 'me'
                      ? 'bg-green-500 text-white rounded-l-xl rounded-tr-xl'
                      : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-r-xl rounded-tl-xl border border-slate-200 dark:border-slate-700'
                  } px-4 py-2.5 shadow-sm`}>
                    <p className="text-sm">{message.text}</p>
                    <p className={`text-xs mt-1 ${
                      message.sender === 'me' ? 'text-green-100' : 'text-slate-500 dark:text-slate-400'
                    }`}>
                      {message.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Message Input */}
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <form onSubmit={handleSendMessage} className="flex items-center gap-3">
              <button
                type="button"
                className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Digite uma mensagem..."
                className="flex-1 px-4 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />

              <button
                type="submit"
                disabled={!messageText.trim()}
                className="p-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
