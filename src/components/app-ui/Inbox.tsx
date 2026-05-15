import { 
  Inbox as InboxIcon, 
  LoaderCircle,
  Mail, 
  Star, 
  Trash2, 
  Search, 
  Filter, 
  Paperclip, 
  Plus, 
  X, 
  FileText,
  Users,
  Settings,
  CornerUpLeft,
  User,
  Send,
  SendHorizontal as Paperplane,
  AlertCircle,
  Image as ImageIcon
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Message {
  id: string;
  subject: string;
  body: string;
  preview: string;
  fromName: string;
  fromEmail: string;
  time: string;
  read: boolean;
  starred: boolean;
  isImportant: boolean;
  hasAttachment: boolean;
  recipientId?: string;
  threadId?: string;
  recipients: { name: string; email: string; type: 'TO' | 'CC' | 'BCC' }[];
}

function stripHtml(html: string) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}


import { apiBase } from '../../lib/apiBase';

function getAuthHeaders(extra: Record<string, string> = {}) {
  const token = localStorage.getItem('mrm_token');
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

export function Inbox() {
  const [user, setUser] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [activeFolder, setActiveFolder] = useState('inbox');
  const [loadingFolder, setLoadingFolder] = useState<string | null>('inbox');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteModalAction, setDeleteModalAction] = useState<(() => void) | null>(null);
  const [deleteModalCount, setDeleteModalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [counts, setCounts] = useState<any>({ inbox: 0, sent: 0, trash: 0, starred: 0, important: 0 });
  
  // Compose form state
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [replyToThreadId, setReplyToThreadId] = useState<string | null>(null);

  // Cross-campo state
  const [isCrossCampo, setIsCrossCampo] = useState(false);
  const [targetCampoId, setTargetCampoId] = useState('');
  const [targetCampoPassword, setTargetCampoPassword] = useState('');
  const [campos, setCampos] = useState<any[]>([]);

  // Attachments state
  const [attachments, setAttachments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Member search state
  const [memberSuggestions, setMemberSuggestions] = useState<any[]>([]);
  const [isSearchingMembers, setIsSearchingMembers] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeFolder]);

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML === body) return;
    editorRef.current.innerHTML = body;
  }, [body, isComposeOpen]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();
      const [userRes, msgRes, camposRes, countsRes] = await Promise.all([
        fetch(`${apiBase}/auth/me`, { headers }).then(r => r.json()),
        fetch(`${apiBase}/inbox/messages?folder=${activeFolder}`, { headers }).then(r => r.json()),
        fetch(`${apiBase}/campos/list-all`, { headers }).then(r => r.json()),
        fetch(`${apiBase}/inbox/counts`, { headers }).then(r => r.json())
      ]);
      setUser(userRes);
      setCampos(Array.isArray(camposRes) ? camposRes : []);
      setCounts(countsRes || { inbox: 0, sent: 0, trash: 0, starred: 0, important: 0 });
      
      const messageList = Array.isArray(msgRes) ? msgRes : [];
      const mappedMessages = messageList.map((m: any) => ({
        id: m.id,
        subject: m.subject,
        body: m.body || '',
        preview: stripHtml(m.body || '').substring(0, 120),
        fromName: m.sender?.fullName || 'Desconhecido',
        fromEmail: m.sender?.email || m.sender?.systemEmail || '',
        time: m.createdAt,
        read: m.recipients?.[0]?.isRead ?? true,
        starred: m.recipients?.[0]?.isStarred ?? false,
        isImportant: m.recipients?.[0]?.isImportant ?? false,
        hasAttachment: (m._count?.attachments || 0) > 0,
        recipientId: m.recipients?.[0]?.id,
        threadId: m.threadId,
        recipients: m.recipients?.map((r: any) => ({ 
          name: r.user?.fullName || r.user?.email || 'Destinatário', 
          email: r.user?.systemEmail || r.user?.email || '', 
          type: r.recipientType 
        })) || []
      }));
      setMessages(mappedMessages);
    } catch (error) {
      console.error('Failed to fetch inbox data', error);
      toast.error('Erro ao carregar mensagens');
    } finally {
      setLoading(false);
      setLoadingFolder(null);
    }
  };

  const handleFolderChange = (folder: string) => {
    if (folder === activeFolder && !loading) {
      return;
    }

    setSelectedIds(new Set());
    setSelectedMessageId(null);
    setLoading(true);
    setLoadingFolder(folder);
    setActiveFolder(folder);
  };

  const searchMembers = async (term: string) => {
    if (term.length < 2) {
      setMemberSuggestions([]);
      return;
    }
    try {
      setIsSearchingMembers(true);
      const res = await fetch(`${apiBase}/members/search-for-email?q=${encodeURIComponent(term)}`, { headers: getAuthHeaders() });
      const data = await res.json();
      setMemberSuggestions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to search members', error);
    } finally {
      setIsSearchingMembers(false);
    }
  };

  const generateSystemEmail = async () => {
    try {
      const res = await fetch(`${apiBase}/users/generate-system-email`, { method: 'POST', headers: getAuthHeaders() });
      const data = await res.json();
      if (res.ok) {
        setUser({ ...user, systemEmail: data.systemEmail });
        toast.success(`E-mail gerado: ${data.systemEmail}`);
      } else {
        toast.error(data.error || 'Erro ao gerar e-mail');
      }
    } catch (error) {
      toast.error('Erro de conexão');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${apiBase}/upload`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData
      });

      const data = await res.json();
      if (res.ok) {
        setAttachments([...attachments, data]);
        toast.success(`Arquivo ${file.name} anexado`);
      } else {
        toast.error(data.error || 'Erro no upload');
      }
    } catch (error) {
      toast.error('Erro ao enviar arquivo');
    } finally {
      setIsUploading(false);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const selectedMessage = messages.find(m => m.id === selectedMessageId);

  const handleMessageClick = async (id: string) => {
    setSelectedMessageId(id);
    const msg = messages.find(m => m.id === id);
    if (msg && !msg.read && msg.recipientId) {
      try {
        await fetch(`${apiBase}/inbox/recipients/${msg.recipientId}`, {
          method: 'PATCH',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ isRead: true })
        });
      } catch {}
    }
    setMessages(prev => prev.map(m => m.id === id ? { ...m, read: true } : m));
  };

  const toggleStar = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const msg = messages.find(m => m.id === id);
    if (!msg?.recipientId) {
      toast.error('Não é possível favoritar mensagens enviadas no momento');
      return;
    }
    const newStarred = !msg.starred;
    setMessages(prev => prev.map(m => m.id === id ? { ...m, starred: newStarred } : m));
    try {
      await fetch(`${apiBase}/inbox/recipients/${msg.recipientId}`, {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ isStarred: newStarred })
      });
      fetchData(); // Refresh counts
    } catch { toast.error('Erro ao atualizar favorito'); }
  };

  const toggleImportant = async (e: React.MouseEvent | React.FocusEvent | any, id: string) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const msg = messages.find(m => m.id === id);
    if (!msg?.recipientId) {
      toast.error('Não é possível marcar como importante mensagens enviadas');
      return;
    }
    const newImportant = !msg.isImportant;
    setMessages(prev => prev.map(m => m.id === id ? { ...m, isImportant: newImportant } : m));
    try {
      await fetch(`${apiBase}/inbox/recipients/${msg.recipientId}`, {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ isImportant: newImportant })
      });
      fetchData(); // Refresh counts
    } catch { toast.error('Erro ao atualizar status de importância'); }
  };

  const toggleSelect = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    e.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (e.target.checked) newSelected.add(id);
    else newSelected.delete(id);
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(filteredMessages.map(m => m.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    
    setDeleteModalCount(selectedIds.size);
    setDeleteModalAction(() => async () => {
      try {
        setLoading(true);
        const idsArray = Array.from(selectedIds);
        
        for (const id of idsArray) {
          const msg = messages.find(m => m.id === id);
          if (msg?.recipientId) {
            const method = activeFolder === 'trash' ? 'DELETE' : 'PATCH';
            const body = activeFolder === 'trash' ? undefined : JSON.stringify({ isDeleted: true });
            
            await fetch(`${apiBase}/inbox/recipients/${msg.recipientId}`, {
              method,
              headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
              body
            });
          } else {
            await fetch(`${apiBase}/inbox/messages/${id}`, {
              method: 'DELETE',
              headers: getAuthHeaders()
            });
          }
        }

        toast.success(`${selectedIds.size} mensagens excluídas`);
        setSelectedIds(new Set());
        fetchData();
      } catch {
        toast.error('Erro ao excluir algumas mensagens');
      } finally {
        setLoading(false);
        setIsDeleteModalOpen(false);
      }
    });
    setIsDeleteModalOpen(true);
  };

  const deleteMessage = async (id: string) => {
    const msg = messages.find(m => m.id === id);
    if (!msg) return;

    setDeleteModalCount(1);
    setDeleteModalAction(() => async () => {
      try {
        if (msg.recipientId) {
          const method = activeFolder === 'trash' ? 'DELETE' : 'PATCH';
          const body = activeFolder === 'trash' ? undefined : JSON.stringify({ isDeleted: true });

          await fetch(`${apiBase}/inbox/recipients/${msg.recipientId}`, {
            method,
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body
          });
        } else {
          await fetch(`${apiBase}/inbox/messages/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
          });
        }
        setMessages(prev => prev.filter(m => m.id !== id));
        if (selectedMessageId === id) setSelectedMessageId(null);
        toast.success('Mensagem excluída');
        fetchData();
      } catch {
        toast.error('Erro ao excluir');
      } finally {
        setIsDeleteModalOpen(false);
      }
    });
    setIsDeleteModalOpen(true);
  };

  const handleReply = () => {
    if (!selectedMessage) return;
    setTo(selectedMessage.fromEmail);
    setSubject(selectedMessage.subject.startsWith('Re: ') ? selectedMessage.subject : `Re: ${selectedMessage.subject}`);
    
    const dateStr = format(new Date(selectedMessage.time), "EEEE, d 'de' MMMM 'de' yyyy HH:mm", { locale: ptBR });
    const replyHeader = `<br><br><div style="border-left: 2px solid #e2e8f0; padding-left: 1rem; margin-top: 2rem;">
      <p style="font-size: 0.875rem; color: #64748b; margin-bottom: 1rem;">
        <b>De:</b> ${selectedMessage.fromName} &lt;${selectedMessage.fromEmail}&gt;<br>
        <b>Enviado em:</b> ${dateStr}<br>
        <b>Assunto:</b> ${selectedMessage.subject}
      </p>
      ${selectedMessage.body}
    </div>`;
    
    setBody(replyHeader);
    setReplyToThreadId(selectedMessage.threadId || selectedMessage.id);
    setIsComposeOpen(true);
  };

  const syncEditorBody = () => {
    setBody(editorRef.current?.innerHTML || '');
  };

  const applyEditorCommand = (command: string, value?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    syncEditorBody();
  };

  const insertEditorLink = () => {
    const url = window.prompt('Informe a URL do link');
    if (!url) return;
    applyEditorCommand('createLink', url);
  };

  const handleSend = async () => {
    try {
      const payload = {
        subject: subject || '(Sem assunto)',
        body,
        to: to.split(/[,; ]+/).filter(Boolean),
        cc: cc.split(/[,; ]+/).filter(Boolean),
        bcc: bcc.split(/[,; ]+/).filter(Boolean),
        threadId: replyToThreadId,
        targetCampoId: isCrossCampo ? targetCampoId : undefined,
        targetCampoPassword: isCrossCampo ? targetCampoPassword : undefined,
        attachments: attachments.map(a => ({
          fileName: a.fileName,
          fileUrl: a.url,
          fileSize: a.size,
          mimeType: a.mimeType
        }))
      };

      const res = await fetch(`${apiBase}/inbox/messages`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        toast.success('Mensagem enviada com sucesso!');
        setIsComposeOpen(false);
        // Clear form
        setTo(''); setCc(''); setBcc(''); setSubject(''); setBody('');
        setReplyToThreadId(null);
        setIsCrossCampo(false); setTargetCampoId(''); setTargetCampoPassword('');
        setAttachments([]);
        fetchData();
      } else {
        toast.error(data.error || 'Erro ao enviar mensagem');
      }
    } catch (error) {
      toast.error('Erro de conexão ao enviar');
    }
  };

  const filteredMessages = messages.filter(m => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return m.subject.toLowerCase().includes(q) ||
      m.fromName.toLowerCase().includes(q) ||
      m.preview.toLowerCase().includes(q);
  });

  const unreadCount = messages.filter(m => !m.read).length;

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950">
      {/* Top toolbar like Outlook */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => { setTo(''); setSubject(''); setBody(''); setReplyToThreadId(null); setIsComposeOpen(true); }}
            className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium text-sm transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nova mensagem
          </button>
          
          <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700" />
          
          <div className="flex items-center gap-1">
            <button 
              onClick={() => selectedMessageId && deleteMessage(selectedMessageId)}
              disabled={!selectedMessageId}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors text-slate-600 dark:text-slate-400 disabled:opacity-30" title="Excluir"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button 
              onClick={() => selectedMessageId && handleReply()}
              disabled={!selectedMessageId}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors text-slate-600 dark:text-slate-400 disabled:opacity-30" title="Responder"
            >
              <CornerUpLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={(e) => selectedMessageId && toggleStar(e, selectedMessageId)}
              disabled={!selectedMessageId}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors text-slate-600 dark:text-slate-400 disabled:opacity-30" title="Favoritar"
            >
              <Star className={`w-4 h-4 ${selectedMessage?.starred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
            </button>
            <button 
              onClick={(e) => selectedMessageId && toggleImportant(e, selectedMessageId)}
              disabled={!selectedMessageId}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors text-slate-600 dark:text-slate-400 disabled:opacity-30" title="Marcar como importante"
            >
              <AlertCircle className={`w-4 h-4 ${selectedMessage?.isImportant ? 'text-red-500 fill-red-500' : ''}`} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Pesquisar" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 w-64 lg:w-96 bg-slate-100 dark:bg-slate-800 border-none rounded text-sm focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-700 transition-all"
            />
          </div>
          <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors text-slate-600 dark:text-slate-400">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Navigation Sidebar */}
        <div className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hidden md:flex flex-col">
          <div className="p-4 space-y-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-3">Favoritos</p>
            <FolderItem 
              icon={<InboxIcon className="w-4 h-4" />} 
              label="Caixa de Entrada" 
              count={counts.inbox} 
              active={activeFolder === 'inbox'} 
              loading={loadingFolder === 'inbox'}
              onClick={() => handleFolderChange('inbox')}
            />
            <FolderItem 
              icon={<Paperplane className="w-4 h-4" />} 
              label="Itens Enviados" 
              count={counts.sent}
              active={activeFolder === 'sent'} 
              loading={loadingFolder === 'sent'}
              onClick={() => handleFolderChange('sent')}
            />
            <FolderItem 
              icon={<FileText className="w-4 h-4" />} 
              label="Rascunhos" 
              active={activeFolder === 'drafts'} 
              loading={loadingFolder === 'drafts'}
              onClick={() => handleFolderChange('drafts')}
            />
            <FolderItem 
              icon={<Trash2 className="w-4 h-4" />} 
              label="Itens Excluídos" 
              count={counts.trash}
              active={activeFolder === 'trash'} 
              loading={loadingFolder === 'trash'}
              onClick={() => handleFolderChange('trash')}
            />
            <FolderItem 
              icon={<Star className="w-4 h-4" />} 
              label="Favoritos" 
              count={counts.starred}
              active={activeFolder === 'starred'} 
              loading={loadingFolder === 'starred'}
              onClick={() => handleFolderChange('starred')}
            />
            <FolderItem 
              icon={<AlertCircle className="w-4 h-4" />} 
              label="Importantes" 
              count={counts.important}
              active={activeFolder === 'important'} 
              loading={loadingFolder === 'important'}
              onClick={() => handleFolderChange('important')}
            />
          </div>

          <div className="p-4 border-t border-slate-100 dark:border-slate-800 mt-2">
            <div className="flex items-center justify-between mb-2 px-3">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Meu E-mail</p>
            </div>
            {user?.systemEmail ? (
              <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                <p className="text-xs font-medium text-slate-900 dark:text-white truncate" title={user.systemEmail}>
                  {user.systemEmail}
                </p>
              </div>
            ) : (
              <button 
                onClick={generateSystemEmail}
                className="w-full text-left px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors flex items-center gap-2"
              >
                <Plus className="w-3 h-3" />
                Gerar meu e-mail @{user?.campo?.domain || 'campo'}
              </button>
            )}
          </div>
        </div>

        {/* Message List Column */}
        <div className="w-80 lg:w-96 border-r border-slate-200 dark:border-slate-800 flex flex-col bg-white dark:bg-slate-900">
          <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                checked={filteredMessages.length > 0 && selectedIds.size === filteredMessages.length}
                onChange={toggleSelectAll}
              />
              <span className="text-sm font-semibold text-blue-600 border-b-2 border-blue-600 pb-3 -mb-3.5">
                {activeFolder === 'inbox' ? 'Caixa de Entrada' : activeFolder === 'sent' ? 'Enviados' : activeFolder === 'trash' ? 'Excluídos' : activeFolder === 'starred' ? 'Favoritos' : activeFolder === 'drafts' ? 'Rascunhos' : activeFolder === 'important' ? 'Importantes' : 'Mensagens'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <button 
                  onClick={bulkDelete}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir ({selectedIds.size})
                </button>
              )}
              <button className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors text-slate-500" title="Filtrar">
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-slate-400">
                <LoaderCircle className="h-8 w-8 animate-spin text-blue-600" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Carregando mensagens...</p>
              </div>
            ) : filteredMessages.length > 0 ? (
              filteredMessages.map((msg) => (
                <MessageListItem 
                  key={msg.id}
                  message={msg}
                  active={selectedMessageId === msg.id}
                  selected={selectedIds.has(msg.id)}
                  onSelect={(e) => toggleSelect(e, msg.id)}
                  onClick={() => handleMessageClick(msg.id)}
                  onToggleStar={toggleStar}
                  onToggleImportant={toggleImportant}
                  onDelete={deleteMessage}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
                <Mail className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm font-medium">Nenhuma mensagem encontrada</p>
                <p className="text-xs mt-1">Tente ajustar sua pesquisa ou filtros.</p>
              </div>
            )}
          </div>
        </div>

        {/* Message Detail Column */}
        <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden relative">
          <AnimatePresence mode="wait">
            {selectedMessage ? (
              <motion.div 
                key={selectedMessage.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex-1 flex flex-col h-full"
              >
                {/* Detail Header */}
                <div className="p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
                  <div className="flex items-start justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                      {selectedMessage.subject}
                    </h2>
                    <div className="flex items-center gap-1">
                      <button onClick={handleReply} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors text-slate-500" title="Responder">
                        <CornerUpLeft className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => toggleStar(e, selectedMessage.id)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors text-slate-500" title="Favoritar">
                        <Star className={`w-4 h-4 ${selectedMessage.starred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                      </button>
                      <button onClick={(e) => toggleImportant(e, selectedMessage.id)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors text-slate-500" title="Marcar como importante">
                        <AlertCircle className={`w-4 h-4 ${selectedMessage.isImportant ? 'text-red-500 fill-red-500' : ''}`} />
                      </button>
                      <button onClick={() => deleteMessage(selectedMessage.id)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors text-slate-500 hover:text-red-500" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                      {selectedMessage.fromName.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{selectedMessage.fromName}</p>
                        <p className="text-xs text-slate-500">
                          {format(new Date(selectedMessage.time), "EEEE, d 'de' MMMM 'de' yyyy HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <p className="text-xs text-slate-500">Para: {selectedMessage.recipients.filter(r => r.type === 'TO' || r.type === 'CC').map(r => r.name || r.email).join(', ') || 'Destinatário não disponível'}</p>
                    </div>
                  </div>
                </div>

                {/* Detail Body */}
                <div className="flex-1 overflow-y-auto p-8 bg-white dark:bg-slate-900/50 m-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                  <div 
                    className="prose dark:prose-invert max-w-none text-slate-700 dark:text-slate-300 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: selectedMessage.body }}
                  />

                  {selectedMessage.hasAttachment && (
                    <div className="mt-12 border-t border-slate-100 dark:border-slate-800 pt-6">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Paperclip className="w-3 h-3" />
                        Anexos (1)
                      </p>
                      <div className="inline-flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 group cursor-pointer hover:border-blue-300 transition-colors">
                        <div className="w-8 h-8 bg-blue-600 text-white rounded flex items-center justify-center">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">relatorio_vendas.pdf</p>
                          <p className="text-xs text-slate-500">1.2 MB</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Detail Footer / Quick Reply */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3">
                  <button onClick={handleReply} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors">
                    <CornerUpLeft className="w-4 h-4" />
                    Responder
                  </button>
                  <button onClick={() => deleteMessage(selectedMessage.id)} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-red-900/20 border border-slate-200 dark:border-slate-700 rounded text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-red-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                    Excluir
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300 p-8 text-center">
                <div className="w-24 h-24 bg-slate-100 dark:bg-slate-900 rounded-full flex items-center justify-center mb-6">
                  <Mail className="w-12 h-12 opacity-20" />
                </div>
                <h3 className="text-lg font-bold text-slate-400">Nenhuma mensagem selecionada</h3>
                <p className="text-sm mt-2 max-w-xs">Selecione uma mensagem da lista para visualizar seu conteúdo completo aqui.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Compose Window Modal (Outlook Style) */}
      <AnimatePresence>
        {isComposeOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 100, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.95 }}
            className="fixed bottom-0 right-8 w-full max-w-2xl bg-white dark:bg-slate-900 rounded-t-xl shadow-2xl border border-slate-200 dark:border-slate-800 z-50 flex flex-col h-[600px]"
          >
            {/* Compose Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white rounded-t-xl">
              <h3 className="text-sm font-bold">Nova mensagem</h3>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsComposeOpen(false)}
                  className="p-1 hover:bg-white/10 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Compose Body */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 space-y-px bg-white dark:bg-slate-900">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 py-2">
                  <button 
                    onClick={() => {}} // Could open contact picker
                    className="text-sm font-bold text-slate-500 w-12 hover:bg-slate-100 dark:hover:bg-slate-800 py-1 rounded text-center"
                  >
                    Para
                  </button>
                  <div className="flex-1 relative">
                    <input 
                      type="text" 
                      value={to}
                      onChange={(e) => {
                        setTo(e.target.value);
                        searchMembers(e.target.value);
                      }}
                      className="w-full bg-transparent border-none focus:ring-0 text-sm dark:text-white" 
                      placeholder="E-mail do destinatário"
                    />
                    {memberSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-b shadow-lg z-[60] max-h-48 overflow-y-auto">
                        {memberSuggestions.map(m => (
                          <button 
                            key={m.id}
                            onClick={() => {
                              setTo(m.systemEmail || m.email || '');
                              setMemberSuggestions([]);
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 last:border-0"
                          >
                            <div className="w-6 h-6 bg-slate-200 dark:bg-slate-600 rounded-full flex items-center justify-center text-[10px] font-bold">
                              {m.fullName.charAt(0)}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900 dark:text-white">{m.fullName}</p>
                              <p className="text-[10px] text-slate-500">{m.systemEmail || m.email || 'Sem e-mail cadastrado'}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsCrossCampo(!isCrossCampo)}
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors ${isCrossCampo ? 'bg-purple-600 text-white border-purple-600' : 'text-slate-400 border-slate-200'}`}
                      title="Enviar para outro Campo"
                    >
                      Campo Externo
                    </button>
                    <button 
                      onClick={() => setShowCc(!showCc)}
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors ${showCc ? 'bg-blue-600 text-white border-blue-600' : 'text-slate-400 border-slate-200'}`}
                    >
                      Cc
                    </button>
                    <button 
                      onClick={() => setShowBcc(!showBcc)}
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border transition-colors ${showBcc ? 'bg-blue-600 text-white border-blue-600' : 'text-slate-400 border-slate-200'}`}
                    >
                      Cco
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {isCrossCampo && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="bg-purple-50 dark:bg-purple-900/10 border-b border-purple-100 dark:border-purple-900/20 p-3 space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-purple-600 w-24">Campo Destino:</span>
                        <select 
                          value={targetCampoId}
                          onChange={(e) => setTargetCampoId(e.target.value)}
                          className="flex-1 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-900/30 rounded px-2 py-1 text-xs"
                        >
                          <option value="">Selecione o Campo...</option>
                          {campos.map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.domain})</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-purple-600 w-24">Senha do Campo:</span>
                        <input 
                          type="password" 
                          value={targetCampoPassword}
                          onChange={(e) => setTargetCampoPassword(e.target.value)}
                          className="flex-1 bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-900/30 rounded px-2 py-1 text-xs"
                          placeholder="Senha de acesso deste campo"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {showCc && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 py-2 overflow-hidden"
                    >
                      <span className="text-sm font-bold text-slate-500 w-12 text-center">Cc</span>
                      <input 
                        type="text" 
                        value={cc}
                        onChange={(e) => setCc(e.target.value)}
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm dark:text-white" 
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {showBcc && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 py-2 overflow-hidden"
                    >
                      <span className="text-sm font-bold text-slate-500 w-12 text-center">Cco</span>
                      <input 
                        type="text" 
                        value={bcc}
                        onChange={(e) => setBcc(e.target.value)}
                        className="flex-1 bg-transparent border-none focus:ring-0 text-sm dark:text-white" 
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 py-2">
                  <span className="text-sm font-bold text-slate-500 w-12 text-center invisible">Ass</span>
                  <input 
                    type="text" 
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-semibold dark:text-white" 
                    placeholder="Adicionar um assunto"
                  />
                </div>
                
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950">
                    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-700 px-3 py-2 bg-slate-50 dark:bg-slate-900">
                      <button type="button" onClick={() => applyEditorCommand('bold')} className="rounded px-2 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-800">B</button>
                      <button type="button" onClick={() => applyEditorCommand('italic')} className="rounded px-2 py-1 text-xs italic text-slate-700 transition-colors hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-800">I</button>
                      <button type="button" onClick={() => applyEditorCommand('underline')} className="rounded px-2 py-1 text-xs underline text-slate-700 transition-colors hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-800">U</button>
                      <button type="button" onClick={() => applyEditorCommand('insertUnorderedList')} className="rounded px-2 py-1 text-xs text-slate-700 transition-colors hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-800">Lista</button>
                      <button type="button" onClick={() => applyEditorCommand('insertOrderedList')} className="rounded px-2 py-1 text-xs text-slate-700 transition-colors hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-800">Numerada</button>
                      <button type="button" onClick={insertEditorLink} className="rounded px-2 py-1 text-xs text-slate-700 transition-colors hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-800">Link</button>
                      <button type="button" onClick={() => applyEditorCommand('removeFormat')} className="rounded px-2 py-1 text-xs text-slate-700 transition-colors hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-800">Limpar</button>
                    </div>
                    <div className="relative min-h-[300px]">
                      {!stripHtml(body).trim() && (
                        <div className="pointer-events-none absolute left-4 top-4 text-sm text-slate-400 dark:text-slate-500">
                          Escreva sua mensagem aqui...
                        </div>
                      )}
                      <div
                        ref={editorRef}
                        contentEditable
                        suppressContentEditableWarning
                        onInput={syncEditorBody}
                        className="min-h-[300px] px-4 py-4 text-sm text-slate-900 outline-none dark:text-slate-100"
                      />
                    </div>
                  </div>
                </div>

                {attachments.length > 0 && (
                  <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-wrap gap-2">
                    {attachments.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[10px] font-medium">
                        <Paperclip className="w-3 h-3 text-slate-400" />
                        <span className="truncate max-w-[150px]">{file.fileName}</span>
                        <button onClick={() => removeAttachment(idx)} className="text-red-500 hover:text-red-700">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Compose Footer Toolbar */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <button 
                  onClick={handleSend}
                  disabled={!to}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded font-bold text-sm transition-colors shadow-sm"
                >
                  <Send className="w-4 h-4" />
                  Enviar
                </button>
                <div className="w-[1px] h-8 bg-slate-200 dark:bg-slate-700 mx-2" />
                <div className="flex items-center gap-2">
                    <input 
                      type="file" 
                      className="hidden" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload}
                    />
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors text-slate-500"
                    >
                      <Paperclip className={`w-4 h-4 ${isUploading ? 'animate-pulse text-blue-500' : ''}`} />
                    </button>
                    <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors text-slate-500">
                      <ImageIcon className="w-4 h-4" />
                    </button>
                    <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors text-slate-500">
                      <Users className="w-4 h-4" />
                    </button>
                </div>
              </div>
              <button 
                onClick={() => setIsComposeOpen(false)}
                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-slate-400 hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <DeleteConfirmModal 
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={deleteModalAction || (() => {})}
        count={deleteModalCount}
        isTrash={activeFolder === 'trash'}
      />
    </div>
  );
}

function FolderItem({ icon, label, count, active, small, loading, onClick }: { icon?: React.ReactNode, label: string, count?: number, active?: boolean, small?: boolean, loading?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      disabled={loading}
      className={`
        w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left group
        ${active 
          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold shadow-sm' 
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
        }
        ${loading ? 'cursor-wait opacity-80' : ''}
      `}
    >
      {icon && <span className={`${active ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`}>{icon}</span>}
      <span className={`flex-1 ${small ? 'text-xs' : 'text-sm'}`}>{label}</span>
      {loading && <LoaderCircle className="h-3.5 w-3.5 animate-spin text-blue-600" />}
      {count !== undefined && count > 0 && (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function MessageListItem({ 
  message, 
  active, 
  selected,
  onSelect,
  onClick, 
  onToggleStar, 
  onToggleImportant, 
  onDelete 
}: { 
  message: Message, 
  active: boolean, 
  selected: boolean,
  onSelect: (e: React.ChangeEvent<HTMLInputElement>) => void,
  onClick: () => void, 
  onToggleStar: (e: React.MouseEvent, id: string) => void, 
  onToggleImportant: (e: React.MouseEvent, id: string) => void, 
  onDelete: (id: string) => void 
}) {
  return (
    <div 
      onClick={onClick}
      className={`
        px-4 py-3 border-b border-slate-100 dark:border-slate-800 cursor-pointer transition-all relative group
        ${active 
          ? 'bg-white dark:bg-slate-800 ring-1 ring-inset ring-blue-500/30 z-10' 
          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
        }
        ${!message.read ? 'bg-blue-50/30 dark:bg-blue-900/5' : ''}
      `}
    >
      {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />}
      {!message.read && !active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />}

      <div className="flex items-start gap-3">
        <div className="mt-1.5">
          <input 
            type="checkbox" 
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            checked={selected}
            onChange={onSelect}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="mt-1 flex-shrink-0 flex flex-col items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
            {message.fromName.charAt(0)}
          </div>
          <button 
            onClick={(e) => onToggleStar(e, message.id)}
            className="text-slate-300 hover:text-yellow-400 transition-colors"
          >
            <Star className={`w-3.5 h-3.5 ${message.starred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
          </button>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 mb-0.5">
            <h4 className={`text-sm truncate ${!message.read ? 'font-bold text-slate-900 dark:text-white' : 'font-semibold text-slate-700 dark:text-slate-300'}`}>
              {message.fromName}
            </h4>
            <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
              {format(new Date(message.time), 'HH:mm')}
            </span>
          </div>
          <p className={`text-xs truncate mb-1 ${!message.read ? 'font-semibold text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-white'}`}>
            {message.subject}
          </p>
          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {message.preview}
          </p>
          
          <div className="flex items-center gap-2 mt-2">
            {message.hasAttachment && <Paperclip className="w-3 h-3 text-slate-400" />}
            {message.starred && <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />}
            {message.isImportant && <AlertCircle className="w-3 h-3 text-red-500 fill-red-500" />}
          </div>
        </div>
      </div>

      {/* Hover actions */}
      <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(message.id); }}
          className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors text-slate-500 hover:text-red-500"
          title="Excluir"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <button 
          onClick={(e) => onToggleStar(e, message.id)}
          className="p-1.5 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded transition-colors text-slate-500 hover:text-yellow-500"
          title="Favoritar"
        >
          <Star className={`w-3.5 h-3.5 ${message.starred ? 'fill-yellow-400 text-yellow-400' : ''}`} />
        </button>
        <button 
          onClick={(e) => onToggleImportant(e, message.id)}
          className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors text-slate-500 hover:text-red-500"
          title="Marcar como importante"
        >
          <AlertCircle className={`w-3.5 h-3.5 ${message.isImportant ? 'text-red-500 fill-red-500' : ''}`} />
        </button>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ isOpen, onClose, onConfirm, count, isTrash }: { isOpen: boolean, onClose: () => void, onConfirm: () => void, count: number, isTrash?: boolean }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-8 overflow-hidden animate-in fade-in zoom-in slide-in-from-bottom-8 duration-300">
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-500/10 rounded-full flex items-center justify-center mb-6">
            <Trash2 className="w-10 h-10 text-red-600 dark:text-red-500" />
          </div>
          
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
            {isTrash ? 'Excluir Permanentemente' : 'Confirmar Exclusão'}
          </h3>
          
          <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
            {isTrash 
              ? `Deseja realmente apagar ${count === 1 ? 'esta mensagem' : `as ${count} mensagens selecionadas`} para sempre? Esta ação não pode ser desfeita.`
              : `Deseja realmente excluir ${count === 1 ? 'esta mensagem' : `as ${count} mensagens selecionadas`}? Ela será movida para os itens excluídos.`
            }
          </p>
          
          <div className="flex w-full gap-4">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-2xl transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl shadow-xl shadow-red-600/20 active:scale-95 transition-all"
            >
              Excluir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
