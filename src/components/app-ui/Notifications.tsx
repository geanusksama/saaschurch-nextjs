import {
  Bell,
  Calendar,
  Check,
  DollarSign,
  Edit3,
  HeartHandshake,
  Loader2,
  Mail,
  Megaphone,
  MessageSquare,
  Plus,
  Trash2,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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

const iconOptions = [
  { key: 'bell', label: 'Aviso', icon: Bell },
  { key: 'users', label: 'Membros', icon: Users },
  { key: 'dollar', label: 'Financeiro', icon: DollarSign },
  { key: 'calendar', label: 'Eventos', icon: Calendar },
  { key: 'message', label: 'Mensagem', icon: MessageSquare },
  { key: 'mail', label: 'E-mail', icon: Mail },
  { key: 'megaphone', label: 'Comunicado', icon: Megaphone },
  { key: 'care', label: 'Cuidado', icon: HeartHandshake },
];

const colorOptions = [
  { key: 'purple', label: 'Roxo', className: 'bg-purple-100 text-purple-600 ring-purple-200' },
  { key: 'blue', label: 'Azul', className: 'bg-blue-100 text-blue-600 ring-blue-200' },
  { key: 'green', label: 'Verde', className: 'bg-green-100 text-green-600 ring-green-200' },
  { key: 'cyan', label: 'Ciano', className: 'bg-cyan-100 text-cyan-600 ring-cyan-200' },
  { key: 'indigo', label: 'Índigo', className: 'bg-indigo-100 text-indigo-600 ring-indigo-200' },
  { key: 'orange', label: 'Laranja', className: 'bg-orange-100 text-orange-600 ring-orange-200' },
  { key: 'rose', label: 'Rosa', className: 'bg-rose-100 text-rose-600 ring-rose-200' },
];

const colorClassMap: Record<string, string> = Object.fromEntries(
  colorOptions.map((option) => [option.key, option.className]),
);

const iconMap = Object.fromEntries(iconOptions.map((option) => [option.key, option.icon]));

const initialForm = {
  id: '',
  title: '',
  message: '',
  notificationType: 'announcement',
  iconKey: 'bell',
  colorKey: 'purple',
  actionText: '',
  actionUrl: '',
};

type NotificationRecord = {
  id: string;
  title: string;
  message?: string | null;
  notificationType: string;
  actionText?: string | null;
  actionUrl?: string | null;
  read: boolean;
  createdAt: string;
  iconKey?: string;
  colorKey?: string;
  canManage?: boolean;
};

function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('mrm_user') || '{}');
  } catch {
    return {};
  }
}

function formatRelativeTime(value?: string) {
  if (!value) {
    return 'Agora';
  }

  const date = new Date(value);
  const diffMs = date.getTime() - Date.now();
  const diffMinutes = Math.round(diffMs / 60000);
  const formatter = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, 'minute');
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, 'hour');
  }

  const diffDays = Math.round(diffHours / 24);
  return formatter.format(diffDays, 'day');
}

function getIcon(iconKey?: string) {
  return iconMap[iconKey || 'bell'] || Bell;
}

function normalizeForm(notification?: Partial<NotificationRecord>) {
  return {
    id: notification?.id || '',
    title: notification?.title || '',
    message: notification?.message || '',
    notificationType: notification?.notificationType || 'announcement',
    iconKey: notification?.iconKey || 'bell',
    colorKey: notification?.colorKey || 'purple',
    actionText: notification?.actionText || '',
    actionUrl: notification?.actionUrl || '',
  };
}

