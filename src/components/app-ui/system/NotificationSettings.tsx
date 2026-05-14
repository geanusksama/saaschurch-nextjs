import { Bell, Mail, MessageSquare, Smartphone, Users, DollarSign, Calendar, UserPlus, Save, Volume2, VolumeX } from 'lucide-react';
import { useState } from 'react';

interface NotificationChannel {
  email: boolean;
  whatsapp: boolean;
  sms: boolean;
  push: boolean;
}

interface NotificationPreference {
  id: string;
  title: string;
  description: string;
  channels: NotificationChannel;
}

export function NotificationSettings() {
  const [preferences, setPreferences] = useState<Record<string, NotificationChannel>>({
    new_member: { email: true, whatsapp: true, sms: false, push: true },
    baptism_request: { email: true, whatsapp: true, sms: false, push: true },
    financial_alert: { email: true, whatsapp: false, sms: false, push: true },
    event_reminder: { email: true, whatsapp: true, sms: true, push: true },
    new_lead: { email: true, whatsapp: false, sms: false, push: true },
    prayer_request: { email: false, whatsapp: true, sms: false, push: true },
    birthday: { email: true, whatsapp: true, sms: false, push: false },
    attendance_low: { email: true, whatsapp: false, sms: false, push: true },
  });

  const [globalSettings, setGlobalSettings] = useState({
    enableEmail: true,
    enableWhatsApp: true,
    enableSMS: true,
    enablePush: true,
    quietHours: true,
    quietStart: '22:00',
    quietEnd: '08:00',
  });

  const notificationTypes: NotificationPreference[] = [
    {
      id: 'new_member',
      title: 'Novo Membro',
      description: 'Quando um novo membro é cadastrado',
      channels: preferences.new_member
    },
    {
      id: 'baptism_request',
      title: 'Solicitação de Batismo',
      description: 'Quando alguém solicita batismo',
      channels: preferences.baptism_request
    },
    {
      id: 'financial_alert',
      title: 'Alertas Financeiros',
      description: 'Metas atingidas ou despesas importantes',
      channels: preferences.financial_alert
    },
    {
      id: 'event_reminder',
      title: 'Lembretes de Eventos',
      description: 'Lembretes antes de eventos programados',
      channels: preferences.event_reminder
    },
    {
      id: 'new_lead',
      title: 'Novo Lead no CRM',
      description: 'Quando um novo lead é adicionado',
      channels: preferences.new_lead
    },
    {
      id: 'prayer_request',
      title: 'Pedido de Oração',
      description: 'Novos pedidos de oração',
      channels: preferences.prayer_request
    },
    {
      id: 'birthday',
      title: 'Aniversários',
      description: 'Aniversariantes do dia',
      channels: preferences.birthday
    },
    {
      id: 'attendance_low',
      title: 'Frequência Baixa',
      description: 'Quando a frequência está abaixo da média',
      channels: preferences.attendance_low
    },
  ];

  const toggleChannel = (notifId: string, channel: keyof NotificationChannel) => {
    setPreferences(prev => ({
      ...prev,
      [notifId]: {
        ...prev[notifId],
        [channel]: !prev[notifId][channel]
      }
    }));
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Preferências de Notificação</h1>
        <p className="text-slate-600 dark:text-slate-400">Configure alertas e notificações do sistema</p>
      </div>

      <div className="max-w-6xl space-y-6">
        {/* Global Settings */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex items-start gap-3 mb-6">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Bell className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 mb-1">Configurações Globais</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">Controle geral dos canais de notificação</p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-slate-900">Email</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={globalSettings.enableEmail}
                  onChange={(e) => setGlobalSettings(prev => ({ ...prev, enableEmail: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-green-600" />
                <span className="font-medium text-slate-900">WhatsApp</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={globalSettings.enableWhatsApp}
                  onChange={(e) => setGlobalSettings(prev => ({ ...prev, enableWhatsApp: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-orange-600" />
                <span className="font-medium text-slate-900">SMS</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={globalSettings.enableSMS}
                  onChange={(e) => setGlobalSettings(prev => ({ ...prev, enableSMS: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-purple-600" />
                <span className="font-medium text-slate-900">Notificações Push</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={globalSettings.enablePush}
                  onChange={(e) => setGlobalSettings(prev => ({ ...prev, enablePush: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
          </div>

          {/* Quiet Hours */}
          <div className="mt-6 pt-6 border-t border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {globalSettings.quietHours ? (
                  <VolumeX className="w-5 h-5 text-slate-600" />
                ) : (
                  <Volume2 className="w-5 h-5 text-slate-600" />
                )}
                <div>
                  <p className="font-medium text-slate-900">Horário de Silêncio</p>
                  <p className="text-sm text-slate-500">Não enviar notificações durante período específico</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={globalSettings.quietHours}
                  onChange={(e) => setGlobalSettings(prev => ({ ...prev, quietHours: e.target.checked }))}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            {globalSettings.quietHours && (
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Início</label>
                  <input
                    type="time"
                    value={globalSettings.quietStart}
                    onChange={(e) => setGlobalSettings(prev => ({ ...prev, quietStart: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Fim</label>
                  <input
                    type="time"
                    value={globalSettings.quietEnd}
                    onChange={(e) => setGlobalSettings(prev => ({ ...prev, quietEnd: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Notification Types */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[1fr_80px_80px_80px_80px] gap-4 p-4 bg-slate-50 border-b border-slate-200">
            <div className="font-bold text-slate-900">Tipo de Notificação</div>
            <div className="text-center">
              <Mail className="w-5 h-5 text-blue-600 mx-auto mb-1" />
              <p className="text-xs font-medium text-slate-700">Email</p>
            </div>
            <div className="text-center">
              <MessageSquare className="w-5 h-5 text-green-600 mx-auto mb-1" />
              <p className="text-xs font-medium text-slate-700">WhatsApp</p>
            </div>
            <div className="text-center">
              <Smartphone className="w-5 h-5 text-orange-600 mx-auto mb-1" />
              <p className="text-xs font-medium text-slate-700">SMS</p>
            </div>
            <div className="text-center">
              <Bell className="w-5 h-5 text-purple-600 mx-auto mb-1" />
              <p className="text-xs font-medium text-slate-700">Push</p>
            </div>
          </div>

          {/* Notification Rows */}
          {notificationTypes.map((notif, index) => (
            <div
              key={notif.id}
              className={`grid grid-cols-[1fr_80px_80px_80px_80px] gap-4 p-4 hover:bg-slate-50 transition-colors ${
                index < notificationTypes.length - 1 ? 'border-b border-slate-200' : ''
              }`}
            >
              <div>
                <p className="font-medium text-slate-900">{notif.title}</p>
                <p className="text-sm text-slate-500">{notif.description}</p>
              </div>
              <div className="flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={notif.channels.email}
                  onChange={() => toggleChannel(notif.id, 'email')}
                  className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                />
              </div>
              <div className="flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={notif.channels.whatsapp}
                  onChange={() => toggleChannel(notif.id, 'whatsapp')}
                  className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                />
              </div>
              <div className="flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={notif.channels.sms}
                  onChange={() => toggleChannel(notif.id, 'sms')}
                  className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                />
              </div>
              <div className="flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={notif.channels.push}
                  onChange={() => toggleChannel(notif.id, 'push')}
                  className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          <button className="px-6 py-2.5 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button className="flex items-center gap-2 bg-purple-600 text-white px-6 py-2.5 rounded-lg hover:bg-purple-700 transition-colors">
            <Save className="w-5 h-5" />
            Salvar Configurações
          </button>
        </div>
      </div>
    </div>
  );
}
