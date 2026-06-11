import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, X, Send, Paperclip, Mic, Image, File, Play, Pause, 
  Circle, AlertCircle, Loader, User, Clock, Check, Volume2, Shield 
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabaseClient';
import { apiBase } from '../../lib/apiBase';

interface ChatMessage {
  id: string;
  campoId: string;
  userId: string;
  userName: string;
  userRole: string | null;
  body: string | null;
  fileUrl: string | null;
  fileName: string | null;
  fileType: string | null;
  fileSize: number | null;
  createdAt: string;
}

interface OnlineContact {
  id: string;
  fullName: string;
  presenceStatus: 'online' | 'busy' | 'away' | string;
  customStatus: string | null;
  roleName: string | null;
  lastActiveAt: string;
}

export function ChatFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'contacts'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contacts, setContacts] = useState<OnlineContact[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  
  // User presence info
  const [presenceStatus, setPresenceStatus] = useState<'online' | 'busy' | 'away'>('online');
  const [customStatus, setCustomStatus] = useState('');
  const [isEditingStatusPhrase, setIsEditingStatusPhrase] = useState(false);
  const [statusPhraseInput, setStatusPhraseInput] = useState('');

  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const recordIntervalRef = useRef<any>(null);

  // References
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const storedUser = (() => {
    try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; }
  })();
  const token = localStorage.getItem('mrm_token');
  const campoId = storedUser.campoId || '';
  const currentUserId = storedUser.id || '';

  // Heartbeat effect (Updates user presence status & fetches online users every 10 seconds)
  useEffect(() => {
    if (!token) return;

    // Send initial heartbeat and load status
    sendHeartbeat();
    fetchPresence();

    const presenceInterval = setInterval(() => {
      sendHeartbeat();
      fetchPresence();
    }, 10000);

    return () => clearInterval(presenceInterval);
  }, [token, presenceStatus, customStatus]);

  // Messages polling effect (polls every 4 seconds when chat panel is open)
  useEffect(() => {
    if (!token || !isOpen) return;

    fetchMessages();
    const chatInterval = setInterval(() => {
      fetchMessages();
    }, 4000);

    return () => clearInterval(chatInterval);
  }, [token, isOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Audio timer effect
  useEffect(() => {
    if (isRecording) {
      recordIntervalRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(recordIntervalRef.current);
      setRecordDuration(0);
    }
    return () => clearInterval(recordIntervalRef.current);
  }, [isRecording]);

  const sendHeartbeat = async () => {
    if (!token) return;
    try {
      await fetch(`${apiBase}/chat/presence`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          presenceStatus,
          customStatus: customStatus || null
        })
      });
    } catch (err) {
      console.error("Presence heartbeat failed", err);
    }
  };

  const fetchPresence = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/chat/presence${storedUser.profileType === 'master' ? `?campoId=${campoId}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setContacts(data);
      }
    } catch (err) {
      console.error("Failed to fetch presence", err);
    }
  };

  const fetchMessages = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/chat/messages${storedUser.profileType === 'master' ? `?campoId=${campoId}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error("Failed to fetch messages", err);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !token) return;

    const bodyText = inputText;
    setInputText('');
    setLoading(true);

    try {
      const res = await fetch(`${apiBase}/chat/messages${storedUser.profileType === 'master' ? `?campoId=${campoId}` : ''}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ body: bodyText })
      });

      if (res.ok) {
        const newMessage = await res.json();
        setMessages((prev) => [...prev, newMessage]);
      } else {
        toast.error('Erro ao enviar mensagem.');
      }
    } catch (err) {
      console.error("Message send failed", err);
      toast.error('Falha ao conectar.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;

    // Check size limit: 5MB
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('O arquivo excede o limite de 5MB.');
      return;
    }

    setFileLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const path = `chat-files/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

      const { data, error } = await supabase.storage.from('dados').upload(path, file);
      if (error) throw error;

      const { data: urlData } = supabase.storage.from('dados').getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      const fileType = file.type.startsWith('image/') ? 'image' : 'file';

      const res = await fetch(`${apiBase}/chat/messages${storedUser.profileType === 'master' ? `?campoId=${campoId}` : ''}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          fileUrl: publicUrl,
          fileName: file.name,
          fileType,
          fileSize: file.size
        })
      });

      if (res.ok) {
        const newMessage = await res.json();
        setMessages((prev) => [...prev, newMessage]);
        toast.success('Arquivo enviado com sucesso!');
      } else {
        toast.error('Erro ao registrar arquivo.');
      }
    } catch (err) {
      console.error("File upload failed", err);
      toast.error('Erro ao fazer upload do arquivo.');
    } finally {
      setFileLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Recording audio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        
        // Stop all stream tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());

        if (audioBlob.size > 5 * 1024 * 1024) {
          toast.error('Áudio gravado excede o limite de 5MB.');
          return;
        }

        setFileLoading(true);
        try {
          const path = `chat-audio/${Date.now()}.webm`;
          const { data, error } = await supabase.storage.from('dados').upload(path, audioBlob, {
            contentType: 'audio/webm'
          });
          if (error) throw error;

          const { data: urlData } = supabase.storage.from('dados').getPublicUrl(path);
          
          const res = await fetch(`${apiBase}/chat/messages${storedUser.profileType === 'master' ? `?campoId=${campoId}` : ''}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              fileUrl: urlData.publicUrl,
              fileName: 'Áudio Gravado.webm',
              fileType: 'audio',
              fileSize: audioBlob.size
            })
          });

          if (res.ok) {
            const newMessage = await res.json();
            setMessages((prev) => [...prev, newMessage]);
          } else {
            toast.error('Erro ao enviar áudio.');
          }
        } catch (err) {
          console.error("Audio upload failed", err);
          toast.error('Erro ao enviar gravação de áudio.');
        } finally {
          setFileLoading(false);
        }
      };

      setAudioChunks([]);
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone access denied", err);
      toast.error('Permissão de microfone negada ou indisponível.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorder && isRecording) {
      setIsRecording(false);
      mediaRecorder.onstop = null; // discard recording
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach((track) => track.stop());
    }
  };

  const handleSavePhrase = () => {
    setCustomStatus(statusPhraseInput);
    setIsEditingStatusPhrase(false);
    sendHeartbeat();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getStatusColorClass = (status: string) => {
    switch (status) {
      case 'online': return 'bg-emerald-500 ring-emerald-500/20';
      case 'busy': return 'bg-rose-500 ring-rose-500/20';
      case 'away': return 'bg-amber-500 ring-amber-500/20';
      default: return 'bg-slate-400 ring-slate-400/20';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'online': return 'Disponível';
      case 'busy': return 'Ocupado';
      case 'away': return 'Ausente';
      default: return 'Inativo';
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative flex h-14 w-14 items-center justify-center rounded-full bg-purple-600 hover:bg-purple-700 text-white shadow-2xl hover:scale-105 transition-all duration-200"
          title="Chat do Campo"
        >
          <MessageSquare className="h-6 w-6" />
          {/* Heartbeat notification ring */}
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className={`relative inline-flex rounded-full h-4 w-4 ${getStatusColorClass(presenceStatus)}`}></span>
          </span>
        </button>
      </div>

      {/* Main Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="fixed bottom-24 right-6 z-40 w-96 max-w-full h-[620px] bg-slate-900 border border-slate-700/60 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100 font-sans"
          >
            {/* MSN Messenger Nostalgic Header */}
            <div className="p-4 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <div className="w-10 h-10 bg-purple-600/30 rounded-xl flex items-center justify-center border border-purple-500/30">
                      <User className="w-5 h-5 text-purple-300" />
                    </div>
                    <span className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-slate-900 ${getStatusColorClass(presenceStatus)}`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm tracking-tight text-white">{storedUser.fullName || 'Eu'}</h3>
                    {/* Status selection list */}
                    <div className="flex items-center gap-2.5 mt-0.5">
                      <select
                        value={presenceStatus}
                        onChange={(e) => {
                          const nextStatus = e.target.value as 'online' | 'busy' | 'away';
                          setPresenceStatus(nextStatus);
                          toast.success(`Status alterado para: ${getStatusLabel(nextStatus)}`);
                        }}
                        className="bg-transparent text-xs text-slate-400 border-none outline-none cursor-pointer focus:ring-0 p-0 font-medium hover:text-white"
                      >
                        <option value="online" className="bg-slate-900 text-slate-100">Disponível</option>
                        <option value="busy" className="bg-slate-900 text-slate-100">Ocupado</option>
                        <option value="away" className="bg-slate-900 text-slate-100">Ausente</option>
                      </select>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Custom Message (Old MSN Personal Message) */}
              <div className="px-1 py-0.5">
                {isEditingStatusPhrase ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={statusPhraseInput}
                      onChange={(e) => setStatusPhraseInput(e.target.value)}
                      placeholder="Coloque uma frase no seu MSN..."
                      maxLength={100}
                      className="flex-1 bg-slate-850 text-xs px-2 py-1 rounded-lg border border-slate-700 text-slate-100 focus:outline-none focus:border-purple-500"
                    />
                    <button
                      onClick={handleSavePhrase}
                      className="px-2 py-1 bg-purple-600 hover:bg-purple-500 rounded-lg text-xs font-semibold"
                    >
                      Ok
                    </button>
                    <button
                      onClick={() => setIsEditingStatusPhrase(false)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs"
                    >
                      Canc.
                    </button>
                  </div>
                ) : (
                  <p
                    onClick={() => {
                      setStatusPhraseInput(customStatus || '');
                      setIsEditingStatusPhrase(true);
                    }}
                    className="text-xs text-slate-400 italic hover:text-purple-300 cursor-pointer truncate"
                    title="Clique para mudar a sua frase de status"
                  >
                    {customStatus ? `"${customStatus}"` : 'Clique para digitar uma frase de status...'}
                  </p>
                )}
              </div>
            </div>

            {/* Tab navigation */}
            <div className="flex border-b border-slate-800 bg-slate-950/40 text-xs font-bold uppercase tracking-wider text-center">
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-3 transition ${activeTab === 'chat' ? 'border-b-2 border-purple-500 text-white bg-slate-900/50' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Conversa ({messages.length})
              </button>
              <button
                onClick={() => setActiveTab('contacts')}
                className={`flex-1 py-3 transition ${activeTab === 'contacts' ? 'border-b-2 border-purple-500 text-white bg-slate-900/50' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Contatos MSN ({contacts.length})
              </button>
            </div>

            {/* Content Tabs */}
            <div className="flex-1 overflow-y-auto bg-slate-900/50 p-4">
              {activeTab === 'chat' ? (
                /* Chat view */
                <div className="flex flex-col gap-3 h-full">
                  {messages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                      <MessageSquare className="h-10 w-10 text-slate-700 mb-2" />
                      <p className="text-sm font-semibold text-slate-500">Nenhuma mensagem no Campo</p>
                      <p className="text-xs text-slate-600 mt-1">Seja o primeiro a enviar uma mensagem para seus colegas de Campo.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((msg) => {
                        const isSelf = msg.userId === currentUserId;
                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                          >
                            {/* Metadata */}
                            <div className="flex items-center gap-1.5 mb-1 px-1">
                              <span className="text-[10px] font-bold text-slate-400">
                                {msg.userName}
                              </span>
                              {msg.userRole && (
                                <span className="text-[9px] bg-slate-800 border border-slate-700 text-slate-300 px-1 rounded font-medium flex items-center gap-0.5">
                                  <Shield className="w-2.5 h-2.5" />
                                  {msg.userRole}
                                </span>
                              )}
                              <span className="text-[9px] text-slate-500">
                                {new Date(msg.createdAt).toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                            </div>

                            {/* Bubble Content */}
                            <div
                              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-md border ${
                                isSelf
                                  ? 'bg-purple-600 text-white border-purple-500 rounded-tr-none'
                                  : 'bg-slate-800 text-slate-100 border-slate-750 rounded-tl-none'
                              }`}
                            >
                              {msg.body && <p className="leading-relaxed break-words">{msg.body}</p>}

                              {/* Media Attachment types */}
                              {msg.fileUrl && (
                                <div className="mt-1">
                                  {msg.fileType === 'image' ? (
                                    /* Image rendering */
                                    <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">
                                      <img
                                        src={msg.fileUrl}
                                        alt={msg.fileName || 'Imagem'}
                                        className="rounded-lg max-h-48 w-full object-cover border border-slate-700/50 hover:opacity-90 transition cursor-zoom-in"
                                      />
                                    </a>
                                  ) : msg.fileType === 'audio' ? (
                                    /* Custom nostalgic audio player styling wrapper */
                                    <div className="flex flex-col gap-1 w-64 bg-slate-950/40 p-2.5 rounded-xl border border-white/5">
                                      <div className="flex items-center gap-2">
                                        <Volume2 className="w-4 h-4 text-purple-400 shrink-0" />
                                        <audio src={msg.fileUrl} controls className="h-8 w-full rounded outline-none" />
                                      </div>
                                      <span className="text-[9px] text-slate-400 self-end">
                                        {msg.fileSize ? formatFileSize(msg.fileSize) : ''}
                                      </span>
                                    </div>
                                  ) : (
                                    /* Generic files */
                                    <a
                                      href={msg.fileUrl}
                                      download={msg.fileName || 'arquivo'}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-3 bg-slate-900/40 hover:bg-slate-900/60 p-2.5 rounded-xl border border-white/5 text-xs font-semibold text-purple-300 hover:text-purple-200 transition"
                                    >
                                      <File className="w-5 h-5 shrink-0" />
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-slate-200">{msg.fileName}</p>
                                        <p className="text-[9px] text-slate-500 font-medium">
                                          {msg.fileSize ? formatFileSize(msg.fileSize) : ''}
                                        </p>
                                      </div>
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      <div ref={chatEndRef} />
                    </div>
                  )}
                </div>
              ) : (
                /* Online Presence List */
                <div className="space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Membros online no Campo ({contacts.length})
                  </p>
                  {contacts.length === 0 ? (
                    <div className="text-center py-10">
                      <p className="text-sm text-slate-500">Nenhum colega online no momento.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800">
                      {contacts.map((contact) => (
                        <div key={contact.id} className="flex items-start gap-3 py-3">
                          <div className="relative mt-0.5">
                            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-700">
                              <User className="w-4 h-4 text-slate-400" />
                            </div>
                            <span className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border border-slate-900 ${getStatusColorClass(contact.presenceStatus)}`} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold text-slate-100 truncate">{contact.fullName}</p>
                              {contact.roleName && (
                                <span className="text-[8px] bg-slate-800 border border-slate-700 text-slate-400 px-0.5 rounded font-bold shrink-0">
                                  {contact.roleName}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 italic truncate mt-0.5">
                              {contact.customStatus ? `"${contact.customStatus}"` : `(${getStatusLabel(contact.presenceStatus)})`}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Audio Recording overlay block */}
            <AnimatePresence>
              {isRecording && (
                <motion.div
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 50, opacity: 0 }}
                  className="absolute bottom-0 inset-x-0 p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-3 w-3 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                    </span>
                    <span className="font-bold text-rose-400">Gravando Áudio...</span>
                    <span className="text-slate-400 font-mono">
                      {Math.floor(recordDuration / 60)}:{String(recordDuration % 60).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={cancelRecording}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-xl font-semibold text-slate-300 transition"
                    >
                      Descartar
                    </button>
                    <button
                      onClick={stopRecording}
                      className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-white shadow-md transition"
                    >
                      Enviar
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Normal Input Area footer */}
            {!isRecording && activeTab === 'chat' && (
              <form
                onSubmit={handleSendMessage}
                className="p-4 bg-slate-950 border-t border-slate-800 flex items-center gap-2"
              >
                {/* Upload attachment hidden input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                  accept="image/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={fileLoading || loading}
                  className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition disabled:opacity-50"
                  title="Anexar arquivo (Máx 5MB)"
                >
                  {fileLoading ? (
                    <Loader className="w-5 h-5 animate-spin" />
                  ) : (
                    <Paperclip className="w-5 h-5" />
                  )}
                </button>

                {/* Microphone audio record trigger */}
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={fileLoading || loading}
                  className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-rose-400 transition disabled:opacity-50"
                  title="Gravar Mensagem de Voz"
                >
                  <Mic className="w-5 h-5" />
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={loading}
                  placeholder="Enviar mensagem..."
                  className="flex-1 bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-purple-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 transition text-slate-100 placeholder:text-slate-500"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim() || loading}
                  className="p-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 text-white rounded-xl shadow transition disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