export function Notifications() {
  const [currentUser, setCurrentUser] = useState(() => readStoredUser());
  const canCreate = currentUser.profileType === 'admin' && Boolean(currentUser.campoId);
  const [notificationList, setNotificationList] = useState<NotificationRecord[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NotificationRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState(initialForm);
  const token = localStorage.getItem('mrm_token');

  const fetchJson = async (path: string, options: RequestInit = {}) => {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      const message = await response.json().catch(() => ({}));
      throw new Error(message.error || 'Falha ao processar notificações.');
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  };

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchJson('/notifications');
      setNotificationList(data || []);
    } catch (loadError: any) {
      setError(loadError.message || 'Falha ao carregar notificações.');
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

  useEffect(() => {
    loadUserContext();
    loadNotifications();
  }, []);

  const filteredNotifications = filter === 'unread'
    ? notificationList.filter((notification) => !notification.read)
    : notificationList;

  const unreadCount = notificationList.filter((notification) => !notification.read).length;

  const openCreateModal = () => {
    setForm(initialForm);
    setModalOpen(true);
  };

  const openEditModal = (notification: NotificationRecord) => {
    setForm(normalizeForm(notification));
    setModalOpen(true);
  };

  const markAsRead = async (notification: NotificationRecord) => {
    if (notification.read) {
      return;
    }

    try {
      await fetchJson(`/notifications/${notification.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ read: true }),
      });
      setNotificationList((current) => current.map((item) => (
        item.id === notification.id
          ? { ...item, read: true }
          : item
      )));
    } catch (readError: any) {
      setError(readError.message || 'Falha ao marcar notificação como lida.');
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetchJson('/notifications/read-all', { method: 'PATCH' });
      setNotificationList((current) => current.map((item) => ({ ...item, read: true })));
    } catch (readError: any) {
      setError(readError.message || 'Falha ao marcar notificações como lidas.');
    }
  };

  const saveNotification = async () => {
    if (!form.title.trim()) {
      setError('Informe o título da notificação.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      const payload = {
        title: form.title.trim(),
        message: form.message.trim() || undefined,
        notificationType: form.notificationType,
        iconKey: form.iconKey,
        colorKey: form.colorKey,
        actionText: form.actionText.trim() || undefined,
        actionUrl: form.actionUrl.trim() || undefined,
      };

      if (form.id) {
        const updated = await fetchJson(`/notifications/${form.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setNotificationList((current) => current.map((item) => (item.id === form.id ? updated : item)));
      } else {
        const created = await fetchJson('/notifications', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setNotificationList((current) => [created, ...current]);
      }

      setModalOpen(false);
      setForm(initialForm);
    } catch (saveError: any) {
      setError(saveError.message || 'Falha ao salvar notificação.');
    } finally {
      setSaving(false);
    }
  };

  const deleteNotification = (notification: NotificationRecord) => {
    setDeleteTarget(notification);
  };

  const confirmDeleteNotification = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      await fetchJson(`/notifications/${deleteTarget.id}`, { method: 'DELETE' });
      setNotificationList((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (deleteError: any) {
      setError(deleteError.message || 'Falha ao excluir notificação.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
              <Bell className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Notificações</h1>
              <p className="text-slate-600 dark:text-slate-400">
                {unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}` : 'Todas lidas'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 ? (
              <button
                onClick={markAllAsRead}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-purple-600 transition-colors hover:bg-purple-50"
              >
                <Check className="h-4 w-4" />
                Marcar todas como lidas
              </button>
            ) : null}

            {canCreate ? (
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                <Plus className="h-4 w-4" />
                Nova notificação
              </button>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">Campo: {currentUser.campoName || 'Não vinculado'}</Badge>
            <Badge variant="secondary">Perfil: {currentUser.roleName || currentUser.profileType || 'Usuário'}</Badge>
            <span className="text-sm text-slate-500">
              {canCreate
                ? 'Você pode criar, editar e excluir notificações enviadas para o seu campo.'
                : 'Somente o administrador do campo pode criar notificações. Aqui você acompanha e marca as suas como lidas.'}
            </span>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-purple-600 text-white'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          Todas ({notificationList.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            filter === 'unread'
              ? 'bg-purple-600 text-white'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          Não lidas ({unreadCount})
        </button>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
          <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-slate-300" />
          Carregando notificações...
        </div>
      ) : (
        <div className="space-y-2">
          {filteredNotifications.map((notification) => {
            const Icon = getIcon(notification.iconKey);
            return (
              <div
                key={notification.id}
                className={`rounded-xl border p-4 transition-all ${
                  notification.read
                    ? 'border-slate-200 bg-white'
                    : 'border-purple-200 bg-purple-50/30'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${colorClassMap[notification.colorKey || 'purple'] || colorClassMap.purple}`}>
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900">{notification.title}</h3>
                          {notification.canManage ? <Badge variant="secondary">Campo</Badge> : null}
                        </div>
                        {!notification.read ? <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-purple-600" /> : null}
                      </div>
                      <span className="text-xs text-slate-500">{formatRelativeTime(notification.createdAt)}</span>
                    </div>

                    <p className="mb-3 text-sm text-slate-600">{notification.message || 'Sem descrição adicional.'}</p>

                    <div className="flex flex-wrap items-center gap-2">
                      {!notification.read ? (
                        <button
                          onClick={() => markAsRead(notification)}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Marcar como lida
                        </button>
                      ) : null}

                      {notification.canManage ? (
                        <button
                          onClick={() => openEditModal(notification)}
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Editar lote
                        </button>
                      ) : null}

                      <button
                        onClick={() => deleteNotification(notification)}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Excluir
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {!filteredNotifications.length ? (
            <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
              <Bell className="mx-auto mb-4 h-12 w-12 text-slate-300" />
              <p className="text-slate-600 dark:text-slate-400">Nenhuma notificação encontrada</p>
            </div>
          ) : null}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-3xl border border-slate-200 bg-white p-0">
          <div className="border-b border-slate-200 px-5 py-4">
            <DialogHeader>
              <DialogTitle>{form.id ? 'Editar notificação' : 'Nova notificação para o campo'}</DialogTitle>
              <DialogDescription>
                Escolha um ícone e uma cor para deixar a notificação visualmente destacada para as igrejas do seu campo.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="grid gap-5 px-5 py-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Título
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                  placeholder="Ex.: Evento especial no sábado"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Tipo interno
                <input
                  value={form.notificationType}
                  onChange={(event) => setForm((current) => ({ ...current, notificationType: event.target.value }))}
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                  placeholder="announcement"
                />
              </label>
            </div>

            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Mensagem
              <textarea
                value={form.message}
                onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                rows={4}
                className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                placeholder="Descreva o aviso que será enviado para todo o campo."
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Texto do botão
                <input
                  value={form.actionText}
                  onChange={(event) => setForm((current) => ({ ...current, actionText: event.target.value }))}
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                  placeholder="Abrir aviso"
                />
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                URL de ação
                <input
                  value={form.actionUrl}
                  onChange={(event) => setForm((current) => ({ ...current, actionUrl: event.target.value }))}
                  className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                  placeholder="/app-ui/events"
                />
              </label>
            </div>

            <div>
              <div className="mb-2 text-sm font-medium text-slate-700">Ícone</div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {iconOptions.map((option) => {
                  const Icon = option.icon;
                  const selected = form.iconKey === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, iconKey: option.key }))}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${selected ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${selected ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700'}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{option.label}</div>
                        <div className={`text-xs ${selected ? 'text-slate-200' : 'text-slate-500'}`}>{option.key}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-2 text-sm font-medium text-slate-700">Cor</div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {colorOptions.map((option) => {
                  const selected = form.colorKey === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, colorKey: option.key }))}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${selected ? 'border-slate-900 ring-2 ring-slate-900/10' : 'border-slate-200 hover:bg-slate-50'}`}
                    >
                      <div className={`h-10 w-10 rounded-lg ring-1 ${option.className}`} />
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{option.label}</div>
                        <div className="text-xs text-slate-500">{option.key}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-slate-200 px-5 py-4">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={saveNotification}
              disabled={saving}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {saving ? 'Salvando...' : form.id ? 'Salvar alterações' : 'Criar notificação'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir notificação"
        message={
          deleteTarget?.canManage
            ? 'Esta notificação será removida para todo o campo. Deseja continuar?'
            : 'Esta notificação será removida da sua lista. Deseja continuar?'
        }
        confirmLabel="Excluir"
        variant="danger"
        loading={deleting}
        onConfirm={confirmDeleteNotification}
        onCancel={() => (deleting ? null : setDeleteTarget(null))}
      />
    </div>
  );
}
