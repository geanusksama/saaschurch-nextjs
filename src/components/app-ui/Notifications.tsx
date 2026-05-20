import {
  Archive,
  Bell,
  Calendar,
  Check,
  DollarSign,
  Edit3,
  Eye,
  EyeOff,
  File,
  HeartHandshake,
  Image,
  Loader2,
  Mail,
  Megaphone,
  MessageSquare,
  Plus,
  Shield,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '../../design-system/components/Badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { ConfirmDialog } from './shared/ConfirmDialog';

import { apiBase } from '../../lib/apiBase';

// ─── Icon / colour palettes ─────────────────────────────────────────────────

const iconOptions = [
  { key: 'bell',      label: 'Aviso',       icon: Bell },
  { key: 'users',     label: 'Membros',     icon: Users },
  { key: 'dollar',    label: 'Financeiro',  icon: DollarSign },
  { key: 'calendar',  label: 'Eventos',     icon: Calendar },
  { key: 'message',   label: 'Mensagem',    icon: MessageSquare },
  { key: 'mail',      label: 'E-mail',      icon: Mail },
  { key: 'megaphone', label: 'Comunicado',  icon: Megaphone },
  { key: 'care',      label: 'Cuidado',     icon: HeartHandshake },
];

const colorOptions = [
  { key: 'purple', label: 'Roxo',    className: 'bg-purple-100 text-purple-600 ring-purple-200' },
  { key: 'blue',   label: 'Azul',    className: 'bg-blue-100 text-blue-600 ring-blue-200' },
  { key: 'green',  label: 'Verde',   className: 'bg-green-100 text-green-600 ring-green-200' },
  { key: 'cyan',   label: 'Ciano',   className: 'bg-cyan-100 text-cyan-600 ring-cyan-200' },
  { key: 'indigo', label: 'Índigo',  className: 'bg-indigo-100 text-indigo-600 ring-indigo-200' },
  { key: 'orange', label: 'Laranja', className: 'bg-orange-100 text-orange-600 ring-orange-200' },
  { key: 'rose',   label: 'Rosa',    className: 'bg-rose-100 text-rose-600 ring-rose-200' },
];

const colorClassMap: Record<string, string> = Object.fromEntries(
  colorOptions.map((o) => [o.key, o.className]),
);
const iconMap = Object.fromEntries(iconOptions.map((o) => [o.key, o.icon]));

// ─── Types ────────────────────────────────────────────────────────────────────

type NotificationRecord = {
  id: string;
  title: string;
  message?: string | null;
  notificationType: string;
  actionText?: string | null;
  actionUrl?: string | null;
  imageUrl?: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  read: boolean;
  archived: boolean;
  createdAt: string;
  iconKey?: string;
  colorKey?: string;
  batchId?: string | null;
  scope?: string;
  canManage?: boolean;
};

type AckSummary = {
  totalRecipients: number;
  viewedCount: number;
  awareCount: number;
  acks: { user_id: string; name: string; email: string; ack_type: string; acked_at: string }[];
};

type Church = { id: string; name: string };

type FormState = {
  id: string;
  title: string;
  message: string;
  notificationType: string;
  iconKey: string;
  colorKey: string;
  actionText: string;
  actionUrl: string;
  scope: string;
  churchId: string;
  imageFile: File | null;
  fileAttachment: File | null;
  imageUrl: string;
  fileUrl: string;
  fileName: string;
};

const initialForm: FormState = {
  id: '',
  title: '',
  message: '',
  notificationType: 'announcement',
  iconKey: 'bell',
  colorKey: 'purple',
  actionText: '',
  actionUrl: '',
  scope: 'field',
  churchId: '',
  imageFile: null,
  fileAttachment: null,
  imageUrl: '',
  fileUrl: '',
  fileName: '',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readStoredUser() {
  try { return JSON.parse(localStorage.getItem('mrm_user') || '{}'); }
  catch { return {}; }
}

function formatRelativeTime(value?: string) {
  if (!value) return 'Agora';
  const date = new Date(value);
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const fmt = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
  if (Math.abs(diffMinutes) < 60) return fmt.format(diffMinutes, 'minute');
  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) return fmt.format(diffHours, 'hour');
  return fmt.format(Math.round(diffHours / 24), 'day');
}

function getIcon(iconKey?: string) {
  return iconMap[iconKey || 'bell'] || Bell;
}

function normalizeForm(n?: Partial<NotificationRecord>): FormState {
  return {
    id: n?.id || '',
    title: n?.title || '',
    message: n?.message || '',
    notificationType: n?.notificationType || 'announcement',
    iconKey: n?.iconKey || 'bell',
    colorKey: n?.colorKey || 'purple',
    actionText: n?.actionText || '',
    actionUrl: n?.actionUrl || '',
    scope: n?.scope || 'field',
    churchId: '',
    imageFile: null,
    fileAttachment: null,
    imageUrl: n?.imageUrl || '',
    fileUrl: n?.fileUrl || '',
    fileName: n?.fileName || '',
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Notifications() {
  const [currentUser, setCurrentUser] = useState(() => readStoredUser());
  const canCreate =
    currentUser.profileType === 'master' ||
    currentUser.profileType === 'campo' ||
    (currentUser.profileType === 'admin' && Boolean(currentUser.campoId));

  const [notificationList, setNotificationList] = useState<NotificationRecord[]>([]);
  const [filter, setFilter] = useState<'unread' | 'all'>('unread');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NotificationRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [archivingAll, setArchivingAll] = useState(false);
  const [form, setForm] = useState<FormState>(initialForm);
  const [churches, setChurches] = useState<Church[]>([]);
  const [ackMap, setAckMap] = useState<Record<string, { viewed: boolean; aware: boolean }>>({});
  const [ackSummary, setAckSummary] = useState<{ notifId: string; data: AckSummary } | null>(null);
  const [ackSummaryLoading, setAckSummaryLoading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('mrm_token') : null;

  // ─── API helper ────────────────────────────────────────────────────────────

  const fetchJson = async (path: string, options: RequestInit = {}) => {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        ...(options.body && typeof options.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    if (!response.ok) {
      const msg = await response.json().catch(() => ({}));
      throw new Error((msg as { error?: string }).error || 'Erro na operação.');
    }
    if (response.status === 204) return null;
    return response.json();
  };

  // ─── Load data ─────────────────────────────────────────────────────────────

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchJson('/notifications');
      setNotificationList(data || []);
    } catch (e: unknown) {
      setError((e as Error).message || 'Falha ao carregar notificações.');
    } finally {
      setLoading(false);
    }
  };

  const loadUserContext = async () => {
    try {
      const profile = await fetchJson('/auth/me');
      setCurrentUser(profile || {});
      localStorage.setItem('mrm_user', JSON.stringify(profile || {}));
    } catch {
      setCurrentUser(readStoredUser());
    }
  };

  const loadChurches = async () => {
    try {
      const data = await fetchJson('/churches');
      setChurches((data as Church[]) || []);
    } catch { /* silent */ }
  };

  useEffect(() => {
    loadUserContext();
    loadNotifications();
  }, []);

  useEffect(() => {
    if (canCreate) loadChurches();
  }, [canCreate]);

  // ─── Computed ──────────────────────────────────────────────────────────────

  const unreadCount = useMemo(
    () => notificationList.filter((n) => !n.read).length,
    [notificationList],
  );

  const filteredNotifications = useMemo(
    () => filter === 'unread' ? notificationList.filter((n) => !n.read) : notificationList,
    [filter, notificationList],
  );

  // ─── Actions ───────────────────────────────────────────────────────────────

  const openCreateModal = () => {
    setForm(initialForm);
    setModalOpen(true);
  };

  const openEditModal = (notification: NotificationRecord) => {
    setForm(normalizeForm(notification));
    setModalOpen(true);
  };

  const markAsRead = async (notification: NotificationRecord) => {
    if (notification.read) return;
    try {
      await fetchJson(`/notifications/${notification.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ read: true }),
      });
      setNotificationList((cur) => cur.map((item) => item.id === notification.id ? { ...item, read: true } : item));
    } catch (e: unknown) {
      setError((e as Error).message || 'Falha ao marcar como lida.');
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetchJson('/notifications/read-all', { method: 'PATCH' });
      setNotificationList((cur) => cur.map((item) => ({ ...item, read: true })));
    } catch (e: unknown) {
      setError((e as Error).message || 'Falha ao marcar todas como lidas.');
    }
  };

  const archiveNotification = async (notification: NotificationRecord) => {
    try {
      await fetchJson(`/notifications/${notification.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ archived: true }),
      });
      setNotificationList((cur) => cur.filter((item) => item.id !== notification.id));
    } catch (e: unknown) {
      setError((e as Error).message || 'Falha ao arquivar notificação.');
    }
  };

  const archiveAll = async () => {
    try {
      setArchivingAll(true);
      await fetchJson('/notifications/archive-all', { method: 'PATCH' });
      setNotificationList([]);
    } catch (e: unknown) {
      setError((e as Error).message || 'Falha ao arquivar notificações.');
    } finally {
      setArchivingAll(false);
    }
  };

  const registerAck = async (notification: NotificationRecord, ackType: 'viewed' | 'aware') => {
    try {
      await fetchJson(`/notifications/${notification.id}/ack`, {
        method: 'POST',
        body: JSON.stringify({ ackType }),
      });
      setAckMap((cur) => ({
        ...cur,
        [notification.id]: { ...cur[notification.id], [ackType]: true },
      }));
      if (ackType === 'aware') {
        setNotificationList((cur) => cur.map((item) => item.id === notification.id ? { ...item, read: true } : item));
      }
    } catch { /* silent — ack already exists */ }
  };

  const loadAckSummary = async (notifId: string) => {
    setAckSummaryLoading(true);
    setAckSummary(null);
    try {
      const data = await fetchJson(`/notifications/${notifId}/acks`);
      setAckSummary({ notifId, data });
    } catch (e: unknown) {
      setError((e as Error).message || 'Falha ao carregar resumo de ciência.');
    } finally {
      setAckSummaryLoading(false);
    }
  };

  // ─── Save (create / edit) ──────────────────────────────────────────────────

  const saveNotification = async () => {
    if (!form.title.trim()) {
      setError('Informe o título da notificação.');
      return;
    }
    try {
      setSaving(true);
      setError('');

      let imageUrl = form.imageUrl;
      let fileUrl = form.fileUrl;
      let fileName = form.fileName;

      if (form.imageFile) {
        const fd = new FormData();
        fd.append('file', form.imageFile);
        const uploadRes = await fetch(`${apiBase}/upload`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          imageUrl = (uploadData as { url?: string }).url || '';
        }
      }

      if (form.fileAttachment) {
        const fd = new FormData();
        fd.append('file', form.fileAttachment);
        const uploadRes = await fetch(`${apiBase}/upload`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          fileUrl = (uploadData as { url?: string }).url || '';
          fileName = form.fileAttachment.name;
        }
      }

      const payload = {
        title: form.title.trim(),
        message: form.message.trim() || undefined,
        notificationType: form.notificationType,
        iconKey: form.iconKey,
        colorKey: form.colorKey,
        actionText: form.actionText.trim() || undefined,
        actionUrl: form.actionUrl.trim() || undefined,
        imageUrl: imageUrl || undefined,
        fileUrl: fileUrl || undefined,
        fileName: fileName || undefined,
        scope: form.scope,
        churchId: form.scope === 'church' ? form.churchId : undefined,
      };

      if (form.id) {
        const updated = await fetchJson(`/notifications/${form.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setNotificationList((cur) => cur.map((item) => (item.id === form.id ? updated : item)));
      } else {
        const created = await fetchJson('/notifications', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setNotificationList((cur) => [created, ...cur]);
      }

      setModalOpen(false);
      setForm(initialForm);
    } catch (e: unknown) {
      setError((e as Error).message || 'Falha ao salvar notificação.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteNotification = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await fetchJson(`/notifications/${deleteTarget.id}`, { method: 'DELETE' });
      setNotificationList((cur) => cur.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e: unknown) {
      setError((e as Error).message || 'Falha ao excluir notificação.');
    } finally {
      setDeleting(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 text-slate-900 dark:text-slate-100">

      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
              <Bell className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Notificações</h1>
              <p className="text-slate-600 dark:text-slate-400">
                {unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}` : 'Todas lidas'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {unreadCount > 0 ? (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-purple-600 dark:text-purple-300 transition-colors hover:bg-purple-50 dark:hover:bg-purple-900/20"
              >
                <Check className="h-4 w-4" />
                Marcar todas como lidas
              </button>
            ) : null}

            {notificationList.length > 0 ? (
              <button
                onClick={archiveAll}
                disabled={archivingAll}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                {archivingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                Arquivar tudo
              </button>
            ) : null}

            {canCreate ? (
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-700"
              >
                <Plus className="h-4 w-4" />
                Nova notificação
              </button>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">Campo: {currentUser.campoName || 'Não vinculado'}</Badge>
            <Badge variant="secondary">Perfil: {currentUser.roleName || currentUser.profileType || 'Usuário'}</Badge>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {canCreate
                ? 'Crie e envie mensagens para seu campo ou igrejas específicas.'
                : 'Aqui você recebe mensagens do administrador do campo. Marque como lida ou indique que está ciente.'}
            </span>
          </div>
        </div>
      </div>

      {/* Error */}
      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError('')}><X className="h-4 w-4" /></button>
        </div>
      ) : null}

      {/* Filter tabs — default: Não lidas */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setFilter('unread')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            filter === 'unread'
              ? 'bg-purple-600 text-white'
              : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          Não lidas ({unreadCount})
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-purple-600 text-white'
              : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          Todas ({notificationList.length})
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center text-sm text-slate-500 dark:text-slate-400">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-slate-300" />
          Carregando notificações...
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => {
            const Icon = getIcon(notification.iconKey);
            const myAck = ackMap[notification.id] || { viewed: false, aware: false };

            return (
              <div
                key={notification.id}
                className={`rounded-xl border p-4 transition-all ${
                  notification.read
                    ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                    : 'border-purple-200 dark:border-purple-900 bg-purple-50/30 dark:bg-purple-950/20'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${colorClassMap[notification.colorKey || 'purple'] || colorClassMap['purple']}`}>
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    {/* Title row */}
                    <div className="mb-1 flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-slate-900 dark:text-slate-100">{notification.title}</h3>
                          {notification.canManage ? <Badge variant="secondary">Campo</Badge> : null}
                          {notification.scope === 'church' ? <Badge variant="secondary">Igreja</Badge> : null}
                        </div>
                        {!notification.read ? <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-purple-600" /> : null}
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">{formatRelativeTime(notification.createdAt)}</span>
                    </div>

                    {/* Message */}
                    <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">{notification.message || 'Sem descrição adicional.'}</p>

                    {/* Image */}
                    {notification.imageUrl ? (
                      <div className="mb-3">
                        <img
                          src={notification.imageUrl}
                          alt="Imagem anexada"
                          className="rounded-lg max-h-48 w-auto border border-slate-200 dark:border-slate-700"
                        />
                      </div>
                    ) : null}

                    {/* File attachment */}
                    {notification.fileUrl ? (
                      <a
                        href={notification.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mb-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <File className="h-3.5 w-3.5" />
                        {notification.fileName || 'Arquivo anexado'}
                      </a>
                    ) : null}

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Marcar como lida */}
                      {!notification.read ? (
                        <button
                          onClick={() => markAsRead(notification)}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Marcar como lida
                        </button>
                      ) : null}

                      {/* Estou ciente */}
                      {!myAck.aware ? (
                        <button
                          onClick={() => registerAck(notification, 'aware')}
                          className="inline-flex items-center gap-2 rounded-lg border border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/30 px-3 py-2 text-xs font-semibold text-green-700 dark:text-green-300 transition-colors hover:bg-green-100 dark:hover:bg-green-900/40"
                        >
                          <Shield className="h-3.5 w-3.5" />
                          Estou ciente
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-100 dark:bg-green-900/30 px-3 py-2 text-xs font-semibold text-green-700 dark:text-green-300">
                          <Check className="h-3.5 w-3.5" />
                          Ciente
                        </span>
                      )}

                      {/* Arquivar (apenas da minha lista) */}
                      <button
                        onClick={() => archiveNotification(notification)}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                        title="Arquivar — remove apenas da sua lista"
                      >
                        <Archive className="h-3.5 w-3.5" />
                        Arquivar
                      </button>

                      {/* Editar lote (admin) */}
                      {notification.canManage ? (
                        <button
                          onClick={() => openEditModal(notification)}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Editar
                        </button>
                      ) : null}

                      {/* Ver ciências (admin) */}
                      {notification.canManage ? (
                        <button
                          onClick={() => loadAckSummary(notification.id)}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Ver ciências
                        </button>
                      ) : null}

                      {/* Excluir (admin only — deletes entire batch) */}
                      {notification.canManage ? (
                        <button
                          onClick={() => setDeleteTarget(notification)}
                          className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-400 transition-colors hover:bg-red-100 dark:hover:bg-red-900/40"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Excluir
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {!filteredNotifications.length ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-12 text-center">
              <Bell className="mx-auto mb-4 h-12 w-12 text-slate-300 dark:text-slate-600" />
              <p className="text-slate-600 dark:text-slate-400">
                {filter === 'unread' ? 'Nenhuma notificação não lida.' : 'Nenhuma notificação encontrada.'}
              </p>
            </div>
          ) : null}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="w-full max-w-full sm:w-[60vw] sm:max-w-[60vw] max-h-[92vh] overflow-y-auto border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0 text-slate-900 dark:text-slate-100">
          {/* Header */}
          <div className="border-b border-slate-200 dark:border-slate-700 px-6 py-4 sticky top-0 bg-white dark:bg-slate-900 z-10">
            <DialogHeader>
              <DialogTitle>{form.id ? 'Editar notificação' : 'Nova notificação'}</DialogTitle>
              <DialogDescription>Envie um aviso para todo o campo ou para uma igreja específica.</DialogDescription>
            </DialogHeader>
          </div>

          {/* Body — 2 colunas em telas grandes, 1 em pequenas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-700">

            {/* ── Coluna esquerda: campos de input ── */}
            <div className="px-6 py-5 space-y-4">
              {/* Título + Tipo */}
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Título *
                  <input
                    value={form.title}
                    onChange={(e) => setForm((c) => ({ ...c, title: e.target.value }))}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:border-purple-400"
                    placeholder="Ex.: Evento especial no sábado"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Tipo interno
                  <input
                    value={form.notificationType}
                    onChange={(e) => setForm((c) => ({ ...c, notificationType: e.target.value }))}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:border-purple-400"
                    placeholder="announcement"
                  />
                </label>
              </div>

              {/* Mensagem */}
              <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                Mensagem
                <textarea
                  value={form.message}
                  onChange={(e) => setForm((c) => ({ ...c, message: e.target.value }))}
                  rows={4}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:border-purple-400 resize-none"
                  placeholder="Descreva o aviso que será enviado."
                />
              </label>

              {/* Destinatários + Igreja */}
              {!form.id ? (
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Destinatários
                    <select
                      value={form.scope}
                      onChange={(e) => setForm((c) => ({ ...c, scope: e.target.value, churchId: '' }))}
                      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:border-purple-400"
                    >
                      <option value="field">Todo o campo</option>
                      <option value="church">Igreja específica</option>
                    </select>
                  </label>
                  {form.scope === 'church' ? (
                    <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                      Igreja
                      <select
                        value={form.churchId}
                        onChange={(e) => setForm((c) => ({ ...c, churchId: e.target.value }))}
                        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:border-purple-400"
                      >
                        <option value="">Selecione...</option>
                        {churches.map((ch) => <option key={ch.id} value={ch.id}>{ch.name}</option>)}
                      </select>
                    </label>
                  ) : <div />}
                </div>
              ) : null}

              {/* Botão + URL */}
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                  Texto do botão
                  <input
                    value={form.actionText}
                    onChange={(e) => setForm((c) => ({ ...c, actionText: e.target.value }))}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:border-purple-400"
                    placeholder="Abrir aviso"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                  URL de ação
                  <input
                    value={form.actionUrl}
                    onChange={(e) => setForm((c) => ({ ...c, actionUrl: e.target.value }))}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm outline-none focus:border-purple-400"
                    placeholder="/app-ui/events"
                  />
                </label>
              </div>

              {/* Imagem + Arquivo */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Imagem (opcional)</span>
                  <button type="button" onClick={() => imageInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 py-4 text-center hover:border-purple-400 transition-colors">
                    <Image className="h-6 w-6 text-slate-300" />
                    <span className="text-xs text-slate-500 truncate max-w-[120px]">
                      {form.imageFile ? form.imageFile.name : form.imageUrl ? 'Anexada' : 'Clique para selecionar'}
                    </span>
                  </button>
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => setForm((c) => ({ ...c, imageFile: e.target.files?.[0] ?? null }))} />
                  {(form.imageFile || form.imageUrl) && (
                    <button type="button" onClick={() => setForm((c) => ({ ...c, imageFile: null, imageUrl: '' }))} className="text-xs text-red-600 hover:underline text-left">Remover</button>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Arquivo (opcional)</span>
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 py-4 text-center hover:border-purple-400 transition-colors">
                    <File className="h-6 w-6 text-slate-300" />
                    <span className="text-xs text-slate-500 truncate max-w-[120px]">
                      {form.fileAttachment ? form.fileAttachment.name : form.fileUrl ? 'Anexado' : 'Clique para selecionar'}
                    </span>
                  </button>
                  <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setForm((c) => ({ ...c, fileAttachment: e.target.files?.[0] ?? null }))} />
                  {(form.fileAttachment || form.fileUrl) && (
                    <button type="button" onClick={() => setForm((c) => ({ ...c, fileAttachment: null, fileUrl: '', fileName: '' }))} className="text-xs text-red-600 hover:underline text-left">Remover</button>
                  )}
                </div>
              </div>
            </div>

            {/* ── Coluna direita: ícones e cores ── */}
            <div className="px-6 py-5 space-y-5">
              {/* Ícone — 4 colunas */}
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Ícone</p>
                <div className="grid grid-cols-4 gap-2">
                  {iconOptions.map((option) => {
                    const OptionIcon = option.icon;
                    const selected = form.iconKey === option.key;
                    return (
                      <button key={option.key} type="button"
                        onClick={() => setForm((c) => ({ ...c, iconKey: option.key }))}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition-colors ${selected ? 'border-purple-600 bg-purple-600 text-white' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                      >
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${selected ? 'bg-white/20' : 'bg-slate-100 dark:bg-slate-800'}`}>
                          <OptionIcon className="h-4 w-4" />
                        </div>
                        <span className="text-[10px] font-medium leading-tight text-center">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Cor — 4 colunas */}
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Cor</p>
                <div className="grid grid-cols-4 gap-2">
                  {colorOptions.map((option) => {
                    const selected = form.colorKey === option.key;
                    return (
                      <button key={option.key} type="button"
                        onClick={() => setForm((c) => ({ ...c, colorKey: option.key }))}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 transition-colors ${selected ? 'border-slate-900 dark:border-slate-100 ring-2 ring-slate-900/20 dark:ring-slate-100/20' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                      >
                        <div className={`h-8 w-8 rounded-lg ring-1 ${option.className}`} />
                        <span className="text-[10px] font-medium text-slate-700 dark:text-slate-200 leading-tight text-center">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="border-t border-slate-200 dark:border-slate-700 px-6 py-4 sticky bottom-0 bg-white dark:bg-slate-900">
            <button type="button" onClick={() => setModalOpen(false)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
              Cancelar
            </button>
            <button type="button" onClick={saveNotification} disabled={saving}
              className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-60">
              {saving ? 'Salvando...' : form.id ? 'Salvar alterações' : 'Criar notificação'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Ack summary dialog ─── */}
      <Dialog open={Boolean(ackSummary) || ackSummaryLoading} onOpenChange={() => { setAckSummary(null); setAckSummaryLoading(false); }}>
        <DialogContent className="max-w-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0 text-slate-900 dark:text-slate-100">
          <div className="border-b border-slate-200 dark:border-slate-700 px-5 py-4">
            <DialogHeader>
              <DialogTitle>Resumo de ciências</DialogTitle>
              <DialogDescription>Quem já confirmou que está ciente desta notificação.</DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-5 py-5">
            {ackSummaryLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
              </div>
            ) : ackSummary ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-4 text-center">
                    <div className="text-2xl font-bold text-slate-900 dark:text-white">{ackSummary.data.totalRecipients}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Destinatários</div>
                  </div>
                  <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 p-4 text-center">
                    <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{ackSummary.data.viewedCount}</div>
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">Visualizaram</div>
                  </div>
                  <div className="rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 p-4 text-center">
                    <div className="text-2xl font-bold text-green-700 dark:text-green-300">{ackSummary.data.awareCount}</div>
                    <div className="text-xs text-green-600 dark:text-green-400 mt-1">Cientes</div>
                  </div>
                </div>

                {ackSummary.data.acks.length > 0 ? (
                  <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Usuário</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Tipo</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Data</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {ackSummary.data.acks.map((ack, idx) => (
                          <tr key={idx} className="bg-white dark:bg-slate-900">
                            <td className="px-4 py-3 text-slate-900 dark:text-slate-100">{ack.name || ack.email}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                                ack.ack_type === 'aware'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                              }`}>
                                {ack.ack_type === 'aware' ? <Shield className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                {ack.ack_type === 'aware' ? 'Ciente' : 'Visualizou'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{formatRelativeTime(ack.acked_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center">
                    <EyeOff className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma confirmação registrada ainda.</p>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <DialogFooter className="border-t border-slate-200 dark:border-slate-700 px-5 py-4">
            <button
              type="button"
              onClick={() => setAckSummary(null)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Fechar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete confirm ─── */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir notificação"
        message="Esta notificação será removida para todos os destinatários do lote. Deseja continuar?"
        confirmLabel="Excluir"
        variant="danger"
        loading={deleting}
        onConfirm={confirmDeleteNotification}
        onCancel={() => (deleting ? null : setDeleteTarget(null))}
      />
    </div>
  );
}
