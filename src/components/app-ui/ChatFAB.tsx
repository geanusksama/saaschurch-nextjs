import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, X, Send, Paperclip, Mic, Image, File, Play, Pause, 
  Circle, AlertCircle, Loader, User, Clock, Check, Volume2, Shield,
  Wifi, WifiOff, Search, ArrowLeft, MoreVertical, Smile, CornerUpLeft, Trash2,
  MapPin
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
  parentId?: string | null;
  parentName?: string | null;
  parentBody?: string | null;
  reactions?: any | null;
}

interface OnlineContact {
  id: string;
  fullName: string;
  presenceStatus: 'online' | 'busy' | 'away' | string;
  customStatus: string | null;
  roleName: string | null;
  lastActiveAt: string;
  email?: string;
}

export function ChatFAB() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'contacts'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [contacts, setContacts] = useState<OnlineContact[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null);
  
  // 1-on-1 private chat states
  const [selectedContact, setSelectedContact] = useState<any | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [activeDropdownMsgId, setActiveDropdownMsgId] = useState<string | null>(null);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState('Minha Localização');
  const [loadingGps, setLoadingGps] = useState(false);

  // User presence info
  const [presenceStatus, setPresenceStatus] = useState<'online' | 'busy' | 'away' | 'furtivo'>('online');
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
  const chatInputRef = useRef<HTMLInputElement>(null);

  const storedUser = (() => {
    try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); } catch { return {}; }
  })();
  const token = localStorage.getItem('mrm_token');
  const activeFieldId = localStorage.getItem('mrm_active_field_id') || storedUser.campoId || '';
  const currentUserId = storedUser.id || '';
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnlyOnline, setShowOnlyOnline] = useState(false);

  // Reset unread count when opening the panel
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

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
  }, [token, presenceStatus, customStatus, activeFieldId]);

  // Load conversation messages or conversations list
  useEffect(() => {
    if (!token || !isOpen) return;

    if (selectedContact) {
      fetchMessages(selectedContact.id);
    } else {
      fetchConversations();
    }
  }, [token, isOpen, selectedContact, activeFieldId]);

  // Realtime subscription for new chat messages (active always)
  useEffect(() => {
    if (!token || !activeFieldId) return;

    const channel = supabase
      .channel(`chat_messages_${activeFieldId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'internal_chat_messages',
          filter: `campo_id=eq.${activeFieldId}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as any;
            if (!newMsg) return;

            const isForSelectedContact =
              selectedContact &&
              ((newMsg.user_id === currentUserId && newMsg.receiver_id === selectedContact.id) ||
               (newMsg.user_id === selectedContact.id && newMsg.receiver_id === currentUserId));

            if (isForSelectedContact) {
              const formattedMsg: ChatMessage = {
                id: newMsg.id,
                campoId: newMsg.campo_id,
                userId: newMsg.user_id,
                userName: newMsg.user_name,
                userRole: newMsg.user_role,
                body: newMsg.body,
                fileUrl: newMsg.file_url,
                fileName: newMsg.file_name,
                fileType: newMsg.file_type,
                fileSize: newMsg.file_size,
                createdAt: newMsg.created_at,
                parentId: newMsg.parent_id,
                parentName: newMsg.parent_name,
                parentBody: newMsg.parent_body,
                reactions: newMsg.reactions
              };

              setMessages((prev) => {
                if (prev.some((m) => m.id === formattedMsg.id)) return prev;
                return [...prev, formattedMsg];
              });
            }

            // Always reload active conversations list to keep snippets fresh
            fetchConversations();

            // Notify if message is directed to current user and either chat is closed or it's from a different contact
            const isForMe = newMsg.receiver_id === currentUserId;
            const isNotSelected = !selectedContact || selectedContact.id !== newMsg.user_id;

            if (isForMe && (isNotSelected || !isOpen)) {
              setUnreadCount((prev) => prev + 1);
              toast.info(`Nova mensagem de ${newMsg.user_name}: ${newMsg.body || 'Arquivo anexado'}`, {
                action: {
                  label: 'Conversar',
                  onClick: () => {
                    setSelectedContact({
                      id: newMsg.user_id,
                      fullName: newMsg.user_name,
                      presenceStatus: 'online'
                    });
                    setActiveTab('chat');
                    setIsOpen(true);
                  }
                }
              });
            }
          } else if (payload.eventType === 'DELETE') {
            const oldId = payload.old?.id;
            if (oldId) {
              setMessages((prev) => prev.filter((m) => m.id !== oldId));
              fetchConversations();
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as any;
            if (updatedMsg) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === updatedMsg.id
                    ? {
                        ...m,
                        body: updatedMsg.body,
                        fileUrl: updatedMsg.file_url,
                        fileName: updatedMsg.file_name,
                        fileType: updatedMsg.file_type,
                        fileSize: updatedMsg.file_size,
                        createdAt: updatedMsg.created_at,
                        parentId: updatedMsg.parent_id,
                        parentName: updatedMsg.parent_name,
                        parentBody: updatedMsg.parent_body,
                        reactions: updatedMsg.reactions
                      }
                    : m
                )
              );
              fetchConversations();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [token, activeFieldId, isOpen, selectedContact, currentUserId]);

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
      const res = await fetch(`${apiBase}/chat/presence${activeFieldId ? `?campoId=${activeFieldId}` : ''}`, {
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

  const fetchMessages = async (contactId?: string) => {
    if (!token) return;
    const targetId = contactId || selectedContact?.id;
    if (!targetId) return;

    try {
      const res = await fetch(`${apiBase}/chat/messages?contactId=${targetId}${activeFieldId ? `&campoId=${activeFieldId}` : ''}`, {
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

  const fetchConversations = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/chat/messages${activeFieldId ? `?campoId=${activeFieldId}` : ''}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error("Failed to fetch conversations", err);
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!inputText.trim() && !stagedFile) || !token || !selectedContact) return;

    const bodyText = inputText;
    const currentReply = replyingTo;

    setInputText('');
    setReplyingTo(null);
    setLoading(true);

    try {
      let uploadedFileUrl = null;
      let uploadedFileName = null;
      let uploadedFileType = null;
      let uploadedFileSize = null;

      // 1. Upload file if staged
      if (stagedFile) {
        setFileLoading(true);
        try {
          const fileExt = stagedFile.name.split('.').pop();
          const path = `chat-files/${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${fileExt}`;

          const { data, error } = await supabase.storage.from('dados').upload(path, stagedFile);
          if (error) throw error;

          const { data: urlData } = supabase.storage.from('dados').getPublicUrl(path);
          uploadedFileUrl = urlData.publicUrl;
          uploadedFileName = stagedFile.name;
          uploadedFileType = stagedFile.type.startsWith('image/')
            ? 'image'
            : stagedFile.type.startsWith('audio/')
            ? 'audio'
            : 'file';
          uploadedFileSize = stagedFile.size;

          setStagedFile(null);
        } catch (err) {
          console.error("File upload failed", err);
          toast.error('Erro ao fazer upload do arquivo.');
          setLoading(false);
          setFileLoading(false);
          return;
        } finally {
          setFileLoading(false);
        }
      }

      // 2. Send request to messages API
      const res = await fetch(`${apiBase}/chat/messages${activeFieldId ? `?campoId=${activeFieldId}` : ''}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          body: bodyText || null,
          receiverId: selectedContact.id,
          fileUrl: uploadedFileUrl,
          fileName: uploadedFileName,
          fileType: uploadedFileType,
          fileSize: uploadedFileSize,
          parentId: currentReply ? currentReply.id : null,
          parentName: currentReply ? currentReply.userName : null,
          parentBody: currentReply ? (currentReply.body || currentReply.fileName || 'Arquivo') : null
        })
      });

      if (res.ok) {
        const newMessage = await res.json();
        setMessages((prev) => [...prev, newMessage]);
        fetchConversations();
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit: 5MB
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('O arquivo excede o limite de 5MB.');
      return;
    }

    setStagedFile(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/chat/messages`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ messageId, emoji })
      });
      if (res.ok) {
        const updatedMsg = await res.json();
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, reactions: updatedMsg.reactions } : m))
        );
      }
    } catch (err) {
      console.error("Failed to toggle reaction", err);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${apiBase}/chat/messages?messageId=${messageId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        fetchConversations();
        toast.success("Mensagem excluída.");
      } else {
        toast.error("Não foi possível excluir a mensagem.");
      }
    } catch (err) {
      console.error("Failed to delete message", err);
      toast.error("Erro ao excluir.");
    }
  };

  // Location handling
  const handleRequestLocation = () => {
    setAttachmentMenuOpen(false);
    setLoadingGps(true);
    setLocationModalOpen(true);
    setLocationName('Minha Localização');
    setGpsCoords(null);

    if (!navigator.geolocation) {
      toast.error('Geolocalização não é suportada neste navegador.');
      setLoadingGps(false);
      setLocationModalOpen(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setLoadingGps(false);
      },
      (error) => {
        console.error("Geolocation error", error);
        toast.error('Não foi possível obter sua localização. Verifique as permissões.');
        setLoadingGps(false);
        setLocationModalOpen(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleSendLocation = async () => {
    if (!gpsCoords || !token || !selectedContact) return;
    setLocationModalOpen(false);
    setLoading(true);

    try {
      const mapsUrl = `https://www.google.com/maps?q=${gpsCoords.lat},${gpsCoords.lng}`;
      const bodyText = `📍 ${locationName}\n${mapsUrl}`;

      const res = await fetch(`${apiBase}/chat/messages${activeFieldId ? `?campoId=${activeFieldId}` : ''}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          body: bodyText,
          receiverId: selectedContact.id
        })
      });

      if (res.ok) {
        const newMessage = await res.json();
        setMessages((prev) => [...prev, newMessage]);
        fetchConversations();
      } else {
        toast.error('Erro ao enviar localização.');
      }
    } catch (err) {
      console.error("Location send failed", err);
      toast.error('Falha ao enviar localização.');
    } finally {
      setLoading(false);
      setGpsCoords(null);
    }
  };

  // Recording audio
  const startRecording = async () => {
    if (!selectedContact) return;
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
          
          const res = await fetch(`${apiBase}/chat/messages${activeFieldId ? `?campoId=${activeFieldId}` : ''}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              fileUrl: urlData.publicUrl,
              fileName: 'Áudio Gravado.webm',
              fileType: 'audio',
              fileSize: audioBlob.size,
              receiverId: selectedContact.id
            })
          });

          if (res.ok) {
            const newMessage = await res.json();
            setMessages((prev) => [...prev, newMessage]);
            fetchConversations();
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return '#22c55e'; // Green
      case 'busy': return '#ef4444'; // Red
      case 'away': return '#f59e0b'; // Amber/Orange
      case 'furtivo': return '#94a3b8'; // Slate/Gray
      default: return '#94a3b8'; // Slate/Gray
    }
  };

  const handleContactClick = (contact: OnlineContact) => {
    setSelectedContact(contact);
    setActiveTab('chat');
    setInputText('');
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 50);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'online': return 'Disponível';
      case 'busy': return 'Ocupado';
      case 'away': return 'Ausente';
      case 'furtivo': return 'Invisível';
      default: return 'Offline';
    }
  };

  const filteredContacts = contacts.filter((contact) => {
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      contact.fullName.toLowerCase().includes(query) ||
      (contact.roleName || '').toLowerCase().includes(query) ||
      (contact.email || '').toLowerCase().includes(query);

    if (!matchesSearch) return false;

    if (showOnlyOnline) {
      return contact.presenceStatus !== 'offline' && contact.presenceStatus !== 'furtivo';
    }

    return true;
  });

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

          {/* Unread count badge */}
          {unreadCount > 0 && (
            <span className="absolute -top-2 -left-2 bg-rose-600 text-white text-[10px] font-bold h-5 w-5 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-900 shadow animate-bounce">
              {unreadCount}
            </span>
          )}

          {/* Heartbeat notification ring */}
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: getStatusColor(presenceStatus) }}
            />
            <span
              className="relative inline-flex rounded-full h-4 w-4"
              style={{
                backgroundColor: getStatusColor(presenceStatus),
                boxShadow: `0 0 0 2px ${getStatusColor(presenceStatus)}20`
              }}
            />
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
            className="fixed bottom-24 right-6 z-40 w-96 max-w-full h-[620px] bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 font-sans"
          >
            {/* Header */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-2">
              {selectedContact ? (
                /* Conversation Header (WhatsApp-style back button and contact info) */
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSelectedContact(null)}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors"
                      title="Voltar para conversas"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="relative">
                      <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center border border-purple-200 dark:border-purple-800/30">
                        <User className="w-5 h-5 text-purple-600 dark:text-purple-300" />
                      </div>
                      <span
                        className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-900"
                        style={{ backgroundColor: getStatusColor(selectedContact.presenceStatus) }}
                      />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm tracking-tight text-slate-800 dark:text-white truncate max-w-[150px]" title={selectedContact.fullName}>
                        {selectedContact.fullName}
                      </h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 italic truncate max-w-[150px]">
                        {selectedContact.customStatus ? `"${selectedContact.customStatus}"` : selectedContact.roleName || getStatusLabel(selectedContact.presenceStatus)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-450 hover:text-slate-650 dark:hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                /* Main Header (Self Status Selector) */
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center border border-purple-200 dark:border-purple-800/30">
                        <User className="w-5 h-5 text-purple-600 dark:text-purple-300" />
                      </div>
                      <span
                        className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white dark:border-slate-900"
                        style={{ backgroundColor: getStatusColor(presenceStatus) }}
                      />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm tracking-tight text-slate-800 dark:text-white">{storedUser.fullName || 'Eu'}</h3>
                      {/* Status selection list */}
                      <div className="flex items-center gap-2.5 mt-0.5">
                        <select
                          value={presenceStatus}
                          onChange={(e) => {
                            const nextStatus = e.target.value as 'online' | 'busy' | 'away' | 'furtivo';
                            setPresenceStatus(nextStatus);
                            toast.success(`Status alterado para: ${getStatusLabel(nextStatus)}`);
                          }}
                          className="bg-transparent text-xs text-slate-500 dark:text-slate-400 border-none outline-none cursor-pointer focus:ring-0 p-0 font-semibold hover:text-slate-800 dark:hover:text-white"
                        >
                          <option value="online" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold">Disponível</option>
                          <option value="busy" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold">Ocupado</option>
                          <option value="away" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold">Ausente</option>
                          <option value="furtivo" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-semibold">Invisível (Furtivo)</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-450 hover:text-slate-650 dark:hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Status Custom Message (Self status, shown only when conversations list / contacts list is active) */}
              {!selectedContact && (
                <div className="px-1 py-0.5">
                  {isEditingStatusPhrase ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={statusPhraseInput}
                        onChange={(e) => setStatusPhraseInput(e.target.value)}
                        placeholder="Coloque uma frase de status..."
                        maxLength={100}
                        className="flex-1 bg-white dark:bg-slate-900 text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-purple-500"
                      />
                      <button
                        onClick={handleSavePhrase}
                        className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 rounded-lg text-xs font-semibold text-white transition"
                      >
                        Ok
                      </button>
                      <button
                        onClick={() => setIsEditingStatusPhrase(false)}
                        className="px-2.5 py-1 bg-slate-200 dark:bg-slate-800 hover:bg-slate-350 dark:hover:bg-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300"
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
                      className="text-xs text-slate-500 dark:text-slate-400 italic hover:text-purple-650 dark:hover:text-purple-300 cursor-pointer truncate"
                      title="Clique para mudar a sua frase de status"
                    >
                      {customStatus ? `"${customStatus}"` : 'Clique para digitar uma frase de status...'}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Tab navigation (Hidden when inside a private conversation) */}
            {!selectedContact && (
              <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/40 dark:bg-slate-950/40 text-xs font-bold uppercase tracking-wider text-center">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex-1 py-3 transition ${activeTab === 'chat' ? 'border-b-2 border-purple-500 text-purple-600 dark:text-white bg-purple-50/10 dark:bg-slate-900/50' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  Conversas ({conversations.length})
                </button>
                <button
                  onClick={() => setActiveTab('contacts')}
                  className={`flex-1 py-3 transition ${activeTab === 'contacts' ? 'border-b-2 border-purple-500 text-purple-600 dark:text-white bg-purple-50/10 dark:bg-slate-900/50' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  Contatos ({contacts.length})
                </button>
              </div>
            )}

            {/* Content Panel */}
            <div className="flex-1 overflow-y-auto bg-slate-50/30 dark:bg-slate-900/50 p-4">
              {activeTab === 'chat' ? (
                /* Chat view */
                selectedContact ? (
                  /* Active conversation messages */
                  <div className="flex flex-col gap-3 h-full">
                    {messages.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                        <MessageSquare className="h-10 w-10 text-slate-300 dark:text-slate-700 mb-2" />
                        <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">Nenhuma mensagem ainda</p>
                        <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">Diga olá para iniciar esta conversa!</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((msg) => {
                          const isSelf = msg.userId === currentUserId;
                          return (
                            <div
                              key={msg.id}
                              className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} group/row mb-2`}
                            >
                              {/* Metadata */}
                              <div className="flex items-center gap-1.5 mb-1 px-1">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                  {msg.userName}
                                </span>
                                {msg.userRole && (
                                  <span className="text-[9px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-650 dark:text-slate-300 px-1 rounded font-medium flex items-center gap-0.5">
                                    <Shield className="w-2.5 h-2.5" />
                                    {msg.userRole}
                                  </span>
                                )}
                                <span className="text-[9px] text-slate-400 dark:text-slate-505">
                                  {new Date(msg.createdAt).toLocaleTimeString('pt-BR', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>

                              {/* Message bubble + Actions row */}
                              <div className={`flex items-center gap-1 relative ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}>
                                {/* Bubble Content wrapper */}
                                <div
                                  className={`relative max-w-[80vw] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm shadow-sm border ${
                                    isSelf
                                      ? 'bg-purple-600 text-white border-purple-500 rounded-tr-none'
                                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-750 rounded-tl-none'
                                  }`}
                                >
                                  {/* Reply Box quote inside the bubble */}
                                  {msg.parentId && (
                                    <div className={`mb-2 p-2 rounded-lg border-l-4 text-xs text-left max-w-full truncate opacity-95 ${
                                      isSelf
                                        ? 'bg-black/20 border-purple-300 text-purple-100'
                                        : 'bg-slate-100 dark:bg-slate-900 border-purple-500 text-slate-700 dark:text-slate-300'
                                    }`}>
                                      <p className={`font-bold mb-0.5 truncate ${isSelf ? 'text-white' : 'text-purple-600 dark:text-purple-400'}`}>{msg.parentName}</p>
                                      <p className="truncate opacity-90">{msg.parentBody}</p>
                                    </div>
                                  )}

                                  {msg.body && <p className="leading-relaxed break-words">{msg.body}</p>}

                                  {/* Media Attachment types */}
                                  {msg.fileUrl && (
                                    <div className="mt-1">
                                      {msg.fileType === 'image' ? (
                                        <button
                                          type="button"
                                          onClick={() => setPreviewFile({ url: msg.fileUrl!, name: msg.fileName || 'Imagem', type: 'image' })}
                                          className="block w-full text-left"
                                        >
                                          <img
                                            src={msg.fileUrl}
                                            alt={msg.fileName || 'Imagem'}
                                            className="rounded-lg max-h-48 w-full object-cover border border-slate-150 dark:border-slate-700/50 hover:opacity-90 transition cursor-zoom-in"
                                          />
                                        </button>
                                      ) : msg.fileType === 'audio' ? (
                                        <div className="flex flex-col gap-1 w-64 bg-slate-100 dark:bg-slate-950/40 p-2.5 rounded-xl border border-slate-200 dark:border-white/5">
                                          <div className="flex items-center gap-2">
                                            <Volume2 className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                                            <audio src={msg.fileUrl} controls className="h-8 w-full rounded outline-none" />
                                          </div>
                                          <span className="text-[9px] text-slate-500 dark:text-slate-400 self-end">
                                            {msg.fileSize ? formatFileSize(msg.fileSize) : ''}
                                          </span>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const isPdf = msg.fileName?.toLowerCase().endsWith('.pdf');
                                            const isOffice = ['.docx', '.xlsx', '.pptx', '.doc', '.xls'].some(ext => msg.fileName?.toLowerCase().endsWith(ext));
                                            const type = isPdf ? 'pdf' : isOffice ? 'office' : 'download';
                                            setPreviewFile({ url: msg.fileUrl!, name: msg.fileName || 'Arquivo', type });
                                          }}
                                          className="w-full flex items-center gap-3 bg-slate-100 dark:bg-slate-900/40 hover:bg-slate-200 dark:hover:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200 dark:border-white/5 text-xs font-semibold text-purple-650 dark:text-purple-300 text-left transition"
                                        >
                                          <File className="w-5 h-5 shrink-0" />
                                          <div className="min-w-0 flex-1">
                                            <p className="truncate text-slate-750 dark:text-slate-200">{msg.fileName}</p>
                                            <p className="text-[9px] text-slate-500 font-medium">
                                              {msg.fileSize ? formatFileSize(msg.fileSize) : ''}
                                            </p>
                                          </div>
                                        </button>
                                      )}
                                    </div>
                                  )}

                                  {/* Emoji Reactions Badge inside bubble boundary */}
                                  {msg.reactions && typeof msg.reactions === 'object' && Object.keys(msg.reactions).length > 0 && (
                                    <div className={`absolute -bottom-2.5 flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded-full shadow-sm text-[10px] z-10 ${isSelf ? 'right-2' : 'left-2'}`}>
                                      {Object.entries(msg.reactions).map(([emoji, users]: [string, any]) => (
                                        <button
                                          key={emoji}
                                          type="button"
                                          onClick={() => handleToggleReaction(msg.id, emoji)}
                                          title={users.map((u: any) => u.userName).join(', ')}
                                          className="flex items-center gap-0.5 hover:scale-110 active:scale-95 transition"
                                        >
                                          <span>{emoji}</span>
                                          <span className="text-slate-500 dark:text-slate-400 font-semibold">{users.length}</span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Option Actions (3-dot dropdown) visible on hover */}
                                <div className="relative shrink-0 flex items-center">
                                  <button
                                    type="button"
                                    onClick={() => setActiveDropdownMsgId(activeDropdownMsgId === msg.id ? null : msg.id)}
                                    className="opacity-0 group-hover/row:opacity-100 p-1 rounded-lg hover:bg-slate-250 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-opacity duration-150 mx-1 shrink-0"
                                    title="Opções"
                                  >
                                    <MoreVertical className="w-4.5 h-4.5" />
                                  </button>

                                  {/* Menu overlay box */}
                                  {activeDropdownMsgId === msg.id && (
                                    <>
                                      <div className="fixed inset-0 z-30" onClick={() => setActiveDropdownMsgId(null)} />
                                      <div className={`absolute z-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-1.5 w-36 flex flex-col gap-0.5 ${isSelf ? 'right-full mr-1 bottom-0' : 'left-full ml-1 bottom-0'}`}>
                                        {/* Quick reactions emojis */}
                                        <div className="flex gap-1 justify-between px-1 py-1 border-b border-slate-100 dark:border-slate-800 mb-1">
                                          {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji) => (
                                            <button
                                              key={emoji}
                                              type="button"
                                              onClick={() => {
                                                handleToggleReaction(msg.id, emoji);
                                                setActiveDropdownMsgId(null);
                                              }}
                                              className="hover:scale-125 transition text-sm active:scale-95"
                                            >
                                              {emoji}
                                            </button>
                                          ))}
                                        </div>
                                        {/* Reply button */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setReplyingTo(msg);
                                            setActiveDropdownMsgId(null);
                                            chatInputRef.current?.focus();
                                          }}
                                          className="w-full text-left px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center gap-1.5 font-medium text-slate-750 dark:text-slate-305 transition-colors"
                                        >
                                          <CornerUpLeft className="w-3.5 h-3.5" />
                                          Responder
                                        </button>
                                        {/* Delete button */}
                                        {(isSelf || storedUser.profileType === 'master') && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (confirm("Deseja excluir esta mensagem para todos?")) {
                                                handleDeleteMessage(msg.id);
                                              }
                                              setActiveDropdownMsgId(null);
                                            }}
                                            className="w-full text-left px-2 py-1 text-xs hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg flex items-center gap-1.5 font-bold text-rose-600 dark:text-rose-400 transition-colors"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Excluir
                                          </button>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={chatEndRef} />
                      </div>
                    )}
                  </div>
                ) : (
                  /* Conversations List (WhatsApp style) */
                  <div className="space-y-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-505">
                      Conversas Recentes
                    </p>
                    {conversations.length === 0 ? (
                      <div className="text-center py-10 flex flex-col items-center justify-center">
                        <MessageSquare className="h-10 w-10 text-slate-300 dark:text-slate-700 mb-2" />
                        <p className="text-sm text-slate-400 dark:text-slate-500 font-semibold">Nenhuma conversa ativa</p>
                        <p className="text-xs text-slate-400 dark:text-slate-600 mt-1 max-w-[200px] mx-auto">
                          Vá para a aba **Contatos** para iniciar um novo chat privado com seus colegas.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-150 dark:divide-slate-800">
                        {conversations.map((conv) => {
                          const isOffline = conv.presenceStatus === 'offline' || conv.presenceStatus === 'furtivo';
                          const lastMsg = conv.lastMessage;
                          const formattedTime = new Date(lastMsg.createdAt).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          });

                          return (
                            <div
                              key={conv.id}
                              onClick={() => setSelectedContact(conv)}
                              className="flex items-center gap-3 py-3 px-2 hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer transition-colors"
                            >
                              <div className="relative mt-0.5">
                                <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0">
                                  <User className="w-4.5 h-4.5 text-slate-500 dark:text-slate-400" />
                                </div>
                                <span
                                  className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border border-white dark:border-slate-900"
                                  style={{ backgroundColor: getStatusColor(conv.presenceStatus) }}
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <p className="text-sm font-semibold text-slate-750 dark:text-slate-100 truncate">{conv.fullName}</p>
                                    {conv.roleName && (
                                      <span className="text-[8px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 px-0.5 rounded font-bold shrink-0">
                                        {conv.roleName}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[9px] text-slate-400 dark:text-slate-505 shrink-0 font-medium">{formattedTime}</span>
                                </div>
                                <p className="text-xs text-slate-450 dark:text-slate-400 truncate mt-0.5 font-medium">
                                  {lastMsg.senderId === currentUserId ? 'Você: ' : ''}
                                  {lastMsg.body || (lastMsg.fileType === 'image' ? '📷 Imagem' : lastMsg.fileType === 'audio' ? '🎵 Áudio' : '📎 Arquivo')}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )
              ) : (
                /* Contacts list with query */
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Buscar por nome, e-mail ou cargo..."
                        className="w-full bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-505 rounded-xl pl-8 pr-3 py-1.5 text-xs border border-slate-200 dark:border-slate-850 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition"
                      />
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 w-3.5 h-3.5" />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs font-bold"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => setShowOnlyOnline(!showOnlyOnline)}
                      className={`p-2 rounded-xl border transition-all duration-200 shrink-0 active:scale-95 ${
                        showOnlyOnline
                          ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                          : 'bg-slate-100 border-slate-200 dark:bg-slate-900 dark:border-slate-850 text-slate-500 dark:text-slate-400 hover:bg-slate-150 dark:hover:bg-slate-800'
                      }`}
                      title={showOnlyOnline ? "Mostrando apenas online" : "Mostrando todos"}
                    >
                      {showOnlyOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-505">
                    Contatos ({filteredContacts.length})
                  </p>
                  {filteredContacts.length === 0 ? (
                    <div className="text-center py-10">
                      <p className="text-sm text-slate-450 dark:text-slate-505">Nenhum contato encontrado.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-150 dark:divide-slate-800/60">
                      {filteredContacts.map((contact) => {
                        const isOffline = contact.presenceStatus === 'offline' || contact.presenceStatus === 'furtivo';
                        return (
                          <div
                            key={contact.id}
                            onClick={() => handleContactClick(contact)}
                            className="flex items-center justify-between py-3 px-2 hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer transition-colors group"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="relative shrink-0">
                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                                  <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                                </div>
                                <span
                                  className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border border-white dark:border-slate-900"
                                  style={{ backgroundColor: getStatusColor(contact.presenceStatus) }}
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-sm font-semibold text-slate-750 dark:text-slate-100 truncate">{contact.fullName}</p>
                                  {contact.roleName && (
                                    <span className="text-[8px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 px-0.5 rounded font-bold shrink-0">
                                      {contact.roleName}
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-400 dark:text-slate-505 italic truncate mt-0.5">
                                  {contact.customStatus ? `"${contact.customStatus}"` : isOffline ? '(Inativo)' : `(${getStatusLabel(contact.presenceStatus)})`}
                                </p>
                              </div>
                            </div>

                            {/* Chat icon indicator on the right */}
                            <div className="p-2 rounded-lg text-purple-650 dark:text-purple-400 group-hover:bg-purple-50 dark:group-hover:bg-purple-950/30 transition shrink-0 ml-2" title="Iniciar conversa">
                              <MessageSquare className="w-4 h-4" />
                            </div>
                          </div>
                        );
                      })}
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
                  className="absolute bottom-0 inset-x-0 p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-850 dark:text-slate-100"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-3 w-3 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                    </span>
                    <span className="font-bold text-rose-600 dark:text-rose-400">Gravando Áudio...</span>
                    <span className="text-slate-500 dark:text-slate-400 font-mono">
                      {Math.floor(recordDuration / 60)}:{String(recordDuration % 60).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={cancelRecording}
                      className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold text-slate-650 dark:text-slate-350 transition"
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

            {/* Normal Input Area footer (Shown only when in an active conversation and not recording) */}
            {!isRecording && activeTab === 'chat' && selectedContact && (
              <div className="flex flex-col border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                {/* Reply Preview Banner */}
                {replyingTo && (
                  <div className="px-4 py-2 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                    <div className="flex-1 min-w-0 border-l-2 border-purple-500 pl-2">
                      <p className="font-bold text-purple-600 dark:text-purple-400">Respondendo a {replyingTo.userName}</p>
                      <p className="text-slate-500 dark:text-slate-400 truncate">
                        {replyingTo.body || (replyingTo.fileType === 'image' ? 'Imagem' : replyingTo.fileType === 'audio' ? 'Áudio' : 'Arquivo')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReplyingTo(null)}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Staged File Preview Banner */}
                {stagedFile && (
                  <div className="px-4 py-2 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {stagedFile.type.startsWith('image/') ? (
                        <Image className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                      ) : (
                        <File className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-700 dark:text-slate-300 truncate">{stagedFile.name}</p>
                        <p className="text-[10px] text-slate-500">{formatFileSize(stagedFile.size)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStagedFile(null)}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <form
                  onSubmit={handleSendMessage}
                  className="p-4 flex items-center gap-2"
                >
                  {/* Upload attachment hidden inputs */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain"
                  />
                  <input
                    id="audioFileInput"
                    type="file"
                    onChange={handleFileChange}
                    className="hidden"
                    accept="audio/*"
                  />

                  {/* Attachment popover trigger */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setAttachmentMenuOpen(!attachmentMenuOpen)}
                      disabled={fileLoading || loading}
                      className="p-2 hover:bg-slate-200 dark:hover:bg-slate-850 rounded-xl text-slate-450 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition disabled:opacity-50"
                      title="Anexar"
                    >
                      {fileLoading ? (
                        <Loader className="w-5 h-5 animate-spin" />
                      ) : (
                        <Paperclip className="w-5 h-5" />
                      )}
                    </button>

                    {/* Attachment options dropdown */}
                    <AnimatePresence>
                      {attachmentMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setAttachmentMenuOpen(false)} />
                          <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute bottom-full mb-2 left-0 z-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl p-1.5 w-48 flex flex-col gap-0.5"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setAttachmentMenuOpen(false);
                                fileInputRef.current?.click();
                              }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center gap-2.5 font-medium text-slate-700 dark:text-slate-300 transition-colors"
                            >
                              <File className="w-4 h-4 text-purple-500" />
                              Arquivo / Imagem
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAttachmentMenuOpen(false);
                                document.getElementById('audioFileInput')?.click();
                              }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center gap-2.5 font-medium text-slate-700 dark:text-slate-300 transition-colors"
                            >
                              <Volume2 className="w-4 h-4 text-rose-500" />
                              Áudio do Sistema
                            </button>
                            <button
                              type="button"
                              onClick={handleRequestLocation}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center gap-2.5 font-medium text-slate-700 dark:text-slate-300 transition-colors"
                            >
                              <MapPin className="w-4 h-4 text-emerald-500" />
                              Localização
                            </button>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Microphone audio record trigger */}
                  <button
                    type="button"
                    onClick={startRecording}
                    disabled={fileLoading || loading}
                    className="p-2 hover:bg-slate-250 dark:hover:bg-slate-850 rounded-xl text-slate-450 dark:text-slate-400 hover:text-rose-500 transition disabled:opacity-50"
                    title="Gravar Mensagem de Voz"
                  >
                    <Mic className="w-5 h-5" />
                  </button>

                  <input
                    ref={chatInputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    disabled={loading}
                    placeholder={stagedFile ? "Adicionar legenda..." : "Enviar mensagem..."}
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 focus:border-purple-500 dark:focus:border-purple-500 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500 transition text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-505"
                  />

                  <button
                    type="submit"
                    disabled={(!inputText.trim() && !stagedFile) || loading}
                    className="p-2 bg-purple-650 hover:bg-purple-600 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white rounded-xl shadow transition disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* File Preview Modal */}
      <AnimatePresence>
        {previewFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800"
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-slate-150 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
                <div className="flex items-center gap-2.5 min-w-0">
                  <File className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0" />
                  <h3 className="font-bold text-sm text-slate-800 dark:text-white truncate" title={previewFile.name}>
                    {previewFile.name}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={previewFile.url}
                    download={previewFile.name}
                    className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-purple-500/10"
                  >
                    Baixar Arquivo
                  </a>
                  <button
                    onClick={() => setPreviewFile(null)}
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body / Viewer */}
              <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-100 dark:bg-slate-950/40 min-h-[300px]">
                {previewFile.type === 'image' ? (
                  <img
                    src={previewFile.url}
                    alt={previewFile.name}
                    className="max-w-full max-h-[70vh] object-contain rounded-lg shadow border border-slate-200 dark:border-slate-800"
                  />
                ) : previewFile.type === 'pdf' ? (
                  <iframe
                    src={`${previewFile.url}#toolbar=0`}
                    className="w-full h-[70vh] rounded-lg border border-slate-200 dark:border-slate-800"
                    title={previewFile.name}
                  />
                ) : previewFile.type === 'office' ? (
                  <iframe
                    src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewFile.url)}`}
                    className="w-full h-[70vh] rounded-lg border border-slate-200 dark:border-slate-800"
                    title={previewFile.name}
                  />
                ) : (
                  <div className="text-center p-8 max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow">
                    <File className="w-12 h-12 text-slate-305 dark:text-slate-600 mx-auto mb-3" />
                    <p className="font-bold text-sm text-slate-800 dark:text-white mb-1">
                      Visualização indisponível
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                      Este tipo de arquivo não pode ser visualizado diretamente no navegador.
                    </p>
                    <a
                      href={previewFile.url}
                      download={previewFile.name}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow"
                    >
                      Clique para fazer o download
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Location Confirmation Modal */}
      <AnimatePresence>
        {locationModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-slate-200 dark:border-slate-800"
            >
              {/* Location Modal Header */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-emerald-500" />
                  <h3 className="font-bold text-sm text-slate-800 dark:text-white">Enviar Localização</h3>
                </div>
                <button
                  onClick={() => { setLocationModalOpen(false); setGpsCoords(null); }}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Location Modal Body */}
              <div className="p-5 flex flex-col gap-4">
                {loadingGps ? (
                  <div className="flex flex-col items-center justify-center py-6 gap-3">
                    <Loader className="w-8 h-8 animate-spin text-emerald-500" />
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Obtendo localização GPS...</p>
                  </div>
                ) : gpsCoords ? (
                  <>
                    {/* Mini map preview */}
                    <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
                      <img
                        src={`https://maps.googleapis.com/maps/api/staticmap?center=${gpsCoords.lat},${gpsCoords.lng}&zoom=15&size=400x200&markers=color:red%7C${gpsCoords.lat},${gpsCoords.lng}&key=`}
                        alt="Mapa"
                        className="w-full h-40 object-cover bg-slate-100 dark:bg-slate-800"
                        onError={(e) => {
                          // Fallback if Google Maps static API fails (no key)
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                      {/* Fallback: show text coords when image fails */}
                      <div className="p-3 bg-slate-50 dark:bg-slate-950 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
                            {gpsCoords.lat.toFixed(6)}, {gpsCoords.lng.toFixed(6)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Location name input */}
                    <div>
                      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5">
                        Nome do local (opcional)
                      </label>
                      <input
                        type="text"
                        value={locationName}
                        onChange={(e) => setLocationName(e.target.value)}
                        placeholder="Ex: Casa, Escritório, Igreja..."
                        maxLength={120}
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition"
                      />
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setLocationModalOpen(false); setGpsCoords(null); }}
                        className="flex-1 px-3 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleSendLocation}
                        className="flex-1 px-3 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow transition flex items-center justify-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Enviar Localização
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
