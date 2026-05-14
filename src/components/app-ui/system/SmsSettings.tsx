import { Smartphone, CreditCard, DollarSign, TrendingUp, Save, Plus, AlertCircle } from 'lucide-react';
import { useState } from 'react';

export function SmsSettings() {
  const [provider, setProvider] = useState('twilio');
  const [config, setConfig] = useState({
    twilioAccountSid: '',
    twilioAuthToken: '',
    twilioPhoneNumber: '',
    senderName: 'IgrejaEx',
  });

  const smsStats = {
    sent: 1245,
    delivered: 1198,
    failed: 47,
    balance: 850,
    costPerSms: 0.15,
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-slate-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Configurações de SMS</h1>
            <p className="text-slate-600 dark:text-slate-400">Provedor e créditos de SMS</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl space-y-6">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mb-1">{smsStats.sent.toLocaleString()}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Enviados (mês)</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mb-1">
              {((smsStats.delivered / smsStats.sent) * 100).toFixed(1)}%
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Taxa de Entrega</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mb-1">{smsStats.balance}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Créditos Restantes</p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-orange-600" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 mb-1">R$ {smsStats.costPerSms.toFixed(2)}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">Custo por SMS</p>
          </div>
        </div>

        {/* Balance Alert */}
        {smsStats.balance < 100 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-orange-900 mb-1">Créditos baixos</p>
                <p className="text-sm text-orange-700 mb-3">
                  Você tem apenas {smsStats.balance} créditos restantes. Recarregue agora para continuar enviando SMS.
                </p>
                <button className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors text-sm">
                  <Plus className="w-4 h-4" />
                  Comprar Créditos
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Provider Selection */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-6">Provedor de SMS</h3>

          <div className="grid md:grid-cols-3 gap-4">
            <button
              onClick={() => setProvider('twilio')}
              className={`p-4 border-2 rounded-lg transition-all text-left ${
                provider === 'twilio'
                  ? 'border-purple-600 bg-purple-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="font-bold text-slate-900 mb-1">Twilio</div>
              <p className="text-xs text-slate-600 mb-2">R$ 0,15 por SMS</p>
              {provider === 'twilio' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-semibold">
                  Selecionado
                </span>
              )}
            </button>

            <button
              onClick={() => setProvider('zenvia')}
              className={`p-4 border-2 rounded-lg transition-all text-left ${
                provider === 'zenvia'
                  ? 'border-purple-600 bg-purple-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="font-bold text-slate-900 mb-1">Zenvia</div>
              <p className="text-xs text-slate-600 mb-2">R$ 0,12 por SMS</p>
              {provider === 'zenvia' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-semibold">
                  Selecionado
                </span>
              )}
            </button>

            <button
              onClick={() => setProvider('totalvoice')}
              className={`p-4 border-2 rounded-lg transition-all text-left ${
                provider === 'totalvoice'
                  ? 'border-purple-600 bg-purple-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="font-bold text-slate-900 mb-1">TotalVoice</div>
              <p className="text-xs text-slate-600 mb-2">R$ 0,13 por SMS</p>
              {provider === 'totalvoice' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-semibold">
                  Selecionado
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Twilio Configuration */}
        {provider === 'twilio' && (
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-6">Configuração do Twilio</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Account SID
                </label>
                <input
                  type="text"
                  value={config.twilioAccountSid}
                  onChange={(e) => setConfig(prev => ({ ...prev, twilioAccountSid: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Auth Token
                </label>
                <input
                  type="password"
                  value={config.twilioAuthToken}
                  onChange={(e) => setConfig(prev => ({ ...prev, twilioAuthToken: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="••••••••••••••••••••••••••••••••"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Número de Telefone Twilio
                </label>
                <input
                  type="text"
                  value={config.twilioPhoneNumber}
                  onChange={(e) => setConfig(prev => ({ ...prev, twilioPhoneNumber: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="+1234567890"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Número fornecido pelo Twilio para envio de SMS
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Sender Settings */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-6">Configurações do Remetente</h3>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Nome do Remetente
            </label>
            <input
              type="text"
              value={config.senderName}
              onChange={(e) => setConfig(prev => ({ ...prev, senderName: e.target.value }))}
              maxLength={11}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              placeholder="IgrejaEx"
            />
            <p className="text-xs text-slate-500 mt-1">
              Máximo de 11 caracteres. Será exibido como remetente do SMS.
            </p>
          </div>
        </div>

        {/* Advanced Options */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-bold text-slate-900 mb-4">Opções Avançadas</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Permitir SMS Unicode</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Suporte para emojis e caracteres especiais (custo maior)</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Relatório de Entrega</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Receber confirmação de entrega de cada SMS</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900">Alerta de Créditos Baixos</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">Notificar quando créditos estiverem abaixo de 100</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Purchase Credits */}
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border border-purple-200 p-6">
          <h3 className="font-bold text-slate-900 mb-4">Comprar Créditos</h3>
          
          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <button className="bg-white border-2 border-slate-200 hover:border-purple-300 rounded-xl p-4 transition-all">
              <p className="text-2xl font-bold text-slate-900 mb-1">500</p>
              <p className="text-sm text-slate-600 mb-2">créditos</p>
              <p className="text-lg font-bold text-purple-600">R$ 75,00</p>
            </button>

            <button className="bg-white border-2 border-purple-300 hover:border-purple-400 rounded-xl p-4 transition-all relative overflow-hidden">
              <span className="absolute top-2 right-2 px-2 py-1 bg-green-500 text-white text-xs font-bold rounded">
                Popular
              </span>
              <p className="text-2xl font-bold text-slate-900 mb-1">1000</p>
              <p className="text-sm text-slate-600 mb-2">créditos</p>
              <p className="text-lg font-bold text-purple-600">R$ 135,00</p>
            </button>

            <button className="bg-white border-2 border-slate-200 hover:border-purple-300 rounded-xl p-4 transition-all">
              <p className="text-2xl font-bold text-slate-900 mb-1">2500</p>
              <p className="text-sm text-slate-600 mb-2">créditos</p>
              <p className="text-lg font-bold text-purple-600">R$ 300,00</p>
            </button>
          </div>

          <button className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors">
            <CreditCard className="w-5 h-5" />
            Comprar Créditos
          </button>
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
